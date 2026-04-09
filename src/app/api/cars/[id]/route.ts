import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { carWriteSchema } from "@/lib/schemas/car";

// GET single car by ID or slug
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = await createClient();

    // Try by slug first (more common for public pages), then by ID
    let { data: car, error } = await supabase
      .from("cars")
      .select("*")
      .eq("slug", id)
      .single();

    if (error || !car) {
      const result = await supabase
        .from("cars")
        .select("*")
        .eq("id", id)
        .single();
      car = result.data;
      error = result.error;
    }

    if (error || !car) {
      return NextResponse.json({ error: "Car not found" }, { status: 404 });
    }

    return NextResponse.json({ car });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT - update a car (admin)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const supabase = await createClient();

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
  const { id } = await params;

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("cars").delete().eq("id", id);

    if (error) {
      console.error("Delete error:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted: id });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to delete car" }, { status: 500 });
  }
}
