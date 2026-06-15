"use client";

import { useEffect, useState } from "react";
import { Gauge, Loader2 } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

const usd = (n: number | null | undefined) => (n == null ? "—" : "$" + Math.round(n).toLocaleString("en-US"));

interface Health {
  overall: string;
  sources: { source: string; count24h: number; count7d: number; count30d: number; daysSinceSeen: number | null; status: string }[];
}
interface Calibration {
  calibrated: boolean;
  proxy?: boolean;
  matched?: number;
  soldTotal?: number;
  medianBiasPct?: number;
  meanAbsErrorPct?: number;
  note?: string;
  reason?: string;
}
interface Leads {
  savedSearches: number;
  stockCars: number;
  matchedCount: number;
  unmatchedCount: number;
  unmatched: { brand?: string; model?: string }[];
}
interface PolicySim {
  dutyDeltaPct: number;
  perFuel: { fuel: string; dutyNowPct: number; landedNowUsd: number; landedNewUsd: number; deltaUsd: number }[];
  catalog: { carsCounted: number; avgExtraLandedUsd: number; totalMarginImpactUsd: number; carsFlippedUnprofitable: number };
}
interface SearchStats {
  bing: { configured: boolean; verified: boolean; clicks?: number; impressions?: number } | null;
  yandex: { configured: boolean; verified: boolean; loaded: boolean; sqi?: number | null; searchablePages?: number | null; status?: string; topQueries?: { query: string; shows: number; clicks: number }[] } | null;
  google: {
    configured: boolean;
    clicks28d?: number;
    impressions28d?: number;
    avgPosition?: number | null;
    topQueries?: { query: string; clicks: number; impressions: number }[];
    topPages?: { page: string; clicks: number; impressions: number; ctr: number }[];
    fixCtrPages?: { page: string; impressions: number; ctr: number }[];
  } | null;
}
interface Coverage {
  checked: number;
  indexed: number;
  notIndexed: { label: string; path: string; state: string }[];
}

const STATUS_TONE: Record<string, string> = {
  ok: "text-[var(--success)]",
  healthy: "text-[var(--success)]",
  stale: "text-[var(--danger)]",
  degraded: "text-[var(--danger)]",
  idle: "text-muted-foreground",
  no_data: "text-muted-foreground",
};

const COPY: Record<Locale, { title: string; intro: string; health: string; calibration: string; leads: string; policy: string; dutyApply: string; loading: string; indexing: string }> = {
  ru: {
    title: "Движок — диагностика",
    intro: "Здоровье движка ценообразования: свежесть сборщиков, калибровка по продажам, спрос без покрытия и симулятор пошлин.",
    health: "Здоровье сборщиков",
    calibration: "Калибровка по продажам",
    leads: "Спрос ↔ склад",
    policy: "Симулятор пошлин",
    dutyApply: "Пересчитать",
    loading: "Загрузка…",
    indexing: "Индексация (Bing/Yandex)",
  },
  uz: {
    title: "Dvigatel diagnostikasi",
    intro: "Narxlash dvigateli sog'lig'i: yig'uvchilar yangiligi, sotuvlar bo'yicha kalibrlash, qoplanmagan talab va boj simulyatori.",
    health: "Yig'uvchilar holati",
    calibration: "Sotuvlar kalibratsiyasi",
    leads: "Talab ↔ ombor",
    policy: "Boj simulyatori",
    dutyApply: "Qayta hisoblash",
    loading: "Yuklanmoqda…",
    indexing: "Indeksatsiya (Bing/Yandex)",
  },
  en: {
    title: "Engine Ops",
    intro: "Health of the pricing engine: collector freshness, sales calibration, uncovered demand, and a customs-duty simulator.",
    health: "Scraper health",
    calibration: "Sales calibration",
    leads: "Demand ↔ stock",
    policy: "Policy simulator",
    dutyApply: "Recompute",
    loading: "Loading…",
    indexing: "Indexing (Bing/Yandex)",
  },
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {children}
    </div>
  );
}

export default function AdminEnginePage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [health, setHealth] = useState<Health | null>(null);
  const [calib, setCalib] = useState<Calibration | null>(null);
  const [leads, setLeads] = useState<Leads | null>(null);
  const [sim, setSim] = useState<PolicySim | null>(null);
  const [search, setSearch] = useState<SearchStats | null>(null);
  const [duty, setDuty] = useState(10);
  const [loading, setLoading] = useState(true);
  const [inBusy, setInBusy] = useState(false);
  const [inResult, setInResult] = useState<string | null>(null);
  const [cov, setCov] = useState<Coverage | null>(null);
  const [covBusy, setCovBusy] = useState(false);

  const submitIndexNow = async () => {
    setInBusy(true);
    setInResult(null);
    try {
      const d = await fetch("/api/admin/indexnow", { method: "POST" }).then((r) => r.json());
      setInResult(d?.ok ? `✓ ${d.submitted} URLs submitted (${d.cars} cars)` : "✗ failed");
    } catch {
      setInResult("✗ failed");
    } finally {
      setInBusy(false);
    }
  };

  const checkCoverage = async () => {
    setCovBusy(true);
    try {
      const d = await fetch("/api/admin/index-coverage", { method: "POST" }).then((r) => r.json());
      if (d?.ok) setCov(d);
    } finally {
      setCovBusy(false);
    }
  };

  const [resubBusy, setResubBusy] = useState(false);
  const [resubResult, setResubResult] = useState<string | null>(null);
  const resubmitSitemap = async () => {
    setResubBusy(true);
    setResubResult(null);
    try {
      const d = await fetch("/api/admin/resubmit-sitemap", { method: "POST" }).then((r) => r.json());
      setResubResult(d?.ok ? `Google ${d.google?.status === 204 ? "✓" : d.google?.status} · Yandex ${d.yandex?.ok ? "✓" : d.yandex?.status}` : "✗ failed");
    } catch {
      setResubResult("✗ failed");
    } finally {
      setResubBusy(false);
    }
  };

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/market/health").then((r) => r.json()).then((d) => d?.ok && setHealth(d)),
      fetch("/api/admin/calibration").then((r) => r.json()).then((d) => d?.ok && setCalib(d)),
      fetch("/api/admin/leads/match").then((r) => r.json()).then((d) => d?.ok && setLeads(d)),
      fetch("/api/admin/search-stats").then((r) => r.json()).then((d) => d?.ok && setSearch(d)),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch(`/api/admin/policy-sim?dutyDelta=${duty}`).then((r) => r.json()).then((d) => d?.ok && setSim(d));
  }, [duty]);

  return (
    <div className="max-w-5xl">
      <div className="mb-1 flex items-center gap-3">
        <Gauge className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">{t.title}</h1>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t.intro}</p>

      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={submitIndexNow}
          disabled={inBusy}
          className="border border-primary px-3 py-1.5 text-sm text-primary hover:bg-primary/10 disabled:opacity-50"
        >
          {inBusy ? "…" : "Submit catalog to IndexNow (Bing/Yandex)"}
        </button>
        {inResult && <span className="font-mono text-xs text-muted-foreground">{inResult}</span>}
      </div>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title={t.health}>
            {health ? (
              <table className="w-full text-sm">
                <tbody>
                  {health.sources.map((s) => (
                    <tr key={s.source} className="border-b border-border last:border-0">
                      <td className="py-1.5 font-mono text-foreground">{s.source}</td>
                      <td className="py-1.5 text-right font-mono text-muted-foreground">{s.count7d}/7d</td>
                      <td className="py-1.5 text-right font-mono text-muted-foreground">{s.daysSinceSeen != null ? `${s.daysSinceSeen}d` : "—"}</td>
                      <td className={`py-1.5 text-right font-mono ${STATUS_TONE[s.status]}`}>{s.status}</td>
                    </tr>
                  ))}
                  {health.sources.length === 0 && <tr><td className="py-1.5 text-muted-foreground">—</td></tr>}
                </tbody>
              </table>
            ) : <p className="text-sm text-muted-foreground">—</p>}
          </Card>

          <Card title={t.calibration}>
            {calib?.calibrated ? (
              <div className="space-y-1 text-sm">
                <div className="font-mono text-foreground">
                  bias {calib.medianBiasPct! > 0 ? "+" : ""}{calib.medianBiasPct}% <span className="text-muted-foreground">· MAE {calib.meanAbsErrorPct}% · n={calib.matched}</span>
                </div>
                <p className="text-xs text-muted-foreground">{calib.note}</p>
                {calib.proxy && <p className="text-[11px] text-[var(--warning)]">proxy: last-listed price, not realized sale price</p>}
              </div>
            ) : <p className="text-sm text-muted-foreground">{calib?.reason || "—"}</p>}
          </Card>

          <Card title={t.leads}>
            {leads ? (
              <div className="space-y-2 text-sm">
                <div className="font-mono text-foreground">
                  {leads.matchedCount} matched <span className="text-muted-foreground">· {leads.unmatchedCount} uncovered · {leads.stockCars} in stock</span>
                </div>
                {leads.unmatched.length > 0 && (
                  <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    {leads.unmatched.slice(0, 8).map((u, i) => (
                      <span key={i} className="font-mono">{[u.brand, u.model].filter(Boolean).join(" ") || "?"}</span>
                    ))}
                  </div>
                )}
              </div>
            ) : <p className="text-sm text-muted-foreground">—</p>}
          </Card>

          <Card title={t.policy}>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">duty Δ</span>
              <input type="number" value={duty} onChange={(e) => setDuty(Number(e.target.value) || 0)} className="w-20 border border-border bg-background px-2 py-1 text-sm font-mono" />
              <span className="text-xs text-muted-foreground">pp</span>
            </div>
            {sim ? (
              <div className="space-y-2 text-sm">
                <div className="font-mono text-foreground">
                  avg landed {sim.catalog.avgExtraLandedUsd >= 0 ? "+" : ""}{usd(sim.catalog.avgExtraLandedUsd)}
                  <span className="text-muted-foreground"> · margin {usd(sim.catalog.totalMarginImpactUsd)} · {sim.catalog.carsFlippedUnprofitable} flip</span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-mono text-muted-foreground">
                  {sim.perFuel.map((f) => (
                    <span key={f.fuel}>{f.fuel} {f.deltaUsd >= 0 ? "+" : ""}{usd(f.deltaUsd)}</span>
                  ))}
                </div>
              </div>
            ) : <p className="text-sm text-muted-foreground">—</p>}
          </Card>

          <Card title={t.indexing}>
            {search ? (
              <div className="space-y-2 text-sm">
                <div className="font-mono text-foreground">
                  Yandex:{" "}
                  {!search.yandex?.configured ? (
                    <span className="text-muted-foreground">not configured</span>
                  ) : !search.yandex.verified ? (
                    <span className="text-[var(--danger)]">not verified</span>
                  ) : search.yandex.loaded ? (
                    <span className="text-[var(--success)]">SQI {search.yandex.sqi ?? "—"} · {search.yandex.searchablePages ?? "—"} pages</span>
                  ) : (
                    <span className="text-[var(--warning)]">verified · indexing pending</span>
                  )}
                </div>
                <div className="font-mono text-foreground">
                  Bing:{" "}
                  {!search.bing?.configured ? (
                    <span className="text-muted-foreground">not configured</span>
                  ) : search.bing.verified ? (
                    <span className="text-[var(--success)]">
                      verified{(search.bing.impressions ?? 0) > 0 ? ` · ${search.bing.clicks} clicks · ${search.bing.impressions} impr` : ""}
                    </span>
                  ) : (
                    <span className="text-[var(--danger)]">not verified</span>
                  )}
                </div>
                <div className="font-mono text-foreground">
                  Google:{" "}
                  {!search.google?.configured ? (
                    <span className="text-muted-foreground">not configured</span>
                  ) : (search.google.impressions28d ?? 0) > 0 ? (
                    <span className="text-[var(--success)]">{search.google.clicks28d} clicks · {search.google.impressions28d} impr · pos {search.google.avgPosition ?? "—"} (28d)</span>
                  ) : (
                    <span className="text-[var(--warning)]">connected · no search data yet</span>
                  )}
                </div>
                {search.google?.topQueries && search.google.topQueries.length > 0 && (
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span className="uppercase tracking-wider">queries:</span>
                    {search.google.topQueries.map((q, i) => (
                      <span key={i} className="font-mono">{q.query} ({q.clicks})</span>
                    ))}
                  </div>
                )}
                {search.google?.topPages && search.google.topPages.length > 0 && (
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span className="uppercase tracking-wider">top pages:</span>
                    {search.google.topPages.map((p, i) => (
                      <span key={i} className="font-mono">{p.page} ({p.clicks}c/{p.ctr}%)</span>
                    ))}
                  </div>
                )}
                {search.google?.fixCtrPages && search.google.fixCtrPages.length > 0 && (
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-[var(--warning)]">
                    <span className="uppercase tracking-wider" title="High impressions, low CTR — improve the title/snippet">fix CTR:</span>
                    {search.google.fixCtrPages.map((p, i) => (
                      <span key={i} className="font-mono">{p.page} ({p.impressions} impr/{p.ctr}%)</span>
                    ))}
                  </div>
                )}
                {search.yandex?.topQueries && search.yandex.topQueries.length > 0 && (
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span className="uppercase tracking-wider">yandex queries:</span>
                    {search.yandex.topQueries.map((q, i) => (
                      <span key={i} className="font-mono">{q.query} ({q.clicks})</span>
                    ))}
                  </div>
                )}

                <div className="mt-1 border-t border-border pt-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={checkCoverage} disabled={covBusy} className="border border-primary px-2.5 py-1 text-xs text-primary hover:bg-primary/10 disabled:opacity-50">
                      {covBusy ? "checking…" : "Check Google index coverage"}
                    </button>
                    <button onClick={resubmitSitemap} disabled={resubBusy} className="border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/40 disabled:opacity-50">
                      {resubBusy ? "…" : "Re-submit sitemap (Google/Yandex)"}
                    </button>
                    {resubResult && <span className="font-mono text-[11px] text-muted-foreground">{resubResult}</span>}
                  </div>
                  {cov && (
                    <div className="mt-1.5 text-xs">
                      <span className={`font-mono ${cov.indexed === cov.checked ? "text-[var(--success)]" : "text-foreground"}`}>{cov.indexed}/{cov.checked} car pages indexed</span>
                      {cov.notIndexed.length > 0 && (
                        <div className="mt-1 space-y-0.5 text-[11px] text-[var(--warning)]">
                          {cov.notIndexed.slice(0, 12).map((n, i) => (
                            <div key={i} className="font-mono">{n.label} — {n.state}</div>
                          ))}
                          {cov.notIndexed.length > 12 && <div className="text-muted-foreground">+{cov.notIndexed.length - 12} more</div>}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground">IndexNow pushes new cars to Bing/Yandex automatically; Google indexes via the sitemap.</p>
              </div>
            ) : <p className="text-sm text-muted-foreground">—</p>}
          </Card>
        </div>
      )}
    </div>
  );
}
