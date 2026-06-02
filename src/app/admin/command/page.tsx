"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Gauge, Loader2, ListChecks, Flame, Container, AlertTriangle, MessageSquare, ArrowRight, Target, ShieldCheck } from "lucide-react";

interface CommandData {
  fx: { usd_uzs: number };
  actions: { tasksDue: number; hotLeads: number; overdueShipments: number; unpaidReservations: number; newInquiries: number; warrantiesExpiring: number };
  money: { revenueMtdUsd: number; depositsUzs: number; depositsUsd: number; committedSupplierUsd: number; potentialMarginUsd: number };
  recentInquiries: { name: string; phone: string; type: string; status: string; created_at: string }[];
  hotLeads: { name: string | null; phone: string | null; lead_score: number; stage: string }[];
}
interface Pick { brand: string; model: string; verdict: string; opportunityScore: number; marginUsd: number | null; marginPct: number | null; recommendedQty: number }

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const uzs = (n: number) => new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " so'm";
const VERDICT_TONE: Record<string, string> = {
  strong_buy: "text-[var(--success)]", buy: "text-[var(--accent)]", consider: "text-[var(--warning)]", skip: "text-muted-foreground",
};

export default function AdminCommandPage() {
  const [data, setData] = useState<CommandData | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/command").then((r) => r.json()),
      fetch("/api/admin/buying").then((r) => r.json()).catch(() => ({})),
    ]).then(([cmd, buy]) => {
      if (cmd?.ok) setData(cmd);
      if (buy?.ok) setPicks((buy.recommendations || []).filter((p: Pick) => p.recommendedQty > 0).slice(0, 4));
    }).finally(() => setLoading(false));
  }, []);

  const actionCards = data ? [
    { label: "Tasks due", value: data.actions.tasksDue, href: "/admin/tasks", icon: ListChecks },
    { label: "Hot AI leads", value: data.actions.hotLeads, href: "/admin/conversations", icon: Flame },
    { label: "Overdue shipments", value: data.actions.overdueShipments, href: "/admin/shipments", icon: Container },
    { label: "Unpaid reservations", value: data.actions.unpaidReservations, href: "/admin/orders", icon: AlertTriangle },
    { label: "New inquiries", value: data.actions.newInquiries, href: "/admin/inquiries", icon: MessageSquare },
    { label: "Warranties expiring", value: data.actions.warrantiesExpiring, href: "/admin/after-sales", icon: ShieldCheck },
  ] : [];
  const totalActions = data ? Object.values(data.actions).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <Gauge className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">Command center</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Your morning briefing — what needs attention today, the cash picture, and the top models to import.
      </p>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">No data.</p>
      ) : (
        <div className="space-y-8">
          {/* Action list */}
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">
              Needs attention {totalActions > 0 ? <span className="text-primary">({totalActions})</span> : <span className="text-[var(--success)]">— all clear 🎉</span>}
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
              {actionCards.map((c) => (
                <Link key={c.label} href={c.href} className={`bg-card border p-4 rounded-[2px] transition-colors ${c.value > 0 ? "border-[var(--accent-line)] hover:border-[var(--accent)]" : "border-border hover:border-[var(--accent-line)]"}`}>
                  <div className="flex items-center justify-between">
                    <c.icon className={`w-4 h-4 ${c.value > 0 ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`font-mono text-2xl font-semibold ${c.value > 0 ? "text-foreground" : "text-muted-foreground"}`}>{c.value}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{c.label}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* Cash snapshot */}
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Cash & margin</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Revenue (MTD)", value: usd(data.money.revenueMtdUsd), accent: true },
                { label: "Deposits collected", value: uzs(data.money.depositsUzs), sub: `≈ ${usd(data.money.depositsUsd)}` },
                { label: "Committed to suppliers", value: usd(data.money.committedSupplierUsd) },
                { label: "Potential margin (lot)", value: usd(data.money.potentialMarginUsd), accent: true },
              ].map((c) => (
                <div key={c.label} className="bg-card border border-border p-4">
                  <p className={`font-mono text-xl font-semibold ${c.accent ? "text-primary" : "text-foreground"}`}>{c.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
                  {c.sub && <p className="text-[11px] text-muted-foreground">{c.sub}</p>}
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-2 text-xs">
              <Link href="/admin/money" className="text-primary hover:underline inline-flex items-center gap-1">Money cockpit <ArrowRight className="w-3 h-3" /></Link>
              <Link href="/admin/finance" className="text-primary hover:underline inline-flex items-center gap-1">Finance <ArrowRight className="w-3 h-3" /></Link>
            </div>
          </div>

          {/* Top buying picks */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Target className="w-4 h-4" /> Top to import</h2>
              <Link href="/admin/buying" className="text-xs text-primary hover:underline inline-flex items-center gap-1">Buying brain <ArrowRight className="w-3 h-3" /></Link>
            </div>
            {picks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recommendations yet — add market data + supplier costs.</p>
            ) : (
              <div className="bg-card border border-border divide-y divide-border">
                {picks.map((p, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <span className="text-sm text-foreground">{p.brand} {p.model}</span>
                      <span className={`ml-2 text-[10px] font-mono uppercase ${VERDICT_TONE[p.verdict] || "text-muted-foreground"}`}>{p.verdict.replace("_", " ")}</span>
                    </div>
                    <div className="text-xs font-mono text-muted-foreground">
                      opp {p.opportunityScore}{p.marginUsd != null ? ` · margin ${usd(p.marginUsd)}${p.marginPct != null ? ` (${p.marginPct > 0 ? "+" : ""}${p.marginPct}%)` : ""}` : ""} · qty {p.recommendedQty}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-2">Latest inquiries</h2>
              <div className="bg-card border border-border divide-y divide-border">
                {data.recentInquiries.map((q, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="text-foreground truncate">{q.name} <span className="text-muted-foreground font-mono text-xs">{q.phone}</span></span>
                    <span className={`text-[10px] font-mono uppercase ${q.status === "new" ? "text-[var(--warning)]" : "text-muted-foreground"}`}>{q.status}</span>
                  </div>
                ))}
                {data.recentInquiries.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">None yet.</p>}
              </div>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-2">Hot AI leads</h2>
              <div className="bg-card border border-border divide-y divide-border">
                {data.hotLeads.map((l, i) => (
                  <Link key={i} href="/admin/conversations" className="flex items-center justify-between px-4 py-2 text-sm hover:bg-muted/40">
                    <span className="text-foreground truncate">{l.name || "—"} <span className="text-muted-foreground font-mono text-xs">{l.phone}</span></span>
                    <span className="text-xs font-mono text-[var(--warning)]">{l.lead_score}</span>
                  </Link>
                ))}
                {data.hotLeads.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">None flagged.</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
