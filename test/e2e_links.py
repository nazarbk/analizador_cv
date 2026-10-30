import subprocess,sys,time,zipfile,re
from playwright.sync_api import sync_playwright
import os, tempfile
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
NM=next((p for p in [os.path.join(ROOT,'node_modules'), os.environ.get('CV_NODE_MODULES',''), '/opt/npm-tools/node_modules'] if p and os.path.isdir(os.path.join(p,'pdfjs-dist'))), os.path.join(ROOT,'node_modules'))
OUT=os.environ.get('CV_TEST_OUT', tempfile.gettempdir())
srv=subprocess.Popen([sys.executable,'-m','http.server','8801','--bind','127.0.0.1'],cwd=os.path.join(ROOT,'dist'),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1366,'height':900}, accept_downloads=True); pg=ctx.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8801/selfhost/index.html'); pg.wait_for_selector('.scorecard .big')
    pg.click('#tabs a[data-view=datos]')
    n0=[pg.locator('#v-datos .entry').count(), pg.locator('#v-datos .proj').count()]
    for k in ['exp','edu','langs','projects']: pg.click(f'[data-add="{k}"]')
    n1=[pg.locator('#v-datos .entry').count(), pg.locator('#v-datos .proj').count()]
    pg.locator('[data-del^="langs:"]').last.click()
    pg.locator('[data-move^="exp:1:-1"]').first.click()
    print('entries before/after add:', n0, n1, '| after del lang:', pg.locator('#v-datos .entry').count())
    i=pg.locator('#v-datos .proj').count()-1
    pg.fill(f'[data-path="projects.{i}.name"]','Q State Prep'); pg.fill(f'[data-path="projects.{i}.url"]','github.com/nazarbk/q-state-prep')
    pg.fill(f'[data-path="projects.{i}.desc"]','Linea uno del proyecto.'); pg.wait_for_timeout(400)
    pg.click('#tabs a[data-view=plantilla]'); pg.wait_for_timeout(200)
    hrefs=pg.evaluate("()=>[...document.querySelectorAll('#cvPreview a')].map(a=>a.getAttribute('href'))")
    print('preview links:', hrefs)
    with pg.expect_download() as d: pg.click('#tplPdf')
    d.value.save_as(os.path.join(OUT,'links.pdf'))
    with pg.expect_download() as d: pg.click('#tplDocx')
    d.value.save_as(os.path.join(OUT,'links.docx'))
    print('errors', errs); b.close()
srv.terminate()
from pypdf import PdfReader
r=PdfReader(os.path.join(OUT,'links.pdf')); uris=[a.get_object()['/A']['/URI'] for pgx in r.pages for a in (pgx.get('/Annots') or [])]
print('pdf link annots:', uris)
z=zipfile.ZipFile(os.path.join(OUT,'links.docx')); rels=z.read('word/_rels/document.xml.rels').decode(); doc=z.read('word/document.xml').decode()
print('docx hyperlinks:', re.findall(r'Target="([^"]+)" TargetMode', rels), '| w:hyperlink count:', doc.count('<w:hyperlink'))
from docx import Document; Document(os.path.join(OUT,'links.docx')); print('docx opens ok')
