import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://tezmotors.uz";

  const staticPages = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily" as const, priority: 1 },
    { url: `${baseUrl}/catalog`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.9 },
    { url: `${baseUrl}/calculator`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.8 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.7 },
    { url: `${baseUrl}/faq`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.7 },
    { url: `${baseUrl}/contacts`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.8 },
  ];

  try {
    const supabase = await createClient();
    const { data: cars } = await supabase
      .from("cars")
      .select("slug, updated_at")
      .eq("is_available", true);

    const carPages = (cars || []).map((car) => ({
      url: `${baseUrl}/catalog/${car.slug}`,
      lastModified: new Date(car.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

    return [...staticPages, ...carPages];
  } catch {
    return staticPages;
  }
}
