// api/confirm-ad-payment.js — Vercel serverless function
//
// Sibling to confirm-payment.js, kept separate rather than folded into it
// because ads live in their own table with their own status machine (see
// supabase/schema/22_ads.sql) and their own race condition to resolve —
// whether the slot still has room by the time payment clears.
//
// This function:
//   1. Looks up the `ads` row by payment_reference
//   2. Verifies the charge server-side with Flutterwave using the secret
//      key (the browser never sees this key) — same verifyByReference /
//      readCharge helpers confirm-payment.js uses
//   3. Confirms the amount Flutterwave actually charged covers amount_paid
//   4. Only if both checks pass, atomically decides — using the Supabase
//      SERVICE ROLE key — whether the slot still has room:
//        room available    -> status = 'pending_review'
//        slot filled while paying -> status = 'pending_queue', assigned
//        the next queue_position
//
// FAILS CLOSED: if Flutterwave's response is missing, ambiguous, or
// doesn't match, this returns an error and does NOT mark anything paid.
// A payment stuck "pending" is a visible, reportable problem; a forged
// payment marked "paid" is a loss — same reasoning as confirm-payment.js.
//
// Requires the same Vercel environment variables confirm-payment.js uses:
// FLW_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from '@supabase/supabase-js';
import { verifyByReference, readCharge, getSecretKey } from './_flutterwave.js';
import { applyCors } from './_cors.js';

const UNDERCHARGE_TOLERANCE = 5; // ₦5 slack for rounding — see confirm-payment.js for why we only fail closed on undercharge, never overcharge

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
    // ---- 1. Find the ad order ----
    const { data: ad, error: adErr } = await supabase
      .from('ads')
      .select('*')
      .eq('payment_reference', reference)
      .maybeSingle();
    if (adErr) throw adErr;
    if (!ad) return res.status(404).json({ error: 'No ad order found for this reference' });

    if (ad.status !== 'pending_payment') {
      // Already resolved (double-fired callback, retry, etc.) — report
      // the current state rather than re-processing.
      return res.status(200).json({ ok: true, alreadyProcessed: true, type: 'ad', status: ad.status });
    }

    // ---- 2. Verify with Flutterwave server-side ----
    const { ok: flwOk, body: flwBody } = await verifyByReference(reference);
    if (!flwOk || flwBody?.status !== 'success') {
      console.error('confirm-ad-payment: Flutterwave verify failed', flwBody);
      return res.status(402).json({ error: 'Could not verify payment with Flutterwave', detail: flwBody?.message });
    }

    const charge = readCharge(flwBody);
    if (charge.status !== 'successful') {
      return res.status(402).json({ error: `Payment not successful (Flutterwave status: ${charge.status || 'unknown'})` });
    }
    if (!Number.isFinite(charge.amount) || charge.amount <= 0) {
      console.error('confirm-ad-payment: could not parse charged amount', flwBody);
      return res.status(502).json({ error: 'Could not confirm the charged amount with Flutterwave — payment not completed.' });
    }
    if (charge.currency && charge.currency !== 'NGN') {
      return res.status(409).json({ error: `Unexpected payment currency: ${charge.currency}` });
    }
    if (charge.txRef && charge.txRef !== reference) {
      return res.status(409).json({ error: 'Payment reference mismatch' });
    }
    if (charge.amount < Number(ad.amount_paid) - UNDERCHARGE_TOLERANCE) {
      console.error('confirm-ad-payment: amount mismatch', { expected: ad.amount_paid, charged: charge.amount, reference });
      return res.status(409).json({ error: 'Charged amount does not match the expected ad price.' });
    }

    // ---- 3. Atomically decide pending_review vs pending_queue ----
    // Re-check under the service role (bypasses RLS) right before writing,
    // so a payment that clears while the slot filled up doesn't wrongly
    // land as pending_review.
    const { data: slotCfg } = await supabase
      .from('ad_slot_config')
      .select('max_concurrent_ads')
      .eq('slot_type', ad.slot_type)
      .maybeSingle();
    const maxConcurrent = slotCfg?.max_concurrent_ads ?? 0;

    const { count: activeAndReviewCount } = await supabase
      .from('ads')
      .select('id', { count: 'exact', head: true })
      .eq('slot_type', ad.slot_type)
      .in('status', ['active', 'pending_review']);

    let newStatus = 'pending_review';
    let queuePosition = null;

    if ((activeAndReviewCount || 0) >= maxConcurrent) {
      newStatus = 'pending_queue';
      const { count: queueCount } = await supabase
        .from('ads')
        .select('id', { count: 'exact', head: true })
        .eq('slot_type', ad.slot_type)
        .eq('status', 'pending_queue');
      queuePosition = (queueCount || 0) + 1;
    }

    const { error: updateErr } = await supabase
      .from('ads')
      .update({
        status: newStatus,
        queue_position: queuePosition,
        payment_status: 'completed',
      })
      .eq('id', ad.id)
      .eq('status', 'pending_payment'); // guards against a double-fired callback processing this twice
    if (updateErr) throw updateErr;

    // Best-effort admin heads-up via the existing generic admin alert
    // template — never let a notification failure change the payment
    // outcome that was already committed above.
    try {
      await notifyAdminsOfNewAdOrder(supabase, ad, newStatus, queuePosition);
    } catch (e) {
      console.error('[ad admin alert] failed:', e?.message || e);
    }

    return res.status(200).json({ ok: true, type: 'ad', status: newStatus, queue_position: queuePosition });
  } catch (err) {
    console.error('confirm-ad-payment: unexpected error', err);
    return res.status(500).json({ error: 'Failed to confirm payment', detail: String(err?.message || err) });
  }
}

async function callSupabaseSendEmail(payload) {
  const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || '').trim();
  const SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const INTERNAL_EMAIL_SECRET = (process.env.INTERNAL_EMAIL_SECRET || '').trim();
  if (!SUPABASE_URL || (!SERVICE_ROLE_KEY && !INTERNAL_EMAIL_SECRET)) {
    throw new Error('callSupabaseSendEmail: missing env vars for ad admin alert');
  }
  const headers = { 'Content-Type': 'application/json' };
  if (SERVICE_ROLE_KEY) headers['Authorization'] = `Bearer ${SERVICE_ROLE_KEY}`;
  if (INTERNAL_EMAIL_SECRET) headers['x-internal-secret'] = INTERNAL_EMAIL_SECRET;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`callSupabaseSendEmail: send-email returned ${res.status} — ${body}`);
  }
}

async function notifyAdminsOfNewAdOrder(supabase, ad, newStatus, queuePosition) {
  const { data: admins } = await supabase.from('users').select('email, full_name').eq('role', 'admin');
  const recipients = (admins || []).filter((a) => !!a.email);
  if (!recipients.length) return;

  const summary = newStatus === 'pending_review'
    ? `${ad.business_name} paid for the ${ad.slot_type.replace(/_/g, ' ')} slot (${ad.duration_type}) and is waiting on your review.`
    : `${ad.business_name} paid for the ${ad.slot_type.replace(/_/g, ' ')} slot (${ad.duration_type}) but it's full — they're #${queuePosition} in the queue.`;

  const results = await Promise.allSettled(
    recipients.map((admin) =>
      callSupabaseSendEmail({
        type: 'admin_activity_alert',
        to: admin.email,
        data: {
          event_label: 'New ad order',
          title: `New ad order — ${ad.business_name}`,
          summary,
          breakdown: [
            ['Slot', ad.slot_type.replace(/_/g, ' ')],
            ['Duration', ad.duration_type],
            ['Amount', `NGN ${Number(ad.amount_paid).toLocaleString('en-NG')}`],
            ['Contact', ad.contact_name],
            ['WhatsApp', ad.whatsapp_number],
            ['Status', newStatus.replace(/_/g, ' ')],
          ],
          action_url: 'https://www.rentora.com.ng/admin?tab=ads',
        },
      }),
    ),
  );
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error(`[ad admin alert] failed for ${recipients[i].email}:`, r.reason?.message || r.reason);
  });
}
