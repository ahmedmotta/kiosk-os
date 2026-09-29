#!/usr/bin/env bash
# Checks each child's token against their site, the same way the kiosk does.
#   sudo bash check-kids.sh
set -uo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Run with sudo"; exit 1; }
python3 - <<'PY'
import json, subprocess
d = json.load(open('/var/lib/kioskos/config.json'))
apps = {a['id']: a for a in d['apps']}
if not d['users']:
    print('No users yet.')
for u in d['users']:
    t = u.get('token') or {}
    cid, sec = t.get('id', ''), t.get('secret', '')
    print(f"\n{u['name']}")
    if not cid or not sec:
        print('  NO TOKEN saved for this user'); continue
    bad = [k for k, v in (('Client ID', cid), ('Secret', sec)) if ':' in v or ' ' in v]
    print(f"  Client ID: {cid[:6]}…{cid[-7:]}  ({'looks OK' if cid.endswith('.access') else 'should end with .access'})")
    if bad: print('  WARNING: extra text pasted in', ', '.join(bad))
    if not u['apps']: print('  NO APP given to this user')
    for aid in u['apps']:
        url = apps[aid]['url'].rstrip('/')
        r = subprocess.run(['curl', '-s', '-o', '/dev/null', '-m', '15', '-w', '%{http_code} %{redirect_url}',
                            '-H', 'CF-Access-Client-Id: ' + cid, '-H', 'CF-Access-Client-Secret: ' + sec,
                            url + '/api/today'], capture_output=True, text=True)
        code, _, redirect = r.stdout.partition(' ')
        if code == '200': verdict = 'OK — token accepted'
        elif 'cloudflareaccess.com' in redirect or code in ('302', '401', '403') and 'login' in redirect:
            verdict = 'Cloudflare asked for login → token NOT accepted by the Access policy'
        elif code == '403': verdict = 'Blocked (403) — token rejected or wrong site'
        elif code == '000': verdict = 'No connection (internet/DNS)'
        else: verdict = f'Unexpected answer'
        print(f"  {url} → {code} {redirect[:60]}\n  {verdict}")
PY
