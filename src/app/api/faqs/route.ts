import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { faqWriteSchema } from "@/lib/schemas/car";
import { requireAdmin, isAdminRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const all = searchParams.get("all") && isAdminRequest(request);

  try {
    const supabase = all ? createServiceClient() : await createClient();
    let query = supabase.from("faqs").select("*").order("order_position", { ascending: true });

    if (!all) {
      query = query.eq("is_published", true);
    }

    const { data: faqs, error } = await query;

    if (error) {
      console.error("FAQs fetch error:", error);
      return NextResponse.json({ faqs: [], total: 0 }, { status: 500 });
    }

    return NextResponse.json(
      { faqs: faqs || [], total: faqs?.length || 0 },
      {
        headers: all
          ? {}
          : { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" },
      },
    );
  } catch {
    return NextResponse.json({ faqs: [], total: 0, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const unauth = requireAdmin(request);
  if (unauth) return unauth;
  try {
    const body = await request.json();
    const result = faqWriteSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, errors: result.error.issues },
        { status: 400 }
      );
    }

    const data = result.data;
    const supabase = createServiceClient();

    const { data: faq, error } = await supabase
      .from("faqs")
      .insert(data)
      .select()
      .single();

    if (error) {
      console.error("FAQ insert error:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, faq }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, errors: error.issues }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: "Failed to create FAQ" }, { status: 500 });
  }
}
