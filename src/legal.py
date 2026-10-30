# Textos legales de la versión autoalojada (proyecto personal sin actividad económica, alojado en Netlify).
# Si el sitio pasa a tener actividad económica (anuncios, afiliación, servicios de pago), añade NIF y domicilio al aviso legal (art. 10 LSSI-CE).
PAGES = {
"aviso-legal.html": ("Aviso legal", """
<h2>Titular</h2>
<ul>
<li>Titular: Nazar Blanco Kataran</li>
<li>Email de contacto: <a href="mailto:nazarblanco@gmail.com">nazarblanco@gmail.com</a></li>
</ul>
<p>El Analizador de CV es un proyecto personal, gratuito y sin actividad económica: no tiene publicidad, enlaces de afiliado ni servicios de pago.</p>
<h2>Objeto</h2>
<p>Este sitio ofrece una herramienta gratuita que permite a cada persona analizar su propio currículum en su navegador y obtener recomendaciones orientativas de mejora.</p>
<h2>Responsabilidad</h2>
<p>Los resultados se generan automáticamente mediante reglas y tienen carácter orientativo. No constituyen asesoramiento profesional ni garantizan resultados en ningún proceso de selección. El titular no se responsabiliza de las decisiones que se tomen a partir de ellos.</p>
<h2>Propiedad intelectual</h2>
<p>El diseño y el código propio del sitio pertenecen al titular. Las librerías de terceros se usan conforme a sus licencias: pdf.js (Apache License 2.0, Mozilla Foundation), JSZip (licencia MIT) y pdf-lib (licencia MIT). El código fuente propio se publica con licencia MIT.</p>
<h2>Legislación aplicable</h2>
<p>Este aviso se rige por la legislación española. Para cualquier controversia serán competentes los juzgados y tribunales que correspondan conforme a la normativa de consumidores y usuarios.</p>
"""),
"privacidad.html": ("Política de privacidad", """
<h2>Resumen</h2>
<p><strong>Tu CV no se envía a ningún servidor.</strong> El archivo se lee y se analiza dentro de tu navegador y desaparece al cerrar o recargar la página. No usamos cookies, analítica ni publicidad.</p>
<h2>Responsable</h2>
<p>Nazar Blanco Kataran. Contacto: <a href="mailto:nazarblanco@gmail.com">nazarblanco@gmail.com</a>.</p>
<h2>Qué datos tratamos</h2>
<ul>
<li><strong>Contenido del CV:</strong> no lo recibimos ni lo almacenamos. Todo el procesamiento ocurre en tu dispositivo.</li>
<li><strong>Datos técnicos de conexión:</strong> como cualquier sitio web, el servicio de alojamiento (Netlify, Inc., 101 2nd Street, San Francisco, CA 94105, EE. UU.) registra la dirección IP, la fecha y la página solicitada para entregar el sitio y protegerlo frente a abusos. Base jurídica: interés legítimo (art. 6.1.f RGPD). Netlify actúa como encargado del tratamiento conforme a su acuerdo de tratamiento de datos (art. 28 RGPD) y conserva esos registros el tiempo que establece su política de privacidad. El titular no usa esos registros para identificar a nadie.</li>
<li><strong>Preferencias locales:</strong> el país y el tipo de empresa que eliges se guardan solo en el almacenamiento local de tu navegador para recordarlos. Puedes borrarlos desde la configuración del navegador. No se transmiten.</li>
<li><strong>Guardado opcional de tu trabajo:</strong> solo si activas «Guardar mi trabajo», el texto de tu CV, las ofertas que pegas, tus cambios y las versiones se guardan en el almacenamiento local de tu navegador para que puedas recuperarlos. No se transmiten a ningún servidor. Base jurídica: tu consentimiento, que puedes retirar en cualquier momento desactivando la opción o pulsando «Borrar datos guardados», lo que elimina esos datos de inmediato.</li>
</ul>
<h2>Transferencias internacionales</h2>
<p>Netlify tiene su sede en Estados Unidos, por lo que los datos técnicos de conexión pueden tratarse fuera del Espacio Económico Europeo. Netlify, Inc. está adherida al Marco de Privacidad de Datos UE-EE. UU. (decisión de adecuación de la Comisión Europea de 10 de julio de 2023) y, además, aplica las cláusulas contractuales tipo de la Comisión Europea (Decisión de Ejecución 2021/914). El contenido de tu CV no se transfiere, porque nunca sale de tu navegador.</p>
<h2>Tus derechos</h2>
<p>Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a <a href="mailto:nazarblanco@gmail.com">nazarblanco@gmail.com</a>. Si consideras que no se han atendido, puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).</p>
<h2>Datos de terceros</h2>
<p>Si analizas el CV de otra persona, debes contar con su consentimiento. La herramienta no debe usarse para evaluar o filtrar candidaturas de terceros.</p>
<p class="small">Última actualización: 30 de octubre de 2026</p>
"""),
"terminos.html": ("Términos de uso", """
<h2>Uso permitido</h2>
<p>La herramienta está pensada para que cada persona revise su propio currículum. Su uso es gratuito y personal.</p>
<h2>Uso no permitido</h2>
<ul>
<li>Usarla para puntuar, ordenar, filtrar o descartar candidaturas de terceras personas en procesos de selección. Ese uso convertiría la herramienta en un sistema de IA de alto riesgo según el Reglamento (UE) 2024/1689 (anexo III, punto 4), con obligaciones específicas para quien lo despliegue.</li>
<li>Analizar documentos de otras personas sin su consentimiento.</li>
<li>Intentar alterar el funcionamiento del sitio o usarlo con fines ilícitos.</li>
</ul>
<h2>Naturaleza de los resultados</h2>
<p>El análisis se basa en reglas sobre estructura, formato, palabras clave y convenciones habituales por país. Es orientativo, puede contener errores y no garantiza que un CV supere un filtro concreto: cada empresa configura sus sistemas de forma distinta.</p>
<h2>Disponibilidad</h2>
<p>El titular puede modificar o retirar la herramienta en cualquier momento sin previo aviso.</p>
<h2>Legislación aplicable</h2>
<p>Estos términos se rigen por la legislación española.</p>
<p class="small">Titular: Nazar Blanco Kataran · Contacto: <a href="mailto:nazarblanco@gmail.com">nazarblanco@gmail.com</a> · Última actualización: 30 de octubre de 2026</p>
"""),
}

PAGE_TPL = """<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'none'">
<title>{title} · Analizador de CV</title>
<style>
:root {{ --bg:#FFFFFF; --fg:#1F2430; --muted:#4A5160; --pen:#0F7A74; --sheet:#F9F9FC; --rule:#E3E3EC; --mark:#7B6CC6; color-scheme: light; }}
main {{ border-top:3px solid var(--pen); }}
body {{ background:var(--bg); color:var(--fg); font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif; margin:0; }}
main {{ max-width:760px; margin:0 auto; padding:32px max(16px, env(safe-area-inset-right)) 64px max(16px, env(safe-area-inset-left)); }}
h1, h2 {{ font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif; }}
h1 {{ font-size:30px; margin:16px 0 8px; }} h2 {{ font-size:20px; margin-top:28px; }}
a {{ color:var(--pen); }} li {{ margin:4px 0; }}
.note {{ border-left:4px solid var(--mark); background:var(--sheet); padding:10px 14px; color:var(--muted); font-size:14px; }}
.small {{ font-size:13px; color:var(--muted); }}
</style>
</head>
<body><main>
<a href="./">← Volver al Analizador de CV</a>
<h1>{title}</h1>
{body}
</main></body></html>
"""
