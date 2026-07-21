// api/confirm-payment.js — Vercel serverless function
//
// This is the ONLY place a payment (token purchase, inspection fee, or
// rent) should ever be marked as paid/held/completed. Previously this
// happened directly from the browser, trusting the Korapay SDK's
// onSuccess callback with no independent verification — which meant
// anyone calling the Supabase REST API directly (bypassing the app
// entirely) could mark their own payment "complete" without ever
// paying, crediting real money to agents/wallets that was never
// actually received. See migration v17 for the matching RLS lockdown.
//
// This function:
//   1. Looks up the reference in whichever table it belongs to
//      (transactions / inspection_transactions / property_rent_payments)
//   2. Verifies the charge with Korapay SERVER-SIDE using the secret key
//      (the browser never sees this key)
//   3. Confirms the amount Korapay actually charged matches what our
//      database expects for that reference
//   4. Only if both checks pass does it perform the status transition,
//      using the Supabase SERVICE ROLE key (bypasses RLS — safe here
//      because this code never runs in the browser)
//
// FAILS CLOSED: if Korapay's response is missing, ambiguous, or
// doesn't match, this returns an error and does NOT mark anything
// paid. A legitimate payment stuck as "pending" is a visible, reportable
// problem. A forged payment silently marked "paid" is a bankruptcy risk.
//
// Requires two Vercel environment variables:
//   - KORALPAY_SECRET_KEY        (should already exist — used by korapay-verify.js)
//   - SUPABASE_SERVICE_ROLE_KEY  (NEW — from Supabase Dashboard > Project Settings > API)
// Also needs SUPABASE_URL (should already exist).

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { reference } = req.body || {};
  if (!reference) return res.status(400).json({ error: 'Missing reference' });

  const secretKey = process.env.KORALPAY_SECRET_KEY;
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
    const [tokenRes, inspRes, rentRes] = await Promise.all([
      supabase.from('transactions').select('*').eq('reference', reference).maybeSingle(),
      supabase.from('inspection_transactions').select('*').eq('reference', reference).maybeSingle(),
      supabase.from('property_rent_payments').select('*').eq('reference', reference).maybeSingle(),
    ]);

    const tokenTx = tokenRes.data;
    const inspTx = inspRes.data;
    const rentTx = rentRes.data;

    if (!tokenTx && !inspTx && !rentTx) {
      return res.status(404).json({ error: 'No transaction found for this reference' });
    }

    // ---- 2. Verify with Korapay server-side ----
    const koraRes = await fetch(`https://api.korapay.com/merchant/api/v1/charges/${reference}`, {
      headers: { 'Authorization': `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
    });
    const koraBody = await koraRes.json();

    if (!koraRes.ok) {
      console.error('confirm-payment: Korapay verify failed', koraBody);
      return res.status(402).json({ error: 'Could not verify payment with Korapay', detail: koraBody?.message });
    }

    // Korapay's response shape can nest the charge under `data`. Handle
    // both to be safe, but require an explicit "success" status — never
    // assume success from the mere presence of a response.
    const chargeStatus = koraBody?.data?.status || koraBody?.status;
    const chargedAmountRaw = koraBody?.data?.amount ?? koraBody?.amount;
    const chargedAmount = Number(chargedAmountRaw);

    if (chargeStatus !== 'success') {
      return res.status(402).json({ error: `Payment not successful (Korapay status: ${chargeStatus || 'unknown'})` });
    }
    if (!Number.isFinite(chargedAmount) || chargedAmount <= 0) {
      console.error('confirm-payment: could not parse charged amount', koraBody);
      return res.status(502).json({ error: 'Could not confirm the charged amount with Korapay — payment not completed.' });
    }

    // ---- 3. Match the charged amount against what we expect, then transition ----
    const AMOUNT_TOLERANCE = 1; // allow ₦1 rounding slack, nothing more

    if (tokenTx) {
      if (tokenTx.status === 'completed') {
        return res.status(200).json({ ok: true, alreadyProcessed: true, type: 'token_purchase' });
      }
      if (Math.abs(chargedAmount - Number(tokenTx.amount)) > AMOUNT_TOLERANCE) {
        console.error('confirm-payment: token amount mismatch', { expected: tokenTx.amount, charged: chargedAmount, reference });
        return res.status(409).json({ error: 'Charged amount does not match the expected token purchase amount.' });
      }

      const { error: txErr } = await supabase.from('transactions').update({ status: 'completed' }).eq('reference', reference).eq('status', 'pending');
      if (txErr) throw txErr;

      const { data: wallet } = await supabase.from('wallets').select('token_balance').eq('user_id', tokenTx.user_id).maybeSingle();
      const newBalance = (wallet?.token_balance || 0) + tokenTx.tokens_added;
      const { error: walletErr } = await supabase.from('wallets').update({ token_balance: newBalance }).eq('user_id', tokenTx.user_id);
      if (walletErr) throw walletErr;

      sendTokenReceiptEmail(supabase, tokenTx).catch((e) => console.warn('token receipt email failed (non-fatal):', e));

      return res.status(200).json({ ok: true, type: 'token_purchase', amount: tokenTx.amount, tokens: tokenTx.tokens_added });
    }

    if (inspTx) {
      if (inspTx.status === 'completed') {
        return res.status(200).json({ ok: true, alreadyProcessed: true, type: 'inspection' });
      }
      if (Math.abs(chargedAmount - Number(inspTx.amount)) > AMOUNT_TOLERANCE) {
        console.error('confirm-payment: inspection amount mismatch', { expected: inspTx.amount, charged: chargedAmount, reference });
        return res.status(409).json({ error: 'Charged amount does not match the expected inspection fee.' });
      }

      const { error: itxErr } = await supabase.from('inspection_transactions').update({ status: 'completed' }).eq('reference', reference).eq('status', 'pending');
      if (itxErr) throw itxErr;

      const { error: inspErr } = await supabase.from('inspections').update({ payment_status: 'completed', status: 'assigned' }).eq('id', inspTx.inspection_id).eq('payment_status', 'pending');
      if (inspErr) throw inspErr;

      const { data: inspection } = await supabase.from('inspections').select('*').eq('id', inspTx.inspection_id).maybeSingle();

      sendInspectionReceiptEmail(supabase, inspTx, inspection).catch((e) => console.warn('inspection receipt email failed (non-fatal):', e));

      return res.status(200).json({ ok: true, type: 'inspection', amount: inspTx.amount, agent_name: inspection?.agent_name, property_title: inspection?.property_title });
    }

    if (rentTx) {
      if (rentTx.status !== 'pending') {
        return res.status(200).json({ ok: true, alreadyProcessed: true, type: 'rent', status: rentTx.status });
      }
      if (Math.abs(chargedAmount - Number(rentTx.total_amount)) > AMOUNT_TOLERANCE) {
        console.error('confirm-payment: rent amount mismatch', { expected: rentTx.total_amount, charged: chargedAmount, reference });
        return res.status(409).json({ error: 'Charged amount does not match the expected rent total.' });
      }

      const { error: rentErr } = await supabase
        .from('property_rent_payments')
        .update({ status: 'held', held_at: new Date().toISOString(), koralpay_reference: koraBody?.data?.reference || reference })
        .eq('reference', reference)
        .eq('status', 'pending');
      if (rentErr) throw rentErr;

      sendRentHeldEmail(supabase, rentTx).catch((e) => console.warn('rent held email failed (non-fatal):', e));

      return res.status(200).json({ ok: true, type: 'rent', amount: rentTx.total_amount, agent_fee: rentTx.agent_fee });
    }
  } catch (err) {
    console.error('confirm-payment: unexpected error', err);
    return res.status(500).json({ error: 'Failed to confirm payment', detail: String(err?.message || err) });
  }
}

// ---- Email helpers: reuse the Supabase Edge Function (send-email) that
// already handles these templates, same as the rest of the app. ----

async function callSupabaseSendEmail(payload) {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
  await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify(payload),
  });
}

async function sendTokenReceiptEmail(supabase, tokenTx) {
  const { data: user } = await supabase.from('users').select('email, full_name').eq('id', tokenTx.user_id).maybeSingle();
  if (!user?.email) return;
  await callSupabaseSendEmail({
    type: 'rent_payment_receipt', // reuses the generic "payment received" style template
    to: user.email,
    data: { student_name: user.full_name || 'there', property_title: `${tokenTx.tokens_added} Rentora Tokens`, amount: tokenTx.amount, reference: tokenTx.reference },
  });
}

async function sendInspectionReceiptEmail(supabase, inspTx, inspection) {
  const [{ data: student }, { data: agent }] = await Promise.all([
    supabase.from('users').select('email, full_name, phone').eq('id', inspTx.user_id).maybeSingle(),
    inspection?.agent_id ? supabase.from('users').select('email, full_name').eq('id', inspection.agent_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (agent?.email) {
    await callSupabaseSendEmail({
      type: 'inspection_agent_notify',
      to: agent.email,
      data: {
        agent_name: agent.full_name || 'there',
        user_name: student?.full_name || 'A student',
        user_email: student?.email || '',
        user_phone: student?.phone || '',
        property_title: inspection?.property_title || 'a property',
        inspection_date: inspection?.inspection_date || '',
        reference: inspTx.reference,
      },
    });
  }
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
  user_name:  inspection?.user_name  || student?.full_name || 'A student',
  user_email: inspection?.user_email || student?.email     || '',
  user_phone: inspection?.user_phone || student?.phone     || '',
  property_title: inspection?.property_title || 'a property',
  inspection_date: inspection?.inspection_date || '',
  reference: inspTx.reference,
},

    });
  }
  if (student?.email) {
    await callSupabaseSendEmail({
      type: 'rent_payment_receipt',
      to: student.email,
      data: { student_name: student.full_name || 'there', property_title: propertyTitle, amount: rentTx.total_amount, reference: rentTx.reference },
    });
  }
}