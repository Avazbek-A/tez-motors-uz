import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies, headers } from "next/headers";
import { getLocaleFromCookie } from "@/i18n/config";
import { localizedAlternates, type SeoLocale } from "@/lib/seo/alternates";
import ScootersCatalogContent from "./_content";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale =
    (requestHeaders.get("x-tez-locale") as SeoLocale | null) ??
    (getLocaleFromCookie(cookieStore.get("NEXT_LOCALE")?.value) as SeoLocale);

  const title =
    locale === "uz" ? "Skuterlar va elektrovelosipedlar — Tez Motors"
    : locale === "en" ? "Scooters & e-bikes — Tez Motors"
    : "Самокаты и электровелосипеды — Tez Motors";
  const description =
    locale === "uz" ? "Elektroskuter va e-bike Toshkentda: Xiaomi, Segway-Ninebot, Kugoo. Narxlar, kafolat, yetkazib berish."
    : locale === "en" ? "Electric scooters and e-bikes in Tashkent: Xiaomi, Segway-Ninebot, Kugoo. Prices, warranty, delivery."
    : "Электросамокаты и электровелосипеды в Ташкенте: Xiaomi, Segway-Ninebot, Kugoo. Цены, гарантия, доставка.";

  return { title, description, alternates: localizedAlternates("/scooters", locale), openGraph: { title, description } };
}

export default function ScootersPage() {
  return (
    <Suspense fallback={null}>
      <ScootersCatalogContent />
    </Suspense>
  );
}
