import { describe, it, expect } from "vitest";
import { SEGMENTS, segmentDef, dedupeContacts, personalize } from "../segments";

describe("SEGMENTS catalog", () => {
  it("has unique keys and at least one channel each", () => {
    const keys = SEGMENTS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const s of SEGMENTS) expect(s.channels.length).toBeGreaterThan(0);
  });
  it("looks up by key", () => {
    expect(segmentDef("delivered")?.label).toBe("Past buyers");
    expect(segmentDef("nope")).toBeUndefined();
  });
});

describe("dedupeContacts", () => {
  it("merges rows for the same phone, keeping best name/email", () => {
    const out = dedupeContacts([
      { phone: "+998901234567", name: null, email: null },
      { phone: "901234567", name: "Alisher", email: "a@x.uz" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Alisher");
    expect(out[0].email).toBe("a@x.uz");
  });
  it("keeps email-only contacts separate by email", () => {
    const out = dedupeContacts([
      { email: "a@x.uz", name: "A" },
      { email: "b@x.uz", name: "B" },
      { email: "a@x.uz", name: null },
    ]);
    expect(out).toHaveLength(2);
  });
  it("treats truly anonymous rows as distinct", () => {
    const out = dedupeContacts([{ name: "x" }, { name: "y" }]);
    expect(out).toHaveLength(2);
  });
});

describe("personalize", () => {
  it("substitutes {name}", () => {
    expect(personalize("Salom {name}!", "Sardor", "uz")).toBe("Salom Sardor!");
  });
  it("falls back per locale when no name", () => {
    expect(personalize("Hi {name}", null, "en")).toBe("Hi there");
    expect(personalize("Здравствуйте, {name}", null, "ru")).toBe("Здравствуйте, уважаемый клиент");
  });
});
