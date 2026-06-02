#!/usr/bin/env bash
# Nightly logical backup of the Supabase Postgres database.
#
# A business that holds deposits must have restorable backups. Supabase Pro adds
# PITR, but this gives you an independent, offsite-able dump on any tier.
#
# Usage:
#   DATABASE_URL="postgres://...supabase..." ./scripts/backup-db.sh [out_dir]
# Cron (daily 03:00):
#   0 3 * * * DATABASE_URL=... /path/to/scripts/backup-db.sh /home/tez/backups
#
# Requires: pg_dump (postgresql-client). Keeps the last 14 dumps.
set -euo pipefail

OUT_DIR="${1:-./backups}"
RETAIN=14

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi
if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump not found — install postgresql-client" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
STAMP="$(date +%F_%H%M)"
FILE="$OUT_DIR/tez-$STAMP.dump"

# Custom format (-Fc) → compressed + restorable with pg_restore.
pg_dump "$DATABASE_URL" -Fc -f "$FILE"
echo "✓ backup written: $FILE ($(du -h "$FILE" | cut -f1))"

# Prune old dumps, keep the most recent $RETAIN.
ls -1t "$OUT_DIR"/tez-*.dump 2>/dev/null | tail -n +$((RETAIN + 1)) | xargs -r rm -f
echo "✓ retention: keeping newest $RETAIN dumps in $OUT_DIR"
