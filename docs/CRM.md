# CRM suite

Built on top of the existing inquiry pipeline, lead scoring, analytics and
admin roles. Three layers, all service-role only (no RLS regression).

## 1. Customer 360 — `/admin/customers`
One unified record per person, **deduped by the 9-digit phone core**
(`contactKey` in `src/lib/crm.ts`), stitching together their scattered records:

- inquiries (`inquiries.phone`)
- orders (`orders.customer_phone`) + order events + paid deposits (`payments`)
- AI conversations (`assistant_conversations.phone`)
- account + favorites (`customers` / `favorites`)

**APIs:** `/api/admin/customers` (list with per-contact counts, lead score,
deposits, activity bounds) and `/api/admin/customers/[key]` (full profile + a
merged, newest-first **activity timeline**). The `key` is the 9-digit core,
which doubles as an ILIKE needle matching every stored phone format
(`+998…`, `998…`, `90…`).

No new table — the 360 is **aggregation-on-read**, so it never drifts from the
source records and needs no write-path changes. (If volume ever makes this slow,
introduce a maintained `crm_contacts` table fed from the lead/order chokepoints.)

## 2. Sales tasks & follow-up engine — `/admin/tasks`
A per-salesperson task queue. Table `crm_tasks` (migration `042`).

- **Manual tasks**: create/assign/snooze/complete in the UI.
- **Auto-generated** by `/api/cron/generate-tasks` (cron-worker `15 4 * * *`),
  idempotent via a unique `auto_source` key, from four signals:
  - stale new leads (inquiry `new` > 2 days old)
  - due follow-ups (`inquiry.follow_up_date <= today`, not closed)
  - abandoned deposits (order still `ordered` > 1 day)
  - hot AI handoffs (conversation `handoff = true`, last 7 days)

**APIs:** `/api/admin/tasks` (GET list + assignees, POST create),
`/api/admin/tasks/[id]` (PATCH complete/snooze/reassign, DELETE).

## 3. Segments & targeted outreach — `/admin/segments`
Live-computed audiences + capped SMS/email campaigns.

- **Segments** (`src/lib/segments.ts` catalog, resolved in
  `src/lib/segment-resolve.ts`): open inquiries, hot AI leads, unpaid
  reservations, past buyers, all registered customers. Each resolves to deduped
  contacts with channel reach (how many have a phone vs an email).
- **Send** (`/api/admin/segments/send`): personalizes `{name}`, sends via
  `sendSms` / `sendEmail` (both fail-open), **hard cap 300 recipients**,
  records a row in `campaigns` (migration `043`) with sent/failed counts.
- **APIs:** `/api/admin/segments` (catalog or resolve one + sample),
  `/api/admin/segments/send`.

## Pure, tested helpers
- `src/lib/crm.ts` — `contactKey`, `pickFirst`, `sortEventsDesc`, money helpers (7 tests)
- `src/lib/segments.ts` — `SEGMENTS`, `dedupeContacts`, `personalize` (7 tests)

## Migrations
- `040_assistant_conversations.sql` (AI sales closer — prerequisite)
- `042_crm_tasks.sql`
- `043_campaigns.sql`

## Admin nav added
Customers · Tasks · Campaigns (alongside the existing Pipeline / AI Sales /
Inquiries / Analytics).
