# Owner playbook — running Tez Motors solo

You're one person. This is the daily/weekly rhythm to run the whole import
business on the platform without missing anything. Each step links to the admin
section that does the work.

## Every morning (5 minutes) — `/admin/command`
The command center is your home screen. It shows everything that needs you today:
- **Tasks due**, **Hot AI leads**, **Overdue shipments**, **Unpaid reservations**,
  **New inquiries** — click any card to act.
- **Cash & margin** snapshot (revenue MTD, deposits, committed to suppliers,
  potential margin) and the **top models to import**.
Work the cards top-to-bottom until they're clear.

## Selling (throughout the day)
- **`/admin/conversations` (AI Sales)** — the assistant qualifies leads on the
  site, Telegram and WhatsApp 24/7. Call the ones flagged **handoff** (hot).
- **`/admin/customers`** — one record per person (every inquiry, order, chat,
  deposit, favorite). Filter by **tier** (VIP / Buyer / Active / Lead / Dormant).
- **`/admin/tasks`** — your follow-up queue; auto-fills with stale leads, unpaid
  deposits and hot handoffs. Snooze/complete as you go.
- **`/admin/pipeline`** — drag inquiries new → contacted → in progress → closed.
- **`/admin/orders`** — advance an import's status; the customer is notified and
  can track it on `/track`.

## Buying & importing (weekly)
1. **`/admin/buying` (Buying Brain)** — what to import next, ranked by demand ×
   market price × landed cost. Click **order N** on a strong pick.
2. **`/admin/market` (Market Intel)** — paste OLX/Telegram listings (AI parses
   them) so the brain knows real prices. Or run the collector on your Vostro.
3. **`/admin/import-calculator`** — confirm landed cost (duty/excise/VAT/fees)
   and the suggested list price before committing.
4. **`/admin/procurement`** — create the purchase order; use **Supplier WhatsApp
   message** to draft the RFQ/follow-up (中文/EN); then **Create shipment** and
   **Log supplier payment** from the PO.
5. **`/admin/shipments`** — track each batch PO → paid → shipped → customs →
   arrived → delivered; attach the invoice/customs docs; overdue ones alert you.

## Pricing & money
- **`/admin/money`** — where your capital is (deposits in, committed to
  suppliers, inventory at cost, margin on the lot, FX exposure).
- **`/admin/finance`** — issue invoices (with VAT, printable/PDF), log expenses
  in any currency (CNY supplier payments auto-converted), see the period P&L.
- **`/admin/ledger`** — per-car cost → price → margin.

## Marketing (15 min, a few times a week)
- **`/admin/marketing` (Content Studio)** — generate a social post / ad / blog
  about a car or topic in RU/UZ/EN. **Post to Telegram** now or **Schedule** it.
- **`/admin/promotions`** — run a timed sale; it auto-drops the price (shows as a
  strikethrough + on `/deals`), announces to Telegram, and reverts on its own.
- **`/admin/segments` (Campaigns)** — blast SMS/email to an audience (unpaid
  reservations, past buyers, etc.).
- **Measure:** the Content Studio shows **where leads come from** — tag your
  links `?utm_source=instagram&utm_campaign=may` (channels) or `?ref=NAME`
  (word-of-mouth) so you know what actually sells.

## Set-and-forget (runs without you)
Crons handle: USD/UZS+CNY rates, lead digest, follow-up reminders, price-watch
alerts, saved-search alerts, review requests, abandoned-reservation nudges,
order/shipment SLA alerts, CRM task generation, scheduled marketing posts, and
promotion apply/revert. Check **`/admin/autopilot`** for their heartbeat.

## When something breaks
**`/admin/errors`** (and Telegram alerts) surface failures. **`/admin/audit`**
logs every privileged action. See `HANDOFF.md` for env/secret/runbook details
and `LAUNCH.md` for go-live.
