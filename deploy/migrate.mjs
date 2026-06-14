/**
 * Apply pending Supabase migrations to prod. Run from the repo root, on the box
 * that has SUPABASE_DB_URL in .env.local (the Vostro). Invoked by deploy.sh
 * BEFORE the build/restart so the new code never references a missing column.
 *
 *   node deploy/migrate.mjs            # apply pending
 *   node deploy/migrate.mjs --status   # list applied vs pending, no changes
 *
 * Tracking: a public._migrations table records every applied file. FIRST run
 * BASELINES — the existing migrations were applied by hand (SQL editor) and aren't
 * tracked, so on an empty table we record all current files as applied WITHOUT
 * executing them (prod already has them). Thereafter only NEW files run, in order,
 * each in its own transaction. Fails closed (a bad migration aborts the deploy).
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIG_DIR = join(ROOT, "supabase", "migrations");
const STATUS_ONLY = process.argv.includes("--status");

function loadEnv() {
  for (const p of [join(ROOT, ".env.local"), "/home/rayxona/tez-motors/.env.local"]) {
    try { const e = {}; for (const l of readFileSync(p, "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0) e[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^['"]|['"]$/g, ""); } if (e.SUPABASE_DB_URL) return e; } catch {}
  }
  return {};
}

async function main() {
  const env = loadEnv();
  const url = env.SUPABASE_DB_URL;
  if (!url) { console.error("FATAL: SUPABASE_DB_URL not set (.env.local) — cannot migrate."); process.exit(1); }

  const files = readdirSync(MIG_DIR).filter((f) => f.endsWith(".sql")).sort();
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query("CREATE TABLE IF NOT EXISTS public._migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now(), baselined boolean NOT NULL DEFAULT false)");
    const applied = new Set((await client.query("SELECT name FROM public._migrations")).rows.map((r) => r.name));
    const pending = files.filter((f) => !applied.has(f));

    if (STATUS_ONLY) {
      console.log(`migrations: ${files.length} total | ${applied.size} applied | ${pending.length} pending`);
      pending.forEach((f) => console.log("  PENDING " + f));
      return;
    }

    // First run on an untracked DB → baseline (record existing as applied, don't run).
    if (applied.size === 0) {
      for (const f of files) await client.query("INSERT INTO public._migrations(name, baselined) VALUES ($1, true) ON CONFLICT DO NOTHING", [f]);
      console.log(`baselined ${files.length} existing migrations (recorded as applied — prod already has them)`);
      return;
    }

    if (pending.length === 0) { console.log("no pending migrations"); return; }
    for (const f of pending) {
      const sql = readFileSync(join(MIG_DIR, f), "utf8");
      process.stdout.write(`applying ${f} … `);
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO public._migrations(name) VALUES ($1)", [f]);
        await client.query("COMMIT");
        console.log("ok");
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        console.log("FAILED");
        console.error(`  ${e.message}`);
        process.exit(1); // fail closed — deploy.sh aborts
      }
    }
    console.log(`applied ${pending.length} migration(s)`);
  } finally {
    await client.end();
  }
}
main().catch((e) => { console.error("FATAL", e.message); process.exit(1); });
