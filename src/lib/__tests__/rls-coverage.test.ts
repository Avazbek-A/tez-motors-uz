/**
 * RLS-coverage regression guard.
 *
 * Every table in the public schema holds dealer/customer data and must be
 * locked to the service-role key via Row Level Security — public reads are
 * granted (if at all) through explicit policies, never by leaving RLS off.
 * This is load-bearing: with RLS disabled, Supabase's default `anon` grant
 * makes a table fully readable through PostgREST with the public anon key.
 *
 * `admin_users` (password hashes + emails + roles) shipped without RLS for many
 * migrations precisely because nothing checked. This test fails the build if any
 * `CREATE TABLE public.<x>` lacks a matching `ALTER TABLE public.<x> ENABLE ROW
 * LEVEL SECURITY` anywhere in the migration set — so the gap can never recur.
 *
 * If a table is *intentionally* meant to be world-readable without RLS, add it
 * to PUBLIC_NO_RLS_ALLOWLIST with a comment explaining why. Prefer enabling RLS
 * with a `for select using (...)` policy over allowlisting.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Tables that are intentionally created without RLS. Keep this EMPTY unless
// there's a hard reason — every current table is service-role-locked.
const PUBLIC_NO_RLS_ALLOWLIST = new Set<string>([]);

function loadMigrationsSql(): string {
  const dir = join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  return files.map((f) => readFileSync(join(dir, f), "utf8")).join("\n").toLowerCase();
}

function extract(sql: string, re: RegExp): Set<string> {
  const out = new Set<string>();
  for (const m of sql.matchAll(re)) out.add(m[1]);
  return out;
}

describe("RLS coverage across migrations", () => {
  const sql = loadMigrationsSql();

  // Whitespace-tolerant: some migrations align `enable` with extra spaces.
  const created = extract(
    sql,
    /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/g,
  );
  const rlsEnabled = extract(
    sql,
    /alter\s+table\s+(?:only\s+)?public\.([a-z0-9_]+)\s+enable\s+row\s+level\s+security/g,
  );

  it("found a non-trivial set of tables (sanity)", () => {
    // Guards against a glob/path regression silently passing the suite.
    expect(created.size).toBeGreaterThan(30);
    expect(rlsEnabled.size).toBeGreaterThan(30);
  });

  it("every created public table has RLS enabled", () => {
    const missing = [...created]
      .filter((t) => !rlsEnabled.has(t) && !PUBLIC_NO_RLS_ALLOWLIST.has(t))
      .sort();
    expect(missing, `tables created without ENABLE ROW LEVEL SECURITY: ${missing.join(", ")}`).toEqual([]);
  });

  it("admin_users specifically is RLS-locked (regression: it once was not)", () => {
    expect(created.has("admin_users")).toBe(true);
    expect(rlsEnabled.has("admin_users")).toBe(true);
  });
});
