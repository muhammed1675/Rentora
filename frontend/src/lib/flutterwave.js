import { paymentAPI } from './api';

// Flutterwave Inline checkout.
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

// Map internal channel names -> Flutterwave payment_options
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
  onSuccess, onFailed, onClose, onPending,
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
    // Flutterwave amounts are in naira (major units) — no ×100 conversion.
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
      try { window.FlutterwaveCheckout.close?.(); } catch (_) {}

      // Flutterwave's own client-side widget reporting "successful" only
      // means the CHARGE went through — it says nothing about whether our
      // database actually got updated. That update happens in
      // /api/confirm-payment, which independently re-verifies the charge
      // server-side before marking anything paid/held. Previously this
      // function fired onSuccess based on `data.status` alone, completely
      // ignoring whether that confirm-payment call succeeded or threw —
      // so a user could see "Payment Successful" while the database row
      // was still sitting at 'pending' forever (nothing ever retried the
      // confirmation, and the failure was silently swallowed).
      if (!(data?.status === 'successful' || data?.status === 'completed')) {
        if (onFailed) onFailed(data);
        return;
      }

      // The charge succeeded — now make sure our side actually recorded
      // it. Retry a few times: there can be a brief lag between the
      // widget reporting success and Flutterwave's own systems being
      // ready to answer the server-side verify call confirm-payment makes.
      const MAX_ATTEMPTS = 4;
      const DELAYS_MS = [0, 1500, 3000, 5000];
      let confirmed = false;
      let lastErr = null;

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        if (DELAYS_MS[attempt]) await new Promise((r) => setTimeout(r, DELAYS_MS[attempt]));
        try {
          await paymentAPI.confirmPayment(reference);
          confirmed = true;
          break;
        } catch (err) {
          lastErr = err;
          console.error(`confirmPayment attempt ${attempt + 1}/${MAX_ATTEMPTS} failed:`, err.message);
        }
      }

      if (confirmed) {
        if (onSuccess) onSuccess(data?.flw_ref || data?.transaction_id || reference);
      } else {
        // The customer WAS charged — this is not a failed payment, just an
        // unconfirmed one. Never tell the user the payment failed here (that
        // reads as "try again", risking a double charge). Prefer a distinct
        // onPending callback so the caller can show an accurate message; the
        // Flutterwave webhook (server-to-server, independent of this browser
        // tab) will still confirm it shortly even if the user navigates away.
        console.error('Payment charged but confirm-payment never succeeded:', lastErr?.message, reference);
        if (onPending) onPending(reference);
        else if (onFailed) onFailed(data);
      }
    },
    onclose: () => {
      if (onClose) onClose();
    },
  });
}

