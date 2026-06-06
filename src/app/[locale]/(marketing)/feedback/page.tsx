"use client";

import { useEffect, useState } from "react";
import { Star, Loader2, CheckCircle, Share2, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";

const COPY = {
  ru: { title: "Как всё прошло?", q: "Оцените покупку в Tez Motors", placeholder: "Поделитесь впечатлением (необязательно)", submit: "Отправить", publicTitle: "Спасибо! 🎉", publicBody: "Рады, что вам понравилось! Поделитесь с друзьями — это лучшая поддержка для нас.", share: "Поделиться", privateTitle: "Спасибо за честность.", privateBody: "Извините, что не оправдали ожиданий. Команда свяжется с вами, чтобы всё исправить." },
  uz: { title: "Qanday o'tdi?", q: "Tez Motors xaridini baholang", placeholder: "Taassurotingizni baham ko'ring (ixtiyoriy)", submit: "Yuborish", publicTitle: "Rahmat! 🎉", publicBody: "Yoqqanidan xursandmiz! Do'stlaringiz bilan ulashing — bu biz uchun eng katta yordam.", share: "Ulashish", privateTitle: "Halolligingiz uchun rahmat.", privateBody: "Kutganingizdek bo'lmaganidan uzr. Jamoa siz bilan bog'lanib, hammasini to'g'rilaydi." },
  en: { title: "How did it go?", q: "Rate your Tez Motors purchase", placeholder: "Share your experience (optional)", submit: "Submit", publicTitle: "Thank you! 🎉", publicBody: "So glad you loved it! Share with friends — it's the best support for us.", share: "Share", privateTitle: "Thanks for the honesty.", privateBody: "Sorry we fell short. The team will reach out to make it right." },
} as const;

export default function FeedbackPage() {
  const { locale } = useLocale();
  const t = COPY[locale as keyof typeof COPY] ?? COPY.ru;
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [ctx, setCtx] = useState<{ car_id?: string; car?: string; reference_code?: string }>({});
  const [state, setState] = useState<"idle" | "saving" | "public" | "private">("idle");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional on-mount sync (kick off a data load / read a browser-only value)
    setCtx({ car_id: p.get("car_id") || undefined, car: p.get("car") || undefined, reference_code: p.get("ref") || p.get("code") || undefined });
  }, []);

  async function submit() {
    if (rating < 1) return;
    setState("saving");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating, comment, car_id: ctx.car_id, car: ctx.car, reference_code: ctx.reference_code, locale }),
      });
      const data = await res.json();
      setState(data.action === "private" ? "private" : "public");
    } catch {
      setState("public"); // fail soft — thank them
    }
  }

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/${locale}/reviews` : "";

  return (
    <div className="pt-24 pb-20">
      <div className="container-custom max-w-md">
        <SectionHeading title={t.title} centered={false} className="mb-6" />

        {state === "public" ? (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-[var(--success,#16a34a)]"><CheckCircle className="w-5 h-5" /> <span className="font-semibold">{t.publicTitle}</span></p>
            <p className="text-muted-foreground text-sm">{t.publicBody}</p>
            <Button asChild variant="outline">
              <a href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer">
                <Share2 className="w-4 h-4" /> {t.share}
              </a>
            </Button>
          </div>
        ) : state === "private" ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-foreground"><Heart className="w-5 h-5 text-primary" /> <span className="font-semibold">{t.privateTitle}</span></p>
            <p className="text-muted-foreground text-sm">{t.privateBody}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-medium">{t.q}</p>
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <button key={i} type="button" onClick={() => setRating(i + 1)} onMouseEnter={() => setHover(i + 1)} onMouseLeave={() => setHover(0)} className="p-0.5">
                  <Star className={`w-9 h-9 transition-colors ${i < (hover || rating) ? "fill-primary text-primary" : "text-white/20"}`} />
                </button>
              ))}
            </div>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t.placeholder} rows={3} />
            <Button onClick={submit} disabled={state === "saving" || rating < 1} className="w-full">
              {state === "saving" ? <Loader2 className="w-5 h-5 animate-spin" /> : t.submit}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
