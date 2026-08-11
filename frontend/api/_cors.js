// api/_cors.js — shared CORS allow-list for Vercel serverless functions.
//
// Previously several endpoints (confirm-payment, flutterwave-verify,
// flutterwave-init, admin-refund-payment) set
// `Access-Control-Allow-Origin: *`, which lets ANY website's JavaScript
// call these endpoints on behalf of a logged-in user's browser. For
// admin-refund-payment and confirm-payment specifically, that's a
// cross-site request forgery surface on money-moving endpoints. Webhooks
// (Flutterwave calling us server-to-server) don't send an Origin header
// and aren't affected by this — CORS only matters for browser requests.
//
// Set ALLOWED_ORIGINS in Vercel env vars as a comma-separated list, e.g.:
//   ALLOWED_ORIGINS=https://rentora.com.ng,https://www.rentora.com.ng
// Falls back to localhost dev origins if unset, so local dev keeps working.

const DEFAULT_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

function getAllowedOrigins() {
  const fromEnv = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : DEFAULT_DEV_ORIGINS;
}

// Call at the top of a handler, same spot the old `setHeader('Access-Control-
// Allow-Origin', '*')` line was. Reflects the request's Origin back only if
// it's on the allow-list; otherwise omits the header entirely (browser will
// then block the response from being read cross-origin, which is correct).
export function applyCors(req, res, methods = 'POST, OPTIONS') {
  const allowed = getAllowedOrigins();
  const origin = req.headers.origin;

  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
