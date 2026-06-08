/**
 * AutoHome CN → RU/UZ/EN dictionary for the decoded spec sheet (Phase AUTOHOME).
 *
 * The decoder (autohome-extract.mjs) yields Chinese labels/values. This covers
 * AutoHome's common, stable vocabulary (groups + ~90 param names + ~40 categorical
 * values) authored against REAL scraped strings. Strategy = static dict + LLM
 * fallback (the dealer's choice): known terms resolve here for free + deterministically;
 * unknown ones are handed to translateUnknown() (an injected LLM call) and cached;
 * if no LLM, the raw Chinese passes through (fail-open, never blocks an import).
 *
 * Param names carry Latin unit suffixes (最大功率(kW)); we translate the stem and
 * re-append the unit, so "最大功率(kW)" → "Max power (kW)" without hand-listing units.
 */

export const GROUPS = {
  基本参数: { en: "Basics", ru: "Основные параметры", uz: "Asosiy parametrlar" },
  车身: { en: "Body", ru: "Кузов", uz: "Kuzov" },
  发动机: { en: "Engine", ru: "Двигатель", uz: "Dvigatel" },
  电动机: { en: "Electric motor", ru: "Электродвигатель", uz: "Elektr dvigatel" },
  "电池/充电": { en: "Battery / Charging", ru: "Батарея / Зарядка", uz: "Batareya / Quvvatlash" },
  变速箱: { en: "Transmission", ru: "Коробка передач", uz: "Uzatmalar qutisi" },
  底盘转向: { en: "Chassis & Steering", ru: "Шасси и рулевое", uz: "Shassi va rul" },
  车轮制动: { en: "Wheels & Brakes", ru: "Колёса и тормоза", uz: "G‘ildiraklar va tormozlar" },
  车轮制动配置: { en: "Wheels & Brakes", ru: "Колёса и тормоза", uz: "G‘ildiraklar va tormozlar" },
  安全装备: { en: "Safety", ru: "Безопасность", uz: "Xavfsizlik" },
  主被动安全: { en: "Active/Passive safety", ru: "Активная/пассивная безопасность", uz: "Faol/passiv xavfsizlik" },
};

// Param-name STEMS (the part before any "(unit)"). Keyed by exact CN stem.
export const PARAMS = {
  车型名称: { en: "Model name", ru: "Название модели", uz: "Model nomi" },
  简称: { en: "Short name", ru: "Кратко", uz: "Qisqa nom" },
  厂商指导价: { en: "MSRP", ru: "Рекомендованная цена", uz: "Tavsiya etilgan narx" },
  厂商: { en: "Manufacturer", ru: "Производитель", uz: "Ishlab chiqaruvchi" },
  级别: { en: "Class", ru: "Класс", uz: "Sinf" },
  能源类型: { en: "Energy type", ru: "Тип топлива/энергии", uz: "Energiya turi" },
  上市时间: { en: "Launch date", ru: "Дата выхода", uz: "Chiqarilgan sana" },
  最高车速: { en: "Top speed", ru: "Макс. скорость", uz: "Maks. tezlik" },
  "官方0-100km/h加速": { en: "0–100 km/h (official)", ru: "Разгон 0–100 км/ч", uz: "0–100 km/soat" },
  "官方0-100km/h加速时间": { en: "0–100 km/h (official)", ru: "Разгон 0–100 км/ч", uz: "0–100 km/soat" },
  最大功率: { en: "Max power", ru: "Макс. мощность", uz: "Maks. quvvat" },
  最大扭矩: { en: "Max torque", ru: "Макс. крутящий момент", uz: "Maks. moment" },
  最大马力: { en: "Max horsepower", ru: "Макс. мощность (л.с.)", uz: "Maks. ot kuchi" },
  环保标准: { en: "Emission standard", ru: "Эко-стандарт", uz: "Ekologik standart" },
  车身结构: { en: "Body structure", ru: "Тип кузова", uz: "Kuzov turi" },
  车体结构: { en: "Body type", ru: "Несущая система", uz: "Kuzov konstruksiyasi" },
  "长*宽*高": { en: "L×W×H", ru: "Длина×Ширина×Высота", uz: "Uz×En×Bal" },
  长度: { en: "Length", ru: "Длина", uz: "Uzunlik" },
  宽度: { en: "Width", ru: "Ширина", uz: "Kenglik" },
  高度: { en: "Height", ru: "Высота", uz: "Balandlik" },
  轴距: { en: "Wheelbase", ru: "Колёсная база", uz: "G‘ildiraklar bazasi" },
  前轮距: { en: "Front track", ru: "Колея передняя", uz: "Old g‘ildirak izi" },
  后轮距: { en: "Rear track", ru: "Колея задняя", uz: "Orqa g‘ildirak izi" },
  整备质量: { en: "Curb weight", ru: "Снаряжённая масса", uz: "Tayyor massa" },
  最大满载质量: { en: "Gross weight", ru: "Полная масса", uz: "To‘liq massa" },
  最大载重质量: { en: "Max payload", ru: "Грузоподъёмность", uz: "Yuk ko‘tarish" },
  最大载重: { en: "Max payload", ru: "Грузоподъёмность", uz: "Yuk ko‘tarish" },
  油箱容积: { en: "Fuel tank", ru: "Объём бака", uz: "Bak hajmi" },
  后备厢容积: { en: "Trunk volume", ru: "Объём багажника", uz: "Yuk bo‘limi hajmi" },
  前备厢容积: { en: "Front trunk", ru: "Передний багажник", uz: "Old yuk bo‘lim" },
  接近角: { en: "Approach angle", ru: "Угол въезда", uz: "Kirish burchagi" },
  离去角: { en: "Departure angle", ru: "Угол съезда", uz: "Chiqish burchagi" },
  车门开启方式: { en: "Door type", ru: "Тип дверей", uz: "Eshik turi" },
  风阻系数: { en: "Drag coefficient", ru: "Коэф. аэродин. сопротивления", uz: "Aerodinamik koeff." },
  满载最小离地间隙: { en: "Min ground clearance (loaded)", ru: "Клиренс (с нагрузкой)", uz: "Klirens (yuklangan)" },
  空载最小离地间隙: { en: "Min ground clearance (empty)", ru: "Клиренс (без нагрузки)", uz: "Klirens (bo‘sh)" },
  最小转弯半径: { en: "Turning radius", ru: "Радиус разворота", uz: "Burilish radiusi" },
  货箱尺寸: { en: "Cargo box size", ru: "Размер кузова", uz: "Yuk qutisi o‘lchami" },
  货箱: { en: "Cargo box", ru: "Грузовой отсек", uz: "Yuk qutisi" },
  // engine
  发动机: { en: "Engine", ru: "Двигатель", uz: "Dvigatel" },
  发动机型号: { en: "Engine model", ru: "Модель двигателя", uz: "Dvigatel modeli" },
  发动机布局: { en: "Engine layout", ru: "Расположение двигателя", uz: "Dvigatel joylashuvi" },
  发动机特有技术: { en: "Engine tech", ru: "Технологии двигателя", uz: "Dvigatel texnologiyasi" },
  排量: { en: "Displacement", ru: "Рабочий объём", uz: "Ishchi hajm" },
  进气形式: { en: "Aspiration", ru: "Тип впуска", uz: "Havo olish turi" },
  气缸排列形式: { en: "Cylinder layout", ru: "Расположение цилиндров", uz: "Silindrlar joylashuvi" },
  气缸数: { en: "Cylinders", ru: "Число цилиндров", uz: "Silindrlar soni" },
  每缸气门数: { en: "Valves per cylinder", ru: "Клапанов на цилиндр", uz: "Silindrga klapanlar" },
  配气机构: { en: "Valvetrain", ru: "Газораспределение", uz: "Gaz taqsimlash" },
  燃油标号: { en: "Fuel grade", ru: "Марка топлива", uz: "Yoqilg‘i markasi" },
  供油方式: { en: "Fuel supply", ru: "Подача топлива", uz: "Yoqilg‘i berish" },
  缸盖材料: { en: "Cylinder head material", ru: "Материал ГБЦ", uz: "Silindr qopqog‘i materiali" },
  缸体材料: { en: "Engine block material", ru: "Материал блока", uz: "Blok materiali" },
  最大净功率: { en: "Max net power", ru: "Макс. полезная мощность", uz: "Maks. foydali quvvat" },
  最大功率转速: { en: "Max power rpm", ru: "Обороты макс. мощности", uz: "Maks. quvvat aylanishi" },
  最大扭矩转速: { en: "Max torque rpm", ru: "Обороты макс. момента", uz: "Maks. moment aylanishi" },
  "WLTC综合油耗": { en: "WLTC fuel consumption", ru: "Расход WLTC", uz: "WLTC sarfi" },
  "NEDC综合油耗": { en: "NEDC fuel consumption", ru: "Расход NEDC", uz: "NEDC sarfi" },
  // transmission
  挡位个数: { en: "Number of gears", ru: "Число передач", uz: "Uzatmalar soni" },
  变速箱类型: { en: "Transmission type", ru: "Тип КПП", uz: "Uzatma turi" },
  变速箱: { en: "Transmission", ru: "Коробка передач", uz: "Uzatmalar qutisi" },
  // electric / battery
  "电动机": { en: "Electric motor", ru: "Электродвигатель", uz: "Elektr dvigatel" },
  电机类型: { en: "Motor type", ru: "Тип электромотора", uz: "Motor turi" },
  电机布局: { en: "Motor layout", ru: "Расположение моторов", uz: "Motor joylashuvi" },
  驱动电机数: { en: "Number of motors", ru: "Число электромоторов", uz: "Motorlar soni" },
  电动机总功率: { en: "Total motor power", ru: "Суммарная мощность", uz: "Umumiy quvvat" },
  电动机总马力: { en: "Total motor hp", ru: "Суммарная мощность (л.с.)", uz: "Umumiy ot kuchi" },
  电动机总扭矩: { en: "Total motor torque", ru: "Суммарный момент", uz: "Umumiy moment" },
  前电动机品牌: { en: "Front motor brand", ru: "Бренд переднего мотора", uz: "Old motor brendi" },
  前电动机型号: { en: "Front motor model", ru: "Модель переднего мотора", uz: "Old motor modeli" },
  前电动机最大功率: { en: "Front motor max power", ru: "Макс. мощность переднего", uz: "Old motor maks. quvvati" },
  前电动机最大扭矩: { en: "Front motor max torque", ru: "Макс. момент переднего", uz: "Old motor maks. momenti" },
  后电动机品牌: { en: "Rear motor brand", ru: "Бренд заднего мотора", uz: "Orqa motor brendi" },
  后电动机型号: { en: "Rear motor model", ru: "Модель заднего мотора", uz: "Orqa motor modeli" },
  后电动机最大功率: { en: "Rear motor max power", ru: "Макс. мощность заднего", uz: "Orqa motor maks. quvvati" },
  后电动机最大扭矩: { en: "Rear motor max torque", ru: "Макс. момент заднего", uz: "Orqa motor maks. momenti" },
  电池冷却方式: { en: "Battery cooling", ru: "Охлаждение батареи", uz: "Batareya sovutilishi" },
  电池能量: { en: "Battery capacity", ru: "Ёмкость батареи", uz: "Batareya sig‘imi" },
  "CLTC纯电续航里程": { en: "CLTC electric range", ru: "Запас хода CLTC", uz: "CLTC yurish masofasi" },
  "NEDC纯电续航里程": { en: "NEDC electric range", ru: "Запас хода NEDC", uz: "NEDC yurish masofasi" },
  百公里耗电量: { en: "Energy use /100km", ru: "Расход эл. /100км", uz: "Energiya sarfi /100km" },
  电能当量燃料消耗量: { en: "Equivalent fuel use", ru: "Эквивалентный расход", uz: "Ekvivalent sarf" },
  快充功能: { en: "Fast charging", ru: "Быстрая зарядка", uz: "Tez quvvatlash" },
  快充功率: { en: "Fast-charge power", ru: "Мощность быстрой зарядки", uz: "Tez quvvat quvvati" },
  快充接口位置: { en: "Fast-charge port", ru: "Разъём быстрой зарядки", uz: "Tez quvvat porti" },
  慢充接口位置: { en: "Slow-charge port", ru: "Разъём медленной зарядки", uz: "Sekin quvvat porti" },
  电池快充时间: { en: "Fast-charge time", ru: "Время быстрой зарядки", uz: "Tez quvvat vaqti" },
  电池快充电量范围: { en: "Fast-charge range", ru: "Диапазон быстрой зарядки", uz: "Tez quvvat oralig‘i" },
  换电: { en: "Battery swap", ru: "Замена батареи", uz: "Batareya almashtirish" },
  对外交流放电功率: { en: "V2L output power", ru: "Мощность V2L", uz: "V2L quvvati" },
  // chassis
  最大爬坡度: { en: "Max gradeability", ru: "Макс. преодол. подъём", uz: "Maks. ko‘tarilish" },
  最大爬坡角度: { en: "Max climb angle", ru: "Макс. угол подъёма", uz: "Maks. ko‘tarilish burchagi" },
  准拖挂车总质量: { en: "Max towing weight", ru: "Макс. масса прицепа", uz: "Maks. tirkama massasi" },
};

// Common categorical VALUES (exact CN string → translations).
export const VALUES = {
  纯电动: { en: "Electric", ru: "Электро", uz: "Elektr" },
  汽油: { en: "Petrol", ru: "Бензин", uz: "Benzin" },
  柴油: { en: "Diesel", ru: "Дизель", uz: "Dizel" },
  "汽油+CNG": { en: "Petrol + CNG", ru: "Бензин + CNG", uz: "Benzin + CNG" },
  插电式混合动力: { en: "Plug-in hybrid", ru: "Подключаемый гибрид", uz: "Plug-in gibrid" },
  油电混合: { en: "Hybrid", ru: "Гибрид", uz: "Gibrid" },
  增程式: { en: "Range-extender", ru: "С увеличителем пробега", uz: "Range-extender" },
  中型SUV: { en: "Mid-size SUV", ru: "Среднеразмерный SUV", uz: "O‘rta SUV" },
  紧凑型SUV: { en: "Compact SUV", ru: "Компактный SUV", uz: "Kompakt SUV" },
  大型SUV: { en: "Full-size SUV", ru: "Большой SUV", uz: "Katta SUV" },
  小型SUV: { en: "Small SUV", ru: "Малый SUV", uz: "Kichik SUV" },
  中大型SUV: { en: "Mid-large SUV", ru: "Средне-большой SUV", uz: "O‘rta-katta SUV" },
  紧凑型车: { en: "Compact car", ru: "Компактный класс", uz: "Kompakt avto" },
  中型车: { en: "Mid-size car", ru: "Средний класс", uz: "O‘rta avto" },
  中大型车: { en: "Mid-large car", ru: "Бизнес-класс", uz: "O‘rta-katta avto" },
  小型车: { en: "Subcompact", ru: "Малый класс", uz: "Kichik avto" },
  微型车: { en: "Micro car", ru: "Микро-класс", uz: "Mikro avto" },
  三厢车: { en: "Sedan", ru: "Седан", uz: "Sedan" },
  两厢车: { en: "Hatchback", ru: "Хэтчбек", uz: "Xetchbek" },
  承载式: { en: "Unibody", ru: "Несущий", uz: "Yagona kuzov" },
  非承载式: { en: "Body-on-frame", ru: "Рамный", uz: "Ramali" },
  涡轮增压: { en: "Turbocharged", ru: "Турбонаддув", uz: "Turbo" },
  自然吸气: { en: "Naturally aspirated", ru: "Атмосферный", uz: "Atmosfera" },
  机械增压: { en: "Supercharged", ru: "Механический наддув", uz: "Mexanik nadduv" },
  直喷: { en: "Direct injection", ru: "Прямой впрыск", uz: "To‘g‘ridan in’yeksiya" },
  多点电喷: { en: "Multi-point injection", ru: "Распределённый впрыск", uz: "Ko‘p nuqtali in’yeksiya" },
  混合喷射: { en: "Combined injection", ru: "Комбинир. впрыск", uz: "Aralash in’yeksiya" },
  横置: { en: "Transverse", ru: "Поперечное", uz: "Ko‘ndalang" },
  纵置: { en: "Longitudinal", ru: "Продольное", uz: "Bo‘ylama" },
  前置: { en: "Front", ru: "Спереди", uz: "Oldinda" },
  后置: { en: "Rear", ru: "Сзади", uz: "Orqada" },
  "前置+后置": { en: "Front + rear", ru: "Спереди + сзади", uz: "Old + orqa" },
  铝合金: { en: "Aluminium alloy", ru: "Алюм. сплав", uz: "Alumin qotishma" },
  铸铁: { en: "Cast iron", ru: "Чугун", uz: "Cho‘yan" },
  平开门: { en: "Conventional doors", ru: "Распашные двери", uz: "Oddiy eshiklar" },
  液冷: { en: "Liquid-cooled", ru: "Жидкостное охл.", uz: "Suyuqlik sovutish" },
  风冷: { en: "Air-cooled", ru: "Воздушное охл.", uz: "Havo sovutish" },
  永磁同步: { en: "PMSM", ru: "Синхронный (пост. магниты)", uz: "Doimiy magnitli" },
  "永磁/同步": { en: "PMSM", ru: "Синхронный (пост. магниты)", uz: "Doimiy magnitli" },
  交流异步: { en: "AC induction", ru: "Асинхронный", uz: "Asinxron" },
  单电机: { en: "Single motor", ru: "Один мотор", uz: "Bitta motor" },
  双电机: { en: "Dual motor", ru: "Два мотора", uz: "Ikki motor" },
  三电机: { en: "Tri motor", ru: "Три мотора", uz: "Uch motor" },
  电动车单速变速箱: { en: "Single-speed (EV)", ru: "Односкоростная (EV)", uz: "Bir tezlikli (EV)" },
  固定齿比变速箱: { en: "Fixed-ratio", ru: "Фиксир. передача", uz: "Belgilangan nisbat" },
  支持: { en: "Yes", ru: "Есть", uz: "Bor" },
  不支持: { en: "No", ru: "Нет", uz: "Yo‘q" },
  标配: { en: "Standard", ru: "Стандарт", uz: "Standart" },
  选装: { en: "Optional", ru: "Опция", uz: "Opsiya" },
  无: { en: "None", ru: "Нет", uz: "Yo‘q" },
  未知: { en: "Unknown", ru: "Неизвестно", uz: "Noma’lum" },
  货车: { en: "Truck", ru: "Грузовик", uz: "Yuk mashinasi" },
  微卡: { en: "Micro truck", ru: "Микрогрузовик", uz: "Mikro yuk" },
  米勒循环: { en: "Miller cycle", ru: "Цикл Миллера", uz: "Miller sikli" },
  阿特金森循环: { en: "Atkinson cycle", ru: "Цикл Аткинсона", uz: "Atkinson sikli" },
  国VI: { en: "China VI", ru: "Китай VI (≈Евро 6)", uz: "Xitoy VI" },
  "国VI b": { en: "China VI b", ru: "Китай VI b", uz: "Xitoy VI b" },
};

const LANGS = ["en", "ru", "uz"];
const memo = new Map(); // cache for LLM-translated unknowns

function splitUnit(name) {
  const m = String(name).match(/^(.*?)(\s*[（(][^（）()]*[)）])\s*$/);
  return m ? { stem: m[1].trim(), unit: m[2].replace(/（/g, "(").replace(/）/g, ")").trim() } : { stem: String(name).trim(), unit: "" };
}

/** Translate one label (param/group name). Returns {en,ru,uz} or null if unknown. */
export function translateLabel(cn) {
  if (GROUPS[cn]) return GROUPS[cn];
  const { stem, unit } = splitUnit(cn);
  const hit = PARAMS[stem] || PARAMS[cn];
  if (!hit) return null;
  if (!unit) return hit;
  return Object.fromEntries(LANGS.map((l) => [l, `${hit[l]} ${unit}`]));
}

/** Translate one value. Numeric/Latin pass through unchanged; categorical via dict; else null. */
export function translateValue(cn) {
  const v = String(cn).trim();
  if (!v || v === "-") return { en: v, ru: v, uz: v };
  // Chinese myriad units in otherwise-numeric values (price 26.35万 → 263500).
  const wan = v.match(/^([\d.]+)\s*万$/); if (wan) { const n = String(Math.round(parseFloat(wan[1]) * 1e4)); return { en: n, ru: n, uz: n }; }
  const yi = v.match(/^([\d.]+)\s*亿$/); if (yi) { const n = String(Math.round(parseFloat(yi[1]) * 1e8)); return { en: n, ru: n, uz: n }; }
  if (!/[一-鿿]/.test(v)) return { en: v, ru: v, uz: v }; // pure number/Latin (e.g. 4797*1920*1624)
  if (VALUES[v]) return VALUES[v];
  return null;
}

/**
 * Translate a whole SpecData into {en,ru,uz} variants. Known terms from the dict;
 * unknown CN terms collected and resolved via translateUnknown(list)->{cn:{en,ru,uz}}
 * (inject an LLM-backed batch translator; omit for dict-only / raw-CN fallback).
 */
export async function translateSpec(spec, { translateUnknown } = {}) {
  const unknownLabels = new Set(), unknownValues = new Set();
  const labelOf = (cn) => translateLabel(cn);
  const valueOf = (cn) => translateValue(cn);

  for (const g of spec.groups) if (!labelOf(g)) unknownLabels.add(g);
  for (const t of spec.trims) for (const [gn, sec] of Object.entries(t.params)) {
    if (!labelOf(gn)) unknownLabels.add(gn);
    for (const [pn, pv] of Object.entries(sec)) {
      if (!labelOf(pn)) unknownLabels.add(pn);
      if (valueOf(pv) === null) unknownValues.add(pv);
    }
  }

  // Resolve unknowns via the injected LLM translator (cached), if provided.
  const extra = {};
  const pending = [...unknownLabels, ...unknownValues].filter((x) => !memo.has(x));
  if (pending.length && typeof translateUnknown === "function") {
    try {
      const got = (await translateUnknown(pending)) || {};
      for (const [cn, tr] of Object.entries(got)) if (tr) memo.set(cn, tr);
    } catch { /* fail-open */ }
  }
  for (const cn of [...unknownLabels, ...unknownValues]) if (memo.has(cn)) extra[cn] = memo.get(cn);

  const tl = (cn) => labelOf(cn) || extra[cn] || { en: cn, ru: cn, uz: cn };
  const tv = (cn) => valueOf(cn) || extra[cn] || { en: cn, ru: cn, uz: cn };

  const render = (lang) => ({
    groups: spec.groups.map((g) => tl(g)[lang]),
    trims: spec.trims.map((t) => ({
      specid: t.specid, name: t.name, price_raw: t.price_raw,
      params: Object.fromEntries(Object.entries(t.params).map(([gn, sec]) => [
        tl(gn)[lang],
        Object.fromEntries(Object.entries(sec).map(([pn, pv]) => [tl(pn)[lang], tv(pv)[lang]])),
      ])),
    })),
  });

  return {
    ...spec,
    i18n: { en: render("en"), ru: render("ru"), uz: render("uz") },
    untranslated: { labels: [...unknownLabels].filter((x) => !memo.has(x)), values: [...unknownValues].filter((x) => !memo.has(x)) },
  };
}
