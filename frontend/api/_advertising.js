// api/_advertising.js — shared, server-only ad pricing logic.
//
// The final price for an advert is ALWAYS derived here, from the
// `ad_slot_config` row for the chosen slot — never from a value
// the browser sends.
//
// Pricing:
//   7 days  -> 1x weekly_price
//   14 days -> 2x weekly_price
//   30 days -> monthly_price
//
// IMPORTANT:
// `public.ads.billing_period` has an existing CHECK constraint:
//
//   billing_period = ANY (ARRAY['week', 'month'])
//
// Therefore:
//   7 days  -> "week"
//   14 days -> "week"
//   30 days -> "month"
//
// The 14-day campaign is still priced as 2 × weekly_price.
// The billing_period value is simply constrained by the existing schema.

export const AD_DURATION_OPTIONS = [7, 14, 30];

export function computeAdTotal(slotConfig, durationDays) {
  const days = Number(durationDays);

  const weekly = Number(
    slotConfig?.weekly_price ?? slotConfig?.price_per_week
  );

  const monthly = Number(
    slotConfig?.monthly_price ?? slotConfig?.price_per_month
  );

  let total = null;

  if (days === 7) {
    total = weekly;
  } else if (days === 14) {
    total = Number.isFinite(weekly) ? weekly * 2 : null;
  } else if (days === 30) {
    total = monthly;
  }

  if (!Number.isFinite(total) || total <= 0) {
    return null;
  }

  return Math.round(total);
}

// Must match the existing database constraint:
// billing_period IN ('week', 'month')
//
// 7-day campaign  -> week
// 14-day campaign -> week
// 30-day campaign -> month
export function billingPeriodLabel(durationDays) {
  const days = Number(durationDays);

  if (days === 7 || days === 14) {
    return 'week';
  }

  if (days === 30) {
    return 'month';
  }

  return null;
}