/**
 * Heuristic lead scoring — prioritizes the pipeline so the dealer works hot
 * leads first. Pure + deterministic (no LLM cost): rewards buying signals
 * (a specific car, a deposit amount, a real message, an email) and weights by
 * inquiry type (a reservation outranks a newsletter signup).
 */
export type LeadTier = "hot" | "warm" | "cold";

export interface LeadScoreInput {
  type?: string | null;
  hasEmail?: boolean;
  hasCarId?: boolean;
  messageLength?: number;
  amountUsd?: number | null;
}

// High-intent types start with more points.
const TYPE_BASE: Record<string, number> = {
  reservation: 45,
  test_drive: 35,
  car_inquiry: 30,
  part_inquiry: 25,
  calculator: 25,
  trade_in: 20,
  service: 20,
  callback: 20,
  general: 10,
  newsletter: 5,
};

export function scoreLead(input: LeadScoreInput): number {
  let score = TYPE_BASE[(input.type || "general") as string] ?? 10;
  if (input.hasCarId) score += 20; // tied to a specific car = real intent
  if (input.hasEmail) score += 10; // reachable on a second channel
  const len = input.messageLength ?? 0;
  if (len >= 80) score += 15;
  else if (len >= 20) score += 8;
  if (input.amountUsd && input.amountUsd > 0) score += 10; // named a deposit
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function leadTier(score: number): LeadTier {
  if (score >= 60) return "hot";
  if (score >= 35) return "warm";
  return "cold";
}
