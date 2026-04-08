"use client";

import { SectionHeading } from "@/components/shared/section-heading";
import { useLocale } from "@/i18n/locale-context";

export default function PrivacyPage() {
  const { locale } = useLocale();

  const title = locale === "ru" ? "Политика конфиденциальности" : locale === "uz" ? "Maxfiylik siyosati" : "Privacy Policy";

  return (
    <div className="pt-24 pb-16">
      <div className="container-custom">
        <SectionHeading title={title} />

        <div className="max-w-3xl mx-auto prose prose-sm">
          <div className="bg-white rounded-2xl border border-border p-8 md:p-12 space-y-6 text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">
                {locale === "ru" ? "1. Общие положения" : "1. General Provisions"}
              </h2>
              <p>
                {locale === "ru"
                  ? "Настоящая политика конфиденциальности описывает, как Tez Motors собирает, использует и защищает персональные данные пользователей сайта tezmotors.uz."
                  : "This privacy policy describes how Tez Motors collects, uses, and protects personal data of tezmotors.uz website users."}
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">
                {locale === "ru" ? "2. Сбор информации" : "2. Information Collection"}
              </h2>
              <p>
                {locale === "ru"
                  ? "Мы собираем информацию, которую вы предоставляете при заполнении форм на сайте: имя, номер телефона, email, а также информацию о запрашиваемых автомобилях."
                  : "We collect information you provide when filling out forms on the site: name, phone number, email, and information about requested vehicles."}
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">
                {locale === "ru" ? "3. Использование информации" : "3. Use of Information"}
              </h2>
              <p>
                {locale === "ru"
                  ? "Собранная информация используется исключительно для обработки ваших заявок, предоставления консультаций и улучшения качества обслуживания. Мы не передаём ваши данные третьим лицам без вашего согласия."
                  : "Collected information is used solely for processing your requests, providing consultations, and improving service quality. We do not share your data with third parties without your consent."}
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">
                {locale === "ru" ? "4. Защита данных" : "4. Data Protection"}
              </h2>
              <p>
                {locale === "ru"
                  ? "Мы принимаем все необходимые технические и организационные меры для защиты ваших персональных данных от несанкционированного доступа, изменения, раскрытия или уничтожения."
                  : "We take all necessary technical and organizational measures to protect your personal data from unauthorized access, modification, disclosure, or destruction."}
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">
                {locale === "ru" ? "5. Файлы cookie" : "5. Cookies"}
              </h2>
              <p>
                {locale === "ru"
                  ? "Наш сайт использует файлы cookie для улучшения пользовательского опыта. Вы можете управлять настройками cookie в вашем браузере."
                  : "Our website uses cookies to improve user experience. You can manage cookie settings in your browser."}
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-foreground mb-3">
                {locale === "ru" ? "6. Контакты" : "6. Contact"}
              </h2>
              <p>
                {locale === "ru"
                  ? "По вопросам, связанным с конфиденциальностью, обращайтесь: info@tezmotors.uz"
                  : "For privacy-related questions, contact: info@tezmotors.uz"}
              </p>
            </section>

            <p className="text-xs text-muted-foreground/60 pt-4 border-t border-border">
              {locale === "ru" ? "Последнее обновление: Январь 2025" : "Last updated: January 2025"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
