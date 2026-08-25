import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";
import { DEFAULT_TENANT_ID, tenantsEnabled } from "@/lib/tenant";

/**
 * Tenant management (Phase AV — onboarding seam). Lets an operator provision a
 * dealer: create/list/suspend tenants. Admin-gated, audited. Harmless while
 * MULTI_TENANT is off (tenants can exist; nothing resolves to them until the
 * flag is on). Service-role only (the tenants table has no RLS policies).
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("tenants")
    .select("id, slug, name, primary_host, status, created_at")
    .order("created_at", { ascending: true })
    .limit(500);
  return NextResponse.json({ tenants: data || [], enabled: tenantsEnabled(), defaultId: DEFAULT_TENANT_ID });
}

const createSchema = z.object({
  // DNS-label slug: the subdomain a tenant is served on ({slug}.tezmotors.uz).
  slug: z.string().min(2).max(40).regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "slug must be a DNS label (a-z, 0-9, hyphens)"),
  name: z.string().min(1).max(120),
  primary_host: z.string().max(200).optional().nullable(),
});

export async function POST(request: NextRequest) {
  // Owner-only: provisioning a tenant is a super-admin action (mirrors user
  // management). A low-trust 'rep' must not create/suspend dealers.
  const guard = await requireRole(request, ["owner"]);
  if (guard) return guard;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  if (parsed.data.slug === "default" || parsed.data.slug === "www") {
    return NextResponse.json({ error: "Reserved slug" }, { status: 400 });
  }
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("tenants")
    .insert({ slug: parsed.data.slug, name: parsed.data.name, primary_host: parsed.data.primary_host ?? null })
    .select("id")
    .single();
  if (error) {
    // Unique violation on slug → friendly 409.
    const conflict = /duplicate|unique/i.test(error.message);
    return NextResponse.json({ error: conflict ? "Slug already taken" : error.message }, { status: conflict ? 409 : 500 });
  }
  logAdminAction(request, { action: "create", entity: "tenant", entity_id: data.id, diff: { slug: parsed.data.slug } }).catch(() => {});
  return NextResponse.json({ success: true, id: data.id }, { status: 201 });
}

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["active", "suspended"]),
});

export async function PATCH(request: NextRequest) {
  const guard = await requireRole(request, ["owner"]);
  if (guard) return guard;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (parsed.data.id === DEFAULT_TENANT_ID) {
    return NextResponse.json({ error: "The default tenant cannot be suspended" }, { status: 400 });
  }
  const supabase = createServiceClient();
  const { data: updated, error } = await supabase.from("tenants").update({ status: parsed.data.status }).eq("id", parsed.data.id).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated || updated.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  logAdminAction(request, { action: "status_change", entity: "tenant", entity_id: parsed.data.id, diff: { status: parsed.data.status } }).catch(() => {});
  return NextResponse.json({ success: true });
}
