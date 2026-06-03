/**
 * Seed demo business activity so every admin feature shows real data:
 * leads, orders, purchase orders, market listings, expenses, an invoice,
 * a shipment, a warranty, CRM tasks and a content draft. Service-role; reads
 * .env.production. Idempotent-ish (safe to re-run; may add duplicates).
 *
 *   node scripts/seed-demo-activity.mjs
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
for (const line of (await readFile(resolve(ROOT, ".env.production"), "utf8")).split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
const dateAgo = (n) => daysAgo(n).slice(0, 10);
const rid = () => "DEMO-" + Math.random().toString(36).slice(2, 8).toUpperCase();
async function step(label, fn) {
  try { const n = await fn(); console.log(`  ✓ ${label}: ${n ?? "ok"}`); }
  catch (e) { console.log(`  ✗ ${label}: ${e.message || e}`); }
}

const { data: cars } = await supabase.from("cars").select("id, brand, model, year, price_usd").limit(8);
const pick = (i) => cars?.[i % (cars?.length || 1)] || null;
console.log(`Seeding demo activity (${cars?.length || 0} cars available)…`);

await step("inquiries", async () => {
  const names = ["Алишер Каримов", "Дилноза Юсупова", "Шерзод Рахимов", "Малика Тошева", "Бобур Aзизов", "Нигора Саидова"];
  const types = ["car_inquiry", "test_drive", "trade_in", "calculator", "car_inquiry", "callback"];
  const rows = names.map((name, i) => ({
    name, phone: `+99890${(1000000 + i * 111111).toString().slice(0, 7)}`,
    email: i % 2 ? `lead${i}@example.uz` : null, type: types[i],
    message: "Интересует эта модель, какие условия рассрочки?",
    car_id: pick(i)?.id ?? null, source_page: i % 2 ? "catalog" : "car-detail",
    status: ["new", "new", "contacted", "in_progress", "new", "closed"][i],
    created_at: daysAgo(i),
  }));
  const { error, count } = await supabase.from("inquiries").insert(rows, { count: "exact" });
  if (error) throw error; return count;
});

await step("orders", async () => {
  const rows = [0, 1, 2].map((i) => ({
    reference_code: rid(), status: ["ordered", "in_transit", "delivered"][i],
    car_id: pick(i)?.id ?? null, customer_name: ["Алишер Каримов", "Шерзод Рахимов", "Малика Тошева"][i],
    customer_phone: `+99891${(2000000 + i * 123456).toString().slice(0, 7)}`,
    amount_usd: pick(i)?.price_usd ?? 25000, locale: "ru", created_at: daysAgo(i * 4 + 1),
  }));
  const { error, count } = await supabase.from("orders").insert(rows, { count: "exact" });
  if (error) throw error; return count;
});

await step("purchase_orders", async () => {
  const rows = [0, 1].map((i) => ({
    supplier: ["Shenzhen Auto Export", "Chery Intl Trading"][i], supplier_phone: "+8613800138000",
    brand: pick(i)?.brand ?? "BYD", model: pick(i)?.model ?? "Song Plus", year: 2024,
    qty: [3, 2][i], unit_cost_usd: [16800, 19500][i], status: ["ordered", "in_production"][i],
    eta_date: dateAgo(-25), notes: "Demo PO",
  }));
  const { error, count } = await supabase.from("purchase_orders").insert(rows, { count: "exact" });
  if (error) throw error; return count;
});

await step("market_listings", async () => {
  const rows = [];
  for (let i = 0; i < 12; i++) {
    const c = pick(i);
    if (!c) continue;
    rows.push({
      source: i % 2 ? "olx" : "telegram", brand: c.brand, model: c.model, year: c.year,
      price_usd: Math.round((c.price_usd || 25000) * (0.95 + Math.random() * 0.15)),
      currency_raw: "USD", observed_at: daysAgo(i % 20), fingerprint: `demo:${c.brand}:${c.model}:${i}`,
    });
  }
  const { error, count } = await supabase.from("market_listings").upsert(rows, { onConflict: "fingerprint", count: "exact" });
  if (error) throw error; return count;
});

await step("expenses", async () => {
  const rows = [
    { category: "supplier_payment", description: "Deposit to Shenzhen Auto", amount: 120000, currency: "CNY", amount_usd: 16800, supplier: "Shenzhen Auto", spent_on: dateAgo(20) },
    { category: "freight", description: "Rail freight Shenzhen→Tashkent", amount: 2500, currency: "USD", amount_usd: 2500, spent_on: dateAgo(15) },
    { category: "customs", description: "Customs duty + excise", amount: 84000000, currency: "UZS", amount_usd: 6667, spent_on: dateAgo(5) },
    { category: "marketing", description: "Telegram channel ads", amount: 1500000, currency: "UZS", amount_usd: 119, spent_on: dateAgo(3) },
  ];
  const { error, count } = await supabase.from("expenses").insert(rows, { count: "exact" });
  if (error) throw error; return count;
});

await step("invoices", async () => {
  const c = pick(0);
  const sub = c?.price_usd ?? 30000;
  const { error } = await supabase.from("invoices").insert({
    number: "INV-DEMO-0001", customer_name: "Алишер Каримов", customer_phone: "+998901234567",
    line_items: [{ description: `${c?.brand ?? "BYD"} ${c?.model ?? "Song Plus"} ${c?.year ?? 2024}`, qty: 1, unitUsd: sub }],
    subtotal_usd: sub, vat_pct: 12, vat_usd: Math.round(sub * 0.12), total_usd: Math.round(sub * 1.12),
    status: "paid", issued_at: dateAgo(2),
  });
  if (error) throw error; return 1;
});

await step("shipments", async () => {
  const { error } = await supabase.from("shipments").insert({
    title: "3× BYD Song Plus from Shenzhen", supplier: "Shenzhen Auto Export", mode: "rail",
    container_no: "TRLU-1234567", qty: 3, status: "in_transit", eta_date: dateAgo(-12), notes: "Demo shipment",
  });
  if (error) throw error; return 1;
});

await step("warranties", async () => {
  const c = pick(2);
  const { error } = await supabase.from("warranties").insert({
    customer_name: "Малика Тошева", customer_phone: "+998912000000",
    car_label: `${c?.brand ?? "Chery"} ${c?.model ?? "Tiggo 8"} ${c?.year ?? 2024}`,
    delivered_at: dateAgo(40), warranty_months: 12, warranty_until: dateAgo(-325),
    services: [{ date: dateAgo(10), description: "ТО-1 (10 000 км)", cost_usd: 120 }],
  });
  if (error) throw error; return 1;
});

await step("crm_tasks", async () => {
  const rows = [
    { title: "Перезвонить Алишеру по рассрочке", kind: "follow_up", customer_phone: "+998901234567", customer_name: "Алишер Каримов", status: "open", due_at: daysAgo(-1) },
    { title: "Запросить депозит по заказу", kind: "abandoned_deposit", customer_phone: "+998912000000", customer_name: "Малика Тошева", status: "open", due_at: daysAgo(0) },
  ];
  const { error, count } = await supabase.from("crm_tasks").insert(rows, { count: "exact" });
  if (error) throw error; return count;
});

await step("content_drafts", async () => {
  const c = pick(0);
  const { error } = await supabase.from("content_drafts").insert({
    kind: "telegram", locale: "ru", subject: `${c?.brand ?? "BYD"} ${c?.model ?? "Song Plus"}`,
    body: `🚗 ${c?.brand ?? "BYD"} ${c?.model ?? "Song Plus"} ${c?.year ?? 2024} — в наличии!\nИмпорт под ключ от Tez Motors.\n#tezmotors #avto #toshkent`,
    status: "draft",
  });
  if (error) throw error; return 1;
});

console.log("Demo activity seed done.");
