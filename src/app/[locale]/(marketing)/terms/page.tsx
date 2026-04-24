"use client";

import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";

export default function TermsPage() {
  const { locale } = useLocale();

  const title = locale === "ru" ? "Условия использования" : locale === "uz" ? "Foydalanish shartlari" : "Terms of Service";

  return (
    <div className="pt-24 pb-16">
      <div className="container-custom">
        <SectionHeading title={title} />

        <div className="max-w-3xl mx-auto">
          <div className="bg-[#0d0d15] rounded-2xl border border-white/10 p-8 md:p-12 space-y-6 text-white/60 leading-relaxed">
            <section>
              <h2 className="text-lg font-bold text-white mb-3">
                {locale === "ru" ? "1. Предмет договора" : "1. Subject of Agreement"}
              </h2>
              <p>
                {locale === "ru"
                  ? "Tez Motors оказывает услуги по подбору, покупке и доставке автомобилей из Китайской Народной Республики в Республику Узбекистан."
                  : "Tez Motors provides services for selection, purchase, and delivery of vehicles from China to Uzbekistan."}
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3">
                {locale === "ru" ? "2. Порядок оплаты" : "2. Payment Terms"}
              </h2>
              <p>
                {locale === "ru"
                  ? "Предоплата составляет 30% от полной стоимости автомобиля. Оставшаяся сумма оплачивается после прибытия автомобиля и прохождения таможенного оформления."
                  : "The deposit is 30% of the total vehicle cost. The remaining amount is paid after the car arrives and completes customs clearance."}
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3">
                {locale === "ru" ? "3. Сроки доставки" : "3. Delivery Terms"}
              </h2>
              <p>
                {locale === "ru"
                  ? "Стандартный срок доставки составляет 25-45 дней с момента выкупа автомобиля. Сроки могут варьироваться в зависимости от способа доставки и логистических условий."
                  : "Standard delivery time is 25-45 days from the date of vehicle purchase. Timing may vary depending on delivery method and logistics conditions."}
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3">
                {locale === "ru" ? "4. Гарантии" : "4. Warranties"}
              </h2>
              <p>
                {locale === "ru"
                  ? "Tez Motors предоставляет гарантию на техническое состояние автомобиля сроком 1 год или 20 000 км пробега. Гарантия распространяется на основные узлы и агрегаты."
                  : "Tez Motors provides a warranty on the vehicle's technical condition for 1 year or 20,000 km. The warranty covers major components and assemblies."}
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3">
                {locale === "ru" ? "5. Ответственность сторон" : "5. Liability"}
              </h2>
              <p>
                {locale === "ru"
                  ? "Tez Motors несёт ответственность за сохранность автомобиля на всех этапах доставки. Все автомобили застрахованы на время транспортировки."
                  : "Tez Motors is responsible for vehicle safety at all delivery stages. All vehicles are insured during transportation."}
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-white mb-3">
                {locale === "ru" ? "6. Возврат и отмена" : "6. Returns and Cancellation"}
              </h2>
              <p>
                {locale === "ru"
                  ? "Отмена заказа возможна до момента выкупа автомобиля. После выкупа предоплата не возвращается. Условия возврата оговариваются индивидуально."
                  : "Order cancellation is possible before vehicle purchase. After purchase, the deposit is non-refundable. Return conditions are discussed individually."}
              </p>
            </section>

            <p className="text-xs text-white/60 pt-4 border-t border-white/10">
              {locale === "ru" ? "Последнее обновление: Январь 2025" : "Last updated: January 2025"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
