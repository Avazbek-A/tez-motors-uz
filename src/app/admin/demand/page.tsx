"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrendingUp, Heart, Bell, MessageSquare, Loader2, Flame, PackagePlus } from "lucide-react";

interface HotCar {
  car_id: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  price_usd: number | null;
  inventory_status: string | null;
  slug: string | null;
  favorites: number;
  watches: number;
  inquiries: number;
  minTarget: number | null;
  score: number;
}

interface DemandData {
  totals: { favorites: number; watches: number; inquiries: number; savedSearches: number };
  hotCars: HotCar[];
  byBrand: { brand: string; score: number; cars: number }[];
  wantedBrands: { brand: string; count: number }[];
}

const usd = (n: number | null) => (n == null ? "—" : "$" + Math.round(n).toLocaleString("en-US"));

const STATUS_TONE: Record<string, string> = {
  available: "text-[var(--success)]",
  reserved: "text-[var(--warning)]",
  sold: "text-muted-foreground",
};

export default function AdminDemandPage() {
  const [data, setData] = useState<DemandData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats/demand")
      .then((r) => r.json())
      .then((d) => setData(d && d.ok ? d : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <TrendingUp className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">Demand intelligence</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        What buyers want, ranked from real signals — favorites, price-watches and inquiries.
        Use it to decide which cars to source more of. Score weights intent:
        inquiry ×5 &gt; watch ×3 &gt; favorite ×1.
      </p>

      {loading ? (
        <div className="py-16 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
        </div>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">No demand data yet.</p>
      ) : (
        <div className="space-y-8">
          {/* Totals */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Heart, label: "Favorites", value: data.totals.favorites },
              { icon: Bell, label: "Active watches", value: data.totals.watches },
              { icon: MessageSquare, label: "Car inquiries", value: data.totals.inquiries },
              { icon: TrendingUp, label: "Saved searches", value: data.totals.savedSearches },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-border p-4">
                <s.icon className="w-4 h-4 text-primary mb-2" />
                <p className="font-mono text-2xl font-semibold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Hot cars */}
          <div className="bg-card border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Flame className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-foreground">Hottest inventory</h2>
            </div>
            {data.hotCars.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No signals yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="px-4 py-2 font-medium">Car</th>
                    <th className="px-4 py-2 font-medium text-right">Price</th>
                    <th className="px-4 py-2 font-medium text-right">★ Fav</th>
                    <th className="px-4 py-2 font-medium text-right">Watch</th>
                    <th className="px-4 py-2 font-medium text-right">Inq</th>
                    <th className="px-4 py-2 font-medium text-right">Min target</th>
                    <th className="px-4 py-2 font-medium text-right">Score</th>
                    <th className="px-4 py-2 font-medium text-right">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {data.hotCars.map((c) => (
                    <tr key={c.car_id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5">
                        <span className="text-foreground">{c.brand} {c.model}</span>
                        {c.year ? <span className="text-muted-foreground"> {c.year}</span> : null}
                        {c.inventory_status && (
                          <span className={`ml-2 text-xs font-mono uppercase ${STATUS_TONE[c.inventory_status] || "text-muted-foreground"}`}>
                            {c.inventory_status}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-foreground">{usd(c.price_usd)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{c.favorites}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{c.watches}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{c.inquiries}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{usd(c.minTarget)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-primary">{c.score}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Link
                          href={`/admin/models?brand=${encodeURIComponent(c.brand || "")}&model=${encodeURIComponent(c.model || "")}${c.year ? `&year=${c.year}` : ""}${c.price_usd ? `&base_price_usd=${c.price_usd}` : ""}`}
                          title="Create an orderable pre-order model from this car"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <PackagePlus className="w-3.5 h-3.5" /> Pre-order
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Brand-level + wanted */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-card border border-border p-4">
              <h2 className="font-semibold text-foreground mb-3">Demand by brand (in stock)</h2>
              {data.byBrand.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data.</p>
              ) : (
                <div className="space-y-2">
                  {data.byBrand.map((b) => (
                    <div key={b.brand} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{b.brand} <span className="text-muted-foreground text-xs">({b.cars})</span></span>
                      <span className="font-mono text-primary">{b.score}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-card border border-border p-4">
              <h2 className="font-semibold text-foreground mb-3">Wanted brands (saved searches)</h2>
              {data.wantedBrands.length === 0 ? (
                <p className="text-sm text-muted-foreground">No saved-search brand filters yet.</p>
              ) : (
                <div className="space-y-2">
                  {data.wantedBrands.map((b) => (
                    <div key={b.brand} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{b.brand}</span>
                      <span className="font-mono text-muted-foreground">{b.count}×</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
