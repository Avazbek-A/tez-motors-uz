"use client";

import { useEffect, useState } from "react";
import { BarChart3, PieChart, TrendingUp, DollarSign, MessageSquare, Star, HelpCircle, RefreshCw, Loader2 } from "lucide-react";
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
  electric: "bg-blue-500",
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
  { key: "new", label: "New", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { key: "contacted", label: "Contacted", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  { key: "in_progress", label: "In Progress", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
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

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = () => {
    setLoading(true);
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((data) => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

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
        <StatCard icon={BarChart3} label="Total Cars" value={stats.cars.total} color="bg-blue-500/20 text-blue-400" />
        <StatCard icon={TrendingUp} label="Available" value={stats.cars.available} sub={`${Math.round((stats.cars.available / stats.cars.total) * 100)}%`} color="bg-green-500/20 text-green-400" />
        <StatCard icon={DollarSign} label="Hot Offers" value={stats.cars.hotOffers} color="bg-orange-500/20 text-orange-400" />
        <StatCard icon={MessageSquare} label="Inquiries" value={inquiryTotal} sub={`${stats.inquiries.new} new`} color="bg-purple-500/20 text-purple-400" />
        <StatCard icon={Star} label="Reviews" value={stats.reviews.total} sub={stats.reviews.pending > 0 ? `${stats.reviews.pending} pending` : undefined} color="bg-yellow-500/20 text-yellow-400" />
        <StatCard icon={HelpCircle} label="FAQs" value={stats.faqs.total} color="bg-teal-500/20 text-teal-400" />
      </div>

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
            <p className="text-xl font-bold text-purple-400">{formatPrice(stats.cars.maxPrice)}</p>
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
                      className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-lg flex items-center justify-end px-2 transition-all duration-700"
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
                      className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-lg flex items-center justify-end px-2 transition-all duration-700"
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
                  {(() => {
                    let offset = 0;
                    return fuelEntries.map(([type, count], i) => {
                      const pct = (count / fuelTotal) * 100;
                      const dashArray = `${pct} ${100 - pct}`;
                      const el = (
                        <circle
                          key={i}
                          cx="18"
                          cy="18"
                          r="15.9155"
                          fill="none"
                          stroke={fuelSvgColors[type] || "#6b7280"}
                          strokeWidth="3.5"
                          strokeDasharray={dashArray}
                          strokeDashoffset={`-${offset}`}
                        />
                      );
                      offset += pct;
                      return el;
                    });
                  })()}
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
                        className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full transition-all duration-700"
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
