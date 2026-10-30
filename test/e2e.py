import subprocess, time, sys, os, json
from playwright.sync_api import sync_playwright
import os, tempfile
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
NM=next((p for p in [os.path.join(ROOT,'node_modules'), os.environ.get('CV_NODE_MODULES',''), '/opt/npm-tools/node_modules'] if p and os.path.isdir(os.path.join(p,'pdfjs-dist'))), os.path.join(ROOT,'node_modules'))
OUT=os.environ.get('CV_TEST_OUT', tempfile.gettempdir())
F=ROOT+'/test/files/'
VP=NM+'/pdfjs-dist/legacy/build/'; VZ=NM+'/jszip/dist/jszip.min.js'
srv=subprocess.Popen([sys.executable,'-m','http.server','8765','--bind','127.0.0.1'],cwd=ROOT+'/dist',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
def route_cdn(route):
    u=route.request.url
    if 'pdfjs-dist@6.2.108/legacy/build/' in u: path=VP+u.split('/')[-1]
    elif 'jszip/3.10.1/jszip.min.js' in u: path=VZ
    else: return route.abort()
    route.fulfill(status=200, body=open(path,'rb').read(), headers={'content-type':'text/javascript','access-control-allow-origin':'*'})
def summary(page):
    return page.evaluate("""() => ({total: document.querySelector('.scorecard .big').firstChild.textContent, status: document.querySelector('#status').textContent,
      bad: [...document.querySelectorAll('#v-ats .check.s-bad strong, #v-formato .check.s-bad strong')].map(e=>e.textContent),
      warn: [...document.querySelectorAll('#v-ats .check.s-warn strong')].map(e=>e.textContent),
      facts: [...document.querySelectorAll('.fact')].map(f=>f.innerText.replace('\\n',': ')).join(' | '),
      exp: [...document.querySelectorAll('#v-experiencia .job h4')].map(e=>e.textContent),
      kv: document.querySelector('#v-formato .kv') && document.querySelector('#v-formato .kv').innerText.replace(/\\n/g,' ')})""")
results={}
with sync_playwright() as p:
    b=p.chromium.launch()
    for build,url in [('selfhost','http://127.0.0.1:8765/selfhost/analizador.html'),('artifact','http://127.0.0.1:8765/artifact/analizador-cv.html')]:
        ctx=b.new_context(viewport={'width':1300,'height':900}); page=ctx.new_page()
        errs=[]; page.on('console', lambda m: m.type=='error' and errs.append(m.text)); page.on('pageerror', lambda e: errs.append(str(e)))
        if build=='artifact':
            page.route('https://cdn.jsdelivr.net/**', route_cdn); page.route('https://cdnjs.cloudflare.com/**', route_cdn)
        page.goto(url); page.wait_for_selector('.scorecard .big')
        print('\n=====',build,'sample:',summary(page)['total'], summary(page)['facts'])
        for fn in ['Daniel-Ortega-CV.pdf','curriculum.pdf','scan.pdf','Lucia-Martin-CV.docx']:
            page.set_input_files('#file', F+fn)
            page.wait_for_function("() => /analizado|leído|No se|protegido|supera|Formato|no se pueden/.test(document.querySelector('#status').textContent)", timeout=30000)
            s=summary(page); print('--',fn, json.dumps(s, ensure_ascii=False)[:1400])
        page.select_option('#country','US'); page.evaluate("document.querySelectorAll('details.fold').forEach(d=>d.open=true)"); page.fill('#offer', open('test/offer_mkt.txt').read()); page.click('#analyze')
        print('-- US + offer total', summary(page)['total'])
        print('ERRORS', errs)
        if build=='selfhost':
            page.set_input_files('#file', F+'curriculum.pdf'); page.wait_for_timeout(1500)
            page.select_option('#country','ES')
            for v in ['resumen','ats','experiencia','formato','datos','plantilla']:
                page.click(f'#tabs a[data-view={v}]'); page.screenshot(path=os.path.join(OUT,f'shot_{v}.png'), full_page=True)
            # descarga DOCX
            with page.expect_download() as d: page.click('#tplDocx')
            d.value.save_as(os.path.join(OUT,'out.docx')); print('docx saved', d.value.suggested_filename)
        ctx.close()
    b.close()
srv.terminate()
