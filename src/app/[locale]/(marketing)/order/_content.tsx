"use client";

import { useMemo, useState } from "react";
import { CheckCircle, Loader2, AlertCircle, Clock, Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Turnstile } from "@/components/shared/turnstile";
import { SectionHeading } from "@/components/shared/section-heading";
import { DepositButton } from "@/components/checkout/deposit-button";
import { useLocale } from "@/i18n/locale-context";
import { estimatedMonthlyFrom } from "@/lib/finance";
import type { ModelCatalog } from "@/types/model";

export default function OrderContent({ models }: { models: ModelCatalog[] }) {
  const { locale } = useLocale();
  const t = (ru: string, uz: string, en: string) => (locale === "uz" ? uz : locale === "en" ? en : ru);

  const [selectedId, setSelectedId] = useState<string>(models[0]?.id ?? "");
  const [trim, setTrim] = useState("");
  const [color, setColor] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [website, setWebsite] = useState(""); // honeypot
  const [result, setResult] = useState<{ referenceCode: string | null; phone: string } | null>(null);

  const selected = useMemo(() => models.find((m) => m.id === selectedId) ?? null, [models, selectedId]);

  const localizedDescription = (m: ModelCatalog) =>
    (locale === "uz" ? m.description_uz : locale === "en" ? m.description_en : m.description_ru) ||
    m.description_ru ||
    "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/preorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_id: selected.id,
          name: form.name,
          phone: form.phone,
          email: form.email || undefined,
          trim: trim || undefined,
          color: color || undefined,
          notes: form.notes || undefined,
          locale,
          website,
          turnstile_token: turnstileToken ?? undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || t("Не удалось отправить заказ", "Buyurtma yuborilmadi", "Could not submit order"));
        return;
      }
      setResult({ referenceCode: data.reference_code ?? null, phone: form.phone });
    } catch {
      setError(t("Ошибка сети", "Tarmoq xatosi", "Network error"));
    } finally {
      setLoading(false);
    }
  };

  if (models.length === 0) {
    return (
      <div className="pt-24 pb-16">
        <div className="container-custom max-w-3xl">
          <SectionHeading
            as="h1"
            title={t("Заказ авто под импорт", "Buyurtma asosida import", "Order a car to import")}
            subtitle={t(
              "Пока нет доступных моделей для заказа. Свяжитесь с нами — подберём под вас.",
              "Hozircha buyurtma uchun modellar yo'q. Biz bilan bog'laning.",
              "No orderable models yet. Contact us and we'll source one for you.",
            )}
          />
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="pt-24 pb-16">
        <div className="container-custom max-w-3xl">
          <div className="bg-card rounded-2xl border border-white/10 p-10 text-center space-y-4">
            <CheckCircle className="w-12 h-12 text-neon-green mx-auto" />
            <p className="font-semibold text-lg">
              {t("Заказ принят!", "Buyurtma qabul qilindi!", "Order received!")}
            </p>
            {result.referenceCode && (
              <p className="text-sm text-muted-foreground">
                {t("Номер для отслеживания:", "Kuzatuv raqami:", "Tracking reference:")}{" "}
                <span className="font-mono font-semibold text-foreground">{result.referenceCode}</span>
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {t(
                "Мы свяжемся с вами для подтверждения. Хотите ускорить — внесите депозит онлайн.",
                "Tasdiqlash uchun bog'lanamiz. Tezlashtirish uchun depozit to'lang.",
                "We'll call to confirm. To lock it in, pay a deposit online.",
              )}
            </p>
            {result.referenceCode && (
              <DepositButton referenceCode={result.referenceCode} phone={result.phone} className="max-w-xs mx-auto" />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-16">
      <div className="container-custom max-w-5xl">
        <SectionHeading
          as="h1"
          title={t("Заказ авто под импорт", "Buyurtma asosida import", "Order a car to import")}
          subtitle={t(
            "Выберите модель, комплектацию и цвет — привезём из Китая под заказ.",
            "Model, komplektatsiya va rangni tanlang — buyurtma asosida olib kelamiz.",
            "Pick a model, trim and colour — we'll import it to order.",
          )}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Model picker */}
          <div className="space-y-3">
            {models.map((m) => {
              const active = m.id === selectedId;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(m.id);
                    setTrim("");
                    setColor("");
                  }}
                  className={`w-full text-left rounded-2xl border p-4 transition flex gap-4 ${
                    active ? "border-neon-green bg-neon-green/5" : "border-white/10 bg-card hover:border-white/30"
                  }`}
                >
                  <div className="w-24 h-16 rounded-lg bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                    {m.thumbnail || m.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.thumbnail || m.images[0]} alt={`${m.brand} ${m.model}`} className="w-full h-full object-cover" />
                    ) : (
                      <Car className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">
                      {m.brand} {m.model}
                      {m.year ? ` ${m.year}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {t("Срок", "Muddat", "ETA")} {m.lead_time_weeks_min}–{m.lead_time_weeks_max}{" "}
                      {t("нед.", "hafta", "wks")}
                    </p>
                    {m.base_price_usd ? (
                      <p className="text-sm font-semibold mt-1">
                        {t("от", "dan", "from")} ${m.base_price_usd.toLocaleString()}
                        <span className="text-xs text-muted-foreground font-normal">
                          {" · ~$"}
                          {estimatedMonthlyFrom(m.base_price_usd).toLocaleString()}/{t("мес", "oy", "mo")}
                        </span>
                      </p>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Configurator + form */}
          {selected && (
            <form onSubmit={submit} className="bg-card rounded-2xl border border-white/10 p-6 space-y-4 h-fit">
              <div>
                <p className="font-semibold">
                  {selected.brand} {selected.model}
                  {selected.year ? ` ${selected.year}` : ""}
                </p>
                {localizedDescription(selected) && (
                  <p className="text-sm text-muted-foreground mt-1">{localizedDescription(selected)}</p>
                )}
              </div>

              {selected.trims.length > 0 && (
                <label className="block">
                  <span className="text-xs font-medium block mb-1">{t("Комплектация", "Komplektatsiya", "Trim")}</span>
                  <select
                    value={trim}
                    onChange={(e) => setTrim(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm"
                  >
                    <option value="">{t("Любая", "Istalgan", "Any")}</option>
                    {selected.trims.map((tr) => (
                      <option key={tr} value={tr}>{tr}</option>
                    ))}
                  </select>
                </label>
              )}

              {selected.available_colors.length > 0 && (
                <label className="block">
                  <span className="text-xs font-medium block mb-1">{t("Цвет", "Rang", "Colour")}</span>
                  <select
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm"
                  >
                    <option value="">{t("Любой", "Istalgan", "Any")}</option>
                    {selected.available_colors.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t("Имя", "Ism", "Name")}
                  required
                />
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder={t("Телефон", "Telefon", "Phone")}
                  required
                />
              </div>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder={t("Email (для подтверждения)", "Email (tasdiqlash uchun)", "Email (for confirmation)")}
              />
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder={t("Комментарий", "Izoh", "Notes")}
                rows={3}
              />

              {/* Honeypot — hidden from humans */}
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="hidden"
                aria-hidden="true"
              />

              <Turnstile onToken={setTurnstileToken} />

              {error && (
                <p className="text-sm text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={loading || !form.name || !form.phone}>
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  t("Отправить заказ", "Buyurtma yuborish", "Submit order")
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
