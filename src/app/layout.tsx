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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://tezmotors.uz"),
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
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Tez Motors",
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "Tez Motors",
    title: "Tez Motors — Импорт авто из Китая в Узбекистан",
    description:
      "Подбор, покупка и доставка автомобилей из Китая. Прозрачные цены и полное сопровождение сделки.",
    images: [{ url: "/opengraph-image" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tez Motors — Импорт авто из Китая",
    description: "Подбор, покупка и доставка автомобилей из Китая в Узбекистан.",
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
        {process.env.NEXT_PUBLIC_TAWK_ID && (
          <Script id="tawk-loader" strategy="afterInteractive">
            {`var Tawk_API=Tawk_API||{},Tawk_LoadStart=new Date();(function(){var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];s1.async=true;s1.src="https://embed.tawk.to/${process.env.NEXT_PUBLIC_TAWK_ID}/1";s1.charset="UTF-8";s1.setAttribute("crossorigin","*");s0.parentNode.insertBefore(s1,s0);})();`}
          </Script>
        )}
        <LocaleProvider initialLocale={locale} initialDictionary={dictionary}>
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
