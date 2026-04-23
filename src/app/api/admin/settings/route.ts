import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { SiteSettingsSchema, mergeWithDefaults } from "@/lib/site-settings";

export async function GET(request: NextRequest) {
  const unauth = await requireAdmin(request);
  if (unauth) return unauth;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("site_settings")
    .select("values, updated_at")
    .eq("id", "singleton")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }

  const parsed = SiteSettingsSchema.safeParse(data?.values ?? {});
  return NextResponse.json({
    values: mergeWithDefaults(parsed.success ? parsed.data : {}),
    updated_at: data?.updated_at ?? null,
  });
}

export async function PUT(request: NextRequest) {
  const unauth = await requireAdmin(request);
  if (unauth) return unauth;

  const body = await request.json().catch(() => null);
  const parsed = SiteSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid settings", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("site_settings")
    .upsert({ id: "singleton", values: parsed.data, updated_at: new Date().toISOString() });

  if (error) {
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }

  return NextResponse.json({ success: true, values: mergeWithDefaults(parsed.data) });
}
