// Pruebas del contador del Informe Pro contra el servidor simulado (Stripe con claves de idempotencia reales).
// Uso: node test/counter_test.mjs
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const errs = [];
const check = (label, ok) => { console.log((ok ? 'OK   ' : 'FALLO') + ' ' + label); if (!ok) errs.push(label); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function server(port, extra = {}) {
  const p = spawn(process.execPath, [path.join(HERE, 'pro_server.mjs'), String(port)], { env: { ...process.env, ...extra }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise(r => p.stdout.once('data', r));
  const B = 'http://127.0.0.1:' + port;
  const api = {
    B, stop: () => p.kill(),
    async buy() { const r = await fetch(B + '/api/checkout', { method: 'POST', headers: { origin: B } }); const d = await r.json(); await fetch(B + '/__mark_paid?session=' + d.id); return d.id; },
    async log() { return (await fetch(B + '/__log')).json(); },
    async meta(sid) { return (await api.log()).sessions.find(s => s.id === sid).meta; },
    async estado(sid) { return (await fetch(B + '/api/estado?session_id=' + sid)).json(); },
    async gen(sid, abortAfterMs) {
      const ctl = new AbortController(); if (abortAfterMs) setTimeout(() => ctl.abort(), abortAfterMs);
      const body = { session_id: sid, lang: 'es', offer: 'Buscamos Backend Developer con Python, AWS, Docker y SQL. '.repeat(5), cv: { exp: [{ indice: 0, puesto: 'Backend Developer', empresa: 'Acme', descripcion: 'APIs en Python' }], proyectos: [], skills: ['Python'] } };
      try {
        const r = await fetch(B + '/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
        if (!r.ok) return { status: r.status, error: (await r.json()).error };
        const t = await r.text(); const m = t.match(/event: informe_pro\ndata: (.+)/);
        return { status: 200, done: !!m, info: m && JSON.parse(m[1]) };
      } catch (e) { return { status: 0, aborted: true }; }
    }
  };
  return api;
}

// 1. Cinco peticiones a la vez con una compra de 3 informes
{
  const s = await server(8851); const sid = await s.buy();
  const res = await Promise.all([1, 2, 3, 4, 5].map(() => s.gen(sid)));
  const ok = res.filter(r => r.done).length, rej = res.filter(r => r.status === 409 || r.status === 429).length;
  check('5 peticiones simultáneas: como mucho 3 informes (' + ok + ' generados, ' + rej + ' rechazados)', ok <= 3 && ok + rej === 5);
  let m = await s.meta(sid);
  check('el contador coincide con los informes entregados (' + m.generaciones + ')', +m.generaciones === ok);
  check('no quedan reservas abiertas', !m.reservas);
  // completar hasta 3 y comprobar el límite
  for (let i = ok; i < 3; i++) await s.gen(sid);
  const extra = await s.gen(sid); m = await s.meta(sid);
  check('con 3 informes, el 4.º se rechaza (' + extra.status + ' ' + extra.error + ')', extra.status === 429 && +m.generaciones === 3);
  const e = await s.estado(sid); check('estado: agotado', e.estado === 'agotado' && e.restantes === 0);
  check('la IA solo se llamó para los informes contados', (await s.log()).aiCalls === 3 + (5 - ok - rej));
  s.stop();
}
// 2. La IA falla → la reserva se devuelve
{
  const s = await server(8852, { MOCK_FAIL_FIRST: '1' }); const sid = await s.buy();
  const r1 = await s.gen(sid); let m = await s.meta(sid);
  check('fallo de la IA: error y no se gasta el informe', r1.status === 502 && (+m.generaciones || 0) === 0 && !m.reservas);
  const r2 = await s.gen(sid); m = await s.meta(sid);
  check('al reintentar se genera y cuenta 1', r2.done && +m.generaciones === 1 && r2.info.generaciones === 1 && r2.info.contado === true);
  s.stop();
}
// 3. Stripe no deja escribir → no se genera nada (no se regalan informes)
{
  const s = await server(8853, { MOCK_STRIPE_POST_FAIL: '1' }); const sid = await s.buy();
  const r = await s.gen(sid); const l = await s.log();
  check('contador no disponible: no se llama a la IA (' + r.status + ' ' + r.error + ')', r.status === 502 && r.error === 'stripe_no_disponible' && l.aiCalls === 0);
  s.stop();
}
// 4. La persona cierra la pestaña a mitad → se devuelve la reserva
{
  const s = await server(8854); const sid = await s.buy();
  const r = await s.gen(sid, 120); await sleep(800); const m = await s.meta(sid);
  check('conexión cortada a mitad: no cuenta y libera la reserva', r.aborted && (+m.generaciones || 0) === 0 && !m.reservas);
  s.stop();
}
// 5. Compras antiguas (solo «generaciones») y reservas caducadas
{
  const s = await server(8855); const sid = await s.buy();
  await fetch(s.B + '/__meta?session=' + sid + '&set=' + encodeURIComponent(JSON.stringify({ generaciones: '1' })));
  let r = await s.gen(sid); let m = await s.meta(sid);
  check('compra con el formato anterior: sigue contando (1 → 2)', r.done && +m.generaciones === 2);
  const old = Math.floor(Date.now() / 1000) - 3600;
  await fetch(s.B + '/__meta?session=' + sid + '&set=' + encodeURIComponent(JSON.stringify({ reservas: 'zzzz:' + old })));
  const e = await s.estado(sid); check('una reserva de hace 1 hora (función cortada) no bloquea', e.restantes === 1);
  r = await s.gen(sid); m = await s.meta(sid);
  check('y se limpia al escribir', r.done && +m.generaciones === 3 && !m.reservas);
  s.stop();
}
console.log('errors', errs); process.exit(errs.length ? 1 : 0);
