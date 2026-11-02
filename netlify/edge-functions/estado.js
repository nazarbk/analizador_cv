// GET /api/estado?session_id=… → indica si un pedido está pagado y cuántas generaciones le quedan (sin generar nada).
import { env, json, verifyPurchase, MAX_GENERATIONS } from '../shared/pro.js';

export default async (req) => {
  if (!env('STRIPE_SECRET_KEY')) return json({ disponible: false, error: 'pagos_no_configurados' }, 200);
  const id = new URL(req.url).searchParams.get('session_id');
  if (!id) return json({ disponible: true });
  const v = await verifyPurchase(id);
  if (!v.ok) return json({ disponible: true, pagado: v.error !== 'pago_no_completado' && v.error !== 'pedido_no_encontrado' && v.error !== 'pedido_no_valido', error: v.error, restantes: v.error === 'limite_generaciones' ? 0 : undefined }, v.status === 429 ? 200 : v.status);
  return json({ disponible: true, pagado: true, restantes: MAX_GENERATIONS - v.used });
};
export const config = { path: '/api/estado' };
