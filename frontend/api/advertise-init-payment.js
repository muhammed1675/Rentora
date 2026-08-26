// api/advertise-init-payment.js — Vercel serverless function
//
// The ONLY place an advertising payment should ever be initialized.
// Previously Advertise.jsx sent `amount: total` — a number computed in
// the browser from state the browser also controlled — straight to
// /api/korapay-init. Anyone could edit that request and check out for ₦1
// while the ad still recorded whatever price it wanted. This endpoint
// replaces that call for ads specifically, without touching
// /api/korapay-init.js (shared by rent / inspection / token flows, out
// of scope here).
//
// Schema note: `ads` has no `payment_reference` column and none is being
// added (no migrations here). Instead, the Korapay reference is derived
// from the advert's own UUID: `ADV-<ad.id>-<timestamp>`. confirm-payment.js
// parses the ad_id back out of that reference and re-reads the ad row —
// there's nothing extra to store or keep in sync.
//
// This function:
//   1. Confirms the caller is signed in and owns the advert (server-side,
//      via their own JWT — never a client-asserted user id).
//   2. Looks up the advert's slot in `ad_slot_config` and computes the
//      price from ITS stored weekly/monthly rates and the advert's own
//      starts_at/ends_at — never from anything the browser sent.
//   3. Writes that computed price onto the ad row (`price`, `billing_period`)
//      using the SERVICE ROLE key (bypasses RLS — safe here because this
//      code never runs in the browser). `price` is what
//      /api/confirm-payment.js later checks the Korapay-verified charge
//      against; `amount_paid` is left alone until payment actually clears.
//   4. Initializes the Korapay charge server-side with that amount.
//
// Requires the same env vars as the rest of the payment stack:
//   - KORAPAY_SECRET_KEY
//   - SUPABASE_SERVICE_ROLE_KEY
//   - SUPABASE_URL (or REACT_APP_SUPABASE_URL)

import { createClient } from '@supabase/supabase-js';
import { korapayFetch } from './_korapay.js';
import { applyCors } from './_cors.js';
import { computeAdTotal, billingPeriodLabel } from './_advertising.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { ad_id, redirect_url: redirectBase } = req.body || {};
  if (!ad_id || !redirectBase) return res.status(400).json({ error: 'Missing ad_id or redirect_url' });

  // The reference doesn't exist yet at the point the client builds this URL
  // (it's generated below), so the client sends only the base callback URL
  // and this endpoint appends `?reference=...` itself. Any query string the
  // client did include is ignored.
  let redirectUrlObj;
  try {
    redirectUrlObj = new URL(redirectBase);
  } catch {
    return res.status(400).json({ error: 'Invalid redirect_url' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('advertise-init-payment: missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    return res.status(500).json({ error: 'Advertising payments are not configured on the server yet.' });
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // ---- 1. Verify the caller is signed in and owns this advert ----
  const authHeader = req.headers.authorization || '';
  const jwt = authHeader.replace('Bearer ', '').trim();
  if (!jwt) return res.status(401).json({ error: 'Missing authorization token' });

  const { data: authData, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !authData?.user) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }

  const { data: ad, error: adErr } = await supabase.from('ads').select('*').eq('id', ad_id).maybeSingle();
  if (adErr) {
    console.error('advertise-init-payment: failed to load ad', adErr.message);
    return res.status(500).json({ error: 'Failed to load advert.' });
  }
  if (!ad) return res.status(404).json({ error: 'Advert not found.' });
  if (ad.user_id !== authData.user.id) return res.status(403).json({ error: 'This advert does not belong to you.' });

  if (ad.payment_status === 'paid' || ad.payment_status === 'completed') {
    return res.status(200).json({ status: true, data: { alreadyPaid: true } });
  }

  // ---- 2. Price the advert from ad_slot_config — NEVER from the browser ----
  const { data: slotConfig, error: slotErr } = await supabase
    .from('ad_slot_config')
    .select('*')
    .eq('slot', ad.slot)
    .maybeSingle();
  if (slotErr || !slotConfig) return res.status(400).json({ error: 'Unknown ad placement — cannot price this advert.' });

  const startsAt = ad.starts_at ? new Date(ad.starts_at) : null;
  const endsAt = ad.ends_at ? new Date(ad.ends_at) : null;
  const durationDays = startsAt && endsAt ? Math.round((endsAt.getTime() - startsAt.getTime()) / 86400000) : null;

  const amount = computeAdTotal(slotConfig, durationDays);
  if (!amount) {
    return res.status(400).json({ error: 'Could not determine a valid price for this campaign duration. Supported durations are 7, 14, or 30 days.' });
  }

  // ---- 3. Customer details for the checkout ----
  const { data: buyer } = await supabase.from('users').select('email, full_name, phone').eq('id', authData.user.id).maybeSingle();
  if (!buyer?.email) return res.status(400).json({ error: 'Your account has no email on file — cannot start checkout.' });

  // ---- 4. Record the EXPECTED price on the ad itself (never in the request
  // body) — this is what confirm-payment.js checks the verified Korapay
  // charge against. Conditioned on payment_status='pending' as a claim, so
  // a stray call against an already-paid/processing ad can't reprice it.
  const { data: claimedAd, error: updateErr } = await supabase
    .from('ads')
    .update({ price: amount, billing_period: billingPeriodLabel(durationDays) })
    .eq('id', ad.id)
    .eq('payment_status', 'pending')
    .select('id')
    .maybeSingle();
  if (updateErr) {
    console.error('advertise-init-payment: failed to record expected price', updateErr.message);
    return res.status(500).json({ error: 'Failed to prepare payment.' });
  }
  if (!claimedAd) {
    return res.status(409).json({ error: 'This advert is no longer awaiting payment. Refresh and try again.' });
  }

  // ---- 5. Derive a unique Korapay reference from the ad's own UUID — no
  // extra column needed. confirm-payment.js reverses this to find the ad.
  const reference = `ADV-${ad.id}-${Date.now()}`;
  redirectUrlObj.searchParams.set('reference', reference);
  const redirect_url = redirectUrlObj.toString();

  // ---- 6. Initialize the charge server-side ----
  try {
    const result = await korapayFetch('/charges/initialize', {
      method: 'POST',
      body: JSON.stringify({
        reference,
        amount,
        currency: 'NGN',
        redirect_url,
        customer: { name: ad.full_name || buyer.full_name || 'Advertiser', email: buyer.email, phone: ad.whatsapp_number || buyer.phone || undefined },
        narration: `Rentora advert — ${ad.slot}`,
      }),
    });
    if (!result.ok || result.body?.status === false) {
      return res.status(result.ok ? 502 : result.status).json({ error: result.body?.message || 'Korapay checkout unavailable' });
    }
    return res.status(200).json({
      status: true,
      data: {
        reference,
        amount,
        checkout_url: result.body?.data?.checkout_url || result.body?.data?.checkoutUrl,
      },
    });
  } catch (error) {
    if (error.code === 'not_configured') return res.status(500).json({ error: 'Payment service is not configured' });
    console.error('[advertise-init-payment]', error);
    return res.status(500).json({ error: 'Failed to initialize payment' });
  }
}
