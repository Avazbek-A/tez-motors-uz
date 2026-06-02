"use client";

import { useCallback, useEffect, useState } from "react";
import { Container, Loader2, Plus, X, Check, ArrowRight, FileText, Trash2, Plane, Ship as ShipIcon, Train, TruckIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SHIPMENT_MILESTONES, milestoneLabel, nextMilestone, progressPct, milestoneStatus } from "@/lib/shipment-flow";

interface Shipment {
  id: string;
  title: string;
  supplier: string | null;
  mode: string;
  container_no: string | null;
  origin: string | null;
  destination: string | null;
  qty: number | null;
  status: string;
  eta_date: string | null;
  notes: string | null;
}
interface Ev { milestone: string; note: string | null; created_at: string }
interface Doc { id: string; kind: string; url: string; filename: string | null; created_at: string }

const MODE_ICON: Record<string, typeof Plane> = { air: Plane, sea: ShipIcon, rail: Train, road: TruckIcon, multimodal: TruckIcon };
const DOC_KINDS = ["invoice", "packing_list", "bill_of_lading", "customs_declaration", "certificate", "other"];

const fmt = (s: string | null) => {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" }); } catch { return s; }
};

export default function AdminShipmentsPage() {
  const [rows, setRows] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: "", supplier: "", mode: "rail", qty: "", eta_date: "", container_no: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<{ shipment: Shipment; events: Ev[]; documents: Doc[] } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [doc, setDoc] = useState({ kind: "invoice", url: "", filename: "" });

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/shipments").then((r) => r.json()).then((d) => setRows(d.shipments || [])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("title") || p.get("po_id")) {
      setShowNew(true);
      setForm((f) => ({ ...f, title: p.get("title") || f.title, supplier: p.get("supplier") || f.supplier, qty: p.get("qty") || f.qty }));
    }
  }, []);

  const create = async () => {
    if (form.title.trim().length < 2) return;
    setSaving(true);
    try {
      const p = new URLSearchParams(window.location.search);
      const res = await fetch("/api/admin/shipments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(), supplier: form.supplier || null, mode: form.mode,
          qty: form.qty ? Number(form.qty) : null, eta_date: form.eta_date || null,
          container_no: form.container_no || null, notes: form.notes || null,
          purchase_order_id: p.get("po_id") || null,
        }),
      });
      if (res.ok) { setShowNew(false); setForm({ title: "", supplier: "", mode: "rail", qty: "", eta_date: "", container_no: "", notes: "" }); load(); }
    } finally { setSaving(false); }
  };

  const openDetail = async (id: string) => {
    setLoadingDetail(true); setOpen(null);
    try { const d = await (await fetch(`/api/admin/shipments/${id}`)).json(); if (d.shipment) setOpen(d); }
    finally { setLoadingDetail(false); }
  };

  const advance = async (s: Shipment, to?: string) => {
    const next = to || nextMilestone(s.status);
    if (!next) return;
    await fetch(`/api/admin/shipments/${s.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
    await openDetail(s.id); load();
  };

  const addDoc = async (shipmentId: string) => {
    if (!doc.url.trim()) return;
    const res = await fetch(`/api/admin/shipments/${shipmentId}/documents`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: doc.kind, url: doc.url.trim(), filename: doc.filename || null }),
    });
    if (res.ok) { setDoc({ kind: "invoice", url: "", filename: "" }); openDetail(shipmentId); }
  };
  const delDoc = async (shipmentId: string, docId: string) => {
    await fetch(`/api/admin/shipments/${shipmentId}/documents?doc=${docId}`, { method: "DELETE" });
    openDetail(shipmentId);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this shipment?")) return;
    await fetch(`/api/admin/shipments/${id}`, { method: "DELETE" });
    setOpen(null); load();
  };

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <Container className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-semibold text-foreground">Shipments</h1>
        </div>
        <Button size="sm" onClick={() => setShowNew((s) => !s)}><Plus className="w-4 h-4" /> New shipment</Button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Track each import from supplier payment → shipping → customs → arrival → delivery, with documents and ETAs.
      </p>

      {showNew && (
        <div className="bg-card border border-border p-4 mb-4 space-y-2">
          <div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-foreground">New shipment</h2><button onClick={() => setShowNew(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button></div>
          <Input placeholder="Title * (e.g. 3× BYD Song Plus from Shenzhen)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Supplier" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="text-sm" />
            <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} className="h-11 rounded-[2px] border border-border bg-[var(--bg-3)] px-2 text-sm text-foreground">
              {["rail", "sea", "road", "air", "multimodal"].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <Input type="number" placeholder="Qty" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} className="text-sm" />
            <Input type="date" value={form.eta_date} onChange={(e) => setForm({ ...form, eta_date: e.target.value })} className="text-sm" />
            <Input placeholder="Container / wagon no." value={form.container_no} onChange={(e) => setForm({ ...form, container_no: e.target.value })} className="text-sm col-span-2" />
          </div>
          <div className="flex justify-end"><Button size="sm" onClick={create} disabled={saving || form.title.trim().length < 2}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}</Button></div>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No shipments yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((s) => {
            const Icon = MODE_ICON[s.mode] || TruckIcon;
            const pct = progressPct(s.status);
            const overdue = s.eta_date && s.status !== "delivered" && new Date(s.eta_date).getTime() < Date.now();
            return (
              <div key={s.id} onClick={() => openDetail(s.id)} className="bg-card border border-border p-3 cursor-pointer hover:bg-muted/40">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm text-foreground truncate">{s.title}</span>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">{milestoneLabel(s.status)}</span>
                </div>
                <div className="mt-2 h-1.5 bg-[var(--bg-3)] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center justify-between mt-1.5 text-[11px] text-muted-foreground">
                  <span>{s.supplier || "—"}{s.qty ? ` · ${s.qty} units` : ""}</span>
                  <span className={overdue ? "text-[var(--danger)]" : ""}>ETA {fmt(s.eta_date)}{overdue ? " · overdue" : ""}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(open || loadingDetail) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(null)} />
          <div className="relative z-10 w-full max-w-lg bg-card border border-border p-6 max-h-[90vh] overflow-y-auto">
            {loadingDetail || !open ? (
              <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="font-semibold text-foreground">{open.shipment.title}</h2>
                    <p className="text-xs text-muted-foreground">{open.shipment.supplier || "—"} · {open.shipment.mode}{open.shipment.container_no ? ` · ${open.shipment.container_no}` : ""} · ETA {fmt(open.shipment.eta_date)}</p>
                  </div>
                  <button onClick={() => setOpen(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
                </div>

                {/* Milestone timeline */}
                <div className="space-y-1.5 mb-4">
                  {SHIPMENT_MILESTONES.map((m) => {
                    const st = milestoneStatus(m, open.shipment.status);
                    return (
                      <div key={m} className="flex items-center gap-2 text-sm">
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${st === "done" ? "bg-[var(--success)]/20 text-[var(--success)]" : st === "current" ? "bg-[var(--accent)]/20 text-[var(--accent)]" : "border border-border"}`}>
                          {st === "done" ? <Check className="w-3 h-3" /> : null}
                        </span>
                        <span className={st === "pending" ? "text-muted-foreground" : "text-foreground"}>{milestoneLabel(m)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2 mb-4">
                  {nextMilestone(open.shipment.status) && (
                    <Button size="sm" onClick={() => advance(open.shipment)}>
                      <ArrowRight className="w-4 h-4" /> Advance to {milestoneLabel(nextMilestone(open.shipment.status) as string)}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => remove(open.shipment.id)} className="ml-auto text-[var(--danger)]"><Trash2 className="w-4 h-4" /></Button>
                </div>

                {/* Documents */}
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5"><FileText className="w-4 h-4" /> Documents</h3>
                <div className="space-y-1 mb-2">
                  {open.documents.map((d) => (
                    <div key={d.id} className="flex items-center justify-between text-sm">
                      <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">{d.kind.replace("_", " ")}{d.filename ? ` · ${d.filename}` : ""}</a>
                      <button onClick={() => delDoc(open.shipment.id, d.id)} className="text-muted-foreground hover:text-[var(--danger)] shrink-0 ml-2"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  {open.documents.length === 0 && <p className="text-xs text-muted-foreground">No documents attached.</p>}
                </div>
                <div className="flex gap-2">
                  <select value={doc.kind} onChange={(e) => setDoc({ ...doc, kind: e.target.value })} className="h-9 rounded-[2px] border border-border bg-[var(--bg-3)] px-1.5 text-xs text-foreground">
                    {DOC_KINDS.map((k) => <option key={k} value={k}>{k.replace("_", " ")}</option>)}
                  </select>
                  <Input placeholder="Document URL" value={doc.url} onChange={(e) => setDoc({ ...doc, url: e.target.value })} className="text-xs h-9 flex-1" />
                  <Button size="sm" variant="outline" onClick={() => addDoc(open.shipment.id)} disabled={!doc.url.trim()}>Add</Button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Paste a link (Supabase Storage, Drive, etc.) to the invoice / customs declaration / certificate.</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
