import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { getAdminSessionContext, hashPassword } from "@/lib/auth";

const schema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  role: z.enum(["owner", "manager", "rep"]).default("rep"),
});

async function requireOwner(request: NextRequest) {
  const ctx = await getAdminSessionContext(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.user && ctx.user.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (ctx.user) return null;

  const supabase = createServiceClient();
  const { count } = await supabase.from("admin_users").select("id", { count: "exact", head: true });
  if ((count || 0) === 0) return null;

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function GET(request: NextRequest) {
  const unauth = await requireOwner(request);
  if (unauth) return unauth;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("admin_users")
    .select("id, email, role, disabled, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }

  return NextResponse.json({ users: data || [] });
}

export async function POST(request: NextRequest) {
  const unauth = await requireOwner(request);
  if (unauth) return unauth;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const supabase = createServiceClient();
  const password_hash = await hashPassword(parsed.data.password);
  const { data, error } = await supabase
    .from("admin_users")
    .insert({
      email: parsed.data.email.toLowerCase(),
      password_hash,
      role: parsed.data.role,
      disabled: false,
    })
    .select("id, email, role, disabled, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, user: data }, { status: 201 });
}
