import type { Metadata } from "next";
import Script from "next/script";
import { Inter, JetBrains_Mono } from "next/font/google";
import { cookies, headers } from "next/headers";
import { getLocaleFromCookie } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { LocaleProvider } from "@/i18n/locale-context";
import { OrganizationSchema, WebsiteSchema } from "@/components/shared/structured-data";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "700"],
});

// OG locale codes per Open Graph spec.
const OG_LOCALES: Record<"ru" | "uz" | "en", string> = {
  ru: "ru_RU",
  uz: "uz_UZ",
  en: "en_US",
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale =
    (requestHeaders.get("x-tez-locale") as "ru" | "uz" | "en" | null) ??
    getLocaleFromCookie(cookieStore.get("NEXT_LOCALE")?.value);

  const ogLocale = OG_LOCALES[locale];
  const ogAlternates = (Object.keys(OG_LOCALES) as (keyof typeof OG_LOCALES)[])
    .filter((l) => l !== locale)
    .map((l) => OG_LOCALES[l]);

  return {
    ...rootMetadata,
    openGraph: {
      ...rootMetadata.openGraph,
      locale: ogLocale,
      alternateLocale: ogAlternates,
    },
  };
}

const rootMetadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://tezmotors.uz"),
  title: {
    default: "Tez Motors — Импорт авто из Китая в Узбекистан",
    template: "%s | Tez Motors",
  },
  description:
    "Импорт автомобилей из Китая в Узбекистан. BYD, Chery, Haval, Geely, Changan. Подбор, доставка, таможня, гарантия — под ключ.",
  keywords: [
    "импорт авто из Китая",
    "купить авто из Китая в Узбекистан",
    "Tez Motors",
    "китайские автомобили Ташкент",
    "BYD в Ташкенте",
    "Chery Узбекистан",
    "Haval Узбекистан",
    "Geely Узбекистан",
    "Changan Ташкент",
  ],
  authors: [{ name: "Tez Motors" }],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Tez Motors",
  },
  openGraph: {
    type: "website",
    siteName: "Tez Motors",
    title: "Tez Motors — Импорт авто из Китая в Узбекистан",
    description:
      "Импорт автомобилей из Китая под ключ: BYD, Chery, Haval, Geely. Подбор, доставка, таможня, гарантия.",
    images: [{ url: "/opengraph-image" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tez Motors — Импорт авто из Китая",
    description:
      "Импорт автомобилей из Китая в Узбекистан под ключ. BYD, Chery, Haval, Geely.",
    images: ["/opengraph-image"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const locale =
    (requestHeaders.get("x-tez-locale") as "ru" | "uz" | "en" | null) ??
    getLocaleFromCookie(cookieStore.get("NEXT_LOCALE")?.value);
  const dictionary = await getDictionary(locale);

  return (
    <html lang={locale} className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <head>
        <link
          rel="preconnect"
          href={process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://wyivyvoljvplkdrjmpox.supabase.co"}
          crossOrigin="anonymous"
        />
        {/* dns-prefetch is cheap; only used if/when these are loaded. */}
        <link rel="dns-prefetch" href="https://plausible.io" />
        <link rel="dns-prefetch" href="https://embed.tawk.to" />
        <link rel="dns-prefetch" href="https://challenges.cloudflare.com" />

        {/* Search-engine + AI-platform verification.
            Codes are env-gated so the dealer can paste new ones without
            a code change. Each platform requires registering the
            property at its console (Google Search Console, Yandex
            Webmaster, Bing Webmaster Tools) and pasting the code into
            the matching env var. */}
        {process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION && (
          <meta name="google-site-verification" content={process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION} />
        )}
        {process.env.NEXT_PUBLIC_YANDEX_VERIFICATION && (
          <meta name="yandex-verification" content={process.env.NEXT_PUBLIC_YANDEX_VERIFICATION} />
        )}
        {process.env.NEXT_PUBLIC_BING_VERIFICATION && (
          <meta name="msvalidate.01" content={process.env.NEXT_PUBLIC_BING_VERIFICATION} />
        )}

        {/* Apple Spotlight / Siri pick up these tags when ranking results. */}
        <meta name="application-name" content="Tez Motors" />
        <meta name="apple-mobile-web-app-title" content="Tez Motors" />
        <meta name="theme-color" content="#0a0a0f" />
        <meta name="msapplication-TileColor" content="#0a0a0f" />

        <OrganizationSchema />
        <WebsiteSchema />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
          <Script
            defer
            src="https://plausible.io/js/script.js"
            data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
            strategy="afterInteractive"
          />
        )}
        {/* Tawk widget is mounted once via the marketing-layout
            <TawkChat /> component, with deferred loading. Don't double-load
            here — that was costing every visitor a 100kB+ duplicate fetch. */}
        <LocaleProvider initialLocale={locale} initialDictionary={dictionary}>
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
