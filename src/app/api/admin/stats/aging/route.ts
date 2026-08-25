import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { agingSuggestion, suggestIncreasePct, increasePrice } from "@/lib/inventory-aging";
import { chunk } from "@/lib/supabase/paginate";

/**
 * Aged-inventory repricing suggestions (same engine as the inventory-aging
 * cron, but as an actionable list): per available car, days on lot + demand →
 * a suggested markdown (old + cold) or increase (fresh + hot). Read-only, admin.
 */
const MAX = 2000;

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const supabase = createServiceClient();
    const now = Date.now();
    const { data: cars } = await supabase
      .from("cars")
      .select("id, brand, model, year, price_usd, created_at")
      .eq("inventory_status", "available")
      .limit(MAX);
    const rows = cars || [];
    if (rows.length === 0) return NextResponse.json({ ok: true, markdowns: [], increases: [] });

    const ids = rows.map((c) => c.id as string);
    // Batch the id list: a single .in() with up to 2000 ids builds a multi-KB GET
    // URL that can hit PostgREST's length limit (HTTP 414) and blank the report.
    const idChunks = chunk(ids, 200);
    const fetchByCarIds = async (
      build: (chunkIds: string[]) => PromiseLike<{ data: { car_id: unknown }[] | null }>,
    ): Promise<{ car_id: unknown }[]> => {
      const parts = await Promise.all(idChunks.map((c) => build(c).then((r) => r.data ?? [], () => [])));
      return parts.flat();
    };
    const [favRows, watchRows, inqRows] = await Promise.all([
      fetchByCarIds((c) => supabase.from("favorites").select("car_id").in("car_id", c)),
      fetchByCarIds((c) => supabase.from("price_watches").select("car_id").is("notified_at", null).in("car_id", c)),
      fetchByCarIds((c) => supabase.from("inquiries").select("car_id").in("car_id", c)),
    ]);
    const tally = (rowsIn: { car_id: unknown }[]) => {
      const m = new Map<string, number>();
      for (const r of rowsIn) { const id = r.car_id as string; if (id) m.set(id, (m.get(id) || 0) + 1); }
      return m;
    };
    const fav = tally(favRows), watch = tally(watchRows), inq = tally(inqRows);

    const scored = rows.map((c) => {
      const id = c.id as string;
      const demandScore = (inq.get(id) || 0) * 5 + (watch.get(id) || 0) * 3 + (fav.get(id) || 0);
      const daysOnLot = Math.floor((now - new Date(c.created_at as string).getTime()) / 86_400_000);
      const price = typeof c.price_usd === "number" ? c.price_usd : Number(c.price_usd) || 0;
      const down = agingSuggestion({ price_usd: price, daysOnLot, demandScore });
      const upPct = suggestIncreasePct(daysOnLot, demandScore);
      return {
        car_id: id,
        name: `${c.brand} ${c.model}${c.year ? ` ${c.year}` : ""}`,
        price_usd: price,
        daysOnLot,
        demandScore,
        markdownPct: down.markdownPct,
        suggestedPriceUsd: down.suggestedPriceUsd,
        increasePct: upPct,
        increasePriceUsd: upPct > 0 ? increasePrice(price, upPct) : price,
      };
    });

    return NextResponse.json({
      ok: true,
      markdowns: scored.filter((c) => c.markdownPct > 0).sort((a, b) => b.daysOnLot - a.daysOnLot),
      increases: scored.filter((c) => c.increasePct > 0).sort((a, b) => b.demandScore - a.demandScore),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to compute aging" }, { status: 500 });
  }
}
