#!/usr/bin/env node
/**
 * Tez Motors update webhook — turns `git push` into a live deploy on the Vostro.
 *
 * Listens on 127.0.0.1:UPDATE_WEBHOOK_PORT (default 9090). GitHub posts there
 * (via the Cloudflare Tunnel that already fronts the app — see SETUP.md §13);
 * we verify the X-Hub-Signature-256 HMAC, ignore everything except push events
 * on DEPLOY_BRANCH, and exec ./update.sh once. Concurrency: at most ONE deploy
 * at a time — overlapping pushes coalesce.
 *
 * Env (all loaded from .env.local by the systemd unit):
 *   UPDATE_WEBHOOK_SECRET   required — same value you paste into GitHub
 *   UPDATE_WEBHOOK_PORT     default 9090
 *   DEPLOY_BRANCH           default main
 *   TELEGRAM_BOT_TOKEN      optional — send success/failure pings here
 *   TELEGRAM_CHAT_ID        optional — dealer chat for the pings
 */
import http from "node:http";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.UPDATE_WEBHOOK_PORT || 9090);
const SECRET = process.env.UPDATE_WEBHOOK_SECRET;
const BRANCH = process.env.DEPLOY_BRANCH || "main";
const BOT = process.env.TELEGRAM_BOT_TOKEN || "";
const CHAT = process.env.TELEGRAM_CHAT_ID || "";
const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, "update.sh");

if (!SECRET) { console.error("UPDATE_WEBHOOK_SECRET is required"); process.exit(1); }

let running = false;     // a deploy is in-flight
let coalesced = null;    // a push that arrived while running; we run once more after

async function notify(text) {
  if (!BOT || !CHAT) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) { console.error("notify failed:", e?.message || e); }
}

function verifySig(rawBody, sigHeader) {
  if (typeof sigHeader !== "string" || !sigHeader.startsWith("sha256=")) return false;
  const mac = crypto.createHmac("sha256", SECRET).update(rawBody).digest();
  let given;
  try { given = Buffer.from(sigHeader.slice(7), "hex"); } catch { return false; }
  return given.length === mac.length && crypto.timingSafeEqual(given, mac);
}

function runDeploy(meta) {
  if (running) { coalesced = meta; return; }
  running = true;
  const sha = (meta.after || "").slice(0, 7);
  const msg = (meta.head_commit?.message || "").split("\n")[0].slice(0, 200);
  console.log(`→ deploy ${meta.ref} ${sha}: ${msg}`);
  const proc = spawn("bash", [SCRIPT], { stdio: "inherit", cwd: resolve(HERE, "../..") });
  proc.on("exit", async (code) => {
    running = false;
    if (code === 0) {
      console.log(`✓ deploy ${sha} ok`);
      await notify(`✅ tezmotors.uz deployed ${sha}\n${msg}`);
    } else {
      console.error(`✗ deploy ${sha} failed (exit ${code})`);
      await notify(`❌ tezmotors.uz deploy FAILED for ${sha}\nSSH in and run: journalctl -u tez-motors-webhook -n 80`);
    }
    if (coalesced) { const next = coalesced; coalesced = null; runDeploy(next); }
  });
  proc.on("error", async (err) => {
    running = false;
    console.error("spawn error:", err);
    await notify(`❌ tezmotors.uz: webhook couldn't start update.sh — ${err.message}`);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") { res.writeHead(200); return res.end("ok"); }
  if (req.method !== "POST" || req.url !== "/webhook") { res.writeHead(404); return res.end(); }
  let raw = Buffer.alloc(0);
  let aborted = false;
  req.on("data", (chunk) => {
    raw = Buffer.concat([raw, chunk]);
    if (raw.length > 1_000_000) { aborted = true; res.writeHead(413); res.end("too large"); req.destroy(); }
  });
  req.on("end", () => {
    if (aborted) return;
    const sig = req.headers["x-hub-signature-256"];
    if (!verifySig(raw, Array.isArray(sig) ? sig[0] : sig)) { res.writeHead(401); return res.end("bad signature"); }
    const event = req.headers["x-github-event"];
    if (event === "ping") { res.writeHead(200); return res.end("pong"); }
    if (event !== "push") { res.writeHead(200); return res.end(`ignored event ${event}`); }
    let payload;
    try { payload = JSON.parse(raw.toString("utf8")); } catch { res.writeHead(400); return res.end("bad json"); }
    const ref = payload.ref || "";
    if (ref !== `refs/heads/${BRANCH}`) { res.writeHead(200); return res.end(`ignored ref ${ref}`); }
    res.writeHead(202); res.end("deploying");
    runDeploy(payload);
  });
});

server.listen(PORT, "127.0.0.1", () => console.log(`update-webhook listening on 127.0.0.1:${PORT} (branch ${BRANCH})`));
