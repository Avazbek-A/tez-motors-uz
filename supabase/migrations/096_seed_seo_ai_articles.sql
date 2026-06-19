-- 096_seed_seo_ai_articles.sql
--
-- Seed three high-authority, SEO & AI optimized articles with localized content,
-- detailed comparison tables, and FAQPage JSON-LD compatible metadata.
--

DO $$
DECLARE
  v_author_id UUID;
BEGIN
  -- 1. Resolve the author ID (first available admin/author)
  SELECT id INTO v_author_id FROM public.blog_authors LIMIT 1;
  
  IF v_author_id IS NULL THEN
    -- Fallback to generating a dummy uuid if no authors exist yet
    v_author_id := '00000000-0000-0000-0000-000000000000'::uuid;
  END IF;

  -- 2. Insert Article 1: Customs Clearance Guide
  INSERT INTO public.posts (
    slug,
    title_ru,
    title_uz,
    title_en,
    body_ru,
    body_uz,
    body_en,
    cover_image,
    published_at,
    author_id,
    is_published,
    category,
    tags,
    read_time_minutes,
    meta_title_ru,
    meta_title_uz,
    meta_title_en,
    meta_description_ru,
    meta_description_uz,
    meta_description_en,
    faqs
  ) VALUES (
    'customs-clearance-ev-hybrid-uzbekistan-2026',
    'Растаможка электромобилей и гибридов в Узбекистане 2026: полный гид по пошлинам и оформлению',
    'O''zbekistonda elektromobillar va gibridlarni bojxona rasmiylashtiruvi 2026: bojlar va to''liq qo''llanma',
    'Customs Clearance of EVs and Hybrids in Uzbekistan 2026: Complete Guide to Duties and Registration',
    $$# Растаможка электромобилей и гибридов в Узбекистане 2026: Полный гид

Импорт автомобилей из Китая в Узбекистан переживает настоящий бум, однако правила таможенного оформления вызывают множество вопросов. В этом руководстве мы разберем актуальные тарифы, пошлины и скрытые расходы при растаможке электромобилей и гибридов в 2026 году.

## Сравнение пошлин: Электромобили vs Гибриды vs ДВС

Ключевое различие в растаможке заключается в типе силовой установки. Электромобили по-прежнему пользуются значительными льготами, тогда как гибриды таможатся по другим ставкам.

| Тип двигателя | Таможенная пошлина | Акцизный налог | НДС (НДС) | Утилизационный сбор |
| :--- | :--- | :--- | :--- | :--- |
| **Электромобили (BEV)** | 0% | 0% | 0% | Да (зависит от возраста) |
| **Гибриды (PHEV/HEV)** | 15% | 0% | 12% | Да (зависит от возраста) |
| **Бензин / Дизель (ICE)** | 15% | Зависит от объема | 12% | Да (зависит от объема) |

> [!IMPORTANT]
> Электромобили полностью освобождены от таможенной пошлины и НДС. Однако вам всё равно придется уплатить сбор за таможенное оформление, сертификацию и утилизационный сбор.

## Пошаговый расчет стоимости растаможки электромобиля

Давайте рассчитаем примерную стоимость оформления нового электромобиля стоимостью **$25,000** (FOB Китай):

1. **Таможенная пошлина (0%):** $0
2. **НДС (0%):** $0
3. **Таможенный сбор (сбор за оформление):** Около 0.2% от стоимости декларации (~$50).
4. **Утилизационный сбор (новый авто до 3 лет):** 30 БРВ (Базовая расчетная величина). При БРВ в 375,000 сум это составляет 11,250,000 сум (~$880).
5. **Сертификация и экспертиза:** Около 2,500,000 сум (~$200).

**Итого расходы на оформление:** Около **$1,130** под ключ.

## Особенности растаможки гибридов (PHEV)

Гибридные автомобили (например, популярные BYD Song Plus DM-i или Li L9) имеют как электрический, так и бензиновый двигатель. В Узбекистане они оформляются по правилам классических автомобилей с бензиновым двигателем, но имеют нулевой акциз:
- **Пошлина:** 15% от стоимости инвойса.
- **НДС:** 12% от стоимости (инвойс + пошлина).
- **Утилизационный сбор:** Зависит от объема бензинового двигателя.

Поэтому импорт гибридов обходится существенно дороже, чем чистых электромобилей, но они остаются крайне востребованными из-за независимости от зарядной инфраструктуры на дальних трассах.$$,
    $$# O'zbekistonda elektromobillar va gibridlarni bojxona rasmiylashtiruvi 2026: To'liq qo'llanma

Xitoydan O'zbekistonga avtomobillarni import qilish jadal rivojlanmoqda, ammo bojxona rasmiylashtiruvi qoidalari ko'plab savollarni keltirib chiqaradi. Ushbu qo'llanmada biz 2026 yilda elektromobillar va gibridlar uchun amaldagi tariflar va to'lovlarni batafsil tahlil qilamiz.

## Bojlar solishtiruvi: Elektromobillar va Gibridlar

Bojxona rasmiylashtiruvidagi asosiy farq dvigatel turiga bog'liq. Elektromobillar imtiyozlardan foydalanishda davom etmoqda, gibridlar esa umumiy asoslarda bojga tortiladi.

| Dvigatel turi | Bojxona boji | Aksiz solig'i | QQS (NDS) | Utilizatsiya yig'imi |
| :--- | :--- | :--- | :--- | :--- |
| **Elektromobillar (BEV)** | 0% | 0% | 0% | Ha (yoshiga qarab) |
| **Gibridlar (PHEV/HEV)** | 15% | 0% | 12% | Ha (yoshiga qarab) |
| **Benzin / Dizel (ICE)** | 15% | Hajmiga qarab | 12% | Ha (hajmiga qarab) |

> [!IMPORTANT]
> Elektromobillar bojxona boji va QQSdan to'liq ozod qilingan. Biroq, siz baribir bojxona rasmiylashtiruvi, sertifikatlashtirish va utilizatsiya yig'imini to'lashingiz kerak.

## Elektromobil bojxona to'lovlarini hisoblash namunasi

Xitoyda narxi **$25,000** bo'lgan yangi elektromobil uchun to'lovlarni hisoblaymiz:

1. **Bojxona boji (0%):** $0
2. **QQS (0%):** $0
3. **Bojxona yig'imi:** Deklaratsiya qiymatining taxminan 0.2% (~$50).
4. **Utilizatsiya yig'imi (3 yilgacha bo'lgan yangi avto):** 30 BHM (Baza hisoblash miqdori). 1 BHM 375,000 so'm bo'lganda, bu 11,250,000 so'mni (~$880) tashkil etadi.
5. **Sertifikatlash:** Taxminan 2,500,000 so'm (~$200).

**Jami rasmiylashtirish xarajatlari:** Taxminan **$1,130** atrofida.$$,
    $$# Customs Clearance of EVs and Hybrids in Uzbekistan 2026: Complete Guide

Importing cars from China to Uzbekistan is booming, but customs clearance rules raise many questions. In this guide, we analyze current tariffs, duties, and additional costs for customs clearance of electric vehicles and hybrids in 2026.

## Comparison of Duties: EVs vs Hybrids vs ICE

The key difference in customs clearance lies in the engine type. EVs still enjoy major benefits, while hybrids are cleared under standard tariffs.

| Engine Type | Customs Duty | Excise Tax | VAT | Recycling Fee (Util Sbor) |
| :--- | :--- | :--- | :--- | :--- |
| **Pure EVs (BEV)** | 0% | 0% | 0% | Yes (based on age) |
| **Hybrids (PHEV/HEV)**| 15% | 0% | 12% | Yes (based on age) |
| **Petrol / Diesel** | 15% | Based on volume | 12% | Yes (based on volume) |

> [!IMPORTANT]
> Electric vehicles are completely exempt from customs duty and VAT. However, you still have to pay customs processing fees, certification, and the recycling fee.

## Step-by-Step Customs Calculation for an EV

Let's calculate the approximate clearance cost for a new EV worth **$25,000** (FOB China):

1. **Customs Duty (0%):** $0
2. **VAT (0%):** $0
3. **Customs Processing Fee:** Roughly 0.2% of invoice value (~$50).
4. **Recycling Fee (New vehicle up to 3 years):** 30 BCV (Basic Calculation Value). At 375,000 UZS per BCV, this is 11,250,000 UZS (~$880).
5. **Certification & Testing:** Around 2,500,000 UZS (~$200).

**Total clearance expenses:** Around **$1,130** turn-key.$$,
    'https://images.unsplash.com/photo-1563720223185-11003d516935?q=80&w=1200&auto=format&fit=crop',
    now() - interval '2 hours',
    v_author_id,
    true,
    'guides',
    ARRAY['byd', 'zeekr', 'li', 'xiaomi', 'import'],
    7,
    'Растаможка электромобилей в Узбекистане 2026: Пошлины и Сборы',
    'Elektromobillar bojxona rasmiylashtiruvi 2026: Bojlar va Yig''imlar',
    'Customs Clearance of EVs in Uzbekistan 2026: Duties Guide',
    'Полный разбор правил растаможки электромобилей и гибридов в Узбекистане на 2026 год. Расчет пошлин, НДС и утилизационного сбора под ключ.',
    '2026 yilda O''zbekistonda elektromobillar va gibridlarni bojxona rasmiylashtiruvi qoidalari. Bojlar, QQS va utilizatsiya yig''imini hisoblash.',
    'Complete breakdown of customs clearance rules for EVs and hybrids in Uzbekistan for 2026. Calculate duties, VAT, and recycling fees turn-key.',
    '[
      {
        "question_ru": "Какова пошлина на импорт чистых электромобилей?",
        "question_uz": "Sof elektromobillar uchun import boji qancha?",
        "question_en": "What is the import duty for pure electric vehicles?",
        "answer_ru": "Таможенная пошлина и НДС на чистые электромобили (BEV) составляют 0%. Оплачиваются только сбор за оформление, утилизационный сбор и сертификация.",
        "answer_uz": "Sof elektromobillar (BEV) uchun bojxona boji va QQS 0% ni tashkil qiladi. Faqat bojxona rasmiylashtiruvi, utilizatsiya yig''imi va sertifikatlash uchun to''lov qilinadi.",
        "answer_en": "Customs duty and VAT for pure electric vehicles (BEV) are 0%. Only customs processing, recycling fee, and certification are paid."
      },
      {
        "question_ru": "Нужно ли платить НДС при импорте гибрида?",
        "question_uz": "Gibrid import qilganda QQS to''lash kerakmi?",
        "question_en": "Is VAT required when importing a hybrid car?",
        "answer_ru": "Да, при импорте гибридных автомобилей (PHEV/HEV) уплачивается НДС в размере 12% от стоимости автомобиля плюс импортная пошлина.",
        "answer_uz": "Ha, gibrid avtomobillarni (PHEV/HEV) import qilishda avtomobil qiymati va import bojining 12% miqdorida QQS to''lanadi.",
        "answer_en": "Yes, when importing hybrid vehicles (PHEV/HEV), a VAT of 12% calculated on the vehicle cost plus import duty must be paid."
      }
    ]'::jsonb
  );

  -- 3. Insert Article 2: Top 5 Chinese EVs
  INSERT INTO public.posts (
    slug,
    title_ru,
    title_uz,
    title_en,
    body_ru,
    body_uz,
    body_en,
    cover_image,
    published_at,
    author_id,
    is_published,
    category,
    tags,
    read_time_minutes,
    meta_title_ru,
    meta_title_uz,
    meta_title_en,
    meta_description_ru,
    meta_description_uz,
    meta_description_en,
    faqs
  ) VALUES (
    'top-5-chinese-evs-uzbekistan-2026',
    'Топ-5 китайских электромобилей для покупки в Узбекистане в 2026 году: цены и характеристики',
    '2026 yilda O''zbekistonda sotib olish uchun eng yaxshi 5 ta Xitoy elektromobili: narxlar va xususiyatlar',
    'Top 5 Chinese Electric Vehicles to Buy in Uzbekistan in 2026: Prices and Specifications',
    $$# Топ-5 китайских электромобилей для покупки в Узбекистане в 2026 году

Китайские производители электромобилей продолжают доминировать на рынке Узбекистана. Благодаря высоким технологиям, богатой комплектации и доступным ценам, такие бренды как BYD, Zeekr и Li Auto стали народными марками. Рассмотрим 5 лучших моделей для покупки в 2026 году.

## 1. BYD Song Plus EV / DM-i (Чемпион продаж)
Абсолютный лидер продаж в Ташкенте и регионах. Доступен как в полностью электрической версии (EV), так и в гибридной (DM-i).
- **Плюсы:** Надежная батарея Blade Battery, доступность запчастей, высокая ликвидность на вторичном рынке.
- **Запас хода:** До 605 км (CLTC) для электрической версии.

## 2. Zeekr 001 (Премиальный хэтчбек)
Выбор тех, кто ценит спортивный характер, премиальные материалы отделки и превосходную динамику. Обновленный Zeekr 001 предлагает 800-вольтовую архитектуру для сверхбыстрой зарядки.
- **Плюсы:** Пневматическая подвеска, разгон до 100 км/ч за 3.3 секунды, премиальная аудиосистема Yamaha.
- **Запас хода:** До 750 км.

## 3. Li Auto L9 / L7 (Люксовые семейные кроссоверы)
Последовательные гибриды с бензиновым генератором на борту, которые идеально подходят для дальних поездок между городами Узбекистана (например, Ташкент — Самарканд).
- **Плюсы:** Комфорт уровня первого класса, экраны для задних пассажиров, отсутствие зависимости от зарядных станций на трассе.

## 4. Xiaomi SU7 (Технологический прорыв)
Первый электромобиль от гиганта электроники Xiaomi мгновенно завоевал сердца молодежи благодаря интеграции с экосистемой умного дома и футуристичному дизайну.
- **Запас хода:** До 830 км.

## 5. Geely Monjaro (Сбалансированный кроссовер)
Хотя это классический бензиновый автомобиль или мягкий гибрид, он остается одним из самых надежных и популярных кроссоверов в стране благодаря технологиям Volvo.

## Сравнительная таблица ключевых параметров

| Модель | Тип | Запас хода (CLTC) | Привод | Ориентировочная цена в Ташкенте |
| :--- | :--- | :--- | :--- | :--- |
| **BYD Song Plus EV** | Электро | 605 км | Передний | $28,000 - $32,000 |
| **Zeekr 001** | Электро | 750 км | Полный | $48,000 - $55,000 |
| **Li Auto L7** | Гибрид | 1100 км (общий) | Полный | $45,000 - $52,000 |
| **Xiaomi SU7** | Электро | 830 км | Полный / Задний | $38,000 - $46,000 |
| **Geely Monjaro** | ДВС / Гибрид | — | Полный | $33,000 - $37,000 |

> [!TIP]
> При покупке электромобиля обязательно заказывайте домашнюю зарядную станцию на 7 кВт или 11 кВт. Это позволит заряжать машину за копейки за ночь по льготному домашнему тарифу.$$,
    $$# 2026 yilda O'zbekistonda sotib olish uchun eng yaxshi 5 ta Xitoy elektromobili

Xitoy elektromobillari O'zbekiston bozorida yetakchilik qilishda davom etmoqda. BYD, Zeekr va Li Auto kabi brendlar ilg'or texnologiyalari va hamyonbop narxlari bilan xalqimiz orasida mashhur bo'ldi. Keling, 2026 yildagi eng yaxshi 5 ta modelni ko'rib chiqamiz.

## 1. BYD Song Plus EV / DM-i (Sotuvlar chempioni)
Toshkent va viloyatlarda eng ko'p sotilayotgan model. Ham to'liq elektr (EV), ham gibrid (DM-i) versiyalarda mavjud.
- **Afzalliklari:** Ishonchli Blade Battery, ehtiyot qismlarining ko'pligi, bozorda yuqori likvidlik.
- **Masofa (Range):** Elektr versiyasi uchun 605 kmgacha (CLTC).

## 2. Zeekr 001 (Premium xetchbek)
Sport xarakteri va premium sifatni qadrlaydiganlar uchun ajoyib tanlov. Yangilangan Zeekr 001 juda tez zaryadlash uchun 800 voltli arxitekturani taklif etadi.
- **Afzalliklari:** Pnevmatik podveska, 100 km/s tezlikka 3.3 soniyada erishish.

## 3. Li Auto L9 / L7 (Oilaviy krossover)
Uzoq masofalarga sayohat qilish uchun ideal bo'lgan gibrid yo'ltanlamaslar.
- **Afzalliklari:** Biznes-klass qulayligi, orqa yo'lovchilar uchun monitorlar.

## 4. Xiaomi SU7 (Texnologik yangilik)
Xiaomi smartfon ishlab chiqaruvchisining birinchi elektromobili yoshlar orasida juda ommalashdi.

## 5. Geely Monjaro (Ishonchli tanlov)
Volvo texnologiyalariga asoslangan, mamlakatimizda juda mashhur bo'lgan krossover.

## Taqqoslash jadvali

| Model | Turi | Zaryad bilan masofa | Tortish | Taxminiy narxi (Toshkentda) |
| :--- | :--- | :--- | :--- | :--- |
| **BYD Song Plus EV** | Elektr | 605 km | Old | $28,000 - $32,000 |
| **Zeekr 001** | Elektr | 750 km | To'liq | $48,000 - $55,000 |
| **Li Auto L7** | Gibrid | 1100 km (umumiy) | To'liq | $45,000 - $52,000 |
| **Xiaomi SU7** | Elektr | 830 km | To'liq / Orqa | $38,000 - $46,000 |
| **Geely Monjaro** | Benzin | — | To'liq | $33,000 - $37,000 |$$,
    $$# Top 5 Chinese Electric Vehicles to Buy in Uzbekistan in 2026

Chinese electric vehicle manufacturers continue to dominate the Uzbekistan market. Thanks to cutting-edge technology and attractive pricing, brands like BYD, Zeekr, and Li Auto have become household names. Let''s review the top 5 models to buy in 2026.

## 1. BYD Song Plus EV / DM-i (Best Seller)
The undisputed sales leader in Tashkent. Available as a pure electric (EV) or plug-in hybrid (DM-i).
- **Pros:** Ultra-safe Blade Battery, wide availability of spare parts, high resale value.
- **Range:** Up to 605 km (CLTC).

## 2. Zeekr 001 (Premium Hatchback)
The choice for those who value sport performance and premium cabin materials. The new Zeekr 001 features an 800V platform for ultra-fast charging.
- **Pros:** Air suspension, 0-100 km/h in 3.3s, Yamaha audio.

## 3. Li Auto L9 / L7 (Luxury Family SUVs)
Range-extended hybrids with a generator motor, perfect for long-distance highway trips between Tashkent and Samarkand.
- **Pros:** First-class seating comfort, passenger entertainment screens.

## 4. Xiaomi SU7 (Tech Phenomenon)
Xiaomi''s debut EV instantly captured attention with smart ecosystem integration and sport styling.

## 5. Geely Monjaro (Balanced SUV)
A highly reliable SUV based on Volvo architecture, remaining extremely popular across Uzbekistan.

## Spec Comparison Grid

| Model | Type | Range (CLTC) | Drivetrain | Estimate Price (Tashkent) |
| :--- | :--- | :--- | :--- | :--- |
| **BYD Song Plus EV** | EV | 605 km | FWD | $28,000 - $32,000 |
| **Zeekr 001** | EV | 750 km | AWD | $48,000 - $55,000 |
| **Li Auto L7** | Hybrid | 1100 km (total) | AWD | $45,000 - $52,000 |
| **Xiaomi SU7** | EV | 830 km | AWD / RWD | $38,000 - $46,000 |
| **Geely Monjaro** | ICE | — | AWD | $33,000 - $37,000 |$$,
    'https://images.unsplash.com/photo-1617788138017-80ad40651399?q=80&w=1200&auto=format&fit=crop',
    now() - interval '1 hour',
    v_author_id,
    true,
    'analytics',
    ARRAY['byd', 'zeekr', 'li', 'lixiang', 'xiaomi', 'geely'],
    6,
    'Топ-5 Китайских Электромобилей в Узбекистане 2026: Обзор и Цены',
    'O''zbekistondagi eng yaxshi 5 ta Xitoy elektromobili: Narxlar',
    'Top 5 Chinese Electric Cars in Uzbekistan 2026: Reviews',
    'Подробный обзор лучших китайских электромобилей (BYD, Zeekr, Li Auto, Xiaomi) для дорог Узбекистана в 2026 году. Сравнение цен и технических характеристик.',
    '2026 yilda O''zbekiston yo''llari uchun eng yaxshi Xitoy elektromobillari sharhi. BYD, Zeekr, Li Auto va Xiaomi narxlari hamda texnik xususiyatlari.',
    'Detailed review of the best Chinese electric cars (BYD, Zeekr, Li Auto, Xiaomi) for Uzbekistan in 2026. Compare pricing, ranges, and battery specs.',
    '[
      {
        "question_ru": "Какова реальная дальность хода Zeekr 001 зимой?",
        "question_uz": "Zeekr 001 qishda necha km yuradi?",
        "question_en": "What is the real range of Zeekr 001 in winter?",
        "answer_ru": "Зимой при температуре около 0°C в Ташкенте реальный запас хода Zeekr 001 составляет около 450-500 км в зависимости от использования отопления салона.",
        "answer_uz": "Qishda Toshkent sharoitida (0°C atrofida) Zeekr 001 pechka yoqilgan holda taxminan 450-500 km masofani bosib o''tadi.",
        "answer_en": "In winter conditions in Tashkent (around 0°C), the real range of Zeekr 001 is about 450-500 km, depending on cabin heater usage."
      },
      {
        "question_ru": "Где обслуживать китайские электромобили в Ташкенте?",
        "question_uz": "Toshkentda Xitoy elektromobillariga qayerda xizmat ko''rsatiladi?",
        "question_en": "Where can I service Chinese electric vehicles in Tashkent?",
        "answer_ru": "Tez Motors предоставляет официальное обслуживание и гарантию на все привезенные автомобили в партнерских дилерских сервис-центрах в Ташкенте.",
        "answer_uz": "Tez Motors kompaniyasi Toshkentdagi hamkor servis markazlarida o''zi olib kelgan barcha avtomobillarga kafolatli xizmat ko''rsatishni ta''minlaydi.",
        "answer_en": "Tez Motors provides professional service and warranty coverage for all imported cars at our partner service centers in Tashkent."
      }
    ]'::jsonb
  );

  -- 4. Insert Article 3: Safe Import Process
  INSERT INTO public.posts (
    slug,
    title_ru,
    title_uz,
    title_en,
    body_ru,
    body_uz,
    body_en,
    cover_image,
    published_at,
    author_id,
    is_published,
    category,
    tags,
    read_time_minutes,
    meta_title_ru,
    meta_title_uz,
    meta_title_en,
    meta_description_ru,
    meta_description_uz,
    meta_description_en,
    faqs
  ) VALUES (
    'how-to-import-car-china-uzbekistan-safely',
    'Как безопасно привезти автомобиль из Китая в Узбекистан: пошаговый процесс заказа под ключ',
    'Xitoydan O''zbekistonga avtomobilni xavfsiz olib kelish: bosqichma-bosqich buyurtma berish jarayoni',
    'How to Safely Import a Car from China to Uzbekistan: Step-by-Step Turn-Key Sourcing Process',
    $$# Как безопасно привезти автомобиль из Китая в Узбекистан под ключ

Покупка автомобиля под заказ непосредственно из Китая позволяет сэкономить от 15% до 30% стоимости по сравнению с покупкой на авторынках Ташкента. Однако этот процесс сопряжен с рисками: от недобросовестных поставщиков до повреждений при транспортировке. В этой статье мы расскажем, как работает безопасный импорт через Tez Motors.

## Пошаговый процесс заказа автомобиля из Китая

Наш прозрачный рабочий процесс состоит из пяти ключевых этапов, полностью защищенных договором.

```mermaid
graph TD
  A["1. Подбор и Договор"] --> B["2. Заказ на заводе и Осмотр в Китае"]
  B --> C["3. Транспортировка (Автовоз/ЖД)"]
  C --> D["4. Таможня в Ташкенте"]
  D --> E["5. Выдача клиенту"]
```

### Этап 1: Подбор конфигурации и заключение договора
Вы выбираете модель, цвет кузова, салона и дополнительные опции. Мы заключаем официальный юридический договор в нашем офисе в Ташкенте. В договоре четко прописывается окончательная цена в сумах или долларах США, сроки доставки и техническое состояние автомобиля.

### Этап 2: Выкуп автомобиля и проверка в Китае
Мы выкупаем машину напрямую у завода-производителя или крупных дилеров. Перед отправкой наши инспекторы в Хоргосе или Урумчи проводят тщательный осмотр автомобиля: проверяют лакокрасочное покрытие толщиномером, делают подробный фото- и видеоотчет для клиента.

### Этап 3: Страхование и транспортировка
Автомобиль заезжает на автовоз или в железнодорожный контейнер. На все время транспортировки оформляется полная страховка. Любые повреждения в пути (например, сколы от камней) покрываются страховой компанией.

### Этап 4: Таможенное оформление и сертификация
По прибытии автомобиля в Ташкент (на таможенный пост «Сергели» или «Арк-Булак») наши декларанты берут на себя весь процесс оформления документов, уплату утилизационного сбора и получение сертификата соответствия.

### Этап 5: Подготовка и выдача
Мы проводим предпродажную подготовку: мойку, химчистку, русификацию мультимедиа системы (при необходимости) и выдаем автомобиль с полным пакетом документов для регистрации в СБДД (бывш. ГАИ).

## Гарантии безопасности сделки

- **Юридический договор:** Защищает ваши средства от непредвиденных платежей.
- **Полное страхование пути:** Доставка застрахована от любых форс-мажоров.
- **Контроль качества:** Вы видите детальное состояние авто на фото перед отправкой из Китая.
- **Никаких скрытых комиссий:** Все затраты на таможню, утильсбор и транспортировку включены в цену договора.$$,
    $$# Xitoydan O'zbekistonga avtomobilni xavfsiz olib kelish: Bosqichma-bosqich yo'riqnoma

Xitoydan to'g'ridan-to'g'ri buyurtma asosida avtomobil sotib olish Toshkentdagi avtobozorlarga qaraganda 15% dan 30% gacha tejash imkonini beradi. Biroq, bu jarayon ma'lum xavflarga ega. Ushbu maqolada biz Tez Motors orqali import qilish jarayoni qanday ishlashini tushuntiramiz.

## Xitoydan avtomobil buyurtma qilish bosqichlari

Bizning shaffof ish jarayonimiz shartnoma bilan to'liq himoyalangan beshta asosiy bosqichdan iborat.

### 1-bosqich: Tanlash va shartnoma tuzish
Siz model, rang va opsiyalarni tanlaysiz. Biz Toshkentdagi ofisimizda rasmiy shartnoma tuzamiz. Shartnomada yakuniy narx, yetkazib berish muddatlari va kafolatlar aniq ko'rsatiladi.

### 2-bosqich: Avtomobilni Xitoyda tekshirish
Avtomobil ishlab chiqaruvchi zavod yoki yirik dilerdan sotib olinadi. Jo'natishdan oldin bizning inspektorlarimiz Xitoyda avtomobilni to'liq tekshirib, foto va videotahlilni mijozga yuborishadi.

### 3-bosqich: Sug'urta va tashish
Avtomobil avtovoz yoki temir yo'l konteyneriga yuklanadi va to'liq sug'urtalanadi.

### 4-bosqich: Bojxona rasmiylashtiruvi va sertifikatlash
Avtomobil Toshkentga kelgach, mutaxassislarimiz barcha hujjatlarni rasmiylashtirish, utilizatsiya yig'imini to'lash va sertifikat olish jarayonini o'z zimmalariga oladilar.

### 5-bosqich: Yetkazib berish
Avtomobil tozalangan, tayyorlangan holda barcha hujjatlar bilan mijozga topshiriladi.

## Xavfsizlik kafolatlari

- **Yuridik shartnoma:** Mablag'laringizni qo'shimcha xarajatlardan himoya qiladi.
- **To'liq sug'urta:** Yo'ldagi har qanday zararlar sug'urta kompaniyasi tomonidan qoplanadi.
- **Sifat nazorati:** Jo'natishdan oldin avtomobil holatini ko'rasiz.$$,
    $$# How to Safely Import a Car from China to Uzbekistan: Turn-Key Sourcing

Ordering a car directly from China saves 15% to 30% compared to buying from local dealerships in Tashkent. However, importing involves risks: unreliable suppliers or transit damage. Here is how Tez Motors guarantees a safe and transparent turn-key import process.

## Step-by-Step Ordering Process

Our turn-key pipeline consists of 5 clear stages, fully secured by legal contract.

### Stage 1: Vehicle Configuration & Contract
You select the exact model, colors, and interior specs. We sign a legal contract at our Tashkent office specifying the final price, delivery terms, and condition guarantees.

### Stage 2: Sourcing & Pre-Shipment Inspection
We purchase the vehicle directly from factories or authorized dealers. Before leaving China, our inspectors conduct a rigorous physical inspection, sending detailed paint-gauge tests, photos, and videos to you.

### Stage 3: Insured Logistics
The car is loaded onto an auto-transporter or rail container. The entire journey is fully covered by transit insurance, protecting you from transport damage.

### Stage 4: Customs Brokerage & Certification
Upon arrival in Tashkent, our in-house customs brokers manage document clearance, pay recycling fees, and secure state safety certificates.

### Stage 5: Final Delivery
We perform detailed pre-delivery detailing and hand over the vehicle with registration-ready documents.

## Safety Guarantees

- **Legally Binding Contract:** Guarantees no hidden markups or price increases.
- **Full Transit Insurance:** Zero financial risk during international shipping.
- **Pre-Shipment Inspection:** Verify vehicle status before it crosses the border.
- **Turn-Key Convenience:** All logistics, customs, and certificates are handled for you.$$,
    'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?q=80&w=1200&auto=format&fit=crop',
    now(),
    v_author_id,
    true,
    'guides',
    ARRAY['byd', 'chery', 'haval', 'geely', 'changan', 'tank'],
    5,
    'Как Безопасно Привезти Автомобиль из Китая в Узбекистан под Ключ',
    'Xitoydan O''zbekistonga mashina olib kelish: Xavfsiz buyurtma qilish',
    'How to Import a Car from China to Uzbekistan Safely: Turn-Key',
    'Пошаговый гид по безопасному заказу электромобилей и гибридов из Китая в Ташкент. Договорные гарантии, страхование транспортировки и этапы растаможки.',
    'Xitoydan Toshkentga elektromobil va gibridlarni xavfsiz olib kelish bo''yicha qo''llanma. Shartnoma kafolatlari, sug''urtalash va bojxona bosqichlari.',
    'Step-by-step guide to safely ordering EVs and hybrids from China to Tashkent. Contract guarantees, shipping insurance, and customs clearance stages.',
    '[
      {
        "question_ru": "Каковы сроки доставки автомобиля из Китая в Ташкент?",
        "question_uz": "Xitoydan Toshkentgacha yetkazib berish muddati qancha?",
        "question_en": "What is the delivery time from China to Tashkent?",
        "answer_ru": "В среднем транспортировка автовозом занимает от 15 до 25 дней с момента отгрузки со склада в Китае.",
        "answer_uz": "O''rtacha hisobda, Xitoydagi ombordan yuklangan kundan boshlab avtovozda yetkazib berish 15 kundan 25 kungacha davom etadi.",
        "answer_en": "On average, auto-transporter shipping takes 15 to 25 days from the date of dispatch from our warehouse in China."
      },
      {
        "question_ru": "Застрахован ли автомобиль во время перевозки?",
        "question_uz": "Tashish paytida avtomobil sug''urtalanganmi?",
        "question_en": "Is the vehicle insured during transit?",
        "answer_ru": "Да, абсолютно все автомобили застрахованы на 100% их инвойсной стоимости от любых повреждений на протяжении всего пути транспортировки.",
        "answer_uz": "Ha, mutlaqo barcha avtomobillar tashish davomida yuzaga kelishi mumkin bo''lgan har qanday zararlardan 100% qiymati bo''yicha sug''urtalangan bo''ladi.",
        "answer_en": "Yes, absolutely all vehicles are 100% insured for their full invoice value against any transport damage throughout the entire journey."
      }
    ]'::jsonb
  );

END $$;
