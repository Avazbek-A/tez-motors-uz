"use client";

import { useEffect, useState } from "react";
import { FileSignature, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";

const COPY = {
  ru: {
    title: "Подписать договор",
    subtitle: "Введите номер заказа и телефон, чтобы открыть и подписать договор",
    code: "Номер заказа (TM-…)",
    phone: "Телефон",
    open: "Открыть договор",
    notFound: "Заказ не найден. Проверьте номер и телефон.",
    yourName: "Ваше полное имя (подпись)",
    agree: "Я ознакомился(ась) с договором и согласен(на) с его условиями",
    sign: "Подписать",
    signed: "Договор подписан",
    signedAt: "Подписано",
    already: "Этот документ уже подписан.",
    err: "Не удалось подписать. Попробуйте ещё раз.",
  },
  uz: {
    title: "Shartnomani imzolash",
    subtitle: "Shartnomani ochish va imzolash uchun buyurtma raqami va telefonni kiriting",
    code: "Buyurtma raqami (TM-…)",
    phone: "Telefon",
    open: "Shartnomani ochish",
    notFound: "Buyurtma topilmadi. Raqam va telefonni tekshiring.",
    yourName: "To'liq ismingiz (imzo)",
    agree: "Shartnoma bilan tanishdim va shartlariga roziman",
    sign: "Imzolash",
    signed: "Shartnoma imzolandi",
    signedAt: "Imzolangan",
    already: "Bu hujjat allaqachon imzolangan.",
    err: "Imzolab bo'lmadi. Qayta urinib ko'ring.",
  },
  en: {
    title: "Sign your contract",
    subtitle: "Enter your order reference and phone to open and sign the contract",
    code: "Order reference (TM-…)",
    phone: "Phone",
    open: "Open contract",
    notFound: "Order not found. Check the reference and phone.",
    yourName: "Your full name (signature)",
    agree: "I have read the contract and agree to its terms",
    sign: "Sign",
    signed: "Contract signed",
    signedAt: "Signed",
    already: "This document is already signed.",
    err: "Could not sign. Please try again.",
  },
} as const;

export default function SignPage() {
  const { locale } = useLocale();
  const t = COPY[locale as keyof typeof COPY] ?? COPY.ru;

  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [doc, setDoc] = useState<{ title: string; html: string; reference: string } | null>(null);
  const [signedInfo, setSignedInfo] = useState<{ at: string; name: string } | null>(null);
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill from a link (e.g. from /track or the deposit-success surface).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const c = p.get("code");
    const ph = p.get("phone");
    if (c) setCode(c);
    if (ph) setPhone(ph);
    if (c && ph) void open(c, ph);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function open(c = code, ph = phone) {
    setLoading(true);
    setError(null);
    setDoc(null);
    try {
      const res = await fetch(`/api/sign?code=${encodeURIComponent(c)}&phone=${encodeURIComponent(ph)}&type=sales_contract`);
      const data = await res.json();
      if (!data.ok || !data.found) {
        setError(t.notFound);
        return;
      }
      setDoc({ title: data.title, html: data.html, reference: data.order?.reference_code || c });
      setSignedInfo(data.signed || null);
      if (data.order?.customer_name) setName(data.order.customer_name);
    } catch {
      setError(t.notFound);
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (!agree || name.trim().length < 2) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, phone, type: "sales_contract", signer_name: name.trim(), signature_text: name.trim(), agreed: true }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(t.err);
        return;
      }
      setDone(true);
    } catch {
      setError(t.err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pt-24 pb-20">
      <div className="container-custom max-w-3xl">
        <SectionHeading title={t.title} subtitle={t.subtitle} centered={false} className="mb-8" />

        {!doc && (
          <div className="bg-card border border-border p-6 space-y-4 max-w-md">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t.code} />
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.phone} />
            {error && <p className="text-sm text-red-400 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{error}</p>}
            <Button onClick={() => open()} disabled={loading || !code || phone.length < 5} className="w-full">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><FileSignature className="w-5 h-5" />{t.open}</>}
            </Button>
          </div>
        )}

        {doc && (
          <div className="space-y-6">
            <div
              className="bg-white text-black border border-border p-6 max-h-[60vh] overflow-y-auto rounded"
              dangerouslySetInnerHTML={{ __html: doc.html }}
            />

            {done || signedInfo ? (
              <div className="bg-card border border-[var(--success,#16a34a)]/40 p-6 flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-[var(--success,#16a34a)]" />
                <div>
                  <p className="font-semibold text-foreground">{t.signed}</p>
                  {signedInfo && !done && (
                    <p className="text-sm text-muted-foreground">{t.signedAt}: {new Date(signedInfo.at).toLocaleString()} — {signedInfo.name}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-card border border-border p-6 space-y-4 max-w-md">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.yourName} />
                <label className="flex items-start gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
                  <span>{t.agree}</span>
                </label>
                {error && <p className="text-sm text-red-400 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{error}</p>}
                <Button onClick={submit} disabled={submitting || !agree || name.trim().length < 2} className="w-full">
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><FileSignature className="w-5 h-5" />{t.sign}</>}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
