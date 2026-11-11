// GET /api/estado?session_id=… → indica si un pedido está pagado y cuántas generaciones le quedan (sin generar nada).
import { env, json, verifyPurchase, MAX_GENERATIONS } from '../shared/pro.js';

export default async (req) => {
  if (!env('STRIPE_SECRET_KEY')) return json({ disponible: false, error: 'pagos_no_configurados' }, 200);
  const id = new URL(req.url).searchParams.get('session_id');
  if (!id) return json({ disponible: true });
  // Siempre responde 200 con el estado del pedido: el navegador lo usa para saber cuántos informes le quedan.
  const v = await verifyPurchase(id);
  const base = { disponible: true, max: MAX_GENERATIONS, caduca: v.caduca || null };
  if (v.ok) return json(Object.assign(base, { estado: 'pagado', restantes: v.restantes, en_curso: v.enCurso || 0 }));
  if (v.error === 'generacion_en_curso') return json(Object.assign(base, { estado: 'pagado', restantes: 0, en_curso: v.enCurso, error: v.error }));
  const estado = { pago_no_completado: 'pendiente', limite_generaciones: 'agotado', pedido_caducado: 'caducado', pedido_reembolsado: 'reembolsado', pedido_no_encontrado: 'no_existe', pedido_no_valido: 'no_existe' }[v.error] || 'desconocido';
  return json(Object.assign(base, { estado, restantes: 0, error: v.error }));
};
export const config = { path: '/api/estado' };
