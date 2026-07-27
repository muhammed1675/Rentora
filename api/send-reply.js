// frontend/api/send-reply.js — Vercel Edge Function
// Sends admin replies to contact messages via Resend

export const config = { runtime: 'edge' };

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'Rentora Support <support@rentora.com.ng>';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const { to, toName, subject, message, originalMessage } = await req.json();

    if (!to || !subject || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <!-- Header -->
        <tr><td style="background:#1d4ed8;padding:28px 32px;text-align:center">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700">Rentora Support</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:14px">Response to your message</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px">
          <p style="margin:0 0 16px;font-size:15px;color:#374151">Hi <strong>${toName || 'there'}</strong>,</p>
          <div style="background:#f9fafb;border-left:4px solid #1d4ed8;border-radius:4px;padding:16px 20px;margin-bottom:24px">
            <p style="margin:0;font-size:15px;color:#111827;line-height:1.7;white-space:pre-wrap">${message}</p>
          </div>
          ${originalMessage ? `
          <div style="border-top:1px solid #e5e7eb;padding-top:20px;margin-top:8px">
            <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Your original message</p>
            <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;white-space:pre-wrap">${originalMessage}</p>
          </div>` : ''}
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;text-align:center">
          <p style="margin:0;font-size:12px;color:#9ca3af">Rentora · Student Housing Platform, Ogbomosho</p>
          <p style="margin:4px 0 0;font-size:12px;color:#9ca3af">
            <a href="https://www.rentora.com.ng" style="color:#1d4ed8;text-decoration:none">www.rentora.com.ng</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject: `Re: ${subject}`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return new Response(JSON.stringify({ error: err }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
