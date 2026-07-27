// api/flutterwave-webhook.js
// Vercel serverless function — Flutterwave calls this when a charge completes.
//
// Why you want it: the browser callback can be lost (user closes the tab,
// network drops, bank redirect fails). The webhook is the reliable path that
// still marks a genuine payment as paid.
//
// Setup: Flutterwave Dashboard → Settings → Webhooks
//   URL:         https://<your-domain>/api/flutterwave-webhook
//   Secret hash: the same value you store as FLW_WEBHOOK_HASH in Vercel
//
// It never trusts the payload: it only takes the tx_ref out of it and then
// re-runs the same verified confirmation path as /api/confirm-payment.

import confirmPayment from './confirm-payment.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const expectedHash = process.env.FLW_WEBHOOK_HASH;
  const signature = req.headers['verif-hash'];

  if (!expectedHash) {
    console.error('flutterwave-webhook: FLW_WEBHOOK_HASH not configured');
    return res.status(500).json({ error: 'Webhook not configured' });
  }
  if (!signature || signature !== expectedHash) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const payload = req.body || {};
  const reference =
    payload?.data?.tx_ref || payload?.txRef || payload?.data?.reference || null;

  if (!reference) {
    return res.status(400).json({ error: 'No tx_ref in payload' });
  }

  // Reuse the verified confirmation handler — it re-checks status and amount
  // with Flutterwave before touching the database, and is idempotent.
  const fakeRes = {
    _status: 200,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
    end() { return this; },
    setHeader() {},
  };

  await confirmPayment({ method: 'POST', body: { reference }, headers: {} }, fakeRes);

  console.log('flutterwave-webhook processed', reference, fakeRes._status, fakeRes._body);

  // Always 200 so Flutterwave stops retrying a payload we've seen; real
  // failures are visible in the logs above.
  return res.status(200).json({ received: true });
}
