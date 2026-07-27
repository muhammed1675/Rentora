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
  try {
    // Log that webhook was called
    console.log('[webhook] Called with method:', req.method, 'from IP:', req.headers['x-forwarded-for']);

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const expectedHash = process.env.FLW_WEBHOOK_HASH;
    const signature = req.headers['verif-hash'];

    if (!expectedHash) {
      console.error('[webhook] ERROR: FLW_WEBHOOK_HASH environment variable is not set');
      // Return 500 so Flutterwave knows there's a server config issue
      return res.status(500).json({ error: 'Server not configured - FLW_WEBHOOK_HASH missing' });
    }

    if (!signature) {
      console.warn('[webhook] WARNING: No verif-hash header in request');
      return res.status(401).json({ error: 'Missing verif-hash header' });
    }

    if (signature !== expectedHash) {
      console.warn('[webhook] ERROR: Signature mismatch. Expected:', expectedHash.substring(0, 10) + '...', 'Got:', signature.substring(0, 10) + '...');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse payload - handle both JSON and form-encoded
    let payload = {};
    if (req.body) {
      if (typeof req.body === 'string') {
        try {
          payload = JSON.parse(req.body);
        } catch (e) {
          console.error('[webhook] Failed to parse body as JSON:', e.message);
          payload = req.body;
        }
      } else {
        payload = req.body;
      }
    }

    console.log('[webhook] Payload received:', JSON.stringify(payload).substring(0, 300));

    // Extract reference from multiple possible locations in Flutterwave payload
    const reference =
      payload?.data?.tx_ref ||
      payload?.txRef ||
      payload?.data?.reference ||
      payload?.tx_ref ||
      payload?.reference ||
      null;

    if (!reference) {
      console.error('[webhook] ERROR: No tx_ref found in payload. Payload keys:', Object.keys(payload).join(', '));
      // Return 200 because there's nothing we can do with a bad payload
      return res.status(200).json({ received: true, error: 'No reference in payload' });
    }

    console.log('[webhook] ✓ Processing payment for reference:', reference);

    // Reuse the verified confirmation handler — it re-checks status and amount
    // with Flutterwave before touching the database, and is idempotent.
    const fakeRes = {
      _status: 200,
      _body: null,
      status(code) { this._status = code; return this; },
      json(body) { this._body = body; return this; },
      end() { return this; },
      setHeader() {},
    };

    await confirmPayment(
      { method: 'POST', body: { reference }, headers: {} },
      fakeRes
    );

    console.log('[webhook] ✓ Confirmation complete. Status:', fakeRes._status, 'Response:', JSON.stringify(fakeRes._body).substring(0, 200));

    // Always 200 so Flutterwave stops retrying a payload we've seen
    return res.status(200).json({ received: true, reference, processed: fakeRes._status === 200 });
  } catch (err) {
    console.error('[webhook] ✗ Unexpected error:', err?.message || err, 'Stack:', err?.stack);
    // Return 500 so Flutterwave retries (it's a server error)
    return res.status(500).json({ error: 'Server error', message: err?.message || 'Unknown error' });
  }
}
