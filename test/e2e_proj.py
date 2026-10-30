import subprocess,sys,time
from playwright.sync_api import sync_playwright
import os, tempfile
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
NM=next((p for p in [os.path.join(ROOT,'node_modules'), os.environ.get('CV_NODE_MODULES',''), '/opt/npm-tools/node_modules'] if p and os.path.isdir(os.path.join(p,'pdfjs-dist'))), os.path.join(ROOT,'node_modules'))
OUT=os.environ.get('CV_TEST_OUT', tempfile.gettempdir())
srv=subprocess.Popen([sys.executable,'-m','http.server','8771','--bind','127.0.0.1'],cwd=os.path.join(ROOT,'dist'),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1300,'height':900}); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8771/selfhost/index.html'); pg.wait_for_selector('.scorecard .big')
    pg.click('#tabs a[data-view=datos]')
    print('projects at load:', pg.locator('.proj').count())
    pg.click('#v-datos [data-add="projects"]')
    i=pg.locator('.proj').count()-1
    pg.fill(f'[data-path="projects.{i}.url"]','github.com/usuario/panel-campanas')
    print('hint:', pg.locator(f'[data-hint="projects.{i}.url"]').inner_text())
    pg.focus(f'[data-path="projects.{i}.name"]'); print('auto name:', pg.input_value(f'[data-path="projects.{i}.name"]'))
    pg.fill(f'[data-path="projects.{i}.desc"]','Panel en Looker Studio que unifica Google Ads y Meta Ads; ahorra 6 h semanales de reporting.')
    pg.locator(f'[data-addtool="{i}"]').first.click(); pg.locator(f'[data-addtool="{i}"]').first.click()
    print('tools:', pg.input_value(f'[data-path="projects.{i}.tools"]'))
    pg.fill(f'[data-path="projects.{i}.url"]','localhost:3000'); print('bad hint:', pg.locator(f'[data-hint="projects.{i}.url"]').get_attribute('class'))
    pg.fill(f'[data-path="projects.{i}.url"]','https://github.com/usuario/panel-campanas')
    pg.wait_for_timeout(400)
    pg.click('#tabs a[data-view=plantilla]')
    print('preview has project:', 'panel-campanas' in pg.inner_text('#cvPreview'), '| Proyectos heading:', 'PROYECTOS' in pg.inner_text('#cvPreview').upper())
    pg.click('#tabs a[data-view=datos]'); pg.locator('.proj').nth(i).screenshot(path=os.path.join(OUT,'proj.png'))
    pg.click('#tabs a[data-view=cambios]'); pg.screenshot(path=os.path.join(OUT,'cambios.png'), full_page=True)
    pg.click('#tabs a[data-view=resumen]'); pg.screenshot(path=os.path.join(OUT,'resumen.png'))
    # narrow widths: check no pill overlaps text in any check list
    for w in [1300, 760, 390]:
        pg.set_viewport_size({'width':w,'height':900})
        bad=pg.evaluate("""()=>{let n=0;for(const v of ['resumen','ats','experiencia','formato','cambios']){document.querySelector('#v-'+v).hidden=false;}
          document.querySelectorAll('.check').forEach(li=>{const p=li.querySelector('.pill'),d=li.querySelector(':scope > div');if(!p||!d)return;const a=p.getBoundingClientRect(),c=d.getBoundingClientRect();
          if(a.width&&c.width&&a.right>c.left+1&&a.bottom>c.top+1&&a.top<c.bottom-1)n++;});return [n, document.documentElement.scrollWidth>document.documentElement.clientWidth];}""")
        print('width',w,'overlaps, hscroll:',bad)
    print('errors',errs); b.close()
srv.terminate()
