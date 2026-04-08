import { NextResponse } from "next/server";
import { MOCK_CARS, MOCK_REVIEWS, MOCK_FAQS } from "@/lib/mock-data";

export async function GET() {
  // In production, these would be Supabase queries
  const totalCars = MOCK_CARS.length;
  const availableCars = MOCK_CARS.filter((c) => c.is_available).length;
  const hotOffers = MOCK_CARS.filter((c) => c.is_hot_offer).length;
  const totalReviews = MOCK_REVIEWS.filter((r) => r.is_published).length;
  const totalFaqs = MOCK_FAQS.filter((f) => f.is_published).length;

  const brandCounts: Record<string, number> = {};
  MOCK_CARS.forEach((car) => {
    brandCounts[car.brand] = (brandCounts[car.brand] || 0) + 1;
  });

  const bodyTypeCounts: Record<string, number> = {};
  MOCK_CARS.forEach((car) => {
    bodyTypeCounts[car.body_type] = (bodyTypeCounts[car.body_type] || 0) + 1;
  });

  const fuelTypeCounts: Record<string, number> = {};
  MOCK_CARS.forEach((car) => {
    fuelTypeCounts[car.fuel_type] = (fuelTypeCounts[car.fuel_type] || 0) + 1;
  });

  const avgPrice = Math.round(MOCK_CARS.reduce((s, c) => s + c.price_usd, 0) / totalCars);
  const minPrice = Math.min(...MOCK_CARS.map((c) => c.price_usd));
  const maxPrice = Math.max(...MOCK_CARS.map((c) => c.price_usd));

  return NextResponse.json({
    cars: {
      total: totalCars,
      available: availableCars,
      hotOffers,
      avgPrice,
      minPrice,
      maxPrice,
      byBrand: brandCounts,
      byBodyType: bodyTypeCounts,
      byFuelType: fuelTypeCounts,
    },
    reviews: { total: totalReviews },
    faqs: { total: totalFaqs },
    generatedAt: new Date().toISOString(),
  });
}
