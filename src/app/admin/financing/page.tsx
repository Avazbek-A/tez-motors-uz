"use client";

import { useEffect, useState } from "react";
import { Landmark, ShieldCheck, Loader2 } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

interface App {
  id: string;
  customer_name: string;
  customer_phone: string;
  down_pct: number | null;
  term_months: number | null;
  estimated_monthly: number | null;
  employment: string | null;
  income_band: string | null;
  status: string;
  created_at: string;
}
interface InsLead {
  id: string;
  customer_name: string | null;
  customer_phone: string;
  type: string;
  estimated_premium_usd: number | null;
  status: string;
  created_at: string;
}

const APP_STATUSES = ["new", "submitted", "approved", "declined"];
const INS_STATUSES = ["new", "contacted", "bound", "lost"];

const COPY: Record<Locale, {
  loading: string;
  financingTitle: string;
  noApplications: string;
  colCustomer: string;
  colTerms: string;
  colEmployment: string;
  colStatus: string;
  months: (n: number) => string;
  downPct: (pct: number) => string;
  perMonth: (amount: number) => string;
  insuranceTitle: string;
  noInsuranceLeads: string;
  colType: string;
  colEstPremium: string;
  perYear: (amount: number) => string;
  appStatus: Record<string, string>;
  insStatus: Record<string, string>;
}> = {
  ru: {
    loading: "Загрузка…",
    financingTitle: "Заявки на финансирование",
    noApplications: "Заявок пока нет.",
    colCustomer: "Клиент",
    colTerms: "Условия",
    colEmployment: "Занятость",
    colStatus: "Статус",
    months: (n) => `${n} мес`,
    downPct: (pct) => ` · ${pct}% перв. взнос`,
    perMonth: (amount) => ` · ~$${amount}/мес`,
    insuranceTitle: "Заявки на страхование",
    noInsuranceLeads: "Заявок на страхование пока нет.",
    colType: "Тип",
    colEstPremium: "Оценка премии",
    perYear: (amount) => `$${amount}/год`,
    appStatus: { new: "новая", submitted: "подана", approved: "одобрена", declined: "отклонена" },
    insStatus: { new: "новая", contacted: "связались", bound: "оформлена", lost: "потеряна" },
  },
  uz: {
    loading: "Yuklanmoqda…",
    financingTitle: "Moliyalashtirish arizalari",
    noApplications: "Hozircha arizalar yo'q.",
    colCustomer: "Mijoz",
    colTerms: "Shartlar",
    colEmployment: "Bandlik",
    colStatus: "Holat",
    months: (n) => `${n} oy`,
    downPct: (pct) => ` · ${pct}% boshlang'ich`,
    perMonth: (amount) => ` · ~$${amount}/oy`,
    insuranceTitle: "Sug'urta arizalari",
    noInsuranceLeads: "Hozircha sug'urta arizalari yo'q.",
    colType: "Turi",
    colEstPremium: "Mukofot bahosi",
    perYear: (amount) => `$${amount}/yil`,
    appStatus: { new: "yangi", submitted: "topshirilgan", approved: "tasdiqlangan", declined: "rad etilgan" },
    insStatus: { new: "yangi", contacted: "bog'lanildi", bound: "rasmiylashtirilgan", lost: "yo'qotilgan" },
  },
  en: {
    loading: "Loading…",
    financingTitle: "Financing applications",
    noApplications: "No applications yet.",
    colCustomer: "Customer",
    colTerms: "Terms",
    colEmployment: "Employment",
    colStatus: "Status",
    months: (n) => `${n} mo`,
    downPct: (pct) => ` · ${pct}% down`,
    perMonth: (amount) => ` · ~$${amount}/mo`,
    insuranceTitle: "Insurance leads",
    noInsuranceLeads: "No insurance leads yet.",
    colType: "Type",
    colEstPremium: "Est. premium",
    perYear: (amount) => `$${amount}/yr`,
    appStatus: { new: "new", submitted: "submitted", approved: "approved", declined: "declined" },
    insStatus: { new: "new", contacted: "contacted", bound: "bound", lost: "lost" },
  },
};

export default function AdminFinancingPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [apps, setApps] = useState<App[]>([]);
  const [ins, setIns] = useState<InsLead[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/financing");
      const data = await res.json();
      setApps(data.applications || []);
      setIns(data.insurance || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function setStatus(kind: "financing" | "insurance", id: string, status: string) {
    await fetch("/api/admin/financing", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, id, status }),
    });
    if (kind === "financing") setApps((a) => a.map((x) => (x.id === id ? { ...x, status } : x)));
    else setIns((a) => a.map((x) => (x.id === id ? { ...x, status } : x)));
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-white/60">
        <Loader2 className="h-4 w-4 animate-spin" /> {t.loading}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-lime" />
          <h1 className="text-xl font-bold">{t.financingTitle}</h1>
        </div>
        {apps.length === 0 ? (
          <p className="text-white/50 text-sm">{t.noApplications}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase text-white/50">
                <tr><th className="px-3 py-2">{t.colCustomer}</th><th className="px-3 py-2">{t.colTerms}</th><th className="px-3 py-2">{t.colEmployment}</th><th className="px-3 py-2">{t.colStatus}</th></tr>
              </thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.id} className="border-t border-white/5">
                    <td className="px-3 py-2"><div className="font-medium">{a.customer_name}</div><div className="text-white/50">{a.customer_phone}</div></td>
                    <td className="px-3 py-2 text-white/70">
                      {a.term_months ? t.months(a.term_months) : "—"}{a.down_pct != null ? t.downPct(a.down_pct) : ""}{a.estimated_monthly ? t.perMonth(Math.round(a.estimated_monthly)) : ""}
                    </td>
                    <td className="px-3 py-2 text-white/60">{a.employment || "—"}{a.income_band ? ` · ${a.income_band}` : ""}</td>
                    <td className="px-3 py-2">
                      <select value={a.status} onChange={(e) => setStatus("financing", a.id, e.target.value)} className="rounded border border-white/15 bg-black/20 px-2 py-1 text-xs">
                        {APP_STATUSES.map((s) => <option key={s} value={s}>{t.appStatus[s] ?? s}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-lime" />
          <h2 className="text-lg font-bold">{t.insuranceTitle}</h2>
        </div>
        {ins.length === 0 ? (
          <p className="text-white/50 text-sm">{t.noInsuranceLeads}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase text-white/50">
                <tr><th className="px-3 py-2">{t.colCustomer}</th><th className="px-3 py-2">{t.colType}</th><th className="px-3 py-2">{t.colEstPremium}</th><th className="px-3 py-2">{t.colStatus}</th></tr>
              </thead>
              <tbody>
                {ins.map((l) => (
                  <tr key={l.id} className="border-t border-white/5">
                    <td className="px-3 py-2"><div className="font-medium">{l.customer_name || "—"}</div><div className="text-white/50">{l.customer_phone}</div></td>
                    <td className="px-3 py-2 uppercase text-white/70">{l.type}</td>
                    <td className="px-3 py-2 text-white/70">{l.estimated_premium_usd ? t.perYear(Math.round(l.estimated_premium_usd)) : "—"}</td>
                    <td className="px-3 py-2">
                      <select value={l.status} onChange={(e) => setStatus("insurance", l.id, e.target.value)} className="rounded border border-white/15 bg-black/20 px-2 py-1 text-xs">
                        {INS_STATUSES.map((s) => <option key={s} value={s}>{t.insStatus[s] ?? s}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
