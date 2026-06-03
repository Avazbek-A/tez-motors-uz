"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LineChart, Loader2, Sparkles, Save, Plus, Ship } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ParsedListing {
  brand: string;
  model: string;
  year?: number | null;
  price_raw?: number | null;
  currency?: string | null;
  city?: string | null;
  condition?: string | null;
}

interface StatRow {
  brand: string;
  model: string;
  year: number | null;
  medianUsd: number | null;
  minUsd: number | null;
  maxUsd: number | null;
  count: number;
  latestObservedAt: string | null;
  ourPriceUsd: number | null;
  weSell: boolean;
  vsMarketPct: number | null;
}

const usd = (n: number | null) => (n == null ? "—" : "$" + Math.round(n).toLocaleString("en-US"));
const ago = (s: string | null) => {
  if (!s) return "—";
  const d = Math.floor((Date.now() - new Date(s).getTime()) / 86_400_000);
  return d <= 0 ? "today" : `${d}d ago`;
};

export default function AdminMarketPage() {
  const [rows, setRows] = useState<StatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<{ totalListings: number; windowDays: number; sources?: Record<string, { count: number; latest: string | null }> }>({ totalListings: 0, windowDays: 90 });

  const [source, setSource] = useState<"olx" | "telegram" | "manual" | "other">("olx");
  const [rawText, setRawText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedListing[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // manual single add
  const [m, setM] = useState({ brand: "", model: "", year: "", price: "", currency: "USD" });

  const loadStats = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/market/stats")
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) {
          setRows(d.rows || []);
          setMeta({ totalListings: d.totalListings || 0, windowDays: d.windowDays || 90, sources: d.sources });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const parse = async () => {
    if (rawText.trim().length < 4) return;
    setParsing(true);
    setNote(null);
    try {
      const res = await fetch("/api/admin/market/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText }),
      });
      const d = await res.json();
      const list: ParsedListing[] = Array.isArray(d.listings) ? d.listings : [];
      setParsed(list);
      setSelected(new Set(list.map((_, i) => i)));
      if (list.length === 0) setNote("No listings parsed. Add rows manually below, or check LLM_API_KEY is set.");
    } finally {
      setParsing(false);
    }
  };

  const saveParsed = async () => {
    const listings = parsed.filter((_, i) => selected.has(i));
    if (listings.length === 0) return;
    setSaving(true);
    setNote(null);
    try {
      const res = await fetch("/api/admin/market/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, listings }),
      });
      const d = await res.json();
      if (res.ok) {
        setNote(`Saved ${d.stored} listing${d.stored === 1 ? "" : "s"}.`);
        setParsed([]);
        setRawText("");
        loadStats();
      } else {
        setNote(d.error || "Save failed.");
      }
    } finally {
      setSaving(false);
    }
  };

  const addManual = async () => {
    if (!m.brand.trim() || !m.model.trim() || !m.price) return;
    setSaving(true);
    setNote(null);
    try {
      const res = await fetch("/api/admin/market/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "manual",
          listings: [{
            brand: m.brand.trim(),
            model: m.model.trim(),
            year: m.year ? Number(m.year) : null,
            price_raw: Number(m.price),
            currency: m.currency,
          }],
        }),
      });
      if (res.ok) {
        setNote("Added 1 listing.");
        setM({ brand: "", model: "", year: "", price: "", currency: "USD" });
        loadStats();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <LineChart className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">Market intelligence</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-1.5">
        What cars actually sell for on OLX &amp; Telegram — so you quote competitively and import the
        models with the best market price vs landed cost. {meta.totalListings} listings (last {meta.windowDays}d).
      </p>
      {meta.sources && Object.keys(meta.sources).length > 0 && (
        <p className="text-[11px] text-muted-foreground mb-6">
          Collector freshness:{" "}
          {(["olx", "telegram", "manual", "other"] as const)
            .filter((s) => meta.sources?.[s])
            .map((s) => {
              const v = meta.sources![s];
              const ageDays = v.latest ? Math.floor((Date.now() - new Date(v.latest).getTime()) / 86_400_000) : null;
              const stale = ageDays != null && (s === "olx" || s === "telegram") && ageDays > 7;
              return (
                <span key={s} className={stale ? "text-[var(--warning)]" : undefined}>
                  {s.toUpperCase()} {v.count}{ageDays != null ? ` (${ageDays === 0 ? "today" : ageDays + "d ago"})` : ""}
                  {stale ? " ⚠" : ""}
                  {" · "}
                </span>
              );
            })}
          <span className="text-muted-foreground/70">scrapers run from deploy/collector/</span>
        </p>
      )}

      {/* Add market data */}
      <div className="bg-card border border-border p-4 mb-8 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Add market data</h2>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as typeof source)}
            className="h-9 rounded-[2px] border border-border bg-[var(--bg-3)] px-2 text-sm text-foreground"
          >
            <option value="olx">OLX</option>
            <option value="telegram">Telegram</option>
            <option value="manual">Manual</option>
            <option value="other">Other</option>
          </select>
        </div>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Paste raw OLX search results or a Telegram channel dump — the AI will extract brand / model / year / price for you to review."
          rows={4}
          className="w-full rounded-[2px] border border-border bg-[var(--bg-3)] px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[var(--accent)]"
        />
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={parse} disabled={parsing || rawText.trim().length < 4}>
            {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4" /> Parse with AI</>}
          </Button>
        </div>

        {parsed.length > 0 && (
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-xs text-muted-foreground">Review &amp; save ({selected.size} selected):</p>
            <div className="max-h-56 overflow-y-auto space-y-1">
              {parsed.map((p, i) => (
                <label key={i} className="flex items-center gap-2 text-sm py-1">
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={() =>
                      setSelected((s) => {
                        const n = new Set(s);
                        if (n.has(i)) n.delete(i); else n.add(i);
                        return n;
                      })
                    }
                  />
                  <span className="text-foreground">{p.brand} {p.model}{p.year ? ` ${p.year}` : ""}</span>
                  <span className="font-mono text-muted-foreground">
                    {p.price_raw ? `${p.price_raw.toLocaleString()} ${p.currency || ""}` : "—"}
                  </span>
                  {p.city && <span className="text-[11px] text-muted-foreground">· {p.city}</span>}
                </label>
              ))}
            </div>
            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={saveParsed} disabled={saving || selected.size === 0}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save {selected.size}</>}
              </Button>
            </div>
          </div>
        )}

        {/* Manual single add */}
        <div className="border-t border-border pt-3">
          <p className="text-xs text-muted-foreground mb-2">…or add one manually:</p>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
            <Input placeholder="Brand" value={m.brand} onChange={(e) => setM({ ...m, brand: e.target.value })} className="text-sm" />
            <Input placeholder="Model" value={m.model} onChange={(e) => setM({ ...m, model: e.target.value })} className="text-sm" />
            <Input placeholder="Year" type="number" value={m.year} onChange={(e) => setM({ ...m, year: e.target.value })} className="text-sm" />
            <Input placeholder="Price" type="number" value={m.price} onChange={(e) => setM({ ...m, price: e.target.value })} className="text-sm" />
            <select value={m.currency} onChange={(e) => setM({ ...m, currency: e.target.value })} className="h-11 rounded-[2px] border border-border bg-[var(--bg-3)] px-2 text-sm text-foreground">
              <option value="USD">USD</option>
              <option value="UZS">UZS</option>
            </select>
            <Button type="button" variant="outline" size="sm" onClick={addManual} disabled={saving || !m.brand || !m.model || !m.price}>
              <Plus className="w-4 h-4" /> Add
            </Button>
          </div>
        </div>

        {note && <p className="text-xs text-primary">{note}</p>}
      </div>

      {/* Intelligence table */}
      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No market data yet — add some above.</p>
      ) : (
        <div className="bg-card border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-4 py-2 font-medium">Model</th>
                <th className="px-4 py-2 font-medium text-right">Market median</th>
                <th className="px-4 py-2 font-medium text-right">Range</th>
                <th className="px-4 py-2 font-medium text-right">Your price</th>
                <th className="px-4 py-2 font-medium text-right">vs market</th>
                <th className="px-4 py-2 font-medium text-right">n</th>
                <th className="px-4 py-2 font-medium">Fresh</th>
                <th className="px-4 py-2 font-medium text-right">Profit?</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 text-foreground">
                    {r.brand} {r.model}{r.year ? ` ${r.year}` : ""}
                    {!r.weSell && <span className="ml-2 text-[10px] font-mono uppercase text-[var(--info)]">new opportunity</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-foreground">{usd(r.medianUsd)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-[11px] text-muted-foreground">{usd(r.minUsd)}–{usd(r.maxUsd)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{usd(r.ourPriceUsd)}</td>
                  <td className={`px-4 py-2.5 text-right font-mono ${r.vsMarketPct == null ? "text-muted-foreground" : r.vsMarketPct > 3 ? "text-[var(--danger)]" : r.vsMarketPct < -3 ? "text-[var(--success)]" : "text-foreground"}`}>
                    {r.vsMarketPct == null ? "—" : `${r.vsMarketPct > 0 ? "+" : ""}${r.vsMarketPct}%`}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{r.count}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{ago(r.latestObservedAt)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      href={`/admin/import-calculator?market=${r.medianUsd ?? ""}&brand=${encodeURIComponent(r.brand)}&model=${encodeURIComponent(r.model)}${r.year ? `&year=${r.year}` : ""}`}
                      className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline"
                      title="Check import margin at this market price"
                    >
                      <Ship className="w-3 h-3" /> calc
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground mt-4">
        Tip: <span className="text-foreground">vs market</span> shows how your price compares to the median —
        green means you&apos;re below market (competitive), red means above. <span className="text-foreground">New opportunity</span>{" "}
        = a model selling well that you don&apos;t list yet. Use <span className="text-foreground">calc</span> to see your import margin at the market price.
      </p>
    </div>
  );
}
