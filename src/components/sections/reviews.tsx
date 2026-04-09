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
    <section className="py-20 md:py-28 bg-[#0a0a0f]">
      <div className="container-custom">
        <SectionHeading
          title={dictionary.reviews.title}
          subtitle={dictionary.reviews.subtitle}
          light
        />

        <div ref={ref} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reviews.map((review, index) => (
            <div
              key={review.id}
              className={`bg-[#0d0d15] rounded-2xl border border-neon-blue/10 p-6 hover:border-neon-blue/30 hover:shadow-[0_0_30px_rgba(0,212,255,0.08)] transition-all duration-300 ${
                isVisible ? "animate-fade-in-up" : "opacity-0"
              }`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <Quote className="w-8 h-8 text-neon-purple/40 mb-4" />
              <p className="text-white/70 text-sm leading-relaxed mb-6">
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
                    <Star key={i} className="w-4 h-4 fill-neon-blue text-neon-blue" />
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
