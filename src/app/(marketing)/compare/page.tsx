import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import CompareContent from "./_content";

export const metadata: Metadata = {
  title: "Сравнение автомобилей — Tez Motors",
  description: "Сравните характеристики и цены китайских авто: BYD, Haval, Chery, Geely и другие бренды.",
};

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="pt-32 pb-16 text-center container-custom">
        <Loader2 className="w-8 h-8 animate-spin text-neon-blue mx-auto mb-3" />
      </div>
    }>
      <CompareContent />
    </Suspense>
  );
}
