import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Automation heartbeat for the autopilot command-center: last run + freshness of
 * every scheduled job, from cron_runs (written by logEvent on cron.* events).
 * maxAgeHours = the job's cadence + slack; older than that ⇒ "stale".
 */
const JOBS: { key: string; label: string; cadence: string; maxAgeHours: number }[] = [
  { key: "rates", label: "FX rate refresh", cadence: "daily", maxAgeHours: 26 },
  { key: "ops_digest", label: "Daily ops action queue", cadence: "daily", maxAgeHours: 26 },
  { key: "lead_digest", label: "Daily lead digest", cadence: "daily", maxAgeHours: 26 },
  { key: "follow_ups", label: "Follow-up reminders", cadence: "daily", maxAgeHours: 26 },
  { key: "order_sla", label: "Order SLA watchdog", cadence: "daily", maxAgeHours: 26 },
  { key: "lead_nurture", label: "Cold-lead nurture", cadence: "daily", maxAgeHours: 26 },
  { key: "review_requests", label: "Post-delivery review requests", cadence: "daily", maxAgeHours: 26 },
  { key: "saved_search_alerts", label: "Saved-search alerts", cadence: "daily", maxAgeHours: 26 },
  { key: "otp_cleanup", label: "OTP cleanup", cadence: "daily", maxAgeHours: 26 },
  { key: "reservation_recovery", label: "Reservation recovery", cadence: "every 2h", maxAgeHours: 4 },
  { key: "price_watch_sweep", label: "Price-watch sweep", cadence: "every 6h", maxAgeHours: 8 },
  { key: "inventory_aging", label: "Aged-inventory markdowns", cadence: "weekly", maxAgeHours: 192 },
];

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("cron_runs")
      .select("job, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);

    const lastByJob = new Map<string, { detail: unknown; created_at: string }>();
    for (const r of data || []) {
      if (!lastByJob.has(r.job as string)) {
        lastByJob.set(r.job as string, { detail: r.detail, created_at: r.created_at as string });
      }
    }

    const now = Date.now();
    const jobs = JOBS.map((j) => {
      const last = lastByJob.get(j.key);
      const lastRunAt = last?.created_at ?? null;
      const ageHours = lastRunAt ? (now - new Date(lastRunAt).getTime()) / 3_600_000 : null;
      const status = lastRunAt == null ? "unknown" : ageHours! > j.maxAgeHours ? "stale" : "ok";
      return {
        key: j.key,
        label: j.label,
        cadence: j.cadence,
        lastRunAt,
        detail: last?.detail ?? null,
        status,
      };
    });

    return NextResponse.json({
      ok: true,
      summary: {
        total: jobs.length,
        ok: jobs.filter((j) => j.status === "ok").length,
        stale: jobs.filter((j) => j.status === "stale").length,
        unknown: jobs.filter((j) => j.status === "unknown").length,
      },
      jobs,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to read automation status" }, { status: 500 });
  }
}
