"use client";

import { Star, Quote } from "lucide-react";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import type { Review } from "@/types/car";

interface ReviewsProps {
  reviews: Review[];
}

export function Reviews({ reviews }: ReviewsProps) {
  const { locale, dictionary } = useLocale();
  const { ref, isVisible } = useScrollReveal();

  const getReviewText = (review: Review) => {
    if (locale === "uz") return review.review_text_uz;
    if (locale === "en") return review.review_text_en;
    return review.review_text_ru;
  };

  return (
    <section className="py-20 md:py-28">
      <div className="container-custom">
        <SectionHeading
          title={dictionary.reviews.title}
          subtitle={dictionary.reviews.subtitle}
        />

        <div ref={ref} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reviews.map((review, index) => (
            <div
              key={review.id}
              className={`bg-white rounded-2xl border border-border p-6 shadow-sm hover:shadow-lg transition-all duration-300 ${
                isVisible ? "animate-fade-in-up" : "opacity-0"
              }`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <Quote className="w-8 h-8 text-lime/30 mb-4" />
              <p className="text-foreground/80 text-sm leading-relaxed mb-6">
                {getReviewText(review)}
              </p>
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div>
                  <p className="font-semibold text-foreground">{review.client_name}</p>
                  {review.car_description && (
                    <p className="text-xs text-muted-foreground">{review.car_description}</p>
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
      </div>
    </section>
  );
}
