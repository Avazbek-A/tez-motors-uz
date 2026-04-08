import { NextRequest, NextResponse } from "next/server";
import { MOCK_CARS } from "@/lib/mock-data";

// GET all cars with optional filters
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const brand = searchParams.get("brand");
  const bodyType = searchParams.get("body_type");
  const fuelType = searchParams.get("fuel_type");
  const priceMin = searchParams.get("price_min");
  const priceMax = searchParams.get("price_max");
  const hotOnly = searchParams.get("hot_only");
  const search = searchParams.get("search");

  let cars = [...MOCK_CARS];

  if (brand) cars = cars.filter((c) => c.brand === brand);
  if (bodyType) cars = cars.filter((c) => c.body_type === bodyType);
  if (fuelType) cars = cars.filter((c) => c.fuel_type === fuelType);
  if (priceMin) cars = cars.filter((c) => c.price_usd >= parseInt(priceMin));
  if (priceMax) cars = cars.filter((c) => c.price_usd <= parseInt(priceMax));
  if (hotOnly === "true") cars = cars.filter((c) => c.is_hot_offer);
  if (search) {
    const q = search.toLowerCase();
    cars = cars.filter((c) =>
      `${c.brand} ${c.model}`.toLowerCase().includes(q)
    );
  }

  return NextResponse.json({
    cars,
    total: cars.length,
    filters: { brand, bodyType, fuelType, priceMin, priceMax },
  });
}

// POST - add a new car (admin)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // TODO: validate with carSchema and insert into Supabase
    const newCar = {
      id: crypto.randomUUID(),
      slug: `${body.brand}-${body.model}-${body.year}`.toLowerCase().replace(/\s+/g, "-"),
      ...body,
      images: body.images || [],
      thumbnail: body.thumbnail || null,
      is_hot_offer: body.is_hot_offer || false,
      is_available: body.is_available ?? true,
      order_position: 0,
      specs: body.specs || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, car: newCar }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to create car" }, { status: 500 });
  }
}
