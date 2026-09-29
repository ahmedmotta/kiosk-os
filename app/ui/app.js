'use strict';
(() => {
  const K = window.kiosk;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  // ---------- look ----------
  const COLORS = {
    blue: ['#5b8cff', '#3656d4'], teal: ['#2fc6a7', '#13897a'], orange: ['#ffad4d', '#e0721f'],
    purple: ['#c06bff', '#7b3fd1'], pink: ['#ff7eb3', '#d9467f'], green: ['#7ed957', '#3f9e2c'],
  };
  const grad = (c) => { const [a, b] = COLORS[c] || COLORS.blue; return `linear-gradient(160deg, ${a} 0%, ${b} 100%)`; };

  const ICONS = {
    book: '<path d="M2 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2z"/><path d="M22 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8z"/>',
    code: '<path d="M8 7l-5 5 5 5"/><path d="M16 7l5 5-5 5"/><path d="M14 4l-4 16"/>',
    quran: '<path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.5 6.5 0 0 0 10 10z"/><path d="M17 3.5l.8 1.7 1.8.3-1.3 1.3.3 1.8-1.6-.9-1.6.9.3-1.8-1.3-1.3 1.8-.3z"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/>',
    star: '<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 3 1-6.2L3 9.7l6.2-.9z"/>',
    puzzle: '<path d="M4 7h4a2 2 0 1 1 4 0h4v4a2 2 0 1 1 0 4v4h-4a2 2 0 1 0-4 0H4v-4a2 2 0 1 0 0-4z"/>',
    pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    game: '<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 10.5v4M5 12.5h4"/><circle cx="15.5" cy="11.5" r="1"/><circle cx="18" cy="14" r="1"/>',
  };
  const UI = {
    wifi: '<path d="M2 9a15 15 0 0 1 20 0"/><path d="M5 12.5a10 10 0 0 1 14 0"/><path d="M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="0.8" fill="currentColor"/>',
    wifi2: '<path d="M5 12.5a10 10 0 0 1 14 0"/><path d="M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="0.8" fill="currentColor"/>',
    wifi1: '<path d="M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="0.8" fill="currentColor"/>',
    wifiOff: '<path d="M3 3l18 18"/><path d="M8.5 16a5 5 0 0 1 7 0"/><path d="M5 12.5a10 10 0 0 1 4.5-2.7"/><path d="M2 9a15 15 0 0 1 5-3"/><circle cx="12" cy="19.5" r="0.8" fill="currentColor"/>',
    power: '<path d="M12 3v9"/><path d="M6.3 7a8 8 0 1 0 11.4 0"/>',
    home: '<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    arrow: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    terminal: '<path d="M5 7l5 5-5 5"/><path d="M12 18h7"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/>',
    logout: '<path d="M9 4H5v16h4"/><path d="M14 8l4 4-4 4"/><path d="M18 12H8"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="currentColor" stroke="none"/>',
  };
  const svg = (inner, size = 24, sw = 1.8) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

  // Small DOM helper. Text always goes in as text (never HTML), except trusted icon SVG via `html`.
  function h(tag, props = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    return el;
  }
  const clear = (el) => { el.replaceChildren(); return el; };
  // A photo (data: URL from the kiosk) or the gradient + initials.
  function paintAvatar(el, u) {
    if (u.photo && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(u.photo)) {
      el.textContent = '';
      el.style.background = `center / cover no-repeat url("${u.photo}")`;
    } else {
      el.textContent = initials(u.name);
      el.style.background = grad(u.color);
    }
  }
  const initials = (n) => String(n || '?').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const cleanErr = (e) => String((e && e.message) || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');

  // static icons in the HTML
  $$('[data-icon]').forEach((el) => { el.innerHTML = svg(UI[el.dataset.icon], 18, 2.2); });

  // ---------- state ----------
  let S = { users: [], user: null, apps: [], activeAppId: null, activeApp: null, deviceName: '' };
  let selectedUser = null;

  K.onState((s) => { S = s; render(); });
  K.init().then((s) => { S = s; render(); refreshStatus(); });

  function render() {
    $('#deviceName').textContent = S.deviceName || '';
    const loggedIn = !!S.user;
    const inApp = loggedIn && !!S.activeAppId && !!S.activeApp;
    $('#login').hidden = loggedIn;
    $('#home').hidden = !loggedIn || inApp;
    $('#notch').hidden = !inApp;
    $('#brand').hidden = inApp;
    if (inApp) closeWifi();
    if (!loggedIn) renderLogin();
    else if (inApp) renderNotch();
    else renderDock();
  }

  // ---------- clock + status ----------
  function tick() {
    const d = new Date();
    const big = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    const short = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const date = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    $$('[data-time]').forEach((e) => { if (e.textContent !== big) e.textContent = big; });
    $$('[data-time-short]').forEach((e) => { if (e.textContent !== short) e.textContent = short; });
    $$('[data-date]').forEach((e) => { if (e.textContent !== date) e.textContent = date; });
  }
  tick();
  setInterval(tick, 1000);

  const signalIcon = (s) => (s >= 67 ? UI.wifi : s >= 34 ? UI.wifi2 : UI.wifi1);

  function batterySvg(b) {
    const w = Math.max(1, Math.round((15 * b.level) / 100));
    const low = b.level <= 15 && !b.charging;
    return `<svg width="26" height="14" viewBox="0 0 26 14" fill="none" aria-hidden="true">
      <rect x="0.75" y="0.75" width="21.5" height="12.5" rx="3.5" stroke="currentColor" stroke-opacity=".8" stroke-width="1.5"/>
      <rect x="3" y="3" width="${w}" height="8" rx="1.8" fill="${low ? '#ff6b6b' : 'currentColor'}"/>
      <rect x="23.5" y="4.5" width="2" height="5" rx="1" fill="currentColor" fill-opacity=".8"/></svg>`;
  }

  async function refreshStatus() {
    let s;
    try { s = await K.status(); } catch { return; }
    $$('[data-battery]').forEach((el) => {
      if (!s.battery) { el.hidden = true; return; }
      el.hidden = false;
      el.innerHTML = batterySvg(s.battery) + (s.battery.charging ? svg(UI.bolt, 12) : '');
      el.append(h('span', {}, `${s.battery.level}%`));
      el.setAttribute('aria-label', `Battery ${s.battery.level}%`);
    });
    $$('[data-wifi-icon]').forEach((el) => {
      el.innerHTML = svg(s.wifi ? signalIcon(s.wifi.signal) : UI.wifiOff, Number(el.dataset.size) || 20, 2);
    });
  }
  setInterval(refreshStatus, 15000);

  // ---------- login ----------
  function renderLogin() {
    const list = clear($('#userList'));
    if (selectedUser && !S.users.some((u) => u.id === selectedUser)) selectedUser = null;
    list.classList.toggle('has-sel', !!selectedUser);
    if (!S.users.length) {
      list.append(h('p', { class: 'hint' }, 'No users yet. Press Ctrl + Alt + A to open the admin panel.'));
      return;
    }
    for (const u of S.users) {
      const sel = u.id === selectedUser;
      const col = h('div', { class: 'user' + (sel ? ' selected' : '') },
        (() => { const b = h('button', { class: 'avatar', 'aria-label': `Sign in as ${u.name}`, onclick: () => pickUser(u) }); paintAvatar(b, u); return b; })(),
        h('span', { class: 'user-name' }, u.name));
      if (sel && u.hasPassword) {
        const input = h('input', { type: 'password', placeholder: 'Password', autocomplete: 'off', 'aria-label': `Password for ${u.name}` });
        const form = h('form', { class: 'pw-pill', onsubmit: (e) => { e.preventDefault(); doLogin(u.id, input.value, form, input); } },
          input,
          h('button', { class: 'pw-go', type: 'submit', 'aria-label': 'Sign in', html: svg(UI.arrow, 16, 2.4) }));
        col.append(form);
        setTimeout(() => input.focus(), 30);
      }
      list.append(col);
    }
  }

  function pickUser(u) {
    $('#loginErr').textContent = '';
    if (!u.hasPassword) { doLogin(u.id, ''); return; }
    selectedUser = selectedUser === u.id ? null : u.id;
    renderLogin();
  }

  async function doLogin(id, pw, form, input) {
    try {
      await K.login(id, pw);
      selectedUser = null;
      $('#loginErr').textContent = '';
    } catch (e) {
      $('#loginErr').textContent = cleanErr(e);
      if (form) {
        input.value = '';
        form.classList.remove('shake');
        void form.offsetWidth;
        form.classList.add('shake');
      }
    }
  }

  // ---------- home + dock ----------
  function renderDock() {
    const box = clear($('#dockApps'));
    if (!S.apps.length) box.append(h('span', { class: 'dock-empty' }, 'No apps yet'));
    for (const a of S.apps) {
      box.append(h('button', {
        class: 'app-icon', style: `background:${grad(a.color)}`, title: a.name, 'aria-label': a.name,
        html: svg(ICONS[a.icon] || ICONS.book, 28), onclick: () => K.openApp(a.id),
      }));
    }
    const ub = $('#userBtn');
    paintAvatar(ub, S.user);
    ub.title = `${S.user.name} — sign out`;
    ub.setAttribute('aria-label', `Sign out ${S.user.name}`);
  }

  $('#userBtn').addEventListener('click', async () => {
    if (await confirmBox('Sign out?', `${S.user ? S.user.name : ''} will go back to the sign-in screen.`, 'Sign out')) K.logout();
  });

  function renderNotch() {
    $('#notchAppIcon').style.background = grad(S.activeApp.color);
    $('#notchAppName').textContent = S.activeApp.name;
    paintAvatar($('#notchUser'), S.user);
  }
  $('#notchHome').addEventListener('click', () => K.home());

  $$('[data-power]').forEach((b) => b.addEventListener('click', async () => {
    closeWifi();
    if (await confirmBox('Shut down?', 'The computer will turn off.', 'Shut down', true)) K.powerOff();
  }));

  // ---------- Wi-Fi ----------
  let nets = [];
  let expanded = null;

  $$('[data-wifi-toggle]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); toggleWifi(); }));
  $('#wifiRescan').addEventListener('click', () => loadWifi());
  document.addEventListener('click', (e) => {
    const p = $('#wifiPanel');
    // composedPath() is captured at click time, so it still works when the click
    // re-rendered the list and removed the clicked element from the page.
    if (!p.hidden && !e.composedPath().includes(p)) closeWifi();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeWifi(); });

  function toggleWifi() {
    if (!$('#wifiPanel').hidden) { closeWifi(); return; }
    $('#wifiPanel').hidden = false;
    expanded = null;
    loadWifi();
  }
  function closeWifi() { $('#wifiPanel').hidden = true; expanded = null; }

  async function loadWifi() {
    const list = clear($('#wifiList'));
    list.append(h('div', { class: 'muted pad' }, 'Searching…'));
    try { nets = await K.wifiList(); } catch (e) {
      clear(list).append(h('div', { class: 'err pad' }, 'Wi‑Fi is not available: ' + cleanErr(e)));
      return;
    }
    drawWifi();
  }

  function drawWifi() {
    const list = clear($('#wifiList'));
    if (!nets.length) list.append(h('div', { class: 'muted pad' }, 'No networks found'));
    for (const n of nets) list.append(wifiRow(n));
  }

  function wifiRow(n) {
    const open = expanded === n.ssid;
    const row = h('div', { class: 'net' + (n.active ? ' active' : '') + (open ? ' open' : '') });
    row.append(h('button', {
      class: 'net-head', 'aria-expanded': String(open),
      onclick: () => {
        if (n.active) return;
        if (!n.secure) { join(n, '', null); return; }
        expanded = open ? null : n.ssid;
        drawWifi();
      },
    },
    h('span', { html: svg(signalIcon(n.signal), 18, 2) }),
    h('span', { class: 'net-name' }, n.ssid),
    n.active ? h('span', { class: 'net-state' }, 'Connected') : null,
    n.active ? h('span', { html: svg(UI.check, 18, 2.4) }) : null,
    !n.active && n.secure ? h('span', { html: svg(UI.lock, 15, 2) }) : null));

    if (open) {
      const input = h('input', { type: 'password', placeholder: 'Password', 'aria-label': `Password for ${n.ssid}` });
      const msg = h('div', { class: 'err small', role: 'alert' });
      const joinBtn = h('button', { type: 'submit', class: 'btn primary sm' }, 'Join');
      row.append(h('form', { class: 'net-form', onsubmit: (e) => { e.preventDefault(); join(n, input.value, msg, joinBtn); } },
        input,
        h('div', { class: 'row-end' },
          h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { expanded = null; drawWifi(); } }, 'Cancel'),
          joinBtn),
        msg));
      setTimeout(() => input.focus(), 30);
    }
    return row;
  }

  async function join(n, pw, msg, btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Joining…'; }
    try {
      await K.wifiConnect(n.ssid, pw);
      expanded = null;
      await loadWifi();
      refreshStatus();
    } catch (e) {
      if (msg) msg.textContent = cleanErr(e);
      if (btn) { btn.disabled = false; btn.textContent = 'Join'; }
    }
  }

  // ---------- dialogs ----------
  function syncScrim() {
    $('#scrim').hidden = $('#dialog').hidden && $('#adminLogin').hidden && $('#admin').hidden;
  }

  function confirmBox(title, text, okLabel, danger = false) {
    return new Promise((resolve) => {
      const d = clear($('#dialog'));
      const done = (v) => { d.hidden = true; syncScrim(); resolve(v); };
      const ok = h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => done(true) }, okLabel);
      d.append(
        h('h2', {}, title),
        h('p', { class: 'muted' }, text),
        h('div', { class: 'row-end' }, h('button', { class: 'btn ghost', onclick: () => done(false) }, 'Cancel'), ok));
      d.hidden = false;
      syncScrim();
      setTimeout(() => ok.focus(), 30);
    });
  }

  // ---------- admin sign-in ----------
  K.onAdminPrompt(() => {
    if (!$('#admin').hidden) return;
    closeWifi();
    const f = $('#adminLogin');
    f.reset();
    $('#adminErr').textContent = '';
    f.hidden = false;
    syncScrim();
    setTimeout(() => $('#adminUser').focus(), 30);
  });

  $('#adminLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await K.adminLogin($('#adminUser').value, $('#adminPass').value);
      $('#adminLogin').hidden = true;
      await openAdmin();
    } catch (err) {
      $('#adminErr').textContent = cleanErr(err);
      $('#adminPass').value = '';
      $('#adminPass').focus();
    }
  });
  $('#adminLoginCancel').addEventListener('click', () => { $('#adminLogin').hidden = true; syncScrim(); });

  // ---------- admin panel ----------
  let A = null;
  let tab = 'users';
  let editing = null; // { kind: 'user' | 'app', id: string | null }

  async function openAdmin() {
    A = await K.adminData();
    tab = 'users';
    editing = null;
    $('#admin').hidden = false;
    syncScrim();
    renderAdmin();
  }
  async function closeAdmin() {
    try { await K.adminLogout(); } catch { /* ignore */ }
    $('#admin').hidden = true;
    editing = null;
    A = null;
    syncScrim();
  }
  $('#adminClose').addEventListener('click', closeAdmin);
  $$('#adminTabs [role=tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; editing = null; renderAdmin(); }));

  async function reloadAdmin() { A = await K.adminData(); renderAdmin(); }

  function renderAdmin() {
    $$('#adminTabs [role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    const body = clear($('#adminBody'));
    if (tab === 'users') usersTab(body);
    else if (tab === 'apps') appsTab(body);
    else systemTab(body);
  }

  const field = (label, control) => h('label', { class: 'field' }, h('span', {}, label), control);
  const group = (label, control) => h('div', { class: 'field' }, h('span', {}, label), control);

  function colorPicker(current, onPick) {
    const wrap = h('div', { class: 'picker', role: 'group', 'aria-label': 'Color' });
    for (const c of Object.keys(COLORS)) {
      const b = h('button', { type: 'button', class: 'swatch', style: `background:${grad(c)}`, 'aria-label': c, 'aria-pressed': String(c === current) });
      b.addEventListener('click', () => { wrap.querySelectorAll('.swatch').forEach((x) => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); onPick(c); });
      wrap.append(b);
    }
    return wrap;
  }

  function iconPicker(current, onPick) {
    const wrap = h('div', { class: 'picker', role: 'group', 'aria-label': 'Icon' });
    for (const name of Object.keys(ICONS)) {
      const b = h('button', { type: 'button', class: 'icon-pick', 'aria-label': name, 'aria-pressed': String(name === current), html: svg(ICONS[name], 20) });
      b.addEventListener('click', () => { wrap.querySelectorAll('.icon-pick').forEach((x) => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); onPick(name); });
      wrap.append(b);
    }
    return wrap;
  }

  function addButton(label, onclick) {
    return h('button', { class: 'btn primary', onclick, html: svg(UI.plus, 16, 2.4) + `<span>${label}</span>` });
  }

  // Users tab
  function usersTab(body) {
    body.append(h('div', { class: 'section-head' },
      h('h3', {}, 'Users'),
      addButton('Add user', () => { editing = { kind: 'user', id: null }; renderAdmin(); })));

    if (editing && editing.kind === 'user' && editing.id === null) body.append(userEditor(null));
    if (!A.users.length && !editing) body.append(h('p', { class: 'muted' }, 'No users yet.'));

    for (const u of A.users) {
      if (editing && editing.kind === 'user' && editing.id === u.id) { body.append(userEditor(u)); continue; }
      const apps = u.apps.map((id) => A.apps.find((a) => a.id === id)).filter(Boolean);
      const tokenOk = !!(u.tokenId && u.hasSecret);
      body.append(h('div', { class: 'item' },
        h('div', { class: 'avatar sm', style: `background:${grad(u.color)}` }, initials(u.name)),
        h('div', { class: 'item-main' },
          h('div', { class: 'item-title' }, u.name + (u.hasPassword ? '' : ' · no password')),
          h('div', { class: 'chips' }, apps.length
            ? apps.map((a) => h('span', { class: 'chip' }, h('span', { class: 'dot', style: `background:${grad(a.color)}` }), a.name))
            : h('span', { class: 'muted small' }, 'No apps'))),
        h('span', { class: 'badge ' + (tokenOk ? 'ok' : 'warn') }, tokenOk ? 'Token set' : 'No token'),
        h('button', { class: 'btn ghost sm', onclick: () => { editing = { kind: 'user', id: u.id }; renderAdmin(); } }, 'Edit'),
        h('button', {
          class: 'btn danger-ghost sm',
          onclick: async () => {
            if (await confirmBox('Delete user?', `${u.name} and their saved data will be removed.`, 'Delete', true)) {
              A = await K.deleteUser(u.id); renderAdmin();
            }
          },
        }, 'Delete')));
    }
  }

  function userEditor(u) {
    let color = (u && u.color) || 'blue';
    const chosen = new Set((u && u.apps) || []);
    const name = h('input', { type: 'text', value: (u && u.name) || '', maxlength: '30', required: true, spellcheck: 'false' });
    const pw = h('input', { type: 'password', autocomplete: 'new-password', placeholder: u ? 'Leave empty to keep' : 'Leave empty for none' });
    const noPw = h('input', { type: 'checkbox', checked: !!(u && !u.hasPassword) });
    const tokId = h('input', { type: 'text', value: (u && u.tokenId) || '', placeholder: 'xxxxxxxx.access', spellcheck: 'false', autocomplete: 'off' });
    const tokSecret = h('input', { type: 'password', autocomplete: 'off', placeholder: u && u.hasSecret ? 'Saved — leave empty to keep' : 'Client Secret' });
    const err = h('div', { class: 'err', role: 'alert' });

    const appsBox = h('div', { class: 'chips' });
    if (!A.apps.length) appsBox.append(h('span', { class: 'muted small' }, 'Add apps in the Apps tab first.'));
    for (const a of A.apps) {
      const cb = h('input', { type: 'checkbox', checked: chosen.has(a.id) });
      cb.addEventListener('change', () => { if (cb.checked) chosen.add(a.id); else chosen.delete(a.id); });
      appsBox.append(h('label', { class: 'check-chip' }, cb, h('span', { class: 'dot', style: `background:${grad(a.color)}` }), a.name));
    }

    return h('form', {
      class: 'editor',
      onsubmit: async (e) => {
        e.preventDefault();
        err.textContent = '';
        try {
          A = await K.saveUser({
            id: u ? u.id : null, name: name.value, color, apps: [...chosen],
            password: pw.value, noPassword: noPw.checked, tokenId: tokId.value, tokenSecret: tokSecret.value,
          });
          editing = null;
          renderAdmin();
        } catch (x) { err.textContent = cleanErr(x); }
      },
    },
    h('div', { class: 'editor-title' }, u ? `Editing ${u.name}` : 'New user'),
    h('div', { class: 'grid2' }, field('Name', name), field('Password', pw)),
    h('label', { class: 'inline' }, noPw, 'No password — tap the picture to sign in'),
    group('Color', colorPicker(color, (c) => { color = c; })),
    group('Apps this user can see', appsBox),
    h('div', { class: 'grid2' }, field('Cloudflare Access · Client ID', tokId), field('Cloudflare Access · Client Secret', tokSecret)),
    h('p', { class: 'help' }, 'The token is only sent to this user’s own apps. Leave Client ID empty to remove the token.'),
    err,
    h('div', { class: 'row-end' },
      h('button', { type: 'button', class: 'btn ghost', onclick: () => { editing = null; renderAdmin(); } }, 'Cancel'),
      h('button', { type: 'submit', class: 'btn primary' }, 'Save')));
  }

  // Apps tab
  function appsTab(body) {
    body.append(h('div', { class: 'section-head' },
      h('h3', {}, 'Apps'),
      addButton('Add app', () => { editing = { kind: 'app', id: null }; renderAdmin(); })));

    if (editing && editing.kind === 'app' && editing.id === null) body.append(appEditor(null));
    if (!A.apps.length && !editing) body.append(h('p', { class: 'muted' }, 'No apps yet. Each app is a link that opens full screen, with the address hidden.'));

    for (const a of A.apps) {
      if (editing && editing.kind === 'app' && editing.id === a.id) { body.append(appEditor(a)); continue; }
      const owners = A.users.filter((u) => u.apps.includes(a.id)).map((u) => u.name);
      body.append(h('div', { class: 'item' },
        h('div', { class: 'app-sq', style: `background:${grad(a.color)}`, html: svg(ICONS[a.icon] || ICONS.book, 20) }),
        h('div', { class: 'item-main' },
          h('div', { class: 'item-title' }, a.name),
          h('div', { class: 'item-sub' }, a.url),
          h('div', { class: 'muted small' }, owners.length ? 'Used by ' + owners.join(', ') : 'Not given to anyone yet')),
        h('button', { class: 'btn ghost sm', onclick: () => { editing = { kind: 'app', id: a.id }; renderAdmin(); } }, 'Edit'),
        h('button', {
          class: 'btn danger-ghost sm',
          onclick: async () => {
            if (await confirmBox('Delete app?', `${a.name} will be removed from every user.`, 'Delete', true)) {
              A = await K.deleteApp(a.id); renderAdmin();
            }
          },
        }, 'Delete')));
    }
  }

  function appEditor(a) {
    let color = (a && a.color) || 'blue';
    let icon = (a && a.icon) || 'book';
    const name = h('input', { type: 'text', value: (a && a.name) || '', maxlength: '40', required: true, spellcheck: 'false' });
    const url = h('input', { type: 'url', value: (a && a.url) || 'https://', required: true, spellcheck: 'false' });
    const err = h('div', { class: 'err', role: 'alert' });
    return h('form', {
      class: 'editor',
      onsubmit: async (e) => {
        e.preventDefault();
        err.textContent = '';
        try {
          A = await K.saveApp({ id: a ? a.id : null, name: name.value, url: url.value, icon, color });
          editing = null;
          renderAdmin();
        } catch (x) { err.textContent = cleanErr(x); }
      },
    },
    h('div', { class: 'editor-title' }, a ? `Editing ${a.name}` : 'New app'),
    h('div', { class: 'grid2' }, field('Name', name), field('Link', url)),
    group('Icon', iconPicker(icon, (i) => { icon = i; })),
    group('Color', colorPicker(color, (c) => { color = c; })),
    err,
    h('div', { class: 'row-end' },
      h('button', { type: 'button', class: 'btn ghost', onclick: () => { editing = null; renderAdmin(); } }, 'Cancel'),
      h('button', { type: 'submit', class: 'btn primary' }, 'Save')));
  }

  // System tab
  function systemTab(body) {
    const sysBtn = (label, icon, onclick, extra = '') =>
      h('button', { class: 'sys-btn ' + extra, onclick, html: svg(UI[icon], 20, 2) + `<span>${label}</span>` });

    body.append(
      h('div', { class: 'section-head' }, h('h3', {}, 'System')),
      h('div', { class: 'sys-grid' },
        sysBtn('Terminal', 'terminal', async () => { await K.terminal(); }, 'term'),
        sysBtn('System update', 'refresh', async () => { await K.update(); }),
        sysBtn('Restart', 'power', async () => {
          if (await confirmBox('Restart?', 'The computer will restart now.', 'Restart', true)) K.reboot();
        }),
        sysBtn('Sign out of admin', 'logout', closeAdmin)),
      h('p', { class: 'help' }, 'Terminal and System update ask for the Linux admin password (user “kioskadmin”, set during install). Close the terminal window to come back here.'));

    const oldPw = h('input', { type: 'password', autocomplete: 'off', required: true });
    const newPw = h('input', { type: 'password', autocomplete: 'new-password', required: true, minlength: '8' });
    const again = h('input', { type: 'password', autocomplete: 'new-password', required: true, minlength: '8' });
    const msg = h('div', { class: 'err', role: 'alert' });
    const okMsg = h('div', { class: 'small', style: 'color:#b8f5d2', role: 'status' });
    body.append(h('form', {
      class: 'editor',
      style: 'margin-top:10px',
      onsubmit: async (e) => {
        e.preventDefault();
        msg.textContent = ''; okMsg.textContent = '';
        if (newPw.value !== again.value) { msg.textContent = 'The new passwords don’t match'; return; }
        try {
          await K.setAdminPassword(oldPw.value, newPw.value);
          oldPw.value = newPw.value = again.value = '';
          okMsg.textContent = 'Admin password changed.';
        } catch (x) { msg.textContent = cleanErr(x); }
      },
    },
    h('div', { class: 'editor-title' }, `Change admin panel password (${A.adminUser})`),
    h('div', { class: 'grid2' }, field('Current password', oldPw), h('div')),
    h('div', { class: 'grid2' }, field('New password', newPw), field('Repeat new password', again)),
    msg, okMsg,
    h('div', { class: 'row-end' }, h('button', { type: 'submit', class: 'btn primary' }, 'Change password'))));
  }
})();
