// api/_flutterwave.js
// Shared helper for talking to the Flutterwave API from the server side.
// The secret key never leaves this module / the Vercel serverless runtime.
//
// Used by: flutterwave-init.js, flutterwave-verify.js, confirm-payment.js.
//
// NOTE: this file's contents were previously overwritten with a duplicate
// copy of flutterwave-webhook.js (same code, wrong file), which deleted all
// of the exports below. That's why every payment confirmation was failing
// with `TypeError: (0 , _flutterwave.getSecretKey) is not a function` —
// confirm-payment.js, flutterwave-init.js, and flutterwave-verify.js all
// import functions from this file that no longer existed. This restores
// them.

const FLW_BASE_URL = 'https://api.flutterwave.com/v3';

// Returns the secret key, or null if it isn't configured. Deliberately does
// NOT throw — confirm-payment.js checks this value with a plain `if (!secretKey)`
// alongside its other required env vars, so it needs a falsy return, not an
// exception. flwFetch() below is what turns a missing key into a thrown,
// catchable error for the callers that expect one.
export function getSecretKey() {
  return process.env.FLW_SECRET_KEY || null;
}

// Low-level fetch wrapper — every Flutterwave API call goes through this so
// the base URL and auth header only need to be right in one place.
export async function flwFetch(path, options = {}) {
  const secretKey = getSecretKey();
  if (!secretKey) {
    const err = new Error('FLW_SECRET_KEY is not set');
    err.code = 'not_configured';
    throw err;
  }

  const res = await fetch(`${FLW_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

// Verify a transaction server-side by OUR reference (tx_ref) — this is the
// call that can never be trusted from the browser, since it's what actually
// confirms money changed hands.
// Docs: https://developer.flutterwave.com/docs/transaction-verification
export async function verifyByReference(reference) {
  return flwFetch(`/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`, {
    method: 'GET',
  });
}

// Verify a transaction server-side by Flutterwave's own numeric transaction
// id. Used by admin-refund-payment.js to get a fresh id right before issuing
// a refund (we only ever store the reference / flw_ref string on our side,
// never the numeric id, so this looks it up on demand rather than trusting
// anything stale).
export async function verifyById(transactionId) {
  return flwFetch(`/transactions/${encodeURIComponent(transactionId)}/verify`, {
    method: 'GET',
  });
}

// Issue a refund for a completed charge. Docs:
// https://developer.flutterwave.com/docs/refunds
// amount is optional — omitting it refunds the full charged amount, which
// is what we want here since Rentora never does partial refunds from this
// flow (a held payment was never partially disbursed to anyone).
export async function refundTransaction(transactionId, amount = undefined) {
  return flwFetch(`/transactions/${encodeURIComponent(transactionId)}/refund`, {
    method: 'POST',
    body: JSON.stringify(amount ? { amount } : {}),
  });
}

// Normalizes the handful of fields confirm-payment.js / flutterwave-verify.js
// actually need out of a raw Flutterwave verify response, in exactly one
// place, so nobody has to remember Flutterwave's field names more than once.
export function readCharge(flwBody) {
  const data = flwBody?.data || {};
  return {
    id: data.id, // Flutterwave's numeric transaction id — required for /transactions/{id}/refund
    status: data.status,
    // charged_amount is what the CUSTOMER paid, which can be higher than
    // `amount` when they bear the transaction fee (common for NG bank
    // transfer/USSD) — see the note in confirm-payment.js for why this,
    // not `amount`, is compared against our expected total.
    amount: Number(data.charged_amount ?? data.amount),
    currency: data.currency,
    txRef: data.tx_ref,
    flwRef: data.flw_ref,
  };
}
