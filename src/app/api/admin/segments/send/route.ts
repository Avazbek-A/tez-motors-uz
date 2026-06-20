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
import { sendToCustomer } from "@/lib/customer-messaging";
import { isSuppressed, unsubscribeToken } from "@/lib/automation/suppression";

const CAP = 300; // hard per-campaign recipient cap (cost + abuse guardrail)
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://tezmotors.uz").replace(/\/$/, "");

const schema = z.object({
  segment: z.string().min(1).max(60),
  channel: z.enum(["auto", "email", "sms"]),
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
  const reachable = contacts.filter((c) => {
    if (channel === "email") return !!c.email;
    if (channel === "sms") return !!contactKey(c.phone);
    return !!c.telegramId || !!c.customerId || !!c.email || !!contactKey(c.phone);
  });
  const targeted = Math.min(reachable.length, CAP);
  const batch = reachable.slice(0, CAP);

  let sent = 0;
  let failed = 0;
  let suppressed = 0;
  for (const c of batch) {
    const text = personalize(msg, c.name, locale || "ru");
    if (await suppressedForChannel(supabase, c, channel)) {
      suppressed++;
      continue;
    }
    try {
      if (channel === "email") {
        const html = await campaignEmailHtml(text, c.email as string, locale || "ru");
        const r = await sendEmail({ to: c.email as string, subject: subject as string, html });
        if (r.ok) sent++;
        else failed++;
      } else if (channel === "sms") {
        const r = await sendSms(c.phone as string, text);
        if (r.ok) sent++;
        else failed++;
      } else {
        const emailHtml = c.email ? await campaignEmailHtml(text, c.email, locale || "ru") : null;
        const r = await sendToCustomer(
          supabase,
          {
            id: c.customerId ?? null,
            phone: c.phone,
            telegram_id: c.telegramId ?? null,
            email: c.email,
            locale: c.locale || locale || "ru",
            notify_channel: c.notifyChannel || "auto",
          },
          {
            title: subject || "Tez Motors",
            body: text,
            email: c.email && subject && emailHtml ? { subject, html: emailHtml } : null,
            kind: `campaign:${segment}`,
            pushTag: `campaign-${segment}`,
          },
        );
        if (r.delivered) {
          sent++;
        } else if (contactKey(c.phone)) {
          const sms = await sendSms(c.phone as string, text);
          if (sms.ok) sent++;
          else failed++;
        } else {
          failed++;
        }
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
    suppressed,
    capped: reachable.length > CAP ? reachable.length - CAP : 0,
  });
}

async function suppressedForChannel(
  supabase: ReturnType<typeof createServiceClient>,
  c: Awaited<ReturnType<typeof resolveSegmentContacts>>[number],
  channel: "auto" | "email" | "sms",
): Promise<boolean> {
  const checks: Array<Promise<boolean>> = [];
  if (channel === "email" && c.email) checks.push(isSuppressed(supabase, c.email, "email"));
  if (channel === "sms" && c.phone) checks.push(isSuppressed(supabase, c.phone, "sms"));
  if (channel === "auto") {
    if (c.email) checks.push(isSuppressed(supabase, c.email, "auto"));
    if (c.phone) checks.push(isSuppressed(supabase, c.phone, "auto"));
  }
  if (checks.length === 0) return false;
  return (await Promise.all(checks)).some(Boolean);
}

async function campaignEmailHtml(text: string, contact: string, locale: "ru" | "uz" | "en"): Promise<string> {
  const token = await unsubscribeToken(contact);
  const unsubUrl = `${SITE}/${locale}/unsubscribe?c=${encodeURIComponent(contact)}&t=${token}`;
  const copy = {
    ru: "Отписаться",
    uz: "Obunani bekor qilish",
    en: "Unsubscribe",
  }[locale];
  return `<div>${htmlEscape(text).replace(/\n/g, "<br>")}</div><hr/><p style="font-size:12px;color:#888"><a href="${htmlEscape(unsubUrl)}">${copy}</a></p>`;
}
