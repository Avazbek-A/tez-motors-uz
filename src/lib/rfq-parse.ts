/**
 * RFQ quote parsing (Phase AK polish).
 *
 * Turns a pasted supplier quote ("BYD Song Plus, 85000 RMB, MOQ 5, lead time
 * 30 days") into structured fields so the Buying Brain can use a current source
 * price instead of PO history. `parseRfqText` is a pure deterministic heuristic
 * (unit-tested) and the fail-open fallback; `parseRfq` adds an optional LLM pass
 * for messier quotes.
 */
import { llmText } from "./llm";

export interface RfqFields {
  priceUsd: number | null;
  priceCny: number | null;
  leadTimeDays: number | null;
  moq: number | null;
}

function firstNumber(m: RegExpMatchArray | null): number | null {
  if (!m) return null;
  const n = Number(m[1].replace(/[,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Deterministic extraction — also the no-LLM fallback. */
export function parseRfqText(text: string): RfqFields {
  const t = (text || "").toLowerCase();

  // CNY: "85000 rmb" / "¥85000" / "85,000 元" / "cny 85000"
  const cny =
    firstNumber(t.match(/(?:¥|cny|rmb|元)\s*([\d,\s]{3,})/)) ??
    firstNumber(t.match(/([\d,\s]{3,})\s*(?:¥|cny|rmb|元|yuan)/));

  // USD: "$12,000" / "12000 usd" / "usd 12000"
  const usd =
    firstNumber(t.match(/\$\s*([\d,\s]{3,})/)) ??
    firstNumber(t.match(/([\d,\s]{3,})\s*(?:usd|dollars?)/)) ??
    firstNumber(t.match(/usd\s*([\d,\s]{3,})/));

  // Lead time: "30 days" / "6 weeks" / "30天" / "lead time 45"
  let leadTimeDays: number | null = null;
  const weeks = firstNumber(t.match(/(\d{1,3})\s*(?:weeks?|hafta|недел)/));
  const days = firstNumber(t.match(/(\d{1,3})\s*(?:days?|天|kun|дн)/)) ?? firstNumber(t.match(/lead\s*time\D{0,8}(\d{1,3})/));
  if (weeks) leadTimeDays = weeks * 7;
  else if (days) leadTimeDays = days;

  // MOQ: "moq 5" / "minimum order 3" / "min 10 units"
  const moq =
    firstNumber(t.match(/moq\D{0,8}(\d{1,4})/)) ??
    firstNumber(t.match(/min(?:imum)?(?:\s*order)?\D{0,8}(\d{1,4})\s*(?:units?|pcs|cars?)?/));

  return {
    priceUsd: usd,
    priceCny: cny,
    leadTimeDays: leadTimeDays ?? null,
    moq: moq ?? null,
  };
}

/**
 * Parse a quote, preferring the LLM when configured (messy multi-line quotes,
 * mixed languages) and falling back to the heuristic. The heuristic always runs
 * and fills any field the LLM left null, so output is never worse than rules.
 */
export async function parseRfq(text: string): Promise<RfqFields & { ai: boolean }> {
  const heuristic = parseRfqText(text);
  const system = [
    "Extract a car supplier quote into STRICT JSON only, no prose:",
    '{"priceUsd":number|null,"priceCny":number|null,"leadTimeDays":number|null,"moq":number|null}',
    "priceUsd/priceCny: unit price in that currency (omit thousands separators). leadTimeDays: production+ship lead time in days (convert weeks×7). moq: minimum order quantity. Use null for anything not present. Do not guess.",
  ].join(" ");
  const out = await llmText({ system, user: text.slice(0, 4000), maxTokens: 120 });
  if (!out) return { ...heuristic, ai: false };
  try {
    const start = out.indexOf("{");
    const end = out.lastIndexOf("}");
    if (start < 0 || end <= start) return { ...heuristic, ai: false };
    const parsed = JSON.parse(out.slice(start, end + 1)) as Partial<RfqFields>;
    const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
    return {
      // Prefer LLM value, fall back to heuristic per field.
      priceUsd: numOrNull(parsed.priceUsd) ?? heuristic.priceUsd,
      priceCny: numOrNull(parsed.priceCny) ?? heuristic.priceCny,
      leadTimeDays: numOrNull(parsed.leadTimeDays) ?? heuristic.leadTimeDays,
      moq: numOrNull(parsed.moq) ?? heuristic.moq,
      ai: true,
    };
  } catch {
    return { ...heuristic, ai: false };
  }
}
