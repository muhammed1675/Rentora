// api/confirm-ad-payment.js — Vercel serverless function
//
// The client-triggered confirmation call right after Flutterwave checkout
// succeeds in the browser — see openFlutterwaveCheckout's confirmEndpoint
// param in lib/flutterwave.js. The actual verify-then-write logic lives in
// _ads.js and is shared with confirm-payment.js, which also handles ad
// references when Flutterwave's own server-side webhook (one fixed URL
// for the whole merchant account) posts here instead — see the comment
// at the top of _ads.js for why that matters.
//
// FAILS CLOSED: if Flutterwave's response is missing, ambiguous, or
// doesn't match, this returns an error and does NOT mark anything paid.
//
// Requires the same Vercel environment variables confirm-payment.js uses:
// FLW_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from '@supabase/supabase-js';
import { getSecretKey } from './_flutterwave.js';
import { applyCors } from './_cors.js';
import { confirmAdPaymentByReference } from './_ads.js';

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { reference } = req.body || {};
  if (!reference) return res.status(400).json({ error: 'Missing reference' });

  const secretKey = getSecretKey();
  const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secretKey || !supabaseUrl || !serviceRoleKey) {
    console.error('confirm-ad-payment: missing required env vars', {
      hasSecretKey: !!secretKey, hasUrl: !!supabaseUrl, hasServiceKey: !!serviceRoleKey,
    });
    return res.status(500).json({ error: 'Payment confirmation is not configured on the server yet.' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const result = await confirmAdPaymentByReference(supabase, reference);
    if (!result) return res.status(404).json({ error: 'No ad order found for this reference' });
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('confirm-ad-payment: unexpected error', err);
    return res.status(500).json({ error: 'Failed to confirm payment', detail: String(err?.message || err) });
  }
}
