// Servidor local para probar el Informe Pro sin claves reales: sirve site/ y ejecuta las Edge Functions
// con Stripe y la API de Claude simulados. Uso: node test/pro_server.mjs 8820
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +(process.argv[2] || 8820), SITE = 'http://127.0.0.1:' + PORT;
Object.assign(process.env, { STRIPE_SECRET_KEY: 'sk_test_mock', ANTHROPIC_API_KEY: 'sk-ant-mock', SITE_URL: SITE });
const FAIL_FIRST = process.env.MOCK_FAIL_FIRST === '1';
const NO_CHARGES = process.env.MOCK_NO_CHARGES === '1';
const sessions = new Map(), log = [], idem = new Map();
const STRIPE_POST_FAIL = process.env.MOCK_STRIPE_POST_FAIL === '1';
let aiCalls = 0;
const realFetch = globalThis.fetch;
const sse = (o) => 'event: ' + o.type + '\ndata: ' + JSON.stringify(o) + '\n\n';
function aiStream(body) {
  const b = JSON.parse(body), u = b.messages[0].content, cv = JSON.parse(u.slice(u.indexOf('<cv>') + 4, u.indexOf('</cv>')));
  const en = /inglés \(English\)/.test(b.system);
  const out = {
    encaje: { puntuacion: 72, veredicto: en ? 'Good fit; missing Kubernetes.' : 'Buen encaje; le falta experiencia con Kubernetes.', requisitos: [
      { requisito: 'Experiencia con Python', tipo: 'imprescindible', estado: 'cumple', evidencia: 'Puesto 1: APIs en Python.' },
      { requisito: 'Kubernetes', tipo: 'imprescindible', estado: 'no_cumple', evidencia: 'No aparece en el CV.' },
      { requisito: 'Inglés B2', tipo: 'deseable', estado: 'parcial', evidencia: 'Indica inglés, sin nivel.' }],
      palabras_clave_faltan: ['Kubernetes', 'Terraform'], consejos: ['Añade el nivel de inglés.', 'Cuantifica el impacto del puesto actual.'] },
    cv: { titular: 'Backend Developer · Python · AWS', perfil: 'Desarrollador backend con experiencia en APIs y datos. [añade cifra] proyectos entregados.',
      experiencia: cv.exp.map(x => ({ indice: x.indice, puesto: x.puesto, descripcion: '• Diseñé y mantuve servicios para ' + (x.empresa || 'la empresa') + '.\n• Reduje el tiempo de respuesta un [añade cifra] %.' })),
      proyectos: (cv.proyectos || []).map(p => ({ indice: p.indice, descripcion: '• Proyecto adaptado a la oferta.' })), habilidades: 'Python, AWS, SQL, Docker' },
    carta: { asunto: 'Candidatura: Backend Developer', saludo: 'Estimado equipo de selección:', cuerpo: 'Párrafo uno sobre mi interés.\n\nPárrafo dos con logros reales y la web github.com/ejemplo.\n\nPárrafo tres de cierre.', despedida: 'Un saludo,' },
    avisos: ['Completa la cifra de proyectos entregados.']
  };
  if (b.tool_choice && b.tool_choice.type !== 'auto') throw Object.assign(new Error('tool_choice'), { mockStatus: 400 });
  if ('temperature' in b) throw Object.assign(new Error('temperature'), { mockStatus: 400 });
  const js = JSON.stringify(out), parts = [], asText = process.env.MOCK_TEXT === '1';
  for (let i = 0; i < js.length; i += 120) parts.push(js.slice(i, i + 120));
  // como un modelo con razonamiento: primero un bloque «thinking», luego la herramienta (o el JSON en texto)
  const events = [sse({ type: 'message_start', message: { id: 'msg_mock', model: b.model } }), sse({ type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } })]
    .concat(Array.from({ length: 6 }, () => sse({ type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'Analizo los requisitos de la oferta y el CV. '.repeat(20) } })))
    .concat([sse({ type: 'content_block_stop', index: 0 }), sse(asText ? { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } } : { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'tu', name: 'entregar_informe', input: {} } })])
    .concat(parts.map(p => sse({ type: 'content_block_delta', index: 1, delta: asText ? { type: 'text_delta', text: p } : { type: 'input_json_delta', partial_json: p } })))
    .concat([sse({ type: 'content_block_stop', index: 1 }), sse({ type: 'message_delta', delta: { stop_reason: asText ? 'end_turn' : 'tool_use' } }), sse({ type: 'message_stop' })]);
  const enc = new TextEncoder();
  return new ReadableStream({ async start(c) { for (const e of events) { c.enqueue(enc.encode(e)); await new Promise(r => setTimeout(r, 25)); } c.close(); } });
}
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  if (url.startsWith('https://api.stripe.com/v1')) {
    const p = url.slice('https://api.stripe.com/v1'.length), body = init.body ? Object.fromEntries(new URLSearchParams(init.body)) : {};
    log.push({ stripe: init.method + ' ' + p, body, version: init.headers['Stripe-Version'] });
    const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json' } });
    if (init.method === 'POST' && p === '/checkout/sessions') { const id = 'cs_test_' + Math.random().toString(36).slice(2) + 'abcdefghij'; sessions.set(id, { paid: false, success: body.success_url, gen: 0, meta: {}, params: body }); return J({ id, url: SITE + '/__mock_checkout?session=' + id }); }
    let m;
    if ((m = p.match(/^\/checkout\/sessions\/(.+)$/))) { const s = sessions.get(decodeURIComponent(m[1])); if (!s) return J({ error: { message: 'No such session' } }, 404); return J({ id: m[1], payment_status: s.paid ? 'paid' : 'unpaid', status: s.paid ? 'complete' : 'open', metadata: { producto: s.params['metadata[producto]'] }, payment_intent: 'pi_' + m[1], created: Math.floor(Date.now() / 1000), customer_details: { email: 'test@example.com' } }); }
    if ((m = p.match(/^\/payment_intents\/pi_([^?]+)(\?.*)?$/))) {
      const s = sessions.get(decodeURIComponent(m[1]));
      if (init.method === 'POST') {
        // claves de idempotencia como en Stripe: misma clave + otros datos → 400 idempotency_error; a la vez → 409
        const key = init.headers['Idempotency-Key'], sig = JSON.stringify(body);
        if (key) {
          const prev = idem.get(key);
          if (prev === 'en_curso') return J({ error: { type: 'idempotency_error', message: 'There is currently another in-progress request using this Idempotent Key' } }, 409);
          if (prev && prev !== sig) return J({ error: { type: 'idempotency_error', message: 'Keys for idempotent requests can only be used with the same parameters they were first used with.' } }, 400);
          if (prev === sig) return J({ id: 'pi_' + m[1], metadata: { ...s.meta } });
          idem.set(key, 'en_curso');
        }
        if (STRIPE_POST_FAIL) { idem.delete(key); return J({ error: { type: 'api_error', message: 'mock: Stripe caído' } }, 500); }
        await new Promise(r => setTimeout(r, 40));
        for (const [k, v] of Object.entries(body)) { const mk = k.match(/^metadata\[(.+)\]$/); if (mk) { if (v === '') delete s.meta[mk[1]]; else s.meta[mk[1]] = v; } }
        s.gen = +(s.meta.generaciones || 0); if (key) idem.set(key, sig); log.push({ counter: { ...s.meta } });
      }
      const pi = { id: 'pi_' + m[1], metadata: { ...s.meta }, latest_charge: 'ch_' + m[1] };
      if (m[2] && /expand/.test(m[2])) { if (NO_CHARGES) return J({ error: { type: 'invalid_request_error', message: 'The provided key does not have the required permissions' } }, 403); pi.latest_charge = { id: 'ch_' + m[1], refunded: !!s.refunded, disputed: false }; }
      return J(pi);
    }
    return J({ error: { message: 'mock: ruta no simulada ' + p } }, 400);
  }
  if (url.startsWith('https://api.anthropic.com/')) {
    aiCalls++; log.push({ ai: JSON.parse(init.body).model, headers: Object.keys(init.headers) , bodyLen: init.body.length, sent: JSON.parse(init.body).messages[0].content });
    if (FAIL_FIRST && aiCalls === 1) return new Response(JSON.stringify({ type: 'error', error: { type: 'overloaded_error' } }), { status: 529 });
    try { return new Response(aiStream(init.body), { status: 200, headers: { 'content-type': 'text/event-stream' } }); }
    catch (e) { return new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'mock: ' + e.message } }), { status: e.mockStatus || 400 }); }
  }
  return realFetch(url, init);
};
const fns = {};
for (const f of ['checkout', 'generate', 'estado']) { const mod = await import(path.join(ROOT, 'netlify/edge-functions', f + '.js')); fns[mod.config.path] = mod.default; }
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain' };
http.createServer(async (req, res) => {
  const u = new URL(req.url, SITE);
  if (u.pathname === '/__log') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ log, aiCalls, sessions: [...sessions].map(([k, v]) => ({ id: k, ...v })) })); return; }
  if (u.pathname === '/__meta') { const s = sessions.get(u.searchParams.get('session')); if (s) { Object.assign(s.meta, JSON.parse(u.searchParams.get('set') || '{}')); s.gen = +(s.meta.generaciones || 0); } res.end('ok'); return; }
  if (u.pathname === '/__refund') { const s = sessions.get(u.searchParams.get('session')); if (s) s.refunded = true; res.end('ok'); return; }
  if (u.pathname === '/__mark_paid') { const s = sessions.get(u.searchParams.get('session')); if (s) s.paid = true; res.end('ok'); return; }
  if (u.pathname === '/__mock_checkout') { const s = sessions.get(u.searchParams.get('session')); s.paid = true; res.writeHead(302, { location: s.success.replace('{CHECKOUT_SESSION_ID}', u.searchParams.get('session')) }); res.end(); return; }
  if (fns[u.pathname]) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const r = await fns[u.pathname](new Request(u, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) }));
    res.writeHead(r.status, Object.fromEntries(r.headers));
    if (r.body) { const rd = r.body.getReader(); res.on('close', () => { if (!res.writableEnded) rd.cancel().catch(() => {}); }); try { for (;;) { const { value, done } = await rd.read(); if (done) break; res.write(value); } } catch (e) { } }
    res.end(); return;
  }
  let f = path.join(ROOT, 'site', decodeURIComponent(u.pathname));
  if (u.pathname.endsWith('/')) f = path.join(f, 'index.html');
  if (!f.startsWith(path.join(ROOT, 'site')) || !fs.existsSync(f)) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log('mock server', SITE));
