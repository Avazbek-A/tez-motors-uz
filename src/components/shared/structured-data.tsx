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
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_CONFIG.name,
    url: SITE_CONFIG.url,
    logo: `${SITE_CONFIG.url}/images/logo.svg`,
    contactPoint: {
      "@type": "ContactPoint",
      telephone: SITE_CONFIG.phone,
      contactType: "sales",
      availableLanguage: ["Russian", "Uzbek", "English"],
    },
    address: {
      "@type": "PostalAddress",
      streetAddress: SITE_CONFIG.address,
      addressLocality: "Tashkent",
      addressCountry: "UZ",
    },
    sameAs: [
      SITE_CONFIG.telegram,
      SITE_CONFIG.instagram,
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
