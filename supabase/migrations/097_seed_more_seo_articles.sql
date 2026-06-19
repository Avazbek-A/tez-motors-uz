-- 097_seed_more_seo_articles.sql
--
-- Seed two more high-authority articles with comparison tables, pros/cons,
-- and SEO schemas.
--

DO $mig$
DECLARE
  v_author_id UUID;
BEGIN
  -- Resolve the author ID (first available admin/author)
  SELECT id INTO v_author_id FROM public.blog_authors LIMIT 1;
  
  IF v_author_id IS NULL THEN
    v_author_id := '00000000-0000-0000-0000-000000000000'::uuid;
  END IF;

  -- 1. Insert Article 4: BYD Song Plus vs BYD Song L Comparison
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
    'byd-song-plus-ev-vs-song-l-comparison-uzbekistan',
    'BYD Song Plus vs BYD Song L: Какой кроссовер выбрать в Узбекистане?',
    'BYD Song Plus va BYD Song L: O''zbekistonda qaysi krossoverni tanlash kerak?',
    'BYD Song Plus vs BYD Song L: Which SUV to Choose in Uzbekistan?',
    $$# BYD Song Plus vs BYD Song L: Какой кроссовер выбрать в Узбекистане?

Бренд BYD стал абсолютным лидером на рынке электромобилей Узбекистана. Но если раньше выбор в среднем классе ограничивался народным кроссовером BYD Song Plus, то теперь появился премиальный спортивный фастбэк BYD Song L. Какая машина лучше подойдет для ваших задач? Разберем подробно.

## Позиционирование моделей
- **BYD Song Plus EV:** Классический семейный среднеразмерный кроссовер. Ориентирован на комфорт, практичность и вместимость. Отличный выбор в качестве единственного автомобиля в семье.
- **BYD Song L:** Спортивный кросс-купе (фастбэк). Отличается низким динамичным силуэтом, безрамочными дверями, выдвижным спойлером и более премиальными материалами отделки. Создан для любителей дизайна и драйва.

## Сравнение технических характеристик

| Параметр | BYD Song Plus EV (Flagship) | BYD Song L (Excellence) |
| :--- | :--- | :--- |
| **Габариты (Д x Ш x В)** | 4785 x 1890 x 1660 мм | 4840 x 1950 x 1560 мм |
| **Колесная база** | 2765 мм | 2930 мм (салон просторнее) |
| **Подвеска** | Макферсон / Многорычажная | Двухрычажная / Многорычажная (Disus-C) |
| **Двери** | Обычные | Безрамочные |
| **Разгон до 100 км/ч** | 8.5 сек | 6.9 сек (задний привод) / 4.3 сек (полный) |
| **Емкость батареи** | 87 кВтч | 87 кВтч |
| **Запас хода (CLTC)** | 605 км | 662 км |

## Плюсы и минусы моделей

### BYD Song Plus EV
- **Плюсы:** Более высокая посадка и дорожный просвет (удобнее на грунтовках), мягкая комфортная подвеска, более доступная цена (разница около $6,000 - $8,000).
- **Минусы:** Простой дизайн салона, крены в поворотах на высокой скорости.

### BYD Song L
- **Плюсы:** Роскошный салон из алькантары, продвинутая интеллектуальная подвеска Disus-C (отлично держит дорогу), безрамочные стекла, динамичный внешний вид, простор на заднем ряду за счет большой колесной базы.
- **Минусы:** Более низкий дорожный просвет (клиренс), высокая цена, жестче на ямах.$$,
    $$# BYD Song Plus va BYD Song L: O'zbekistonda qaysi birini tanlash kerak?

BYD brendi O'zbekiston elektromobillar bozorida mutlaq yetakchiga aylandi. Avval tanlov asosan oilaviy BYD Song Plus krossoveri bilan cheklangan bo'lsa, endilikda premium sport fastboki BYD Song L savdoga chiqdi. Qaysi avtomobil sizga ko'proq mos keladi? Keling, solishtiramiz.

## Modellar joylashuvi
- **BYD Song Plus EV:** Klassik oilaviy krossover. Qulaylik, amaliylik va kenglikka yo'naltirilgan.
- **BYD Song L:** Sport kross-kupe (fastbek). Past va dinamik profili, romsiz eshiklari, chiquvchi spoyleri va premium salon materiallari bilan ajralib turadi.

## Texnik xususiyatlar solishtiruvi

| Parametr | BYD Song Plus EV (Flagship) | BYD Song L (Excellence) |
| :--- | :--- | :--- |
| **O'lchamlari** | 4785 x 1890 x 1660 mm | 4840 x 1950 x 1560 mm |
| **G'ildirak bazasi** | 2765 mm | 2930 mm (kengroq) |
| **Eshiklar** | Oddiy | Romsiz |
| **Tezlanish (0-100 km/s)**| 8.5 soniya | 6.9 soniya (orqa) / 4.3 soniya (to'liq) |
| **Batareya sig'imi** | 87 kVt/soat | 87 kVt/soat |
| **Yurish masofasi** | 605 km | 662 km |$$,
    $$# BYD Song Plus vs BYD Song L: Which SUV to Choose in Uzbekistan?

BYD has become the dominant brand in the Uzbekistan EV market. While the choice was previously limited to the family-oriented BYD Song Plus, the premium sporty BYD Song L fastback has now entered the market. Which one suits your needs better? Let''s review.

## Model Positioning
- **BYD Song Plus EV:** Classic mid-size family SUV. Focused on comfort, practicality, and cabin height.
- **BYD Song L:** Sporty cross-coupe (fastback). Features frameless doors, an active electric spoiler, and a premium cabin.

## Specification Comparison

| Feature | BYD Song Plus EV (Flagship) | BYD Song L (Excellence) |
| :--- | :--- | :--- |
| **Dimensions (L x W x H)**| 4785 x 1890 x 1660 mm | 4840 x 1950 x 1560 mm |
| **Wheelbase** | 2765 mm | 2930 mm (larger cabin) |
| **Doors** | Standard | Frameless |
| **0-100 km/h Acceleration**| 8.5s | 6.9s (RWD) / 4.3s (AWD) |
| **Battery Capacity** | 87 kWh | 87 kWh |
| **Range (CLTC)** | 605 km | 662 km |$$,
    '/images/byd_song_comparison.png',
    now() - interval '30 minutes',
    v_author_id,
    true,
    'analytics',
    ARRAY['byd', 'comparison'],
    6,
    'Сравнение BYD Song Plus и BYD Song L в Узбекистане',
    'BYD Song Plus vs BYD Song L krossoverlar taqqoslash',
    'BYD Song Plus vs BYD Song L: Detailed Comparison',
    'Какая модель BYD лучше подходит для Узбекистана: практичный семейный кроссовер Song Plus или спортивный премиальный Song L? Сравнение цен, клиренса и характеристик.',
    'O''zbekiston yo''llari uchun qaysi BYD modeli mos keladi: oilaviy Song Plus yoki premium Song L? Narxlar, klirens va xususiyatlar solishtiruvi.',
    'Which BYD SUV is better for Uzbekistan: the practical family Song Plus or the premium sporty Song L? Detailed comparison of prices, range, and ride quality.',
    '[
      {
        "question_ru": "Каков дорожный просвет (клиренс) у BYD Song L?",
        "question_uz": "BYD Song L ning klirensi (yer bilan oraliq) qancha?",
        "question_en": "What is the ground clearance of BYD Song L?",
        "answer_ru": "Дорожный просвет BYD Song L составляет около 150 мм, что ниже, чем у BYD Song Plus (180 мм). Машина ориентирована на ровные городские и шоссейные дороги.",
        "answer_uz": "BYD Song L ning klirensi taxminan 150 mm ni tashkil qiladi, bu BYD Song Plus (180 mm) ga qaraganda pastroq. Mashina tekis shahar va magistral yo''llarga mo''ljallangan.",
        "answer_en": "The ground clearance of BYD Song L is around 150 mm, which is lower than the BYD Song Plus (180 mm). It is designed primarily for flat city streets and highways."
      },
      {
        "question_ru": "Какова разница в цене между Song Plus и Song L?",
        "question_uz": "Song Plus va Song L o''rtasidagi narx farqi qancha?",
        "question_en": "What is the price difference between Song Plus and Song L?",
        "answer_ru": "В зависимости от комплектации, спортивный BYD Song L обходится на $6,000 - $8,000 дороже, чем стандартный BYD Song Plus EV.",
        "answer_uz": "Komplektatsiyasiga qarab, sport dizaynli BYD Song L standart BYD Song Plus EV ga qaraganda $6,000 - $8,000 qimmatroq turadi.",
        "answer_en": "Depending on the trim level, the sporty BYD Song L costs roughly $6,000 to $8,000 more than a standard BYD Song Plus EV."
      }
    ]'::jsonb
  );

  -- 2. Insert Article 5: Li Auto Hybrids Analysis
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
    'lixiang-li-auto-hybrid-suvs-uzbekistan-guide',
    'Обзор гибридов Li Auto (L6, L7, L8, L9): Почему последовательный гибрид идеален для Узбекистана',
    'Li Auto (L6, L7, L8, L9) gibridlari sharhi: Nima uchun ketma-ket gibrid O''zbekiston uchun ideal?',
    'Li Auto Hybrids Review (L6, L7, L8, L9): Why Range Extenders are Perfect for Uzbekistan',
    $$# Обзор гибридов Li Auto (Lixiang): Идеальный выбор для Узбекистана

Автомобили марки Li Auto (Lixiang) стали символом роскоши и семейного комфорта в Ташкенте. Модели L6, L7, L8 и L9 заполонили улицы столицы. В этой статье мы разберем технологию последовательного гибрида (EREV) и объясним, почему эти кроссоверы идеально подходят для условий Узбекистана.

## Что такое последовательный гибрид (EREV)?

В отличие от классических гибридов (например, Toyota Prius), где колеса могут приводиться в движение как бензиновым, так и электромотором, у Li Auto колеса крутят **исключительно электромоторы**. 
Бензиновый 1.5-литровый турбодвигатель под капотом выполняет роль **генератора**. Он никак не связан с колесами механически — его задача вырабатывать электричество и заряжать батарею прямо на ходу, когда уровень заряда падает.

```
[Бензиновый ДВС 1.5T] ──> [Генератор] ──> [Батарея / Электромоторы] ──> [Колеса]
```

## Главные преимущества Li Auto в Узбекистане

1. **Запас хода более 1,100 км:** Вы можете зарядить батарею дома в Ташкенте и поехать в Самарканд, Бухару или Хиву без необходимости искать электрозарядки по пути. При нехватке заряда вы просто заправляете обычный бензин АИ-95 на любой АЗС.
2. **Плавность хода электромобиля:** Машина едет бесшумно и плавно, с мгновенным откликом на педаль газа, так как привод полностью электрический.
3. **Пневмоподвеска и комфорт:** Старшие модели (L7, L8, L9 в версиях Max/Ultra) оснащены пневматической подвеской Magic Carpet, которая буквально проглатывает неровности дорог.
4. **Королевский салон:** Сиденья с массажем и вентиляцией, холодильник, работающий в режиме обогрева/охлаждения, и персональные мониторы для детей превратят любые поездки в удовольствие.

## Модельный ряд Li Auto: отличия

- **Li L6:** Самый компактный кроссовер (длина 4.9м, 5 мест). Самый доступный в линейке. Пружинная подвеска.
- **Li L7:** Полноразмерный 5-местный премиум-кроссовер (длина 5.05м). Места сзади с оттоманкой ("королевское сиденье").
- **Li L8:** 6-местный кроссовер с тремя рядами сидений.
- **Li L9:** Флагманский огромный 6-местный внедорожник (длина 5.2м) с максимальным набором опций, холодильником и большими экранами.$$,
    $$# Li Auto (L6, L7, L8, L9) gibridlari sharhi: Nima uchun O'zbekiston uchun ideal?

Li Auto (Lixiang) brendining L6, L7, L8 va L9 modellari Toshkent ko'chalarida juda tez ommalashdi. Ushbu maqolada biz ketma-ket gibrid (EREV) texnologiyasi qanday ishlashini va nima uchun ushbu krossoverlar O'zbekiston sharoiti uchun eng yaxshi tanlov ekanligini ko'rib chiqamiz.

## Ketma-ket gibrid (EREV) nima?

Klassik gibrid avtomobillardan farqli o'laroq, Li Auto modellarida g'ildiraklarni **faqat elektr motorlar** aylantiradi. 
Kapot ostidagi 1.5 litrli benzinli turbo dvigatel faqat **generator** vazifasini bajaradi. U g'ildiraklar bilan mexanik bog'lanmagan — uning vazifasi batareya quvvati kamayganda uni zaryadlash va elektr energiyasi ishlab chiqarishdir.

## Li Auto afzalliklari:

1. **1,100 km dan ortiq masofa:** Toshkentdan Samarqand, Buxoro yoki Xivaga zaryadlash stansiyalarini qidirmasdan borish imkoniyati. Yo'lda oddiy AAI-95 benzin quyib ketaverasiz.
2. **Elektromobil ravonligi:** Yurishi sokin va tezkor.
3. **Magic Carpet pnevmatik osma tizimi:** Yo'ldagi chuqurlarni deyarli sezdirmaydi.

## Modellar farqi:
- **Li L6:** Eng ixcham krossover (5 o'rindiqli).
- **Li L7:** Keng oilaviy 5 o'rindiqli krossover (uzunligi 5.05m).
- **Li L8:** 6 o'rindiqli, 3 qatorli krossover.
- **Li L9:** Flagman, eng hashamatli 6 o'rindiqli model (muzlatgich va orqa ekranlar bilan).$$,
    $$# Li Auto Hybrids Review (L6, L7, L8, L9): Why Range Extenders are Perfect for Uzbekistan

Li Auto (Lixiang) vehicles have become the ultimate symbol of premium family transport in Tashkent. In this article, we explain the Range Extender Hybrid (EREV) technology and why these premium SUVs are perfectly suited for driving in Uzbekistan.

## What is a Range Extender Hybrid (EREV)?

Unlike traditional hybrids where the petrol engine can mechanically drive the wheels, in Li Auto vehicles, the wheels are driven **exclusively by electric motors**. 
The 1.5L turbo petrol engine under the hood acts strictly as an **onboard generator**. It charges the battery when state of charge drops, removing any reliance on public EV chargers.

## Key Advantages of Li Auto in Uzbekistan

1. **1,100 km+ Total Range:** Drive from Tashkent to Samarkand or Bukhara with zero charging stops. Simply refuel with standard premium petrol at any station.
2. **Electric Vehicle Ride Quality:** Silent, smooth drive with immediate torque responses.
3. **Magic Carpet Air Suspension:** Absorbs rough road surfaces effortlessly.
4. **First-Class Cabin:** Heated/ventilated massaging seats, dual compressors fridge, and overhead entertainment screens.

## Lineup Comparison

- **Li L6:** The most compact and affordable 5-seater model (4.9m length, steel coil suspension).
- **Li L7:** Premium large 5-seater (5.05m length, features rear VIP reclining seats).
- **Li L8:** Three-row 6-seater premium SUV.
- **Li L9:** The flagship 6-seater SUV (5.2m length, features onboard fridge and peak luxuries spec).$$,
    '/images/lixiang_suvs.png',
    now(),
    v_author_id,
    true,
    'ai',
    ARRAY['li', 'lixiang', 'comparison'],
    6,
    'Обзор гибридов Lixiang Li L7, L8, L9 в Узбекистане',
    'Lixiang Li L7, L8, L9 gibrid krossoverlar sharhi',
    'Review of Li Auto Hybrids (L6, L7, L8, L9) in Uzbekistan',
    'Подробный разбор преимуществ последовательных гибридов Li Auto (Lixiang) L6, L7, L8, L9. Как устроена технология генератора и почему это лучший выбор для дальних поездок по Узбекистану.',
    'Li Auto (Lixiang) L6, L7, L8, L9 ketma-ket gibridlari sharhi. Generator tizimi qanday ishlaydi va nima uchun bu O''zbekiston bo''ylab uzoq safarlar uchun eng yaxshi tanlov.',
    'Detailed analysis of Li Auto (Lixiang) L6, L7, L8, L9 range-extenders. How the generator powertrain works and why range-extending SUVs are ideal for highway trips in Uzbekistan.',
    '[
      {
        "question_ru": "Нужно ли заряжать Li Auto от розетки?",
        "question_uz": "Li Auto avtomobilini tokka ulash shartmi?",
        "question_en": "Do I have to plug in a Li Auto vehicle to charge it?",
        "answer_ru": "Не обязательно, но рекомендуется. Зарядка от розетки экономит деньги на бензине. Но если розетки нет, встроенный генератор автоматически зарядит батарею во время езды.",
        "answer_uz": "Shart emas, lekin tavsiya etiladi. Rozetkadan quvvatlash yoqilg''ini tejaydi. Rozetka bo''lmasa, motor-generator harakat vaqtida batareyani avtomatik zaryadlaydi.",
        "answer_en": "It is not strictly required, but highly recommended. Charging from a plug saves fuel costs. If no charger is available, the onboard generator will automatically recharge the battery."
      },
      {
        "question_ru": "Какой бензин нужно заправлять в Li Auto L7/L9?",
        "question_uz": "Li Auto L7/L9 modellariga qanday benzin quyish kerak?",
        "question_en": "What type of gasoline should I use for Li Auto L7/L9?",
        "answer_ru": "Рекомендуется использовать высокооктановый бензин не ниже АИ-95 для предотвращения детонации и обеспечения оптимальной работы турбогенератора.",
        "answer_uz": "Dvigatelning optimal ishlashini ta''minlash uchun kamida AI-95 yuqori oktanli benzin quyish tavsiya etiladi.",
        "answer_en": "It is highly recommended to use premium fuel with octane rating of 95 (AI-95) or higher to protect the turbo generator and ensure optimal efficiency."
      }
    ]'::jsonb
  );

END $mig$;
