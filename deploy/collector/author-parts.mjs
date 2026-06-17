/**
 * Build the Tez Motors parts catalogue from the Gonzo crawl (~/subs/gonzo-parts.json).
 *
 * ALL catalogue copy here — clean trilingual names + descriptions, category,
 * brand/model — is authored by hand (Opus), NOT by any runtime/free model. The
 * descriptions are written per part-TYPE (front bumper, headlight, …) and the car
 * model is interpolated, which is the professional norm for a parts catalogue.
 * Prices: Gonzo's price is the reference (original_price_usd); ours undercuts it
 * ~8%. Parts Gonzo lists без цены become honest "price on request" drafts the
 * dealer prices during review. Everything lands is_published=false (review-gated).
 *
 *   node author-parts.mjs            (dry-run: prints what it would insert)
 *   node author-parts.mjs --write    (insert drafts)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const WRITE = process.argv.includes("--write");
const UNDERCUT_PCT = 8;
const IN = (process.env.HOME || "/home/rayxona") + "/subs/gonzo-parts.json";

function loadEnv() {
  for (const p of ["../../.env.local", "../.env.local", "./.env.local", "/home/rayxona/tez-motors/.env.local"]) {
    try { const e = {}; for (const l of readFileSync(resolve(p), "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0) e[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^['"]|['"]$/g, ""); } if (e.NEXT_PUBLIC_SUPABASE_URL) return e; } catch {}
  }
  return {};
}
const env = loadEnv();
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, authorization: `Bearer ${K}`, "content-type": "application/json" };

// ── clean + dedupe the crawl (mirror of the worksheet) ─────────────────────
function cleanName(n) {
  return (n || "").replace(/\s+/g, " ").trim()
    .replace(/^Запчасти( на| Лобовое|)\s*/i, "")
    .replace(/\s*(в Ташкенте?|в Ташкент)\s*(\|.*)?$/i, "")
    .replace(/\s*\|\s*GONZO.*$/i, "")
    .replace(/^Купить\s+/i, "")
    .replace(/^Copy of\s+/i, "")
    .trim();
}

// ── brand + model from the cleaned RU name ─────────────────────────────────
function brandModel(name, crumbBrand) {
  const s = name;
  let brand = null, model = null;
  if (/\bBYD\b/i.test(s) || /byd/i.test(crumbBrand || "")) {
    brand = "BYD";
    if (/han/i.test(s)) model = "Han";
    else if (/yuan/i.test(s)) model = "Yuan Plus";
    else if (/seal/i.test(s)) model = "Seal 06 GT";
    else if (/chazor/i.test(s)) model = "Chazor";
    else if (/tang/i.test(s)) model = "Tang L";
  } else if (/zeekr/i.test(s)) {
    brand = "Zeekr";
    const m = s.match(/zeekr\s*(001\s*fr|007|009|001|7\s*[хx]|mix|x)\b/i);
    model = m ? "Zeekr " + m[1].toUpperCase().replace(/\s+/g, "").replace("Х", "X") : "Zeekr";
  } else if (/lixiang|li\s*\d|\bli\b|mega/i.test(s)) {
    brand = "Li Auto";
    const m = s.match(/li\s*(\d)/i);
    model = /mega/i.test(s) ? "Mega" : m ? "L" + m[1] : "Li Auto";
  } else if (/\bbmw\b/i.test(s)) {
    brand = "BMW";
    const m = s.match(/\b(ix3|ix|i3|i4|i5)\b/i);
    model = m ? "BMW " + m[1].toUpperCase().replace("IX3", "iX3").replace("IX", "iX").replace(/I(\d)/, "i$1") : "BMW";
  } else if (/hongqi|eqm/i.test(s)) {
    brand = "Hongqi";
    model = /eqm-?5/i.test(s) ? "EQM-5" : "Hongqi";
  }
  return { brand, model: model || brand };
}

// ── part-TYPE detection + hand-authored trilingual copy ────────────────────
// Each entry: cat + RU/UZ/EN name + RU/UZ/EN description. `M` = "Brand Model".
const T = (cat, ru, uz, en, dRu, dUz, dEn) => ({ cat, ru, uz, en, dRu, dUz, dEn });
const TYPES = [
  [/передн[а-яёa-z]*\s*бампер|бампер\s*передн/i, T("body", "Передний бампер", "old bufer", "Front Bumper",
    (M) => `Передний бампер для ${M} — кузовная деталь, точно повторяющая геометрию, крепления и вырезы оригинала. Поставляется загрунтованным под окраску в цвет кузова. Привозим под заказ напрямую из Китая с доставкой в Ташкент.`,
    (M) => `${M} uchun old bufer — original geometriya va biriktirgichlarni aniq takrorlovchi kuzov detali. Kuzov rangiga bo'yashga tayyor holda yetkaziladi. Xitoydan buyurtma asosida Toshkentga yetkazib beramiz.`,
    (M) => `Front bumper for the ${M} — a body panel that matches the original's shape, mounting points and cut-outs exactly. Supplied primed and ready for colour-matched painting. Ordered direct from China with delivery to Tashkent.`)],
  [/задн[а-яёa-z]*\s*бампер|бампер\s*задн/i, T("body", "Задний бампер", "orqa bufer", "Rear Bumper",
    (M) => `Задний бампер для ${M} — точная копия штатной детали по форме и крепёжным точкам, под окраску в цвет кузова. Под заказ из Китая, доставка в Ташкент.`,
    (M) => `${M} uchun orqa bufer — shakl va biriktirish nuqtalari bo'yicha original detalning aniq nusxasi, kuzov rangiga bo'yash uchun. Xitoydan buyurtma, Toshkentga yetkazib berish.`,
    (M) => `Rear bumper for the ${M} — an exact match for the factory part in shape and mounting points, ready for colour-matched paint. Ordered from China, delivered to Tashkent.`)],
  [/накладк[а-яёa-z]*\s*на\s*бампер|боди\s*кит|воздуховод\s*.*бампер/i, T("body", "Накладка на бампер", "bufer qoplamasi", "Bumper Trim",
    (M) => `Накладка/обвес на бампер для ${M} — элемент внешнего тюнинга, добавляющий автомобилю выразительности. Идеальная посадка по штатным местам. Под заказ из Китая.`,
    (M) => `${M} uchun bufer qoplamasi — avtomobil tashqi ko'rinishini jonlantiruvchi tюning elementi. Original o'rinlarga aniq o'rnatiladi. Xitoydan buyurtma asosida.`,
    (M) => `Bumper trim / body-kit element for the ${M} — an exterior styling piece that sharpens the car's stance, fitting the factory mounting points. Ordered from China.`)],
  [/передн[а-яёa-z]*\s*крыл|крыл[а-яёa-z]*\s*передн/i, T("body", "Переднее крыло", "old qanot", "Front Fender",
    (M) => `Переднее крыло для ${M} — кузовной элемент с точной геометрией под штатные крепления и зазоры. Загрунтовано под окраску. Под заказ из Китая, доставка в Ташкент.`,
    (M) => `${M} uchun old qanot — original biriktirgich va oraliqlarga mos aniq geometriyali kuzov elementi. Bo'yashga tayyor. Xitoydan buyurtma, Toshkentga yetkazib berish.`,
    (M) => `Front fender for the ${M} — a body panel with precise geometry for factory fitment and panel gaps, primed for paint. Ordered from China, delivered to Tashkent.`)],
  [/задн[а-яёa-z]*\s*крыл|крыл[а-яёa-z]*\s*задн/i, T("body", "Заднее крыло", "orqa qanot", "Rear Fender",
    (M) => `Заднее крыло для ${M} — точная по форме кузовная панель под окраску в цвет кузова. Под заказ из Китая, доставка в Ташкент.`,
    (M) => `${M} uchun orqa qanot — kuzov rangiga bo'yash uchun aniq shakldagi panel. Xitoydan buyurtma, Toshkentga yetkazish.`,
    (M) => `Rear fender for the ${M} — a precisely shaped body panel ready for colour-matched paint. Ordered from China, delivered to Tashkent.`)],
  [/крыл/i, T("body", "Крыло", "qanot", "Fender",
    (M) => `Крыло для ${M} — кузовная панель с заводской геометрией под окраску в цвет кузова. Под заказ из Китая, доставка в Ташкент.`,
    (M) => `${M} uchun qanot — zavod geometriyasiga ega kuzov paneli, bo'yashga tayyor. Xitoydan buyurtma, Toshkentga yetkazish.`,
    (M) => `Fender for the ${M} — a body panel with factory geometry, ready for paint. Ordered from China, delivered to Tashkent.`)],
  [/капот/i, T("body", "Капот", "kapot", "Hood",
    (M) => `Капот для ${M} — кузовная деталь с точными крепёжными точками и зазорами, загрунтована под окраску. Под заказ из Китая, доставка в Ташкент.`,
    (M) => `${M} uchun kapot — aniq biriktirish nuqtalari va oraliqlarga ega, bo'yashga tayyor kuzov detali. Xitoydan buyurtma, Toshkentga yetkazish.`,
    (M) => `Hood for the ${M} — a body panel with exact mounting points and panel gaps, primed for paint. Ordered from China, delivered to Tashkent.`)],
  [/двер/i, T("body", "Дверь", "eshik", "Door",
    (M) => `Дверь для ${M} — кузовной элемент в сборе под окраску, с точной геометрией под штатные петли и замки. Под заказ из Китая, доставка в Ташкент.`,
    (M) => `${M} uchun eshik — original ilgak va qulflarga mos aniq geometriyali, bo'yashga tayyor kuzov elementi. Xitoydan buyurtma, Toshkentga yetkazish.`,
    (M) => `Door for the ${M} — a body shell ready for paint, with precise geometry for the factory hinges and latches. Ordered from China, delivered to Tashkent.`)],
  [/багажник|задн[а-яёa-z]*\s*багаж|крышк[а-яёa-z]*\s*багаж/i, T("body", "Крышка багажника", "bagajnik qopqog'i", "Trunk Lid",
    (M) => `Крышка багажника для ${M} — кузовная панель с точными креплениями под штатные петли и фонари, загрунтована под окраску. Под заказ из Китая.`,
    (M) => `${M} uchun bagajnik qopqog'i — original ilgak va chiroqlarga mos aniq biriktirgichli, bo'yashga tayyor panel. Xitoydan buyurtma asosida.`,
    (M) => `Trunk lid for the ${M} — a body panel with exact mounts for the factory hinges and lights, primed for paint. Ordered from China.`)],
  [/спойлер/i, T("body", "Спойлер", "spoyler", "Spoiler",
    (M) => `Спортивный спойлер для ${M} — аэродинамический и стилевой элемент с точной посадкой по штатным местам. Под заказ из Китая, доставка в Ташкент.`,
    (M) => `${M} uchun sport spoyler — original o'rinlarga aniq mos aerodinamik va uslubiy element. Xitoydan buyurtma, Toshkentga yetkazish.`,
    (M) => `Sport spoiler for the ${M} — an aerodynamic and styling element that fits the factory mounting points exactly. Ordered from China, delivered to Tashkent.`)],
  [/подножк/i, T("body", "Подножки", "yon zinapoyalar", "Running Boards",
    (M) => `Боковые подножки для ${M} — облегчают посадку и подчёркивают внешний вид внедорожника, крепятся по штатным точкам. Под заказ из Китая.`,
    (M) => `${M} uchun yon zinapoyalar — mashinaga chiqishni osonlashtiradi va tashqi ko'rinishni ta'kidlaydi, original nuqtalarga o'rnatiladi. Xitoydan buyurtma.`,
    (M) => `Side running boards for the ${M} — they ease entry and accent the SUV's look, mounting at the factory points. Ordered from China.`)],
  [/боковое\s*зеркал|зеркал/i, T("body", "Боковое зеркало", "yon oyna", "Side Mirror",
    (M) => `Боковое зеркало для ${M} — в сборе, с точной геометрией корпуса и креплений под штатную проводку. Под заказ из Китая, доставка в Ташкент.`,
    (M) => `${M} uchun yon oyna — original simlarga mos aniq korpus va biriktirgichli, yig'ilgan holatda. Xitoydan buyurtma, Toshkentga yetkazish.`,
    (M) => `Side mirror assembly for the ${M} — precise housing and mounts matched to the factory wiring. Ordered from China, delivered to Tashkent.`)],
  [/решётк|решетк|облицовк/i, T("body", "Решётка радиатора", "radiator panjarasi", "Radiator Grille",
    (M) => `Решётка радиатора для ${M} — точная по рисунку и креплениям деталь передней части, освежающая внешний вид. Под заказ из Китая.`,
    (M) => `${M} uchun radiator panjarasi — naqsh va biriktirgichlar bo'yicha aniq old qism detali, tashqi ko'rinishni yangilaydi. Xitoydan buyurtma.`,
    (M) => `Radiator grille for the ${M} — matched in pattern and mounts to refresh the front end. Ordered from China.`)],
  [/металлическ[а-яёa-z]*\s*защит|защита\s*картер/i, T("suspension", "Защита картера", "karter himoyasi", "Skid Plate",
    (M) => `Металлическая защита картера для ${M} — оберегает днище и силовые узлы на разбитых дорогах, крепится по штатным точкам. Под заказ из Китая.`,
    (M) => `${M} uchun metall karter himoyasi — yomon yo'llarda ostki qism va asosiy uzellarni himoya qiladi, original nuqtalarga o'rnatiladi. Xitoydan buyurtma.`,
    (M) => `Metal skid plate for the ${M} — protects the underbody and drivetrain on rough roads, bolting to the factory points. Ordered from China.`)],
  [/щетк[а-яёa-z]*\s*дворник|дворник/i, T("other", "Щётки стеклоочистителя", "tozalagich cho'tkalari", "Wiper Blades",
    (M) => `Щётки стеклоочистителя для ${M} — точная длина и тип крепления под штатные поводки, чистое сметание без полос. Под заказ из Китая.`,
    (M) => `${M} uchun tozalagich cho'tkalari — original tutqichlarga mos uzunlik va biriktirish turi, toza tozalash. Xitoydan buyurtma.`,
    (M) => `Wiper blades for the ${M} — correct length and fitment for the factory arms, clean streak-free wipe. Ordered from China.`)],
  [/наружн[а-яёa-z]*\s*ручк|ручк[а-яёa-z]*\s*двер/i, T("body", "Ручка двери", "eshik tutqichi", "Door Handle",
    (M) => `Наружная ручка двери для ${M} — точная по форме и механизму деталь, под окраску в цвет кузова. Под заказ из Китая.`,
    (M) => `${M} uchun tashqi eshik tutqichi — shakl va mexanizm bo'yicha aniq detal, kuzov rangiga bo'yash uchun. Xitoydan buyurtma.`,
    (M) => `Exterior door handle for the ${M} — exact shape and mechanism, ready for colour-matched paint. Ordered from China.`)],

  // Lighting (electrical)
  [/передн[а-яёa-z]*\s*фар|фар[а-яёa-z]*\s*передн|^передн.*фар|дхо|фара\s*передн[а-яёa-z]*\s*средн/i, T("electrical", "Передние фары", "old chiroqlar", "Front Headlights",
    (M) => `Передние фары для ${M} — оригинального типа, со штатными разъёмами и креплениями, полностью совместимы со штатной электрикой. Под заказ из Китая, доставка в Ташкент.`,
    (M) => `${M} uchun old chiroqlar — original turdagi, standart ulagich va biriktirgichlar bilan, standart elektrika bilan to'liq mos. Xitoydan buyurtma, Toshkentga yetkazish.`,
    (M) => `Front headlights for the ${M} — OEM-type units with factory connectors and mounts, fully compatible with the original wiring. Ordered from China, delivered to Tashkent.`)],
  [/задн[а-яёa-z]*\s*фар|задн[а-яёa-z]*\s*фонар|фонар|задн.*фар/i, T("electrical", "Задние фонари", "orqa chiroqlar", "Rear Lights",
    (M) => `Задние фонари для ${M} — оригинального типа, со штатными разъёмами и креплениями. Полная совместимость с электрикой автомобиля. Под заказ из Китая.`,
    (M) => `${M} uchun orqa chiroqlar — original turdagi, standart ulagich va biriktirgichlar bilan. Avtomobil elektrikasi bilan to'liq mos. Xitoydan buyurtma.`,
    (M) => `Rear lights for the ${M} — OEM-type units with factory connectors and mounts, fully compatible with the car's wiring. Ordered from China.`)],
  [/туманк|противотуман/i, T("electrical", "Противотуманная фара", "tuman chirog'i", "Fog Light",
    (M) => `Противотуманная фара для ${M} — улучшает видимость в туман и непогоду, штатный разъём и посадочное место. Под заказ из Китая.`,
    (M) => `${M} uchun tuman chirog'i — tuman va yomon ob-havoda ko'rinishni yaxshilaydi, standart ulagich va o'rin. Xitoydan buyurtma.`,
    (M) => `Fog light for the ${M} — improves visibility in fog and bad weather, with the factory connector and seat. Ordered from China.`)],
  [/фонарь\s*наружн|наружн[а-яёa-z]*\s*фонар/i, T("electrical", "Наружный фонарь", "tashqi chiroq", "Exterior Lamp",
    (M) => `Наружный фонарь для ${M} — оригинального типа со штатным разъёмом, точная посадка по месту. Под заказ из Китая.`,
    (M) => `${M} uchun tashqi chiroq — standart ulagichli original tur, joyiga aniq o'rnatiladi. Xitoydan buyurtma.`,
    (M) => `Exterior lamp for the ${M} — OEM-type with the factory connector and exact fitment. Ordered from China.`)],
  [/аирбаг|airbag|подушк[а-яёa-z]*\s*безопас/i, T("electrical", "Подушка безопасности", "xavfsizlik yostig'i", "Airbag",
    (M) => `Подушка безопасности для ${M} — оригинального типа, для восстановления штатной системы пассивной безопасности. Установку и привязку выполняет специалист. Под заказ из Китая.`,
    (M) => `${M} uchun xavfsizlik yostig'i — passiv xavfsizlik tizimini tiklash uchun original tur. O'rnatish va moslashni mutaxassis bajaradi. Xitoydan buyurtma.`,
    (M) => `Airbag for the ${M} — OEM-type, to restore the factory passive-safety system. Fitting and coding done by a specialist. Ordered from China.`)],

  // Glass (body)
  [/лобов|ветров[а-яёa-z]*\s*стекл/i, T("body", "Лобовое стекло", "old oyna", "Windshield",
    (M) => `Лобовое стекло для ${M} — оригинального типа, с креплениями под датчики и камеры, где они предусмотрены. Рекомендуем установку у специалиста. Под заказ из Китая.`,
    (M) => `${M} uchun old oyna — datchik va kameralar uchun o'rinli original tur. O'rnatishni mutaxassisda tavsiya qilamiz. Xitoydan buyurtma.`,
    (M) => `Windshield for the ${M} — OEM-type, with mounts for sensors and cameras where fitted. Professional installation recommended. Ordered from China.`)],
  [/стекл[а-яёa-z]*\s*(передн|задн)[а-яёa-z]*\s*двер|стекл[а-яёa-z]*\s*двер/i, T("body", "Стекло двери", "eshik oynasi", "Door Glass",
    (M) => `Стекло двери для ${M} — точное по форме и кривизне под штатные направляющие. Под заказ из Китая.`,
    (M) => `${M} uchun eshik oynasi — original yo'naltirgichlarga mos aniq shakl va egrilik. Xitoydan buyurtma.`,
    (M) => `Door glass for the ${M} — exact shape and curvature for the factory channels. Ordered from China.`)],
  [/задн[а-яёa-z]*\s*(лобов|стекл)|стекл[а-яёa-z]*\s*задн/i, T("body", "Заднее стекло", "orqa oyna", "Rear Glass",
    (M) => `Заднее стекло для ${M} — оригинального типа с обогревом, где он предусмотрен. Под заказ из Китая, доставка в Ташкент.`,
    (M) => `${M} uchun orqa oyna — isitgichli original tur (mavjud bo'lsa). Xitoydan buyurtma, Toshkentga yetkazish.`,
    (M) => `Rear glass for the ${M} — OEM-type with defroster where fitted. Ordered from China, delivered to Tashkent.`)],

  // Suspension
  [/пневмостойк|пневмо[а-яёa-z]*\s*подвеск|пневмобаллон/i, T("suspension", "Пневмостойка", "pnevmo amortizator", "Air Suspension Strut",
    (M) => `Пневмостойка для ${M} — узел пневмоподвески в сборе, восстанавливает заводскую плавность хода и регулировку клиренса. Под заказ из Китая, доставка в Ташкент.`,
    (M) => `${M} uchun pnevmo amortizator — pnevmopodveska uzeli, zavod yumshoqligi va klirens sozlamasini tiklaydi. Xitoydan buyurtma, Toshkentga yetkazish.`,
    (M) => `Air suspension strut for the ${M} — a complete air-spring unit that restores factory ride comfort and ride-height control. Ordered from China, delivered to Tashkent.`)],
  [/амортизатор\s*передн|передн[а-яёa-z]*\s*амортизатор/i, T("suspension", "Передний амортизатор", "old amortizator", "Front Shock Absorber",
    (M) => `Передний амортизатор для ${M} — восстанавливает управляемость и комфорт, оригинальные характеристики демпфирования. Под заказ из Китая.`,
    (M) => `${M} uchun old amortizator — boshqaruv va qulaylikni tiklaydi, original dempflash xususiyatlari. Xitoydan buyurtma.`,
    (M) => `Front shock absorber for the ${M} — restores handling and comfort with OEM damping characteristics. Ordered from China.`)],
  [/амортизатор\s*задн|задн[а-яёa-z]*\s*амортизатор|амортизатор/i, T("suspension", "Задний амортизатор", "orqa amortizator", "Rear Shock Absorber",
    (M) => `Задний амортизатор для ${M} — оригинальные характеристики демпфирования для ровного и устойчивого хода. Под заказ из Китая.`,
    (M) => `${M} uchun orqa amortizator — tekis va barqaror harakat uchun original dempflash. Xitoydan buyurtma.`,
    (M) => `Rear shock absorber for the ${M} — OEM damping for a smooth, stable ride. Ordered from China.`)],
  [/стойк[а-яёa-z]*\s*стабилизатор|стабилизатор/i, T("suspension", "Стойка стабилизатора", "stabilizator tirgagi", "Stabilizer Link",
    (M) => `Стойка стабилизатора для ${M} — устраняет стуки и восстанавливает чёткость в поворотах. Оригинальные размеры и резьба. Под заказ из Китая.`,
    (M) => `${M} uchun stabilizator tirgagi — taqilladshlarni yo'qotadi va burilishlarda aniqlikni tiklaydi. Original o'lcham va rezba. Xitoydan buyurtma.`,
    (M) => `Stabilizer link for the ${M} — removes knocks and restores cornering precision, with OEM dimensions and threads. Ordered from China.`)],
  [/рычаг/i, T("suspension", "Рычаг подвески", "podveska richagi", "Control Arm",
    (M) => `Рычаг подвески для ${M} — несущий элемент, восстанавливающий геометрию и управляемость. С штатными сайлентблоками и шаровой. Под заказ из Китая.`,
    (M) => `${M} uchun podveska richagi — geometriya va boshqaruvni tiklovchi tayanch element. Original saylentblok va sharik bilan. Xitoydan buyurtma.`,
    (M) => `Suspension control arm for the ${M} — a load-bearing component that restores geometry and handling, with OEM bushings and ball joint. Ordered from China.`)],
  [/рулев[а-яёa-z]*\s*рейк/i, T("suspension", "Рулевая рейка", "rul reykasi", "Steering Rack",
    (M) => `Рулевая рейка для ${M} — восстанавливает точное и плавное рулевое управление. Оригинальные присоединительные размеры. Под заказ из Китая.`,
    (M) => `${M} uchun rul reykasi — aniq va yumshoq boshqaruvni tiklaydi. Original ulanish o'lchamlari. Xitoydan buyurtma.`,
    (M) => `Steering rack for the ${M} — restores precise, smooth steering with OEM connection dimensions. Ordered from China.`)],
  [/кронштейн[а-яёa-z]*\s*.*амортизатор|опор[а-яёa-z]*\s*амортизатор/i, T("suspension", "Кронштейн амортизатора", "amortizator kronshteyni", "Shock Mount Bracket",
    (M) => `Кронштейн крепления амортизатора для ${M} — силовой элемент крепления стойки, оригинальная геометрия. Под заказ из Китая.`,
    (M) => `${M} uchun amortizator kronshteyni — amortizatorni biriktiruvchi kuch elementi, original geometriya. Xitoydan buyurtma.`,
    (M) => `Shock mount bracket for the ${M} — a structural strut-mount with OEM geometry. Ordered from China.`)],
  [/элемент[а-яёa-z]*\s*подвеск/i, T("suspension", "Элементы подвески", "podveska elementlari", "Suspension Parts",
    (M) => `Элементы подвески для ${M} — рычаги, стойки, сайлентблоки и опоры под штатную геометрию. Точный состав уточнит менеджер. Под заказ из Китая.`,
    (M) => `${M} uchun podveska elementlari — original geometriyaga mos richag, tirgak, saylentblok va tayanchlar. Aniq tarkibni menejer aytadi. Xitoydan buyurtma.`,
    (M) => `Suspension parts for the ${M} — arms, links, bushings and mounts to factory geometry. A manager confirms the exact set. Ordered from China.`)],

  // Brakes
  [/колодк/i, T("brakes", "Тормозные колодки", "tormoz kolodkalari", "Brake Pads",
    (M) => `Тормозные колодки для ${M} — уверенное и тихое торможение, оригинальный состав и геометрия под штатные суппорты. Под заказ из Китая.`,
    (M) => `${M} uchun tormoz kolodkalari — ishonchli va shovqinsiz tormozlash, original tarkib va standart suportlarga mos geometriya. Xitoydan buyurtma.`,
    (M) => `Brake pads for the ${M} — confident, quiet braking with OEM compound and geometry for the factory calipers. Ordered from China.`)],
  [/тормозн[а-яёa-z]*\s*шланг/i, T("brakes", "Тормозной шланг", "tormoz shlangi", "Brake Hose",
    (M) => `Передний тормозной шланг для ${M} — выдерживает рабочее давление, оригинальная длина и присоединения. Под заказ из Китая.`,
    (M) => `${M} uchun old tormoz shlangi — ishchi bosimga chidamli, original uzunlik va ulanishlar. Xitoydan buyurtma.`,
    (M) => `Front brake hose for the ${M} — rated for working pressure, with OEM length and fittings. Ordered from China.`)],

  // Engine / cooling
  [/радиатор\s*кондиционер|кондиционер/i, T("engine", "Радиатор кондиционера", "konditsioner radiatori", "A/C Condenser",
    (M) => `Радиатор кондиционера для ${M} — восстанавливает эффективное охлаждение салона, оригинальные размеры и патрубки. Под заказ из Китая.`,
    (M) => `${M} uchun konditsioner radiatori — salon sovutishini tiklaydi, original o'lcham va patrubkalar. Xitoydan buyurtma.`,
    (M) => `A/C condenser for the ${M} — restores efficient cabin cooling with OEM dimensions and ports. Ordered from China.`)],
  [/масл[а-яёa-z]*\s*радиатор/i, T("engine", "Масляный радиатор", "moy radiatori", "Oil Cooler",
    (M) => `Масляный радиатор для ${M} — поддерживает рабочую температуру масла, оригинальные присоединения. Под заказ из Китая.`,
    (M) => `${M} uchun moy radiatori — moyning ishchi haroratini saqlaydi, original ulanishlar. Xitoydan buyurtma.`,
    (M) => `Oil cooler for the ${M} — keeps oil at its working temperature, with OEM connections. Ordered from China.`)],
  [/радиатор/i, T("engine", "Радиатор охлаждения", "sovutish radiatori", "Radiator",
    (M) => `Радиатор охлаждения для ${M} — эффективный теплообмен и защита от перегрева, оригинальные размеры и патрубки. Под заказ из Китая.`,
    (M) => `${M} uchun sovutish radiatori — samarali issiqlik almashinuvi va qizib ketishdan himoya, original o'lcham va patrubkalar. Xitoydan buyurtma.`,
    (M) => `Cooling radiator for the ${M} — efficient heat exchange and overheating protection, with OEM dimensions and ports. Ordered from China.`)],
  [/бачок\s*расширительн|расширительн[а-яёa-z]*\s*бачок/i, T("engine", "Расширительный бачок", "kengaytiruvchi bachok", "Expansion Tank",
    (M) => `Расширительный бачок для ${M} — компенсирует расширение охлаждающей жидкости, оригинальные патрубки и датчик уровня. Под заказ из Китая.`,
    (M) => `${M} uchun kengaytiruvchi bachok — sovutuvchi suyuqlik kengayishini qoplaydi, original patrubka va daraja datchigi. Xitoydan buyurtma.`,
    (M) => `Coolant expansion tank for the ${M} — absorbs coolant expansion, with OEM ports and a level sensor. Ordered from China.`)],
  [/воздушн[а-яёa-z]*\s*фильтр|фильтр/i, T("engine", "Воздушный фильтр", "havo filtri", "Air Filter",
    (M) => `Воздушный фильтр для ${M} — надёжная очистка воздуха для впуска, оригинальный размер и плотная посадка. Под заказ из Китая.`,
    (M) => `${M} uchun havo filtri — kirish uchun ishonchli havo tozalash, original o'lcham va zich o'rnatish. Xitoydan buyurtma.`,
    (M) => `Air filter for the ${M} — reliable intake air filtration with OEM size and a tight fit. Ordered from China.`)],

  // Trim / misc (body/other)
  [/декоративн[а-яёa-z]*\s*(планк|панел)|планк|молдинг|накладк/i, T("body", "Декоративная накладка", "dekorativ qoplama", "Trim Molding",
    (M) => `Декоративная накладка для ${M} — восстанавливает заводской внешний вид кузова, точная посадка по штатным защёлкам. Под заказ из Китая.`,
    (M) => `${M} uchun dekorativ qoplama — kuzovning zavod ko'rinishini tiklaydi, original mahkamlagichlarga aniq o'rnatiladi. Xitoydan buyurtma.`,
    (M) => `Trim molding for the ${M} — restores the factory exterior look with an exact fit on the original clips. Ordered from China.`)],
  [/петл[а-яёa-z]*\s*багаж|петл/i, T("body", "Петля крышки багажника", "bagajnik ilgagi", "Trunk Hinge",
    (M) => `Петля крышки багажника для ${M} — силовой шарнир с оригинальной геометрией для точного закрытия. Под заказ из Китая.`,
    (M) => `${M} uchun bagajnik ilgagi — aniq yopilish uchun original geometriyali sharnir. Xitoydan buyurtma.`,
    (M) => `Trunk-lid hinge for the ${M} — a load-bearing pivot with OEM geometry for precise closing. Ordered from China.`)],
  [/креплени[а-яёa-z]*\s*бампер|кронштейн[а-яёa-z]*\s*бампер/i, T("body", "Крепление бампера", "bufer kronshteyni", "Bumper Bracket",
    (M) => `Крепление (кронштейн) бампера для ${M} — восстанавливает надёжную фиксацию бампера по штатным точкам. Под заказ из Китая.`,
    (M) => `${M} uchun bufer kronshteyni — buferni original nuqtalarda ishonchli mahkamlaydi. Xitoydan buyurtma.`,
    (M) => `Bumper bracket for the ${M} — restores secure bumper fixing at the factory points. Ordered from China.`)],
];

const GENERIC = T("other", "Запчасть", "ehtiyot qism", "Spare Part",
  (M) => `Оригинальная запчасть для ${M} — точное соответствие штатной детали по геометрии и креплениям. Под заказ напрямую из Китая с доставкой в Ташкент.`,
  (M) => `${M} uchun original ehtiyot qism — geometriya va biriktirgichlar bo'yicha standart detalga aniq mos. Xitoydan to'g'ridan-to'g'ri buyurtma, Toshkentga yetkazish.`,
  (M) => `Genuine spare part for the ${M} — an exact match for the factory item in geometry and mounting. Ordered direct from China with delivery to Tashkent.`);

function detect(name) { for (const [re, t] of TYPES) if (re.test(name)) return t; return GENERIC; }

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72);
const translit = (s) => s.replace(/[а-яё]/gi, (c) => ({ а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" }[c.toLowerCase()] || c));

function main() {
  const raw = JSON.parse(readFileSync(IN, "utf8"));
  const seenUrl = new Set(), seenKey = new Set(), rows = [];
  for (const p of raw) {
    const nm0 = p.name || "";
    const url = (p.url || "").split("?")[0];
    if (!nm0 || /404|Ошибочка/i.test(nm0) || seenUrl.has(url)) continue;
    seenUrl.add(url);
    const name = cleanName(nm0);
    const key = name.toLowerCase().replace(/[^a-zа-я0-9]/g, "");
    if (key.length < 4 || seenKey.has(key)) continue;
    seenKey.add(key);

    const { brand, model } = brandModel(name, p.brand);
    if (!brand) continue; // skip if we can't attribute it to one of our brands
    // Display model with the brand for clarity ("BYD Han", "Hongqi EQM-5"), but
    // don't double it when the model already carries the brand ("Zeekr 007").
    const M = !model || model === brand ? brand : model.toLowerCase().includes(brand.toLowerCase()) ? model : `${brand} ${model}`;
    const t = detect(name);
    const priceUsd = p.price ? (p.currency === "UZS" ? Math.round(p.price / 12600) : p.price) : null;
    const baseSlug = slugify(translit(`${M} ${t.en}`));
    let slug = baseSlug, i = 2;
    while (rows.some((r) => r.slug === slug)) slug = `${baseSlug}-${i++}`;
    rows.push({
      slug,
      name_ru: `${t.ru} ${M}`.slice(0, 180),
      name_uz: `${M} ${t.uz}`.slice(0, 180),
      name_en: `${M} ${t.en}`.slice(0, 180),
      description_ru: t.dRu(M).slice(0, 1000),
      description_uz: t.dUz(M).slice(0, 1000),
      description_en: t.dEn(M).slice(0, 1000),
      category: t.cat,
      brand,
      price_usd: priceUsd ? Math.round(priceUsd * (1 - UNDERCUT_PCT / 100)) : null,
      original_price_usd: priceUsd || null,
      images: [],
      is_published: false,
      stock_qty: 0,
      fits_brands: [brand],
      fits_models: model && model !== brand ? [model] : [],
    });
  }
  const byBrand = {}, byCat = {}, priced = rows.filter((r) => r.price_usd).length;
  for (const r of rows) { byBrand[r.brand] = (byBrand[r.brand] || 0) + 1; byCat[r.category] = (byCat[r.category] || 0) + 1; }
  console.log(`authored ${rows.length} parts (${priced} priced, ${rows.length - priced} on request)`);
  console.log("by brand:", byBrand, "\nby category:", byCat);
  console.log("\nsamples:");
  for (const r of [rows[0], rows[7], rows[28], rows.find((x) => x.category === "suspension"), rows.find((x) => x.category === "brakes")].filter(Boolean))
    console.log(`  • [${r.category}] ${r.name_en} — $${r.price_usd ?? "on request"}\n    RU: ${r.name_ru} — ${r.description_ru.slice(0, 90)}…`);
  return rows;
}

const rows = main();
if (WRITE && rows.length) {
  const r = await fetch(`${U}/rest/v1/parts`, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) });
  console.log(r.ok ? `\ninserted/updated ${rows.length} draft parts ✓` : `\nFAIL ${r.status}: ${(await r.text()).slice(0, 400)}`);
} else if (rows.length) {
  console.log("\n(dry-run — pass --write to insert drafts)");
}
