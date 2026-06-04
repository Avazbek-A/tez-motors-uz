import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/rate-limit";
import { createKvRateLimiter } from "@/lib/rate-limit-kv";
import { normalizeReferenceCode } from "@/lib/order-code";
import { ORDER_STATUS_LABELS, toEmailLocale } from "@/lib/order-status";

/**
 * Printable order/deposit receipt — a branded HTML document the customer can
 * print or save to PDF. HTML (not the ASCII-only spec-sheet PDF) so Russian/
 * Uzbek names render correctly. Gated on reference_code + phone exactly like
 * /api/track (service-role, rate-limited, constant "not found" on mismatch),
 * so no order data leaks by code alone.
 */
// KV-backed so the cap is shared across Workers isolates.
const checkRateLimit = createKvRateLimiter({ max: 10, windowMs: 5 * 60 * 1000, prefix: "receipt" });

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-()]/g, "");
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const COPY = {
  ru: {
    title: "Подтверждение заказа", brand: "Tez Motors", ref: "Номер заказа", date: "Дата",
    customer: "Клиент", car: "Автомобиль", amount: "Сумма депозита", status: "Статус",
    note: "Это подтверждение бронирования. Импорт «под ключ»: подбор, доставка, таможня, гарантия.",
    print: "Печать / Сохранить в PDF", thanks: "Спасибо, что выбрали Tez Motors.",
  },
  uz: {
    title: "Buyurtma tasdig'i", brand: "Tez Motors", ref: "Buyurtma raqami", date: "Sana",
    customer: "Mijoz", car: "Avtomobil", amount: "Depozit summasi", status: "Holat",
    note: "Bu bron tasdig'i. «Kalit topshirish» importi: tanlov, yetkazib berish, bojxona, kafolat.",
    print: "Chop etish / PDF saqlash", thanks: "Tez Motorsni tanlaganingiz uchun rahmat.",
  },
  en: {
    title: "Order Confirmation", brand: "Tez Motors", ref: "Order reference", date: "Date",
    customer: "Customer", car: "Vehicle", amount: "Deposit amount", status: "Status",
    note: "This is your reservation confirmation. Turn-key import: sourcing, delivery, customs, warranty.",
    print: "Print / Save as PDF", thanks: "Thank you for choosing Tez Motors.",
  },
} as const;

export async function GET(request: NextRequest) {
  if (!(await checkRateLimit(getClientIp(request)))) {
    return new Response("Too many requests", { status: 429 });
  }

  const codeRaw = request.nextUrl.searchParams.get("code");
  const phoneRaw = request.nextUrl.searchParams.get("phone");
  if (!codeRaw || !phoneRaw || phoneRaw.trim().length < 5) {
    return new Response("Reference code and phone are required", { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: order } = await supabase
    .from("orders")
    .select("reference_code, status, customer_name, customer_phone, customer_email, amount_usd, locale, created_at, car_id")
    .eq("reference_code", normalizeReferenceCode(codeRaw))
    .single();

  if (!order || normalizePhone(order.customer_phone) !== normalizePhone(phoneRaw)) {
    return new Response("Not found", { status: 404 });
  }

  let carName = "";
  if (order.car_id) {
    const { data: car } = await supabase
      .from("cars")
      .select("brand, model, year")
      .eq("id", order.car_id)
      .single();
    if (car) carName = `${car.brand} ${car.model}${car.year ? ` ${car.year}` : ""}`.trim();
  }

  const locale = toEmailLocale(order.locale);
  const t = COPY[locale];
  const statusLabel = ORDER_STATUS_LABELS[locale][order.status] ?? order.status;
  const dateStr = new Date(order.created_at).toLocaleDateString(
    locale === "ru" ? "ru-RU" : locale === "uz" ? "uz-UZ" : "en-US",
  );
  const amount = order.amount_usd != null ? `$${Number(order.amount_usd).toLocaleString("en-US")}` : "—";
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://tezmotors.uz").replace(/\/$/, "");

  const row = (k: string, v: string) =>
    `<tr><td style="padding:10px 0;color:#71717a;font-size:13px">${esc(k)}</td><td style="padding:10px 0;text-align:right;font-weight:600;font-family:monospace">${esc(v)}</td></tr>`;

  const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(t.title)} ${esc(order.reference_code)}</title>
<style>
  @media print { .noprint { display:none } }
  body { margin:0; background:#f4f4f5; font-family:Arial,Helvetica,sans-serif; color:#18181b }
  .sheet { max-width:560px; margin:32px auto; background:#fff; border:1px solid #e4e4e7; border-radius:12px; overflow:hidden }
  .hd { background:#0d0d10; color:#fff; padding:22px 28px; display:flex; justify-content:space-between; align-items:center }
  .hd b { font-size:20px; letter-spacing:0.12em }
  .hd span { font-size:12px; color:#bfc9d6; letter-spacing:0.16em; text-transform:uppercase }
  .bd { padding:24px 28px }
  table { width:100%; border-collapse:collapse }
  tr { border-bottom:1px solid #f0f0f2 }
  .ft { padding:16px 28px; background:#fafafa; border-top:1px solid #e4e4e7; font-size:12px; color:#71717a }
  .btn { display:inline-block; margin:16px 28px; padding:10px 18px; background:#0d0d10; color:#fff; border-radius:8px; text-decoration:none; font-size:14px; border:0; cursor:pointer }
</style></head>
<body>
  <div class="sheet">
    <div class="hd"><b>${esc(t.brand)}</b><span>${esc(t.title)}</span></div>
    <div class="bd">
      <table>
        ${row(t.ref, order.reference_code)}
        ${row(t.date, dateStr)}
        ${row(t.customer, order.customer_name)}
        ${carName ? row(t.car, carName) : ""}
        ${row(t.amount, amount)}
        ${row(t.status, statusLabel)}
      </table>
      <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#52525b">${esc(t.note)}</p>
      <p style="margin:10px 0 0;font-size:13px;color:#52525b">${esc(t.thanks)}</p>
    </div>
    <button class="btn noprint" onclick="window.print()">${esc(t.print)}</button>
    <div class="ft">${esc(t.brand)} · <a href="${site}" style="color:#71717a">${esc(site.replace(/^https?:\/\//, ""))}</a></div>
  </div>
</body></html>`;

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
