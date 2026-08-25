import { Hero } from "@/components/sections/hero";
import { Features } from "@/components/sections/features";
import { Brands } from "@/components/sections/brands";
import { HotOffers } from "@/components/sections/hot-offers";
import { ForYou } from "@/components/sections/for-you";
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
import { createClient } from "@/lib/supabase/server";
import { scrubCarsForPublic } from "@/lib/cars-query";
import { PUBLIC_CAR_LIST_COLUMNS } from "@/lib/car-columns";
import type { Car } from "@/types/car";

export default async function HomePage() {
  const supabase = await createClient();

  const [carsResult, partsResult, reviewsResult, faqsResult] = await Promise.all([
    supabase
      .from("cars")
      .select(PUBLIC_CAR_LIST_COLUMNS)
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
      .order("order_position")
      .limit(6), // homepage shows a teaser row; full list lives on /reviews
    supabase
      .from("faqs")
      .select("*")
      .eq("is_published", true)
      .order("order_position")
      .limit(5),
  ]);

  // The rail is the homepage's only inventory: when nobody has flagged a car as
  // a hot offer (which is the standing state — the flag is dealer-curated and
  // stays empty for long stretches) the section rendered its heading over an
  // empty grid. Fall back to the newest available cars so a first-time visitor
  // always lands on real stock. Ordered like the catalog's default sort
  // (newest model year first) so the rail leads with current stock.
  let hotOfferRows = carsResult.data || [];
  if (hotOfferRows.length === 0) {
    const { data: newest } = await supabase
      .from("cars")
      .select(PUBLIC_CAR_LIST_COLUMNS)
      .eq("is_available", true)
      .neq("inventory_status", "sold")
      .order("year", { ascending: false })
      .order("order_position")
      .limit(12);
    hotOfferRows = newest || [];
  }

  // Scrub internal spec_data fields before these rows are serialized into the
  // client RSC payload (CarCard is a client component — the whole car prop ships).
  const hotOfferCars = scrubCarsForPublic(hotOfferRows as unknown as Car[]);
  const hotParts = partsResult.data || [];
  const publishedReviews = reviewsResult.data || [];
  const publishedFaqs = faqsResult.data || [];

  // Chrome (Header / Footer / widgets / <main>) is provided by the
  // [locale]/(marketing)/layout.tsx that renders this page — do NOT repeat it
  // here, or the homepage double-renders the header + footer.
  return (
    <>
      <Hero />
      <Features />
      <Brands />
      <HotOffers cars={hotOfferCars} />
      <ForYou />
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
    </>
  );
}
