/**
 * Marketing automation — journey (drip sequence) engine (Phase AW).
 *
 * Pure scheduling + templating logic, unit-tested in isolation. The cron runner
 * and admin CRUD wrap these; delivery is the existing `sendToCustomer`. A
 * journey is a trigger + an ordered list of timed steps; an enrollment walks one
 * contact through them.
 */

export type JourneyTrigger = "new_lead" | "reservation_abandoned" | "delivered" | "manual";
export const JOURNEY_TRIGGERS: JourneyTrigger[] = ["new_lead", "reservation_abandoned", "delivered", "manual"];

export interface JourneyStep {
  /** Wait before this step fires, measured from the previous step (or from
   *  enrollment for step 0). Hours. */
  delayHours: number;
  /** Delivery channel — "auto" (or empty) lets sendToCustomer fan out. */
  channel?: string | null;
  /** Email subject (used only when the email channel sends). */
  subject?: string;
  /** Message body. Supports {name} {car} {price} {ref} placeholders. */
  body: string;
  /** Optional deep link → becomes the message button. */
  url?: string;
  buttonLabel?: string;
}

export const MAX_STEPS = 12;
const HOUR_MS = 3_600_000;

/** Fill {key} placeholders from a vars bag. Unknown / null → empty string. Pure. */
export function renderTemplate(body: string, vars: Record<string, string | number | null | undefined>): string {
  return (body || "").replace(/\{(\w+)\}/g, (_m, k: string) => {
    const v = vars[k];
    return v === undefined || v === null ? "" : String(v);
  });
}

export interface EnrollmentState {
  current_step: number;
  status: "active" | "completed";
  next_run_at: string | null;
}

/** State for a freshly-enrolled contact: step 0 scheduled after its delay. */
export function initialEnrollment(steps: JourneyStep[], nowMs: number): EnrollmentState {
  if (!steps || steps.length === 0) return { current_step: 0, status: "completed", next_run_at: null };
  const delay = Math.max(0, steps[0].delayHours || 0);
  return { current_step: 0, status: "active", next_run_at: new Date(nowMs + delay * HOUR_MS).toISOString() };
}

/**
 * After sending the step at `justSentIndex`, compute the next state: schedule
 * the following step from `nowMs`, or complete the journey if there are no more.
 */
export function advanceEnrollment(justSentIndex: number, steps: JourneyStep[], nowMs: number): EnrollmentState {
  const next = justSentIndex + 1;
  if (next >= steps.length) return { current_step: next, status: "completed", next_run_at: null };
  const delay = Math.max(0, steps[next].delayHours || 0);
  return { current_step: next, status: "active", next_run_at: new Date(nowMs + delay * HOUR_MS).toISOString() };
}

/** Is this enrollment due to send now? Pure. */
export function isDue(enrollment: { status: string; next_run_at: string }, nowMs: number): boolean {
  return enrollment.status === "active" && new Date(enrollment.next_run_at).getTime() <= nowMs;
}

/** Validate a steps array before save (admin). Pure. */
export function validateSteps(steps: unknown): { ok: boolean; error?: string } {
  if (!Array.isArray(steps)) return { ok: false, error: "steps must be an array" };
  if (steps.length === 0) return { ok: false, error: "add at least one step" };
  if (steps.length > MAX_STEPS) return { ok: false, error: `max ${MAX_STEPS} steps` };
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i] as Partial<JourneyStep>;
    if (typeof s !== "object" || s === null) return { ok: false, error: `step ${i + 1} is invalid` };
    if (typeof s.delayHours !== "number" || s.delayHours < 0 || s.delayHours > 24 * 365) {
      return { ok: false, error: `step ${i + 1}: delayHours must be 0–8760` };
    }
    if (typeof s.body !== "string" || s.body.trim().length === 0) {
      return { ok: false, error: `step ${i + 1}: body is required` };
    }
    if (s.body.length > 2000) return { ok: false, error: `step ${i + 1}: body too long` };
  }
  return { ok: true };
}
