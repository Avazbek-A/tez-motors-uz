"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Sparkles, Loader2, RefreshCw, ArrowRight, Tag, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Markdown { carId: string; name: string; daysOnLot: number; markdownPct: number; suggestedPriceUsd: number; currentPriceUsd: number }
interface Ctx {
  actions: { newInquiries: number; hotLeads: number; tasksDue: number; unpaidReservations: number; overdueShipments: number; warrantiesExpiring: number };
  money: { revenueMtdUsd: number; depositsUsd: number; committedSupplierUsd: number; potentialMarginUsd: number };
  topMarkdowns: Markdown[];
  topDemand: { name: string; inquiries: number }[];
}

const usd = (n: number) => "$" + Math.round(n || 0).toLocaleString("en-US");

const LOCALES = [{ k: "ru", l: "RU" }, { k: "uz", l: "UZ" }, { k: "en", l: "EN" }];

export default function AdminOperatorPage() {
  const [briefing, setBriefing] = useState("");
  const [ai, setAi] = useState(false);
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [loading, setLoading] = useState(true);
  const [locale, setLocale] = useState("ru");
  const [promoBusy, setPromoBusy] = useState<string | null>(null);
  const [promoDone, setPromoDone] = useState<Record<string, string>>({});

  const load = useCallback((loc: string) => {
    setLoading(true);
    fetch(`/api/admin/operator?locale=${loc}`)
      .then((r) => r.json())
      .then((d) => { if (d?.ok) { setBriefing(d.briefing); setAi(d.ai); setCtx(d.context); } })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(locale); }, [locale, load]);

  const createPromo = async (m: Markdown) => {
    setPromoBusy(m.carId);
    try {
      const res = await fetch("/api/admin/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_id: m.carId, fixed_price_usd: m.suggestedPriceUsd, label: `Aged-stock markdown (${m.daysOnLot}d)` }),
      });
      const d = await res.json();
      setPromoDone((prev) => ({ ...prev, [m.carId]: res.ok ? "✓ Promo created — goes live within the hour" : d.error || "Failed" }));
    } catch {
      setPromoDone((prev) => ({ ...prev, [m.carId]: "Failed" }));
    } finally {
      setPromoBusy(null);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-semibold text-foreground">AI Operator</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {LOCALES.map((x) => (
              <button key={x.k} onClick={() => setLocale(x.k)} className={`px-2 py-1 text-xs font-mono rounded-[2px] border ${locale === x.k ? "border-[var(--accent)] text-primary" : "border-border text-muted-foreground"}`}>{x.l}</button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={() => load(locale)} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Your proactive morning briefing — the whole business synthesized into what to do today.
        {!ai && !loading && <span className="text-[var(--warning)]"> (template mode — set LLM_API_KEY for the AI narrative)</span>}
      </p>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
      ) : (
        <>
          <div className="bg-card border border-border p-5 whitespace-pre-wrap text-sm text-foreground leading-relaxed">
            {briefing || "No briefing."}
          </div>

          {ctx && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-4">
              {[
                { label: "Revenue MTD", value: "$" + Math.round(ctx.money.revenueMtdUsd).toLocaleString("en-US"), href: "/admin/finance" },
                { label: "Committed to suppliers", value: "$" + Math.round(ctx.money.committedSupplierUsd).toLocaleString("en-US"), href: "/admin/money" },
                { label: "Potential margin", value: "$" + Math.round(ctx.money.potentialMarginUsd).toLocaleString("en-US"), href: "/admin/ledger" },
                { label: "New inquiries", value: String(ctx.actions.newInquiries), href: "/admin/inquiries" },
              ].map((c) => (
                <Link key={c.label} href={c.href} className="bg-card border border-border p-3 rounded-[2px] hover:border-[var(--accent-line)]">
                  <p className="font-mono text-lg font-semibold text-foreground">{c.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{c.label}</p>
                </Link>
              ))}
            </div>
          )}

          {ctx && ctx.topMarkdowns.length > 0 && (
            <div className="mt-5">
              <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5"><Tag className="w-4 h-4 text-[var(--accent)]" /> Move aged stock — one click</h2>
              <div className="space-y-2">
                {ctx.topMarkdowns.map((m) => {
                  const result = promoDone[m.carId];
                  return (
                    <div key={m.carId} className="bg-card border border-border p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground font-medium truncate">{m.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.daysOnLot}d on lot · <span className="line-through">{usd(m.currentPriceUsd)}</span> → <span className="text-[var(--accent)]">{usd(m.suggestedPriceUsd)}</span> (−{m.markdownPct}%)
                        </p>
                      </div>
                      {result ? (
                        <span className="text-xs text-[var(--success)] inline-flex items-center gap-1 shrink-0"><Check className="w-3.5 h-3.5" />{result.replace("✓ ", "")}</span>
                      ) : (
                        <Button type="button" size="sm" variant="outline" onClick={() => createPromo(m)} disabled={promoBusy === m.carId} className="shrink-0">
                          {promoBusy === m.carId ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Tag className="w-4 h-4" /> Create promo at {usd(m.suggestedPriceUsd)}</>}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">Creates a price promotion (storefront strikethrough); Marketing Autopilot will then suggest announcing it. Revert anytime in <Link href="/admin/promotions" className="text-primary hover:underline">Promotions</Link>.</p>
            </div>
          )}

          <div className="flex flex-wrap gap-3 mt-4 text-sm">
            <Link href="/admin/command" className="text-primary hover:underline inline-flex items-center gap-1">Command center <ArrowRight className="w-3.5 h-3.5" /></Link>
            <Link href="/admin/buying" className="text-primary hover:underline inline-flex items-center gap-1">Buying brain <ArrowRight className="w-3.5 h-3.5" /></Link>
            <Link href="/admin/aging" className="text-primary hover:underline inline-flex items-center gap-1">Aged stock <ArrowRight className="w-3.5 h-3.5" /></Link>
          </div>
        </>
      )}
    </div>
  );
}
