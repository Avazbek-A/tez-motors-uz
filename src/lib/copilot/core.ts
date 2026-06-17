/**
 * Dealer Copilot — turn orchestration (Phase AE).
 *
 * runCopilotTurn ties together: confirm-gating (a WRITE never mutates on the first
 * turn — it proposes; the dealer's explicit "yes" executes the FROZEN payload),
 * the two-stage router (deterministic + optional LLM), read narration from the
 * operator context, and message memory. Fail-open throughout: no LLM → rules +
 * templates; store failure → stateless answer; executor error → safe message.
 *
 * Localized: user-facing replies follow the dealer's UI language (ru/uz/en).
 * The classifier understands all three (see router RULES) so suggestion buttons
 * in any language resolve. ActionResult success text from ./actions stays RU.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { llmText, llmConfigured } from "@/lib/llm";
import { gatherOperatorContext } from "@/lib/operator-data";
import { CAR_BRANDS } from "@/lib/constants";
import type { Locale } from "@/i18n/config";
import { classifyDeterministic, parseRouterResponse, mergeClassifications, routerSystemPrompt } from "./router";
import { isReadIntent, isWriteIntent, type ParsedIntent } from "./intents";
import {
  resolveCar, computeMarkdownPrice, applyCarMarkdown,
  resolveOrder, nextOrderStatus, advanceOrder,
  createDraftPo, splitBrandModel, type ActionResult,
} from "./actions";

const PENDING_TTL_MS = 10 * 60 * 1000;
// Token-boundary (NOT \b — ASCII-only, fails after Cyrillic да/нет) + \p{L}* suffix.
// Affirm/negate accept ru/en/uz ("ha" = yes, "yo'q"/"bekor" = no/cancel in UZ).
const AFFIRM = /^\s*(да|yes|ок|ok|ha|подтверж[\p{L}]*|давай|go|confirm|tasdiq[\p{L}]*|✅|👍)(?:\s|$|[.!,])/iu;
const NEGATE = /^\s*(нет|no|отмен[\p{L}]*|cancel|стоп|stop|yo['ʻʼ’]?q|bekor[\p{L}]*|to['ʻʼ’]?xta|❌)(?:\s|$|[.!,])/iu;

export interface CopilotTurn { reply: string; intent: string; proposed?: boolean; executed?: boolean; }

const brands = (() => { try { return CAR_BRANDS as readonly string[]; } catch { return [] as string[]; } })();

const usdFmt = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** Localized message dictionary. Pick by locale, fall back to RU. */
type Tri = Record<Locale, string>;
const pick = (t: Tri, locale: Locale) => t[locale] ?? t.ru;

const MSG = {
  noPending: { ru: "Нет действия для подтверждения.", uz: "Tasdiqlash uchun amal yo'q.", en: "No action to confirm." },
  cancelled: { ru: "Отменено.", uz: "Bekor qilindi.", en: "Cancelled." },
  nothingToCancel: { ru: "Нечего отменять.", uz: "Bekor qiladigan narsa yo'q.", en: "Nothing to cancel." },
  confirmSuffix: {
    ru: "Подтвердите: ответьте «да» (или «нет» для отмены).",
    uz: "Tasdiqlang: «ha» deb javob bering (yoki bekor qilish uchun «yo'q»).",
    en: 'Confirm: reply "yes" (or "no" to cancel).',
  },
  carNotFound: { ru: "Машина не найдена.", uz: "Mashina topilmadi.", en: "Car not found." },
  orderNotFound: { ru: "Заказ не найден.", uz: "Buyurtma topilmadi.", en: "Order not found." },
  unknownAction: { ru: "Неизвестное действие.", uz: "Noma'lum amal.", en: "Unknown action." },
  whichCar: { ru: "Какую машину уценить? Укажите модель.", uz: "Qaysi mashinaga chegirma? Modelni ko'rsating.", en: "Which car to mark down? Specify the model." },
  whichOrder: { ru: "Укажите код заказа (TM-XXXXXXXX).", uz: "Buyurtma kodini kiriting (TM-XXXXXXXX).", en: "Specify the order code (TM-XXXXXXXX)." },
  whatToOrder: { ru: "Что заказать у поставщика? Укажите марку и модель.", uz: "Yetkazib beruvchidan nima buyurtma qilish kerak? Marka va modelni ko'rsating.", en: "What to order from the supplier? Specify make and model." },
  noDemand: { ru: "Пока нет заметного спроса за последние 30 дней.", uz: "So'nggi 30 kunda sezilarli talab yo'q.", en: "No notable demand in the last 30 days." },
  noAged: { ru: "Нет машин, требующих уценки.", uz: "Chegirma talab qiladigan mashina yo'q.", en: "No cars need a markdown." },
} as const;

const HELP: Tri = {
  ru: "Я ваш ассистент по бизнесу. Спросите: «сколько денег», «какой спрос», «что залежалось», «новые заявки», «сводка». Действия (с подтверждением): «снизь цену на Tank 300 до $34000», «переведи заказ TM-XXXX в taможню», «закажи 3 BYD Han у поставщика».",
  uz: "Men sizning biznes-yordamchingizman. So'rang: «qancha pul», «qanday talab», «nima qolib ketgan», «yangi so'rovlar», «xulosa». Amallar (tasdiq bilan): «Tank 300 narxini $34000 ga tushir», «TM-XXXX buyurtmasini bojxonaga o'tkaz», «yetkazib beruvchidan 3 BYD Han buyurtma qil».",
  en: 'I\'m your business assistant. Ask: "how much money", "what\'s the demand", "what\'s sitting in stock", "new inquiries", "summary". Actions (with confirmation): "drop the Tank 300 price to $34000", "move order TM-XXXX to customs", "order 3 BYD Han from the supplier".',
};

// ---- read narration (deterministic templates from the operator context) ----
async function answerRead(supabase: SupabaseClient, intent: string, locale: Locale): Promise<string> {
  const c = await gatherOperatorContext(supabase);
  const u = usdFmt;
  switch (intent) {
    case "cash_position":
      return {
        ru: `💰 Деньги: выручка за месяц ${u(c.money.revenueMtdUsd)}, депозиты ${u(c.money.depositsUsd)}. Заморожено у поставщиков ${u(c.money.committedSupplierUsd)}. Потенциальная маржа на складе ${u(c.money.potentialMarginUsd)}.`,
        uz: `💰 Pul: oylik daromad ${u(c.money.revenueMtdUsd)}, depozitlar ${u(c.money.depositsUsd)}. Yetkazib beruvchilarda muzlatilgan ${u(c.money.committedSupplierUsd)}. Ombordagi potensial marja ${u(c.money.potentialMarginUsd)}.`,
        en: `💰 Money: revenue MTD ${u(c.money.revenueMtdUsd)}, deposits ${u(c.money.depositsUsd)}. Committed to suppliers ${u(c.money.committedSupplierUsd)}. Potential margin on the lot ${u(c.money.potentialMarginUsd)}.`,
      }[locale] ?? "";
    case "demand":
      if (!c.topDemand.length) return pick(MSG.noDemand, locale);
      return {
        ru: `🔥 Спрос (30 дней): ${c.topDemand.map((d) => `${d.name} (${d.inquiries})`).join(", ")}.`,
        uz: `🔥 Talab (30 kun): ${c.topDemand.map((d) => `${d.name} (${d.inquiries})`).join(", ")}.`,
        en: `🔥 Demand (30 days): ${c.topDemand.map((d) => `${d.name} (${d.inquiries})`).join(", ")}.`,
      }[locale] ?? "";
    case "aged_stock":
      if (!c.topMarkdowns.length) return pick(MSG.noAged, locale);
      return {
        ru: `🏷 Залежались: ${c.topMarkdowns.map((m) => `${m.name} — ${m.daysOnLot}д, предлагаю −${m.markdownPct}% → ${u(m.suggestedPriceUsd)}`).join("; ")}.`,
        uz: `🏷 Qolib ketgan: ${c.topMarkdowns.map((m) => `${m.name} — ${m.daysOnLot} kun, −${m.markdownPct}% → ${u(m.suggestedPriceUsd)} taklif qilaman`).join("; ")}.`,
        en: `🏷 Aged stock: ${c.topMarkdowns.map((m) => `${m.name} — ${m.daysOnLot}d, I suggest −${m.markdownPct}% → ${u(m.suggestedPriceUsd)}`).join("; ")}.`,
      }[locale] ?? "";
    case "lead_summary":
      return {
        ru: `📥 Новых заявок: ${c.actions.newInquiries}. Горячих лидов: ${c.actions.hotLeads}. Задач на сегодня: ${c.actions.tasksDue}. Неоплаченных броней: ${c.actions.unpaidReservations}.`,
        uz: `📥 Yangi so'rovlar: ${c.actions.newInquiries}. Issiq lidlar: ${c.actions.hotLeads}. Bugungi vazifalar: ${c.actions.tasksDue}. To'lanmagan bronlar: ${c.actions.unpaidReservations}.`,
        en: `📥 New inquiries: ${c.actions.newInquiries}. Hot leads: ${c.actions.hotLeads}. Tasks today: ${c.actions.tasksDue}. Unpaid reservations: ${c.actions.unpaidReservations}.`,
      }[locale] ?? "";
    case "business_summary":
    default: {
      const aged = c.topMarkdowns[0]?.name;
      return {
        ru: [
          `📊 Сводка: ${c.actions.newInquiries} новых заявок, ${c.actions.hotLeads} горячих, ${c.actions.tasksDue} задач, ${c.actions.unpaidReservations} неоплаченных броней, ${c.actions.overdueShipments} просроченных поставок.`,
          `Выручка за месяц ${u(c.money.revenueMtdUsd)}; маржа на складе ${u(c.money.potentialMarginUsd)}.`,
          aged ? `Стоит уценить: ${aged}.` : "",
        ].filter(Boolean).join(" "),
        uz: [
          `📊 Xulosa: ${c.actions.newInquiries} yangi so'rov, ${c.actions.hotLeads} issiq, ${c.actions.tasksDue} vazifa, ${c.actions.unpaidReservations} to'lanmagan bron, ${c.actions.overdueShipments} muddati o'tgan yetkazib berish.`,
          `Oylik daromad ${u(c.money.revenueMtdUsd)}; ombordagi marja ${u(c.money.potentialMarginUsd)}.`,
          aged ? `Chegirma qilish kerak: ${aged}.` : "",
        ].filter(Boolean).join(" "),
        en: [
          `📊 Summary: ${c.actions.newInquiries} new inquiries, ${c.actions.hotLeads} hot, ${c.actions.tasksDue} tasks, ${c.actions.unpaidReservations} unpaid reservations, ${c.actions.overdueShipments} overdue shipments.`,
          `Revenue MTD ${u(c.money.revenueMtdUsd)}; margin on the lot ${u(c.money.potentialMarginUsd)}.`,
          aged ? `Worth marking down: ${aged}.` : "",
        ].filter(Boolean).join(" "),
      }[locale] ?? "";
    }
  }
}

async function saveMsg(supabase: SupabaseClient, threadId: string, role: "user" | "assistant", content: string) {
  try { await supabase.from("copilot_messages").insert({ thread_id: threadId, role, content }); } catch { /* fail-open */ }
}

/** Execute a frozen pending action by its stored intent + payload. */
async function execute(supabase: SupabaseClient, intent: string, payload: Record<string, unknown>, locale: Locale): Promise<ActionResult> {
  try {
    if (intent === "markdown_car") {
      const { data: car } = await supabase.from("cars").select("id, slug, brand, model, year, price_usd, original_price_usd, inventory_status").eq("id", String(payload.carId)).maybeSingle();
      if (!car) return { ok: false, message: pick(MSG.carNotFound, locale) };
      return applyCarMarkdown(supabase, car as never, Number(payload.newPriceUsd));
    }
    if (intent === "advance_order") {
      const order = await resolveOrder(supabase, String(payload.orderRef));
      if (!order) return { ok: false, message: pick(MSG.orderNotFound, locale) };
      return advanceOrder(supabase, order, String(payload.target));
    }
    if (intent === "draft_po") {
      return createDraftPo(supabase, { brand: String(payload.brand), model: String(payload.model), qty: Number(payload.qty) || 1 });
    }
  } catch (e) {
    const why = e instanceof Error ? e.message : "unknown";
    return { ok: false, message: { ru: `Ошибка выполнения: ${why}`, uz: `Bajarishda xato: ${why}`, en: `Execution error: ${why}` }[locale] ?? why };
  }
  return { ok: false, message: pick(MSG.unknownAction, locale) };
}

async function latestPending(supabase: SupabaseClient, threadId: string) {
  const { data } = await supabase
    .from("copilot_pending_actions")
    .select("id, intent, payload")
    .eq("thread_id", threadId).eq("status", "proposed")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data as { id: string; intent: string; payload: Record<string, unknown> } | null;
}

async function propose(supabase: SupabaseClient, threadId: string, intent: string, payload: Record<string, unknown>, preview: string, locale: Locale): Promise<string> {
  try {
    await supabase.from("copilot_pending_actions").insert({ thread_id: threadId, intent, payload, preview, expires_at: new Date(Date.now() + PENDING_TTL_MS).toISOString() });
  } catch { /* fail-open: dealer can still re-issue */ }
  return `${preview}\n\n${pick(MSG.confirmSuffix, locale)}`;
}

export async function runCopilotTurn(args: {
  supabase: SupabaseClient;
  threadId: string;
  message: string;
  confirm?: boolean; // explicit web "Confirm" button / TG callback
  locale?: Locale;
}): Promise<CopilotTurn> {
  const { supabase, threadId, message } = args;
  const locale: Locale = args.locale ?? "ru";
  await saveMsg(supabase, threadId, "user", message);
  const reply = (text: string, extra: Partial<CopilotTurn> = {}): CopilotTurn => {
    saveMsg(supabase, threadId, "assistant", text).catch(() => {});
    return { reply: text, intent: extra.intent ?? "", ...extra };
  };

  // 1) Confirm / cancel a pending action.
  if (args.confirm || AFFIRM.test(message)) {
    const pending = await latestPending(supabase, threadId);
    if (!pending) return reply(pick(MSG.noPending, locale), { intent: "confirm" });
    const res = await execute(supabase, pending.intent, pending.payload, locale);
    await supabase.from("copilot_pending_actions").update({ status: res.ok ? "confirmed" : "proposed", resolved_at: new Date().toISOString() }).eq("id", pending.id).then(() => {}, () => {});
    return reply(res.message, { intent: pending.intent, executed: res.ok });
  }
  if (NEGATE.test(message)) {
    const pending = await latestPending(supabase, threadId);
    if (pending) await supabase.from("copilot_pending_actions").update({ status: "cancelled", resolved_at: new Date().toISOString() }).eq("id", pending.id).then(() => {}, () => {});
    return reply(pending ? pick(MSG.cancelled, locale) : pick(MSG.nothingToCancel, locale), { intent: "cancel" });
  }

  // 2) Classify.
  const parsed = await classify(message);

  // 3) Reads.
  if (isReadIntent(parsed.intent)) {
    return reply(await answerRead(supabase, parsed.intent, locale), { intent: parsed.intent });
  }

  // 4) Writes → resolve + propose (confirm-gated).
  if (isWriteIntent(parsed.intent)) {
    if (parsed.intent === "markdown_car") {
      if (!parsed.params.carQuery) return reply(pick(MSG.whichCar, locale), { intent: parsed.intent });
      const r = await resolveCar(supabase, parsed.params.carQuery);
      if (r.candidates) {
        const list = r.candidates.map((c) => `${c.brand} ${c.model} ${c.year ?? ""}`.trim()).join(" / ");
        return reply({ ru: `Уточните, какую: ${list}.`, uz: `Qaysi birini aniqlang: ${list}.`, en: `Which one: ${list}.` }[locale] ?? "", { intent: parsed.intent });
      }
      if (!r.match) {
        const q = parsed.params.carQuery;
        return reply({ ru: `Не нашёл «${q}» в наличии.`, uz: `«${q}» sotuvda topilmadi.`, en: `Couldn't find "${q}" in stock.` }[locale] ?? "", { intent: parsed.intent });
      }
      const target = computeMarkdownPrice(r.match.price_usd, parsed.params);
      if (target == null) {
        const cur = usdFmt(r.match.price_usd);
        return reply({
          ru: `Укажите новую цену (ниже текущей ${cur}), например «до $34000» или «на 5%».`,
          uz: `Yangi narxni kiriting (joriy ${cur} dan past), masalan «$34000 gacha» yoki «5%».`,
          en: `Specify a new price (below the current ${cur}), e.g. "to $34000" or "by 5%".`,
        }[locale] ?? "", { intent: parsed.intent });
      }
      const from = usdFmt(r.match.price_usd), to = usdFmt(target);
      const name = `${r.match.brand} ${r.match.model} ${r.match.year ?? ""}`.trim();
      const preview = {
        ru: `Снизить цену ${name}: ${from} → ${to}.`,
        uz: `${name} narxini tushirish: ${from} → ${to}.`,
        en: `Drop the price of ${name}: ${from} → ${to}.`,
      }[locale] ?? "";
      return reply(await propose(supabase, threadId, "markdown_car", { carId: r.match.id, newPriceUsd: target }, preview, locale), { intent: parsed.intent, proposed: true });
    }
    if (parsed.intent === "advance_order") {
      if (!parsed.params.orderRef) return reply(pick(MSG.whichOrder, locale), { intent: parsed.intent });
      const order = await resolveOrder(supabase, parsed.params.orderRef);
      if (!order) {
        const ref = parsed.params.orderRef;
        return reply({ ru: `Заказ ${ref} не найден.`, uz: `${ref} buyurtmasi topilmadi.`, en: `Order ${ref} not found.` }[locale] ?? "", { intent: parsed.intent });
      }
      const target = parsed.params.status && (parsed.params.status !== order.status) ? parsed.params.status : nextOrderStatus(order.status);
      if (!target) {
        return reply({
          ru: `Заказ ${order.reference_code} уже на финальном статусе (${order.status}).`,
          uz: `${order.reference_code} buyurtmasi allaqachon yakuniy holatda (${order.status}).`,
          en: `Order ${order.reference_code} is already at its final status (${order.status}).`,
        }[locale] ?? "", { intent: parsed.intent });
      }
      const preview = {
        ru: `Перевести заказ ${order.reference_code}: ${order.status} → ${target}. Клиент получит уведомление.`,
        uz: `${order.reference_code} buyurtmasini o'tkazish: ${order.status} → ${target}. Mijoz xabar oladi.`,
        en: `Move order ${order.reference_code}: ${order.status} → ${target}. The customer will be notified.`,
      }[locale] ?? "";
      return reply(await propose(supabase, threadId, "advance_order", { orderRef: order.reference_code, target }, preview, locale), { intent: parsed.intent, proposed: true });
    }
    if (parsed.intent === "draft_po") {
      const phrase = parsed.params.model || "";
      if (!phrase) return reply(pick(MSG.whatToOrder, locale), { intent: parsed.intent });
      const { brand, model } = splitBrandModel(phrase, brands);
      const qty = parsed.params.qty || 1;
      const preview = {
        ru: `Создать ЧЕРНОВИК заявки поставщику: ${qty}× ${brand} ${model}.`,
        uz: `Yetkazib beruvchiga so'rov QORALAMASI yaratish: ${qty}× ${brand} ${model}.`,
        en: `Create a DRAFT supplier inquiry: ${qty}× ${brand} ${model}.`,
      }[locale] ?? "";
      return reply(await propose(supabase, threadId, "draft_po", { brand, model, qty }, preview, locale), { intent: parsed.intent, proposed: true });
    }
  }

  // 5) help / unknown.
  return reply(pick(HELP, locale), { intent: parsed.intent });
}

async function classify(message: string): Promise<ParsedIntent> {
  const rules = classifyDeterministic(message);
  if (!llmConfigured()) return rules;
  try {
    const raw = await llmText({ system: routerSystemPrompt(), user: message, maxTokens: 200 });
    return mergeClassifications(rules, parseRouterResponse(raw));
  } catch {
    return rules;
  }
}
