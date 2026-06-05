"use client";

import { useEffect, useState } from "react";
import { Gift, Loader2 } from "lucide-react";

interface Row { id: string; name: string | null; phone: string | null; referred: number; converted: number }
interface Totals { referrers: number; referred: number; converted: number }

export default function AdminReferralsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/referrals");
        const data = await res.json();
        setRows(data.leaderboard || []);
        setTotals(data.totals || null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Gift className="h-5 w-5 text-lime" />
        <h1 className="text-xl font-bold">Referrals</h1>
      </div>
      {totals && (
        <div className="flex flex-wrap gap-3 text-sm">
          <div className="rounded border border-white/10 bg-white/5 px-4 py-2">{totals.referrers} referrers</div>
          <div className="rounded border border-white/10 bg-white/5 px-4 py-2">{totals.referred} referred</div>
          <div className="rounded border border-white/10 bg-white/5 px-4 py-2 text-lime">{totals.converted} converted</div>
        </div>
      )}
      {loading ? (
        <div className="flex items-center gap-2 text-white/60"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : rows.length === 0 ? (
        <p className="text-white/50 text-sm">No referrals yet. Customers get a code in their account; conversions show here.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase text-white/50">
              <tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Referrer</th><th className="px-3 py-2 text-right">Referred</th><th className="px-3 py-2 text-right">Converted</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="px-3 py-2 text-white/40">{i + 1}</td>
                  <td className="px-3 py-2"><div className="font-medium">{r.name || "—"}</div><div className="text-white/50">{r.phone || ""}</div></td>
                  <td className="px-3 py-2 text-right font-mono text-white/70">{r.referred}</td>
                  <td className="px-3 py-2 text-right font-mono text-lime">{r.converted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
