"use client";

import { Download, FileSpreadsheet } from "lucide-react";

const EXPORTS = [
  { type: "leads", label: "Leads / inquiries", desc: "Every inquiry: name, phone, email, type, status, source." },
  { type: "inventory", label: "Inventory + margins", desc: "Cars with list price, your cost and gross margin." },
  { type: "invoices", label: "Invoices", desc: "All invoices with subtotal, VAT and total." },
  { type: "expenses", label: "Expenses", desc: "All expenses incl. currency and USD-normalized amount." },
];

export default function AdminExportPage() {
  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-1">
        <FileSpreadsheet className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">Export</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Download your data as CSV (UTF-8, opens in Excel/Sheets) — for your accountant, records, or analysis.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {EXPORTS.map((e) => (
          <a
            key={e.type}
            href={`/api/admin/export/${e.type}`}
            className="bg-card border border-border p-4 rounded-[2px] hover:border-[var(--accent)] transition-colors group"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{e.label}</span>
              <Download className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{e.desc}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
