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
// MANUAL REFUND FLOW: this endpoint does NOT call Flutterwave's refund API.
// Flutterwave's refund endpoint proved unreliable in practice (slow/502s),
// which left payments stuck in an in-between state with no money actually
// returned and no clean way to retry. Instead, the admin sends the money
// back to the student directly (bank transfer, outside the app) and then
// clicks "Refund & Remove Listing" here purely to RECORD that it happened —
// this is bookkeeping, not a payment call.
//
// This endpoint does THREE things:
//   1. Confirms the caller is an admin (server-side, via their own JWT —
//      never trust a role claim from the browser).
//   2. Marks the payment 'refunded' (who, when, why, and an optional
//      internal note — all stored on the row for the record).
//   3. Soft-delists the property (status = 'rejected') so it drops out of
//      every public listing query immediately and permanently — it does
//      NOT go back to 'available'. An admin can manually re-approve it
//      later if the agent proves the listing was actually fine.
//
// Also accepts a payment already stuck in 'refund_processing' (from the
// old Flutterwave-backed version of this endpoint) so any payment left
// hanging by that flow can be resolved here too, in one click.
//
// Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js';

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
  // 'refund_processing' is accepted here too — it's the state a payment
  // could be left in by the old Flutterwave-backed version of this
  // endpoint. Resolving it now just means: record the manual refund.
  if (payment.status !== 'held' && payment.status !== 'refund_processing') {
    return res.status(409).json({
      error: `This payment is '${payment.status}', not 'held' — only a held payment (funds not yet released to the agent) can be refunded through this action.`,
    });
  }

  // ---- 3. Record the manual refund. Conditioned on status so a
  // double-click (or someone else resolving it first) can't double-fire
  // the notifications below. ----
  const { data: updated, error: refundedErr } = await supabase
    .from('property_rent_payments')
    .update({
      status: 'refunded',
      refunded_at: new Date().toISOString(),
      refund_reason: reason,
      refunded_by: caller.email || caller.full_name,
      admin_note: note || null,
    })
    .eq('id', payment_id)
    .in('status', ['held', 'refund_processing'])
    .select()
    .maybeSingle();
  if (refundedErr) return res.status(500).json({ error: 'Failed to mark payment refunded: ' + refundedErr.message });
  if (!updated) return res.status(409).json({ error: 'This payment was already resolved by someone else. Refresh and check its current status.' });

  // Soft-delist: status = 'rejected' takes it out of every public listing
  // query (all of which filter on status = 'approved') immediately and
  // for good — it does NOT go back to 'available'. Admin can manually
  // re-approve later if this turns out to have been an error.
  await supabase
    .from('properties')
    .update({ status: 'rejected' })
    .eq('id', payment.property_id);

  await notifyAndEmail(supabase, payment, reason, note, caller);

  return res.status(200).json({ ok: true, refunded_amount: payment.total_amount });
}

// Quiet, non-alarming notifications for the student and agent — no
// "REFUND ISSUED" banners anywhere in-app. The student gets a plain-language
// email that their payment is resolved and money is on its way back
// (already sent manually by the admin); the agent gets told the listing
// was removed, without being shown the student's dispute details. Every
// admin also gets a record of the refund, same pattern as other
// significant site events (new listing, withdrawal request, etc.).
async function notifyAndEmail(supabase, payment, reason, note, caller) {
  const [{ data: student }, { data: agent }, { data: property }, { data: admins }] = await Promise.all([
    supabase.from('users').select('email, full_name').eq('id', payment.user_id).maybeSingle(),
    payment.agent_id ? supabase.from('users').select('email, full_name').eq('id', payment.agent_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('properties').select('title').eq('id', payment.property_id).maybeSingle(),
    supabase.from('users').select('id, email, full_name').eq('role', 'admin'),
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
    if (admins?.length) {
      await Promise.allSettled(
        admins.filter((a) => a.email).map((admin) =>
          callSupabaseSendEmail({
            type: 'admin_activity_alert',
            to: admin.email,
            data: {
              title: `Refund issued: ${propertyTitle}`,
              event_label: 'Rent refund',
              summary: `${caller.full_name || caller.email || 'An admin'} refunded ${propertyTitle} (₦${Number(payment.total_amount).toLocaleString('en-NG')}) and removed the listing. Reason: ${reason}.${note ? ` Note: ${note}` : ''}`,
              breakdown: [
                ['Property', propertyTitle],
                ['Amount', `NGN ${Number(payment.total_amount).toLocaleString('en-NG')}`],
                ['Reason', reason],
                ['Reference', payment.reference],
                ['Refunded by', caller.full_name || caller.email || '—'],
              ],
              action_url: 'https://www.rentora.com.ng/admin?tab=escrow',
              admin_name: admin.full_name || 'Admin',
            },
          })
        )
      );
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
    if (admins?.length) {
      await supabase.from('user_notifications').insert(
        admins.map((admin) => ({
          user_id: admin.id,
          type: 'rent_refund_issued',
          title: 'Refund issued',
          body: `${caller.full_name || caller.email || 'An admin'} refunded ${propertyTitle} (₦${Number(payment.total_amount).toLocaleString('en-NG')}).`,
          link: '/admin?tab=escrow',
        }))
      );
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