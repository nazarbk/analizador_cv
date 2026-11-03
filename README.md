# Analizador de CV

Herramienta web que analiza un currículum **en el navegador del usuario**: no hay servidor de aplicación, base de datos ni cookies. Es un sitio estático que puedes alojar en cualquier servicio.

## Qué hace

- Lee PDF, DOCX, ODT y TXT (o texto pegado).
- Puntuación global y por categorías: ATS e IA, contenido, estructura, contacto, país y coincidencia con la oferta.
- Puntos fuertes y débiles, con prioridades y cómo arreglar cada problema.
- Filtros ATS e IA: columnas, tablas, cuadros de texto, contacto en encabezado o pie, iconos, barras de nivel, texto oculto o diminuto, instrucciones dirigidas a la IA, relleno de palabras clave, fechas, encabezados y nombre de archivo.
- Coincidencia con una oferta: palabras clave encontradas y ausentes (y en qué sección aparecen), años de experiencia e idiomas pedidos, titular.
- Recomendaciones para ampliar cada puesto: preguntas para sacar cifras según la familia profesional, reescritura de viñetas débiles y modelo de viñeta.
- Formato: ficha técnica del documento, convenciones de 21 países (foto, edad, estado civil, nacionalidad, páginas, papel, formato de fecha y teléfono) y 10 tipos de empresa.
- Qué añadir y qué quitar, con prioridad.
- Coherencia interna: fechas invertidas o futuras, puestos que se solapan o se repiten, años declarados en el perfil frente a los que suman las fechas, titular frente al puesto actual y nivel de idioma contradictorio.
- Varias ofertas (hasta 5): puntuación por oferta y matriz de palabras clave que muestra qué piden todas y qué falta en el CV.
- Versiones: compara dos versiones del CV con el mismo país y oferta (puntuaciones, problemas resueltos, nuevos y pendientes, indicadores).
- Guardado opcional en el navegador (desactivado por defecto): CV, ofertas, cambios y versiones, con borrado inmediato.
- Descarga en PDF con texto real (pdf-lib), además de Word, TXT y JSON.
- Proyectos: extrae los del CV y permite añadir varios con enlace (validado y mostrado como texto, que es lo que leen los ATS), fechas, descripción breve y herramientas usadas, con sugerencias tomadas de tus habilidades. Se incluyen en la plantilla, el Word, el texto copiado y el JSON Resume.
- CV en inglés (o en español si el original está en inglés): crea una segunda versión en «Datos para copiar». Un diccionario local traduce idiomas y niveles, fechas, lugares, titulaciones y competencias habituales; el resto queda marcado como «Sin traducir», con el texto original al lado, y se puede traducir a mano o copiando los textos pendientes (con etiquetas `[@campo]`) a cualquier traductor y pegando el resultado. Los datos comunes (contacto, enlaces, empresas, herramientas) y las altas, bajas y cambios de orden se mantienen sincronizados entre versiones. La plantilla genera el PDF y el Word con la versión elegida en «Idioma del CV».
- Datos para copiar campo a campo en portales, exportación JSON Resume y plantilla ATS (cronológica, combinada, résumé EE. UU., Lebenslauf o tipo Europass) con encabezados en 6 idiomas. En la versión autoalojada, descarga en Word, TXT, JSON e impresión a PDF.

## Estructura del repositorio

```
src/                  código fuente: analizador (markup, styles, *.js), página principal (landing.*), textos legales e iconos (assets/)
scripts/make_icons.py regenera los PNG, el favicon y la imagen para redes a partir de src/assets/icon.svg
test/                 pruebas (node test/fuzz.js; pruebas de navegador con Playwright)
build.py              genera la web en site/ (y una copia en dist/)
site/                 la web ya generada: es la carpeta que publica Netlify
  index.html          página principal: explica el proyecto y tiene el botón «Sube tu CV»
  analizador.html     la aplicación (HTML, CSS y JS en un solo archivo)
  assets/             icono (SVG y PNG) e imagen para redes sociales (og-image.png)
  favicon.ico, apple-touch-icon.png, site.webmanifest
  sitemap.xml, robots.txt, 404.html
  vendor/             pdf.js 6.2.108 (legacy), JSZip 3.10.1 y pdf-lib 1.17.1, servidos desde tu dominio
  aviso-legal.html    aviso legal (LSSI-CE)
  privacidad.html     política de privacidad (RGPD)
  terminos.html       términos de uso
  _headers            cabeceras de seguridad (Netlify)
netlify.toml          configuración de Netlify: publica site/ sin paso de compilación
netlify/              Edge Functions del Informe Pro de pago (Stripe + API de Claude), sin dependencias
docs/INFORME-PRO.md   qué es gratis y qué es de pago, cómo funciona el cobro y cómo activarlo
package.json          versiones fijas de las librerías de terceros
LICENSE               licencia MIT del código propio
```

## Informe Pro (de pago)

El análisis es gratuito y se hace en el navegador. El **Informe Pro (4,99 €)** adapta el CV a una oferta con IA: CV reescrito, carta de presentación y encaje requisito a requisito con la puntuación ATS antes y después. El cobro usa **Stripe Managed Payments** (Stripe es el vendedor registrado y gestiona el IVA) y la generación, la **API de Claude**. La sección se oculta sola mientras no estén configuradas las claves. Activación, variables de entorno y plan de prueba: [`docs/INFORME-PRO.md`](docs/INFORME-PRO.md).

## Desarrollo

1. Instala las librerías: `npm install`
2. Edita lo que necesites en `src/`.
3. Genera la web: `python3 build.py` (actualiza `site/`).
4. Pruébala en local: `cd site && python3 -m http.server 8080` y abre http://localhost:8080. No funciona abriendo `index.html` con doble clic, porque los módulos y el worker de pdf.js necesitan un servidor.
5. Pruebas: `node test/fuzz.js`. Las pruebas de navegador (`test/e2e*.py`) usan Playwright para Python.

Sube a GitHub también la carpeta `site/` regenerada: Netlify la publica tal cual.

**Dirección de la web.** `build.py` usa `https://analizadorcv.com` para la URL canónica, el mapa del sitio y la vista previa en redes sociales. Si tu sitio de Netlify tiene otro nombre o conectas un dominio propio, cámbiala en `SITE_URL` (o ejecuta `CV_SITE_URL=https://tu-dominio python3 build.py`) y vuelve a generar la web.

**Subida desde la página principal.** El botón «Sube tu CV» de la portada deja el archivo un instante en IndexedDB (almacenamiento local del navegador, mismo sitio) y abre `analizador.html`, que lo lee y lo borra en el acto. El archivo nunca sale del navegador.

## Publicar en Netlify

1. Sube el repositorio a GitHub.
2. En Netlify: **Add new site → Import an existing project → GitHub** y elige el repositorio.
3. Netlify lee `netlify.toml`: carpeta de publicación `site`, sin comando de compilación. Pulsa **Deploy**.
4. Cada `git push` vuelve a publicar la web.
5. Para que Google la indexe: da de alta la web en Google Search Console (verificación por etiqueta HTML o DNS) y envía `sitemap.xml`. Puedes cambiar el subdominio en **Site configuration → Change site name** o conectar un dominio propio.

`_headers` se aplica solo en Netlify. Bloquea que la web se cargue dentro de un `<iframe>` (protección contra clickjacking): en tu portfolio, enlázala en lugar de incrustarla.

## Lista de comprobación legal (España / UE)

1. **Aviso legal (LSSI-CE, art. 10)**: el sitio es un proyecto personal sin actividad económica, así que identifica al titular con nombre y email. Si añades anuncios, enlaces de afiliado o servicios de pago, añade NIF y domicilio en `src/legal.py`.
2. **Política de privacidad (RGPD)**: aunque el CV no llegue a ningún servidor, Netlify registra IP y fecha de cada visita. `privacidad.html` lo indica, junto con la transferencia a EE. UU. (Marco de Privacidad de Datos UE-EE. UU. y cláusulas contractuales tipo). Si cambias de hosting, actualízalo en `src/legal.py`.
3. **Cookies y almacenamiento local**: la herramienta no usa cookies ni analítica, así que no necesita banner. Por defecto solo guarda en `localStorage` el país y el tipo de empresa (preferencia técnica). El guardado del CV y del trabajo es opcional, está desactivado por defecto, lo activa el propio usuario con una casilla y se borra al desactivarla; está descrito en `privacidad.html`. Si añades analítica o publicidad, necesitarás banner de consentimiento conforme a la guía de la AEPD.
4. **Terceros**: todo se sirve desde tu dominio, sin CDN ni fuentes externas. Así se evita transferir la IP del visitante a terceros sin consentimiento, el problema que llevó a la condena por Google Fonts del Tribunal Regional de Múnich (LG München I, 20/01/2022). No añadas fuentes ni scripts externos sin revisar esto.
5. **Reglamento europeo de IA**: la herramienta está pensada para que cada persona revise su propio CV. Si la ofreces a empresas para puntuar, ordenar o filtrar candidaturas, pasa a ser un sistema de alto riesgo (anexo III, punto 4), con obligaciones aplicables desde el 2 de diciembre de 2027 tras el Ómnibus Digital: gestión de riesgos, documentación técnica, supervisión humana, registros y evaluación de sesgos. Los términos de uso prohíben ese uso.
6. **Licencias**: pdf.js (Apache 2.0), JSZip (MIT) y pdf-lib (MIT). Mantén `vendor/THIRD-PARTY-LICENSES.md` publicado.
7. **Accesibilidad**: la interfaz usa HTML semántico, foco visible, contraste en tema claro y oscuro, y funciona con teclado. Si la ofrece una administración pública o una gran empresa, revisa los requisitos de la norma EN 301 549 / Ley Europea de Accesibilidad.
8. **Sin garantías**: mantén visible que los resultados son orientativos (ya está en el pie y en «Privacidad»).

## Cómo funciona por dentro

| Archivo de origen | Función |
|---|---|
| `data.js` | Base de conocimiento: encabezados en 6 idiomas, unas 270 competencias (con sus sinónimos) en 17 familias profesionales, verbos de acción, frases hechas, idiomas y niveles MCER, 21 países, tipos de empresa y plantillas. |
| `engine.js` | Motor puro (sin red): segmenta secciones, extrae contacto, puestos, fechas, formación, competencias e idiomas; ejecuta las comprobaciones y genera puntuaciones y recomendaciones. |
| `extract.js` | Lectura de archivos en el navegador. PDF: posiciones del texto (columnas), imágenes y su tamaño (foto), tamaño de papel, fuentes, texto diminuto, cabeceras y pies repetidos. DOCX: tablas, cuadros de texto, columnas nativas, encabezados y pies, texto oculto o blanco, imágenes. |
| `cvtemplate.js` | Genera el CV ATS como HTML, texto, PDF, DOCX y JSON Resume, con enlaces clicables. |
| `translate.js` | Versión del CV en inglés (o en español): diccionario local y detección de texto sin traducir. |
| `legal.py` | Textos del aviso legal, la política de privacidad y los términos de uso. |
| `ui.js` | Interfaz. |

Las fuentes están en `src/`; `build.py` genera `site/`. `translate.js` prepara la versión del CV en otro idioma y detecta lo que queda sin traducir.

## Ideas para siguientes versiones

- OCR opcional (Tesseract.js, también local) para CV escaneados.
- Análisis con un modelo de lenguaje **opcional y con consentimiento expreso**, a través de un backend propio: exigiría actualizar la política de privacidad (encargado del tratamiento, transferencias, plazo de conservación) y no guardar los CV.
- Más idiomas de interfaz y más familias profesionales.
- Versiones en más idiomas (alemán, francés…) con sus propios diccionarios.

## Licencia

Código propio bajo licencia MIT (ver `LICENSE`) · © 2026 Nazar Blanco Kataran. Las librerías de terceros conservan sus licencias (`site/vendor/THIRD-PARTY-LICENSES.md`).
