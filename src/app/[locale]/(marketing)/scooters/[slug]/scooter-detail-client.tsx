"use client";

import { useState } from "react";
import { Bike, CheckCircle, Clock, Loader2, Zap, Gauge, BatteryCharging, Weight, Ruler, Users2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { Scooter } from "@/types/scooter";

const L = {
  ru: { escooter: "Электросамокат", ebike: "Электровелосипед", inStock: "В наличии", outOfStock: "Под заказ", motor: "Мотор", battery: "Батарея", range: "Запас хода", speed: "Макс. скорость", load: "Макс. нагрузка", weight: "Вес", wheel: "Колёса", foldable: "Складной", color: "Цвет", yes: "Да", specs: "Характеристики", inquire: "Оставить заявку", name: "Имя", phone: "Телефон", msg: "Сообщение", send: "Отправить", sent: "Заявка отправлена! Менеджер свяжется с вами.", err: "Ошибка. Попробуйте ещё раз." },
  uz: { escooter: "Elektroskuter", ebike: "Elektrovelosiped", inStock: "Mavjud", outOfStock: "Buyurtma asosida", motor: "Motor", battery: "Batareya", range: "Yurish masofasi", speed: "Maks. tezlik", load: "Maks. yuk", weight: "Vazn", wheel: "G'ildiraklar", foldable: "Yig'iladigan", color: "Rang", yes: "Ha", specs: "Xususiyatlar", inquire: "Ariza qoldirish", name: "Ism", phone: "Telefon", msg: "Xabar", send: "Yuborish", sent: "Ariza yuborildi! Menejer bog'lanadi.", err: "Xatolik. Qayta urinib ko'ring." },
  en: { escooter: "E-scooter", ebike: "E-bike", inStock: "In stock", outOfStock: "Made to order", motor: "Motor", battery: "Battery", range: "Range", speed: "Top speed", load: "Max load", weight: "Weight", wheel: "Wheels", foldable: "Foldable", color: "Color", yes: "Yes", specs: "Specs", inquire: "Request a quote", name: "Name", phone: "Phone", msg: "Message", send: "Send", sent: "Sent! A manager will contact you.", err: "Error. Please try again." },
} as const;

export default function ScooterDetailClient({ scooter: s }: { scooter: Scooter }) {
  const { locale } = useLocale();
  const t = L[locale as keyof typeof L] || L.ru;
  const [activeImage, setActiveImage] = useState(s.images[0] || "");
  const [form, setForm] = useState({ name: "", phone: "", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const specs = [
    s.motor_power_w ? { icon: Zap, label: t.motor, value: `${s.motor_power_w} W` } : null,
    s.battery_wh ? { icon: BatteryCharging, label: t.battery, value: `${s.battery_wh} Wh` } : null,
    s.range_km ? { icon: BatteryCharging, label: t.range, value: `${s.range_km} km` } : null,
    s.top_speed_kmh ? { icon: Gauge, label: t.speed, value: `${s.top_speed_kmh} km/h` } : null,
    s.max_load_kg ? { icon: Users2, label: t.load, value: `${s.max_load_kg} kg` } : null,
    s.weight_kg ? { icon: Weight, label: t.weight, value: `${s.weight_kg} kg` } : null,
    s.wheel_size_inch ? { icon: Ruler, label: t.wheel, value: `${s.wheel_size_inch}"` } : null,
    s.foldable ? { icon: CheckCircle, label: t.foldable, value: t.yes } : null,
    s.color ? { icon: CheckCircle, label: t.color, value: s.color } : null,
  ].filter(Boolean) as { icon: typeof Zap; label: string; value: string }[];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          message: form.message || `Интересует ${s.brand} ${s.model}`,
          type: "general",
          source_page: `scooters/${s.slug}`,
          metadata: { vertical: "scooter", scooter_id: s.id, scooter: `${s.brand} ${s.model}` },
        }),
      });
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  };

  const description = locale === "uz" ? s.description_uz : locale === "en" ? s.description_en : s.description_ru;

  return (
    <div className="pt-24 pb-16">
      <div className="container-custom grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Gallery */}
        <div>
          <div className="aspect-video bg-[var(--bg-0)] border border-border overflow-hidden rounded-lg flex items-center justify-center">
            {activeImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={activeImage} alt={`${s.brand} ${s.model}`} className="w-full h-full object-cover" />
            ) : (
              <Bike className="w-16 h-16 text-muted-foreground/40" />
            )}
          </div>
          {s.images.length > 1 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {s.images.map((url) => (
                <button key={url} onClick={() => setActiveImage(url)} className={cn("w-20 h-16 rounded border overflow-hidden", activeImage === url ? "border-primary" : "border-border")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary">{s.kind === "ebike" ? t.ebike : t.escooter}</Badge>
            <span className={cn("inline-flex items-center gap-1 text-xs font-mono", s.stock_qty > 0 ? "text-neon-green" : "text-muted-foreground")}>
              {s.stock_qty > 0 ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              {s.stock_qty > 0 ? t.inStock : t.outOfStock}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white">{s.brand} {s.model}</h1>
          <p className="text-2xl font-bold font-mono mt-3 text-white">{s.price_usd ? `$${s.price_usd.toLocaleString("en-US")}` : "—"}</p>

          {specs.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-medium mb-2 text-white/80">{t.specs}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {specs.map((sp, i) => (
                  <div key={i} className="bg-card border border-border rounded-lg p-3">
                    <sp.icon className="w-4 h-4 text-[var(--accent)] mb-1" />
                    <p className="text-[11px] text-muted-foreground">{sp.label}</p>
                    <p className="text-sm font-medium text-white">{sp.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {description && <p className="mt-6 text-white/70 whitespace-pre-wrap">{description}</p>}

          {/* Inquiry */}
          <form onSubmit={submit} className="mt-8 space-y-3 bg-card border border-border rounded-lg p-4">
            <p className="font-semibold text-white">{t.inquire}</p>
            {status === "sent" ? (
              <p className="text-neon-green text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4" /> {t.sent}</p>
            ) : (
              <>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t.name} required />
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder={t.phone} required />
                <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder={t.msg} rows={3} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
                <Button type="submit" disabled={status === "sending"} className="w-full">
                  {status === "sending" ? <Loader2 className="w-4 h-4 animate-spin" /> : t.send}
                </Button>
                {status === "error" && <p className="text-xs text-[var(--danger,#e11)]">{t.err}</p>}
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
