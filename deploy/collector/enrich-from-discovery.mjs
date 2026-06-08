/**
 * Enrichment orchestration (Phase GONZO) — match the competitor discovery list to
 * AutoHome series, DRY-RUN by default (no DB writes).
 *
 * Flow: gonzo-discovery.json (cars) + autohome-index.json (537 brands / 5693 series)
 *   → brand alias (Latin→Chinese) + model-token match → confidence-scored matches
 *   → match report (CSV + JSON) for review. Confident matches → autohome-targets.json
 *     ({ url: config/series/{id}, gonzoName, gonzoPrice }) to feed autohome-crawlee.mjs.
 *
 * With --validate=N: actually decode the top N confident matches (autohome-extract.mjs)
 * to prove the end-to-end chain. NO DB writes here — publishing is a later, gated step.
 *
 * Usage:
 *   node enrich-from-discovery.mjs                 # build/refresh index if needed + match report
 *   node enrich-from-discovery.mjs --validate=3    # + decode the top 3 to prove the chain
 *   node enrich-from-discovery.mjs --refresh-index # rebuild the AutoHome index first
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { loadAutohomeIndex } from "./autohome-index.mjs";
import { extractAutohomeSpec, openBrowser } from "./autohome-extract.mjs";
import { log } from "./crawlee-shared.mjs";

const ARGS = process.argv.slice(2);
const VALIDATE = Number((ARGS.find((a) => a.startsWith("--validate=")) || "").split("=")[1] || 0);
const REFRESH = ARGS.includes("--refresh-index");
const DISCOVERY = process.env.GONZO_DISCOVERY || "./gonzo-discovery.json";

// Latin brand → Chinese brand name(s) as they appear in the AutoHome index.
// Multi-word keys (e.g. "land rover") are matched by longest-prefix in parseGonzo.
const BRAND_ALIAS = {
  zeekr: ["极氪"], xiaomi: ["小米"], byd: ["比亚迪"], nio: ["蔚来"], xpeng: ["小鹏"],
  li: ["理想"], lixiang: ["理想"], liauto: ["理想"], aito: ["问界", "AITO"], avatr: ["阿维塔"],
  mg: ["MG", "名爵"], bmw: ["宝马"], porsche: ["保时捷"], audi: ["奥迪"], "mercedes": ["奔驰"],
  "mercedes-benz": ["奔驰"], benz: ["奔驰"], ferrari: ["法拉利"], tesla: ["特斯拉"], lexus: ["雷克萨斯"],
  toyota: ["丰田"], honda: ["本田"], volkswagen: ["大众"], vw: ["大众"], volvo: ["沃尔沃"],
  geely: ["吉利", "吉利银河"], chery: ["奇瑞"], changan: ["长安", "深蓝"], hongqi: ["红旗"], gac: ["广汽", "埃安", "传祺"],
  aion: ["埃安"], bentley: ["宾利"], lamborghini: ["兰博基尼"], maserati: ["玛莎拉蒂"],
  rolls: ["劳斯莱斯"], "rolls-royce": ["劳斯莱斯"], "rolls royce": ["劳斯莱斯"],
  landrover: ["路虎"], "land rover": ["路虎"], "range rover": ["路虎"], jaguar: ["捷豹"],
  "aston martin": ["阿斯顿马丁"], "aston": ["阿斯顿马丁"], mclaren: ["迈凯伦"],
  cadillac: ["凯迪拉克"], lynkco: ["领克"], "lynk": ["领克"], "lynk&co": ["领克"], hyundai: ["现代"], kia: ["起亚"],
  jetour: ["捷途"], haval: ["哈弗"], tank: ["坦克"], wuling: ["五菱"], denza: ["腾势"],
  smart: ["smart"], voyah: ["岚图"], polestar: ["极星"], "rising": ["飞凡"], feifan: ["飞凡"], im: ["智己"],
  zhiji: ["智己"], jishi: ["极石"], leapmotor: ["零跑"], neta: ["哪吒"], baojun: ["宝骏"],
  genesis: ["捷尼赛思"], dongfeng: ["东风"], saic: ["上汽"], buick: ["别克"], beijing: ["北京"],
  mazda: ["马自达"], chevrolet: ["雪佛兰"], chevy: ["雪佛兰"], ora: ["欧拉"], roewe: ["荣威"],
  aiways: ["爱驰"], hiphi: ["高合"], farizon: ["远程"], shenlan: ["深蓝"], deepal: ["深蓝"],
  exeed: ["星途"], jaecoo: ["捷酷", "Jaecoo"], omoda: ["欧萌达", "OMODA"], skywell: ["天美"],
  jmc: ["江铃"], foton: ["福田"], gwm: ["长城"], "great wall": ["长城"], luxeed: ["享界"], stelato: ["享界"],
  maextro: ["尊界"], forthing: ["东风风行"], skyworth: ["创维"], nissan: ["日产"], mini: ["MINI"], "mercedes-amg": ["AMG", "奔驰"],
  yangwang: ["仰望"], maxus: ["大通"], qiyuan: ["启源"], radar: ["雷达"], mitsubishi: ["三菱"],
  weltmeister: ["威马"], hyndai: ["现代"], onvo: ["乐道"], yuanhang: ["远航"], hechuang: ["合创"],
  ford: ["福特"], "saic maxus": ["大通"], arcfox: ["极狐"],
};
// Latin model → Chinese (for fully-Chinese model names: BYD dynasties, Land Rover, etc.).
// Matched against the FIRST word of the Gonzo model (so "Tang L" → 唐).
const MODEL_ALIAS = {
  han: "汉", tang: "唐", song: "宋", qin: "秦", yuan: "元", seal: "海豹", dolphin: "海豚",
  destroyer: "驱逐舰", frigate: "护卫舰", leopard: "豹", sealion: "海狮", seagull: "海鸥",
  // Voyah (岚图), Ora cats, Buick Velite, Cadillac, etc.
  dreamer: "梦想家", taishan: "泰山", courage: "知音", velite: "微蓝", lyriq: "锐歌",
  mulan: "木兰", carnival: "嘉华", bingo: "缤果", mistra: "名图",
  // Land Rover lines
  range: "揽胜", defender: "卫士", discovery: "发现", evoque: "极光", velar: "星脉",
};

const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
// strip spaces/hyphens/dots (so VW "ID.4" ↔ "ID4") and year/款 noise.
const modelKey = (s) => norm(s).replace(/[\s\-_/.]+/g, "").replace(/20\d\d款?/g, "").replace(/(款|新款|改款)/g, "");

// Sub-brands sold under a parent on Gonzo but listed as their own AutoHome brand:
// "SAIC Maxus MIFA 9" → maxus, "BYD Yangwang U8" → yangwang, "Changan Shenlan S7" → shenlan.
const SUBBRANDS = new Set(["maxus", "yangwang", "shenlan", "deepal", "aion", "qiyuan", "onvo"]);
// Embedded CN model lines matched by substring (multi-word / not the first token).
const CONTAINS_ALIAS = {
  "sea lion": "海狮", sealion: "海狮", seagull: "海鸥", "good cat": "好猫", "lightning cat": "闪电猫",
  dreamer: "梦想家", "chasing light": "追光", courage: "知音", taishan: "泰山", velite: "微蓝",
  lyriq: "锐歌", mulan: "木兰", prado: "普拉多", carnival: "嘉华", bingo: "缤果", mistra: "名图",
  bingguo: "缤果",
};

function parseGonzo(name) {
  const n = norm(name);
  // Longest-matching known brand prefix.
  let brand = null, rest = n;
  const aliases = Object.keys(BRAND_ALIAS).sort((a, b) => b.length - a.length);
  for (const a of aliases) { if (n === a || n.startsWith(a + " ") || n.startsWith(a)) { brand = a; rest = n.slice(a.length).trim(); break; } }
  if (!brand) { const t = n.split(" "); brand = t[0]; rest = t.slice(1).join(" "); }
  // sub-brand redirect: "saic maxus mifa 9" → maxus, "byd yangwang u8" → yangwang.
  const fw = rest.split(" ")[0];
  if (SUBBRANDS.has(fw)) { brand = fw; rest = rest.slice(fw.length).trim(); }
  return { brand, model: rest };
}

function findBrand(index, gonzoBrand) {
  const cands = BRAND_ALIAS[gonzoBrand] || [gonzoBrand];
  return index.brands.filter((b) =>
    cands.some((c) => b.brand.includes(c) || (/^[a-z]/i.test(c) && b.brand.toLowerCase().includes(c.toLowerCase()))),
  );
}

// German marques name by series number/letter (BMW 3系, Audi A4, Mercedes GLE/C级).
const NUMBER_SERIES_BRANDS = new Set(["bmw", "mercedes", "mercedes-benz", "benz", "audi", "mercedes-amg"]);

const MERCEDES = new Set(["mercedes", "benz", "mercedes-benz", "mercedes-amg"]);

/** Leading series token. BMW/Audi keep the number (3, X5, A4); Mercedes keeps the
 *  CLASS letters and drops the trim digits (C200→c, GLE350→gle, EQB→eqb). */
function seriesCore(s, brand) {
  let t = norm(s).replace(/(\d)\s*系/g, "$1").replace(/[-\s]?class\b/g, "").replace(/[-\s]?series\b/g, "").replace(/级/g, "").replace(/[*()]/g, " ").trim();
  if (MERCEDES.has(brand)) {
    t = t.replace(/^benz\s+/, ""); // Gonzo writes "Mercedes Benz C200"
    const mm = t.match(/^(gl[a-z]|eq[a-z]|cl[a-z]|amg|maybach|[a-z])/);
    return mm ? mm[1] : (t.split(/\s+/)[0] || "");
  }
  const m = t.match(/^([a-z]{1,2}\d{1,2}|gl[a-z]|amg\s?gt|[xim]\s?\d{1,3}|\d{1,3}|[a-z]{2,3}|[a-z])\b/);
  return (m ? m[1] : (t.split(/\s+/)[0] || "")).replace(/\s+/g, "");
}

function scoreSeries(gonzoModel, gonzoBrand, seriesName, brandStrips) {
  // strip every Chinese/Latin brand alias from the series name → the model part.
  let m = seriesName;
  for (const part of brandStrips) if (part) m = m.split(part).join("");
  m = m.trim();
  const sm = modelKey(m), gm = modelKey(gonzoModel);
  // CN line alias: first-word (汉/唐/揽胜) or embedded substring (sea lion→海狮, prado→普拉多).
  let gmCn = MODEL_ALIAS[norm(gonzoModel).split(/\s+/)[0]];
  if (!gmCn) { const nm = norm(gonzoModel); for (const [k, v] of Object.entries(CONTAINS_ALIAS)) if (nm.includes(k)) { gmCn = v; break; } }
  // German/Mercedes number-series: match leading series cores.
  if (NUMBER_SERIES_BRANDS.has(gonzoBrand)) {
    const gc = seriesCore(gonzoModel, gonzoBrand), sc = seriesCore(m, gonzoBrand);
    if (gc && sc && gc === sc) return 0.95; // exact core only — "eqb"≠"e", "ix"≠"ix3"
  }
  if (gmCn && m.startsWith(gmCn)) return 0.85;            // CN dynasty/line alias (BYD唐/汉, LR揽胜) — startsWith avoids 大唐≠唐
  if (!gm && !gmCn) return 0;
  if (sm && gm && sm === gm) return 1.0;                  // exact model token
  if (sm && gm && (sm.includes(gm) || gm.includes(sm))) return 0.7;
  if (gm && sm && (sm.startsWith(gm) || gm.startsWith(sm))) return 0.6;
  return 0;
}

function matchCar(index, car) {
  const { brand, model } = parseGonzo(car.name);
  const brandHits = findBrand(index, brand);
  if (!brandHits.length) return { ...car, parsed_brand: brand, parsed_model: model, confidence: 0, reason: "brand_not_found" };
  const strips = [...new Set([...brandHits.map((b) => b.brand), ...(BRAND_ALIAS[brand] || []), "汽车", "新能源"])];
  let best = null;
  for (const b of brandHits) for (const s of b.series) {
    const score = scoreSeries(model, brand, s.name, strips);
    if (score > 0 && (!best || score > best.score)) best = { score, id: s.id, name: s.name, price: s.price, brandCn: b.brand };
  }
  if (!best) return { ...car, parsed_brand: brand, parsed_model: model, confidence: 0, reason: "no_model_match" };
  return {
    name: car.name, gonzo_price: car.price, parsed_brand: brand, parsed_model: model,
    confidence: best.score, autohome_brand: best.brandCn, autohome_id: best.id,
    autohome_name: best.name, autohome_price: best.price,
    config_url: `https://car.autohome.com.cn/config/series/${best.id}.html`,
  };
}

const csvEsc = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

async function main() {
  if (!existsSync(DISCOVERY)) { log.error(`missing ${DISCOVERY} — run \`npm run gonzo\` first`); process.exit(1); }
  // Gonzo's catalog page leaks a few Russian-named PARTS ("Передний бампер для…") —
  // they're not cars; exclude Cyrillic names from car matching.
  const cars = (JSON.parse(readFileSync(DISCOVERY, "utf8")).cars || []).filter((c) => !/[а-яё]/i.test(c.name));
  const index = await loadAutohomeIndex({ refresh: REFRESH, log: (m) => log.info(m) });
  log.info(`matching ${cars.length} Gonzo cars against ${index.brands.length} brands / ${index.brands.reduce((a, b) => a + b.series.length, 0)} series\n`);

  const matched = cars.map((c) => matchCar(index, c));
  const tiers = { high: matched.filter((m) => m.confidence >= 0.9), med: matched.filter((m) => m.confidence >= 0.6 && m.confidence < 0.9), none: matched.filter((m) => !m.confidence) };

  // Report
  const headers = ["name", "gonzo_price", "parsed_brand", "parsed_model", "confidence", "autohome_id", "autohome_name", "autohome_price", "config_url", "reason"];
  const lines = [headers.join(",")];
  for (const m of matched.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))) lines.push(headers.map((h) => csvEsc(m[h])).join(","));
  writeFileSync("./gonzo-autohome-matches.csv", lines.join("\n"));
  writeFileSync("./gonzo-autohome-matches.json", JSON.stringify(matched, null, 2));
  const targets = tiers.high.concat(tiers.med).map((m) => ({ url: m.config_url, seriesId: m.autohome_id, gonzoName: m.name, gonzoPrice: m.gonzo_price, autohomeName: m.autohome_name, confidence: m.confidence }));
  writeFileSync("./autohome-targets.json", JSON.stringify(targets, null, 2));

  log.info(`── match report ──`);
  log.info(`HIGH (auto-ok): ${tiers.high.length} | MEDIUM (review): ${tiers.med.length} | NO MATCH: ${tiers.none.length}`);
  log.info(`wrote gonzo-autohome-matches.csv + autohome-targets.json (${targets.length} targets)\n`);
  log.info("Top matches:");
  for (const m of tiers.high.slice(0, 12)) log.info(`  ✓ ${m.name}  →  ${m.autohome_id}:${m.autohome_name}  (${m.confidence})`);
  log.info("\nSample NO-MATCH (need manual series id or CN alias):");
  for (const m of tiers.none.slice(0, 8)) log.info(`  · ${m.name}  [${m.reason}]`);

  if (VALIDATE > 0) {
    log.info(`\n── validating top ${VALIDATE} by decoding live ──`);
    const browser = await openBrowser();
    for (const t of targets.slice(0, VALIDATE)) {
      const r = await extractAutohomeSpec(t.url, { browser });
      log.info(r.ok ? `  ✓ ${t.gonzoName} → series ${t.seriesId}: ${r.spec.trims.length} trims, ${r.spec.groups.length} groups` : `  ✗ ${t.gonzoName} → ${r.reason || (r.blocked ? "blocked" : "fail")}`);
    }
    await browser.close();
  }
}

main().catch((e) => { log.error(e?.stack || String(e)); process.exit(1); });
