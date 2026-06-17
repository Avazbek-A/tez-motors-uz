/**
 * Telegram customs ("растаможка") wizard — a stateless inline-button flow for the
 * inbound bot, a no-forced-sub-gate competitor to @autodeklarantbot.
 *
 * Stateless by design: each button's callback_data carries the selections so far
 * (`cu|<step>|<kind>|<age>|<origin>|<cc>`), and the final price step is a
 * force_reply whose prompt text embeds the state as `[cu:kind|age|origin|cc]`.
 * The user's reply quotes that prompt, so we recover the state from
 * reply_to_message.text — no per-chat DB row needed. Compute reuses customs-uz.
 */
import {
  computeCustomsUz, type VehicleKind, type VehicleAge, type OriginClass, type CustomsResult,
} from "@/lib/customs-uz";

type Loc = "ru" | "uz" | "en";
const L = (loc: string): Loc => (loc === "uz" ? "uz" : loc === "en" ? "en" : "ru");

interface Btn { text: string; callback_data?: string; url?: string }
interface Markup { inline_keyboard?: Btn[][]; force_reply?: boolean; input_field_placeholder?: string }
export interface BotStep { text: string; replyMarkup?: Markup }

const KIND_LABEL: Record<VehicleKind, Record<Loc, string>> = {
  electric: { ru: "⚡️ Электро", uz: "⚡️ Elektro", en: "⚡️ Electric" },
  petrol: { ru: "⛽️ Бензин/Дизель", uz: "⛽️ Benzin/Dizel", en: "⛽️ Petrol/Diesel" },
  diesel: { ru: "⛽️ Дизель", uz: "⛽️ Dizel", en: "⛽️ Diesel" },
  hybrid: { ru: "🔋 Гибрид", uz: "🔋 Gibrid", en: "🔋 Hybrid" },
  phev: { ru: "🔌 Послед. гибрид", uz: "🔌 Ketma-ket gibrid", en: "🔌 Plug-in/REEV" },
};
const AGE_LABEL: Record<VehicleAge, Record<Loc, string>> = {
  new: { ru: "До 1 года", uz: "1 yilgacha", en: "≤1 year" },
  used1to3: { ru: "1–3 года", uz: "1–3 yil", en: "1–3 years" },
  used3plus: { ru: "Более 3 лет", uz: "3 yildan ortiq", en: ">3 years" },
};
const ORIGIN_LABEL: Record<OriginClass, Record<Loc, string>> = {
  fta: { ru: "СНГ/ЕАЭС (0%)", uz: "MDH/EOII (0%)", en: "CIS/EAEU (0%)" },
  certified: { ru: "С сертификатом", uz: "Sertifikat bilan", en: "With certificate" },
  uncertified: { ru: "Без сертификата (×2)", uz: "Sertifikatsiz (×2)", en: "No certificate (×2)" },
};
const T = {
  pickKind: { ru: "🧮 Расчёт растаможки.\nВыберите тип авто:", uz: "🧮 Rastamojka hisobi.\nAvto turini tanlang:", en: "🧮 Customs estimate.\nChoose the vehicle type:" },
  pickAge: { ru: "Возраст авто:", uz: "Avto yoshi:", en: "Vehicle age:" },
  pickOrigin: { ru: "Происхождение / сертификат СТ-1:", uz: "Kelib chiqishi / ST-1 sertifikati:", en: "Origin / ST-1 certificate:" },
  pickEngine: { ru: "Объём двигателя:", uz: "Dvigatel hajmi:", en: "Engine volume:" },
  askPrice: { ru: "Введите стоимость авто в USD (цена + доставка). Ответьте на это сообщение числом:", uz: "Avto narxini USD da kiriting (narx + yetkazib berish). Shu xabarga raqam bilan javob bering:", en: "Enter the car price in USD (price + delivery). Reply to this message with a number:" },
  pricePh: { ru: "напр. 20000", uz: "masalan 20000", en: "e.g. 20000" },
  badNum: { ru: "Введите число, например 20000.", uz: "Raqam kiriting, masalan 20000.", en: "Enter a number, e.g. 20000." },
  customsTotal: { ru: "Растаможка", uz: "Rastamojka", en: "Customs" },
  grand: { ru: "Итого под ключ", uz: "Hammasi", en: "All-in" },
  duty: { ru: "Пошлина", uz: "Boj", en: "Duty" },
  vat: { ru: "НДС", uz: "QQS", en: "VAT" },
  util: { ru: "Утильсбор", uz: "Utilizatsiya", en: "Utilization" },
  fee: { ru: "Таможенный сбор", uz: "Bojxona yig'imi", en: "Clearance fee" },
  webBtn: { ru: "🌐 Точный расчёт на сайте", uz: "🌐 Saytda aniq hisob", en: "🌐 Exact estimate on the site" },
  note: { ru: "Оценка по тарифам РУз. Сертификация ~$300–690 отдельно.", uz: "OʻzR tariflari boʻyicha. Sertifikatlash ~$300–690 alohida.", en: "Per UZ tariffs. Certification ~$300–690 separate." },
};

const ENGINE_CC = [1500, 2000, 2500, 3000, 4000];
const exempt = (k: VehicleKind) => k === "electric" || k === "phev";
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "https://tezmotors.uz").replace(/\/$/, "");

/** Trigger words that open the wizard from free text. */
export function isCustomsTrigger(text: string): boolean {
  return /раста?мож|растамож|bojxona|rastamoj|bojini|customs|растамо?шк/i.test(text || "");
}

/** Step 1: the entry keyboard (vehicle type). */
export function customsStart(loc: string): BotStep {
  const l = L(loc);
  const kinds: VehicleKind[] = ["electric", "petrol", "hybrid", "phev"];
  return {
    text: T.pickKind[l],
    replyMarkup: { inline_keyboard: chunk(kinds.map((k) => ({ text: KIND_LABEL[k][l], callback_data: `cu|k|${k}` })), 2) },
  };
}

/** Advance the wizard given a `cu|...` callback. Returns the next prompt. */
export function customsStep(data: string, loc: string): BotStep | null {
  const l = L(loc);
  const p = data.split("|"); // cu | step | ...
  const step = p[1];
  if (step === "k") {
    const kind = p[2] as VehicleKind;
    const ages: VehicleAge[] = ["new", "used1to3", "used3plus"];
    return { text: T.pickAge[l], replyMarkup: { inline_keyboard: chunk(ages.map((a) => ({ text: AGE_LABEL[a][l], callback_data: `cu|a|${kind}|${a}` })), 2) } };
  }
  if (step === "a") {
    const kind = p[2] as VehicleKind, age = p[3] as VehicleAge;
    if (exempt(kind)) return pricePrompt(kind, age, "certified", 0, l); // EV/PHEV: origin & cc don't matter
    const origins: OriginClass[] = ["fta", "certified", "uncertified"];
    return { text: T.pickOrigin[l], replyMarkup: { inline_keyboard: origins.map((o) => [{ text: ORIGIN_LABEL[o][l], callback_data: `cu|o|${kind}|${age}|${o}` }]) } };
  }
  if (step === "o") {
    const [, , kind, age, origin] = p;
    return { text: T.pickEngine[l], replyMarkup: { inline_keyboard: chunk(ENGINE_CC.map((cc) => ({ text: `${(cc / 1000).toFixed(1)} ${l === "en" ? "L" : "л"}`, callback_data: `cu|e|${kind}|${age}|${origin}|${cc}` })), 3) } };
  }
  if (step === "e") {
    const [, , kind, age, origin, cc] = p;
    return pricePrompt(kind as VehicleKind, age as VehicleAge, origin as OriginClass, Number(cc), l);
  }
  return null;
}

/** The price step: force_reply prompt with the state embedded for stateless recovery. */
function pricePrompt(kind: VehicleKind, age: VehicleAge, origin: OriginClass, cc: number, l: Loc): BotStep {
  return {
    text: `${T.askPrice[l]}\n\n[cu:${kind}|${age}|${origin}|${cc}]`,
    replyMarkup: { force_reply: true, input_field_placeholder: T.pricePh[l] },
  };
}

/** Marker recovered from a replied-to price prompt. */
export const CUST_MARKER = /\[cu:([a-z]+)\|([a-z0-9]+)\|([a-z]+)\|(\d+)\]/i;

/** Handle the user's price reply: parse the embedded state + their number, compute. */
export function customsPriceReply(promptText: string, userText: string, loc: string, usdUzs: number): BotStep | null {
  const m = (promptText || "").match(CUST_MARKER);
  if (!m) return null;
  const l = L(loc);
  const price = parseFloat(String(userText).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(price) || price <= 0) return { text: T.badNum[l] };
  const [, kind, age, origin, cc] = m;
  const r = computeCustomsUz({ priceUsd: price, kind: kind as VehicleKind, age: age as VehicleAge, origin: origin as OriginClass, engineCc: Number(cc), usdUzs });
  return { text: renderResult(r, l), replyMarkup: { inline_keyboard: [[{ text: T.webBtn[l], url: `${siteUrl()}/${l}/calculator` }]] } };
}

function renderResult(r: CustomsResult, l: Loc): string {
  const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
  const LK: Record<string, Record<Loc, string>> = { duty: T.duty, vat: T.vat, util: T.util, clearance: T.fee };
  const lines = r.lines.map((x) => `▪️ ${LK[x.key][l]}${x.detail ? ` (${x.detail})` : ""}: ${usd(x.usdValue)}`).join("\n");
  return [
    `🧮 <b>${T.customsTotal[l]}: ${usd(r.customsCostUsd)}</b>`,
    `${KIND_LABEL[r.kind][l]} · ${AGE_LABEL[r.age][l]} · ${ORIGIN_LABEL[r.origin][l]}`,
    "",
    lines,
    "─────────",
    `💰 ${T.grand[l]} (${usd(r.customsValueUsd)} + ${T.customsTotal[l]}): <b>${usd(r.totalUsd)}</b>`,
    "",
    `<i>${T.note[l]}</i>`,
  ].join("\n");
}

function chunk<X>(arr: X[], n: number): X[][] {
  const out: X[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
