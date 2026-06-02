#!/usr/bin/env node
/**
 * Migration verification.
 *
 * Structural check (always): every file in supabase/migrations/ is numbered
 * NNN_*.sql, the sequence is strictly increasing with no gaps or duplicates,
 * and no file is empty / has unbalanced parentheses.
 *
 * Apply check (opt-in): if DATABASE_URL is set AND `psql` is on PATH, applies
 * every migration in order against that database with ON_ERROR_STOP, proving
 * they actually run on a fresh schema. Point it at a THROWAWAY database, e.g.:
 *
 *   createdb tez_verify && DATABASE_URL=postgres://localhost/tez_verify \
 *     node scripts/verify-migrations.mjs && dropdb tez_verify
 *
 * Exits non-zero on any structural problem or apply failure (CI-friendly).
 */
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const DIR = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();

if (files.length === 0) {
  console.error("✗ no migrations found in", DIR);
  process.exit(1);
}

let problems = 0;
const fail = (msg) => {
  console.error("✗ " + msg);
  problems++;
};

let prev = 0;
for (const f of files) {
  const m = f.match(/^(\d+)_/);
  if (!m) {
    fail(`bad filename (expected NNN_name.sql): ${f}`);
    continue;
  }
  const n = parseInt(m[1], 10);
  if (n === prev) fail(`duplicate migration number ${m[1]}: ${f}`);
  else if (n !== prev + 1) fail(`gap in sequence: ${m[1]} follows ${String(prev).padStart(3, "0")} (${f})`);
  prev = n;

  const sql = readFileSync(join(DIR, f), "utf8");
  if (sql.trim().length === 0) fail(`empty migration: ${f}`);
  const opens = (sql.match(/\(/g) || []).length;
  const closes = (sql.match(/\)/g) || []).length;
  if (opens !== closes) fail(`unbalanced parentheses (${opens} vs ${closes}): ${f}`);
}

if (problems > 0) {
  console.error(`\n${problems} structural problem(s) found.`);
  process.exit(1);
}
console.log(`✓ ${files.length} migrations: numbering 001..${String(prev).padStart(3, "0")} sequential, no gaps, well-formed.`);

// --- Optional: actually apply them to a throwaway database.
const dbUrl = process.env.DATABASE_URL;
let hasPsql = false;
try {
  execFileSync("psql", ["--version"], { stdio: "ignore" });
  hasPsql = true;
} catch {
  /* psql not installed */
}

if (!dbUrl || !hasPsql) {
  console.log(
    `ℹ apply-check skipped (${!dbUrl ? "DATABASE_URL unset" : "psql not found"}). ` +
      "Set DATABASE_URL to a throwaway DB + install psql to verify migrations actually run.",
  );
  process.exit(0);
}

console.log(`\nApplying ${files.length} migrations to ${dbUrl.replace(/:[^:@/]*@/, ":***@")} …`);
for (const f of files) {
  try {
    execFileSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-q", "-f", join(DIR, f)], { stdio: ["ignore", "ignore", "inherit"] });
    console.log(`  ✓ ${f}`);
  } catch {
    console.error(`  ✗ ${f} failed to apply (see error above)`);
    process.exit(1);
  }
}
console.log("✓ all migrations applied cleanly in order.");
