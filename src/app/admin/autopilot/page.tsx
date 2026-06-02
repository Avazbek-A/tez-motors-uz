"use client";

import { useEffect, useState } from "react";
import { Activity, Loader2 } from "lucide-react";

interface Job {
  key: string;
  label: string;
  cadence: string;
  lastRunAt: string | null;
  detail: Record<string, unknown> | null;
  status: "ok" | "stale" | "unknown";
}

interface Data {
  summary: { total: number; ok: number; stale: number; unknown: number };
  jobs: Job[];
}

const DOT: Record<string, string> = {
  ok: "bg-[var(--success)]",
  stale: "bg-[var(--danger)]",
  unknown: "bg-[var(--fg-4)]",
};
const STATUS_LABEL: Record<string, string> = { ok: "Healthy", stale: "Stale", unknown: "No runs yet" };

function ago(iso: string | null): string {
  if (!iso) return "—";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function summarizeDetail(detail: Record<string, unknown> | null): string {
  if (!detail) return "";
  return Object.entries(detail)
    .filter(([, v]) => typeof v === "number" || typeof v === "string" || typeof v === "boolean")
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");
}

export default function AdminAutopilotPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats/automation")
      .then((r) => r.json())
      .then((d) => setData(d && d.ok ? d : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-1">
        <Activity className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">Autopilot</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        The heartbeat of every automation — last run and freshness. &ldquo;Stale&rdquo; means a job
        hasn&apos;t reported within its expected window (check the cron worker / CRON_SECRET).
      </p>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">No automation data yet — runs appear here once the scheduled jobs fire (requires migration 032).</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[
              { label: "Healthy", value: data.summary.ok, tone: "text-[var(--success)]" },
              { label: "Stale", value: data.summary.stale, tone: data.summary.stale > 0 ? "text-[var(--danger)]" : "text-foreground" },
              { label: "No runs yet", value: data.summary.unknown, tone: "text-muted-foreground" },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-border p-4">
                <p className={`font-mono text-2xl font-semibold ${s.tone}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="px-4 py-2 font-medium">Job</th>
                  <th className="px-4 py-2 font-medium">Cadence</th>
                  <th className="px-4 py-2 font-medium">Last run</th>
                  <th className="px-4 py-2 font-medium">Last result</th>
                  <th className="px-4 py-2 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.jobs.map((j) => (
                  <tr key={j.key} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-foreground">{j.label}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{j.cadence}</td>
                    <td className="px-4 py-2.5 font-mono text-muted-foreground">{ago(j.lastRunAt)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{summarizeDetail(j.detail) || "—"}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="inline-flex items-center gap-2 justify-end">
                        <span className={`w-2 h-2 rounded-full ${DOT[j.status]}`} />
                        <span className="text-xs text-muted-foreground">{STATUS_LABEL[j.status]}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
