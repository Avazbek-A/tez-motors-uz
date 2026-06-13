"use client";

import { useMemo, useState } from "react";
import type { SpecTrim } from "@/lib/autohome-spec";
import { formatPrice } from "@/lib/utils";

// AutoHome carries a "manufacturer guide price" param (厂商指导价 → "Рекомендованная
// цена (¥)") whose value is the Chinese ¥ price (e.g. "26.35万"). That must NOT reach
// clients — drop the whole row if the key looks price-ish OR any value shows ¥/￥/万.
function isPriceParam(name: string, values: string[]): boolean {
  if (/[¥￥]|万|指导价|厂商|(рекомендованн|официальн)\w*\s*цен|tavsiya\s*etilgan\s*narx|(recommended|suggested|guid\w*|retail|manufacturer'?s?)\s*price|msrp/i.test(name)) return true;
  return values.some((v) => /[¥￥]|\d\s*万/.test(String(v)));
}

export interface SpecComparisonLabels {
  param: string;
  differencesOnly: string;
  showAll: string;
  selectTrims: string;
  noDiff: string;
}

/**
 * Smart multi-trim comparison: pick which trims to compare, and by default see ONLY
 * the parameters that differ between them (toggle reveals the full spec). Differing
 * cells are highlighted. Column headers carry the per-trim price when a confident
 * Gonzo match exists (trimPrices, aligned to `trims`). For up-to-29-trim cars a flat
 * table is unreadable — this is the core fix.
 */
export function SpecComparison({
  groups,
  trims,
  trimPrices,
  labels,
}: {
  groups: string[];
  trims: SpecTrim[];
  trimPrices: (number | null)[];
  labels: SpecComparisonLabels;
}) {
  // Default: spread up to 4 trims across the price range (cheapest → priciest).
  const priceOrder = useMemo(() => {
    const num = (i: number) =>
      trimPrices[i] ?? (parseFloat(String(trims[i]?.price_raw || "").replace(/[^\d.]/g, "")) || 0);
    return [...trims.keys()].sort((a, b) => num(a) - num(b));
  }, [trims, trimPrices]);

  const defaultSel = useMemo(() => {
    if (trims.length <= 4) return [...trims.keys()];
    const picks = [0, 1 / 3, 2 / 3, 1].map((f) => priceOrder[Math.round(f * (priceOrder.length - 1))]);
    return Array.from(new Set(picks)).sort((a, b) => a - b);
  }, [trims, priceOrder]);

  const [selected, setSelected] = useState<number[]>(defaultSel);
  const [diffOnly, setDiffOnly] = useState(true);

  const sel = selected.length ? selected : defaultSel;
  const selTrims = sel.map((i) => trims[i]);

  function toggle(i: number) {
    setSelected((prev) => {
      const has = prev.includes(i);
      if (has && prev.length <= 1) return prev; // keep at least one
      return has ? prev.filter((x) => x !== i) : [...prev, i].sort((a, b) => a - b);
    });
  }

  const rowDiffers = (group: string, p: string) => {
    const vals = selTrims.map((tr) => tr.params[group]?.[p] ?? "");
    return new Set(vals).size > 1;
  };

  return (
    <div className="space-y-6">
      {/* Toolbar: trim selector + differences toggle */}
      <div className="rounded-xl border border-border bg-card/50 p-3" data-print-hide>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{labels.selectTrims}</span>
          <label className="inline-flex items-center gap-2 cursor-pointer select-none text-sm">
            <input
              type="checkbox"
              checked={diffOnly}
              onChange={(e) => setDiffOnly(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            <span className="text-foreground/90">{diffOnly ? labels.differencesOnly : labels.showAll}</span>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {trims.map((tr, i) => {
            const on = sel.includes(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggle(i)}
                title={tr.name}
                className={`max-w-[16rem] truncate rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors ${
                  on
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-foreground"
                    : "border-border bg-transparent text-muted-foreground hover:border-foreground/30"
                }`}
              >
                <span className="block truncate">{tr.name}</span>
                {trimPrices[i] ? (
                  <span className="block font-mono text-[11px] text-[var(--accent)]">{formatPrice(trimPrices[i]!)}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Per-group comparison tables */}
      {groups.map((group) => {
        const paramNames = Array.from(new Set(selTrims.flatMap((tr) => Object.keys(tr.params[group] || {}))))
          .filter((p) => !isPriceParam(p, selTrims.map((tr) => tr.params[group]?.[p] ?? "")));
        if (paramNames.length === 0) return null;
        const diffNames = paramNames.filter((p) => rowDiffers(group, p));
        // In differences mode, if a group has no differing rows, skip it entirely on screen.
        if (diffOnly && diffNames.length === 0) return null;
        return (
          <section key={group} className="spec-group">
            <h2 className="mb-2 text-lg font-semibold text-foreground">{group}</h2>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="spec-table w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-card">
                    <th className="w-1/3 px-3 py-2 text-left font-medium text-muted-foreground">{labels.param}</th>
                    {sel.map((i) => (
                      <th key={i} className="px-3 py-2 text-left align-top font-medium text-foreground">
                        <span className="block">{trims[i].name}</span>
                        {trimPrices[i] ? (
                          <span className="mt-0.5 block font-mono text-xs font-normal text-[var(--accent)]">
                            {formatPrice(trimPrices[i]!)}
                          </span>
                        ) : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paramNames.map((p, ri) => {
                    const differs = rowDiffers(group, p);
                    // Keep non-differing rows in the DOM (hidden on screen) so the print/PDF stays complete.
                    const hideOnScreen = diffOnly && !differs;
                    const first = selTrims[0]?.params[group]?.[p] ?? "";
                    return (
                      <tr
                        key={p}
                        className={`${hideOnScreen ? "hidden print:table-row" : "table-row"} ${ri % 2 ? "bg-card/40" : ""}`}
                      >
                        <td className="px-3 py-2 align-top text-muted-foreground">{p}</td>
                        {sel.map((i) => {
                          const v = trims[i].params[group]?.[p] || "—";
                          const cellDiffers = differs && v !== first;
                          return (
                            <td
                              key={i}
                              className={`px-3 py-2 align-top ${cellDiffers ? "font-medium text-[var(--accent)]" : "text-foreground"}`}
                            >
                              {v}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
