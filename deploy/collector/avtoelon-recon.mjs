// Recon: render an avtoelon car search and capture the api.avtoelon.uz call(s)
// the SPA makes, so we can build a clean HttpCrawler against the real endpoint.
import { chromium } from "playwright";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ userAgent: UA });
const page = await ctx.newPage();
const apis = [];
page.on("response", async (r) => {
  const u = r.url();
  if (!u.includes("api.avtoelon.uz")) return;
  if (r.request().resourceType() === "image") return;
  let sample = "";
  try { sample = (await r.text()).slice(0, 600); } catch {}
  apis.push({ method: r.request().method(), status: r.status(), url: u, sample });
});

try {
  await page.goto("https://avtoelon.uz/avto/?text=jolion", { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(3000);
} catch (e) {
  console.log("nav warn:", e.message);
}
console.log("=== api.avtoelon.uz calls (" + apis.length + ") ===");
for (const a of apis.slice(0, 12)) {
  console.log(`\n${a.method} ${a.status}  ${a.url}`);
  console.log("  sample: " + a.sample.replace(/\s+/g, " ").slice(0, 400));
}
await browser.close();
