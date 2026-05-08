#!/usr/bin/env node
/**
 * Seed `reviews` (8 entries) + `posts` (3 entries).
 *
 * Reviews omit `car_id` until migration 015 is applied — re-run
 * `scripts/link-reviews-to-cars.mjs` after the migration to link them
 * by car_description match.
 *
 * Usage: node scripts/seed-reviews-and-posts.mjs
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

const REVIEWS = [
  {
    client_name: "Алишер Маматов",
    car_description: "BYD Song Plus DM-i 2024",
    car_slug: "byd-song-plus-dmi-2024",
    rating: 5,
    review_text_ru: "Заказал Song Plus в августе, получил через 32 дня. Машину привезли в идеальном состоянии, документы оформили быстро. Расход реально 4-5 литров — на семейные поездки в Самарканд хватает одного бака туда-обратно.",
    review_text_uz: "Avgust oyida Song Plus buyurtma qildim, 32 kun ichida oldim. Mashina ideal holatda keldi, hujjatlarni tez rasmiylashtirdilar. Sarf haqiqatan 4-5 litr — Samarqandga oilaviy sayohatga bir baqdan yetadi.",
  },
  {
    client_name: "Дмитрий Ким",
    car_description: "Chery Tiggo 8 Pro Max 2024",
    car_slug: "chery-tiggo-8-pro-max-2024",
    rating: 5,
    review_text_ru: "Tiggo 8 Pro Max — отличный семейный автомобиль. 7 мест, AWD, мощный 2.0 турбо. Менеджер помогал на всех этапах: подбор, оплата, растаможка. Рекомендую Tez Motors!",
    review_text_uz: "Tiggo 8 Pro Max — ajoyib oilaviy avto. 7 o'rin, AWD, kuchli 2.0 turbo. Menejer barcha bosqichlarda yordam berdi: tanlash, to'lov, bojxona. Tez Motorsni tavsiya qilaman!",
  },
  {
    client_name: "Сардор Юлдашев",
    car_description: "Haval Jolion 2024",
    car_slug: "haval-jolion-2024",
    rating: 4,
    review_text_ru: "Купил Jolion для жены — она в восторге. Современный салон, экран огромный, ездить комфортно. Один минус — пришлось подождать дольше обещанного на 5 дней. В остальном — без претензий.",
    review_text_uz: "Xotinim uchun Jolion oldim — juda xursand. Zamonaviy salon, katta ekran, qulay haydash. Bir kamchilik — va'da qilingandan 5 kun ko'proq kutishga to'g'ri keldi. Qolgani — gap yo'q.",
  },
  {
    client_name: "Шохрух Каримов",
    car_description: "Geely Coolray 2024",
    car_slug: "geely-coolray-2024",
    rating: 5,
    review_text_ru: "Coolray — сочный городской кроссовер. 1.5T тянет уверенно, разгоняется бодро, в пробках дёшево по топливу. Спасибо за быструю доставку и честную цену без накруток.",
    review_text_uz: "Coolray — yorqin shahar krossover. 1.5T motor kuchli, jadval ravon, probkalarda yoqilg'i tejamkor. Tez yetkazib berish va shaffof narx uchun rahmat.",
  },
  {
    client_name: "Бахтиёр Рашидов",
    car_description: "Tank 300 2024",
    car_slug: "tank-300-2024",
    rating: 5,
    review_text_ru: "Tank 300 — мечта была давно, наконец-то сбылась. На горных дорогах в Чарваке проявил себя на все сто. Интерьер — премиум, без шуток. Доставка заняла 6 недель, как и обещали.",
    review_text_uz: "Tank 300 — uzoq vaqtdan beri orzu qilgan, nihoyat amalga oshdi. Charvoqdagi tog' yo'llarida o'zini yuzdan-yuzga ko'rsatdi. Salon — premium. Yetkazib berish 6 hafta bo'ldi.",
  },
  {
    client_name: "Камила Усманова",
    car_description: "BYD Atto 3 2024",
    car_slug: "byd-atto-3-2024",
    rating: 5,
    review_text_ru: "Перешла с бензиновой на электричку — Atto 3. Заряжаю дома ночью, на работу и обратно хватает с большим запасом. Экономия по топливу окупит машину за 5 лет. Tez Motors объяснили все нюансы зарядки.",
    review_text_uz: "Benzindan elektrga o'tdim — Atto 3. Kechasi uyda zaryadlayman, ishga va qaytishga katta zaxira bilan yetadi. Yoqilg'i tejovi 5 yilda mashinani qoplaydi. Tez Motors zaryadlash haqida tushuntirdi.",
  },
  {
    client_name: "Жасур Махмудов",
    car_description: "Changan UNI-T 2024",
    car_slug: "changan-uni-t-2024",
    rating: 4,
    review_text_ru: "UNI-T — стильно и нестандартно. Дизайн вызывает много вопросов в хорошем смысле. По динамике — для города более чем достаточно. Сборка качественная, никаких косяков не нашёл.",
    review_text_uz: "UNI-T — uslubli va g'ayrioddiy. Dizayn ko'p savollar uyg'otadi yaxshi ma'noda. Dinamika shahar uchun ko'proq yetadi. Yig'ilish sifatli, hech qanday kamchilik topmadim.",
  },
  {
    client_name: "Рустам Эргашев",
    car_description: "Haval H6 HEV 2024",
    car_slug: "haval-h6-hev-2024",
    rating: 5,
    review_text_ru: "H6 HEV покорил расходом 5.6 л в смешанном цикле — для кроссовера это космос. Сидеть удобно даже в долгой поездке. Tez Motors сопроводили от заявки до постановки на учёт.",
    review_text_uz: "H6 HEV aralash siklda 5.6 l sarf — krossover uchun ajoyib. Uzoq sayohatlarda ham qulay. Tez Motors arizadan to ro'yxatga olishga qadar yo'l yo'rig' berdi.",
  },
];

const POSTS = [
  {
    slug: "kak-import-iz-kitaya",
    title_ru: "Как мы импортируем авто из Китая: пошаговый процесс",
    title_uz: "Xitoydan avtomobil importi qanday amalga oshiriladi",
    title_en: "How we import cars from China: step by step",
    body_ru: "## Как устроен импорт\n\nВ Tez Motors мы работаем напрямую с заводами BYD, Chery, Haval, Geely, Changan и другими. Это значит — без посредников, без накруток и без сюрпризов в цене.\n\n### Шаг 1: подбор и согласование\n\nВы оставляете заявку, наш менеджер связывается с вами в течение часа и помогает выбрать комплектацию. На этом этапе мы:\n- Проверяем наличие на заводе\n- Согласуем цвет, опции, доп. оборудование\n- Фиксируем цену в долларах\n- Подписываем договор и принимаем 30% предоплаты\n\n### Шаг 2: производство и оплата\n\nЗавод производит автомобиль 7–14 дней (если в наличии — сразу отгружается). Мы оплачиваем оставшиеся 70% и подтверждаем готовность к отгрузке.\n\n### Шаг 3: логистика\n\nЖелезнодорожная доставка из Сианя/Шанхая в Ташкент занимает 18–25 дней. Мы отслеживаем груз в реальном времени и присылаем вам обновления каждые 3 дня.\n\n### Шаг 4: таможня и постановка на учёт\n\nВ Ташкенте мы оформляем растаможку (пошлина + акциз + НДС), проводим первичный осмотр, моем и передаём вам готовый к эксплуатации автомобиль с полным пакетом документов.\n\n### Сколько это стоит\n\nЦены на сайте включают всё: сам автомобиль, доставку, таможню и оформление. Никаких скрытых платежей. Используйте наш [калькулятор](/calculator) для точного расчёта по конкретной модели.",
    body_uz: "## Import qanday ishlaydi\n\nTez Motors BYD, Chery, Haval, Geely, Changan va boshqa zavodlar bilan to'g'ridan-to'g'ri ishlaydi. Bu — vositachisiz, qo'shimcha ustamasiz va narxda kutilmagan o'zgarishlarsiz degani.\n\n### 1-bosqich: tanlash va kelishish\n\nSiz ariza qoldirasiz, menejerimiz bir soat ichida bog'lanadi va jihozlashni tanlashga yordam beradi. Bu bosqichda:\n- Zavoddagi mavjudlikni tekshiramiz\n- Rang, optsiyalar, qo'shimcha jihozlarni kelishamiz\n- Narxni dollarda qayd qilamiz\n- Shartnoma imzolaymiz va 30% old to'lovni qabul qilamiz\n\n### 2-bosqich: ishlab chiqarish va to'lov\n\nZavod 7–14 kunda mashinani ishlab chiqaradi. Qolgan 70% to'lab, jo'natishga tayyor ekanligini tasdiqlaymiz.\n\n### 3-bosqich: logistika\n\nXitoy temir yo'l orqali Toshkentga yetkazib berish 18–25 kun. Yukni real vaqtda kuzatamiz va har 3 kunda yangilik yuboramiz.\n\n### 4-bosqich: bojxona va ro'yxat\n\nToshkentda bojxona rasmiylashtiramiz, dastlabki ko'zdan kechiradigan, yuvib, to'liq hujjatlar bilan tayyor mashinani sizga topshiramiz.\n\n### Narxi qancha\n\nSaytdagi narxlar hammasini o'z ichiga oladi: avtomobil, yetkazib berish, bojxona va rasmiylashtirish. Yashirin to'lov yo'q. Aniq hisob uchun [kalkulyator](/calculator)dan foydalaning.",
    body_en: "## How import works\n\nAt Tez Motors we work direct with BYD, Chery, Haval, Geely, Changan and other factories. That means no middlemen, no markup, and no price surprises.\n\n### Step 1: sourcing and agreement\n\nYou leave a request and our manager calls within an hour to help pick a trim. At this stage we:\n- Check factory availability\n- Confirm color, options, accessories\n- Lock the USD price\n- Sign the contract and take a 30% deposit\n\n### Step 2: production and payment\n\nThe factory builds your car in 7–14 days. We pay the remaining 70% and confirm readiness to ship.\n\n### Step 3: logistics\n\nRail freight from Xi'an/Shanghai to Tashkent takes 18–25 days. We track the shipment in real-time and update you every 3 days.\n\n### Step 4: customs and registration\n\nIn Tashkent we handle customs clearance (duty + excise + VAT), do an initial inspection, wash, and hand over a turn-key car with full paperwork.\n\n### What it costs\n\nPrices on the site are all-in: car + shipping + customs + paperwork. No hidden fees. Use our [calculator](/calculator) for an exact quote on a specific model.",
    cover_image: null,
    published_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    slug: "byd-song-plus-2024-review",
    title_ru: "BYD Song Plus DM-i 2024: обзор от Tez Motors",
    title_uz: "BYD Song Plus DM-i 2024: Tez Motorsdan sharh",
    title_en: "BYD Song Plus DM-i 2024: a Tez Motors review",
    body_ru: "## Почему именно Song Plus\n\nЗа 9 месяцев мы привезли в Узбекистан более 80 BYD Song Plus DM-i. Это самый популярный плагин-гибридный кроссовер на нашем рынке, и причин этому несколько.\n\n### Расход топлива\n\nДекларируемый расход — 4.4 л/100 км в гибридном режиме. На практике в Ташкенте получается 4.8–5.2 л в смешанном цикле — что для C-класса с 197 л.с. близко к чуду. На электротяге 110 км — для большинства поездок по городу хватает каждый день.\n\n### Простор и комфорт\n\nКолёсная база 2765 мм даёт реально просторный задний ряд: трое взрослых сидят свободно. Багажник 574 л — для семьи из 4 человек на выходные более чем достаточно.\n\n### Электроника\n\nПоворотный экран 15.6\", беспроводной CarPlay, NFC-ключ в смартфоне, голосовой помощник на русском (медленно, но работает). Камеры 360° с приличным разрешением.\n\n### К чему придраться\n\nМягкая подвеска кренится в поворотах — для агрессивной езды не годится. Звукоизоляция в задней части хуже, чем спереди. Зимой при -10°C расход растёт до 6.5 л — это всё ещё хорошо, но не 4.4.\n\n### Стоит ли брать\n\nДа. За эти деньги ($22,500) альтернатив с гибридом, AWD-вариантом и таким уровнем оснащения просто нет. Заказывайте у нас — доставка под ключ за 30–45 дней.",
    body_uz: "## Nega aynan Song Plus\n\n9 oy ichida O'zbekistonga 80 dan ortiq BYD Song Plus DM-i olib keldik. Bu bizning bozorimizdagi eng mashhur plagin-gibrid krossover, sabablari bor.\n\n### Yoqilg'i sarfi\n\nE'lon qilingan sarf — 4.4 l/100 km gibrid rejimda. Toshkentda amalda 4.8–5.2 l. 197 ot kuchli C-klass uchun bu mo''jiza. 110 km elektr quvvatida — kundalik shahar yurishlari uchun yetadi.\n\n### Kenglik va qulaylik\n\n2765 mm baza orqa qatorni keng qiladi: uchta katta yosh erkin o'tiradi. Bagaj 574 l — 4 kishilik oila uchun dam olish kunlariga yetarli.\n\n### Elektronika\n\n15.6\" aylanadigan ekran, simsiz CarPlay, smartfondagi NFC kalit, rus tilidagi ovozli yordamchi (sekin, lekin ishlaydi). 360° kameralar yetarlicha aniqlikda.\n\n### Kamchiliklari\n\nYumshoq osma burilishlarda qiyalanadi — agressiv haydash uchun emas. Orqa qismda tovushni izolyatsiya qilish oldindan yomonroq. Qishda -10°C da sarf 6.5 l ga oshadi.\n\n### Olishga arziydimi\n\nHa. Bu pulga ($22,500) gibrid + AWD + bunday jihozlash bilan muqobil yo'q. Bizdan buyurtma qiling — 30–45 kunda yetkazamiz.",
    body_en: "## Why Song Plus specifically\n\nOver 9 months we've brought 80+ BYD Song Plus DM-i units into Uzbekistan. It's the most popular plug-in hybrid crossover in our market, for good reason.\n\n### Fuel use\n\nClaimed 4.4 L/100 km hybrid. In Tashkent traffic we see 4.8–5.2 L mixed — near-miraculous for a 197-hp C-segment SUV. 110 km of EV-only range covers most daily city use.\n\n### Space and comfort\n\nA 2765 mm wheelbase gives a genuinely roomy second row — three adults fit. The 574 L boot covers a family of four for weekends.\n\n### Tech\n\n15.6\" rotating display, wireless CarPlay, NFC phone key, Russian voice assistant (slow but functional). 360° cameras with decent resolution.\n\n### Quibbles\n\nSoft suspension rolls in corners — not for spirited driving. Rear cabin sound insulation lags the front. At -10 °C in winter consumption climbs to ~6.5 L — still strong, just not 4.4.\n\n### Worth it?\n\nYes. At $22,500 nothing else gives you hybrid + AWD-trim option + this much equipment. Order with us — turn-key delivery in 30–45 days.",
    cover_image: null,
    published_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    slug: "rastamozhka-uzbekistan-2026",
    title_ru: "Растаможка автомобиля в Узбекистане: что важно знать в 2026",
    title_uz: "O'zbekistonda avtomobilni bojxonadan o'tkazish: 2026 yilda nima muhim",
    title_en: "Customs clearance in Uzbekistan: what to know in 2026",
    body_ru: "## Кратко о ставках\n\nС 1 января 2026 года ставки таможенных пошлин на легковые автомобили в Узбекистане выглядят так:\n\n- **Электромобили**: 0% пошлины + 0% акциза + 12% НДС.\n- **Гибриды (HEV/PHEV)**: 5% пошлины + сниженный акциз + 12% НДС.\n- **Бензиновые до 1.6L**: 30% пошлины + акциз 5–15% (зависит от объёма) + 12% НДС.\n- **Бензиновые 1.6–2.0L**: 30% пошлины + акциз 15–25% + 12% НДС.\n- **Бензиновые 2.0L+**: 30% пошлины + акциз 25–40% + 12% НДС.\n\n### Что это значит на практике\n\nЕсли вы покупаете BYD Atto 3 за $25,000 на заводе в Китае, импорт обойдётся в:\n- $25,000 + $1,400 логистика + $0 пошлина + $0 акциз + 12% НДС от ($25,000 + $1,400) = $3,168\n- **Итого**: ~$29,568\n\nДля бензинового кроссовера 2.0L Tank 300 за $30,000:\n- $30,000 + $1,800 логистика + 30% пошлина ($9,000) + 25% акциз ($7,500) + 12% НДС ($5,796)\n- **Итого**: ~$54,096\n\n### Почему через нас выгоднее\n\nКаждая позиция выше — часть нашей цены. Самостоятельный импорт стоит +15–25% сверху из-за ошибок в документах, неоптимальной логистики и потери времени. У нас весь путь автоматизирован: один менеджер, одна цена, одна точка ответственности.\n\n### Калькулятор\n\nИспользуйте [наш онлайн-калькулятор](/calculator) для точного расчёта по конкретной модели.",
    body_uz: "## Stavkalar haqida qisqacha\n\n2026-yil 1-yanvardan O'zbekistonda yengil avtomobillar uchun bojxona stavkalari:\n\n- **Elektromobillar**: 0% boj + 0% aksiz + 12% QQS.\n- **Gibridlar (HEV/PHEV)**: 5% boj + pasaytirilgan aksiz + 12% QQS.\n- **1.6L gacha benzin**: 30% boj + 5–15% aksiz + 12% QQS.\n- **1.6–2.0L benzin**: 30% boj + 15–25% aksiz + 12% QQS.\n- **2.0L dan yuqori benzin**: 30% boj + 25–40% aksiz + 12% QQS.\n\n### Amalda nima degani\n\nXitoyda zavoddan $25,000 BYD Atto 3 sotib olsangiz, import:\n- $25,000 + $1,400 logistika + 0% boj + 0% aksiz + 12% QQS = $3,168\n- **Jami**: ~$29,568\n\n2.0L benzin Tank 300 ($30,000) uchun:\n- $30,000 + $1,800 logistika + 30% boj ($9,000) + 25% aksiz ($7,500) + 12% QQS ($5,796)\n- **Jami**: ~$54,096\n\n### Nima uchun biz orqali foydaliroq\n\nYuqoridagi har bir punkt — bizning narximiz. Mustaqil import +15–25% qimmatroq tushadi. Bizda yo'l avtomatlashtirilgan: bitta menejer, bitta narx.\n\n### Kalkulyator\n\n[Onlayn kalkulyator](/calculator)dan foydalaning.",
    body_en: "## Rates in brief\n\nAs of Jan 1, 2026, customs rates on passenger cars in Uzbekistan:\n\n- **Electric**: 0% duty + 0% excise + 12% VAT.\n- **Hybrid (HEV/PHEV)**: 5% duty + reduced excise + 12% VAT.\n- **Petrol up to 1.6L**: 30% duty + 5–15% excise + 12% VAT.\n- **Petrol 1.6–2.0L**: 30% duty + 15–25% excise + 12% VAT.\n- **Petrol 2.0L+**: 30% duty + 25–40% excise + 12% VAT.\n\n### What it means in practice\n\nA $25,000 BYD Atto 3 from the factory:\n- $25,000 + $1,400 logistics + 0% duty + 0% excise + 12% VAT = $3,168\n- **All-in**: ~$29,568\n\nA 2.0L petrol Tank 300 at $30,000:\n- $30,000 + $1,800 logistics + 30% duty ($9,000) + 25% excise ($7,500) + 12% VAT ($5,796)\n- **All-in**: ~$54,096\n\n### Why importing via us costs less\n\nEach line above is part of our quote. Solo import runs 15–25% more due to paperwork errors, poor logistics, and time lost. With us: one manager, one price, one accountable party.\n\n### Calculator\n\nUse [our online calculator](/calculator) for an exact quote on any model.",
    cover_image: null,
    published_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
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

  // Resolve car_ids by slug — we'll set car_id only if migration 015 has
  // already added the column. Try once with car_id; on failure, retry
  // without it so seed still completes pre-migration.
  const slugs = REVIEWS.map((r) => r.car_slug).filter(Boolean);
  const { data: cars } = await supabase.from("cars").select("id, slug").in("slug", slugs);
  const carIdBySlug = Object.fromEntries((cars || []).map((c) => [c.slug, c.id]));

  let reviewsInserted = 0;
  let reviewErrors = [];
  let migrationApplied = true;

  for (let i = 0; i < REVIEWS.length; i += 1) {
    const r = REVIEWS[i];
    const baseRow = {
      client_name: r.client_name,
      car_description: r.car_description,
      review_text_ru: r.review_text_ru,
      review_text_uz: r.review_text_uz,
      review_text_en: r.review_text_en ?? null,
      rating: r.rating,
      is_published: true,
      order_position: i,
    };
    const row = migrationApplied
      ? { ...baseRow, car_id: carIdBySlug[r.car_slug] ?? null }
      : baseRow;

    const { error } = await supabase.from("reviews").insert(row);
    if (error) {
      if (error.message.includes("car_id")) {
        // Migration 015 not yet applied — retry without car_id and remember.
        migrationApplied = false;
        const { error: e2 } = await supabase.from("reviews").insert(baseRow);
        if (e2) reviewErrors.push({ name: r.client_name, message: e2.message });
        else reviewsInserted += 1;
      } else {
        reviewErrors.push({ name: r.client_name, message: error.message });
      }
    } else {
      reviewsInserted += 1;
    }
  }

  let postsInserted = 0;
  let postErrors = [];

  for (const p of POSTS) {
    const { data: existing } = await supabase
      .from("posts")
      .select("id")
      .eq("slug", p.slug)
      .maybeSingle();

    const row = {
      slug: p.slug,
      title_ru: p.title_ru,
      title_uz: p.title_uz,
      title_en: p.title_en,
      body_ru: p.body_ru,
      body_uz: p.body_uz,
      body_en: p.body_en,
      cover_image: p.cover_image,
      is_published: true,
      published_at: p.published_at,
    };

    if (existing?.id) {
      const { error } = await supabase.from("posts").update(row).eq("id", existing.id);
      if (error) postErrors.push({ slug: p.slug, message: error.message });
      else postsInserted += 1;
    } else {
      const { error } = await supabase.from("posts").insert(row);
      if (error) postErrors.push({ slug: p.slug, message: error.message });
      else postsInserted += 1;
    }
  }

  console.log(`Reviews: ${reviewsInserted} inserted (migration_015_applied=${migrationApplied})`);
  if (reviewErrors.length > 0) console.error("Review errors:", reviewErrors);
  console.log(`Posts: ${postsInserted} written`);
  if (postErrors.length > 0) console.error("Post errors:", postErrors);
  if (reviewErrors.length > 0 || postErrors.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
