"use client";

import { Users2, Download } from "lucide-react";

/**
 * First-party audience activation (Phase AW). Download hashed-identifier CSVs
 * to upload to Meta / Google as Custom Audiences — for lookalikes and, the
 * cheap win, suppressing existing customers from acquisition campaigns.
 */
const AUDIENCES = [
  { key: "delivered_customers", label: "Delivered customers", use: "Lookalike seed (your best buyers) — find more like them." },
  { key: "all_customers", label: "All customers", use: "SUPPRESSION list — exclude from acquisition ads so you stop paying to re-reach people you already have." },
  { key: "open_leads", label: "Open leads", use: "Retargeting — warm leads not yet closed." },
];

export default function AdminAudiencesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Users2 className="h-5 w-5 text-lime" />
        <h1 className="text-xl font-bold">Audiences</h1>
      </div>
      <p className="text-sm text-white/60 max-w-2xl">
        Export first-party audiences as SHA-256-hashed identifiers (the format Meta &amp; Google Customer
        Match ingest — raw emails/phones never leave in the file). Upload a CSV as a Custom Audience, then
        build a lookalike from it, or use it as an <strong>exclusion</strong> so acquisition ads skip your
        existing customers.
      </p>
      <div className="space-y-3">
        {AUDIENCES.map((a) => (
          <div key={a.key} className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/5 p-4">
            <div>
              <div className="font-medium">{a.label}</div>
              <div className="text-xs text-white/50">{a.use}</div>
            </div>
            <a
              href={`/api/admin/audience/export?audience=${a.key}`}
              className="inline-flex items-center gap-1 rounded bg-lime px-3 py-2 text-sm font-medium text-navy"
            >
              <Download className="h-4 w-4" /> CSV
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
