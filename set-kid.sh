#!/usr/bin/env bash
# Add a child to the kiosk over SSH: app + user + Cloudflare Access token.
#   sudo bash set-kid.sh <Name> <https://link> [color]
# Colors: blue teal orange purple pink green
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Run with sudo"; exit 1; }
NAME="${1:-}"; URL="${2:-}"; COLOR="${3:-blue}"
if [ -z "$NAME" ] || [ -z "$URL" ]; then
  echo "Usage: sudo bash set-kid.sh <Name> <https://link> [color]"
  exit 1
fi
NODE=/opt/kioskos/node/bin/node
[ -x "$NODE" ] || NODE=$(command -v node)
APP=/opt/kioskos/app
cp "$(dirname "$0")/app/cli.js" "$APP/cli.js" 2>/dev/null || true

echo "Paste the Cloudflare service token for $NAME."
read -rp  "Client ID: " CID
read -rsp "Client Secret (hidden): " CSEC; echo

sudo -u kiosk env KIOSK_CONFIG=/var/lib/kioskos/config.json \
  KID_NAME="$NAME" KID_URL="$URL" KID_COLOR="$COLOR" KID_CID="$CID" KID_SECRET="$CSEC" \
  "$NODE" "$APP/cli.js"
unset CSEC
systemctl restart getty@tty1
echo "The kiosk screen restarted with the new settings."
