// POST /api/generate → comprueba el pago, reserva un informe y lo genera con la API de Claude, en streaming.
// No guarda el CV ni la oferta: los reenvía a la API y devuelve la respuesta tal cual llega.
// El informe se reserva ANTES de llamar a la IA (escritura condicional en Stripe), así dos peticiones a la vez no
// pueden usar el mismo hueco, y un fallo del contador no regala informes: si no se puede reservar, no se genera.
import { env, json, verifyPurchase, reserveGeneration, completeGeneration, releaseGeneration, validateInput, anthropicRequest, MAX_GENERATIONS } from '../shared/pro.js';

const RESERVE_ERR = { limite_generaciones: 429, generacion_en_curso: 409, contador_ocupado: 409 };
async function release(piId, token) {
  if (!piId || !token) return;
  try { await releaseGeneration(piId, token); } catch (e) { console.error('contador: no se pudo liberar la reserva', e.message); }
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'metodo_no_permitido' }, 405);
  if (!env('STRIPE_SECRET_KEY') || !env('ANTHROPIC_API_KEY')) return json({ error: 'pagos_no_configurados' }, 503);
  const raw = await req.text();
  if (raw.length > 70000) return json({ error: 'peticion_muy_grande' }, 413);
  let b; try { b = JSON.parse(raw); } catch (e) { return json({ error: 'peticion_no_valida' }, 400); }
  const bad = validateInput(b); if (bad) return json({ error: bad }, 400);
  const v = await verifyPurchase(b.session_id);
  if (!v.ok) return json({ error: v.error }, v.status);
  // 1. reservar el informe
  let token = null;
  if (v.piId) {
    try { token = await reserveGeneration(v); }
    catch (e) {
      if (RESERVE_ERR[e.code]) return json({ error: e.code === 'contador_ocupado' ? 'generacion_en_curso' : e.code }, RESERVE_ERR[e.code]);
      console.error('contador: no se pudo reservar', e.message); return json({ error: 'stripe_no_disponible' }, 502);
    }
  }
  // 2. llamar a la IA; si falla, se devuelve la reserva
  const { url, init } = anthropicRequest(b);
  let ar;
  try { ar = await fetch(url, init); } catch (e) { await release(v.piId, token); return json({ error: 'ia_no_disponible' }, 502); }
  if (!ar.ok || !ar.body) {
    console.error('anthropic', ar.status, await ar.text().catch(() => ''));
    await release(v.piId, token);
    return json({ error: ar.status === 429 || ar.status === 529 ? 'ia_saturada' : 'ia_no_disponible' }, 502);
  }
  // 3. reenviar el streaming; si termina bien, se cuenta; si se corta, se devuelve la reserva
  const { readable, writable } = new TransformStream();
  const w = writable.getWriter(), reader = ar.body.getReader(), dec = new TextDecoder();
  (async () => {
    let tail = '', finished = false;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        await w.write(value);
        tail = (tail + dec.decode(value, { stream: true })).slice(-4000);
        if (tail.includes('"message_stop"')) finished = true;
      }
    } catch (e) { finished = false; }
    if (!finished) { await release(v.piId, token); try { await w.abort(new Error('cortado')); } catch (x) { } return; }
    let generaciones = v.used + 1, contado = true;
    if (v.piId) {
      try { generaciones = (await completeGeneration(v.piId, token)).used; }
      catch (e) { contado = false; console.error('contador: informe entregado sin contar', e.message); }
    }
    try {
      await w.write(new TextEncoder().encode('event: informe_pro\ndata: ' + JSON.stringify({ generaciones, max: MAX_GENERATIONS, caduca: v.caduca || null, contado }) + '\n\n'));
      await w.close();
    } catch (e) { }
  })();
  return new Response(readable, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' } });
};
export const config = { path: '/api/generate' };
