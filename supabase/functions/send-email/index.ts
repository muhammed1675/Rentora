import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { senderFor, replyToFor } from "../_shared/email-config.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin:0; padding:0; background:#f4f6f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
    .wrapper { max-width:560px; margin:32px auto; background:#fff; border-radius:14px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
    .header { background:#ffffff; padding:26px 32px; text-align:center; }
    .header img { height:40px; width:auto; }
    .accent-bar { height:3px; background:#2E86D8; }
    .body { padding:32px; }
    .body h2 { color:#153E75; font-size:21px; font-weight:500; margin:0 0 12px; }
    .body p { color:#5b6b7d; font-size:14px; line-height:1.6; margin:0 0 16px; }
    .eyebrow { display:block; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; color:#2E86D8; font-weight:600; margin:0 0 10px; }
    .card { background:#fff; border:1px solid #e3e8ee; border-radius:10px; overflow:hidden; margin:16px 0; }
    .card-row { display:flex; justify-content:space-between; align-items:center; padding:12px 16px; font-size:13px; border-bottom:1px solid #e3e8ee; }
    .card-row:nth-child(odd) { background:#f7f9fb; }
    .card-row:last-child { border-bottom:none; }
    .label { color:#5b6b7d; display:inline-flex; align-items:center; gap:6px; }
    .label svg { flex-shrink:0; }
    .value { color:#153E75; font-weight:500; }
    .badge { display:inline-flex; align-items:center; gap:6px; background:#e3f5e9; color:#1f7a43; border-radius:999px; padding:4px 14px; font-size:13px; font-weight:600; margin-bottom:20px; }
    .badge-blue { background:#eaf2fb; color:#153E75; }
    .badge-red { background:#fdeaea; color:#b3261e; }
    .btn { display:block; width:100%; box-sizing:border-box; text-align:center; background:#2E86D8; color:#fff !important; text-decoration:none; padding:13px 28px; border-radius:8px; font-weight:600; font-size:15px; margin:8px 0; }
    .footer { background:#f7f9fb; border-top:1px solid #e3e8ee; padding:24px 32px; text-align:center; }
    .footer p { color:#8a97a6; font-size:12px; margin:0 0 8px; line-height:1.6; }
    .footer a { color:#2E86D8; text-decoration:none; }
    .footer .legal { font-size:11px; color:#aab3bd; }
    .footer .legal a { color:#aab3bd; text-decoration:underline; }
    .footer .copyright { font-size:11px; color:#c4ccd6; margin-top:12px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><img src="https://www.rentora.com.ng/rentora-logo.png" alt="" /></div>
    <div class="accent-bar"></div>
    <div class="body">${content}</div>
    <div class="footer">
      <p>Rentora — Student Housing, Ogbomosho, Oyo State</p>
      <p><a href="https://www.rentora.com.ng">rentora.com.ng</a> &nbsp;·&nbsp; <a href="mailto:support@rentora.com.ng">support@rentora.com.ng</a></p>
      <p class="legal"><a href="https://www.rentora.com.ng/terms">Privacy and terms</a> &nbsp;·&nbsp; <a href="mailto:support@rentora.com.ng">Contact support</a></p>
      <p class="copyright">© 2026 Rentora. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

// Small inline SVG icons (14px, single-color, Lucide-style) used in place of
// emoji throughout these templates — renders consistently and reads as more
// professional than colorful emoji across email clients.
function svgIcon(paths: string): string {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px">${paths}</svg>`;
}

const icon = {
  home: svgIcon(`<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`),
  money: svgIcon(`<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>`),
  calendar: svgIcon(`<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`),
  user: svgIcon(`<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`),
  mail: svgIcon(`<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>`),
  phone: svgIcon(`<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.574 2.81.7A2 2 0 0 1 22 16.92z"/>`),
  tag: svgIcon(`<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r="1.5"/>`),
  target: svgIcon(`<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>`),
  lock: svgIcon(`<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`),
  check: svgIcon(`<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`),
  sparkles: svgIcon(`<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>`),
  pin: svgIcon(`<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>`),
  search: svgIcon(`<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>`),
  coin: svgIcon(`<circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/>`),
  unlock: svgIcon(`<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>`),
  document: svgIcon(`<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>`),
  clipboard: svgIcon(`<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6"/><path d="M9 16h6"/>`),
  clock: svgIcon(`<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`),
  globe: svgIcon(`<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>`),
  monitor: svgIcon(`<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>`),
};

function emailWelcome(name: string) {
  return baseTemplate(`
    <span class="badge badge-blue">${icon.sparkles} Welcome to Rentora</span>
    <h2>Hello, ${name}!</h2>
    <p>Your account has been created. You can now browse verified student accommodation near LAUTECH, Ogbomosho.</p>
    <div class="card">
      <div class="card-row"><span class="label">${icon.search} Browse</span><span class="value">Find verified properties</span></div>
      <div class="card-row"><span class="label">${icon.coin} Tokens</span><span class="value">Buy tokens to unlock contacts</span></div>
      <div class="card-row"><span class="label">${icon.calendar} Inspect</span><span class="value">Book physical viewings</span></div>
    </div>
    <a href="https://www.rentora.com.ng/browse" class="btn">Browse Properties</a>
  `);
}

function emailTokenReceipt(name: string, tokens: number, amount: number, newBalance: number, reference: string) {
  return baseTemplate(`
    <span class="badge">Payment Successful ${icon.check}</span>
    <h2>Token Purchase Receipt</h2>
    <p>Hi ${name}, your token purchase was successful. Your wallet has been credited.</p>
    <div class="card">
      <div class="card-row"><span class="label">Tokens Purchased</span><span class="value">${tokens} token${tokens > 1 ? 's' : ''}</span></div>
      <div class="card-row"><span class="label">Amount Paid</span><span class="value">₦${amount.toLocaleString()}</span></div>
      <div class="card-row"><span class="label">New Balance</span><span class="value">${newBalance} token${newBalance !== 1 ? 's' : ''}</span></div>
      <div class="card-row"><span class="label">Reference</span><span class="value" style="font-size:12px">${reference}</span></div>
    </div>
    <a href="https://www.rentora.com.ng/browse" class="btn">Browse Properties</a>
  `);
}

function emailInspectionBooked(name: string, propertyTitle: string, inspectionDate: string, reference: string, amount: number) {
  return baseTemplate(`
    <span class="badge">Viewing Confirmed ${icon.check}</span>
    <h2>Viewing Booking Confirmed</h2>
    <p>Hi ${name}, your viewing has been booked and payment received. An agent will be in touch before the viewing date.</p>
    <div class="card">
      <div class="card-row"><span class="label">Property</span><span class="value">${propertyTitle}</span></div>
      <div class="card-row"><span class="label">Date</span><span class="value">${inspectionDate}</span></div>
      <div class="card-row"><span class="label">Fee Paid</span><span class="value">₦${amount.toLocaleString()}</span></div>
      <div class="card-row"><span class="label">Reference</span><span class="value" style="font-size:12px">${reference}</span></div>
    </div>
    <a href="https://www.rentora.com.ng/profile" class="btn">View My Viewing Requests</a>
  `);
}

function emailVerificationApproved(name: string) {
  return baseTemplate(`
    <span class="badge">Agent Approved ${icon.check}</span>
    <h2>Congratulations, ${name}!</h2>
    <p>Your agent verification has been approved. You are now a verified Rentora agent and can start listing properties.</p>
    <div class="card">
      <div class="card-row"><span class="label">Status</span><span class="value">${icon.check} Verified Agent</span></div>
      <div class="card-row"><span class="label">Can List Properties</span><span class="value">Yes</span></div>
      <div class="card-row"><span class="label">Can Conduct Viewing Requests</span><span class="value">Yes</span></div>
    </div>
    <a href="https://www.rentora.com.ng/agent" class="btn">Go to Agent Dashboard</a>
  `);
}

function emailVerificationRejected(name: string) {
  return baseTemplate(`
    <span class="badge badge-red">Verification Unsuccessful</span>
    <h2>Hi ${name},</h2>
    <p>Unfortunately, we were unable to approve your agent verification application at this time.</p>
    <div class="card">
      <div class="card-row"><span class="label">${icon.document} Documents</span><span class="value">Unclear or incomplete ID/selfie</span></div>
      <div class="card-row"><span class="label">${icon.clipboard} Information</span><span class="value">Details could not be verified</span></div>
    </div>
    <p>You are welcome to reapply with clearer documents.</p>
    <a href="https://www.rentora.com.ng/become-agent" class="btn" style="background:#5b6b7d">Reapply</a>
    <a href="mailto:support@rentora.com.ng" class="btn">Contact Support</a>
  `);
}

function emailStudentVerificationApproved(name: string) {
  return baseTemplate(`
    <span class="badge">Verified Student ${icon.check}</span>
    <h2>Welcome aboard, ${name}!</h2>
    <p>Your school document and selfie have been reviewed and approved. You're now a Verified LAUTECH Student on Rentora.</p>
    <div class="card">
      <div class="card-row"><span class="label">Status</span><span class="value">${icon.check} Verified Student</span></div>
      <div class="card-row"><span class="label">Can Book Viewing Requests</span><span class="value">Yes</span></div>
    </div>
    <a href="https://www.rentora.com.ng/browse" class="btn">Browse Properties</a>
  `);
}

function emailStudentVerificationRejected(name: string, reason: string) {
  return baseTemplate(`
    <span class="badge badge-red">Verification Unsuccessful</span>
    <h2>Hi ${name},</h2>
    <p>We were unable to approve your student verification at this time.</p>
    <div class="card">
      <div class="card-row"><span class="label">${icon.document} Reason</span><span class="value">${reason || 'Documents unclear or incomplete'}</span></div>
    </div>
    <p>You can resubmit your school document and selfie at any time.</p>
    <a href="https://www.rentora.com.ng/verify-account" class="btn">Resubmit Documents</a>
    <a href="mailto:support@rentora.com.ng" class="btn" style="background:#5b6b7d">Contact Support</a>
  `);
}

function emailSignIn(name: string, ip: string, location: string, time: string, device: string) {
  return baseTemplate(`
    <span class="badge badge-blue">New Sign-In Detected</span>
    <h2>Hi ${name}, you just signed in</h2>
    <p>We noticed a new sign-in to your Rentora account. If this was you, no action needed.</p>
    <div class="card">
      <div class="card-row"><span class="label">${icon.clock} Time</span><span class="value">${time}</span></div>
      <div class="card-row"><span class="label">${icon.pin} Location</span><span class="value">${location}</span></div>
      <div class="card-row"><span class="label">${icon.globe} IP Address</span><span class="value">${ip}</span></div>
      <div class="card-row"><span class="label">${icon.monitor} Device</span><span class="value">${device}</span></div>
    </div>
    <p>If this wasn't you, secure your account immediately.</p>
    <a href="mailto:support@rentora.com.ng?subject=Unauthorised Sign-In" class="btn" style="background:#dc2626">Report Unauthorised Access</a>
  `);
}

function emailInspectionAgentNotify(agentName: string, userName: string, userEmail: string, userPhone: string, propertyTitle: string, inspectionDate: string, reference: string) {
  return baseTemplate(`
    <span class="badge badge-blue">New Viewing Booking ${icon.calendar}</span>
    <h2>Hi ${agentName}, you have a new viewing!</h2>
    <p>A user has booked and paid for an viewing on one of your properties. Please reach out to them before the viewing date.</p>
    <div class="card">
      <div class="card-row"><span class="label">${icon.home} Property</span><span class="value">${propertyTitle}</span></div>
      <div class="card-row"><span class="label">${icon.calendar} Date</span><span class="value">${inspectionDate}</span></div>
      <div class="card-row"><span class="label">${icon.user} Student Name</span><span class="value">${userName}</span></div>
      <div class="card-row"><span class="label">${icon.mail} Student Email</span><span class="value" style="color:#2E86D8">${userEmail}</span></div>
      ${userPhone ? `<div class="card-row"><span class="label">${icon.phone} Student Phone</span><span class="value">${userPhone}</span></div>` : ""}
      <div class="card-row"><span class="label">${icon.tag} Reference</span><span class="value" style="font-size:12px">${reference}</span></div>
    </div>
    <p>Please contact the student to confirm arrangements for the viewing.</p>
    ${userPhone
      ? `<a href="tel:${userPhone}" class="btn">Call student</a>`
      : `<a href="mailto:${userEmail}" class="btn">Email student</a>`}
  `);
}

// Rentora holds the FULL amount (rent + agent fee + caution fee) and
// releases ALL of it to the agent on confirmed move-in (or auto-release).
// Rentora's only cut is the separate service fee, added on top at checkout —
// property owners are never paid through the platform. See Agent Agreement §4.
function emailRentPaymentHeld(agentName: string, propertyTitle: string, totalPaid: number, rentAmount: number, agentFee: number, cautionFee: number, reference: string, studentName: string, studentEmail: string, studentPhone: string) {
  const payout = Number(rentAmount) + Number(agentFee) + Number(cautionFee || 0);
  return baseTemplate(`
    <span class="badge badge-blue">Rent Paid — Held by Rentora ${icon.lock}</span>
    <h2>Hi ${agentName}, a student has paid rent!</h2>
    <p>A student has paid rent for <strong>${propertyTitle}</strong>. Please note: <strong>this money is not yet released to you.</strong> Rentora holds it safely until the student confirms they've moved in, or for a maximum of 5 days, whichever comes first.</p>
    <div class="card">
      <div class="card-row"><span class="label">${icon.home} Property</span><span class="value">${propertyTitle}</span></div>
      <div class="card-row"><span class="label">${icon.money} Total Paid by Student</span><span class="value">₦${Number(totalPaid).toLocaleString()}</span></div>
      <div class="card-row"><span class="label">${icon.target} You'll Receive (once released)</span><span class="value">₦${payout.toLocaleString()}</span></div>
      <div class="card-row"><span class="label">${icon.tag} Reference</span><span class="value" style="font-size:12px">${reference}</span></div>
    </div>
    <div class="card">
      <div class="card-row"><span class="label">${icon.user} Student Name</span><span class="value">${studentName}</span></div>
      ${studentEmail ? `<div class="card-row"><span class="label">${icon.mail} Student Email</span><span class="value" style="color:#2E86D8">${studentEmail}</span></div>` : ""}
      ${studentPhone ? `<div class="card-row"><span class="label">${icon.phone} Student Phone</span><span class="value">${studentPhone}</span></div>` : ""}
    </div>
    <p>The full rent, your agent fee, and the caution fee are released together to your Rentora balance once confirmed — Rentora's only cut is a separate service fee, which is not part of your payout. You'll get another email once it's released.</p>
    <a href="https://www.rentora.com.ng/agent?tab=rent-payments" class="btn">View on Agent Dashboard</a>
  `);
}

function emailRentPaymentReceipt(studentName: string, propertyTitle: string, amount: number, reference: string) {
  return baseTemplate(`
    <span class="badge">Rent Payment Received ${icon.check}</span>
    <h2>Hi ${studentName}, your rent payment is confirmed!</h2>
    <p>We've received your payment for <strong>${propertyTitle}</strong>. Your money is held safely by Rentora — it has NOT been released to the agent or landlord yet.</p>
    <div class="card">
      <div class="card-row"><span class="label">${icon.home} Property</span><span class="value">${propertyTitle}</span></div>
      <div class="card-row"><span class="label">${icon.money} Amount Paid</span><span class="value">₦${Number(amount).toLocaleString()}</span></div>
      <div class="card-row"><span class="label">${icon.tag} Reference</span><span class="value" style="font-size:12px">${reference}</span></div>
    </div>
    <p>Once you've moved in, confirm it from your Rentora profile (with a photo) to release the funds. If you don't confirm within 5 days, it releases automatically.</p>
    <a href="https://www.rentora.com.ng/profile" class="btn">View My Payments</a>
  `);
}

// The agent receives the FULL amount on release — rent + agent fee +
// caution fee, all together. Rentora's cut (the service fee) was already
// deducted at checkout and never appears in the agent's payout.
function emailRentPaymentReleasedAgent(agentName: string, propertyTitle: string, rentAmount: number, agentFee: number, cautionFee: number, reference: string) {
  const totalCredited = Number(rentAmount) + Number(agentFee) + Number(cautionFee || 0);
  return baseTemplate(`
    <span class="badge">Funds Released ${icon.sparkles}</span>
    <h2>Hi ${agentName}, your funds have been released!</h2>
    <p>The tenant has confirmed move-in for <strong>${propertyTitle}</strong>. The full rent, your agent fee, and the caution fee are now credited to your Rentora balance.</p>
    <div class="card">
      <div class="card-row"><span class="label">${icon.home} Property</span><span class="value">${propertyTitle}</span></div>
      <div class="card-row"><span class="label">${icon.money} Rent</span><span class="value">₦${Number(rentAmount).toLocaleString()}</span></div>
      <div class="card-row"><span class="label">${icon.target} Agent Fee</span><span class="value">₦${Number(agentFee).toLocaleString()}</span></div>
      ${cautionFee ? `<div class="card-row"><span class="label">${icon.lock} Caution Fee</span><span class="value">₦${Number(cautionFee).toLocaleString()}</span></div>` : ""}
      <div class="card-row"><span class="label">Total Credited</span><span class="value">₦${totalCredited.toLocaleString()}</span></div>
      <div class="card-row"><span class="label">${icon.tag} Reference</span><span class="value" style="font-size:12px">${reference}</span></div>
    </div>
    <p>You can request a withdrawal to your bank account any time from your Agent Dashboard (minimum ₦3,000 per request).</p>
    <a href="https://www.rentora.com.ng/agent?tab=rent-payments" class="btn">View on Agent Dashboard</a>
  `);
}

function emailRentPaymentReleasedStudent(studentName: string, propertyTitle: string, reference: string) {
  return baseTemplate(`
    <span class="badge">Move-In Confirmed ${icon.check}</span>
    <h2>Hi ${studentName}, welcome to your new home!</h2>
    <p>You've confirmed move-in for <strong>${propertyTitle}</strong>. The funds you paid have now been released to your agent.</p>
    <div class="card">
      <div class="card-row"><span class="label">${icon.home} Property</span><span class="value">${propertyTitle}</span></div>
      <div class="card-row"><span class="label">${icon.tag} Reference</span><span class="value" style="font-size:12px">${reference}</span></div>
    </div>
    <p>If anything about the property wasn't as expected, contact support@rentora.com.ng.</p>
  `);
}

function emailPropertyApproved(agentName: string, propertyTitle: string) {
  return baseTemplate(`
    <span class="badge">Listing Approved ${icon.check}</span>
    <h2>Hi ${agentName}, your listing is live!</h2>
    <p><strong>${propertyTitle}</strong> has been reviewed and approved. It's now visible to students browsing Rentora.</p>
    <div class="card">
      <div class="card-row"><span class="label">${icon.home} Property</span><span class="value">${propertyTitle}</span></div>
    </div>
    <p>You'll be notified as soon as a student books an viewing or pays rent on this listing.</p>
    <a href="https://www.rentora.com.ng/agent?tab=rent-payments" class="btn">View on Agent Dashboard</a>
  `);
}

function emailAdminPaymentAlert(d: any) {
  const ok = d.outcome === "success";
  const dup = d.outcome === "duplicate";
  const badge = ok ? "badge" : dup ? "badge badge-blue" : "badge badge-red";
  const badgeText = ok ? "Payment successful" : dup ? "Already processed" : "Payment failed";
  const amount = Number.isFinite(Number(d.amount)) ? `NGN ${Number(d.amount).toLocaleString("en-NG")}` : "—";
  const rows = (d.breakdown || [])
    .map((r: any[]) => `<div class="card-row"><span class="label">${r[0]}</span><span class="value">${r[1]}</span></div>`)
    .join("");
  return baseTemplate(`
    <span class="eyebrow">Admin notification</span>
    <div class="${badge}">${badgeText}</div>
    <h2>${d.title || "Payment update"}</h2>
    <p><strong>What happened:</strong> ${d.reason || "—"}</p>
    <p><strong>Why this payment was made:</strong> ${d.purpose || "—"}</p>
    <div class="card">
      <div class="card-row"><span class="label">Type</span><span class="value">${d.payment_type || "—"}</span></div>
      <div class="card-row"><span class="label">Amount</span><span class="value">${amount}</span></div>
      <div class="card-row"><span class="label">Reference</span><span class="value">${d.reference || "—"}</span></div>
      ${rows}
      <div class="card-row"><span class="label">Payer</span><span class="value">${d.payer_name || "—"}</span></div>
      <div class="card-row"><span class="label">Payer email</span><span class="value">${d.payer_email || "—"}</span></div>
      <div class="card-row"><span class="label">Payer phone</span><span class="value">${d.payer_phone || "—"}</span></div>
      <div class="card-row"><span class="label">Time</span><span class="value">${d.occurred_at || "—"}</span></div>
      <div class="card-row"><span class="label">Server status</span><span class="value">${d.status_code ?? "—"}</span></div>
    </div>
    <a href="https://www.rentora.com.ng/admin" class="btn">Open Admin Dashboard</a>
  `);
}

// Generic admin alert for any site event that isn't a payment (new listing
// submitted, new agent verification request, new withdrawal request, a
// property report, a contact form message, a student reporting move-in,
// etc). One shared template instead of one per event type — callers pass
// whatever rows are relevant via `breakdown`.
function emailAdminActivityAlert(d: any) {
  const rows = (d.breakdown || [])
    .map((r: any[]) => `<div class="card-row"><span class="label">${r[0]}</span><span class="value">${r[1]}</span></div>`)
    .join("");
  return baseTemplate(`
    <span class="eyebrow">Admin notification</span>
    <div class="badge badge-blue">${d.event_label || "New activity"}</div>
    <h2>${d.title || "Something happened on Rentora"}</h2>
    ${d.summary ? `<p>${d.summary}</p>` : ""}
    ${rows ? `<div class="card">${rows}</div>` : ""}
    <a href="${d.action_url || "https://www.rentora.com.ng/admin"}" class="btn">Open Admin Dashboard</a>
  `);
}

async function sendEmail(to: string, subject: string, html: string, emailType: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: senderFor(emailType),
      to: [to],
      reply_to: replyToFor(emailType),
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { type, to, data } = await req.json();

    console.log(`Email request: type=${type}, to=${to}`);

    let subject = "";
    let html = "";

    switch (type) {
      case "welcome":
        subject = "Welcome to Rentora";
        html = emailWelcome(data.name);
        break;
      case "token_receipt":
        subject = `Receipt: ${data.tokens} Token${data.tokens > 1 ? 's' : ''} Added to Your Wallet`;
        html = emailTokenReceipt(data.name, data.tokens, data.amount, data.new_balance, data.reference);
        break;
      case "inspection_booked":
        subject = "Inspection Booking Confirmed — Rentora";
        html = emailInspectionBooked(data.name, data.property_title, data.inspection_date, data.reference, data.amount);
        break;
      case "inspection_agent_notify":
        subject = `New Viewing Booking: ${data.property_title}`;
        html = emailInspectionAgentNotify(data.agent_name, data.user_name, data.user_email, data.user_phone, data.property_title, data.inspection_date, data.reference);
        break;
      case "rent_payment_held":
        subject = `Rent Paid for ${data.property_title} — Held by Rentora`;
        html = emailRentPaymentHeld(data.agent_name, data.property_title, data.amount, data.rent_amount, data.agent_fee, data.caution_fee, data.reference, data.student_name, data.student_email, data.student_phone);
        break;
      case "rent_payment_receipt":
        subject = `Rent Payment Received — ${data.property_title}`;
        html = emailRentPaymentReceipt(data.student_name, data.property_title, data.amount, data.reference);
        break;
      case "rent_payment_released":
        subject = `Funds Released — ${data.property_title}`;
        html = emailRentPaymentReleasedAgent(data.agent_name, data.property_title, data.rent_amount, data.agent_fee, data.caution_fee, data.reference);
        break;
      case "rent_payment_released_student":
        subject = `Move-In Confirmed — ${data.property_title}`;
        html = emailRentPaymentReleasedStudent(data.student_name, data.property_title, data.reference);
        break;
      case "property_approved":
        subject = `Your listing "${data.property_title}" is now live on Rentora`;
        html = emailPropertyApproved(data.agent_name, data.property_title);
        break;
      case "verification_approved":
        subject = "Your Rentora Agent Verification is Approved!";
        html = emailVerificationApproved(data.name);
        break;
      case "verification_rejected":
        subject = "Rentora Agent Verification Update";
        html = emailVerificationRejected(data.name);
        break;
      case "student_verification_approved":
        subject = "You're Verified! Welcome to Rentora";
        html = emailStudentVerificationApproved(data.name);
        break;
      case "student_verification_rejected":
        subject = "Rentora Student Verification Update";
        html = emailStudentVerificationRejected(data.name, data.reason);
        break;
      case "sign_in":
        subject = "New Sign-In to Your Rentora Account";
        html = emailSignIn(data.name, data.ip, data.location, data.time, data.device);
        break;
      case "admin_payment_alert": {
        const label = data.outcome === "success" ? "Payment received" : data.outcome === "duplicate" ? "Duplicate payment callback" : "Payment FAILED";
        subject = `[Rentora Admin] ${label}: ${data.payment_type || "payment"} — ${data.reference}`;
        html = emailAdminPaymentAlert(data);
        break;
      }
      case "admin_activity_alert": {
        subject = `[Rentora Admin] ${data.title || "New activity"}`;
        html = emailAdminActivityAlert(data);
        break;
      }
      default:
        throw new Error(`Unknown email type: ${type}`);
    }

    await sendEmail(to, subject, html, type);
    console.log(`Email sent successfully to ${to} (type=${type}, from=${senderFor(type)})`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Edge function error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});