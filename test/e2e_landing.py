# Página principal: «Sube tu CV» abre el analizador con el archivo, arrastrar y soltar, iconos, SEO y diseño adaptable
import os, sys, subprocess, time, tempfile, json
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
OUT = os.environ.get('CV_TEST_OUT', tempfile.gettempdir())
CV = os.path.join(HERE, 'files', 'Daniel-Ortega-CV.pdf')
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8811', '--bind', '127.0.0.1'], cwd=os.path.join(ROOT, 'site'), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
B = 'http://127.0.0.1:8811/'
errs = []
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1366, 'height': 860}); pg = ctx.new_page()
        pg.on('pageerror', lambda e: errs.append('pageerror ' + str(e)))
        pg.on('console', lambda m: errs.append('console ' + m.text) if m.type == 'error' else None)
        pg.goto(B); pg.wait_for_selector('.lp-hero h1')
        print('title:', pg.title())
        ld = json.loads(pg.text_content('script[type="application/ld+json"]')); print('json-ld:', ld['@type'], [o['price'] for o in ld['offers']])
        for path in ['favicon.ico', 'assets/icon.svg', 'apple-touch-icon.png', 'site.webmanifest', 'assets/og-image.png', 'sitemap.xml', 'robots.txt']:
            r = pg.request.get(B + path); print(' ', path, r.status)
        pg.screenshot(path=os.path.join(OUT, 'landing_desktop.png'))
        pg.screenshot(path=os.path.join(OUT, 'landing_full.png'), full_page=True)
        # subir desde la portada
        pg.set_input_files('#cvFile', CV)
        pg.wait_for_url('**/analizador.html*'); pg.wait_for_selector('#status:has-text("analizado")', timeout=60000)
        print('handoff ->', pg.text_content('#docName'), '| hash:', pg.evaluate('()=>location.hash'))
        left = pg.evaluate("()=>new Promise(r=>{const q=indexedDB.open('cv-handoff',1);q.onsuccess=()=>{const g=q.result.transaction('f').objectStore('f').get('pending');g.onsuccess=()=>r(!!g.result)}})")
        print('archivo borrado de IndexedDB:', not left)
        print('brand link:', pg.get_attribute('a.brand', 'href'))
        # recarga del analizador: no debe volver a cargar el archivo
        pg.reload(); pg.wait_for_selector('.scorecard .big'); print('tras recargar, ejemplo:', pg.text_content('#docName'))
        # arrastrar y soltar en la portada
        pg.goto(B); pg.wait_for_selector('.lp-hero h1')
        data = open(CV, 'rb').read()
        dt = pg.evaluate_handle("(b)=>{const dt=new DataTransfer();dt.items.add(new File([new Uint8Array(b)],'Daniel-Ortega-CV.pdf',{type:'application/pdf'}));return dt}", list(data))
        pg.dispatch_event('body', 'dragenter', {'dataTransfer': dt}); print('overlay visible:', pg.is_visible('#dropOverlay'))
        pg.dispatch_event('body', 'drop', {'dataTransfer': dt}); pg.wait_for_url('**/analizador.html*'); pg.wait_for_selector('#status:has-text("analizado")', timeout=60000)
        print('drop ->', pg.text_content('#docName'))
        # formato no válido
        pg.goto(B); tmp = os.path.join(OUT, 'nota.png'); open(tmp, 'wb').write(b'x')
        pg.set_input_files('#cvFile', tmp); print('formato no válido:', pg.text_content('#cvStatus'))
        for w in (1024, 768, 390):
            pg.set_viewport_size({'width': w, 'height': 860}); pg.goto(B); pg.wait_for_selector('.lp-hero h1')
            print(w, 'hscroll', pg.evaluate('()=>document.documentElement.scrollWidth>innerWidth'))
            if w == 390: pg.screenshot(path=os.path.join(OUT, 'landing_mobile.png'), full_page=True)
        pg.goto(B + 'no-existe'); 
        pg.goto(B + '404.html'); print('404:', pg.text_content('h1'))
        pg.goto(B + 'privacidad.html'); print('legal nav:', pg.text_content('nav.top'))
        b.close()
finally:
    srv.terminate()
print('errors', [e for e in errs if '404' not in e])
