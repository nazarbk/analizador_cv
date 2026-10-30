#!/usr/bin/env python3
"""Genera los iconos PNG/ICO y la imagen para redes sociales a partir de src/assets/icon.svg.
Requiere Playwright para Python (con Chromium) y Pillow. Solo hace falta si cambias el icono."""
import os, io
from playwright.sync_api import sync_playwright
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, 'src', 'assets')
svg = open(os.path.join(A, 'icon.svg'), encoding='utf-8').read()
OG = """<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}body{width:1200px;height:630px;background:#FFFFFF;font-family:"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:#1F2430;position:relative;overflow:hidden}
.band{position:absolute;inset:0 0 auto 0;height:10px;background:#0F7A74}
.wrap{position:absolute;left:84px;top:96px;width:640px}
.brand{display:flex;align-items:center;gap:18px;font:600 30px Georgia,"Times New Roman",serif}.brand svg{width:64px;height:64px}
h1{font:600 60px/1.08 Georgia,"Times New Roman",serif;margin-top:40px;letter-spacing:-.5px}
p{font-size:26px;line-height:1.4;color:#4A5160;margin-top:24px}
.tags{display:flex;gap:12px;margin-top:34px}.tags span{font-size:20px;padding:8px 16px;border-radius:999px;background:#E4F3F1;color:#0B5F5A;font-weight:600}.tags span.l{background:#F2EFFB;color:#4E3F96}
.card{position:absolute;right:70px;top:110px;width:360px;background:#F9F9FC;border:1px solid #E3E3EC;border-radius:16px;padding:30px 30px 26px;box-shadow:0 12px 40px rgba(31,36,48,.08)}
.k{font:600 14px sans-serif;letter-spacing:1.5px;color:#6A7080;text-transform:uppercase}.score{font:600 84px Georgia,serif;color:#0F7A74;margin-top:6px}.score small{font-size:30px;color:#6A7080}
.row{margin-top:16px}.row b{display:flex;justify-content:space-between;font-size:17px;font-weight:500;color:#4A5160}.bar{height:8px;border-radius:8px;background:#EEEEF4;margin-top:7px}.bar i{display:block;height:100%;border-radius:8px;background:#2E7A4C}.bar i.m{background:#8A4D85}
</style></head><body><div class="band"></div><div class="wrap"><div class="brand">ICON<span>Analizador de CV</span></div>
<h1>Descubre cómo leen tu CV los filtros ATS</h1><p>Puntos fuertes y débiles, coincidencia con ofertas y un CV listo para enviar. Gratis y sin que tu CV salga del navegador.</p>
<div class="tags"><span>Gratis</span><span>Sin registro</span><span class="l">100 % privado</span></div></div>
<div class="card"><div class="k">Puntuación global</div><div class="score">87<small>/100</small></div>
<div class="row"><b><span>ATS e IA</span><span>92</span></b><div class="bar"><i style="width:92%"></i></div></div>
<div class="row"><b><span>Contenido</span><span>74</span></b><div class="bar"><i class="m" style="width:74%"></i></div></div>
<div class="row"><b><span>Estructura</span><span>95</span></b><div class="bar"><i style="width:95%"></i></div></div>
<div class="row"><b><span>Formato y país</span><span>100</span></b><div class="bar"><i style="width:100%"></i></div></div></div></body></html>""".replace('ICON', svg)
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 512, 'height': 512})
    pg.set_content('<html><body style="margin:0;background:transparent">' + svg.replace('<svg ', '<svg width="512" height="512" ') + '</body></html>')
    big = Image.open(io.BytesIO(pg.screenshot(omit_background=True, clip={'x': 0, 'y': 0, 'width': 512, 'height': 512})))
    for n in (512, 192, 180, 48, 32, 16):
        im = big.resize((n, n), Image.LANCZOS)
        name = {180: 'apple-touch-icon.png'}.get(n, 'icon-%d.png' % n)
        if n == 180:   # iOS no admite transparencia: fondo del color del icono
            bg = Image.new('RGBA', (n, n), (15, 122, 116, 255)); bg.alpha_composite(im); im = bg.convert('RGB')
        im.save(os.path.join(A, name))
    big.save(os.path.join(A, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])
    pg2 = b.new_page(viewport={'width': 1200, 'height': 630})
    pg2.set_content(OG); pg2.screenshot(path=os.path.join(A, 'og-image.png'))
    b.close()
print('iconos generados en', A)
