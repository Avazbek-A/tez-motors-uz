import { createServiceClient } from "@/lib/supabase/service";
import { brandSlug } from "@/lib/brands";

/**
 * Per-model landing pages mirror the brand pages (src/lib/brands.ts): every
 * (brand, model) in live inventory gets its own /catalog/brand/<brand>/<model>
 * page so we rank for the long-tail "<Brand> <Model> цена/Узбекистан" queries.
 * Models are derived from inventory (auto-covers new models on rebuild), ranked
 * by how many we have in stock (a demand proxy; used for sitemap priority too).
 */

/** URL-safe model slug — same rules as brandSlug ("Song Plus DM-i" → "song-plus-dm-i"). */
export function modelSlug(model: string): string {
  return model.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export interface InventoryModel {
  brand: string;
  model: string;
  count: number; // live (non-sold) listings of this model
}

let cache: InventoryModel[] | null = null;
let cachedAt = 0;
const TTL_MS = 10 * 60 * 1000;

/** Distinct (brand, model) pairs in live inventory, with availability count, busiest first. */
export async function getInventoryModels(): Promise<InventoryModel[]> {
  if (cache && Date.now() - cachedAt < TTL_MS) return cache;
  try {
    const supabase = createServiceClient();
    const { data } = await supabase.from("cars").select("brand, model").neq("inventory_status", "sold");
    const counts = new Map<string, InventoryModel>();
    for (const r of (data || []) as { brand: string | null; model: string | null }[]) {
      if (!r.brand || !r.model) continue;
      const key = `${r.brand}|||${r.model}`;
      const existing = counts.get(key);
      if (existing) existing.count += 1;
      else counts.set(key, { brand: r.brand, model: r.model, count: 1 });
    }
    const models = [...counts.values()].sort(
      (a, b) => b.count - a.count || a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model),
    );
    if (models.length) {
      cache = models;
      cachedAt = Date.now();
      return models;
    }
  } catch {
    // fall through to whatever we have cached (or empty)
  }
  return cache || [];
}

/** Models for one brand (exact brand string), busiest first. */
export async function getModelsForBrand(brand: string): Promise<InventoryModel[]> {
  return (await getInventoryModels()).filter((m) => m.brand === brand);
}

/** Resolve a (brandSlug, modelSlug) pair back to the exact inventory (brand, model). */
export async function modelFromSlug(bSlug: string, mSlug: string): Promise<InventoryModel | null> {
  const models = await getInventoryModels();
  return models.find((m) => brandSlug(m.brand) === bSlug && modelSlug(m.model) === mSlug) ?? null;
}
