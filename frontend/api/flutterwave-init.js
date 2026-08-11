// api/flutterwave-init.js
// Vercel serverless function — creates a Flutterwave Standard payment and
// returns the hosted checkout link. The secret key never reaches the browser.
//
// Replaces the old api/korapay-init.js.

import { flwFetch } from './_flutterwave.js';
import { applyCors } from './_cors.js';

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { reference, amount, currency, customer, redirect_url, channels, narration } = req.body || {};

  if (!reference || !amount || !customer?.email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const { ok, status, body } = await flwFetch('/payments', {
      method: 'POST',
      body: JSON.stringify({
        tx_ref: reference,
        // Flutterwave amounts are in MAJOR units (naira), same as Korapay's
        // decimal amount — do NOT multiply by 100.
        amount: String(amount),
        currency: currency || 'NGN',
        redirect_url,
        // Korapay channels -> Flutterwave payment_options
        payment_options: (channels && channels.length
          ? channels
          : ['card', 'banktransfer', 'ussd']
        )
          .map(mapChannel)
          .filter(Boolean)
          .join(','),
        customer: {
          email: customer.email,
          name: customer.name,
          phonenumber: customer.phone || customer.phonenumber,
        },
        customizations: {
          title: 'Rentora',
          description: narration || 'Rentora payment',
        },
      }),
    });

    if (!ok || body?.status !== 'success') {
      return res
        .status(ok ? 502 : status)
        .json({ error: body?.message || 'Flutterwave error', data: body });
    }

    // Shape kept close to the old Korapay response so callers stay simple.
    return res.status(200).json({
      status: true,
      data: {
        reference,
        checkout_url: body?.data?.link,
      },
    });
  } catch (err) {
    if (err.code === 'not_configured') {
      return res.status(500).json({ error: 'Payment service not configured' });
    }
    console.error('Flutterwave init error:', err);
    return res.status(500).json({ error: 'Failed to initialize payment' });
  }
}

function mapChannel(channel) {
  switch (channel) {
    case 'card':
      return 'card';
    case 'bank_transfer':
    case 'banktransfer':
      return 'banktransfer';
    case 'pay_with_bank':
      return 'ussd';
    case 'mobile_money':
      return 'mobilemoneyghana';
    default:
      return channel;
  }
}
