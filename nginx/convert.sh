#!/bin/bash
# convert.sh – called by nginx-rtmp exec_record_done
# Usage: convert.sh <flv_path> <stream_key>
#
# 1. Remux FLV → MP4 (no re-encode: fast, CPU-light)
# 2. On success: delete .flv, notify API with mp4 path
# 3. On failure: notify API with failed status, keep .flv

set -euo pipefail

FLV_PATH="${1:-}"
STREAM_KEY="${2:-}"
API_URL="${API_NOTIFY_URL:-http://api:3000/api/recordings/notify}"
INTERNAL_TOKEN="${INTERNAL_TOKEN:-}"

# ── Validate inputs ───────────────────────────────────────────────────────────
if [[ -z "$FLV_PATH" || -z "$STREAM_KEY" ]]; then
  echo "[convert] ERROR: missing arguments (path='$FLV_PATH' key='$STREAM_KEY')" >&2
  exit 1
fi

# Safety: ensure path is inside /recordings to prevent traversal
REAL_PATH="$(realpath -m "$FLV_PATH")"
if [[ "$REAL_PATH" != /recordings/* ]]; then
  echo "[convert] ERROR: path not inside /recordings: $REAL_PATH" >&2
  exit 1
fi

FLV_BASE="$(basename "$FLV_PATH")"
MP4_PATH="${FLV_PATH%.flv}.mp4"
MP4_BASE="$(basename "$MP4_PATH")"

echo "[convert] START  $FLV_BASE → $MP4_BASE"

# ── FFmpeg remux (copy streams, no re-encode) ─────────────────────────────────
if ffmpeg -y -loglevel warning \
    -i "$FLV_PATH" \
    -c copy \
    -movflags +faststart \
    "$MP4_PATH"; then

  echo "[convert] OK     $MP4_BASE ($(du -sh "$MP4_PATH" | cut -f1))"
  rm -f "$FLV_PATH"

  curl -sf -X POST "$API_URL" \
    -H "X-Internal-Token: ${INTERNAL_TOKEN}" \
    -d "name=${STREAM_KEY}&path=${MP4_PATH}&status=ready" \
    || echo "[convert] WARN: API notify failed (non-fatal)"

else
  echo "[convert] FAILED to convert $FLV_BASE – keeping original" >&2

  curl -sf -X POST "$API_URL" \
    -H "X-Internal-Token: ${INTERNAL_TOKEN}" \
    -d "name=${STREAM_KEY}&path=${FLV_PATH}&orig=${FLV_BASE}&status=failed" \
    || echo "[convert] WARN: API notify failed (non-fatal)"

  exit 1
fi
