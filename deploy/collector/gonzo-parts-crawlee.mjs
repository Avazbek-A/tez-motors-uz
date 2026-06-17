/**
 * Gonzo Motors parts-catalogue extractor. Crawls gonzo-motors.uz/zapchast and
 * every /zapchasti-* brand/model category page (Tilda T778 catalog blocks, no
 * ddos-guard block on render), then each part page, and writes the raw catalogue
 * to ~/subs/gonzo-parts.json for import-gonzo-parts.mjs.
 *
 * We capture name + price + brand/model + Gonzo image URLs (image URLs are only a
 * REFERENCE — the import sources its own supplier/OEM images, never Gonzo's). The
 * description is generated fresh downstream, so we don't store Gonzo's prose.
 *
 *   node gonzo-parts-crawlee.mjs            → writes ~/subs/gonzo-parts.json
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = "https://gonzo-motors.uz";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = (process.env.HOME || "/home/rayxona") + "/subs/gonzo-parts.json";

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ locale: "ru-RU", userAgent: UA });
const page = await ctx.newPage();

async function load(url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
  await sleep(2200);
  for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 3200); await sleep(500); }
}

// ── BFS category discovery (start at /zapchast, follow /zapchasti-* links) ──
const catSeen = new Set([`${BASE}/zapchast`]);
const frontier = [`${BASE}/zapchast`];
const partUrls = new Set();
while (frontier.length) {
  const cat = frontier.shift();
  await load(cat);
  const { parts, cats } = await page.evaluate(() => {
    const abs = (h) => (!h ? "" : h.startsWith("http") ? h : `${location.origin}/${h.replace(/^\//, "")}`);
    const parts = [...document.querySelectorAll(".js-product-link")].map((a) => abs(a.getAttribute("href"))).filter(Boolean);
    const cats = [...document.querySelectorAll("a")].map((a) => a.getAttribute("href")).filter((h) => h && /zapcha/i.test(h)).map(abs);
    return { parts, cats };
  });
  parts.forEach((p) => partUrls.add(p.split("?")[0]));
  for (const c of cats) { const u = c.split("?")[0]; if (!catSeen.has(u)) { catSeen.add(u); frontier.push(u); } }
  console.error(`cat ${cat} → +${parts.length} parts (total ${partUrls.size}); ${frontier.length} cats queued`);
}

// ── Visit each part page → name / price / images ──
const parts = [];
let n = 0;
for (const url of partUrls) {
  n++;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 40000 }).catch(() => {});
    await sleep(1400);
    const d = await page.evaluate(() => {
      const txt = document.body.innerText.replace(/\s+/g, " ").trim();
      const h1 = document.querySelector("h1")?.textContent.trim() || (document.title || "").split("|")[0].trim();
      const pm = txt.match(/(\d[\d  ]{1,})\s*\$/) || txt.match(/(\d[\d  ]{3,})\s*(?:сум|so'm|у\.е)/i);
      // breadcrumb: "Запчасти → BYD → Все запчасти на BYD Han → ..."
      const crumb = (txt.match(/Запчасти\s*→\s*([^→]+)→\s*([^→]+)/) || []).slice(1).map((s) => s.trim());
      const imgs = [...document.querySelectorAll("img")]
        .map((i) => i.getAttribute("data-original") || i.src)
        .filter((s) => s && /tildacdn/.test(s) && /(photo|\.jpe?g|\.png|\.webp)/i.test(s) && !/favicon|logo|icon|frame|glass-sol|magnif/i.test(s));
      return { name: h1, price: pm ? Number(pm[1].replace(/\D/g, "")) : null, currency: /\$/.test(pm?.[0] || "") ? "USD" : "UZS", brand: crumb[0] || null, model_hint: crumb[1] || null, imgs: [...new Set(imgs)].slice(0, 6) };
    });
    parts.push({ url, ...d });
    if (n % 10 === 0) console.error(`  …${n}/${partUrls.size} parts`);
  } catch (e) { parts.push({ url, error: String(e.message || e) }); }
  await sleep(300);
}

writeFileSync(OUT, JSON.stringify(parts, null, 1));
await b.close();
console.log(`DONE: ${catSeen.size} category pages, ${parts.length} parts → ${OUT}`);
console.log(`with price: ${parts.filter((p) => p.price).length}, with images: ${parts.filter((p) => p.imgs && p.imgs.length).length}`);
console.log("brands:", [...new Set(parts.map((p) => p.brand).filter(Boolean))].join(", "));
console.log("sample:", JSON.stringify(parts.slice(0, 4), null, 1));
