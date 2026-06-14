#!/bin/bash
# Scheduled market-price collection: refresh the catalog-driven search list, then
# sweep OLX (API-only) and POST to the local app's ingest endpoint. Logs append to
# ~/subs/market-cron.log. Scheduled via crontab (see SETUP.md).
cd /home/rayxona/tez-motors/deploy/collector || exit 1
export INGEST_URL="http://127.0.0.1:3000/api/admin/market/ingest"
export MARKET_INGEST_SECRET="$(grep -E '^MARKET_INGEST_SECRET=' /home/rayxona/tez-motors/.env.local | cut -d= -f2-)"
export OLX_SEARCHES_FILE="./searches.json"
export OLX_NO_BROWSER="1"
LOG=/home/rayxona/subs/market-cron.log
echo "[$(date)] === market run start ===" >> "$LOG"
node gen-searches.mjs >> "$LOG" 2>&1
node olx-crawlee.mjs >> "$LOG" 2>&1
echo "[$(date)] === market run done ===" >> "$LOG"
