# Sourcing photos & video for the catalog

The admin car and part forms have an **Import from URL** panel (the
`MediaImporter`). It does two things:

1. **Extract** — paste a source page URL (AutoHome, Alibaba, AliExpress, a brand
   press page, …); the server pulls candidate image/video URLs from the page's
   `og:image`, JSON-LD, and `<img>`/`<video>` tags. Tick the ones you want.
2. **Re-host** — chosen images are downloaded and stored in **your own Supabase
   Storage** (`car-images` / `part-images`) — not hotlinked — so they're durable
   and won't break if the source changes or blocks hotlinking. The new URLs are
   added to the car/part's `images[]`. (Videos aren't re-hosted; click "Use
   video" to drop an embeddable URL into `video_url`.)

You can always **paste direct image URLs** in the textarea — this path always
works and is the fallback for sites that block server fetches (below).

## Car configuration from AutoHome (and similar)
On the **car** form, the Import panel also pulls the **configuration** from the
pasted page (AI-assisted): it strips the page text and the LLM maps it — even
from Chinese AutoHome spec tables — to our fields (year, body/fuel type,
transmission, drivetrain, engine volume & power, colour). Click **"Apply
configuration"** to fill the form; **review before saving**. It never extracts a
price (that's your landed-cost decision). Requires `LLM_API_KEY`; without it the
button simply won't appear and you fill the form manually.

## Per-source notes

### Cars — AutoHome (autohome.com.cn)
AutoHome is JS-rendered with bot protection and is CN-geo-sensitive, so a
server-side **Extract often returns only the `og:image`** (or nothing) from a
Worker. Reliable flow:
- Open the model's photo page in your browser, right-click the gallery images →
  "Copy image address", and **paste the direct image URLs** into the panel.
- Or extract what you can, then top up with pasted URLs.

### Parts — Alibaba / AliExpress
Product galleries are usually in the page's embedded JSON / `<img>` tags; Extract
frequently works for the main images. If a listing is JS-only, copy the image
addresses from the product gallery and paste them. **This is the strongest case
for reuse**: when you're buying the part from that supplier, their product
photos are intended for buyers to list with.

## Rights — read this
You are responsible for having the right to use any image you import.
- ✅ **Supplier product photos for parts you actually buy from that supplier**
  (Alibaba/AliExpress) — standard practice.
- ⚠️ **AutoHome / manufacturer imagery** — editorial/press use is common in the
  trade, but credit the source where appropriate and don't imply the photo is
  your own studio shot of the exact unit if it isn't.
- ❌ **Don't** lift photos from a competitor dealer's site, and don't present
  stock imagery as a VIN-specific photo of a used car with real wear.

When in doubt, shoot your own photos of physical stock — they convert best and
carry zero licensing risk.
