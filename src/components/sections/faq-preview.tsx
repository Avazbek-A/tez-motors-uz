"use client";

import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { cn } from "@/lib/utils";
import type { FAQ } from "@/types/car";

interface FAQPreviewProps {
  faqs: FAQ[];
}

export function FAQPreview({ faqs }: FAQPreviewProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { locale, dictionary } = useLocale();
  const { ref, isVisible } = useScrollReveal();

  const getQuestion = (faq: FAQ) => locale === "uz" ? faq.question_uz : locale === "en" ? faq.question_en : faq.question_ru;
  const getAnswer = (faq: FAQ) => locale === "uz" ? faq.answer_uz : locale === "en" ? faq.answer_en : faq.answer_ru;

  return (
    <section className="py-20 md:py-28 bg-muted/50">
      <div className="container-custom">
        <SectionHeading
          title={dictionary.faqSection.title}
          subtitle={dictionary.faqSection.subtitle}
        />

        <div ref={ref} className={`max-w-3xl mx-auto space-y-3 ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}>
          {faqs.map((faq, index) => (
            <div
              key={faq.id}
              className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/50 transition-colors"
              >
                <span className="font-semibold text-foreground pr-4">{getQuestion(faq)}</span>
                <ChevronDown
                  className={cn(
                    "w-5 h-5 text-muted-foreground shrink-0 transition-transform duration-200",
                    openIndex === index && "rotate-180"
                  )}
                />
              </button>
              <div className={cn(
                "overflow-hidden transition-all duration-300",
                openIndex === index ? "max-h-96" : "max-h-0"
              )}>
                <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed border-t border-border pt-4">
                  {getAnswer(faq)}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Button variant="outline" asChild>
            <Link href="/faq">
              {dictionary.faqSection.viewAll}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
