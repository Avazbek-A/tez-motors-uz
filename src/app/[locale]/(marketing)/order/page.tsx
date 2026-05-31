import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies, headers } from "next/headers";
import { SITE_CONFIG } from "@/lib/constants";
import { getLocaleFromCookie } from "@/i18n/config";
import { createServiceClient } from "@/lib/supabase/server";
import type { ModelCatalog } from "@/types/model";
import OrderContent from "./_content";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale =
    (requestHeaders.get("x-tez-locale") as "ru" | "uz" | "en" | null) ??
    getLocaleFromCookie(cookieStore.get("NEXT_LOCALE")?.value);

  const title =
    locale === "uz"
      ? "Avtomobilni buyurtma qilish — Tez Motors"
      : locale === "en"
      ? "Order a car to import — Tez Motors"
      : "Заказать авто под импорт — Tez Motors";
  const description =
    locale === "uz"
      ? "Kerakli komplektatsiya va rangni tanlang — biz uni Xitoydan 6–8 hafta ichida olib kelamiz."
      : locale === "en"
      ? "Pick the exact trim and colour you want — we import it from China in 6–8 weeks."
      : "Выберите нужную комплектацию и цвет — привезём из Китая под заказ за 6–8 недель.";

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_CONFIG.url}/${locale}/order`,
      languages: {
        ru: `${SITE_CONFIG.url}/ru/order`,
        uz: `${SITE_CONFIG.url}/uz/order`,
        en: `${SITE_CONFIG.url}/en/order`,
      },
    },
    openGraph: { title, description },
  };
}

async function fetchOrderableModels(): Promise<ModelCatalog[]> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("model_catalog")
      .select("*")
      .eq("is_orderable", true)
      .order("order_position", { ascending: true })
      .order("brand", { ascending: true });
    return (data as ModelCatalog[]) || [];
  } catch {
    return [];
  }
}

export default async function OrderPage() {
  const models = await fetchOrderableModels();
  return (
    <Suspense fallback={null}>
      <OrderContent models={models} />
    </Suspense>
  );
}
