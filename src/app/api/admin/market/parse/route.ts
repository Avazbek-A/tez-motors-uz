import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { parseListings } from "@/lib/market-parse";

/**
 * AI-extract structured listings from pasted raw OLX/Telegram text, for review
 * before ingest. Admin-gated. Fail-open: returns [] without an LLM key.
 */
const schema = z.object({ text: z.string().min(4).max(8000) });

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
  if (!parsed.success) return NextResponse.json({ error: "text required" }, { status: 400 });

  const listings = await parseListings(parsed.data.text);
  return NextResponse.json({ listings });
}
