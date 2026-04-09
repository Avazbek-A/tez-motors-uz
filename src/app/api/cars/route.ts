import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { carWriteSchema } from "@/lib/schemas/car";

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
  const all = searchParams.get("all"); // admin: include unavailable
  const limit = searchParams.get("limit");
  const ids = searchParams.get("ids"); // comma-separated IDs
  const page = searchParams.get("page");
  const pageSize = searchParams.get("page_size");

  try {
    const supabase = await createClient();

    // Pagination mode: use count + range
    if (page !== null) {
      const size = Math.min(parseInt(pageSize || "12") || 12, 50);
      const pageNum = Math.max(parseInt(page) || 1, 1);
      const offset = (pageNum - 1) * size;

      let query = supabase
        .from("cars")
        .select("*", { count: "exact" });

      if (!all) query = query.eq("is_available", true);
      if (brand) query = query.eq("brand", brand);
      if (bodyType) query = query.eq("body_type", bodyType);
      if (fuelType) query = query.eq("fuel_type", fuelType);
      if (priceMin) query = query.gte("price_usd", parseInt(priceMin));
      if (priceMax) query = query.lte("price_usd", parseInt(priceMax));
      if (hotOnly === "true") query = query.eq("is_hot_offer", true);
      if (search) query = query.or(`brand.ilike.%${search}%,model.ilike.%${search}%`);
      if (ids) {
        const idList = ids.split(",").filter(Boolean);
        if (idList.length > 0) query = query.in("id", idList);
      }

      query = query
        .order("order_position", { ascending: true })
        .order("created_at", { ascending: false })
        .range(offset, offset + size - 1);

      const { data: cars, error, count } = await query;

      if (error) {
        console.error("Supabase error:", error);
        return NextResponse.json({ cars: [], total: 0, error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        cars: cars || [],
        total: count || 0,
        page: pageNum,
        page_size: size,
      });
    }

    // Legacy mode (no pagination)
    let query = supabase.from("cars").select("*");

    if (!all) {
      query = query.eq("is_available", true);
    }
    if (brand) query = query.eq("brand", brand);
    if (bodyType) query = query.eq("body_type", bodyType);
    if (fuelType) query = query.eq("fuel_type", fuelType);
    if (priceMin) query = query.gte("price_usd", parseInt(priceMin));
    if (priceMax) query = query.lte("price_usd", parseInt(priceMax));
    if (hotOnly === "true") query = query.eq("is_hot_offer", true);
    if (search) {
      query = query.or(`brand.ilike.%${search}%,model.ilike.%${search}%`);
    }
    if (ids) {
      const idList = ids.split(",").filter(Boolean);
      if (idList.length > 0) query = query.in("id", idList);
    }

    query = query.order("order_position", { ascending: true }).order("created_at", { ascending: false });

    if (limit) query = query.limit(parseInt(limit));

    const { data: cars, error } = await query;

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ cars: [], total: 0, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      cars: cars || [],
      total: cars?.length || 0,
      filters: { brand, bodyType, fuelType, priceMin, priceMax },
    });
  } catch (err) {
    console.error("API error:", err);
    return NextResponse.json({ cars: [], total: 0, error: "Internal server error" }, { status: 500 });
  }
}

// POST - add a new car (admin)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = carWriteSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, errors: result.error.issues },
        { status: 400 }
      );
    }

    const data = result.data;
    const supabase = await createClient();

    const slug = `${data.brand}-${data.model}-${data.year}`
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    const { data: car, error } = await supabase
      .from("cars")
      .insert({ ...data, slug })
      .select()
      .single();

    if (error) {
      console.error("Insert error:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, car }, { status: 201 });
  } catch (err) {
    console.error("POST error:", err);
    return NextResponse.json({ success: false, error: "Failed to create car" }, { status: 500 });
  }
}
