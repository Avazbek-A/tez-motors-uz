import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email";
import { logAdminAction } from "@/lib/audit";

/**
 * Broadcast an announcement to newsletter subscribers (e.g. new inventory).
 * Admin-gated; per-run cap; fail-open per recipient. GET returns the audience
 * size so the dealer knows the reach before sending.
 */
const MAX = 2000;
const schema = z.object({ subject: z.string().min(2).max(200), message: z.string().min(2).max(5000) });

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;
  const supabase = createServiceClient();
  const { count } = await supabase
    .from("newsletter_subscribers")
    .select("email", { count: "exact", head: true });
  return NextResponse.json({ subscribers: count ?? 0 });
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: subs } = await supabase.from("newsletter_subscribers").select("email").limit(MAX);
  const list = (subs || []).map((s) => s.email as string).filter((e) => e && e.includes("@"));

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:#18181b">${esc(parsed.data.message).replace(/\n/g, "<br>")}<hr style="border:none;border-top:1px solid #e4e4e7;margin:20px 0"><p style="font-size:12px;color:#71717a">Tez Motors</p></div>`;

  let sent = 0;
  for (const email of list) {
    const { ok } = await sendEmail({ to: email, subject: parsed.data.subject, html });
    if (ok) sent += 1;
  }

  logAdminAction(request, {
    action: "create",
    entity: "broadcast",
    diff: { subject: parsed.data.subject, recipients: list.length, sent },
  }).catch(() => {});

  return NextResponse.json({ success: true, recipients: list.length, sent });
}
