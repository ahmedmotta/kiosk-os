'use strict';
// Add or update a child from the command line (used by set-kid.sh over SSH).
// Creates/updates an app with the given link and a user with the same name,
// gives the user that app, and stores the Cloudflare Access token.
const store = require('./store');

const name = String(process.env.KID_NAME || '').trim();
const url = String(process.env.KID_URL || '').trim();
const color = store.COLORS.includes(process.env.KID_COLOR) ? process.env.KID_COLOR : 'blue';
const clientId = String(process.env.KID_CID || '').trim();
const secret = String(process.env.KID_SECRET || '').trim();

function fail(msg) { console.error('Error: ' + msg); process.exit(1); }
if (!name) fail('name is missing');
try { const u = new URL(url); if (!['https:', 'http:'].includes(u.protocol)) throw 0; } catch { fail('link must start with https://'); }
if (!clientId || !secret) fail('Client ID and Client Secret are both needed');

const d = store.get();
const same = (a, b) => a.toLowerCase() === b.toLowerCase();

let app = d.apps.find((a) => same(a.name, name));
if (!app) { app = { id: store.newId(), name, url, icon: 'star', color }; d.apps.push(app); }
else Object.assign(app, { url, color });

let user = d.users.find((u) => same(u.name, name));
if (!user) { user = { id: store.newId(), name, color, apps: [], passwordHash: null, token: null }; d.users.push(user); }
if (!user.apps.includes(app.id)) user.apps.push(app.id);
user.color = color;
user.token = { id: clientId, secret };

store.save();
console.log(`Saved: user "${user.name}" → app "${app.name}" (${app.url}), token ${clientId.slice(0, 8)}…`);
