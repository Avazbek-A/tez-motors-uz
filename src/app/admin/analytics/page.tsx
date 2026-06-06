"use client";

import { useEffect, useState } from "react";
import { BarChart3, PieChart, TrendingUp, DollarSign, MessageSquare, Star, HelpCircle, RefreshCw, Loader2, Filter, Users, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface StatsData {
  cars: {
    total: number;
    available: number;
    hotOffers: number;
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    byBrand: Record<string, number>;
    byBodyType: Record<string, number>;
    byFuelType: Record<string, number>;
  };
  reviews: { total: number; pending: number };
  faqs: { total: number };
  inquiries: {
    total: number;
    new: number;
    contacted: number;
    in_progress: number;
    closed: number;
  };
  generatedAt?: string;
}

const fuelColors: Record<string, string> = {
  petrol: "bg-amber-500",
  electric: "bg-neon-blue",
  phev: "bg-green-500",
  hybrid: "bg-teal-500",
  diesel: "bg-orange-500",
};

const fuelSvgColors: Record<string, string> = {
  petrol: "#f59e0b",
  electric: "#3b82f6",
  phev: "#22c55e",
  hybrid: "#14b8a6",
  diesel: "#f97316",
};

const inquiryStatusConfig = [
  { key: "new", label: "New", color: "bg-neon-blue/20 text-neon-blue border-neon-blue/30" },
  { key: "contacted", label: "Contacted", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  { key: "in_progress", label: "In Progress", color: "bg-neon-purple/20 text-neon-purple border-neon-purple/30" },
  { key: "closed", label: "Closed", color: "bg-green-500/20 text-green-400 border-green-500/30" },
];

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", color)}>
            <Icon className="w-4 h-4" />
          </div>
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

interface TimeseriesPoint { date: string; total: number; closed: number; }

interface FunnelData {
  days: number;
  funnel: { inquiries: number; reservations: number; depositsPaid: number; delivered: number };
  bySource: Array<{ source: string; count: number }>;
  deposits: Array<{ date: string; count: number; uzs: number }>;
  depositsTotalUzs: number;
  bySalesperson: Array<{ id: string; label: string; total: number; closed: number; closeRate: number }>;
}

function formatUzs(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " сум";
}

/** Revenue + conversion funnel: inquiries → reservations → deposits → delivered. */
function FunnelBars({ funnel }: { funnel: FunnelData["funnel"] }) {
  const stages = [
    { key: "inquiries", label: "Inquiries", value: funnel.inquiries, color: "from-neon-blue to-neon-blue" },
    { key: "reservations", label: "Reservations", value: funnel.reservations, color: "from-neon-blue to-neon-blue" },
    { key: "depositsPaid", label: "Deposits Paid", value: funnel.depositsPaid, color: "from-neon-purple to-neon-purple" },
    { key: "delivered", label: "Delivered", value: funnel.delivered, color: "from-green-600 to-green-400" },
  ];
  const top = Math.max(1, funnel.inquiries);
  return (
    <div className="space-y-3">
      {stages.map((s, i) => {
        const pctOfTop = Math.round((s.value / top) * 100);
        const prev = i > 0 ? stages[i - 1].value : s.value;
        const stepPct = prev > 0 ? Math.round((s.value / prev) * 100) : 0;
        return (
          <div key={s.key}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium">{s.label}</span>
              <span className="font-bold">
                {s.value}
                {i > 0 && <span className="text-muted-foreground font-normal text-xs ml-2">{stepPct}% of prev</span>}
              </span>
            </div>
            <div className="h-3 bg-white/[0.04] rounded-full overflow-hidden">
              <div
                className={cn("h-full bg-gradient-to-r rounded-full transition-all duration-700", s.color)}
                style={{ width: `${Math.max(pctOfTop, s.value > 0 ? 4 : 0)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Daily deposit volume (UZS) over the window — simple bar chart. */
function DepositsChart({ points }: { points: FunnelData["deposits"] }) {
  if (points.length === 0) return null;
  const maxUzs = Math.max(1, ...points.map((p) => p.uzs));
  return (
    <div>
      <div className="flex items-end gap-0.5 h-32">
        {points.map((p) => (
          <div key={p.date} className="flex-1 flex flex-col justify-end group relative" title={`${p.date}: ${formatUzs(p.uzs)} (${p.count})`}>
            <div
              className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t transition-all"
              style={{ height: `${(p.uzs / maxUzs) * 100}%`, minHeight: p.uzs > 0 ? "2px" : "0" }}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
        <span>{points[0]?.date.slice(5)}</span>
        <span>{points[points.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}

function InquiriesTimeseriesChart({ points }: { points: TimeseriesPoint[] }) {
  if (points.length === 0) return null;
  const width = 640;
  const height = 180;
  const padding = { top: 10, right: 12, bottom: 22, left: 28 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const maxY = Math.max(1, ...points.map((p) => p.total));
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;
  const scaleY = (v: number) => padding.top + innerH - (v / maxY) * innerH;
  const buildPath = (key: "total" | "closed") =>
    points
      .map((p, i) => {
        const x = padding.left + i * stepX;
        const y = scaleY(p[key]);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  const firstLabel = points[0]?.date.slice(5);
  const lastLabel = points[points.length - 1]?.date.slice(5);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      preserveAspectRatio="none"
      role="img"
      aria-label="Daily inquiries"
    >
      {/* gridlines */}
      {[0, 0.5, 1].map((t) => (
        <line
          key={t}
          x1={padding.left}
          x2={width - padding.right}
          y1={padding.top + innerH * t}
          y2={padding.top + innerH * t}
          stroke="currentColor"
          strokeOpacity="0.08"
          strokeWidth="1"
        />
      ))}
      {/* y labels */}
      <text x={8} y={padding.top + 4} fontSize="10" fill="currentColor" fillOpacity="0.5">{maxY}</text>
      <text x={8} y={padding.top + innerH + 4} fontSize="10" fill="currentColor" fillOpacity="0.5">0</text>
      {/* x labels */}
      <text x={padding.left} y={height - 6} fontSize="10" fill="currentColor" fillOpacity="0.5">{firstLabel}</text>
      <text x={width - padding.right} y={height - 6} fontSize="10" fill="currentColor" fillOpacity="0.5" textAnchor="end">{lastLabel}</text>
      {/* total line */}
      <path d={buildPath("total")} fill="none" stroke="#22d3ee" strokeWidth="2" />
      {/* closed line */}
      <path d={buildPath("closed")} fill="none" stroke="#22c55e" strokeWidth="2" strokeDasharray="3 3" />
    </svg>
  );
}

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeseries, setTimeseries] = useState<TimeseriesPoint[]>([]);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);

  const fetchStats = () => {
    setLoading(true);
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((data) => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
    fetch("/api/admin/stats/timeseries?days=30")
      .then((r) => r.json())
      .then((data) => setTimeseries(data.points || []))
      .catch(() => {});
    fetch("/api/admin/stats/funnel?days=30")
      .then((r) => r.json())
      .then((data) => setFunnel(data && !data.error ? data : null))
      .catch(() => {});
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional on-mount sync (kick off a data load / read a browser-only value)
  useEffect(() => { fetchStats(); }, []);

  if (loading && !stats) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading stats...
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const brandEntries = Object.entries(stats.cars.byBrand).sort((a, b) => b[1] - a[1]);
  const maxBrandCount = Math.max(...brandEntries.map(([, v]) => v), 1);

  const bodyEntries = Object.entries(stats.cars.byBodyType).sort((a, b) => b[1] - a[1]);
  const maxBodyCount = Math.max(...bodyEntries.map(([, v]) => v), 1);

  const fuelEntries = Object.entries(stats.cars.byFuelType).sort((a, b) => b[1] - a[1]);
  const fuelTotal = fuelEntries.reduce((s, [, v]) => s + v, 0);

  const inquiryTotal = stats.inquiries?.total || 0;
  const conversionRate = inquiryTotal > 0
    ? Math.round((stats.inquiries.closed / inquiryTotal) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground text-sm">
            {stats.generatedAt
              ? `Last updated: ${new Date(stats.generatedAt).toLocaleString()}`
              : "Inventory and inquiry insights"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard icon={BarChart3} label="Total Cars" value={stats.cars.total} color="bg-neon-blue/20 text-neon-blue" />
        <StatCard icon={TrendingUp} label="Available" value={stats.cars.available} sub={`${Math.round((stats.cars.available / stats.cars.total) * 100)}%`} color="bg-green-500/20 text-green-400" />
        <StatCard icon={DollarSign} label="Hot Offers" value={stats.cars.hotOffers} color="bg-orange-500/20 text-orange-400" />
        <StatCard icon={MessageSquare} label="Inquiries" value={inquiryTotal} sub={`${stats.inquiries.new} new`} color="bg-neon-purple/20 text-neon-purple" />
        <StatCard icon={Star} label="Reviews" value={stats.reviews.total} sub={stats.reviews.pending > 0 ? `${stats.reviews.pending} pending` : undefined} color="bg-yellow-500/20 text-yellow-400" />
        <StatCard icon={HelpCircle} label="FAQs" value={stats.faqs.total} color="bg-teal-500/20 text-teal-400" />
      </div>

      {/* 30-day inquiry timeseries */}
      {timeseries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="w-4 h-4" />
              Inquiries — last 30 days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <InquiriesTimeseriesChart points={timeseries} />
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-neon-blue inline-block" /> Total</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Closed (converted)</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Revenue + conversion intelligence */}
      {funnel && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue funnel */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="w-4 h-4" />
                  Revenue Funnel — last {funnel.days} days
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FunnelBars funnel={funnel.funnel} />
              </CardContent>
            </Card>

            {/* Deposits over time */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wallet className="w-4 h-4" />
                  Deposits Collected
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DepositsChart points={funnel.deposits} />
                <div className="pt-3 mt-2 border-t border-white/10 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total ({funnel.days}d)</span>
                  <span className="font-bold text-emerald-400">{formatUzs(funnel.depositsTotalUzs)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Leads by source */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Filter className="w-4 h-4" />
                  Leads by Source
                </CardTitle>
              </CardHeader>
              <CardContent>
                {funnel.bySource.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No lead data yet.</p>
                ) : (
                  <div className="space-y-2.5">
                    {(() => {
                      const max = Math.max(...funnel.bySource.map((s) => s.count), 1);
                      return funnel.bySource.map((s) => (
                        <div key={s.source} className="flex items-center gap-3">
                          <span className="text-xs font-medium w-28 shrink-0 truncate" title={s.source}>{s.source}</span>
                          <div className="flex-1 h-6 bg-white/[0.04] rounded-lg overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-lg flex items-center justify-end px-2 transition-all duration-700"
                              style={{ width: `${(s.count / max) * 100}%`, minWidth: "1.75rem" }}
                            >
                              <span className="text-xs font-bold text-white">{s.count}</span>
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Per-salesperson close rate */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="w-4 h-4" />
                  Salesperson Close Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                {funnel.bySalesperson.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No assigned inquiries yet.</p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center text-xs text-muted-foreground px-1">
                      <span className="flex-1">Rep</span>
                      <span className="w-16 text-right">Total</span>
                      <span className="w-16 text-right">Closed</span>
                      <span className="w-16 text-right">Rate</span>
                    </div>
                    {funnel.bySalesperson.map((rep) => (
                      <div key={rep.id} className="flex items-center text-sm py-1.5 border-t border-white/5">
                        <span className="flex-1 truncate" title={rep.label}>{rep.label}</span>
                        <span className="w-16 text-right font-medium">{rep.total}</span>
                        <span className="w-16 text-right font-medium">{rep.closed}</span>
                        <span className={cn(
                          "w-16 text-right font-bold",
                          rep.closeRate >= 50 ? "text-green-400" : rep.closeRate >= 20 ? "text-yellow-400" : "text-muted-foreground",
                        )}>{rep.closeRate}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Price range */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground mb-1">Average Price</p>
            <p className="text-xl font-bold">{formatPrice(stats.cars.avgPrice)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground mb-1">Lowest Price</p>
            <p className="text-xl font-bold text-green-400">{formatPrice(stats.cars.minPrice)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground mb-1">Highest Price</p>
            <p className="text-xl font-bold text-neon-purple">{formatPrice(stats.cars.maxPrice)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Brand */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="w-4 h-4" />
              Cars by Brand
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {brandEntries.map(([brand, count]) => (
                <div key={brand} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-20 shrink-0 truncate">{brand}</span>
                  <div className="flex-1 h-7 bg-white/[0.04] rounded-lg overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-neon-blue to-neon-blue rounded-lg flex items-center justify-end px-2 transition-all duration-700"
                      style={{ width: `${(count / maxBrandCount) * 100}%`, minWidth: "2rem" }}
                    >
                      <span className="text-xs font-bold text-white">{count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* By Body Type */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="w-4 h-4" />
              Cars by Body Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {bodyEntries.map(([type, count]) => (
                <div key={type} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-24 shrink-0 capitalize">{type}</span>
                  <div className="flex-1 h-7 bg-white/[0.04] rounded-lg overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-neon-purple to-neon-purple rounded-lg flex items-center justify-end px-2 transition-all duration-700"
                      style={{ width: `${(count / maxBodyCount) * 100}%`, minWidth: "2rem" }}
                    >
                      <span className="text-xs font-bold text-white">{count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Fuel Type pie */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChart className="w-4 h-4" />
              Fuel Type Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-8">
              <div className="relative w-28 h-28 shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  {fuelEntries.map(([type, count], i) => {
                    const pct = (count / fuelTotal) * 100;
                    // Cumulative offset = sum of all prior segments' percentages,
                    // computed immutably (no reassignment during render).
                    const offset = fuelEntries
                      .slice(0, i)
                      .reduce((sum, [, c]) => sum + (c / fuelTotal) * 100, 0);
                    return (
                      <circle
                        key={i}
                        cx="18"
                        cy="18"
                        r="15.9155"
                        fill="none"
                        stroke={fuelSvgColors[type] || "#6b7280"}
                        strokeWidth="3.5"
                        strokeDasharray={`${pct} ${100 - pct}`}
                        strokeDashoffset={`-${offset}`}
                      />
                    );
                  })}
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold">{stats.cars.total}</span>
                </div>
              </div>
              <div className="space-y-2">
                {fuelEntries.map(([type, count]) => (
                  <div key={type} className="flex items-center gap-2">
                    <div className={cn("w-2.5 h-2.5 rounded-full", fuelColors[type] || "bg-gray-400")} />
                    <span className="text-sm capitalize">{type}</span>
                    <span className="text-sm font-bold text-muted-foreground ml-auto pl-4">
                      {count} ({Math.round((count / fuelTotal) * 100)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inquiry funnel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="w-4 h-4" />
              Inquiry Funnel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {inquiryStatusConfig.map(({ key, label, color }) => {
                const count = stats.inquiries[key as keyof typeof stats.inquiries] as number || 0;
                const pct = inquiryTotal > 0 ? Math.round((count / inquiryTotal) * 100) : 0;
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", color)}>{label}</span>
                      <span className="font-bold">{count} <span className="text-muted-foreground font-normal text-xs">({pct}%)</span></span>
                    </div>
                    <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-neon-blue to-neon-blue rounded-full transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Conversion Rate</span>
                <span className="font-bold text-green-400">{conversionRate}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
