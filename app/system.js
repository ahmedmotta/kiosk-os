'use strict';
// Talks to the OS: battery, Wi-Fi (NetworkManager), volume (PipeWire), power, admin terminal.
const { execFile, spawn } = require('child_process');
const fs = require('fs');

const ADMIN_LINUX = process.env.KIOSK_ADMIN_LINUX || 'kioskadmin';

function run(cmd, args, timeout = 20000) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout }, (err, out, errOut) => {
      if (err) reject(new Error(String(errOut || err.message).trim()));
      else resolve(String(out));
    });
  });
}

// nmcli -t escapes ':' inside values as '\:'
function splitTerse(line) {
  const out = [];
  let cur = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '\\' && i + 1 < line.length) { cur += line[++i]; continue; }
    if (c === ':') { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

function battery() {
  try {
    const dir = '/sys/class/power_supply';
    const bat = fs.readdirSync(dir).find((n) => n.startsWith('BAT'));
    if (!bat) return null;
    const level = parseInt(fs.readFileSync(`${dir}/${bat}/capacity`, 'utf8'), 10);
    const status = fs.readFileSync(`${dir}/${bat}/status`, 'utf8').trim();
    return { level: Math.max(0, Math.min(100, level || 0)), charging: status === 'Charging' || status === 'Full' };
  } catch {
    return null;
  }
}

async function wifiCurrent() {
  try {
    const out = await run('nmcli', ['-t', '-f', 'ACTIVE,SSID,SIGNAL', 'dev', 'wifi', 'list', '--rescan', 'no']);
    for (const line of out.split('\n')) {
      const [active, ssid, signal] = splitTerse(line);
      if (active === 'yes') return { ssid, signal: Number(signal) || 0 };
    }
  } catch { /* no wifi */ }
  return null;
}

async function wifiList() {
  const out = await run('nmcli', ['-t', '-f', 'IN-USE,SSID,SIGNAL,SECURITY', 'dev', 'wifi', 'list', '--rescan', 'yes'], 30000);
  const map = new Map();
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    const [inUse, ssid, signal, security] = splitTerse(line);
    if (!ssid) continue;
    const item = { ssid, signal: Number(signal) || 0, secure: !!security && security !== '--', active: inUse === '*' };
    const prev = map.get(ssid);
    if (!prev || item.signal > prev.signal) map.set(ssid, { ...item, active: item.active || !!(prev && prev.active) });
    else if (item.active) prev.active = true;
  }
  return [...map.values()]
    .sort((a, b) => (b.active - a.active) || (b.signal - a.signal))
    .slice(0, 15);
}

async function wifiConnect(ssid, password) {
  if (!ssid) throw new Error('Choose a network');
  const args = ['dev', 'wifi', 'connect', ssid];
  if (password) args.push('password', password);
  try {
    await run('nmcli', args, 45000);
  } catch (e) {
    if (/secrets were required|psk|802-11-wireless-security/i.test(e.message)) throw new Error('Wrong password');
    if (/no network with ssid/i.test(e.message)) throw new Error('Network not found — try again');
    throw new Error('Could not connect');
  }
}

function volume(dir) {
  const args = dir === 'mute'
    ? ['set-mute', '@DEFAULT_AUDIO_SINK@', 'toggle']
    : ['set-volume', '-l', '1.0', '@DEFAULT_AUDIO_SINK@', dir === 'up' ? '5%+' : '5%-'];
  run('wpctl', args).catch(() => {});
}

const poweroff = () => run('systemctl', ['poweroff']);
const reboot = () => run('systemctl', ['reboot']);

// Opens a terminal window on top of the kiosk. It asks for the Linux admin password (su).
function openTerminal(command) {
  const args = ['--title', 'Admin terminal', '-e', 'su', '-', ADMIN_LINUX];
  if (command) args.push('-c', command);
  const p = spawn('foot', args, { detached: true, stdio: 'ignore' });
  p.on('error', () => {});
  p.unref();
}

const terminal = () => openTerminal();
const update = () => openTerminal('sudo apt update && sudo apt full-upgrade -y; echo; read -r -p "Done — press Enter to close" _');

module.exports = { battery, wifiCurrent, wifiList, wifiConnect, volume, poweroff, reboot, terminal, update };
