import { cookies, headers } from "next/headers";
import CalculatorContent from "./_content";
import { createServiceClient } from "@/lib/supabase/server";
import { getUsdUzsRate } from "@/lib/fx-rate";
import { DEFAULT_USD_UZS } from "@/lib/customs-uz";
import { getLocaleFromCookie } from "@/i18n/config";
import { SITE_CONFIG } from "@/lib/constants";
import { CalculatorSchema } from "@/components/shared/structured-data";
import { BreadcrumbSchema } from "@/components/shared/breadcrumb-schema";

// Metadata is provided by calculator/layout.tsx via makePageMetadata.

// Server component: resolve the live USD→UZS rate once so the customs estimate
// converts the so'm-denominated fees (utilization, clearance) accurately.
export default async function CalculatorPage() {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale =
    (requestHeaders.get("x-tez-locale") as "ru" | "uz" | "en" | null) ??
    getLocaleFromCookie(cookieStore.get("NEXT_LOCALE")?.value);

  let usdUzs = DEFAULT_USD_UZS;
  try {
    usdUzs = await getUsdUzsRate(createServiceClient());
  } catch {
    /* fall back to the default rate */
  }

  const crumbs = {
    ru: { home: "Главная", calc: "Калькулятор растаможки" },
    uz: { home: "Bosh sahifa", calc: "Bojxona kalkulyatori" },
    en: { home: "Home", calc: "Customs calculator" },
  }[locale];

  return (
    <>
      <CalculatorSchema locale={locale} />
      <BreadcrumbSchema
        items={[
          { name: crumbs.home, url: `${SITE_CONFIG.url}/${locale}` },
          { name: crumbs.calc, url: `${SITE_CONFIG.url}/${locale}/calculator` },
        ]}
      />
      <CalculatorContent usdUzs={usdUzs} />
    </>
  );
}
