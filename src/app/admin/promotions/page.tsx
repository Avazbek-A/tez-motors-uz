"use client";

import { useCallback, useEffect, useState } from "react";
import { Tag, Loader2, Plus, X, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { discountPct } from "@/lib/promotions";

interface Car { id: string; brand: string; model: string; year: number | null; price_usd: number }
interface Promo {
  id: string; car_id: string; label: string | null; sale_price_usd: number; pre_promo_price_usd: number | null;
  starts_at: string | null; ends_at: string | null; status: string;
  cars?: { brand: string; model: string; year: number | null; price_usd: number } | null;
}

const usd = (n: number | null) => (n == null ? "—" : "$" + Math.round(n).toLocaleString("en-US"));
const STATUS_TONE: Record<string, string> = {
  scheduled: "text-[var(--info)]", active: "text-[var(--success)]", ended: "text-muted-foreground", cancelled: "text-[var(--danger)]",
};
const fmt = (s: string | null) => { if (!s) return "—"; try { return new Date(s).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return s; } };

export default function AdminPromotionsPage() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ carId: "", mode: "pct" as "pct" | "fixed", pct: "10", fixed: "", label: "", starts: "", ends: "" });
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/promotions").then((r) => r.json()).then((d) => setPromos(d.promotions || [])).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    load();
    fetch("/api/cars?all=true&limit=200").then((r) => r.json()).then((d) => setCars(d.cars || [])).catch(() => {});
  }, [load]);

  const car = cars.find((c) => c.id === form.carId);
  const previewSale = car ? (form.mode === "pct" ? Math.round((car.price_usd * (1 - (Number(form.pct) || 0) / 100)) / 100) * 100 : Number(form.fixed) || 0) : 0;

  const create = async () => {
    if (!form.carId) { setNote("Pick a car."); return; }
    setSaving(true); setNote(null);
    try {
      const res = await fetch("/api/admin/promotions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          car_id: form.carId, label: form.label || null,
          pct_off: form.mode === "pct" ? Number(form.pct) || null : null,
          fixed_price_usd: form.mode === "fixed" ? Number(form.fixed) || null : null,
          starts_at: form.starts ? new Date(form.starts).toISOString() : null,
          ends_at: form.ends ? new Date(form.ends).toISOString() : null,
        }),
      });
      const d = await res.json();
      if (res.ok) { setShowNew(false); setForm({ carId: "", mode: "pct", pct: "10", fixed: "", label: "", starts: "", ends: "" }); load(); }
      else setNote(d.error || "Could not create.");
    } finally { setSaving(false); }
  };

  const cancel = async (id: string) => { if (!confirm("Cancel this promotion? (an active one reverts the price)")) return; await fetch(`/api/admin/promotions/${id}`, { method: "DELETE" }); load(); };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3"><Tag className="w-6 h-6 text-primary" /><h1 className="text-2xl font-semibold text-foreground">Promotions</h1></div>
        <Button size="sm" onClick={() => setShowNew((s) => !s)}><Plus className="w-4 h-4" /> New promo</Button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Time-limited price drops. On start they lower the price (shown as a strikethrough on the site) and
        auto-announce to your Telegram channel; on end they revert automatically.
      </p>

      {showNew && (
        <div className="bg-card border border-border p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-foreground">New promotion</h2><button onClick={() => setShowNew(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button></div>
          <select value={form.carId} onChange={(e) => setForm({ ...form, carId: e.target.value })} className="w-full h-11 rounded-[2px] border border-border bg-[var(--bg-3)] px-3 text-sm text-foreground">
            <option value="">Select a car…</option>
            {cars.map((c) => <option key={c.id} value={c.id}>{c.brand} {c.model}{c.year ? ` ${c.year}` : ""} — {usd(c.price_usd)}</option>)}
          </select>
          <div className="flex gap-2">
            {(["pct", "fixed"] as const).map((m) => (
              <button key={m} onClick={() => setForm({ ...form, mode: m })} className={`px-3 py-1 text-xs font-mono uppercase rounded-[2px] border ${form.mode === m ? "border-[var(--accent)] text-primary" : "border-border text-muted-foreground"}`}>{m === "pct" ? "% off" : "Fixed price"}</button>
            ))}
            {form.mode === "pct"
              ? <Input type="number" value={form.pct} onChange={(e) => setForm({ ...form, pct: e.target.value })} className="w-24 text-sm" placeholder="% off" />
              : <Input type="number" value={form.fixed} onChange={(e) => setForm({ ...form, fixed: e.target.value })} className="w-32 text-sm" placeholder="Sale price $" />}
            {car && previewSale > 0 && <span className="text-xs text-muted-foreground self-center">→ {usd(previewSale)} ({discountPct(car.price_usd, previewSale)}% off)</span>}
          </div>
          <Input placeholder="Label (optional, e.g. 'Весенняя распродажа')" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted-foreground">Starts<Input type="datetime-local" value={form.starts} onChange={(e) => setForm({ ...form, starts: e.target.value })} className="text-sm mt-0.5" /></label>
            <label className="text-xs text-muted-foreground">Ends<Input type="datetime-local" value={form.ends} onChange={(e) => setForm({ ...form, ends: e.target.value })} className="text-sm mt-0.5" /></label>
          </div>
          <p className="text-[11px] text-muted-foreground">Leave &ldquo;Starts&rdquo; empty to begin at the next hourly run. Promos apply/revert via cron.</p>
          <div className="flex justify-end"><Button size="sm" onClick={create} disabled={saving || !form.carId}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}</Button></div>
          {note && <p className="text-xs text-[var(--danger)]">{note}</p>}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
      ) : promos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No promotions yet.</p>
      ) : (
        <div className="bg-card border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="px-4 py-2 font-medium">Car</th><th className="px-4 py-2 font-medium text-right">Sale</th>
              <th className="px-4 py-2 font-medium text-right">Off</th><th className="px-4 py-2 font-medium">Window</th>
              <th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2"></th>
            </tr></thead>
            <tbody>
              {promos.map((p) => {
                const orig = p.pre_promo_price_usd ?? p.cars?.price_usd ?? null;
                return (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-foreground">{p.cars ? `${p.cars.brand} ${p.cars.model}${p.cars.year ? ` ${p.cars.year}` : ""}` : "—"}{p.label ? <span className="text-muted-foreground text-xs"> · {p.label}</span> : null}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-foreground">{usd(p.sale_price_usd)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-[var(--success)]">{orig ? `${discountPct(orig, p.sale_price_usd)}%` : "—"}</td>
                    <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">{fmt(p.starts_at)} → {fmt(p.ends_at)}</td>
                    <td className="px-4 py-2.5"><span className={`text-[10px] font-mono uppercase ${STATUS_TONE[p.status] || "text-muted-foreground"}`}>{p.status}</span></td>
                    <td className="px-4 py-2.5 text-right">{(p.status === "scheduled" || p.status === "active") && <button onClick={() => cancel(p.id)} className="text-muted-foreground hover:text-[var(--danger)]"><Trash2 className="w-3.5 h-3.5" /></button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
