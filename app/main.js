'use strict';
// Kiosk OS — main process.
// One fullscreen window draws the shell (login, dock, notch, Wi-Fi, admin).
// Each app is a separate WebContentsView with no address bar, locked to its own site,
// running in its user's own session, which adds that user's Cloudflare Access token.
const { app, BrowserWindow, WebContentsView, ipcMain, session, Menu } = require('electron');
const path = require('path');
const store = require('./store');
const sys = require('./system');
const photos = require('./photos');
const quranAudio = require('./audio');

if (!app.requestSingleInstanceLock()) app.exit(0);

app.commandLine.appendSwitch('force-device-scale-factor', process.env.KIOSK_SCALE || '2');
app.commandLine.appendSwitch('disable-pinch');
app.commandLine.appendSwitch('overscroll-history-navigation', '0');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// Lessons may load Quran audio from this laptop (http://127.0.0.1:47800).
app.commandLine.appendSwitch('disable-features', 'PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults,BlockInsecurePrivateNetworkRequests,LocalNetworkAccessChecks');
Menu.setApplicationMenu(null);

const INSET = { top: 46, side: 14, bottom: 14 };
const OFFLINE = path.join(__dirname, 'ui', 'offline.html');

let win = null;
let userId = null;
let adminMode = false;
let activeAppId = null;
const views = new Map();
const configuredSessions = new Set();
const guard = { fails: 0, until: 0 };

const hostOf = (u) => { try { return new URL(u).host; } catch { return ''; } };
const clean = (s, max) => String(s ?? '').trim().slice(0, max);
const currentUser = () => (userId ? store.getUser(userId) : null);

// ---------- brute-force guard ----------
function checkLock() {
  const left = guard.until - Date.now();
  if (left > 0) throw new Error(`Too many attempts. Try again in ${Math.ceil(left / 1000)}s`);
}
function failed(msg) {
  guard.fails += 1;
  if (guard.fails >= 5) { guard.fails = 0; guard.until = Date.now() + 30000; }
  throw new Error(msg);
}

// ---------- lockdown for every web contents ----------
function isBlockedKey(i) {
  const k = (i.key || '').toLowerCase();
  if (['f11', 'f12', 'browserback', 'browserforward'].includes(k)) return true;
  if (i.alt && ['arrowleft', 'arrowright', 'f4'].includes(k)) return true;
  if ((i.control || i.meta) && i.shift && ['i', 'j', 'c'].includes(k)) return true;
  return false;
}

// An app may move between its own host and that host's subdomains
// (google.com -> www.google.com, example.com -> accounts.example.com), nothing else.
function siteBase(host) { return String(host || '').replace(/^www\./, '').replace(/:\d+$/, ''); }
function sameSite(url, allowedHost) {
  if (!allowedHost) return false;
  const h = siteBase(hostOf(url));
  const base = siteBase(allowedHost);
  return !!h && (h === base || h.endsWith('.' + base));
}

function lockContents(wc, allowedHost) {
  wc.on('before-input-event', (e, i) => {
    if (i.type !== 'keyDown') return;
    const k = (i.key || '').toLowerCase();
    if (i.control && i.alt && k === 'a') {
      e.preventDefault();
      goHome();
      win.webContents.send('admin:prompt');
      return;
    }
    if (i.key === 'AudioVolumeUp') { e.preventDefault(); sys.volume('up'); return; }
    if (i.key === 'AudioVolumeDown') { e.preventDefault(); sys.volume('down'); return; }
    if (i.key === 'AudioVolumeMute') { e.preventDefault(); sys.volume('mute'); return; }
    if (isBlockedKey(i)) e.preventDefault();
  });
  // Popups: same-site links open in place, everything else is dropped.
  wc.setWindowOpenHandler(({ url }) => {
    if (sameSite(url, allowedHost)) wc.loadURL(url).catch(() => {});
    return { action: 'deny' };
  });
  wc.on('will-navigate', (e, url) => {
    if (!sameSite(url, allowedHost)) e.preventDefault();
  });
  wc.on('will-attach-webview', (e) => e.preventDefault());
}

// ---------- shell window ----------
function createWindow() {
  win = new BrowserWindow({
    fullscreen: true,
    kiosk: true,
    frame: false,
    show: true,
    backgroundColor: '#0b1020',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      devTools: false,
      spellcheck: false,
    },
  });
  lockContents(win.webContents, null);
  win.on('resize', layout);
  win.webContents.on('render-process-gone', () => win.reload());
  win.loadFile(path.join(__dirname, 'ui', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  photos.start(() => push());
  quranAudio.setBusy(() => !!activeAppId);
  quranAudio.start();
});
app.on('window-all-closed', () => app.quit());

// ---------- state sent to the shell (never contains links or tokens) ----------
function publicUsers() {
  return store.users().map((u) => ({ id: u.id, name: u.name, color: u.color, hasPassword: !!u.passwordHash, photo: photos.get(u.id) }));
}
function appsFor(u) {
  if (!u) return [];
  return store.apps()
    .filter((a) => u.apps.includes(a.id))
    .map(({ id, name, color, icon }) => ({ id, name, color, icon }));
}
function state() {
  const u = currentUser();
  const apps = appsFor(u);
  return {
    deviceName: store.get().deviceName,
    users: publicUsers(),
    user: u ? { id: u.id, name: u.name, color: u.color, photo: photos.get(u.id) } : null,
    apps,
    activeAppId,
    activeApp: apps.find((a) => a.id === activeAppId) || null,
  };
}
function push() {
  if (win && !win.isDestroyed()) win.webContents.send('state', state());
}

// ---------- per-user session: cookies + Cloudflare Access token ----------
function userSession(u) {
  const partition = 'persist:u-' + u.id;
  const ses = session.fromPartition(partition);
  if (!configuredSessions.has(partition)) {
    configuredSessions.add(partition);
    const uid = u.id;
    // Tells the lesson site it runs on the kiosk, so it plays Quran audio from this laptop.
    ses.setUserAgent(`${ses.getUserAgent()} KioskOS/1`);
    ses.setPermissionRequestHandler((_wc, perm, cb) => cb(['media', 'fullscreen', 'clipboard-sanitized-write'].includes(perm)));
    ses.on('will-download', (e) => e.preventDefault());
    ses.webRequest.onBeforeSendHeaders((d, cb) => {
      const headers = d.requestHeaders;
      const owner = store.getUser(uid);
      if (owner && owner.token && owner.token.id && owner.token.secret) {
        const h = hostOf(d.url);
        // Token is only sent to the hosts of this user's own apps.
        if (h && store.apps().some((a) => owner.apps.includes(a.id) && hostOf(a.url) === h)) {
          headers['CF-Access-Client-Id'] = owner.token.id;
          headers['CF-Access-Client-Secret'] = owner.token.secret;
        }
      }
      cb({ requestHeaders: headers });
    });
  }
  return ses;
}

// ---------- app views ----------
function layout() {
  const v = views.get(activeAppId);
  if (!v || !win) return;
  const [w, h] = win.getContentSize();
  v.setBounds({ x: INSET.side, y: INSET.top, width: w - INSET.side * 2, height: h - INSET.top - INSET.bottom });
}
function detach(v) {
  try { win.contentView.removeChildView(v); } catch { /* not attached */ }
}
function closeView(id) {
  const v = views.get(id);
  if (!v) return;
  detach(v);
  clearTimeout(v.webContents.kioskRetry);
  if (!v.webContents.isDestroyed()) v.webContents.close();
  views.delete(id);
  if (activeAppId === id) activeAppId = null;
}
function closeAll() {
  for (const id of [...views.keys()]) closeView(id);
  activeAppId = null;
}

function openApp(id) {
  const u = currentUser();
  const a = store.getApp(id);
  if (!u || !a || !u.apps.includes(id)) throw new Error('Not allowed');
  let v = views.get(id);
  if (!v) {
    v = new WebContentsView({
      webPreferences: {
        session: userSession(u),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        devTools: false,
        spellcheck: false,
      },
    });
    if (typeof v.setBorderRadius === 'function') v.setBorderRadius(18);
    v.setBackgroundColor('#ffffff');
    const wc = v.webContents;
    const url = a.url;
    lockContents(wc, hostOf(url));
    wc.on('console-message', (_e, level, message, line, sourceId) => {
      if (level >= 2) console.error(`[app ${a.name}] ${message} (${sourceId}:${line})`);
    });
    wc.on('did-fail-load', (_e, code, desc, failedUrl, isMain) => { if (isMain) console.error(`[app ${a.name}] load failed ${code} ${desc} ${failedUrl}`); });
    wc.on('did-navigate', (_e, navUrl, status) => console.error(`[app ${a.name}] ${status} ${navUrl}`));
    wc.on('did-fail-load', (_e, code, _desc, _u, isMain) => {
      if (!isMain || code === -3) return;
      wc.loadFile(OFFLINE).catch(() => {});
      clearTimeout(wc.kioskRetry);
      wc.kioskRetry = setTimeout(() => { if (!wc.isDestroyed()) wc.loadURL(url).catch(() => {}); }, 8000);
    });
    wc.on('render-process-gone', () => { if (!wc.isDestroyed()) wc.loadURL(url).catch(() => {}); });
    wc.loadURL(url).catch(() => {});
    views.set(id, v);
  }
  for (const [otherId, other] of views) if (otherId !== id) detach(other);
  win.contentView.addChildView(v);
  activeAppId = id;
  layout();
  v.webContents.focus();
  push();
}

function goHome() {
  const v = views.get(activeAppId);
  if (v) detach(v);
  activeAppId = null;
  if (win) win.webContents.focus();
  push();
}

// ---------- IPC (only the shell window may call) ----------
function handle(channel, fn, adminOnly = false) {
  ipcMain.handle(channel, async (e, ...args) => {
    if (!win || e.sender !== win.webContents) throw new Error('Denied');
    if (adminOnly && !adminMode) throw new Error('Admin only');
    return fn(...args);
  });
}

function adminData() {
  const d = store.get();
  return {
    deviceName: d.deviceName,
    adminUser: d.admin.user,
    quranAudio: quranAudio.status(),
    apps: d.apps.map((a) => ({ ...a })),
    users: d.users.map((u) => ({
      id: u.id,
      name: u.name,
      color: u.color,
      apps: [...u.apps],
      hasPassword: !!u.passwordHash,
      tokenId: (u.token && u.token.id) || '',
      hasSecret: !!(u.token && u.token.secret),
    })),
  };
}

handle('ui:init', () => state());

handle('auth:login', (id, pw) => {
  checkLock();
  const u = store.getUser(String(id));
  if (!u) throw new Error('Unknown user');
  if (!store.verify(String(pw ?? ''), u.passwordHash)) failed('Wrong password');
  guard.fails = 0;
  closeAll();
  userId = u.id;
  push();
  return true;
});

handle('auth:logout', () => { closeAll(); userId = null; push(); });
handle('app:open', (id) => openApp(String(id)));
handle('app:home', () => goHome());
handle('sys:status', async () => ({ battery: sys.battery(), wifi: await sys.wifiCurrent() }));
handle('wifi:list', () => sys.wifiList());
handle('wifi:connect', (ssid, pw) => sys.wifiConnect(clean(ssid, 64), String(pw ?? '').slice(0, 128)));
handle('power:off', () => { closeAll(); return sys.poweroff(); });

handle('admin:login', (user, pw) => {
  checkLock();
  const ad = store.get().admin;
  if (String(user ?? '') !== ad.user || !store.verify(String(pw ?? ''), ad.passwordHash)) failed('Wrong username or password');
  guard.fails = 0;
  adminMode = true;
  goHome();
  return true;
});
handle('admin:logout', () => { adminMode = false; });
handle('admin:data', () => adminData(), true);

handle('admin:saveApp', (inp) => {
  const d = store.get();
  const name = clean(inp && inp.name, 40);
  if (!name) throw new Error('Name is required');
  let url;
  try { url = new URL(String((inp && inp.url) || '').trim()); } catch { throw new Error('Enter the full link, starting with https://'); }
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('The link must start with https://');
  const icon = store.ICONS.includes(inp.icon) ? inp.icon : 'book';
  const color = store.COLORS.includes(inp.color) ? inp.color : 'blue';
  let a = inp.id ? d.apps.find((x) => x.id === inp.id) : null;
  if (a) {
    if (a.url !== url.href) closeView(a.id);
    Object.assign(a, { name, url: url.href, icon, color });
  } else {
    a = { id: store.newId(), name, url: url.href, icon, color };
    d.apps.push(a);
  }
  store.save();
  push();
  return adminData();
}, true);

handle('admin:deleteApp', (id) => {
  const d = store.get();
  closeView(id);
  d.apps = d.apps.filter((a) => a.id !== id);
  for (const u of d.users) u.apps = u.apps.filter((x) => x !== id);
  store.save();
  push();
  return adminData();
}, true);

handle('admin:saveUser', (inp) => {
  const d = store.get();
  const name = clean(inp && inp.name, 30);
  if (!name) throw new Error('Name is required');
  const color = store.COLORS.includes(inp.color) ? inp.color : 'blue';
  const apps = Array.isArray(inp.apps) ? inp.apps.filter((id) => d.apps.some((a) => a.id === id)) : [];
  const pw = String(inp.password ?? '');
  if (!inp.noPassword && pw && pw.length < 4) throw new Error('Password must be at least 4 characters');
  const existing = inp.id ? d.users.find((x) => x.id === inp.id) : null;
  const strip = (v) => String(v ?? '').replace(/^\s*cf-access-client-(id|secret)\s*:\s*/i, '').replace(/\s+/g, '');
  const tokenId = strip(inp.tokenId).slice(0, 200);
  const tokenSecret = strip(inp.tokenSecret).slice(0, 300);
  const secret = tokenSecret || (existing && existing.token && existing.token.secret) || '';
  if (tokenId && !secret) throw new Error('Add the Client Secret for this token');

  const u = existing || { id: store.newId(), passwordHash: null, token: null };
  Object.assign(u, { name, color, apps });
  if (inp.noPassword) u.passwordHash = null;
  else if (pw) u.passwordHash = store.hash(pw);
  u.token = tokenId ? { id: tokenId, secret } : null;
  if (!existing) d.users.push(u);
  if (userId === u.id) closeAll();
  store.save();
  push();
  photos.refresh(() => push());
  return adminData();
}, true);

handle('admin:deleteUser', (id) => {
  const d = store.get();
  if (userId === id) { closeAll(); userId = null; }
  d.users = d.users.filter((u) => u.id !== id);
  store.save();
  session.fromPartition('persist:u-' + id).clearStorageData().catch(() => {});
  push();
  return adminData();
}, true);

handle('admin:setPassword', (oldPw, newPw) => {
  const ad = store.get().admin;
  if (!store.verify(String(oldPw ?? ''), ad.passwordHash)) throw new Error('Current password is wrong');
  if (String(newPw ?? '').length < 8) throw new Error('New password must be at least 8 characters');
  ad.passwordHash = store.hash(String(newPw));
  store.save();
  return true;
}, true);

handle('admin:terminal', () => sys.terminal(), true);
handle('admin:update', () => sys.update(), true);
handle('admin:reboot', () => { closeAll(); return sys.reboot(); }, true);
