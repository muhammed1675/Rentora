// api/_advertising.js — shared, server-only ad pricing logic.
//
// The final price for an advert is ALWAYS derived here, from the
// `ad_slot_config` row for the chosen slot — never from a value the
// browser sends. Advertise.jsx only offers three fixed campaign
// lengths (7 / 14 / 30 days), which this maps onto the slot's stored
// rates:
//   7 days  -> 1x weekly_price
//   14 days -> 2x weekly_price
//   30 days -> monthly_price
//
// frontend/src/lib/advertising.js has a matching function used ONLY to
// show the advertiser an estimate before checkout — that estimate is
// never trusted for the actual charge. If you change the mapping here,
// update it there too so the displayed estimate doesn't drift from the
// real price.
export const AD_DURATION_OPTIONS = [7, 14, 30];

export function computeAdTotal(slotConfig, durationDays) {
  const days = Number(durationDays);
  const weekly = Number(slotConfig?.weekly_price ?? slotConfig?.price_per_week);
  const monthly = Number(slotConfig?.monthly_price ?? slotConfig?.price_per_month);

  let total = null;
  if (days === 7) total = weekly;
  else if (days === 14) total = Number.isFinite(weekly) ? weekly * 2 : null;
  else if (days === 30) total = monthly;

  if (!Number.isFinite(total) || total <= 0) return null;
  return Math.round(total);
}

// Human-readable label written to ads.billing_period alongside the price —
// display/reporting only; pricing itself always comes from computeAdTotal.
export function billingPeriodLabel(durationDays) {
  const days = Number(durationDays);
  if (days === 7) return 'weekly';
  if (days === 14) return 'biweekly';
  if (days === 30) return 'monthly';
  return null;
}
