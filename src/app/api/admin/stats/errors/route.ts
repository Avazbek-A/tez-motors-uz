import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Recent server errors for the in-house error feed (admin → Errors). Read-only,
 * admin-gated. Source is the error_events table written by logEvent on any
 * error-level event.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("error_events")
      .select("id, event, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const rows = data || [];
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    return NextResponse.json({
      ok: true,
      total: rows.length,
      last24h: rows.filter((r) => (r.created_at as string) >= dayAgo).length,
      events: rows,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to read errors" }, { status: 500 });
  }
}
