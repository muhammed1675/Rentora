// api/_ads.js — shared ad-payment confirmation logic
//
// Split out from confirm-ad-payment.js so the exact same verify-then-write
// logic can also run from inside confirm-payment.js. Why that's necessary:
// Flutterwave's server-side webhook is configured with ONE fixed URL in
// the Flutterwave dashboard for the whole merchant account — it has no
// idea a new /advertise feature or a confirm-ad-payment.js endpoint
// exists, and will keep posting every transaction (tokens, inspections,
// rent, tips, and now ads) to whatever URL was already configured there
// (confirm-payment.js). Without this, ad payments confirmed server-side
// by Flutterwave's webhook — as opposed to the client-triggered call
// right after checkout — would 404 as "no transaction found," which is
// exactly the "Unknown payment / Payment FAILED" admin alert this fixes.
//
// FAILS CLOSED, same as confirm-payment.js: ambiguous/missing/mismatched
// verification never marks anything paid.

import { verifyByReference, readCharge } from './_flutterwave.js';

const UNDERCHARGE_TOLERANCE = 5; // ₦5 slack for rounding

// Returns { status, body } (Express-response-shaped) — the same result
// shape callers of confirm-payment.js already use to build their own
// success/failure response, so both endpoints report identically.
export async function confirmAdPaymentByReference(supabase, reference) {
  const { data: ad, error: adErr } = await supabase
    .from('ads')
    .select('*')
    .eq('payment_reference', reference)
    .maybeSingle();
  if (adErr) throw adErr;
  if (!ad) return null; // not an ad reference at all — let the caller try other tables

  if (ad.status !== 'pending_payment') {
    // Already resolved (double-fired callback, retry, etc.)
    return { status: 200, body: { ok: true, alreadyProcessed: true, type: 'ad', status: ad.status } };
  }

  const { ok: flwOk, body: flwBody } = await verifyByReference(reference);
  if (!flwOk || flwBody?.status !== 'success') {
    console.error('confirmAdPaymentByReference: Flutterwave verify failed', flwBody);
    return { status: 402, body: { error: 'Could not verify payment with Flutterwave', detail: flwBody?.message } };
  }

  const charge = readCharge(flwBody);
  if (charge.status !== 'successful') {
    return { status: 402, body: { error: `Payment not successful (Flutterwave status: ${charge.status || 'unknown'})` } };
  }
  if (!Number.isFinite(charge.amount) || charge.amount <= 0) {
    console.error('confirmAdPaymentByReference: could not parse charged amount', flwBody);
    return { status: 502, body: { error: 'Could not confirm the charged amount with Flutterwave — payment not completed.' } };
  }
  if (charge.currency && charge.currency !== 'NGN') {
    return { status: 409, body: { error: `Unexpected payment currency: ${charge.currency}` } };
  }
  if (charge.txRef && charge.txRef !== reference) {
    return { status: 409, body: { error: 'Payment reference mismatch' } };
  }
  if (charge.amount < Number(ad.amount_paid) - UNDERCHARGE_TOLERANCE) {
    console.error('confirmAdPaymentByReference: amount mismatch', { expected: ad.amount_paid, charged: charge.amount, reference });
    return { status: 409, body: { error: 'Charged amount does not match the expected ad price.' } };
  }

  // Atomically decide pending_review vs pending_queue — re-checked under
  // the service role right before writing, so a payment that clears
  // while the slot filled up doesn't wrongly land as pending_review.
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
    .update({ status: newStatus, queue_position: queuePosition, payment_status: 'completed' })
    .eq('id', ad.id)
    .eq('status', 'pending_payment'); // guards against a double-fired callback/webhook processing this twice
  if (updateErr) throw updateErr;

  try {
    await notifyAdminsOfNewAdOrder(supabase, ad, newStatus, queuePosition);
  } catch (e) {
    console.error('[ad admin alert] failed:', e?.message || e);
  }

  return { status: 200, body: { ok: true, type: 'ad', status: newStatus, queue_position: queuePosition } };
}

// Looked up by confirm-payment.js's own admin-alert notifier so an ad
// payment that lands there (via the webhook path above) shows up
// correctly labeled instead of "Unknown payment".
export async function findAdByReference(supabase, reference) {
  const { data } = await supabase.from('ads').select('*').eq('payment_reference', reference).maybeSingle();
  return data || null;
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

export async function notifyAdminsOfNewAdOrder(supabase, ad, newStatus, queuePosition) {
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
