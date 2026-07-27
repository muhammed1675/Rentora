import { paymentAPI } from './api';

// Flutterwave Inline checkout (replaces the old Korapay modal).
// Docs: https://developer.flutterwave.com/v3.0/docs/inline
const SCRIPT_URL = 'https://checkout.flutterwave.com/v3.js';

function loadScript() {
  return new Promise((resolve, reject) => {
    if (window.FlutterwaveCheckout) { resolve(); return; }
    const existing = document.querySelector(`script[src="${SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener('load', resolve);
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load payment script. Check your connection.'));
    document.body.appendChild(script);
  });
}

// Korapay channel names -> Flutterwave payment_options
function mapChannel(channel) {
  switch (channel) {
    case 'card': return 'card';
    case 'bank_transfer': return 'banktransfer';
    case 'pay_with_bank': return 'ussd';
    default: return channel;
  }
}

export async function openFlutterwaveCheckout({
  reference, amount, email, name, phone, narration,
  channels, defaultChannel,
  onSuccess, onFailed, onClose,
}) {
  await loadScript();

  const key = process.env.REACT_APP_FLW_PUBLIC_KEY;
  if (!key) {
    throw new Error('Flutterwave public key not found. Add REACT_APP_FLW_PUBLIC_KEY to your Vercel environment variables.');
  }

  const paymentOptions = (channels && channels.length
    ? channels
    : ['card', 'bank_transfer', 'pay_with_bank']
  ).map(mapChannel).filter(Boolean);

  if (defaultChannel) {
    const mapped = mapChannel(defaultChannel);
    paymentOptions.sort((a, b) => (a === mapped ? -1 : b === mapped ? 1 : 0));
  }

  window.FlutterwaveCheckout({
    public_key: key,
    tx_ref: reference,
    // Flutterwave amounts are in naira (major units), same as Korapay's
    // decimal amount — no ×100 conversion.
    amount,
    currency: 'NGN',
    payment_options: paymentOptions.join(','),
    customer: {
      email,
      name: name || 'Customer',
      phone_number: phone || '',
    },
    customizations: {
      title: 'Rentora',
      description: narration || 'Rentora',
    },
    callback: async (data) => {
      // The browser callback is NEVER trusted on its own — /api/confirm-payment
      // re-verifies the charge with Flutterwave using the secret key before
      // anything is marked paid. Same guarantee as the old Korapay flow.
      //
      // IMPORTANT: right after the modal reports success, Flutterwave's own
      // verify_by_reference endpoint can still briefly read back "pending"
      // (their systems catching up) — /api/confirm-payment fails closed in
      // that case, on purpose, rather than risk marking an unpaid charge as
      // paid. The old version called confirmPayment exactly once, swallowed
      // any failure with a console.error, and then STILL showed the user a
      // "success" toast based only on the modal's own status — leaving the
      // inspection/token/rent record stuck on "pending" in the database
      // with no visible error and no retry. Retry a few times before
      // giving up, and only report success once our own server has
      // actually confirmed it.
      let confirmed = false;
      let lastErr = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await paymentAPI.confirmPayment(reference);
          confirmed = true;
          break;
        } catch (err) {
          lastErr = err;
          if (attempt < 4) await new Promise((r) => setTimeout(r, 3000));
        }
      }
      if (!confirmed) {
        console.error('Failed to confirm payment in DB after retries:', lastErr);
      }

      try { window.FlutterwaveCheckout.close?.(); } catch (_) {}

      if (confirmed) {
        if (onSuccess) onSuccess(data?.flw_ref || data?.transaction_id || reference);
      } else if (onFailed) {
        // pendingConfirmation=true means Flutterwave's modal says the charge
        // went through but our server couldn't confirm it yet (or at all) —
        // this is NOT the same as a declined/failed card, so callers should
        // not tell the user their payment failed outright. The webhook
        // (api/flutterwave-webhook.js) will still complete it in the
        // background if this was just a timing issue.
        onFailed({ ...data, pendingConfirmation: true, reference });
      }
    },
    onclose: () => {
      if (onClose) onClose();
    },
  });
}

// Back-compat alias so any straggling import keeps working.
export const openKorapayCheckout = openFlutterwaveCheckout;
