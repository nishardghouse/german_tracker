#!/usr/bin/env bash
# Run once on a fresh Oracle Cloud Ubuntu 22.04 ARM instance.
# Usage: bash server-setup.sh <your-github-username> <your-repo-name>
#   e.g. bash server-setup.sh nishard sprachheld
set -euo pipefail

GITHUB_USER="${1:?Usage: bash server-setup.sh <github-user> <repo-name>}"
REPO_NAME="${2:?Usage: bash server-setup.sh <github-user> <repo-name>}"
APP_DIR="/opt/sprachheld"

echo "=== 1. System packages ==="
sudo apt-get update -y
sudo apt-get install -y git curl unzip

echo "=== 2. Python 3.12 via deadsnakes ==="
sudo apt-get install -y software-properties-common
sudo add-apt-repository -y ppa:deadsnakes/ppa
sudo apt-get update -y
sudo apt-get install -y python3.12 python3.12-venv python3.12-dev

echo "=== 3. uv (Python package manager) ==="
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.cargo/bin:$PATH"

echo "=== 4. Node.js 22 ==="
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "=== 5. Caddy (web server / reverse proxy) ==="
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update -y
sudo apt-get install -y caddy

echo "=== 6. Clone repo ==="
sudo mkdir -p "$APP_DIR"
sudo chown "$USER:$USER" "$APP_DIR"
git clone "https://github.com/${GITHUB_USER}/${REPO_NAME}.git" "$APP_DIR"

echo "=== 7. Backend Python deps ==="
cd "$APP_DIR/backend"
~/.cargo/bin/uv sync

echo "=== 8. Frontend build ==="
cd "$APP_DIR/frontend"
npm ci
npm run build

echo ""
echo "=== Done! Next steps ==="
echo ""
echo "1. Create your .env:"
echo "   nano $APP_DIR/backend/.env"
echo "   (Copy from $APP_DIR/backend/.env.example — fill in ANTHROPIC_API_KEY and APP_TOKEN)"
echo ""
echo "2. Install the systemd service:"
echo "   sudo cp $APP_DIR/deploy/sprachheld.service /etc/systemd/system/"
echo "   sudo sed -i \"s|/opt/sprachheld|$APP_DIR|g\" /etc/systemd/system/sprachheld.service"
echo "   sudo sed -i \"s|YOUR_USERNAME|$USER|g\" /etc/systemd/system/sprachheld.service"
echo "   sudo systemctl daemon-reload"
echo "   sudo systemctl enable --now sprachheld"
echo ""
echo "3. Configure Caddy (replace YOUR_DOMAIN with your DuckDNS subdomain):"
echo "   sudo cp $APP_DIR/deploy/Caddyfile /etc/caddy/Caddyfile"
echo "   sudo sed -i 's/YOUR_DOMAIN/your-name.duckdns.org/' /etc/caddy/Caddyfile"
echo "   sudo systemctl reload caddy"
echo ""
echo "4. Open ports in Oracle Cloud VCN Security List: TCP 80 and 443 inbound."
