import os
import sys, subprocess, time, json
from playwright.sync_api import sync_playwright
srv=subprocess.Popen([sys.executable,'-m','http.server','8767','--bind','127.0.0.1'],cwd=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),'dist'),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page()
    pg.goto('http://127.0.0.1:8767/selfhost/index.html'); pg.wait_for_selector('.scorecard .big')
    pg.select_option('#country', sys.argv[2] if len(sys.argv)>2 else 'ES')
    pg.set_input_files('#file', 'test/files/'+sys.argv[1]); pg.wait_for_timeout(2500)
    print(pg.evaluate("()=>[document.querySelector('.scorecard .big').firstChild.textContent, document.querySelector('#v-formato .kv').innerText.replace(/\\n/g,' '), [...document.querySelectorAll('.check.s-bad strong,.check.s-warn strong')].map(e=>e.textContent).join(' | '), [...document.querySelectorAll('#v-experiencia .job h4, #v-experiencia .job .meta')].map(e=>e.textContent).join(' / ')]"))
    b.close()
srv.terminate()
