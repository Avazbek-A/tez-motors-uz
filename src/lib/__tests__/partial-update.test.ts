import { describe, it, expect } from "vitest";
import { partWriteSchema } from "../schemas/part";

/**
 * Regression: Zod 4's `.partial()` does NOT strip `.default()` — for keys the
 * caller omitted it still injects the default into the parsed output. The admin
 * PUT-by-id handlers (parts/scooters/models) therefore must write only the
 * fields actually present in the request body; writing parsed.data directly
 * would reset stock_qty/is_published/images/fitment to defaults on a
 * single-field edit (silent data loss / unpublishing).
 */
describe("partial PUT must not persist injected defaults", () => {
  it(".partial() injects defaults for omitted keys (the hazard)", () => {
    const parsed = partWriteSchema.partial().parse({ price_usd: 9000 }) as Record<string, unknown>;
    expect(parsed.stock_qty).toBe(0);
    expect(parsed.is_published).toBe(false);
    expect(parsed.images).toEqual([]);
  });

  it("filtering parsed.data to body keys yields only the sent field", () => {
    const body = { price_usd: 9000 };
    const parsed = partWriteSchema.partial().parse(body) as Record<string, unknown>;
    const update = Object.fromEntries(Object.entries(parsed).filter(([k]) => k in body));
    expect(update).toEqual({ price_usd: 9000 });
    expect("stock_qty" in update).toBe(false);
    expect("is_published" in update).toBe(false);
    expect("images" in update).toBe(false);
  });

  it("an explicit images:[] in the body IS kept (intentional clear)", () => {
    const body = { images: [] as string[] };
    const parsed = partWriteSchema.partial().parse(body) as Record<string, unknown>;
    const update = Object.fromEntries(Object.entries(parsed).filter(([k]) => k in body));
    expect(update).toEqual({ images: [] });
  });
});
