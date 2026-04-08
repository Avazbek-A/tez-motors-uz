import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { WhatsAppButton } from "@/components/shared/whatsapp-button";
import { ScrollToTop } from "@/components/shared/scroll-to-top";
import { CallbackWidget } from "@/components/shared/callback-widget";
import { CookieConsent } from "@/components/shared/cookie-consent";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsAppButton />
      <CallbackWidget />
      <ScrollToTop />
      <CookieConsent />
    </>
  );
}
