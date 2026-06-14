/**
 * Canonical model-name normalizer for joining catalog cars to scraped market
 * listings. The catalog stores trim-suffixed / chassis-coded names ("H6 2.0T",
 * "H6 HEV", "5 series (g60) 2025") while marketplaces say the base name ("H6",
 * "5 series"). normalizeModel strips the noise that prevents a join WITHOUT
 * merging genuinely different models:
 *   - parenthetical chassis codes:  "(g60)", "(w206)"
 *   - embedded model years:         "2025"
 *   - engine / fuel / drivetrain tokens: "2.0T", "HEV", "DM-i", "EV", "AWD", …
 * It KEEPS model-distinguishing tokens (Plus, Pro, Max, Ultra, numbers), so
 * "Tiggo 8 Pro" ≠ "Tiggo 8" and "Song Plus" ≠ "Song". Pure + unit-tested.
 */

// Only engine-size / fuel / drivetrain tokens — never trim/series words.
const MODEL_NOISE = /^(\d(?:\.\d)?[tl]|hev|phev|mhev|dm-?i|dmi|ev|bev|awd|4wd|2wd|fwd|rwd)$/i;

export function normalizeModel(model: string): string {
  return String(model || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")        // chassis codes in parens
    .replace(/\b(19|20)\d{2}\b/g, " ") // embedded years
    .split(/[\s/,]+/)
    .map((t) => t.trim())
    .filter((t) => t && !MODEL_NOISE.test(t))
    .join(" ")
    .trim();
}

/** Lowercased brand|model key with the model normalized to its base form. */
export function baseModelKey(brand: string, model: string): string {
  return `${String(brand || "").toLowerCase().trim()}|${normalizeModel(model)}`;
}
