import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getUsdUzsRate } from "@/lib/fx-rate";
import { toUsd, priceToUsd, fingerprint } from "@/lib/market-intel";

/**
 * Ingest observed market listings — from the admin "add data" UI OR an
 * off-Workers collector (Playwright/Telethon on the Vostro). Normalizes price
 * to USD, dedupes by fingerprint. Auth: an admin session, or a collector
 * presenting `Authorization: Bearer $MARKET_INGEST_SECRET`. Fail-closed.
 */
const listingSchema = z.object({
  source: z.enum(["olx", "telegram", "manual", "other"]).optional(),
  source_ref: z.string().max(400).optional().nullable(),
  brand: z.string().min(1).max(60),
  model: z.string().min(1).max(80),
  year: z.number().int().min(1990).max(2035).optional().nullable(),
  mileage_km: z.number().int().min(0).max(2_000_000).optional().nullable(),
  price_usd: z.number().min(0).max(100_000_000).optional().nullable(),
  price_raw: z.number().min(0).max(1_000_000_000_000).optional().nullable(),
  currency: z.string().max(8).optional().nullable(),
  condition: z.enum(["new", "used"]).optional().nullable(),
  city: z.string().max(60).optional().nullable(),
  posted_at: z.string().max(40).optional().nullable(),
  raw_text: z.string().max(2000).optional().nullable(),
});

const bodySchema = z.object({
  source: z.enum(["olx", "telegram", "manual", "other"]).optional(),
  listings: z.array(listingSchema).min(1).max(500),
});

function authorize(request: NextRequest, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  const secret = process.env.MARKET_INGEST_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return token.length > 0 && token === secret;
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!authorize(request, !guard)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const supabase = createServiceClient();
  const usdUzs = await getUsdUzsRate(supabase);
  const defaultSource = parsed.data.source || "manual";

  const seen = new Set<string>();
  const rows = parsed.data.listings
    .map((l) => {
      // Normalize price to USD: explicit price_usd wins, else convert raw, else parse text.
      let priceUsd: number | null = l.price_usd ?? null;
      if (priceUsd == null && l.price_raw != null) {
        const cur = (l.currency || "").toLowerCase();
        priceUsd = toUsd({ amount: l.price_raw, currency: cur === "uzs" ? "uzs" : cur === "usd" ? "usd" : "unknown" }, usdUzs);
      }
      if (priceUsd == null && l.raw_text) priceUsd = priceToUsd(l.raw_text, usdUzs);

      const source = l.source || defaultSource;
      const fp = fingerprint({ source, source_ref: l.source_ref, brand: l.brand, model: l.model, year: l.year, price_usd: priceUsd, city: l.city });
      if (seen.has(fp)) return null;
      seen.add(fp);

      return {
        source,
        source_ref: l.source_ref ?? null,
        brand: l.brand,
        model: l.model,
        year: l.year ?? null,
        mileage_km: l.mileage_km ?? null,
        price_usd: priceUsd,
        price_raw: l.price_raw ?? null,
        currency_raw: l.currency ?? null,
        condition: l.condition ?? null,
        city: l.city ?? null,
        posted_at: l.posted_at ?? null,
        raw_text: l.raw_text ?? null,
        fingerprint: fp,
      };
    })
    .filter(Boolean);

  const { error, count } = await supabase
    .from("market_listings")
    .upsert(rows as object[], { onConflict: "fingerprint", ignoreDuplicates: true, count: "exact" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, received: parsed.data.listings.length, stored: count ?? rows.length });
}
