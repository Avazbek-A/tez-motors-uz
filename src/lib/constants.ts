export const SITE_CONFIG = {
  name: "Tez Motors",
  description: "Импорт автомобилей из Китая в Узбекистан — надёжно, быстро, выгодно",
  url: "https://tezmotors.uz",
  // Verified from public Tez Motors socials (DuckDuckGo + Telegram bio).
  // Email + working hours still need to come from the dealer.
  phone: "+998 90 858 89 89",
  phoneRaw: "+998908588989",
  email: "tezglobalmotors@gmail.com",
  telegram: "https://t.me/tezmotors",
  instagram: "https://instagram.com/tezmotors_uz",
  whatsapp: "https://wa.me/998908588989",
  address: "г. Ташкент, Чиланзарский район, ул. Катартал, 25",
  workingHours: "Пн-Сб: 09:00 – 19:00",
  foundedYear: 2024,
};

// Compact list shown in the header — keep ≤ 8 entries so the desktop
// nav doesn't wrap on a 1366px screen.
export const NAV_LINKS = [
  { href: "/", label: { ru: "Главная", uz: "Bosh sahifa", en: "Home" } },
  { href: "/catalog", label: { ru: "Каталог", uz: "Katalog", en: "Catalog" } },
  { href: "/used", label: { ru: "С пробегом", uz: "Probegli", en: "Used" } },
  { href: "/scooters", label: { ru: "Самокаты", uz: "Skuterlar", en: "Scooters" } },
  { href: "/deals", label: { ru: "Скидки", uz: "Chegirmalar", en: "Deals" } },
  { href: "/parts", label: { ru: "Запчасти", uz: "Ehtiyot qismlar", en: "Parts" } },
  { href: "/calculator", label: { ru: "Калькулятор", uz: "Kalkulyator", en: "Calculator" } },
  { href: "/about", label: { ru: "О нас", uz: "Biz haqimizda", en: "About" } },
  { href: "/blog", label: { ru: "Блог", uz: "Blog", en: "Blog" } },
  { href: "/contacts", label: { ru: "Контакты", uz: "Kontaktlar", en: "Contacts" } },
] as const;

// Larger list shown in the footer — covers everything indexable + boosts
// internal link density to brand / type / city pages.
export const FOOTER_LINKS = [
  { href: "/catalog", label: { ru: "Каталог", uz: "Katalog", en: "Catalog" } },
  { href: "/used", label: { ru: "Авто с пробегом", uz: "Probegli avtolar", en: "Used cars" } },
  { href: "/scooters", label: { ru: "Самокаты и e-bike", uz: "Skuter va e-bike", en: "Scooters & e-bikes" } },
  { href: "/deals", label: { ru: "Скидки", uz: "Chegirmalar", en: "Deals" } },
  { href: "/order", label: { ru: "Заказ под импорт", uz: "Buyurtma asosida", en: "Order to import" } },
  { href: "/parts", label: { ru: "Запчасти", uz: "Ehtiyot qismlar", en: "Parts" } },
  { href: "/services", label: { ru: "Услуги", uz: "Xizmatlar", en: "Services" } },
  { href: "/delivered", label: { ru: "Доставленные авто", uz: "Yetkazilgan avtolar", en: "Delivered cars" } },
  { href: "/compare", label: { ru: "Сравнение", uz: "Solishtirish", en: "Compare" } },
  { href: "/calculator", label: { ru: "Калькулятор", uz: "Kalkulyator", en: "Calculator" } },
  { href: "/tashkent", label: { ru: "Доставка по Ташкенту", uz: "Toshkent bo'ylab", en: "Tashkent" } },
  { href: "/about", label: { ru: "О нас", uz: "Biz haqimizda", en: "About" } },
  { href: "/sell-your-car", label: { ru: "Продать авто", uz: "Mashina sotish", en: "Sell Your Car" } },
  { href: "/blog", label: { ru: "Блог", uz: "Blog", en: "Blog" } },
  { href: "/reviews", label: { ru: "Отзывы", uz: "Sharhlar", en: "Reviews" } },
  { href: "/faq", label: { ru: "FAQ", uz: "FAQ", en: "FAQ" } },
  { href: "/contacts", label: { ru: "Контакты", uz: "Kontaktlar", en: "Contacts" } },
] as const;

/**
 * Cities we deliver imported cars to. These power thin SEO landing pages
 * (/city/[slug]) that funnel geo-intent traffic to the single Tashkent
 * operation — there is NO per-city inventory or contact, just localized copy +
 * CTAs. Tashkent keeps its own bespoke /tashkent page. `days` = typical car-
 * carrier delivery window from the Tashkent office.
 */
export const DELIVERY_CITIES = [
  { slug: "samarkand", ru: "Самарканд", uz: "Samarqand", en: "Samarkand", days: "1–2" },
  { slug: "bukhara", ru: "Бухара", uz: "Buxoro", en: "Bukhara", days: "1–2" },
  { slug: "fergana", ru: "Фергана", uz: "Farg'ona", en: "Fergana", days: "1–2" },
  { slug: "andijan", ru: "Андижан", uz: "Andijon", en: "Andijan", days: "1–2" },
  { slug: "namangan", ru: "Наманган", uz: "Namangan", en: "Namangan", days: "1–2" },
  { slug: "qarshi", ru: "Карши", uz: "Qarshi", en: "Qarshi", days: "1–2" },
  { slug: "nukus", ru: "Нукус", uz: "Nukus", en: "Nukus", days: "2–3" },
] as const;

export const CAR_BRANDS = [
  "BYD", "Chery", "Haval", "Geely", "Changan", "JETOUR", "Tank",
  "Li Auto", "NIO", "Zeekr", "Exeed", "Hongqi", "Dongfeng", "GAC",
  "Great Wall", "MG", "Omoda", "Jaecoo", "Voyah", "XPeng",
] as const;

export const BODY_TYPES = [
  { value: "sedan", label: { ru: "Седан", uz: "Sedan", en: "Sedan" } },
  { value: "suv", label: { ru: "Внедорожник", uz: "SUV", en: "SUV" } },
  { value: "crossover", label: { ru: "Кроссовер", uz: "Krossover", en: "Crossover" } },
  { value: "hatchback", label: { ru: "Хэтчбек", uz: "Xetchbek", en: "Hatchback" } },
  { value: "minivan", label: { ru: "Минивэн", uz: "Miniven", en: "Minivan" } },
  { value: "coupe", label: { ru: "Купе", uz: "Kupe", en: "Coupe" } },
] as const;

export const FUEL_TYPES = [
  { value: "petrol", label: { ru: "Бензин", uz: "Benzin", en: "Petrol" } },
  { value: "electric", label: { ru: "Электро", uz: "Elektr", en: "Electric" } },
  { value: "hybrid", label: { ru: "Гибрид", uz: "Gibrid", en: "Hybrid" } },
  { value: "phev", label: { ru: "Плагин-гибрид", uz: "Plagin-gibrid", en: "PHEV" } },
] as const;

export const PROCESS_STEPS = [
  {
    step: 1,
    title: { ru: "Заявка", uz: "Ariza", en: "Application" },
    description: {
      ru: "Оставьте заявку на сайте или свяжитесь с нами",
      uz: "Saytda ariza qoldiring yoki biz bilan bog'laning",
      en: "Submit an application or contact us directly",
    },
    icon: "FileText",
  },
  {
    step: 2,
    title: { ru: "Подбор авто", uz: "Avto tanlash", en: "Car Selection" },
    description: {
      ru: "Подберём автомобиль под ваш бюджет и пожелания",
      uz: "Byudjet va xohishlaringizga mos avtomobilni tanlaymiz",
      en: "We select a car matching your budget and preferences",
    },
    icon: "Search",
  },
  {
    step: 3,
    title: { ru: "Договор и оплата", uz: "Shartnoma va to'lov", en: "Contract & Payment" },
    description: {
      ru: "Заключаем договор и вносите предоплату",
      uz: "Shartnoma tuzamiz va oldindan to'lov qilasiz",
      en: "Sign the contract and make the deposit",
    },
    icon: "FileCheck",
  },
  {
    step: 4,
    title: { ru: "Покупка в Китае", uz: "Xitoyda xarid", en: "Purchase in China" },
    description: {
      ru: "Выкупаем автомобиль на аукционе или у дилера",
      uz: "Avtomobilni auksionda yoki dilerdan sotib olamiz",
      en: "We purchase the vehicle at auction or from a dealer",
    },
    icon: "ShoppingCart",
  },
  {
    step: 5,
    title: { ru: "Доставка", uz: "Yetkazib berish", en: "Shipping" },
    description: {
      ru: "Отправляем авто морем/по ж/д в Узбекистан",
      uz: "Avtomobilni dengiz/temir yo'l orqali O'zbekistonga jo'natamiz",
      en: "Ship the car by sea/rail to Uzbekistan",
    },
    icon: "Ship",
  },
  {
    step: 6,
    title: { ru: "Получение", uz: "Qabul qilish", en: "Delivery" },
    description: {
      ru: "Таможенное оформление и передача вам автомобиля",
      uz: "Bojxona rasmiylashtiruvi va avtomobilni sizga topshirish",
      en: "Customs clearance and handover of your vehicle",
    },
    icon: "CarFront",
  },
] as const;
