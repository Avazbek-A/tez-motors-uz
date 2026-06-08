"use client";

import { useEffect, useState } from "react";
import { Save, Globe, Phone, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

const COPY: Record<Locale, {
  loadingSettings: string;
  title: string;
  subtitle: string;
  general: string;
  siteName: string;
  workingHours: string;
  contact: string;
  phoneDisplay: string;
  phoneRaw: string;
  email: string;
  address: string;
  mapLat: string;
  mapLng: string;
  mapTipPrefix: string;
  mapTipSuffix: string;
  social: string;
  telegramUrl: string;
  instagramUrl: string;
  whatsappUrl: string;
  botNote: string;
  saved: string;
  errorLabel: string;
  saveFailed: string;
  networkError: string;
  saving: string;
  saveSettings: string;
}> = {
  ru: {
    loadingSettings: "Загрузка настроек…",
    title: "Настройки",
    subtitle: "Редактируемые настройки сайта. Изменения применяются сразу после сохранения.",
    general: "Общие",
    siteName: "Название сайта",
    workingHours: "Часы работы",
    contact: "Контакты",
    phoneDisplay: "Телефон (отображаемый)",
    phoneRaw: "Телефон (необработанный, для ссылок tel:)",
    email: "Email",
    address: "Адрес",
    mapLat: "Широта карты",
    mapLng: "Долгота карты",
    mapTipPrefix: "Совет: откройте",
    mapTipSuffix:
      ", найдите салон, щёлкните правой кнопкой по метке → «Что здесь?» → скопируйте координаты (широта, долгота).",
    social: "Соцсети",
    telegramUrl: "Ссылка Telegram",
    instagramUrl: "Ссылка Instagram",
    whatsappUrl: "Ссылка WhatsApp",
    botNote:
      "Учётные данные бота уведомлений Telegram настраиваются через секреты Cloudflare Worker, а не здесь.",
    saved: "Сохранено",
    errorLabel: "Ошибка",
    saveFailed: "Не удалось сохранить",
    networkError: "Ошибка сети",
    saving: "Сохранение…",
    saveSettings: "Сохранить настройки",
  },
  uz: {
    loadingSettings: "Sozlamalar yuklanmoqda…",
    title: "Sozlamalar",
    subtitle: "Tahrirlanadigan sayt sozlamalari. O'zgartirishlar saqlangandan so'ng darhol qo'llaniladi.",
    general: "Umumiy",
    siteName: "Sayt nomi",
    workingHours: "Ish vaqti",
    contact: "Aloqa",
    phoneDisplay: "Telefon (ko'rsatiladigan)",
    phoneRaw: "Telefon (xom, tel: havolalari uchun)",
    email: "Email",
    address: "Manzil",
    mapLat: "Xarita kengligi",
    mapLng: "Xarita uzunligi",
    mapTipPrefix: "Maslahat: oching",
    mapTipSuffix:
      ", salonni toping, belgini o'ng tugma bilan bosing → «Bu yer nima?» → koordinatalarni nusxalang (kenglik, uzunlik).",
    social: "Ijtimoiy tarmoqlar",
    telegramUrl: "Telegram havolasi",
    instagramUrl: "Instagram havolasi",
    whatsappUrl: "WhatsApp havolasi",
    botNote:
      "Telegram bildirishnoma boti hisob ma'lumotlari shu yerda emas, Cloudflare Worker maxfiy kalitlari orqali sozlanadi.",
    saved: "Saqlandi",
    errorLabel: "Xato",
    saveFailed: "Saqlab bo'lmadi",
    networkError: "Tarmoq xatosi",
    saving: "Saqlanmoqda…",
    saveSettings: "Sozlamalarni saqlash",
  },
  en: {
    loadingSettings: "Loading settings…",
    title: "Settings",
    subtitle: "Editable site settings. Changes apply immediately after save.",
    general: "General",
    siteName: "Site Name",
    workingHours: "Working Hours",
    contact: "Contact",
    phoneDisplay: "Phone (display)",
    phoneRaw: "Phone (raw, for tel: links)",
    email: "Email",
    address: "Address",
    mapLat: "Map latitude",
    mapLng: "Map longitude",
    mapTipPrefix: "Tip: open",
    mapTipSuffix:
      ", find the showroom, right-click the pin → “What’s here?” → copy coordinates (lat, lng).",
    social: "Social",
    telegramUrl: "Telegram URL",
    instagramUrl: "Instagram URL",
    whatsappUrl: "WhatsApp URL",
    botNote:
      "Telegram notification bot credentials are configured via Cloudflare Worker secrets, not here.",
    saved: "Saved",
    errorLabel: "Error",
    saveFailed: "Save failed",
    networkError: "Network error",
    saving: "Saving…",
    saveSettings: "Save Settings",
  },
};

type Settings = {
  siteName: string;
  phone: string;
  phoneRaw: string;
  email: string;
  address: string;
  workingHours: string;
  telegram: string;
  instagram: string;
  whatsapp: string;
  mapLat: string; // stored as number; UI uses string for empty-state friendliness
  mapLng: string;
};

const EMPTY: Settings = {
  siteName: "", phone: "", phoneRaw: "", email: "", address: "",
  workingHours: "", telegram: "", instagram: "", whatsapp: "",
  mapLat: "", mapLng: "",
};

export default function AdminSettingsPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [settings, setSettings] = useState<Settings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data?.values) {
          const v = data.values;
          setSettings({
            ...EMPTY,
            ...v,
            mapLat: typeof v.mapLat === "number" ? String(v.mapLat) : "",
            mapLng: typeof v.mapLng === "number" ? String(v.mapLng) : "",
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatus("idle");
    setErrorMsg(null);
    try {
      // Coerce lat/lng strings → numbers (or omit if blank). The PUT
      // schema rejects strings on the numeric coords.
      const { mapLat, mapLng, ...rest } = settings;
      const payload: Record<string, unknown> = { ...rest };
      const latNum = parseFloat(mapLat);
      const lngNum = parseFloat(mapLng);
      if (Number.isFinite(latNum)) payload.mapLat = latNum;
      if (Number.isFinite(lngNum)) payload.mapLng = lngNum;

      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setStatus("error");
        setErrorMsg(err?.error ?? t.saveFailed);
      } else {
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 3000);
      }
    } catch {
      setStatus("error");
      setErrorMsg(t.networkError);
    } finally {
      setSaving(false);
    }
  };

  const update = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }));

  if (loading) {
    return <div className="text-sm text-muted-foreground">{t.loadingSettings}</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <p className="text-muted-foreground">{t.subtitle}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            {t.general}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label={t.siteName} value={settings.siteName} onChange={(v) => update({ siteName: v })} />
          <Field label={t.workingHours} value={settings.workingHours} onChange={(v) => update({ workingHours: v })} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            {t.contact}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label={t.phoneDisplay} value={settings.phone} onChange={(v) => update({ phone: v })} placeholder="+998 90 123 45 67" />
          <Field label={t.phoneRaw} value={settings.phoneRaw} onChange={(v) => update({ phoneRaw: v })} placeholder="+998901234567" />
          <Field label={t.email} value={settings.email} onChange={(v) => update({ email: v })} />
          <Field label={t.address} value={settings.address} onChange={(v) => update({ address: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={t.mapLat}
              value={settings.mapLat}
              onChange={(v) => update({ mapLat: v })}
              placeholder="41.2935"
            />
            <Field
              label={t.mapLng}
              value={settings.mapLng}
              onChange={(v) => update({ mapLng: v })}
              placeholder="69.2027"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {t.mapTipPrefix} <a href="https://yandex.com/maps" target="_blank" rel="noreferrer" className="underline">yandex.com/maps</a>{t.mapTipSuffix}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            {t.social}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label={t.telegramUrl} value={settings.telegram} onChange={(v) => update({ telegram: v })} placeholder="https://t.me/..." />
          <Field label={t.instagramUrl} value={settings.instagram} onChange={(v) => update({ instagram: v })} placeholder="https://instagram.com/..." />
          <Field label={t.whatsappUrl} value={settings.whatsapp} onChange={(v) => update({ whatsapp: v })} placeholder="https://wa.me/..." />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground max-w-sm">
          {t.botNote}
        </p>
        <div className="flex items-center gap-3">
          {status === "saved" && <span className="text-sm text-green-400">{t.saved}</span>}
          {status === "error" && <span className="text-sm text-red-400">{errorMsg ?? t.errorLabel}</span>}
          <Button size="lg" onClick={handleSave} disabled={saving}>
            <Save className="w-5 h-5" />
            {saving ? t.saving : t.saveSettings}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field(props: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-sm font-medium mb-1 block">{props.label}</label>
      <Input
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  );
}
