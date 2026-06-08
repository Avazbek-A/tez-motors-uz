"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Sparkles, Loader2, RefreshCw, ArrowRight, Tag, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

const COPY: Record<Locale, {
  title: string;
  briefingIntro: string;
  templateMode: string;
  noBriefing: string;
  revenueMtd: string;
  committedToSuppliers: string;
  potentialMargin: string;
  newInquiries: string;
  moveAgedStock: string;
  daysOnLot: string;
  createPromoAt: string;
  promoCreated: string;
  failed: string;
  promoHint: string;
  promotions: string;
  commandCenter: string;
  buyingBrain: string;
  agedStock: string;
}> = {
  ru: {
    title: "AI-оператор",
    briefingIntro: "Ваша проактивная утренняя сводка — весь бизнес собран в то, что нужно сделать сегодня.",
    templateMode: " (режим шаблона — задайте LLM_API_KEY для AI-сводки)",
    noBriefing: "Нет сводки.",
    revenueMtd: "Выручка с начала мес.",
    committedToSuppliers: "Обязательства поставщикам",
    potentialMargin: "Потенциальная маржа",
    newInquiries: "Новые заявки",
    moveAgedStock: "Сдвинуть залежавшийся товар — в один клик",
    daysOnLot: " дн. на складе",
    createPromoAt: "Создать акцию по цене",
    promoCreated: "Акция создана — появится в течение часа",
    failed: "Не удалось",
    promoHint: "Создаёт ценовую акцию (зачёркнутая цена в витрине); затем Маркетинговый автопилот предложит её анонсировать. Отменить можно в любой момент в",
    promotions: "Акциях",
    commandCenter: "Командный центр",
    buyingBrain: "Закупочный мозг",
    agedStock: "Залежавшийся товар",
  },
  uz: {
    title: "AI-operator",
    briefingIntro: "Sizning proaktiv ertalabki brifingingiz — butun biznes bugun nima qilish kerakligiga jamlangan.",
    templateMode: " (shablon rejimi — AI-sxulosa uchun LLM_API_KEY ni o'rnating)",
    noBriefing: "Sxulosa yo'q.",
    revenueMtd: "Daromad oy boshidan",
    committedToSuppliers: "Yetkazib beruvchilarga majburiyatlar",
    potentialMargin: "Potensial marja",
    newInquiries: "Yangi so'rovlar",
    moveAgedStock: "Qolib ketgan tovarni siljiting — bir bosishda",
    daysOnLot: " kun omborda",
    createPromoAt: "Aksiya yarating, narxi",
    promoCreated: "Aksiya yaratildi — bir soat ichida faollashadi",
    failed: "Bajarilmadi",
    promoHint: "Narx aksiyasini yaratadi (vitrinada chizilgan narx); keyin Marketing avtopiloti uni e'lon qilishni taklif qiladi. Istalgan vaqtda bekor qilish mumkin:",
    promotions: "Aksiyalar",
    commandCenter: "Boshqaruv markazi",
    buyingBrain: "Xarid miyasi",
    agedStock: "Qolib ketgan tovar",
  },
  en: {
    title: "AI Operator",
    briefingIntro: "Your proactive morning briefing — the whole business synthesized into what to do today.",
    templateMode: " (template mode — set LLM_API_KEY for the AI narrative)",
    noBriefing: "No briefing.",
    revenueMtd: "Revenue MTD",
    committedToSuppliers: "Committed to suppliers",
    potentialMargin: "Potential margin",
    newInquiries: "New inquiries",
    moveAgedStock: "Move aged stock — one click",
    daysOnLot: "d on lot",
    createPromoAt: "Create promo at",
    promoCreated: "Promo created — goes live within the hour",
    failed: "Failed",
    promoHint: "Creates a price promotion (storefront strikethrough); Marketing Autopilot will then suggest announcing it. Revert anytime in",
    promotions: "Promotions",
    commandCenter: "Command center",
    buyingBrain: "Buying brain",
    agedStock: "Aged stock",
  },
};

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
  const { locale: uiLocale } = useLocale();
  const t = COPY[uiLocale];
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
      setPromoDone((prev) => ({ ...prev, [m.carId]: res.ok ? t.promoCreated : d.error || t.failed }));
    } catch {
      setPromoDone((prev) => ({ ...prev, [m.carId]: t.failed }));
    } finally {
      setPromoBusy(null);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-semibold text-foreground">{t.title}</h1>
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
        {t.briefingIntro}
        {!ai && !loading && <span className="text-[var(--warning)]">{t.templateMode}</span>}
      </p>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
      ) : (
        <>
          <div className="bg-card border border-border p-5 whitespace-pre-wrap text-sm text-foreground leading-relaxed">
            {briefing || t.noBriefing}
          </div>

          {ctx && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-4">
              {[
                { label: t.revenueMtd, value: "$" + Math.round(ctx.money.revenueMtdUsd).toLocaleString("en-US"), href: "/admin/finance" },
                { label: t.committedToSuppliers, value: "$" + Math.round(ctx.money.committedSupplierUsd).toLocaleString("en-US"), href: "/admin/money" },
                { label: t.potentialMargin, value: "$" + Math.round(ctx.money.potentialMarginUsd).toLocaleString("en-US"), href: "/admin/ledger" },
                { label: t.newInquiries, value: String(ctx.actions.newInquiries), href: "/admin/inquiries" },
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
              <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5"><Tag className="w-4 h-4 text-[var(--accent)]" /> {t.moveAgedStock}</h2>
              <div className="space-y-2">
                {ctx.topMarkdowns.map((m) => {
                  const result = promoDone[m.carId];
                  return (
                    <div key={m.carId} className="bg-card border border-border p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground font-medium truncate">{m.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.daysOnLot}{t.daysOnLot} · <span className="line-through">{usd(m.currentPriceUsd)}</span> → <span className="text-[var(--accent)]">{usd(m.suggestedPriceUsd)}</span> (−{m.markdownPct}%)
                        </p>
                      </div>
                      {result ? (
                        <span className="text-xs text-[var(--success)] inline-flex items-center gap-1 shrink-0"><Check className="w-3.5 h-3.5" />{result.replace("✓ ", "")}</span>
                      ) : (
                        <Button type="button" size="sm" variant="outline" onClick={() => createPromo(m)} disabled={promoBusy === m.carId} className="shrink-0">
                          {promoBusy === m.carId ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Tag className="w-4 h-4" /> {t.createPromoAt} {usd(m.suggestedPriceUsd)}</>}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">{t.promoHint} <Link href="/admin/promotions" className="text-primary hover:underline">{t.promotions}</Link>.</p>
            </div>
          )}

          <div className="flex flex-wrap gap-3 mt-4 text-sm">
            <Link href="/admin/command" className="text-primary hover:underline inline-flex items-center gap-1">{t.commandCenter} <ArrowRight className="w-3.5 h-3.5" /></Link>
            <Link href="/admin/buying" className="text-primary hover:underline inline-flex items-center gap-1">{t.buyingBrain} <ArrowRight className="w-3.5 h-3.5" /></Link>
            <Link href="/admin/aging" className="text-primary hover:underline inline-flex items-center gap-1">{t.agedStock} <ArrowRight className="w-3.5 h-3.5" /></Link>
          </div>
        </>
      )}
    </div>
  );
}
