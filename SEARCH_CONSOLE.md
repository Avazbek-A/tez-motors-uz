# Search engines — submission & verification

Site: **https://tezmotors.uz** · sitemap: **/sitemap.xml** · robots: **/robots.txt**

## Already automated (no action needed)
- **IndexNow is live** — every new/updated car is pushed to **Bing + Yandex** instantly
  (key file: `https://tezmotors.uz/ac0acca5ba2ade12a7b652db2f746a8c.txt`). No account
  or login required. A manual **"Submit catalog to IndexNow"** button lives on
  **/admin → Engine Ops** for an initial bulk push or any time you want to re-push.
- **Sitemap + robots** are complete (all cars/parts/scooters/posts × ru/uz/en, with
  hreflang + lastmod) and robots.txt already references the sitemap.
- **Verification meta tags** are wired — they render automatically once the tokens
  are set (see below).

## What only YOU can do: verify ownership (one-time, ~15 min)
Verifying ownership requires logging into each engine's console with your account —
that's the part I can't do. It unlocks the **dashboards** (indexing coverage,
structured-data warnings, Core Web Vitals, search analytics) — worth doing.

For each engine, the **fastest path** is the meta-tag method:
> add the property → it shows you a `<meta name="…-verification" content="TOKEN">` →
> **paste me the TOKEN** (it's public) → I set the env var + deploy → you click **Verify**.

### Google — Search Console
1. https://search.google.com/search-console → **Add property**.
2. Easiest robust option: **Domain** property → it gives a **DNS TXT** record → add it
   at your domain registrar (covers http/https + all subdomains, no redeploy). 
   *Or* **URL prefix** `https://tezmotors.uz` → choose **HTML tag** → paste me the token
   (I set `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`).
3. After verifying: **Sitemaps → enter `sitemap.xml` → Submit.**

### Yandex — Webmaster
1. https://webmaster.yandex.com → **Add site** → `https://tezmotors.uz`.
2. Verify → **Meta tag** → paste me the token (`NEXT_PUBLIC_YANDEX_VERIFICATION`),
   or use the DNS/HTML-file method.
3. **Indexing → Sitemap files → add `https://tezmotors.uz/sitemap.xml`.**
   (Yandex also already gets new cars via IndexNow.)

### Bing — Webmaster Tools
1. https://www.bing.com/webmasters → **Add site** (or **Import from Google Search
   Console** — one click, reuses Google verification).
2. If verifying directly: **Meta tag** → paste me the token (`NEXT_PUBLIC_BING_VERIFICATION`).
3. **Sitemaps → Submit `https://tezmotors.uz/sitemap.xml`.**
   (Bing also already gets new cars via IndexNow.)

## Optional — richer API automation (give me these only if you want them)
IndexNow already covers instant Bing/Yandex submission. These add their official
Submit/coverage APIs on top. **All are secrets → put them in the Vostro
`~/tez-motors/.env.local`, NOT in chat** (same rule as the Telegram/DB secrets):
- **Bing**: `BING_WEBMASTER_KEY` (Bing Webmaster Tools → Settings → API access).
- **Yandex**: `YANDEX_WEBMASTER_OAUTH` + `YANDEX_WEBMASTER_HOST_ID` (oauth.yandex.com).
- **Google**: a service-account JSON added as an owner in Search Console — heavier;
  usually not worth it vs the one-time "Submit sitemap" click.

Tell me which (if any) you've added and I'll wire the corresponding API.

## Tokens recap
- **Verification tokens** = public → paste in chat, I set `NEXT_PUBLIC_*_VERIFICATION` + deploy.
- **API keys / OAuth tokens** = secret → Vostro `.env.local` only.
