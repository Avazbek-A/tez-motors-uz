import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { sha256Hex } from "@/lib/auth";
import { canonicalPhone } from "@/lib/phone";

/**
 * First-party audience export (Phase AW). Outputs SHA-256-hashed email + phone
 * (the format Meta / Google Customer Match ingest) for the chosen audience, so
 * the dealer can build acquisition lookalikes — or, crucially, SUPPRESS existing
 * customers from acquisition ads to stop paying to re-reach people they already
 * have. Hashing is done here so raw PII never leaves in the file. Admin-gated.
 *
 *   ?audience=delivered_customers | all_customers | open_leads
 */
const AUDIENCES = ["delivered_customers", "all_customers", "open_leads"] as const;
type Audience = (typeof AUDIENCES)[number];

const normEmail = (e: string | null | undefined) => (e || "").trim().toLowerCase();
const normPhone = (p: string | null | undefined) => canonicalPhone(p || "") || "";

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const audience = (new URL(request.url).searchParams.get("audience") || "all_customers") as Audience;
  if (!AUDIENCES.includes(audience)) {
    return NextResponse.json({ error: "Unknown audience" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const rows: { email: string; phone: string }[] = [];

  if (audience === "all_customers") {
    const { data } = await supabase.from("customers").select("email, phone").limit(50000);
    for (const c of data || []) rows.push({ email: normEmail(c.email as string), phone: normPhone(c.phone as string) });
  } else if (audience === "delivered_customers") {
    const { data } = await supabase.from("orders").select("customer_email, customer_phone").eq("status", "delivered").limit(50000);
    for (const o of data || []) rows.push({ email: normEmail(o.customer_email as string), phone: normPhone(o.customer_phone as string) });
  } else {
    const { data } = await supabase.from("inquiries").select("email, phone").in("status", ["new", "contacted", "in_progress"]).limit(50000);
    for (const i of data || []) rows.push({ email: normEmail(i.email as string), phone: normPhone(i.phone as string) });
  }

  // Dedupe on the normalized identity, hash, drop empties.
  const seen = new Set<string>();
  const lines: string[] = ["email_sha256,phone_sha256"];
  for (const r of rows) {
    const key = `${r.email}|${r.phone}`;
    if (seen.has(key) || (!r.email && !r.phone)) continue;
    seen.add(key);
    const emailHash = r.email ? await sha256Hex(r.email) : "";
    const phoneHash = r.phone ? await sha256Hex(r.phone) : "";
    lines.push(`${emailHash},${phoneHash}`);
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="audience-${audience}.csv"`,
      "cache-control": "no-store",
    },
  });
}
