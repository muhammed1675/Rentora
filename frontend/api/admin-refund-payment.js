// api/admin-refund-payment.js — Vercel serverless function
//
// The ONLY place a held rent payment should ever be refunded. Called from
// the Admin Dashboard's Escrow tab when a house turns out not to actually
// be available after a student has already paid.
//
// Why this exists: because of the escrow design, a "held" payment was never
// disbursed to the agent — Rentora is just sitting on it until move-in is
// confirmed. So resolving "the house isn't available" doesn't need any
// clawback; it's a clean refund of money that was never released.
//
// This endpoint does THREE things atomically-in-spirit (each step checked,
// each failure handled explicitly, nothing left half-done silently):
//   1. Confirms the caller is an admin (server-side, via their own JWT —
//      never trust a role claim from the browser).
//   2. Refunds the FULL amount via Flutterwave, server-side, using the
//      secret key (never exposed to the browser).
//   3. Only on confirmed refund success: marks the payment 'refunded' and
//      soft-delists the property (status = 'rejected') so it drops out of
//      every public listing query immediately and permanently — it does
//      NOT go back to 'available'. An admin can manually re-approve it
//      later if the agent proves the listing was actually fine.
//
// FAILS CLOSED, same principle as confirm-payment.js: if Flutterwave's
// refund call doesn't clearly succeed, the payment is left in
// 'refund_processing' (not silently reverted to 'held' and not marked
// 'refunded') so it shows up for an admin to retry or resolve manually —
// never guess.
//
// Requires the same env vars as confirm-payment.js:
//   FLW_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js';
import { verifyByReference, refundTransaction, readCharge } from './_flutterwave.js';

const VALID_REASONS = ['unavailable', 'misrepresented', 'other'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { payment_id, reason, note } = req.body || {};
  if (!payment_id) return res.status(400).json({ error: 'Missing payment_id' });
  if (!reason || !VALID_REASONS.includes(reason)) {
    return res.status(400).json({ error: `reason must be one of: ${VALID_REASONS.join(', ')}` });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('admin-refund-payment: missing required env vars');
    return res.status(500).json({ error: 'Refunds are not configured on the server yet.' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // ---- 1. Verify the caller is really an admin ----
  const authHeader = req.headers.authorization || '';
  const jwt = authHeader.replace('Bearer ', '').trim();
  if (!jwt) return res.status(401).json({ error: 'Missing authorization token' });

  const { data: authData, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !authData?.user) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }

  const { data: caller, error: callerErr } = await supabase
    .from('users')
    .select('id, role, full_name, email')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (callerErr || !caller || caller.role !== 'admin') {
    return res.status(403).json({ error: 'Only an admin can issue a refund.' });
  }

  // ---- 2. Load the payment and make sure it's actually refundable ----
  const { data: payment, error: paymentErr } = await supabase
    .from('property_rent_payments')
    .select('*')
    .eq('id', payment_id)
    .maybeSingle();
  if (paymentErr || !payment) return res.status(404).json({ error: 'Payment not found' });

  if (payment.status === 'refunded') {
    return res.status(200).json({ ok: true, alreadyProcessed: true });
  }
  if (payment.status !== 'held') {
    return res.status(409).json({
      error: `This payment is '${payment.status}', not 'held' — only a held payment (funds not yet released to the agent) can be refunded through this action.`,
    });
  }

  // ---- 3. Lock it: held -> refund_processing, so a double-click or the
  // auto-release cron can't touch it while we're mid-refund. ----
  const { error: lockErr } = await supabase
    .from('property_rent_payments')
    .update({ status: 'refund_processing', refund_reason: reason, refunded_by: caller.email || caller.full_name })
    .eq('id', payment_id)
    .eq('status', 'held'); // fails silently (0 rows) if someone else beat us to it
  if (lockErr) return res.status(500).json({ error: 'Failed to lock payment for refund: ' + lockErr.message });

  try {
    // ---- 4. Get Flutterwave's numeric transaction id fresh, then refund ----
    const { ok: verifyOk, body: verifyBody } = await verifyByReference(payment.reference);
    if (!verifyOk) {
      throw new Error(`Could not look up the original charge with Flutterwave: ${verifyBody?.message || 'unknown error'}`);
    }
    const charge = readCharge(verifyBody);
    if (!charge.id) {
      throw new Error('Flutterwave did not return a transaction id for this reference.');
    }

    const { ok: refundOk, body: refundBody } = await refundTransaction(charge.id);
    // Flutterwave returns status: "success" with the refund queued/completed;
    // it does not always settle instantly, but a "success" response here
    // means the refund was accepted and will complete on their side.
    if (!refundOk || refundBody?.status !== 'success') {
      throw new Error(refundBody?.message || 'Flutterwave did not accept the refund request.');
    }

    // ---- 5. Confirmed: mark refunded + soft-delist the property ----
    const { error: refundedErr } = await supabase
      .from('property_rent_payments')
      .update({ status: 'refunded', refunded_at: new Date().toISOString() })
      .eq('id', payment_id)
      .eq('status', 'refund_processing');
    if (refundedErr) throw refundedErr;

    // Soft-delist: status = 'rejected' takes it out of every public listing
    // query (all of which filter on status = 'approved') immediately and
    // for good — it does NOT go back to 'available'. Admin can manually
    // re-approve later if this turns out to have been an error.
    await supabase
      .from('properties')
      .update({ status: 'rejected' })
      .eq('id', payment.property_id);

    await notifyAndEmail(supabase, payment, reason, note);

    return res.status(200).json({ ok: true, refunded_amount: payment.total_amount });
  } catch (err) {
    console.error('admin-refund-payment: refund failed, leaving payment in refund_processing for manual follow-up', err);
    // Deliberately do NOT revert to 'held' automatically — a payment stuck
    // visibly in 'refund_processing' is a problem an admin will notice and
    // retry. Silently reverting it risks the auto-release cron picking it
    // back up and paying the agent for a house that isn't available.
    return res.status(502).json({
      error: 'Refund could not be completed with Flutterwave. The payment is held in refund_processing — retry, or resolve manually with Flutterwave support.',
      detail: String(err?.message || err),
    });
  }
}

// Quiet, non-alarming notifications — no "REFUND ISSUED" banners anywhere
// in-app. The student gets a plain-language email that their payment is
// resolved and money is on its way back; the agent gets told the listing
// was removed, without being shown the student's dispute details.
async function notifyAndEmail(supabase, payment, reason, note) {
  const [{ data: student }, { data: agent }, { data: property }] = await Promise.all([
    supabase.from('users').select('email, full_name').eq('id', payment.user_id).maybeSingle(),
    payment.agent_id ? supabase.from('users').select('email, full_name').eq('id', payment.agent_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('properties').select('title').eq('id', payment.property_id).maybeSingle(),
  ]);
  const propertyTitle = property?.title || 'the property';

  try {
    if (student?.email) {
      await callSupabaseSendEmail({
        type: 'rent_payment_resolved_student',
        to: student.email,
        data: { student_name: student.full_name || 'there', property_title: propertyTitle, amount: payment.total_amount, reference: payment.reference },
      });
    }
    if (agent?.email) {
      await callSupabaseSendEmail({
        type: 'rent_payment_resolved_agent',
        to: agent.email,
        data: { agent_name: agent.full_name || 'there', property_title: propertyTitle, reason },
      });
    }
  } catch (e) {
    console.error('[admin-refund-payment] resolution email failed (non-critical):', e?.message || e);
  }

  try {
    if (payment.user_id) {
      await supabase.from('user_notifications').insert({
        user_id: payment.user_id,
        type: 'rent_payment_resolved',
        title: 'Update on your payment',
        body: `We've resolved the issue with ${propertyTitle}. Your funds are being returned to your original payment method.`,
        link: '/profile',
      });
    }
    if (payment.agent_id) {
      await supabase.from('user_notifications').insert({
        user_id: payment.agent_id,
        type: 'listing_removed',
        title: 'Listing removed',
        body: `"${propertyTitle}" has been taken down and the booking on it was cancelled${note ? `: ${note}` : '.'}`,
        link: '/agent',
      });
    }
  } catch (e) {
    console.error('[admin-refund-payment] notification insert failed (non-critical):', e?.message || e);
  }
}

async function callSupabaseSendEmail(payload) {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(`callSupabaseSendEmail: missing env vars for type=${payload?.type}`);
  }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`callSupabaseSendEmail: send-email returned ${res.status} for type=${payload?.type} — ${body}`);
  }
}
