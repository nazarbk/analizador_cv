#!/usr/bin/env python3
"""Ejecuta toda la batería de pruebas y falla si alguna falla (para CI y en local).
   python3 scripts/test_all.py            → todo
   python3 scripts/test_all.py e2e_pro    → solo las que contienen ese nombre
Requisitos: Node 18+, Python 3 con playwright, pypdf, python-docx y reportlab; `npm ci` y `python3 build.py` antes."""
import os, re, subprocess, sys, time
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TESTS = [
    ['node', 'test/fuzz.js'], ['node', 'test/doccheck.js'], ['node', 'test/counter_test.mjs'],
    ['python3', 'test/e2e.py'], ['python3', 'test/e2e_v2.py'], ['python3', 'test/e2e_lists.py'], ['python3', 'test/e2e_proj.py'],
    ['python3', 'test/e2e_links.py'], ['python3', 'test/e2e_trans.py'], ['python3', 'test/e2e_landing.py'], ['python3', 'test/e2e_notcv.py'],
    ['python3', 'test/e2e_pro.py'], ['python3', 'test/e2e_storage.py'],
]
BAD = re.compile(r'^(FALLO|Traceback)|^(errors|ERRORS) \[(?!\])', re.M)
only = sys.argv[1:]; failed = []
for cmd in TESTS:
    if only and not any(o in cmd[1] for o in only): continue
    t0 = time.time(); r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=900)
    out = r.stdout + r.stderr; bad = r.returncode != 0 or BAD.search(out)
    print(('FALLO ' if bad else 'OK    ') + cmd[1] + ' (%.0f s)' % (time.time() - t0), flush=True)
    if bad: failed.append(cmd[1]); print('\n'.join('    ' + l for l in out.strip().splitlines()[-25:]), flush=True)
print('\n%d pruebas con fallos: %s' % (len(failed), ', '.join(failed)) if failed else '\nTodo correcto')
sys.exit(1 if failed else 0)
