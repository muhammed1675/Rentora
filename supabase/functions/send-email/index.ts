// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { senderFor, replyToFor } from "../_shared/email-config.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

// Email types that only ever concern the caller's own account. For these,
// we additionally require `to` to match the verified caller's own email —
// nobody should be able to make this function send a "welcome" or
// "sign-in" email about themselves to someone else's inbox.
const SELF_ONLY_TYPES = new Set(["welcome", "sign_in"]);

// Every dynamic value below (name, property_title, reference, etc.) is
// interpolated directly into HTML template strings. This function is
// called both from trusted server code (Vercel functions, using the
// service-role key) and from the browser (using the caller's own session
// token — see the auth check in the request handler below), so `data`
// fields still can't be fully trusted even once the caller is verified.
// Escaping happens once, centrally, on the whole `data` object before it
// reaches any template function below — see escapeDeep() and its use in
// the request handler.
function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeDeep(value: any): any {
  if (typeof value === "string") return escapeHtml(value);
  if (Array.isArray(value)) return value.map(escapeDeep);
  if (value && typeof value === "object") {
    const out: Record<string, any> = {};
    for (const k of Object.keys(value)) out[k] = escapeDeep(value[k]);
    return out;
  }
  return value;
}

// Subject lines are plain text, not HTML — they must NOT go through
// escapeHtml/escapeDeep, or an apostrophe in e.g. a property title
// ("Don't Pay2") renders literally as "Don&#39;t Pay2" in the inbox.
// Use the raw (unescaped) field here instead. We still strip CR/LF so a
// crafted title can't inject extra email headers.
function sanitizeForHeader(value: unknown): string {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim();
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Maps a `tone` name to the accent/icon-badge colors used across the
// header icon, headline highlight, and the reassurance/alert box. Kept to
// four tones so every template reads consistently instead of one-off hex
// values scattered through each `emailX()` function.
const TONES: Record<string, { accent: string; badgeBg: string; badgeFg: string; boxBg: string; boxBorder: string }> = {
  green: { accent: "#1f7a43", badgeBg: "#e3f5e9", badgeFg: "#1f7a43", boxBg: "#eef8f1", boxBorder: "#cdecd7" },
  blue: { accent: "#153E75", badgeBg: "#eaf2fb", badgeFg: "#2E86D8", boxBg: "#eef5fc", boxBorder: "#d3e6f8" },
  red: { accent: "#b3261e", badgeBg: "#fdeaea", badgeFg: "#c0362d", boxBg: "#fdf1f1", boxBorder: "#f6d4d2" },
  amber: { accent: "#92620a", badgeBg: "#fdf1de", badgeFg: "#b3760f", boxBg: "#fdf6ea", boxBorder: "#f5e3bd" },
};

function baseTemplate(opts: {
  eyebrow?: string;
  headline: string;
  subhead?: string;
  intro?: string;
  lead?: string;
  sectionHeading?: string;
  rowsHtml?: string;
  sectionHeading2?: string;
  rowsHtml2?: string;
  paragraphs?: string[];
  cta?: { heading?: string; buttons: { text: string; href: string; color?: string }[] };
  // New, optional — used to opt individual templates into the richer
  // "confirmation" look (icon badge under the logo + tone-matched
  // highlighted word in the headline). Templates that don't pass these
  // still render correctly with sensible blue defaults.
  icon?: string;
  tone?: "green" | "blue" | "red" | "amber";
  // A prominent highlighted callout box in the body (e.g. "Don't recognize
  // this activity?"), styled with the same tone as `icon`/`tone`.
  alertBox?: { title: string; text: string; buttonText?: string; href?: string };
}): string {
  const {
    eyebrow, headline, subhead, intro, lead, sectionHeading, rowsHtml, sectionHeading2, rowsHtml2, paragraphs, cta,
    icon, tone = "blue", alertBox,
  } = opts;

  const t = TONES[tone] || TONES.blue;

  const iconBadgeHtml = icon
    ? `<div class="icon-badge" style="background:${t.badgeBg}"><span style="font-size:30px;line-height:1">${ic(icon, 30)}</span></div>`
    : "";

  const introHtml = intro
    ? `<div class="intro"><p>${intro}</p></div>`
    : "";

  const leadHtml = lead ? `<p class="lead">${lead}</p>` : "";
  const sectionHeadingHtml = sectionHeading ? `<h2>${sectionHeading}</h2>` : "";
  const sectionHeading2Html = sectionHeading2 ? `<h2>${sectionHeading2}</h2>` : "";
  const paragraphsHtml = (paragraphs || []).map((p) => `<p>${p}</p>`).join("");

  const alertBoxHtml = alertBox
    ? `<div class="alert-box" style="background:${t.boxBg};border:1px solid ${t.boxBorder}">
        <span class="alert-icon" style="background:${t.badgeBg};color:${t.badgeFg}">${ic("shield", 18)}</span>
        <div class="alert-copy">
          <p class="alert-title">${alertBox.title}</p>
          <p class="alert-text">${alertBox.text}</p>
          ${alertBox.buttonText ? `<a href="${alertBox.href || "#"}" class="btn" style="background:${t.badgeFg}">${alertBox.buttonText}</a>` : ""}
        </div>
      </div>`
    : "";

  const ctaHtml = cta
    ? `<div class="cta-section">
        ${cta.heading ? `<p class="cta-lead">${cta.heading}</p>` : ""}
        ${cta.buttons.map((b) => `<a href="${b.href}" class="btn"${b.color ? ` style="background:${b.color}"` : ""}>${b.text}</a>`).join("")}
      </div>`
    : "";

  // Headline: wrap the last `<em>…</em>` phrase (already used throughout
  // the emailX() functions to mark the key phrase) in the tone accent
  // color instead of italics, matching the two-tone "Sign-in Successful!"
  // style. Falls back to plain text if a template has no <em> at all.
  const headlineHtml = headline.replace(/<em>(.*?)<\/em>/g, `<span class="accent" style="color:${t.accent}">$1</span>`);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin:0; padding:0; background:#eef2f7; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
    .wrapper { max-width:560px; margin:32px auto; background:#fff; border-radius:20px; overflow:hidden; box-shadow:0 2px 16px rgba(21,62,117,0.08); border-top:4px solid #2E86D8; }

    /* ── Header (light, centered) ─────────────────── */
    .header { background:#ffffff; padding:36px 32px 28px; text-align:center; }
    .logo-pill { display:inline-flex; align-items:center; justify-content:center; background:transparent; padding:0; margin-bottom:6px; }
    .logo-pill img { height:26px; width:auto; display:block; }
    .icon-badge { width:72px; height:72px; border-radius:50%; margin:22px auto 20px; display:flex; align-items:center; justify-content:center; }
    .eyebrow { display:block; color:#8a97a6; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; font-weight:700; margin:0 0 10px; }
    .header h1 { color:#16233a; font-size:25px; font-weight:800; line-height:1.32; margin:0 0 12px; letter-spacing:-0.01em; }
    .header h1 .accent { font-weight:800; }
    .header .subhead { color:#5b6b7d; font-size:14px; line-height:1.6; margin:0 auto; max-width:400px; }

    /* ── Intro band (light gray, under header) ──── */
    .intro { background:#f7f9fb; padding:26px 32px; text-align:center; border-top:1px solid #e9edf2; border-bottom:1px solid #e9edf2; }
    .intro p { color:#5b6b7d; font-size:14px; line-height:1.65; margin:0; }

    /* ── Body ─────────────────────────────────────── */
    .body { padding:30px 32px 10px; }
    .body p.lead { color:#324459; font-size:15px; line-height:1.65; margin:0 0 22px; }
    .body p { color:#5b6b7d; font-size:14px; line-height:1.65; margin:0 0 16px; }
    .body h2 { text-align:left; color:#153E75; font-size:15px; font-weight:700; margin:0 0 4px; letter-spacing:-0.01em; }

    /* ── Detail card: bordered box with divided rows ── */
    .rows { border:1px solid #e9edf2; border-radius:14px; padding:4px 18px; margin:14px 0 22px; }
    .row { display:flex; align-items:center; gap:12px; padding:13px 0; border-bottom:1px solid #eef1f5; }
    .rows .row:last-child { border-bottom:none; }
    .row-icon { flex-shrink:0; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:#eaf2fb; color:#2E86D8; font-size:15px; }
    .row-body { flex:1; min-width:0; display:flex; align-items:center; justify-content:space-between; gap:12px; }
    .row-body.single { justify-content:flex-start; }
    .row-label { font-size:13px; color:#5b6b7d; font-weight:500; }
    .row-value { font-size:13.5px; color:#16233a; font-weight:700; text-align:right; word-break:break-word; }
    .row-single { font-size:14px; color:#324459; font-weight:500; }

    /* ── Prominent tone-matched alert box ─────────── */
    .alert-box { display:flex; gap:14px; align-items:flex-start; border-radius:14px; padding:18px; margin:6px 0 22px; }
    .alert-icon { flex-shrink:0; width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; }
    .alert-title { color:#16233a; font-size:14.5px; font-weight:700; margin:0 0 4px; }
    .alert-text { color:#5b6b7d; font-size:13.5px; line-height:1.55; margin:0 0 12px; }
    .alert-copy .btn { margin:0; padding:10px 22px; font-size:13px; }

    /* ── Status badge (small pill, used sparingly) ── */
    .badge { display:inline-flex; align-items:center; gap:6px; background:#e3f5e9; color:#1f7a43; border-radius:999px; padding:5px 14px; font-size:12.5px; font-weight:700; margin-bottom:16px; }
    .badge-blue { background:#eaf2fb; color:#153E75; }
    .badge-red { background:#fdeaea; color:#b3261e; }

    /* ── CTA band (light gray, bottom) ───────────── */
    .cta-section { background:#f7f9fb; padding:28px 32px 30px; text-align:center; border-top:1px solid #e9edf2; margin-top:6px; }
    .cta-lead { color:#153E75; font-size:15px; font-weight:700; margin:0 0 16px; }
    .btn { display:inline-block; background:#2E86D8; color:#fff !important; text-decoration:none; padding:13px 34px; border-radius:9px; font-weight:700; font-size:14px; margin:0 4px 10px; }

    /* ── Divider with house mark ───────────────────── */
    .divider { display:flex; align-items:center; gap:12px; padding:24px 32px 0; }
    .divider hr { flex:1; border:none; border-top:1px solid #e9edf2; margin:0; }
    .divider span { color:#9aa7b5; font-size:16px; }
    .thankyou { text-align:center; color:#16233a; font-size:13.5px; font-weight:700; padding:14px 32px 26px; margin:0; }
    .thankyou span { display:block; color:#8a97a6; font-weight:500; font-size:12.5px; margin-top:4px; }

    /* ── Footer (light, three columns) ─────────────── */
    .footer { background:#f7f9fb; padding:30px 32px; border-top:1px solid #e9edf2; }
    .footer-col h3 { color:#16233a; font-size:13px; font-weight:700; margin:0 0 6px; }
    .footer-col p { color:#8a97a6; font-size:12px; line-height:1.6; margin:0 0 6px; }
    .footer-col a { color:#2E86D8; font-size:12.5px; font-weight:700; text-decoration:none; }
    .footer table { width:100%; border-collapse:collapse; }
    .footer td { vertical-align:top; padding:0 10px; }
    .footer td:first-child { padding-left:0; }
    .footer td:last-child { padding-right:0; }
    .app-link { display:inline-block; background:#16233a; color:#fff !important; text-decoration:none; padding:8px 14px; border-radius:8px; font-size:11.5px; font-weight:700; }

    /* ── Sub-footer (legal) ─────────────────────────── */
    .subfooter { text-align:center; padding:18px 32px 26px; background:#f7f9fb; }
    .subfooter p { color:#9aa7b5; font-size:11px; margin:0 0 6px; line-height:1.6; }
    .subfooter a { color:#7c8ba0; text-decoration:underline; }

    /* ── Social row ──────────────────────────────────── */
    .social-row { text-align:center; padding:0 32px 18px; background:#f7f9fb; }
    .social-row a { color:#8a97a6; font-size:12px; font-weight:600; text-decoration:none; margin:0 8px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <span class="logo-pill"><img src="https://www.rentora.com.ng/rentora-logo.png" alt="Rentora" /></span>
      ${iconBadgeHtml}
      ${eyebrow ? `<span class="eyebrow">${eyebrow}</span>` : ""}
      <h1>${headlineHtml}</h1>
      ${subhead ? `<p class="subhead">${subhead}</p>` : ""}
    </div>
    ${introHtml}
    <div class="body">
      ${leadHtml}
      ${sectionHeadingHtml}
      ${rowsHtml ? `<div class="rows">${rowsHtml}</div>` : ""}
      ${sectionHeading2Html}
      ${rowsHtml2 ? `<div class="rows">${rowsHtml2}</div>` : ""}
      ${alertBoxHtml}
      ${paragraphsHtml}
    </div>
    ${ctaHtml}
    <div class="divider"><hr /><span>${ic("home", 16)}</span><hr /></div>
    <p class="thankyou">Thank you for choosing Rentora.<span>We're here to help you find a place you'll love to call home.</span></p>
    <div class="footer">
      <table role="presentation">
        <tr>
          <td class="footer-col" style="width:38%">
            <span class="logo-pill"><img src="https://www.rentora.com.ng/rentora-logo.png" alt="Rentora" style="height:20px" /></span>
            <p style="margin-top:10px">Find a place you'll love to call home.</p>
          </td>
          <td class="footer-col" style="width:31%">
            <h3>Need Help?</h3>
            <p>Our support team is ready to help.</p>
            <a href="mailto:support@rentora.com.ng">Contact Support →</a>
            <p style="margin-top:10px">+234 913 113 3832 (WhatsApp)<br />+234 908 561 8894</p>
          </td>
          <td class="footer-col" style="width:31%">
            <h3>Get the Rentora App</h3>
            <p>Search for homes, book, and manage on the go.</p>
            <a class="app-link" href="https://www.rentora.com.ng/rentora.apk" download>Download for Android</a>
          </td>
        </tr>
      </table>
    </div>
    <div class="social-row">
      <a href="https://wa.me/2349131133832">WhatsApp</a>&bull;
      <a href="https://www.instagram.com/rentora.com.ng">Instagram</a>&bull;
      <a href="https://www.tiktok.com/@rentora.com.ng">TikTok</a>
    </div>
    <div class="subfooter">
      <p>This is an automated email. Please do not reply to this message.</p>
      <p><a href="https://www.rentora.com.ng/terms">Privacy and terms</a> &nbsp;·&nbsp; <a href="mailto:support@rentora.com.ng">support@rentora.com.ng</a></p>
      <p>© 2026 Rentora. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

// Inline SVG icons (Lucide-style, single-color via currentColor) used in
// place of emoji throughout these templates. `ic(name, size)` renders one
// at a given pixel size — small (14px) for inline text, larger (18-20px)
// for the icon-badge circles in `.row-icon`.
const iconPaths: Record<string, string> = {
  home: `<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`,
  money: `<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>`,
  calendar: `<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`,
  user: `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
  mail: `<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>`,
  phone: `<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.574 2.81.7A2 2 0 0 1 22 16.92z"/>`,
  tag: `<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r="1.5"/>`,
  target: `<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>`,
  lock: `<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`,
  check: `<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>`,
  sparkles: `<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>`,
  pin: `<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>`,
  search: `<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>`,
  coin: `<circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/>`,
  unlock: `<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>`,
  document: `<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>`,
  clipboard: `<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6"/><path d="M9 16h6"/>`,
  clock: `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
  globe: `<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>`,
  monitor: `<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>`,
  alert: `<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>`,
  shield: `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>`,
  trash: `<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>`,
};

// Unicode emoji instead of inline SVG — Gmail (and several other clients)
// strip or flag inline <svg>, which is why this used to fall back to a
// plain bullet. Emoji render natively everywhere without that risk, and
// let the icon-badge / row-icon circles show something meaningful again
// (a lock, a clock, a pin, etc.) instead of a dot.
const EMOJI: Record<string, string> = {
  home: "🏠", money: "💰", calendar: "📅", user: "👤", mail: "✉️", phone: "📞",
  tag: "🏷️", target: "🎯", lock: "🔒", check: "✅", sparkles: "✨", pin: "📍",
  search: "🔍", coin: "🪙", unlock: "🔓", document: "📄", clipboard: "📋",
  clock: "🕒", globe: "🌐", monitor: "💻", alert: "⚠️", shield: "🛡️", trash: "🗑️",
};

function ic(name: string, size = 14): string {
  return `<span aria-hidden="true" style="display:inline-block;font-size:${size}px;line-height:1;font-style:normal">${EMOJI[name] || "•"}</span>`;
}

// One row inside a `.rows` detail card. Pass `value` for a label/value data
// row (icon + label on the left, bold value right-aligned, e.g. "Date  →
// 31 May 2025") — this is the "Sign-in Details" / "Booking Summary" card
// style. Omit `value` for a single-line feature row (e.g. "Browse verified
// properties near campus"), used in welcome/invite-style feature lists.
// `opts.color` tints the small icon circle for that one row (e.g. green
// for a "Status: Verified" row, red for a rejection reason).
function row(iconName: string, label: string, value?: string, opts: { color?: string; valueColor?: string } = {}): string {
  const iconBg = opts.color ? `${opts.color}1a` : "#eaf2fb"; // ~10% tint of the color, or default blue tint
  const iconFg = opts.color || "#2E86D8";
  const body = value !== undefined
    ? `<span class="row-label">${label}</span><span class="row-value"${opts.valueColor ? ` style="color:${opts.valueColor}"` : ""}>${value}</span>`
    : `<span class="row-single">${label}</span>`;
  const rowBodyClass = value !== undefined ? "row-body" : "row-body single";
  return `<div class="row"><span class="row-icon" style="background:${iconBg};color:${iconFg}">${ic(iconName, 14)}</span><div class="${rowBodyClass}">${body}</div></div>`;
}

function emailWelcome(name: string) {
  return baseTemplate({
    headline: `You're One Step Closer to Your <em>Next Home</em>`,
    subhead: "Your account is active — you now have full access to verified student housing near LAUTECH.",
    intro: `Welcome to Rentora, ${name}! We're excited to have you as part of a growing community of students finding safe, stress-free accommodation.`,
    sectionHeading: "Here's What You Can Do:",
    rowsHtml: [
      row("search", "Browse verified properties near campus"),
      row("coin", "Buy tokens to unlock agent contact details"),
      row("calendar", "Book physical viewings before you commit"),
    ].join(""),
    paragraphs: ["Whether you're moving off-campus for the first time or switching lodges, you're in the right place."],
    cta: { heading: "Click below to start exploring listings:", buttons: [{ text: "Browse Properties", href: "https://www.rentora.com.ng/browse" }] },
  });
}

function emailInspectionBooked(name: string, propertyTitle: string, inspectionDate: string, reference: string, amount: number) {
  return baseTemplate({
    icon: "check",
    tone: "green",
    headline: `Payment <em>Successful</em>!`,
    subhead: "Your viewing has been booked.",
    lead: `<strong>Hi ${name},</strong> great news! Your payment has been received and your viewing is confirmed. An agent will be in touch before the date.`,
    sectionHeading: "Booking Summary",
    rowsHtml: [
      row("home", "Property", propertyTitle),
      row("calendar", "Date", inspectionDate),
      row("money", "Fee Paid", `₦${amount.toLocaleString()}`),
      row("tag", "Reference", reference),
    ].join(""),
    sectionHeading2: "Important Next Steps",
    rowsHtml2: [
      row("mail", "You'll receive a reminder before the viewing date", undefined),
      row("clipboard", "Keep this email for your records", undefined),
      row("phone", "Contact the agent directly for any questions", undefined),
    ].join(""),
    cta: { buttons: [{ text: "View My Viewing Requests", href: "https://www.rentora.com.ng/profile" }] },
  });
}

function emailAgentInvite(link: string, expiresAt: string, invitedBy: string) {
  return baseTemplate({
    eyebrow: "Agent invitation",
    headline: `You're Invited to List on <em>Rentora</em>`,
    subhead: `${invitedBy} has invited you to apply as a verified Rentora agent.`,
    lead: "Rentora agent applications are invite-only. Use the link below to start your application — it's a single-use link tied to your email.",
    rowsHtml: [
      row("clock", "Link Expires", expiresAt),
    ].join(""),
    paragraphs: ["Once approved, you'll be able to list properties and reach students looking for verified housing near LAUTECH directly on Rentora."],
    cta: { heading: "Click below to start your application:", buttons: [{ text: "Apply as an Agent", href: link }] },
  });
}

function emailVerificationApproved(name: string) {
  return baseTemplate({
    eyebrow: "Agent verification",
    headline: `You're a Verified <em>Rentora Agent</em>`,
    subhead: `Congratulations, ${name}! Your application has been approved.`,
    rowsHtml: [
      row("check", "Status", "Verified Agent", { color: "#1f7a43" }),
      row("home", "Can List Properties", "Yes"),
      row("calendar", "Can Conduct Viewings", "Yes"),
    ].join(""),
    paragraphs: ["You can now start listing properties and reaching students directly on Rentora."],
    cta: { buttons: [{ text: "Go to Agent Dashboard", href: "https://www.rentora.com.ng/agent" }] },
  });
}

function emailVerificationRejected(name: string) {
  return baseTemplate({
    eyebrow: "Agent verification",
    headline: "We Couldn't Approve This One",
    subhead: `Hi ${name}, your agent verification wasn't successful this time.`,
    rowsHtml: [
      row("document", "Documents", "Unclear or incomplete ID/selfie"),
      row("clipboard", "Information", "Details could not be verified", { color: "#b3261e" }),
    ].join(""),
    paragraphs: ["You're welcome to reapply with clearer documents whenever you're ready."],
    cta: { buttons: [
      { text: "Reapply", href: "https://www.rentora.com.ng/become-agent", color: "#5b6b7d" },
      { text: "Contact Support", href: "mailto:support@rentora.com.ng" },
    ] },
  });
}

function emailStudentVerificationApproved(name: string) {
  return baseTemplate({
    eyebrow: "Student verification",
    headline: `Welcome Aboard, <em>${name}</em>!`,
    subhead: "Your school document and selfie have been reviewed and approved.",
    rowsHtml: [
      row("check", "Status", "Verified Student", { color: "#1f7a43" }),
      row("calendar", "Can Book Viewings", "Yes"),
    ].join(""),
    paragraphs: ["You're now a Verified LAUTECH Student on Rentora — go find your next home."],
    cta: { buttons: [{ text: "Browse Properties", href: "https://www.rentora.com.ng/browse" }] },
  });
}

function emailStudentVerificationRejected(name: string, reason: string) {
  return baseTemplate({
    eyebrow: "Student verification",
    headline: "We Couldn't Approve This One",
    subhead: `Hi ${name}, your student verification wasn't successful this time.`,
    rowsHtml: [
      row("document", "Reason", reason || "Documents unclear or incomplete", { color: "#b3261e" }),
    ].join(""),
    paragraphs: ["You can resubmit your school document and selfie at any time."],
    cta: { buttons: [
      { text: "Resubmit Documents", href: "https://www.rentora.com.ng/verify-account" },
      { text: "Contact Support", href: "mailto:support@rentora.com.ng", color: "#5b6b7d" },
    ] },
  });
}

function emailSignIn(name: string, ip: string, location: string, time: string, device: string) {
  return baseTemplate({
    icon: "shield",
    tone: "green",
    headline: `Sign-in <em>Successful</em>!`,
    subhead: "You've successfully signed in to your Rentora account.",
    lead: `<strong>Hi ${name},</strong> welcome back! We're glad to have you.`,
    sectionHeading: "Sign-in Details",
    rowsHtml: [
      row("clock", "Time", time),
      row("pin", "Location", location),
      row("globe", "IP Address", ip),
      row("monitor", "Device", device),
    ].join(""),
    alertBox: {
      title: "Don't recognize this activity?",
      text: "If you didn't sign in, someone may have accessed your account. Please secure your account immediately.",
      buttonText: "Secure My Account",
      href: "mailto:support@rentora.com.ng?subject=Unauthorised Sign-In",
    },
  });
}

function emailInspectionAgentNotify(agentName: string, userName: string, userEmail: string, userPhone: string, propertyTitle: string, inspectionDate: string, reference: string, viewingFee: number, rentPrice: number, agentFee: number, cautionFee: number) {
  const money = (n: number) => `₦${Number(n || 0).toLocaleString()}`;
  return baseTemplate({
    eyebrow: "New booking",
    headline: `You Have a New <em>Viewing</em>!`,
    subhead: `Hi ${agentName}, a student has booked and paid for a viewing on one of your properties.`,
    rowsHtml: [
      row("home", "Property", propertyTitle),
      row("calendar", "Date", inspectionDate),
      row("user", "Student Name", userName),
      row("mail", "Student Email", userEmail, { valueColor: "#2E86D8" }),
      userPhone ? row("phone", "Student Phone", userPhone) : "",
      row("tag", "Reference", reference),
    ].join(""),
    sectionHeading2: "Payment & Fee Breakdown",
    rowsHtml2: [
      row("money", "Viewing Fee Paid", money(viewingFee), { color: "#1f7a43", valueColor: "#1f7a43" }),
      row("home", "Rent Amount", money(rentPrice)),
      row("coin", "Agent Fee", money(agentFee)),
      cautionFee ? row("lock", "Caution Fee", money(cautionFee)) : "",
    ].join(""),
    paragraphs: ["Please contact the student to confirm arrangements for the viewing."],
    cta: { buttons: [userPhone
      ? { text: "Call Student", href: `tel:${userPhone}` }
      : { text: "Email Student", href: `mailto:${userEmail}` }] },
  });
}

// Rentora holds the FULL amount (rent + agent fee + caution fee) and
// releases ALL of it to the agent on confirmed move-in (or auto-release).
// Rentora's only cut is the separate service fee, added on top at checkout —
// property owners are never paid through the platform. See Agent Agreement §4.
function emailRentPaymentHeld(agentName: string, propertyTitle: string, totalPaid: number, rentAmount: number, agentFee: number, agreementFee: number, cautionFee: number, inspectionFee: number, documentationFee: number, otherFeesTotal: number, reference: string, studentName: string, studentEmail: string, studentPhone: string) {
  const payout = Number(rentAmount) + Number(agentFee) + Number(agreementFee || 0) + Number(cautionFee || 0) + Number(inspectionFee || 0) + Number(documentationFee || 0) + Number(otherFeesTotal || 0);
  return baseTemplate({
    eyebrow: "Rent paid — held by Rentora",
    headline: `A Student Has Paid Rent for <em>${propertyTitle}</em>`,
    subhead: `Hi ${agentName}, this money is not yet released to you — Rentora holds it safely until move-in is confirmed, or for a maximum of 5 days.`,
    rowsHtml: [
      row("home", "Property", propertyTitle),
      row("money", "Total Paid by Student", `₦${Number(totalPaid).toLocaleString()}`),
      row("tag", "Reference", reference),
      row("user", "Student Name", studentName),
      studentEmail ? row("mail", "Student Email", studentEmail, { valueColor: "#2E86D8" }) : "",
      studentPhone ? row("phone", "Student Phone", studentPhone) : "",
    ].join(""),
    sectionHeading2: "Your Payout Breakdown (once released)",
    rowsHtml2: [
      row("home", "Rent Amount", `₦${Number(rentAmount).toLocaleString()}`),
      row("coin", "Agent Fee", `₦${Number(agentFee).toLocaleString()}`),
      cautionFee > 0 ? row("lock", "Caution Fee", `₦${Number(cautionFee).toLocaleString()}`) : "",
      agreementFee > 0 ? row("tag", "Agreement Fee", `₦${Number(agreementFee).toLocaleString()}`) : "",
      inspectionFee > 0 ? row("home", "Inspection Fee", `₦${Number(inspectionFee).toLocaleString()}`) : "",
      documentationFee > 0 ? row("tag", "Documentation Fee", `₦${Number(documentationFee).toLocaleString()}`) : "",
      otherFeesTotal > 0 ? row("tag", "Other Fees", `₦${Number(otherFeesTotal).toLocaleString()}`) : "",
      row("target", "You'll Receive", `₦${payout.toLocaleString()}`, { color: "#1f7a43", valueColor: "#1f7a43" }),
    ].join(""),
    paragraphs: ["The full rent and all disclosed property-related charges are released together to your Rentora balance once confirmed — Rentora's only cut is a separate service fee, which is not part of your payout. You'll get another email once it's released."],
    cta: { buttons: [{ text: "View on Agent Dashboard", href: "https://www.rentora.com.ng/agent?tab=rent-payments" }] },
  });
}

function emailRentPaymentReceipt(studentName: string, propertyTitle: string, amount: number, reference: string) {
  return baseTemplate({
    eyebrow: "Payment received",
    headline: `Your Rent Payment Is <em>Confirmed</em>`,
    subhead: `Hi ${studentName}, we've received your payment. Your money is held safely by Rentora — it has NOT been released to the agent yet.`,
    rowsHtml: [
      row("home", "Property", propertyTitle),
      row("money", "Amount Paid", `₦${Number(amount).toLocaleString()}`),
      row("tag", "Reference", reference),
    ].join(""),
    paragraphs: ["Once you've moved in, confirm it from your Rentora profile (with a photo) to release the funds. If you don't confirm within 5 days, it releases automatically."],
    cta: { buttons: [{ text: "View My Payments", href: "https://www.rentora.com.ng/profile" }] },
  });
}

// The agent receives the FULL amount on release — rent + agent fee +
// caution fee, all together. Rentora's cut (the service fee) was already
// deducted at checkout and never appears in the agent's payout.
function emailRentPaymentReleasedAgent(agentName: string, propertyTitle: string, rentAmount: number, agentFee: number, agreementFee: number, cautionFee: number, inspectionFee: number, documentationFee: number, otherFeesTotal: number, reference: string) {
  const totalCredited = Number(rentAmount) + Number(agentFee) + Number(agreementFee || 0) + Number(cautionFee || 0) + Number(inspectionFee || 0) + Number(documentationFee || 0) + Number(otherFeesTotal || 0);
  return baseTemplate({
    eyebrow: "Funds released",
    headline: `Your Funds Have Been <em>Released</em>`,
    subhead: `Hi ${agentName}, the tenant has confirmed move-in for ${propertyTitle}.`,
    rowsHtml: [
      row("home", "Property", propertyTitle),
      row("money", "Rent", `₦${Number(rentAmount).toLocaleString()}`),
      row("target", "Agent Fee", `₦${Number(agentFee).toLocaleString()}`),
      cautionFee ? row("lock", "Caution Fee", `₦${Number(cautionFee).toLocaleString()}`) : "",
      agreementFee > 0 ? row("tag", "Agreement Fee", `₦${Number(agreementFee).toLocaleString()}`) : "",
      inspectionFee > 0 ? row("home", "Inspection Fee", `₦${Number(inspectionFee).toLocaleString()}`) : "",
      documentationFee > 0 ? row("tag", "Documentation Fee", `₦${Number(documentationFee).toLocaleString()}`) : "",
      otherFeesTotal > 0 ? row("tag", "Other Fees", `₦${Number(otherFeesTotal).toLocaleString()}`) : "",
      row("check", "Total Credited", `₦${totalCredited.toLocaleString()}`, { color: "#1f7a43" }),
      row("tag", "Reference", reference),
    ].join(""),
    paragraphs: ["The full rent, your agent fee, and the caution fee are now credited to your Rentora balance. You can request a withdrawal to your bank account any time from your Agent Dashboard (minimum ₦3,000 per request)."],
    cta: { buttons: [{ text: "View on Agent Dashboard", href: "https://www.rentora.com.ng/agent?tab=rent-payments" }] },
  });
}

function emailRentPaymentReleasedStudent(studentName: string, propertyTitle: string, reference: string) {
  return baseTemplate({
    eyebrow: "Move-in confirmed",
    headline: `Welcome to Your <em>New Home</em>!`,
    subhead: `Hi ${studentName}, you've confirmed move-in for ${propertyTitle}. The funds you paid have now been released to your agent.`,
    rowsHtml: [
      row("home", "Property", propertyTitle),
      row("tag", "Reference", reference),
    ].join(""),
    paragraphs: ["If anything about the property wasn't as expected, contact support@rentora.com.ng."],
  });
}

// Deliberately calm, non-alarming copy — this is the one place the word
// "refund" appears to the student at all, and even here it's framed as
// resolution rather than failure. See emailRentPaymentReceipt above for the
// matching "held safely" language used at payment time.
function emailRentPaymentResolvedStudent(studentName: string, propertyTitle: string, amount: number, reference: string) {
  return baseTemplate({
    eyebrow: "Update on your payment",
    headline: "We've Resolved This One for You",
    subhead: `Hi ${studentName}, after looking into ${propertyTitle}, we found it's no longer a good match to proceed with.`,
    lead: "Since your payment was still held by Rentora and never released, your full payment is being returned to your original payment method.",
    rowsHtml: [
      row("home", "Property", propertyTitle),
      row("money", "Amount", `₦${Number(amount).toLocaleString()}`),
      row("tag", "Reference", reference),
    ].join(""),
    paragraphs: ["This can take a few business days to reflect, depending on your bank. Feel free to keep browsing other verified listings on Rentora — if you have any questions, reach out to support@rentora.com.ng."],
    cta: { buttons: [{ text: "Browse Listings", href: "https://www.rentora.com.ng/browse" }] },
  });
}

// Agent-facing: no mention of "refund" — just that the listing was removed.
// Keeps the student's dispute details private and avoids adjacent
// "refund" language reaching agents/browsers of the platform at large.
function emailRentPaymentResolvedAgent(agentName: string, propertyTitle: string, reason: string) {
  const reasonText = reason === 'unavailable'
    ? 'it was reported as no longer available'
    : reason === 'misrepresented'
    ? 'the details didn\u2019t match what was listed'
    : 'an issue was found with it';
  return baseTemplate({
    eyebrow: "Listing removed",
    headline: "A Listing Has Been Taken Down",
    subhead: `Hi ${agentName}, ${propertyTitle} has been removed from Rentora because ${reasonText}. The booking associated with it has been cancelled.`,
    rowsHtml: row("home", "Property", propertyTitle),
    paragraphs: ["If you believe this was a mistake, contact support@rentora.com.ng and we'll review it with you."],
  });
}

function emailPropertyApproved(agentName: string, propertyTitle: string) {
  return baseTemplate({
    eyebrow: "Listing approved",
    headline: `Your Listing Is <em>Live</em>!`,
    subhead: `Hi ${agentName}, ${propertyTitle} has been reviewed and approved. It's now visible to students browsing Rentora.`,
    rowsHtml: row("home", "Property", propertyTitle),
    paragraphs: ["You'll be notified as soon as a student books a viewing or pays rent on this listing."],
    cta: { buttons: [{ text: "View on Agent Dashboard", href: "https://www.rentora.com.ng/agent?tab=rent-payments" }] },
  });
}

// Agent-facing: a submitted or edited listing was reviewed and turned down.
// Kept separate from emailPropertyApproved so the subject line and tone are
// clearly different — this is not a "listing removed after being live"
// notice (see emailRentPaymentResolvedAgent), it's a review outcome.
function emailPropertyRejected(agentName: string, propertyTitle: string) {
  return baseTemplate({
    eyebrow: "Listing not approved",
    headline: "Your Listing Needs Changes",
    subhead: `Hi ${agentName}, ${propertyTitle} was reviewed but not approved to go live yet.`,
    rowsHtml: row("home", "Property", propertyTitle),
    paragraphs: [
      "This usually means a detail needs fixing — photos, pricing, description, or contact info.",
      "You can edit the listing and resubmit it for another review from your Agent Dashboard. If you're not sure what to change, contact support@rentora.com.ng and we'll help.",
    ],
    cta: { buttons: [{ text: "Edit Listing", href: "https://www.rentora.com.ng/agent" }] },
  });
}

function emailAdminPaymentAlert(d: any) {
  const ok = d.outcome === "success";
  const dup = d.outcome === "duplicate";
  const badgeColor = ok ? "#1f7a43" : dup ? "#2E86D8" : "#b3261e";
  const badgeText = ok ? "Payment successful" : dup ? "Already processed" : "Payment failed";
  const amount = Number.isFinite(Number(d.amount)) ? `NGN ${Number(d.amount).toLocaleString("en-NG")}` : "—";
  const breakdownRows = (d.breakdown || []).map((r: any[]) => row("tag", r[0], r[1])).join("");
  return baseTemplate({
    eyebrow: "Admin notification",
    headline: d.title || "Payment update",
    subhead: badgeText,
    rowsHtml: [
      row("clipboard", "Type", d.payment_type || "—"),
      row("money", "Amount", amount, { color: badgeColor }),
      row("tag", "Reference", d.reference || "—"),
      breakdownRows,
      row("user", "Payer", d.payer_name || "—"),
      row("mail", "Payer Email", d.payer_email || "—", { valueColor: "#2E86D8" }),
      d.payer_phone ? row("phone", "Payer Phone", d.payer_phone) : "",
      row("clock", "Time", d.occurred_at || "—"),
      row("monitor", "Server Status", String(d.status_code ?? "—")),
    ].join(""),
    paragraphs: [
      `<strong>What happened:</strong> ${d.reason || "—"}`,
      `<strong>Why this payment was made:</strong> ${d.purpose || "—"}`,
    ],
    cta: { buttons: [{ text: "Open Admin Dashboard", href: "https://www.rentora.com.ng/admin" }] },
  });
}

// Generic admin alert for any site event that isn't a payment (new listing
// submitted, new agent verification request, new withdrawal request, a
// property report, a contact form message, a student reporting move-in,
// etc). One shared template instead of one per event type — callers pass
// whatever rows are relevant via `breakdown`.
function emailAdminActivityAlert(d: any) {
  const breakdownRows = (d.breakdown || []).map((r: any[]) => row("tag", r[0], r[1])).join("");
  return baseTemplate({
    eyebrow: "Admin notification",
    headline: d.event_label || "New Activity",
    subhead: d.title || "Something happened on Rentora",
    rowsHtml: breakdownRows,
    paragraphs: d.summary ? [d.summary] : [],
    cta: { buttons: [{ text: "Open Admin Dashboard", href: d.action_url || "https://www.rentora.com.ng/admin" }] },
  });
}

// Admin notification specifically for an existing property that an agent/user
// has edited. The caller can pass a list of changed fields in `breakdown`.
// This is intentionally kept separate from property_approved so an edit that
// sends the listing back to pending review has its own clear email trail.
function emailPropertyUpdatedAdmin(d: any) {
  const breakdownRows = (d.breakdown || []).map((r: any[]) => row("tag", r[0], r[1])).join("");
  return baseTemplate({
    eyebrow: "Property update",
    headline: "A Property Listing Was Updated",
    subhead: d.property_title ? `\"${d.property_title}\" was updated and needs admin review.` : "A property listing was updated and may need admin review.",
    rowsHtml: [
      row("home", "Property", d.property_title || "—"),
      row("user", "Updated By", d.agent_name || d.user_name || "—"),
      d.agent_email ? row("mail", "Agent Email", d.agent_email, { valueColor: "#2E86D8" }) : "",
      d.status ? row("check", "New Status", d.status) : "",
      d.property_id ? row("tag", "Property ID", d.property_id) : "",
      breakdownRows,
    ].join(""),
    paragraphs: [d.summary || "Please review the updated listing in the Admin Dashboard before approving it again."],
    cta: { buttons: [{ text: "Review Property", href: d.action_url || "https://www.rentora.com.ng/admin" }] },
  });
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

  // ── Auth check ─────────────────────────────────────────
  // Previously this function accepted the public anon key from ANY
  // caller (the frontend was even sending the anon key itself, not a
  // real user token) — meaning anyone on the internet could trigger any
  // of the templated emails below to any recipient, using Rentora's own
  // Resend account and sending domain. Two tiers of trusted caller now:
  //
  //   1. Service-role key (frontend/api/confirm-payment.js and
  //      admin-refund-payment.js — private, server-side only, never
  //      shipped to the browser) — fully trusted.
  //   2. A real user access token (every browser call site now sends
  //      the logged-in user's session token instead of the anon key —
  //      see lib/auth.js's sendTransactionalEmail / lib/api.js's
  //      sendTransactionalEmail). Verified against Supabase auth below;
  //      for "welcome"/"sign_in" specifically, `to` must also match
  //      that verified user's own email.
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  // Tier 1a — dedicated internal secret. This is the reliable path for
  // server-to-server calls: it does NOT depend on the service-role key
  // being byte-identical in two different platforms (Vercel + Supabase).
  // Rotating the service-role key, migrating to the new sb_secret_* key
  // format, or a stray newline pasted into a Vercel env var used to make
  // the equality check below fail, and the request then fell through to
  // auth.getUser() — which rejected the key with the misleading
  // "Invalid or expired session" 401 seen in the payment webhook logs.
  const INTERNAL_SECRET = (Deno.env.get("INTERNAL_EMAIL_SECRET") || "").trim();
  const internalHeader = (req.headers.get("x-internal-secret") || "").trim();
  const serviceKey = (SERVICE_ROLE_KEY || "").trim();

  const isTrustedServer =
    (INTERNAL_SECRET.length > 0 && internalHeader === INTERNAL_SECRET) ||
    (serviceKey.length > 0 && token === serviceKey);

  if (!isTrustedServer && !token) {
    return new Response(JSON.stringify({ error: "Missing authorization token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let callerEmail: string | null = null;
  if (!isTrustedServer) {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData?.user) {
      // Safe fingerprints only (never the key material itself) so an
      // env-drift mismatch is diagnosable straight from the function logs.
      console.error(
        `[send-email] auth rejected — tokenLen=${token.length} tokenPrefix=${token.slice(0, 6)} ` +
        `serviceKeyLen=${serviceKey.length} serviceKeyPrefix=${serviceKey.slice(0, 6)} ` +
        `internalSecretConfigured=${INTERNAL_SECRET.length > 0} internalHeaderSent=${internalHeader.length > 0}`,
      );
      return new Response(JSON.stringify({ error: "Invalid or expired session. Please log in again." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    callerEmail = authData.user.email || null;
  }
  // Trusted server caller: callerEmail stays null and the SELF_ONLY_TYPES
  // check below is skipped for it.


  try {
    const { type, to, data: rawData } = await req.json();
    const data = escapeDeep(rawData || {});

    if (callerEmail && SELF_ONLY_TYPES.has(type) && String(to).toLowerCase() !== callerEmail.toLowerCase()) {
      return new Response(JSON.stringify({ error: "You can only send this email type to your own account." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Email request: type=${type}, to=${to}`);

    let subject = "";
    let html = "";

    switch (type) {
      case "welcome":
        subject = "Welcome to Rentora";
        html = emailWelcome(data.name);
        break;
      case "inspection_booked":
        subject = "Inspection Booking Confirmed — Rentora";
        html = emailInspectionBooked(data.name, data.property_title, data.inspection_date, data.reference, data.amount);
        break;
      case "inspection_agent_notify":
        subject = `New Viewing Booking: ${sanitizeForHeader(rawData.property_title)}`;
        html = emailInspectionAgentNotify(data.agent_name, data.user_name, data.user_email, data.user_phone, data.property_title, data.inspection_date, data.reference, data.viewing_fee, data.rent_price, data.agent_fee, data.caution_fee);
        break;
      case "rent_payment_held":
        subject = `Rent Paid for ${sanitizeForHeader(rawData.property_title)} — Held by Rentora`;
        html = emailRentPaymentHeld(data.agent_name, data.property_title, data.amount, data.rent_amount, data.agent_fee, data.agreement_fee, data.caution_fee, data.inspection_fee, data.documentation_fee, data.other_fees_total, data.reference, data.student_name, data.student_email, data.student_phone);
        break;
      case "rent_payment_receipt":
        subject = `Rent Payment Received — ${sanitizeForHeader(rawData.property_title)}`;
        html = emailRentPaymentReceipt(data.student_name, data.property_title, data.amount, data.reference);
        break;
      case "rent_payment_released":
        subject = `Funds Released — ${sanitizeForHeader(rawData.property_title)}`;
        html = emailRentPaymentReleasedAgent(data.agent_name, data.property_title, data.rent_amount, data.agent_fee, data.agreement_fee, data.caution_fee, data.inspection_fee, data.documentation_fee, data.other_fees_total, data.reference);
        break;
      case "rent_payment_released_student":
        subject = `Move-In Confirmed — ${sanitizeForHeader(rawData.property_title)}`;
        html = emailRentPaymentReleasedStudent(data.student_name, data.property_title, data.reference);
        break;
      case "rent_payment_resolved_student":
        subject = `Update on your payment — ${sanitizeForHeader(rawData.property_title)}`;
        html = emailRentPaymentResolvedStudent(data.student_name, data.property_title, data.amount, data.reference);
        break;
      case "rent_payment_resolved_agent":
        subject = `Listing removed — ${sanitizeForHeader(rawData.property_title)}`;
        html = emailRentPaymentResolvedAgent(data.agent_name, data.property_title, data.reason);
        break;
      case "property_approved":
        subject = `Your listing "${sanitizeForHeader(rawData.property_title)}" is now live on Rentora`;
        html = emailPropertyApproved(data.agent_name, data.property_title);
        break;
      case "property_rejected":
        subject = `Update on your listing "${sanitizeForHeader(rawData.property_title)}"`;
        html = emailPropertyRejected(data.agent_name, data.property_title);
        break;
      case "agent_invite":
        subject = "You're Invited to Become a Rentora Agent";
        html = emailAgentInvite(data.link, data.expires_at, data.invited_by);
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
        subject = `[Rentora Admin] ${label}: ${sanitizeForHeader(rawData.payment_type) || "payment"} — ${sanitizeForHeader(rawData.reference)}`;
        html = emailAdminPaymentAlert(data);
        break;
      }
      case "admin_activity_alert": {
        subject = `[Rentora Admin] ${sanitizeForHeader(rawData.title) || "New activity"}`;
        html = emailAdminActivityAlert(data);
        break;
      }
      case "property_updated_admin": {
        subject = `[Rentora Admin] Property updated — ${sanitizeForHeader(rawData.property_title) || "listing"}`;
        html = emailPropertyUpdatedAdmin(data);
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