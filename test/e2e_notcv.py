# Un documento que no es un CV no se analiza sin preguntar; un CV sí. Usa la build selfhost (sin pagos).
import subprocess, sys, os, time, tempfile
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DOCS = os.path.join(HERE, 'docs')
OUT = os.environ.get('CV_TEST_OUT', tempfile.gettempdir())
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8806', '--bind', '127.0.0.1'], cwd=os.path.join(ROOT, 'dist'), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
errs = []
def check(label, cond): print(('OK   ' if cond else 'FALLO') + ' ' + label); (None if cond else errs.append(label))
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1300, 'height': 900})
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto('http://127.0.0.1:8806/selfhost/analizador.html'); pg.wait_for_selector('.scorecard .big')
        before = pg.text_content('#docName')
        pg.set_input_files('#file', os.path.join(DOCS, 'nocv_factura.txt'))
        pg.wait_for_selector('#notCvBox:not([hidden])', timeout=20000)
        check('factura → pregunta en vez de analizar', 'no parece un CV' in pg.text_content('#notCvMsg') and 'factura' in pg.text_content('#notCvMsg'))
        check('el informe anterior no cambia', pg.text_content('#docName') == before)
        pg.screenshot(path=os.path.join(OUT, 'notcv_box.png'))
        pg.click('#notCvForce'); pg.wait_for_selector('#notCvBox[hidden]', state='attached'); pg.wait_for_timeout(1500)
        check('«analizarlo igualmente» analiza el documento', 'nocv_factura' in pg.text_content('#docName'))
        check('aviso en el informe', pg.is_visible('#notCvBanner'))
        pg.set_input_files('#file', os.path.join(DOCS, 'cv_estudiante.txt')); pg.wait_for_selector('#status:has-text("analizado")', timeout=20000); pg.wait_for_timeout(800)
        check('un CV se analiza directamente', 'cv_estudiante' in pg.text_content('#docName') and pg.is_hidden('#notCvBox') and pg.is_hidden('#notCvBanner'))
        for f in ['nocv_oferta.txt', 'nocv_carta.txt', 'nocv_articulo.txt']:
            pg.set_input_files('#file', os.path.join(DOCS, f)); pg.wait_for_selector('#notCvBox:not([hidden])', timeout=20000)
            check(f + ' → pregunta', 'cv_estudiante' in pg.text_content('#docName'))
        # texto pegado
        pg.click('#pasteBox summary'); pg.fill('#pasted', open(os.path.join(DOCS, 'nocv_receta.txt')).read()); pg.click('#analyzePasted')
        pg.wait_for_selector('#notCvBox:not([hidden])', timeout=20000)
        check('texto pegado que no es un CV → pregunta', 'receta' in pg.text_content('#notCvMsg'))
        pg.set_viewport_size({'width': 390, 'height': 844}); pg.wait_for_timeout(300)
        check('móvil sin scroll horizontal', not pg.evaluate('()=>document.documentElement.scrollWidth>innerWidth'))
        pg.screenshot(path=os.path.join(OUT, 'notcv_movil.png'))
        b.close()
finally: srv.terminate()
print('errors', errs)
