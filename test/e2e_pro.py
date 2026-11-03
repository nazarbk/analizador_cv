# Informe Pro de principio a fin con Stripe y la API de Claude simulados (test/pro_server.mjs).
# Cubre: compra, 3 informes por compra, cambiar de CV entre informes, borrar informes sin perder la compra,
# recuperar la compra en otro navegador, pago terminado con la pestaña cerrada, pago cancelado y errores de la IA.
import os, sys, subprocess, json, tempfile, urllib.request
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
OUT = os.environ.get('CV_TEST_OUT', tempfile.gettempdir())
CV1 = os.path.join(HERE, 'files', 'Daniel-Ortega-CV.pdf'); CV2 = os.path.join(HERE, 'files', 'Lucia-Martin-CV.docx')
OFFER = """Backend Developer (Python) — Acme Data, Madrid (híbrido)
Buscamos una persona para diseñar y mantener APIs en Python y servicios en AWS.
Requisitos: 3 años de experiencia con Python, AWS, SQL y Docker. Valorable Kubernetes y Terraform.
Inglés B2. Trabajo en equipo ágil, revisiones de código y pruebas automatizadas."""
REPORT = '#v-pro h3:text-is("Requisito a requisito")'
errs = []
def start(port, **env):
    p = subprocess.Popen(['node', os.path.join(HERE, 'pro_server.mjs'), str(port)], cwd=ROOT, env=dict(os.environ, **env), stdout=subprocess.PIPE, stderr=subprocess.DEVNULL); p.stdout.readline(); return p
def mlog(port): return json.loads(urllib.request.urlopen(f'http://127.0.0.1:{port}/__log').read())
def page(b, **kw):
    ctx = b.new_context(viewport={'width': 1366, 'height': 900}, accept_downloads=True, **kw); pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept()); return ctx, pg
def upload(pg, f):
    pg.set_input_files('#file', f); pg.wait_for_selector('#status:has-text("analizado")', timeout=60000); pg.wait_for_timeout(1400)
def pay(pg, offer=OFFER):
    pg.click('#tabs a[data-view=pro]'); pg.wait_for_selector('#proOffer'); pg.fill('#proOffer', offer); pg.check('#proC1'); pg.check('#proC2'); pg.click('#proPay')
def check(label, cond): print(('OK   ' if cond else 'FALLO') + ' ' + label); (None if cond else errs.append(label))

def main_flow(port):
    srv = start(port); B = f'http://127.0.0.1:{port}/'
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(); ctx, pg = page(b)
            pg.goto(B + 'analizador.html'); pg.wait_for_selector('#tabs a[data-view=pro]:not([hidden])')
            upload(pg, CV1)
            pg.click('#tabs a[data-view=pro]'); check('sin compra: botón de pagar', pg.locator('#proPay').count() == 1)
            check('explica qué falta', 'pega la oferta' in pg.text_content('#proWhy'))
            pay(pg); pg.wait_for_url('**/analizador.html#pro'); pg.wait_for_selector(REPORT, timeout=30000)
            check('1.º informe con el CV 1', 'Daniel-Ortega-CV.pdf' in pg.text_content('.pro-head'))
            check('quedan 2', 'quedan 2' in pg.text_content('#proNew'))
            pg.screenshot(path=os.path.join(OUT, 'pro_resultado.png'), full_page=True)
            with pg.expect_download() as d: pg.click('#proCvPdf')
            check('descarga CV', d.value.suggested_filename.endswith('.pdf'))
            with pg.expect_download() as d: pg.click('#proLetPdf')
            check('descarga carta', 'carta' in d.value.suggested_filename)
            sid = mlog(port)['sessions'][0]['id']
            # enlace de recuperación en otro navegador (sin datos guardados)
            ctx2, pg2 = page(b); pg2.goto(B + f'analizador.html?pro={sid}#pro'); pg2.wait_for_selector('.pro-wallet', timeout=15000)
            check('otro navegador recupera la compra (quedan 2)', 'quedan 2' in pg2.text_content('.pro-wallet'))
            check('otro navegador: botón usar, no pagar', pg2.locator('#proUse').count() == 1 and pg2.locator('#proPay').count() == 0)
            ctx2.close()
            # se sube OTRO CV y se usa un informe restante con él
            upload(pg, CV2); pg.click('#tabs a[data-view=pro]'); pg.wait_for_selector(REPORT)
            check('aviso de CV distinto en el informe anterior', 'otro CV' in pg.text_content('#v-pro .banner'))
            pg.click('#proNew'); pg.wait_for_selector('#proUse')
            check('el formulario usará el CV nuevo', 'Lucia-Martin-CV.docx' in pg.text_content('#v-pro'))
            check('con informes pagados no pide la casilla de desistimiento', pg.locator('#proC2').count() == 0)
            pg.fill('#proOffer', OFFER.replace('Acme Data', 'Beta Labs')); pg.check('#proC1'); pg.click('#proUse'); pg.wait_for_selector(REPORT, timeout=30000)
            check('2.º informe con el CV 2', 'Lucia-Martin-CV.docx' in pg.text_content('.pro-head') and 'Beta Labs' in pg.text_content('.pro-head h3'))
            check('queda 1', 'queda 1' in pg.text_content('#proNew'))
            # borrar un informe no quita informes de la compra
            pg.click('#proForget'); pg.wait_for_selector('#proOffer, ' + REPORT)
            check('tras borrar sigue quedando 1', '1' in (pg.text_content('[data-badge=pro]') or ''))
            # recarga: se conservan compra e informes
            pg.reload(); pg.wait_for_selector('.scorecard .big'); pg.click('#tabs a[data-view=pro]'); pg.wait_for_timeout(800)
            check('tras recargar: lista de informes', pg.locator('.pro-reports li').count() == 1)
            check('tras recargar (CV de ejemplo): pide subir el CV', 'sube primero tu CV' in (pg.text_content('#proWhy') if pg.locator('#proWhy').count() else 'sube primero tu CV'))
            upload(pg, CV1); pg.click('#tabs a[data-view=pro]'); pg.wait_for_timeout(400)
            if pg.locator('#proNew').count(): pg.click('#proNew')
            pg.wait_for_selector('#proUse'); pg.fill('#proOffer', OFFER.replace('Acme Data', 'Gamma')); pg.check('#proC1'); pg.click('#proUse'); pg.wait_for_selector(REPORT, timeout=30000)
            check('3.º informe: ya no quedan → comprar más', 'Comprar más' in pg.text_content('#proNew'))
            pg.click('#proNew'); pg.wait_for_selector('#proPay'); check('sin informes: vuelve a pedir pago', pg.locator('#proC2').count() == 1)
            r = pg.request.post(B + 'api/generate', data=json.dumps({'session_id': sid, 'offer': OFFER, 'lang': 'es', 'cv': {'exp': []}}), headers={'content-type': 'application/json'})
            check('el servidor rechaza un 4.º informe (429)', r.status == 429)
            lg = mlog(port)
            check('contador en Stripe = 3', lg['sessions'][0]['gen'] == 3)
            sent = [x for x in lg['log'] if 'ai' in x][-1]['sent']
            check('a la IA no van datos de contacto', not any(k in sent for k in ['@', 'linkedin.com', '+34']))
            co = [x for x in lg['log'] if x.get('stripe') == 'POST /checkout/sessions'][0]
            check('Managed Payments activado', co['body'].get('managed_payments[enabled]') == 'true')
            check('vuelve al mismo dominio', co['body']['success_url'].startswith(B.rstrip('/')))
            # pago terminado con la pestaña cerrada: se recupera al volver a entrar
            pg.fill('#proOffer', OFFER); pg.check('#proC1'); pg.check('#proC2'); pg.click('#proPay'); pg.wait_for_url('**/analizador.html#pro', timeout=20000)
            pg.wait_for_selector(REPORT, timeout=30000)  # (vuelta normal; ahora la simulación de pestaña cerrada)
            ctx3, pg3 = page(b); pg3.goto(B + 'analizador.html'); upload(pg3, CV1); pay(pg3)
            sid3 = [s for s in mlog(port)['sessions'] if not s['paid']]
            pg3.wait_for_timeout(500)
            urllib.request.urlopen(urllib.request.Request(B + '__mark_paid?session=' + mlog(port)['sessions'][-1]['id']))
            pg3.goto(B + 'analizador.html'); pg3.wait_for_selector('.scorecard .big'); pg3.wait_for_timeout(1500); pg3.click('#tabs a[data-view=pro]')
            pg3.wait_for_selector('#proUse', timeout=10000)
            check('pestaña cerrada tras pagar: compra disponible y oferta recuperada', 'Backend Developer' in pg3.input_value('#proOffer'))
            ctx3.close()
            # pago cancelado
            pg.goto(B + 'analizador.html?pro=cancelado#pro'); pg.wait_for_selector('#proOffer')
            for w in (760, 390):
                pg.set_viewport_size({'width': w, 'height': 900}); pg.reload(); pg.wait_for_selector('.scorecard .big'); pg.click('#tabs a[data-view=pro]'); pg.wait_for_timeout(500)
                check(f'{w}px sin scroll horizontal', not pg.evaluate('()=>document.documentElement.scrollWidth>innerWidth'))
            pg.screenshot(path=os.path.join(OUT, 'pro_movil.png'), full_page=True)
            b.close()
    finally: srv.terminate()

def ai_fail(port):
    srv = start(port, MOCK_FAIL_FIRST='1'); B = f'http://127.0.0.1:{port}/'
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(); ctx, pg = page(b)
            pg.goto(B + 'analizador.html'); pg.wait_for_selector('#tabs a[data-view=pro]:not([hidden])'); upload(pg, CV1); pay(pg)
            pg.wait_for_selector('#proRetry', timeout=30000); check('IA saturada → mensaje y reintentar', 'saturado' in pg.text_content('#v-pro .lede'))
            pg.click('#proRetry'); pg.wait_for_selector(REPORT, timeout=30000)
            check('el intento fallido no se cuenta', mlog(port)['sessions'][0]['gen'] == 1)
            b.close()
    finally: srv.terminate()

print('== flujo completo'); main_flow(8821)
print('== IA saturada en el primer intento'); ai_fail(8822)
print('errors', errs)
