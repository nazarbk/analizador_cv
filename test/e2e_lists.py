import subprocess,sys,time
from playwright.sync_api import sync_playwright
import os, tempfile
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
NM=next((p for p in [os.path.join(ROOT,'node_modules'), os.environ.get('CV_NODE_MODULES',''), '/opt/npm-tools/node_modules'] if p and os.path.isdir(os.path.join(p,'pdfjs-dist'))), os.path.join(ROOT,'node_modules'))
OUT=os.environ.get('CV_TEST_OUT', tempfile.gettempdir())
srv=subprocess.Popen([sys.executable,'-m','http.server','8800','--bind','127.0.0.1'],cwd=os.path.join(ROOT,'dist'),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1366,'height':900}); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8800/selfhost/index.html'); pg.wait_for_selector('.scorecard .big')
    pg.click('#tabs a[data-view=datos]')
    cnt=lambda k: pg.evaluate(f"()=>document.querySelectorAll('[data-path^=\"{k}.\"][data-path$=\".{ {'exp':'title','edu':'degree','langs':'name','projects':'name'}[k] }\"]').length")
    for k in ['exp','edu','langs','projects']: print(k,'inicial',cnt(k), end=' | ')
    print()
    pg.click('[data-add=exp]'); pg.fill('[data-path="exp.4.title"]','Puesto nuevo'); print('exp tras añadir', cnt('exp'))
    pg.click('[data-del="exp:0"]'); print('exp tras quitar', cnt('exp'))
    first=pg.input_value('[data-path="exp.0.title"]'); pg.click('[data-move="exp:0:1"]'); print('mover:', first, '->', pg.input_value('[data-path="exp.1.title"]'))
    pg.click('[data-add=langs]'); pg.fill('[data-path="langs.3.name"]','Alemán'); pg.fill('[data-path="langs.3.level"]','A2'); print('langs', cnt('langs'))
    pg.click('[data-add=edu]'); print('edu', cnt('edu')); pg.click('[data-del="edu:2"]')
    pg.click('[data-add=projects]'); pg.fill('[data-path="projects.1.name"]','Proyecto (beta)'); pg.fill('[data-path="projects.1.desc"]','Una sola línea de descripción.'); pg.fill('[data-path="projects.1.tools"]','Python')
    pg.wait_for_timeout(400); pg.click('#tabs a[data-view=plantilla]')
    t=pg.inner_text('#cvPreview'); print('preview: Puesto nuevo', 'Puesto nuevo' in t, '| Alemán', 'Alemán' in t, '| Proyecto (beta)', 'Proyecto (beta)' in t)
    print('bullets in projects consistent:', pg.evaluate("()=>{const h=[...document.querySelectorAll('#cvPreview h2')].find(x=>/proyectos/i.test(x.textContent));let n=h.nextElementSibling,c=0,p=0;while(n&&n.tagName!=='H2'){if(n.tagName==='UL')c++;if(n.tagName==='P'&&!n.classList.contains('tools'))p++;n=n.nextElementSibling}return [c,p]}"))
    pg.locator('#cvPreview').screenshot(path=os.path.join(OUT,'prev_proj.png'))
    print('errors', errs); b.close()
srv.terminate()
