import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { llmText } from "@/lib/llm";

/**
 * B2B wholesale sourcing negotiator endpoint.
 * Admin-gated.
 * Simulates negotiation with overseas exporters, dynamically routing to alternative colors
 * if requested configurations are unavailable, and agreeing on shipping and final prices.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const body = await request.json().catch(() => ({}));
    // Bound the free-text fields that get interpolated into the LLM prompt (cost +
    // prompt-injection hygiene; admin-only). Budget is numeric-coerced already.
    const vehicle = String(body.vehicle || "").slice(0, 80).trim();
    const targetColor = (String(body.color || "").slice(0, 40).trim()) || "Grey";

    if (!vehicle) {
      return NextResponse.json({ error: "Missing vehicle parameters" }, { status: 400 });
    }

    const clientBudget = Number(body.budget || 26000);

    const systemPrompt = [
      `You are the B2B Wholesale Sourcing Agent for Tez Motors.`,
      `Your job is to simulate a realistic, professional, step-by-step negotiation log between Tez Motors (represented by you) and a Chinese automotive exporter (e.g. "Chongqing Xinghe Auto Export").`,
      `The customer wants a ${vehicle} in ${targetColor} color with a target retail budget of $${clientBudget}.`,
      `You need to negotiate a wholesale purchase price that fits this budget and leaves a healthy margin for Tez Motors.`,
      `During negotiation:`,
      `1. Supplier initially quotes a price that is slightly too high or states that ${targetColor} is currently out of stock (forcing a color swap suggestion to 'Space Black' or 'Glacier White').`,
      `2. You push back, negotiating a bulk/volume discount or accepting the color swap in exchange for a lower price.`,
      `3. Agree on a final wholesale price, shipping ETA (typically 20-30 days to Tashkent), and shipping terms (CIP Tashkent).`,
      `Output the result as a JSON object containing:`,
      `- logs: array of dialogue strings representing the exchange: e.g. ["Tez Agent: ...", "Supplier: ..."]`,
      `- final_wholesale_price: number (e.g. 21500)`,
      `- sourced_color: string (the negotiated color, e.g. "Space Black")`,
      `- eta_days: number (e.g. 25)`,
      `- supplier_name: string (e.g. "Chongqing Xinghe Auto")`,
      `- margin_usd: number (difference between client budget and wholesale price)`,
      `Ensure your entire output is valid JSON and nothing else. Do not wrap in markdown code blocks.`,
    ].join(" ");

    const userPrompt = `Simulate sourcing negotiation for a ${vehicle} in ${targetColor} with budget $${clientBudget}`;

    let resultJson: any = null;
    try {
      const response = await llmText({
        system: systemPrompt,
        user: userPrompt,
        maxTokens: 600,
        tier: "reason"
      });

      if (response) {
        // Clean markdown wraps if the model included them
        const cleaned = response.replace(/```json/g, "").replace(/```/g, "").trim();
        resultJson = JSON.parse(cleaned);
      }
    } catch (err) {
      console.error("LLM JSON parsing failed, using high-fidelity fallback negotiation log:", err);
    }

    if (!resultJson) {
      // Graceful fallback simulation
      const sourcedColor = targetColor.toLowerCase().includes("grey") ? "Space Black (Alternative)" : targetColor;
      const wholesalePrice = Math.round(clientBudget * 0.85); // 15% margin
      const margin = clientBudget - wholesalePrice;

      resultJson = {
        supplier_name: "Sichuan Auto Export Group Co.",
        sourced_color: sourcedColor,
        final_wholesale_price: wholesalePrice,
        margin_usd: margin,
        eta_days: 28,
        logs: [
          `Tez Agent (Sourcing): Requesting wholesale availability for 1x ${vehicle} in ${targetColor}. Target CIP Tashkent pricing.`,
          `Supplier (Sichuan Auto): Hello Tez Motors. We have ${vehicle} available immediately, but ${targetColor} is currently on backorder for 45 days. We can ship Space Black immediately for $${wholesalePrice + 1200} CIP Tashkent.`,
          `Tez Agent (Sourcing): 45 days is too long for our client. We can accept Space Black if you can discount it to $${wholesalePrice - 500} due to the color swap.`,
          `Supplier (Sichuan Auto): That is below our cost. The best we can do for Space Black ready to ship is $${wholesalePrice}. ETA is 28 days via Chengdu-Tashkent rail.`,
          `Tez Agent (Sourcing): Deal confirmed at $${wholesalePrice} CIP Tashkent for 1x ${vehicle} in Space Black. Sourcing contract generated.`
        ]
      };
    }

    return NextResponse.json(resultJson);

  } catch (err: any) {
    console.error("B2B Sourcing Negotiator API failed:", err);
    return NextResponse.json({ error: err.message || "B2B Sourcing failed" }, { status: 500 });
  }
}
