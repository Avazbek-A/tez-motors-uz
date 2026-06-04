import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Public health endpoint (Phase AQ) for external uptime monitors.
 *
 * Cheap DB reachability probe → 200 { ok:true } when healthy, 503 when the
 * database can't be reached. Deliberately reveals NOTHING sensitive — no
 * version, no env, no schema, no internal detail — just ok/not-ok per check.
 * Never cached.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  let db = false;
  try {
    const supabase = createServiceClient();
    // Cheapest possible probe: a head count on a tiny, always-present table.
    const { error } = await supabase.from("site_settings").select("id", { count: "exact", head: true });
    db = !error;
  } catch {
    db = false;
  }

  const ok = db;
  return NextResponse.json(
    { ok, checks: { db } },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
