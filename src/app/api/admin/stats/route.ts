import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: Request) {
  const unauth = await requireAdmin(request);
  if (unauth) return unauth;
  try {
    const supabase = createServiceClient();

    // Fetch all data in parallel
    const [carsResult, reviewsResult, faqsResult, inquiriesResult] = await Promise.all([
      supabase.from("cars").select("*"),
      supabase.from("reviews").select("*"),
      supabase.from("faqs").select("*"),
      supabase.from("inquiries").select("*"),
    ]);

    const cars = carsResult.data || [];
    const reviews = reviewsResult.data || [];
    const faqs = faqsResult.data || [];
    const inquiries = inquiriesResult.data || [];

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
