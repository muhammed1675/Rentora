# Double-submit fix + Email broadcasts — setup notes

## 1. Double-submit bug (agent property saved twice)

**Cause:** every submit handler relied on `disabled={someState}`. React state
updates are asynchronous, so a fast second click landed *before* the re-render
and fired the handler again → two INSERTs in Supabase → the listing showed up
twice on the admin dashboard.

**Fix (three layers, no setup needed — it is all code):**

1. `frontend/src/components/ui/button.jsx` — every `<Button>` in the app now
   locks itself while an `async` click handler is still running. Extra clicks
   are swallowed and the button renders disabled/`aria-busy`. Synchronous
   handlers (tabs, carousels, nav, copy-to-clipboard, lightbox arrows) are
   untouched, so rapid clicking still works where it should. Because every
   page uses this one component, all pages are covered — agent dashboard,
   admin dashboard, property details, profile, payouts, verification, etc.
2. `frontend/src/hooks/useSubmitGuard.js` — a reusable synchronous (ref-based)
   guard, applied to the 7 real `<form onSubmit>` handlers (Login, Register ×2,
   Contact, BecomeAgent, VerifyAccount) so pressing **Enter** twice can't
   double-submit either.
3. Explicit guards on the two highest-risk actions:
   - `AgentDashboard.handleSubmitProperty` — ref guard + "Submitting…" state.
   - `AdminDashboard.handleSendBroadcast` — ref guard + "Sending…" state.

Nothing to configure. Just deploy.

## 2. Email broadcasts (admin → every user's inbox)

New files:
- `frontend/api/broadcast-email.js` — Vercel serverless endpoint.
- `supabase/schema/18_broadcast_emails.sql` — one-row-per-broadcast send log.
- `sendBroadcastEmail()` in `frontend/src/lib/notifications.js`.
- Admin → **Broadcasts** tab now has an **“Also send as email”** checkbox.

### How it works
1. Admin fills in Title, Message, optional Link, and audience
   (Everyone / Students / Agents), ticks “Also send as email”, hits Send.
2. The in-app broadcast is created as before (bell + `/notifications`), push is
   sent, then `/api/broadcast-email` is called.
3. The endpoint verifies the caller's Supabase session **and** that their role
   is `admin`, claims the broadcast id in `broadcast_email_sends`
   (PRIMARY KEY → a second call returns `already_sent`, so a broadcast can
   never be emailed twice), loads all matching users, de-duplicates addresses,
   and sends via Resend's batch API in chunks of 100 with a short pause
   between batches.
4. You get a toast: `Emailed 412 of 415 users`.

The email itself is a branded Rentora HTML template (accent bar, logo,
title, personalised “Hi {first name}”, your message with paragraphs kept,
optional CTA button from the Link field, footer) — the same shape as the
sample you sent.

### Setup steps

**a) Run the SQL** — Supabase Dashboard → SQL Editor → New query → paste
`supabase/schema/18_broadcast_emails.sql` → Run.

**b) Vercel env vars** (Project → Settings → Environment Variables). Most of
these already exist for the other endpoints:

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | your Resend API key |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key |
| `ALLOWED_ORIGINS` | `https://rentora.com.ng,https://www.rentora.com.ng` |
| `EMAIL_ADDR_NOREPLY` | `noreply@rentora.com.ng` (optional, this is the default) |
| `EMAIL_ADDR_SUPPORT` | `support@rentora.com.ng` (used as Reply-To) |
| `PUBLIC_SITE_URL` | `https://www.rentora.com.ng` (used for the logo + link) |

**c) Resend** — make sure `rentora.com.ng` is a verified domain in Resend, or
sends will be rejected with a 403.

**d) Redeploy** the frontend on Vercel (env var changes need a redeploy).

**e) Test** — send a broadcast targeted at *Agents only* first (small list),
check the toast counts, then check Resend → Emails for the delivery log.

### Notes / limits
- Serverless timeout is set to 60s (`maxDuration`). At 100 emails per batch
  + 0.6s pause, ~8,000 recipients fit comfortably. Beyond that, split the
  broadcast by audience.
- Recipients come from `public.users.email`, filtered by the audience you pick.
- Deleting a broadcast does not un-send emails (obviously) — the log row is
  removed with it.
