/**
 * Telegram customs ("растаможка") wizard — a stateless inline-button flow for the
 * inbound bot, a no-forced-sub-gate competitor to @autodeklarantbot.
 *
 * Stateless by design: each button's callback_data carries the selections so far,
 * and the final price step is a force_reply whose prompt embeds `[cu:…]`. The
 * user's reply quotes that prompt, so we recover the state from
 * reply_to_message.text — no per-chat DB row. Compute reuses customs-uz.
 *
 * All 6 categories are fully computed (each probed + validated to the $ vs the
 * bot): car, moto, engine, mini-truck (≤5t), bus, фура — including the фура
 * below-Euro-4 import ban.
 */
import {
  computeCustomsUz, type VehicleKind, type VehicleAge, type OriginClass, type CustomsResult,
  type BusCapacity, type EcoClass, type FuraPart, type FuraAge,
} from "@/lib/customs-uz";

type Loc = "ru" | "uz" | "en";
type Tri = Record<Loc, string>;
const L = (loc: string): Loc => (loc === "uz" ? "uz" : loc === "en" ? "en" : "ru");

interface Btn { text: string; callback_data?: string; url?: string }
interface Markup { inline_keyboard?: Btn[][]; force_reply?: boolean; input_field_placeholder?: string }
export interface BotStep { text: string; replyMarkup?: Markup; lead?: boolean }

const CATEGORIES: { cat: string; label: Tri; mode: "car" | "moto" | "engine" | "truck" | "bus" | "fura" }[] = [
  { cat: "car", label: { ru: "🚗 Авто", uz: "🚗 Avto", en: "🚗 Car" }, mode: "car" },
  { cat: "moto", label: { ru: "🏍 Мото / скутер", uz: "🏍 Moto / skuter", en: "🏍 Moto / scooter" }, mode: "moto" },
  { cat: "truck", label: { ru: "🚚 Мини-грузовик", uz: "🚚 Mini yuk", en: "🚚 Mini-truck" }, mode: "truck" },
  { cat: "engine", label: { ru: "⚙️ Мотор", uz: "⚙️ Motor", en: "⚙️ Engine" }, mode: "engine" },
  { cat: "bus", label: { ru: "🚍 Автобус", uz: "🚍 Avtobus", en: "🚍 Bus" }, mode: "bus" },
  { cat: "fura", label: { ru: "🚛 Фура", uz: "🚛 Fura", en: "🚛 Semi-truck" }, mode: "fura" },
];

const KIND_LABEL: Record<VehicleKind, Tri> = {
  electric: { ru: "⚡️ Электро", uz: "⚡️ Elektro", en: "⚡️ Electric" },
  petrol: { ru: "⛽️ Бензин/Дизель", uz: "⛽️ Benzin/Dizel", en: "⛽️ Petrol/Diesel" },
  diesel: { ru: "⛽️ Дизель", uz: "⛽️ Dizel", en: "⛽️ Diesel" },
  hybrid: { ru: "🔋 Гибрид", uz: "🔋 Gibrid", en: "🔋 Hybrid" },
  phev: { ru: "🔌 Послед. гибрид", uz: "🔌 Ketma-ket gibrid", en: "🔌 Plug-in/REEV" },
};
const MOTO_FUEL: Record<"petrol" | "electric", Tri> = {
  petrol: { ru: "⛽️ Бензин", uz: "⛽️ Benzin", en: "⛽️ Petrol" },
  electric: { ru: "⚡️ Электро", uz: "⚡️ Elektro", en: "⚡️ Electric" },
};
const STATE_LABEL: Record<"new" | "used", Tri> = {
  new: { ru: "Новый", uz: "Yangi", en: "New" },
  used: { ru: "Б/У", uz: "Ishlatilgan", en: "Used" },
};
const TRUCK_FUEL: Record<"ice" | "ev", Tri> = {
  ice: { ru: "⛽️ ДВС", uz: "⛽️ ICE", en: "⛽️ ICE" },
  ev: { ru: "🔋 Электро", uz: "🔋 Elektro", en: "🔋 Electric" },
};
const TRUCK_AGE: Record<"le3" | "gt3", Tri> = {
  le3: { ru: "До 3 лет", uz: "3 yilgacha", en: "≤3 years" },
  gt3: { ru: "Более 3 лет", uz: "3 yildan ortiq", en: ">3 years" },
};
const CAP_LABEL: Record<BusCapacity, Tri> = {
  small: { ru: "10–59 мест", uz: "10–59 o'rin", en: "10–59 seats" },
  large: { ru: "60+ мест", uz: "60+ o'rin", en: "60+ seats" },
};
const BUS_FUEL: Record<"ice" | "ev", Tri> = {
  ice: { ru: "⛽️ ДВС", uz: "⛽️ ICE", en: "⛽️ ICE" },
  ev: { ru: "🔋 Электро", uz: "🔋 Elektro", en: "🔋 Electric" },
};
const ECO_LABEL: Record<EcoClass, Tri> = {
  euro5plus: { ru: "Евро-5 и выше", uz: "Yevro-5 va yuqori", en: "Euro-5+" },
  euro4: { ru: "Евро-4", uz: "Yevro-4", en: "Euro-4" },
  below4: { ru: "Ниже Евро-4", uz: "Yevro-4 dan past", en: "Below Euro-4" },
};
const FURA_PART: Record<FuraPart, Tri> = {
  tractor: { ru: "🚛 Тягач", uz: "🚛 Tyagach", en: "🚛 Tractor" },
  semitrailer: { ru: "🚛 Полуприцеп", uz: "🚛 Yarim tirkama", en: "🚛 Semi-trailer" },
};
const FURA_AGE: Record<FuraAge, Tri> = {
  a1: { ru: "До 3 лет", uz: "3 yilgacha", en: "≤3 years" },
  a2: { ru: "3–5 лет", uz: "3–5 yil", en: "3–5 years" },
  a3: { ru: "5–7 лет", uz: "5–7 yil", en: "5–7 years" },
  a4: { ru: "Более 7 лет", uz: "7 yildan ortiq", en: ">7 years" },
};
const AGE_LABEL: Record<VehicleAge, Tri> = {
  new: { ru: "До 1 года", uz: "1 yilgacha", en: "≤1 year" },
  used1to3: { ru: "1–3 года", uz: "1–3 yil", en: "1–3 years" },
  used3plus: { ru: "Более 3 лет", uz: "3 yildan ortiq", en: ">3 years" },
};
const ORIGIN_LABEL: Record<OriginClass, Tri> = {
  fta: { ru: "СНГ/ЕАЭС (0%)", uz: "MDH/EOII (0%)", en: "CIS/EAEU (0%)" },
  certified: { ru: "С сертификатом", uz: "Sertifikat bilan", en: "With certificate" },
  uncertified: { ru: "Без сертификата (×2)", uz: "Sertifikatsiz (×2)", en: "No certificate (×2)" },
};
const T = {
  pickCat: { ru: "🧮 Расчёт растаможки.\nВыберите тип транспорта:", uz: "🧮 Rastamojka hisobi.\nTransport turini tanlang:", en: "🧮 Customs estimate.\nChoose the vehicle type:" },
  pickKind: { ru: "Тип топлива авто:", uz: "Avto yoqilg'i turi:", en: "Car fuel type:" },
  pickMotoFuel: { ru: "Тип топлива мото:", uz: "Moto yoqilg'i turi:", en: "Moto fuel type:" },
  pickAge: { ru: "Возраст авто:", uz: "Avto yoshi:", en: "Vehicle age:" },
  pickState: { ru: "Состояние двигателя:", uz: "Dvigatel holati:", en: "Engine condition:" },
  pickTruckFuel: { ru: "Тип топлива грузовика:", uz: "Yuk mashinasi yoqilg'isi:", en: "Truck fuel type:" },
  pickTruckAge: { ru: "Возраст грузовика:", uz: "Yuk mashinasi yoshi:", en: "Truck age:" },
  pickCapacity: { ru: "Вместимость автобуса:", uz: "Avtobus sig'imi:", en: "Bus capacity:" },
  pickFuel: { ru: "Тип топлива:", uz: "Yoqilg'i turi:", en: "Fuel type:" },
  pickEco: { ru: "Экологический класс:", uz: "Ekologik sinf:", en: "Emission class:" },
  pickFuraPart: { ru: "Часть фуры:", uz: "Fura qismi:", en: "Semi-truck part:" },
  pickFuraAge: { ru: "Возраст тягача:", uz: "Tyagach yoshi:", en: "Tractor age:" },
  banned: { ru: "❗️Ввоз тягачей ниже экологического класса Евро-4 в Узбекистан ЗАПРЕЩЁН.", uz: "❗️Yevro-4 dan past tyagachlarni Oʻzbekistonga import qilish TAQIQLANGAN.", en: "❗️Importing tractors below Euro-4 into Uzbekistan is BANNED." },
  pickOrigin: { ru: "Происхождение / сертификат СТ-1:", uz: "Kelib chiqishi / ST-1 sertifikati:", en: "Origin / ST-1 certificate:" },
  pickEngine: { ru: "Объём двигателя:", uz: "Dvigatel hajmi:", en: "Engine volume:" },
  askPrice: { ru: "Введите стоимость в USD (цена + доставка). Ответьте на это сообщение числом:", uz: "Narxni USD da kiriting (narx + yetkazib berish). Shu xabarga raqam bilan javob bering:", en: "Enter the price in USD (price + delivery). Reply to this message with a number:" },
  pricePh: { ru: "напр. 20000", uz: "masalan 20000", en: "e.g. 20000" },
  badNum: { ru: "Введите число, например 20000.", uz: "Raqam kiriting, masalan 20000.", en: "Enter a number, e.g. 20000." },
  leadTitle: { ru: "Для этого типа транспорта расчёт индивидуальный (масса/эко-класс/тоннаж).", uz: "Bu transport turi uchun hisob individual (massa/eko-klass/tonnaj).", en: "This vehicle type needs an individual estimate (mass / eco-class / tonnage)." },
  leadAsk: { ru: "Наш декларант рассчитает точно — оставьте номер 👇", uz: "Bizning deklarantimiz aniq hisoblab beradi — raqamingizni qoldiring 👇", en: "Our declarant will calculate it exactly — leave your number 👇" },
  customsTotal: { ru: "Растаможка", uz: "Rastamojka", en: "Customs" },
  grand: { ru: "Итого под ключ", uz: "Hammasi", en: "All-in" },
  duty: { ru: "Пошлина", uz: "Boj", en: "Duty" },
  vat: { ru: "НДС", uz: "QQS", en: "VAT" },
  util: { ru: "Утильсбор", uz: "Utilizatsiya", en: "Utilization" },
  fee: { ru: "Таможенный сбор", uz: "Bojxona yig'imi", en: "Clearance fee" },
  webBtn: { ru: "🌐 Точный расчёт на сайте", uz: "🌐 Saytda aniq hisob", en: "🌐 Exact estimate on the site" },
  note: { ru: "Оценка по тарифам РУз. Сертификация ~$300–690 отдельно.", uz: "OʻzR tariflari boʻyicha. Sertifikatlash ~$300–690 alohida.", en: "Per UZ tariffs. Certification ~$300–690 separate." },
  cat: { car: { ru: "🚗 Авто", uz: "🚗 Avto", en: "🚗 Car" }, moto: { ru: "🏍 Мото", uz: "🏍 Moto", en: "🏍 Moto" }, engine: { ru: "⚙️ Мотор", uz: "⚙️ Motor", en: "⚙️ Engine" }, truck: { ru: "🚚 Мини-грузовик", uz: "🚚 Mini yuk", en: "🚚 Mini-truck" }, bus: { ru: "🚍 Автобус", uz: "🚍 Avtobus", en: "🚍 Bus" }, fura: { ru: "🚛 Фура", uz: "🚛 Fura", en: "🚛 Semi-truck" } } as Record<string, Tri>,
};

const ENGINE_CC = [1500, 2000, 2500, 3000, 4000];
const exempt = (k: VehicleKind) => k === "electric" || k === "phev";
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "https://tezmotors.uz").replace(/\/$/, "");

export function isCustomsTrigger(text: string): boolean {
  return /раста?мож|растамож|bojxona|rastamoj|bojini|customs|растамо?шк/i.test(text || "");
}

/** Step 1: vehicle-category menu. */
export function customsStart(loc: string): BotStep {
  const l = L(loc);
  return { text: T.pickCat[l], replyMarkup: { inline_keyboard: chunk(CATEGORIES.map((c) => ({ text: c.label[l], callback_data: `cu|cat|${c.cat}` })), 2) } };
}

/** Advance the wizard given a `cu|...` callback. */
export function customsStep(data: string, loc: string): BotStep | null {
  const l = L(loc);
  const p = data.split("|");
  const step = p[1];

  if (step === "cat") {
    const cat = CATEGORIES.find((c) => c.cat === p[2]);
    if (!cat) return null;
    if (cat.mode === "bus") {
      const caps: BusCapacity[] = ["small", "large"];
      return { text: T.pickCapacity[l], replyMarkup: { inline_keyboard: [caps.map((c) => ({ text: CAP_LABEL[c][l], callback_data: `cu|bc|${c}` }))] } };
    }
    if (cat.mode === "fura") {
      const parts: FuraPart[] = ["tractor", "semitrailer"];
      return { text: T.pickFuraPart[l], replyMarkup: { inline_keyboard: [parts.map((pt) => ({ text: FURA_PART[pt][l], callback_data: `cu|fp|${pt}` }))] } };
    }
    if (cat.mode === "moto") {
      const fuels: ("petrol" | "electric")[] = ["petrol", "electric"];
      return { text: T.pickMotoFuel[l], replyMarkup: { inline_keyboard: [fuels.map((f) => ({ text: MOTO_FUEL[f][l], callback_data: `cu|mk|${f}` }))] } };
    }
    if (cat.mode === "engine") {
      const states: ("new" | "used")[] = ["new", "used"];
      return { text: T.pickState[l], replyMarkup: { inline_keyboard: [states.map((s) => ({ text: STATE_LABEL[s][l], callback_data: `cu|es|${s}` }))] } };
    }
    if (cat.mode === "truck") {
      const fuels: ("ice" | "ev")[] = ["ice", "ev"];
      return { text: T.pickTruckFuel[l], replyMarkup: { inline_keyboard: [fuels.map((f) => ({ text: TRUCK_FUEL[f][l], callback_data: `cu|tf|${f}` }))] } };
    }
    // car
    const kinds: VehicleKind[] = ["electric", "petrol", "hybrid", "phev"];
    return { text: T.pickKind[l], replyMarkup: { inline_keyboard: chunk(kinds.map((k) => ({ text: KIND_LABEL[k][l], callback_data: `cu|k|${k}` })), 2) } };
  }

  // ── Car flow ──
  if (step === "k") {
    const kind = p[2];
    const ages: VehicleAge[] = ["new", "used1to3", "used3plus"];
    return { text: T.pickAge[l], replyMarkup: { inline_keyboard: chunk(ages.map((a) => ({ text: AGE_LABEL[a][l], callback_data: `cu|a|${kind}|${a}` })), 2) } };
  }
  if (step === "a") {
    const kind = p[2] as VehicleKind, age = p[3];
    if (exempt(kind)) return pricePrompt(`${kind}|${age}|certified|0`, l);
    const origins: OriginClass[] = ["fta", "certified", "uncertified"];
    return { text: T.pickOrigin[l], replyMarkup: { inline_keyboard: origins.map((o) => [{ text: ORIGIN_LABEL[o][l], callback_data: `cu|o|${kind}|${age}|${o}` }]) } };
  }
  if (step === "o") {
    const [, , kind, age, origin] = p;
    return { text: T.pickEngine[l], replyMarkup: { inline_keyboard: chunk(ENGINE_CC.map((cc) => ({ text: `${(cc / 1000).toFixed(1)} ${l === "en" ? "L" : "л"}`, callback_data: `cu|e|${kind}|${age}|${origin}|${cc}` })), 3) } };
  }
  if (step === "e") {
    const [, , kind, age, origin, cc] = p;
    return pricePrompt(`${kind}|${age}|${origin}|${cc}`, l);
  }

  // ── Moto flow ──
  if (step === "mk") {
    const fuel = p[2]; // petrol | electric
    if (fuel === "electric") return pricePrompt(`moto|electric|certified`, l); // EV moto: origin irrelevant (0%)
    const origins: OriginClass[] = ["fta", "certified", "uncertified"];
    return { text: T.pickOrigin[l], replyMarkup: { inline_keyboard: origins.map((o) => [{ text: ORIGIN_LABEL[o][l], callback_data: `cu|mo|${fuel}|${o}` }]) } };
  }
  if (step === "mo") {
    const [, , fuel, origin] = p;
    return pricePrompt(`moto|${fuel}|${origin}`, l);
  }

  // ── Engine flow ──
  if (step === "es") return pricePrompt(`engine|${p[2]}`, l); // p[2] = new|used

  // ── Mini-truck flow ──
  if (step === "tf") {
    const fuel = p[2]; // ice | ev
    const ages: ("le3" | "gt3")[] = ["le3", "gt3"];
    return { text: T.pickTruckAge[l], replyMarkup: { inline_keyboard: [ages.map((a) => ({ text: TRUCK_AGE[a][l], callback_data: `cu|ta|${fuel}|${a}` }))] } };
  }
  if (step === "ta") {
    const [, , fuel, age] = p;
    if (fuel === "ev") return pricePrompt(`truck|ev|${age}|certified`, l); // EV: origin irrelevant
    const origins: OriginClass[] = ["fta", "certified", "uncertified"];
    return { text: T.pickOrigin[l], replyMarkup: { inline_keyboard: origins.map((o) => [{ text: ORIGIN_LABEL[o][l], callback_data: `cu|to|${fuel}|${age}|${o}` }]) } };
  }
  if (step === "to") {
    const [, , fuel, age, origin] = p;
    return pricePrompt(`truck|${fuel}|${age}|${origin}`, l);
  }

  // ── Bus flow: capacity → age → fuel → (ice: eco → origin) → price ──
  if (step === "bc") {
    const ages: ("le3" | "gt3")[] = ["le3", "gt3"];
    return { text: T.pickAge[l], replyMarkup: { inline_keyboard: [ages.map((a) => ({ text: TRUCK_AGE[a][l], callback_data: `cu|ba|${p[2]}|${a}` }))] } };
  }
  if (step === "ba") {
    const [, , cap, age] = p;
    const fuels: ("ice" | "ev")[] = ["ice", "ev"];
    return { text: T.pickFuel[l], replyMarkup: { inline_keyboard: [fuels.map((f) => ({ text: BUS_FUEL[f][l], callback_data: `cu|bf|${cap}|${age}|${f}` }))] } };
  }
  if (step === "bf") {
    const [, , cap, age, fuel] = p;
    if (fuel === "ev") return pricePrompt(`bus|${cap}|${age}|ev|euro5plus|certified`, l);
    const ecos: EcoClass[] = ["euro5plus", "euro4"];
    return { text: T.pickEco[l], replyMarkup: { inline_keyboard: [ecos.map((e) => ({ text: ECO_LABEL[e][l], callback_data: `cu|be|${cap}|${age}|${e}` }))] } };
  }
  if (step === "be") {
    const [, , cap, age, eco] = p;
    const origins: OriginClass[] = ["fta", "certified", "uncertified"];
    return { text: T.pickOrigin[l], replyMarkup: { inline_keyboard: origins.map((o) => [{ text: ORIGIN_LABEL[o][l], callback_data: `cu|bo|${cap}|${age}|${eco}|${o}` }]) } };
  }
  if (step === "bo") {
    const [, , cap, age, eco, origin] = p;
    return pricePrompt(`bus|${cap}|${age}|ice|${eco}|${origin}`, l);
  }

  // ── Фура flow: part → (tractor: age → eco) → price; below-Euro-4 BANNED ──
  if (step === "fp") {
    if (p[2] === "semitrailer") return pricePrompt(`fura|semitrailer|a1|euro5plus`, l);
    const ages: FuraAge[] = ["a1", "a2", "a3", "a4"];
    return { text: T.pickFuraAge[l], replyMarkup: { inline_keyboard: chunk(ages.map((a) => ({ text: FURA_AGE[a][l], callback_data: `cu|fa|tractor|${a}` })), 2) } };
  }
  if (step === "fa") {
    const age = p[3];
    const ecos: EcoClass[] = ["euro5plus", "euro4", "below4"];
    return { text: T.pickEco[l], replyMarkup: { inline_keyboard: ecos.map((e) => [{ text: ECO_LABEL[e][l], callback_data: `cu|fe|tractor|${age}|${e}` }]) } };
  }
  if (step === "fe") {
    const [, , , age, eco] = p;
    if (eco === "below4") return { text: T.banned[l] }; // import prohibited — no calc
    return pricePrompt(`fura|tractor|${age}|${eco}`, l);
  }
  return null;
}

function pricePrompt(state: string, l: Loc): BotStep {
  return { text: `${T.askPrice[l]}\n\n[cu:${state}]`, replyMarkup: { force_reply: true, input_field_placeholder: T.pricePh[l] } };
}

export const CUST_MARKER = /\[cu:([a-z0-9|]+)\]/i;

/** Handle the price reply: recover state from the quoted prompt, compute. */
export function customsPriceReply(promptText: string, userText: string, loc: string, usdUzs: number): BotStep | null {
  const m = (promptText || "").match(CUST_MARKER);
  if (!m) return null;
  const l = L(loc);
  const price = parseFloat(String(userText).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(price) || price <= 0) return { text: T.badNum[l] };
  const parts = m[1].split("|");
  let r: CustomsResult, header: string;
  if (parts[0] === "moto") {
    const [, fuel, origin] = parts;
    r = computeCustomsUz({ priceUsd: price, category: "moto", kind: fuel as VehicleKind, origin: origin as OriginClass, usdUzs });
    header = `${T.cat.moto[l]} · ${MOTO_FUEL[(fuel === "electric" ? "electric" : "petrol")][l]} · ${ORIGIN_LABEL[r.origin][l]}`;
  } else if (parts[0] === "engine") {
    const state = parts[1] === "used" ? "used3plus" : "new";
    r = computeCustomsUz({ priceUsd: price, category: "engine", kind: "petrol", age: state as VehicleAge, usdUzs });
    header = `${T.cat.engine[l]} · ${STATE_LABEL[parts[1] === "used" ? "used" : "new"][l]}`;
  } else if (parts[0] === "truck") {
    const [, fuel, age, origin] = parts; // fuel ice|ev, age le3|gt3
    const kind: VehicleKind = fuel === "ev" ? "electric" : "petrol";
    const va: VehicleAge = age === "gt3" ? "used3plus" : "used1to3";
    r = computeCustomsUz({ priceUsd: price, category: "truck", kind, age: va, origin: origin as OriginClass, usdUzs });
    header = `${T.cat.truck[l]} · ${TRUCK_FUEL[fuel === "ev" ? "ev" : "ice"][l]} · ${TRUCK_AGE[age === "gt3" ? "gt3" : "le3"][l]}${kind === "electric" ? "" : ` · ${ORIGIN_LABEL[r.origin][l]}`}`;
  } else if (parts[0] === "bus") {
    const [, cap, age, fuel, eco, origin] = parts; // cap small|large, age le3|gt3, fuel ice|ev
    const kind: VehicleKind = fuel === "ev" ? "electric" : "petrol";
    const va: VehicleAge = age === "gt3" ? "used3plus" : "used1to3";
    r = computeCustomsUz({ priceUsd: price, category: "bus", kind, age: va, capacity: cap as BusCapacity, eco: eco as EcoClass, origin: origin as OriginClass, engineCc: 2000, usdUzs });
    header = `${T.cat.bus[l]} · ${CAP_LABEL[cap as BusCapacity][l]} · ${TRUCK_AGE[age === "gt3" ? "gt3" : "le3"][l]} · ${BUS_FUEL[fuel === "ev" ? "ev" : "ice"][l]}`;
  } else if (parts[0] === "fura") {
    const [, part, age, eco] = parts;
    r = computeCustomsUz({ priceUsd: price, category: "fura", kind: "diesel", furaPart: part as FuraPart, furaAge: age as FuraAge, eco: eco as EcoClass, engineCc: 12000, usdUzs });
    header = `${T.cat.fura[l]} · ${FURA_PART[part as FuraPart][l]}${part === "tractor" ? ` · ${FURA_AGE[age as FuraAge][l]} · ${ECO_LABEL[eco as EcoClass][l]}` : ""}`;
  } else {
    const [kind, age, origin, cc] = parts;
    r = computeCustomsUz({ priceUsd: price, kind: kind as VehicleKind, age: age as VehicleAge, origin: origin as OriginClass, engineCc: Number(cc), usdUzs });
    header = `${T.cat.car[l]} · ${KIND_LABEL[r.kind][l]} · ${AGE_LABEL[r.age][l]} · ${ORIGIN_LABEL[r.origin][l]}`;
  }
  return { text: renderResult(r, header, l), replyMarkup: { inline_keyboard: [[{ text: T.webBtn[l], url: `${siteUrl()}/${l}/calculator` }]] } };
}

function renderResult(r: CustomsResult, header: string, l: Loc): string {
  const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
  const LK: Record<string, Tri> = { duty: T.duty, vat: T.vat, util: T.util, clearance: T.fee };
  const lines = r.lines.map((x) => `▪️ ${LK[x.key][l]}${x.detail ? ` (${x.detail})` : ""}: ${usd(x.usdValue)}`).join("\n");
  return [
    `🧮 <b>${T.customsTotal[l]}: ${usd(r.customsCostUsd)}</b>`,
    header,
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
