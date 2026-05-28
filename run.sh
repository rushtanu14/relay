#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

PORT="${PORT:-5190}"
echo "Starting Relay on http://127.0.0.1:${PORT}/"

exec npm run dev -- --port "${PORT}"
