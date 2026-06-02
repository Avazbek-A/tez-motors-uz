#!/usr/bin/env node
/**
 * Pre-deploy environment readiness check. Verifies the REQUIRED secrets are set
 * and reports which RECOMMENDED / OPTIONAL integrations are live vs dark.
 * Exits non-zero if any required var is missing.
 *
 *   node scripts/check-env.mjs                 # checks process.env
 *   node scripts/check-env.mjs .env.local      # also loads a dotenv file first
 */
import { readFileSync, existsSync } from "node:fs";

// Optional: load a dotenv-style file passed as arg (no dependency).
const file = process.argv[2];
if (file && existsSync(file)) {
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const has = (k) => typeof process.env[k] === "string" && process.env[k].trim().length > 0;
const allSet = (ks) => ks.every(has);

const REQUIRED = [
  ["NEXT_PUBLIC_SUPABASE_URL", "Supabase project URL"],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "Public anon key (RLS-gated reads)"],
  ["SUPABASE_SERVICE_ROLE_KEY", "Server-only privileged writes"],
  ["ADMIN_PASSWORD", "Admin panel login"],
  ["NEXT_PUBLIC_SITE_URL", "Canonical site origin"],
];

const RECOMMENDED = [
  [["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"], "Lead notifications to dealer"],
  [["CRON_SECRET"], "Guards /api/cron/* (set on app + cron Worker)"],
  [["RESEND_API_KEY", "EMAIL_FROM", "DEALER_EMAIL"], "Transactional + dealer email"],
  [["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "TURNSTILE_SECRET"], "Bot protection on forms"],
];

const OPTIONAL = [
  [["LLM_API_KEY"], "AI assistant (else retrieval-only)"],
  [["ESKIZ_EMAIL", "ESKIZ_PASSWORD"], "Customer phone-OTP SMS"],
  [["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "NEXT_PUBLIC_VAPID_PUBLIC_KEY"], "Web Push"],
  [["PAYME_MERCHANT_ID", "PAYME_MERCHANT_KEY", "NEXT_PUBLIC_PAYME_MERCHANT_ID"], "Payme deposits"],
  [["CLICK_SERVICE_ID", "CLICK_MERCHANT_ID", "CLICK_SECRET_KEY", "NEXT_PUBLIC_CLICK_MERCHANT_ID"], "Click deposits"],
  [["MARKET_INGEST_SECRET"], "Market-intel collector ingest"],
  [["WHATSAPP_VERIFY_TOKEN", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID"], "WhatsApp bot"],
  [["TELEGRAM_WEBHOOK_SECRET"], "Telegram inbound bot"],
  [["NEXT_PUBLIC_PLAUSIBLE_DOMAIN"], "Analytics"],
];

let missing = 0;
console.log("\n  REQUIRED (site is broken without these)");
for (const [k, desc] of REQUIRED) {
  const ok = has(k);
  if (!ok) missing++;
  console.log(`   ${ok ? "✓" : "✗ MISSING"}  ${k.padEnd(34)} ${desc}`);
}

console.log("\n  RECOMMENDED (fail-open if unset)");
for (const [ks, desc] of RECOMMENDED) {
  const ok = allSet(ks);
  console.log(`   ${ok ? "✓ live" : "· dark"}  ${ks.join(" + ").padEnd(40)} ${desc}`);
}

console.log("\n  OPTIONAL integrations (ship dark until set)");
for (const [ks, desc] of OPTIONAL) {
  const ok = allSet(ks);
  console.log(`   ${ok ? "✓ live" : "· dark"}  ${ks[0].padEnd(40)} ${desc}`);
}

if (missing > 0) {
  console.log(`\n  ✗ ${missing} required variable(s) missing — deployment will not work.\n`);
  process.exit(1);
}
console.log("\n  ✓ All required variables present. Safe to deploy.\n");
