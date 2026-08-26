// api/advertise-init-payment.js
//
// Server-side initialization for advertising payments.
//
// IMPORTANT:
// - The browser never supplies the amount.
// - The amount is calculated from ad_slot_config.
// - The advert must belong to the authenticated user.
// - billing_period is written using the values allowed by the existing
//   ads.billing_period CHECK constraint: "week" or "month".
// - customer.phone is the advertiser's WhatsApp number, already collected
//   and normalized (normalizeWhatsApp -> "+234...") when the ad was
//   created. Korapay's charge-initialize endpoint rejects the request
//   ("One or more fields are invalid") without a phone number, so we
//   reuse that value instead of asking the advertiser for it again.

import { createClient } from '@supabase/supabase-js';
import { korapayFetch } from './_korapay.js';
import { applyCors } from './_cors.js';
import {
  computeAdTotal,
  billingPeriodLabel,
} from './_advertising.js';

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    ad_id,
    redirect_url: redirectBase,
  } = req.body || {};

  if (!ad_id || !redirectBase) {
    return res.status(400).json({
      error: 'Missing ad_id or redirect_url',
    });
  }

  // ------------------------------------------------------------
  // Validate redirect URL
  // ------------------------------------------------------------

  let redirectUrlObj;

  try {
    redirectUrlObj = new URL(redirectBase);
  } catch {
    return res.status(400).json({
      error: 'Invalid redirect_url',
    });
  }

  // ------------------------------------------------------------
  // Server configuration
  // ------------------------------------------------------------

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.REACT_APP_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      'advertise-init-payment: missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'
    );

    return res.status(500).json({
      error: 'Advertising payments are not configured on the server yet.',
    });
  }

  const supabase = createClient(
    supabaseUrl,
    serviceRoleKey
  );

  // ------------------------------------------------------------
  // 1. Authenticate the caller
  // ------------------------------------------------------------

  const authHeader =
    req.headers.authorization || '';

  const jwt = authHeader
    .replace(/^Bearer\s+/i, '')
    .trim();

  if (!jwt) {
    return res.status(401).json({
      error: 'Missing authorization token',
    });
  }

  const {
    data: authData,
    error: authError,
  } = await supabase.auth.getUser(jwt);

  if (authError || !authData?.user) {
    return res.status(401).json({
      error: 'Invalid or expired session. Please log in again.',
    });
  }

  const userId = authData.user.id;

  // ------------------------------------------------------------
  // 2. Load advert
  // ------------------------------------------------------------

  const {
    data: ad,
    error: adErr,
  } = await supabase
    .from('ads')
    .select('*')
    .eq('id', ad_id)
    .maybeSingle();

  if (adErr) {
    console.error(
      'advertise-init-payment: failed to load ad',
      adErr
    );

    return res.status(500).json({
      error: 'Failed to load advert.',
    });
  }

  if (!ad) {
    return res.status(404).json({
      error: 'Advert not found.',
    });
  }

  if (ad.user_id !== userId) {
    return res.status(403).json({
      error: 'This advert does not belong to you.',
    });
  }

  // ------------------------------------------------------------
  // Don't initialize another payment for an already-paid advert
  // ------------------------------------------------------------

  if (
    ad.payment_status === 'paid' ||
    ad.payment_status === 'completed'
  ) {
    return res.status(200).json({
      status: true,
      data: {
        alreadyPaid: true,
      },
    });
  }

  // ------------------------------------------------------------
  // 3. Load slot pricing from database
  // ------------------------------------------------------------

  const {
    data: slotConfig,
    error: slotErr,
  } = await supabase
    .from('ad_slot_config')
    .select('*')
    .eq('slot', ad.slot)
    .maybeSingle();

  if (slotErr) {
    console.error(
      'advertise-init-payment: failed to load slot config',
      slotErr
    );

    return res.status(500).json({
      error: 'Failed to load advertising slot pricing.',
    });
  }

  if (!slotConfig) {
    return res.status(400).json({
      error: 'Unknown ad placement - cannot price this advert.',
    });
  }

  // ------------------------------------------------------------
  // 4. Calculate campaign duration from the advert itself
  // ------------------------------------------------------------

  const startsAt = ad.starts_at
    ? new Date(ad.starts_at)
    : null;

  const endsAt = ad.ends_at
    ? new Date(ad.ends_at)
    : null;

  if (
    !startsAt ||
    !endsAt ||
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime())
  ) {
    return res.status(400).json({
      error: 'Advert campaign dates are invalid.',
    });
  }

  const durationDays = Math.round(
    (endsAt.getTime() - startsAt.getTime()) /
      86400000
  );

  // ------------------------------------------------------------
  // 5. Calculate price SERVER-SIDE
  // ------------------------------------------------------------

  const amount = computeAdTotal(
    slotConfig,
    durationDays
  );

  if (!amount) {
    return res.status(400).json({
      error:
        'Could not determine a valid price for this campaign duration. Supported durations are 7, 14, or 30 days.',
    });
  }

  const billingPeriod =
    billingPeriodLabel(durationDays);

  if (!billingPeriod) {
    return res.status(400).json({
      error: 'Invalid advertising billing period.',
    });
  }

  // ------------------------------------------------------------
  // 6. Load buyer
  // ------------------------------------------------------------

  const {
    data: buyer,
    error: buyerErr,
  } = await supabase
    .from('users')
    .select('email, full_name')
    .eq('id', userId)
    .maybeSingle();

  if (buyerErr) {
    console.error(
      'advertise-init-payment: failed to load buyer',
      buyerErr
    );

    return res.status(500).json({
      error: 'Failed to load customer information.',
    });
  }

  if (!buyer?.email) {
    return res.status(400).json({
      error:
        'Your account has no email on file - cannot start checkout.',
    });
  }

  // ------------------------------------------------------------
  // 6b. Customer phone for Korapay
  //
  // The advertiser already gave us a WhatsApp number when the ad was
  // created (normalizeWhatsApp() in lib/advertising.js stores it as
  // "+234XXXXXXXXXX"). Korapay's charge-initialize call rejects the
  // request as invalid when customer.phone is missing, so reuse that
  // number rather than asking again. Digits-only, no leading "+", which
  // is the format Korapay expects.
  // ------------------------------------------------------------

  const customerPhone = String(ad.whatsapp_number || '')
    .replace(/\D/g, '');

  if (!customerPhone) {
    return res.status(400).json({
      error:
        'This advert has no WhatsApp number on file — cannot start checkout.',
    });
  }

  // ------------------------------------------------------------
  // 7. Save the server-computed price
  // ------------------------------------------------------------

  const {
    data: claimedAd,
    error: updateErr,
  } = await supabase
    .from('ads')
    .update({
      price: amount,
      billing_period: billingPeriod,
    })
    .eq('id', ad.id)
    .eq('payment_status', 'pending')
    .select('id')
    .maybeSingle();

  if (updateErr) {
    console.error(
      'advertise-init-payment: failed to record expected price',
      updateErr
    );

    return res.status(500).json({
      error: 'Failed to prepare payment.',
    });
  }

  if (!claimedAd) {
    return res.status(409).json({
      error:
        'This advert is no longer awaiting payment. Refresh and try again.',
    });
  }

  // ------------------------------------------------------------
  // 8. Generate unique Kora reference
  // ------------------------------------------------------------

  const reference =
    `ADV-${ad.id}-${Date.now()}`;

  redirectUrlObj.searchParams.set(
    'reference',
    reference
  );

  const redirect_url =
    redirectUrlObj.toString();

  // ------------------------------------------------------------
  // 9. Initialize Kora checkout
  //
  // Kept aligned with Kora's documented Checkout Redirect request.
  // We do NOT send:
  // - undefined values
  // - browser supplied amount
  // ------------------------------------------------------------

  const korapayPayload = {
    amount,
    currency: 'NGN',
    reference,
    redirect_url,
    customer: {
      name:
        String(
          ad.full_name ||
          buyer.full_name ||
          'Advertiser'
        ).trim() || 'Advertiser',

      email:
        String(buyer.email).trim(),

      phone: customerPhone,
    },

    narration:
      `Rentora advert - ${String(ad.slot || 'advertising').trim()}`,

    merchant_bears_cost: false,
  };

  console.log(
    '[advertise-init-payment] Initializing Kora checkout:',
    {
      ad_id: ad.id,
      reference,
      amount,
      currency: 'NGN',
      billing_period: billingPeriod,
      durationDays,
      customer_email: buyer.email,
      redirect_url,
    }
  );

  // ------------------------------------------------------------
  // 10. Call Kora
  // ------------------------------------------------------------

  try {
    const result = await korapayFetch(
      '/charges/initialize',
      {
        method: 'POST',
        body: JSON.stringify(
          korapayPayload
        ),
      }
    );

    console.log(
      '[advertise-init-payment] Kora response:',
      {
        ok: result.ok,
        status: result.status,
        body: result.body,
      }
    );

    if (
      !result.ok ||
      result.body?.status === false
    ) {
      // Return the actual Kora validation details so if Kora rejects
      // another field, we can immediately see which one instead of
      // getting the generic 422 message.
      return res.status(
        result.ok
          ? 502
          : result.status
      ).json({
        error:
          result.body?.message ||
          'Korapay checkout unavailable',

        details:
          result.body?.errors ||
          result.body?.data ||
          null,
      });
    }

    const checkoutUrl =
      result.body?.data?.checkout_url ||
      result.body?.data?.checkoutUrl;

    if (!checkoutUrl) {
      console.error(
        '[advertise-init-payment] Kora returned no checkout URL:',
        result.body
      );

      return res.status(502).json({
        error:
          'Korapay did not return a checkout URL.',
        details: result.body || null,
      });
    }

    return res.status(200).json({
      status: true,
      data: {
        reference,
        amount,
        checkout_url: checkoutUrl,
      },
    });

  } catch (error) {
    if (
      error?.code === 'not_configured'
    ) {
      return res.status(500).json({
        error:
          'Payment service is not configured',
      });
    }

    console.error(
      '[advertise-init-payment]',
      error
    );

    return res.status(500).json({
      error:
        'Failed to initialize payment',
    });
  }
}
