import { describe, it, expect } from "vitest";
import {
  SHIPMENT_MILESTONES,
  milestoneLabel,
  nextMilestone,
  isTerminal,
  isValidMilestone,
  progressPct,
  milestoneStatus,
} from "../shipment-flow";

describe("shipment flow", () => {
  it("has 9 ordered milestones ending in delivered", () => {
    expect(SHIPMENT_MILESTONES.length).toBe(9);
    expect(SHIPMENT_MILESTONES[0]).toBe("created");
    expect(SHIPMENT_MILESTONES.at(-1)).toBe("delivered");
  });
  it("labels and validates", () => {
    expect(milestoneLabel("at_customs")).toBe("At customs");
    expect(isValidMilestone("shipped")).toBe(true);
    expect(isValidMilestone("nope")).toBe(false);
  });
  it("advances to the next milestone, null at terminal", () => {
    expect(nextMilestone("created")).toBe("supplier_paid");
    expect(nextMilestone("arrived")).toBe("delivered");
    expect(nextMilestone("delivered")).toBeNull();
    expect(nextMilestone("bogus")).toBeNull();
  });
  it("knows the terminal state", () => {
    expect(isTerminal("delivered")).toBe(true);
    expect(isTerminal("in_transit")).toBe(false);
  });
  it("computes progress", () => {
    expect(progressPct("created")).toBe(0);
    expect(progressPct("delivered")).toBe(100);
    expect(progressPct("shipped")).toBeGreaterThan(0);
    expect(progressPct("bogus")).toBe(0);
  });
  it("classifies milestone status relative to current", () => {
    expect(milestoneStatus("created", "shipped")).toBe("done");
    expect(milestoneStatus("shipped", "shipped")).toBe("current");
    expect(milestoneStatus("arrived", "shipped")).toBe("pending");
  });
});
