"use client";

import { useState } from "react";

import { ChevronDown } from "lucide-react";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { MOCK_FAQS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import type { FAQ } from "@/types/car";

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const { locale, dictionary } = useLocale();

  const faqs = MOCK_FAQS.filter((f) => f.is_published);

  const getQuestion = (faq: FAQ) => {
    if (locale === "uz") return faq.question_uz;
    if (locale === "en") return faq.question_en;
    return faq.question_ru;
  };

  const getAnswer = (faq: FAQ) => {
    if (locale === "uz") return faq.answer_uz;
    if (locale === "en") return faq.answer_en;
    return faq.answer_ru;
  };

  return (
    <div className="pt-24 pb-16">
      <div className="container-custom">
        <SectionHeading
          title={dictionary.faqSection.title}
          subtitle={dictionary.faqSection.subtitle}
        />

        <div className="max-w-3xl mx-auto space-y-3">
          {faqs.map((faq, index) => (
            <div
              key={faq.id}
              className="animate-fade-in-up bg-white rounded-2xl border border-border overflow-hidden shadow-sm"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-6 text-left hover:bg-muted/50 transition-colors"
              >
                <span className="font-semibold text-foreground pr-4 text-lg">
                  {getQuestion(faq)}
                </span>
                <ChevronDown
                  className={cn(
                    "w-5 h-5 text-muted-foreground shrink-0 transition-transform duration-200",
                    openIndex === index && "rotate-180"
                  )}
                />
              </button>
              <div
                className={cn(
                  "overflow-hidden transition-all duration-300",
                  openIndex === index ? "max-h-96" : "max-h-0"
                )}
              >
                <div className="px-6 pb-6 text-muted-foreground leading-relaxed border-t border-border pt-4">
                  {getAnswer(faq)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
