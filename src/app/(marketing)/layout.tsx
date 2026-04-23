import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { WhatsAppButton } from "@/components/shared/whatsapp-button";
import { ScrollToTop } from "@/components/shared/scroll-to-top";
import { CallbackWidget } from "@/components/shared/callback-widget";
import { FavoritesPill } from "@/components/shared/favorites-pill";
import { CookieConsent } from "@/components/shared/cookie-consent";
import { SiteSettingsProvider } from "@/lib/site-settings-context";
import { getSiteSettings } from "@/lib/site-settings-server";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSiteSettings();
  return (
    <SiteSettingsProvider value={settings}>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsAppButton />
      <CallbackWidget />
      <FavoritesPill />
      <ScrollToTop />
      <CookieConsent />
    </SiteSettingsProvider>
  );
}
