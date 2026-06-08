/**
 * AutoHome brand→series index builder (Phase GONZO enrichment).
 *
 * Builds the complete {brand → [series {id, name, price}]} map from AutoHome's
 * grade/carhtml/{A-Z}.html index pages, so a competitor car name can be resolved
 * to an AutoHome series id (→ car.autohome.com.cn/config/series/{id} → the proven
 * deterministic decode in autohome-extract.mjs).
 *
 * IMPORTANT (recon 2026-06-08): www.autohome.com.cn is unreachable via node fetch
 * from Uzbekistan (mainland-China PoP IPs, blocked/slow), but a Playwright browser
 * REACHES it (different routing). So we render the index pages in Chromium.
 * car.autohome.com.cn (config pages) is reachable directly — only the index needs
 * the browser. Result is cached to autohome-index.json (refresh with --refresh).
 *
 * CLI:  node autohome-index.mjs            # build/refresh the cache, print stats
 * Lib:  import { loadAutohomeIndex } from "./autohome-index.mjs"
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { chromium } from "playwright";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const CACHE = "./autohome-index.json";
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function parsePageDom() {
  // Runs in the page context. Each <dl id="{brandId}"> is a brand; each
  // <li id="s{seriesId}"><h4><a>{name}</a></h4>…<a class="red">{price}</a> a series.
  const brands = [];
  for (const dl of Array.from(document.querySelectorAll("dl[id]"))) {
    const brand = (dl.querySelector("dt div a")?.textContent || dl.querySelector("dt a:last-child")?.textContent || "").replace(/\s+/g, " ").trim();
    if (!brand) continue;
    const series = [];
    for (const li of Array.from(dl.querySelectorAll('li[id^="s"]'))) {
      const id = li.id.replace(/^s/, "");
      const name = (li.querySelector("h4 a")?.textContent || "").replace(/\s+/g, " ").trim();
      const price = (li.querySelector("a.red")?.textContent || "").replace(/\s+/g, " ").trim() || null;
      if (/^\d+$/.test(id) && name) series.push({ id, name, price });
    }
    if (series.length) brands.push({ brandId: dl.id, brand, series });
  }
  return brands;
}

export async function buildAutohomeIndex({ log = console.log } = {}) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: UA, locale: "zh-CN" });
  const page = await ctx.newPage();
  const byBrand = new Map(); // brand(zh) → {brandId, brand, series[]}
  try {
    for (const L of LETTERS) {
      // www.autohome.com.cn routing from UZ is flaky — retry each letter a few times
      // (a single miss silently drops every brand on that pinyin letter, e.g. A→奥迪, B→宝马/保时捷/奔驰).
      let brands = null, lastErr = "";
      for (let attempt = 1; attempt <= 6 && !brands; attempt++) {
        try {
          const resp = await page.goto(`https://www.autohome.com.cn/grade/carhtml/${L}.html`, { waitUntil: "domcontentloaded", timeout: 35000 });
          if (!resp || resp.status() !== 200) { lastErr = `HTTP ${resp?.status() || "?"}`; continue; }
          const b = await page.evaluate(parsePageDom);
          if (b.length) brands = b; else lastErr = "0 brands";
        } catch (e) { lastErr = e?.message?.slice(0, 40) || "err"; await page.waitForTimeout(800 * attempt); }
      }
      if (!brands) { log(`  carhtml/${L}: FAILED (${lastErr})`); continue; }
      for (const b of brands) {
        const cur = byBrand.get(b.brand);
        if (cur) { const seen = new Set(cur.series.map((s) => s.id)); for (const s of b.series) if (!seen.has(s.id)) cur.series.push(s); }
        else byBrand.set(b.brand, b);
      }
      log(`  carhtml/${L}: ${brands.length} brands`);
    }
  } finally {
    await ctx.close();
    await browser.close();
  }
  const index = { builtAt: new Date().toISOString(), brands: [...byBrand.values()] };
  writeFileSync(CACHE, JSON.stringify(index));
  const totalSeries = index.brands.reduce((a, b) => a + b.series.length, 0);
  log(`index: ${index.brands.length} brands, ${totalSeries} series → ${CACHE}`);
  return index;
}

/** Load the cached index; build it if missing or {refresh:true}. */
export async function loadAutohomeIndex({ refresh = false, log = console.log } = {}) {
  if (!refresh && existsSync(CACHE)) {
    try { return JSON.parse(readFileSync(CACHE, "utf8")); } catch { /* rebuild */ }
  }
  return buildAutohomeIndex({ log });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const idx = await buildAutohomeIndex();
  // quick sanity: show a few EV brands Gonzo carries
  for (const q of ["极氪", "小米", "比亚迪", "蔚来", "宝马", "保时捷"]) {
    const b = idx.brands.find((x) => x.brand.includes(q));
    if (b) console.log(`  ${b.brand}: ${b.series.length} series — e.g. ${b.series.slice(0, 3).map((s) => `${s.id}:${s.name}`).join(", ")}`);
  }
}
