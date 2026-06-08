"use client";

import { useEffect, useState } from "react";
import { Building2, Loader2, Plus } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

const COPY: Record<Locale, {
  title: string;
  modePrefix: string;
  on: string;
  off: string;
  modeOn: string;
  modeOff: string;
  slugPlaceholder: string;
  namePlaceholder: string;
  hostPlaceholder: string;
  addTenant: string;
  createFailed: string;
  loading: string;
  thSlug: string;
  thName: string;
  thHost: string;
  thStatus: string;
  default: string;
  suspend: string;
  activate: string;
}> = {
  ru: {
    title: "Арендаторы",
    modePrefix: "Мультиарендный режим",
    on: "ВКЛ",
    off: "ВЫКЛ",
    modeOn: "Запросы сопоставляются с арендатором по поддомену; чтение витрины ограничено областью.",
    modeOff:
      "Режим одного дилера — каждый запрос разрешается в арендатора по умолчанию, а ограничение области витрины не действует. Создавайте арендаторов здесь; включайте флаг только после полного ограничения области уровня данных (см. docs/MULTI_TENANT.md).",
    slugPlaceholder: "слаг (поддомен)",
    namePlaceholder: "Название дилера",
    hostPlaceholder: "основной хост (необязательно)",
    addTenant: "Добавить арендатора",
    createFailed: "Не удалось создать арендатора",
    loading: "Загрузка…",
    thSlug: "Слаг",
    thName: "Название",
    thHost: "Хост",
    thStatus: "Статус",
    default: "по умолчанию",
    suspend: "Приостановить",
    activate: "Активировать",
  },
  uz: {
    title: "Ijarachilar",
    modePrefix: "Ko'p ijarachi rejimi",
    on: "YOQILGAN",
    off: "O'CHIRILGAN",
    modeOn: "So'rovlar subdomen bo'yicha ijarachiga moslanadi; vitrina o'qishlari doiraga cheklangan.",
    modeOff:
      "Yagona diler rejimi — har bir so'rov standart ijarachiga hal qilinadi va vitrina doirasini cheklash ishlamaydi. Ijarachilarni shu yerda yarating; bayroqni faqat ma'lumotlar qatlami to'liq doiralangandan keyin yoqing (docs/MULTI_TENANT.md ga qarang).",
    slugPlaceholder: "slug (subdomen)",
    namePlaceholder: "Diler nomi",
    hostPlaceholder: "asosiy host (ixtiyoriy)",
    addTenant: "Ijarachi qo'shish",
    createFailed: "Ijarachini yaratib bo'lmadi",
    loading: "Yuklanmoqda…",
    thSlug: "Slug",
    thName: "Nomi",
    thHost: "Host",
    thStatus: "Holat",
    default: "standart",
    suspend: "To'xtatish",
    activate: "Faollashtirish",
  },
  en: {
    title: "Tenants",
    modePrefix: "Multi-tenant mode is",
    on: "ON",
    off: "OFF",
    modeOn: "Requests resolve to a tenant by subdomain; storefront reads are scoped.",
    modeOff:
      "Single-dealer mode — every request resolves to the default tenant and storefront scoping is a no-op. Provision tenants here; turn the flag on only after the data plane is fully scoped (see docs/MULTI_TENANT.md).",
    slugPlaceholder: "slug (subdomain)",
    namePlaceholder: "Dealer name",
    hostPlaceholder: "primary host (optional)",
    addTenant: "Add tenant",
    createFailed: "Failed to create tenant",
    loading: "Loading…",
    thSlug: "Slug",
    thName: "Name",
    thHost: "Host",
    thStatus: "Status",
    default: "default",
    suspend: "Suspend",
    activate: "Activate",
  },
};

interface Tenant {
  id: string;
  slug: string;
  name: string;
  primary_host: string | null;
  status: string;
  created_at: string;
}

export default function AdminTenantsPage() {
  const { locale } = useLocale();
  const tx = COPY[locale];
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [defaultId, setDefaultId] = useState("");
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tenants");
      const data = await res.json();
      setTenants(data.tenants || []);
      setEnabled(!!data.enabled);
      setDefaultId(data.defaultId || "");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: slug.trim().toLowerCase(), name: name.trim(), primary_host: host.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || tx.createFailed);
        return;
      }
      setSlug("");
      setName("");
      setHost("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: string) {
    await fetch("/api/admin/tenants", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setTenants((t) => t.map((x) => (x.id === id ? { ...x, status } : x)));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Building2 className="h-5 w-5 text-lime" />
        <h1 className="text-xl font-bold">{tx.title}</h1>
      </div>

      <div className={`rounded-lg border p-3 text-sm ${enabled ? "border-lime/40 bg-lime/10" : "border-white/10 bg-white/5 text-white/60"}`}>
        {tx.modePrefix} <strong>{enabled ? tx.on : tx.off}</strong>.{" "}
        {enabled ? tx.modeOn : tx.modeOff}
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-white/10 bg-white/5 p-4">
        <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={tx.slugPlaceholder} className="rounded border border-white/15 bg-black/20 px-3 py-2 text-sm" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tx.namePlaceholder} className="rounded border border-white/15 bg-black/20 px-3 py-2 text-sm" />
        <input value={host} onChange={(e) => setHost(e.target.value)} placeholder={tx.hostPlaceholder} className="rounded border border-white/15 bg-black/20 px-3 py-2 text-sm" />
        <button onClick={create} disabled={saving || slug.trim().length < 2 || name.trim().length < 1} className="inline-flex items-center gap-1 rounded bg-lime px-3 py-2 text-sm font-medium text-navy disabled:opacity-50">
          <Plus className="h-4 w-4" /> {tx.addTenant}
        </button>
        {err && <span className="text-sm text-red-400">{err}</span>}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-white/60"><Loader2 className="h-4 w-4 animate-spin" /> {tx.loading}</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase text-white/50">
              <tr><th className="px-3 py-2">{tx.thSlug}</th><th className="px-3 py-2">{tx.thName}</th><th className="px-3 py-2">{tx.thHost}</th><th className="px-3 py-2">{tx.thStatus}</th><th className="px-3 py-2"></th></tr>
            </thead>
            <tbody>
              {tenants.map((t) => {
                const isDefault = t.id === defaultId;
                return (
                  <tr key={t.id} className="border-t border-white/5">
                    <td className="px-3 py-2 font-mono">{t.slug}{isDefault && <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">{tx.default}</span>}</td>
                    <td className="px-3 py-2">{t.name}</td>
                    <td className="px-3 py-2 text-white/60">{t.primary_host || "—"}</td>
                    <td className="px-3 py-2">
                      <span className={t.status === "active" ? "text-lime" : "text-red-400"}>{t.status}</span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!isDefault && (
                        <button onClick={() => setStatus(t.id, t.status === "active" ? "suspended" : "active")} className="rounded border border-white/15 px-2 py-1 text-xs hover:bg-white/10">
                          {t.status === "active" ? tx.suspend : tx.activate}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
