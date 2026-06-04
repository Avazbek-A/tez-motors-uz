/**
 * Paperwork engine (Phase AF) — branded, Unicode-safe RU/UZ business documents.
 *
 * HTML + print CSS (NOT the ASCII manual-PDF route, which strips Cyrillic). The
 * admin renders these from an order; a separate route turns them into PDF via the
 * Vostro extractor /render-pdf, falling back to browser print. Pure builders here
 * (unit-tested): given order/car/payment data → {title, html}. Legal text is a
 * starting template the dealer reviews — labeled as such, not certified.
 */
import { escapeHtml } from "@/lib/escape-html";
import { SITE_CONFIG } from "@/lib/constants";

export type DocType = "sales_contract" | "proforma_invoice" | "commercial_invoice" | "deposit_receipt" | "handover_act" | "warranty_certificate";
export type DocLocale = "ru" | "uz";

export const DOC_TYPES: DocType[] = ["sales_contract", "proforma_invoice", "commercial_invoice", "deposit_receipt", "handover_act", "warranty_certificate"];

export const DOC_LABELS: Record<DocLocale, Record<DocType, string>> = {
  ru: {
    sales_contract: "Договор купли-продажи",
    proforma_invoice: "Счёт-проформа",
    commercial_invoice: "Коммерческий счёт",
    deposit_receipt: "Квитанция о депозите",
    handover_act: "Акт приёма-передачи",
    warranty_certificate: "Гарантийный сертификат",
  },
  uz: {
    sales_contract: "Oldi-sotdi shartnomasi",
    proforma_invoice: "Proforma-hisob",
    commercial_invoice: "Tijorat hisobi",
    deposit_receipt: "Depozit kvitansiyasi",
    handover_act: "Qabul-topshirish dalolatnomasi",
    warranty_certificate: "Kafolat sertifikati",
  },
};

export interface DocData {
  number: string;
  date: string; // ISO or display date
  locale: DocLocale;
  order: {
    reference_code: string;
    customer_name: string;
    customer_phone: string | null;
    customer_email?: string | null;
    amount_usd: number | null;
    status: string;
  };
  car: { brand: string; model: string; year: number | null; vin?: string | null; color?: string | null } | null;
  depositUsd?: number | null;
  vatPct?: number; // for money docs (default 12)
  usdUzs?: number | null; // optional UZS conversion
}

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const T = {
  ru: { seller: "Продавец", buyer: "Покупатель", vehicle: "Автомобиль", price: "Цена", deposit: "Депозит", vat: "НДС (ҚҚС)", total: "Итого", date: "Дата", number: "№", phone: "Телефон", vin: "VIN", draftNote: "Черновик документа. Проверьте данные перед подписанием.", sign: "Подпись", reference: "Заказ" },
  uz: { seller: "Sotuvchi", buyer: "Xaridor", vehicle: "Avtomobil", price: "Narx", deposit: "Depozit", vat: "QQS", total: "Jami", date: "Sana", number: "№", phone: "Telefon", vin: "VIN", draftNote: "Hujjat qoralamasi. Imzolashdan oldin ma'lumotlarni tekshiring.", sign: "Imzo", reference: "Buyurtma" },
};

function carName(d: DocData): string {
  if (!d.car) return "—";
  return `${d.car.brand} ${d.car.model}${d.car.year ? ` ${d.car.year}` : ""}${d.car.color ? `, ${d.car.color}` : ""}`;
}

function shell(d: DocData, title: string, body: string): string {
  const t = T[d.locale];
  return `<!doctype html><html lang="${d.locale}"><head><meta charset="utf-8"><title>${escapeHtml(title)} ${escapeHtml(d.number)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #111; font-size: 13px; line-height: 1.5; max-width: 800px; margin: 0 auto; padding: 24px; }
  .hdr { display: flex; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 16px; }
  .brand { font-size: 20px; font-weight: 800; }
  .muted { color: #666; font-size: 11px; }
  h1 { font-size: 16px; margin: 16px 0 4px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  td, th { padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: left; vertical-align: top; }
  th { width: 38%; color: #444; font-weight: 600; }
  .totals td { border: none; }
  .totals .grand { font-weight: 800; font-size: 15px; border-top: 2px solid #111; }
  .sign { display: flex; justify-content: space-between; margin-top: 48px; }
  .sign div { width: 45%; border-top: 1px solid #111; padding-top: 6px; }
  .draft { background: #fff8e1; border: 1px solid #f0d000; padding: 6px 10px; font-size: 11px; margin: 10px 0; border-radius: 4px; }
  .print-btn { margin: 12px 0; }
  @media print { .print-btn { display: none; } body { padding: 0; } }
</style></head><body>
<div class="hdr"><div><div class="brand">${escapeHtml(SITE_CONFIG.name)}</div><div class="muted">${escapeHtml(SITE_CONFIG.address)} · ${escapeHtml(SITE_CONFIG.phone)}</div></div>
<div style="text-align:right"><div><strong>${escapeHtml(title)}</strong></div><div class="muted">${t.number} ${escapeHtml(d.number)} · ${t.date}: ${escapeHtml(d.date)}</div><div class="muted">${t.reference}: ${escapeHtml(d.order.reference_code)}</div></div></div>
<div class="draft">⚠ ${t.draftNote}</div>
${body}
<button class="print-btn" onclick="window.print()">🖨 PDF / Print</button>
</body></html>`;
}

function partiesTable(d: DocData): string {
  const t = T[d.locale];
  return `<table>
    <tr><th>${t.seller}</th><td>${escapeHtml(SITE_CONFIG.name)}, ${escapeHtml(SITE_CONFIG.phone)}</td></tr>
    <tr><th>${t.buyer}</th><td>${escapeHtml(d.order.customer_name)}${d.order.customer_phone ? `, ${escapeHtml(d.order.customer_phone)}` : ""}</td></tr>
    <tr><th>${t.vehicle}</th><td>${escapeHtml(carName(d))}</td></tr>
    ${d.car?.vin ? `<tr><th>${t.vin}</th><td>${escapeHtml(d.car.vin)}</td></tr>` : ""}
  </table>`;
}

function moneyTable(d: DocData): string {
  const t = T[d.locale];
  const price = Number(d.order.amount_usd) || 0;
  const vatPct = d.vatPct ?? 12;
  const vat = Math.round((price * vatPct) / (100 + vatPct)); // VAT-inclusive
  const deposit = Number(d.depositUsd) || 0;
  const due = price - deposit;
  const uzs = d.usdUzs ? ` (${new Intl.NumberFormat("ru-RU").format(Math.round(price * d.usdUzs))} so'm)` : "";
  return `<table class="totals">
    <tr><td>${t.price}</td><td style="text-align:right">${money(price)}${uzs}</td></tr>
    <tr><td>${t.vat} (${vatPct}%, incl.)</td><td style="text-align:right">${money(vat)}</td></tr>
    ${deposit > 0 ? `<tr><td>${t.deposit}</td><td style="text-align:right">−${money(deposit)}</td></tr><tr class="grand"><td>${t.total}</td><td style="text-align:right">${money(due)}</td></tr>` : `<tr class="grand"><td>${t.total}</td><td style="text-align:right">${money(price)}</td></tr>`}
  </table>`;
}

function signBlock(d: DocData): string {
  const t = T[d.locale];
  return `<div class="sign"><div>${t.seller} / ${t.sign}</div><div>${t.buyer} / ${t.sign}</div></div>`;
}

/** Build a document's HTML. Pure. */
export function buildDocument(type: DocType, d: DocData): { title: string; html: string } {
  const title = DOC_LABELS[d.locale][type];
  let body = "";
  switch (type) {
    case "sales_contract":
      body = `<p>${d.locale === "ru" ? "Настоящий договор заключён между Продавцом и Покупателем о купле-продаже транспортного средства на условиях ниже." : "Ushbu shartnoma Sotuvchi va Xaridor o'rtasida quyidagi shartlarda transport vositasini sotish to'g'risida tuzildi."}</p>${partiesTable(d)}${moneyTable(d)}${signBlock(d)}`;
      break;
    case "proforma_invoice":
    case "commercial_invoice":
      body = `${partiesTable(d)}${moneyTable(d)}`;
      break;
    case "deposit_receipt": {
      const dep = Number(d.depositUsd) || 0;
      body = `<p>${d.locale === "ru" ? `Получен депозит за бронирование автомобиля.` : `Avtomobilni band qilish uchun depozit qabul qilindi.`}</p>${partiesTable(d)}<table class="totals"><tr class="grand"><td>${T[d.locale].deposit}</td><td style="text-align:right">${money(dep)}</td></tr></table>${signBlock(d)}`;
      break;
    }
    case "handover_act":
      body = `<p>${d.locale === "ru" ? "Продавец передал, а Покупатель принял транспортное средство в технически исправном состоянии. Претензий по комплектации и внешнему виду нет." : "Sotuvchi topshirdi, Xaridor esa transport vositasini texnik soz holatda qabul qildi. Butlik va tashqi ko'rinish bo'yicha e'tirozlar yo'q."}</p>${partiesTable(d)}${signBlock(d)}`;
      break;
    case "warranty_certificate":
      body = `<p>${d.locale === "ru" ? "Tez Motors предоставляет гарантию на импортированное транспортное средство в соответствии с условиями производителя." : "Tez Motors import qilingan transport vositasiga ishlab chiqaruvchi shartlariga muvofiq kafolat beradi."}</p>${partiesTable(d)}${signBlock(d)}`;
      break;
  }
  return { title, html: shell(d, title, body) };
}

/** Document number like SC-20260601-A1B2 from a type + seed. */
export function documentNumber(type: DocType, seed: string): string {
  const prefix = { sales_contract: "SC", proforma_invoice: "PF", commercial_invoice: "CI", deposit_receipt: "DR", handover_act: "AA", warranty_certificate: "WC" }[type];
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const tail = seed.replace(/[^A-Za-z0-9]/g, "").slice(-4).toUpperCase() || "0001";
  return `${prefix}-${date}-${tail}`;
}
