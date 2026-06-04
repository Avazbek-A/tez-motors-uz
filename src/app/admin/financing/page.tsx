"use client";

import { useEffect, useState } from "react";
import { Landmark, ShieldCheck, Loader2 } from "lucide-react";

interface App {
  id: string;
  customer_name: string;
  customer_phone: string;
  down_pct: number | null;
  term_months: number | null;
  estimated_monthly: number | null;
  employment: string | null;
  income_band: string | null;
  status: string;
  created_at: string;
}
interface InsLead {
  id: string;
  customer_name: string | null;
  customer_phone: string;
  type: string;
  estimated_premium_usd: number | null;
  status: string;
  created_at: string;
}

const APP_STATUSES = ["new", "submitted", "approved", "declined"];
const INS_STATUSES = ["new", "contacted", "bound", "lost"];

export default function AdminFinancingPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [ins, setIns] = useState<InsLead[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/financing");
      const data = await res.json();
      setApps(data.applications || []);
      setIns(data.insurance || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function setStatus(kind: "financing" | "insurance", id: string, status: string) {
    await fetch("/api/admin/financing", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, id, status }),
    });
    if (kind === "financing") setApps((a) => a.map((x) => (x.id === id ? { ...x, status } : x)));
    else setIns((a) => a.map((x) => (x.id === id ? { ...x, status } : x)));
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-white/60">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-lime" />
          <h1 className="text-xl font-bold">Financing applications</h1>
        </div>
        {apps.length === 0 ? (
          <p className="text-white/50 text-sm">No applications yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase text-white/50">
                <tr><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Terms</th><th className="px-3 py-2">Employment</th><th className="px-3 py-2">Status</th></tr>
              </thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.id} className="border-t border-white/5">
                    <td className="px-3 py-2"><div className="font-medium">{a.customer_name}</div><div className="text-white/50">{a.customer_phone}</div></td>
                    <td className="px-3 py-2 text-white/70">
                      {a.term_months ? `${a.term_months} mo` : "—"}{a.down_pct != null ? ` · ${a.down_pct}% down` : ""}{a.estimated_monthly ? ` · ~$${Math.round(a.estimated_monthly)}/mo` : ""}
                    </td>
                    <td className="px-3 py-2 text-white/60">{a.employment || "—"}{a.income_band ? ` · ${a.income_band}` : ""}</td>
                    <td className="px-3 py-2">
                      <select value={a.status} onChange={(e) => setStatus("financing", a.id, e.target.value)} className="rounded border border-white/15 bg-black/20 px-2 py-1 text-xs">
                        {APP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-lime" />
          <h2 className="text-lg font-bold">Insurance leads</h2>
        </div>
        {ins.length === 0 ? (
          <p className="text-white/50 text-sm">No insurance leads yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase text-white/50">
                <tr><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Est. premium</th><th className="px-3 py-2">Status</th></tr>
              </thead>
              <tbody>
                {ins.map((l) => (
                  <tr key={l.id} className="border-t border-white/5">
                    <td className="px-3 py-2"><div className="font-medium">{l.customer_name || "—"}</div><div className="text-white/50">{l.customer_phone}</div></td>
                    <td className="px-3 py-2 uppercase text-white/70">{l.type}</td>
                    <td className="px-3 py-2 text-white/70">{l.estimated_premium_usd ? `$${Math.round(l.estimated_premium_usd)}/yr` : "—"}</td>
                    <td className="px-3 py-2">
                      <select value={l.status} onChange={(e) => setStatus("insurance", l.id, e.target.value)} className="rounded border border-white/15 bg-black/20 px-2 py-1 text-xs">
                        {INS_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
