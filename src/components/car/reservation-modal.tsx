"use client";

import { useState } from "react";
import { X, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Turnstile } from "@/components/shared/turnstile";
import { DepositButton } from "@/components/checkout/deposit-button";
import { useLocale } from "@/i18n/locale-context";

export function ReservationModal({
  carId,
  carName,
  open,
  onClose,
}: {
  carId: string;
  carName: string;
  open: boolean;
  onClose: () => void;
}) {
  const { locale } = useLocale();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [amountUsd, setAmountUsd] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [referenceCode, setReferenceCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const LABELS = {
    ru: {
      sent: "Заявка на бронь отправлена",
      refLabel: "Номер заказа",
      refHint: "Сохраните этот номер — по нему и вашему телефону вы сможете отслеживать заказ на странице «Отслеживание».",
      close: "Закрыть",
    },
    uz: {
      sent: "Bron arizasi yuborildi",
      refLabel: "Buyurtma raqami",
      refHint: "Ushbu raqamni saqlang — u va telefon raqamingiz orqali buyurtmani «Kuzatish» sahifasida kuzatishingiz mumkin.",
      close: "Yopish",
    },
    en: {
      sent: "Reservation sent",
      refLabel: "Order reference",
      refHint: "Save this code — use it with your phone number on the Track page to follow your order.",
      close: "Close",
    },
  };
  const T = LABELS[locale as keyof typeof LABELS] || LABELS.ru;

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reservation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          car_id: carId,
          name,
          phone,
          email: email || undefined,
          amount_usd: amountUsd || null,
          notes: notes || null,
          locale,
          turnstile_token: turnstileToken ?? undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to submit reservation");
        return;
      }
      const data = await res.json().catch(() => ({}));
      setReferenceCode(typeof data.reference_code === "string" ? data.reference_code : null);
      setSuccess(true);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-white/10 bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold">Reserve {carName}</h3>
            <p className="text-sm text-white/50">Hold the car with a deposit request</p>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="py-8 text-center">
            <CheckCircle className="w-12 h-12 text-neon-green mx-auto mb-3" />
            <p className="font-semibold">{T.sent}</p>
            {referenceCode && (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wide text-white/50">{T.refLabel}</p>
                <p className="mt-1 text-2xl font-mono font-bold tracking-wider text-neon-blue">{referenceCode}</p>
                <p className="mt-2 text-xs text-white/50">{T.refHint}</p>
              </div>
            )}
            {referenceCode && (
              <DepositButton referenceCode={referenceCode} phone={phone} className="mt-4" />
            )}
            <Button type="button" onClick={onClose} variant="outline" className="mt-3 w-full">
              {T.close}
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required />
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" required />
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" type="email" />
            <Input value={amountUsd} onChange={(e) => setAmountUsd(e.target.value)} placeholder="Deposit amount USD" type="number" min="0" />
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" rows={3} />
            <Turnstile onToken={setTurnstileToken} />
            {error && (
              <p className="text-sm text-red-400 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />{error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit reservation"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
