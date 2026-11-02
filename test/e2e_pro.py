# Informe Pro de principio a fin con Stripe y la API de Claude simulados (test/pro_server.mjs)
import os, sys, subprocess, time, json, tempfile, urllib.request
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
OUT = os.environ.get('CV_TEST_OUT', tempfile.gettempdir())
CV = os.path.join(HERE, 'files', 'Daniel-Ortega-CV.pdf')
OFFER = """Backend Developer (Python) — Acme Data, Madrid (híbrido)
Buscamos una persona para diseñar y mantener APIs en Python y servicios en AWS.
Requisitos: 3 años de experiencia con Python, AWS, SQL y Docker. Valorable Kubernetes y Terraform.
Inglés B2. Trabajo en equipo ágil, revisiones de código y pruebas automatizadas."""
def start(port, **env):
    e = dict(os.environ, **env)
    p = subprocess.Popen(['node', os.path.join(HERE, 'pro_server.mjs'), str(port)], cwd=ROOT, env=e, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL); p.stdout.readline(); return p
def mlog(port): return json.loads(urllib.request.urlopen(f'http://127.0.0.1:{port}/__log').read())
errs = []
def run(port, fail_first=False):
    srv = start(port, MOCK_FAIL_FIRST='1' if fail_first else '0'); B = f'http://127.0.0.1:{port}/'
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1366, 'height': 900}, accept_downloads=True); pg = ctx.new_page()
            pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
            pg.goto(B + 'analizador.html'); pg.wait_for_selector('.scorecard .big')
            pg.wait_for_selector('#tabs a[data-view=pro]:not([hidden])'); print('nav pro visible, badge:', pg.text_content('[data-badge=pro]'))
            pg.set_input_files('#file', CV); pg.wait_for_selector('#status:has-text("analizado")', timeout=60000); pg.wait_for_timeout(1400)
            print('promo en resumen:', pg.locator('#v-resumen .pro-promo').count())
            pg.click('#v-resumen [data-goto-pro]'); pg.wait_for_selector('#proOffer')
            print('pagar deshabilitado al inicio:', pg.is_disabled('#proPay'))
            pg.fill('#proOffer', OFFER); pg.check('#proC1'); print('solo un consentimiento → deshabilitado:', pg.is_disabled('#proPay'))
            pg.check('#proC2'); print('todo listo → habilitado:', pg.is_enabled('#proPay'))
            if not fail_first: pg.screenshot(path=os.path.join(OUT, 'pro_venta.png'), full_page=True)
            pg.click('#proPay')
            pg.wait_for_url('**/analizador.html#pro', timeout=20000)
            if fail_first:
                pg.wait_for_selector('#proRetry', timeout=30000); print('error IA →', pg.text_content('#v-pro .lede')[:70])
                pg.click('#proRetry')
            else:
                pg.wait_for_selector('.pro-gen', timeout=10000); pg.wait_for_timeout(500); pg.screenshot(path=os.path.join(OUT, 'pro_generando.png'))
            pg.wait_for_selector('#v-pro h3:text-is("Requisito a requisito")', timeout=30000)
            print('url limpia:', pg.url.split('/')[-1])
            print('encaje:', pg.text_content('.pro-ring b'), '| deltas:', [t.strip() for t in pg.locator('.pro-deltas .delta').all_text_contents()])
            print('requisitos:', pg.locator('#v-pro .checks li').count(), '| botón regenerar:', pg.text_content('#proAgain') if pg.locator('#proAgain').count() else None)
            if not fail_first:
                pg.screenshot(path=os.path.join(OUT, 'pro_resultado.png'), full_page=True)
                pg.fill('#pPer', 'Perfil editado a mano para la prueba.')
                with pg.expect_download() as d: pg.click('#proCvPdf')
                d.value.save_as(os.path.join(OUT, 'pro_cv.pdf')); print('pdf cv:', d.value.suggested_filename)
                with pg.expect_download() as d: pg.click('#proLetPdf')
                d.value.save_as(os.path.join(OUT, 'pro_carta.pdf')); print('pdf carta:', d.value.suggested_filename)
                with pg.expect_download() as d: pg.click('#proLetDocx')
                d.value.save_as(os.path.join(OUT, 'pro_carta.docx'))
                # recarga: el informe sigue en este navegador, con la edición
                pg.wait_for_timeout(800); pg.goto(B + 'analizador.html#pro'); pg.reload(); pg.wait_for_selector('#v-pro h3:text-is("Requisito a requisito")', timeout=15000)
                print('tras recargar conserva edición:', pg.input_value('#pPer')[:30])
                pg.click('#proAgain'); pg.wait_for_selector('#v-pro h3:text-is("Requisito a requisito")', timeout=30000); print('2ª generación ->', pg.text_content('#proAgain'))
                pg.click('#proAgain'); pg.wait_for_selector('#v-pro h3:text-is("Requisito a requisito")', timeout=30000); print('3ª generación -> botón regenerar:', pg.locator('#proAgain').count())
                sid = [s for s in mlog(port)['sessions']][0]['id']
                r = pg.request.post(B + 'api/generate', data=json.dumps({'session_id': sid, 'offer': OFFER, 'lang': 'es', 'cv': {'exp': []}}), headers={'content-type': 'application/json'})
                print('4ª por API:', r.status, r.json())
                r = pg.request.post(B + 'api/generate', data=json.dumps({'session_id': 'cs_test_noexiste1234567', 'offer': OFFER, 'lang': 'es', 'cv': {'exp': []}}), headers={'content-type': 'application/json'})
                print('pedido inexistente:', r.status, r.json())
                # pago cancelado
                pg.goto(B + 'analizador.html?pro=cancelado#pro'); pg.wait_for_selector('#proOffer'); print('cancelado → oferta conservada:', pg.input_value('#proOffer')[:25])
                for w in (760, 390):
                    pg.set_viewport_size({'width': w, 'height': 900}); pg.goto(B + 'analizador.html#pro'); pg.reload(); pg.wait_for_selector('#v-pro h3:text-is("Requisito a requisito")')
                    print(w, 'hscroll', pg.evaluate('()=>document.documentElement.scrollWidth>innerWidth'))
                    if w == 390: pg.screenshot(path=os.path.join(OUT, 'pro_movil.png'), full_page=True)
            lg = mlog(port)
            co = [x for x in lg['log'] if x.get('stripe') == 'POST /checkout/sessions'][0]
            print('checkout managed_payments:', co['body'].get('managed_payments[enabled]'), '| version:', co['version'], '| price:', co['body'].get('line_items[0][price_data][unit_amount]'), co['body'].get('line_items[0][price_data][tax_behavior]'))
            sent = [x for x in lg['log'] if 'ai' in x][-1]['sent']
            print('a la IA no van datos de contacto:', not any(k in sent for k in ['@', 'linkedin', '+34', 'Daniel Ortega']), '| modelo:', [x for x in lg['log'] if 'ai' in x][-1]['ai'], '| llamadas IA:', lg['aiCalls'], '| generaciones contadas:', lg['sessions'][0]['gen'])
            b.close()
    finally:
        srv.terminate()
print('== flujo normal'); run(8821)
print('== IA saturada en el primer intento'); run(8822, fail_first=True)
print('errors', errs)
