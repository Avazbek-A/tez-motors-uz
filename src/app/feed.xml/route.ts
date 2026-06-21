import { createClient } from "@/lib/supabase/server";
import { SITE_CONFIG } from "@/lib/constants";

/**
 * RSS 2.0 feed of published blog posts (RU — the primary market). Complements the
 * sitemap + IndexNow for content discovery (Yandex and feed readers consume RSS),
 * and is a standard syndication asset. Revalidated hourly.
 */
export const revalidate = 3600;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET() {
  let items = "";
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("posts")
      .select("slug, title_ru, meta_description_ru, body_ru, published_at, updated_at")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(50);

    items = ((data || []) as Array<{
      slug: string;
      title_ru: string | null;
      meta_description_ru: string | null;
      body_ru: string | null;
      published_at: string | null;
      updated_at: string | null;
    }>)
      .map((p) => {
        const url = `${SITE_CONFIG.url}/ru/blog/${p.slug}`;
        const desc =
          p.meta_description_ru ||
          (p.body_ru || "").replace(/[#*`>_[\]()-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
        const date = new Date(p.published_at || p.updated_at || Date.now()).toUTCString();
        return `    <item>\n      <title>${esc(p.title_ru || "")}</title>\n      <link>${url}</link>\n      <guid isPermaLink="true">${url}</guid>\n      <description>${esc(desc)}</description>\n      <pubDate>${date}</pubDate>\n    </item>`;
      })
      .join("\n");
  } catch {
    /* empty feed on DB error */
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Tez Motors — Блог</title>
    <link>${SITE_CONFIG.url}/ru/blog</link>
    <atom:link href="${SITE_CONFIG.url}/feed.xml" rel="self" type="application/rss+xml" />
    <description>Импорт авто из Китая в Узбекистан: гайды по растаможке, электромобили, аналитика рынка.</description>
    <language>ru</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
