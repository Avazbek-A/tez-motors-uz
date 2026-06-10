import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: Request) {
  const unauth = await requireAdmin(request);
  if (unauth) return unauth;
  try {
    const supabase = createServiceClient();

    // Fetch all rows (paginated, narrowed columns) so the counts/avg/min/max are
    // computed over the FULL tables, not just the first page (PostgREST's
    // db-max-rows cap) — otherwise totals + average price undercount past ~1000.
    const [cars, reviews, faqs, inquiries] = await Promise.all([
      fetchAllRows<{ inventory_status: string; is_hot_offer: boolean; brand: string; body_type: string; fuel_type: string; price_usd: number }>(
        (from, to) => supabase.from("cars").select("inventory_status, is_hot_offer, brand, body_type, fuel_type, price_usd").range(from, to)),
      fetchAllRows<{ is_published: boolean }>((from, to) => supabase.from("reviews").select("is_published").range(from, to)),
      fetchAllRows<{ is_published: boolean }>((from, to) => supabase.from("faqs").select("is_published").range(from, to)),
      fetchAllRows<{ status: string }>((from, to) => supabase.from("inquiries").select("status").range(from, to)),
    ]);

    const totalCars = cars.length;
    const availableCars = cars.filter((c) => c.inventory_status === "available").length;
    const reservedCars = cars.filter((c) => c.inventory_status === "reserved").length;
    const soldCars = cars.filter((c) => c.inventory_status === "sold").length;
    const hotOffers = cars.filter((c) => c.is_hot_offer).length;

    const brandCounts: Record<string, number> = {};
    cars.forEach((car) => {
      brandCounts[car.brand] = (brandCounts[car.brand] || 0) + 1;
    });

    const bodyTypeCounts: Record<string, number> = {};
    cars.forEach((car) => {
      bodyTypeCounts[car.body_type] = (bodyTypeCounts[car.body_type] || 0) + 1;
    });

    const fuelTypeCounts: Record<string, number> = {};
    cars.forEach((car) => {
      fuelTypeCounts[car.fuel_type] = (fuelTypeCounts[car.fuel_type] || 0) + 1;
    });

    const prices = cars.map((c) => c.price_usd);
    const avgPrice = totalCars > 0 ? Math.round(prices.reduce((s, p) => s + p, 0) / totalCars) : 0;
    const minPrice = totalCars > 0 ? Math.min(...prices) : 0;
    const maxPrice = totalCars > 0 ? Math.max(...prices) : 0;

    return NextResponse.json({
      cars: {
        total: totalCars,
        available: availableCars,
        reserved: reservedCars,
        sold: soldCars,
        hotOffers,
        avgPrice,
        minPrice,
        maxPrice,
        byBrand: brandCounts,
        byBodyType: bodyTypeCounts,
        byFuelType: fuelTypeCounts,
      },
      reviews: {
        total: reviews.filter((r) => r.is_published).length,
        pending: reviews.filter((r) => !r.is_published).length,
      },
      faqs: { total: faqs.filter((f) => f.is_published).length },
      inquiries: {
        total: inquiries.length,
        new: inquiries.filter((i) => i.status === "new").length,
        contacted: inquiries.filter((i) => i.status === "contacted").length,
        in_progress: inquiries.filter((i) => i.status === "in_progress").length,
        closed: inquiries.filter((i) => i.status === "closed").length,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Stats error:", err);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
