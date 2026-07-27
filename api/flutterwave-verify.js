// api/flutterwave-verify.js
// Vercel serverless function — verifies a payment server-side.
// Replaces the old api/korapay-verify.js.

import { verifyByReference, readCharge } from './_flutterwave.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { reference } = req.query;
  if (!reference) return res.status(400).json({ error: 'Missing reference' });

  try {
    const { ok, status, body } = await verifyByReference(reference);

    if (!ok) {
      return res.status(status).json({ error: body?.message || 'Flutterwave error', data: body });
    }

    const charge = readCharge(body);
    return res.status(200).json({
      status: charge.status === 'successful',
      data: { ...charge, raw: body?.data },
    });
  } catch (err) {
    if (err.code === 'not_configured') {
      return res.status(500).json({ error: 'Payment service not configured' });
    }
    console.error('Flutterwave verify error:', err);
    return res.status(500).json({ error: 'Failed to verify payment' });
  }
}
