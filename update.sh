#!/usr/bin/env bash
# =====================================================================
#  Kiosk OS quick update — no questions, keeps users/apps/tokens.
#  Run after `git pull`:   sudo bash update.sh
# =====================================================================
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
APP_DIR=/opt/kioskos

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m%s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run as root:  sudo bash update.sh"
[ -d "$APP_DIR/app/node_modules" ] || die "Kiosk OS isn't installed yet — run install.sh first."

# ---------- app ----------
say "Updating the interface"
NEED_NPM=0
cmp -s "$SRC/app/package.json" "$APP_DIR/app/package.json" || NEED_NPM=1
for f in main.js preload.js store.js system.js cli.js package.json; do
  install -m 644 "$SRC/app/$f" "$APP_DIR/app/$f"
done
rm -rf "$APP_DIR/app/ui"
cp -r "$SRC/app/ui" "$APP_DIR/app/ui"
if [ "$NEED_NPM" = 1 ]; then
  [ -x "$APP_DIR/node/bin/node" ] && export PATH="$APP_DIR/node/bin:$PATH"
  ( cd "$APP_DIR/app" && npm install --omit=dev --no-audit --no-fund )
  chown root:root "$APP_DIR/app/node_modules/electron/dist/chrome-sandbox"
  chmod 4755 "$APP_DIR/app/node_modules/electron/dist/chrome-sandbox"
fi
chown -R root:root "$APP_DIR/app"

# ---------- boot screen ----------
THEME=/usr/share/plymouth/themes/kioskos
REBUILD=0
install -d "$THEME"
for f in "$SRC"/plymouth/kioskos/*; do
  cmp -s "$f" "$THEME/$(basename "$f")" || { install -m 644 "$f" "$THEME/"; REBUILD=1; }
done
# Start the Intel graphics driver early so the boot screen draws cleanly.
if ! grep -qx 'i915' /etc/initramfs-tools/modules 2>/dev/null; then
  echo i915 >> /etc/initramfs-tools/modules
  REBUILD=1
fi
if [ "$REBUILD" = 1 ]; then
  say "Updating the boot screen"
  update-initramfs -u
fi

# ---------- restart the interface ----------
say "Restarting the interface"
systemctl restart getty@tty1
say "Done."
