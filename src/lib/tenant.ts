/**
 * Multi-tenant primitives (Phase AV — foundation increment 1).
 *
 * The resolution SEAM that future query-scoping hangs off. Pure host parsing +
 * the default-tenant constant + the feature flag. With MULTI_TENANT off (the
 * default), everything resolves to the default tenant and behavior is unchanged.
 *
 * Tenant DB lookup lives in tenant-context.ts (server). This file stays pure +
 * unit-tested so the routing logic is verifiable in isolation.
 */

/** Fixed id of the default tenant (the existing single dealer). Mirrors the
 *  seed in migration 066. */
export const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";

/** Off by default — set MULTI_TENANT=1 to turn the seam live. */
export function tenantsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.MULTI_TENANT === "1";
}

/** Apex domains that map straight to the default tenant (no subdomain tenant). */
export const APEX_DOMAINS = ["tezmotors.uz", "localhost", "127.0.0.1"];

/**
 * Extract a tenant slug from a request host. Pure.
 *  - apex / www.apex / unknown host          → null (= default tenant)
 *  - {slug}.apex (slug not "www")             → slug
 * Port is stripped; case-insensitive.
 */
export function tenantSlugFromHost(
  host: string | null | undefined,
  apexDomains: string[] = APEX_DOMAINS,
): string | null {
  if (!host) return null;
  const h = host.toLowerCase().split(":")[0].trim();
  if (!h) return null;
  for (const apex of apexDomains) {
    if (h === apex || h === `www.${apex}`) return null;
    if (h.endsWith(`.${apex}`)) {
      const label = h.slice(0, -(apex.length + 1)).split(".").pop() || "";
      return label && label !== "www" ? label : null;
    }
  }
  return null; // host we don't recognize → default tenant (fail-safe)
}
