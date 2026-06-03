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

const API_ID = Number(process.env.TG_API_ID || 0);
const API_HASH = process.env.TG_API_HASH || "";
const SESSION = process.env.TG_SESSION || "";
const CHANNELS = (process.env.TG_CHANNELS || "").split(",").map((s) => s.trim()).filter(Boolean);
const INGEST_URL = process.env.INGEST_URL;
const SECRET = process.env.MARKET_INGEST_SECRET;
const PER_CHANNEL = Number(process.env.TG_LIMIT || 60);

// Brand+model dictionary — only messages matching a pair become listings, so the
// data is clean. Extend with the models you track. Patterns are case-insensitive.
const MODELS = [
  { brand: "BYD", model: "Song Plus", re: /\bsong\s*plus\b|сонг\s*плюс/i },
  { brand: "BYD", model: "Seal", re: /\bbyd\s*seal\b|сил\b/i },
  { brand: "BYD", model: "Atto 3", re: /\batto\s*3\b/i },
  { brand: "BYD", model: "Han", re: /\bbyd\s*han\b|хан\b/i },
  { brand: "BYD", model: "Chazor", re: /\bchazor\b|чазор/i },
  { brand: "Chery", model: "Tiggo 8 Pro", re: /tiggo\s*8\s*pro|тигго\s*8\s*про/i },
  { brand: "Chery", model: "Tiggo 8", re: /tiggo\s*8\b|тигго\s*8/i },
  { brand: "Chery", model: "Tiggo 7 Pro", re: /tiggo\s*7\s*pro|тигго\s*7\s*про/i },
  { brand: "Chery", model: "Tiggo 7", re: /tiggo\s*7\b|тигго\s*7/i },
  { brand: "Chery", model: "Arrizo 8", re: /arrizo\s*8|арризо\s*8/i },
  { brand: "Haval", model: "Jolion", re: /\bjolion\b|джолион/i },
  { brand: "Haval", model: "H6", re: /\bhaval\s*h6\b|хавал\s*h6/i },
  { brand: "Haval", model: "Dargo", re: /\bdargo\b|дарго/i },
  { brand: "Geely", model: "Coolray", re: /\bcoolray\b|кулрей/i },
  { brand: "Geely", model: "Monjaro", re: /\bmonjaro\b|монджаро/i },
  { brand: "Geely", model: "Atlas Pro", re: /atlas\s*pro|атлас\s*про/i },
  { brand: "Changan", model: "CS75 Plus", re: /cs75\s*plus|cs-?75/i },
  { brand: "Changan", model: "UNI-T", re: /\buni-?t\b/i },
  { brand: "Zeekr", model: "001", re: /\bzeekr\s*001\b|зикр\s*001/i },
  { brand: "Tank", model: "300", re: /\btank\s*300\b|танк\s*300/i },
  { brand: "Tank", model: "500", re: /\btank\s*500\b|танк\s*500/i },
  { brand: "Omoda", model: "C5", re: /\bomoda\s*c5\b|омода\s*c5/i },
  { brand: "Jaecoo", model: "J7", re: /\bjaecoo\s*j7\b|джейку\s*j7/i },
];

function identify(text) {
  for (const m of MODELS) if (m.re.test(text)) return m;
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
        const hit = identify(text);
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
