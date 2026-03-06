import { paymentAPI } from './api';

const SCRIPT_URL = 'https://korablobstorage.blob.core.windows.net/modal-bucket/korapay-collections.min.js';

function loadScript() {
  return new Promise((resolve, reject) => {
    if (window.Korapay) { resolve(); return; }
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

export async function openKorapayCheckout({
  reference, amount, email, name, narration,
  onSuccess, onFailed, onClose,
}) {
  await loadScript();

  const key = process.env.REACT_APP_KORAPAY_PUBLIC_KEY;
  if (!key) {
    throw new Error('Korapay public key not found. Add REACT_APP_KORAPAY_PUBLIC_KEY to your Vercel environment variables.');
  }

  window.Korapay.initialize({
    key,
    reference,
    amount,
    currency: 'NGN',
    narration: narration || 'Rentora',
    merchant_bears_cost: false,   // ← client bears the fee
    customer: {
      name: name || 'Customer',
      email,
    },
    onSuccess: async (data) => {
      try {
        // Mark transaction complete in DB and credit wallet/inspection
        await paymentAPI.confirmPayment(reference);
      } catch (err) {
        console.error('Failed to confirm payment in DB:', err);
        // Payment went through — still proceed
      }
      if (onSuccess) onSuccess(data);
    },
    onFailed: (data) => {
      if (onFailed) onFailed(data);
    },
    onClose: () => {
      if (onClose) onClose();
    },
  });
}
