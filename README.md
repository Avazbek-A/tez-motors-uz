# Tez Motors — tezmotors.uz

Production website and lead engine for Tez Motors, an EV-import business in Tashkent (100+ vehicles imported from China, $2M+ cumulative revenue). Live at **[tezmotors.uz](https://tezmotors.uz)**.

The site is not a brochure — it is the company's inbound channel: SEO-focused catalog and content pages capture buyer and supplier requests, which are qualified and routed automatically.

## Stack

- **Next.js / TypeScript** (App Router), Tailwind CSS
- **Supabase** (Postgres) — catalog, requests, content; migrations in `supabase/`, business logic partly in PLpgSQL
- **Cron worker** (`cron-worker/`) — scheduled jobs: data refresh, notifications
- **Docker + docker-compose**, deploy scripts in `deploy/`; self-hosted on the company's own Linux server
- **Tests**: vitest (unit), Playwright (`e2e/`)
- RU/UZ localization

## Structure

```
src/            application code (App Router)
supabase/       schema, migrations, PLpgSQL
cron-worker/    scheduled background jobs
e2e/            Playwright end-to-end tests
deploy/         deployment scripts
docs/           project docs
```

## Run locally

```bash
npm install
cp .env.example .env   # fill in Supabase keys
npm run dev
```

---

Built and operated by [Avazbek Abdusaidov](https://github.com/Avazbek-A) — solo, end to end: requirements, code, deployment, operations.
