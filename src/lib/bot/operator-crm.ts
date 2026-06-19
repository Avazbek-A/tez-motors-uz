/**
 * In-Telegram operator CRM — a button-driven, edit-in-place CRM for the dealer,
 * so the daily work (leads, orders, tasks) is doable in chat without opening the
 * web admin. Operator-gated by the caller (isOperatorChat). Renders in Russian.
 *
 * Navigation edits the same message (one tidy "screen"); data actions reuse the
 * real business logic — advanceOrder() fires the same customer notify + audit as
 * the web admin, status changes are audit-logged. callback_data stays < 64 bytes
 * ("crm|<view>|<id>"). Customer lookup + search are force_reply flows carrying a
 * marker, recognised back in the webhook.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { escapeHtml } from "@/lib/escape-html";
import { logAdminAction } from "@/lib/audit";
import { contactKey } from "@/lib/crm";
import { normalizePhone } from "@/lib/customer-auth";
import { advanceOrder, nextOrderStatus, type OrderRow } from "@/lib/copilot/actions";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";

export const CRM_CUST_MARKER = "[crm:cust]";
export const CRM_SEARCH_MARKER = "[crm:search]";
const PAGE = 6;
const ACTOR = { email: "operator:telegram" };
const TG = "https://api.telegram.org";
const HOT = 70; // lead_score ≥ this → 🔥 hot

type Btn = { text: string; url?: string; callback_data?: string };
type InlineKb = { inline_keyboard: Btn[][] };

interface CrmCb {
  id: string;
  data?: string;
  from?: { language_code?: string };
  message?: { chat?: { id: number }; message_id?: number };
}

// ---- Telegram API (self-contained; fail-open) ------------------------------
async function api(method: string, body: Record<string, unknown>): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`${TG}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    /* fail-open */
  }
}
const answer = (id: string, text?: string) => api("answerCallbackQuery", { callback_query_id: id, ...(text ? { text } : {}) });
const edit = (chatId: number, messageId: number, text: string, markup?: InlineKb) =>
  api("editMessageText", { chat_id: chatId, message_id: messageId, text, parse_mode: "HTML", disable_web_page_preview: true, ...(markup ? { reply_markup: markup } : {}) });
const send = (chatId: number, text: string, markup?: object) =>
  api("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...(markup ? { reply_markup: markup } : {}) });

// ---- Helpers ---------------------------------------------------------------
function ago(iso?: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}м`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}ч`;
  return `${Math.floor(h / 24)}д`;
}
function waUrl(phone?: string | null): string | null {
  const d = (phone || "").replace(/\D/g, "");
  if (!d) return null;
  return `https://wa.me/${d.length === 9 ? "998" + d : d}`;
}
const hotTag = (score: unknown): string => (typeof score === "number" && score >= HOT ? `🔥${score} ` : "");
const LEAD_STATUS = { new: "🆕 Новая", contacted: "📞 Связались", in_progress: "🔄 В работе", closed: "✅ Закрыта" } as const;
const LEAD_EMOJI = { new: "🆕", contacted: "📞", in_progress: "🔄", closed: "✅" } as const;
const ORD = ORDER_STATUS_LABELS.ru;
const homeBtn: Btn = { text: "🔙 CRM", callback_data: "crm|home" };

function pager(view: string, page: number, count: number, back: Btn): Btn[] {
  const row: Btn[] = [];
  if (page > 0) row.push({ text: "◀️", callback_data: `crm|${view}|${page - 1}` });
  if ((page + 1) * PAGE < count) row.push({ text: "▶️", callback_data: `crm|${view}|${page + 1}` });
  row.push(back);
  return row;
}

// ---- Home ------------------------------------------------------------------
export function crmHome(): { text: string; markup: InlineKb } {
  return {
    text: "🗂 <b>CRM</b> — выберите раздел:",
    markup: { inline_keyboard: [
      [{ text: "📥 Заявки", callback_data: "crm|leads|0" }, { text: "📦 Заказы", callback_data: "crm|orders|0" }],
      [{ text: "✅ Задачи", callback_data: "crm|tasks|0" }, { text: "👤 Найти клиента", callback_data: "crm|cust" }],
      [{ text: "🔎 Поиск (имя / телефон / TM-…)", callback_data: "crm|srch" }],
    ] },
  };
}

// ---- Leads -----------------------------------------------------------------
async function leadsList(supabase: SupabaseClient, chatId: number, msgId: number, page: number) {
  const { data, count } = await supabase
    .from("inquiries")
    .select("id, name, type, status, lead_score, created_at", { count: "exact" })
    .in("status", ["new", "contacted", "in_progress"])
    .order("lead_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(page * PAGE, page * PAGE + PAGE - 1);
  const rows: Btn[][] = (data || []).map((i) => [{
    text: `${hotTag(i.lead_score)}${LEAD_EMOJI[(i.status as keyof typeof LEAD_EMOJI)] || "•"} ${i.name || "—"} · ${i.type || "lead"} · ${ago(i.created_at as string)}`,
    callback_data: `crm|lead|${i.id}`,
  }]);
  rows.push(pager("leads", page, count || 0, homeBtn));
  await edit(chatId, msgId, `📥 <b>Заявки</b> — открытых: ${count ?? 0}  (🔥 горячие сверху)`, { inline_keyboard: rows });
}

async function leadDetail(supabase: SupabaseClient, chatId: number, msgId: number, id: string) {
  const { data: i } = await supabase
    .from("inquiries")
    .select("id, name, phone, type, message, source_page, status, lead_score, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!i) { await edit(chatId, msgId, "Заявка не найдена.", { inline_keyboard: [[{ text: "🔙 К заявкам", callback_data: "crm|leads|0" }]] }); return; }
  // Cross-link: does this lead already have an order?
  const { data: ord } = await supabase.from("orders").select("id, reference_code, status").eq("inquiry_id", id).order("created_at", { ascending: false }).maybeSingle();
  const lines = [
    `📥 <b>${escapeHtml((i.name as string) || "—")}</b>${hotTag(i.lead_score) ? ` · ${hotTag(i.lead_score)}` : ""}`,
    `📱 ${escapeHtml((i.phone as string) || "—")}`,
    `🏷 ${escapeHtml((i.type as string) || "lead")} · ${LEAD_STATUS[(i.status as keyof typeof LEAD_STATUS)] || i.status}`,
    i.source_page ? `🌐 ${escapeHtml(i.source_page as string)}` : "",
    `🕒 ${ago(i.created_at as string)} назад`,
    i.message ? `\n💬 ${escapeHtml((i.message as string).slice(0, 600))}` : "",
  ].filter(Boolean);
  const wa = waUrl(i.phone as string);
  const kb: Btn[][] = [];
  if (wa) kb.push([{ text: "💬 WhatsApp", url: wa }]);
  kb.push([{ text: "📞 Связались", callback_data: `crm|lst|${id}|contacted` }, { text: "🔄 В работе", callback_data: `crm|lst|${id}|in_progress` }]);
  kb.push([{ text: "📝 Задача", callback_data: `crm|ltask|${id}` }, { text: "✅ Закрыть", callback_data: `crm|lst|${id}|closed` }]);
  if (ord) kb.push([{ text: `📦 Заказ ${ord.reference_code} · ${ORD[ord.status as string] || ord.status}`, callback_data: `crm|order|${ord.id}` }]);
  kb.push([{ text: "🔙 К заявкам", callback_data: "crm|leads|0" }]);
  await edit(chatId, msgId, lines.join("\n"), { inline_keyboard: kb });
}

async function leadSetStatus(supabase: SupabaseClient, cb: CrmCb, id: string, status: string) {
  await supabase.from("inquiries").update({ status }).eq("id", id);
  logAdminAction(null, { action: "status_change", entity: "inquiry", entity_id: id, actor: ACTOR, diff: { to: status, via: "telegram" } }).catch(() => {});
  await answer(cb.id, `✅ ${LEAD_STATUS[status as keyof typeof LEAD_STATUS] || status}`);
  await leadDetail(supabase, cb.message!.chat!.id, cb.message!.message_id!, id);
}

async function leadToTask(supabase: SupabaseClient, cb: CrmCb, id: string) {
  const { data: i } = await supabase.from("inquiries").select("name, phone").eq("id", id).maybeSingle();
  if (!i) { await answer(cb.id, "Заявка не найдена"); return; }
  const phone = (i.phone as string) || "";
  const { error } = await supabase.from("crm_tasks").upsert({
    title: `Перезвонить: ${(i.name as string) || phone}`,
    kind: "follow_up",
    customer_key: contactKey(phone),
    customer_phone: phone,
    customer_name: (i.name as string) || null,
    inquiry_id: id,
    due_at: new Date().toISOString(),
    status: "open",
    auto_source: `tg:lead:${id}`,
  }, { onConflict: "auto_source", ignoreDuplicates: true });
  await answer(cb.id, error ? "Не удалось создать задачу" : "✅ Задача создана");
}

// ---- Orders ----------------------------------------------------------------
async function ordersList(supabase: SupabaseClient, chatId: number, msgId: number, page: number) {
  const { data, count } = await supabase
    .from("orders")
    .select("id, reference_code, customer_name, status, created_at", { count: "exact" })
    .neq("status", "delivered")
    .order("created_at", { ascending: false })
    .range(page * PAGE, page * PAGE + PAGE - 1);
  const rows: Btn[][] = (data || []).map((o) => [{
    text: `${o.reference_code} · ${(o.customer_name as string) || "—"} · ${ORD[o.status as string] || o.status}`,
    callback_data: `crm|order|${o.id}`,
  }]);
  rows.push(pager("orders", page, count || 0, homeBtn));
  await edit(chatId, msgId, `📦 <b>Заказы</b> — активных: ${count ?? 0}`, { inline_keyboard: rows });
}

type FullOrder = OrderRow & { customer_name: string | null; amount_usd: number | null; inquiry_id: string | null };
async function loadOrder(supabase: SupabaseClient, id: string): Promise<FullOrder | null> {
  const { data } = await supabase
    .from("orders")
    .select("id, reference_code, status, customer_name, customer_email, customer_phone, amount_usd, inquiry_id, locale, cars(brand, model, year)")
    .eq("id", id)
    .maybeSingle();
  return (data as FullOrder | null) || null;
}

async function orderDetail(supabase: SupabaseClient, chatId: number, msgId: number, id: string) {
  const o = await loadOrder(supabase, id);
  if (!o) { await edit(chatId, msgId, "Заказ не найден.", { inline_keyboard: [[{ text: "🔙 К заказам", callback_data: "crm|orders|0" }]] }); return; }
  const car = Array.isArray(o.cars) ? o.cars[0] : o.cars;
  const lines = [
    `📦 <b>${escapeHtml(o.reference_code)}</b>`,
    `👤 ${escapeHtml(o.customer_name || "—")} · ${escapeHtml(o.customer_phone || "—")}`,
    car ? `🚗 ${escapeHtml(`${car.brand} ${car.model} ${car.year}`)}` : "",
    `📊 ${ORD[o.status] || o.status}`,
    o.amount_usd != null ? `💰 $${Number(o.amount_usd).toLocaleString("en-US")}` : "",
  ].filter(Boolean);
  const next = nextOrderStatus(o.status);
  const wa = waUrl(o.customer_phone);
  const kb: Btn[][] = [];
  if (next) kb.push([{ text: `➡️ ${ORD[next] || next}`, callback_data: `crm|oadv|${id}` }]);
  if (wa) kb.push([{ text: "💬 WhatsApp", url: wa }]);
  if (o.inquiry_id) kb.push([{ text: "📥 Открыть заявку", callback_data: `crm|lead|${o.inquiry_id}` }]);
  kb.push([{ text: "🔙 К заказам", callback_data: "crm|orders|0" }]);
  await edit(chatId, msgId, lines.join("\n"), { inline_keyboard: kb });
}

async function orderAdvance(supabase: SupabaseClient, cb: CrmCb, id: string) {
  const o = await loadOrder(supabase, id);
  if (!o) { await answer(cb.id, "Заказ не найден"); return; }
  const next = nextOrderStatus(o.status);
  if (!next) { await answer(cb.id, "Заказ уже доставлен"); return; }
  const res = await advanceOrder(supabase, o, next);
  await answer(cb.id, res.ok ? `✅ ${ORD[next] || next}` : res.message.slice(0, 190));
  await orderDetail(supabase, cb.message!.chat!.id, cb.message!.message_id!, id);
}

// ---- Tasks -----------------------------------------------------------------
async function tasksList(supabase: SupabaseClient, chatId: number, msgId: number, page: number) {
  const { data, count } = await supabase
    .from("crm_tasks")
    .select("id, title, due_at", { count: "exact" })
    .eq("status", "open")
    .order("due_at", { ascending: true, nullsFirst: false })
    .range(page * PAGE, page * PAGE + PAGE - 1);
  const rows: Btn[][] = (data || []).map((t) => [
    { text: `📋 ${(t.title as string || "—").slice(0, 40)}`, callback_data: `crm|task|${t.id}` },
    { text: "✅", callback_data: `crm|tdone|${t.id}` },
  ]);
  rows.push(pager("tasks", page, count || 0, homeBtn));
  await edit(chatId, msgId, `✅ <b>Задачи</b> — открытых: ${count ?? 0}`, { inline_keyboard: rows });
}

async function taskDetail(supabase: SupabaseClient, chatId: number, msgId: number, id: string) {
  const { data: t } = await supabase.from("crm_tasks").select("id, title, kind, customer_name, customer_phone, due_at, status").eq("id", id).maybeSingle();
  if (!t) { await edit(chatId, msgId, "Задача не найдена.", { inline_keyboard: [[{ text: "🔙 К задачам", callback_data: "crm|tasks|0" }]] }); return; }
  const wa = waUrl(t.customer_phone as string);
  const lines = [
    `✅ <b>${escapeHtml((t.title as string) || "—")}</b>`,
    t.customer_name ? `👤 ${escapeHtml(t.customer_name as string)}` : "",
    t.customer_phone ? `📱 ${escapeHtml(t.customer_phone as string)}` : "",
    t.due_at ? `🕒 срок: ${new Date(t.due_at as string).toLocaleDateString("ru-RU")}` : "",
  ].filter(Boolean);
  const kb: Btn[][] = [];
  if (wa) kb.push([{ text: "💬 WhatsApp", url: wa }]);
  kb.push([{ text: "✅ Выполнено", callback_data: `crm|tdone|${id}` }, { text: "😴 +1 день", callback_data: `crm|tsnz|${id}` }]);
  kb.push([{ text: "🔙 К задачам", callback_data: "crm|tasks|0" }]);
  await edit(chatId, msgId, lines.join("\n"), { inline_keyboard: kb });
}

async function taskDone(supabase: SupabaseClient, cb: CrmCb, id: string) {
  await supabase.from("crm_tasks").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", id);
  logAdminAction(null, { action: "status_change", entity: "crm_task", entity_id: id, actor: ACTOR, diff: { to: "done", via: "telegram" } }).catch(() => {});
  await answer(cb.id, "✅ Готово");
  await tasksList(supabase, cb.message!.chat!.id, cb.message!.message_id!, 0);
}

async function taskSnooze(supabase: SupabaseClient, cb: CrmCb, id: string) {
  const due = new Date(Date.now() + 86_400_000).toISOString();
  await supabase.from("crm_tasks").update({ due_at: due, status: "open" }).eq("id", id);
  await answer(cb.id, "😴 Отложено на завтра");
  await tasksList(supabase, cb.message!.chat!.id, cb.message!.message_id!, 0);
}

// ---- Search (leads / orders / customers by name·phone·TM-ref) --------------
export async function handleCrmSearch(supabase: SupabaseClient, chatId: number, query: string) {
  const q = query.trim().slice(0, 60);
  if (q.length < 2) { await send(chatId, "Введите минимум 2 символа для поиска."); return; }
  // PostgREST .or() logic-tree: ilike wildcard is *, and , ( ) % break the string.
  const safe = q.replace(/[,()*%]/g, " ").trim();
  const digits = q.replace(/\D/g, "");
  const [inq, ord] = await Promise.all([
    supabase.from("inquiries")
      .select("id, name, phone, type, status")
      .or(`name.ilike.*${safe}*${digits.length >= 4 ? `,phone.ilike.*${digits}*` : ""}`)
      .order("created_at", { ascending: false }).limit(6),
    supabase.from("orders")
      .select("id, reference_code, customer_name, status")
      .or(`reference_code.ilike.*${safe}*,customer_name.ilike.*${safe}*${digits.length >= 4 ? `,customer_phone.ilike.*${digits}*` : ""}`)
      .order("created_at", { ascending: false }).limit(6),
  ]);
  const kb: Btn[][] = [];
  for (const i of inq.data || []) kb.push([{ text: `📥 ${i.name || "—"} · ${i.type || "lead"}`, callback_data: `crm|lead|${i.id}` }]);
  for (const o of ord.data || []) kb.push([{ text: `📦 ${o.reference_code} · ${o.customer_name || "—"}`, callback_data: `crm|order|${o.id}` }]);
  if (!kb.length) { await send(chatId, `🔎 По запросу «${escapeHtml(q)}» ничего не найдено.`); return; }
  kb.push([homeBtn]);
  await send(chatId, `🔎 Результаты по «${escapeHtml(q)}»:`, { inline_keyboard: kb });
}

// ---- Customer lookup -------------------------------------------------------
export async function handleCrmCustomerLookup(supabase: SupabaseClient, chatId: number, phoneText: string) {
  const phone = normalizePhone(phoneText) || phoneText.trim();
  const { data: c } = await supabase
    .from("customers")
    .select("name, phone, telegram_id, locale, created_at")
    .eq("phone", phone)
    .maybeSingle();
  const [{ count: inq }, { data: orders }] = await Promise.all([
    supabase.from("inquiries").select("id", { count: "exact", head: true }).eq("phone", phone),
    supabase.from("orders").select("reference_code, status").eq("customer_phone", phone).order("created_at", { ascending: false }).limit(3),
  ]);
  const wa = waUrl(phone);
  if (!c && !(orders || []).length && !inq) {
    await send(chatId, `👤 Клиент с номером <b>${escapeHtml(phone)}</b> не найден.`, wa ? { inline_keyboard: [[{ text: "💬 Написать в WhatsApp", url: wa }]] } : undefined);
    return;
  }
  const lines = [
    `👤 <b>${escapeHtml(c?.name as string || "Клиент")}</b>`,
    `📱 ${escapeHtml(phone)}${c?.telegram_id ? " · ✈️ Telegram привязан" : ""}`,
    `📥 Заявок: ${inq ?? 0} · 📦 Заказов: ${(orders || []).length}`,
    ...(orders || []).map((o) => `   • ${o.reference_code} — ${ORD[o.status as string] || o.status}`),
  ];
  await send(chatId, lines.join("\n"), wa ? { inline_keyboard: [[{ text: "💬 WhatsApp", url: wa }]] } : undefined);
}

// ---- Dispatch --------------------------------------------------------------
export async function handleCrmCallback(supabase: SupabaseClient, cb: CrmCb): Promise<void> {
  const chatId = cb.message?.chat?.id;
  const msgId = cb.message?.message_id;
  const parts = (cb.data || "").split("|"); // crm|<view>|<arg>|<arg2>
  const view = parts[1] || "home";
  if (!chatId || !msgId) { await answer(cb.id); return; }

  try {
    switch (view) {
      case "home": { await answer(cb.id); const h = crmHome(); await edit(chatId, msgId, h.text, h.markup); return; }
      case "leads": await answer(cb.id); return void (await leadsList(supabase, chatId, msgId, parseInt(parts[2] || "0", 10) || 0));
      case "lead": await answer(cb.id); return void (await leadDetail(supabase, chatId, msgId, parts[2]));
      case "lst": return void (await leadSetStatus(supabase, cb, parts[2], parts[3]));
      case "ltask": return void (await leadToTask(supabase, cb, parts[2]));
      case "orders": await answer(cb.id); return void (await ordersList(supabase, chatId, msgId, parseInt(parts[2] || "0", 10) || 0));
      case "order": await answer(cb.id); return void (await orderDetail(supabase, chatId, msgId, parts[2]));
      case "oadv": return void (await orderAdvance(supabase, cb, parts[2]));
      case "tasks": await answer(cb.id); return void (await tasksList(supabase, chatId, msgId, parseInt(parts[2] || "0", 10) || 0));
      case "task": await answer(cb.id); return void (await taskDetail(supabase, chatId, msgId, parts[2]));
      case "tdone": return void (await taskDone(supabase, cb, parts[2]));
      case "tsnz": return void (await taskSnooze(supabase, cb, parts[2]));
      case "cust":
        await answer(cb.id);
        await send(chatId, `👤 ${CRM_CUST_MARKER}\nОтправьте номер телефона клиента ответом на это сообщение:`, { force_reply: true, input_field_placeholder: "+998 ..." });
        return;
      case "srch":
        await answer(cb.id);
        await send(chatId, `🔎 ${CRM_SEARCH_MARKER}\nОтправьте имя, телефон или номер заказа (TM-…) ответом на это сообщение:`, { force_reply: true, input_field_placeholder: "Иван / 901234567 / TM-..." });
        return;
      default: await answer(cb.id); return;
    }
  } catch {
    await answer(cb.id, "Ошибка. Попробуйте ещё раз.");
  }
}
