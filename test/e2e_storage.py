# La web con el almacenamiento del navegador bloqueado (modo privado, permisos, IndexedDB que no responde):
# portada, subida, guardado opcional, compra con retorno de Stripe, informes y descargas.
# Usa el servidor simulado del Informe Pro (test/pro_server.mjs).
import os, sys, subprocess, json, urllib.request
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
CV1 = os.path.join(HERE, 'files', 'Daniel-Ortega-CV.pdf')
OFFER = """Backend Developer (Python) — Acme Data, Madrid (híbrido)
Buscamos una persona para diseñar y mantener APIs en Python y servicios en AWS.
Requisitos: 3 años de experiencia con Python, AWS, SQL y Docker. Valorable Kubernetes y Terraform.
Inglés B2. Trabajo en equipo ágil, revisiones de código y pruebas automatizadas."""
REPORT = '#v-pro h3:text-is("Requisito a requisito")'
MODES = {
  # IndexedDB lanza al abrir y localStorage lanza (como algunos navegadores con el almacenamiento bloqueado)
  'bloqueado': """(()=>{const no=()=>{throw new DOMException('bloqueado','SecurityError')};
     Object.defineProperty(window,'indexedDB',{get(){return {open:no}}});
     Storage.prototype.getItem=no;Storage.prototype.setItem=no;Storage.prototype.removeItem=no;})()""",
  # IndexedDB abre pero da error (Firefox en modo privado antiguo)
  'error': """(()=>{Object.defineProperty(window,'indexedDB',{get(){return {open(){const r={};setTimeout(()=>{r.error=new DOMException('InvalidStateError');r.onerror&&r.onerror()},10);return r}}}});})()""",
  # IndexedDB no responde nunca (fallo conocido de Safari)
  'colgado': """(()=>{Object.defineProperty(window,'indexedDB',{get(){return {open(){return {}}}}});})()""",
}
errs = []
def check(label, cond): print(('OK   ' if cond else 'FALLO') + ' ' + label); (None if cond else errs.append(label))
def mlog(port): return json.loads(urllib.request.urlopen(f'http://127.0.0.1:{port}/__log').read())
srv = subprocess.Popen(['node', os.path.join(HERE, 'pro_server.mjs'), '8860'], cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL); srv.stdout.readline()
B = 'http://127.0.0.1:8860/'
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        for mode, js in MODES.items():
            print('== almacenamiento', mode)
            ctx = b.new_context(viewport={'width': 1300, 'height': 900}, accept_downloads=True); ctx.add_init_script(js)
            pg = ctx.new_page(); perr = []; pg.on('pageerror', lambda e: perr.append(str(e)))
            # portada: subir el CV
            pg.goto(B + 'index.html'); pg.set_input_files('#cvFile', CV1)
            pg.wait_for_selector('#cvStatus.err, #cvStatus:has-text("Abriendo")', timeout=10000)
            pg.wait_for_function("()=>/analizador/.test(location.href) || document.querySelector('#cvStatus.err')", timeout=8000)
            check(mode + ': portada → aviso claro y enlace al analizador', 'analizador' in pg.url or (pg.locator('#cvStatus a').count() == 1 and 'modo privado' in pg.text_content('#cvStatus')))
            # analizador: subir y analizar
            pg.goto(B + 'analizador.html'); pg.wait_for_selector('#tabs a[data-view=pro]:not([hidden])', timeout=15000)
            pg.set_input_files('#file', CV1); pg.wait_for_selector('#status:has-text("analizado")', timeout=60000); pg.wait_for_timeout(1200)
            check(mode + ': el análisis funciona', 'Daniel-Ortega-CV.pdf' in pg.text_content('#docName'))
            # guardado opcional
            pg.click('#saveBox summary') if pg.locator('#saveBox summary').count() else pg.click('summary:has-text("Guardar mi trabajo")')
            pg.check('#saveLocal') if mode != 'bloqueado' else pg.click('#saveLocal')
            pg.wait_for_timeout(1000)
            if mode == 'bloqueado':
                check(mode + ': «Guardar mi trabajo» explica que no se puede guardar', not pg.is_checked('#saveLocal') and 'no deja guardar' in pg.text_content('#saveStatus'))
            else:
                check(mode + ': «Guardar mi trabajo» funciona (localStorage sí)', 'Guardado' in pg.text_content('#saveStatus'))
            # compra: aviso previo, pago, vuelta de Stripe
            pg.click('#tabs a[data-view=pro]'); pg.wait_for_selector('#proOffer', timeout=10000)
            check(mode + ': el formulario avisa de que no se guardará', pg.locator('.notice-storage').count() == 1)
            pg.fill('#proOffer', OFFER); pg.check('#proC1'); pg.check('#proC2'); pg.click('#proPay')
            pg.wait_for_url('**/analizador.html#pro', timeout=20000); pg.wait_for_selector('.pro-wallet', timeout=20000)
            check(mode + ': al volver del pago la compra aparece (quedan 3)', 'quedan 3' in pg.text_content('.pro-wallet'))
            check(mode + ': y está el enlace de la compra', pg.locator('#v-pro button:has-text("enlace")').count() >= 1)
            # vuelve a subir el CV y genera con la compra
            pg.set_input_files('#file', CV1); pg.wait_for_selector('#status:has-text("analizado")', timeout=60000); pg.wait_for_timeout(1000)
            pg.click('#tabs a[data-view=pro]'); pg.wait_for_selector('#proUse', timeout=10000)
            pg.fill('#proOffer', OFFER); pg.check('#proC1'); pg.click('#proUse'); pg.wait_for_selector(REPORT, timeout=40000)
            check(mode + ': genera el informe y descuenta (quedan 2)', 'quedan 2' in pg.text_content('#proNew'))
            with pg.expect_download() as d: pg.click('#proCvPdf')
            check(mode + ': descarga el CV adaptado', d.value.suggested_filename.endswith('.pdf'))
            check(mode + ': sin errores de JavaScript', not perr)
            if perr: print(perr[:3])
            ctx.close()
        b.close()
finally: srv.terminate()
print('errors', errs)
