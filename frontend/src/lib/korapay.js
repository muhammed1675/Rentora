import { paymentAPI } from './api';

/** Korapay Hosted Checkout uses a server-created redirect URL. */
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
  if (!popup) window.location.assign(checkoutUrl);
  if (onPending) onPending(reference);
  if (onClose) onClose();
  return { reference, checkout_url: checkoutUrl, onSuccess, onFailed };
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
