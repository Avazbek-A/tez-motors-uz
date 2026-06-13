// Recon (read-only): how does AutoHome's pic gallery load, and do responses carry
// color + angle-category labels? Captures XHR/fetch responses while rendering the
// pic page, plus the config-page color JSON. Run: node colors-recon.mjs [seriesId]
import { chromium } from "playwright";

const SID = process.argv[2] || "5769"; // Tesla Model Y
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const isApi = (u) =>
  /autohome|autoimg|che168|cardc|carapi/i.test(u) &&
  /(pic|photo|album|color|spec|param|image|gallery|list)/i.test(u) &&
  !/\.(jpg|jpeg|png|webp|gif|css|js|woff|svg|ico)(\?|$)/i.test(u);

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: UA, locale: "zh-CN" });
  const apis = new Map();
  page.on("response", async (res) => {
    const u = res.url();
    if (!isApi(u)) return;
    const ct = (res.headers()["content-type"] || "");
    if (!/json|javascript|text/i.test(ct)) return;
    try {
      const txt = await res.text();
      if (!apis.has(u)) apis.set(u, txt.slice(0, 1200));
    } catch {}
  });

  console.log(`\n=== pic page render: car.autohome.com.cn/pic/series/${SID}.html ===`);
  await page.goto(`https://car.autohome.com.cn/pic/series/${SID}.html`, { waitUntil: "domcontentloaded", timeout: 40000 }).catch((e) => console.log("goto:", e.message));
  await sleep(3500);
  await page.evaluate(async () => { for (let y = 0; y < 6000; y += 800) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 250)); } });
  await sleep(2000);

  console.log(`\n=== captured API responses (${apis.size}) ===`);
  for (const [u, sample] of apis) {
    console.log("\nURL:", u);
    // show keys that hint at color/category
    const hints = (sample.match(/"(colorname|colorid|color|specid|categoryname|categoryid|grouptype|typename|picname|albumname|name|smallpic|bigpic|pic|colorvalue)"\s*:/gi) || []);
    console.log("  hint-keys:", [...new Set(hints)].slice(0, 20).join(" ") || "(none)");
    console.log("  sample:", sample.replace(/\s+/g, " ").slice(0, 320));
  }

  // DOM: color filter + category tabs
  console.log("\n=== DOM color/category UI ===");
  const dom = await page.evaluate(() => {
    const grab = (sel) => Array.from(document.querySelectorAll(sel)).map((e) => (e.textContent || "").trim()).filter(Boolean).slice(0, 30);
    const colorLinks = Array.from(document.querySelectorAll('a[href*="color"],a[data-color],[class*="color"] a')).map((a) => a.getAttribute("href")).filter(Boolean).slice(0, 12);
    return {
      categoryTexts: [...new Set(grab('[class*="tab"] a, [class*="nav"] a, [class*="menu"] a, dt, .tab-item'))].filter((t) => /外观|内饰|中控|座椅|车头|车尾|车轮|官方|全部|车身|空间|图解/.test(t)).slice(0, 25),
      colorHrefs: colorLinks,
    };
  }).catch((e) => ({ err: e.message }));
  console.log(JSON.stringify(dom, null, 1));

  await browser.close();
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
