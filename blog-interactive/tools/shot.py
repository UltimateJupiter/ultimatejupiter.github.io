#!/usr/bin/env python3
"""Headless Chrome screenshot + console capture for figure development.

usage: python3 shot.py URL OUT.png [--w 1280] [--h 1800] [--wait 4] [--dark]
Prints console messages (CONSOLE lines) and JS errors found in Chrome's log, then kills Chrome.
Each call uses its own temporary profile, so several agents can run it in parallel.
"""
import subprocess, sys, time, os, tempfile, shutil, re, argparse
ap = argparse.ArgumentParser()
ap.add_argument('url'); ap.add_argument('out')
ap.add_argument('--w', type=int, default=1280); ap.add_argument('--h', type=int, default=1800)
ap.add_argument('--wait', type=float, default=4.0)
ap.add_argument('--dark', action='store_true', help='emulate prefers-color-scheme: dark')
a = ap.parse_args()
chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
prof = tempfile.mkdtemp(prefix='shotprof-')
out = os.path.abspath(a.out)
if os.path.exists(out): os.remove(out)
args = [chrome, '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        f'--user-data-dir={prof}', '--enable-logging=stderr', '--v=0', '--hide-scrollbars',
        f'--virtual-time-budget={int(a.wait*1000)}', f'--window-size={a.w},{a.h}', f'--screenshot={out}']
if a.dark: args.append('--force-dark-mode'); args.append('--blink-settings=preferredColorScheme=0')
args += [x for x in os.environ.get('SHOT_EXTRA','').split('|') if x]
args.append(a.url)
logf = tempfile.NamedTemporaryFile(delete=False, suffix='.log')
p = subprocess.Popen(args, stdout=logf, stderr=subprocess.STDOUT)
t0 = time.time()
while time.time() - t0 < a.wait + 25:
    if os.path.exists(out) and os.path.getsize(out) > 0:
        time.sleep(0.5); break
    if p.poll() is not None: break
    time.sleep(0.25)
try:
    p.kill()
except Exception: pass
time.sleep(0.3)
subprocess.run(['pkill', '-f', prof])
logf.close()
log = open(logf.name, errors='replace').read()
os.remove(logf.name); shutil.rmtree(prof, ignore_errors=True)
msgs = [l for l in log.splitlines() if 'CONSOLE' in l or 'Uncaught' in l]
print('screenshot:', out if os.path.exists(out) else 'NOT CREATED')
print(f'console lines: {len(msgs)}')
for l in msgs[:60]:
    print('  ', re.sub(r'^\[[^\]]*\]\s*', '', l)[:400])
