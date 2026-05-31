"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-context";

/**
 * "Pay deposit online" button(s).
 *
 * One button per configured rail: Payme (NEXT_PUBLIC_PAYME_MERCHANT_ID) and/or
 * Click (NEXT_PUBLIC_CLICK_MERCHANT_ID). A rail with no public merchant id is
 * hidden entirely, so each ships dark until the dealer completes that rail's
 * onboarding. On click it asks the checkout route for a hosted-checkout link
 * (which pins the expected amount on the order) and redirects the customer.
 */
export function DepositButton({
  referenceCode,
  phone,
  className,
}: {
  referenceCode: string;
  phone: string;
  className?: string;
}) {
  const { locale } = useLocale();
  const [loading, setLoading] = useState<"payme" | "click" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const paymeEnabled = !!process.env.NEXT_PUBLIC_PAYME_MERCHANT_ID;
  const clickEnabled = !!process.env.NEXT_PUBLIC_CLICK_MERCHANT_ID;
  if (!paymeEnabled && !clickEnabled) return null;

  const t = (ru: string, uz: string, en: string) =>
    locale === "uz" ? uz : locale === "en" ? en : ru;

  const pay = async (provider: "payme" | "click") => {
    setLoading(provider);
    setError(null);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference_code: referenceCode, phone, locale, provider }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.url === "string") {
        window.location.href = data.url;
        return;
      }
      setError(data.error || t("Не удалось создать платёж", "To'lov yaratilmadi", "Could not start payment"));
    } catch {
      setError(t("Ошибка сети", "Tarmoq xatosi", "Network error"));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className={className}>
      <div className="flex flex-col gap-2 sm:flex-row">
        {paymeEnabled && (
          <Button
            type="button"
            onClick={() => pay("payme")}
            disabled={loading !== null}
            className="w-full gap-2"
          >
            {loading === "payme" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            {t("Оплатить через Payme", "Payme orqali to'lash", "Pay with Payme")}
          </Button>
        )}
        {clickEnabled && (
          <Button
            type="button"
            onClick={() => pay("click")}
            disabled={loading !== null}
            variant={paymeEnabled ? "outline" : "default"}
            className="w-full gap-2"
          >
            {loading === "click" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            {t("Оплатить через Click", "Click orqali to'lash", "Pay with Click")}
          </Button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
    </div>
  );
}
