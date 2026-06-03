/**
 * AI Operator — a proactive daily operations briefing that synthesizes the whole
 * business (action queue, cash, aged stock, demand) into a prioritized "here's
 * your day" with concrete actions. Pure helpers (action derivation + fail-open
 * template) are unit-tested; generateOperatorBriefing wraps the LLM for a
 * natural narrative and falls back to the template so it always produces output.
 */
import { llmText } from "./llm";

export interface OperatorContext {
  actions: {
    newInquiries: number;
    hotLeads: number;
    tasksDue: number;
    unpaidReservations: number;
    overdueShipments: number;
    warrantiesExpiring: number;
    pendingMarketingDrafts?: number;
  };
  money: {
    revenueMtdUsd: number;
    depositsUsd: number;
    committedSupplierUsd: number;
    potentialMarginUsd: number;
  };
  topMarkdowns: { carId: string; name: string; daysOnLot: number; markdownPct: number; suggestedPriceUsd: number; currentPriceUsd: number }[];
  topDemand: { name: string; inquiries: number }[];
  trends?: {
    leadsThisWeek: number; leadsLastWeek: number;
    revenueThisWeekUsd: number; revenueLastWeekUsd: number;
    ordersThisWeek: number; ordersLastWeek: number;
  };
}

/** Percent change current vs previous. null = no baseline (previous was 0 but
 *  current is not) — i.e. "new", no meaningful percentage. */
export function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

/** A compact "12 (▲25%)" style trend token from a current count + its delta. */
export function trendToken(current: number, previous: number): string {
  const d = pctDelta(current, previous);
  if (d === null) return `${current} (new)`;
  if (d === 0) return `${current} (▬)`;
  return `${current} (${d > 0 ? "▲" : "▼"}${Math.abs(d)}%)`;
}

export interface OperatorAction {
  priority: number; // lower = more urgent
  text: string;
}

/** Derive a prioritized action list from the context — deterministic + tested. */
export function buildActions(ctx: OperatorContext): OperatorAction[] {
  const a = ctx.actions;
  const out: OperatorAction[] = [];
  if (a.hotLeads > 0) out.push({ priority: 1, text: `Call ${a.hotLeads} hot AI lead${a.hotLeads === 1 ? "" : "s"} flagged for handoff` });
  if (a.unpaidReservations > 0) out.push({ priority: 2, text: `Chase ${a.unpaidReservations} unpaid reservation${a.unpaidReservations === 1 ? "" : "s"} (deposit not paid)` });
  if (a.newInquiries > 0) out.push({ priority: 3, text: `Respond to ${a.newInquiries} new inquir${a.newInquiries === 1 ? "y" : "ies"}` });
  if (a.tasksDue > 0) out.push({ priority: 4, text: `${a.tasksDue} follow-up task${a.tasksDue === 1 ? "" : "s"} due today` });
  if (a.overdueShipments > 0) out.push({ priority: 5, text: `${a.overdueShipments} shipment${a.overdueShipments === 1 ? "" : "s"} overdue — chase the supplier/broker` });
  if (a.warrantiesExpiring > 0) out.push({ priority: 6, text: `${a.warrantiesExpiring} warrant${a.warrantiesExpiring === 1 ? "y" : "ies"} expiring in 30 days — offer a service/extended warranty` });
  if ((a.pendingMarketingDrafts ?? 0) > 0) out.push({ priority: 6.5, text: `📣 ${a.pendingMarketingDrafts} marketing draft${a.pendingMarketingDrafts === 1 ? "" : "s"} waiting — review & schedule in Content Studio` });
  for (const m of ctx.topMarkdowns.slice(0, 3)) {
    out.push({ priority: 7, text: `Mark down ${m.name} (${m.daysOnLot}d on lot) by ${m.markdownPct}% → $${m.suggestedPriceUsd.toLocaleString("en-US")}` });
  }
  for (const d of ctx.topDemand.slice(0, 3)) {
    out.push({ priority: 8, text: `High demand: ${d.name} (${d.inquiries} inquiries) — consider importing more` });
  }
  return out.sort((x, y) => x.priority - y.priority);
}

const usd = (n: number) => "$" + Math.round(n || 0).toLocaleString("en-US");

const GREETING = { ru: "Доброе утро! Сводка на сегодня.", uz: "Xayrli tong! Bugungi xulosa.", en: "Good morning — here's your day." };
const ACTIONS_LABEL = { ru: "Что сделать сегодня:", uz: "Bugun nima qilish kerak:", en: "Today's actions:" };
const NOTHING = { ru: "Срочных дел нет — хороший день, чтобы заняться маркетингом и поиском поставщиков.", uz: "Shoshilinch ish yo'q — marketing va ta'minotchilar bilan shug'ullaning.", en: "Nothing urgent — a good day for marketing and sourcing." };
const TREND_LABEL = { ru: "За неделю", uz: "Hafta davomida", en: "This week" };
const TREND_LEADS = { ru: "лидов", uz: "lid", en: "leads" };
const TREND_REVENUE = { ru: "выручка", uz: "tushum", en: "revenue" };
const TREND_ORDERS = { ru: "заказов", uz: "buyurtma", en: "orders" };

function L(locale: string): "ru" | "uz" | "en" {
  return locale === "uz" ? "uz" : locale === "en" ? "en" : "ru";
}

/** "📈 This week: 5 leads (▲25%) · $12,000 revenue (▼10%) · 2 orders (new)". */
function trendLine(ctx: OperatorContext, l: "ru" | "uz" | "en"): string | null {
  const t = ctx.trends;
  if (!t) return null;
  const rev = `${usd(t.revenueThisWeekUsd)} ${TREND_REVENUE[l]} ${pctSuffix(t.revenueThisWeekUsd, t.revenueLastWeekUsd)}`;
  return `📈 ${TREND_LABEL[l]}: ${trendToken(t.leadsThisWeek, t.leadsLastWeek)} ${TREND_LEADS[l]} · ${rev} · ${trendToken(t.ordersThisWeek, t.ordersLastWeek)} ${TREND_ORDERS[l]}.`;
}

function pctSuffix(current: number, previous: number): string {
  const d = pctDelta(current, previous);
  if (d === null) return "(new)";
  if (d === 0) return "(▬)";
  return `(${d > 0 ? "▲" : "▼"}${Math.abs(d)}%)`;
}

/** Deterministic briefing used when the LLM is unconfigured/unavailable. */
export function operatorFallback(ctx: OperatorContext, locale = "ru"): string {
  const l = L(locale);
  const actions = buildActions(ctx);
  const lines: string[] = [GREETING[l]];
  lines.push("");
  lines.push(`💰 ${usd(ctx.money.revenueMtdUsd)} revenue MTD · ${usd(ctx.money.depositsUsd)} deposits · ${usd(ctx.money.committedSupplierUsd)} committed to suppliers · ${usd(ctx.money.potentialMarginUsd)} potential margin on the lot.`);
  const trend = trendLine(ctx, l);
  if (trend) lines.push(trend);
  lines.push("");
  lines.push(ACTIONS_LABEL[l]);
  if (actions.length === 0) lines.push(`• ${NOTHING[l]}`);
  else actions.forEach((a, i) => lines.push(`${i + 1}. ${a.text}`));
  return lines.join("\n");
}

export async function generateOperatorBriefing(ctx: OperatorContext, locale = "ru"): Promise<{ text: string; ai: boolean }> {
  const actions = buildActions(ctx);
  const facts = [
    `Revenue MTD: ${usd(ctx.money.revenueMtdUsd)}`,
    `Deposits collected: ${usd(ctx.money.depositsUsd)}`,
    `Committed to suppliers (in transit): ${usd(ctx.money.committedSupplierUsd)}`,
    `Potential margin on the lot: ${usd(ctx.money.potentialMarginUsd)}`,
    ctx.trends
      ? `Week-over-week: leads ${ctx.trends.leadsThisWeek} (prev ${ctx.trends.leadsLastWeek}), revenue ${usd(ctx.trends.revenueThisWeekUsd)} (prev ${usd(ctx.trends.revenueLastWeekUsd)}), orders ${ctx.trends.ordersThisWeek} (prev ${ctx.trends.ordersLastWeek})`
      : "",
    `New inquiries: ${ctx.actions.newInquiries}, hot AI leads: ${ctx.actions.hotLeads}, tasks due: ${ctx.actions.tasksDue}, unpaid reservations: ${ctx.actions.unpaidReservations}, overdue shipments: ${ctx.actions.overdueShipments}, warranties expiring: ${ctx.actions.warrantiesExpiring}`,
    ctx.topMarkdowns.length ? `Aged stock to mark down: ${ctx.topMarkdowns.map((m) => `${m.name} (${m.daysOnLot}d, -${m.markdownPct}%)`).join("; ")}` : "",
    ctx.topDemand.length ? `Most-demanded models: ${ctx.topDemand.map((d) => `${d.name} (${d.inquiries})`).join("; ")}` : "",
    `Candidate action list (already prioritized): ${actions.map((a) => a.text).join(" | ") || "none"}`,
  ].filter(Boolean).join("\n");

  const system = [
    "You are the operations manager for Tez Motors, a one-person Chinese-car importer in Tashkent.",
    `Write a SHORT morning briefing in ${L(locale) === "uz" ? "Uzbek (Latin)" : L(locale) === "en" ? "English" : "Russian"}: a one-line summary of the business state, then a numbered list of the 3–6 most important concrete actions for today, each with a one-clause reason.`,
    "Use ONLY the numbers given — never invent figures. Be direct and practical, like a sharp COO. No preamble.",
  ].join(" ");

  const out = await llmText({ system, user: facts, maxTokens: 500 });
  if (out) return { text: out.trim(), ai: true };
  return { text: operatorFallback(ctx, locale), ai: false };
}
