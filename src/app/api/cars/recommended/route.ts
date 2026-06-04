import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getCustomerContext } from "@/lib/customer-auth";
import { PUBLIC_CAR_COLUMNS } from "@/lib/car-columns";
import { buildProfile, recommendFromProfile, type ScorableCar } from "@/lib/recommend";

/**
 * "Recommended for you" (Phase AO). Builds an affinity profile from the
 * visitor's engaged cars — recently-viewed + favorite ids passed by the client
 * (localStorage), merged with account favorites when logged in — and ranks the
 * live catalog against it. Cold start (no signal / no matches) falls back to
 * hot-offers so the rail is never empty. Public (anon RLS), cached short.
 */
export const dynamic = "force-dynamic";

const idRe = /^[a-f0-9-]{1,64}$/i;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seedIds = (searchParams.get("ids") || "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => idRe.test(s))
      .slice(0, 20);

    const supabase = await createClient();

    // Merge account favorites when the visitor is logged in (cross-device signal).
    try {
      const ctx = await getCustomerContext(request);
      if (ctx) {
        const svc = createServiceClient();
        const { data: favs } = await svc
          .from("favorites")
          .select("car_id")
          .eq("customer_id", ctx.customer.id)
          .limit(20);
        for (const f of favs || []) {
          const id = f.car_id as string;
          if (idRe.test(id) && !seedIds.includes(id)) seedIds.push(id);
        }
      }
    } catch {
      // not logged in / table issue — proceed with client-supplied seeds
    }

    const wantPersonalized = seedIds.length > 0;
    let recommended: Record<string, unknown>[] = [];

    if (wantPersonalized) {
      const [{ data: seedCars }, { data: candidates }] = await Promise.all([
        supabase.from("cars").select("id, brand, body_type, fuel_type, price_usd").in("id", seedIds),
        supabase.from("cars").select(PUBLIC_CAR_COLUMNS).neq("inventory_status", "sold").limit(300),
      ]);
      const profile = buildProfile((seedCars as unknown as ScorableCar[]) || []);
      const candidateRows = (candidates as unknown as Record<string, unknown>[]) || [];
      const scorable = candidateRows.map((c) => ({
        id: c.id as string,
        brand: c.brand as string,
        body_type: (c.body_type as string) ?? null,
        fuel_type: (c.fuel_type as string) ?? null,
        price_usd: Number(c.price_usd) || 0,
      }));
      const ranked = recommendFromProfile(scorable, profile, new Set(seedIds), 8);
      const byId = new Map(candidateRows.map((c) => [c.id as string, c]));
      recommended = ranked.map((r) => byId.get(r.id)).filter(Boolean) as Record<string, unknown>[];
    }

    let personalized = recommended.length > 0;
    if (recommended.length === 0) {
      // Cold start: hot offers.
      const { data: hot } = await supabase
        .from("cars")
        .select(PUBLIC_CAR_COLUMNS)
        .neq("inventory_status", "sold")
        .eq("is_hot_offer", true)
        .order("order_position", { ascending: true })
        .limit(8);
      recommended = (hot as unknown as Record<string, unknown>[]) || [];
      personalized = false;
    }

    return NextResponse.json(
      { cars: recommended, personalized },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch {
    return NextResponse.json({ cars: [], personalized: false });
  }
}
