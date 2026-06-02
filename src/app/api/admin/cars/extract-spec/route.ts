import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { extractCarSpecFromPage } from "@/lib/car-spec-ingest";

/**
 * Extract a car configuration (year, body/fuel/transmission, engine, etc.) from
 * a source page (e.g. AutoHome) for the dealer to review and apply to the form.
 * Admin-only; fail-open (returns spec:null when the LLM is off or the page is
 * blocked). Never returns a price.
 */
const schema = z.object({ url: z.string().url().max(2000) });

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
    return NextResponse.json({ error: "A valid URL is required" }, { status: 400 });
  }

  const spec = await extractCarSpecFromPage(parsed.data.url);
  return NextResponse.json({ spec });
}
