"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { Wallet, Loader2, Check, Ship } from "lucide-react";

interface LedgerRow {
  car_id: string;
  brand: string;
  model: string;
  year: number | null;
  inventory_status: string;
  cost_usd: number | null;
  price_usd: number;
  margin_usd: number | null;
  margin_pct: number | null;
}

interface LedgerData {
  totals: {
    trackedCars: number;
    inventoryAtCostUsd: number;
    inventoryListUsd: number;
    potentialMarginUsd: number;
    soldCars: number;
    realizedMarginUsd: number;
    depositsCollectedUzs: number;
  };
  rows: LedgerRow[];
}

const usd = (n: number | null) => (n == null ? "—" : "$" + Math.round(n).toLocaleString("en-US"));
const uzs = (n: number) => new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " сум";

const STATUS_TONE: Record<string, string> = {
  available: "text-[var(--success)]",
  reserved: "text-[var(--warning)]",
  sold: "text-muted-foreground",
};

export default function AdminLedgerPage() {
  const [data, setData] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/stats/ledger")
      .then((r) => r.json())
      .then((d) => setData(d && d.ok ? d : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveCost = async (carId: string, raw: string) => {
    const trimmed = raw.trim();
    const cost_usd = trimmed === "" ? null : Number(trimmed);
    if (cost_usd != null && (!Number.isFinite(cost_usd) || cost_usd < 0)) return;
    setSavingId(carId);
    try {
      const res = await fetch(`/api/admin/cars/${carId}/cost`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cost_usd }),
      });
      if (res.ok) {
        setSavedId(carId);
        setTimeout(() => setSavedId((s) => (s === carId ? null : s)), 1500);
        load();
      }
    } finally {
      setSavingId(null);
    }
  };

  const t = data?.totals;

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <Wallet className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">Profit ledger</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Enter each car&apos;s purchase cost to see gross margin and your inventory economics.
        Costs are internal — stored separately and never shown to customers.
      </p>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">No ledger data.</p>
      ) : (
        <>
          {/* Totals */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
            {[
              { label: "Tracked cars", value: String(t!.trackedCars) },
              { label: "Inventory at cost", value: usd(t!.inventoryAtCostUsd) },
              { label: "Inventory list value", value: usd(t!.inventoryListUsd) },
              { label: "Potential margin (on lot)", value: usd(t!.potentialMarginUsd), accent: true },
              { label: "Realized margin (sold)", value: usd(t!.realizedMarginUsd), accent: true },
              { label: "Deposits collected", value: uzs(t!.depositsCollectedUzs) },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-border p-4">
                <p className={`font-mono text-2xl font-semibold ${s.accent ? "text-primary" : "text-foreground"}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Per-car table */}
          <div className="bg-card border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="px-4 py-2 font-medium">Car</th>
                  <th className="px-4 py-2 font-medium text-right">List price</th>
                  <th className="px-4 py-2 font-medium text-right">Cost (USD)</th>
                  <th className="px-4 py-2 font-medium text-right">Margin</th>
                  <th className="px-4 py-2 font-medium text-right">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.car_id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">
                      <span className="text-foreground">{r.brand} {r.model}</span>
                      {r.year ? <span className="text-muted-foreground"> {r.year}</span> : null}
                      <span className={`ml-2 text-xs font-mono uppercase ${STATUS_TONE[r.inventory_status] || "text-muted-foreground"}`}>
                        {r.inventory_status}
                      </span>
                      <Link
                        href={`/admin/import-calculator?car_id=${r.car_id}&car_label=${encodeURIComponent(`${r.brand} ${r.model}`)}`}
                        className="ml-2 inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-primary align-middle"
                        title="Compute landed cost in the import calculator"
                      >
                        <Ship className="w-3 h-3" /> calc
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-foreground">{usd(r.price_usd)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="inline-flex items-center gap-1.5 justify-end">
                        <input
                          type="number"
                          defaultValue={r.cost_usd ?? ""}
                          placeholder="—"
                          onBlur={(e) => {
                            const v = e.target.value;
                            if (v !== String(r.cost_usd ?? "")) saveCost(r.car_id, v);
                          }}
                          className="w-24 bg-[var(--bg-3)] border border-border rounded-[2px] px-2 py-1 text-right font-mono text-foreground focus:outline-none focus:border-[var(--accent)]"
                        />
                        {savingId === r.car_id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                        ) : savedId === r.car_id ? (
                          <Check className="w-3.5 h-3.5 text-[var(--success)]" />
                        ) : (
                          <span className="w-3.5" />
                        )}
                      </span>
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono ${r.margin_usd != null && r.margin_usd < 0 ? "text-[var(--danger)]" : "text-foreground"}`}>
                      {usd(r.margin_usd)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">
                      {r.margin_pct == null ? "—" : `${r.margin_pct}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
