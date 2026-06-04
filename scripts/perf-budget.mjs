/**
 * Performance budget gate (Phase AQ).
 *
 * After `next build`, sums the client JS chunks and checks them against a budget
 * so a careless change that doubles the bundle fails CI instead of silently
 * shipping a slow site. Coarse-but-honest: raw bytes of .next/static/chunks.
 * Tune the budgets as the app legitimately grows.
 */
import { readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const CHUNKS_DIR = ".next/static/chunks";
const MAX_TOTAL_BYTES = 8 * 1024 * 1024; // 8 MB total client JS
const MAX_SINGLE_BYTES = 1024 * 1024; // 1 MB any single chunk

if (!existsSync(CHUNKS_DIR)) {
  console.error(`perf-budget: ${CHUNKS_DIR} not found — run \`next build\` first.`);
  process.exit(1);
}

function walk(dir) {
  let total = 0;
  let max = { file: "", bytes: 0 };
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = walk(p);
      total += sub.total;
      if (sub.max.bytes > max.bytes) max = sub.max;
    } else if (entry.name.endsWith(".js")) {
      const bytes = statSync(p).size;
      total += bytes;
      if (bytes > max.bytes) max = { file: p, bytes };
    }
  }
  return { total, max };
}

const { total, max } = walk(CHUNKS_DIR);
const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;

console.log(`perf-budget: total client JS ${mb(total)} (budget ${mb(MAX_TOTAL_BYTES)})`);
console.log(`perf-budget: largest chunk ${mb(max.bytes)} — ${max.file} (budget ${mb(MAX_SINGLE_BYTES)})`);

const errors = [];
if (total > MAX_TOTAL_BYTES) errors.push(`total client JS ${mb(total)} exceeds budget ${mb(MAX_TOTAL_BYTES)}`);
if (max.bytes > MAX_SINGLE_BYTES) errors.push(`chunk ${max.file} (${mb(max.bytes)}) exceeds budget ${mb(MAX_SINGLE_BYTES)}`);

if (errors.length) {
  console.error("perf-budget FAILED:\n  " + errors.join("\n  "));
  process.exit(1);
}
console.log("perf-budget OK");
