// api/_email-config.js
// Shared helper for resolving email sender / reply-to addresses across the
// Vercel serverless functions in this folder. Mirrors
// supabase/functions/_shared/email-config.ts — same env var names, same
// role/category split — so the two runtimes never drift apart.
//
// To change an address, set the env var in Vercel (Project Settings →
// Environment Variables). Nothing in frontend/api should hardcode
// support@ / billing@ / noreply@rentora.com.ng as a literal string.
//
// Used by: send-reply.js. (send-email.js is currently unused/dead code —
// see the Rentora email migration notes — and is intentionally left
// untouched, so it is NOT wired up to this config.)

export const SENDERS = {
  support: {
    email: process.env.EMAIL_ADDR_SUPPORT || 'support@rentora.com.ng',
    name: 'Rentora Support',
  },
  billing: {
    email: process.env.EMAIL_ADDR_BILLING || 'billing@rentora.com.ng',
    name: 'Rentora Billing',
  },
  noreply: {
    email: process.env.EMAIL_ADDR_NOREPLY || 'noreply@rentora.com.ng',
    name: 'Rentora',
  },
};

export function formatSender(role) {
  const s = SENDERS[role];
  return `${s.name} <${s.email}>`;
}

// Every admin → customer reply sent through this app is a human
// conversation, so it always comes from support@ in Phase 1 (no
// subject-based routing).
export function senderForReply() {
  return formatSender('support');
}
