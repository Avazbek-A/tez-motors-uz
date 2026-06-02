import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { SEGMENTS, segmentDef } from "@/lib/segments";
import { contactKey } from "@/lib/crm";
import { resolveSegmentContacts } from "@/lib/segment-resolve";

/**
 * Segments: list the audience catalog, or resolve one segment to a live count +
 * channel reach + a small sample. Read-only, admin-gated.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const key = new URL(request.url).searchParams.get("segment");
  if (!key) return NextResponse.json({ segments: SEGMENTS });

  const def = segmentDef(key);
  if (!def) return NextResponse.json({ error: "Unknown segment" }, { status: 404 });

  const supabase = createServiceClient();
  const contacts = await resolveSegmentContacts(supabase, key);
  const withEmail = contacts.filter((c) => c.email).length;
  const withPhone = contacts.filter((c) => contactKey(c.phone)).length;

  return NextResponse.json({
    segment: def,
    count: contacts.length,
    withEmail,
    withPhone,
    sample: contacts.slice(0, 50).map((c) => ({ name: c.name, phone: c.phone, email: c.email })),
  });
}
