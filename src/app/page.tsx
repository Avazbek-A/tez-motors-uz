import { Hero } from "@/components/sections/hero";
import { Features } from "@/components/sections/features";
import { Brands } from "@/components/sections/brands";
import { HotOffers } from "@/components/sections/hot-offers";
import { HotParts } from "@/components/sections/hot-parts";
import { WhyChina } from "@/components/sections/why-china";
import { ProcessTimeline } from "@/components/sections/process-timeline";
import { Guarantees } from "@/components/sections/guarantees";
import { PricingComparison } from "@/components/sections/pricing-comparison";
import { VideoReviews } from "@/components/sections/video-reviews";
import { Reviews } from "@/components/sections/reviews";
import { FAQPreview } from "@/components/sections/faq-preview";
import { ContactForm } from "@/components/sections/contact-form";
import { CtaBanner } from "@/components/sections/cta-banner";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { WhatsAppButton } from "@/components/shared/whatsapp-button";
import { ScrollToTop } from "@/components/shared/scroll-to-top";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();

  const [carsResult, partsResult, reviewsResult, faqsResult] = await Promise.all([
    supabase
      .from("cars")
      .select("*")
      .eq("is_available", true)
      .eq("is_hot_offer", true)
      .order("order_position")
      .limit(12),
    supabase
      .from("parts")
      .select("id, slug, name_ru, name_uz, name_en, oem_number, images, stock_qty, price_usd")
      .eq("is_published", true)
      .order("order_position")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("reviews")
      .select("*")
      .eq("is_published", true)
      .order("order_position"),
    supabase
      .from("faqs")
      .select("*")
      .eq("is_published", true)
      .order("order_position")
      .limit(5),
  ]);

  const hotOfferCars = carsResult.data || [];
  const hotParts = partsResult.data || [];
  const publishedReviews = reviewsResult.data || [];
  const publishedFaqs = faqsResult.data || [];

  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero />
        <Features />
        <Brands />
        <HotOffers cars={hotOfferCars} />
        <HotParts parts={hotParts} />
        <WhyChina />
        <ProcessTimeline />
        <Guarantees />
        <PricingComparison />
        <VideoReviews />
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
