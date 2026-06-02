"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, LogOut, Heart, Search, Package, Phone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/shared/section-heading";
import { Turnstile } from "@/components/shared/turnstile";
import { PushManager } from "@/components/account/push-manager";
import { CarCard } from "@/components/catalog/car-card";
import { useLocale } from "@/i18n/locale-context";
import { localizedPath } from "@/lib/locale-path";
import { getFavoriteIds } from "@/lib/favorites";
import { warrantyStatus } from "@/lib/warranty";
import type { Car } from "@/types/car";

interface SavedSearch {
  id: string;
  label: string | null;
  filters: Record<string, unknown>;
  created_at: string;
}
interface OrderRow {
  id: string;
  reference_code: string;
  status: string;
  created_at: string;
  cars: { brand: string; model: string; year: number; slug: string } | { brand: string; model: string; year: number; slug: string }[] | null;
}
interface WarrantyRow {
  car_label: string;
  warranty_until: string | null;
  warranty_months: number;
  services: { date: string; description: string; cost_usd?: number | null }[];
}
interface Me {
  authenticated: boolean;
  customer?: { id: string; phone: string; name: string | null; locale: string };
  favorite_ids?: string[];
  saved_searches?: SavedSearch[];
  orders?: OrderRow[];
  warranties?: WarrantyRow[];
}

export default function AccountPage() {
  const { locale } = useLocale();
  const t = (ru: string, uz: string, en: string) =>
    locale === "uz" ? uz : locale === "en" ? en : ru;

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Me | null>(null);

  // login state
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // garage
  const [cars, setCars] = useState<Car[]>([]);

  const loadMe = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/account/me", { cache: "no-store" });
      const data: Me = await res.json();
      setMe(data);
      if (data.authenticated) {
        // One-time merge of any anonymous localStorage favorites into the account.
        const localIds = getFavoriteIds();
        const serverIds = data.favorite_ids || [];
        const missing = localIds.filter((id) => !serverIds.includes(id));
        if (missing.length > 0) {
          await fetch("/api/account/favorites", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ car_ids: missing }),
          }).catch(() => {});
        }
        const allIds = Array.from(new Set([...serverIds, ...localIds]));
        if (allIds.length > 0) {
          const carRes = await fetch(`/api/cars?ids=${allIds.join(",")}`);
          const carData = await carRes.json();
          setCars(carData.cars || []);
        } else {
          setCars([]);
        }
      }
    } catch {
      setMe({ authenticated: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const requestOtp = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, locale, turnstile_token: turnstileToken ?? undefined }),
      });
      if (res.ok) {
        setStep("code");
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || t("Не удалось отправить код", "Kod yuborilmadi", "Failed to send code"));
      }
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code, name: name || undefined, locale }),
      });
      if (res.ok) {
        setStep("phone");
        setCode("");
        await loadMe();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || t("Неверный код", "Noto'g'ri kod", "Incorrect code"));
      }
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await fetch("/api/account/logout", { method: "POST" }).catch(() => {});
    setMe({ authenticated: false });
    setCars([]);
  };

  const removeSearch = async (id: string) => {
    await fetch(`/api/account/saved-searches?id=${id}`, { method: "DELETE" }).catch(() => {});
    setMe((prev) =>
      prev ? { ...prev, saved_searches: (prev.saved_searches || []).filter((s) => s.id !== id) } : prev,
    );
  };

  if (loading) {
    return (
      <div className="pt-24 pb-16">
        <div className="container-custom py-20 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // ---- Not logged in: phone + OTP ----
  if (!me?.authenticated) {
    return (
      <div className="pt-24 pb-16">
        <div className="container-custom">
          <SectionHeading
            as="h1"
            title={t("Вход в кабинет", "Kabinetga kirish", "Sign in")}
            subtitle={t(
              "Войдите по номеру телефона, чтобы сохранить гараж и отслеживать заказы.",
              "Garaj va buyurtmalarni saqlash uchun telefon raqami orqali kiring.",
              "Sign in with your phone to save your garage and track orders.",
            )}
          />
          <div className="mx-auto max-w-md space-y-4 border border-border bg-card p-6 shadow-sm">
            {step === "phone" ? (
              <>
                <label className="block text-sm font-medium text-white/70">
                  {t("Номер телефона", "Telefon raqami", "Phone number")}
                </label>
                <Input
                  type="tel"
                  placeholder="+998 90 123 45 67"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <label className="block text-sm font-medium text-white/70">
                  {t("Имя (необязательно)", "Ism (ixtiyoriy)", "Name (optional)")}
                </label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
                <Turnstile onToken={setTurnstileToken} />
                {error && <p className="text-sm text-neon-pink">{error}</p>}
                <Button onClick={requestOtp} className="w-full" disabled={busy || phone.length < 7}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("Получить код", "Kod olish", "Get code")}
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-white/60">
                  {t("Мы отправили код на", "Kod yuborildi:", "We sent a code to")} {phone}
                </p>
                <Input
                  inputMode="numeric"
                  placeholder="______"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
                {error && <p className="text-sm text-neon-pink">{error}</p>}
                <Button onClick={verifyOtp} className="w-full" disabled={busy || code.length !== 6}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("Войти", "Kirish", "Sign in")}
                </Button>
                <button
                  className="w-full text-center text-sm text-white/50 hover:text-white/80"
                  onClick={() => {
                    setStep("phone");
                    setError(null);
                  }}
                >
                  {t("Изменить номер", "Raqamni o'zgartirish", "Change number")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---- Logged in: portal ----
  const orders = me.orders || [];
  const searches = me.saved_searches || [];
  const warranties = me.warranties || [];
  const nowMs = Date.now();

  return (
    <div className="pt-24 pb-16">
      <div className="container-custom space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <SectionHeading
            as="h1"
            title={t("Личный кабинет", "Shaxsiy kabinet", "My account")}
            subtitle={me.customer?.name || me.customer?.phone}
          />
          <div className="flex items-center gap-2">
            <PushManager />
            <Button variant="outline" size="sm" onClick={logout} className="gap-2">
              <LogOut className="h-4 w-4" />
              {t("Выйти", "Chiqish", "Log out")}
            </Button>
          </div>
        </div>

        {/* Orders */}
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Package className="h-5 w-5 text-muted-foreground" />
            {t("Мои заказы", "Buyurtmalarim", "My orders")}
          </h2>
          {orders.length === 0 ? (
            <p className="text-sm text-white/50">{t("Заказов пока нет.", "Hozircha buyurtmalar yo'q.", "No orders yet.")}</p>
          ) : (
            <div className="space-y-3">
              {orders.map((o) => {
                const car = Array.isArray(o.cars) ? o.cars[0] : o.cars;
                return (
                  <div
                    key={o.id}
                    className="flex flex-wrap items-center justify-between gap-3 border border-border bg-card p-4"
                  >
                    <div>
                      <p className="font-medium">
                        {car ? `${car.brand} ${car.model} ${car.year}` : t("Заказ", "Buyurtma", "Order")}
                      </p>
                      <p className="font-mono text-sm text-white/50">#{o.reference_code}</p>
                    </div>
                    <Link
                      href={localizedPath(locale, "/track")}
                      className="text-sm text-primary hover:underline"
                    >
                      {t("Отследить", "Kuzatish", "Track")} →
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Warranties */}
        {warranties.length > 0 && (
          <section className="space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ShieldCheck className="h-5 w-5 text-muted-foreground" />
              {t("Гарантия и обслуживание", "Kafolat va xizmat", "Warranty & service")}
            </h2>
            <div className="space-y-3">
              {warranties.map((w, i) => {
                const st = warrantyStatus(w.warranty_until, nowMs);
                const stLabel = st === "active" ? t("действует", "amal qiladi", "active") : st === "expiring" ? t("истекает", "tugayapti", "expiring") : st === "expired" ? t("истекла", "tugagan", "expired") : "—";
                const tone = st === "active" ? "text-[var(--success)]" : st === "expiring" ? "text-[var(--warning)]" : "text-white/50";
                return (
                  <div key={i} className="border border-border bg-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{w.car_label}</p>
                      <span className={`text-xs font-mono uppercase ${tone}`}>{stLabel}{w.warranty_until ? ` · ${w.warranty_until}` : ""}</span>
                    </div>
                    {w.services && w.services.length > 0 && (
                      <ul className="mt-2 space-y-1 text-sm text-white/60">
                        {w.services.slice(0, 5).map((s, j) => (
                          <li key={j}>• {s.date} — {s.description}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Garage */}
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Heart className="h-5 w-5 text-muted-foreground" />
            {t("Мой гараж", "Mening garajim", "My garage")}
          </h2>
          {cars.length === 0 ? (
            <p className="text-sm text-white/50">
              {t("В избранном пока пусто.", "Sevimlilar bo'sh.", "No favorites yet.")}{" "}
              <Link href={localizedPath(locale, "/catalog")} className="text-primary hover:underline">
                {t("Перейти в каталог", "Katalogga o'tish", "Browse catalog")}
              </Link>
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {cars.map((car) => (
                <CarCard key={car.id} car={car} />
              ))}
            </div>
          )}
        </section>

        {/* Saved searches */}
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Search className="h-5 w-5 text-muted-foreground" />
            {t("Сохранённые поиски", "Saqlangan qidiruvlar", "Saved searches")}
          </h2>
          {searches.length === 0 ? (
            <p className="text-sm text-white/50">
              {t("Нет сохранённых поисков.", "Saqlangan qidiruvlar yo'q.", "No saved searches.")}
            </p>
          ) : (
            <div className="space-y-2">
              {searches.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 border border-border bg-card p-3"
                >
                  <span className="text-sm">
                    {s.label || t("Поиск", "Qidiruv", "Search")}
                  </span>
                  <button
                    className="text-sm text-white/40 hover:text-neon-pink"
                    onClick={() => removeSearch(s.id)}
                  >
                    {t("Удалить", "O'chirish", "Remove")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="flex items-center gap-2 font-mono text-xs text-white/40">
          <Phone className="h-3 w-3" />
          {me.customer?.phone}
        </p>
      </div>
    </div>
  );
}
