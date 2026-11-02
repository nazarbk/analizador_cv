// POST /api/checkout → crea la sesión de pago de Stripe y devuelve su URL.
import { env, json, stripe, checkoutParams } from '../shared/pro.js';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'metodo_no_permitido' }, 405);
  if (!env('STRIPE_SECRET_KEY')) return json({ error: 'pagos_no_configurados' }, 503);
  const site = (env('SITE_URL') || new URL(req.url).origin).replace(/\/$/, '');
  const origin = req.headers.get('origin');
  if (origin && origin !== site && origin !== new URL(req.url).origin) return json({ error: 'origen_no_permitido' }, 403);
  try {
    const s = await stripe('POST', '/checkout/sessions', checkoutParams(site));
    return json({ url: s.url, id: s.id });
  } catch (e) {
    console.error('checkout', e.message);
    return json({ error: 'stripe_no_disponible' }, 502);
  }
};
export const config = { path: '/api/checkout' };
