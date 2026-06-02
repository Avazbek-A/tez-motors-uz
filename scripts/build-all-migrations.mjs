#!/usr/bin/env node
/**
 * Bundle every migration in supabase/migrations/ (in numeric order) into a
 * single supabase/ALL_MIGRATIONS.sql for a ONE-PASTE apply into the Supabase
 * SQL editor on a fresh project. Migrations are written to run sequentially on
 * a clean DB, so concatenation in order is equivalent to applying them one by
 * one. For an EXISTING database, apply only the new individual files instead.
 *
 *   node scripts/build-all-migrations.mjs   (or: npm run migrations:bundle)
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "supabase", "migrations");
const out = join(root, "supabase", "ALL_MIGRATIONS.sql");

const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort(); // 001_, 002_, … lexical sort == numeric order (zero-padded)

const parts = [
  "-- ============================================================",
  "-- Tez Motors — consolidated schema (ALL migrations, in order)",
  `-- Generated from ${files.length} files in supabase/migrations/`,
  "-- FRESH DATABASE ONLY: paste this once into the Supabase SQL editor.",
  "-- For an existing DB, apply only the new individual migration files.",
  "-- ============================================================",
  "",
];

for (const f of files) {
  const sql = readFileSync(join(dir, f), "utf8").trimEnd();
  parts.push(`-- ─── ${f} ───────────────────────────────────────────`, sql, "");
}

const body = parts.join("\n") + "\n";
writeFileSync(out, body);
console.log(`Wrote ${out}`);
console.log(`  ${files.length} migrations, ${body.split("\n").length} lines, ${(body.length / 1024).toFixed(1)} KB`);
console.log(`  range: ${files[0]} … ${files[files.length - 1]}`);
