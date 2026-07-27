// api/_flutterwave.js
// Shared server-side Flutterwave helpers. Never imported by browser code —
// the secret key must never reach the client.
//
// Required Vercel environment variables:
//   FLW_SECRET_KEY   (server-side only) — "FLWSECK-..." / "FLWSECK_TEST-..."
//   FLW_PUBLIC_KEY   is only needed on the client as REACT_APP_FLW_PUBLIC_KEY

export const FLW_BASE_URL = 'https://api.flutterwave.com/v3';

export function getSecretKey() {
  return process.env.FLW_SECRET_KEY || process.env.FLUTTERWAVE_SECRET_KEY || '';
}

export async function flwFetch(path, options = {}) {
  const secretKey = getSecretKey();
  if (!secretKey) {
    const err = new Error('Payment service not configured (FLW_SECRET_KEY missing)');
    err.code = 'not_configured';
    throw err;
  }

  const res = await fetch(`${FLW_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

// Verify a transaction using OUR reference (tx_ref), which is what the app
// stores in the database. Flutterwave also exposes verification by its own
// transaction id; verifying by reference avoids trusting anything the
// browser sends us beyond the reference itself.
export async function verifyByReference(reference) {
  return flwFetch(`/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`, {
    method: 'GET',
  });
}

// Normalises a Flutterwave verify payload into { status, amount, currency, flwRef }.
// Flutterwave marks a completed payment as data.status === "successful".
export function readCharge(body) {
  const data = body?.data || {};
  return {
    status: data.status,                        // "successful" | "failed" | "pending"
    amount: Number(data.charged_amount ?? data.amount),
    currency: data.currency,
    txRef: data.tx_ref,
    flwRef: data.flw_ref || data.id ? String(data.flw_ref || data.id) : undefined,
  };
}
