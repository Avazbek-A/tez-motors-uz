# Plan — Car colors (exterior + interior) + per-color KEY photos (category-aware)

## What you asked for
- Show **exterior and interior colors clearly on every car page**.
- Scrape only **key photos** from AutoHome — not the thousands they host.
- Beat gonzo-motors.uz by ~30%: gonzo does **8 / exterior color** and **~11 / interior color** → we do **10 / exterior color** and **~15 / interior color**.
- Photos must be **diverse key angles** — NOT 5 near-identical dashboards. → **Build the category selection.** Use an **LLM where it's needed** to get this right.
- Reuse the existing scraper's plumbing (download/upscale/dedupe/re-host) — don't rebuild that part.

## The key discovery (confirmed live today)
AutoHome's **config page** `car.autohome.com.cn/config/series/{seriesId}.html` embeds clean JSON (plain fetch, no browser, no obfuscation):

```
var color       → exterior: { name:"快银", value:"#BAB8C3", id:12056, picnum:133 } … (6 colors, real HEX)
var innerColor  → interior: { name:"黑色/白色", value:"#000000/#F0F0F0", id:1827, picnum:171 } …
```

Per color, for free: **name + real hex + colorId + photo-count**. The `colorId` is the key to fetch *that color's* photos.

## The approach

**1. Colors metadata (cheap, new):** parse `var color` + `var innerColor` → exterior/interior lists `{ name(→RU/UZ/EN), hex, colorId, picnum }`. Hand-built CN→RU/UZ/EN color dictionary (finite set across 208 cars; fallback = keep original).

**2. Photos — reuse the scraper's plumbing, add CATEGORY-AWARE selection (the new core):**
   - **Plumbing reused as-is** from `deploy/collector/publish-from-targets.mjs`: Playwright render → upscale to 1100×0 → hash-dedupe → re-host to the Vostro disk.
   - **What's new = how we choose which photos to keep.** AutoHome tags every photo with an **angle category** — 车头/front, 车侧/side, 车尾/rear, 车轮/wheel, 车灯/lights, 中控/dashboard, 方向盘/steering, 座椅/seats, 后排/rear-seat, 车门/door, 后备厢/trunk, etc. We read that label per photo, group by category, and **round-robin across categories** (take 1 from each angle before a 2nd) until the cap. This *structurally* guarantees a varied set — no 5 dashboards.
     - Exterior cap **10**, priority: front-3/4 → side → rear-3/4 → front → rear → wheel → headlight → taillight → roof → detail.
     - Interior cap **~15**, priority: dashboard → full cabin → front seats → rear seats → steering → screen → door → console/gear → sunroof → trunk → storage → …
   - **LLM where needed (you approved it):** a vision model is used in two narrow, high-value spots — NOT to classify all ~18k photos blindly:
     1. **Fallback classifier** — when AutoHome's category label is missing/ambiguous for a photo, the LLM tags its angle so it still slots correctly.
     2. **Quality judge** — within a category with several candidates, the LLM picks the cleanest shot and rejects watermarked / blurry / cluttered user-uploads, so our set looks better than gonzo's.
     - Engine: **local Ollama `qwen2.5-vl` on the Vostro** (free, on-box) by default; hosted OpenRouter vision as a drop-in if local is too slow. Reuse the `src/lib/llm.ts` provider-switch pattern. Used sparingly (residual + tie-breaks), so cost/time stay bounded.

**3. Store** per color: `exterior_colors[i].images[]` (≤10), `interior_colors[i].images[]` (≤15). Keep flat `car.images[]` working for cards/catalog. Keep `spec_data.colors?: string[]` (back-compat).

## Build stage 0 — recon (settles the two unknowns)
On the Vostro: render `pic/series/{seriesId}.html`, (a) click a color → capture the **color-filter URL** keyed by `colorId`; (b) confirm **where the per-photo angle category comes from** — the page's section headers / a `data-` attribute / the pic XHR JSON. This decides whether the LLM is rarely needed (good labels) or does more work (weak labels). Flat-grab + LLM-classify is the fallback if color filtering is unavailable for a car.

## Data model — `src/lib/autohome-spec.ts` (`SpecData`)
```ts
type CarColor = { name_cn: string; name_ru?: string; name_uz?: string; name_en?: string; hex: string; color_id?: number; images?: string[] };
exterior_colors?: CarColor[];
interior_colors?: CarColor[];
```
`spec_data` is already public via `PUBLIC_CAR_COLUMNS` → no migration, no API change.

## Rendering — `src/app/[locale]/(marketing)/catalog/[slug]/car-detail-client.tsx`
- New **Colors** section: Exterior + Interior rows. Each swatch = hex dot (dual-tone = split) + localized name. Click an exterior swatch → that color's `images[]` load into the existing `CarGallery` (`src/components/catalog/car-gallery.tsx`); same for interior. Default = first exterior color; falls back to today's gallery if no color data.
- Add `color` to `CarSchema` JSON-LD (`src/components/shared/structured-data.tsx`).

## Automation / batch (Vostro)
New `deploy/collector/autohome-colors.mjs`: per car w/ `spec_data.series_id` → parse colors → per color: scrape (reused plumbing) → category-group + round-robin select (+ LLM fallback/judge) → re-host → PATCH `cars.spec_data`. Resume-safe. Test on 2–3 cars → batch all 208.

## Critical files
- **Reuse:** `deploy/collector/publish-from-targets.mjs` (`gallery`, `upsize`, `photoHash`, `rehostToDisk`, `fetchPhoto`) — extract to a shared `autohome-photos.mjs` if cleaner.
- **New:** `deploy/collector/autohome-colors.mjs` (orchestrator) + `select-photos.mjs` (category round-robin + LLM hooks) + a CN color dictionary.
- **LLM:** reuse `src/lib/llm.ts` (provider switch); add a small vision call (Ollama `qwen2.5-vl` / OpenRouter).
- **Edit:** `src/lib/autohome-spec.ts`, `…/catalog/[slug]/car-detail-client.tsx`, `src/components/catalog/car-gallery.tsx`, `src/components/shared/structured-data.tsx`.

## Numbers / scope
- 10 / exterior color, ~15 / interior color, category-diverse + deduped.
- ≈90 photos/car × 208 ≈ ~15–19k images (~4–6 GB on the Vostro; 397 GB free). Long gentle background batch; LLM used only on the residual so it stays feasible.

## Verify
- Config parse → correct colors+hex (Tesla MY 5769 → 6 exterior incl. 快银/#BAB8C3, 2 interior).
- A color's 10 photos are **distinct angles** (front/side/rear/wheel/…), zero dashboards-x5, no exact dupes, sharp 1100px.
- Car page: exterior+interior swatches; click swaps the gallery to that color's set.
- `tsc` + build green; deploy via the tar→Vostro→build→restart flow used for subtitles.

## Risks
- **Category-label source** is the main unknown → recon stage 0 settles it; LLM classifier covers weak labels.
- **LLM throughput**: local CPU vision is slow at scale → that's why the LLM is residual-only (fallback + tie-breaks), not a blanket pass; switch to hosted vision if needed.
- **Volume / long batch** → background + resume-safe.
- **Color-name dict** is finite + hand-built; unknown names fall back to CN (never blocks).

## Dependency to start building
Recon + scrape run on the **Vostro**, which is currently unreachable — **Tailscale SSH needs re-auth** (same block holding the last 2 subtitle PATCHes). Once that's cleared I start with stage-0 recon on one car.
