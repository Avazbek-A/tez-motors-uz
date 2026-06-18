/**
 * Orphaned call-recording cleanup (privacy hygiene).
 *
 * Call recordings are sensitive customer audio stored on the Vostro disk under
 * <MEDIA_ROOT>/call-recordings/<uuid>.<ext>, referenced by calls.recording_url.
 * The admin "delete" action removes both the row and the file, but orphans still
 * accumulate from aborted uploads, a row insert that failed after the file was
 * written, or manual testing. Leaving unreferenced PII audio on disk forever is
 * both a privacy liability and disk creep.
 *
 * This sweep deletes files that are BOTH:
 *   (a) not referenced by any calls.recording_url, AND
 *   (b) older than MAX_AGE_DAYS (default 7) by mtime.
 * The age gate is the safety net: it can never race a fresh upload whose calls
 * row hasn't committed yet. Only files matching the <uuid>.<ext> naming are ever
 * touched. Idempotent; fail-soft.
 *
 * Run:  node clean-orphan-recordings.mjs --dry-run     (report only, deletes nothing)
 *       node clean-orphan-recordings.mjs               (delete eligible orphans)
 *       node clean-orphan-recordings.mjs --days=14     (override the age gate)
 * Schedule daily via the Vostro crontab.
 */
import { readFileSync } from "node:fs";
import { readdir, stat, unlink } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");
const daysArg = process.argv.find((a) => a.startsWith("--days="));
const MAX_AGE_DAYS = daysArg ? Math.max(0, Number(daysArg.split("=")[1]) || 0) : 7;
const RECORDING_NAME = /^[0-9a-f-]{36}\.[a-z0-9]{2,4}$/i; // <uuid>.<ext> written by call-recording.ts

function loadEnv() {
  for (const p of ["../../.env.local", "../.env.local", "./.env.local", "/home/rayxona/tez-motors/.env.local"]) {
    try {
      const e = {};
      for (const l of readFileSync(resolve(p), "utf8").split("\n")) {
        const i = l.indexOf("=");
        if (i > 0) e[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
      }
      if (e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SERVICE_KEY) return e;
    } catch { /* try next path */ }
  }
  return {};
}

const env = { ...loadEnv(), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error("[orphan-clean] missing Supabase env (url/service key) — aborting");
  process.exit(1);
}

const MEDIA_ROOT = env.MEDIA_ROOT || "/home/rayxona/tez-motors-media";
const DIR = join(MEDIA_ROOT, "call-recordings");
const stamp = new Date().toISOString();

const sb = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await sb.from("calls").select("recording_url").not("recording_url", "is", null);
if (error) {
  console.error(`[orphan-clean] ${stamp} could not read calls: ${error.message}`);
  process.exit(1);
}
const referenced = new Set((data || []).map((r) => (r.recording_url || "").split("/").pop()).filter(Boolean));

let files = [];
try {
  files = await readdir(DIR);
} catch (e) {
  console.log(`[orphan-clean] ${stamp} no recordings dir (${DIR}): ${e.message} — nothing to do`);
  process.exit(0);
}

const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
let deleted = 0;
let skippedYoung = 0;
let skippedUnknown = 0;

for (const f of files) {
  if (!RECORDING_NAME.test(f)) { skippedUnknown++; continue; }
  if (referenced.has(f)) continue;
  let mtime = 0;
  try { mtime = (await stat(join(DIR, f))).mtimeMs; } catch { continue; }
  if (mtime > cutoff) { skippedYoung++; continue; } // too new — a row may still be committing
  if (DRY_RUN) {
    console.log(`[orphan-clean] would delete orphan: ${f}`);
    deleted++;
    continue;
  }
  try {
    await unlink(join(DIR, f));
    deleted++;
  } catch (e) {
    console.error(`[orphan-clean] failed to delete ${f}: ${e.message}`);
  }
}

console.log(
  `[orphan-clean] ${stamp} mode=${DRY_RUN ? "dry-run" : "live"} maxAgeDays=${MAX_AGE_DAYS} ` +
  `files=${files.length} referenced=${referenced.size} ${DRY_RUN ? "wouldDelete" : "deleted"}=${deleted} ` +
  `skippedYoung=${skippedYoung} skippedUnknown=${skippedUnknown}`,
);
