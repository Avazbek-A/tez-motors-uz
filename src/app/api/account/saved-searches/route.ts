import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { requireCustomer } from "@/lib/customer-auth";

const createSchema = z.object({
  label: z.string().max(120).optional().nullable(),
  filters: z
    .record(z.string(), z.unknown())
    .refine((v) => JSON.stringify(v).length <= 4000, "filters too large"),
});

// GET — list the customer's saved searches.
export async function GET(request: NextRequest) {
  const auth = await requireCustomer(request);
  if ("response" in auth) return auth.response;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("saved_searches")
    .select("id, label, filters, created_at")
    .eq("customer_id", auth.context.customer.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ searches: [] }, { status: 500 });
  return NextResponse.json({ searches: data || [] });
}

// POST — save a new search (its filter set).
export async function POST(request: NextRequest) {
  const auth = await requireCustomer(request);
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, errors: parsed.error.issues }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("saved_searches")
    .insert({
      customer_id: auth.context.customer.id,
      label: parsed.data.label ?? null,
      filters: parsed.data.filters,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ success: false }, { status: 500 });
  return NextResponse.json({ success: true, id: data.id }, { status: 201 });
}

// DELETE — remove a saved search (?id=...).
export async function DELETE(request: NextRequest) {
  const auth = await requireCustomer(request);
  if ("response" in auth) return auth.response;

  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[a-f0-9-]{1,64}$/i.test(id)) {
    return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
  }
  const supabase = createServiceClient();
  await supabase
    .from("saved_searches")
    .delete()
    .eq("customer_id", auth.context.customer.id)
    .eq("id", id);
  return NextResponse.json({ success: true });
}
