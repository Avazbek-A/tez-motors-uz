"use client";

import { useEffect, useState } from "react";
import { BarChart3, PieChart, TrendingUp, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";

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
  reviews: { total: number };
  faqs: { total: number };
}

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  if (!stats) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const brandEntries = Object.entries(stats.cars.byBrand).sort((a, b) => b[1] - a[1]);
  const maxBrandCount = Math.max(...brandEntries.map(([, v]) => v));

  const bodyEntries = Object.entries(stats.cars.byBodyType).sort((a, b) => b[1] - a[1]);
  const maxBodyCount = Math.max(...bodyEntries.map(([, v]) => v));

  const fuelEntries = Object.entries(stats.cars.byFuelType).sort((a, b) => b[1] - a[1]);
  const fuelColors: Record<string, string> = {
    petrol: "bg-amber-500",
    electric: "bg-blue-500",
    phev: "bg-green-500",
    hybrid: "bg-teal-500",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">Inventory and pricing insights</p>
      </div>

      {/* Price stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-green-100 text-green-600 flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
              <span className="text-sm text-muted-foreground">Avg Price</span>
            </div>
            <p className="text-2xl font-bold">{formatPrice(stats.cars.avgPrice)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className="text-sm text-muted-foreground">Min Price</span>
            </div>
            <p className="text-2xl font-bold">{formatPrice(stats.cars.minPrice)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className="text-sm text-muted-foreground">Max Price</span>
            </div>
            <p className="text-2xl font-bold">{formatPrice(stats.cars.maxPrice)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Brand */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="w-5 h-5" />
              Cars by Brand
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {brandEntries.map(([brand, count]) => (
                <div key={brand} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-20 shrink-0">{brand}</span>
                  <div className="flex-1 h-8 bg-muted rounded-lg overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-lime-dark to-lime rounded-lg flex items-center justify-end px-2 transition-all duration-500"
                      style={{ width: `${(count / maxBrandCount) * 100}%` }}
                    >
                      <span className="text-xs font-bold text-navy">{count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* By Body Type */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="w-5 h-5" />
              Cars by Body Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {bodyEntries.map(([type, count]) => (
                <div key={type} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-24 shrink-0 capitalize">{type}</span>
                  <div className="flex-1 h-8 bg-muted rounded-lg overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-navy to-navy-light rounded-lg flex items-center justify-end px-2 transition-all duration-500"
                      style={{ width: `${(count / maxBodyCount) * 100}%` }}
                    >
                      <span className="text-xs font-bold text-white">{count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* By Fuel Type */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChart className="w-5 h-5" />
              Fuel Type Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              {/* Visual circle chart */}
              <div className="relative w-32 h-32 shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  {(() => {
                    const total = fuelEntries.reduce((s, [, v]) => s + v, 0);
                    let offset = 0;
                    const colors = ["#aae079", "#3b82f6", "#22c55e", "#14b8a6"];
                    return fuelEntries.map(([, count], i) => {
                      const pct = (count / total) * 100;
                      const dashArray = `${pct} ${100 - pct}`;
                      const el = (
                        <circle
                          key={i}
                          cx="18"
                          cy="18"
                          r="15.9155"
                          fill="none"
                          stroke={colors[i % colors.length]}
                          strokeWidth="3"
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

              {/* Legend */}
              <div className="space-y-2">
                {fuelEntries.map(([type, count]) => (
                  <div key={type} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${fuelColors[type] || "bg-gray-400"}`} />
                    <span className="text-sm capitalize">{type}</span>
                    <span className="text-sm font-bold text-muted-foreground">({count})</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inventory Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-muted/50 text-center">
                <p className="text-3xl font-bold text-navy">{stats.cars.total}</p>
                <p className="text-xs text-muted-foreground mt-1">Total Cars</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50 text-center">
                <p className="text-3xl font-bold text-green-600">{stats.cars.available}</p>
                <p className="text-xs text-muted-foreground mt-1">Available</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50 text-center">
                <p className="text-3xl font-bold text-lime-dark">{stats.cars.hotOffers}</p>
                <p className="text-xs text-muted-foreground mt-1">Hot Offers</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50 text-center">
                <p className="text-3xl font-bold text-purple-600">{stats.reviews.total}</p>
                <p className="text-xs text-muted-foreground mt-1">Reviews</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
