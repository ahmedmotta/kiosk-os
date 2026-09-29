#!/usr/bin/env bash
# =====================================================================
#  Kiosk OS installer
#  Target: Debian 12/13 or Ubuntu 22.04+ (server or desktop), MacBook Pro Retina 2012
#  Run:    sudo bash install.sh
# =====================================================================
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
APP_DIR=/opt/kioskos
DATA_DIR=/var/lib/kioskos
KIOSK_USER=kiosk
ADMIN_LINUX=kioskadmin

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m%s\033[0m\n' "$*" >&2; exit 1; }

# ---------- checks ----------
[ "$(id -u)" -eq 0 ] || die "Run as root:  sudo bash install.sh"
. /etc/os-release
case "${ID:-}" in
  debian)
    case "${VERSION_CODENAME:-}" in
      bookworm|trixie) ;;
      *) die "Debian 12 or 13 is needed. Found: ${PRETTY_NAME:-unknown}" ;;
    esac ;;
  ubuntu)
    case "${VERSION_ID:-}" in
      22.04|24.04|24.10|25.04|25.10|26.04|26.10) ;;
      *) echo "Warning: untested Ubuntu version ${VERSION_ID:-?} — trying anyway." ;;
    esac ;;
  *) die "Debian 12/13 or Ubuntu 22.04+ is needed. Found: ${PRETTY_NAME:-unknown}" ;;
esac
[ -f "$SRC/app/main.js" ] || die "Can't find app/ next to install.sh"
getent hosts github.com >/dev/null 2>&1 || die "No internet. Connect Ethernet or USB tethering from a phone first."

# ---------- questions ----------
echo
echo "Kiosk OS setup"
echo "--------------"
read -rp "Name shown on screen [Innovation IT Hub]: " DEVICE_NAME
DEVICE_NAME=${DEVICE_NAME:-Innovation IT Hub}
read -rp "Admin panel username [admin]: " ADMIN_USER
ADMIN_USER=${ADMIN_USER:-admin}
while :; do
  read -rsp "Admin password (8+ characters, used for the panel, terminal and boot menu): " P1; echo
  read -rsp "Repeat password: " P2; echo
  if [ "$P1" != "$P2" ]; then echo "Passwords don't match."; continue; fi
  if [ ${#P1} -lt 8 ]; then echo "Too short."; continue; fi
  break
done

# ---------- repositories ----------
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a
if [ "$ID" = "debian" ]; then
  say "Enabling contrib / non-free (needed for the Broadcom Wi-Fi driver)"
  if [ -f /etc/apt/sources.list ]; then
    sed -i -E '/^deb(-src)? /s/ main( .*)?$/ main contrib non-free non-free-firmware/' /etc/apt/sources.list
  fi
  for f in /etc/apt/sources.list.d/*.sources; do
    [ -f "$f" ] && sed -i -E 's/^Components: .*/Components: main contrib non-free non-free-firmware/' "$f"
  done
  BASE_PKGS="linux-headers-amd64 firmware-linux firmware-misc-nonfree"
else
  say "Enabling universe / restricted / multiverse"
  if [ -f /etc/apt/sources.list ]; then
    sed -i -E '/^deb(-src)? /s/ main( .*)?$/ main restricted universe multiverse/' /etc/apt/sources.list
  fi
  for f in /etc/apt/sources.list.d/*.sources; do
    [ -f "$f" ] && sed -i -E 's/^Components: .*/Components: main restricted universe multiverse/' "$f"
  done
  BASE_PKGS="linux-headers-generic linux-firmware"
fi

# ---------- packages ----------
say "Installing packages (this takes a while)"
apt-get update
apt-get install -y --no-install-recommends \
  $BASE_PKGS dkms broadcom-sta-dkms \
  network-manager wpasupplicant iw \
  cage xwayland foot sudo dbus-user-session alsa-utils \
  plymouth plymouth-themes \
  nodejs npm ca-certificates curl

# Libraries Electron needs + fonts. Names differ between Debian/Ubuntu versions (e.g. the
# "t64" renames), so each one is tried on its own and a missing name is simply skipped.
for pkg in "linux-headers-$(uname -r)" firmware-brcm80211 polkitd policykit-1 \
           pipewire pipewire-pulse wireplumber \
           libgbm1 libnss3 libxss1 libxtst6 libdrm2 libxkbcommon0 libsecret-1-0 \
           libasound2t64 libasound2 libgtk-3-0t64 libgtk-3-0 libatk-bridge2.0-0t64 libatk-bridge2.0-0 \
           libgl1-mesa-dri mesa-vulkan-drivers \
           fonts-noto-core fonts-noto-color-emoji fonts-hosny-amiri fonts-dejavu-core; do
  apt-get install -y --no-install-recommends "$pkg" >/dev/null 2>&1 || true
done

say "Loading the Wi-Fi driver"
modprobe -r b44 b43 b43legacy ssb brcmsmac bcma 2>/dev/null || true
modprobe wl 2>/dev/null || echo "(wl will load after reboot)"

say "Handing networking to NetworkManager"
systemctl enable NetworkManager
# Debian: ifupdown keeps only loopback
if [ -f /etc/network/interfaces ] && grep -qv '^\s*#' /etc/network/interfaces; then
  cp /etc/network/interfaces /etc/network/interfaces.bak
  printf 'auto lo\niface lo inet loopback\nsource /etc/network/interfaces.d/*\n' > /etc/network/interfaces
fi
# Ubuntu: netplan hands everything to NetworkManager
if [ -d /etc/netplan ]; then
  install -d /etc/netplan/backup
  for f in /etc/netplan/*.yaml; do [ -f "$f" ] && mv "$f" /etc/netplan/backup/; done
  printf 'network:\n  version: 2\n  renderer: NetworkManager\n' > /etc/netplan/01-kioskos.yaml
  chmod 600 /etc/netplan/01-kioskos.yaml
  systemctl disable systemd-networkd-wait-online.service 2>/dev/null || true
fi
sed -i 's/^managed=.*/managed=true/' /etc/NetworkManager/NetworkManager.conf 2>/dev/null || true
# Ubuntu Desktop: no graphical login screen, the kiosk takes tty1 instead
for dm in gdm3 gdm lightdm sddm; do systemctl disable "$dm" 2>/dev/null || true; done

# ---------- accounts ----------
say "Creating accounts"
for g in video audio input render netdev; do getent group "$g" >/dev/null || groupadd -r "$g"; done
if ! id "$KIOSK_USER" >/dev/null 2>&1; then
  useradd -m -s /bin/bash -G video,audio,input,render,netdev "$KIOSK_USER"
fi
passwd -l "$KIOSK_USER" >/dev/null
if ! id "$ADMIN_LINUX" >/dev/null 2>&1; then
  useradd -m -s /bin/bash -G sudo "$ADMIN_LINUX"
fi
echo "$ADMIN_LINUX:$P1" | chpasswd

# ---------- app ----------
say "Installing the Kiosk OS app"
install -d "$APP_DIR"
rm -rf "$APP_DIR/app.new"
cp -r "$SRC/app" "$APP_DIR/app.new"
if [ -d "$APP_DIR/app/node_modules" ]; then mv "$APP_DIR/app/node_modules" "$APP_DIR/app.new/"; fi
rm -rf "$APP_DIR/app"
mv "$APP_DIR/app.new" "$APP_DIR/app"
# Ubuntu 22.04 ships Node.js 12, which is too old for Electron's installer.
# In that case fetch the official Node.js 22 build (checksum-verified) just for this step.
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$NODE_MAJOR" -lt 18 ]; then
  say "Node.js $NODE_MAJOR is too old — installing Node.js 22"
  NODE_URL=https://nodejs.org/dist/latest-v22.x
  TMPN=$(mktemp -d)
  curl -fsSL "$NODE_URL/SHASUMS256.txt" -o "$TMPN/SHASUMS256.txt" || die "Can't reach nodejs.org"
  TARBALL=$(awk '/linux-x64\.tar\.xz$/{print $2; exit}' "$TMPN/SHASUMS256.txt")
  [ -n "$TARBALL" ] || die "Can't find the Node.js download"
  curl -fsSL "$NODE_URL/$TARBALL" -o "$TMPN/$TARBALL" || die "Node.js download failed"
  ( cd "$TMPN" && grep " $TARBALL\$" SHASUMS256.txt | sha256sum -c - ) || die "Node.js checksum mismatch"
  rm -rf "$APP_DIR/node"
  install -d "$APP_DIR/node"
  tar -xJf "$TMPN/$TARBALL" -C "$APP_DIR/node" --strip-components=1
  rm -rf "$TMPN"
  export PATH="$APP_DIR/node/bin:$PATH"
fi
NODE_BIN=$(command -v node)
echo "Using Node.js $("$NODE_BIN" -v)"
( cd "$APP_DIR/app" && npm install --omit=dev --no-audit --no-fund )
SANDBOX="$APP_DIR/app/node_modules/electron/dist/chrome-sandbox"
[ -f "$SANDBOX" ] || die "Electron download failed. Check the internet and run install.sh again."
chown root:root "$SANDBOX"
chmod 4755 "$SANDBOX"
MISSING=$(ldd "$APP_DIR/app/node_modules/electron/dist/electron" 2>/dev/null | awk '/not found/{print $1}' | tr '\n' ' ')
[ -z "$MISSING" ] || echo "WARNING: missing libraries for the interface: $MISSING  (send this line to Claude)"
chown -R root:root "$APP_DIR"

cat > "$APP_DIR/start.sh" <<'EOF'
#!/bin/sh
# Started by cage on tty1. Change KIOSK_SCALE to 1 if everything looks tiny/huge.
export KIOSK_SCALE="${KIOSK_SCALE:-2}"
export ELECTRON_ENABLE_LOGGING=1
cd /opt/kioskos/app || exit 1
exec ./node_modules/electron/dist/electron . --ozone-platform=x11
EOF
chmod 755 "$APP_DIR/start.sh"

install -d -o "$KIOSK_USER" -g "$KIOSK_USER" -m 700 "$DATA_DIR"
sudo -u "$KIOSK_USER" env \
  KIOSK_ADMIN_USER="$ADMIN_USER" KIOSK_ADMIN_PASS="$P1" KIOSK_DEVICE_NAME="$DEVICE_NAME" \
  "$NODE_BIN" "$APP_DIR/app/store.js" init

# ---------- auto-login straight into the kiosk ----------
say "Setting up auto-login"
install -d /etc/systemd/system/getty@tty1.service.d
cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf <<EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $KIOSK_USER --noclear --noissue %I \$TERM
TTYVTDisallocate=no
EOF

KHOME=$(getent passwd "$KIOSK_USER" | cut -d: -f6)
cat > "$KHOME/.bash_profile" <<'EOF'
# Kiosk session: cage runs one fullscreen app. No -s flag = VT switching disabled.
if [ -z "$WAYLAND_DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
  clear
  while true; do
    LOG="$HOME/kioskos.log"
    [ -f "$LOG" ] && [ "$(stat -c %s "$LOG")" -gt 2000000 ] && mv "$LOG" "$LOG.old"
    echo "=== start $(date) ===" >>"$LOG"
    cage -d -- /opt/kioskos/start.sh >>"$LOG" 2>&1
    echo "=== exit $? $(date) ===" >>"$LOG"
    sleep 2
  done
fi
EOF
touch "$KHOME/.hushlogin"
install -d "$KHOME/.config/foot"
cat > "$KHOME/.config/foot/foot.ini" <<'EOF'
font=DejaVu Sans Mono:size=11
pad=12x12
[colors]
background=0b1020
foreground=e6ebff
EOF
chown -R "$KIOSK_USER:$KIOSK_USER" "$KHOME"
systemctl set-default multi-user.target

# ---------- lockdown ----------
say "Locking the system down"
install -d /etc/systemd/logind.conf.d
cat > /etc/systemd/logind.conf.d/kioskos.conf <<'EOF'
[Login]
NAutoVTs=0
ReserveVT=0
EOF

cat > /etc/sysctl.d/90-kioskos.conf <<'EOF'
kernel.sysrq=0
EOF

# Kiosk user may manage Wi-Fi and power, nothing else.
install -d /etc/polkit-1/rules.d
cat > /etc/polkit-1/rules.d/50-kioskos.rules <<EOF
polkit.addRule(function (action, subject) {
  if (subject.user != "$KIOSK_USER") return;
  if (action.id.indexOf("org.freedesktop.NetworkManager.") == 0) return polkit.Result.YES;
  var power = ["org.freedesktop.login1.power-off", "org.freedesktop.login1.power-off-multiple-sessions",
               "org.freedesktop.login1.reboot", "org.freedesktop.login1.reboot-multiple-sessions"];
  if (power.indexOf(action.id) >= 0) return polkit.Result.YES;
});
EOF
# Older polkit (Ubuntu 22.04) reads .pkla files instead of the JS rule above.
install -d /etc/polkit-1/localauthority/50-local.d
cat > /etc/polkit-1/localauthority/50-local.d/kioskos.pkla <<EOF
[Kiosk Wi-Fi]
Identity=unix-user:$KIOSK_USER
Action=org.freedesktop.NetworkManager.*
ResultAny=yes
ResultInactive=yes
ResultActive=yes

[Kiosk power]
Identity=unix-user:$KIOSK_USER
Action=org.freedesktop.login1.power-off;org.freedesktop.login1.power-off-multiple-sessions;org.freedesktop.login1.reboot;org.freedesktop.login1.reboot-multiple-sessions
ResultAny=yes
ResultInactive=yes
ResultActive=yes
EOF

# ---------- boot: silent + password-protected GRUB ----------
say "Configuring a silent, protected boot"
G=/etc/default/grub
sed -i -E 's/^GRUB_TIMEOUT=.*/GRUB_TIMEOUT=0/' "$G"
if grep -q '^GRUB_TIMEOUT_STYLE=' "$G"; then sed -i -E 's/^GRUB_TIMEOUT_STYLE=.*/GRUB_TIMEOUT_STYLE=hidden/' "$G"; else echo 'GRUB_TIMEOUT_STYLE=hidden' >> "$G"; fi
sed -i -E 's/^GRUB_CMDLINE_LINUX_DEFAULT=.*/GRUB_CMDLINE_LINUX_DEFAULT="quiet splash loglevel=3 rd.systemd.show_status=false vt.global_cursor_default=0"/' "$G"

GHASH=$(printf '%s\n%s\n' "$P1" "$P1" | grub-mkpasswd-pbkdf2 | awk '/grub.pbkdf2/{print $NF}')
if [ -n "$GHASH" ]; then
  cat > /etc/grub.d/01_kioskos_password <<EOF
#!/bin/sh
cat <<'EOT'
set superusers="$ADMIN_LINUX"
password_pbkdf2 $ADMIN_LINUX $GHASH
EOT
EOF
  chmod 755 /etc/grub.d/01_kioskos_password
  # Normal boot needs no password; editing entries / recovery does.
  sed -i 's/^CLASS="--class gnu-linux --class gnu --class os"$/CLASS="--class gnu-linux --class gnu --class os --unrestricted"/' /etc/grub.d/10_linux
fi

# Boot screen: Innovation IT Hub logo, name and quote (plymouth/kioskos)
install -d /usr/share/plymouth/themes/kioskos
cp "$SRC"/plymouth/kioskos/* /usr/share/plymouth/themes/kioskos/
if command -v plymouth-set-default-theme >/dev/null; then
  plymouth-set-default-theme kioskos || true
else
  update-alternatives --install /usr/share/plymouth/themes/default.plymouth default.plymouth \
    /usr/share/plymouth/themes/kioskos/kioskos.plymouth 200
  update-alternatives --set default.plymouth /usr/share/plymouth/themes/kioskos/kioskos.plymouth
fi
echo "FRAMEBUFFER=y" > /etc/initramfs-tools/conf.d/splash
# Start the Intel graphics driver early so the boot screen draws cleanly.
grep -qx i915 /etc/initramfs-tools/modules 2>/dev/null || echo i915 >> /etc/initramfs-tools/modules
update-initramfs -u
update-grub

timedatectl set-timezone Africa/Cairo 2>/dev/null || true

unset P1 P2
say "Done."
echo
echo "  Reboot now:   sudo reboot"
echo "  Admin panel:  press Ctrl + Alt + A on the kiosk"
echo "  Logs:         $KHOME/kioskos.log"
echo
