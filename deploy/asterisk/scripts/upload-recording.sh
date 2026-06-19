#!/usr/bin/env bash
#==============================================================================
# Tez Motors — push an Asterisk call recording into the CRM/AI pipeline.
# Invoked by MixMonitor on hangup (see extensions.conf [sub-record]).
#   $1 = phone (caller for inbound / callee for outbound)
#   $2 = direction (inbound|outbound)
#   $3 = absolute path to the finished .wav
#
# Reuses the ALREADY-WORKING endpoint: POST /api/admin/calls/upload-recording
# (Bearer CALLS_UPLOAD_SECRET) → store → Whisper → analyze → link to the CRM.
# duration is derived from the audio server-side, so we don't send it. The
# endpoint replies 201 in <1s (enrichment runs in the background on the Vostro),
# so this stays synchronous and fast.
#==============================================================================
set -uo pipefail

PHONE="${1:-}"
DIRECTION="${2:-outbound}"
REC="${3:-}"

ENV_FILE="/etc/asterisk/tez.env"
[ -f "$ENV_FILE" ] && . "$ENV_FILE"

LOG="/var/log/asterisk/tez-upload.log"
UPLOAD_URL="${CALLS_UPLOAD_URL:-https://tezmotors.uz/api/admin/calls/upload-recording}"

log() { echo "$(date -Is) $*" >> "$LOG" 2>/dev/null || true; }

if [ -z "${CALLS_UPLOAD_SECRET:-}" ]; then
  log "ERROR no CALLS_UPLOAD_SECRET in $ENV_FILE — skipping upload of $REC"
  exit 0   # never fail the call teardown
fi
if [ ! -s "$REC" ]; then
  log "skip empty/missing recording: $REC"
  exit 0
fi

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 120 -X POST "$UPLOAD_URL" \
  -H "Authorization: Bearer ${CALLS_UPLOAD_SECRET}" \
  -F "audio=@${REC};type=audio/wav" \
  -F "caller_phone=${PHONE}" \
  -F "direction=${DIRECTION}" 2>/dev/null || echo ERR)

log "${DIRECTION} ${PHONE} ${REC} -> ${code}"

# Reclaim VPS disk after a confirmed upload (the canonical copy lives on the Vostro).
if [ "$code" = "201" ] && [ "${TEZ_DELETE_AFTER_UPLOAD:-1}" = "1" ]; then
  rm -f "$REC"
fi
exit 0
