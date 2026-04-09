import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { reviewWriteSchema } from "@/lib/schemas/car";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const all = searchParams.get("all"); // admin: include unpublished

  try {
    const supabase = await createClient();
    let query = supabase.from("reviews").select("*").order("order_position", { ascending: true });

    if (!all) {
      query = query.eq("is_published", true);
    }

    const { data: reviews, error } = await query;

    if (error) {
      console.error("Reviews fetch error:", error);
      return NextResponse.json({ reviews: [], total: 0 }, { status: 500 });
    }

    return NextResponse.json({ reviews: reviews || [], total: reviews?.length || 0 });
  } catch {
    return NextResponse.json({ reviews: [], total: 0, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = reviewWriteSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, errors: result.error.issues },
        { status: 400 }
      );
    }

    const data = result.data;
    const supabase = await createClient();

    const { data: review, error } = await supabase
      .from("reviews")
      .insert(data)
      .select()
      .single();

    if (error) {
      console.error("Review insert error:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, review }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, errors: error.issues }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: "Failed to create review" }, { status: 500 });
  }
}
