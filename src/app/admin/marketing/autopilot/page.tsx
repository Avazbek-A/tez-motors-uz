"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Loader2, Wand2, Check, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { contentKindLabel } from "@/lib/marketing-content";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

interface Suggestion {
  key: string;
  priority: number;
  reason: string;
  kind: string;
  locale: string;
  carId: string | null;
  topic: string | null;
  subjectLabel: string;
  tone: string;
}

const LOCALES = [{ k: "ru", l: "RU" }, { k: "uz", l: "UZ" }, { k: "en", l: "EN" }];

const COPY: Record<Locale, {
  back: string;
  title: string;
  refresh: string;
  intro: string;
  draftedAi: string;
  draftedTemplate: string;
  couldNotCreate: string;
  reading: string;
  noSuggestions: string;
  langAria: string;
  drafted: string;
  draftIt: string;
  footer1: string;
  footerLink: string;
  footer2: string;
}> = {
  ru: {
    back: "Студия контента",
    title: "Маркетинговый автопилот",
    refresh: "Обновить",
    intro: "Что стоит опубликовать прямо сейчас — на основе вашего актуального склада: товары, залежавшиеся слишком долго, свежие поступления, модели, о которых постоянно спрашивают, и уже идущие промо. Один клик создаёт черновик текста в библиотеке Студии контента, готовый к проверке и планированию.",
    draftedAi: "Черновик создан с помощью ИИ — проверьте его в библиотеке.",
    draftedTemplate: "Черновик создан из шаблона (задайте LLM_API_KEY для текста от ИИ).",
    couldNotCreate: "Не удалось создать черновик.",
    reading: "Анализируем бизнес…",
    noSuggestions: "Сейчас нет предложений — добавьте товары на склад или зайдите позже.",
    langAria: "Язык",
    drafted: "Черновик создан",
    draftIt: "Создать черновик",
    footer1: "Черновики попадают в библиотеку ",
    footerLink: "Студии контента",
    footer2: ". Отредактируйте, затем опубликуйте сейчас или запланируйте — ничего не публикуется автоматически.",
  },
  uz: {
    back: "Kontent studiyasi",
    title: "Marketing avtopiloti",
    refresh: "Yangilash",
    intro: "Hozir nimani joylash kerakligi — sizning joriy omboringizga asoslangan: juda uzoq turib qolgan tovarlar, yangi kelganlar, doim so‘raladigan modellar va allaqachon ishlab turgan aksiyalar. Bir bosish bilan Kontent studiyasi kutubxonasida matn qoralamasi yaratiladi, ko‘rib chiqish va rejalashtirishga tayyor.",
    draftedAi: "Qoralama AI yordamida yaratildi — uni kutubxonada ko‘rib chiqing.",
    draftedTemplate: "Qoralama shablondan yaratildi (AI matni uchun LLM_API_KEY ni o‘rnating).",
    couldNotCreate: "Qoralamani yaratib bo‘lmadi.",
    reading: "Biznes tahlil qilinmoqda…",
    noSuggestions: "Hozircha takliflar yo‘q — omborga tovar qo‘shing yoki keyinroq qayting.",
    langAria: "Til",
    drafted: "Qoralama tayyor",
    draftIt: "Qoralama yaratish",
    footer1: "Qoralamalar ",
    footerLink: "Kontent studiyasi",
    footer2: " kutubxonasiga tushadi. Tahrirlang, so‘ng hozir joylang yoki rejalashtiring — hech narsa avtomatik joylanmaydi.",
  },
  en: {
    back: "Content Studio",
    title: "Marketing Autopilot",
    refresh: "Refresh",
    intro: "What's worth posting right now — derived from your live inventory: stock that's sitting too long, fresh arrivals, models people keep asking about, and promos already running. One click drafts the copy into your Content Studio library, ready to review and schedule.",
    draftedAi: "Draft created with AI — review it in the library.",
    draftedTemplate: "Draft created from a template (set LLM_API_KEY for AI copy).",
    couldNotCreate: "Could not create the draft.",
    reading: "Reading the business…",
    noSuggestions: "No suggestions right now — add inventory or check back later.",
    langAria: "Language",
    drafted: "Drafted",
    draftIt: "Draft it",
    footer1: "Drafts land in the ",
    footerLink: "Content Studio",
    footer2: " library. Edit, then post now or schedule — nothing publishes automatically.",
  },
};

export default function MarketingAutopilotPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [locales, setLocales] = useState<Record<string, string>>({});
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/marketing/suggestions")
      .then((r) => r.json())
      .then((d) => setSuggestions(d.suggestions || []))
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const draftIt = async (s: Suggestion) => {
    setBusyKey(s.key); setNote(null);
    try {
      const res = await fetch("/api/admin/marketing/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: s.kind,
          locale: locales[s.key] || s.locale,
          car_id: s.carId,
          topic: s.topic,
          tone: s.tone,
          subject: s.subjectLabel,
        }),
      });
      const d = await res.json();
      if (res.ok) {
        setDone((prev) => ({ ...prev, [s.key]: true }));
        setNote(d.ai ? t.draftedAi : t.draftedTemplate);
      } else {
        setNote(d.error || t.couldNotCreate);
      }
    } catch {
      setNote(t.couldNotCreate);
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="max-w-4xl">
      <Link href="/admin/marketing" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary mb-3">
        <ArrowLeft className="w-3.5 h-3.5" /> {t.back}
      </Link>
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-semibold text-foreground">{t.title}</h1>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} {t.refresh}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        {t.intro}
      </p>

      {note && <p className="text-xs text-primary mb-4">{note}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> {t.reading}</div>
      ) : suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.noSuggestions}</p>
      ) : (
        <div className="space-y-2">
          {suggestions.map((s) => (
            <div key={s.key} className="bg-card border border-border p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs mb-1">
                  <span className="font-mono uppercase text-[var(--accent)]">{contentKindLabel(s.kind)}</span>
                  <span className="text-foreground font-medium truncate">{s.subjectLabel}</span>
                </div>
                <p className="text-sm text-muted-foreground">{s.reason}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={locales[s.key] || s.locale}
                  onChange={(e) => setLocales((prev) => ({ ...prev, [s.key]: e.target.value }))}
                  className="h-9 rounded-[2px] border border-border bg-[var(--bg-3)] px-2 text-xs text-foreground"
                  aria-label={t.langAria}
                >
                  {LOCALES.map((l) => <option key={l.k} value={l.k}>{l.l}</option>)}
                </select>
                {done[s.key] ? (
                  <Button type="button" variant="outline" size="sm" disabled><Check className="w-4 h-4" /> {t.drafted}</Button>
                ) : (
                  <Button type="button" size="sm" onClick={() => draftIt(s)} disabled={busyKey === s.key}>
                    {busyKey === s.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Wand2 className="w-4 h-4" /> {t.draftIt}</>}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground mt-6">
        {t.footer1}<Link href="/admin/marketing" className="text-primary hover:underline">{t.footerLink}</Link>{t.footer2}
      </p>
    </div>
  );
}
