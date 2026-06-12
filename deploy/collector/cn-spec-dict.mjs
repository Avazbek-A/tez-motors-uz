/**
 * AutoHome CN → RU/UZ/EN dictionary (Phase AUTOHOME / GONZO).
 *
 * Comprehensive, Claude-authored translations of AutoHome's parameter vocabulary,
 * with EN matching AutoHome's own GLOBAL-site conventions (Length(mm), Maximum
 * power(kW), Curb weight(kg)…). Covers the full scraped vocabulary — groups, ~120
 * param-name stems, ~110 categorical values (incl. battery names, motor suppliers,
 * body styles, transmissions) — plus compositional handling (万 prices, N门N座 body,
 * unit suffixes) and TRIM-NAME translation (款→year, 度→kWh, 四驱→AWD, 曜夜→Shadowline…).
 *
 * Deterministic + free (no runtime LLM key needed). translateSpec() still accepts an
 * optional injected `translateUnknown` for the rare long-tail term, and reports what
 * (if anything) it couldn't translate so the dict can be extended.
 */
import { EXTRA_PARAMS, UNIT_MAP, VALUE_WORDS, EXTRA_VALUES, TRIM_WORDS } from "./cn-spec-terms.mjs";

export const GROUPS = {
  基本参数: { en: "Basics", ru: "Основные параметры", uz: "Asosiy parametrlar" },
  车身: { en: "Body", ru: "Кузов", uz: "Kuzov" },
  发动机: { en: "Engine", ru: "Двигатель", uz: "Dvigatel" },
  电动机: { en: "Electric motor", ru: "Электродвигатель", uz: "Elektr dvigatel" },
  "电池/充电": { en: "Battery / Charging", ru: "Батарея / Зарядка", uz: "Batareya / Quvvatlash" },
  变速箱: { en: "Transmission", ru: "Коробка передач", uz: "Uzatmalar qutisi" },
  底盘转向: { en: "Chassis & Steering", ru: "Шасси и рулевое управление", uz: "Shassi va rul" },
  车轮制动: { en: "Wheels & Brakes", ru: "Колёса и тормоза", uz: "G‘ildiraklar va tormozlar" },
  主被动安全: { en: "Active / Passive safety", ru: "Активная и пассивная безопасность", uz: "Faol va passiv xavfsizlik" },
  辅助操控配置: { en: "Driver assistance", ru: "Системы помощи водителю", uz: "Haydovchiga yordam" },
  外部配置: { en: "Exterior features", ru: "Внешнее оснащение", uz: "Tashqi jihozlar" },
  内部配置: { en: "Interior features", ru: "Внутреннее оснащение", uz: "Ichki jihozlar" },
  座椅配置: { en: "Seats", ru: "Сиденья", uz: "O‘rindiqlar" },
  智能互联: { en: "Connectivity", ru: "Мультимедиа и связь", uz: "Aloqa va multimedia" },
  灯光配置: { en: "Lighting", ru: "Освещение", uz: "Yoritish" },
  玻璃后视镜: { en: "Glass & Mirrors", ru: "Стёкла и зеркала", uz: "Oynalar va ko‘zgular" },
  空调冰箱: { en: "A/C & Fridge", ru: "Климат и холодильник", uz: "Iqlim va muzlatgich" },
};

// Param-name STEMS (the part before any "(unit)"). Keyed by exact CN stem.
export const PARAMS = {
  // basics
  车型名称: { en: "Model", ru: "Модель", uz: "Model" },
  简称: { en: "Short name", ru: "Краткое название", uz: "Qisqa nom" },
  厂商指导价: { en: "MSRP", ru: "Рекомендованная цена", uz: "Tavsiya etilgan narx" },
  厂商: { en: "Manufacturer", ru: "Производитель", uz: "Ishlab chiqaruvchi" },
  级别: { en: "Class", ru: "Класс", uz: "Sinf" },
  能源类型: { en: "Energy type", ru: "Тип энергии", uz: "Energiya turi" },
  上市时间: { en: "Launch date", ru: "Дата выхода", uz: "Chiqarilgan sana" },
  最高车速: { en: "Top speed", ru: "Максимальная скорость", uz: "Maksimal tezlik" },
  "官方0-100km/h加速": { en: "0–100 km/h acceleration", ru: "Разгон 0–100 км/ч", uz: "0–100 km/soat tezlanish" },
  "官方100-0km/h制动": { en: "100–0 km/h braking", ru: "Торможение 100–0 км/ч", uz: "100–0 km/soat tormoz" },
  最大功率: { en: "Maximum power", ru: "Максимальная мощность", uz: "Maksimal quvvat" },
  最大扭矩: { en: "Maximum torque", ru: "Максимальный крутящий момент", uz: "Maksimal moment" },
  最大马力: { en: "Maximum horsepower", ru: "Максимальная мощность (л.с.)", uz: "Maksimal ot kuchi" },
  最大净功率: { en: "Maximum net power", ru: "Максимальная полезная мощность", uz: "Maksimal foydali quvvat" },
  最大功率转速: { en: "Max power RPM", ru: "Обороты макс. мощности", uz: "Maks. quvvat aylanishi" },
  最大扭矩转速: { en: "Max torque RPM", ru: "Обороты макс. момента", uz: "Maks. moment aylanishi" },
  环保标准: { en: "Emission standard", ru: "Экологический стандарт", uz: "Ekologik standart" },
  // body
  车身结构: { en: "Body structure", ru: "Тип кузова", uz: "Kuzov turi" },
  车体结构: { en: "Body type", ru: "Конструкция кузова", uz: "Kuzov konstruksiyasi" },
  "长*宽*高": { en: "L × W × H", ru: "Длина × Ширина × Высота", uz: "Uz. × En × Bal." },
  长度: { en: "Length", ru: "Длина", uz: "Uzunlik" },
  宽度: { en: "Width", ru: "Ширина", uz: "Kenglik" },
  高度: { en: "Height", ru: "Высота", uz: "Balandlik" },
  轴距: { en: "Wheelbase", ru: "Колёсная база", uz: "G‘ildiraklar bazasi" },
  前轮距: { en: "Front track", ru: "Передняя колея", uz: "Old g‘ildirak izi" },
  后轮距: { en: "Rear track", ru: "Задняя колея", uz: "Orqa g‘ildirak izi" },
  整备质量: { en: "Curb weight", ru: "Снаряжённая масса", uz: "Tayyor massa" },
  最大满载质量: { en: "Gross weight", ru: "Полная масса", uz: "To‘liq massa" },
  准拖挂车总质量: { en: "Max towing weight", ru: "Макс. масса прицепа", uz: "Maks. tirkama massasi" },
  接近角: { en: "Approach angle", ru: "Угол въезда", uz: "Kirish burchagi" },
  离去角: { en: "Departure angle", ru: "Угол съезда", uz: "Chiqish burchagi" },
  风阻系数: { en: "Drag coefficient", ru: "Коэффициент аэродинамики", uz: "Aerodinamik koeffitsient" },
  前备厢容积: { en: "Front trunk volume", ru: "Объём переднего багажника", uz: "Old yuk bo‘limi hajmi" },
  后备厢容积: { en: "Trunk volume", ru: "Объём багажника", uz: "Yuk bo‘limi hajmi" },
  油箱容积: { en: "Fuel tank", ru: "Объём бака", uz: "Bak hajmi" },
  车门开启方式: { en: "Door type", ru: "Тип открывания дверей", uz: "Eshik ochilishi" },
  最小离地间隙: { en: "Min ground clearance", ru: "Дорожный просвет", uz: "Dorojniy prosvet" },
  空载最小离地间隙: { en: "Min ground clearance (empty)", ru: "Клиренс (без нагрузки)", uz: "Klirens (bo‘sh)" },
  满载最小离地间隙: { en: "Min ground clearance (loaded)", ru: "Клиренс (с нагрузкой)", uz: "Klirens (yuklangan)" },
  最小转弯半径: { en: "Turning radius", ru: "Радиус разворота", uz: "Burilish radiusi" },
  货箱尺寸: { en: "Cargo box size", ru: "Размер грузового отсека", uz: "Yuk qutisi o‘lchami" },
  // electric motor
  电动机: { en: "Electric motor", ru: "Электродвигатель", uz: "Elektr dvigatel" },
  电机类型: { en: "Motor type", ru: "Тип электромотора", uz: "Motor turi" },
  电机布局: { en: "Motor layout", ru: "Расположение моторов", uz: "Motor joylashuvi" },
  驱动电机数: { en: "Number of motors", ru: "Число электромоторов", uz: "Motorlar soni" },
  电动机总功率: { en: "Total motor power", ru: "Суммарная мощность моторов", uz: "Umumiy motor quvvati" },
  电动机总马力: { en: "Total motor horsepower", ru: "Суммарная мощность (л.с.)", uz: "Umumiy ot kuchi" },
  电动机总扭矩: { en: "Total motor torque", ru: "Суммарный крутящий момент", uz: "Umumiy moment" },
  前电动机品牌: { en: "Front motor brand", ru: "Бренд переднего мотора", uz: "Old motor brendi" },
  前电动机型号: { en: "Front motor model", ru: "Модель переднего мотора", uz: "Old motor modeli" },
  前电动机最大功率: { en: "Front motor max power", ru: "Макс. мощность переднего мотора", uz: "Old motor maks. quvvati" },
  前电动机最大扭矩: { en: "Front motor max torque", ru: "Макс. момент переднего мотора", uz: "Old motor maks. momenti" },
  后电动机品牌: { en: "Rear motor brand", ru: "Бренд заднего мотора", uz: "Orqa motor brendi" },
  后电动机型号: { en: "Rear motor model", ru: "Модель заднего мотора", uz: "Orqa motor modeli" },
  后电动机最大功率: { en: "Rear motor max power", ru: "Макс. мощность заднего мотора", uz: "Orqa motor maks. quvvati" },
  后电动机最大扭矩: { en: "Rear motor max torque", ru: "Макс. момент заднего мотора", uz: "Orqa motor maks. momenti" },
  // battery / charging
  电池能量: { en: "Battery capacity", ru: "Ёмкость батареи", uz: "Batareya sig‘imi" },
  电池能量密度: { en: "Battery energy density", ru: "Плотность энергии батареи", uz: "Batareya energiya zichligi" },
  电池冷却方式: { en: "Battery cooling", ru: "Охлаждение батареи", uz: "Batareya sovutilishi" },
  电池特有技术: { en: "Battery technology", ru: "Технология батареи", uz: "Batareya texnologiyasi" },
  CLTC纯电续航里程: { en: "CLTC electric range", ru: "Запас хода CLTC", uz: "CLTC yurish masofasi" },
  NEDC纯电续航里程: { en: "NEDC electric range", ru: "Запас хода NEDC", uz: "NEDC yurish masofasi" },
  WLTC纯电续航里程: { en: "WLTC electric range", ru: "Запас хода WLTC", uz: "WLTC yurish masofasi" },
  百公里耗电量: { en: "Energy consumption /100km", ru: "Расход энергии /100км", uz: "Energiya sarfi /100km" },
  电能当量燃料消耗量: { en: "Equivalent fuel consumption", ru: "Эквивалентный расход топлива", uz: "Ekvivalent yoqilg‘i sarfi" },
  快充功能: { en: "Fast charging", ru: "Быстрая зарядка", uz: "Tez quvvatlash" },
  高压快充: { en: "High-voltage fast charge", ru: "Высоковольтная быстрая зарядка", uz: "Yuqori kuchlanishli tez quvvat" },
  快充功率: { en: "Fast-charge power", ru: "Мощность быстрой зарядки", uz: "Tez quvvat quvvati" },
  快充时间: { en: "Fast-charge time", ru: "Время быстрой зарядки", uz: "Tez quvvat vaqti" },
  电池快充时间: { en: "Fast-charge time", ru: "Время быстрой зарядки", uz: "Tez quvvat vaqti" },
  电池快充电量范围: { en: "Fast-charge range", ru: "Диапазон быстрой зарядки", uz: "Tez quvvat oralig‘i" },
  电池慢充时间: { en: "Slow-charge time", ru: "Время медленной зарядки", uz: "Sekin quvvat vaqti" },
  电池慢充电量范围: { en: "Slow-charge range", ru: "Диапазон медленной зарядки", uz: "Sekin quvvat oralig‘i" },
  快充接口位置: { en: "Fast-charge port", ru: "Расположение порта быстрой зарядки", uz: "Tez quvvat porti" },
  慢充接口位置: { en: "Slow-charge port", ru: "Расположение порта медленной зарядки", uz: "Sekin quvvat porti" },
  高压平台: { en: "Voltage platform", ru: "Вольтаж платформы", uz: "Kuchlanish platformasi" },
  充电桩价格: { en: "Charger price", ru: "Цена зарядной станции", uz: "Quvvatlash stansiyasi narxi" },
  对外交流放电功率: { en: "V2L AC output", ru: "Мощность V2L (AC)", uz: "V2L (AC) quvvati" },
  对外直流放电功率: { en: "V2L DC output", ru: "Мощность V2L (DC)", uz: "V2L (DC) quvvati" },
  换电: { en: "Battery swap", ru: "Замена батареи", uz: "Batareya almashtirish" },
  // transmission
  挡位个数: { en: "Number of gears", ru: "Число передач", uz: "Uzatmalar soni" },
  变速箱类型: { en: "Transmission type", ru: "Тип КПП", uz: "Uzatma turi" },
  变速箱: { en: "Transmission", ru: "Коробка передач", uz: "Uzatmalar qutisi" },
  // engine
  发动机: { en: "Engine", ru: "Двигатель", uz: "Dvigatel" },
  发动机型号: { en: "Engine model", ru: "Модель двигателя", uz: "Dvigatel modeli" },
  发动机布局: { en: "Engine layout", ru: "Расположение двигателя", uz: "Dvigatel joylashuvi" },
  发动机特有技术: { en: "Engine technology", ru: "Технологии двигателя", uz: "Dvigatel texnologiyasi" },
  排量: { en: "Displacement", ru: "Рабочий объём", uz: "Ishchi hajm" },
  进气形式: { en: "Aspiration", ru: "Тип впуска", uz: "Havo olish turi" },
  气缸排列形式: { en: "Cylinder layout", ru: "Расположение цилиндров", uz: "Silindrlar joylashuvi" },
  气缸数: { en: "Cylinders", ru: "Число цилиндров", uz: "Silindrlar soni" },
  每缸气门数: { en: "Valves per cylinder", ru: "Клапанов на цилиндр", uz: "Silindrga klapanlar" },
  配气机构: { en: "Valvetrain", ru: "Газораспределение", uz: "Gaz taqsimlash" },
  压缩比: { en: "Compression ratio", ru: "Степень сжатия", uz: "Siqilish darajasi" },
  缸径: { en: "Bore", ru: "Диаметр цилиндра", uz: "Silindr diametri" },
  行程: { en: "Stroke", ru: "Ход поршня", uz: "Porshen yo‘li" },
  燃油标号: { en: "Fuel grade", ru: "Марка топлива", uz: "Yoqilg‘i markasi" },
  供油方式: { en: "Fuel supply", ru: "Подача топлива", uz: "Yoqilg‘i berish" },
  缸盖材料: { en: "Cylinder head material", ru: "Материал ГБЦ", uz: "Silindr qopqog‘i materiali" },
  缸体材料: { en: "Engine block material", ru: "Материал блока цилиндров", uz: "Silindr bloki materiali" },
  WLTC综合油耗: { en: "WLTC fuel consumption", ru: "Расход топлива WLTC", uz: "WLTC yoqilg‘i sarfi" },
  NEDC综合油耗: { en: "NEDC fuel consumption", ru: "Расход топлива NEDC", uz: "NEDC yoqilg‘i sarfi" },
};

// Categorical VALUES (exact CN string → translations).
export const VALUES = {
  // energy / fuel
  纯电动: { en: "Electric", ru: "Электро", uz: "Elektr" },
  汽油: { en: "Petrol", ru: "Бензин", uz: "Benzin" },
  柴油: { en: "Diesel", ru: "Дизель", uz: "Dizel" },
  插电式混合动力: { en: "Plug-in hybrid", ru: "Подключаемый гибрид", uz: "Plug-in gibrid" },
  油电混合: { en: "Hybrid", ru: "Гибрид", uz: "Gibrid" },
  增程式: { en: "Range-extender", ru: "С увеличителем пробега", uz: "Range-extender" },
  "汽油+CNG": { en: "Petrol + CNG", ru: "Бензин + CNG", uz: "Benzin + CNG" },
  "95号": { en: "95 octane", ru: "АИ-95", uz: "AI-95" },
  "92号": { en: "92 octane", ru: "АИ-92", uz: "AI-92" },
  国VI: { en: "China VI", ru: "Китай VI (≈Евро 6)", uz: "Xitoy VI" },
  // class
  微型车: { en: "City car", ru: "Микро-класс", uz: "Mikro avto" },
  小型车: { en: "Subcompact", ru: "Малый класс", uz: "Kichik avto" },
  紧凑型车: { en: "Compact car", ru: "Компактный класс", uz: "Kompakt avto" },
  中型车: { en: "Mid-size car", ru: "Средний класс", uz: "O‘rta avto" },
  中大型车: { en: "Mid-large car", ru: "Бизнес-класс", uz: "Biznes avto" },
  大型车: { en: "Full-size car", ru: "Представительский класс", uz: "Katta avto" },
  小型SUV: { en: "Small SUV", ru: "Малый SUV", uz: "Kichik SUV" },
  紧凑型SUV: { en: "Compact SUV", ru: "Компактный SUV", uz: "Kompakt SUV" },
  中型SUV: { en: "Mid-size SUV", ru: "Среднеразмерный SUV", uz: "O‘rta SUV" },
  中大型SUV: { en: "Mid-large SUV", ru: "Средне-большой SUV", uz: "O‘rta-katta SUV" },
  大型SUV: { en: "Full-size SUV", ru: "Большой SUV", uz: "Katta SUV" },
  跑车: { en: "Sports car", ru: "Спорткар", uz: "Sport avto" },
  MPV: { en: "MPV", ru: "Минивэн", uz: "Miniven" },
  微面: { en: "Microvan", ru: "Микровэн", uz: "Mikroven" },
  皮卡: { en: "Pickup", ru: "Пикап", uz: "Pikap" },
  // body structure
  三厢车: { en: "Sedan", ru: "Седан", uz: "Sedan" },
  两厢车: { en: "Hatchback", ru: "Хэтчбек", uz: "Xetchbek" },
  掀背车: { en: "Liftback", ru: "Лифтбек", uz: "Liftbek" },
  旅行车: { en: "Wagon", ru: "Универсал", uz: "Universal" },
  软顶敞篷车: { en: "Soft-top convertible", ru: "Кабриолет (мягкий верх)", uz: "Kabriolet (yumshoq tom)" },
  硬顶跑车: { en: "Hardtop coupe", ru: "Купе (жёсткая крыша)", uz: "Kupe (qattiq tom)" },
  硬顶敞篷车: { en: "Hardtop convertible", ru: "Кабриолет (жёсткий верх)", uz: "Kabriolet (qattiq tom)" },
  承载式: { en: "Unibody", ru: "Несущий кузов", uz: "Yagona kuzov" },
  非承载式: { en: "Body-on-frame", ru: "Рамный", uz: "Ramali" },
  // doors
  平开门: { en: "Conventional doors", ru: "Распашные двери", uz: "Oddiy eshiklar" },
  剪刀门: { en: "Scissor doors", ru: "Двери-ножницы", uz: "Qaychi eshiklar" },
  鸥翼门: { en: "Gullwing doors", ru: "Двери «крыло чайки»", uz: "Chaqqon eshiklar" },
  电动侧滑门: { en: "Power sliding doors", ru: "Электрические сдвижные двери", uz: "Elektr suriladigan eshiklar" },
  对开门: { en: "Coach doors", ru: "Двери навстречу", uz: "Qarama-qarshi eshiklar" },
  // motor / drive
  前置: { en: "Front", ru: "Спереди", uz: "Oldinda" },
  后置: { en: "Rear", ru: "Сзади", uz: "Orqada" },
  中置: { en: "Mid", ru: "Центральное", uz: "Markazda" },
  "前置+后置": { en: "Front + rear", ru: "Спереди + сзади", uz: "Old + orqa" },
  单电机: { en: "Single motor", ru: "Один мотор", uz: "Bitta motor" },
  双电机: { en: "Dual motor", ru: "Два мотора", uz: "Ikki motor" },
  三电机: { en: "Tri-motor", ru: "Три мотора", uz: "Uch motor" },
  四电机: { en: "Quad-motor", ru: "Четыре мотора", uz: "To‘rt motor" },
  "永磁/同步": { en: "PMSM", ru: "Синхронный (пост. магниты)", uz: "Doimiy magnitli sinxron" },
  永磁同步电机: { en: "PMSM", ru: "Синхронный (пост. магниты)", uz: "Doimiy magnitli sinxron" },
  "励磁/同步": { en: "Wound-rotor synchronous", ru: "Синхронный (с возбуждением)", uz: "Qo‘zg‘atuvchili sinxron" },
  "交流/异步": { en: "AC induction", ru: "Асинхронный (AC)", uz: "Asinxron (AC)" },
  "前感应/异步 后永磁/同步": { en: "Front induction / Rear PMSM", ru: "Перед — асинхронный, зад — синхронный", uz: "Old — asinxron, orqa — sinxron" },
  // transmission types
  电动车单速变速箱: { en: "Single-speed (EV)", ru: "Односкоростная (EV)", uz: "Bir tezlikli (EV)" },
  固定齿比变速箱: { en: "Fixed-ratio gearbox", ru: "Фиксированное передаточное число", uz: "Belgilangan uzatma" },
  手动变速箱: { en: "Manual", ru: "Механическая (МКПП)", uz: "Mexanik (MKPP)" },
  自动变速箱: { en: "Automatic", ru: "Автоматическая (АКПП)", uz: "Avtomatik (AKPP)" },
  无级变速箱: { en: "CVT", ru: "Вариатор (CVT)", uz: "Variator (CVT)" },
  双离合变速箱: { en: "Dual-clutch (DCT)", ru: "Робот (DCT)", uz: "Robot (DCT)" },
  // aspiration / engine
  涡轮增压: { en: "Turbocharged", ru: "Турбонаддув", uz: "Turbonadduv" },
  自然吸气: { en: "Naturally aspirated", ru: "Атмосферный", uz: "Atmosfera" },
  机械增压: { en: "Supercharged", ru: "Механический наддув", uz: "Mexanik nadduv" },
  "双增压(机械+涡轮)": { en: "Twin-charged", ru: "Двойной наддув", uz: "Ikki nadduv" },
  直喷: { en: "Direct injection", ru: "Прямой впрыск", uz: "To‘g‘ridan-to‘g‘ri in’yeksiya" },
  多点电喷: { en: "Multi-point injection", ru: "Распределённый впрыск", uz: "Ko‘p nuqtali in’yeksiya" },
  混合喷射: { en: "Combined injection", ru: "Комбинированный впрыск", uz: "Aralash in’yeksiya" },
  横置: { en: "Transverse", ru: "Поперечное", uz: "Ko‘ndalang" },
  纵置: { en: "Longitudinal", ru: "Продольное", uz: "Bo‘ylama" },
  铝合金: { en: "Aluminium alloy", ru: "Алюминиевый сплав", uz: "Alumin qotishma" },
  铸铁: { en: "Cast iron", ru: "Чугун", uz: "Cho‘yan" },
  钢: { en: "Steel", ru: "Сталь", uz: "Po‘lat" },
  米勒循环: { en: "Miller cycle", ru: "Цикл Миллера", uz: "Miller sikli" },
  阿特金森循环: { en: "Atkinson cycle", ru: "Цикл Аткинсона", uz: "Atkinson sikli" },
  // battery cooling / tech / names
  液冷: { en: "Liquid-cooled", ru: "Жидкостное охлаждение", uz: "Suyuqlik bilan sovutish" },
  风冷: { en: "Air-cooled", ru: "Воздушное охлаждение", uz: "Havo bilan sovutish" },
  神盾金砖电池: { en: "Blade Shield battery", ru: "Батарея Blade Shield", uz: "Blade Shield batareyasi" },
  第二代金砖电池: { en: "2nd-gen Brick battery", ru: "Батарея Brick (2-е пок.)", uz: "Brick batareyasi (2-avlod)" },
  麒麟电池: { en: "Qilin battery", ru: "Батарея Qilin (CATL)", uz: "Qilin batareyasi (CATL)" },
  麒麟II: { en: "Qilin II", ru: "Qilin II", uz: "Qilin II" },
  刀片电池: { en: "Blade battery", ru: "Батарея Blade (BYD)", uz: "Blade batareyasi (BYD)" },
  三元锂电池: { en: "NMC lithium", ru: "Литий NMC", uz: "Litiy NMC" },
  磷酸铁锂电池: { en: "LFP lithium", ru: "Литий LFP", uz: "Litiy LFP" },
  // suppliers / brands seen in values
  极氪: { en: "Zeekr", ru: "Zeekr", uz: "Zeekr" },
  小米汽车: { en: "Xiaomi", ru: "Xiaomi", uz: "Xiaomi" },
  比亚迪: { en: "BYD", ru: "BYD", uz: "BYD" },
  汇川联合: { en: "Inovance", ru: "Inovance", uz: "Inovance" },
  苏州汇川: { en: "Inovance (Suzhou)", ru: "Inovance (Сучжоу)", uz: "Inovance (Suzhou)" },
  衢州极电: { en: "Zeekr Powertrain", ru: "Zeekr Powertrain", uz: "Zeekr Powertrain" },
  华域电动: { en: "HASCO", ru: "HASCO", uz: "HASCO" },
  联合电子: { en: "UAES", ru: "UAES", uz: "UAES" },
  联合汽车: { en: "UAES", ru: "UAES", uz: "UAES" },
  采埃孚: { en: "ZF", ru: "ZF", uz: "ZF" },
  华晨宝马: { en: "BMW Brilliance", ru: "BMW Brilliance", uz: "BMW Brilliance" },
  "宝马(进口)": { en: "BMW (import)", ru: "BMW (импорт)", uz: "BMW (import)" },
  上汽集团: { en: "SAIC", ru: "SAIC", uz: "SAIC" },
  特斯拉中国: { en: "Tesla China", ru: "Tesla China", uz: "Tesla China" },
  特斯拉: { en: "Tesla", ru: "Tesla", uz: "Tesla" },
  蔚来动力: { en: "NIO Power", ru: "NIO Power", uz: "NIO Power" },
  蔚来: { en: "NIO", ru: "NIO", uz: "NIO" },
  博格华纳: { en: "BorgWarner", ru: "BorgWarner", uz: "BorgWarner" },
  // charge port locations
  车左后侧: { en: "Left rear", ru: "Слева сзади", uz: "Chap orqada" },
  车右后侧: { en: "Right rear", ru: "Справа сзади", uz: "O‘ng orqada" },
  车左前侧: { en: "Left front", ru: "Слева спереди", uz: "Chap oldinda" },
  车右前侧: { en: "Right front", ru: "Справа спереди", uz: "O‘ng oldinda" },
  车头: { en: "Front", ru: "Спереди", uz: "Oldinda" },
  车尾: { en: "Rear", ru: "Сзади", uz: "Orqada" },
  // yes/no/standard
  支持: { en: "Yes", ru: "Есть", uz: "Bor" },
  不支持: { en: "No", ru: "Нет", uz: "Yo‘q" },
  标配: { en: "Standard", ru: "Стандарт", uz: "Standart" },
  选装: { en: "Optional", ru: "Опция", uz: "Opsiya" },
  无: { en: "None", ru: "Нет", uz: "Yo‘q" },
  有: { en: "Yes", ru: "Есть", uz: "Bor" },
  未知: { en: "Unknown", ru: "Неизвестно", uz: "Noma’lum" },
};

// Merge the extended Claude-authored term tables (cn-spec-terms.mjs).
Object.assign(PARAMS, EXTRA_PARAMS);
Object.assign(VALUES, EXTRA_VALUES);

const LANGS = ["en", "ru", "uz"];
const memo = new Map();

function splitUnit(name) {
  const m = String(name).match(/^(.*?)(\s*[（(][^（）()]*[)）])\s*$/);
  return m ? { stem: m[1].trim(), unit: m[2].replace(/（/g, "(").replace(/）/g, ")").replace(/\s+/g, "") } : { stem: String(name).trim(), unit: "" };
}
// translate CJK inside a "(unit)" → "(¥)"/"(h)"/"(pcs)"; Latin units unchanged.
function transUnit(unit) {
  if (!unit) return "";
  let u = unit;
  for (const [cn, en] of Object.entries(UNIT_MAP)) u = u.split(cn).join(en);
  return u;
}

/** Translate one label (group/param name). Returns {en,ru,uz} or null if unknown. */
export function translateLabel(cn) {
  if (GROUPS[cn]) return GROUPS[cn];
  // peel a trailing standard tag that sits AFTER the unit (e.g. 油耗(L/100km)CLTC)
  let tag = "", base = String(cn);
  const tm = base.match(/^(.*[)）])\s*(CLTC|WLTC|NEDC|EPA)$/);
  if (tm) { base = tm[1]; tag = " " + tm[2]; }
  const { stem, unit } = splitUnit(base);
  const hit = PARAMS[stem] || PARAMS[base] || PARAMS[cn];
  if (!hit) return null;
  const u = transUnit(unit);
  return Object.fromEntries(LANGS.map((l) => [l, `${hit[l]}${u ? ` ${u}` : ""}${tag}`]));
}

/** Translate one value. Numeric/Latin pass through; 万/亿 normalized; categorical via dict + composers. */
export function translateValue(cn) {
  const v = String(cn).trim();
  if (!v || v === "-") return { en: v, ru: v, uz: v };
  const wan = v.match(/^([\d.]+)\s*万$/); if (wan) { const n = String(Math.round(parseFloat(wan[1]) * 1e4)); return { en: n, ru: n, uz: n }; }
  const yi = v.match(/^([\d.]+)\s*亿$/); if (yi) { const n = String(Math.round(parseFloat(yi[1]) * 1e8)); return { en: n, ru: n, uz: n }; }
  if (VALUES[v]) return VALUES[v];
  // compositional "N门N座<body>" → "5-door 5-seat SUV"
  const ds = v.match(/^(\d)门(\d)座(.*)$/);
  if (ds) {
    const body = VALUES[ds[3]] || { en: ds[3], ru: ds[3], uz: ds[3] };
    return {
      en: `${ds[1]}-door ${ds[2]}-seat ${body.en}`.trim(),
      ru: `${ds[1]}-дв. ${ds[2]}-мест. ${body.ru}`.trim(),
      uz: `${ds[1]}-eshik ${ds[2]}-o‘rin ${body.uz}`.trim(),
    };
  }
  // "N挡<type>" gearbox, e.g. 7挡湿式双离合 / 8挡手自一体
  const gb = v.match(/^(\d{1,2})挡(.*)$/);
  if (gb) {
    const t = gb[2];
    const map = { 湿式双离合: ["wet DCT", "робот (мокрый)", "ho‘l DCT"], 干式双离合: ["dry DCT", "робот (сухой)", "quruq DCT"], 手自一体: ["automatic", "автомат", "avtomat"], 自动: ["automatic", "автомат", "avtomat"], 手动: ["manual", "механика", "mexanika"], "AMT": ["AMT", "AMT", "AMT"], "CVT": ["CVT", "CVT", "CVT"] };
    const tr = map[t] || [t, t, t];
    return { en: `${gb[1]}-speed ${tr[0]}`, ru: `${gb[1]}-ст. ${tr[1]}`, uz: `${gb[1]}-pog‘onali ${tr[2]}` };
  }
  // compound on "+"/"/"/"、" → translate each part, rejoin
  if (/[+＋/、]/.test(v)) {
    const sep = /[+＋]/.test(v) ? " + " : /、/.test(v) ? ", " : " / ";
    const parts = v.split(/[+＋/、]/).map((p) => p.trim()).filter(Boolean);
    const tp = parts.map((p) => translateValue(p));
    if (parts.length > 1 && tp.every(Boolean)) return { en: tp.map((x) => x.en).join(sep), ru: tp.map((x) => x.ru).join(sep), uz: tp.map((x) => x.uz).join(sep) };
  }
  // embedded-word pass (engine specs: "2.0T 233马力 L4" → "2.0T 233 hp L4")
  let w = v; for (const [re, rep] of VALUE_WORDS) w = w.replace(re, rep);
  w = w.replace(/\s+/g, " ").trim();
  if (w !== v && !/[一-鿿]/.test(w)) return { en: w, ru: w, uz: w };
  if (!/[一-鿿]/.test(v)) return { en: v, ru: v, uz: v }; // pure number/Latin
  // trim-name-shaped values (the 车型名称/Model row) → trim translator (only if it fully resolves)
  if (/款|版|续航|[四后前两]驱|套装|纪念|限量|型|双电机|单电机/.test(v)) { const tn = translateTrimName(v); if (tn && tn !== v && !/[一-鿿]/.test(tn)) return { en: tn, ru: tn, uz: tn }; }
  return null;
}

// --- trim-name translation: drop redundant brand/model CN, translate structural tokens ---
const TRIM_TR = [
  // brand/model CN prefixes (redundant — car already has brand+model)
  [/极氪|小米汽车|小米|比亚迪|蔚来|小鹏|理想|问界|阿维塔|腾势|宝马|奥迪|奔驰|保时捷|大众|丰田|本田|领克|吉利|奇瑞|长安|哈弗|坦克|捷途|红旗|名爵|smart|岚图|极星|智己|深蓝/g, ""],
  // multi-token packages first (longest)
  [/五周年纪念版?/g, " 5th Anniversary"], [/M运动曜夜套装/g, " M Sport Shadowline"], [/曜夜运动套装/g, " Shadowline Sport"],
  [/敞篷M运动曜夜套装/g, " M Sport Shadowline Cabrio"], [/敞篷M运动套装/g, " M Sport Cabrio"], [/敞篷锋芒限量版?/g, " Edge Limited Cabrio"],
  [/M运动套装/g, " M Sport"], [/运动套装/g, " Sport"], [/曜夜套装/g, " Shadowline"], [/套装/g, " Package"],
  [/传奇四驱红篷版?/g, " Legend AWD Red-Roof"], [/传奇四驱版?/g, " Legend AWD"], [/锋芒限量版?/g, " Edge Limited"],
  [/魅力心动版?/g, " Charm"], [/超然致远版?/g, " Premium"],
  // structure tokens
  [/(\d+)\s*度/g, " $1kWh "], [/四驱/g, " AWD "], [/后驱/g, " RWD "], [/前驱|两驱/g, " FWD "],
  [/超长续航版?/g, " Extended Range"], [/长续航版?/g, " Long Range"], [/标准续航版?/g, " Standard Range"], [/标准版?/g, " Standard"],
  [/豪华版?/g, " Luxury"], [/旗舰版?/g, " Flagship"], [/尊享版?/g, " Premium"], [/尊贵版?/g, " Premium"], [/智驾版?/g, " ADAS"],
  [/纪念版?/g, " Anniversary"], [/限量版?/g, " Limited"], [/创始版?/g, " Founder"], [/性能版?/g, " Performance"],
  [/敞篷/g, " Convertible"], [/硬顶/g, " Hardtop"], [/软顶/g, " Soft-top"],
  [/改款/g, " (facelift)"], [/新款/g, ""], [/(20\d\d)款/g, "$1"], [/款/g, ""], [/版/g, ""],
];
const TRIM_WORDS_SORTED = Object.entries(TRIM_WORDS).sort((a, b) => b[0].length - a[0].length);
export function translateTrimName(name) {
  let t = ` ${String(name || "")} `;
  for (const [re, rep] of TRIM_TR) t = t.replace(re, rep);
  for (const [cn, en] of TRIM_WORDS_SORTED) if (t.includes(cn)) t = t.split(cn).join(en ? ` ${en} ` : " ");
  t = t.replace(/马力/g, "hp");
  return t.replace(/\s+/g, " ").trim() || String(name || "");
}

/**
 * Translate a whole SpecData into {en,ru,uz} views. Known terms from the dict;
 * trim names via translateTrimName; unknown CN terms handed to translateUnknown()
 * (optional injected LLM) and cached; absent → raw CN passes through (fail-open).
 */
export async function translateSpec(spec, { translateUnknown } = {}) {
  const unknownLabels = new Set(), unknownValues = new Set();
  for (const g of spec.groups) if (!translateLabel(g)) unknownLabels.add(g);
  for (const t of spec.trims) for (const [gn, sec] of Object.entries(t.params)) {
    if (!translateLabel(gn)) unknownLabels.add(gn);
    for (const [pn, pv] of Object.entries(sec)) {
      if (!translateLabel(pn)) unknownLabels.add(pn);
      if (translateValue(pv) === null) unknownValues.add(pv);
    }
  }
  const extra = {};
  const pending = [...unknownLabels, ...unknownValues].filter((x) => !memo.has(x));
  if (pending.length && typeof translateUnknown === "function") {
    try { const got = (await translateUnknown(pending)) || {}; for (const [cn, tr] of Object.entries(got)) if (tr) memo.set(cn, tr); } catch { /* fail-open */ }
  }
  for (const cn of [...unknownLabels, ...unknownValues]) if (memo.has(cn)) extra[cn] = memo.get(cn);

  const tl = (cn) => translateLabel(cn) || extra[cn] || { en: cn, ru: cn, uz: cn };
  const tv = (cn) => translateValue(cn) || extra[cn] || { en: cn, ru: cn, uz: cn };
  const trimName = (n) => translateTrimName(n);
  const cleanPrice = (raw) => {
    if (!raw) return null;
    const s = String(raw).trim();
    const m = s.match(/^([\d.]+)\s*万$/); if (m) return "¥" + Math.round(parseFloat(m[1]) * 1e4).toLocaleString("en-US");
    return /[一-鿿]/.test(s) ? null : s; // 暂无报价 etc → no price
  };

  const render = (lang) => ({
    groups: spec.groups.map((g) => tl(g)[lang]),
    trims: spec.trims.map((t) => ({
      specid: t.specid, name: trimName(t.name), price_raw: cleanPrice(t.price_raw),
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
