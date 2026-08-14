// frontend/api/broadcast-email.js — Vercel Serverless Function (Node runtime)
//
// Sends ONE admin broadcast to the email address of every matching user
// (target: 'all' | 'user' | 'agent'), in batches, via Resend's batch API.
//
// Security:
//   - Caller must send their Supabase user access token as
//     `Authorization: Bearer <token>`; the token is validated with the service
//     role key and the user's role must be 'admin' in public.users.
//   - CORS is limited to ALLOWED_ORIGINS (see _cors.js).
//
// Double-send protection:
//   - Every broadcast id is claimed once in public.broadcast_email_sends
//     (primary key = broadcast_id). A second call for the same broadcast —
//     double click, retried request, refreshed tab — returns
//     { already_sent: true } and sends nothing.
//
// Required env vars (Vercel → Settings → Environment Variables):
//   RESEND_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   EMAIL_ADDR_NOREPLY (optional), PUBLIC_SITE_URL (optional),
//   ALLOWED_ORIGINS

import { applyCors } from './_cors.js';
import { SENDERS } from './_email-config.js';

export const config = { maxDuration: 60 };

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://www.rentora.com.ng').replace(/\/$/, '');
const FROM = `${SENDERS.noreply.name} <${SENDERS.noreply.email}>`;
const REPLY_TO = SENDERS.support.email;

const BATCH_SIZE = 100;   // Resend hard limit per batch request
const BATCH_PAUSE_MS = 600; // stay under Resend's rate limit

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function sb(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { ok: res.ok, status: res.status, body: json, raw: text };
}

// ── Email template (Rentora-branded, plain-table HTML for Gmail/Outlook) ──
function broadcastEmailHtml({ firstName, title, body, link, linkLabel }) {
  const paragraphs = String(body || '')
    .split(/\n{2,}/)
    .map((p) => escapeHtml(p.trim()).replace(/\n/g, '<br />'))
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151">${p}</p>`)
    .join('');

  const ctaUrl = link
    ? (/^https?:\/\//i.test(link) ? link : `${SITE_URL}${link.startsWith('/') ? '' : '/'}${link}`)
    : null;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(String(body).slice(0, 120))}</div>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f1f5f9;padding:32px 12px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(15,23,42,0.07)">
        <tr><td style="height:6px;background:#16a34a"></td></tr>
        <tr><td align="center" style="padding:28px 32px 8px">
          <img src="${SITE_URL}/rentora-logo.png" alt="Rentora" width="132" style="display:block;border:0;max-width:132px;height:auto" />
        </td></tr>
        <tr><td style="padding:16px 32px 8px">
          <h1 style="margin:0 0 18px;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700">${escapeHtml(title)}</h1>
          <p style="margin:0 0 16px;font-size:15px;color:#374151">Hi ${escapeHtml(firstName || 'there')},</p>
          ${paragraphs}
          ${ctaUrl ? `
          <table cellpadding="0" cellspacing="0" role="presentation" style="margin:26px 0 8px">
            <tr><td align="center" style="background:#16a34a;border-radius:10px">
              <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">${escapeHtml(linkLabel || 'Open Rentora')} &rarr;</a>
            </td></tr>
          </table>` : ''}
        </td></tr>
        <tr><td style="padding:8px 32px 28px">
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
          <p style="margin:0;font-size:14px;font-weight:700;color:#0f172a">Rentora</p>
          <p style="margin:4px 0 0;font-size:13px;color:#6b7280">Student housing you can trust</p>
          <p style="margin:10px 0 0;font-size:13px"><a href="${SITE_URL}" style="color:#16a34a;text-decoration:none">www.rentora.com.ng</a></p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:11px;color:#94a3b8">&copy; ${new Date().getFullYear()} Rentora Skyline Housing Solutions. You receive this because you have a Rentora account.</p>
    </td></tr>
  </table>
</body>
</html>`;
}

export default async function handler(req, res) {
  applyCors(req, res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !RESEND_API_KEY) {
    return res.status(500).json({ error: 'Server email config missing (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / RESEND_API_KEY)' });
  }

  // ── 1. Authenticate the caller and require admin ──
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'Missing Authorization header' });

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  const authUser = await userRes.json();

  const roleRes = await sb(`users?id=eq.${authUser.id}&select=role`);
  if (!roleRes.ok || !Array.isArray(roleRes.body) || roleRes.body[0]?.role !== 'admin') {
    return res.status(403).json({ error: 'Admins only' });
  }

  // ── 2. Validate input ──
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { broadcast_id: broadcastId, title, message, link = null, link_label: linkLabel = null, target = 'all' } = body;

  if (!broadcastId) return res.status(400).json({ error: 'broadcast_id is required' });
  if (!title?.trim() || !message?.trim()) return res.status(400).json({ error: 'title and message are required' });
  if (!['all', 'user', 'agent'].includes(target)) return res.status(400).json({ error: 'Invalid target' });

  // ── 3. Claim this broadcast exactly once (idempotency) ──
  const claim = await sb('broadcast_email_sends', {
    method: 'POST',
    body: [{ broadcast_id: broadcastId, sent_by: authUser.id, target }],
    headers: { Prefer: 'return=representation' },
  });
  if (!claim.ok) {
    // 23505 = unique_violation → this broadcast was already emailed.
    if (claim.status === 409 || String(claim.raw).includes('23505')) {
      return res.status(200).json({ ok: true, already_sent: true, sent: 0, failed: 0 });
    }
    return res.status(500).json({ error: 'Could not record the email send', detail: claim.raw });
  }

  // ── 4. Collect recipients ──
  const roleFilter = target === 'all' ? '' : `&role=eq.${target}`;
  const recipients = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const page = await sb(`users?select=email,full_name&email=not.is.null${roleFilter}&order=created_at.asc`, {
      headers: { Range: `${from}-${from + PAGE - 1}` },
    });
    if (!page.ok) return res.status(500).json({ error: 'Could not load recipients', detail: page.raw });
    const rows = Array.isArray(page.body) ? page.body : [];
    recipients.push(...rows);
    if (rows.length < PAGE) break;
  }

  // De-duplicate addresses so nobody gets the same broadcast twice.
  const seen = new Set();
  const unique = recipients.filter((r) => {
    const email = (r.email || '').trim().toLowerCase();
    if (!email || !email.includes('@') || seen.has(email)) return false;
    seen.add(email);
    return true;
  });

  // ── 5. Send in batches ──
  let sent = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const chunk = unique.slice(i, i + BATCH_SIZE);
    const payload = chunk.map((r) => ({
      from: FROM,
      to: [r.email],
      reply_to: REPLY_TO,
      subject: title.trim(),
      html: broadcastEmailHtml({
        firstName: (r.full_name || '').trim().split(/\s+/)[0],
        title: title.trim(),
        body: message.trim(),
        link,
        linkLabel,
      }),
    }));

    try {
      const send = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const text = await send.text();
      if (send.ok) {
        sent += chunk.length;
      } else {
        failed += chunk.length;
        errors.push(`batch ${i / BATCH_SIZE + 1}: ${send.status} ${text}`);
        console.error(`[broadcast-email] provider ${send.status}: ${text}`);
      }
    } catch (err) {
      failed += chunk.length;
      errors.push(`batch ${i / BATCH_SIZE + 1}: ${err.message}`);
    }

    if (i + BATCH_SIZE < unique.length) await sleep(BATCH_PAUSE_MS);
  }

  await sb(`broadcast_email_sends?broadcast_id=eq.${broadcastId}`, {
    method: 'PATCH',
    body: { recipients: unique.length, sent, failed, finished_at: new Date().toISOString() },
  });

  return res.status(200).json({ ok: failed === 0, recipients: unique.length, sent, failed, errors: errors.slice(0, 5) });
}
