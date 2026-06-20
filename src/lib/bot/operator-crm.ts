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
import { advanceOrder, nextOrderStatus, resolveCar, computeMarkdownPrice, applyCarMarkdown, type OrderRow, type CarRow } from "@/lib/copilot/actions";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import { sendBotMessage } from "@/lib/telegram";
import { reserveCarAndCreateOrder } from "@/lib/reservation";

export const CRM_CUST_MARKER = "[crm:cust]";
export const CRM_SEARCH_MARKER = "[crm:search]";
export const CRM_REPLY_MARKER = "[crm:reply:";
export const CRM_NOTE_MARKER = "[crm:note:";
export const CRM_CAR_MARKER = "[crm:car]";
export const CRM_WALKIN_MARKER = "[crm:walkin:";
const PAGE = 6;
const ACTOR = { email: "operator:telegram" };
const TG = "https://api.telegram.org";
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://tezmotors.uz").replace(/\/$/, "");
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
      [{ text: "🚗 Авто (наличие / цена)", callback_data: "crm|cars" }],
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
    .select("id, name, phone, type, message, source_page, status, lead_score, notes, created_at")
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
    i.notes ? `\n🗒 <b>Заметки:</b>\n${escapeHtml(String(i.notes).slice(-700))}` : "",
  ].filter(Boolean);
  const wa = waUrl(i.phone as string);
  const ph = String((i.phone as string) || "").replace(/\D/g, "");
  const kb: Btn[][] = [];
  const contactRow: Btn[] = [];
  if (wa) contactRow.push({ text: "💬 WhatsApp", url: wa });
  if (ph) contactRow.push({ text: "✍️ Ответить", callback_data: `crm|reply|${ph}` });
  if (contactRow.length) kb.push(contactRow);
  kb.push([{ text: "📞 Связались", callback_data: `crm|lst|${id}|contacted` }, { text: "🔄 В работе", callback_data: `crm|lst|${id}|in_progress` }]);
  kb.push([{ text: "📝 Задача", callback_data: `crm|ltask|${id}` }, { text: "✅ Закрыть", callback_data: `crm|lst|${id}|closed` }]);
  kb.push([{ text: "🗒 Заметка", callback_data: `crm|note|${id}` }]);
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
  const ph = String(o.customer_phone || "").replace(/\D/g, "");
  const kb: Btn[][] = [];
  if (next) kb.push([{ text: `➡️ ${ORD[next] || next}`, callback_data: `crm|oadv|${id}` }]);
  const contactRow: Btn[] = [];
  if (wa) contactRow.push({ text: "💬 WhatsApp", url: wa });
  if (ph) contactRow.push({ text: "✍️ Ответить", callback_data: `crm|reply|${ph}` });
  if (contactRow.length) kb.push(contactRow);
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
  const cr: Btn[] = [];
  if (wa) cr.push({ text: "💬 WhatsApp", url: wa });
  cr.push({ text: "✍️ Ответить", callback_data: `crm|reply|${phone.replace(/\D/g, "")}` });
  await send(chatId, lines.join("\n"), { inline_keyboard: [cr] });
}

// ---- Reply to the customer from chat ---------------------------------------
// The operator's reply to the force_reply prompt (which embeds the phone in
// CRM_REPLY_MARKER) is delivered to the customer: a Telegram DM if their account
// is linked (free, instant), otherwise a prefilled WhatsApp link the operator taps.
export async function handleCrmReply(supabase: SupabaseClient, operatorChatId: number, promptText: string, msg: string) {
  const m = promptText.match(/\[crm:reply:(\d+)\]/);
  const text = msg.trim().slice(0, 2000);
  if (!m || !text) { await send(operatorChatId, "Не удалось определить адресата или пустое сообщение."); return; }
  const phone = normalizePhone(m[1]) || m[1];
  const { data: c } = await supabase.from("customers").select("telegram_id, name").eq("phone", phone).maybeSingle();
  if (c?.telegram_id) {
    const res = await sendBotMessage(c.telegram_id as number, escapeHtml(text));
    if (res.ok) {
      await send(operatorChatId, `✅ Отправлено клиенту в Telegram${c.name ? ` (${escapeHtml(c.name as string)})` : ""}.`);
      return;
    }
  }
  const digits = (m[1] || "").replace(/\D/g, "");
  const wa = `https://wa.me/${digits.length === 9 ? "998" + digits : digits}?text=${encodeURIComponent(text)}`;
  await send(operatorChatId,
    c?.telegram_id ? "⚠️ Не доставлено в Telegram (клиент мог заблокировать бота). Отправьте через WhatsApp:" : "Клиент не привязан к Telegram. Отправьте через WhatsApp:",
    { inline_keyboard: [[{ text: "💬 Открыть WhatsApp с текстом", url: wa }]] });
}

// ---- Lead notes (append-only, timestamped) ---------------------------------
export async function handleCrmNote(supabase: SupabaseClient, operatorChatId: number, promptText: string, msg: string) {
  const m = promptText.match(/\[crm:note:([a-f0-9-]{8,64})\]/i);
  const note = msg.trim().slice(0, 1000);
  if (!m || !note) { await send(operatorChatId, "Не удалось определить заявку или пустая заметка."); return; }
  const id = m[1];
  const { data: i } = await supabase.from("inquiries").select("notes, name").eq("id", id).maybeSingle();
  if (!i) { await send(operatorChatId, "Заявка не найдена."); return; }
  const stamp = new Date().toLocaleString("ru-RU", { timeZone: "Asia/Tashkent", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const existing = (i.notes as string) || "";
  // Keep the field bounded — retain the most recent ~4000 chars of history.
  const merged = `${existing ? existing + "\n" : ""}[${stamp}] ${note}`.slice(-4000);
  await supabase.from("inquiries").update({ notes: merged }).eq("id", id);
  logAdminAction(null, { action: "update", entity: "inquiry", entity_id: id, actor: ACTOR, diff: { added_note: note.slice(0, 80), via: "telegram" } }).catch(() => {});
  await send(operatorChatId, `🗒 Заметка добавлена к «${escapeHtml((i.name as string) || "заявке")}».`, { inline_keyboard: [[{ text: "📥 Открыть заявку", callback_data: `crm|lead|${id}` }]] });
}

// ---- Inventory (operator): look up a car, quick-markdown, reserve walk-in ---
function carCard(c: CarRow): { text: string; markup: InlineKb } {
  const status = c.inventory_status === "reserved" ? "🔒 бронь" : c.inventory_status === "sold" ? "❌ продан" : "✅ в наличии";
  const orig = c.original_price_usd && c.original_price_usd > c.price_usd ? ` (было $${c.original_price_usd.toLocaleString("en-US")})` : "";
  const text = [
    `🚗 <b>${escapeHtml(`${c.brand} ${c.model} ${c.year ?? ""}`.trim())}</b>`,
    `💰 $${c.price_usd.toLocaleString("en-US")}${orig}`,
    `📦 ${status}`,
  ].join("\n");
  const kb: Btn[][] = [];
  if (c.inventory_status !== "sold") {
    kb.push([{ text: "💰 −5%", callback_data: `crm|cmd|${c.id}|5` }, { text: "💰 −10%", callback_data: `crm|cmd|${c.id}|10` }]);
    kb.push([{ text: "🔖 Бронь для клиента", callback_data: `crm|crsv|${c.id}` }]);
  }
  kb.push([{ text: "🌐 На сайте", url: `${SITE}/ru/catalog/${c.slug}` }, homeBtn]);
  return { text, markup: { inline_keyboard: kb } };
}

async function loadCarRow(supabase: SupabaseClient, id: string): Promise<CarRow | null> {
  const { data } = await supabase
    .from("cars")
    .select("id, slug, brand, model, year, price_usd, original_price_usd, inventory_status")
    .eq("id", id)
    .maybeSingle();
  return (data as CarRow | null) || null;
}

async function carDetail(supabase: SupabaseClient, chatId: number, msgId: number, id: string) {
  const c = await loadCarRow(supabase, id);
  if (!c) { await edit(chatId, msgId, "Авто не найдено.", { inline_keyboard: [[homeBtn]] }); return; }
  const card = carCard(c);
  await edit(chatId, msgId, card.text, card.markup);
}

async function carMarkdown(supabase: SupabaseClient, cb: CrmCb, id: string, pct: number) {
  const c = await loadCarRow(supabase, id);
  if (!c) { await answer(cb.id, "Авто не найдено"); return; }
  const target = computeMarkdownPrice(c.price_usd, { pct });
  if (target == null) { await answer(cb.id, "Скидку нельзя применить"); return; }
  const res = await applyCarMarkdown(supabase, c, target);
  await answer(cb.id, res.ok ? `💰 −${pct}% → $${target.toLocaleString("en-US")}` : res.message.slice(0, 190));
  await carDetail(supabase, cb.message!.chat!.id, cb.message!.message_id!, id);
}

/** Operator searches inventory by name → match card or candidate list. */
export async function handleCrmCarSearch(supabase: SupabaseClient, chatId: number, query: string) {
  const q = query.trim().slice(0, 60);
  if (q.length < 2) { await send(chatId, "Введите марку/модель (минимум 2 символа)."); return; }
  const res = await resolveCar(supabase, q);
  if (res.match) { const card = carCard(res.match); await send(chatId, card.text, card.markup); return; }
  if (res.candidates?.length) {
    const rows: Btn[][] = res.candidates.map((c) => [{ text: `${c.brand} ${c.model} ${c.year ?? ""} — $${c.price_usd.toLocaleString("en-US")}`, callback_data: `crm|car|${c.id}` }]);
    rows.push([homeBtn]);
    await send(chatId, "🚗 Найдено несколько — выберите:", { inline_keyboard: rows });
    return;
  }
  await send(chatId, `🚗 «${escapeHtml(q)}» не найдено в наличии.`);
}

/** Operator reserves a car for a walk-in: name + phone parsed from the reply. */
export async function handleCrmWalkinReserve(supabase: SupabaseClient, operatorChatId: number, promptText: string, text: string) {
  const m = promptText.match(/\[crm:walkin:([a-f0-9-]{8,64})\]/i);
  if (!m) return;
  const carId = m[1];
  const phoneMatch = text.match(/\+?\d[\d\s()\-]{7,16}\d/);
  const phone = phoneMatch ? (normalizePhone(phoneMatch[0].replace(/\D/g, "")) || phoneMatch[0].replace(/\D/g, "")) : "";
  if (!phone) { await send(operatorChatId, "Укажите телефон клиента в сообщении."); return; }
  const name = (phoneMatch ? text.replace(phoneMatch[0], "") : text).trim().slice(0, 80) || "Клиент";
  const res = await reserveCarAndCreateOrder(supabase, { carId, name, phone, locale: "ru", attribution: { source: "telegram" }, sourcePage: "telegram-operator" });
  if (!res.ok) { await send(operatorChatId, "❌ Не удалось забронировать (возможно, авто уже занято)."); return; }
  logAdminAction(null, { action: "create", entity: "order", entity_id: null, actor: ACTOR, diff: { reference_code: res.referenceCode, walk_in: true, via: "telegram" } }).catch(() => {});
  await send(operatorChatId, `🔖 Забронировано для <b>${escapeHtml(name)}</b> (${escapeHtml(phone)}).\nЗаказ: <b>${escapeHtml(res.referenceCode || "—")}</b>`);
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
      case "cars":
        await answer(cb.id);
        await send(chatId, `🚗 ${CRM_CAR_MARKER}\nВведите марку/модель авто ответом на это сообщение:`, { force_reply: true, input_field_placeholder: "Tank 300 / BYD Han …" });
        return;
      case "car": await answer(cb.id); return void (await carDetail(supabase, chatId, msgId, parts[2]));
      case "cmd": return void (await carMarkdown(supabase, cb, parts[2], Number(parts[3]) || 0));
      case "crsv":
        await answer(cb.id);
        await send(chatId, `🔖 ${CRM_WALKIN_MARKER}${parts[2]}]\nИмя и телефон клиента ответом на это сообщение:`, { force_reply: true, input_field_placeholder: "Иван, +998 90 …" });
        return;
      case "reply":
        await answer(cb.id);
        await send(chatId, `✍️ ${CRM_REPLY_MARKER}${parts[2]}]\nНапишите сообщение клиенту ответом на это сообщение — отправлю в Telegram (если привязан), иначе дам ссылку WhatsApp:`, { force_reply: true, input_field_placeholder: "Сообщение клиенту…" });
        return;
      case "note":
        await answer(cb.id);
        await send(chatId, `🗒 ${CRM_NOTE_MARKER}${parts[2]}]\nНапишите заметку к заявке ответом на это сообщение:`, { force_reply: true, input_field_placeholder: "Текст заметки…" });
        return;
      default: await answer(cb.id); return;
    }
  } catch {
    await answer(cb.id, "Ошибка. Попробуйте ещё раз.");
  }
}
