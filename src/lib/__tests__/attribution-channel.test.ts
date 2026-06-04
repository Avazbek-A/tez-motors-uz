import { describe, it, expect } from "vitest";
import { channelKey } from "../attribution";

describe("channelKey", () => {
  it("returns 'direct' for no attribution", () => {
    expect(channelKey(null)).toBe("direct");
    expect(channelKey({})).toBe("direct");
  });

  it("buckets known utm_source values", () => {
    expect(channelKey({ source: "olx" })).toBe("olx");
    expect(channelKey({ source: "OLX.uz" })).toBe("olx");
    expect(channelKey({ source: "google" })).toBe("google");
    expect(channelKey({ source: "meta" })).toBe("meta");
    expect(channelKey({ source: "instagram" })).toBe("instagram");
    expect(channelKey({ source: "facebook" })).toBe("facebook");
    expect(channelKey({ source: "telegram" })).toBe("telegram");
    expect(channelKey({ source: "avtoelon" })).toBe("avtoelon");
  });

  it("derives channel from referrer host when no source", () => {
    expect(channelKey({ referrer: "https://www.olx.uz/d/123" })).toBe("olx");
    expect(channelKey({ referrer: "https://t.me/somechannel" })).toBe("telegram");
  });

  it("keeps an unknown named source as-is", () => {
    expect(channelKey({ source: "newsletter" })).toBe("newsletter");
  });
});
