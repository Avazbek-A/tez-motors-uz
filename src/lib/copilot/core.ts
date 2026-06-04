/**
 * Dealer Copilot — turn orchestration (Phase AE).
 *
 * runCopilotTurn ties together: confirm-gating (a WRITE never mutates on the first
 * turn — it proposes; the dealer's explicit "yes" executes the FROZEN payload),
 * the two-stage router (deterministic + optional LLM), read narration from the
 * operator context, and message memory. Fail-open throughout: no LLM → rules +
 * templates; store failure → stateless answer; executor error → safe message.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { llmText, llmConfigured } from "@/lib/llm";
import { gatherOperatorContext } from "@/lib/operator-data";
import { CAR_BRANDS } from "@/lib/constants";
import { classifyDeterministic, parseRouterResponse, mergeClassifications, routerSystemPrompt } from "./router";
import { isReadIntent, isWriteIntent, type ParsedIntent } from "./intents";
import {
  resolveCar, computeMarkdownPrice, applyCarMarkdown,
  resolveOrder, nextOrderStatus, advanceOrder,
  createDraftPo, splitBrandModel, type ActionResult,
} from "./actions";

const PENDING_TTL_MS = 10 * 60 * 1000;
const AFFIRM = /^\s*(да|yes|ок|ok|подтверж\w*|давай|go|confirm|✅|👍)\b/i;
const NEGATE = /^\s*(нет|no|отмен\w*|cancel|стоп|stop|❌)\b/i;

export interface CopilotTurn { reply: string; intent: string; proposed?: boolean; executed?: boolean; }

const brands = (() => { try { return CAR_BRANDS as readonly string[]; } catch { return [] as string[]; } })();

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

// ---- read narration (deterministic templates from the operator context) ----
async function answerRead(supabase: SupabaseClient, intent: string): Promise<string> {
  const c = await gatherOperatorContext(supabase);
  const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
  switch (intent) {
    case "cash_position":
      return [
        `💰 Деньги: выручка за месяц ${usd(c.money.revenueMtdUsd)}, депозиты ${usd(c.money.depositsUsd)}.`,
        `Заморожено у поставщиков ${usd(c.money.committedSupplierUsd)}. Потенциальная маржа на складе ${usd(c.money.potentialMarginUsd)}.`,
      ].join(" ");
    case "demand":
      return c.topDemand.length
        ? `🔥 Спрос (30 дней): ${c.topDemand.map((d) => `${d.name} (${d.inquiries})`).join(", ")}.`
        : "Пока нет заметного спроса за последние 30 дней.";
    case "aged_stock":
      return c.topMarkdowns.length
        ? `🏷 Залежались: ${c.topMarkdowns.map((m) => `${m.name} — ${m.daysOnLot}д, предлагаю −${m.markdownPct}% → ${usd(m.suggestedPriceUsd)}`).join("; ")}.`
        : "Нет машин, требующих уценки.";
    case "lead_summary":
      return `📥 Новых заявок: ${c.actions.newInquiries}. Горячих лидов: ${c.actions.hotLeads}. Задач на сегодня: ${c.actions.tasksDue}. Неоплаченных броней: ${c.actions.unpaidReservations}.`;
    case "business_summary":
    default:
      return [
        `📊 Сводка: ${c.actions.newInquiries} новых заявок, ${c.actions.hotLeads} горячих, ${c.actions.tasksDue} задач, ${c.actions.unpaidReservations} неоплаченных броней, ${c.actions.overdueShipments} просроченных поставок.`,
        `Выручка за месяц ${usd(c.money.revenueMtdUsd)}; маржа на складе ${usd(c.money.potentialMarginUsd)}.`,
        c.topMarkdowns[0] ? `Стоит уценить: ${c.topMarkdowns[0].name}.` : "",
      ].filter(Boolean).join(" ");
  }
}

const HELP = [
  "Я ваш ассистент по бизнесу. Спросите: «сколько денег», «какой спрос», «что залежалось», «новые заявки», «сводка».",
  "Действия (с подтверждением): «снизь цену на Tank 300 до $34000», «переведи заказ TM-XXXX в taможню», «закажи 3 BYD Han у поставщика».",
].join(" ");

async function saveMsg(supabase: SupabaseClient, threadId: string, role: "user" | "assistant", content: string) {
  try { await supabase.from("copilot_messages").insert({ thread_id: threadId, role, content }); } catch { /* fail-open */ }
}

/** Execute a frozen pending action by its stored intent + payload. */
async function execute(supabase: SupabaseClient, intent: string, payload: Record<string, unknown>): Promise<ActionResult> {
  try {
    if (intent === "markdown_car") {
      const { data: car } = await supabase.from("cars").select("id, slug, brand, model, year, price_usd, original_price_usd, inventory_status").eq("id", String(payload.carId)).maybeSingle();
      if (!car) return { ok: false, message: "Машина не найдена." };
      return applyCarMarkdown(supabase, car as never, Number(payload.newPriceUsd));
    }
    if (intent === "advance_order") {
      const order = await resolveOrder(supabase, String(payload.orderRef));
      if (!order) return { ok: false, message: "Заказ не найден." };
      return advanceOrder(supabase, order, String(payload.target));
    }
    if (intent === "draft_po") {
      return createDraftPo(supabase, { brand: String(payload.brand), model: String(payload.model), qty: Number(payload.qty) || 1 });
    }
  } catch (e) {
    return { ok: false, message: `Ошибка выполнения: ${e instanceof Error ? e.message : "unknown"}` };
  }
  return { ok: false, message: "Неизвестное действие." };
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

async function propose(supabase: SupabaseClient, threadId: string, intent: string, payload: Record<string, unknown>, preview: string): Promise<string> {
  try {
    await supabase.from("copilot_pending_actions").insert({ thread_id: threadId, intent, payload, preview, expires_at: new Date(Date.now() + PENDING_TTL_MS).toISOString() });
  } catch { /* fail-open: dealer can still re-issue */ }
  return `${preview}\n\nПодтвердите: ответьте «да» (или «нет» для отмены).`;
}

export async function runCopilotTurn(args: {
  supabase: SupabaseClient;
  threadId: string;
  message: string;
  confirm?: boolean; // explicit web "Confirm" button / TG callback
}): Promise<CopilotTurn> {
  const { supabase, threadId, message } = args;
  await saveMsg(supabase, threadId, "user", message);
  const reply = (text: string, extra: Partial<CopilotTurn> = {}): CopilotTurn => {
    saveMsg(supabase, threadId, "assistant", text).catch(() => {});
    return { reply: text, intent: extra.intent ?? "", ...extra };
  };

  // 1) Confirm / cancel a pending action.
  if (args.confirm || AFFIRM.test(message)) {
    const pending = await latestPending(supabase, threadId);
    if (!pending) return reply("Нет действия для подтверждения.", { intent: "confirm" });
    const res = await execute(supabase, pending.intent, pending.payload);
    await supabase.from("copilot_pending_actions").update({ status: res.ok ? "confirmed" : "proposed", resolved_at: new Date().toISOString() }).eq("id", pending.id).then(() => {}, () => {});
    return reply(res.message, { intent: pending.intent, executed: res.ok });
  }
  if (NEGATE.test(message)) {
    const pending = await latestPending(supabase, threadId);
    if (pending) await supabase.from("copilot_pending_actions").update({ status: "cancelled", resolved_at: new Date().toISOString() }).eq("id", pending.id).then(() => {}, () => {});
    return reply(pending ? "Отменено." : "Нечего отменять.", { intent: "cancel" });
  }

  // 2) Classify.
  const parsed = await classify(message);

  // 3) Reads.
  if (isReadIntent(parsed.intent)) {
    return reply(await answerRead(supabase, parsed.intent), { intent: parsed.intent });
  }

  // 4) Writes → resolve + propose (confirm-gated).
  if (isWriteIntent(parsed.intent)) {
    if (parsed.intent === "markdown_car") {
      if (!parsed.params.carQuery) return reply("Какую машину уценить? Укажите модель.", { intent: parsed.intent });
      const r = await resolveCar(supabase, parsed.params.carQuery);
      if (r.candidates) return reply(`Уточните, какую: ${r.candidates.map((c) => `${c.brand} ${c.model} ${c.year ?? ""}`.trim()).join(" / ")}.`, { intent: parsed.intent });
      if (!r.match) return reply(`Не нашёл «${parsed.params.carQuery}» в наличии.`, { intent: parsed.intent });
      const target = computeMarkdownPrice(r.match.price_usd, parsed.params);
      if (target == null) return reply(`Укажите новую цену (ниже текущей $${r.match.price_usd.toLocaleString("en-US")}), например «до $34000» или «на 5%».`, { intent: parsed.intent });
      const preview = `Снизить цену ${r.match.brand} ${r.match.model} ${r.match.year ?? ""}: $${r.match.price_usd.toLocaleString("en-US")} → $${target.toLocaleString("en-US")}.`;
      return reply(await propose(supabase, threadId, "markdown_car", { carId: r.match.id, newPriceUsd: target }, preview), { intent: parsed.intent, proposed: true });
    }
    if (parsed.intent === "advance_order") {
      if (!parsed.params.orderRef) return reply("Укажите код заказа (TM-XXXXXXXX).", { intent: parsed.intent });
      const order = await resolveOrder(supabase, parsed.params.orderRef);
      if (!order) return reply(`Заказ ${parsed.params.orderRef} не найден.`, { intent: parsed.intent });
      const target = parsed.params.status && (parsed.params.status !== order.status) ? parsed.params.status : nextOrderStatus(order.status);
      if (!target) return reply(`Заказ ${order.reference_code} уже на финальном статусе (${order.status}).`, { intent: parsed.intent });
      const preview = `Перевести заказ ${order.reference_code}: ${order.status} → ${target}. Клиент получит уведомление.`;
      return reply(await propose(supabase, threadId, "advance_order", { orderRef: order.reference_code, target }, preview), { intent: parsed.intent, proposed: true });
    }
    if (parsed.intent === "draft_po") {
      const phrase = parsed.params.model || "";
      if (!phrase) return reply("Что заказать у поставщика? Укажите марку и модель.", { intent: parsed.intent });
      const { brand, model } = splitBrandModel(phrase, brands);
      const qty = parsed.params.qty || 1;
      const preview = `Создать ЧЕРНОВИК заявки поставщику: ${qty}× ${brand} ${model}.`;
      return reply(await propose(supabase, threadId, "draft_po", { brand, model, qty }, preview), { intent: parsed.intent, proposed: true });
    }
  }

  // 5) help / unknown.
  return reply(HELP, { intent: parsed.intent });
}
