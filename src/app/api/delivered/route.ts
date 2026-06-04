import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Public "delivered cars" proof feed (Phase AL — trust engine).
 *
 * Importer trust ("will they actually deliver my car from China?") is the #1
 * conversion blocker. This returns recently DELIVERED orders as anonymized
 * social proof — car make/model/year + image + delivery month + a masked
 * customer initial only. NO phone, email, name, reference code, or amount: the
 * orders table is service-role-locked and we deliberately project only
 * non-PII fields. Cached.
 */
export const revalidate = 1800;

interface DeliveredRow {
  updated_at: string;
  customer_name: string | null;
  cars: { brand: string; model: string; year: number | null; slug: string; thumbnail: string | null; images: string[] | null }
    | { brand: string; model: string; year: number | null; slug: string; thumbnail: string | null; images: string[] | null }[]
    | null;
}

function initial(name: string | null): string {
  const t = (name || "").trim();
  return t ? `${t[0].toUpperCase()}.` : "—";
}

export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("orders")
      .select("updated_at, customer_name, cars(brand, model, year, slug, thumbnail, images)")
      .eq("status", "delivered")
      .order("updated_at", { ascending: false })
      .limit(48);

    const items = ((data as DeliveredRow[]) || [])
      .map((o) => {
        const rel = o.cars;
        const car = Array.isArray(rel) ? rel[0] : rel;
        if (!car) return null;
        const image = car.thumbnail || (Array.isArray(car.images) ? car.images[0] : null);
        return {
          brand: car.brand,
          model: car.model,
          year: car.year,
          slug: car.slug,
          image,
          delivered_month: (o.updated_at || "").slice(0, 7), // YYYY-MM
          customer_initial: initial(o.customer_name),
        };
      })
      .filter(Boolean);

    return NextResponse.json(
      { count: items.length, delivered: items },
      { headers: { "cache-control": "public, s-maxage=1800, stale-while-revalidate=86400" } },
    );
  } catch {
    return NextResponse.json({ count: 0, delivered: [] });
  }
}
