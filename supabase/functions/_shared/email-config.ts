// supabase/functions/_shared/email-config.ts
//
// Single source of truth for "who does an email come from" across every
// Supabase Edge Function. Nothing outside this file should ever hardcode
// support@ / billing@ / noreply@rentora.com.ng as a literal string.
//
// To change an address, change the env var (`supabase secrets set
// EMAIL_ADDR_SUPPORT=...`) — no code changes, no redeploy of every function
// that happens to send email.
//
// Import from a sibling function with:
//   import { senderFor, replyToFor } from "../_shared/email-config.ts";

// ── Sender identities ───────────────────────────────────────────────
// Each key is a "mailbox role", not a specific email type. New email types
// map onto one of these three roles below in EMAIL_CATEGORY /
// ADMIN_ALERT_ROLE — they never get a bespoke sender of their own.
export const SENDERS = {
  support: {
    email: Deno.env.get("EMAIL_ADDR_SUPPORT") || "support@rentora.com.ng",
    name: "Rentora Support",
  },
  billing: {
    email: Deno.env.get("EMAIL_ADDR_BILLING") || "billing@rentora.com.ng",
    name: "Rentora Billing",
  },
  noreply: {
    email: Deno.env.get("EMAIL_ADDR_NOREPLY") || "noreply@rentora.com.ng",
    name: "Rentora",
  },
} as const;

export type SenderRole = keyof typeof SENDERS;

function formatSender(role: SenderRole): string {
  const s = SENDERS[role];
  return `${s.name} <${s.email}>`;
}

// ── Reply-To rules ──────────────────────────────────────────────────
// Per the approved architecture:
//   - Authentication / account emails            → Reply-To: support@
//   - Property & viewing notifications         → Reply-To: support@
//   - Financial transaction emails                → Reply-To: billing@
//   - Internal admin alerts (any kind)             → Reply-To: support@
//     (an admin replying to an internal alert about a withdrawal request,
//     a new listing, etc. should reach the support team, not billing@ —
//     these alerts are operational, not a customer-facing financial email)
const REPLY_TO_BY_ROLE: Record<SenderRole, string> = {
  support: SENDERS.support.email,
  billing: SENDERS.billing.email,
  noreply: SENDERS.support.email,
};

// ── Email type → sender role ─────────────────────────────────────────
// This is the only place that decides which mailbox an email type comes
// from. Only emails whose PRIMARY purpose is a financial transaction
// (receipts, escrow hold/release, payment confirmations, future refunds/
// invoices/withdrawals) are on `billing`. Everything else — including
// viewing booking/confirmation/reminder emails, and ALL internal admin
// alerts (including payment and withdrawal alerts, which are internal
// system notifications, not customer-facing financial communications) —
// stays on `noreply`. Admin replies to contact messages are handled
// separately by send-reply/index.ts and always use `support`.
export const EMAIL_CATEGORY: Record<string, SenderRole> = {
  // Non-financial automated / auth / account emails
  welcome: "noreply",
  sign_in: "noreply",
  verification_approved: "noreply",
  verification_rejected: "noreply",
  property_approved: "noreply",
  account_deleted: "noreply",

  // Advertising review outcomes — same non-financial "noreply" role as
  // property_approved/property_rejected above. The financial side (payment
  // received, receipt) is handled separately by the existing rent/token
  // billing categories; these two are purely the admin review decision.
  ad_approved: "noreply",
  ad_rejected: "noreply",

  // Viewing notifications — booking, confirmation, reminders. Kept off
  // billing@ even though inspection_booked includes a fee-paid receipt
  // line, because the PRIMARY purpose of these emails is confirming the
  // viewing, not a financial transaction.
  inspection_booked: "noreply",
  inspection_agent_notify: "noreply",

  // Financial transaction emails — primary purpose is money changing hands
  token_receipt: "billing",
  rent_payment_held: "billing",
  rent_payment_receipt: "billing",
  rent_payment_released: "billing",
  rent_payment_released_student: "billing",

  // Internal admin alerts — always noreply, no conditional routing, even
  // for financial-flavored events (payment alerts, withdrawal requests).
  admin_payment_alert: "noreply",
  admin_activity_alert: "noreply",
};

/**
 * Resolve the "From" header for a given email type. Falls back to
 * `noreply` for any type not explicitly listed above, so a new/unknown
 * type never accidentally sends from billing@ or support@.
 */
export function senderFor(emailType: string): string {
  const role = EMAIL_CATEGORY[emailType] ?? "noreply";
  return formatSender(role);
}

/**
 * Resolve the "Reply-To" header for a given email type, following the
 * same role lookup as senderFor().
 */
export function replyToFor(emailType: string): string {
  const role = EMAIL_CATEGORY[emailType] ?? "noreply";
  return REPLY_TO_BY_ROLE[role];
}