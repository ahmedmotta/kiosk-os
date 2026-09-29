'use strict';
// Config storage: /var/lib/kioskos/config.json (owned by the kiosk user, mode 600).
// Passwords are stored as scrypt hashes. Cloudflare tokens are stored per user.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = process.env.KIOSK_CONFIG || '/var/lib/kioskos/config.json';
const COLORS = ['blue', 'teal', 'orange', 'purple', 'pink', 'green'];
const ICONS = ['book', 'code', 'quran', 'globe', 'star', 'puzzle', 'pencil', 'music', 'game'];

let data = null;

function load() {
  if (!data) {
    data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    data.apps = data.apps || [];
    data.users = data.users || [];
  }
  return data;
}

function save() {
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
}

function hash(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(String(pw), salt, 64);
  return `scrypt$${salt.toString('hex')}$${h.toString('hex')}`;
}

function verify(pw, stored) {
  if (!stored) return pw === '';
  const [, s, h] = String(stored).split('$');
  if (!s || !h) return false;
  const calc = crypto.scryptSync(String(pw), Buffer.from(s, 'hex'), 64);
  const want = Buffer.from(h, 'hex');
  return want.length === calc.length && crypto.timingSafeEqual(want, calc);
}

const newId = () => crypto.randomBytes(6).toString('hex');

module.exports = {
  FILE, COLORS, ICONS, hash, verify, newId, save,
  get: load,
  apps: () => load().apps,
  users: () => load().users,
  getApp: (id) => load().apps.find((a) => a.id === id),
  getUser: (id) => load().users.find((u) => u.id === id),
};

// First-time setup, called by install.sh:
//   KIOSK_ADMIN_USER=.. KIOSK_ADMIN_PASS=.. KIOSK_DEVICE_NAME=.. node store.js init
if (require.main === module && process.argv[2] === 'init') {
  const user = process.env.KIOSK_ADMIN_USER;
  const pass = process.env.KIOSK_ADMIN_PASS;
  if (!user || !pass) { console.error('KIOSK_ADMIN_USER and KIOSK_ADMIN_PASS are required'); process.exit(1); }
  if (fs.existsSync(FILE) && !process.env.KIOSK_FORCE) {
    console.log('Config already exists — keeping apps and users. (Set KIOSK_FORCE=1 to reset.)');
    process.exit(0);
  }
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  data = {
    version: 1,
    deviceName: process.env.KIOSK_DEVICE_NAME || 'Kiosk',
    admin: { user, passwordHash: hash(pass) },
    apps: [],
    users: [],
  };
  save();
  console.log('Config created at ' + FILE);
}
