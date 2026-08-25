import { describe, it, expect } from "vitest";
import { SiteSettingsSchema, mergeWithDefaults } from "../site-settings";

describe("SiteSettingsSchema social URLs", () => {
  it("accepts http(s) social URLs and empty strings", () => {
    expect(SiteSettingsSchema.safeParse({ instagram: "https://instagram.com/tez" }).success).toBe(true);
    expect(SiteSettingsSchema.safeParse({ telegram: "https://t.me/tez", whatsapp: "" }).success).toBe(true);
  });
  it("rejects javascript:/data: schemes (stored-XSS guard)", () => {
    // Regression: these used z.string().url(), which accepts dangerous schemes
    // that then render as <a href> in the global header.
    expect(SiteSettingsSchema.safeParse({ instagram: "javascript:alert(document.cookie)" }).success).toBe(false);
    expect(SiteSettingsSchema.safeParse({ telegram: "data:text/html,<script>1</script>" }).success).toBe(false);
    expect(SiteSettingsSchema.safeParse({ whatsapp: "javascript:fetch('//evil')" }).success).toBe(false);
  });
});

describe("mergeWithDefaults", () => {
  it("falls back to SITE_CONFIG values for missing fields", () => {
    const r = mergeWithDefaults({ siteName: "Custom" });
    expect(r.siteName).toBe("Custom");
    expect(typeof r.mapLat).toBe("number");
    expect(r.instagram.length).toBeGreaterThan(0);
  });
});
