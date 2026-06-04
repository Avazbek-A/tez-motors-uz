/**
 * Instagram content discovery — via the OFFICIAL Instagram Graph API.
 *
 * HONEST SCOPE: Instagram's official API does NOT allow scraping arbitrary
 * profiles. What it DOES allow (for a connected Instagram BUSINESS/Creator
 * account) is Hashtag Search — finding recent/top public media for a hashtag.
 * That's what this collector uses. It's the right tool for car-market content
 * discovery + marketing research (what's trending under #avtosalontashkent etc.)
 * without the ban/ToS risk and constant breakage of unofficial profile scrapers.
 *
 * It writes a JSON report the dealer reviews (no DB table — this is research, not
 * catalog data). Single `fetch` per call, fail-open, env-gated.
 *
 * One-time setup (Meta side):
 *   - An Instagram Business/Creator account linked to a Facebook Page.
 *   - A Meta app with a long-lived access token that has instagram_basic +
 *     instagram_manage_insights (or pages_show_list) permissions.
 *   - Your IG Business account id (the "user_id" below).
 *   Docs: https://developers.facebook.com/docs/instagram-api/guides/hashtag-search
 *
 * Run:
 *   export IG_ACCESS_TOKEN="EAAB..."     # long-lived token
 *   export IG_USER_ID="178414..."         # your IG Business account id
 *   export IG_HASHTAGS="avtosalontashkent,byduzbekistan,cheryuzbekistan"
 *   export IG_MEDIA_TYPE=top              # top | recent  (default top)
 *   export IG_OUT=./instagram-report.json
 *   node instagram-collector.mjs
 *
 * API limit: a user can query a rolling set of ~30 unique hashtags per 7 days.
 */
import { writeFileSync } from "node:fs";

const BASE = "https://graph.facebook.com/v21.0";
const TOKEN = process.env.IG_ACCESS_TOKEN;
const USER_ID = process.env.IG_USER_ID;
const MEDIA_TYPE = (process.env.IG_MEDIA_TYPE || "top").toLowerCase() === "recent" ? "recent_media" : "top_media";
const OUT = process.env.IG_OUT || "./instagram-report.json";
const HASHTAGS = (process.env.IG_HASHTAGS || "avtosalontashkent,byduzbekistan,cheryuzbekistan,avtouzbekistan")
  .split(",").map((s) => s.trim().replace(/^#/, "")).filter(Boolean);

const MEDIA_FIELDS = "id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count";

async function api(path, params) {
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", TOKEN);
  const res = await fetch(url, { headers: { accept: "application/json" } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    throw new Error(json?.error?.message || `HTTP ${res.status}`);
  }
  return json;
}

/** Resolve a hashtag string → its IG hashtag id (required before media lookup). */
async function hashtagId(tag) {
  const r = await api("ig_hashtag_search", { user_id: USER_ID, q: tag });
  return r?.data?.[0]?.id || null;
}

async function main() {
  if (!TOKEN || !USER_ID) {
    console.error("[instagram] IG_ACCESS_TOKEN + IG_USER_ID required (official Graph API). Skipping — fail-open.");
    console.error("  See the header of this file for the one-time Meta setup.");
    process.exit(0);
  }

  const report = { generated_at: new Date().toISOString(), media_type: MEDIA_TYPE, hashtags: [] };
  for (const tag of HASHTAGS) {
    try {
      const id = await hashtagId(tag);
      if (!id) {
        report.hashtags.push({ tag, error: "hashtag not found" });
        console.error(`#${tag}: not found`);
        continue;
      }
      const media = await api(`${id}/${MEDIA_TYPE}`, { user_id: USER_ID, fields: MEDIA_FIELDS });
      const items = (media?.data || []).map((m) => ({
        id: m.id,
        caption: (m.caption || "").slice(0, 500),
        media_type: m.media_type,
        media_url: m.media_url || null,
        permalink: m.permalink || null,
        timestamp: m.timestamp || null,
        like_count: m.like_count ?? null,
        comments_count: m.comments_count ?? null,
      }));
      report.hashtags.push({ tag, hashtag_id: id, count: items.length, media: items });
      console.log(`#${tag}: ${items.length} ${MEDIA_TYPE} posts`);
    } catch (e) {
      report.hashtags.push({ tag, error: e?.message || String(e) });
      console.error(`#${tag}: ${e?.message || e}`);
    }
  }

  writeFileSync(OUT, JSON.stringify(report, null, 2), "utf8");
  const total = report.hashtags.reduce((a, h) => a + (h.count || 0), 0);
  console.log(`wrote ${total} posts across ${HASHTAGS.length} hashtags → ${OUT}`);
  console.log("Review for trending car content, competitor activity, and image/marketing ideas.");
}

main().catch((e) => {
  console.error("[instagram] failed:", e?.message || e);
  process.exit(1);
});
