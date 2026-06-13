import { chromium } from "playwright";
const SID = process.argv[2] || "5769"; // Tesla Model Y
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ userAgent: UA, locale: "zh-CN" });
const vids = new Set(), players = new Set();
page.on("request", (r) => {
  const u = r.url();
  if (/\.mp4|\.m3u8|video|veh\.autohvideo|v\.autohome|player/i.test(u)) {
    if (/\.mp4|\.m3u8/i.test(u)) vids.add(u.split("?")[0]);
    if (/v\.autohome|player|video.*html/i.test(u)) players.add(u);
  }
});
for (const url of [
  `https://car.autohome.com.cn/pic/series/${SID}.html`,
  `https://www.autohome.com.cn/${SID}/`,
]) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(4000);
    const html = await page.content();
    const playerLinks = await page.$$eval('a[href*="video"],a[href*="v.autohome"],iframe[src*="video"],iframe[src*="v.autohome"]', (els) => els.map((e) => e.href || e.src).slice(0, 6)).catch(() => []);
    const vIds = [...new Set([...html.matchAll(/v\.autohome\.com\.cn\/v\/(\d+)/g)].map((m) => m[1]))];
    console.log(`\n${url}`);
    console.log("  v.autohome video ids in html:", vIds.slice(0, 6));
    console.log("  player/video links:", [...new Set(playerLinks)].slice(0, 5));
  } catch (e) { console.log(url, "ERR", e.message); }
}
console.log("\nvideo file requests (.mp4/.m3u8):", [...vids].slice(0, 6));
console.log("player/video-page requests:", [...players].slice(0, 6));
await browser.close();
