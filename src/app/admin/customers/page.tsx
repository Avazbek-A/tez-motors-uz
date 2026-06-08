"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Contact, Loader2, X, Search, Phone, Mail, Flame } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

interface Row {
  key: string;
  phone: string;
  name: string | null;
  email: string | null;
  sources: string[];
  inquiries: number;
  orders: number;
  conversations: number;
  hasAccount: boolean;
  leadScore: number;
  depositsUsd: number;
  tier: string;
  lastSeen: string | null;
}

type Tier = "vip" | "buyer" | "active" | "lead" | "dormant";

const TIER_TONE: Record<Tier, string> = {
  vip: "text-[var(--accent)] border-[var(--accent)]",
  buyer: "text-[var(--success)] border-[var(--success)]",
  active: "text-[var(--info)] border-[var(--info)]",
  lead: "text-muted-foreground border-border",
  dormant: "text-[var(--danger)] border-[var(--danger)]",
};
const TIER_ORDER: Tier[] = ["vip", "buyer", "active", "lead", "dormant"];

interface TimelineEvent {
  type: string;
  title: string;
  detail?: string;
  at: string;
  link?: string;
}

interface Profile {
  profile: {
    key: string;
    phone: string;
    name: string | null;
    email: string | null;
    hasAccount: boolean;
    leadScore: number;
    tier?: string;
    stats: {
      inquiries: number;
      orders: number;
      conversations: number;
      favorites: number;
      depositsUsd: number;
      depositsUzs: number;
      firstSeen: string | null;
      lastSeen: string | null;
    };
  };
  timeline: TimelineEvent[];
  favorites: { car_id: string; name: string }[];
}

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const fmt = (s: string | null) => {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
  } catch {
    return s;
  }
};
const fmtFull = (s: string) => {
  try {
    return new Date(s).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return s;
  }
};

const EV_TONE: Record<string, string> = {
  inquiry: "border-[var(--info)]",
  order: "border-primary",
  order_event: "border-border",
  payment: "border-[var(--success)]",
  conversation: "border-[var(--warning)]",
  account: "border-border",
};

const COPY: Record<Locale, {
  title: string;
  subtitlePrefix: string;
  subtitleSuffix: string;
  tierLabels: Record<Tier, string>;
  all: string;
  searchPlaceholder: string;
  noContacts: string;
  thCustomer: string;
  thTier: string;
  thInq: string;
  thOrd: string;
  thAi: string;
  thScore: string;
  thDeposits: string;
  thLast: string;
  accountBadge: string;
  unknown: string;
  statInquiries: string;
  statOrders: string;
  statAiChats: string;
  statFavorites: string;
  statDeposits: string;
  statLeadScore: string;
  watching: string;
  activityTimeline: string;
  noActivity: string;
}> = {
  ru: {
    title: "Клиенты",
    subtitlePrefix: "Единая запись по каждому человеку — все запросы, заказы, AI-чаты, депозиты и избранное, связанные по телефону.",
    subtitleSuffix: "контактов.",
    tierLabels: { vip: "VIP", buyer: "Покупатель", active: "Активный", lead: "Лид", dormant: "Спящий" },
    all: "Все",
    searchPlaceholder: "Поиск по имени или телефону…",
    noContacts: "Контакты не найдены.",
    thCustomer: "Клиент",
    thTier: "Уровень",
    thInq: "Зап",
    thOrd: "Зак",
    thAi: "AI",
    thScore: "Балл",
    thDeposits: "Депозиты",
    thLast: "Посл.",
    accountBadge: "аккаунт",
    unknown: "Неизвестно",
    statInquiries: "Запросы",
    statOrders: "Заказы",
    statAiChats: "AI-чаты",
    statFavorites: "Избранное",
    statDeposits: "Депозиты",
    statLeadScore: "Балл лида",
    watching: "Следит за:",
    activityTimeline: "Лента активности",
    noActivity: "Нет активности.",
  },
  uz: {
    title: "Mijozlar",
    subtitlePrefix: "Har bir shaxs uchun yagona yozuv — barcha so‘rovlar, buyurtmalar, AI-suhbatlar, depozitlar va sevimlilar telefon orqali bog‘langan.",
    subtitleSuffix: "ta kontakt.",
    tierLabels: { vip: "VIP", buyer: "Xaridor", active: "Faol", lead: "Lid", dormant: "Uxlayotgan" },
    all: "Hammasi",
    searchPlaceholder: "Ism yoki telefon bo‘yicha qidirish…",
    noContacts: "Kontaktlar topilmadi.",
    thCustomer: "Mijoz",
    thTier: "Daraja",
    thInq: "So‘r",
    thOrd: "Buy",
    thAi: "AI",
    thScore: "Ball",
    thDeposits: "Depozitlar",
    thLast: "Oxirgi",
    accountBadge: "akkaunt",
    unknown: "Noma’lum",
    statInquiries: "So‘rovlar",
    statOrders: "Buyurtmalar",
    statAiChats: "AI-suhbatlar",
    statFavorites: "Sevimlilar",
    statDeposits: "Depozitlar",
    statLeadScore: "Lid bali",
    watching: "Kuzatmoqda:",
    activityTimeline: "Faollik tasmasi",
    noActivity: "Faollik yo‘q.",
  },
  en: {
    title: "Customers",
    subtitlePrefix: "One unified record per person — every inquiry, order, AI chat, deposit and favorite stitched together by phone.",
    subtitleSuffix: "contacts.",
    tierLabels: { vip: "VIP", buyer: "Buyer", active: "Active", lead: "Lead", dormant: "Dormant" },
    all: "All",
    searchPlaceholder: "Search name or phone…",
    noContacts: "No contacts found.",
    thCustomer: "Customer",
    thTier: "Tier",
    thInq: "Inq",
    thOrd: "Ord",
    thAi: "AI",
    thScore: "Score",
    thDeposits: "Deposits",
    thLast: "Last",
    accountBadge: "account",
    unknown: "Unknown",
    statInquiries: "Inquiries",
    statOrders: "Orders",
    statAiChats: "AI chats",
    statFavorites: "Favorites",
    statDeposits: "Deposits",
    statLeadScore: "Lead score",
    watching: "Watching:",
    activityTimeline: "Activity timeline",
    noActivity: "No activity.",
  },
};

export default function AdminCustomersPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [tierCounts, setTierCounts] = useState<Record<string, number>>({});
  const [tier, setTier] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const load = useCallback((query: string, tierKey: string | null) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (tierKey) params.set("tier", tierKey);
    params.set("sort", "tier");
    fetch(`/api/admin/customers?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) {
          setRows(d.customers || []);
          setTotal(d.total || 0);
          if (d.tierCounts) setTierCounts(d.tierCounts);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Debounced search + tier filter.
  useEffect(() => {
    const t = setTimeout(() => load(q.trim(), tier), 350);
    return () => clearTimeout(t);
  }, [q, tier, load]);

  const openProfile = async (key: string) => {
    setLoadingProfile(true);
    setOpen(null);
    try {
      const res = await fetch(`/api/admin/customers/${key}`);
      const d = await res.json();
      if (d?.ok) setOpen(d);
    } finally {
      setLoadingProfile(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-1">
        <Contact className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">{t.title}</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {t.subtitlePrefix} {total} {t.subtitleSuffix}
      </p>

      {/* Value-tier summary + filter */}
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={() => setTier(null)}
          className={`px-2.5 py-1 text-xs font-mono uppercase tracking-wider rounded-[2px] border ${tier === null ? "border-[var(--accent)] text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
        >
          {t.all}
        </button>
        {TIER_ORDER.map((tk) => (
          <button
            key={tk}
            onClick={() => setTier(tier === tk ? null : tk)}
            className={`px-2.5 py-1 text-xs font-mono uppercase tracking-wider rounded-[2px] border ${tier === tk ? TIER_TONE[tk] : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            {t.tierLabels[tk]} {tierCounts[tk] ? <span className="opacity-70">{tierCounts[tk]}</span> : null}
          </button>
        ))}
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchPlaceholder} className="pl-9 text-sm" />
      </div>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.noContacts}</p>
      ) : (
        <div className="bg-card border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-4 py-2 font-medium">{t.thCustomer}</th>
                <th className="px-4 py-2 font-medium">{t.thTier}</th>
                <th className="px-4 py-2 font-medium text-right">{t.thInq}</th>
                <th className="px-4 py-2 font-medium text-right">{t.thOrd}</th>
                <th className="px-4 py-2 font-medium text-right">{t.thAi}</th>
                <th className="px-4 py-2 font-medium text-right">{t.thScore}</th>
                <th className="px-4 py-2 font-medium text-right">{t.thDeposits}</th>
                <th className="px-4 py-2 font-medium">{t.thLast}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} onClick={() => openProfile(r.key)} className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/40">
                  <td className="px-4 py-2.5">
                    <div className="text-foreground">{r.name || "—"}{r.hasAccount && <span className="ml-2 text-[10px] font-mono uppercase text-[var(--success)]">{t.accountBadge}</span>}</div>
                    <div className="text-xs text-muted-foreground font-mono">{r.phone}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    {TIER_TONE[r.tier as Tier] && (
                      <span className={`inline-block text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 border rounded-[2px] ${TIER_TONE[r.tier as Tier]}`}>
                        {t.tierLabels[r.tier as Tier]}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{r.inquiries || ""}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-foreground">{r.orders || ""}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{r.conversations || ""}</td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {r.leadScore > 0 && <span className={`inline-flex items-center gap-0.5 ${r.leadScore >= 60 ? "text-[var(--warning)]" : "text-muted-foreground"}`}>{r.leadScore >= 60 && <Flame className="w-3 h-3" />}{r.leadScore}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-foreground">{r.depositsUsd > 0 ? usd(r.depositsUsd) : ""}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{fmt(r.lastSeen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(open || loadingProfile) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(null)} />
          <div className="relative z-10 w-full max-w-2xl bg-card border border-border p-6 max-h-[90vh] overflow-y-auto">
            {loadingProfile || !open ? (
              <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-foreground">{open.profile.name || t.unknown}</h2>
                      {open.profile.tier && TIER_TONE[open.profile.tier as Tier] && (
                        <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 border rounded-[2px] ${TIER_TONE[open.profile.tier as Tier]}`}>
                          {t.tierLabels[open.profile.tier as Tier]}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-1">
                      <a href={`tel:${open.profile.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Phone className="w-3.5 h-3.5" />{open.profile.phone}</a>
                      {open.profile.email && <a href={`mailto:${open.profile.email}`} className="inline-flex items-center gap-1 hover:underline"><Mail className="w-3.5 h-3.5" />{open.profile.email}</a>}
                    </div>
                  </div>
                  <button onClick={() => setOpen(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-5">
                  {[
                    { label: t.statInquiries, value: String(open.profile.stats.inquiries) },
                    { label: t.statOrders, value: String(open.profile.stats.orders) },
                    { label: t.statAiChats, value: String(open.profile.stats.conversations) },
                    { label: t.statFavorites, value: String(open.profile.stats.favorites) },
                    { label: t.statDeposits, value: open.profile.stats.depositsUsd > 0 ? usd(open.profile.stats.depositsUsd) : "—" },
                    { label: t.statLeadScore, value: String(open.profile.leadScore) },
                  ].map((s) => (
                    <div key={s.label} className="bg-[var(--bg-3)] border border-border p-2 rounded-[2px]">
                      <p className="font-mono text-base font-semibold text-foreground">{s.value}</p>
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>

                {open.favorites.length > 0 && (
                  <p className="text-xs text-muted-foreground mb-4">
                    ❤ {t.watching} {open.favorites.map((f) => f.name).join(", ")}
                  </p>
                )}

                {/* Timeline */}
                <h3 className="text-sm font-semibold text-foreground mb-2">{t.activityTimeline}</h3>
                <div className="space-y-2">
                  {open.timeline.map((e, i) => (
                    <div key={i} className={`border-l-2 pl-3 py-0.5 ${EV_TONE[e.type] || "border-border"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-foreground">
                          {e.link ? <Link href={e.link} className="hover:underline">{e.title}</Link> : e.title}
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap">{fmtFull(e.at)}</span>
                      </div>
                      {e.detail && <p className="text-xs text-muted-foreground">{e.detail}</p>}
                    </div>
                  ))}
                  {open.timeline.length === 0 && <p className="text-sm text-muted-foreground">{t.noActivity}</p>}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
