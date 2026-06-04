import { describe, it, expect } from "vitest";
import { normalizeTag, mergeHashtags, trendingTagBudget } from "../marketing-hashtags";

describe("normalizeTag", () => {
  it("adds a leading # and strips junk", () => {
    expect(normalizeTag("byduzbekistan")).toBe("#byduzbekistan");
    expect(normalizeTag("#avtosalon tashkent")).toBe("#avtosalontashkent");
    expect(normalizeTag("##double")).toBe("#double");
  });
  it("keeps non-Latin scripts", () => {
    expect(normalizeTag("ташкент")).toBe("#ташкент");
  });
  it("returns empty for nothing usable", () => {
    expect(normalizeTag("")).toBe("");
    expect(normalizeTag("#")).toBe("");
    expect(normalizeTag("!!!")).toBe("");
  });
});

describe("mergeHashtags", () => {
  it("appends trending tags not already present", () => {
    const out = mergeHashtags("Купите BYD\n\n#tezmotors", ["byduzbekistan", "avtosalontashkent"], 8);
    expect(out).toContain("#tezmotors");
    expect(out).toContain("#byduzbekistan");
    expect(out).toContain("#avtosalontashkent");
  });
  it("dedupes case-insensitively against existing + added", () => {
    const out = mergeHashtags("text #TezMotors", ["#tezmotors", "TashKent", "tashkent"], 8);
    // #tezmotors already present (case-insensitive) → not re-added; tashkent added once
    expect(out.match(/#tezmotors/gi)?.length).toBe(1);
    expect(out.match(/#tashkent/gi)?.length).toBe(1);
  });
  it("respects maxAdd", () => {
    const out = mergeHashtags("body", ["a", "b", "c", "d"], 2);
    expect(out.match(/#/g)?.length).toBe(2);
  });
  it("returns text unchanged when nothing to add", () => {
    expect(mergeHashtags("body", [], 8)).toBe("body");
    expect(mergeHashtags("body", null, 8)).toBe("body");
    expect(mergeHashtags("body #a", ["a"], 8)).toBe("body #a");
    expect(mergeHashtags("body", ["x"], 0)).toBe("body");
  });
});

describe("trendingTagBudget", () => {
  it("is generous for instagram, modest for telegram, off for ad/blog", () => {
    expect(trendingTagBudget("instagram")).toBe(8);
    expect(trendingTagBudget("telegram")).toBe(4);
    expect(trendingTagBudget("ad")).toBe(0);
    expect(trendingTagBudget("blog")).toBe(0);
  });
});
