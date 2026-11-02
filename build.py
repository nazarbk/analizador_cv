#!/usr/bin/env python3
"""Genera dos versiones del Analizador de CV:
   dist/artifact/analizador-cv.html  -> página para publicar como artifact (librerías desde CDN, carga diferida)
   dist/selfhost/ y site/             -> sitio estático autoalojable (librerías locales, CSP estricta, páginas legales);
                                         site/ es la carpeta que se sube al repositorio y publica Netlify
"""
import base64, hashlib, json, os, shutil, sys, zipfile
ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
DIST = os.path.join(ROOT, 'dist')
sys.path.insert(0, SRC)
from legal import PAGES, PAGE_TPL

PDFJS = '6.2.108'
JSZIP = '3.10.1'
PDFLIB = '1.17.1'
# Librerías de terceros: se instalan con `npm install` (package.json fija las versiones).
def _modules():
    for base in (os.path.join(ROOT, 'node_modules'), os.environ.get('CV_NODE_MODULES', ''), '/opt/npm-tools/node_modules'):
        if base and os.path.isdir(os.path.join(base, 'pdfjs-dist')) and os.path.isdir(os.path.join(base, 'jszip')) and os.path.isdir(os.path.join(base, 'pdf-lib')):
            return base
    sys.exit('Faltan las librerías de terceros. Ejecuta primero: npm install')
NM = _modules()
VENDOR_PDFLIB = os.path.join(NM, 'pdf-lib/dist/pdf-lib.min.js')
VENDOR_PDFLIB_LICENSE = os.path.join(NM, 'pdf-lib/LICENSE.md')
VENDOR_PDF = os.path.join(NM, 'pdfjs-dist/legacy/build')
VENDOR_PDF_LICENSE = os.path.join(NM, 'pdfjs-dist/LICENSE')
VENDOR_ZIP = os.path.join(NM, 'jszip/dist/jszip.min.js')
VENDOR_ZIP_LICENSE = os.path.join(NM, 'jszip/LICENSE.markdown')
SITE = os.path.join(ROOT, 'site')   # carpeta que publica Netlify (netlify.toml)
# Dirección pública de la web (para la URL canónica, el mapa del sitio y las vistas previas en redes).
# Cámbiala si tu sitio de Netlify tiene otro nombre o usas un dominio propio: CV_SITE_URL=https://... python3 build.py
SITE_URL = os.environ.get('CV_SITE_URL', 'https://cv-analizador.netlify.app').rstrip('/')
ASSETS = os.path.join(SRC, 'assets')
AUTHOR = 'Nazar Blanco Kataran'
import re as _re

def icon_links(prefix=''):
    return ('<link rel="icon" href="%(p)sfavicon.ico" sizes="48x48">\n<link rel="icon" href="%(p)sassets/icon.svg" type="image/svg+xml">\n'
            '<link rel="apple-touch-icon" href="%(p)sapple-touch-icon.png">\n<link rel="manifest" href="%(p)ssite.webmanifest">\n<meta name="theme-color" content="#0F7A74">\n') % {'p': prefix}

def seo_meta(title, desc, path, og_title=None):
    url = SITE_URL + '/' + path
    return ('<link rel="canonical" href="%(u)s">\n<meta name="author" content="%(a)s">\n'
            '<meta property="og:type" content="website">\n<meta property="og:locale" content="es_ES">\n<meta property="og:site_name" content="Analizador de CV">\n'
            '<meta property="og:title" content="%(t)s">\n<meta property="og:description" content="%(d)s">\n<meta property="og:url" content="%(u)s">\n'
            '<meta property="og:image" content="%(s)s/assets/og-image.png">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n'
            '<meta property="og:image:alt" content="Analizador de CV: puntuación del CV y categorías del análisis">\n'
            '<meta name="twitter:card" content="summary_large_image">\n') % {'u': url, 'a': AUTHOR, 't': og_title or title, 'd': desc, 's': SITE_URL}

read = lambda n: open(os.path.join(SRC, n), encoding='utf-8').read()
css, markup = read('styles.css'), read('markup.html')
TOKENS = _re.search(r':root \{.*?\n\}', css, _re.S).group(0)   # paleta compartida con la página principal
js_files = ['data.js', 'engine.js', 'extract.js', 'cvtemplate.js', 'translate.js']
sample_text = open(os.path.join(ROOT, 'test', 'sample_es.txt'), encoding='utf-8').read()
sample = 'window.CV_SAMPLE = ' + json.dumps({'text': sample_text, 'meta': {'fileType': 'pdf', 'fileName': 'CV.pdf', 'pages': 2, 'pageSize': 'A4', 'fonts': 3, 'images': 0, 'columns': False, 'tables': 0}}, ensure_ascii=False) + ';'

ART_LIBS = """window.CV_BUILD = 'artifact';
window.CV_LIBS = {
  pdfjs: async function () {
    try {
      const m = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@%(pdf)s/legacy/build/pdf.min.mjs');
      m.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@%(pdf)s/legacy/build/pdf.worker.min.mjs';
      return m;
    } catch (e) { throw new Error('No se pudo cargar el lector de PDF. Comprueba tu conexión o pega el texto del CV.'); }
  },
  jszip: function () {
    return new Promise(function (resolve, reject) {
      if (window.JSZip) return resolve(window.JSZip);
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/%(zip)s/jszip.min.js';
      s.onload = function () { resolve(window.JSZip); };
      s.onerror = function () { reject(new Error('No se pudo cargar el lector de DOCX. Comprueba tu conexión o pega el texto del CV.')); };
      document.head.appendChild(s);
    });
  }
};""" % {'pdf': PDFJS, 'zip': JSZIP}
ART_LIBS = ART_LIBS[:-2] + """,
  pdflib: function () {
    return new Promise(function (resolve, reject) {
      if (window.PDFLib) return resolve(window.PDFLib);
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/%s/pdf-lib.min.js';
      s.onload = function () { resolve(window.PDFLib); };
      s.onerror = function () { reject(new Error('No se pudo cargar el generador de PDF.')); };
      document.head.appendChild(s);
    });
  }
};""" % PDFLIB

SELF_LIBS = """window.CV_BUILD = 'selfhost';
window.CV_LEGAL_LINKS = [['Aviso legal', 'aviso-legal.html'], ['Privacidad', 'privacidad.html'], ['Términos de uso', 'terminos.html'], ['Condiciones de venta', 'condiciones.html'], ['Código en GitHub', 'https://github.com/nazarbk']];
window.CV_AUTHOR = { name: 'Nazar Blanco Kataran', email: 'nazarblanco@gmail.com' };
window.CV_LIBS = {
  pdfjs: async function () {
    const m = await import('./vendor/pdf.min.mjs');
    m.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.mjs';
    return m;
  },
  jszip: function () {
    return new Promise(function (resolve, reject) {
      if (window.JSZip) return resolve(window.JSZip);
      const s = document.createElement('script');
      s.src = './vendor/jszip.min.js';
      s.onload = function () { resolve(window.JSZip); };
      s.onerror = function () { reject(new Error('No se pudo cargar el lector de DOCX.')); };
      document.head.appendChild(s);
    });
  },
  pdflib: function () {
    return new Promise(function (resolve, reject) {
      if (window.PDFLib) return resolve(window.PDFLib);
      const s = document.createElement('script');
      s.src = './vendor/pdf-lib.min.js';
      s.onload = function () { resolve(window.PDFLib); };
      s.onerror = function () { reject(new Error('No se pudo cargar el generador de PDF.')); };
      document.head.appendChild(s);
    });
  }
};"""

def scripts(libs):
    return [libs] + [read(f) for f in js_files] + [sample, read('ui.js')]

def build_artifact():
    out = os.path.join(DIST, 'artifact'); os.makedirs(out, exist_ok=True)
    head = '<meta charset="utf-8">\n<title>Analizador de CV</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<meta name="description" content="Analiza tu CV en el navegador: ATS, puntos fuertes y débiles, datos para copiar en ofertas y formato por país.">\n'
    html = head + '<style>\n' + css + '\n</style>\n' + markup + '\n' + '\n'.join('<script>\n' + s + '\n</script>' for s in scripts(ART_LIBS)) + '\n'
    p = os.path.join(out, 'analizador-cv.html')
    open(p, 'w', encoding='utf-8').write(html)
    return p, len(html.encode())

TOOL_DESC = 'Analiza tu CV en el navegador, sin enviarlo a ningún servidor: compatibilidad con ATS, puntos fuertes y débiles, coincidencia con ofertas, datos para copiar y CV en PDF o Word.'
HOME_TITLE = 'Analizador de CV gratis: comprueba tu CV para los filtros ATS'
HOME_DESC = 'Analiza tu CV gratis y sin registro: compatibilidad con ATS, puntos fuertes y débiles, coincidencia con ofertas y un CV listo en PDF o Word. Tu CV no sale de tu navegador.'

def build_landing(out, base_css):
    body = read('landing.html'); js = read('landing.js')
    h = base64.b64encode(hashlib.sha256(('\n' + js + '\n').encode()).digest()).decode()
    csp = ("default-src 'self'; script-src 'self' 'sha256-%s'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; "
           "connect-src 'none'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'") % h
    ld = {
        '@context': 'https://schema.org', '@type': 'WebApplication', 'name': 'Analizador de CV', 'url': SITE_URL + '/',
        'description': HOME_DESC, 'inLanguage': 'es', 'applicationCategory': 'BusinessApplication', 'operatingSystem': 'Cualquiera (navegador web)',
        'browserRequirements': 'Requiere JavaScript y un navegador actual', 'isAccessibleForFree': True,
        'offers': [{'@type': 'Offer', 'name': 'Análisis gratuito', 'price': '0', 'priceCurrency': 'EUR'},
                   {'@type': 'Offer', 'name': 'Informe Pro: CV adaptado a una oferta y carta de presentación', 'price': '4.99', 'priceCurrency': 'EUR'}],
        'author': {'@type': 'Person', 'name': AUTHOR, 'url': 'https://github.com/nazarbk'},
        'image': SITE_URL + '/assets/og-image.png',
        'featureList': ['Compatibilidad con ATS e IA', 'Puntos fuertes y débiles', 'Coincidencia con ofertas de empleo', 'Datos listos para copiar en portales de empleo', 'CV en formato ATS en PDF y Word', 'Versión del CV en inglés', 'Formato por país', 'Comparación de versiones']
    }
    html = ('<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '<meta http-equiv="Content-Security-Policy" content="%s">\n<meta name="referrer" content="strict-origin-when-cross-origin">\n'
            '<title>%s</title>\n<meta name="description" content="%s">\n%s%s'
            '<script type="application/ld+json">%s</script>\n'
            '<style>\n%s%s\n%s\n</style>\n</head>\n<body>\n%s\n<script>\n%s\n</script>\n</body>\n</html>\n') % (
            csp, HOME_TITLE, HOME_DESC, icon_links(), seo_meta(HOME_TITLE, HOME_DESC, '', 'Analizador de CV: descubre cómo leen tu CV los filtros ATS'),
            json.dumps(ld, ensure_ascii=False), base_css, TOKENS, read('landing.css'), body, js)
    open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(html)
    nf = ('<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'
          '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; style-src \'unsafe-inline\'; img-src \'self\'; base-uri \'none\'; form-action \'none\'">\n'
          '<meta name="robots" content="noindex">\n<title>Página no encontrada · Analizador de CV</title>\n%s'
          '<style>\n%s\nbody{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--paper);color:var(--ink);font:16px/1.6 var(--sans);padding:24px}'
          'main{text-align:center;max-width:460px}h1{font:600 30px/1.2 var(--serif);margin:18px 0 8px}p{color:var(--ink-2);margin:0}'
          '.b{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:24px}.b a{padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;border:1px solid var(--pen-line);color:var(--pen-strong)}'
          '.b a:first-child{background:var(--pen);border-color:var(--pen);color:#fff}\n</style>\n</head>\n<body>\n<main><img src="/assets/icon.svg" width="64" height="64" alt="">'
          '<h1>Esta página no existe</h1><p>Puede que el enlace esté mal escrito o que la página se haya movido.</p>'
          '<div class="b"><a href="/analizador.html">Analizar mi CV</a><a href="/">Ir al inicio</a></div></main>\n</body>\n</html>\n') % (icon_links('/'), TOKENS)
    open(os.path.join(out, '404.html'), 'w', encoding='utf-8').write(nf)

def copy_assets(out):
    os.makedirs(os.path.join(out, 'assets'), exist_ok=True)
    for f in ('icon.svg', 'icon-16.png', 'icon-32.png', 'icon-48.png', 'icon-192.png', 'icon-512.png', 'og-image.png'):
        shutil.copy(os.path.join(ASSETS, f), os.path.join(out, 'assets', f))
    for f in ('favicon.ico', 'apple-touch-icon.png'):
        shutil.copy(os.path.join(ASSETS, f), os.path.join(out, f))
    manifest = {'name': 'Analizador de CV', 'short_name': 'Analizador CV', 'description': HOME_DESC, 'lang': 'es', 'start_url': './analizador.html', 'scope': './',
                'display': 'standalone', 'background_color': '#FFFFFF', 'theme_color': '#0F7A74',
                'icons': [{'src': 'assets/icon-192.png', 'sizes': '192x192', 'type': 'image/png'}, {'src': 'assets/icon-512.png', 'sizes': '512x512', 'type': 'image/png'},
                          {'src': 'assets/icon.svg', 'sizes': 'any', 'type': 'image/svg+xml'}]}
    open(os.path.join(out, 'site.webmanifest'), 'w', encoding='utf-8').write(json.dumps(manifest, ensure_ascii=False, indent=2))
    import datetime
    today = datetime.date.today().isoformat()
    urls = [('', '1.0'), ('analizador.html', '0.9'), ('condiciones.html', '0.3'), ('privacidad.html', '0.3'), ('aviso-legal.html', '0.2'), ('terminos.html', '0.2')]
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(
        '  <url><loc>%s/%s</loc><lastmod>%s</lastmod><priority>%s</priority></url>\n' % (SITE_URL, u, today, pr) for u, pr in urls) + '</urlset>\n'
    open(os.path.join(out, 'sitemap.xml'), 'w', encoding='utf-8').write(sm)
    open(os.path.join(out, 'robots.txt'), 'w').write('User-agent: *\nAllow: /\n\nSitemap: %s/sitemap.xml\n' % SITE_URL)

def build_selfhost():
    out = os.path.join(DIST, 'selfhost')
    if os.path.exists(out): shutil.rmtree(out)
    os.makedirs(os.path.join(out, 'vendor'))
    shutil.copy(os.path.join(VENDOR_PDF, 'pdf.min.mjs'), os.path.join(out, 'vendor'))
    shutil.copy(os.path.join(VENDOR_PDF, 'pdf.worker.min.mjs'), os.path.join(out, 'vendor'))
    shutil.copy(VENDOR_ZIP, os.path.join(out, 'vendor'))
    shutil.copy(VENDOR_PDFLIB, os.path.join(out, 'vendor'))
    lic = '# Licencias de terceros\n\n## pdf.js %s (Mozilla Foundation) — Apache License 2.0\n\n%s\n\n## JSZip %s — MIT o GPLv3 (se usa bajo MIT)\n\n%s\n\n## pdf-lib %s — MIT\n\n%s\n' % (PDFJS, open(VENDOR_PDF_LICENSE).read(), JSZIP, open(VENDOR_ZIP_LICENSE).read(), PDFLIB, open(VENDOR_PDFLIB_LICENSE).read())
    open(os.path.join(out, 'vendor', 'THIRD-PARTY-LICENSES.md'), 'w').write(lic)
    ss = scripts(SELF_LIBS)
    hashes = ' '.join("'sha256-%s'" % base64.b64encode(hashlib.sha256(('\n' + s + '\n').encode()).digest()).decode() for s in ss)
    csp = ("default-src 'self'; script-src 'self' %s; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; "
           "img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'") % hashes
    base_css = ':root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}[hidden]{display:none!important}img{max-width:100%}\n'
    html = ('<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '<meta http-equiv="Content-Security-Policy" content="%s">\n<meta name="referrer" content="no-referrer">\n'
            '<title>Analizador de CV · Análisis ATS en tu navegador</title>\n<meta name="description" content="%s">\n%s%s'
            '<style>\n%s%s\n</style>\n</head>\n<body>\n%s\n%s\n</body>\n</html>\n') % (csp, TOOL_DESC, icon_links(), seo_meta('Analizador de CV · Análisis ATS en tu navegador', TOOL_DESC, 'analizador.html'), base_css, css, markup, '\n'.join('<script>\n' + s + '\n</script>' for s in ss))
    open(os.path.join(out, 'analizador.html'), 'w', encoding='utf-8').write(html)
    build_landing(out, base_css)
    copy_assets(out)
    for fn, (title, body) in PAGES.items():
        open(os.path.join(out, fn), 'w', encoding='utf-8').write(PAGE_TPL.format(title=title, body=body, icons=icon_links(), canonical=SITE_URL + '/' + fn))
    headers = """/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  X-Frame-Options: DENY
  Content-Security-Policy: frame-ancestors 'none'
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
  Cross-Origin-Opener-Policy: same-origin
/vendor/*
  Cache-Control: public, max-age=31536000, immutable
/assets/*
  Cache-Control: public, max-age=604800
/site.webmanifest
  Content-Type: application/manifest+json
"""
    open(os.path.join(out, '_headers'), 'w').write(headers)
    zp = os.path.join(DIST, 'analizador-cv-web.zip')
    with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED) as z:
        for d, _, files in os.walk(out):
            for f in files:
                full = os.path.join(d, f)
                z.write(full, os.path.join('analizador-cv', os.path.relpath(full, out)))
    if os.path.exists(SITE): shutil.rmtree(SITE)
    shutil.copytree(out, SITE)
    return out, zp

def legal_check():
    from legal import TITULAR_NIF, TITULAR_DOMICILIO
    if '[' in TITULAR_NIF or '[' in TITULAR_DOMICILIO:
        print('AVISO: faltan el NIF y el domicilio del titular en src/legal.py. Son obligatorios antes de cobrar (art. 10 LSSI-CE).')

if __name__ == '__main__':
    legal_check()
    p, size = build_artifact()
    print('artifact', p, size, 'bytes')
    print('selfhost', *build_selfhost())
