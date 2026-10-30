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

read = lambda n: open(os.path.join(SRC, n), encoding='utf-8').read()
css, markup = read('styles.css'), read('markup.html')
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
window.CV_LEGAL_LINKS = [['Aviso legal', 'aviso-legal.html'], ['Privacidad', 'privacidad.html'], ['Términos de uso', 'terminos.html'], ['Código en GitHub', 'https://github.com/nazarbk']];
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
            '<title>Analizador de CV</title>\n<meta name="description" content="Analiza tu CV en el navegador, sin enviarlo a ningún servidor: compatibilidad con ATS, puntos fuertes y débiles, datos para copiar en ofertas y formato por país.">\n'
            '<style>\n%s%s\n</style>\n</head>\n<body>\n%s\n%s\n</body>\n</html>\n') % (csp, base_css, css, markup, '\n'.join('<script>\n' + s + '\n</script>' for s in ss))
    open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(html)
    for fn, (title, body) in PAGES.items():
        open(os.path.join(out, fn), 'w', encoding='utf-8').write(PAGE_TPL.format(title=title, body=body))
    headers = """/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  X-Frame-Options: DENY
  Content-Security-Policy: frame-ancestors 'none'
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
  Cross-Origin-Opener-Policy: same-origin
/vendor/*
  Cache-Control: public, max-age=31536000, immutable
"""
    open(os.path.join(out, '_headers'), 'w').write(headers)
    open(os.path.join(out, 'robots.txt'), 'w').write('User-agent: *\nAllow: /\n')
    zp = os.path.join(DIST, 'analizador-cv-web.zip')
    with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED) as z:
        for d, _, files in os.walk(out):
            for f in files:
                full = os.path.join(d, f)
                z.write(full, os.path.join('analizador-cv', os.path.relpath(full, out)))
    if os.path.exists(SITE): shutil.rmtree(SITE)
    shutil.copytree(out, SITE)
    return out, zp

if __name__ == '__main__':
    p, size = build_artifact()
    print('artifact', p, size, 'bytes')
    print('selfhost', *build_selfhost())
