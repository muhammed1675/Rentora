// KoraPay webhook endpoint.
//
// KoraPay sends POST notifications containing { event, data }. We verify
// x-korapay-signature using HMAC-SHA256 over JSON.stringify(data) with the
// KoraPay secret key, then reuse the existing server-side confirm-payment
// handler so all payment types keep one source of truth for verification,
// amount checks, reservation, and email/ledger updates.

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import confirmPayment from './confirm-payment.js';

function timingSafeEqualHex(a, b) {
  if (!a || !b) return false;
  const aa = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function isValidKoraSignature(data, signature) {
  const secret = process.env.KORAPAY_SECRET_KEY;
  if (!secret || !signature || !data) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(data))
    .digest('hex');
  return timingSafeEqualHex(expected, signature);
}

function jsonResponse(res, status, body) {
  res.status(status).json(body);
}

async function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey);
}

async function recordFailedProviderStatus(supabase, reference) {
  if (!supabase || !reference) return;
  const tables = ['property_rent_payments', 'inspection_transactions', 'transactions', 'inspection_tips'];
  await Promise.all(tables.map(async (table) => {
    try {
      await supabase.from(table).update({ provider_status: 'failed' }).eq('reference', reference).eq('status', 'pending');
    } catch (error) {
      console.error(`[korapay-webhook] failed to update ${table}:`, error?.message || error);
    }
  }));
}

function makeResponseCapture() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end(body) { this.body = body ?? null; return this; },
    setHeader(key, value) { this.headers[key] = value; },
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return jsonResponse(res, 200, { ok: true });

  const signature = req.headers?.['x-korapay-signature'] || req.headers?.['X-Korapay-Signature'];
  const event = String(req.body?.event || '');
  const data = req.body?.data;
  const reference = data?.reference || data?.transaction_reference || data?.payment_reference;

  if (!isValidKoraSignature(data, signature)) {
    console.warn('[korapay-webhook] invalid signature');
    // KoraPay recommends acknowledging invalid notifications with 200 so the
    // provider does not waste retries on a request we intentionally rejected.
    return jsonResponse(res, 200, { ok: true });
  }

  if (!reference) {
    console.warn('[korapay-webhook] missing transaction reference');
    return jsonResponse(res, 200, { ok: true, ignored: true });
  }

  const supabase = await getSupabase();
  if (!supabase) {
    console.error('[korapay-webhook] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return jsonResponse(res, 500, { error: 'Webhook is not configured on the server.' });
  }

  // Persist every notification so retries can be identified and audited.
  // A failed attempt keeps processed_at null and is therefore safe to retry.
  const { data: existing, error: lookupError } = await supabase
    .from('korapay_webhook_events')
    .select('id, processed_at')
    .eq('event', event)
    .eq('reference', reference)
    .maybeSingle();

  if (lookupError) {
    console.error('[korapay-webhook] event lookup failed:', lookupError.message);
    return jsonResponse(res, 500, { error: 'Webhook event lookup failed.' });
  }

  if (existing?.processed_at) {
    return jsonResponse(res, 200, { ok: true, alreadyProcessed: true, reference });
  }

  const payload = req.body || {};
  let eventId = existing?.id || null;

  if (!eventId) {
    const { data: inserted, error: insertError } = await supabase
      .from('korapay_webhook_events')
      .insert({ event, reference, payload })
      .select('id')
      .maybeSingle();

    if (insertError) {
      // A concurrent webhook may have inserted the same notification. Re-read
      // it and continue using that row instead of creating duplicate records.
      const { data: raced } = await supabase
        .from('korapay_webhook_events')
        .select('id, processed_at')
        .eq('event', event)
        .eq('reference', reference)
        .maybeSingle();
      if (raced?.processed_at) return jsonResponse(res, 200, { ok: true, alreadyProcessed: true, reference });
      eventId = raced?.id || null;
    } else {
      eventId = inserted?.id || null;
    }
  }

  const normalizedEvent = event.toLowerCase();

  try {
    if (normalizedEvent === 'charge.failed') {
      await recordFailedProviderStatus(supabase, reference);
      if (eventId) {
        await supabase.from('korapay_webhook_events').update({ processed_at: new Date().toISOString(), outcome: 'failed' }).eq('id', eventId);
      }
      return jsonResponse(res, 200, { ok: true, reference, status: 'failed' });
    }

    if (normalizedEvent !== 'charge.success') {
      if (eventId) {
        await supabase.from('korapay_webhook_events').update({ processed_at: new Date().toISOString(), outcome: 'ignored' }).eq('id', eventId);
      }
      return jsonResponse(res, 200, { ok: true, ignored: true, event: normalizedEvent });
    }

    // Reuse the existing server-side confirmation path. It queries KoraPay's
    // charge endpoint, checks the final status/currency/reference/amount, then
    // applies the correct Rentora state transition.
    const innerReq = {
      method: 'POST',
      headers: {},
      body: { reference },
    };
    const innerRes = makeResponseCapture();
    await confirmPayment(innerReq, innerRes);

    const successful = innerRes.statusCode >= 200 && innerRes.statusCode < 300;
    if (!successful) {
      console.error('[korapay-webhook] confirm-payment failed', {
        reference,
        statusCode: innerRes.statusCode,
        body: innerRes.body,
      });
      return jsonResponse(res, 500, { error: 'Payment confirmation failed; KoraPay should retry this webhook.', reference });
    }

    if (eventId) {
      await supabase.from('korapay_webhook_events').update({
        processed_at: new Date().toISOString(),
        outcome: innerRes.body?.alreadyProcessed ? 'already_processed' : 'success',
        response: innerRes.body || null,
      }).eq('id', eventId);
    }

    return jsonResponse(res, 200, {
      ok: true,
      reference,
      result: innerRes.body || { status: 'processed' },
    });
  } catch (error) {
    console.error('[korapay-webhook] processing error:', error?.message || error);
    return jsonResponse(res, 500, { error: 'Webhook processing failed; KoraPay should retry this webhook.', reference });
  }
}
