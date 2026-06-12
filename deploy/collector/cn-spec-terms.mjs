/**
 * AutoHome CN → RU/UZ/EN extended terms (Claude-authored, hand-translated).
 * Companion to cn-spec-dict.mjs — covers the long tail found across the real catalog:
 * missing technical params, CJK units, ~140 categorical/supplier/battery values, and
 * ~200 marketing trim words. Goal: ZERO Chinese leftovers, deterministic, no LLM/cost.
 */
const tri = (en, ru, uz) => ({ en, ru, uz });
const same = (s) => ({ en: s, ru: s, uz: s }); // proper nouns (brands/suppliers): same across locales

// ---- extra param stems ----
export const EXTRA_PARAMS = {
  最低荷电状态油耗: tri("Fuel use (min charge)", "Расход (мин. заряд)", "Sarf (min zaryad)"),
  CLTC综合续航: tri("CLTC combined range", "Запас хода CLTC", "CLTC umumiy masofa"),
  CLTC综合油耗: tri("CLTC fuel consumption", "Расход CLTC", "CLTC yoqilg‘i sarfi"),
  NEDC综合续航: tri("NEDC combined range", "Запас хода NEDC", "NEDC umumiy masofa"),
  WLTC综合续航: tri("WLTC combined range", "Запас хода WLTC", "WLTC umumiy masofa"),
  系统综合功率: tri("System total power", "Суммарная мощность системы", "Tizim umumiy quvvati"),
  系统综合马力: tri("System total horsepower", "Суммарная мощность (л.с.)", "Tizim umumiy ot kuchi"),
  系统综合扭矩: tri("System total torque", "Суммарный момент системы", "Tizim umumiy momenti"),
  最大涉水深度: tri("Max wading depth", "Глубина преодол. брода", "Suv kechish chuqurligi"),
  油电综合燃料消耗量: tri("Combined fuel consumption", "Расход (гибрид)", "Aralash yoqilg‘i sarfi"),
  对外放电最低允许值: tri("Min charge for V2L", "Мин. заряд для V2L", "V2L uchun min zaryad"),
  实测续航里程: tri("Tested range", "Запас хода (тест)", "Sinov masofasi"),
  "实测0-100km/h加速": tri("Tested 0–100 km/h", "0–100 км/ч (тест)", "0–100 km/soat (sinov)"),
  "实测100-0km/h制动": tri("Tested 100–0 km/h braking", "Торможение 100–0 (тест)", "100–0 tormoz (sinov)"),
  "官方0-50km/h加速": tri("0–50 km/h acceleration", "Разгон 0–50 км/ч", "0–50 km/soat"),
  最大爬坡度: tri("Max gradeability", "Макс. преодол. подъём", "Maks. ko‘tarilish"),
  最大爬坡角度: tri("Max climb angle", "Макс. угол подъёма", "Maks. ko‘tarilish burchagi"),
  纵向通过角: tri("Ramp breakover angle", "Угол рампы", "Rampa burchagi"),
};

// ---- CJK units inside "(...)" ----
export const UNIT_MAP = { 元: "¥", 小时: "h", 个: "pcs", 千米: "km", 公里: "km" };

// ---- embedded words: replace inside any value string (engine specs etc.) ----
// applied as plain substring replacements BEFORE the dict lookup.
export const VALUE_WORDS = [
  [/马力/g, " hp"], [/增程器/g, "Range extender"], [/纯电动/g, "Electric"], [/增程式/g, "REEV"],
  [/轻混系统/g, "mild hybrid"], [/汽油/g, "Petrol"], [/柴油/g, "Diesel"],
];

// ---- extra categorical values (EN/RU/UZ) ----
export const EXTRA_VALUES = {
  // transmissions
  "手自一体变速箱(AT)": tri("Automatic (AT)", "Автомат (AT)", "Avtomat (AT)"),
  "自动变速箱(AT)": tri("Automatic (AT)", "Автомат (AT)", "Avtomat (AT)"),
  "手动变速箱(MT)": tri("Manual (MT)", "Механика (MT)", "Mexanika (MT)"),
  "无级变速箱(CVT)": tri("CVT", "Вариатор (CVT)", "Variator (CVT)"),
  无级变速: tri("CVT", "Вариатор", "Variator"),
  "CVT无级变速(模拟10挡)": tri("CVT (10 sim. gears)", "Вариатор (10 имит. передач)", "CVT (10 taqlid)"),
  "E-CVT无级变速": tri("E-CVT", "E-CVT", "E-CVT"),
  "电子无级变速箱(E-CVT)": tri("E-CVT", "E-CVT", "E-CVT"),
  "湿式双离合变速箱(DCT)": tri("Wet DCT", "Робот мокрый (DCT)", "Ho‘l DCT"),
  "干式双离合变速箱(DCT)": tri("Dry DCT", "Робот сухой (DCT)", "Quruq DCT"),
  "混合动力专用变速箱(DHT)": tri("Hybrid DHT", "Гибридный (DHT)", "Gibrid DHT"),
  // body
  中型MPV: tri("Mid-size MPV", "Средний минивэн", "O‘rta miniven"),
  中大型MPV: tri("Mid-large MPV", "Большой минивэн", "Katta miniven"),
  紧凑型MPV: tri("Compact MPV", "Компактный минивэн", "Kompakt miniven"),
  SUV跨界车: tri("SUV crossover", "Кроссовер", "Krossover"),
  四门轿跑车: tri("4-door coupe", "4-дверное купе", "4-eshik kupe"),
  双门轿跑车: tri("2-door coupe", "2-дверное купе", "2-eshik kupe"),
  轿跑车: tri("Coupe", "Купе", "Kupe"),
  // motor type compounds
  "前交流/异步 后励磁/同步": tri("Front induction / Rear wound-rotor", "Перед — асинхр., зад — синхр.", "Old — asinxron, orqa — sinxron"),
  "前交流/异步 后永磁/同步": tri("Front induction / Rear PMSM", "Перед — асинхр., зад — синхр.", "Old — asinxron, orqa — PMSM"),
  "前永磁/同步 后交流/异步": tri("Front PMSM / Rear induction", "Перед — синхр., зад — асинхр.", "Old — PMSM, orqa — asinxron"),
  永磁: tri("PMSM", "Синхронный", "Sinxron"),
  // doors
  侧滑门: tri("Sliding door", "Сдвижная дверь", "Suriluvchi eshik"),
  // cooling
  直冷: tri("Direct cooling", "Прямое охлаждение", "To‘g‘ridan sovutish"),
  冷媒直冷: tri("Refrigerant direct cooling", "Хладагентное охлаждение", "Sovutgich bilan sovutish"),
  // fuel
  "92号": tri("92 octane", "АИ-92", "AI-92"),
  "汽油+48V轻混系统": tri("Petrol + 48V mild hybrid", "Бензин + 48В мягкий гибрид", "Benzin + 48V mild gibrid"),
  // batteries
  刀片电池: same("Blade battery"), 第二代刀片电池: same("2nd-gen Blade battery"),
  金钟罩电池: tri("Golden Bell battery", "Батарея Golden Bell", "Golden Bell batareyasi"),
  骁遥电池: same("Xiaoyao battery"), "骁遥超级增·混电池": same("Xiaoyao hybrid battery"),
  巨鲸电池: tri("Giant Whale battery", "Батарея Giant Whale", "Giant Whale batareyasi"),
  琥珀电池系统: tri("Amber battery", "Батарея Amber", "Amber batareyasi"),
  金砖电池: same("Brick battery"), 磷酸铁锂: same("LFP"), 三元锂: same("NMC"),
  "5C超充AI电池": same("5C ultra-fast AI battery"),
  // descriptive
  采用阻燃材料和热失控保护技术: tri("Flame-retardant + thermal-runaway protection", "Огнестойкие материалы + защита от перегрева", "Yong‘inga chidamli + termal himoya"),
  "底部防弹涂层、CTB一体化电池技术": tri("Bulletproof underbody, CTB battery", "Бронепокрытие днища, батарея CTB", "Zirhli tag, CTB batareya"),
  准900: same("≈900V"),
  双涡轮增压: tri("Twin-turbo", "Битурбо", "Ikki turbo"), 四涡轮增压: tri("Quad-turbo", "Кватротурбо", "To‘rt turbo"),
  // brands / OEMs (proper nouns)
  长安汽车: same("Changan"), 长安启源: same("Changan Qiyuan"), 长安马自达: same("Changan Mazda"),
  零跑汽车: same("Leapmotor"), 金华零跑新能源: same("Leapmotor (Jinhua)"),
  广汽丰田: same("GAC Toyota"), 一汽丰田: same("FAW Toyota"), 广汽传祺: same("GAC Trumpchi"),
  "一汽-大众": same("FAW-VW"), 一汽奥迪: same("FAW Audi"), 一汽红旗: same("FAW Hongqi"),
  上汽大众: same("SAIC-VW"), 上汽通用: same("SAIC-GM"), 上汽通用别克: same("SAIC-GM Buick"),
  大众汽车: same("Volkswagen"), 北京奔驰: same("Beijing Benz"), "奔驰(进口)": same("Mercedes (import)"),
  北京汽车: same("BAIC"), 东风本田: same("Dongfeng Honda"), 腾势汽车: same("Denza"),
  岚图汽车: same("Voyah"), 智己汽车: same("IM Motors"), 阿维塔科技: same("Avatr"),
  理想汽车: same("Li Auto"), 小鹏汽车: same("XPeng"), 武汉小鹏: same("XPeng (Wuhan)"),
  合众汽车: same("Hozon"), 吉利几何: same("Geely Geometry"), 仰望: same("Yangwang"),
  "特斯拉（进口）": same("Tesla (import)"), 捷尼赛思: same("Genesis"), 深蓝汽车: same("Deepal"),
  "AITO 问界": same("AITO"), "STELATO 享界": same("Stelato"), "MAEXTRO 尊界": same("Maextro"),
  华为: same("Huawei"), 华为技术: same("Huawei"), 华为数字: same("Huawei Digital"), 宝马M: same("BMW M"),
  // motor / battery suppliers (proper nouns; best-known romanization)
  弗迪: same("FinDreams"), 弗迪动力: same("FinDreams Power"), 威睿电动: same("Viridi E-Power"), 威睿: same("Viridi"),
  蔚然动力: same("XPT"), 精进电动: same("Jing-Jin"), 精进: same("Jing-Jin"), "日本电产/尼得科": same("Nidec"),
  采埃孚电驱动科技: same("ZF E-Drive"), "汇川联合/巨一动力": same("Inovance / JEE"), 巨一动力: same("JEE"),
  华域汽车: same("HASCO"), 联合汽车电子: same("UAES"), 格雷博智能动力: same("Greatpower"),
  立讯智造: same("Luxshare"), 菲仕绿能: same("Phase Motion"), "菲仕绿能/无锡中车浩夫尔": same("Phase / CRRC-Hofer"),
  无锡中车浩夫尔: same("CRRC-Hofer"), "无锡中车浩夫尔/上海电驱动": same("CRRC-Hofer / Edrive"),
  常州汇想: same("Huixiang"), "常州汇想/蜂巢电驱": same("Huixiang / SVOLT"), 合普动力: same("Hope Power"),
  浙江鑫可: same("Xinke"), 金华凌昇: same("Lingsheng"), 上海电驱动: same("Edrive"), 蔚来动力: same("NIO Power"),
};

// ---- marketing trim words (EN only — trim names render the same across locales) ----
export const TRIM_WORDS = {
  // structural
  款: "", 版: "", 型: "", 系: "", 级: "", 第三代: "Gen3", 第二代: "Gen2", 第四代: "Gen4",
  七座: "7-seat", 六座: "6-seat", 五座: "5-seat", 四座: "4-seat", 座: "-seat",
  后轮驱动: "RWD", 全轮驱动: "AWD", 前轮驱动: "FWD", 四轮驱动: "4WD", 双电机全轮驱动: "Dual-motor AWD",
  单电机: "Single-motor", 双电机: "Dual-motor", 三电机: "Tri-motor", 超级四电: "Quad-motor",
  增程: "REEV", 纯电: "EV", 换电: "Swap", 磷酸铁锂: "LFP", 三元锂: "NMC",
  超长蓝鲸增程: "Long-range Bluewhale REEV", 超长蓝鲸纯电: "Long-range Bluewhale EV", 新蓝鲸: "New Bluewhale", 蓝鲸: "Bluewhale",
  激光雷达: "LiDAR", 线激光雷达: "LiDAR", 双激光: "Dual-LiDAR", 双激光猎影: "Dual-LiDAR", 双激光尊荣: "Dual-LiDAR Premium",
  // tiers / marketing
  悦享: "Comfort", 悦尚: "Style", 悦领: "Premier", 悦动: "Dynamic", 悦风: "Breeze", 悦潮: "Trend",
  逸风: "Breeze", 逸尚: "Vogue", 逸潮: "Trend", 舒享: "Comfort", 舒适: "Comfort", 优享: "Plus", 越享: "Premium",
  至享: "Premium", 至尊: "Ultimate", 尊享: "Premium", 尊荣: "Premium", 尊贵: "Luxury", 尊航: "Premier", 尊界: "Maextro",
  旗舰: "Flagship", 精英: "Elite", 领先: "Leading", 卓越: "Excellence", 时尚: "Style", 进取: "Aspire",
  致雅: "Elegant", 雅悦: "Elegance", 尚悦: "Comfort", 嘉悦: "Joy", 尊悦: "Premium",
  动感: "Dynamic", 经典: "Classic", 运动: "Sport", 高配: "High", 基本: "Base", 标准: "Standard",
  高能: "High-power", 劲速: "Speed", 劲擎: "Power", 智慧领航: "Smart Pilot", 智享: "Smart", 智行: "Smart Drive",
  智联: "Connected", 智驾: "ADAS", 智能电混双擎: "Smart Hybrid", 智能焕新: "Smart Refresh", 焕新: "Refresh",
  新智: "New Smart", 新享: "New Plus", 新乐: "New Joy", 新趣: "New Fun", 新享型: "New Plus",
  // brand-specific marketing
  黑武士: "Black Knight", 暗夜骑士: "Dark Knight", 暗黑骑士: "Dark Knight", 皇家剧院: "Royal Theater",
  光辉: "Glory", 光辉典藏: "Glory Collector", 典藏: "Collector", 典藏大观: "Grand Collector", 签名: "Signature",
  行政: "Executive", 行政签名: "Executive Signature", 公务: "Business", 旷野: "Wilderness", 远山: "Mountain",
  秘境: "Wonderland", 荣耀: "Honor", 倾心: "Charm", 倾慕: "Adore", 倾城: "Stunning", 星辉: "Starlight",
  星耀: "Starshine", 星辉行政: "Starlight Executive", 星耀行政: "Starshine Executive", 曜黑: "Eclipse Black",
  曜影: "Shadow", 曜黑: "Eclipse", 皓夜: "Bright Night", 皓夜运动: "Bright Night Sport",
  自然奇境: "Natural Wonder", 无忧穿越: "Carefree Tour", 易三方: "e³", 闪充: "Flash-charge", 超充: "Ultra-charge",
  闪充尊荣: "Flash-charge Premium", 易三方闪充尊荣: "e³ Flash-charge Premium", 易三方闪充: "e³ Flash-charge", 闪充尊荣型: "Flash-charge Premium",
  天枢: "Tianshu", 乾崑: "Qiankun", 领航: "Pilot", 智慧领航型: "Smart Pilot", 领世: "Lingshi", 领世加长: "Lingshi LWB",
  创行: "Pioneer", 创境: "Vision", 创境曜夜: "Vision Shadowline", 创享曜夜: "Share Shadowline", 创领: "Lead",
  四座创领: "4-seat Lead", 经典运动: "Classic Sport", 经典运动型: "Classic Sport", 运动经典: "Sport Classic",
  运动特别: "Sport Special", 运动定制: "Sport Custom", 时尚运动: "Style Sport", 时尚动感: "Style Dynamic",
  进取动感: "Aspire Dynamic", 进取致雅: "Aspire Elegant", 时尚致雅: "Style Elegant", 套件燃速: "Pack Turbo",
  套件: "Pack", 燃速: "Turbo", 出众: "Outstanding", 极智: "Smart Pro", 聪明: "Smart", 纯净智享: "Pure Smart",
  纯净: "Pure", 纯享: "Pure", 远空: "Skyline", 限定: "Limited", 臻选: "Select", 臻享: "Premium",
  臻享标续影音: "Premium Std AV", 臻选型: "Select", 时尚型: "Style", 优享出行: "Plus Mobility", 出行: "Mobility",
  优享型: "Plus", 越享型: "Premium", 至享型: "Premium", 至尊型: "Ultimate", 尊荣型: "Premium", 尊航型: "Premier",
  卓越型: "Excellence", 精英型: "Elite", 领先型: "Leading", 舒适型: "Comfort", 动感型: "Dynamic",
  劲速型: "Speed", 劲擎型: "Power", 运动型: "Sport", 基本型: "Base", 旅行升级: "Travel Plus", 旅行: "Travel",
  全球行: "Global", 升级: "Plus", 特别: "Special", 科技: "Tech", 探索: "Explore", 环游: "Tour",
  畅行: "Cruise", 畅优: "Cruise Plus", 挑战: "Challenge", 秀: "Show", 公务舱: "Business",
  增程精英: "REEV Elite", 增程运动: "REEV Sport", 纯电精英: "EV Elite", 纯电运动: "EV Sport",
  增程精英型: "REEV Elite", 增程运动型: "REEV Sport", 纯电精英型: "EV Elite", 纯电运动型: "EV Sport",
  领航系列: "Pilot Series", 旗悦: "Joy", 旗享: "Plus", 旗畅: "Cruise", 旗领: "Lead",
  齐家: "Family", 轻年: "Youth", 七座过道: "7-seat aisle", 六座行政: "6-seat Executive",
  六座行政签名: "6-seat Exec Signature", 七座行政: "7-seat Executive", 哪吒: "", 几何: "", 零跑: "", 启源: "",
  荣威: "", 传祺: "", 别克: "", 北京: "", 马自达: "", 享界: "", 捷尼赛思: "", 仰望: "", 智享家: "Smart Home",
  粉色定制: "Pink Edition", 行业: "Fleet", 先享: "First Plus", 先锋: "Pioneer", 创领型: "Lead", 旷野版: "Wilderness",
  超长续航: "Extended Range", 长续航: "Long Range", 标准续航: "Standard Range", 双门: "2-door", 四门: "4-door",
  手动: "Manual", 自动: "Auto", 智尊: "Premium", 智享版: "Smart", 尊享版: "Premium",
  敞篷轿跑车: "Convertible Coupe", 四门轿跑车: "4-door Coupe", 双门轿跑车: "2-door Coupe", 轿跑车: "Coupe", 轿跑: "Coupe",
  新能源: "", 黑: "Black", 高: "High", 二: "II", 动: "Dynamic", 境: "Realm", 驰: "Drive", 潮: "Trend",
  签名版: "Signature", 远空版: "Skyline", 自然奇境版: "Natural Wonder",
};
