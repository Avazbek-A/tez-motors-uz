"use client";

import { useState, useEffect } from "react";
import { Star, Quote, Send, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import type { Review } from "@/types/car";

export default function ReviewsPage() {
  const { locale } = useLocale();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);

  useEffect(() => {
    fetch("/api/reviews")
      .then((r) => r.json())
      .then((data) => {
        setReviews((data.reviews || []).filter((r: Review) => r.is_published));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const title = locale === "ru" ? "Отзывы клиентов" : locale === "uz" ? "Mijozlar fikrlari" : "Customer Reviews";
  const subtitle = locale === "ru"
    ? "Что говорят о нас наши клиенты"
    : locale === "uz" ? "Mijozlarimiz biz haqimizda nima deyishadi"
    : "What our clients say about us";

  const getReviewText = (review: Review) => {
    if (locale === "uz") return review.review_text_uz;
    if (locale === "en") return review.review_text_en;
    return review.review_text_ru;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: String(formData.get("name") ?? ""),
          car_description: String(formData.get("car") ?? ""),
          review_text_ru: String(formData.get("review") ?? ""),
          rating,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSubmitError(data.error || (locale === "ru" ? "Ошибка отправки. Попробуйте ещё раз." : "Failed to send. Please try again."));
        return;
      }
      setIsSuccess(true);
      form.reset();
      setTimeout(() => { setIsSuccess(false); setShowForm(false); }, 3000);
    } catch {
      setSubmitError(locale === "ru" ? "Нет соединения. Проверьте интернет." : "No connection. Check your internet.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : "5.0";

  return (
    <div className="pt-24 pb-16">
      <div className="container-custom">
        <SectionHeading title={title} subtitle={subtitle} />

        {/* Summary stats */}
        <div className="flex items-center justify-center gap-8 mb-12">
          <div className="text-center">
            <p className="text-4xl font-bold text-neon-blue">{avgRating}</p>
            <div className="flex gap-0.5 justify-center mt-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <p className="text-xs text-white/60 mt-1">{reviews.length} {locale === "ru" ? "отзывов" : "reviews"}</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            {locale === "ru" ? "Оставить отзыв" : "Leave Review"}
          </Button>
        </div>

        {/* Review form */}
        {showForm && (
          <div className="max-w-xl mx-auto mb-12 animate-fade-in-up">
            {isSuccess ? (
              <div className="bg-neon-blue/10 rounded-2xl border border-neon-blue/20 p-8 text-center">
                <CheckCircle className="w-12 h-12 text-neon-blue mx-auto mb-3" />
                <p className="font-semibold">{locale === "ru" ? "Спасибо за отзыв! Он будет опубликован после модерации." : "Thank you! Your review will be published after moderation."}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-[#0d0d15] rounded-2xl border border-white/10 p-6 space-y-4">
                <h3 className="font-bold">{locale === "ru" ? "Оставить отзыв" : "Leave a Review"}</h3>

                {/* Star rating */}
                <div>
                  <p className="text-sm font-medium mb-2">{locale === "ru" ? "Ваша оценка" : "Your Rating"}</p>
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setRating(i + 1)}
                        onMouseEnter={() => setHoverRating(i + 1)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-0.5"
                      >
                        <Star className={`w-7 h-7 transition-colors ${
                          i < (hoverRating || rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-200"
                        }`} />
                      </button>
                    ))}
                  </div>
                </div>

                <Input name="name" placeholder={locale === "ru" ? "Ваше имя" : "Your name"} required />
                <Input name="car" placeholder={locale === "ru" ? "Какой автомобиль купили?" : "Which car did you buy?"} />
                <Textarea name="review" placeholder={locale === "ru" ? "Расскажите о вашем опыте..." : "Tell us about your experience..."} rows={4} required />

                {submitError && (
                  <p className="text-sm text-red-400 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />{submitError}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-5 h-5" />{locale === "ru" ? "Отправить" : "Submit"}</>}
                </Button>
              </form>
            )}
          </div>
        )}

        {/* Reviews grid */}
        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-neon-blue mx-auto" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reviews.map((review, index) => (
              <div
                key={review.id}
                className="bg-[#0d0d15] rounded-2xl border border-white/10 p-6 shadow-sm hover:shadow-lg hover:shadow-neon-blue/5 transition-all duration-300 animate-fade-in-up"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <Quote className="w-8 h-8 text-neon-blue/30 mb-4" />
                <p className="text-white/80 text-sm leading-relaxed mb-6">
                  {getReviewText(review)}
                </p>
                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <div>
                    <p className="font-semibold text-white">{review.client_name}</p>
                    {review.car_description && (
                      <p className="text-xs text-white/60">{review.car_description}</p>
                    )}
                  </div>
                  <div className="flex gap-0.5">
                    {Array.from({ length: review.rating }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
