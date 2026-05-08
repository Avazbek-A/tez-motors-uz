import { SITE_CONFIG } from "@/lib/constants";
import type { Car } from "@/types/car";

interface FAQItem {
  question: string;
  answer: string;
}

export function FAQSchema({ faqs }: { faqs: FAQItem[] }) {
  if (!faqs || faqs.length === 0) return null;

  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function OrganizationSchema() {
  // We declare ourselves as both AutoDealer and LocalBusiness — these
  // are the schemas Yandex, Google, Apple Maps, and Bing actively
  // consume when answering "best <thing> near me" / "<thing> in <city>"
  // queries. AutoDealer is the most specific applicable type and is
  // recommended by Google for car dealerships.
  const schema = {
    "@context": "https://schema.org",
    "@type": ["AutoDealer", "LocalBusiness"],
    "@id": `${SITE_CONFIG.url}/#organization`,
    name: SITE_CONFIG.name,
    legalName: "Tez Motors",
    url: SITE_CONFIG.url,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_CONFIG.url}/images/logo.svg`,
    },
    image: `${SITE_CONFIG.url}/opengraph-image`,
    description:
      "Импортёр автомобилей из Китая в Узбекистан. BYD, Chery, Haval, Geely, Changan, Tank, Omoda, Jaecoo и другие бренды. Подбор, доставка, таможня, гарантия — под ключ.",
    telephone: SITE_CONFIG.phone,
    email: SITE_CONFIG.email,
    priceRange: "$$",
    foundingDate: "2024",
    address: {
      "@type": "PostalAddress",
      streetAddress: "ул. Катартал, 25",
      addressLocality: "Ташкент",
      addressRegion: "Чиланзарский район",
      addressCountry: "UZ",
      postalCode: "100185",
    },
    geo: {
      "@type": "GeoCoordinates",
      // Approximate Chilanzar district coordinates; refine when the
      // dealer confirms the exact lat/lng of the showroom.
      latitude: 41.2754,
      longitude: 69.2046,
    },
    areaServed: [
      { "@type": "City", name: "Ташкент" },
      { "@type": "City", name: "Самарканд" },
      { "@type": "City", name: "Бухара" },
      { "@type": "City", name: "Андижан" },
      { "@type": "City", name: "Фергана" },
      { "@type": "City", name: "Наманган" },
      { "@type": "Country", name: "Uzbekistan" },
    ],
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        opens: "09:00",
        closes: "19:00",
      },
    ],
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: SITE_CONFIG.phone,
        contactType: "sales",
        areaServed: "UZ",
        availableLanguage: ["Russian", "Uzbek", "English"],
      },
      {
        "@type": "ContactPoint",
        contactType: "customer service",
        url: SITE_CONFIG.whatsapp,
        availableLanguage: ["Russian", "Uzbek"],
      },
    ],
    brand: [
      { "@type": "Brand", name: "BYD" },
      { "@type": "Brand", name: "Chery" },
      { "@type": "Brand", name: "Haval" },
      { "@type": "Brand", name: "Geely" },
      { "@type": "Brand", name: "Changan" },
      { "@type": "Brand", name: "Tank" },
      { "@type": "Brand", name: "Omoda" },
      { "@type": "Brand", name: "Jaecoo" },
      { "@type": "Brand", name: "MG" },
      { "@type": "Brand", name: "Great Wall" },
    ],
    makesOffer: {
      "@type": "Service",
      name: "Импорт автомобилей из Китая",
      serviceType: "Car import",
      provider: { "@id": `${SITE_CONFIG.url}/#organization` },
      areaServed: { "@type": "Country", name: "Uzbekistan" },
    },
    sameAs: [
      SITE_CONFIG.telegram,
      SITE_CONFIG.instagram,
      "https://www.instagram.com/tezmotors_uz",
      "https://t.me/tezmotors",
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function CarSchema({
  car,
  aggregate,
}: {
  car: Car;
  /**
   * Optional aggregate review data for this specific car. When passed and
   * `count >= 1`, an AggregateRating block is added to the Product
   * schema — this enables ★ ratings in Google search results.
   */
  aggregate?: { ratingValue: number; count: number } | null;
}) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${car.brand} ${car.model} ${car.year}`,
    description: car.description_ru || `${car.brand} ${car.model} ${car.year} - import from China`,
    brand: {
      "@type": "Brand",
      name: car.brand,
    },
    offers: {
      "@type": "Offer",
      price: car.price_usd,
      priceCurrency: "USD",
      availability: car.is_available
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: {
        "@type": "Organization",
        name: SITE_CONFIG.name,
      },
    },
    vehicleConfiguration: car.transmission,
    fuelType: car.fuel_type,
    vehicleEngine: car.engine_volume
      ? { "@type": "EngineSpecification", displacement: `${car.engine_volume}L` }
      : undefined,
    modelDate: car.year.toString(),
  };

  if (aggregate && aggregate.count > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: aggregate.ratingValue.toFixed(1),
      reviewCount: aggregate.count,
      bestRating: "5",
      worstRating: "1",
    };
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function BlogPostingSchema({
  headline,
  description,
  image,
  datePublished,
  dateModified,
  url,
}: {
  headline: string;
  description?: string;
  image?: string;
  datePublished: string;
  dateModified?: string;
  url: string;
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline,
    description,
    image: image ? [image] : undefined,
    datePublished,
    dateModified: dateModified ?? datePublished,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: {
      "@type": "Organization",
      name: SITE_CONFIG.name,
      url: SITE_CONFIG.url,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_CONFIG.name,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_CONFIG.url}/images/logo.svg`,
      },
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function WebsiteSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_CONFIG.name,
    url: SITE_CONFIG.url,
    description: "Import cars from China to Uzbekistan",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_CONFIG.url}/catalog?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
