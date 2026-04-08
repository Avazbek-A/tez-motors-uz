import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import { getLocaleFromCookie } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { LocaleProvider } from "@/i18n/locale-context";
import { OrganizationSchema, WebsiteSchema } from "@/components/shared/structured-data";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: {
    default: "Tez Motors — Импорт авто из Китая в Узбекистан",
    template: "%s | Tez Motors",
  },
  description:
    "Импорт автомобилей из Китая в Узбекистан. Подбор, покупка и доставка авто под ключ. Прозрачные цены, гарантия, полное сопровождение.",
  keywords: [
    "импорт авто из Китая",
    "купить авто из Китая в Узбекистан",
    "Tez Motors",
    "китайские автомобили Ташкент",
    "BYD Узбекистан",
    "Chery Узбекистан",
    "Haval Узбекистан",
  ],
  authors: [{ name: "Tez Motors" }],
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "Tez Motors",
    title: "Tez Motors — Импорт авто из Китая в Узбекистан",
    description:
      "Подбор, покупка и доставка автомобилей из Китая. Прозрачные цены и полное сопровождение сделки.",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookie(cookieStore.get("NEXT_LOCALE")?.value);
  const dictionary = await getDictionary(locale);

  return (
    <html lang={locale} className={`${inter.variable} h-full antialiased`}>
      <head>
        <OrganizationSchema />
        <WebsiteSchema />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <LocaleProvider initialLocale={locale} initialDictionary={dictionary}>
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
