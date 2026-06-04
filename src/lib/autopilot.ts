/**
 * Autonomous operations control plane (Phase AH).
 *
 * The system already SUGGESTS (aging markdowns, demand-to-source). Autopilot lets
 * it ACT — strictly opt-in, capped, audited, and only for REVERSIBLE moves
 * (markdowns within a margin floor; DRAFT purchase orders — never auto-ordered,
 * never auto-money-movement). Config lives in site_settings('autopilot'); every
 * flag defaults OFF so absent config = today's behavior. Pure resolver here.
 */

export interface AutopilotConfig {
  /** Master switch — when false, NOTHING autonomous runs. */
  master: boolean;
  autoMarkdown: {
    enabled: boolean;
    minDaysOnLot: number; // only mark down stock older than this
    maxPerRun: number; // cap cars touched per cron run
    minMarginPct: number; // never mark below cost + this margin (when cost known)
  };
  autoSourceDrafts: {
    enabled: boolean;
    maxPerRun: number; // cap draft POs created per run
    minDemandScore: number; // only draft for demand at/above this
  };
}

export const AUTOPILOT_ROW_ID = "autopilot";

export const DEFAULT_AUTOPILOT: AutopilotConfig = {
  master: false,
  autoMarkdown: { enabled: false, minDaysOnLot: 60, maxPerRun: 3, minMarginPct: 5 },
  autoSourceDrafts: { enabled: false, maxPerRun: 2, minDemandScore: 5 },
};

const clampInt = (v: unknown, min: number, max: number, dflt: number): number => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(Math.max(Math.round(n), min), max);
};
const bool = (v: unknown, dflt: boolean): boolean => (typeof v === "boolean" ? v : dflt);

/** Merge stored values onto safe defaults + clamp every numeric bound. */
export function resolveAutopilot(values: unknown): AutopilotConfig {
  const v = (values && typeof values === "object" ? values : {}) as Record<string, Record<string, unknown>>;
  const m = v.autoMarkdown || {};
  const s = v.autoSourceDrafts || {};
  return {
    master: bool(v.master as unknown, DEFAULT_AUTOPILOT.master),
    autoMarkdown: {
      enabled: bool(m.enabled, false),
      minDaysOnLot: clampInt(m.minDaysOnLot, 14, 365, DEFAULT_AUTOPILOT.autoMarkdown.minDaysOnLot),
      maxPerRun: clampInt(m.maxPerRun, 1, 20, DEFAULT_AUTOPILOT.autoMarkdown.maxPerRun),
      minMarginPct: clampInt(m.minMarginPct, 0, 50, DEFAULT_AUTOPILOT.autoMarkdown.minMarginPct),
    },
    autoSourceDrafts: {
      enabled: bool(s.enabled, false),
      maxPerRun: clampInt(s.maxPerRun, 1, 20, DEFAULT_AUTOPILOT.autoSourceDrafts.maxPerRun),
      minDemandScore: clampInt(s.minDemandScore, 1, 100, DEFAULT_AUTOPILOT.autoSourceDrafts.minDemandScore),
    },
  };
}

/** Is a specific autonomous action allowed to run? (master AND the sub-flag). */
export function markdownAllowed(c: AutopilotConfig): boolean { return c.master && c.autoMarkdown.enabled; }
export function sourceAllowed(c: AutopilotConfig): boolean { return c.master && c.autoSourceDrafts.enabled; }
