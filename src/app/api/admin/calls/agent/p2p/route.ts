import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Cooperative P2P Dealership Sourcing simulation endpoint.
 * Admin-gated.
 * Coordinates inventories across dealership networks to swap stock, agree on commissions, and generate shipping logs.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const body = await request.json().catch(() => ({}));
    const { vehicle, color } = body;

    if (!vehicle) {
      return NextResponse.json({ error: "Missing vehicle parameter" }, { status: 400 });
    }

    const targetColor = color || "Grey";
    const supabase = createServiceClient();

    // 1. Locate P2P inventory matching vehicle from public.p2p_dealer_inventory or mock fallback
    const { data: p2pListing } = await supabase
      .from("p2p_dealer_inventory")
      .select("*")
      .ilike("vehicle_model", `%${vehicle}%`)
      .eq("available", true)
      .limit(1)
      .maybeSingle();

    const dealerName = p2pListing?.dealer_name || "Tashkent Premium Cars P2P";
    const wholesalePrice = p2pListing?.wholesale_price ? Number(p2pListing.wholesale_price) : 24200;
    const commission = p2pListing?.commission_usd ? Number(p2pListing.commission_usd) : 500;
    const etaDays = p2pListing?.eta_days || 3;

    // 2. Generate simulated P2P P2P swap logs
    const logs = [
      `Tez Agent (P2P): Broadcast request to local dealer network for 1x ${vehicle} in ${targetColor}.`,
      `P2P Node (${dealerName}): Connection established. We have 1x ${vehicle} in ${targetColor} sitting in our dry port container.`,
      `Tez Agent (P2P): Requesting dealer transfer pricing and commission structure.`,
      `P2P Node (${dealerName}): Sourcing price is $${wholesalePrice} with a $${commission} P2P network broker fee. Car can be cleared and driven to your Tashkent showroom in ${etaDays} days.`,
      `Tez Agent (P2P): Sourcing approved. Reserving vehicle and drafting commission wire release contract.`
    ];

    return NextResponse.json({
      success: true,
      dealer_name: dealerName,
      vehicle_model: vehicle,
      sourced_color: targetColor,
      wholesale_price: wholesalePrice,
      commission_usd: commission,
      eta_days: etaDays,
      logs: logs
    });

  } catch (err: any) {
    console.error("P2P Sourcing failed:", err);
    return NextResponse.json({ error: err.message || "P2P Sourcing failed" }, { status: 500 });
  }
}
