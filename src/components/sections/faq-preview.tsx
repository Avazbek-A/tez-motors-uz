"use client";

import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";
import { localizedPath } from "@/lib/locale-path";
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
    <section className="py-20 md:py-28 bg-background">
      <div className="container-custom">
        <SectionHeading
          title={dictionary.faqSection.title}
          subtitle={dictionary.faqSection.subtitle}
          light
        />

        <div ref={ref} className={`max-w-3xl mx-auto space-y-3 ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}>
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={faq.id}
                className={cn(
                  "bg-card border overflow-hidden transition-all duration-300",
                  isOpen
                    ? "border-white/25"
                    : "border-border hover:border-white/20"
                )}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <span className="font-semibold text-white pr-4">{getQuestion(faq)}</span>
                  <ChevronDown
                    className={cn(
                      "w-5 h-5 shrink-0 transition-all duration-200",
                      isOpen ? "rotate-180 text-primary" : "text-muted-foreground"
                    )}
                  />
                </button>
                <div className={cn(
                  "overflow-hidden transition-all duration-300",
                  isOpen ? "max-h-96" : "max-h-0"
                )}>
                  <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed border-t border-border pt-4">
                    {getAnswer(faq)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-10">
          <Button variant="outline" className="border-border text-foreground hover:bg-white/5 hover:border-white/20" asChild>
            <Link href={localizedPath(locale, "/faq")}>
              {dictionary.faqSection.viewAll}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
