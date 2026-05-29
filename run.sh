#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

PORT="${PORT:-5190}"
OPEN_BROWSER="${OPEN_BROWSER:-true}"
echo "Starting Relay on http://127.0.0.1:${PORT}/"

DEV_ARGS=(--port "${PORT}")

case "${OPEN_BROWSER}" in
  0|false|FALSE|no|NO|off|OFF)
    echo "Browser auto-open disabled."
    ;;
  *)
    DEV_ARGS+=(--open)
    echo "Opening Relay in your browser..."
    ;;
esac

exec npm run dev -- "${DEV_ARGS[@]}"
