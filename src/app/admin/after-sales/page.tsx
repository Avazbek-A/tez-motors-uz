"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Loader2, Plus, X, Trash2, Wrench } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { warrantyStatus, daysLeft, totalServiceCost, type ServiceRecord } from "@/lib/warranty";

interface Warranty {
  id: string; customer_name: string; customer_phone: string | null; car_label: string; vin: string | null;
  delivered_at: string | null; warranty_months: number; warranty_until: string | null; services: ServiceRecord[]; notes: string | null;
}

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const STATUS_TONE: Record<string, string> = {
  active: "text-[var(--success)] border-[var(--success)]", expiring: "text-[var(--warning)] border-[var(--warning)]",
  expired: "text-[var(--danger)] border-[var(--danger)]", none: "text-muted-foreground border-border",
};

export default function AdminAfterSalesPage() {
  const [rows, setRows] = useState<Warranty[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ customer_name: "", customer_phone: "", car_label: "", vin: "", delivered_at: "", warranty_months: "12" });
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<Warranty | null>(null);
  const [svc, setSvc] = useState({ date: new Date().toISOString().slice(0, 10), odometer_km: "", description: "", cost_usd: "" });
  const now = Date.now();

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/warranties").then((r) => r.json()).then((d) => setRows(d.warranties || [])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.customer_name.trim() || !form.car_label.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/warranties", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, warranty_months: Number(form.warranty_months) || 12, delivered_at: form.delivered_at || null, customer_phone: form.customer_phone || null, vin: form.vin || null }),
      });
      if (res.ok) { setShowNew(false); setForm({ customer_name: "", customer_phone: "", car_label: "", vin: "", delivered_at: "", warranty_months: "12" }); load(); }
    } finally { setSaving(false); }
  };

  const addService = async () => {
    if (!open || !svc.description.trim()) return;
    const res = await fetch(`/api/admin/warranties/${open.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ add_service: { date: svc.date, description: svc.description.trim(), odometer_km: svc.odometer_km ? Number(svc.odometer_km) : null, cost_usd: svc.cost_usd ? Number(svc.cost_usd) : null } }),
    });
    if (res.ok) {
      const updated = { ...open, services: [...(open.services || []), { date: svc.date, description: svc.description.trim(), odometer_km: svc.odometer_km ? Number(svc.odometer_km) : null, cost_usd: svc.cost_usd ? Number(svc.cost_usd) : null }] };
      setOpen(updated); setSvc({ date: new Date().toISOString().slice(0, 10), odometer_km: "", description: "", cost_usd: "" }); load();
    }
  };

  const remove = async (id: string) => { if (!confirm("Delete this warranty record?")) return; await fetch(`/api/admin/warranties/${id}`, { method: "DELETE" }); setOpen(null); load(); };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3"><ShieldCheck className="w-6 h-6 text-primary" /><h1 className="text-2xl font-semibold text-foreground">After-sales</h1></div>
        <Button size="sm" onClick={() => setShowNew((s) => !s)}><Plus className="w-4 h-4" /> New warranty</Button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">Warranty &amp; service history per delivered car. Expiring soon (≤30 days) is flagged.</p>

      {showNew && (
        <div className="bg-card border border-border p-4 mb-4 space-y-2">
          <div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-foreground">New warranty</h2><button onClick={() => setShowNew(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button></div>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Customer *" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} className="text-sm" />
            <Input placeholder="Phone" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} className="text-sm" />
            <Input placeholder="Car * (e.g. BYD Song Plus 2024)" value={form.car_label} onChange={(e) => setForm({ ...form, car_label: e.target.value })} className="text-sm col-span-2" />
            <Input placeholder="VIN" value={form.vin} onChange={(e) => setForm({ ...form, vin: e.target.value })} className="text-sm" />
            <label className="text-xs text-muted-foreground">Delivered<Input type="date" value={form.delivered_at} onChange={(e) => setForm({ ...form, delivered_at: e.target.value })} className="text-sm mt-0.5" /></label>
            <label className="text-xs text-muted-foreground">Warranty (months)<Input type="number" value={form.warranty_months} onChange={(e) => setForm({ ...form, warranty_months: e.target.value })} className="text-sm mt-0.5" /></label>
          </div>
          <div className="flex justify-end"><Button size="sm" onClick={create} disabled={saving || !form.customer_name.trim() || !form.car_label.trim()}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}</Button></div>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No warranties yet.</p>
      ) : (
        <div className="bg-card border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="px-4 py-2 font-medium">Car / Customer</th><th className="px-4 py-2 font-medium">Until</th>
              <th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium text-right">Services</th><th className="px-4 py-2"></th>
            </tr></thead>
            <tbody>
              {rows.map((w) => {
                const st = warrantyStatus(w.warranty_until, now);
                const dl = daysLeft(w.warranty_until, now);
                return (
                  <tr key={w.id} onClick={() => setOpen(w)} className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/40">
                    <td className="px-4 py-2.5"><div className="text-foreground">{w.car_label}</div><div className="text-xs text-muted-foreground">{w.customer_name}{w.customer_phone ? ` · ${w.customer_phone}` : ""}</div></td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{w.warranty_until || "—"}{dl != null && dl >= 0 ? ` (${dl}d)` : ""}</td>
                    <td className="px-4 py-2.5"><span className={`inline-block text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 border rounded-[2px] ${STATUS_TONE[st]}`}>{st}</span></td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{(w.services || []).length}</td>
                    <td className="px-4 py-2.5 text-right"><button onClick={(e) => { e.stopPropagation(); remove(w.id); }} className="text-muted-foreground hover:text-[var(--danger)]"><Trash2 className="w-3.5 h-3.5" /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(null)} />
          <div className="relative z-10 w-full max-w-lg bg-card border border-border p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-3">
              <div><h2 className="font-semibold text-foreground">{open.car_label}</h2><p className="text-xs text-muted-foreground">{open.customer_name}{open.customer_phone ? ` · ${open.customer_phone}` : ""}{open.vin ? ` · VIN ${open.vin}` : ""}</p><p className="text-xs text-muted-foreground">Warranty until {open.warranty_until || "—"} · {open.warranty_months} mo</p></div>
              <button onClick={() => setOpen(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>

            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5"><Wrench className="w-4 h-4" /> Service history {open.services?.length ? `· total ${usd(totalServiceCost(open.services))}` : ""}</h3>
            <div className="space-y-1 mb-3">
              {(open.services || []).map((s, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b border-border/60 py-1">
                  <span className="text-foreground">{s.description}<span className="text-muted-foreground text-xs"> · {s.date}{s.odometer_km ? ` · ${s.odometer_km.toLocaleString()} km` : ""}</span></span>
                  {s.cost_usd ? <span className="font-mono text-muted-foreground">{usd(s.cost_usd)}</span> : null}
                </div>
              ))}
              {(!open.services || open.services.length === 0) && <p className="text-xs text-muted-foreground">No services logged.</p>}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Input type="date" value={svc.date} onChange={(e) => setSvc({ ...svc, date: e.target.value })} className="text-xs" />
              <Input placeholder="Odometer" type="number" value={svc.odometer_km} onChange={(e) => setSvc({ ...svc, odometer_km: e.target.value })} className="text-xs" />
              <Input placeholder="Cost $" type="number" value={svc.cost_usd} onChange={(e) => setSvc({ ...svc, cost_usd: e.target.value })} className="text-xs" />
              <Button size="sm" onClick={addService} disabled={!svc.description.trim()}>Add</Button>
              <Input placeholder="Description" value={svc.description} onChange={(e) => setSvc({ ...svc, description: e.target.value })} className="text-xs col-span-2 sm:col-span-4" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
