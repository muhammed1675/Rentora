// frontend/api/notify-contact-admins.js — Vercel Serverless Function (Node runtime)
//
// Emails every admin about a new Contact page submission.
//
// WHY THIS EXISTS: the Contact page is public — most people who use it are
// NOT logged in. The generic browser-side notifyAdmins() helper
// (frontend/src/lib/api.js) authenticates its call to the Supabase
// send-email edge function with the caller's session token, falling back
// to the public anon key when there's no session. The edge function
// requires either a trusted server caller (service-role key /
// x-internal-secret) or a real user token verified via auth.getUser() —
// the anon key satisfies neither, so that call gets a 401 and is silently
// dropped (notifyAdmins never inspects the fetch response status). Net
// effect: an anonymous visitor's contact-form submission was saved to the
// database, but admins never got an email about it.
//
// This endpoint runs server-side with the Supabase service-role key, so it
// works identically whether the visitor is logged in or not.
//
// Required env vars (Vercel → Settings → Environment Variables):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY (used
//   downstream by the send-email edge function), ALLOWED_ORIGINS

import { applyCors } from './_cors.js';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const INTERNAL_EMAIL_SECRET = (process.env.INTERNAL_EMAIL_SECRET || '').trim();

async function sb(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) throw new Error(`Supabase REST ${res.status}: ${typeof json === 'string' ? json : JSON.stringify(json)}`);
  return json;
}

async function callSupabaseSendEmail(payload) {
  if (!SUPABASE_URL || (!SERVICE_ROLE_KEY && !INTERNAL_EMAIL_SECRET)) {
    throw new Error(`notify-contact-admins: missing env vars (hasUrl=${!!SUPABASE_URL}, hasServiceRoleKey=${!!SERVICE_ROLE_KEY}, hasInternalSecret=${!!INTERNAL_EMAIL_SECRET})`);
  }
  const headers = { 'Content-Type': 'application/json' };
  if (SERVICE_ROLE_KEY) headers['Authorization'] = `Bearer ${SERVICE_ROLE_KEY}`;
  if (INTERNAL_EMAIL_SECRET) headers['x-internal-secret'] = INTERNAL_EMAIL_SECRET;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`send-email returned ${res.status}: ${body}`);
  }
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name, email, phone, subject, message } = req.body || {};
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const admins = await sb(`users?role=eq.admin&select=email,full_name`);
    if (!Array.isArray(admins) || admins.length === 0) {
      console.warn('notify-contact-admins: no admin users found — nobody to notify');
      return res.status(200).json({ ok: true, notified: 0 });
    }

    const results = await Promise.allSettled(
      admins.filter((a) => a.email).map((admin) =>
        callSupabaseSendEmail({
          type: 'admin_activity_alert',
          to: admin.email,
          data: {
            title: `New contact message: ${subject}`,
            event_label: 'Contact message',
            summary: `${name} sent a message through the contact form.`,
            breakdown: [
              ['From', name],
              ['Email', email],
              ['Phone', phone || '—'],
              ['Subject', subject],
              ['Message', message],
            ],
            action_url: 'https://www.rentora.com.ng/admin',
            admin_name: admin.full_name || 'Admin',
          },
        })
      )
    );

    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length) {
      failed.forEach((f) => console.error('notify-contact-admins: send failed —', f.reason?.message || f.reason));
    }

    return res.status(200).json({ ok: true, notified: admins.length - failed.length, failed: failed.length });
  } catch (err) {
    console.error('notify-contact-admins: unexpected error', err);
    return res.status(500).json({ error: 'Failed to notify admins', detail: String(err?.message || err) });
  }
}