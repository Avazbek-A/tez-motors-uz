"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, Loader2, Truck, MessageCircle, Sparkles, Container, Receipt } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PURCHASE_ORDER_STATUSES } from "@/lib/schemas/purchase-order";

interface PurchaseOrder {
  id: string;
  supplier: string | null;
  supplier_phone: string | null;
  brand: string;
  model: string;
  trim: string | null;
  year: number | null;
  qty: number;
  unit_cost_usd: number | null;
  status: string;
  eta_date: string | null;
  notes: string | null;
  created_at: string;
}

const MSG_KINDS: { value: string; label: string }[] = [
  { value: "rfq", label: "Request quote" },
  { value: "follow_up", label: "Follow up" },
  { value: "eta", label: "Shipping / ETA" },
  { value: "price_check", label: "Price check" },
];

/** Build a one-tap WhatsApp link. With a number → direct chat; without → share sheet. */
function waLink(phone: string | null | undefined, text: string): string {
  const digits = (phone || "").replace(/[^\d]/g, "");
  const q = `?text=${encodeURIComponent(text)}`;
  return digits ? `https://wa.me/${digits}${q}` : `https://wa.me/${q}`;
}

const usd = (n: number | null) => (n == null ? "—" : "$" + Math.round(n).toLocaleString("en-US"));

const STATUS_TONE: Record<string, string> = {
  draft: "text-muted-foreground border-border",
  ordered: "text-[var(--info)] border-[var(--info)]",
  in_production: "text-[var(--warning)] border-[var(--warning)]",
  shipped: "text-primary border-[var(--accent-line)]",
  arrived: "text-[var(--success)] border-[var(--success)]",
  cancelled: "text-[var(--danger)] border-[var(--danger)]",
};

type Draft = Partial<PurchaseOrder>;

export default function AdminProcurementPage() {
  const [rows, setRows] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [msgKind, setMsgKind] = useState("rfq");
  const [msgText, setMsgText] = useState("");
  const [drafting, setDrafting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/purchase-orders")
      .then((r) => r.json())
      .then((d) => setRows(d.purchaseOrders || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Optional prefill (?brand=&model=&unit_cost_usd=) so a demand/ledger link can
  // open a new PO pre-populated.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const brand = p.get("brand");
    if (!brand) return;
    setEditing({
      brand,
      model: p.get("model") || "",
      qty: 1,
      status: "draft",
      unit_cost_usd: p.get("unit_cost_usd") ? Number(p.get("unit_cost_usd")) : null,
    });
  }, []);

  // Reset the WhatsApp draft when switching to a different purchase order.
  useEffect(() => {
    setMsgText("");
    setMsgKind("rfq");
  }, [editing?.id]);

  const draftMessage = async () => {
    if (!editing?.id) return;
    setDrafting(true);
    try {
      const res = await fetch(`/api/admin/purchase-orders/${editing.id}/draft-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: msgKind }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.text) setMsgText(data.text);
    } finally {
      setDrafting(false);
    }
  };

  const save = async () => {
    if (!editing || !editing.brand || !editing.model) return;
    setSaving(true);
    try {
      const isEdit = !!editing.id;
      const payload = {
        supplier: editing.supplier || null,
        supplier_phone: editing.supplier_phone || null,
        brand: editing.brand,
        model: editing.model,
        trim: editing.trim || null,
        year: editing.year ? Number(editing.year) : null,
        qty: editing.qty ? Number(editing.qty) : 1,
        unit_cost_usd: editing.unit_cost_usd != null && editing.unit_cost_usd !== ("" as never) ? Number(editing.unit_cost_usd) : null,
        status: editing.status || "draft",
        eta_date: editing.eta_date || null,
        notes: editing.notes || null,
      };
      const res = await fetch(
        isEdit ? `/api/admin/purchase-orders/${editing.id}` : "/api/admin/purchase-orders",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (res.ok) {
        setEditing(null);
        load();
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this purchase order?")) return;
    const res = await fetch(`/api/admin/purchase-orders/${id}`, { method: "DELETE" });
    if (res.ok) load();
  };

  const set = (patch: Draft) => setEditing((e) => ({ ...(e || {}), ...patch }));

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <Truck className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-semibold text-foreground">Procurement</h1>
        </div>
        <Button size="sm" onClick={() => setEditing({ brand: "", model: "", qty: 1, status: "draft" })}>
          <Plus className="w-4 h-4" /> New purchase order
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Track what you order from suppliers — from draft to arrived. Internal only.
      </p>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No purchase orders yet.</p>
      ) : (
        <div className="bg-card border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-4 py-2 font-medium">Supplier</th>
                <th className="px-4 py-2 font-medium">Car</th>
                <th className="px-4 py-2 font-medium text-right">Qty</th>
                <th className="px-4 py-2 font-medium text-right">Unit cost</th>
                <th className="px-4 py-2 font-medium text-right">Total</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">ETA</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((po) => (
                <tr key={po.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 text-foreground">{po.supplier || "—"}</td>
                  <td className="px-4 py-2.5 text-foreground">
                    {po.brand} {po.model}{po.trim ? ` ${po.trim}` : ""}{po.year ? ` ${po.year}` : ""}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{po.qty}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{usd(po.unit_cost_usd)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-foreground">
                    {usd(po.unit_cost_usd != null ? po.unit_cost_usd * po.qty : null)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 border rounded-[2px] ${STATUS_TONE[po.status] || "text-muted-foreground border-border"}`}>
                      {po.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-muted-foreground">{po.eta_date || "—"}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => setEditing(po)} className="text-muted-foreground hover:text-primary p-1"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => remove(po.id)} className="text-muted-foreground hover:text-[var(--danger)] p-1"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditing(null)} />
          <div className="relative z-10 w-full max-w-lg bg-card border border-border p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">{editing.id ? "Edit" : "New"} purchase order</h2>
              <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Supplier" value={editing.supplier || ""} onChange={(e) => set({ supplier: e.target.value })} />
                <Input placeholder="Supplier WhatsApp (+86…)" value={editing.supplier_phone || ""} onChange={(e) => set({ supplier_phone: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Brand *" value={editing.brand || ""} onChange={(e) => set({ brand: e.target.value })} />
                <Input placeholder="Model *" value={editing.model || ""} onChange={(e) => set({ model: e.target.value })} />
                <Input placeholder="Trim" value={editing.trim || ""} onChange={(e) => set({ trim: e.target.value })} />
                <Input type="number" placeholder="Year" value={editing.year ?? ""} onChange={(e) => set({ year: e.target.value ? Number(e.target.value) : null })} />
                <Input type="number" placeholder="Qty" value={editing.qty ?? 1} onChange={(e) => set({ qty: Number(e.target.value) })} />
                <Input type="number" placeholder="Unit cost USD" value={editing.unit_cost_usd ?? ""} onChange={(e) => set({ unit_cost_usd: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={editing.status || "draft"}
                  onChange={(e) => set({ status: e.target.value })}
                  className="h-11 rounded-[2px] border border-border bg-[var(--bg-3)] px-3 text-sm text-foreground"
                >
                  {PURCHASE_ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>{s.replace("_", " ")}</option>
                  ))}
                </select>
                <Input type="date" value={editing.eta_date || ""} onChange={(e) => set({ eta_date: e.target.value })} />
              </div>
              <Input placeholder="Notes" value={editing.notes || ""} onChange={(e) => set({ notes: e.target.value })} />

              {/* Supplier WhatsApp message — AI-drafted, you review & send (ToS-safe). */}
              <div className="rounded-[2px] border border-border bg-[var(--bg-3)]/50 p-3 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  <MessageCircle className="w-3.5 h-3.5" /> Supplier WhatsApp message
                </div>
                {editing.id ? (
                  <>
                    <div className="flex gap-2">
                      <select
                        value={msgKind}
                        onChange={(e) => setMsgKind(e.target.value)}
                        className="h-9 flex-1 rounded-[2px] border border-border bg-[var(--bg-3)] px-2 text-sm text-foreground"
                      >
                        {MSG_KINDS.map((k) => (
                          <option key={k.value} value={k.value}>{k.label}</option>
                        ))}
                      </select>
                      <Button type="button" variant="outline" size="sm" onClick={draftMessage} disabled={drafting}>
                        {drafting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4" /> Draft</>}
                      </Button>
                    </div>
                    <textarea
                      value={msgText}
                      onChange={(e) => setMsgText(e.target.value)}
                      placeholder="Draft a message, edit it, then send on WhatsApp…"
                      rows={5}
                      className="w-full rounded-[2px] border border-border bg-[var(--bg-3)] px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-[var(--accent)] whitespace-pre-wrap"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] text-muted-foreground">
                        Bilingual 中文/EN. Review before sending — you send, not the bot.
                      </p>
                      <a
                        href={waLink(editing.supplier_phone, msgText)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1.5 rounded-[2px] bg-[var(--success)] px-3 py-1.5 text-xs font-medium text-black ${msgText.trim() ? "" : "pointer-events-none opacity-50"}`}
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> Send on WhatsApp
                      </a>
                    </div>
                  </>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Save this order first to draft a supplier message.</p>
                )}
              </div>
            </div>
            {editing.id && (
              <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-border text-xs">
                <span className="text-muted-foreground">Next:</span>
                <Link
                  href={`/admin/shipments?po_id=${editing.id}&title=${encodeURIComponent(`${editing.qty || 1}× ${editing.brand} ${editing.model}${editing.supplier ? ` from ${editing.supplier}` : ""}`)}&supplier=${encodeURIComponent(editing.supplier || "")}&qty=${editing.qty || 1}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <Container className="w-3.5 h-3.5" /> Create shipment
                </Link>
                <Link
                  href={`/admin/finance?exp_category=supplier_payment&exp_currency=USD&exp_supplier=${encodeURIComponent(editing.supplier || "")}&exp_amount=${Math.round((editing.unit_cost_usd || 0) * (editing.qty || 1))}&exp_desc=${encodeURIComponent(`${editing.brand} ${editing.model} — PO`)}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <Receipt className="w-3.5 h-3.5" /> Log supplier payment
                </Link>
              </div>
            )}
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
              <Button size="sm" onClick={save} disabled={saving || !editing.brand || !editing.model}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
