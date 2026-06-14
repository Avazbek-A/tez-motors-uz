# Deploy & workflow

Three machines, three roles — keep them distinct:

| Machine | Role | Stays current via |
|---|---|---|
| **Mac** | Dev / control — edit, commit, push, run scripts | every change is committed **and pushed** (default) |
| **GitHub** (`Avazbek-A/tez-motors-uz`) | Source of truth / backup | `git push` on every commit |
| **Vostro** (self-hosted prod) | Runs the app + collectors + cron | `./deploy/deploy.sh` (git-based) |

Working branch: **`design/cinematic-showroom`** (not `main`). Prod runs this branch.

## Daily flow
1. Edit on the Mac → commit (focused commits, `Co-Authored-By` line) → **push** (both automatic; GitHub is the only off-laptop backup).
2. Deploy when a change should go live:
   ```bash
   ./deploy/deploy.sh
   ```
   It pushes, then on the Vostro: `git fetch` → `git reset --hard origin/<branch>` → `npm install` → **`node deploy/migrate.mjs`** (apply pending DB migrations, fails closed) → `npm run selfhost:build` → restart `tez-motors.service` → health-check `/ru/catalog`.

**push ≠ deploy.** Pushing backs code to GitHub; deploying makes it live. They're separate steps.

## Rollback
```bash
ssh vostro "cd /home/rayxona/tez-motors && git reset --hard <prev-sha> && npm run selfhost:build && sudo systemctl restart tez-motors"
```
`deploy.sh` prints the previous SHA on every run; or `git log` on the Vostro.

## Env files
- **Vostro `.env.local`** = the full production secret set (Supabase, payment, LLM, email/SMS, VAPID, Telegram, market secret…). **Source of truth for secrets. Gitignored — never committed, never touched by deploy.** Backed up in place as `.env.local.bak-YYYY-MM-DD`.
- **Mac `.env.local`** = minimal (Supabase only) for local scripts/verification. Don't copy prod secrets onto the laptop.
- **Never `git pull` or hand-edit code on the Vostro** — `deploy.sh` owns it. The Vostro is a clean checkout of `origin/<branch>`; the only Vostro-unique file is the env.

## Prod facts (see also memory: infra-production-topology)
- Self-hosted on the Vostro: `tez-motors.service` (systemd, standalone Next build, 127.0.0.1:3000) behind a `cloudflared` tunnel → **tezmotors.uz**. Not Cloudflare Workers.
- Canonical DB: Supabase `wyivyvoljvplkdrjmpox` (the `kmzd…` project is abandoned). **DB migrations apply automatically** during deploy via `deploy/migrate.mjs` — it tracks applied files in `public._migrations` (baselined to the 75 hand-applied ones on 2026-06-14) and runs only new `supabase/migrations/*.sql`, in order, transactionally, fail-closed. Needs `SUPABASE_DB_URL` in the Vostro `.env.local` (the direct Postgres URI, gitignored). For a genuinely destructive change, still eyeball it first — it'll run on the next deploy.
- Market collectors run on the Vostro via cron (`deploy/collector/run-market.sh`): OLX + avtoelon + Telegram → `market_listings` → the buying brain. See memory: market-intel-engine.
