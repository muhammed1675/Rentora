export const RENTORA_SERVICE_FEE_RATE = 0.035;

export function calculateRentPricing(property = {}) {
  const rent = Math.max(0, Math.round(Number(property.price ?? property.rent_amount) || 0));
  const agencyFee = Math.max(0, Math.round(Number(property.agent_fee ?? 0) || 0));
  const cautionFee = Math.max(0, Math.round(Number(property.caution_fee) || 0));
  const inspectionFee = Math.max(0, Math.round(Number(property.inspection_fee) || 0));
  const agreementFee = Math.max(0, Math.round(Number(property.agreement_fee) || 0));
  const serviceFee = Math.round(rent * RENTORA_SERVICE_FEE_RATE);
  const total = rent + agencyFee + cautionFee + inspectionFee + agreementFee + serviceFee;

  return {
    rent,
    agencyFee,
    cautionFee,
    inspectionFee,
    agreementFee,
    serviceFee,
    total,
    serviceFeeRate: RENTORA_SERVICE_FEE_RATE,
  };
}

export function pricingFromPayment(row = {}) {
  return calculateRentPricing({
    price: row.rent_amount,
    agent_fee: row.agent_fee,
    caution_fee: row.caution_fee,
    inspection_fee: row.inspection_fee,
    agreement_fee: row.agreement_fee,
  });
}

export default calculateRentPricing;
