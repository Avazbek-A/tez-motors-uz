import { createClient } from "@/lib/supabase/server";
import { SITE_CONFIG } from "@/lib/constants";

/**
 * Server-side fetch of the cars on a collection page (brand / filter), used to
 * emit ItemList JSON-LD so Google/Yandex see the inventory even though the visual
 * grid (CatalogContent) is client-rendered. Light projection (slug + name fields
 * only); cheapest first; capped.
 */
export async function fetchCollectionItems(
  filters: { brand?: string; fuel_type?: string; body_type?: string },
  locale: string,
  limit = 30,
): Promise<Array<{ name: string; url: string }>> {
  try {
    const supabase = await createClient();
    let q = supabase
      .from("cars")
      .select("slug, brand, model, year")
      .neq("inventory_status", "sold");
    if (filters.brand) q = q.eq("brand", filters.brand);
    if (filters.fuel_type) q = q.eq("fuel_type", filters.fuel_type);
    if (filters.body_type) q = q.eq("body_type", filters.body_type);
    const { data } = await q.order("price_usd", { ascending: true }).limit(limit);
    return ((data || []) as { slug: string; brand: string; model: string; year: number }[]).map((c) => ({
      name: `${c.brand} ${c.model} ${c.year}`,
      url: `${SITE_CONFIG.url}/${locale}/catalog/${c.slug}`,
    }));
  } catch {
    return [];
  }
}
