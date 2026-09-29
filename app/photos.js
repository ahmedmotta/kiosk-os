'use strict';
// Kids' photos come from the cloud: the kiosk asks each child's own site for
// /api/photo using that child's Access token, and keeps a copy on disk so the
// photo still shows when the internet is down. Upload a photo once on the
// parent page and it appears here too (refreshed at start and every 20 min).
const fs = require('fs');
const path = require('path');
const store = require('./store');

const DIR = path.join(path.dirname(store.FILE), 'photos');
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX = 3 * 1024 * 1024;
const cache = new Map(); // userId -> data URL

function fileOf(id) { return path.join(DIR, `${id}.json`); }

function loadCached() {
  try {
    for (const f of fs.readdirSync(DIR)) {
      if (!f.endsWith('.json')) continue;
      const { url } = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
      if (typeof url === 'string' && url.startsWith('data:image/')) cache.set(f.slice(0, -5), url);
    }
  } catch { /* no photos yet */ }
}

function siteOf(user) {
  const app = store.apps().find((a) => user.apps.includes(a.id));
  try { return app ? new URL(app.url).origin : null; } catch { return null; }
}

async function fetchOne(user) {
  const origin = siteOf(user);
  if (!origin || !user.token || !user.token.id || !user.token.secret) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`${origin}/api/photo`, {
      headers: { 'CF-Access-Client-Id': user.token.id, 'CF-Access-Client-Secret': user.token.secret },
      redirect: 'manual',
      signal: ctrl.signal,
    });
    if (res.status === 404) { // no photo uploaded (or removed)
      if (cache.delete(user.id)) fs.rmSync(fileOf(user.id), { force: true });
      return true;
    }
    const type = (res.headers.get('content-type') || '').split(';')[0].trim();
    if (!res.ok || !TYPES.includes(type)) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > MAX) return false;
    const url = `data:${type};base64,${buf.toString('base64')}`;
    if (cache.get(user.id) === url) return false;
    cache.set(user.id, url);
    fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
    fs.writeFileSync(fileOf(user.id), JSON.stringify({ url }), { mode: 0o600 });
    return true;
  } catch {
    return false; // offline: keep the cached photo
  } finally {
    clearTimeout(timer);
  }
}

async function refresh(onChange) {
  let changed = false;
  for (const u of store.users()) if (await fetchOne(u)) changed = true;
  for (const id of [...cache.keys()]) if (!store.getUser(id)) cache.delete(id);
  if (changed && onChange) onChange();
}

function start(onChange) {
  loadCached();
  refresh(onChange);
  setInterval(() => refresh(onChange), 20 * 60 * 1000);
}

module.exports = { start, refresh, get: (id) => cache.get(id) || null };
