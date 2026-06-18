/**
 * Customs rate-drift watch (Leap 1 — keep our rates honest vs current law).
 *
 * Our customs matrix (src/lib/customs-uz.ts) was reverse-engineered from
 * @autodeklarantbot + grounded in legislation (src/lib/customs-rates.ts). UZ
 * customs rates move (ПКМ amendments, BHM, EV utilization). This job monthly
 * re-probes a set of CANARY cells on the bot and compares the bot's reported
 * RATE STRINGS (duty %, util БРВ, VAT %, fee БРВ — FX-independent, so no false
 * positives from exchange-rate moves) against our recorded baseline. Any change
 * = the law/practice likely shifted → alert the dealer to re-verify on lex.uz /
 * tarif.customs.uz and update customs-uz.ts.
 *
 * Run:  node customs-drift.mjs        (dry — prints diffs)
 *       node customs-drift.mjs --notify   (Telegram/email on drift)
 * Schedule monthly via crontab on the Vostro.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const NOTIFY = process.argv.includes("--notify");
function loadEnv() {
  for (const p of ["../../.env.local", "../.env.local", "./.env.local", "/home/rayxona/tez-motors/.env.local"]) {
    try { const e = {}; for (const l of readFileSync(resolve(p), "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0) e[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^['"]|['"]$/g, ""); } if (e.TG_SESSION) return e; } catch {}
  }
  return {};
}
const env = loadEnv();
const NM = "/home/rayxona/tez-motors/deploy/collector/node_modules";
const { TelegramClient } = await import(`${NM}/telegram/index.js`);
const { StringSession } = await import(`${NM}/telegram/sessions/index.js`);
const client = new TelegramClient(new StringSession(env.TG_SESSION), Number(env.TG_API_ID), env.TG_API_HASH, { connectionRetries: 3 });
await client.connect();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BOT = "autodeklarantbot";
const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
const snap = async () => { const m = (await client.getMessages(BOT, { limit: 1 }))[0]; return { m, key: `${m?.id}|${(m?.message || "").length}` }; };
async function act(fn) { const b = await snap(); await fn(); const t0 = Date.now(); while (Date.now() - t0 < 14000) { await sleep(1000); const n = await snap(); if (n.key !== b.key) return n.m; } return (await snap()).m; }
async function click(m, t) { const x = m.replyMarkup?.rows?.flatMap((r) => r.buttons).find((b) => b.text === t) || m.replyMarkup?.rows?.flatMap((r) => r.buttons).find((b) => b.text.includes(t)); if (x) await m.click({ text: x.text }).catch(() => {}); }

// Universal navigator (same as the recon prober): drive the bot to a result.
async function probe(c) {
  let m = await act(() => client.sendMessage(BOT, { message: "/start" }));
  if (m.replyMarkup?.rows?.some((r) => r.buttons.some((b) => /Русский/.test(b.text)))) m = await act(() => click(m, "🇷🇺 Русский"));
  for (let i = 0; i < 20; i++) {
    const t = norm(m.message);
    if (/Код ТН ВЭД|🧮|Растаможка:|ниже экологической/i.test(t)) return t;
    let fn = null;
    if (/Выберите вид транспорт/i.test(t)) fn = () => click(m, c.type);
    else if (/Подтверждаете/i.test(t)) fn = () => click(m, "Да ✅");
    else if (/часть фуры/i.test(t)) fn = () => click(m, c.part);
    else if (/количество людей|рассчитан автобус/i.test(t)) fn = () => click(m, c.capacity);
    else if (/возраст/i.test(t)) fn = () => click(m, c.age);
    else if (/тип топлив|тип двигател/i.test(t)) fn = () => click(m, c.fuel);
    else if (/состояние двигател/i.test(t)) fn = () => click(m, c.state);
    else if (/масс/i.test(t)) fn = () => client.sendMessage(BOT, { message: "3000" });
    else if (/объ[её]м двигател/i.test(t)) fn = () => client.sendMessage(BOT, { message: c.cc || "2000" });
    else if (/экологическ/i.test(t)) fn = () => click(m, c.eco);
    else if (/сертификат/i.test(t)) fn = () => click(m, c.cert || "Имеется");
    else if (/страну производства/i.test(t)) fn = () => click(m, c.country || "🇨🇳Китай");
    else if (/стоимост/i.test(t)) fn = () => client.sendMessage(BOT, { message: "20000" });
    else { const b = m.replyMarkup?.rows?.flatMap((r) => r.buttons).find((x) => !/Назад/.test(x.text) && !x.url); if (b) fn = () => click(m, b.text); }
    if (!fn) { await sleep(1000); m = (await snap()).m; continue; }
    m = await act(fn);
  }
  return "TIMEOUT";
}
const rateOf = (t) => ({
  duty: (t.match(/пошлина \(([^)]+)\)/) || [, "—"])[1].trim(),
  util: (t.match(/тилизацион[^(]*\(([^)]+)\)/) || [, "—"])[1].trim(),
  vat: (t.match(/НДС \(([^)]+)\)/) || [, "—"])[1].trim(),
  fee: (t.match(/Таможенный сбор \(([^)]+)\)/) || [, "—"])[1].trim(),
  banned: /ниже экологической/i.test(t),
});

// CANARY cells + baseline rate strings recorded 2026-06-17 (FX-independent).
const CANARIES = [
  { l: "car petrol new cert", base: "15% + 1 $/см3|180 БРВ", type: "🚗 Автомобиль", age: "До 1 года", fuel: "⛽️ Бензин", cc: "2000", cert: "Имеется", country: "🇨🇳Китай" },
  { l: "car petrol 1-3 cert", base: "30% + 2.5 $/см3|180 БРВ", type: "🚗 Автомобиль", age: "С 1 г. до 3 лет", fuel: "⛽️ Бензин", cc: "2000", cert: "Имеется", country: "🇨🇳Китай" },
  { l: "car petrol >3 cert", base: "40% + 3 $/см3|330 БРВ", type: "🚗 Автомобиль", age: "Более 3 лет", fuel: "⛽️ Бензин", cc: "2000", cert: "Имеется", country: "🇨🇳Китай" },
  { l: "car petrol 1-3 NOCERT", base: "60% + 5 $/см3|180 БРВ", type: "🚗 Автомобиль", age: "С 1 г. до 3 лет", fuel: "⛽️ Бензин", cc: "2000", cert: "Не имеется" },
  { l: "car electric 1-3", base: "0%|120 БРВ", type: "🚗 Автомобиль", age: "С 1 г. до 3 лет", fuel: "🔋 Электр", cc: "2000", cert: "Имеется", country: "🇨🇳Китай" },
  { l: "truck petrol <=3 cert", base: "30%|210 БРВ", type: "🚚 Мини грузовик", age: "До 3 лет", fuel: "⛽️ Бензин", cc: "2000", cert: "Имеется", country: "🇨🇳Китай" },
  { l: "engine new", base: "0%|—", type: "⚙️ Мотор", fuel: "⛽️ Бензин", cc: "2000", state: "Новый" },
  { l: "bus 10-59 <=3 Euro5", base: "Лгота|120 БРВ", type: "🚍 Автобус", capacity: "от 10 до 59", age: "До 3 лет", fuel: "⛽️ Бензин", cc: "2000", eco: "Евро-5 и выше", cert: "Имеется", country: "🇨🇳Китай" },
  { l: "fura tractor >7 hiE5", base: "70% + 3 $/см3|1360 БРВ", type: "🚛 Фура", part: "🚛 Тягач", age: "Более 7", fuel: "⛽️ Дизель", eco: "Выше Евро-5", cc: "10000", cert: "Имеется", country: "🇨🇳Китай" },
];

// Normalize rate strings so cosmetic formatting (e.g. "70 %" vs "70%") never
// triggers a false alarm — only genuine rate changes count as drift.
const nrm = (s) => (s || "").toLowerCase().replace(/\s+/g, "");
const drift = [], failed = [];
for (const c of CANARIES) {
  let t = await probe(c);
  if (t === "TIMEOUT") { await sleep(2500); t = await probe(c); } // one retry — probe flakiness ≠ rate change
  if (t === "TIMEOUT") { failed.push(c.l); await sleep(2000); continue; }
  const r = rateOf(t);
  const now = r.banned ? "BANNED" : `${r.duty}|${r.util}`;
  if (nrm(now) !== nrm(c.base)) drift.push(`${c.l}:  was [${c.base}]  →  now [${now}]`);
  await sleep(2000);
}

await client.disconnect();
if (failed.length) console.log("ℹ️ could not verify (probe failed, not drift): " + failed.join(", "));
if (!drift.length) { console.log("✓ no customs-rate drift — all canaries match the baseline."); process.exit(0); }
console.log("⚠️ CUSTOMS RATE DRIFT DETECTED:\n  " + drift.join("\n  "));

if (NOTIFY) {
  const text = ["⚠️ Растаможка: тарифы изменились?", ...drift, "", "Сверьте с lex.uz / tarif.customs.uz и обновите customs-uz.ts."].join("\n").slice(0, 3500);
  const jobs = [];
  const chat = env.TELEGRAM_ERROR_CHAT_ID || env.TELEGRAM_CHAT_ID;
  if (env.TELEGRAM_BOT_TOKEN && chat) jobs.push(fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }) }).catch(() => {}));
  if (env.RESEND_API_KEY && env.EMAIL_FROM && env.DEALER_EMAIL) jobs.push(fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ from: env.EMAIL_FROM, to: env.DEALER_EMAIL, subject: "[Tez Motors] Customs rate drift", text }) }).catch(() => {}));
  await Promise.allSettled(jobs);
}
process.exit(0);
