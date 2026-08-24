const API_URL = 'https://api.korapay.com/merchant/api/v1';

export function getSecretKey() { return process.env.KORAPAY_SECRET_KEY || ''; }

export async function korapayFetch(path, options = {}) {
  const secret = getSecretKey();
  if (!secret) { const error = new Error('Korapay is not configured'); error.code = 'not_configured'; throw error; }
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}`, ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, body };
}

export async function verifyByReference(reference) {
  return korapayFetch(`/charges/${encodeURIComponent(reference)}`);
}

export function readCharge(body) {
  const charge = body?.data || body?.charge || {};
  return { status: String(charge.status || '').toLowerCase(), amount: Number(charge.amount), currency: charge.currency, txRef: charge.reference || charge.merchant_reference || charge.merchantReference, providerReference: charge.payment_reference || charge.reference };
}

export function isValidSignature(payload, signature) {
  const configured = process.env.KORAPAY_WEBHOOK_SECRET || process.env.KORAPAY_SECRET_KEY;
  return Boolean(configured && signature && signature === configured);
}
