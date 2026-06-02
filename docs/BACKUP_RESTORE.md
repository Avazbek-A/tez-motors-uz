# Backup & restore runbook

A business that takes deposits must be able to restore its data. This covers the
self-managed path (works on any Supabase tier); on **Supabase Pro** also enable
**PITR** (Database → Backups) as the primary mechanism and treat the dumps below
as a second, offsite copy.

## What's at risk
All business data lives in Supabase Postgres: cars, parts, **orders, payments,
customers, inquiries, car_costs, purchase_orders, admin_audit**. Storage buckets
(`car-images`, `part-images`) hold the images. The app itself is stateless and
redeployable from git, so backups are about the **database** (and, secondarily,
the storage buckets).

## Nightly backup
```bash
DATABASE_URL="postgres://...supabase-connection-string..." \
  ./scripts/backup-db.sh /home/tez/backups
```
- Writes a compressed, restorable custom-format dump (`tez-YYYY-MM-DD_HHMM.dump`).
- Keeps the newest 14; prunes older.
- Cron it (self-host or any box with `pg_dump`):
  ```
  0 3 * * * DATABASE_URL=... /path/to/scripts/backup-db.sh /home/tez/backups
  ```
- **Copy `/home/tez/backups` offsite** periodically (external drive / object store)
  — a backup on the same dying machine isn't a backup.

## Restore drill (do this BEFORE go-live, then quarterly)
Restore into a **throwaway** database and confirm the app boots against it — never
practice on production.
```bash
createdb tez_restore_test
pg_restore --clean --if-exists --no-owner -d tez_restore_test tez-2026-06-01_0300.dump
# point a local app build at it and smoke-test /track, admin login, a catalog page
dropdb tez_restore_test
```
A backup you've never restored is a hope, not a backup.

## Migrations
Schema is code in `supabase/migrations/` (001..NNN). Verify they apply cleanly on
a fresh DB:
```bash
createdb tez_verify
DATABASE_URL=postgres://localhost/tez_verify npm run verify:migrations
dropdb tez_verify
```
To rebuild from scratch: create a fresh Supabase project → apply migrations in
order → restore the latest dump (data only) if migrating data.

## Storage buckets
DB PITR does not cover Storage. Keep the original processed images
(`scripts/seed/processed-images/` or your master copies) and re-upload if needed;
for production uploads, periodically mirror the buckets to external storage.
