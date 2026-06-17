import CalculatorContent from "./_content";
import { createServiceClient } from "@/lib/supabase/server";
import { getUsdUzsRate } from "@/lib/fx-rate";
import { DEFAULT_USD_UZS } from "@/lib/customs-uz";

// Metadata is provided by calculator/layout.tsx via makePageMetadata.

// Server component: resolve the live USD→UZS rate once so the customs estimate
// converts the so'm-denominated fees (utilization, clearance) accurately.
export default async function CalculatorPage() {
  let usdUzs = DEFAULT_USD_UZS;
  try {
    usdUzs = await getUsdUzsRate(createServiceClient());
  } catch {
    /* fall back to the default rate */
  }
  return <CalculatorContent usdUzs={usdUzs} />;
}
