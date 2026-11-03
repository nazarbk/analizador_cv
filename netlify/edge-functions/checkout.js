// POST /api/checkout → crea la sesión de pago de Stripe y devuelve su URL.
import { env, json, stripe, checkoutParams } from '../shared/pro.js';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'metodo_no_permitido' }, 405);
  if (!env('STRIPE_SECRET_KEY')) return json({ error: 'pagos_no_configurados' }, 503);
  // se vuelve a la misma web desde la que se paga (producción o vista previa de Netlify): el CV guardado en el navegador es de ese dominio
  const here = new URL(req.url).origin, site = (here.startsWith('https://') || here.startsWith('http://127.0.0.1') ? here : (env('SITE_URL') || here)).replace(/\/$/, '');
  const origin = req.headers.get('origin');
  if (origin && origin !== here) return json({ error: 'origen_no_permitido' }, 403);
  try {
    const s = await stripe('POST', '/checkout/sessions', checkoutParams(site));
    return json({ url: s.url, id: s.id });
  } catch (e) {
    console.error('checkout', e.message);
    return json({ error: 'stripe_no_disponible' }, 502);
  }
};
export const config = { path: '/api/checkout' };
