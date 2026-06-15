#!/usr/bin/env bash
# Run on the server to pull the latest code and restart.
# Usage (from any directory): bash /opt/sprachheld/deploy/deploy.sh
set -euo pipefail

APP_DIR="/opt/sprachheld"
cd "$APP_DIR"

echo "=== Pulling latest code ==="
git pull

echo "=== Updating Python deps ==="
cd "$APP_DIR/backend"
~/.local/bin/uv sync

echo "=== Rebuilding frontend ==="
cd "$APP_DIR/frontend"
npm ci
npm run build

echo "=== Restarting service ==="
sudo systemctl restart sprachheld

echo "=== Done! App restarted. ==="
sudo systemctl status sprachheld --no-pager
