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
SITE_URL = os.environ.get('CV_SITE_URL', 'https://analizadorcv.com').rstrip('/')
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

TOOL_DESC = 'Analiza gratis tu CV en el navegador, sin subirlo a ningún servidor: compatibilidad ATS, puntos fuertes y débiles, encaje con ofertas y CV en PDF o Word.'
HOME_TITLE = 'Analizador de CV gratis: comprueba tu CV para los filtros ATS'
HOME_DESC = 'Analiza tu CV gratis y sin registro: compatibilidad ATS, puntos fuertes y débiles, encaje con ofertas y un CV listo en PDF o Word. No sale de tu navegador.'

def build_landing(out, base_css):
    body = read('landing.html'); js = read('landing.js')
    body = body.replace('<!--GUIAS-->', '<ul class="lp-guides">' + ''.join('<li><a href="guias/%s.html">%s</a><p>%s</p></li>' % (g['slug'], g['h1'], g['lede']) for g in load_guides()) + '</ul>')
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

GUIDE_CSS = """
.lp-article { max-width: 760px; margin: 0 auto; padding: 36px max(20px, env(safe-area-inset-left, 0px)) 72px; }
.crumbs { font-size: 14px; color: var(--ink-3); display: flex; flex-wrap: wrap; gap: 6px; }
.crumbs a { color: var(--ink-2); }
.lp-article h1 { font-size: clamp(30px, 4vw, 42px); line-height: 1.12; margin-top: 18px; }
.lp-article .lede { font-size: 19px; color: var(--ink-2); margin-top: 14px; }
.byline { font-size: 14px; color: var(--ink-3); margin-top: 14px; }
.toc-box { margin: 26px 0 8px; padding: 16px 20px; background: var(--sheet); border: 1px solid var(--rule); border-radius: 12px; }
.toc-box strong { font: 600 14px var(--sans); letter-spacing: .06em; text-transform: uppercase; color: var(--ink-3); }
.toc-box ol { margin: 8px 0 0; padding-left: 20px; display: grid; gap: 4px; }
.prose h2 { font-size: 26px; margin-top: 40px; scroll-margin-top: 80px; }
.prose p, .prose li { font-size: 17px; line-height: 1.7; color: var(--ink); }
.prose p { margin-top: 14px; }
.prose ul, .prose ol { margin-top: 12px; padding-left: 22px; display: grid; gap: 8px; }
.prose blockquote { margin: 18px 0; padding: 4px 20px; border-left: 4px solid var(--lila-line); background: var(--lila-soft); border-radius: 0 10px 10px 0; }
.cta-box { margin-top: 44px; padding: 24px; border-radius: 14px; background: linear-gradient(110deg, var(--pen-soft), var(--lila-soft)); border: 1px solid var(--pen-line); display: grid; gap: 12px; }
.cta-box h2 { font-size: 22px; margin: 0; }
.cta-box .lp-cta { margin-top: 4px; }
.related { margin-top: 40px; }
.related h2 { font-size: 20px; }
.related ul { list-style: none; padding: 0; margin: 12px 0 0; display: grid; gap: 10px; }
.related a { font-weight: 600; }
.guide-list { list-style: none; padding: 0; margin: 28px 0 0; display: grid; gap: 16px; }
.guide-list li { padding: 20px 22px; border: 1px solid var(--rule); border-radius: 12px; background: var(--sheet); }
.guide-list a { font: 600 20px/1.3 var(--serif); text-decoration: none; color: var(--ink); }
.guide-list a:hover { color: var(--pen-strong); }
.guide-list p { color: var(--ink-2); margin-top: 6px; }
"""

def _abs_links(html):
    import re as _r
    def fix(m):
        attr, url = m.group(1), m.group(2)
        if _r.match(r'^(https?:|mailto:|/|data:)', url): return m.group(0)
        if url in ('./', ''): url = ''
        return '%s="/%s"' % (attr, url)
    return _r.sub(r'(href|src)="([^"]*)"', fix, html)

def _chrome():
    body = read('landing.html')
    import re as _r
    header = _r.search(r'<header class="lp-top">.*?</header>', body, _r.S).group(0)
    footer = _r.search(r'<footer class="lp-foot">.*?</footer>', body, _r.S).group(0)
    header = header.replace('<a class="lp-btn lp-btn-ghost lp-nav-cta" href="analizador.html">Abrir el analizador</a>', '<a class="lp-btn lp-btn-primary lp-nav-cta" href="analizador.html">Analizar mi CV gratis</a>')
    return _abs_links(header), _abs_links(footer)

def load_guides():
    import re as _r
    gdir = os.path.join(SRC, 'guias'); out = []
    for fn in sorted(os.listdir(gdir)):
        if not fn.endswith('.html'): continue
        raw = open(os.path.join(gdir, fn), encoding='utf-8').read()
        meta = json.loads(_r.match(r'<!--(.*?)-->', raw, _r.S).group(1))
        meta['slug'] = fn[:-5]; meta['body'] = raw[raw.index('-->') + 3:].strip()
        meta['toc'] = _r.findall(r'<h2 id="([^"]+)">(.*?)</h2>', meta['body'])
        meta['words'] = len(_r.sub(r'<[^>]+>', ' ', meta['body']).split())
        out.append(meta)
    return out

def _page(title, desc, path, body_html, ld, extra_css=''):
    csp = "default-src 'self'; script-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'"
    return ('<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '<meta http-equiv="Content-Security-Policy" content="%s">\n<title>%s</title>\n<meta name="description" content="%s">\n%s%s'
            '<script type="application/ld+json">%s</script>\n<style>\n%s\n%s\n%s\n%s\n</style>\n</head>\n<body>\n%s\n</body>\n</html>\n') % (
            csp, title, desc, icon_links('/'), seo_meta(title, desc, path), json.dumps(ld, ensure_ascii=False), ':root{padding-top:env(safe-area-inset-top,0px)}[hidden]{display:none!important}', TOKENS, read('landing.css'), GUIDE_CSS + extra_css, body_html)

def build_guides(out):
    gs = load_guides(); header, footer = _chrome()
    os.makedirs(os.path.join(out, 'guias'), exist_ok=True)
    fmt = lambda d: '%d de %s de %s' % (int(d[8:10]), ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][int(d[5:7]) - 1], d[:4])
    for g in gs:
        path = 'guias/%s.html' % g['slug']
        others = [o for o in gs if o['slug'] != g['slug']]
        toc = '<nav class="toc-box" aria-label="Contenido"><strong>En esta guía</strong><ol>' + ''.join('<li><a href="#%s">%s</a></li>' % (i, t) for i, t in g['toc']) + '</ol></nav>'
        cta = ('<aside class="cta-box"><h2>Comprueba tu CV gratis</h2><p>El Analizador de CV revisa tu currículum como lo haría un ATS y te dice qué arreglar, por prioridad. Se analiza en tu navegador: no se sube a ningún servidor.</p>'
               '<div class="lp-cta"><a class="lp-btn lp-btn-primary" href="/analizador.html">Analizar mi CV gratis</a><a class="lp-btn lp-btn-ghost" href="/analizador.html#pro">Ver el Informe Pro</a></div></aside>')
        rel = '<section class="related"><h2>Otras guías</h2><ul>' + ''.join('<li><a href="/guias/%s.html">%s</a></li>' % (o['slug'], o['h1']) for o in others) + '</ul></section>'
        main = ('<main id="main" class="lp-article"><nav class="crumbs" aria-label="Ruta"><a href="/">Inicio</a><span aria-hidden="true">›</span><a href="/guias/">Guías</a><span aria-hidden="true">›</span><span>%s</span></nav>'
                '<article><h1>%s</h1><p class="lede">%s</p><p class="byline">Por Nazar Blanco Kataran · Actualizada el %s · %d min de lectura</p>%s<div class="prose">%s</div></article>%s%s</main>') % (
                g['h1'], g['h1'], g['lede'], fmt(g['date']), max(2, round(g['words'] / 220)), toc, g['body'], cta, rel)
        ld = [{'@context': 'https://schema.org', '@type': 'Article', 'headline': g['h1'], 'description': g['description'], 'inLanguage': 'es', 'datePublished': g['date'], 'dateModified': g['date'],
               'author': {'@type': 'Person', 'name': AUTHOR, 'url': 'https://github.com/nazarbk'}, 'publisher': {'@type': 'Person', 'name': AUTHOR},
               'image': SITE_URL + '/assets/og-image.png', 'mainEntityOfPage': SITE_URL + '/' + path},
              {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
                  {'@type': 'ListItem', 'position': 1, 'name': 'Inicio', 'item': SITE_URL + '/'},
                  {'@type': 'ListItem', 'position': 2, 'name': 'Guías', 'item': SITE_URL + '/guias/'},
                  {'@type': 'ListItem', 'position': 3, 'name': g['h1'], 'item': SITE_URL + '/' + path}]}]
        html = _page(g['title'], g['description'], path, '<a class="skip" href="#main">Saltar al contenido</a>\n' + header + main + footer, ld)
        open(os.path.join(out, path), 'w', encoding='utf-8').write(html)
    lst = '<ul class="guide-list">' + ''.join('<li><a href="/guias/%s.html">%s</a><p>%s</p></li>' % (g['slug'], g['h1'], g['lede']) for g in gs) + '</ul>'
    main = ('<main id="main" class="lp-article"><nav class="crumbs" aria-label="Ruta"><a href="/">Inicio</a><span aria-hidden="true">›</span><span>Guías</span></nav>'
            '<h1>Guías para mejorar tu CV</h1><p class="lede">Consejos prácticos y sin humo para que tu currículum pase los filtros ATS y convenza a quien lo lee.</p>%s</main>') % lst
    ld = {'@context': 'https://schema.org', '@type': 'CollectionPage', 'name': 'Guías para mejorar tu CV', 'url': SITE_URL + '/guias/', 'inLanguage': 'es'}
    open(os.path.join(out, 'guias', 'index.html'), 'w', encoding='utf-8').write(_page('Guías para mejorar tu CV y pasar los filtros ATS', 'Guías prácticas para hacer un CV compatible con ATS, adaptarlo a cada oferta y escribir una carta de presentación que no suene genérica.', 'guias/', '<a class="skip" href="#main">Saltar al contenido</a>\n' + header + main + footer, ld))
    return gs

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
    urls = [('', '1.0'), ('analizador.html', '0.9'), ('guias/', '0.7')] + [('guias/%s.html' % g['slug'], '0.7') for g in load_guides()] + [('condiciones.html', '0.3'), ('privacidad.html', '0.3'), ('aviso-legal.html', '0.2'), ('terminos.html', '0.2')]
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
    build_guides(out)
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
