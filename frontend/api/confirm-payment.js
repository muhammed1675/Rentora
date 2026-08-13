// api/confirm-payment.js — Vercel serverless function
//
// This is the ONLY place a payment (token purchase, inspection fee, or
// rent) should ever be marked as paid/held/completed. Previously this
// happened directly from the browser, trusting the Flutterwave SDK's
// onSuccess callback with no independent verification — which meant
// anyone calling the Supabase REST API directly (bypassing the app
// entirely) could mark their own payment "complete" without ever
// paying, crediting real money to agents/wallets that was never
// actually received. See migration v17 for the matching RLS lockdown.
//
// This function:
//   1. Looks up the reference in whichever table it belongs to
//      (transactions / inspection_transactions / property_rent_payments)
//   2. Verifies the charge with Flutterwave SERVER-SIDE using the secret key
//      (the browser never sees this key)
//   3. Confirms the amount Flutterwave actually charged matches what our
//      database expects for that reference
//   4. Only if both checks pass does it perform the status transition,
//      using the Supabase SERVICE ROLE key (bypasses RLS — safe here
//      because this code never runs in the browser)
//
// FAILS CLOSED: if Flutterwave's response is missing, ambiguous, or
// doesn't match, this returns an error and does NOT mark anything
// paid. A legitimate payment stuck as "pending" is a visible, reportable
// problem. A forged payment silently marked "paid" is a bankruptcy risk.
//
// Requires two Vercel environment variables:
//   - FLW_SECRET_KEY        (should already exist — used by flutterwave-verify.js)
//   - SUPABASE_SERVICE_ROLE_KEY  (NEW — from Supabase Dashboard > Project Settings > API)
// Also needs SUPABASE_URL (should already exist).

import { createClient } from '@supabase/supabase-js';
import { verifyByReference, readCharge, getSecretKey } from './_flutterwave.js';
import { applyCors } from './_cors.js';

// Admin notification wrapper: every attempt to confirm a payment (success or
// failure) is reported by email to every user with role='admin' in Supabase,
// with the reason/outcome spelled out. Adding/removing an admin in the users
// table is all that's needed to change who gets alerted.
export default async function handler(req, res) {
  const captured = { status: 200, body: null, headers: {} };
  const shim = {
    status(code) { captured.status = code; return this; },
    json(body) { captured.body = body; return this; },
    end() { captured.ended = true; return this; },
    setHeader(k, v) { captured.headers[k] = v; },
    get method() { return req.method; },
  };

  await handlePayment(req, shim);

  // Never let a notification problem change the payment outcome.
  try {
    await notifyAdminsOfPaymentAttempt(req, captured);
  } catch (e) {
    console.error('[admin payment alert] failed:', e?.message || e);
  }

  for (const [k, v] of Object.entries(captured.headers)) res.setHeader(k, v);
  res.status(captured.status);
  if (captured.body !== null) return res.json(captured.body);
  return res.end();
}

async function handlePayment(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { reference } = req.body || {};
  if (!reference) return res.status(400).json({ error: 'Missing reference' });

  const secretKey = getSecretKey();
  const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secretKey || !supabaseUrl || !serviceRoleKey) {
    console.error('confirm-payment: missing required env vars', {
      hasSecretKey: !!secretKey, hasUrl: !!supabaseUrl, hasServiceKey: !!serviceRoleKey,
    });
    return res.status(500).json({ error: 'Payment confirmation is not configured on the server yet.' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // ---- 1. Find which table this reference belongs to ----
    const [tokenRes, inspRes, rentRes, tipRes] = await Promise.all([
      supabase.from('transactions').select('*').eq('reference', reference).maybeSingle(),
      supabase.from('inspection_transactions').select('*').eq('reference', reference).maybeSingle(),
      supabase.from('property_rent_payments').select('*').eq('reference', reference).maybeSingle(),
      supabase.from('inspection_tips').select('*').eq('reference', reference).maybeSingle(),
    ]);

    const tokenTx = tokenRes.data;
    const inspTx = inspRes.data;
    const rentTx = rentRes.data;
    const tipTx = tipRes.data;

    if (!tokenTx && !inspTx && !rentTx && !tipTx) {
      return res.status(404).json({ error: 'No transaction found for this reference' });
    }

    // ---- 2. Verify with Flutterwave server-side ----
    const { ok: flwOk, body: flwBody } = await verifyByReference(reference);

    if (!flwOk || flwBody?.status !== 'success') {
      console.error('confirm-payment: Flutterwave verify failed', flwBody);
      return res.status(402).json({ error: 'Could not verify payment with Flutterwave', detail: flwBody?.message });
    }

    // Flutterwave marks a completed payment as data.status === "successful".
    // Never assume success from the mere presence of a response.
    const charge = readCharge(flwBody);
    const chargeStatus = charge.status;
    const chargedAmount = charge.amount;

    if (chargeStatus !== 'successful') {
      return res.status(402).json({ error: `Payment not successful (Flutterwave status: ${chargeStatus || 'unknown'})` });
    }
    if (!Number.isFinite(chargedAmount) || chargedAmount <= 0) {
      console.error('confirm-payment: could not parse charged amount', flwBody);
      return res.status(502).json({ error: 'Could not confirm the charged amount with Flutterwave — payment not completed.' });
    }
    if (charge.currency && charge.currency !== 'NGN') {
      return res.status(409).json({ error: `Unexpected payment currency: ${charge.currency}` });
    }
    if (charge.txRef && charge.txRef !== reference) {
      return res.status(409).json({ error: 'Payment reference mismatch' });
    }

    // ---- 3. Match the charged amount against what we expect, then transition ----
    //
    // IMPORTANT: Flutterwave's `charged_amount` is what the CUSTOMER paid,
    // which is often HIGHER than the amount we requested. When "customer
    // bears the transaction fee" is enabled on the Flutterwave dashboard
    // (common/default for NG merchants, especially for bank transfer /
    // USSD), Flutterwave adds its fee on top before charging the customer,
    // e.g. we ask for ₦1000 and the customer is charged ₦1020 — we still
    // receive the full ₦1000 at settlement (data.amount_settled).
    // Flutterwave's own docs are explicit about this: verify that the
    // charged amount is >= the amount you expect, not that it matches
    // exactly. See: https://developer.flutterwave.com/docs/transaction-verification
    //
    // So we only fail closed when the customer was charged LESS than
    // expected (an undercharge could indicate someone gaming the amount).
    // We do NOT reject an overcharge — that's the customer legitimately
    // covering Flutterwave's fee, and treating it as a mismatch is what was
    // causing every real, successful payment to get stuck on "pending".
    const UNDERCHARGE_TOLERANCE = 5; // ₦5 slack for rounding/floating point only

    if (tokenTx) {
      if (tokenTx.status === 'completed') {
        return res.status(200).json({ ok: true, alreadyProcessed: true, type: 'token_purchase' });
      }
      if (chargedAmount < Number(tokenTx.amount) - UNDERCHARGE_TOLERANCE) {
        console.error('confirm-payment: token amount mismatch', { expected: tokenTx.amount, charged: chargedAmount, reference });
        return res.status(409).json({ error: 'Charged amount does not match the expected token purchase amount.' });
      }

      const { error: txErr } = await supabase.from('transactions').update({ status: 'completed' }).eq('reference', reference).eq('status', 'pending');
      if (txErr) throw txErr;

      const { data: wallet } = await supabase.from('wallets').select('token_balance').eq('user_id', tokenTx.user_id).maybeSingle();
      const newBalance = (wallet?.token_balance || 0) + tokenTx.tokens_added;
      const { error: walletErr } = await supabase.from('wallets').update({ token_balance: newBalance }).eq('user_id', tokenTx.user_id);
      if (walletErr) throw walletErr;

      // Awaited (not fire-and-forget) — Vercel can freeze/terminate the
      // function the instant res.status(200).json(...) is sent, which was
      // killing this email mid-flight before it ever reached Resend. Same
      // fix as the rent-held email below.
      // 
      // Catch email errors so they don't break the webhook: the payment has
      // already been marked "completed" and tokens added to wallet, so the
      // core transaction is complete. Email failures should be logged but not
      // reported to Flutterwave (which would trigger infinite retries).
      try {
        const tokenEmailResult = await sendTokenReceiptEmail(supabase, tokenTx).then(
          () => ({ status: 'fulfilled' }),
          (e) => ({ status: 'rejected', reason: e }),
        );
        if (tokenEmailResult.status === 'rejected') {
          console.error(`[token receipt email] FAILED for reference=${reference}:`, tokenEmailResult.reason?.message || tokenEmailResult.reason);
        } else {
          console.log(`[token receipt email] OK for reference=${reference}`);
        }
      } catch (emailErr) {
        console.error(`[token receipt email] exception for reference=${reference}:`, emailErr?.message || emailErr);
      }

      return res.status(200).json({ ok: true, type: 'token_purchase', amount: tokenTx.amount, tokens: tokenTx.tokens_added });
    }

    if (inspTx) {
      if (inspTx.status === 'completed') {
        return res.status(200).json({ ok: true, alreadyProcessed: true, type: 'inspection' });
      }
      const shortfall = Number(inspTx.amount) - chargedAmount; // positive => customer paid less than expected
      console.log('[confirm-payment] Inspection amount check:', {
        expected: inspTx.amount,
        charged: chargedAmount,
        shortfall,
        tolerance: UNDERCHARGE_TOLERANCE,
        withinTolerance: shortfall <= UNDERCHARGE_TOLERANCE,
        reference
      });
      if (shortfall > UNDERCHARGE_TOLERANCE) {
        console.error('confirm-payment: inspection amount mismatch', { expected: inspTx.amount, charged: chargedAmount, reference, shortfall });
        return res.status(409).json({ error: 'Charged amount does not match the expected inspection fee.' });
      }

      const { error: itxErr } = await supabase.from('inspection_transactions').update({ status: 'completed' }).eq('reference', reference).eq('status', 'pending');
      if (itxErr) throw itxErr;

      const { error: inspErr } = await supabase.from('inspections').update({ payment_status: 'completed', status: 'assigned' }).eq('id', inspTx.inspection_id).eq('payment_status', 'pending');
      if (inspErr) throw inspErr;

      const { data: inspection } = await supabase.from('inspections').select('*').eq('id', inspTx.inspection_id).maybeSingle();

      // Awaited (not fire-and-forget) — same reasoning as the token receipt
      // and rent-held emails: Vercel can freeze/terminate the function the
      // instant res.status(200).json(...) is sent, which was killing this
      // background IIFE mid-flight before the emails ever reached Resend.
      // 
      // Catch email errors so they don't break the webhook: the payment has
      // already been marked "completed" and inspection marked "assigned", so
      // the core transaction is complete. Email failures should be logged but
      // not reported to Flutterwave (which would trigger infinite retries).
      try {
        const emailResults = await Promise.allSettled([
          sendInspectionAgentNotify(supabase, inspTx, inspection),
          sendInspectionStudentReceipt(supabase, inspTx, inspection),
        ]);
        emailResults.forEach((r, i) => {
          const label = i === 0 ? 'agent_notify' : 'student_receipt';
          if (r.status === 'rejected') {
            console.error(`[inspection email] ${label} FAILED for reference=${reference}:`, r.reason?.message || r.reason);
          } else {
            console.log(`[inspection email] ${label} OK for reference=${reference}`);
          }
        });
      } catch (emailErr) {
        console.error(`[inspection email] exception for reference=${reference}:`, emailErr?.message || emailErr);
      }

      return res.status(200).json({ ok: true, type: 'inspection', amount: inspTx.amount, agent_name: inspection?.agent_name, property_title: inspection?.property_title });
    }

    if (rentTx) {
      if (rentTx.status !== 'pending') {
        return res.status(200).json({ ok: true, alreadyProcessed: true, type: 'rent', status: rentTx.status });
      }
      if (chargedAmount < Number(rentTx.total_amount) - UNDERCHARGE_TOLERANCE) {
        console.error('confirm-payment: rent amount mismatch', { expected: rentTx.total_amount, charged: chargedAmount, reference });
        return res.status(409).json({ error: 'Charged amount does not match the expected rent total.' });
      }

      const { error: rentErr } = await supabase
        .from('property_rent_payments')
        .update({ status: 'held', held_at: new Date().toISOString(), koralpay_reference: charge.flwRef || reference })
        .eq('reference', reference)
        .eq('status', 'pending');
      if (rentErr) throw rentErr;

      // Lock the property the instant rent is actually held — otherwise
      // nothing stops a second student from also successfully paying for
      // the same property before the agent notices and marks it taken by
      // hand. This is best-effort: the payment itself already succeeded
      // and must not be rolled back just because this follow-up update
      // fails, so log and move on rather than throwing.
      try {
        const { error: availErr } = await supabase
          .from('properties')
          .update({ availability: 'unavailable' })
          .eq('id', rentTx.property_id);
        if (availErr) console.error('confirm-payment: failed to lock property availability', availErr.message, { property_id: rentTx.property_id, reference });
      } catch (availEx) {
        console.error('confirm-payment: exception locking property availability', availEx?.message || availEx, { property_id: rentTx.property_id, reference });
      }

      // Await this (same fix already applied to the inspection emails above) —
      // firing this without awaiting let Vercel freeze/terminate the function
      // as soon as res.status(200).json(...) was sent, often killing the
      // in-flight request to send-email before it reached Resend. That's why
      // the agent's "Rent Paid — Held" email wasn't arriving even though the
      // payment itself was correctly marked "held".
      // 
      // Catch email errors so they don't break the webhook: the payment has
      // already been marked "held" in the database, so the core transaction
      // is complete. Email failures should be logged but not reported to
      // Flutterwave (which would trigger infinite retries).
      try {
        const heldEmailResult = await sendRentHeldEmail(supabase, rentTx).then(
          () => ({ status: 'fulfilled' }),
          (e) => ({ status: 'rejected', reason: e }),
        );
        if (heldEmailResult.status === 'rejected') {
          console.error(`[rent held email] FAILED for reference=${reference}:`, heldEmailResult.reason?.message || heldEmailResult.reason);
        } else {
          console.log(`[rent held email] OK for reference=${reference}`);
        }
      } catch (emailErr) {
        console.error(`[rent held email] exception for reference=${reference}:`, emailErr?.message || emailErr);
      }

      return res.status(200).json({ ok: true, type: 'rent', amount: rentTx.total_amount, agent_fee: rentTx.agent_fee });
    }

    if (tipTx) {
      if (tipTx.status === 'completed') {
        return res.status(200).json({ ok: true, alreadyProcessed: true, type: 'tip' });
      }
      if (chargedAmount < Number(tipTx.amount) - UNDERCHARGE_TOLERANCE) {
        console.error('confirm-payment: tip amount mismatch', { expected: tipTx.amount, charged: chargedAmount, reference });
        return res.status(409).json({ error: 'Charged amount does not match the expected tip amount.' });
      }

      // Conditioned on status='pending' so a double-fired callback can't
      // process the same tip twice. The partial unique index on
      // inspection_tips(inspection_id) WHERE status='completed' is the
      // real backstop against two different tip rows both completing for
      // the same viewing.
      const { data: updatedTip, error: tipErr } = await supabase
        .from('inspection_tips')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('reference', reference)
        .eq('status', 'pending')
        .select()
        .maybeSingle();
      if (tipErr) {
        // Unique violation means someone else's tip on this viewing beat
        // this one to 'completed' in the exact same instant — treat it as
        // already processed rather than a hard failure, since the charge
        // did succeed and shouldn't be reported as failed to the student.
        if (tipErr.code === '23505') {
          return res.status(200).json({ ok: true, alreadyProcessed: true, type: 'tip' });
        }
        throw tipErr;
      }
      if (!updatedTip) {
        return res.status(200).json({ ok: true, alreadyProcessed: true, type: 'tip' });
      }

      // Agent balance crediting happens via the trg_credit_agent_tip_balance
      // DB trigger on this same UPDATE (see 12_agent_tips.sql) — nothing
      // more to do here for the money itself. Just let the agent know.
      try {
        const [{ data: agent }, { data: student }, { data: inspection }] = await Promise.all([
          supabase.from('users').select('email, full_name').eq('id', tipTx.agent_id).maybeSingle(),
          supabase.from('users').select('full_name').eq('id', tipTx.user_id).maybeSingle(),
          supabase.from('inspections').select('property_title').eq('id', tipTx.inspection_id).maybeSingle(),
        ]);
        await notify(
          supabase,
          tipTx.agent_id,
          'agent_tip_received',
          'You received a tip',
          `${student?.full_name || 'A student'} tipped you ₦${Number(tipTx.amount).toLocaleString('en-NG')} for the viewing of "${inspection?.property_title || 'a property'}".`,
          '/agent'
        );
        console.log(`[tip] credited agent_id=${tipTx.agent_id} amount=${tipTx.amount} reference=${reference}`);
      } catch (notifyErr) {
        console.error(`[tip] notify failed for reference=${reference}:`, notifyErr?.message || notifyErr);
      }

      return res.status(200).json({ ok: true, type: 'tip', amount: tipTx.amount });
    }
  } catch (err) {
    // Payment confirmation failed — don't return 200.
    // Return 500 so Flutterwave retries: a payment stuck as "pending" is
    // better than one silently marked "paid" when we never checked it.
    console.error('confirm-payment: unexpected error', err);
    return res.status(500).json({ error: 'Failed to confirm payment', detail: String(err?.message || err) });
  }
}

// ---- Email helpers: reuse the Supabase Edge Function (send-email) that
// already handles these templates, same as the rest of the app. ----

async function callSupabaseSendEmail(payload) {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error(`callSupabaseSendEmail: missing env vars (hasUrl=${!!SUPABASE_URL}, hasServiceRoleKey=${!!SERVICE_ROLE_KEY}) for type=${payload?.type}`);
  }
  // Uses the service-role key (private, server-side only) rather than the
  // public anon key — the send-email edge function trusts this key fully,
  // since only trusted server code (this file) ever has it. See
  // supabase/functions/send-email/index.ts for the corresponding check.
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    // Previously this response was never inspected, so a failed send here
    // (bad payload, Resend error surfaced by the edge function, etc.) was
    // completely invisible — the outer .catch() never fired because
    // nothing rejected. Throwing here is what makes failures show up in
    // Vercel logs instead of vanishing silently.
    const body = await res.text().catch(() => '');
    throw new Error(`callSupabaseSendEmail: send-email returned ${res.status} for type=${payload?.type} to=${payload?.to} — ${body}`);
  }
}

// In-app notification insert — runs with the service_role client this file
// already uses, so it bypasses RLS directly (no need for the
// create_notification() RPC that client-side code uses). Never allowed to
// throw and break payment confirmation over a notification failure.
async function notify(supabase, userId, type, title, body, link = null) {
  if (!userId) return;
  try {
    const { error } = await supabase.from('user_notifications').insert({ user_id: userId, type, title, body, link });
    if (error) console.warn(`notify(${type}) failed (non-critical):`, error.message);
  } catch (e) {
    console.warn(`notify(${type}) failed (non-critical):`, e.message);
  }
}

async function sendTokenReceiptEmail(supabase, tokenTx) {
  const { data: user } = await supabase.from('users').select('email, full_name').eq('id', tokenTx.user_id).maybeSingle();
  if (!user?.email) return;
  await callSupabaseSendEmail({
    type: 'rent_payment_receipt', // reuses the generic "payment received" style template
    to: user.email,
    data: { student_name: user.full_name || 'there', property_title: `${tokenTx.tokens_added} Rentora Tokens`, amount: tokenTx.amount, reference: tokenTx.reference },
  });
  await notify(supabase, tokenTx.user_id, 'token_receipt', 'Tokens added', `${tokenTx.tokens_added} tokens have been added to your wallet.`, '/profile');
}

async function sendInspectionAgentNotify(supabase, inspTx, inspection) {
  if (!inspection) {
    throw new Error(`inspection row not found for inspection_id=${inspTx?.inspection_id}`);
  }

  // Self-heal: if agent_id is missing on the inspection row, look it up from
  // the property. Older inspection rows created before agent_id was populated
  // consistently would otherwise silently skip the notify.
  let agentId = inspection.agent_id;
  if (!agentId && inspection.property_id) {
    const { data: prop } = await supabase
      .from('properties')
      .select('uploaded_by_agent_id')
      .eq('id', inspection.property_id)
      .maybeSingle();
    agentId = prop?.uploaded_by_agent_id || null;
    if (agentId) {
      await supabase.from('inspections').update({ agent_id: agentId }).eq('id', inspection.id);
      console.log(`[inspection email] backfilled agent_id=${agentId} on inspection=${inspection.id}`);
    }
  }

  if (!agentId) {
    throw new Error(`no agent_id on inspection=${inspection.id} and property has no uploaded_by_agent_id`);
  }

  const [{ data: student }, { data: agent }] = await Promise.all([
    supabase.from('users').select('email, full_name, phone').eq('id', inspTx.user_id).maybeSingle(),
    supabase.from('users').select('email, full_name').eq('id', agentId).maybeSingle(),
  ]);

  if (!agent) {
    throw new Error(`agent user row not found for agent_id=${agentId}`);
  }
  if (!agent.email) {
    throw new Error(`agent user row found but email is null for agent_id=${agentId}`);
  }

  console.log(`[inspection email] sending agent_notify to=${agent.email} for inspection=${inspection.id}`);

  await callSupabaseSendEmail({
    type: 'inspection_agent_notify',
    to: agent.email,
    data: {
      agent_name: agent.full_name || 'there',
      user_name: student?.full_name || 'A student',
      user_email: student?.email || inspection.user_email || '',
      user_phone: student?.phone || '',
      property_title: inspection?.property_title || 'a property',
      inspection_date: inspection?.inspection_date || '',
      reference: inspTx.reference,
    },
  });
  await notify(supabase, agentId, 'inspection_agent_notify', 'New inspection booked', `${student?.full_name || 'A student'} booked an inspection for ${inspection?.property_title || 'a property'}.`, '/agent');
}

async function sendInspectionStudentReceipt(supabase, inspTx, inspection) {
  const { data: student } = await supabase
    .from('users').select('email, full_name').eq('id', inspTx.user_id).maybeSingle();
  const to = student?.email || inspection?.user_email;
  if (!to) throw new Error(`no student email for inspection=${inspection?.id}`);
  await callSupabaseSendEmail({
    type: 'inspection_booked',
    to,
    data: {
      name: student?.full_name || inspection?.user_name || 'there',
      property_title: inspection?.property_title || 'a property',
      inspection_date: inspection?.inspection_date || '',
      reference: inspTx.reference,
      amount: inspTx.amount,
    },
  });
  await notify(supabase, inspTx.user_id, 'inspection_booked', 'Inspection confirmed', `Your inspection for ${inspection?.property_title || 'the property'} is booked.`, '/profile');
}

async function sendRentHeldEmail(supabase, rentTx) {
  const [{ data: student }, { data: agent }, { data: property }] = await Promise.all([
    supabase.from('users').select('email, full_name, phone').eq('id', rentTx.user_id).maybeSingle(),
    rentTx.agent_id ? supabase.from('users').select('email, full_name').eq('id', rentTx.agent_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('properties').select('title').eq('id', rentTx.property_id).maybeSingle(),
  ]);
  const propertyTitle = property?.title || 'a property';
  if (agent?.email) {
    await callSupabaseSendEmail({
      type: 'rent_payment_held',
      to: agent.email,
      data: {
        agent_name: agent.full_name || 'there',
        property_title: propertyTitle,
        amount: rentTx.total_amount,
        rent_amount: rentTx.rent_amount,
        agent_fee: rentTx.agent_fee,
        caution_fee: rentTx.caution_fee,
        reference: rentTx.reference,
        student_name: student?.full_name || 'A student',
        student_email: student?.email || '',
        student_phone: student?.phone || '',
      },
    });
    // No notify() call here for the agent — the queue_rent_held_notification
    // DB trigger (fires on the same status='held' transition, right when
    // the row above gets updated) already creates this exact notification.
    // Adding one here too would double it up in the agent's bell.
  }
  if (student?.email) {
    await callSupabaseSendEmail({
      type: 'rent_payment_receipt',
      to: student.email,
      data: { student_name: student.full_name || 'there', property_title: propertyTitle, amount: rentTx.total_amount, reference: rentTx.reference },
    });
  }
  await notify(supabase, rentTx.user_id, 'rent_payment_receipt', 'Rent payment received', `Your rent payment for ${propertyTitle} was received.`, '/profile');
}

// ---------------------------------------------------------------------------
// Admin payment notifications
// ---------------------------------------------------------------------------
// Recipients are NOT hardcoded: anyone in the Supabase `users` table with
// role = 'admin' receives every payment alert.
async function getAdminEmails(supabase) {
  const { data, error } = await supabase.from('users').select('email, full_name').eq('role', 'admin');
  if (error) throw error;
  return (data || []).filter((u) => !!u.email);
}

function describeOutcome(status, body) {
  if (status === 200 && body?.alreadyProcessed) {
    return { outcome: 'duplicate', title: 'Payment already processed', reason: 'This reference was confirmed earlier — no changes were made (idempotent replay of the callback or webhook).' };
  }
  if (status === 200) {
    return { outcome: 'success', title: 'Payment successful', reason: 'Flutterwave verified the charge server-side and the amount matched what Rentora expected, so the payment was completed.' };
  }
  if (status === 404) return { outcome: 'failed', title: 'Payment could not be matched', reason: body?.error || 'No transaction in Rentora matches this reference.' };
  if (status === 402) return { outcome: 'failed', title: 'Payment not verified by Flutterwave', reason: body?.error || 'Flutterwave did not report this charge as successful.' };
  if (status === 409) return { outcome: 'failed', title: 'Payment rejected — mismatch', reason: body?.error || 'The charged amount, currency or reference did not match Rentora records.' };
  if (status === 502) return { outcome: 'failed', title: 'Payment rejected — unreadable amount', reason: body?.error || 'Could not confirm the charged amount with Flutterwave.' };
  return { outcome: 'failed', title: 'Payment confirmation error', reason: body?.error || body?.detail || `Server returned status ${status}.` };
}

async function notifyAdminsOfPaymentAttempt(req, captured) {
  const reference = req?.body?.reference;
  if (!reference) return; // nothing meaningful to report (OPTIONS / bad request)

  const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return;

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const admins = await getAdminEmails(supabase);
  if (!admins.length) return;

  const { status, body } = captured;
  const { outcome, title, reason } = describeOutcome(status, body);

  // Figure out what was being paid for and by whom.
  const [tokenRes, inspRes, rentRes, tipRes] = await Promise.all([
    supabase.from('transactions').select('*').eq('reference', reference).maybeSingle(),
    supabase.from('inspection_transactions').select('*').eq('reference', reference).maybeSingle(),
    supabase.from('property_rent_payments').select('*').eq('reference', reference).maybeSingle(),
    supabase.from('inspection_tips').select('*').eq('reference', reference).maybeSingle(),
  ]);
  const tx = tokenRes.data || inspRes.data || rentRes.data || tipRes.data || null;

  let paymentType = 'Unknown payment';
  let purpose = 'Could not determine what this payment was for.';
  let amount = null;
  let breakdown = [];

  if (tokenRes.data) {
    paymentType = 'Token purchase';
    purpose = `User bought ${tokenRes.data.tokens_added} Rentora token(s) to unlock agent contacts.`;
    amount = tokenRes.data.amount;
    breakdown = [['Tokens', String(tokenRes.data.tokens_added)]];
  } else if (inspRes.data) {
    paymentType = 'Inspection fee';
    amount = inspRes.data.amount;
    const { data: inspection } = await supabase.from('inspections').select('property_title, inspection_date, agent_name').eq('id', inspRes.data.inspection_id).maybeSingle();
    purpose = `Student paid the inspection fee to book a viewing of "${inspection?.property_title || 'a property'}".`;
    breakdown = [
      ['Property', inspection?.property_title || '—'],
      ['Inspection date', inspection?.inspection_date || '—'],
      ['Agent', inspection?.agent_name || '—'],
    ];
  } else if (rentRes.data) {
    paymentType = 'Rent payment';
    amount = rentRes.data.total_amount;
    const { data: property } = await supabase.from('properties').select('title').eq('id', rentRes.data.property_id).maybeSingle();
    purpose = `Student paid rent for "${property?.title || 'a property'}". Funds are held by Rentora until move-in is confirmed.`;
    breakdown = [
      ['Property', property?.title || '—'],
      ['Rent', formatNaira(rentRes.data.rent_amount)],
      ['Agent fee', formatNaira(rentRes.data.agent_fee)],
      ['Caution fee', formatNaira(rentRes.data.caution_fee)],
    ];
  } else if (tipRes.data) {
    paymentType = 'Agent tip';
    amount = tipRes.data.amount;
    const { data: inspection } = await supabase.from('inspections').select('property_title, agent_name').eq('id', tipRes.data.inspection_id).maybeSingle();
    purpose = `Student tipped the agent for the viewing of "${inspection?.property_title || 'a property'}". Credited straight to the agent's balance.`;
    breakdown = [
      ['Property', inspection?.property_title || '—'],
      ['Agent', inspection?.agent_name || '—'],
    ];
  }

  let payer = null;
  if (tx?.user_id) {
    const { data: u } = await supabase.from('users').select('full_name, email, phone').eq('id', tx.user_id).maybeSingle();
    payer = u || null;
  }

  const payload = {
    outcome,
    title,
    reason,
    payment_type: paymentType,
    purpose,
    amount,
    reference,
    status_code: status,
    payer_name: payer?.full_name || '—',
    payer_email: payer?.email || '—',
    payer_phone: payer?.phone || '—',
    breakdown,
    occurred_at: new Date().toISOString(),
  };

  const results = await Promise.allSettled(
    admins.map((admin) =>
      callSupabaseSendEmail({
        type: 'admin_payment_alert',
        to: admin.email,
        data: { ...payload, admin_name: admin.full_name || 'Admin' },
      }),
    ),
  );
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error(`[admin payment alert] failed for ${admins[i].email}:`, r.reason?.message || r.reason);
    else console.log(`[admin payment alert] sent to ${admins[i].email} (${outcome}, ${reference})`);
  });
}

function formatNaira(v) {
  const n = Number(v);
  return Number.isFinite(n) ? `NGN ${n.toLocaleString('en-NG')}` : '—';
}