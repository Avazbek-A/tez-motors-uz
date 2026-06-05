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

// INTEGRITY — the dangerous middle state: a group half-configured. "Dark"
// (all unset) is fine; "live" (all set) is fine; PARTIAL means a customer-
// facing trigger fires but its backend can't work. These fail the check.
const someSet = (ks) => ks.some(has);
const integrity = [];
const partial = (ks, label) => {
  if (someSet(ks) && !allSet(ks)) {
    const miss = ks.filter((k) => !has(k));
    integrity.push(`${label}: half-configured — missing ${miss.join(", ")}`);
  }
};
// Payment buttons render off the public id; without the secret/ids the endpoint
// fails auth → a dead checkout the customer can still click.
partial(["PAYME_MERCHANT_ID", "PAYME_MERCHANT_KEY", "NEXT_PUBLIC_PAYME_MERCHANT_ID"], "Payme");
partial(["CLICK_SERVICE_ID", "CLICK_MERCHANT_ID", "CLICK_SECRET_KEY", "NEXT_PUBLIC_CLICK_MERCHANT_ID"], "Click");
// Push: public key set but no signing keypair → subscribe succeeds, send fails.
partial(["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT", "NEXT_PUBLIC_VAPID_PUBLIC_KEY"], "Web Push");
// Email: a key with no verified sender → every send 422s.
partial(["RESEND_API_KEY", "EMAIL_FROM"], "Resend email");
// SMS OTP: one credential without the other → auth fails on every send.
partial(["ESKIZ_EMAIL", "ESKIZ_PASSWORD"], "Eskiz SMS");

// Dependency checks: a feature flag set without the engine it rides on.
const dep = (flag, base, label) => {
  if (someSet(Array.isArray(flag) ? flag : [flag]) && !allSet(Array.isArray(base) ? base : [base])) {
    integrity.push(`${label}: set but ${Array.isArray(base) ? base.join("+") : base} is missing`);
  }
};
dep("TELEGRAM_WEBHOOK_SECRET", "TELEGRAM_BOT_TOKEN", "Telegram inbound bot");
dep("TELEGRAM_OPERATOR_CHAT_IDS", "TELEGRAM_BOT_TOKEN", "Telegram operator copilot");
dep("AI_AUTORESPOND", "LLM_API_KEY", "AI auto-responder");

// Edge-reachability: an Ollama/localhost LLM URL can't be reached from the
// Cloudflare Workers edge — only the self-hosted/local deployment.
if (has("LLM_API_URL") && /localhost|127\.0\.0\.1/.test(process.env.LLM_API_URL)) {
  integrity.push("LLM_API_URL points at localhost — unreachable from the Workers edge (self-host only)");
}
// Production origin should be https.
if (has("NEXT_PUBLIC_SITE_URL") && /^http:\/\/(?!localhost|127\.)/.test(process.env.NEXT_PUBLIC_SITE_URL)) {
  integrity.push("NEXT_PUBLIC_SITE_URL is http:// on a non-local host — use https in production");
}

console.log("\n  INTEGRITY (half-configured / inconsistent — these break things)");
if (integrity.length === 0) {
  console.log("   ✓ no half-configured integrations");
} else {
  for (const msg of integrity) console.log(`   ✗ ${msg}`);
}

if (missing > 0 || integrity.length > 0) {
  if (missing > 0) console.log(`\n  ✗ ${missing} required variable(s) missing — deployment will not work.`);
  if (integrity.length > 0) console.log(`  ✗ ${integrity.length} integrity problem(s) — fix before launch (a half-set integration fails for real users).`);
  console.log("");
  process.exit(1);
}
console.log("\n  ✓ All required variables present, no half-configured integrations. Safe to deploy.\n");
