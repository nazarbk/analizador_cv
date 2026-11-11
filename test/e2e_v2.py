import subprocess, sys, time, os
from playwright.sync_api import sync_playwright
import os, tempfile
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
NM=next((p for p in [os.path.join(ROOT,'node_modules'), os.environ.get('CV_NODE_MODULES',''), '/opt/npm-tools/node_modules'] if p and os.path.isdir(os.path.join(p,'pdfjs-dist'))), os.path.join(ROOT,'node_modules'))
OUT=os.environ.get('CV_TEST_OUT', tempfile.gettempdir())
F='test/files/'
VP=NM+'/pdfjs-dist/legacy/build/'; VZ=NM+'/jszip/dist/jszip.min.js'; VL=NM+'/pdf-lib/dist/pdf-lib.min.js'
srv=subprocess.Popen([sys.executable,'-m','http.server','8781','--bind','127.0.0.1'],cwd=os.path.join(ROOT,'dist'),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
def route_cdn(route):
    u=route.request.url
    path = VP+u.split('/')[-1] if 'pdfjs-dist@' in u else VZ if 'jszip' in u else VL if 'pdf-lib' in u else None
    if not path: return route.abort()
    route.fulfill(status=200, body=open(path,'rb').read(), headers={'content-type':'text/javascript','access-control-allow-origin':'*'})
offers=[open('test/offer_mkt.txt').read(),
 'Especialista SEO/SEM\nBuscamos especialista con experiencia en SEO, Google Ads, Google Analytics 4 y Looker Studio. Valorable HubSpot y SQL. Inglés B2. 3 años de experiencia. Gestión de campañas de SEO y SEM.',
 'Growth Marketer\nCampañas de Meta Ads y Google Ads, CRO, tests A/B y SQL para análisis. Looker Studio. Email marketing con HubSpot. Growth y SEO técnico para ecommerce.']
def wait_status(pg): pg.wait_for_function("() => /analizado|leído|recuperado/.test(document.querySelector('#status').textContent)", timeout=30000)
with sync_playwright() as p:
    b=p.chromium.launch()
    for build,url in [('selfhost','http://127.0.0.1:8781/selfhost/analizador.html'),('artifact','http://127.0.0.1:8781/artifact/analizador-cv.html')]:
        ctx=b.new_context(viewport={'width':1300,'height':900}, accept_downloads=True); ctx.route('**/api/**', lambda r: r.fulfill(status=200, content_type='application/json', body='{"disponible":false}'))  # sin servidor de pagos: el Informe Pro se oculta
        pg=ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type=='error' and errs.append(m.text))
        if build=='artifact': pg.route('https://cdn.jsdelivr.net/**', route_cdn); pg.route('https://cdnjs.cloudflare.com/**', route_cdn)
        pg.goto(url); pg.wait_for_selector('.scorecard .big')
        print('\n=====', build)
        # 2) varias ofertas
        pg.evaluate("document.querySelectorAll('details.fold').forEach(d=>d.open=true)"); pg.fill('#offer', offers[0]); pg.click('#addOffer'); pg.locator('#moreOffers textarea').nth(0).fill(offers[1]); pg.click('#addOffer'); pg.locator('#moreOffers textarea').nth(1).fill(offers[2])
        pg.click('#analyze'); pg.wait_for_timeout(300)
        print('offers tab visible:', pg.is_visible('#v-ofertas'), '| cards:', pg.locator('.ocard').count(), '| matrix rows:', pg.locator('table.matrix tbody tr').count())
        print('callout:', pg.inner_text('#v-ofertas .callout')[:160])
        first_before=pg.input_value('#offer')[:25]; pg.locator('[data-primary]').first.click(); print('primary swapped:', first_before, '->', pg.input_value('#offer')[:25])
        # 3) coherencia visible
        pg.click('#tabs a[data-view=formato]'); print('coherence sheet:', 'Coherencia' in pg.inner_text('#v-formato'))
        # 4) guardado
        if build=='selfhost':
            pg.evaluate("document.querySelectorAll('details.fold').forEach(d=>d.open=true)"); pg.check('#saveLocal')
        # 1) versiones
        pg.set_input_files('#file', F+'Lucia-Martin-CV.docx'); wait_status(pg)
        pg.set_input_files('#file', F+'curriculum.pdf'); pg.wait_for_function("()=>/curriculum.pdf» analizado/.test(document.querySelector('#status').textContent)", timeout=30000)
        pg.click('#tabs a[data-view=versiones]')
        print('versions:', pg.inner_text('#tabs a[data-view=versiones]'), '|', ' / '.join(x.inner_text() for x in pg.locator('#v-versiones .cols3 h3').all()))
        print('score rows:', pg.locator('table.cmp').first.locator('tbody tr').count(), '|', pg.locator('table.cmp tr.tot').inner_text().replace('\t',' '))
        if build=='selfhost':
            pg.wait_for_timeout(1200); print('save status:', pg.inner_text('#saveStatus'))
            pg.reload(); pg.wait_for_selector('.scorecard .big')
            print('restore banner visible:', pg.is_visible('#restoreBanner'))
            pg.click('#restoreBtn'); pg.wait_for_timeout(500)
            print('restored status:', pg.inner_text('#status'), '| versions tab:', pg.inner_text('#tabs a[data-view=versiones]'), '| offers:', pg.locator('#moreOffers textarea').count()+1)
            # 5) PDF
            pg.click('#tabs a[data-view=plantilla]')
            with pg.expect_download() as d: pg.click('#tplPdf')
            d.value.save_as(os.path.join(OUT,'gen.pdf')); print('pdf downloaded:', d.value.suggested_filename, os.path.getsize(os.path.join(OUT,'gen.pdf')), 'bytes')
            # reanalizar el PDF generado con la propia herramienta
            pg.set_input_files('#file', os.path.join(OUT,'gen.pdf')); pg.wait_for_function("()=>/gen.pdf» analizado/.test(document.querySelector('#status').textContent)", timeout=30000)
            pg.click('#tabs a[data-view=formato]')
            print('generated PDF re-analyzed: score', pg.locator('.scorecard .big').inner_text().split('/')[0], '| kv:', pg.inner_text('#v-formato .kv').replace('\n',' ')[:260])
            print('ats bad:', [x.inner_text() for x in pg.locator('#v-ats .check.s-bad strong').all()])
            pg.evaluate("document.querySelectorAll('details.fold').forEach(d=>d.open=true)"); pg.click('#clearLocal'); print('cleared storage:', pg.evaluate("()=>localStorage.getItem('cva:draft')"))
        else:
            ok=pg.evaluate("""async()=>{const L=await window.CV_LIBS.pdflib(); const blob=await window.CVTemplate.toPdf(window.CVTemplate.blocks({name:'Prueba',exp:[],edu:[],projects:[]},{style:'cronologico',lang:'es'}),{style:'cronologico',lang:'es',paper:'A4'},L); return blob.size}""")
            print('artifact pdf-lib via CDN loader, bytes:', ok)
        print('ERRORS', errs)
        ctx.close()
    b.close()
srv.terminate()
