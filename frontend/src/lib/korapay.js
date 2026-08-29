import { paymentAPI } from './api';

/**
 * Korapay Hosted Checkout uses a server-created redirect URL, opened in a
 * new tab/popup so the original page (property details, profile, etc.)
 * stays put underneath it.
 *
 * IMPORTANT: this used to call onPending() the instant the popup opened
 * and never check again — onSuccess/onFailed were accepted as parameters
 * but never actually invoked. That meant the original tab never learned
 * the real outcome; it just assumed "pending" forever, which is exactly
 * why closing the popup tab felt like the payment "hung." This version
 * actually checks the real status (via the same /api/confirm-payment
 * endpoint the callback page uses) once the popup closes, and again if
 * the original tab regains focus — so it reflects reality instead of a
 * one-time guess. The webhook remains the ultimate source of truth; this
 * is just about the ORIGINAL tab finding out what the webhook already
 * knows, instead of staying silent.
 */
export async function openKorapayCheckout({ reference, amount, email, name, phone, narration, onSuccess, onFailed, onPending, onClose }) {
  const response = await paymentAPI.initializeKorapay({
    reference,
    amount,
    currency: 'NGN',
    customer: { email, name: name || 'Customer', phone: phone || '' },
    narration: narration || 'Rentora payment',
    redirect_url: `${window.location.origin}/payment/callback?reference=${encodeURIComponent(reference)}`,
  });
  const checkoutUrl = response?.data?.checkout_url || response?.checkout_url;
  if (!checkoutUrl) throw new Error('Payment checkout is unavailable. Please try again.');
  const popup = window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
  const usedPopup = !!popup;
  if (!usedPopup) window.location.assign(checkoutUrl);

  // Tell the caller we're now waiting — this is genuinely true at this
  // point (unlike before, nothing here claims success or failure yet).
  if (onPending) onPending(reference);

  if (!usedPopup) {
    // Full-page redirect (popup blocked): this tab is about to navigate
    // away to Korapay, so there's nothing left to poll from here — the
    // /payment/callback page handles the outcome after Korapay redirects
    // back. Nothing further to do.
    return { reference, checkout_url: checkoutUrl };
  }

  let settled = false;
  const checkOutcome = async (source) => {
    if (settled) return;
    try {
      const res = await paymentAPI.confirmPayment(reference);
      if (res?.data?.status === 'completed' || res?.data?.ok === true) {
        settled = true;
        cleanup();
        if (onSuccess) onSuccess(reference);
      }
      // Anything else (including a thrown "still pending" error caught
      // below) just means: not confirmed yet. Keep waiting rather than
      // guessing failure — the webhook may simply not have landed yet.
    } catch (error) {
      // A hard, non-retryable rejection from Korapay (declined, invalid,
      // etc.) is the one case where we tell the user it actually failed.
      const hardFailure = /declined|invalid|failed|not successful/i.test(error?.message || '') && error?.status !== 404 && error?.status !== 402;
      if (hardFailure && source === 'popup_closed') {
        settled = true;
        cleanup();
        if (onFailed) onFailed(reference);
      }
      // Otherwise: stay pending, let the next check (or the webhook) settle it.
    }
  };

  const onFocus = () => checkOutcome('focus');
  window.addEventListener('focus', onFocus);

  const poll = setInterval(() => {
    if (popup.closed) {
      clearInterval(poll);
      checkOutcome('popup_closed');
    }
  }, 1000);

  function cleanup() {
    clearInterval(poll);
    window.removeEventListener('focus', onFocus);
    if (onClose) onClose();
  }

  // Safety net: stop polling after 15 minutes even if the popup was never
  // detected as closed (e.g. some mobile browsers don't reliably report
  // popup.closed for cross-origin windows) so this never runs forever.
  setTimeout(() => { if (!settled) cleanup(); }, 15 * 60 * 1000);

  return { reference, checkout_url: checkoutUrl };
}

export const calculateRentFees = ({ rent, agencyFee = 0, agreementFee = 0, cautionFee = 0, inspectionFee = 0, documentationFee = 0, otherFees = [] }) => {
  const n = (value) => Math.max(0, Math.round(Number(value) || 0));
  const normalizedOtherFees = (Array.isArray(otherFees) ? otherFees : []).map((fee) => ({ name: String(fee?.name || '').trim(), amount: n(fee?.amount) })).filter((fee) => fee.name && fee.amount > 0);
  const rentAmount = n(rent);
  const propertyFees = { agency_fee: n(agencyFee), agreement_fee: n(agreementFee), caution_fee: n(cautionFee), inspection_fee: n(inspectionFee), documentation_fee: n(documentationFee), other_fees: normalizedOtherFees };
  const otherTotal = normalizedOtherFees.reduce((sum, fee) => sum + fee.amount, 0);
  const serviceFee = Math.round(rentAmount * 0.035);
  return { rent_amount: rentAmount, ...propertyFees, other_fees_total: otherTotal, service_fee: serviceFee, total_amount: rentAmount + serviceFee + propertyFees.agency_fee + propertyFees.agreement_fee + propertyFees.caution_fee + propertyFees.inspection_fee + propertyFees.documentation_fee + otherTotal };
};