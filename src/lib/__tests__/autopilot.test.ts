import { describe, it, expect } from "vitest";
import { resolveAutopilot, DEFAULT_AUTOPILOT, markdownAllowed, sourceAllowed } from "../autopilot";

describe("resolveAutopilot", () => {
  it("defaults everything OFF on empty/garbage input", () => {
    expect(resolveAutopilot(undefined)).toEqual(DEFAULT_AUTOPILOT);
    expect(resolveAutopilot("nope").master).toBe(false);
    expect(resolveAutopilot({}).autoMarkdown.enabled).toBe(false);
  });
  it("merges + clamps numeric bounds", () => {
    const c = resolveAutopilot({ master: true, autoMarkdown: { enabled: true, maxPerRun: 999, minDaysOnLot: 1, minMarginPct: -5 } });
    expect(c.master).toBe(true);
    expect(c.autoMarkdown.maxPerRun).toBe(20); // clamped from 999
    expect(c.autoMarkdown.minDaysOnLot).toBe(14); // clamped from 1
    expect(c.autoMarkdown.minMarginPct).toBe(0); // clamped from -5
  });
  it("gates require BOTH master and the sub-flag", () => {
    expect(markdownAllowed(resolveAutopilot({ master: false, autoMarkdown: { enabled: true } }))).toBe(false);
    expect(markdownAllowed(resolveAutopilot({ master: true, autoMarkdown: { enabled: true } }))).toBe(true);
    expect(sourceAllowed(resolveAutopilot({ master: true, autoSourceDrafts: { enabled: false } }))).toBe(false);
    expect(sourceAllowed(resolveAutopilot({ master: true, autoSourceDrafts: { enabled: true } }))).toBe(true);
  });
});
