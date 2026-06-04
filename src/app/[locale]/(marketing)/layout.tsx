import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { TelegramButton } from "@/components/shared/telegram-button";
import { WhatsAppButton } from "@/components/shared/whatsapp-button";
import { ScrollToTop } from "@/components/shared/scroll-to-top";
import { CallbackWidget } from "@/components/shared/callback-widget";
import { FavoritesPill } from "@/components/shared/favorites-pill";
import { CookieConsent } from "@/components/shared/cookie-consent";
import { TawkChat } from "@/components/shared/tawk-chat";
import { AttributionCapture } from "@/components/marketing/attribution-capture";
import { WebVitals } from "@/components/shared/web-vitals";
import { SiteSettingsProvider } from "@/lib/site-settings-context";
import { getSiteSettings } from "@/lib/site-settings-server";

export default async function LocaleMarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSiteSettings();
  return (
    <SiteSettingsProvider value={settings}>
      {/* Skip link — keyboard/screen-reader users jump straight to content (WCAG 2.4.1). */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Перейти к содержимому
      </a>
      <Header />
      <main id="main" className="flex-1">{children}</main>
      <Footer />
      {/* Floating contact stack — Telegram is the primary touch point in
          Uzbekistan; WhatsApp is kept as a secondary option above it. */}
      <TelegramButton />
      <WhatsAppButton />
      <CallbackWidget />
      <FavoritesPill />
      <ScrollToTop />
      <CookieConsent />
      <TawkChat />
      <AttributionCapture />
      <WebVitals />
    </SiteSettingsProvider>
  );
}
