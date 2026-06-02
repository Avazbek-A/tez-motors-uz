"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Banknote, Loader2, ArrowRight } from "lucide-react";

interface MoneyData {
  ok: boolean;
  fx: { usd_uzs: number; cny_uzs: number; cny_usd: number; updated_at: string | null };
  inventory: {
    onLotCount: number;
    soldCount: number;
    atCostUsd: number;
    listValueUsd: number;
    potentialMarginUsd: number;
    realizedMarginUsd: number;
  };
  cash: { depositsCollectedUzs: number; depositsCollectedUsd: number };
  suppliers: {
    committedUsd: number;
    pipelineUsd: number;
    byStatus: Record<string, { count: number; valueUsd: number }>;
  };
  exposure: { usdAtRisk: number; uzsNow: number; uzsAtMinus5pct: number };
}

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const uzs = (n: number) => new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " so'm";

const PO_STATUS_ORDER = ["draft", "ordered", "in_production", "shipped", "arrived", "cancelled"];
const PO_TONE: Record<string, string> = {
  draft: "text-muted-foreground",
  ordered: "text-[var(--info)]",
  in_production: "text-[var(--warning)]",
  shipped: "text-primary",
  arrived: "text-[var(--success)]",
  cancelled: "text-[var(--danger)]",
};

export default function AdminMoneyPage() {
  const [data, setData] = useState<MoneyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats/money")
      .then((r) => r.json())
      .then((d) => setData(d && d.ok ? d : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <Banknote className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">Money cockpit</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Where your capital is right now — cash collected, committed to suppliers, sitting as stock, and
        your unrealized vs realized margin. Tracked cars + open purchase orders + deposits.
      </p>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">No financial data yet.</p>
      ) : (
        <div className="space-y-8">
          {/* Headline cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Deposits collected", value: uzs(data.cash.depositsCollectedUzs), sub: `≈ ${usd(data.cash.depositsCollectedUsd)}` },
              { label: "Committed to suppliers", value: usd(data.suppliers.committedUsd), sub: "open POs in transit" },
              { label: "Inventory at cost", value: usd(data.inventory.atCostUsd), sub: `${data.inventory.onLotCount} cars on lot` },
              { label: "Potential margin", value: usd(data.inventory.potentialMarginUsd), sub: "unrealized, on lot", accent: true },
              { label: "Realized margin", value: usd(data.inventory.realizedMarginUsd), sub: `${data.inventory.soldCount} sold`, accent: true },
              { label: "Inventory list value", value: usd(data.inventory.listValueUsd), sub: "at sticker price" },
              { label: "Supplier pipeline", value: usd(data.suppliers.pipelineUsd), sub: "draft POs, not committed" },
            ].map((c) => (
              <div key={c.label} className="bg-card border border-border p-4">
                <p className={`font-mono text-xl font-semibold ${c.accent ? "text-primary" : "text-foreground"}`}>{c.value}</p>
                <p className="text-xs text-foreground mt-1">{c.label}</p>
                {c.sub && <p className="text-[11px] text-muted-foreground">{c.sub}</p>}
              </div>
            ))}
          </div>

          {/* Supplier capital by PO status */}
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Supplier capital by purchase-order status</h2>
            <div className="bg-card border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium text-right">Orders</th>
                    <th className="px-4 py-2 font-medium text-right">Value (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {PO_STATUS_ORDER.filter((s) => data.suppliers.byStatus[s]).map((s) => (
                    <tr key={s} className="border-b border-border last:border-0">
                      <td className={`px-4 py-2.5 font-mono uppercase text-xs ${PO_TONE[s]}`}>{s.replace("_", " ")}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{data.suppliers.byStatus[s].count}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-foreground">{usd(data.suppliers.byStatus[s].valueUsd)}</td>
                    </tr>
                  ))}
                  {Object.keys(data.suppliers.byStatus).length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground text-sm">No purchase orders yet — <Link href="/admin/procurement" className="text-primary hover:underline">create one</Link>.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* FX + exposure */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="bg-card border border-border p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">Exchange rates (CBU)</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">USD → UZS</dt><dd className="font-mono text-foreground">{data.fx.usd_uzs.toLocaleString()}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">CNY → UZS</dt><dd className="font-mono text-foreground">{data.fx.cny_uzs.toLocaleString()}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">CNY → USD</dt><dd className="font-mono text-foreground">{data.fx.cny_usd.toFixed(4)}</dd></div>
              </dl>
              <p className="text-[11px] text-muted-foreground mt-3">
                {data.fx.updated_at ? `Updated ${data.fx.updated_at.slice(0, 10)}` : "Using fallback rates — the daily rates cron will refresh them."}
              </p>
            </div>

            <div className="bg-card border border-border p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">FX exposure</h2>
              <p className="text-sm text-muted-foreground mb-2">
                You buy in USD/CNY and sell in so&apos;m. Capital committed to suppliers that hasn&apos;t landed yet:
              </p>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">At risk</dt><dd className="font-mono text-foreground">{usd(data.exposure.usdAtRisk)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">= now</dt><dd className="font-mono text-foreground">{uzs(data.exposure.uzsNow)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">if so&apos;m −5%</dt><dd className="font-mono text-[var(--danger)]">{uzs(data.exposure.uzsAtMinus5pct)}</dd></div>
              </dl>
              <p className="text-[11px] text-muted-foreground mt-3">
                A 5% soum depreciation adds {uzs(data.exposure.uzsAtMinus5pct - data.exposure.uzsNow)} to what those imports cost you in local money.
              </p>
            </div>
          </div>

          <Link href="/admin/ledger" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
            Per-car profit ledger <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
