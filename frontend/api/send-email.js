// frontend/api/send-email.js  — Vercel Edge Function
// Sends payment receipt emails via Resend

export const config = { runtime: 'edge' };

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'Rentora <noreply@rentora.ng>';

async function sendEmail(to, subject, html) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  return res.ok;
}

function receiptEmailHtml({ userName, amount, type, tokens, reference, date }) {
  const isToken = type === 'token_purchase';
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <!-- Header -->
        <tr><td style="background:#16a34a;padding:32px;text-align:center">
          <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700">Rentora</h1>
          <p style="margin:8px 0 0;color:#bbf7d0;font-size:14px">Payment Receipt</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px">
          <p style="margin:0 0 8px;font-size:16px;color:#111">Hi <strong>${userName}</strong>,</p>
          <p style="margin:0 0 24px;color:#555;font-size:15px">
            Your payment was successful. Here are your receipt details:
          </p>
          <!-- Receipt card -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:24px">
            <tr><td style="padding:20px">
              <table width="100%" cellpadding="6" cellspacing="0">
                <tr>
                  <td style="color:#555;font-size:14px">Reference</td>
                  <td align="right" style="color:#111;font-size:14px;font-weight:600">${reference}</td>
                </tr>
                <tr>
                  <td style="color:#555;font-size:14px">Date</td>
                  <td align="right" style="color:#111;font-size:14px">${date}</td>
                </tr>
                <tr>
                  <td style="color:#555;font-size:14px">Type</td>
                  <td align="right" style="color:#111;font-size:14px">${isToken ? 'Token Purchase' : 'Inspection Fee'}</td>
                </tr>
                ${isToken ? `<tr>
                  <td style="color:#555;font-size:14px">Tokens Added</td>
                  <td align="right" style="color:#16a34a;font-size:14px;font-weight:700">${tokens} token${tokens > 1 ? 's' : ''}</td>
                </tr>` : ''}
                <tr style="border-top:1px solid #bbf7d0">
                  <td style="color:#111;font-size:16px;font-weight:700;padding-top:12px">Amount Paid</td>
                  <td align="right" style="color:#16a34a;font-size:18px;font-weight:800;padding-top:12px">
                    ₦${Number(amount).toLocaleString('en-NG')}
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
          <p style="margin:0;color:#888;font-size:13px;text-align:center">
            Thank you for using Rentora. If you have any questions, reply to this email.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f9fafb;padding:20px;text-align:center;border-top:1px solid #e5e7eb">
          <p style="margin:0;color:#9ca3af;font-size:12px">© ${new Date().getFullYear()} Rentora · Nigeria's Student Housing Platform</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function inspectionEmailHtml({ toAgent, userName, userEmail, userPhone, agentName, agentEmail, agentPhone, propertyTitle, inspectionDate, reference, date }) {
  if (toAgent) {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr><td style="background:#1d4ed8;padding:32px;text-align:center">
          <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700">Rentora</h1>
          <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px">New Inspection Booking</p>
        </td></tr>
        <tr><td style="padding:32px">
          <p style="margin:0 0 8px;font-size:16px;color:#111">Hi <strong>${agentName}</strong>,</p>
          <p style="margin:0 0 24px;color:#555;font-size:15px">
            A client has booked an inspection for one of your properties. Here are their details:
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;margin-bottom:24px">
            <tr><td style="padding:20px">
              <table width="100%" cellpadding="6" cellspacing="0">
                <tr><td style="color:#555;font-size:14px">Property</td><td align="right" style="color:#111;font-size:14px;font-weight:600">${propertyTitle}</td></tr>
                <tr><td style="color:#555;font-size:14px">Inspection Date</td><td align="right" style="color:#1d4ed8;font-size:14px;font-weight:700">${inspectionDate}</td></tr>
                <tr><td style="color:#555;font-size:14px">Reference</td><td align="right" style="color:#111;font-size:13px">${reference}</td></tr>
                <tr style="border-top:1px solid #bfdbfe">
                  <td colspan="2" style="padding-top:16px;font-weight:700;color:#111;font-size:14px">Client Details</td>
                </tr>
                <tr><td style="color:#555;font-size:14px">Name</td><td align="right" style="color:#111;font-size:14px;font-weight:600">${userName}</td></tr>
                <tr><td style="color:#555;font-size:14px">Email</td><td align="right" style="color:#111;font-size:14px">${userEmail}</td></tr>
                <tr><td style="color:#555;font-size:14px">Phone</td><td align="right" style="color:#111;font-size:14px">${userPhone}</td></tr>
              </table>
            </td></tr>
          </table>
          <p style="margin:0;color:#555;font-size:14px">Please reach out to the client to confirm the inspection time.</p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px;text-align:center;border-top:1px solid #e5e7eb">
          <p style="margin:0;color:#9ca3af;font-size:12px">© ${new Date().getFullYear()} Rentora</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  // Email to client (with agent details)
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr><td style="background:#16a34a;padding:32px;text-align:center">
          <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700">Rentora</h1>
          <p style="margin:8px 0 0;color:#bbf7d0;font-size:14px">Inspection Booking Confirmed</p>
        </td></tr>
        <tr><td style="padding:32px">
          <p style="margin:0 0 8px;font-size:16px;color:#111">Hi <strong>${userName}</strong>,</p>
          <p style="margin:0 0 24px;color:#555;font-size:15px">
            Your inspection has been booked and your payment received. An agent will be in touch shortly.
          </p>
          <!-- Receipt -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:20px">
            <tr><td style="padding:20px">
              <p style="margin:0 0 12px;font-weight:700;color:#111;font-size:14px">Payment Receipt</p>
              <table width="100%" cellpadding="6" cellspacing="0">
                <tr><td style="color:#555;font-size:14px">Property</td><td align="right" style="color:#111;font-size:14px;font-weight:600">${propertyTitle}</td></tr>
                <tr><td style="color:#555;font-size:14px">Inspection Date</td><td align="right" style="color:#16a34a;font-size:14px;font-weight:700">${inspectionDate}</td></tr>
                <tr><td style="color:#555;font-size:14px">Reference</td><td align="right" style="color:#111;font-size:13px">${reference}</td></tr>
                <tr><td style="color:#555;font-size:14px">Date Paid</td><td align="right" style="color:#111;font-size:14px">${date}</td></tr>
                <tr style="border-top:1px solid #bbf7d0">
                  <td style="color:#111;font-size:16px;font-weight:700;padding-top:12px">Amount Paid</td>
                  <td align="right" style="color:#16a34a;font-size:18px;font-weight:800;padding-top:12px">₦3,000</td>
                </tr>
              </table>
            </td></tr>
          </table>
          <!-- Agent details -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;margin-bottom:24px">
            <tr><td style="padding:20px">
              <p style="margin:0 0 12px;font-weight:700;color:#111;font-size:14px">Your Agent</p>
              <table width="100%" cellpadding="6" cellspacing="0">
                <tr><td style="color:#555;font-size:14px">Name</td><td align="right" style="color:#111;font-size:14px;font-weight:600">${agentName}</td></tr>
                <tr><td style="color:#555;font-size:14px">Email</td><td align="right"><a href="mailto:${agentEmail}" style="color:#1d4ed8;font-size:14px">${agentEmail}</a></td></tr>
                ${agentPhone ? `<tr><td style="color:#555;font-size:14px">Phone</td><td align="right"><a href="tel:${agentPhone}" style="color:#1d4ed8;font-size:14px">${agentPhone}</a></td></tr>` : ''}
              </table>
            </td></tr>
          </table>
          <p style="margin:0;color:#888;font-size:13px;text-align:center">
            Keep this email as your receipt. Contact your agent directly for any queries.
          </p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px;text-align:center;border-top:1px solid #e5e7eb">
          <p style="margin:0;color:#9ca3af;font-size:12px">© ${new Date().getFullYear()} Rentora · Nigeria's Student Housing Platform</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  if (!RESEND_API_KEY) return new Response(JSON.stringify({ error: 'Email service not configured' }), { status: 500 });

  try {
    const body = await req.json();
    const { type, ...data } = body;
    const date = new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });

    if (type === 'token_receipt') {
      await sendEmail(
        data.userEmail,
        `Rentora – ${data.tokens} Token${data.tokens > 1 ? 's' : ''} Added to Your Wallet`,
        receiptEmailHtml({ ...data, type: 'token_purchase', date })
      );
    }

    if (type === 'inspection_receipt') {
      // Email to client with receipt + agent details
      await sendEmail(
        data.userEmail,
        `Rentora – Inspection Booking Confirmed for ${data.propertyTitle}`,
        inspectionEmailHtml({ ...data, toAgent: false, date })
      );
      // Email to agent with client details
      if (data.agentEmail) {
        await sendEmail(
          data.agentEmail,
          `Rentora – New Inspection Booked: ${data.propertyTitle}`,
          inspectionEmailHtml({ ...data, toAgent: true, date })
        );
      }
    }

    if (type === 'inspection_agent_notify') {
      // Email to agent notifying about new inspection booking
      await sendEmail(
        data.agentEmail,
        `Rentora – New Inspection Booked: ${data.propertyTitle}`,
        inspectionEmailHtml({ ...data, toAgent: true, date })
      );
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('Email error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
