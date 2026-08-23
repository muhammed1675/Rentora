export const RENTORA_SERVICE_FEE_RATE = 0.035;

const finiteAmount = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0;
};

export function normalizeOtherFees(value) {
  const source = Array.isArray(value) ? value : (typeof value === 'string' ? (() => { try { return JSON.parse(value); } catch { return []; } })() : []);
  return source.map((fee) => ({
    name: String(fee?.name ?? fee?.label ?? '').trim(),
    amount: finiteAmount(fee?.amount ?? fee?.value),
  })).filter((fee) => fee.name && fee.amount > 0);
}

export function calculateRentPricing(property = {}) {
  const rent = finiteAmount(property.price ?? property.rent_amount);
  const agencyFee = finiteAmount(property.agent_fee);
  const cautionFee = finiteAmount(property.caution_fee);
  const inspectionFee = finiteAmount(property.inspection_fee);
  const agreementFee = finiteAmount(property.agreement_fee);
  const otherFees = normalizeOtherFees(property.other_fees ?? property.custom_fees);
  const otherFeesTotal = otherFees.reduce((sum, fee) => sum + fee.amount, 0);
  const serviceFee = Math.round(rent * RENTORA_SERVICE_FEE_RATE);
  const total = rent + agencyFee + cautionFee + inspectionFee + agreementFee + otherFeesTotal + serviceFee;

  return { rent, agencyFee, cautionFee, inspectionFee, agreementFee, otherFees, otherFeesTotal, serviceFee, total, serviceFeeRate: RENTORA_SERVICE_FEE_RATE };
}

export function pricingFromPayment(row = {}) {
  return calculateRentPricing({ price: row.rent_amount, agent_fee: row.agent_fee, caution_fee: row.caution_fee, inspection_fee: row.inspection_fee, agreement_fee: row.agreement_fee, other_fees: row.other_fees });
}

export default calculateRentPricing;

export const feeDisplayLines = (pricing) => [
  pricing.agencyFee > 0 && ['Agency Fee', pricing.agencyFee],
  pricing.inspectionFee > 0 && ['Inspection Fee', pricing.inspectionFee],
  pricing.agreementFee > 0 && ['Agreement Fee', pricing.agreementFee],
  pricing.cautionFee > 0 && ['Caution Fee', pricing.cautionFee],
  ...pricing.otherFees.map((fee) => [`${fee.name} Fee`, fee.amount]),
].filter(Boolean);
