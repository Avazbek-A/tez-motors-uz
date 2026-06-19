"use client";

import { useState } from "react";
import { CheckCircle, Loader2, Upload, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Turnstile } from "@/components/shared/turnstile";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";

/**
 * Shared trade-in lead form. Uploads photos to the hardened public
 * /api/trade-in/upload route (Turnstile + KV rate-limit + file caps), then
 * creates a `trade_in` lead via /api/inquiry (lead scoring + Telegram alert).
 *
 * Reused by /sell-your-car and the /showroom portal — `sourcePage` tags the
 * lead's attribution so the dealer knows where it came from.
 */
export const TRADE_IN_COPY: Record<Locale, {
  title: string; subtitle: string; sent: string; name: string; phone: string; make: string;
  model: string; year: string; mileage: string; condition: string; submit: string;
  photosSelected: (n: number) => string; addPhotos: string;
  uploadFailed: string; failed: string; network: string;
}> = {
  ru: {
    title: "Продать автомобиль", subtitle: "Пришлите данные авто и фото — мы оценим его для трейд-ина.",
    sent: "Заявка успешно отправлена", name: "Имя", phone: "Телефон", make: "Марка", model: "Модель",
    year: "Год", mileage: "Пробег", condition: "Состояние", submit: "Отправить на трейд-ин",
    photosSelected: (n) => `Выбрано фото: ${n}`, addPhotos: "Добавьте до 4 фото",
    uploadFailed: "Не удалось загрузить фото", failed: "Не удалось отправить заявку", network: "Ошибка сети",
  },
  uz: {
    title: "Avtomobilni sotish", subtitle: "Avto ma'lumotlari va rasmlarini yuboring — treyd-in uchun baholaymiz.",
    sent: "So'rov muvaffaqiyatli yuborildi", name: "Ism", phone: "Telefon", make: "Marka", model: "Model",
    year: "Yil", mileage: "Yurgan masofa", condition: "Holati", submit: "Treyd-inga yuborish",
    photosSelected: (n) => `Tanlangan rasmlar: ${n}`, addPhotos: "4 tagacha rasm qo'shing",
    uploadFailed: "Rasmlarni yuklab bo'lmadi", failed: "So'rovni yuborib bo'lmadi", network: "Tarmoq xatosi",
  },
  en: {
    title: "Sell your car", subtitle: "Send us your car details and photos for a trade-in estimate.",
    sent: "Request sent successfully", name: "Name", phone: "Phone", make: "Make", model: "Model",
    year: "Year", mileage: "Mileage", condition: "Condition", submit: "Submit trade-in",
    photosSelected: (n) => `${n} photo(s) selected`, addPhotos: "Add up to 4 photos",
    uploadFailed: "Photo upload failed", failed: "Failed to submit request", network: "Network error",
  },
};

export function TradeInForm({
  sourcePage = "sell-your-car",
  className,
}: {
  /** Tags the lead's `source_page` for attribution. */
  sourcePage?: string;
  className?: string;
}) {
  const { locale } = useLocale();
  const t = TRADE_IN_COPY[locale];
  const [form, setForm] = useState({ name: "", phone: "", make: "", model: "", year: "", mileage: "", condition: "" });
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let photoUrls: string[] = [];
      // Photos are optional — only hit the upload route when the user added some.
      if (files.length > 0) {
        const fd = new FormData();
        fd.append("turnstile_token", turnstileToken ?? "");
        files.forEach((file) => fd.append("files", file));
        const uploadRes = await fetch("/api/trade-in/upload", { method: "POST", body: fd });
        const uploadData = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok) {
          setError(uploadData.error || t.uploadFailed);
          return;
        }
        photoUrls = uploadData.urls || [];
      }

      const inquiryRes = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          type: "trade_in",
          source_page: sourcePage,
          locale,
          message: `${form.make} ${form.model} ${form.year}, mileage: ${form.mileage}, condition: ${form.condition}`,
          metadata: { photos: photoUrls, make: form.make, model: form.model, year: form.year, mileage: form.mileage, condition: form.condition },
          turnstile_token: turnstileToken ?? undefined,
        }),
      });
      if (!inquiryRes.ok) {
        const data = await inquiryRes.json().catch(() => ({}));
        setError(data.error || t.failed);
        return;
      }
      setSuccess(true);
      setFiles([]);
      setForm({ name: "", phone: "", make: "", model: "", year: "", mileage: "", condition: "" });
      setTimeout(() => setSuccess(false), 4000);
    } catch {
      setError(t.network);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className={`bg-card rounded-2xl border border-border p-10 text-center ${className ?? ""}`}>
        <CheckCircle className="w-12 h-12 text-neon-green mx-auto mb-3" />
        <p className="font-semibold">{t.sent}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={`bg-card rounded-2xl border border-border p-6 space-y-4 ${className ?? ""}`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t.name} required />
        <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder={t.phone} required />
        <Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder={t.make} required />
        <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder={t.model} required />
        <Input value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder={t.year} type="number" required />
        <Input value={form.mileage} onChange={(e) => setForm({ ...form, mileage: e.target.value })} placeholder={t.mileage} type="number" />
      </div>
      <Textarea value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} placeholder={t.condition} rows={4} />
      <label className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-6 cursor-pointer text-sm text-muted-foreground">
        <Upload className="w-4 h-4" />
        {files.length ? t.photosSelected(files.length) : t.addPhotos}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 4))}
        />
      </label>
      <Turnstile onToken={setTurnstileToken} />
      {error && (
        <p className="text-sm text-neon-pink flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" />{error}
        </p>
      )}
      <Button type="submit" className="w-full h-auto min-h-11 whitespace-normal py-2.5 leading-snug text-center" disabled={loading}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t.submit}
      </Button>
    </form>
  );
}
