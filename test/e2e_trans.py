# Versión en inglés: crear, ver pendientes, exportar/pegar traducción, plantilla y descarga
import subprocess,sys,time,re
from playwright.sync_api import sync_playwright
import os, tempfile
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
NM=next((p for p in [os.path.join(ROOT,'node_modules'), os.environ.get('CV_NODE_MODULES',''), '/opt/npm-tools/node_modules'] if p and os.path.isdir(os.path.join(p,'pdfjs-dist'))), os.path.join(ROOT,'node_modules'))
OUT=os.environ.get('CV_TEST_OUT', tempfile.gettempdir())
CV=sys.argv[1] if len(sys.argv)>1 else None
OUT=sys.argv[2] if len(sys.argv)>2 else OUT
srv=subprocess.Popen([sys.executable,'-m','http.server','8802','--bind','127.0.0.1'],cwd=os.path.join(ROOT,'dist'),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1366,'height':900}, accept_downloads=True); pg=ctx.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    ctx.grant_permissions(['clipboard-read','clipboard-write'])
    pg.goto('http://127.0.0.1:8802/selfhost/analizador.html'); pg.wait_for_selector('.scorecard .big')
    if CV:
        pg.set_input_files('#file', CV); pg.wait_for_selector('#status:has-text("analizado")', timeout=60000)
    pg.click('#tabs a[data-view=datos]')
    pg.click('#v-datos [data-dv="en"]')
    cnt=pg.text_content('#trCount'); print('pending:', cnt, '| marked fields:', pg.locator('#v-datos .cf.pending').count())
    pg.screenshot(path=OUT+'/trans_datos.png', full_page=False)
    langs=pg.evaluate("()=>[...document.querySelectorAll('[data-path^=\"langs.\"]')].map(i=>i.value)"); print('langs:', langs)
    edu=pg.evaluate("()=>[...document.querySelectorAll('[data-path$=\".degree\"]')].map(i=>i.value)"); print('edu:', edu)
    pg.click('#trCopy'); txt=pg.evaluate('()=>navigator.clipboard.readText()')
    tags=re.findall(r'^\[@([^\]]+)\]$', txt, re.M); print('exported tags:', len(tags), tags[:6])
    # simula la respuesta de un traductor: cada bloque sustituido por texto en inglés
    fake='\n\n'.join('[@'+t+']\nTranslated text for this field.' for t in tags)
    half=re.sub(r'(\[@[^\]]+\]\n)(.+)', lambda m: m.group(1)+'EN '+m.group(2), txt)
    pg.click('#trPaste summary'); pg.fill('#trText', half); pg.click('#trApply'); pg.wait_for_timeout(300)
    print('after pasting untranslated text (should stay pending):', pg.text_content('#trCount'))
    pg.click('#trPaste summary'); pg.fill('#trText', fake); pg.click('#trApply'); pg.wait_for_timeout(300)
    print('after pasting translation:', pg.text_content('#trCount'))
    # edición de un dato compartido en la versión inglesa se refleja en la original
    pg.fill('[data-path="phone"]', '+34 600 000 001')
    pg.click('#v-datos [data-dv="orig"]'); print('orig phone synced:', pg.input_value('[data-path="phone"]'))
    pg.click('#v-datos [data-add="langs"]'); pg.click('#v-datos [data-dv="en"]')
    print('lang entries en after add in orig:', pg.locator('#v-datos [data-path$=".level"]').count())
    pg.locator('#v-datos [data-del^="langs:"]').last.click()
    pg.click('#trUse'); pg.wait_for_timeout(400)
    print('tplLang:', pg.input_value('#tplLang'), '| note:', pg.text_content('#langNote')[:90], '|', pg.text_content('#tplScore'))
    prev=pg.text_content('#cvPreview'); print('preview has EN headings:', 'Professional Experience' in prev or 'Experience' in prev, '| EN text:', prev.count('Translated text'))
    with pg.expect_download() as d: pg.click('#tplPdf')
    print('download name:', d.value.suggested_filename); d.value.save_as(OUT+'/trans.pdf')
    pg.select_option('#tplLang','es'); pg.wait_for_timeout(300); print('es preview EN text count:', pg.text_content('#cvPreview').count('Translated text'))
    for w in [760,390]:
        pg.set_viewport_size({'width':w,'height':900}); pg.click('#tabs a[data-view=datos]') if w>800 else pg.goto(pg.url.split('#')[0]+'#datos')
        pg.wait_for_timeout(300)
        print(w,'hscroll', pg.evaluate('()=>document.documentElement.scrollWidth>innerWidth'))
    print('errors', errs); b.close()
srv.terminate()
