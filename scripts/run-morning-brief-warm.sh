#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

INPUT="${1:-}"
DEVICE="${MORNING_BRIEF_DEVICE:-}"
PUBLIC_HOST="${MORNING_BRIEF_PUBLIC_HOST:-185.194.141.235}"
HTTP_PORT="${MORNING_BRIEF_HTTP_PORT:-18888}"
HTTP_HOST="${MORNING_BRIEF_HTTP_HOST:-0.0.0.0}"
HTTP_DIR="${MORNING_BRIEF_HTTP_DIR:-/tmp}"
WAV_OUT="${MORNING_BRIEF_WAV_OUT:-/tmp/morning-brief-warm-16k.wav}"
RAW_WAV_OUT="${MORNING_BRIEF_RAW_WAV_OUT:-/tmp/morning-brief-warm.raw.wav}"
SPOKEN_TEXT_OUT="${MORNING_BRIEF_SPOKEN_TEXT_OUT:-/tmp/morning-brief-warm.txt}"
KEEP_SERVER_MS="${MORNING_BRIEF_KEEP_SERVER_MS:-15000}"

if [[ -z "$INPUT" || "$INPUT" == "-h" || "$INPUT" == "--help" ]]; then
  cat <<'EOF'
Usage:
  bash scripts/run-morning-brief-warm.sh /path/to/brief.txt [device-name]

Environment overrides:
  MORNING_BRIEF_DEVICE           Xiaomi speaker name; fallback is channels.migpt.devices[0]
  MORNING_BRIEF_PUBLIC_HOST      Public host/IP for MiNA playback URL (default: 185.194.141.235)
  MORNING_BRIEF_HTTP_PORT        Temp HTTP port (default: 18888)
  MORNING_BRIEF_HTTP_HOST        Temp HTTP bind host (default: 0.0.0.0)
  MORNING_BRIEF_HTTP_DIR         Temp HTTP serving dir (default: /tmp)
  MORNING_BRIEF_WAV_OUT          Normalized output wav (default: /tmp/morning-brief-warm-16k.wav)
  MORNING_BRIEF_SPOKEN_TEXT_OUT  Rewritten spoken script path (default: /tmp/morning-brief-warm.txt)

Notes:
  - Manual trigger only; this script does NOT install cron.
  - Reads MiMo API key from env or /root/.openclaw/workspace/.credentials/xiaomi-api.txt.
  - Reads Xiaomi speaker credentials from ~/.openclaw/openclaw.json.
EOF
  exit 0
fi

if [[ -n "${2:-}" ]]; then
  DEVICE="$2"
fi

python3 "$SCRIPT_DIR/morning-brief-warm-tts.py" \
  --input "$INPUT" \
  --spoken-text-out "$SPOKEN_TEXT_OUT" \
  --raw-wav-out "$RAW_WAV_OUT" \
  --wav-out "$WAV_OUT"

PLAY_ARGS=(
  --file "$WAV_OUT"
  --public-host "$PUBLIC_HOST"
  --http-host "$HTTP_HOST"
  --http-port "$HTTP_PORT"
  --http-dir "$HTTP_DIR"
  --keep-server-ms "$KEEP_SERVER_MS"
)

if [[ -n "$DEVICE" ]]; then
  PLAY_ARGS+=(--device "$DEVICE")
fi

node "$SCRIPT_DIR/play-morning-brief-warm.mjs" "${PLAY_ARGS[@]}"
