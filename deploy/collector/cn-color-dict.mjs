/**
 * CN car-colour names → RU/UZ/EN. Hand-built (no LLM): a compositional translator —
 * marketing colours are modifier+base (珍珠白 = pearl + white, 星空灰 = starry + grey).
 * Exact overrides first, then modifier+base compose, then fall back to the CN name.
 * Dual-tone "黑色/白色" → translate each side, join with " / ".
 */

const BASE = {
  "白": { ru: "белый", uz: "oq", en: "White" },
  "黑": { ru: "чёрный", uz: "qora", en: "Black" },
  "灰": { ru: "серый", uz: "kulrang", en: "Grey" },
  "银": { ru: "серебристый", uz: "kumush", en: "Silver" },
  "蓝": { ru: "синий", uz: "ko'k", en: "Blue" },
  "红": { ru: "красный", uz: "qizil", en: "Red" },
  "绿": { ru: "зелёный", uz: "yashil", en: "Green" },
  "金": { ru: "золотистый", uz: "oltin", en: "Gold" },
  "棕": { ru: "коричневый", uz: "jigarrang", en: "Brown" },
  "咖": { ru: "кофейный", uz: "jigarrang", en: "Coffee" },
  "紫": { ru: "фиолетовый", uz: "binafsha", en: "Purple" },
  "橙": { ru: "оранжевый", uz: "to'q sariq", en: "Orange" },
  "粉": { ru: "розовый", uz: "pushti", en: "Pink" },
  "黄": { ru: "жёлтый", uz: "sariq", en: "Yellow" },
  "米": { ru: "бежевый", uz: "bej", en: "Beige" },
};
// modifier morphemes (prefix before the base colour)
const MOD = {
  "珍珠": { ru: "жемчужный", uz: "marvarid", en: "Pearl" },
  "星空": { ru: "звёздный", uz: "yulduzli", en: "Starry" },
  "星钻": { ru: "бриллиантовый", uz: "olmos", en: "Diamond" },
  "冰河": { ru: "ледниковый", uz: "muzlik", en: "Glacier" },
  "冰川": { ru: "ледниковый", uz: "muzlik", en: "Glacier" },
  "烈焰": { ru: "огненный", uz: "olovli", en: "Flame" },
  "天空": { ru: "небесный", uz: "osmon", en: "Sky" },
  "深空": { ru: "тёмно-космический", uz: "chuqur kosmik", en: "Deep Space" },
  "暗夜": { ru: "ночной", uz: "tungi", en: "Midnight" },
  "曜": { ru: "сияющий", uz: "yarqiroq", en: "Obsidian" },
  "皓": { ru: "сияющий", uz: "yorqin", en: "Bright" },
  "云": { ru: "облачный", uz: "bulutli", en: "Cloud" },
  "雪": { ru: "снежный", uz: "qorli", en: "Snow" },
  "极地": { ru: "полярный", uz: "qutbiy", en: "Polar" },
  "钛": { ru: "титановый", uz: "titan", en: "Titanium" },
  "玫瑰": { ru: "розовый", uz: "atirgul", en: "Rose" },
  "香槟": { ru: "шампань", uz: "shampan", en: "Champagne" },
  "珊瑚": { ru: "коралловый", uz: "marjon", en: "Coral" },
  "翡翠": { ru: "изумрудный", uz: "zumrad", en: "Emerald" },
};
// full-name exact overrides where compose would read awkwardly
const EXACT = {
  "快银": { ru: "Quicksilver (серебристый)", uz: "Quicksilver (kumush)", en: "Quicksilver" },
};

const pick = (s) => ["ru", "uz", "en"].reduce((o, k) => ((o[k] = s[k]), o), {});

function one(name) {
  const n = name.replace(/色$/, "").trim(); // drop trailing 色
  if (EXACT[name]) return pick(EXACT[name]);
  // try modifier + base
  for (const mod of Object.keys(MOD).sort((a, b) => b.length - a.length)) {
    if (n.startsWith(mod) && MOD[mod].en) {
      const rest = n.slice(mod.length);
      for (const b of Object.keys(BASE)) if (rest.includes(b)) {
        const m = MOD[mod], base = BASE[b];
        return { ru: `${m.ru} ${base.ru}`, uz: `${m.uz} ${base.uz}`, en: `${m.en} ${base.en}` };
      }
      return { ru: MOD[mod].ru, uz: MOD[mod].uz, en: MOD[mod].en };
    }
  }
  // base only (longest base char present)
  for (const b of Object.keys(BASE)) if (n.includes(b)) return pick(BASE[b]);
  return null;
}

/** Returns { name_ru, name_uz, name_en } for a CN colour name (dual-tone aware). */
export function translateColor(nameCn) {
  const parts = String(nameCn).split("/").map((s) => s.trim()).filter(Boolean);
  const tr = parts.map((p) => one(p) || { ru: p, uz: p, en: p });
  return {
    name_ru: tr.map((t) => t.ru).join(" / "),
    name_uz: tr.map((t) => t.uz).join(" / "),
    name_en: tr.map((t) => t.en).join(" / "),
  };
}
