/**
 * AI-drafted supplier messages for WhatsApp. Composes a short, professional B2B
 * procurement message — bilingual (Simplified Chinese + English) since most
 * suppliers are in China — grounded on the purchase order. The dealer reviews
 * and sends via a one-tap wa.me link (ToS-safe; no autonomous outbound).
 *
 * Fail-open: with no LLM_API_KEY (or any failure) it returns a clean bilingual
 * template so a message is always produced. Never invents specs or prices.
 */
import { llmText } from "./llm";

export type SupplierMessageKind = "rfq" | "follow_up" | "eta" | "price_check";

export interface SupplierPOContext {
  supplier?: string | null;
  brand: string;
  model: string;
  trim?: string | null;
  year?: number | null;
  qty?: number | null;
  unit_cost_usd?: number | null;
  status?: string | null;
  eta_date?: string | null;
}

function carLine(po: SupplierPOContext): string {
  return [po.brand, po.model, po.trim, po.year].filter(Boolean).join(" ");
}

const KIND_INTENT: Record<SupplierMessageKind, string> = {
  rfq: "Request a quotation: confirm availability, unit price (FOB/EXW), MOQ, and lead time.",
  follow_up: "Polite follow-up on a pending order — ask for a status update and next steps.",
  eta: "Ask for the current shipping status and estimated time of arrival.",
  price_check: "Ask for the latest unit price for the given quantity.",
};

function template(kind: SupplierMessageKind, po: SupplierPOContext): string {
  const car = carLine(po);
  const qty = po.qty || 1;
  const hi = po.supplier ? `${po.supplier}` : "您好 / Hello";
  const zh: Record<SupplierMessageKind, string> = {
    rfq: `${hi}，我们想采购 ${qty} 台 ${car}。请提供报价（FOB/EXW）、最小起订量、库存与交货周期。谢谢！`,
    follow_up: `${hi}，关于我们的 ${car}（${qty} 台）订单，请问目前进展如何？谢谢！`,
    eta: `${hi}，请问 ${car} 订单的发货状态和预计到货时间（ETA）？谢谢！`,
    price_check: `${hi}，请问 ${car}（数量 ${qty}）目前的单价是多少？谢谢！`,
  };
  const en: Record<SupplierMessageKind, string> = {
    rfq: `We'd like to order ${qty}× ${car}. Could you share your quote (FOB/EXW), MOQ, availability, and lead time? Thank you!`,
    follow_up: `Following up on our ${car} order (qty ${qty}) — could you share the current status and next steps? Thank you!`,
    eta: `Could you share the shipping status and ETA for the ${car} order? Thank you!`,
    price_check: `What's your current unit price for the ${car} (qty ${qty})? Thank you!`,
  };
  return `${zh[kind]}\n\n${en[kind]}`;
}

export async function draftSupplierMessage(
  kind: SupplierMessageKind,
  po: SupplierPOContext,
): Promise<{ text: string; ai: boolean }> {
  const system = [
    "You are a procurement specialist at Tez Motors (Uzbekistan) messaging a Chinese car/parts supplier on WhatsApp.",
    "Write a SHORT, polite, professional B2B message. Output BOTH Simplified Chinese first, then a blank line, then English.",
    "Use ONLY the facts provided — never invent specs, prices, or commitments. No emoji. No greeting fluff beyond a brief hello.",
  ].join(" ");
  const user = [
    `Intent: ${KIND_INTENT[kind]}`,
    `Supplier: ${po.supplier || "(unknown)"}`,
    `Item: ${carLine(po) || "(car)"}`,
    `Quantity: ${po.qty || 1}`,
    po.unit_cost_usd ? `Last unit cost (USD, for our reference only — do not quote it back): ${po.unit_cost_usd}` : "",
    po.eta_date ? `Current ETA on file: ${po.eta_date}` : "",
    "Write the message now.",
  ]
    .filter(Boolean)
    .join("\n");

  const out = await llmText({ system, user, maxTokens: 400 });
  if (out) return { text: out, ai: true };
  return { text: template(kind, po), ai: false };
}
