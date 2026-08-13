// Server-side email sender for Rentora (Vercel API routes / webhooks).
//
// ROOT CAUSE OF THE 401s:
// callSupabaseSendEmail was forwarding a *user* access token (or the anon key)
// as the Authorization bearer. Webhooks and server confirmations have no logged-in
// user, so the send-email edge function rejected the call with
// {"error":"Invalid or expired session. Please log in again."}.
//
// FIX: server-to-server calls authenticate with the SERVICE ROLE key, never a
// user session. Pair this with the edge-function change in
// supabase-functions-send-email/index.ts.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) console.warn('[email] SUPABASE_URL is not set');
if (!SERVICE_ROLE_KEY) console.warn('[email] SUPABASE_SERVICE_ROLE_KEY is not set');

/**
 * Calls the Supabase `send-email` edge function with service-role auth.
 * Never pass a user token in here.
 *
 * @param {{type: string, to: string, data?: Record<string, unknown>}} payload
 * @returns {Promise<{ok: boolean, status: number, body: any}>}
 */
export async function callSupabaseSendEmail({ type, to, data = {} }) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error(
      'callSupabaseSendEmail: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var on the server',
    );
  }

  const url = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/send-email`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Both headers are required by Supabase Functions.
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ type, to, data }),
  });

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    throw new Error(
      `callSupabaseSendEmail: send-email returned ${res.status} for type=${type} to=${to} — ${text}`,
    );
  }

  return { ok: true, status: res.status, body };
}

/**
 * Fire-and-report wrapper: an email failure must never fail the payment flow.
 */
export async function trySendEmail(label, payload) {
  try {
    await callSupabaseSendEmail(payload);
    console.log(`[${label}] sent to=${payload.to} type=${payload.type}`);
    return true;
  } catch (err) {
    console.error(`[${label}] failed for ${payload.to}: ${err.message}`);
    return false;
  }
}
