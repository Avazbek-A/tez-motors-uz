"use client";

import { useEffect, useState } from "react";
import { Users, Loader2 } from "lucide-react";

interface TeamRow {
  id: string;
  email: string;
  role: string;
  assigned: number;
  closed: number;
  close_rate_pct: number | null;
  commission_accrued_usd: number;
  commission_paid_usd: number;
}

export default function AdminTeamPage() {
  const [rows, setRows] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/team");
        const data = await res.json();
        setRows(data.team || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-lime" />
        <h1 className="text-xl font-bold">Team</h1>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-white/50 text-sm">No team members with assigned leads yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase text-white/50">
              <tr>
                <th className="px-3 py-2">Rep</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Assigned</th>
                <th className="px-3 py-2">Closed</th>
                <th className="px-3 py-2">Close rate</th>
                <th className="px-3 py-2">Commission (accrued / paid)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="px-3 py-2 font-medium">{r.email}</td>
                  <td className="px-3 py-2 text-white/60">{r.role}</td>
                  <td className="px-3 py-2">{r.assigned}</td>
                  <td className="px-3 py-2">{r.closed}</td>
                  <td className="px-3 py-2">
                    {r.close_rate_pct != null ? (
                      <span className={r.close_rate_pct >= 40 ? "text-lime" : r.close_rate_pct >= 20 ? "text-yellow-400" : "text-white/60"}>
                        {r.close_rate_pct}%
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-white/70">
                    ${r.commission_accrued_usd.toLocaleString("en-US")} / ${r.commission_paid_usd.toLocaleString("en-US")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
