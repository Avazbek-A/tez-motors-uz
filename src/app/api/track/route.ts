import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const phone = request.nextUrl.searchParams.get("phone");

    if (!phone || phone.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: "Phone number required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Normalize phone: remove spaces, dashes, parentheses
    const normalized = phone.replace(/[\s\-()]/g, "");

    // Search by phone (partial match to handle different formats)
    const { data: inquiries, error } = await supabase
      .from("inquiries")
      .select("id, name, phone, type, status, message, car_id, created_at, source_page")
      .ilike("phone", `%${normalized}%`)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) throw error;

    if (!inquiries || inquiries.length === 0) {
      return NextResponse.json({ success: true, inquiries: [] });
    }

    // Fetch car details for inquiries that have car_id
    const carIds = inquiries
      .map((i) => i.car_id)
      .filter((id): id is string => Boolean(id));

    let carsMap: Record<string, { brand: string; model: string; year: number }> = {};
    if (carIds.length > 0) {
      const { data: cars } = await supabase
        .from("cars")
        .select("id, brand, model, year")
        .in("id", carIds);

      if (cars) {
        carsMap = Object.fromEntries(cars.map((c) => [c.id, c]));
      }
    }

    const result = inquiries.map((inquiry) => ({
      id: inquiry.id,
      name: inquiry.name,
      phone: inquiry.phone,
      type: inquiry.type,
      status: inquiry.status,
      message: inquiry.message,
      created_at: inquiry.created_at,
      car: inquiry.car_id ? carsMap[inquiry.car_id] : null,
    }));

    return NextResponse.json({ success: true, inquiries: result });
  } catch (error) {
    console.error("Track API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
