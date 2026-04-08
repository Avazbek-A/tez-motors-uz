import { Hero } from "@/components/sections/hero";
import { Features } from "@/components/sections/features";
import { Brands } from "@/components/sections/brands";
import { HotOffers } from "@/components/sections/hot-offers";
import { WhyChina } from "@/components/sections/why-china";
import { ProcessTimeline } from "@/components/sections/process-timeline";
import { Guarantees } from "@/components/sections/guarantees";
import { PricingComparison } from "@/components/sections/pricing-comparison";
import { Reviews } from "@/components/sections/reviews";
import { FAQPreview } from "@/components/sections/faq-preview";
import { ContactForm } from "@/components/sections/contact-form";
import { CtaBanner } from "@/components/sections/cta-banner";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { WhatsAppButton } from "@/components/shared/whatsapp-button";
import { ScrollToTop } from "@/components/shared/scroll-to-top";
import { MOCK_CARS, MOCK_REVIEWS, MOCK_FAQS } from "@/lib/mock-data";

export default function HomePage() {
  const hotOfferCars = MOCK_CARS.filter((c) => c.is_hot_offer).slice(0, 12);
  const publishedReviews = MOCK_REVIEWS.filter((r) => r.is_published);
  const publishedFaqs = MOCK_FAQS.filter((f) => f.is_published).slice(0, 5);

  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero />
        <Features />
        <Brands />
        <HotOffers cars={hotOfferCars} />
        <WhyChina />
        <ProcessTimeline />
        <Guarantees />
        <PricingComparison />
        <Reviews reviews={publishedReviews} />
        <FAQPreview faqs={publishedFaqs} />
        <ContactForm />
        <CtaBanner />
      </main>
      <Footer />
      <WhatsAppButton />
      <ScrollToTop />
    </>
  );
}
