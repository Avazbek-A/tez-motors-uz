#!/usr/bin/env node
/**
 * Post-deploy smoke test. Hits key public endpoints (expect 200) and protected
 * endpoints (expect 401) against a live base URL, so a launch can be verified in
 * seconds. Exits non-zero on any failure.
 *
 *   node scripts/smoke-test.mjs https://tezmotors.uz
 *   node scripts/smoke-test.mjs            # defaults to NEXT_PUBLIC_SITE_URL or localhost:3000
 */
const base = (process.argv[2] || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

/** Each check: path, what we expect, and an optional body predicate. */
const checks = [
  { path: "/", expect: 200, label: "home (→ locale)" },
  { path: "/ru/catalog", expect: 200, label: "catalog (ru)" },
  { path: "/api/cars?limit=1", expect: 200, label: "cars API", json: (d) => Array.isArray(d.cars) },
  { path: "/api/parts?page=1", expect: 200, label: "parts API" },
  { path: "/sitemap.xml", expect: 200, label: "sitemap" },
  { path: "/robots.txt", expect: 200, label: "robots" },
  { path: "/manifest.webmanifest", expect: 200, label: "PWA manifest" },
  // Security: protected surfaces must reject anonymous access.
  { path: "/api/admin/customers", expect: 401, label: "admin guard (401 expected)" },
  { path: "/api/admin/orders", expect: 401, label: "admin orders guard" },
];

let pass = 0;
let fail = 0;

console.log(`\n  Smoke test → ${base}\n`);
for (const c of checks) {
  try {
    const res = await fetch(`${base}${c.path}`, { redirect: "follow", headers: { "user-agent": "tez-smoke/1" } });
    let ok = res.status === c.expect;
    let extra = "";
    if (ok && c.json) {
      try {
        const data = await res.json();
        if (!c.json(data)) { ok = false; extra = " (body check failed)"; }
      } catch { ok = false; extra = " (invalid JSON)"; }
    }
    console.log(`   ${ok ? "✓" : "✗"}  ${String(res.status).padEnd(4)} ${c.path.padEnd(28)} ${c.label}${extra}`);
    ok ? pass++ : fail++;
  } catch (e) {
    console.log(`   ✗  ERR  ${c.path.padEnd(28)} ${c.label} — ${e.message}`);
    fail++;
  }
}

console.log(`\n  ${pass} passed, ${fail} failed.\n`);
process.exit(fail > 0 ? 1 : 0);
