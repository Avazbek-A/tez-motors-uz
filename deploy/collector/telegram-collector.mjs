/**
 * Telegram market-price collector. Reads recent messages from the car-sales
 * channels you follow and POSTs identified listings to the website's
 * /api/admin/market/ingest endpoint (which normalizes prices + dedupes).
 *
 * Reading arbitrary CHANNEL HISTORY needs the Telegram CLIENT API (MTProto) with
 * YOUR account — the Bot API only sees messages sent to the bot. We use gramJS.
 *
 * One-time setup:
 *   cd deploy/collector && npm install
 *   1) Get api_id / api_hash at https://my.telegram.org → API development tools
 *      export TG_API_ID=123456  TG_API_HASH=abc...
 *   2) Mint a reusable session string (interactive login, asks phone + code):
 *      node telegram-collector.mjs --login
 *      → copy the printed TG_SESSION into your env (keep it SECRET — it's a login)
 *   3) Configure channels + ingest, then run on a schedule:
 *      export TG_SESSION="1Ab...="            # from step 2
 *      export TG_CHANNELS="@autosalon_tashkent,@bu_avto_uz"
 *      export INGEST_URL="https://tezmotors.uz/api/admin/market/ingest"
 *      export MARKET_INGEST_SECRET="…same value as the app secret…"
 *      node telegram-collector.mjs
 *   Schedule with cron/systemd-timer (e.g. every 6h). Respect each channel's rules.
 */
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Config from the shell env first, then .env.local (so everything can live in one
// file on the box — loadEnv() is hoisted and returns every KEY=VALUE from it).
const FILEENV = loadEnv();
const cfg = (k, d = "") => process.env[k] || FILEENV[k] || d;
const API_ID = Number(cfg("TG_API_ID") || 0);
const API_HASH = cfg("TG_API_HASH");
const SESSION = cfg("TG_SESSION");
const CHANNELS = cfg("TG_CHANNELS").split(",").map((s) => s.trim()).filter(Boolean);
const INGEST_URL = cfg("INGEST_URL", "http://127.0.0.1:3000/api/admin/market/ingest");
const SECRET = cfg("MARKET_INGEST_SECRET");
const PER_CHANNEL = Number(cfg("TG_LIMIT") || 60);

// Catalog-driven model dictionary: fetched from the live cars table so Telegram
// tracks EVERY model the dealer stocks (not a hardcoded list). A message matches a
// model when it contains the brand + all the model's significant tokens (engine/
// fuel/drivetrain noise stripped, so "Tiggo 8 Pro" stays distinct from "Tiggo 8").
// Mirrors src/lib/model-normalize.ts.
const TRIM_NOISE = /^(\d(?:\.\d)?[tl]|hev|phev|mhev|dm-?i|dmi|ev|bev|awd|4wd|2wd|fwd|rwd)$/i;
const sigTokens = (lc) => lc.split(/[\s/-]+/).filter((t) => t.length >= 2 && !TRIM_NOISE.test(t));

function loadEnv() {
  for (const p of ["../../.env.local", "../.env.local", "./.env.local", "/home/rayxona/tez-motors/.env.local"]) {
    try { const e = {}; for (const l of readFileSync(resolve(p), "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0) e[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^['"]|['"]$/g, ""); } if (e.NEXT_PUBLIC_SUPABASE_URL) return e; } catch {}
  }
  return {};
}

async function buildModels() {
  const env = loadEnv();
  const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!U || !K) return [];
  const cars = await (await fetch(`${U}/rest/v1/cars?select=brand,model&limit=400`, { headers: { apikey: K, authorization: `Bearer ${K}` } })).json();
  const seen = new Set(), out = [];
  for (const c of cars || []) {
    const brand = String(c.brand || "").trim(), model = String(c.model || "").trim();
    if (!brand || !model) continue;
    const id = `${brand}|${model}`.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ brand, model, brandLc: brand.toLowerCase(), tokens: sigTokens(model.toLowerCase()) });
  }
  out.sort((a, b) => b.tokens.length - a.tokens.length); // most-specific first
  return out;
}

function identify(text, models) {
  const t = text.toLowerCase();
  for (const m of models) {
    if (m.tokens.length && t.includes(m.brandLc) && m.tokens.every((tok) => t.includes(tok))) return m;
  }
  return null;
}

async function doLogin() {
  if (!API_ID || !API_HASH) {
    console.error("Set TG_API_ID and TG_API_HASH first (https://my.telegram.org).");
    process.exit(1);
  }
  const { TelegramClient } = await import("telegram");
  const { StringSession } = await import("telegram/sessions/index.js");
  const client = new TelegramClient(new StringSession(""), API_ID, API_HASH, { connectionRetries: 3 });
  const rl = readline.createInterface({ input, output });
  await client.start({
    phoneNumber: async () => (await rl.question("Phone (+998…): ")).trim(),
    password: async () => (await rl.question("2FA password (blank if none): ")).trim(),
    phoneCode: async () => (await rl.question("Login code: ")).trim(),
    onError: (e) => console.error(e),
  });
  rl.close();
  console.log("\n=== TG_SESSION (store securely, treat as a password) ===\n");
  console.log(client.session.save());
  console.log("\nSet it as TG_SESSION and re-run without --login.");
  await client.disconnect();
  process.exit(0);
}

async function collect() {
  if (!SESSION || !API_ID || !API_HASH) {
    console.error("Set TG_API_ID, TG_API_HASH, TG_SESSION (run --login once).");
    process.exit(1);
  }
  if (!INGEST_URL || !SECRET) {
    console.error("Set INGEST_URL and MARKET_INGEST_SECRET.");
    process.exit(1);
  }
  if (CHANNELS.length === 0) {
    console.error("Set TG_CHANNELS (comma-separated @usernames).");
    process.exit(1);
  }
  const models = await buildModels();
  if (models.length === 0) { console.error("No catalog models loaded (check Supabase env in .env.local)."); process.exit(1); }
  console.log(`tracking ${models.length} catalog models`);

  const { TelegramClient } = await import("telegram");
  const { StringSession } = await import("telegram/sessions/index.js");
  const client = new TelegramClient(new StringSession(SESSION), API_ID, API_HASH, { connectionRetries: 3 });
  await client.connect();

  const listings = [];
  for (const channel of CHANNELS) {
    try {
      const messages = await client.getMessages(channel, { limit: PER_CHANNEL });
      let n = 0;
      for (const msg of messages) {
        const text = msg?.message || msg?.text || "";
        if (!text || text.length < 12) continue;
        const hit = identify(text, models);
        if (!hit) continue;
        listings.push({
          source: "telegram",
          source_ref: `${channel}:${msg.id}`,
          brand: hit.brand,
          model: hit.model,
          year: Number((text.match(/\b(20\d{2})\b/) || [])[1]) || null,
          raw_text: text.slice(0, 500),
          posted_at: msg.date ? new Date(msg.date * 1000).toISOString() : null,
        });
        n++;
      }
      console.log(`${channel}: ${n} identified / ${messages.length} scanned`);
    } catch (e) {
      console.error(`${channel}: ${e.message}`);
    }
  }
  await client.disconnect();

  if (listings.length === 0) return console.log("nothing to ingest");
  const res = await fetch(INGEST_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` },
    body: JSON.stringify({ source: "telegram", listings: listings.slice(0, 500) }),
  });
  console.log("ingest:", res.status, (await res.text()).slice(0, 300));
}

if (process.argv.includes("--login")) doLogin();
else collect().catch((e) => { console.error(e); process.exit(1); });
