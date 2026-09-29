'use strict';
// Keeps a full copy of the Quran recitation (Al-Husary, 6,236 ayat) on this laptop,
// so lessons play audio without using the internet.
//  - Downloads in the background, in lesson order (Al-Fatiha, then An-Nas → Al-Baqarah),
//    from the children's own site (which serves it from our Cloudflare storage).
//  - Serves it to the lessons at http://127.0.0.1:47800/quran/<surah>/<ayah>.
//    The lesson page tries this first and falls back to the internet if a file is missing.
const fs = require('fs');
const path = require('path');
const http = require('http');
const store = require('./store');

const DIR = path.join(path.dirname(store.FILE), 'quran-audio');
const PORT = 47800;
const MIN_FREE = 3 * 1024 ** 3; // keep at least 3 GB free
const AYAT = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];
const TOTAL = 6236;
const ORDER = [1, ...Array.from({ length: 113 }, (_, i) => 114 - i)];

const pad3 = (n) => String(n).padStart(3, '0');
const PAUSE_FILE = path.join(path.dirname(store.FILE), 'quran-audio.pause');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let busy = () => false; // set by main.js: true while a child has a lesson open

// Gentle on the connection: never while a child is using the kiosk, never on a
// phone hotspot / metered connection, never when paused by Baba, and a short rest between files.
function mayDownload() {
  if (fs.existsSync(PAUSE_FILE)) return 'Paused by Baba';
  if (busy()) return 'Waiting: a lesson is open';
  try {
    const out = require('child_process').execFileSync('nmcli', ['-t', '-f', 'GENERAL.METERED', 'dev', 'show'], { timeout: 5000 }).toString();
    if (/METERED:yes/i.test(out)) return 'Waiting: phone hotspot / metered connection';
  } catch { /* no nmcli: allow */ }
  return null;
}
const fileOf = (s, a) => path.join(DIR, `${pad3(s)}${pad3(a)}.mp3`);
let state = { saved: 0, running: false, note: '' };

function count() {
  try { return fs.readdirSync(DIR).filter((f) => f.endsWith('.mp3')).length; } catch { return 0; }
}

function freeBytes() {
  try { const st = fs.statfsSync(path.dirname(store.FILE)); return st.bavail * st.bsize; } catch { return Infinity; }
}

// Any child with a token and an app can fetch the audio (it's the same for everyone).
function source() {
  for (const u of store.users()) {
    const app = store.apps().find((a) => u.apps.includes(a.id));
    if (app && u.token && u.token.id && u.token.secret) {
      try { return { origin: new URL(app.url).origin, token: u.token }; } catch { /* next */ }
    }
  }
  return null;
}

async function fetchOne(src, s, a) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(`${src.origin}/api/quran/audio/${s}/${a}`, {
      headers: { 'CF-Access-Client-Id': src.token.id, 'CF-Access-Client-Secret': src.token.secret },
      redirect: 'manual', signal: ctrl.signal,
    });
    if (!res.ok || !(res.headers.get('content-type') || '').startsWith('audio/')) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1000) return false;
    const tmp = fileOf(s, a) + '.part';
    fs.writeFileSync(tmp, buf);
    fs.renameSync(tmp, fileOf(s, a));
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function downloadAll() {
  if (state.running) return;
  state.running = true;
  try {
    fs.mkdirSync(DIR, { recursive: true, mode: 0o755 });
    let failures = 0;
    for (const s of ORDER) {
      for (let a = 1; a <= AYAT[s - 1]; a++) {
        if (fs.existsSync(fileOf(s, a))) continue;
        if (freeBytes() < MIN_FREE) { state.note = 'Stopped: disk almost full'; return; }
        const hold = mayDownload();
        if (hold) { state.note = hold; return; }
        await wait(1500);
        const src = source();
        if (!src) { state.note = 'Waiting for a child with a token'; return; }
        const ok = await fetchOne(src, s, a);
        if (!ok && ++failures >= 10) { state.note = 'Paused: no connection, will retry'; return; }
        if (ok) failures = 0;
      }
    }
    state.note = count() >= TOTAL ? 'Complete' : 'Some files could not be downloaded';
  } finally {
    state.saved = count();
    state.running = false;
  }
}

function serve() {
  const server = http.createServer((req, res) => {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Private-Network': 'true',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
    const m = /^\/quran\/(\d{1,3})\/(\d{1,3})$/.exec((req.url || '').split('?')[0]);
    const s = m && Number(m[1]);
    const a = m && Number(m[2]);
    if (!m || s < 1 || s > 114 || a < 1 || a > AYAT[s - 1] || req.method !== 'GET') { res.writeHead(404, cors); res.end(); return; }
    const file = fileOf(s, a);
    fs.stat(file, (err, st) => {
      if (err) { res.writeHead(404, cors); res.end(); return; }
      const headers = { ...cors, 'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=31536000, immutable' };
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
      if (range) {
        const start = range[1] ? Number(range[1]) : 0;
        const end = range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
        if (start > end) { res.writeHead(416, { ...headers, 'Content-Range': `bytes */${st.size}` }); res.end(); return; }
        res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
        fs.createReadStream(file, { start, end }).pipe(res);
      } else {
        res.writeHead(200, { ...headers, 'Content-Length': st.size });
        fs.createReadStream(file).pipe(res);
      }
    });
  });
  server.on('error', () => { /* port busy: lessons fall back to the internet */ });
  server.listen(PORT, '127.0.0.1');
}

function start() {
  state.saved = count();
  serve();
  setTimeout(downloadAll, 60 * 1000);                  // let the screen settle first
  setInterval(downloadAll, 10 * 60 * 1000);            // resume later (after a lesson, outage or pause)
}

module.exports = { setBusy: (fn) => { busy = fn; }, start, downloadAll, status: () => ({ ...state, saved: count(), total: TOTAL }) };
