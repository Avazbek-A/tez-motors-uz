/**
 * Order-status vocabulary tests. The 7-step import lifecycle and its localized
 * labels are shared by the admin advance route and the Payme perform path; if
 * they drift, customers get wrong /track timelines and notification copy.
 */
import { describe, it, expect } from "vitest";
import { ORDER_STATUSES, ORDER_STATUS_LABELS, toEmailLocale } from "../order-status";

describe("ORDER_STATUSES", () => {
  it("is the canonical 7-step import lifecycle in order", () => {
    expect(ORDER_STATUSES).toEqual([
      "ordered",
      "deposit_paid",
      "sourcing",
      "in_transit",
      "at_customs",
      "ready_for_pickup",
      "delivered",
    ]);
  });
});

describe("ORDER_STATUS_LABELS", () => {
  it("has a label for every status in every supported locale", () => {
    for (const locale of ["ru", "uz", "en"] as const) {
      for (const status of ORDER_STATUSES) {
        expect(ORDER_STATUS_LABELS[locale][status]).toBeTruthy();
      }
    }
  });
});

describe("toEmailLocale", () => {
  it("passes through supported locales", () => {
    expect(toEmailLocale("uz")).toBe("uz");
    expect(toEmailLocale("en")).toBe("en");
    expect(toEmailLocale("ru")).toBe("ru");
  });

  it("defaults unknown/empty to ru", () => {
    expect(toEmailLocale(null)).toBe("ru");
    expect(toEmailLocale(undefined)).toBe("ru");
    expect(toEmailLocale("fr")).toBe("ru");
  });
});
