import { describe, it, expect } from "vitest";
import {
  renderTemplate,
  initialEnrollment,
  advanceEnrollment,
  isDue,
  validateSteps,
  type JourneyStep,
} from "../automation/journey";

const NOW = Date.parse("2026-06-05T00:00:00Z");
const steps: JourneyStep[] = [
  { delayHours: 0, body: "Hi {name}, thanks for your interest in {car}." },
  { delayHours: 48, body: "Still thinking about {car}? Reply to chat." },
  { delayHours: 120, body: "Last nudge on {car} — {price}." },
];

describe("renderTemplate", () => {
  it("fills known placeholders and blanks unknown ones", () => {
    expect(renderTemplate("Hi {name}, {car} is {price}", { name: "Bek", car: "BYD Song", price: "$20k" }))
      .toBe("Hi Bek, BYD Song is $20k");
    expect(renderTemplate("Hi {name}{missing}", { name: "Bek" })).toBe("Hi Bek");
  });
});

describe("initialEnrollment", () => {
  it("schedules step 0 after its delay", () => {
    const e = initialEnrollment(steps, NOW);
    expect(e.current_step).toBe(0);
    expect(e.status).toBe("active");
    expect(e.next_run_at).toBe(new Date(NOW).toISOString()); // delay 0
  });
  it("completes immediately for an empty journey", () => {
    expect(initialEnrollment([], NOW).status).toBe("completed");
  });
});

describe("advanceEnrollment", () => {
  it("schedules the next step from now, by its delay", () => {
    const e = advanceEnrollment(0, steps, NOW); // just sent step 0 → schedule step 1 (+48h)
    expect(e.current_step).toBe(1);
    expect(e.status).toBe("active");
    expect(e.next_run_at).toBe(new Date(NOW + 48 * 3_600_000).toISOString());
  });
  it("completes after the last step", () => {
    const e = advanceEnrollment(2, steps, NOW);
    expect(e.status).toBe("completed");
    expect(e.next_run_at).toBeNull();
  });
});

describe("isDue", () => {
  it("is due only when active and past next_run_at", () => {
    expect(isDue({ status: "active", next_run_at: new Date(NOW - 1).toISOString() }, NOW)).toBe(true);
    expect(isDue({ status: "active", next_run_at: new Date(NOW + 1000).toISOString() }, NOW)).toBe(false);
    expect(isDue({ status: "completed", next_run_at: new Date(NOW - 1).toISOString() }, NOW)).toBe(false);
  });
});

describe("validateSteps", () => {
  it("accepts a well-formed sequence", () => {
    expect(validateSteps(steps).ok).toBe(true);
  });
  it("rejects empty / bad shapes", () => {
    expect(validateSteps([]).ok).toBe(false);
    expect(validateSteps("nope").ok).toBe(false);
    expect(validateSteps([{ delayHours: -1, body: "x" }]).ok).toBe(false);
    expect(validateSteps([{ delayHours: 1, body: "" }]).ok).toBe(false);
  });
});
