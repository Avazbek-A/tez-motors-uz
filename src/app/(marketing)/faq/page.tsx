"use client";

import { useState, useEffect, useMemo } from "react";

import { ChevronDown, Loader2, Search, X } from "lucide-react";
import { SectionHeading } from "@/components/shared/section-heading";
import { FAQSchema } from "@/components/shared/structured-data";
import { useLocale } from "@/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { FAQ } from "@/types/car";

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { locale, dictionary } = useLocale();

  useEffect(() => {
    fetch("/api/faqs")
      .then((r) => r.json())
      .then((data) => {
        setFaqs((data.faqs || []).filter((f: FAQ) => f.is_published));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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

  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) return faqs;
    const q = searchQuery.toLowerCase();
    return faqs.filter((faq) => {
      const question = (getQuestion(faq) || "").toLowerCase();
      const answer = (getAnswer(faq) || "").toLowerCase();
      return question.includes(q) || answer.includes(q);
    });
  }, [faqs, searchQuery, locale]);

  const searchPlaceholder =
    locale === "ru"
      ? "Поиск по вопросам..."
      : locale === "uz"
      ? "Savollar bo'yicha qidirish..."
      : "Search questions...";

  // Build FAQ structured data from published FAQs
  const faqSchemaItems = faqs.map((faq) => ({
    question: getQuestion(faq) || "",
    answer: getAnswer(faq) || "",
  })).filter((item) => item.question && item.answer);

  return (
    <div className="pt-24 pb-16">
      {faqSchemaItems.length > 0 && <FAQSchema faqs={faqSchemaItems} />}
      <div className="container-custom">
        <SectionHeading
          title={dictionary.faqSection.title}
          subtitle={dictionary.faqSection.subtitle}
        />

        {/* Search */}
        <div className="max-w-xl mx-auto mb-10">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setOpenIndex(null);
              }}
              placeholder={searchPlaceholder}
              className="w-full h-14 rounded-2xl border border-white/10 bg-[#0d0d15] text-white placeholder:text-white/30 px-12 text-base focus:outline-none focus:ring-2 focus:ring-neon-blue focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-neon-blue mx-auto" />
          </div>
        ) : filteredFaqs.length === 0 ? (
          <div className="text-center py-16 text-white/40">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>
              {locale === "ru"
                ? "Ничего не найдено по вашему запросу"
                : locale === "uz"
                ? "So'rovingiz bo'yicha hech narsa topilmadi"
                : "No results found for your query"}
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-3">
            {searchQuery && (
              <p className="text-sm text-white/40 mb-4 text-center">
                {locale === "ru"
                  ? `Найдено: ${filteredFaqs.length} результат(а)`
                  : `Found: ${filteredFaqs.length} result(s)`}
              </p>
            )}
            {filteredFaqs.map((faq, index) => (
              <div
                key={faq.id}
                className="animate-fade-in-up bg-[#0d0d15] rounded-2xl border border-white/10 overflow-hidden shadow-sm"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <button
                  onClick={() => setOpenIndex(openIndex === index ? null : index)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-white/5 transition-colors"
                >
                  <span className="font-semibold text-white pr-4 text-lg">
                    {getQuestion(faq)}
                  </span>
                  <ChevronDown
                    className={cn(
                      "w-5 h-5 text-neon-blue shrink-0 transition-transform duration-200",
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
                  <div className="px-6 pb-6 text-white/60 leading-relaxed border-t border-white/10 pt-4">
                    {getAnswer(faq)}
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
