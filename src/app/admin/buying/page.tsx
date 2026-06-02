"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Target, Loader2, TrendingUp, Truck } from "lucide-react";

interface Rec {
  brand: string;
  model: string;
  fuel: string;
  demand: { inquiries: number; watches: number; favorites: number; savedSearches: number };
  demandScore: number;
  marketMedianUsd: number | null;
  marketSample: number;
  marketFreshnessDays: number | null;
  supplierCostUsd: number | null;
  landedCostUsd: number | null;
  marginUsd: number | null;
  marginPct: number | null;
  suggestedPriceUsd: number | null;
  opportunityScore: number;
  verdict: string;
  recommendedQty: number;
}

const usd = (n: number | null) => (n == null ? "—" : "$" + Math.round(n).toLocaleString("en-US"));

const VERDICT: Record<string, { label: string; tone: string }> = {
  strong_buy: { label: "Strong buy", tone: "text-[var(--success)] border-[var(--success)]" },
  buy: { label: "Buy", tone: "text-[var(--accent)] border-[var(--accent)]" },
  consider: { label: "Consider", tone: "text-[var(--warning)] border-[var(--warning)]" },
  skip: { label: "Skip", tone: "text-muted-foreground border-border" },
};

export default function AdminBuyingPage() {
  const [rows, setRows] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/buying")
      .then((r) => r.json())
      .then((d) => setRows(d?.ok ? d.recommendations || [] : []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-6xl">
      <div className="flex items-center gap-3 mb-1">
        <Target className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">Buying brain</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        What to import next — demand × market price × landed cost, ranked by opportunity. Each row fuses
        your inquiries/watches/searches, OLX/Telegram medians, and the customs landed-cost engine.
      </p>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No recommendations yet — add market data (<Link href="/admin/market" className="text-primary hover:underline">Market Intel</Link>),
          track supplier costs (<Link href="/admin/procurement" className="text-primary hover:underline">Procurement</Link>), and let demand accrue.
        </p>
      ) : (
        <div className="bg-card border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-3 py-2 font-medium">Model</th>
                <th className="px-3 py-2 font-medium">Verdict</th>
                <th className="px-3 py-2 font-medium text-right">Opp.</th>
                <th className="px-3 py-2 font-medium text-right">Demand</th>
                <th className="px-3 py-2 font-medium text-right">Market med.</th>
                <th className="px-3 py-2 font-medium text-right">Landed</th>
                <th className="px-3 py-2 font-medium text-right">Margin</th>
                <th className="px-3 py-2 font-medium text-right">Qty</th>
                <th className="px-3 py-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const v = VERDICT[r.verdict] || VERDICT.skip;
                return (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5">
                      <div className="text-foreground">{r.brand} {r.model}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        {r.fuel}{r.marketSample > 0 ? ` · n=${r.marketSample}${r.marketFreshnessDays != null ? ` · ${r.marketFreshnessDays}d` : ""}` : " · no market data"}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-block text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 border rounded-[2px] ${v.tone}`}>{v.label}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-foreground">{r.opportunityScore}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-muted-foreground" title={`${r.demand.inquiries} inq · ${r.demand.watches} watch · ${r.demand.favorites} fav · ${r.demand.savedSearches} search`}>
                      {r.demandScore}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-foreground">{usd(r.marketMedianUsd)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{usd(r.landedCostUsd)}</td>
                    <td className={`px-3 py-2.5 text-right font-mono ${r.marginPct == null ? "text-muted-foreground" : r.marginPct >= 10 ? "text-[var(--success)]" : r.marginPct < 5 ? "text-[var(--danger)]" : "text-foreground"}`}>
                      {r.marginUsd == null ? "—" : `${usd(r.marginUsd)}`}{r.marginPct != null ? <span className="text-[11px] opacity-70"> {r.marginPct > 0 ? "+" : ""}{r.marginPct}%</span> : null}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-foreground">{r.recommendedQty || ""}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {r.recommendedQty > 0 && (
                        <Link
                          href={`/admin/procurement?brand=${encodeURIComponent(r.brand)}&model=${encodeURIComponent(r.model)}${r.supplierCostUsd ? `&unit_cost_usd=${r.supplierCostUsd}` : ""}`}
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                          title="Create a purchase order"
                        >
                          <Truck className="w-3 h-3" /> order {r.recommendedQty}
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground mt-4">
        <TrendingUp className="w-3.5 h-3.5 mt-px shrink-0" />
        Opportunity blends demand (40%) and margin (60%), scaled by market-data confidence. Margin needs a
        tracked supplier cost (from a purchase order) and market listings; models missing either still show
        on demand alone. Suggested list price per model: see the import calculator.
      </p>
    </div>
  );
}
