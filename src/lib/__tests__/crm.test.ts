import { describe, it, expect } from "vitest";
import { contactKey, pickFirst, sortEventsDesc, tiyinToUzs, uzsToUsd, latest, earliest, type TimelineEvent } from "../crm";

describe("contactKey", () => {
  it("normalizes every UZ phone format to the same 9-digit key", () => {
    expect(contactKey("+998 90 123 45 67")).toBe("901234567");
    expect(contactKey("998901234567")).toBe("901234567");
    expect(contactKey("901234567")).toBe("901234567");
    expect(contactKey("(90) 123-45-67")).toBe("901234567");
  });
  it("falls back to the last 9 digits for non-UZ numbers", () => {
    expect(contactKey("+1 415 555 9876")).toBe("155559876"); // last 9 of 14155559876
  });
  it("rejects non-phone input", () => {
    expect(contactKey("123")).toBeNull();
    expect(contactKey("")).toBeNull();
    expect(contactKey(null)).toBeNull();
  });
});

describe("pickFirst", () => {
  it("returns the first non-empty trimmed value", () => {
    expect(pickFirst([null, "  ", "Alisher", "Bob"])).toBe("Alisher");
    expect(pickFirst([null, undefined, ""])).toBeNull();
  });
});

describe("sortEventsDesc", () => {
  it("orders newest first", () => {
    const ev: TimelineEvent[] = [
      { type: "inquiry", title: "a", at: "2026-01-01T00:00:00Z" },
      { type: "order", title: "b", at: "2026-03-01T00:00:00Z" },
      { type: "payment", title: "c", at: "2026-02-01T00:00:00Z" },
    ];
    expect(sortEventsDesc(ev).map((e) => e.title)).toEqual(["b", "c", "a"]);
  });
});

describe("money helpers", () => {
  it("converts tiyin → UZS → USD", () => {
    expect(tiyinToUzs(126_000_000_00)).toBe(126_000_000);
    expect(uzsToUsd(126_000_000, 12600)).toBe(10000);
    expect(uzsToUsd(100, 0)).toBe(0);
  });
});

describe("latest / earliest", () => {
  it("finds the bounds, ignoring nulls", () => {
    const ds = ["2026-05-01", null, "2026-01-01", "2026-03-01"];
    expect(latest(ds)).toBe("2026-05-01");
    expect(earliest(ds)).toBe("2026-01-01");
    expect(latest([])).toBeNull();
  });
});
