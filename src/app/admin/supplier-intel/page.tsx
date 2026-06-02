"use client";

import { useEffect, useState } from "react";
import { LineChart, Loader2, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

interface ModelRow {
  brand: string;
  model: string;
  orders: number;
  minCost: number;
  avgCost: number;
  maxCost: number;
  latestCost: number;
  trendPct: number;
  rising: boolean;
}
interface SupplierRow {
  supplier: string;
  orders: number;
  models: number;
  avgCost: number;
}
interface Data {
  byModel: ModelRow[];
  bySupplier: SupplierRow[];
  alerts: ModelRow[];
  totalOrders: number;
}

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

export default function AdminSupplierIntelPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats/supplier-intel")
      .then((r) => r.json())
      .then((d) => setData(d && d.ok ? d : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <LineChart className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">Supplier intelligence</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Cost trends from your purchase orders — spot rising prices and your cheapest sources.
        Builds as you log more procurement.
      </p>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">No supplier data.</p>
      ) : data.totalOrders === 0 ? (
        <p className="text-sm text-muted-foreground">No purchase orders with a unit cost yet — add some in Procurement.</p>
      ) : (
        <div className="space-y-8">
          {/* Rising-cost alerts */}
          {data.alerts.length > 0 && (
            <div className="bg-[rgba(192,106,92,0.10)] border border-[var(--danger)] p-4">
              <p className="text-sm font-medium text-[var(--danger)] flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4" /> Costs rising
              </p>
              <ul className="space-y-1 text-sm text-foreground">
                {data.alerts.map((m) => (
                  <li key={`${m.brand}-${m.model}`} className="font-mono">
                    {m.brand} {m.model}: latest {usd(m.latestCost)} vs avg {usd(m.avgCost)} (+{m.trendPct}%)
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Per-model cost history */}
          <div className="bg-card border border-border overflow-x-auto">
            <div className="px-4 py-3 border-b border-border"><h2 className="font-semibold text-foreground">Cost history by model</h2></div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="px-4 py-2 font-medium">Model</th>
                  <th className="px-4 py-2 font-medium text-right">POs</th>
                  <th className="px-4 py-2 font-medium text-right">Min</th>
                  <th className="px-4 py-2 font-medium text-right">Avg</th>
                  <th className="px-4 py-2 font-medium text-right">Max</th>
                  <th className="px-4 py-2 font-medium text-right">Latest</th>
                  <th className="px-4 py-2 font-medium text-right">Trend</th>
                </tr>
              </thead>
              <tbody>
                {data.byModel.map((m) => (
                  <tr key={`${m.brand}-${m.model}`} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-foreground">{m.brand} {m.model}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{m.orders}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{usd(m.minCost)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-foreground">{usd(m.avgCost)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{usd(m.maxCost)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-foreground">{usd(m.latestCost)}</td>
                    <td className={`px-4 py-2.5 text-right font-mono ${m.trendPct > 0 ? "text-[var(--danger)]" : m.trendPct < 0 ? "text-[var(--success)]" : "text-muted-foreground"}`}>
                      <span className="inline-flex items-center gap-1 justify-end">
                        {m.trendPct > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : m.trendPct < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : null}
                        {m.trendPct > 0 ? "+" : ""}{m.trendPct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Per-supplier */}
          <div className="bg-card border border-border overflow-x-auto">
            <div className="px-4 py-3 border-b border-border"><h2 className="font-semibold text-foreground">By supplier</h2></div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="px-4 py-2 font-medium">Supplier</th>
                  <th className="px-4 py-2 font-medium text-right">POs</th>
                  <th className="px-4 py-2 font-medium text-right">Models</th>
                  <th className="px-4 py-2 font-medium text-right">Avg unit cost</th>
                </tr>
              </thead>
              <tbody>
                {data.bySupplier.map((s) => (
                  <tr key={s.supplier} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-foreground">{s.supplier}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{s.orders}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{s.models}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-foreground">{usd(s.avgCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
