import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { inquiryUpdateSchema } from "@/lib/schemas/car";
import { requireAdmin } from "@/lib/auth";

// PUT - update inquiry status only
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauth = await requireAdmin(request);
  if (unauth) return unauth;
  const { id } = await params;

  try {
    const body = await request.json();
    const result = inquiryUpdateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, errors: result.error.issues },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("inquiries")
      .update({ status: result.data.status })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Inquiry update error:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, inquiry: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, errors: error.issues }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: "Failed to update inquiry" }, { status: 500 });
  }
}

// DELETE - remove inquiry
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauth = await requireAdmin(request);
  if (unauth) return unauth;
  const { id } = await params;

  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("inquiries").delete().eq("id", id);

    if (error) {
      console.error("Inquiry delete error:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted: id });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to delete inquiry" }, { status: 500 });
  }
}
