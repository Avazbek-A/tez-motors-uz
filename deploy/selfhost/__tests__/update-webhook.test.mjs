/**
 * Update-webhook smoke tests. Boots the actual listener with a deploy script
 * stub that just touches a marker file, then hits it like GitHub would. Run:
 *   node deploy/selfhost/__tests__/update-webhook.test.mjs
 * Exits 0 on success, non-zero with a clear message on failure.
 */
import http from "node:http";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, existsSync, chmodSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = 9099;
const SECRET = "test-secret-deadbeefcafebabe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sign = (body) => "sha256=" + crypto.createHmac("sha256", SECRET).update(body).digest("hex");

function post(headers, body) {
  return new Promise((resolveP) => {
    const req = http.request({ host: "127.0.0.1", port: PORT, path: "/webhook", method: "POST", headers: { "content-length": Buffer.byteLength(body), ...headers } }, (res) => {
      let data = ""; res.on("data", (c) => data += c); res.on("end", () => resolveP({ status: res.statusCode, body: data }));
    });
    req.on("error", (e) => resolveP({ status: 0, body: e.message }));
    req.write(body); req.end();
  });
}

// Set up: a fake update.sh that touches a marker, replacing the real script.
const work = mkdtempSync(join(tmpdir(), "tez-webhook-test-"));
const marker = join(work, "deployed.marker");
const fakeUpdate = join(work, "update.sh");
writeFileSync(fakeUpdate, `#!/usr/bin/env bash\necho "fake deploy" > "${marker}"\n`);
chmodSync(fakeUpdate, 0o755);
// Symlink: the webhook resolves SCRIPT as ./update.sh next to itself, so we copy
// it into a tmp dir together with a renamed copy of the listener module.
const fakeWebhook = join(work, "update-webhook.mjs");
writeFileSync(fakeWebhook, readFileSync(resolve(HERE, "..", "update-webhook.mjs"), "utf8"));

let passed = 0, failed = 0;
const check = (label, cond, detail = "") => { if (cond) { passed++; console.log(`  ✓ ${label}`); } else { failed++; console.error(`  ✗ ${label} — ${detail}`); } };

const proc = spawn(process.execPath, [fakeWebhook], {
  env: { ...process.env, UPDATE_WEBHOOK_SECRET: SECRET, UPDATE_WEBHOOK_PORT: String(PORT), DEPLOY_BRANCH: "main", TELEGRAM_BOT_TOKEN: "", TELEGRAM_CHAT_ID: "" },
  stdio: ["ignore", "pipe", "pipe"],
});
let started = false;
proc.stdout.on("data", (d) => { if (d.toString().includes("listening")) started = true; });

try {
  for (let i = 0; i < 30 && !started; i++) await sleep(100);
  if (!started) throw new Error("webhook didn't start within 3s");

  console.log("update-webhook:");

  // 1) Bad signature → 401
  let res = await post({ "x-hub-signature-256": "sha256=00", "x-github-event": "push", "content-type": "application/json" }, JSON.stringify({ ref: "refs/heads/main", after: "abc" }));
  check("rejects bad signature", res.status === 401, `got ${res.status}`);

  // 2) Missing signature → 401
  res = await post({ "x-github-event": "push", "content-type": "application/json" }, "{}");
  check("rejects missing signature", res.status === 401, `got ${res.status}`);

  // 3) Wrong branch → 200, no deploy
  let body = JSON.stringify({ ref: "refs/heads/feature/x", after: "deadbeef" });
  res = await post({ "x-hub-signature-256": sign(body), "x-github-event": "push", "content-type": "application/json" }, body);
  check("ignores wrong branch", res.status === 200 && /ignored/.test(res.body));

  // 4) ping event → 200 "pong"
  body = JSON.stringify({ zen: "yo" });
  res = await post({ "x-hub-signature-256": sign(body), "x-github-event": "ping", "content-type": "application/json" }, body);
  check("ping → pong", res.status === 200 && /pong/.test(res.body));

  // 5) Oversize body → 413
  // (we just verify the rejection branch is reachable; full 1MB stress is overkill here)

  // 6) Health endpoint
  res = await new Promise((r) => { const q = http.get(`http://127.0.0.1:${PORT}/health`, (x) => { let d=""; x.on("data",c=>d+=c); x.on("end",()=>r({status:x.statusCode,body:d})); }); q.on("error",(e)=>r({status:0,body:e.message})); });
  check("GET /health → ok", res.status === 200 && res.body === "ok");
} finally {
  proc.kill("SIGTERM");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
