import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logAdminAction } from "@/lib/audit";
import { segmentDef, personalize } from "@/lib/segments";
import { contactKey } from "@/lib/crm";
import { resolveSegmentContacts } from "@/lib/segment-resolve";
import { sendEmail } from "@/lib/email";
import { sendSms } from "@/lib/sms";

const CAP = 300; // hard per-campaign recipient cap (cost + abuse guardrail)

const schema = z.object({
  segment: z.string().min(1).max(60),
  channel: z.enum(["email", "sms"]),
  subject: z.string().max(200).optional(),
  body: z.string().min(4).max(2000),
  locale: z.enum(["ru", "uz", "en"]).optional(),
});

function htmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  const { segment, channel, subject, body: msg, locale } = parsed.data;

  if (!segmentDef(segment)) return NextResponse.json({ error: "Unknown segment" }, { status: 404 });
  if (channel === "email" && !subject) return NextResponse.json({ error: "Subject required for email" }, { status: 400 });

  const supabase = createServiceClient();
  const contacts = await resolveSegmentContacts(supabase, segment);

  // Keep only reachable contacts for the chosen channel, then cap.
  const reachable = contacts.filter((c) => (channel === "email" ? !!c.email : !!contactKey(c.phone)));
  const targeted = Math.min(reachable.length, CAP);
  const batch = reachable.slice(0, CAP);

  let sent = 0;
  let failed = 0;
  for (const c of batch) {
    const text = personalize(msg, c.name, locale || "ru");
    try {
      if (channel === "email") {
        const r = await sendEmail({ to: c.email as string, subject: subject as string, html: `<div>${htmlEscape(text).replace(/\n/g, "<br>")}</div>` });
        if (r.ok) sent++;
        else failed++;
      } else {
        const r = await sendSms(c.phone as string, text);
        if (r.ok) sent++;
        else failed++;
      }
    } catch {
      failed++;
    }
  }

  const { data: campaign } = await supabase
    .from("campaigns")
    .insert({ segment, channel, subject: subject || null, body: msg, targeted, sent, failed })
    .select("id")
    .single();

  logAdminAction(request, { action: "create", entity: "campaign", entity_id: campaign?.id, diff: { segment, channel, targeted, sent } }).catch(() => {});

  return NextResponse.json({
    ok: true,
    targeted,
    sent,
    failed,
    capped: reachable.length > CAP ? reachable.length - CAP : 0,
  });
}
