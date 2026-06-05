/**
 * Server-side tenant resolution (Phase AV). Maps a request host to a tenant id,
 * falling back to the default tenant when multi-tenancy is off, the host is the
 * apex, or the lookup fails. Fail-open by design — a request must always resolve
 * to SOME tenant, never error.
 */
import { DEFAULT_TENANT_ID, tenantsEnabled, tenantSlugFromHost } from "./tenant";
import { createServiceClient } from "./supabase/service";

/** Resolve the tenant id for a request host. Always returns a valid id. */
export async function resolveTenantId(host: string | null | undefined): Promise<string> {
  if (!tenantsEnabled()) return DEFAULT_TENANT_ID;
  const slug = tenantSlugFromHost(host);
  if (!slug) return DEFAULT_TENANT_ID;
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("tenants")
      .select("id, status")
      .eq("slug", slug)
      .maybeSingle();
    if (data && data.status === "active") return data.id as string;
  } catch {
    /* fall through to default */
  }
  return DEFAULT_TENANT_ID;
}

/**
 * Apply tenant scoping to a Supabase query builder. A no-op when multi-tenancy
 * is off, so wiring this into a query today changes nothing — it only starts
 * filtering once MULTI_TENANT=1. This is the single place future read/write
 * paths call to become tenant-aware (increment 2).
 */
export function scopeToTenant<Q extends { eq: (col: string, val: string) => Q }>(query: Q, tenantId: string): Q {
  if (!tenantsEnabled()) return query;
  return query.eq("tenant_id", tenantId);
}
