"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

interface ErrorEvent {
  id: string;
  event: string;
  detail: Record<string, unknown> | null;
  created_at: string;
}
interface EventAgg { event: string; last24h: number; last7d: number; total: number; lastSeen: string }
interface VitalRow { metric: string; p75: number | null; samples: number; rating: string | null }
interface Data {
  total: number;
  last24h: number;
  last7d?: number;
  byEvent?: EventAgg[];
  events: ErrorEvent[];
}

function ago(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function detailText(detail: Record<string, unknown> | null): string {
  if (!detail) return "";
  const msg = detail.message ?? detail.context ?? "";
  if (typeof msg === "string" && msg) return msg;
  try {
    return JSON.stringify(detail).slice(0, 240);
  } catch {
    return "";
  }
}

export default function AdminErrorsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [vitals, setVitals] = useState<VitalRow[] | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats/errors")
      .then((r) => r.json())
      .then((d) => setData(d && d.ok ? d : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
    fetch("/api/admin/stats/vitals")
      .then((r) => r.json())
      .then((d) => { if (d?.ok) setVitals(d.metrics || []); })
      .catch(() => {});
  }, []);

  const vitalColor = (r: string | null) =>
    r === "good" ? "text-[var(--success,#16a34a)]" : r === "poor" ? "text-[var(--danger,#ef4444)]" : "text-muted-foreground";

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-1">
        <AlertTriangle className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">Errors</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Recent server errors. These are fail-open (they never break a request) and the dealer is
        alerted — this feed is for diagnosing them. {data && <span className="font-mono text-foreground">{data.last24h}</span>} in the last 24h.
      </p>

      {/* Real-user Core Web Vitals (p75, last 7d) — the experience visitors get. */}
      {vitals && vitals.some((v) => v.p75 != null) && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-2">Core Web Vitals (real users, p75 · 7d)</h2>
          <div className="flex flex-wrap gap-3">
            {vitals.filter((v) => v.p75 != null).map((v) => (
              <div key={v.metric} className="bg-card border border-border px-4 py-3 rounded">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{v.metric}</div>
                <div className={`text-lg font-mono ${vitalColor(v.rating)}`}>
                  {v.metric === "CLS" ? v.p75!.toFixed(3) : `${Math.round(v.p75!)}ms`}
                </div>
                <div className="text-[10px] text-muted-foreground">{v.samples} samples</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SLO summary: error volume by event tag (24h / 7d) so spikes stand out. */}
      {data && data.byEvent && data.byEvent.length > 0 && (
        <div className="mb-6 bg-card border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-4 py-2 font-medium">Event</th>
                <th className="px-4 py-2 font-medium text-right">24h</th>
                <th className="px-4 py-2 font-medium text-right">7d</th>
                <th className="px-4 py-2 font-medium text-right">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {data.byEvent.slice(0, 12).map((e) => (
                <tr key={e.event} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 font-mono text-foreground">{e.event}</td>
                  <td className={`px-4 py-2 text-right font-mono ${e.last24h >= 5 ? "text-[var(--danger,#ef4444)]" : "text-muted-foreground"}`}>{e.last24h}</td>
                  <td className="px-4 py-2 text-right font-mono text-muted-foreground">{e.last7d}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{ago(e.lastSeen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">No error data (requires migration 036).</p>
      ) : data.events.length === 0 ? (
        <p className="text-sm text-[var(--success)]">No errors recorded — clean.</p>
      ) : (
        <div className="bg-card border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Event</th>
                <th className="px-4 py-2 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {data.events.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0 align-top">
                  <td className="px-4 py-2.5 font-mono text-muted-foreground whitespace-nowrap">{ago(e.created_at)}</td>
                  <td className="px-4 py-2.5 font-mono text-[var(--danger)] whitespace-nowrap">{e.event}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground break-all">{detailText(e.detail)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
