#!/usr/bin/env node
/**
 * Seed `parts` table with realistic demo inventory across all 7
 * categories. Mirrors seed-cars.mjs: idempotent on slug.
 *
 * Usage: node scripts/seed-parts.mjs
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

async function loadEnv() {
  const text = await readFile(resolve(ROOT, ".env.production"), "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return env;
}

// Compact part definitions. For each: name (RU/UZ/EN), OEM, category,
// brand of part, fits brands, fits models, year range, price, stock.
// Years cover the typical Chinese-import age range our dealer sees.
const PARTS = [
  // ENGINE
  ["air-filter-byd-song-plus", "10422800", "Воздушный фильтр", "Havo filtri", "Air filter", "engine", "Bosch", 18, 25, ["BYD"], ["Song Plus", "Yuan Plus"], 2021, 2025, 12, 5],
  ["oil-filter-chery-tiggo-8", "1016050070", "Масляный фильтр", "Moy filtri", "Oil filter", "engine", "Mahle", 14, 40, ["Chery"], ["Tiggo 8", "Tiggo 7", "Arrizo 8"], 2020, 2025, 8, 3],
  ["fuel-filter-haval-h6", "1111120-XKZ16A", "Топливный фильтр", "Yoqilg'i filtri", "Fuel filter", "engine", "Mann", 32, 18, ["Haval"], ["H6", "Jolion", "Dargo"], 2020, 2025, 22, 0],
  ["spark-plug-set-byd", "47004000", "Свечи зажигания (комплект 4 шт)", "Yondirish shamlari (4 dona)", "Spark plug set (4 pcs)", "engine", "NGK", 28, 30, ["BYD", "Chery", "Haval"], [], 2018, 2025, null, 0],
  ["timing-belt-geely-coolray", "1016050100", "Ремень ГРМ", "GRM kamari", "Timing belt", "engine", "Gates", 65, 12, ["Geely"], ["Coolray", "Atlas Pro", "Tugella"], 2019, 2024, 45, 2],
  ["coolant-thermostat-chery", "513H-1306030", "Термостат системы охлаждения", "Sovutish tizimi termostati", "Coolant thermostat", "engine", "OEM", 22, 15, ["Chery"], [], 2018, 2024, null, 5],
  ["water-pump-haval-jolion", "1011200XKZ16A", "Помпа охлаждения", "Sovutish nasosi", "Water pump", "engine", "OEM", 95, 8, ["Haval"], ["Jolion", "H6"], 2021, 2025, 75, 1],
  ["intake-manifold-gasket-byd", "13B0001PA0", "Прокладка впускного коллектора", "Kirish kollektori prokladkasi", "Intake manifold gasket", "engine", "Victor Reinz", 14, 20, ["BYD"], [], 2020, 2025, null, 4],
  ["valve-cover-gasket-changan", "1006021AB", "Прокладка клапанной крышки", "Klapan qopqog'i prokladkasi", "Valve cover gasket", "engine", "Elring", 28, 14, ["Changan"], ["CS75 Plus", "UNI-T"], 2019, 2024, null, 6],
  ["pcv-valve-omoda-c5", "F01R03A013", "Клапан PCV", "PCV klapani", "PCV valve", "engine", "OEM", 18, 12, ["Omoda", "Chery"], ["C5", "Tiggo 4 Pro"], 2021, 2025, null, 7],
  ["engine-mount-tank-300", "1001100XPW01A", "Опора двигателя", "Dvigatel tayanchi", "Engine mount", "engine", "OEM", 110, 6, ["Tank"], ["300", "500"], 2022, 2025, 95, 8],
  ["alternator-belt-jaecoo-j7", "1001020J7", "Ремень генератора", "Generator kamari", "Alternator belt", "engine", "Continental", 24, 22, ["Jaecoo"], ["J7", "J8"], 2023, 2025, null, 9],

  // BRAKES
  ["brake-pads-front-byd-song", "GS1G3328Z", "Колодки тормозные передние", "Old tormoz kolodkalari", "Front brake pads", "brakes", "Brembo", 65, 18, ["BYD"], ["Song Plus", "Tang", "Han"], 2020, 2025, 55, 1],
  ["brake-pads-rear-haval-h6", "BYD-RA-001", "Колодки тормозные задние", "Orqa tormoz kolodkalari", "Rear brake pads", "brakes", "TRW", 55, 22, ["Haval"], ["H6", "Jolion"], 2020, 2025, 45, 2],
  ["brake-disc-front-chery-tiggo-8", "T11-3501075", "Тормозной диск передний", "Old tormoz diski", "Front brake disc", "brakes", "Brembo", 95, 10, ["Chery"], ["Tiggo 8", "Tiggo 7"], 2019, 2025, 80, 0],
  ["brake-disc-rear-byd-han", "GA60-3502075", "Тормозной диск задний", "Orqa tormoz diski", "Rear brake disc", "brakes", "OEM", 75, 10, ["BYD"], ["Han", "Tang"], 2020, 2025, null, 3],
  ["brake-fluid-dot4-1l", "1987479107", "Тормозная жидкость DOT4 (1 л)", "Tormoz suyuqligi DOT4 (1 l)", "Brake fluid DOT4 (1 L)", "brakes", "Bosch", 14, 60, [], [], null, null, null, 4],
  ["brake-caliper-front-geely-monjaro", "1014020100", "Суппорт тормозной передний", "Old tormoz supporti", "Front brake caliper", "brakes", "OEM", 285, 4, ["Geely"], ["Monjaro", "Tugella"], 2022, 2025, 245, 5],
  ["abs-sensor-haval-dargo", "ABS-SX-DAR", "Датчик ABS", "ABS datchigi", "ABS sensor", "brakes", "Bosch", 65, 15, ["Haval"], ["Dargo", "H6", "Jolion"], 2021, 2025, null, 6],
  ["handbrake-cable-changan", "3508021-AS01", "Трос ручного тормоза", "Qo'l tormozi trosi", "Handbrake cable", "brakes", "OEM", 38, 12, ["Changan"], ["CS75 Plus", "Eado"], 2019, 2024, null, 7],

  // ELECTRICAL
  ["alternator-byd-tang", "37300-2B100", "Генератор", "Generator", "Alternator", "electrical", "Denso", 320, 6, ["BYD"], ["Tang", "Han", "Song Plus"], 2020, 2025, 285, 0],
  ["starter-motor-haval-h9", "31100-XKZ-001", "Стартер", "Starter", "Starter motor", "electrical", "Bosch", 285, 8, ["Haval"], ["H9", "Dargo"], 2021, 2025, null, 1],
  ["car-battery-12v-70ah", "TM-AGM-70", "Аккумулятор 12V 70Ah AGM", "12V 70Ah AGM akkumulyator", "Car battery 12V 70Ah AGM", "electrical", "Varta", 145, 35, [], [], null, null, null, 2],
  ["battery-12v-90ah", "TM-AGM-90", "Аккумулятор 12V 90Ah AGM", "12V 90Ah AGM akkumulyator", "Car battery 12V 90Ah AGM", "electrical", "Bosch", 195, 18, [], [], null, null, null, 3],
  ["headlight-bulb-h7-pair", "TM-H7-LED", "Лампы H7 LED (пара)", "H7 LED lampalar (juft)", "H7 LED bulbs (pair)", "electrical", "Philips", 65, 50, [], [], null, null, null, 4],
  ["fog-light-led-pair", "TM-FOG-LED", "Противотуманные фары LED (пара)", "Tuman faralari LED (juft)", "LED fog lights (pair)", "electrical", "Osram", 95, 28, [], [], null, null, null, 5],
  ["spark-plug-coil-byd-song", "F01R00A039", "Катушка зажигания", "Yondirish g'altagi", "Ignition coil", "electrical", "Bosch", 78, 18, ["BYD"], ["Song Plus", "Yuan Plus", "Atto 3"], 2020, 2025, null, 6],
  ["wiper-motor-front-chery-tiggo", "T11-5205110AB", "Мотор стеклоочистителя передний", "Oldingi yorqinlovchi motori", "Front wiper motor", "electrical", "OEM", 145, 6, ["Chery"], ["Tiggo 8", "Tiggo 7"], 2019, 2025, 120, 0],
  ["window-regulator-rear-byd", "BYD-WR-RR-01", "Стеклоподъёмник задний", "Orqa oyna ko'taruvchi", "Rear window regulator", "electrical", "OEM", 165, 10, ["BYD"], ["Song Plus", "Atto 3"], 2020, 2025, null, 1],
  ["central-locking-actuator", "TM-LCK-CL", "Привод центрального замка", "Markaziy qulf yuritmasi", "Central locking actuator", "electrical", "OEM", 48, 14, [], [], null, null, null, 2],

  // SUSPENSION
  ["shock-absorber-front-byd-song", "GS1F-34-700", "Амортизатор передний", "Oldingi amortizator", "Front shock absorber", "suspension", "KYB", 145, 12, ["BYD"], ["Song Plus", "Yuan Plus"], 2020, 2025, 120, 3],
  ["shock-absorber-rear-haval-h6", "29040-XKZ16A", "Амортизатор задний", "Orqa amortizator", "Rear shock absorber", "suspension", "Sachs", 125, 14, ["Haval"], ["H6", "Jolion"], 2020, 2025, null, 0],
  ["control-arm-front-lower-chery", "T11-2904010", "Рычаг передней нижней подвески", "Old pastki richag", "Front lower control arm", "suspension", "OEM", 95, 8, ["Chery"], ["Tiggo 8", "Tiggo 7"], 2019, 2025, 80, 4],
  ["ball-joint-byd-tang", "GA40-29010X", "Шаровая опора", "Sharli tayanch", "Ball joint", "suspension", "Lemforder", 38, 22, ["BYD"], ["Tang", "Han", "Song Plus"], 2020, 2025, null, 5],
  ["wheel-bearing-front-haval-jolion", "31407CA000", "Подшипник ступицы передний", "Old g'ildirak podshipnigi", "Front wheel bearing", "suspension", "SKF", 75, 16, ["Haval"], ["Jolion", "H6"], 2020, 2025, null, 6],
  ["wheel-bearing-rear-geely-coolray", "GE03-W110-2", "Подшипник ступицы задний", "Orqa g'ildirak podshipnigi", "Rear wheel bearing", "suspension", "FAG", 68, 14, ["Geely"], ["Coolray", "Atlas Pro"], 2019, 2025, null, 7],
  ["sway-bar-link-changan", "2906250-AS01", "Стойка стабилизатора", "Stabilizator stoyka", "Sway bar link", "suspension", "OEM", 24, 30, ["Changan"], [], 2018, 2025, null, 8],
  ["coil-spring-front-tank-300", "29010XPW01A", "Пружина передняя", "Oldingi prujina", "Front coil spring", "suspension", "OEM", 110, 10, ["Tank"], ["300"], 2022, 2025, null, 1],
  ["strut-mount-byd-yuan-plus", "BYD-SM-YP-01", "Опорный подшипник стойки", "Stoyka tayanch podshipnigi", "Strut mount", "suspension", "Lemforder", 45, 18, ["BYD"], ["Yuan Plus", "Atto 3"], 2021, 2025, null, 2],

  // BODY
  ["front-bumper-byd-song-plus", "20502-FBP-WHT", "Бампер передний", "Oldingi bamper", "Front bumper", "body", "OEM", 285, 4, ["BYD"], ["Song Plus"], 2021, 2024, 245, 0],
  ["rear-bumper-chery-tiggo-7", "T15-2804501-DQ", "Бампер задний", "Orqa bamper", "Rear bumper", "body", "OEM", 245, 5, ["Chery"], ["Tiggo 7"], 2020, 2024, null, 5],
  ["headlight-left-haval-jolion", "JOL-HL-LFT-01", "Фара левая", "Chap fara", "Left headlight", "body", "OEM", 285, 6, ["Haval"], ["Jolion"], 2021, 2024, 245, 6],
  ["headlight-right-haval-jolion", "JOL-HL-RGT-01", "Фара правая", "O'ng fara", "Right headlight", "body", "OEM", 285, 6, ["Haval"], ["Jolion"], 2021, 2024, 245, 7],
  ["taillight-rear-byd-han", "GA60-4133050-AT", "Фонарь задний", "Orqa fonar", "Rear taillight", "body", "OEM", 145, 12, ["BYD"], ["Han"], 2020, 2025, null, 8],
  ["fender-front-left-geely-coolray", "GC-FE-FL-CR", "Крыло переднее левое", "Old chap qanot", "Front left fender", "body", "OEM", 165, 5, ["Geely"], ["Coolray"], 2019, 2024, null, 1],
  ["mirror-electric-left-chery-tiggo-8", "T18-8202010-DQ", "Зеркало боковое левое (электро)", "Chap yon oyna (elektr)", "Left side mirror (electric)", "body", "OEM", 95, 14, ["Chery"], ["Tiggo 8"], 2019, 2024, null, 2],
  ["windshield-byd-song-plus", "BYD-WS-SP-FT", "Лобовое стекло", "Old oyna", "Windshield", "body", "Pilkington", 245, 8, ["BYD"], ["Song Plus", "Yuan Plus"], 2020, 2025, null, 3],
  ["hood-haval-h6", "5300101XKZ16A", "Капот", "Kaput", "Hood", "body", "OEM", 285, 4, ["Haval"], ["H6"], 2020, 2024, 245, 4],
  ["door-handle-exterior-chery", "T15-6105180-DQ", "Ручка двери внешняя", "Tashqi eshik dastasi", "Exterior door handle", "body", "OEM", 24, 35, ["Chery"], [], 2018, 2025, null, 5],

  // INTERIOR
  ["floor-mats-byd-song-plus", "BYD-FM-SP-04", "Коврики салонные (4 шт)", "Salon gilamlari (4 dona)", "Floor mats (4 pcs)", "interior", "OEM", 65, 50, ["BYD"], ["Song Plus", "Yuan Plus"], 2020, 2025, null, 0],
  ["floor-mats-haval-jolion", "HVL-FM-JOL-04", "Коврики салонные (4 шт)", "Salon gilamlari (4 dona)", "Floor mats (4 pcs)", "interior", "OEM", 65, 50, ["Haval"], ["Jolion"], 2021, 2025, null, 1],
  ["floor-mats-chery-tiggo-7", "CHE-FM-T7-04", "Коврики салонные (4 шт)", "Salon gilamlari (4 dona)", "Floor mats (4 pcs)", "interior", "OEM", 65, 50, ["Chery"], ["Tiggo 7", "Tiggo 7 Pro"], 2020, 2025, null, 2],
  ["seat-cover-front-pair", "TM-SC-FRT-LX", "Чехлы на передние сиденья (пара)", "Oldingi o'rindiq chexollari (juft)", "Front seat covers (pair)", "interior", "OEM", 95, 25, [], [], null, null, null, 3],
  ["steering-wheel-cover-leather", "TM-SW-LX-BLK", "Оплётка руля (натуральная кожа)", "Rul qoplamasi (charm)", "Steering wheel cover (leather)", "interior", "OEM", 28, 80, [], [], null, null, null, 4],
  ["sun-visor-byd-song", "BYD-SV-SP-LH", "Солнцезащитный козырёк", "Quyosh kozigi", "Sun visor", "interior", "OEM", 38, 18, ["BYD"], ["Song Plus", "Yuan Plus"], 2020, 2025, null, 5],
  ["dashboard-mat-anti-slip", "TM-DM-ANTI", "Антискользящий коврик на торпедо", "Torpeda uchun siljimaydigan gilam", "Anti-slip dashboard mat", "interior", "OEM", 12, 95, [], [], null, null, null, 6],

  // OTHER
  ["motor-oil-5w30-4l", "TM-OIL-5W30-4L", "Моторное масло 5W-30 (4 л)", "Motor moyi 5W-30 (4 l)", "Motor oil 5W-30 (4 L)", "other", "Mobil", 45, 80, [], [], null, null, null, 0],
  ["motor-oil-0w20-4l", "TM-OIL-0W20-4L", "Моторное масло 0W-20 (4 л)", "Motor moyi 0W-20 (4 l)", "Motor oil 0W-20 (4 L)", "other", "Liqui Moly", 58, 50, [], [], null, null, null, 1],
  ["transmission-fluid-atf-1l", "TM-ATF-1L", "Жидкость АКПП ATF (1 л)", "AKPP suyuqligi ATF (1 l)", "Transmission fluid ATF (1 L)", "other", "Mobil", 18, 70, [], [], null, null, null, 2],
  ["coolant-antifreeze-5l", "TM-CL-5L", "Антифриз концентрат (5 л)", "Antifriz konsentrat (5 l)", "Coolant concentrate (5 L)", "other", "OEM", 22, 60, [], [], null, null, null, 3],
  ["wiper-blade-set-pair", "TM-WB-PR-22", "Щётки стеклоочистителя (пара)", "Yorqinlovchilar (juft)", "Wiper blades (pair)", "other", "Bosch", 22, 90, [], [], null, null, null, 4],
  ["timing-chain-tensioner-byd-song", "13540-2B100", "Натяжитель цепи ГРМ", "GRM zanjiri tarangligi", "Timing chain tensioner", "other", "OEM", 65, 12, ["BYD"], ["Song Plus", "Tang"], 2020, 2025, null, 5],
  ["egr-valve-haval-h6", "EGR-HVL-H6", "Клапан EGR", "EGR klapani", "EGR valve", "other", "Pierburg", 145, 6, ["Haval"], ["H6"], 2020, 2024, null, 6],
  ["catalytic-converter-chery-tiggo-7", "T15-1205510-DQ", "Каталический нейтрализатор", "Katalizator", "Catalytic converter", "other", "OEM", 385, 3, ["Chery"], ["Tiggo 7", "Tiggo 7 Pro"], 2019, 2024, null, 7],
];

async function main() {
  const env = await loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing env keys");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  let inserted = 0;
  let updated = 0;
  const errors = [];

  for (let i = 0; i < PARTS.length; i += 1) {
    const [
      slug, oem, name_ru, name_uz, name_en, category, brand,
      price_usd, stock_qty, fits_brands, fits_models, fits_year_from, fits_year_to,
      wholesale_price_usd, min_order_qty,
    ] = PARTS[i];

    const row = {
      slug,
      oem_number: oem,
      name_ru, name_uz, name_en,
      category,
      brand,
      price_usd,
      stock_qty,
      images: [],
      is_published: true,
      fits_brands,
      fits_models,
      fits_year_from,
      fits_year_to,
      wholesale_price_usd,
      min_order_qty: Math.max(1, min_order_qty || 1),
      order_position: i,
    };

    const { data: existing } = await supabase
      .from("parts")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabase.from("parts").update(row).eq("id", existing.id);
      if (error) errors.push({ slug, message: error.message });
      else updated += 1;
    } else {
      const { error } = await supabase.from("parts").insert(row);
      if (error) errors.push({ slug, message: error.message });
      else inserted += 1;
    }
  }

  console.log(`Parts seed complete: ${inserted} inserted, ${updated} updated, ${errors.length} errors`);
  if (errors.length > 0) {
    console.error(JSON.stringify(errors.slice(0, 10), null, 2));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
