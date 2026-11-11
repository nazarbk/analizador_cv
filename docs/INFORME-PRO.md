# Informe Pro: modelo gratis + pago y puesta en marcha

## 1. Qué es gratis y qué es de pago

La regla: **todo lo que ya existe sigue gratis** (es lo que atrae tráfico por SEO y lo que convence de que la herramienta sabe de lo que habla). **Se paga lo que solo tiene sentido para una oferta concreta y necesita IA generativa.**

| | Gratis | Informe Pro · 4,99 € |
|---|---|---|
| Puntuación ATS e IA, puntos fuertes y débiles, prioridades | ✔ | ✔ |
| Coincidencia de palabras clave con hasta 5 ofertas | ✔ | ✔ |
| Datos para copiar, CV en formato ATS (PDF/Word), versión en inglés manual, comparar versiones | ✔ | ✔ |
| **CV reescrito para una oferta concreta** (titular, perfil, experiencias, proyectos, habilidades), sin inventar nada | | ✔ |
| **Carta de presentación** personalizada, editable, en PDF/Word | | ✔ |
| **Encaje requisito a requisito** (cumple / parcial / no cumple, con evidencia) y palabras clave que faltan | | ✔ |
| **Puntuación ATS antes y después** de adaptar el CV, frente a esa oferta | | ✔ |
| Resultado en español o en inglés | | ✔ |
| Informes por compra | | 3 en 30 días, para la misma oferta o para otras, con cualquier CV |

Por qué así:
- **La puntuación ATS se queda gratis.** Es el gancho de búsquedas como «comprobar CV ATS», y quitarla rompería la promesa de la portada. En el Informe Pro se vende la puntuación **frente a una oferta**, con el antes y el después.
- **Privacidad por capas.** El análisis gratuito sigue siendo 100 % local. Solo el Informe Pro envía datos a la IA, con consentimiento expreso, y sin nombre ni contacto.
- **Un solo precio, sin suscripción.** Para validar con 5 ventas en 30 días, cuanto menos haya que decidir, mejor. Las 3 generaciones dan margen para reintentar o probar con otra oferta sin sensación de pagar por cada clic.

## 2. Cómo funciona

```
Analizador (navegador)                    Netlify Edge Functions                 Servicios
─────────────────────                     ──────────────────────                 ─────────
Pega la oferta + 2 consentimientos
Guarda CV y oferta en IndexedDB  ──POST /api/checkout──▶ crea la sesión de pago ──▶ Stripe Checkout
                                                        (Managed Payments, 4,99 €)   (merchant of record)
◀──────────── vuelve a /analizador.html?pro=cs_… ◀──────────────────────────────────┘
Recupera CV y oferta de IndexedDB
Envía CV sin contacto + oferta ──POST /api/generate──▶ 1. comprueba en Stripe que está pagado
                                                        2. reserva un informe (escritura condicional)
                                                        3. llama a la API de Claude (streaming) ──▶ Anthropic
◀────────────── el informe llega en streaming ◀─────────┘ 4. al terminar, lo cuenta; si falla, libera la reserva
Muestra el informe, lo guarda en IndexedDB                 (metadata del PaymentIntent)
PDF y Word se generan en el navegador
```

- **No hay base de datos.** El contador de generaciones vive en los metadatos del pago en Stripe, y el informe se guarda solo en el navegador de quien lo compra.
- **Sin dependencias de npm.** Las funciones usan `fetch` contra las APIs REST de Stripe y Anthropic.
- **Edge Functions** porque la generación tarda entre 30 y 60 segundos: en streaming no tienen límite de duración, siempre que empiecen a responder en menos de 40 segundos.
- **Contador sin base de datos y a prueba de peticiones simultáneas.** Vive en los metadatos del pago: `generaciones` (informes completados), `reservas` (en curso) e `intentos` (versión). Cada cambio se escribe con la clave de idempotencia `ipro_<pago>_<versión+1>`: si dos peticiones leen la misma versión, Stripe solo acepta la primera y la otra vuelve a leer. El informe se **reserva antes** de llamar a la IA, así que un fallo del contador nunca regala informes (sin reserva no se genera). Una reserva que no se cierra (función cortada) deja de contar a los 15 minutos.
- Si la IA falla o se corta la conexión, la reserva se libera y el intento **no se cuenta**. Solo se cuenta cuando el informe llega completo.
- Si la compra se **devuelve** o entra en **disputa**, deja de dar informes (los ya generados siguen en el navegador de quien compró).
- **Nada pagado se pierde en el navegador:** el monedero local (`pro-wallet`) guarda el código de cada compra y se sincroniza con Stripe (`/api/estado`). Cada informe guarda su propia copia del CV y de la oferta, así que se puede subir otro CV y usar los informes restantes con él; borrar un informe no borra la compra; si la pestaña se cierra justo después de pagar, la compra aparece al volver a entrar; y con el **enlace de la compra** (`/analizador.html?pro=<código>`) se usa en otro navegador.

Archivos:
- `netlify/edge-functions/checkout.js`: `POST /api/checkout`, crea la sesión de Stripe.
- `netlify/edge-functions/generate.js`: `POST /api/generate`, verifica el pago y genera el informe en streaming.
- `netlify/edge-functions/estado.js`: `GET /api/estado`, indica si los pagos están activos y el estado de un pedido.
- `netlify/shared/pro.js`: configuración, precio, límites, *prompt* y esquema del informe.
- `src/ui.js`: sección «Informe Pro» (venta, retorno de Stripe, progreso, resultado y descargas).
- `test/pro_server.mjs` + `test/e2e_pro.py`: prueba completa con Stripe y Claude simulados.

## 3. Puesta en marcha (orden recomendado)

### 3.1 Antes de cobrar (no técnico)
1. **Alta fiscal.** Vender es actividad económica: habla con una gestoría sobre el alta en Hacienda (modelo 036/037), el alta como autónomo y cómo declarar los ingresos que te pague Stripe. Con Managed Payments, Stripe vende al cliente final y gestiona el IVA de cada país, pero tú facturas tus ingresos frente a Stripe.
2. **Aviso legal.** Rellena `TITULAR_NIF` y `TITULAR_DOMICILIO` en `src/legal.py` y ejecuta `python3 build.py` (avisa mientras falten).
3. Revisa `condiciones.html` y el apartado «Informe Pro» de `privacidad.html` con quien te asesore.

### 3.2 Stripe
1. Crea la cuenta de Stripe (o usa la tuya) y **solicita Managed Payments** en el Dashboard. Stripe revisa la cuenta antes de activarlo.
2. Crea el producto **«Informe Pro del Analizador de CV»** con un **código fiscal marcado como apto para Managed Payments** (contenido o software digital). Crea un precio único de **4,99 EUR con el IVA incluido** (*tax behavior: inclusive*) y copia su ID (`price_…`).
3. Primero, todo en **modo de prueba** (claves `sk_test_…`).

### 3.3 Anthropic
1. Crea una clave de API en console.anthropic.com y **pon un límite de gasto mensual** (por ejemplo, 20 $). Cada informe cuesta unos céntimos.
2. Revisa y acepta el acuerdo de tratamiento de datos (DPA) de Anthropic: la política de privacidad lo menciona.

### 3.4 Variables de entorno en Netlify
Site configuration → Environment variables:

| Variable | Valor |
|---|---|
| `STRIPE_SECRET_KEY` | mejor una clave **restringida** (`rk_test_…`, luego `rk_live_…`) con *Checkout Sessions: escritura*, *PaymentIntents: escritura* y *Charges: lectura* (sin este último todo funciona, pero una compra devuelta seguiría dando informes). Pon la de prueba en Deploy Previews y Branch deploys, y la real solo en Production. |
| `STRIPE_PRICE_ID` | `price_…` del paso 3.2 (si no se indica, se usa 4,99 € definido en el código) |
| `ANTHROPIC_API_KEY` | `sk-ant-…` |
| `SITE_URL` | `https://analizadorcv.com` |
| `ANTHROPIC_MODEL` | opcional; por defecto `claude-sonnet-5-5` |
| `STRIPE_MANAGED_PAYMENTS` | opcional; `false` para probar sin Managed Payments mientras Stripe lo aprueba |
| `STRIPE_API_VERSION` | opcional; por defecto `2026-04-22.dahlia` (la primera que admite `managed_payments`) |

Sin `STRIPE_SECRET_KEY` y `ANTHROPIC_API_KEY`, la sección Informe Pro se oculta sola: puedes desplegar el código antes de activar los pagos.

### 3.5 Prueba en real (modo de prueba)
1. Despliega, abre el analizador, sube tu CV, pega una oferta y paga con la tarjeta de prueba `4242 4242 4242 4242`.
2. Comprueba que se genera el informe, que «Nuevo informe» resta uno de los 3, que puedes subir otro CV y seguir usando los que quedan y que en Stripe el pago tiene `metadata.generaciones`.
3. Cambia a claves `live` y haz una compra real tuya (puedes reembolsarla desde Stripe).

### 3.6 Prueba local
```
npm ci && pip install -r requirements-dev.txt && python -m playwright install chromium
python3 build.py
node test/pro_server.mjs 8820        # Stripe y Claude simulados → http://127.0.0.1:8820/analizador.html
python3 scripts/test_all.py          # toda la batería (también la ejecuta GitHub Actions en cada PR)
```

## 4. Test de 30 días

**Criterio de descarte:** menos de 5 ventas en 30 días.

Qué medir sin añadir analítica ni cookies:
- **Ventas y conversión del pago:** en Stripe → Payments, compara las sesiones de Checkout creadas (intención de compra) con las pagadas. Muchas sesiones creadas y pocas pagadas apuntan al precio o a la confianza. Pocas sesiones creadas apuntan a la propuesta de valor o al tráfico.
- **Uso real del informe:** `metadata.generaciones` de cada pago (1 = lo usó una vez; 3 = le sacó todo el partido).
- **Tráfico:** Google Search Console (impresiones y clics por consulta). Para saber cuánto aportan Reddit y LinkedIn sin poner cookies, la opción más sencilla es Netlify Analytics (de pago, se calcula en el servidor y no usa cookies); si no, pregunta a quien compre cómo os ha conocido.
- **Coste:** el gasto de la API en la consola de Anthropic. Ingreso neto por venta ≈ 4,99 € − IVA − comisión de Stripe (≈ 5 % + 0,25 €) − IA.

Ideas si no llega a 5 ventas, antes de descartar del todo: un ejemplo real del informe en la portada (antes/después), el precio a 2,99 € durante una semana, o el informe como pack de 3 ofertas a 6,99 €.
