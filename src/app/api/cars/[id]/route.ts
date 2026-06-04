import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { carWriteSchema } from "@/lib/schemas/car";
import { requireAdmin } from "@/lib/auth";
import { notifyPriceWatchers } from "@/lib/price-watch";
import { logEvent } from "@/lib/error-report";
import { logAdminAction, compactDiff } from "@/lib/audit";
import { PUBLIC_CAR_COLUMNS } from "@/lib/car-columns";

// GET single car by ID or slug
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = await createClient();

    // Try by slug first (more common for public pages), then by ID.
    // Use PUBLIC_CAR_COLUMNS (NOT "*") so any future internal column added to
    // `cars` doesn't silently leak through this public endpoint.
    let { data: car, error } = await supabase
      .from("cars")
      .select(PUBLIC_CAR_COLUMNS)
      .eq("slug", id)
      .single();

    if (error || !car) {
      const result = await supabase
        .from("cars")
        .select(PUBLIC_CAR_COLUMNS)
        .eq("id", id)
        .single();
      car = result.data;
      error = result.error;
    }

    if (error || !car) {
      return NextResponse.json({ error: "Car not found" }, { status: 404 });
    }

    return NextResponse.json(
      { car },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
        },
      },
    );
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT - update a car (admin)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauth = await requireAdmin(request);
  if (unauth) return unauth;
  const { id } = await params;

  try {
    const body = await request.json();
    const result = carWriteSchema.partial().safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, errors: result.error.issues },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Capture the pre-update price so we can detect a drop after the write.
    const { data: prev } = await supabase
      .from("cars")
      .select("price_usd")
      .eq("id", id)
      .single();

    const { data, error } = await supabase
      .from("cars")
      .update({ ...result.data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Update error:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Price dropped → email anyone watching this car who hit their target.
    // Fire-and-forget; never blocks or fails the save.
    if (
      data &&
      typeof data.price_usd === "number" &&
      prev &&
      typeof prev.price_usd === "number" &&
      data.price_usd < prev.price_usd
    ) {
      notifyPriceWatchers(supabase, {
        id: data.id,
        slug: data.slug,
        brand: data.brand,
        model: data.model,
        year: data.year ?? null,
        price_usd: data.price_usd,
      })
        .then((sent) =>
          logEvent("price_watch.notified", {
            car_id: data.id,
            old_price: prev.price_usd,
            new_price: data.price_usd,
            sent,
          }),
        )
        .catch(() => {});
    }

    logAdminAction(request, {
      action: "update",
      entity: "car",
      entity_id: id,
      diff: compactDiff(result.data as Record<string, unknown>),
    }).catch(() => {});

    return NextResponse.json({ success: true, car: data });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to update car" }, { status: 500 });
  }
}

// DELETE - remove a car (admin)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauth = await requireAdmin(request);
  if (unauth) return unauth;
  const { id } = await params;

  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("cars").delete().eq("id", id);

    if (error) {
      console.error("Delete error:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    logAdminAction(request, { action: "delete", entity: "car", entity_id: id }).catch(() => {});

    return NextResponse.json({ success: true, deleted: id });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to delete car" }, { status: 500 });
  }
}
