import { korapayFetch } from './_korapay.js';
import { applyCors } from './_cors.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { reference, amount, currency = 'NGN', customer, redirect_url, narration } = req.body || {};
  const numericAmount = Number(amount);
  if (!reference || !Number.isInteger(numericAmount) || numericAmount <= 0 || !customer?.email || !redirect_url) return res.status(400).json({ error: 'Invalid payment details' });
  try {
    const result = await korapayFetch('/charges/initialize', { method: 'POST', body: JSON.stringify({ reference, amount: numericAmount, currency, redirect_url, customer: { name: customer.name || 'Customer', email: customer.email, phone: customer.phone || undefined }, narration: narration || 'Rentora payment' }) });
    if (!result.ok || result.body?.status === false) return res.status(result.ok ? 502 : result.status).json({ error: result.body?.message || 'Korapay checkout unavailable' });
    return res.status(200).json({ status: true, data: { reference, checkout_url: result.body?.data?.checkout_url || result.body?.data?.checkoutUrl } });
  } catch (error) {
    if (error.code === 'not_configured') return res.status(500).json({ error: 'Payment service is not configured' });
    console.error('[korapay-init]', error);
    return res.status(500).json({ error: 'Failed to initialize payment' });
  }
}
