// POST /api/generate → comprueba el pago y genera el Informe Pro con la API de Claude, en streaming.
// No guarda el CV ni la oferta: los reenvía a la API y devuelve la respuesta tal cual llega.
import { env, json, verifyPurchase, countGeneration, validateInput, anthropicRequest, MAX_GENERATIONS } from '../shared/pro.js';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'metodo_no_permitido' }, 405);
  if (!env('STRIPE_SECRET_KEY') || !env('ANTHROPIC_API_KEY')) return json({ error: 'pagos_no_configurados' }, 503);
  const raw = await req.text();
  if (raw.length > 70000) return json({ error: 'peticion_muy_grande' }, 413);
  let b; try { b = JSON.parse(raw); } catch (e) { return json({ error: 'peticion_no_valida' }, 400); }
  const bad = validateInput(b); if (bad) return json({ error: bad }, 400);
  const v = await verifyPurchase(b.session_id);
  if (!v.ok) return json({ error: v.error }, v.status);
  const { url, init } = anthropicRequest(b);
  let ar;
  try { ar = await fetch(url, init); } catch (e) { return json({ error: 'ia_no_disponible' }, 502); }
  if (!ar.ok || !ar.body) { console.error('anthropic', ar.status, await ar.text().catch(() => '')); return json({ error: ar.status === 429 || ar.status === 529 ? 'ia_saturada' : 'ia_no_disponible' }, 502); }
  // Reenvía el streaming y, si termina bien, cuenta la generación en el pago de Stripe.
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
      if (finished) {
        try { await countGeneration(v.piId, v.used); } catch (e) { console.error('contador', e.message); }
        await w.write(new TextEncoder().encode('event: informe_pro\ndata: ' + JSON.stringify({ generaciones: v.used + 1, max: MAX_GENERATIONS, caduca: v.caduca || null }) + '\n\n'));
      }
      await w.close();
    } catch (e) { try { await w.abort(e); } catch (x) { } }
  })();
  return new Response(readable, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' } });
};
export const config = { path: '/api/generate' };
