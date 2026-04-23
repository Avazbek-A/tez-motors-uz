import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { locales } from "@/i18n/config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://tezmotors.uz";

  const staticPaths = [
    { path: "", changeFrequency: "daily" as const, priority: 1 },
    { path: "/catalog", changeFrequency: "daily" as const, priority: 0.9 },
    { path: "/calculator", changeFrequency: "monthly" as const, priority: 0.8 },
    { path: "/about", changeFrequency: "monthly" as const, priority: 0.7 },
    { path: "/sell-your-car", changeFrequency: "monthly" as const, priority: 0.7 },
    { path: "/faq", changeFrequency: "weekly" as const, priority: 0.7 },
    { path: "/contacts", changeFrequency: "monthly" as const, priority: 0.8 },
    { path: "/blog", changeFrequency: "weekly" as const, priority: 0.7 },
    { path: "/parts", changeFrequency: "weekly" as const, priority: 0.7 },
    { path: "/favorites", changeFrequency: "monthly" as const, priority: 0.3 },
  ];

  const alternatesFor = (path: string) => {
    const languages = Object.fromEntries(
      locales.map((locale) => [locale, `${baseUrl}/${locale}${path}`]),
    );
    return { languages } as const;
  };

  const staticPages = staticPaths.flatMap(({ path, changeFrequency, priority }) =>
    locales.map((locale) => ({
      url: `${baseUrl}/${locale}${path}`,
      lastModified: new Date(),
      changeFrequency,
      priority,
      alternates: alternatesFor(path),
    })),
  );

  try {
    const supabase = await createClient();
    const { data: cars } = await supabase
      .from("cars")
      .select("slug, updated_at")
      .eq("inventory_status", "available");

    const carPages = (cars || []).flatMap((car) =>
      locales.map((locale) => ({
        url: `${baseUrl}/${locale}/catalog/${car.slug}`,
        lastModified: new Date(car.updated_at),
        changeFrequency: "weekly" as const,
        priority: 0.6,
        alternates: alternatesFor(`/catalog/${car.slug}`),
      })),
    );

    const { data: posts } = await supabase
      .from("posts")
      .select("slug, updated_at, published_at")
      .eq("is_published", true);

    const blogPages = (posts || []).flatMap((post) =>
      locales.map((locale) => ({
        url: `${baseUrl}/${locale}/blog/${post.slug}`,
        lastModified: new Date(post.updated_at || post.published_at || new Date()),
        changeFrequency: "weekly" as const,
        priority: 0.5,
        alternates: alternatesFor(`/blog/${post.slug}`),
      })),
    );

    const { data: parts } = await supabase
      .from("parts")
      .select("slug, updated_at")
      .eq("is_published", true);

    const partPages = (parts || []).flatMap((part) =>
      locales.map((locale) => ({
        url: `${baseUrl}/${locale}/parts/${part.slug}`,
        lastModified: new Date(part.updated_at),
        changeFrequency: "weekly" as const,
        priority: 0.5,
        alternates: alternatesFor(`/parts/${part.slug}`),
      })),
    );

    return [...staticPages, ...carPages, ...blogPages, ...partPages];
  } catch {
    return staticPages;
  }
}
