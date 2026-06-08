"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone, Loader2, Sparkles, Copy, Send, Save, Trash2, Check, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CONTENT_KINDS, contentKindLabel } from "@/lib/marketing-content";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

interface Car { id: string; brand: string; model: string; year: number | null }
interface Draft { id: string; kind: string; locale: string; subject: string | null; body: string; status: string; scheduled_at: string | null; created_at: string }
interface AttrRow { key: string; leads: number; conversions: number; convRate: number }
interface RoiRow { channel: string; leads: number; orders: number; depositsUsd: number; marginUsd: number; spendUsd: number; cpaUsd: number | null; roas: number | null }

const LOCALES = [{ k: "ru", l: "RU" }, { k: "uz", l: "UZ" }, { k: "en", l: "EN" }];
const SOCIAL = new Set(["telegram", "instagram", "facebook", "promo", "ad"]);

const COPY: Record<Locale, {
  title: string;
  autopilot: string;
  intro1: string;
  intro2: string;
  introLink: string;
  pickCar: string;
  enterTopic: string;
  fromTemplate: string;
  generationFailed: string;
  pickSchedule: string;
  scheduled: string;
  savedLibrary: string;
  posted: string;
  couldNotPost: string;
  modeCar: string;
  modeTopic: string;
  selectCar: string;
  topicPlaceholder: string;
  tonePlaceholder: string;
  generate: string;
  outputPlaceholder: string;
  copied: string;
  copy: string;
  save: string;
  postNow: string;
  schedule: string;
  library: string;
  nothingSaved: string;
  published: string;
  use: string;
  whereLeads: string;
  source: string;
  leads: string;
  converted: string;
  convRate: string;
  topCampaigns: string;
  referralsWom: string;
  lead: string;
  leadsPlural: string;
  sold: string;
  tagHint1: string;
  tagHint2: string;
  tagHint3: string;
  channelRoi: string;
  channel: string;
  orders: string;
  deposits: string;
  margin: string;
  spend: string;
  cpa: string;
  roas: string;
  roasHint: string;
}> = {
  ru: {
    title: "Студия контента",
    autopilot: "Автопилот",
    intro1: "Маркетинг с помощью ИИ — посты в соцсети, рекламные тексты, статьи в блог и промо, основанные на вашем реальном складе, на RU / UZ / EN. Создавайте, редактируйте, публикуйте в Telegram-канал или сохраняйте в библиотеку. Не знаете, что опубликовать? Пусть ",
    intro2: " прочитает ваш склад и подскажет.",
    introLink: "Автопилот",
    pickCar: "Сначала выберите авто.",
    enterTopic: "Сначала введите тему.",
    fromTemplate: "Сгенерировано из шаблона (задайте LLM_API_KEY для текста от ИИ).",
    generationFailed: "Не удалось сгенерировать.",
    pickSchedule: "Выберите дату и время для планирования.",
    scheduled: "Запланировано — будет автоматически опубликовано в Telegram в указанное время.",
    savedLibrary: "Сохранено в библиотеку.",
    posted: "Опубликовано в ваш Telegram-канал.",
    couldNotPost: "Не удалось опубликовать.",
    modeCar: "Из авто",
    modeTopic: "Тема",
    selectCar: "Выберите авто…",
    topicPlaceholder: "Тема, напр. «растаможка в Узбекистане 2026»",
    tonePlaceholder: "Тон (необязательно): энергичный, премиальный, лаконичный…",
    generate: "Сгенерировать",
    outputPlaceholder: "Сгенерированный контент появится здесь — редактируйте свободно.",
    copied: "Скопировано",
    copy: "Копировать",
    save: "Сохранить",
    postNow: "Опубликовать сейчас",
    schedule: "Запланировать",
    library: "Библиотека контента",
    nothingSaved: "Пока ничего не сохранено.",
    published: "опубликовано",
    use: "Использовать",
    whereLeads: "Откуда приходят лиды",
    source: "Источник",
    leads: "Лиды",
    converted: "Конверсии",
    convRate: "Конверсия",
    topCampaigns: "Топ-кампании",
    referralsWom: "Рефералы (сарафанное радио)",
    lead: "лид",
    leadsPlural: "лидов",
    sold: "продано",
    tagHint1: "Помечайте ссылки ",
    tagHint2: " для каналов или ",
    tagHint3: " чтобы отслеживать, кто привёл клиента.",
    channelRoi: "ROI каналов (расход → маржа)",
    channel: "Канал",
    orders: "Заказы",
    deposits: "Депозиты",
    margin: "Маржа",
    spend: "Расход",
    cpa: "CPA",
    roas: "ROAS",
    roasHint: "ROAS = реализованная маржа ÷ рекламный расход. Помечайте маркетинговые расходы каналом (Финансы → Расходы), чтобы заполнить расход/CPA/ROAS.",
  },
  uz: {
    title: "Kontent studiyasi",
    autopilot: "Avtopilot",
    intro1: "AI yordamida marketing — ijtimoiy tarmoq postlari, reklama matnlari, blog maqolalari va aksiyalar, sizning haqiqiy omboringizga asoslangan, RU / UZ / EN tillarida. Yarating, tahrirlang, Telegram-kanalingizga joylang yoki kutubxonaga saqlang. Nima joylashni bilmayapsizmi? ",
    intro2: " omboringizni o‘qib, taklif bersin.",
    introLink: "Avtopilot",
    pickCar: "Avval avtomobilni tanlang.",
    enterTopic: "Avval mavzu kiriting.",
    fromTemplate: "Shablondan yaratildi (AI matni uchun LLM_API_KEY ni o‘rnating).",
    generationFailed: "Yaratib bo‘lmadi.",
    pickSchedule: "Rejalashtirish uchun sana va vaqtni tanlang.",
    scheduled: "Rejalashtirildi — belgilangan vaqtda Telegramga avtomatik joylanadi.",
    savedLibrary: "Kutubxonaga saqlandi.",
    posted: "Telegram-kanalingizga joylandi.",
    couldNotPost: "Joylab bo‘lmadi.",
    modeCar: "Avtomobildan",
    modeTopic: "Mavzu",
    selectCar: "Avtomobilni tanlang…",
    topicPlaceholder: "Mavzu, masalan: «O‘zbekistonda bojxona rasmiylashtiruvi 2026»",
    tonePlaceholder: "Ohang (ixtiyoriy): hayajonli, premium, qisqa…",
    generate: "Yaratish",
    outputPlaceholder: "Yaratilgan kontent shu yerda paydo bo‘ladi — erkin tahrirlang.",
    copied: "Nusxalandi",
    copy: "Nusxalash",
    save: "Saqlash",
    postNow: "Hozir joylash",
    schedule: "Rejalashtirish",
    library: "Kontent kutubxonasi",
    nothingSaved: "Hali hech narsa saqlanmagan.",
    published: "joylandi",
    use: "Foydalanish",
    whereLeads: "Lidlar qayerdan keladi",
    source: "Manba",
    leads: "Lidlar",
    converted: "Konversiyalar",
    convRate: "Konversiya",
    topCampaigns: "Eng yaxshi kampaniyalar",
    referralsWom: "Tavsiyalar (og‘zaki targ‘ibot)",
    lead: "lid",
    leadsPlural: "lid",
    sold: "sotildi",
    tagHint1: "Havolalarni ",
    tagHint2: " bilan kanallar uchun yoki ",
    tagHint3: " bilan mijozni kim tavsiya qilganini kuzatish uchun belgilang.",
    channelRoi: "Kanallar ROI (xarajat → marja)",
    channel: "Kanal",
    orders: "Buyurtmalar",
    deposits: "Depozitlar",
    margin: "Marja",
    spend: "Xarajat",
    cpa: "CPA",
    roas: "ROAS",
    roasHint: "ROAS = amalga oshgan marja ÷ reklama xarajati. Marketing xarajatlarini kanal bilan belgilang (Moliya → Xarajatlar), shunda xarajat/CPA/ROAS to‘ldiriladi.",
  },
  en: {
    title: "Content Studio",
    autopilot: "Autopilot",
    intro1: "AI-drafted marketing — social posts, ad copy, blog articles and promos, grounded on your real inventory, in RU / UZ / EN. Generate, edit, post to your Telegram channel, or save to the library. Not sure what to post? Let ",
    intro2: " read your inventory and suggest.",
    introLink: "Autopilot",
    pickCar: "Pick a car first.",
    enterTopic: "Enter a topic first.",
    fromTemplate: "Generated from a template (set LLM_API_KEY for AI copy).",
    generationFailed: "Generation failed.",
    pickSchedule: "Pick a date & time to schedule.",
    scheduled: "Scheduled — it'll auto-post to Telegram at that time.",
    savedLibrary: "Saved to library.",
    posted: "Posted to your Telegram channel.",
    couldNotPost: "Could not post.",
    modeCar: "From a car",
    modeTopic: "Topic",
    selectCar: "Select a car…",
    topicPlaceholder: "Topic, e.g. 'customs clearance in Uzbekistan 2026'",
    tonePlaceholder: "Tone (optional): excited, premium, concise…",
    generate: "Generate",
    outputPlaceholder: "Generated content appears here — edit freely.",
    copied: "Copied",
    copy: "Copy",
    save: "Save",
    postNow: "Post now",
    schedule: "Schedule",
    library: "Content library",
    nothingSaved: "Nothing saved yet.",
    published: "published",
    use: "Use",
    whereLeads: "Where leads come from",
    source: "Source",
    leads: "Leads",
    converted: "Converted",
    convRate: "Conv. rate",
    topCampaigns: "Top campaigns",
    referralsWom: "Referrals (word-of-mouth)",
    lead: "lead",
    leadsPlural: "leads",
    sold: "sold",
    tagHint1: "Tag links with ",
    tagHint2: " for channels, or ",
    tagHint3: " to track who referred a customer.",
    channelRoi: "Channel ROI (spend → margin)",
    channel: "Channel",
    orders: "Orders",
    deposits: "Deposits",
    margin: "Margin",
    spend: "Spend",
    cpa: "CPA",
    roas: "ROAS",
    roasHint: "ROAS = realized margin ÷ ad spend. Tag marketing expenses with a channel (Finance → Expenses) to populate spend/CPA/ROAS.",
  },
};

export default function AdminMarketingPage() {
  const { locale: uiLocale } = useLocale();
  const t = COPY[uiLocale];
  const [cars, setCars] = useState<Car[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [mode, setMode] = useState<"car" | "topic">("car");
  const [carId, setCarId] = useState("");
  const [topic, setTopic] = useState("");
  const [kind, setKind] = useState("telegram");
  const [locale, setLocale] = useState("ru");
  const [tone, setTone] = useState("");
  const [text, setText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [attr, setAttr] = useState<{ bySource: AttrRow[]; byCampaign: AttrRow[]; byReferral: AttrRow[] } | null>(null);
  const [roi, setRoi] = useState<RoiRow[] | null>(null);

  const loadDrafts = useCallback(() => {
    fetch("/api/admin/marketing/drafts").then((r) => r.json()).then((d) => setDrafts(d.drafts || []));
  }, []);
  useEffect(() => {
    fetch("/api/cars?all=true&limit=200").then((r) => r.json()).then((d) => setCars(d.cars || [])).catch(() => {});
    fetch("/api/admin/stats/attribution").then((r) => r.json()).then((d) => { if (d?.ok) setAttr({ bySource: d.bySource || [], byCampaign: d.byCampaign || [], byReferral: d.byReferral || [] }); }).catch(() => {});
    fetch("/api/admin/stats/channel-roi").then((r) => r.json()).then((d) => { if (d?.ok) setRoi(d.channels || []); }).catch(() => {});
    loadDrafts();
  }, [loadDrafts]);

  const generate = async () => {
    if (mode === "car" && !carId) { setNote(t.pickCar); return; }
    if (mode === "topic" && topic.trim().length < 3) { setNote(t.enterTopic); return; }
    setGenerating(true); setNote(null);
    try {
      const res = await fetch("/api/admin/marketing/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, locale, car_id: mode === "car" ? carId : null, topic: mode === "topic" ? topic.trim() : null, tone: tone || null }),
      });
      const d = await res.json();
      if (d.text) { setText(d.text); if (!d.ai) setNote(t.fromTemplate); }
      else setNote(d.error || t.generationFailed);
    } finally { setGenerating(false); }
  };

  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ } };

  const subjectLabel = () => {
    if (mode === "car") { const c = cars.find((x) => x.id === carId); return c ? `${c.brand} ${c.model}${c.year ? ` ${c.year}` : ""}` : null; }
    return topic.trim() || null;
  };

  const save = async (withSchedule = false) => {
    if (!text.trim()) return;
    if (withSchedule && !scheduleAt) { setNote(t.pickSchedule); return; }
    setBusy(true); setNote(null);
    try {
      const res = await fetch("/api/admin/marketing/drafts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, locale, subject: subjectLabel(), car_id: mode === "car" ? carId || null : null, body: text, scheduled_at: withSchedule ? new Date(scheduleAt).toISOString() : null }),
      });
      if (res.ok) { setNote(withSchedule ? t.scheduled : t.savedLibrary); setScheduleAt(""); loadDrafts(); }
    } finally { setBusy(false); }
  };

  const publish = async () => {
    if (!text.trim()) return;
    setBusy(true); setNote(null);
    try {
      const res = await fetch("/api/admin/marketing/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const d = await res.json();
      setNote(d.ok ? t.posted : d.reason || t.couldNotPost);
      if (d.ok) loadDrafts();
    } finally { setBusy(false); }
  };

  const delDraft = async (id: string) => { await fetch(`/api/admin/marketing/drafts?id=${id}`, { method: "DELETE" }); loadDrafts(); };
  const applyDraft = (d: Draft) => { setText(d.body); setKind(d.kind); setLocale(d.locale); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-3">
          <Megaphone className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-semibold text-foreground">{t.title}</h1>
        </div>
        <Link href="/admin/marketing/autopilot" className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-[var(--accent)] hover:underline">
          <Sparkles className="w-4 h-4" /> {t.autopilot}
        </Link>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        {t.intro1}<Link href="/admin/marketing/autopilot" className="text-primary hover:underline">{t.introLink}</Link>{t.intro2}
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Composer */}
        <div className="bg-card border border-border p-4 space-y-3">
          <div className="flex gap-1">
            {(["car", "topic"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`px-3 py-1 text-xs font-mono uppercase rounded-[2px] border ${mode === m ? "border-[var(--accent)] text-primary" : "border-border text-muted-foreground"}`}>{m === "car" ? t.modeCar : t.modeTopic}</button>
            ))}
          </div>
          {mode === "car" ? (
            <select value={carId} onChange={(e) => setCarId(e.target.value)} className="w-full h-11 rounded-[2px] border border-border bg-[var(--bg-3)] px-3 text-sm text-foreground">
              <option value="">{t.selectCar}</option>
              {cars.map((c) => <option key={c.id} value={c.id}>{c.brand} {c.model}{c.year ? ` ${c.year}` : ""}</option>)}
            </select>
          ) : (
            <Input placeholder={t.topicPlaceholder} value={topic} onChange={(e) => setTopic(e.target.value)} className="text-sm" />
          )}
          <div className="grid grid-cols-3 gap-2">
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="h-10 rounded-[2px] border border-border bg-[var(--bg-3)] px-2 text-sm text-foreground col-span-2">
              {CONTENT_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select>
            <select value={locale} onChange={(e) => setLocale(e.target.value)} className="h-10 rounded-[2px] border border-border bg-[var(--bg-3)] px-2 text-sm text-foreground">
              {LOCALES.map((l) => <option key={l.k} value={l.k}>{l.l}</option>)}
            </select>
          </div>
          <Input placeholder={t.tonePlaceholder} value={tone} onChange={(e) => setTone(e.target.value)} className="text-sm" />
          <Button type="button" onClick={generate} disabled={generating} className="w-full">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4" /> {t.generate}</>}
          </Button>
        </div>

        {/* Output */}
        <div className="bg-card border border-border p-4 space-y-3">
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t.outputPlaceholder} rows={12}
            className="w-full rounded-[2px] border border-border bg-[var(--bg-3)] px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[var(--accent)] whitespace-pre-wrap" />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={copy} disabled={!text.trim()}>{copied ? <><Check className="w-4 h-4" /> {t.copied}</> : <><Copy className="w-4 h-4" /> {t.copy}</>}</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => save(false)} disabled={busy || !text.trim()}><Save className="w-4 h-4" /> {t.save}</Button>
            {SOCIAL.has(kind) && (
              <Button type="button" size="sm" onClick={publish} disabled={busy || !text.trim()}><Send className="w-4 h-4" /> {t.postNow}</Button>
            )}
          </div>
          {SOCIAL.has(kind) && (
            <div className="flex items-center gap-2 pt-1 border-t border-border">
              <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <Input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className="text-xs h-9 flex-1" />
              <Button type="button" variant="outline" size="sm" onClick={() => save(true)} disabled={busy || !text.trim() || !scheduleAt}>{t.schedule}</Button>
            </div>
          )}
          {note && <p className="text-xs text-primary">{note}</p>}
        </div>
      </div>

      {/* Library */}
      <h2 className="text-sm font-semibold text-foreground mt-8 mb-2">{t.library}</h2>
      {drafts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.nothingSaved}</p>
      ) : (
        <div className="space-y-2">
          {drafts.map((d) => (
            <div key={d.id} className="bg-card border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono uppercase text-muted-foreground">{contentKindLabel(d.kind, uiLocale)} · {d.locale}</span>
                  {d.subject && <span className="text-foreground truncate">{d.subject}</span>}
                  {d.status === "published" && <span className="text-[10px] font-mono uppercase text-[var(--success)]">{t.published}</span>}
                  {d.status === "draft" && d.scheduled_at && <span className="inline-flex items-center gap-0.5 text-[10px] font-mono uppercase text-[var(--warning)]"><Clock className="w-3 h-3" />{new Date(d.scheduled_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => applyDraft(d)} className="text-xs text-primary hover:underline">{t.use}</button>
                  <button onClick={() => delDraft(d.id)} className="text-muted-foreground hover:text-[var(--danger)] p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">{d.body.slice(0, 200)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Attribution — which channels drive leads & sales */}
      {attr && attr.bySource.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-foreground mb-2">{t.whereLeads}</h2>
          <div className="bg-card border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="px-4 py-2 font-medium">{t.source}</th>
                  <th className="px-4 py-2 font-medium text-right">{t.leads}</th>
                  <th className="px-4 py-2 font-medium text-right">{t.converted}</th>
                  <th className="px-4 py-2 font-medium text-right">{t.convRate}</th>
                </tr>
              </thead>
              <tbody>
                {attr.bySource.map((r) => (
                  <tr key={r.key} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 text-foreground">{r.key}</td>
                    <td className="px-4 py-2 text-right font-mono text-muted-foreground">{r.leads}</td>
                    <td className="px-4 py-2 text-right font-mono text-foreground">{r.conversions}</td>
                    <td className={`px-4 py-2 text-right font-mono ${r.convRate >= 10 ? "text-[var(--success)]" : "text-muted-foreground"}`}>{r.convRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {attr.byCampaign.length > 0 && (
            <p className="text-[11px] text-muted-foreground mt-2">
              {t.topCampaigns}: {attr.byCampaign.slice(0, 6).map((c) => `${c.key} (${c.leads})`).join(" · ")}
            </p>
          )}
          {attr.byReferral.length > 0 && (
            <div className="mt-3">
              <h3 className="text-xs font-semibold text-foreground mb-1">{t.referralsWom}</h3>
              <p className="text-[11px] text-muted-foreground">
                {attr.byReferral.map((r) => `${r.key}: ${r.leads} ${r.leads === 1 ? t.lead : t.leadsPlural}${r.conversions ? `, ${r.conversions} ${t.sold}` : ""}`).join(" · ")}
              </p>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            {t.tagHint1}<code className="text-foreground">?utm_source=…&amp;utm_campaign=…</code>{t.tagHint2}
            <code className="text-foreground">?ref=NAME</code>{t.tagHint3}
          </p>
        </div>
      )}

      {/* Channel ROI — spend vs deposits/margin, CPA, ROAS */}
      {roi && roi.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-foreground mb-2">{t.channelRoi}</h2>
          <div className="bg-card border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="px-4 py-2 font-medium">{t.channel}</th>
                  <th className="px-4 py-2 font-medium text-right">{t.orders}</th>
                  <th className="px-4 py-2 font-medium text-right">{t.deposits}</th>
                  <th className="px-4 py-2 font-medium text-right">{t.margin}</th>
                  <th className="px-4 py-2 font-medium text-right">{t.spend}</th>
                  <th className="px-4 py-2 font-medium text-right">{t.cpa}</th>
                  <th className="px-4 py-2 font-medium text-right">{t.roas}</th>
                </tr>
              </thead>
              <tbody>
                {roi.map((r) => (
                  <tr key={r.channel} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 text-foreground">{r.channel}</td>
                    <td className="px-4 py-2 text-right font-mono text-muted-foreground">{r.orders}</td>
                    <td className="px-4 py-2 text-right font-mono text-muted-foreground">${r.depositsUsd.toLocaleString("en-US")}</td>
                    <td className="px-4 py-2 text-right font-mono text-foreground">${r.marginUsd.toLocaleString("en-US")}</td>
                    <td className="px-4 py-2 text-right font-mono text-muted-foreground">{r.spendUsd ? `$${r.spendUsd.toLocaleString("en-US")}` : "—"}</td>
                    <td className="px-4 py-2 text-right font-mono text-muted-foreground">{r.cpaUsd != null ? `$${r.cpaUsd.toLocaleString("en-US")}` : "—"}</td>
                    <td className={`px-4 py-2 text-right font-mono ${r.roas != null && r.roas >= 1 ? "text-[var(--success)]" : r.roas != null ? "text-[var(--danger,#ef4444)]" : "text-muted-foreground"}`}>{r.roas != null ? `${r.roas}×` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {t.roasHint}
          </p>
        </div>
      )}
    </div>
  );
}
