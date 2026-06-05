import { describe, it, expect } from "vitest";
import { tenantSlugFromHost, tenantsEnabled, DEFAULT_TENANT_ID } from "../tenant";

describe("tenantsEnabled", () => {
  it("is off unless MULTI_TENANT=1", () => {
    expect(tenantsEnabled({})).toBe(false);
    expect(tenantsEnabled({ MULTI_TENANT: "0" })).toBe(false);
    expect(tenantsEnabled({ MULTI_TENANT: "1" })).toBe(true);
  });
});

describe("tenantSlugFromHost", () => {
  it("maps apex + www to the default tenant (null)", () => {
    expect(tenantSlugFromHost("tezmotors.uz")).toBeNull();
    expect(tenantSlugFromHost("www.tezmotors.uz")).toBeNull();
    expect(tenantSlugFromHost("localhost")).toBeNull();
    expect(tenantSlugFromHost("localhost:3000")).toBeNull();
  });

  it("extracts a subdomain slug", () => {
    expect(tenantSlugFromHost("avto-bek.tezmotors.uz")).toBe("avto-bek");
    expect(tenantSlugFromHost("DealerX.tezmotors.uz:443")).toBe("dealerx");
  });

  it("takes the left-most label for deeper subdomains", () => {
    expect(tenantSlugFromHost("shop.dealerx.tezmotors.uz")).toBe("dealerx");
  });

  it("returns null for empty / unknown hosts (fail-safe to default)", () => {
    expect(tenantSlugFromHost(null)).toBeNull();
    expect(tenantSlugFromHost("")).toBeNull();
    expect(tenantSlugFromHost("some-other-domain.com")).toBeNull();
  });

  it("DEFAULT_TENANT_ID is the seeded fixed id", () => {
    expect(DEFAULT_TENANT_ID).toBe("00000000-0000-0000-0000-000000000001");
  });
});
