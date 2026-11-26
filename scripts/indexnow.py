#!/usr/bin/env python3
"""Avisa a Bing (y al resto de buscadores con IndexNow) de las páginas de site/ que han cambiado.

Lo ejecuta GitHub Actions en cada push a main (.github/workflows/indexnow.yml):
    python3 scripts/indexnow.py <commit_anterior> <commit_nuevo>
También sirve a mano, con URL concretas:
    python3 scripts/indexnow.py --urls https://analizadorcv.com/guias/cv-ats.html

Antes de avisar espera a que Netlify publique la versión nueva de cada página (compara su contenido),
para que el buscador no rastree la versión antigua. La clave está en build.py (INDEXNOW_KEY) y build.py
la publica en https://analizadorcv.com/<clave>.txt, que es como IndexNow comprueba que la web es nuestra.
"""
import hashlib, json, os, re, subprocess, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = open(os.path.join(ROOT, 'build.py'), encoding='utf-8').read()
SITE_URL = os.environ.get('CV_SITE_URL') or re.search(r"'CV_SITE_URL', '([^']+)'", BUILD).group(1)
SITE_URL = SITE_URL.rstrip('/')
KEY = re.search(r"^INDEXNOW_KEY = '([0-9a-f]+)'", BUILD, re.M).group(1)
HOST = SITE_URL.split('://', 1)[1]
ENDPOINT = 'https://api.indexnow.org/indexnow'
SKIP = {'404.html'}
WAIT_S = int(os.environ.get('INDEXNOW_WAIT', '600'))


def to_url(path):
    """site/guias/index.html -> https://analizadorcv.com/guias/"""
    rel = path[len('site/'):]
    if rel == 'index.html': return SITE_URL + '/'
    if rel.endswith('/index.html'): return SITE_URL + '/' + rel[:-len('index.html')]
    return SITE_URL + '/' + rel


def changed_pages(before, after):
    if not before or set(before) == {'0'}: before = after + '~1'
    out = subprocess.run(['git', 'diff', '--name-only', '--diff-filter=AM', before, after, '--', 'site'],
                         cwd=ROOT, capture_output=True, text=True, check=True).stdout.split()
    return [p for p in out if p.endswith('.html') and p[len('site/'):] not in SKIP]


def fetch(url):
    req = urllib.request.Request(url + ('&' if '?' in url else '?') + 'nocache=%d' % time.time(), headers={'User-Agent': 'analizadorcv-indexnow'})
    with urllib.request.urlopen(req, timeout=20) as r: return r.read()


def wait_live(pages):
    """Espera hasta que todas las páginas publicadas coinciden con las del repo (o se agota el tiempo)."""
    pending = {p: hashlib.sha256(open(os.path.join(ROOT, p), 'rb').read()).hexdigest() for p in pages}
    t0 = time.time()
    while pending and time.time() - t0 < WAIT_S:
        for p, h in list(pending.items()):
            try:
                if hashlib.sha256(fetch(to_url(p))).hexdigest() == h: del pending[p]
            except Exception: pass
        if pending: time.sleep(20)
    if pending: print('Aviso: tras %d s Netlify aún no sirve la versión nueva de: %s. Se avisa igualmente.' % (WAIT_S, ', '.join(pending)))
    else: print('Netlify ya publica la versión nueva (%.0f s).' % (time.time() - t0))


def submit(urls):
    body = json.dumps({'host': HOST, 'key': KEY, 'keyLocation': '%s/%s.txt' % (SITE_URL, KEY), 'urlList': urls}).encode()
    req = urllib.request.Request(ENDPOINT, data=body, method='POST', headers={'Content-Type': 'application/json; charset=utf-8'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r: code = r.status
    except urllib.error.HTTPError as e: code = e.code
    # 200 = recibido; 202 = recibido, la clave se validará después; 422/403/400 = error
    print('IndexNow respondió %d para %d URL:\n  %s' % (code, len(urls), '\n  '.join(urls)))
    return code in (200, 202)


if __name__ == '__main__':
    args = sys.argv[1:]
    if args[:1] == ['--urls']:
        urls = args[1:]
    else:
        pages = changed_pages(*args[:2]) if len(args) >= 2 else []
        if not pages: print('No hay páginas nuevas o modificadas en site/: nada que avisar.'); sys.exit(0)
        wait_live(pages)
        urls = [to_url(p) for p in pages]
    if not urls: print('Sin URL.'); sys.exit(0)
    sys.exit(0 if submit(urls) else 1)
