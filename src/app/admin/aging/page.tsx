"use client";

import { useCallback, useEffect, useState } from "react";
import { Hourglass, Loader2, TrendingDown, TrendingUp, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Row {
  car_id: string; name: string; price_usd: number; daysOnLot: number; demandScore: number;
  markdownPct: number; suggestedPriceUsd: number; increasePct: number; increasePriceUsd: number;
}

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

export default function AdminAgingPage() {
  const [markdowns, setMarkdowns] = useState<Row[]>([]);
  const [increases, setIncreases] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/stats/aging").then((r) => r.json()).then((d) => {
      if (d?.ok) { setMarkdowns(d.markdowns || []); setIncreases(d.increases || []); }
    }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const createPromo = async (r: Row) => {
    setBusy(r.car_id); setNote(null);
    try {
      const res = await fetch("/api/admin/promotions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_id: r.car_id, fixed_price_usd: r.suggestedPriceUsd, label: `Markdown ${r.markdownPct}% — aged ${r.daysOnLot}d` }),
      });
      const d = await res.json();
      setNote(res.ok ? `Promo created for ${r.name} → ${usd(r.suggestedPriceUsd)} (applies on next cron run).` : d.error || "Could not create promo.");
    } finally { setBusy(null); }
  };

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <Hourglass className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">Aged stock & repricing</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Capital sitting on the lot. Old + cold cars get a suggested markdown (one-click → promotion);
        fresh + in-demand cars could take a price increase. Suggestions only — you decide.
      </p>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
      ) : (
        <div className="space-y-8">
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5"><TrendingDown className="w-4 h-4 text-[var(--danger)]" /> Consider a markdown</h2>
            {markdowns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No aged + cold cars — nice.</p>
            ) : (
              <div className="bg-card border border-border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="px-4 py-2 font-medium">Car</th><th className="px-4 py-2 font-medium text-right">Days</th>
                    <th className="px-4 py-2 font-medium text-right">Demand</th><th className="px-4 py-2 font-medium text-right">Price</th>
                    <th className="px-4 py-2 font-medium text-right">Suggested</th><th className="px-4 py-2 text-right"></th>
                  </tr></thead>
                  <tbody>
                    {markdowns.map((r) => (
                      <tr key={r.car_id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5 text-foreground">{r.name}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-[var(--warning)]">{r.daysOnLot}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{r.demandScore}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-muted-foreground line-through">{usd(r.price_usd)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-foreground">{usd(r.suggestedPriceUsd)} <span className="text-[var(--danger)] text-xs">-{r.markdownPct}%</span></td>
                        <td className="px-4 py-2.5 text-right">
                          <Button size="sm" variant="outline" onClick={() => createPromo(r)} disabled={busy === r.car_id}>
                            {busy === r.car_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Tag className="w-3.5 h-3.5" /> Promo</>}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {increases.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-[var(--success)]" /> Could raise the price</h2>
              <div className="bg-card border border-border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="px-4 py-2 font-medium">Car</th><th className="px-4 py-2 font-medium text-right">Days</th>
                    <th className="px-4 py-2 font-medium text-right">Demand</th><th className="px-4 py-2 font-medium text-right">Price</th>
                    <th className="px-4 py-2 font-medium text-right">Suggested</th>
                  </tr></thead>
                  <tbody>
                    {increases.map((r) => (
                      <tr key={r.car_id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5 text-foreground">{r.name}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{r.daysOnLot}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-[var(--success)]">{r.demandScore}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{usd(r.price_usd)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-foreground">{usd(r.increasePriceUsd)} <span className="text-[var(--success)] text-xs">+{r.increasePct}%</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {note && <p className="text-xs text-primary">{note}</p>}
        </div>
      )}
    </div>
  );
}
