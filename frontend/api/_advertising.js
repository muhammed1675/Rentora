// api/_advertising.js — shared, server-only ad pricing logic.
//
// The final price for an advert is ALWAYS derived here, from the
// `ad_slot_config` row for the chosen slot — never from a value the
// browser sends. Advertise.jsx only offers three fixed campaign
// lengths (7 / 14 / 30 days), which this maps onto the slot's stored
// rates:
//   7 days  -> weekly_price
//   14 days -> biweekly_price (set independently by admin, NOT weekly x2)
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
  const biweekly = Number(slotConfig?.biweekly_price);
  const monthly = Number(slotConfig?.monthly_price ?? slotConfig?.price_per_month);

  let total = null;
  if (days === 7) total = weekly;
  else if (days === 14) total = biweekly;
  else if (days === 30) total = monthly;

  if (!Number.isFinite(total) || total <= 0) return null;
  return Math.round(total);
}

// Database constraint: ads.billing_period IN ('week', 'month') — a 14-day
// campaign still falls in the 'week' bucket for billing-period grouping,
// even though its price is its own stored biweekly_price now, not a
// calculated 2x. Only a 30-day campaign is 'month'. Any other label here
// fails the insert.
export function billingPeriodLabel(durationDays) {
  const days = Number(durationDays);
  if (days === 7 || days === 14) return 'week';
  if (days === 30) return 'month';
  return null;
}