# Textos legales de la versión autoalojada (alojada en Netlify), con un informe de pago (Informe Pro).
# Al haber actividad económica, el aviso legal debe identificar al titular con NIF y domicilio (art. 10 LSSI-CE).
# Rellena TITULAR_NIF y TITULAR_DOMICILIO antes de activar los pagos en producción: build.py avisa si siguen vacíos.
TITULAR_NIF = '[NIF]'
TITULAR_DOMICILIO = '[DOMICILIO]'
PAGES = {
"aviso-legal.html": ("Aviso legal", """
<h2>Titular</h2>
<ul>
<li>Titular: Nazar Blanco Kataran</li>
<li>NIF: """ + TITULAR_NIF + """</li>
<li>Domicilio: """ + TITULAR_DOMICILIO + """</li>
<li>Email de contacto: <a href="mailto:nazarblanco@gmail.com">nazarblanco@gmail.com</a></li>
</ul>
<h2>Objeto</h2>
<p>Este sitio ofrece una herramienta gratuita que permite a cada persona analizar su propio currículum en su navegador y obtener recomendaciones orientativas de mejora, y un informe de pago (Informe Pro) que adapta el CV a una oferta concreta. La contratación del Informe Pro se rige por las <a href="condiciones.html">condiciones de venta</a>.</p>
<h2>Responsabilidad</h2>
<p>Los resultados se generan automáticamente, mediante reglas en el análisis gratuito y con inteligencia artificial en el Informe Pro, y tienen carácter orientativo. No constituyen asesoramiento profesional ni garantizan resultados en ningún proceso de selección. El titular no se responsabiliza de las decisiones que se tomen a partir de ellos.</p>
<h2>Propiedad intelectual</h2>
<p>El diseño y el código propio del sitio pertenecen al titular. Las librerías de terceros se usan conforme a sus licencias: pdf.js (Apache License 2.0, Mozilla Foundation), JSZip (licencia MIT) y pdf-lib (licencia MIT). El código fuente propio se publica con licencia MIT.</p>
<h2>Legislación aplicable</h2>
<p>Este aviso se rige por la legislación española. Para cualquier controversia serán competentes los juzgados y tribunales que correspondan conforme a la normativa de consumidores y usuarios.</p>
"""),
"privacidad.html": ("Política de privacidad", """
<h2>Resumen</h2>
<p><strong>En el análisis gratuito, tu CV no se envía a ningún servidor.</strong> El archivo se lee y se analiza dentro de tu navegador y desaparece al cerrar o recargar la página. No usamos cookies, analítica ni publicidad.</p>
<p><strong>Solo si compras el Informe Pro</strong>, y después de aceptarlo expresamente, se envía a un proveedor de inteligencia artificial el texto de tu CV, sin tu nombre ni tus datos de contacto, junto con la oferta que pegas. Los detalles están en el apartado <a href="#informe-pro">Informe Pro</a>.</p>
<h2>Responsable</h2>
<p>Nazar Blanco Kataran. Contacto: <a href="mailto:nazarblanco@gmail.com">nazarblanco@gmail.com</a>.</p>
<h2>Qué datos tratamos</h2>
<ul>
<li><strong>Contenido del CV en el análisis gratuito:</strong> no lo recibimos ni lo almacenamos. Todo el procesamiento ocurre en tu dispositivo.</li>
<li><strong>Datos técnicos de conexión:</strong> como cualquier sitio web, el servicio de alojamiento (Netlify, Inc., 101 2nd Street, San Francisco, CA 94105, EE. UU.) registra la dirección IP, la fecha y la página solicitada para entregar el sitio y protegerlo frente a abusos. Base jurídica: interés legítimo (art. 6.1.f RGPD). Netlify actúa como encargado del tratamiento conforme a su acuerdo de tratamiento de datos (art. 28 RGPD) y conserva esos registros el tiempo que establece su política de privacidad. El titular no usa esos registros para identificar a nadie.</li>
<li><strong>Subida desde la página principal:</strong> si eliges tu CV en la página de inicio, el archivo se deja un instante en el almacenamiento local de tu navegador (IndexedDB) para abrirlo en el analizador, que lo borra en cuanto lo lee. Si no se abre, se descarta a los 10 minutos la próxima vez que entres en el analizador. No se transmite a ningún servidor.</li>
<li><strong>Preferencias locales:</strong> el país y el tipo de empresa que eliges se guardan solo en el almacenamiento local de tu navegador para recordarlos. Puedes borrarlos desde la configuración del navegador. No se transmiten.</li>
<li><strong>Guardado opcional de tu trabajo:</strong> solo si activas «Guardar mi trabajo», el texto de tu CV, las ofertas que pegas, tus cambios y las versiones se guardan en el almacenamiento local de tu navegador para que puedas recuperarlos. No se transmiten a ningún servidor. Base jurídica: tu consentimiento, que puedes retirar en cualquier momento desactivando la opción o pulsando «Borrar datos guardados», lo que elimina esos datos de inmediato.</li>
</ul>
<h2 id="informe-pro">Informe Pro (de pago)</h2>
<ul>
<li><strong>Qué se envía:</strong> el texto de tu CV estructurado (titular, perfil, experiencia, proyectos, formación, habilidades, idiomas y certificaciones), sin tu nombre, email, teléfono, enlaces ni ubicación, junto con la oferta que pegas y el idioma elegido.</li>
<li><strong>Para qué:</strong> generar el informe que has comprado: el CV adaptado a la oferta, la carta de presentación y el análisis de encaje. Base jurídica: la ejecución del contrato que solicitas (art. 6.1.b RGPD). Además, te pedimos que lo aceptes expresamente antes de pagar.</li>
<li><strong>Quién lo procesa:</strong> el contenido pasa por una función del servidor de alojamiento (Netlify), que lo reenvía a Anthropic, PBC (EE. UU.), proveedor del modelo de IA, como encargado del tratamiento. Esta web no guarda el CV, la oferta ni el informe en ningún servidor. Anthropic conserva los datos enviados a su API durante un tiempo limitado por motivos de seguridad y, según sus condiciones comerciales, no los usa para entrenar sus modelos.</li>
<li><strong>Pago:</strong> lo gestiona Stripe, que actúa como vendedor registrado (merchant of record): recoge tus datos de pago, tu email y tu país, emite la factura y declara los impuestos de la venta, de acuerdo con su propia política de privacidad. Esta web solo recibe de Stripe el estado del pedido y el número de informes generados, para comprobar el pago y darte soporte.</li>
<li><strong>En tu navegador:</strong> mientras pagas, el CV y la oferta se guardan en el almacenamiento local de tu navegador (IndexedDB) para no perderlos al volver de la pasarela. El informe generado también se guarda ahí para que puedas volver a verlo. Puedes borrarlo con «Borrar de este navegador».</li>
<li><strong>Tus derechos:</strong> como no conservamos el contenido de tu CV ni del informe, no podemos facilitarlo ni modificarlo después; para cualquier consulta sobre tu pedido, escribe a <a href="mailto:nazarblanco@gmail.com">nazarblanco@gmail.com</a>.</li>
</ul>
<h2>Transferencias internacionales</h2>
<p>Netlify tiene su sede en Estados Unidos, por lo que los datos técnicos de conexión pueden tratarse fuera del Espacio Económico Europeo. Netlify, Inc. está adherida al Marco de Privacidad de Datos UE-EE. UU. (decisión de adecuación de la Comisión Europea de 10 de julio de 2023) y, además, aplica las cláusulas contractuales tipo de la Comisión Europea (Decisión de Ejecución 2021/914). En el análisis gratuito, el contenido de tu CV no se transfiere, porque nunca sale de tu navegador. En el Informe Pro, el texto del CV (sin datos de contacto) y la oferta se envían a Anthropic, PBC, en EE. UU., con las garantías de su acuerdo de tratamiento de datos (cláusulas contractuales tipo de la Comisión Europea, art. 46 RGPD). Stripe trata los datos del pago según su propia política de privacidad.</p>
<h2>Tus derechos</h2>
<p>Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a <a href="mailto:nazarblanco@gmail.com">nazarblanco@gmail.com</a>. Si consideras que no se han atendido, puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).</p>
<h2>Datos de terceros</h2>
<p>Si analizas el CV de otra persona, debes contar con su consentimiento. La herramienta no debe usarse para evaluar o filtrar candidaturas de terceros.</p>
<p class="small">Última actualización: 30 de octubre de 2026</p>
"""),
"condiciones.html": ("Condiciones de venta del Informe Pro", """
<h2>Quién presta el servicio</h2>
<p>Nazar Blanco Kataran, NIF """ + TITULAR_NIF + """, con domicilio en """ + TITULAR_DOMICILIO + """. Contacto: <a href="mailto:nazarblanco@gmail.com">nazarblanco@gmail.com</a>.</p>
<p>El pago se realiza a través de Stripe, que actúa como vendedor registrado (merchant of record): cobra el importe, emite la factura o el recibo a tu nombre y declara los impuestos de la venta. Al pagar aceptas también las condiciones que Stripe te muestra en su página de pago.</p>
<h2>Qué compras</h2>
<p>El Informe Pro es un contenido digital generado al momento con inteligencia artificial a partir de tu CV y de la oferta que pegas. Incluye:</p>
<ul>
<li>tu CV reescrito para esa oferta, editable y descargable en PDF y Word;</li>
<li>una carta de presentación personalizada, editable y descargable;</li>
<li>el encaje con la oferta requisito a requisito y la puntuación ATS antes y después de adaptar el CV.</li>
</ul>
<p>Con cada compra puedes generar el informe hasta 3 veces durante 30 días (por ejemplo, para otra oferta o para obtener otra redacción). El informe se guarda en tu navegador; esta web no conserva una copia.</p>
<h2>Precio</h2>
<p>4,99 € por informe, IVA incluido, en un pago único. No hay suscripción ni cargos recurrentes.</p>
<h2>Entrega</h2>
<p>El informe se genera en tu navegador justo después del pago y suele tardar menos de un minuto. Si algo falla durante la generación, el intento no se descuenta y puedes reintentarlo.</p>
<h2>Derecho de desistimiento</h2>
<p>Como consumidor tienes, en general, 14 días para desistir de una compra a distancia. Sin embargo, en el suministro de contenido digital que no se presta en un soporte material, ese derecho no se aplica cuando la ejecución empieza con tu consentimiento previo y expreso y con tu conocimiento de que, en consecuencia, lo pierdes (artículo 103.m del Real Decreto Legislativo 1/2007, Ley General para la Defensa de los Consumidores y Usuarios). Antes de pagar te pedimos ese consentimiento expreso. Por eso, <strong>una vez generado el informe, no es posible desistir</strong>.</p>
<p>Si pagas y no llegas a generar ningún informe, escríbenos en un plazo de 14 días y te devolveremos el importe.</p>
<h2>Garantía y reclamaciones</h2>
<p>Si el informe no se puede generar, llega incompleto o no corresponde a lo descrito, escríbenos a <a href="mailto:nazarblanco@gmail.com">nazarblanco@gmail.com</a> con el email de la compra y lo resolveremos generándolo de nuevo o devolviéndote el importe. Responderemos en un plazo máximo de 7 días.</p>
<h2>Qué no garantiza</h2>
<p>El informe es una ayuda para preparar tu candidatura. La IA puede cometer errores: revisa el contenido antes de enviarlo y completa los datos que te marca entre corchetes. No garantiza que superes un filtro ATS ni que consigas una entrevista o un empleo. El informe no debe incluir datos falsos: no añadas experiencia o conocimientos que no tengas.</p>
<h2>Uso permitido</h2>
<p>El Informe Pro es para que cada persona prepare su propia candidatura. No está permitido usarlo para evaluar o filtrar candidaturas de terceros.</p>
<h2>Legislación aplicable</h2>
<p>Estas condiciones se rigen por la legislación española. Si eres consumidor, puedes acudir a los juzgados de tu domicilio y a los servicios de consumo de tu comunidad autónoma.</p>
<p class="small">Última actualización: 2 de noviembre de 2026</p>
"""),
"terminos.html": ("Términos de uso", """
<h2>Uso permitido</h2>
<p>La herramienta está pensada para que cada persona revise su propio currículum. El análisis es gratuito y de uso personal. El Informe Pro es de pago y se rige además por las <a href="condiciones.html">condiciones de venta</a>.</p>
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
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; manifest-src 'self'; base-uri 'none'; form-action 'none'">
<title>{title} · Analizador de CV</title>
<link rel="canonical" href="{canonical}">
{icons}
<style>
:root {{ --bg:#FFFFFF; --fg:#1F2430; --muted:#4A5160; --pen:#0F7A74; --sheet:#F9F9FC; --rule:#E3E3EC; --mark:#7B6CC6; color-scheme: light; }}
main {{ border-top:3px solid var(--pen); }}
body {{ background:var(--bg); color:var(--fg); font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif; margin:0; }}
main {{ max-width:760px; margin:0 auto; padding:32px max(16px, env(safe-area-inset-right)) 64px max(16px, env(safe-area-inset-left)); }}
h1, h2 {{ font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif; }}
h1 {{ font-size:30px; margin:16px 0 8px; }} h2 {{ font-size:20px; margin-top:28px; }}
a {{ color:var(--pen); }} li {{ margin:4px 0; }}
.top {{ display:flex; justify-content:space-between; gap:16px; }}
.note {{ border-left:4px solid var(--mark); background:var(--sheet); padding:10px 14px; color:var(--muted); font-size:14px; }}
.small {{ font-size:13px; color:var(--muted); }}
</style>
</head>
<body><main>
<nav class="top"><a href="./">← Inicio</a><a href="analizador.html">Analizar mi CV</a></nav>
<h1>{title}</h1>
{body}
</main></body></html>
"""
