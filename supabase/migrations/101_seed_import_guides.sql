-- 101_seed_import_guides.sql
--
-- SEO content cluster (P3): two evergreen pillar guides that interlink with the
-- /calculator растаможка hub, the /import/* country hubs, and the catalog. Rates
-- are the verified 2026 facts (BRV 412k; EV duty 0%; util 120/210 BRV; VAT 12%;
-- ICE 7yr/Euro-5/no-RHD). category 'guides'; published. faqs use the localized
-- question_/answer_ shape the blog renderer expects (see 097_seed_more_seo_articles).

DO $mig$
DECLARE
  v_author_id UUID;
BEGIN
  SELECT id INTO v_author_id FROM public.blog_authors LIMIT 1;
  IF v_author_id IS NULL THEN
    v_author_id := '00000000-0000-0000-0000-000000000000'::uuid;
  END IF;

  -- 1. How to import a car from China (process pillar)
  INSERT INTO public.posts (
    slug, title_ru, title_uz, title_en, body_ru, body_uz, body_en,
    cover_image, published_at, author_id, is_published, category, tags, read_time_minutes,
    meta_title_ru, meta_title_uz, meta_title_en,
    meta_description_ru, meta_description_uz, meta_description_en, faqs
  ) VALUES (
    'kak-prignat-avto-iz-kitaya-uzbekistan-2026',
    'Как пригнать авто из Китая в Узбекистан в 2026 году: полный гайд',
    'Xitoydan O''zbekistonga avtomobil olib kelish 2026: to''liq qo''llanma',
    'How to import a car from China to Uzbekistan in 2026: full guide',
    $$# Как пригнать авто из Китая в Узбекистан в 2026 году

Импорт автомобиля из Китая — это понятный процесс из нескольких этапов. Ниже пошаговое руководство: от выбора модели до получения ключей, с реальными сроками и расходами.

## Этапы импорта

1. **Подбор.** Выберите модель в [каталоге](/ru/catalog) или пришлите желаемую комплектацию — мы подберём варианты по бюджету.
2. **Проверка.** Проверяем историю, состояние и комплектацию до оплаты.
3. **Оплата и договор.** Прозрачный договор, фиксируем цену и сроки.
4. **Доставка.** Организуем логистику до Узбекистана.
5. **Растаможка.** Оформляем пошлину, НДС и утилизационный сбор.
6. **Передача.** Помогаем с постановкой на учёт и отдаём ключи.

## Сколько это стоит

Итоговая цена «под ключ» = стоимость авто + доставка + растаможка. Растаможка состоит из таможенной пошлины, НДС 12% и утилизационного сбора. Для **электромобилей пошлина 0%**. Точную сумму посчитает [калькулятор растаможки](/ru/calculator).

## Какие авто можно ввозить

- **Бензин/дизель:** не старше 7 лет, эко-класс не ниже Евро-5, без правого руля.
- **Электромобили:** без ограничений по возрасту и эко-классу.

## Сроки

Доставка из Китая обычно занимает **3–6 недель** с учётом логистики и оформления.

## Популярные модели

BYD, Zeekr, Li Auto, Changan, Haval, Chery — подробности на странице [авто из Китая](/ru/import/china).

Готовы помочь с импортом под ключ — [оставьте заявку](/ru/order).$$,
    $$# Xitoydan O''zbekistonga avtomobil olib kelish (2026)

Xitoydan avtomobil import qilish — bir necha bosqichdan iborat tushunarli jarayon. Quyida model tanlashdan kalit olishgacha bosqichma-bosqich qo''llanma.

## Import bosqichlari

1. **Tanlash.** [Katalog](/uz/catalog)dan model tanlang yoki kerakli komplektatsiyani yuboring.
2. **Tekshiruv.** To''lovdan oldin tarix va holatni tekshiramiz.
3. **To''lov va shartnoma.** Shaffof shartnoma, narx va muddat belgilanadi.
4. **Yetkazib berish.** O''zbekistongacha logistikani tashkil qilamiz.
5. **Rastamojka.** Boj, QQS va utilizatsiya yig''imini rasmiylashtiramiz.
6. **Topshirish.** Ro''yxatdan o''tkazishda yordam beramiz.

## Narx qancha

Yakuniy "под ключ" narx = avto narxi + yetkazib berish + rastamojka. **Elektromobil uchun boj 0%**. Aniq summani [rastamojka kalkulyatori](/uz/calculator) hisoblaydi.

## Qanday avtolarni olib kirish mumkin

- **Benzin/dizel:** 7 yildan oshmagan, Yevro-5 dan past emas, o''ng rulsiz.
- **Elektromobil:** yosh va eko-sinf bo''yicha cheklovsiz.

## Muddat

Xitoydan yetkazib berish odatda **3–6 hafta**.

## Mashhur modellar

BYD, Zeekr, Li Auto, Changan, Haval — batafsil [Xitoydan avto](/uz/import/china) sahifasida. [Ariza qoldiring](/uz/order).$$,
    $$# How to import a car from China to Uzbekistan (2026)

Importing a car from China is a clear, multi-step process. Below is a step-by-step guide from picking a model to getting the keys.

## The import steps

1. **Sourcing.** Pick a model in the [catalog](/en/catalog) or send us the trim you want.
2. **Inspection.** We verify history and condition before payment.
3. **Payment & contract.** Transparent contract, fixed price and timeline.
4. **Shipping.** We arrange logistics to Uzbekistan.
5. **Customs.** We handle duty, VAT and the recycling fee.
6. **Handover.** We help with registration and hand you the keys.

## How much it costs

The turn-key price = car price + shipping + customs. **EVs pay 0% duty.** The [customs calculator](/en/calculator) gives the exact figure.

## Which cars can be imported

- **Petrol/diesel:** no older than 7 years, at least Euro-5, no right-hand drive.
- **EVs:** no age or emission limit.

## Timeline

Shipping from China usually takes **3–6 weeks**.

## Popular models

BYD, Zeekr, Li Auto, Changan, Haval — see the [cars from China](/en/import/china) page. [Send a request](/en/order).$$,
    '/images/ev_logistics_truck.png',
    now() - interval '2 hours',
    v_author_id,
    true,
    'guides',
    ARRAY['import', 'china', 'guide', 'customs'],
    7,
    'Как пригнать авто из Китая в Узбекистан 2026 — пошаговый гайд',
    'Xitoydan O''zbekistonga avto olib kelish 2026 — qo''llanma',
    'How to import a car from China to Uzbekistan 2026 — guide',
    'Полный гайд по импорту авто из Китая в Узбекистан: этапы, сроки, стоимость под ключ, растаможка и требования к ввозу. Электромобили — 0% пошлины.',
    'Xitoydan O''zbekistonga avto import qilish: bosqichlar, muddat, под ключ narx, rastamojka va talablar. Elektromobil — 0% boj.',
    'Full guide to importing a car from China to Uzbekistan: steps, timeline, turn-key cost, customs and import rules. EVs pay 0% duty.',
    '[
      {
        "question_ru": "Сколько стоит пригнать авто из Китая под ключ?",
        "question_uz": "Xitoydan под ключ avto olib kelish qancha turadi?",
        "question_en": "How much does it cost to import a car from China turn-key?",
        "answer_ru": "Цена под ключ = стоимость авто + доставка + растаможка (пошлина, НДС 12%, утильсбор). Для электромобилей пошлина 0%. Точную сумму посчитает калькулятор растаможки.",
        "answer_uz": "Под ключ narx = avto narxi + yetkazib berish + rastamojka (boj, 12% QQS, utilizatsiya). Elektromobil uchun boj 0%. Aniq summani kalkulyator hisoblaydi.",
        "answer_en": "Turn-key price = car + shipping + customs (duty, 12% VAT, recycling fee). EVs pay 0% duty. The customs calculator gives the exact figure."
      },
      {
        "question_ru": "Сколько идёт авто из Китая?",
        "question_uz": "Xitoydan avto qancha vaqtda keladi?",
        "question_en": "How long does a car from China take?",
        "answer_ru": "Обычно 3–6 недель с учётом логистики и таможенного оформления.",
        "answer_uz": "Odatda 3–6 hafta — logistika va bojxona rasmiylashtiruvi bilan.",
        "answer_en": "Usually 3–6 weeks including logistics and customs clearance."
      }
    ]'::jsonb
  )
  ON CONFLICT (slug) DO NOTHING;

  -- 2. EV customs deep-dive (0% duty)
  INSERT INTO public.posts (
    slug, title_ru, title_uz, title_en, body_ru, body_uz, body_en,
    cover_image, published_at, author_id, is_published, category, tags, read_time_minutes,
    meta_title_ru, meta_title_uz, meta_title_en,
    meta_description_ru, meta_description_uz, meta_description_en, faqs
  ) VALUES (
    'rastamozhka-elektromobilya-uzbekistan-2026',
    'Растаможка электромобиля в Узбекистане в 2026 году: 0% пошлины',
    'O''zbekistonda elektromobil rastamojkasi 2026: 0% boj',
    'EV customs clearance in Uzbekistan in 2026: 0% duty',
    $$# Растаможка электромобиля в Узбекистане в 2026 году

Электромобили — самый выгодный класс для импорта в Узбекистан благодаря налоговым льготам. Разберём, из чего складывается стоимость.

## Из чего складывается растаможка электромобиля

- **Таможенная пошлина — 0%** (для электромобилей).
- **Акциз — 0%.**
- **НДС — 12%** от (таможенная стоимость + доставка).
- **Утилизационный сбор:** 120 БХМ для авто до 3 лет, 210 БХМ для авто старше 3 лет (с 1 мая 2025 года).
- **Таможенный сбор за оформление — 2,5 БХМ.**

БХМ (базовая расчётная величина) — 412 000 сум.

## Почему электромобиль выгоднее ДВС

В отличие от бензиновых авто, электромобиль не платит пошлину (0% против 15–40%) и акциз, а также не подпадает под ограничение по возрасту в 7 лет и требование Евро-5.

## Рассчитать точно

Стоимость зависит от цены авто и возраста. Посчитайте свой вариант в [калькуляторе растаможки](/ru/calculator) и посмотрите [электромобили в наличии](/ru/catalog/type/electric).

Поможем с импортом под ключ — [оставьте заявку](/ru/order).$$,
    $$# O''zbekistonda elektromobil rastamojkasi (2026)

Elektromobillar — soliq imtiyozlari tufayli O''zbekistonga import uchun eng foydali sinf.

## Elektromobil rastamojkasi nimalardan iborat

- **Bojxona boji — 0%** (elektromobil uchun).
- **Aktsiz — 0%.**
- **QQS — 12%** (bojxona qiymati + yetkazib berish).
- **Utilizatsiya yig''imi:** 3 yilgacha 120 BHM, 3 yildan ortiq 210 BHM (2025-yil 1-maydan).
- **Rasmiylashtirish yig''imi — 2,5 BHM.**

BHM (bazaviy hisoblash miqdori) — 412 000 so''m.

## Nega elektromobil ICE dan foydaliroq

Benzin avtolardan farqli, elektromobil boj (0% va 15–40%) va aktsiz to''lamaydi, shuningdek 7 yil va Yevro-5 cheklovlariga tushmaydi.

## Aniq hisoblang

[Rastamojka kalkulyatori](/uz/calculator)da hisoblang va [mavjud elektromobillar](/uz/catalog/type/electric)ni ko''ring. [Ariza qoldiring](/uz/order).$$,
    $$# EV customs clearance in Uzbekistan (2026)

Electric vehicles are the most cost-effective class to import into Uzbekistan thanks to tax breaks.

## What EV customs is made of

- **Customs duty — 0%** (for EVs).
- **Excise — 0%.**
- **VAT — 12%** of (customs value + shipping).
- **Recycling fee:** 120 BRV under 3 years, 210 BRV over 3 years (since May 1, 2025).
- **Clearance fee — 2.5 BRV.**

BRV (base calculation value) — 412,000 UZS.

## Why an EV beats an ICE car

Unlike petrol cars, an EV pays no duty (0% vs 15–40%) and no excise, and is exempt from the 7-year age and Euro-5 rules.

## Calculate it precisely

Cost depends on the car price and age. Run yours in the [customs calculator](/en/calculator) and browse [EVs in stock](/en/catalog/type/electric). [Send a request](/en/order).$$,
    '/images/customs_clearance_ev.png',
    now() - interval '1 hour',
    v_author_id,
    true,
    'guides',
    ARRAY['ev', 'customs', 'electric', 'guide'],
    6,
    'Растаможка электромобиля в Узбекистане 2026 — 0% пошлины, расчёт',
    'Elektromobil rastamojkasi O''zbekiston 2026 — 0% boj',
    'EV customs clearance Uzbekistan 2026 — 0% duty, calculator',
    'Растаможка электромобиля в Узбекистане: 0% пошлины и акциза, НДС 12%, утильсбор 120/210 БХМ. Полный расчёт и сравнение с ДВС.',
    'O''zbekistonda elektromobil rastamojkasi: 0% boj va aktsiz, 12% QQS, utilizatsiya 120/210 BHM. To''liq hisob.',
    'EV customs in Uzbekistan: 0% duty and excise, 12% VAT, 120/210 BRV recycling fee. Full breakdown vs ICE cars.',
    '[
      {
        "question_ru": "Какая пошлина на электромобиль в Узбекистане?",
        "question_uz": "O''zbekistonda elektromobilga qanday boj?",
        "question_en": "What is the customs duty on an EV in Uzbekistan?",
        "answer_ru": "Для электромобилей таможенная пошлина и акциз составляют 0%. Платится только НДС 12% и утилизационный сбор (120 БХМ до 3 лет, 210 БХМ старше 3 лет).",
        "answer_uz": "Elektromobil uchun bojxona boji va aktsiz 0%. Faqat 12% QQS va utilizatsiya yig''imi (3 yilgacha 120 BHM, 3 yildan ortiq 210 BHM) to''lanadi.",
        "answer_en": "For EVs, customs duty and excise are 0%. You pay only 12% VAT and the recycling fee (120 BRV under 3 years, 210 BRV over 3 years)."
      },
      {
        "question_ru": "Есть ли ограничение по возрасту для электромобилей?",
        "question_uz": "Elektromobillar uchun yosh cheklovi bormi?",
        "question_en": "Is there an age limit for electric vehicles?",
        "answer_ru": "Нет. Ограничение 7 лет и требование Евро-5 действуют только для авто с ДВС; на электромобили они не распространяются.",
        "answer_uz": "Yo''q. 7 yil va Yevro-5 cheklovlari faqat ICE avtolar uchun; elektromobillarga tatbiq etilmaydi.",
        "answer_en": "No. The 7-year limit and Euro-5 rule apply only to ICE cars; EVs are exempt."
      }
    ]'::jsonb
  )
  ON CONFLICT (slug) DO NOTHING;

END $mig$;
