"use client";

import { useState, useMemo } from "react";
import { CreditCard, Percent, Calendar, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/i18n/locale-context";
import { formatPrice, cn } from "@/lib/utils";

export function FinancingCalculator() {
  const { locale } = useLocale();
  const [carPrice, setCarPrice] = useState("25000");
  const [downPaymentPct, setDownPaymentPct] = useState("30");
  const [interestRate, setInterestRate] = useState("18");
  const [termMonths, setTermMonths] = useState("24");

  const result = useMemo(() => {
    const price = parseFloat(carPrice) || 0;
    const dpPct = parseFloat(downPaymentPct) || 0;
    const rate = parseFloat(interestRate) || 0;
    const months = parseInt(termMonths) || 12;

    if (price <= 0) return null;

    const downPayment = price * (dpPct / 100);
    const loanAmount = price - downPayment;
    const monthlyRate = rate / 100 / 12;

    let monthlyPayment: number;
    if (monthlyRate === 0) {
      monthlyPayment = loanAmount / months;
    } else {
      monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
    }

    const totalPayment = monthlyPayment * months + downPayment;
    const totalInterest = totalPayment - price;

    return {
      downPayment,
      loanAmount,
      monthlyPayment,
      totalPayment,
      totalInterest,
      months,
    };
  }, [carPrice, downPaymentPct, interestRate, termMonths]);

  const labels = {
    ru: {
      title: "Калькулятор рассрочки",
      carPrice: "Стоимость авто (USD)",
      downPayment: "Первоначальный взнос (%)",
      interestRate: "Процентная ставка (% годовых)",
      term: "Срок (месяцев)",
      result: "Результат расчёта",
      dpAmount: "Первоначальный взнос",
      loanAmount: "Сумма кредита",
      monthly: "Ежемесячный платёж",
      totalPayment: "Общая сумма выплат",
      overpayment: "Переплата",
      note: "* Расчёт приблизительный. Фактические условия зависят от банка.",
    },
    en: {
      title: "Financing Calculator",
      carPrice: "Car Price (USD)",
      downPayment: "Down Payment (%)",
      interestRate: "Interest Rate (% annual)",
      term: "Term (months)",
      result: "Calculation Result",
      dpAmount: "Down Payment",
      loanAmount: "Loan Amount",
      monthly: "Monthly Payment",
      totalPayment: "Total Payment",
      overpayment: "Total Interest",
      note: "* This is an estimate. Actual terms depend on the bank.",
    },
    uz: {
      title: "Bo'lib to'lash kalkulyatori",
      carPrice: "Avtomobil narxi (USD)",
      downPayment: "Dastlabki to'lov (%)",
      interestRate: "Foiz stavkasi (% yillik)",
      term: "Muddat (oy)",
      result: "Hisoblash natijasi",
      dpAmount: "Dastlabki to'lov",
      loanAmount: "Kredit miqdori",
      monthly: "Oylik to'lov",
      totalPayment: "Jami to'lov",
      overpayment: "Ortiqcha to'lov",
      note: "* Bu taxminiy hisob. Haqiqiy shartlar bankka bog'liq.",
    },
  };

  const t = labels[locale as keyof typeof labels] || labels.ru;

  const termOptions = [12, 18, 24, 36, 48, 60];

  return (
    <div className="space-y-6">
      <div className="bg-[#0d0d15] rounded-2xl border border-white/10 p-8 space-y-6">
        <div>
          <label className="text-sm font-semibold mb-2 block">{t.carPrice}</label>
          <Input type="number" value={carPrice} onChange={(e) => setCarPrice(e.target.value)} min="1000" className="h-14 text-lg" />
        </div>

        <div>
          <label className="text-sm font-semibold mb-2 block">{t.downPayment}: {downPaymentPct}%</label>
          <input
            type="range"
            min="10"
            max="80"
            step="5"
            value={downPaymentPct}
            onChange={(e) => setDownPaymentPct(e.target.value)}
            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-neon-blue"
          />
          <div className="flex justify-between text-xs text-white/60 mt-1">
            <span>10%</span>
            <span>80%</span>
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold mb-2 block">{t.interestRate}</label>
          <Input type="number" step="0.5" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} min="0" max="50" />
        </div>

        <div>
          <label className="text-sm font-semibold mb-3 block">{t.term}</label>
          <div className="grid grid-cols-3 gap-2">
            {termOptions.map((m) => (
              <button
                key={m}
                onClick={() => setTermMonths(String(m))}
                className={cn(
                  "py-2.5 rounded-xl text-sm font-medium border transition-all",
                  termMonths === String(m)
                    ? "bg-neon-blue/15 border-neon-blue text-neon-blue"
                    : "border-white/10 text-white/60 hover:bg-white/5"
                )}
              >
                {m} {locale === "ru" ? "мес" : "mo"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="bg-[#0d0d15] rounded-2xl border border-white/10 overflow-hidden animate-fade-in-up">
          <div className="bg-[#0a0a0f] text-white p-6">
            <h3 className="text-lg font-bold">{t.result}</h3>
          </div>
          <div className="p-6 space-y-3">
            {[
              { icon: DollarSign, label: t.dpAmount, value: formatPrice(result.downPayment) },
              { icon: CreditCard, label: t.loanAmount, value: formatPrice(result.loanAmount) },
              { icon: Calendar, label: t.monthly, value: formatPrice(result.monthlyPayment), highlight: true },
              { icon: DollarSign, label: t.totalPayment, value: formatPrice(result.totalPayment) },
              { icon: Percent, label: t.overpayment, value: formatPrice(result.totalInterest), destructive: true },
            ].map((row, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-white/10 last:border-0">
                <div className="flex items-center gap-2">
                  <row.icon className="w-4 h-4 text-white/60" />
                  <span className="text-sm text-white/60">{row.label}</span>
                </div>
                <span className={cn(
                  "text-sm font-semibold text-white",
                  row.highlight && "text-lg text-neon-blue",
                  row.destructive && "text-red-500"
                )}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
          <div className="bg-neon-blue/10 p-6 border-t-2 border-neon-blue">
            <div className="flex items-center justify-between">
              <span className="font-bold text-lg text-white">{t.monthly}</span>
              <span className="text-2xl font-bold text-neon-blue">{formatPrice(result.monthlyPayment)}</span>
            </div>
            <p className="text-xs text-white/60 mt-2">{locale === "ru" ? `на ${result.months} месяцев` : `for ${result.months} months`}</p>
          </div>
          <div className="p-4 text-xs text-white/60 text-center">{t.note}</div>
        </div>
      )}
    </div>
  );
}
