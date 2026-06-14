# Client-surface cleanup — deep review (Phase CLEANUP, Part 3)

Adversarial multi-agent review of the client-surface cleanup (commits `1fa51e7..29e5bb6`).
5 dimensions reviewed in parallel (public-leak, new-code-correctness, security/RLS,
colors-pipeline, funnel); every candidate finding was re-read by 2 independent
refuters (refute-by-default). **5 findings confirmed, 0 refuted** — all fixed.

## Confirmed + fixed

| # | Sev | Where | Issue | Fix |
|---|-----|-------|-------|-----|
| 1 | HIGH | `src/app/page.tsx` | Home page `select("*")` → hot-offer rows passed to the **client** `CarCard`; the whole `spec_data` (incl. `source_url`, `series_id`) serializes into the RSC flight payload even though CarCard never reads it. | `scrubCarsForPublic(carsResult.data)` before render. |
| 2 | HIGH | `src/app/[locale]/(marketing)/deals/page.tsx` | Same leak — `select("*")` → client `CarCard`, no scrub. | `scrubCarsForPublic((data) as Car[])`. |
| 3 | MED | `catalog/[slug]/car-detail-client.tsx` | A "price on request" car (`price_usd===0`) with an `original_price` rendered a bogus **"−100%"** discount + "—" headline (discount calc wasn't price-guarded). | Gate the discount on `car.price_usd > 0`. |
| 4 | LOW | `catalog/[slug]/spec/page.tsx` | `matchGonzoToTrims(spec.trims, …)` runs before the empty-trims guard → `undefined.length` TypeError (500) if a partial `spec_data` lacks `trims`. | `matchGonzoToTrims` is now null-safe (`Array.isArray(trims)`). |
| 5 | LOW | `catalog/[slug]/spec/page.tsx` | The public **PDF download was only half-removed** — gone from the car page but still live on `/spec` (which is publicly reachable via "Compare trims"/"View full spec"). | Removed the `<a … spec-sheet>` button. |

## Notes
- The HIGH leaks are the same class the cleanup closed on the API/catalog paths — RSC
  serialization ships the *entire* prop object to client components regardless of which
  fields are read. The fix is the same `scrubCarsForPublic` helper applied at the SSR seam.
- The `/api/cars/[id]/spec-sheet` route stays intentionally public + SSRF-hardened; only the
  client-facing *button* was removed (per the "no PDF for clients" decision).
- No RLS regression, no auth-bypass, no admin-data leak found. The `in_stock` gate, the
  scrub gating on `includeAll`, and the colors swatch-only rendering all verified sound.
