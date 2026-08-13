// supabase/functions/send-email/index.ts
//
// Accepts BOTH:
//  1. Service-role calls from server code (webhooks, /api/confirm-payment) — no user session.
//  2. Logged-in user calls from the browser — validated via getUser().
//
// The old version only did (2), which is why every server-triggered email
// returned 401 "Invalid or expired session. Please log in again."
//
// Deploy:  supabase functions deploy send-email
// Also set in Supabase → Edge Functions → Settings:
//   verify_jwt = false   (we do our own auth check below)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const FROM = Deno.env.get('EMAIL_FROM') ?? 'Rentora <support@rentora.com.ng>';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) return json({ error: 'Missing Authorization header' }, 401);

  // --- Path 1: trusted server-to-server call ---
  const isServiceRole = token === SERVICE_ROLE_KEY;

  // --- Path 2: browser call with a real user session ---
  if (!isServiceRole) {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return json({ error: 'Invalid or expired session. Please log in again.' }, 401);
    }
  }

  let payload: { type?: string; to?: string; data?: Record<string, unknown> };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { type, to, data = {} } = payload;
  if (!type || !to) return json({ error: 'type and to are required' }, 400);

  const { subject, html } = renderTemplate(type, data);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });

  const body = await res.text();
  if (!res.ok) {
    console.error(`[send-email] provider ${res.status}: ${body}`);
    return json({ error: 'Email provider rejected the request', detail: body }, 502);
  }

  return json({ ok: true, type, to });
});

function renderTemplate(type: string, d: Record<string, unknown>) {
  const wrap = (title: string, inner: string) => `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
      <h2 style="margin:0 0 16px">${title}</h2>
      ${inner}
      <p style="margin-top:24px;font-size:12px;color:#666">Rentora — rentora.com.ng</p>
    </div>`;

  switch (type) {
    case 'rent_payment_held':
      return {
        subject: `Your payment is secured with Rentora (${d.reference ?? ''})`,
        html: wrap(
          'Your funds are safely held',
          `<p>Hi ${d.name ?? 'there'},</p>
           <p>We have received your payment of <strong>₦${d.amount ?? ''}</strong> for
           <strong>${d.property ?? 'your property'}</strong>.</p>
           <p>The funds are held securely by Rentora and will only be released to the agent
           after you confirm the property and move-in details.</p>
           <p>Reference: <strong>${d.reference ?? ''}</strong></p>`,
        ),
      };
    case 'admin_payment_alert':
      return {
        subject: `New payment received — ${d.reference ?? ''}`,
        html: wrap(
          'New payment received',
          `<p><strong>Reference:</strong> ${d.reference ?? ''}</p>
           <p><strong>Amount:</strong> ₦${d.amount ?? ''}</p>
           <p><strong>Property:</strong> ${d.property ?? ''}</p>
           <p><strong>Student:</strong> ${d.student ?? ''}</p>
           <p><strong>Agent:</strong> ${d.agent ?? ''}</p>`,
        ),
      };
    case 'agent_payment_notice':
      return {
        subject: `A student has paid for your listing (${d.reference ?? ''})`,
        html: wrap(
          'Payment received for your listing',
          `<p>Hi ${d.name ?? 'there'},</p>
           <p>${d.student ?? 'A student'} has paid <strong>₦${d.amount ?? ''}</strong> for
           <strong>${d.property ?? 'your listing'}</strong>.</p>
           <p>Rentora is holding the funds until the student confirms move-in, after which
           payout is released to you.</p>
           <p>Reference: <strong>${d.reference ?? ''}</strong></p>`,
        ),
      };
    default:
      return {
        subject: String(d.subject ?? 'Rentora notification'),
        html: wrap('Rentora', `<p>${d.message ?? ''}</p>`),
      };
  }
}
