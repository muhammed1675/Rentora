# Rentora — Setup Guide

Complete instructions to run, deploy, or hand off this project from zero. The app is a student‑housing platform (React + Supabase + Korapay) currently live at https://www.rentora.com.ng.

---

## 1. Repository layout

```
Rentora/
├── frontend/                 # React 19 app (CRACO). This is what Vercel deploys.
│   ├── src/                  # Pages, components, lib (supabase client, auth, api)
│   ├── api/                  # Vercel serverless functions (Korapay, contact form)
│   ├── plugins/              # Dev-only webpack/CRACO tooling (health check, visual
│   │                         #   edits). Not required to understand for normal dev.
│   └── .env.example          # Frontend env vars (REACT_APP_*)
├── backend/                  # Optional Python service (FastAPI). Not required for prod.
├── supabase/
│   ├── schema/                          # See §4 — 18 files, NOT just 6. Run in the
│   │   │                                #   exact order documented there.
│   │   ├── 01_tables.sql                # ─┐
│   │   ├── 02_functions_reference.sql   #  │ Snapshot of the live DB schema
│   │   ├── 03_triggers.sql              #  │ as of when this folder was built
│   │   ├── 04_policies.sql              #  │ (see schema/README.md)
│   │   ├── 05_indexes.sql               #  │
│   │   ├── 06_storage.sql               # ─┘
│   │   ├── 07_notifications_and_rate_limiting.sql  # ─┐
│   │   ├── 07_student_verification.sql             #  │
│   │   ├── 08_verification_gate_and_invites.sql     #  │
│   │   ├── 09_refund_and_delete_fixes.sql            #  │ Runnable migrations,
│   │   ├── 10_free_viewings_status_fix.sql           #  │ applied on top of the
│   │   ├── 11_manual_refund_flow.sql                 #  │ snapshot above, in
│   │   ├── 12_agent_tips.sql                         #  │ order
│   │   ├── 13_admin_broadcasts.sql                   #  │
│   │   ├── 14_push_subscriptions.sql                 #  │
│   │   ├── 15_enable_rls.sql            # ⚠️ SECURITY — see §4            │
│   │   ├── 16_storage_lockdown.sql      # ⚠️ SECURITY — see §4            │
│   │   ├── 17_restrict_user_pii.sql     # ⚠️ SECURITY — see §4          ─┘
│   │   └── add_recurring_payment.sql    # Optional, no numeric prefix — see §4
│   └── functions/            # Edge Functions (Deno)
│       ├── _shared/          # email-config.ts — centralized sender/reply-to config
│       ├── resolve-bank/     # Verifies bank accounts via Korapay
│       ├── send-email/       # Transactional email via Resend
│       ├── delete-account/   # Account deletion + confirmation email
│       └── send-push/        # Delivers real OS/browser push — see §11
├── Documents/                 # Agent agreement + project overview (PDF/DOCX),
│                               #   used for agent onboarding, not the app itself.
├── legal-documents/          # CAC certificate, TIN, and other Nigerian registration docs
├── .gitignore
├── README.md
└── SETUP.md                  # ← you are here
```

---

## 2. What you must obtain before setup

You will need accounts and credentials for:

| Service    | Why                                     | Where to get it                                      |
|------------|-----------------------------------------|--------------------------------------------------------|
| Supabase   | Database, auth, storage, edge functions | https://supabase.com → new project                   |
| Korapay    | Payments (rent, optional agent tips)    | https://dashboard.korapay.com → API keys           |
| Resend     | Transactional email (contact, receipts) | https://resend.com → API keys                        |
| Vercel     | Frontend + serverless hosting           | https://vercel.com                                   |
| GitHub     | Source hosting / CI                     | https://github.com                                   |
| Google Analytics | Site analytics (GA4)              | https://analytics.google.com → Admin → Data Streams   |
| PostHog    | Product analytics + session recording   | https://posthog.com → Project Settings → API Keys    |

Keep every key you generate in a password manager — losing them means re‑issuing and updating every environment.

---

## 3. Local development

### 3.1 Prerequisites
- Node 18+ and Yarn (`corepack enable`)
- Supabase CLI (`npm i -g supabase`) — only if you want to deploy edge functions locally
- (Optional) Python 3.11+ for the auxiliary `backend/` service

Note: `frontend/bun.lock` exists in the repo (from local dev with Bun), but
Vercel's build is explicitly configured to use `yarn install` / `yarn build`
(see `frontend/vercel.json`). Use Yarn for anything you expect to match
production.

### 3.2 Install & run the frontend
```bash
cd frontend
cp .env.example .env             # fill in real values
yarn install
yarn start                       # http://localhost:3000
```

### 3.3 Create the env files
Copy every `.env.example` to a real `.env` in the same folder and fill it in:

- `frontend/.env` — client‑side (Supabase URL, anon key, Korapay PUBLIC key,
  VAPID public key). Everything here ships inside the public JS bundle —
  never put a secret key in this file. Two variables referenced in the code
  (`REACT_APP_RESEND_API_KEY`, `REACT_APP_BASE_URL`) are used only by
  `src/lib/emailService.js`, which is dead code (nothing imports it) — leave
  them unset. See `frontend/.env.example` for the full annotated list.
- `frontend/api/.env` — Vercel functions (Supabase service role, Korapay SECRET, Resend)
- `supabase/functions/.env` — Edge Function secrets (or use `supabase secrets set`)
- `backend/.env` — only if you run the Python service. Its variable names
  (`SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`, `KORAPAY_PUBLIC_KEY`, `CORS_ORIGINS`)
  are **different** from the ones used in `frontend/api/.env` — don't copy
  values across assuming the names line up.

None of these `.env` files are committed (`.gitignore` blocks them). Only the `.env.example` templates ship in git.

---

## 4. Provisioning a fresh Supabase project

1. Create a new project at https://supabase.com. Note the **Project URL** and **anon key** (Settings → API).
2. Also copy the **service_role key** — server‑side only, never expose to the browser.
3. Open **SQL Editor** and run every file in `supabase/schema/` **in this exact order** — there are 18 files total, not 6:

   **Base snapshot** (reconstructed from the live DB — see `schema/README.md`):
   1. `01_tables.sql`
   2. `02_functions_reference.sql`
   3. `03_triggers.sql`
   4. `04_policies.sql`
   5. `05_indexes.sql`
   6. `06_storage.sql`

   **Migrations, applied on top, in order** (both files below are prefixed
   `07_` — they don't depend on each other, so either order between just
   the two of them is fine, but both must run before `08`):
   7. `07_notifications_and_rate_limiting.sql`
   8. `07_student_verification.sql`
   9. `08_verification_gate_and_invites.sql`
   10. `09_refund_and_delete_fixes.sql`
   11. `10_free_viewings_status_fix.sql`
   12. `11_manual_refund_flow.sql`
   13. `12_agent_tips.sql`
   14. `13_admin_broadcasts.sql`
   15. `14_push_subscriptions.sql`
   16. **`15_enable_rls.sql`** ⚠️ — without this, the RLS policies from
       `04_policies.sql` are defined but never turned on. Any client holding
       the anon key can read/write those tables directly, bypassing every
       policy. Do not skip this or leave a gap before running it.
   17. **`16_storage_lockdown.sql`** ⚠️ — without this, the storage policies
       from `06_storage.sql` have no `TO authenticated` clause, so buckets
       like verification docs and move-in photos are readable/writable by
       anyone, including anonymous requests.
   18. **`17_restrict_user_pii.sql`** ⚠️ — closes a real gap left by
       `09_refund_and_delete_fixes.sql`: that migration only stopped
       *deleted* accounts from being readable by everyone — it left every
       **active** user's full name, email, and phone readable by anyone
       holding just the public anon key, no login required. This migration
       restricts that to agent/admin rows only (their contact info is
       meant to be public on listings) plus the row's own owner or an
       admin. Do not skip this — RLS being "on" doesn't help if the policy
       itself is this permissive.

   **Optional, no numeric prefix, safe to run any time after `01_tables.sql`:**
   - `add_recurring_payment.sql` — adds a display-only field to properties;
     not wired into payment/escrow logic.

4. Under **Storage**, confirm the buckets created by `06_storage.sql` exist:
   - `property-images` (public)
   - `verification-docs` (private)
5. Deploy edge functions (from repo root):
   ```bash
   supabase link --project-ref YOUR-PROJECT-REF
   supabase functions deploy resolve-bank
   supabase functions deploy send-email
   supabase functions deploy delete-account
   supabase secrets set KORAPAY_SECRET_KEY=sk_live_xxx RESEND_API_KEY=re_xxx \
     EMAIL_ADDR_SUPPORT=support@yourdomain.com \
     EMAIL_ADDR_BILLING=billing@yourdomain.com \
     EMAIL_ADDR_NOREPLY=noreply@yourdomain.com
   ```
   All three `EMAIL_ADDR_*` secrets are read by `supabase/functions/_shared/email-config.ts`,
   which every email-sending function imports — this is the single place
   that decides which address an email comes from. See that file's comments
   for the full type → sender mapping (financial receipts/escrow → billing@,
   everything else automated → noreply@, admin replies to the contact form →
   support@ via `frontend/api/send-reply.js`, unrelated to these secrets).
   Deploy `send-push` too (see §11) — this is the fourth function alongside
   the three above.
6. Configure **Authentication → URL Configuration**:
   - Site URL: `https://yourdomain.com`
   - Redirect URLs: add both `https://yourdomain.com/**` and `http://localhost:3000/**`
7. Enable any OAuth providers you use (Google, etc.) under Authentication → Providers.
8. Configure **Authentication → Emails → SMTP Settings**: enable Custom SMTP
   (Supabase's default mailer is rate-limited and only delivers to team-member
   addresses — unusable in production). Recommended: point it at Resend's SMTP
   relay (`smtp.resend.com`, port 465, user `resend`, password = a Resend API
   key) so auth emails ride the same verified domain as everything else.
   Sender email: `noreply@yourdomain.com`. Sender name: `Rentora`. Note:
   Supabase's Auth SMTP has no per-template Reply-To field, so built-in auth
   emails (signup confirmation, password reset, magic link) can't be routed
   to support@ the way the custom emails below can.
9. (Optional) Customise email templates under Authentication → Email Templates.
10. **Required for login/signup to work:** the "Magic Link" template under
    Authentication → Email Templates must include `{{ .Token }}` (the 6-digit
    code) — Rentora's login and signup both use `signInWithOtp` and never send
    magic-link URLs. If a person clicks "Send Code" and never receives a
    usable code, check this template first.

---

## 5. Creating the first admin account

1. Register a normal account through the app.
2. In Supabase SQL Editor:
   ```sql
   update public.users set role = 'admin' where email = 'you@example.com';
   ```

---

## 6. Deploying to Vercel

1. Push this repo to GitHub.
2. On Vercel → **Import Project** → select the repo.
3. Configure:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Create React App
   - **Build Command:** `yarn build`
   - **Output Directory:** `build`
4. Under **Environment Variables**, add every variable from `frontend/.env.example` AND `frontend/api/.env.example` (Vercel serverless functions read from the same env).
5. Deploy. Add a custom domain under Vercel → Domains and point your DNS.

**Property link previews:** `frontend/vercel.json` has a `has`-conditioned rewrite that sends ONLY known link-preview bots (WhatsApp, Twitter/X, Facebook, Telegram, Slack, etc. — matched by User-Agent) hitting `/property/:id` to `api/og-property.js` instead of the SPA. That function looks up the one property and returns a tiny HTML page with that property's own photo/title/price as Open Graph tags, so pasting a property link into a chat app shows the property, not the generic Rentora logo. Real visitors are unaffected — they never match the bot condition and always get the normal React app. No extra setup needed beyond the Supabase env vars already listed above; if link previews stop showing a property's photo after a redeploy, check that the rewrite in `vercel.json` still comes *before* the catch-all SPA rewrite (rewrite order matters — first match wins).

---

## 7. Korapay setup

1. In Korapay dashboard → **API Keys**, copy the **public** key (for the browser) and **secret** key (for Vercel functions + Supabase edge functions).
2. Configure the webhook: Korapay Dashboard → Settings → Webhooks. Set the URL to `https://yourdomain.com/api/korapay-webhook` and copy the **Secret Hash** into Vercel env as `KORAPAY_WEBHOOK_HASH` — this must match exactly (case-sensitive) or every webhook delivery is rejected as an invalid signature.
3. Click **Test Webhook** in the Korapay dashboard and confirm it returns `200 OK`. If it doesn't:
   - Confirm the domain has a valid SSL certificate (the URL loads over HTTPS in a browser).
   - Confirm `KORAPAY_WEBHOOK_HASH` is set in Vercel and the project has been redeployed since adding it.
   - Check `vercel logs | grep webhook` for `[webhook] ERROR:` lines — the message there points at the specific failure.
4. Test with the built‑in "Simulate Payment Success" button before flipping to live keys.
5. **Settlement is not instant.** Local (NGN) transactions settle from Korapay's collection balance into your payout balance / bank account on a T+1 schedule — money collected today lands the next business day, later if it lands on a weekend. This is normal Korapay behavior, not a bug in the integration; it only affects when Rentora's own revenue reaches its bank account, not when a student's payment is marked as received in the app (that happens as soon as the webhook + `confirm-payment.js` verify the charge).

---

## 8. Analytics & cookie consent

The site runs two trackers, both configured directly in `frontend/public/index.html`
(hardcoded IDs, not environment variables — rotating either means editing that
file and redeploying, not changing a Vercel env var):

- **Google Analytics (GA4)** — Measurement ID `G-CVXKXET4K2`. Uses Google's
  **Consent Mode v2**: `analytics_storage` defaults to `denied` for every
  visitor until they click Accept on the consent banner (`ConsentBanner.jsx`),
  which calls `gtag('consent', 'update', { analytics_storage: 'granted' })`.
  Declining, or not answering yet, means no GA tracking beacons are sent.
- **PostHog** — project key `phc_xAvL2Iq4tFmANRE7kzbKwaSqp1HJjN7x48s3vr0CMjs`,
  `api_host: https://us.i.posthog.com`, with **session recording** enabled
  (`session_recording: { recordCrossOriginIframes: true, capturePerformance: false }`).
  `posthog.init(...)` is never called until the visitor accepts — it's wrapped
  in a `window.__initPostHogAnalytics()` function that `ConsentBanner.jsx`
  calls on Accept. Declining means PostHog never initializes at all for that
  visitor (no events, no recording).
- **Consent storage:** the visitor's choice is saved to
  `localStorage['rentora_consent']` (`'true'` or `'declined'`). Both trackers
  read this on every page load so returning visitors who already accepted
  aren't re-blocked. Clear this key (or use a private window) to see the
  banner again for testing.
- To rotate the GA Measurement ID or PostHog project key: edit the two
  `<script>` blocks in `frontend/public/index.html` directly, redeploy.
- If you add a **third-party script** to this project later, it needs the
  same consent gate — don't just drop in a new `<script>` tag, or it'll run
  unconditionally like PostHog originally did before this was fixed.

---

## 9. Handing off / selling this project

Everything a buyer needs is in this repo **except** live credentials and live data. Provide them separately:

1. **This repository** (source of truth for code + schema).
2. **Credentials handover** — share via a password manager (1Password, Bitwarden shared vault):
   - Supabase project URL, anon key, service_role key, project ref, dashboard access
   - Korapay account access + API keys
   - Resend API key
   - Vercel project access + custom domain / DNS registrar login
   - GitHub repo access
   - Google Analytics property access, PostHog project access
3. **Data export** — from Supabase Dashboard → Database → Backups, download the latest `pg_dump`. Ship the `.sql` file to the buyer over a secure channel. They restore it into their own Supabase project after running the schema (or restore the full dump and skip step 4 below).
4. **Buyer setup path** — buyer follows this SETUP.md end‑to‑end with their own accounts:
   - Fork/import repo to their GitHub
   - Create their own Supabase project → run all 18 files in `supabase/schema/*.sql` in the order in §4 → deploy edge functions
   - Restore data dump (if included) via Supabase SQL Editor or `psql`
   - Import to their Vercel account, set env vars, deploy
   - Create their own GA4 property and PostHog project, swap the IDs in `frontend/public/index.html` (§8)
   - Point their domain
5. **Rotate everything after handover** — the seller must reset Supabase service_role, Korapay keys, Resend key, and any OAuth client secrets so the previous owner loses access. Buyer generates their own. GA/PostHog aren't secrets in the same sense, but the buyer should still create their own accounts rather than inherit the seller's.
6. **Optional extras to include with the sale:**
   - Screenshots / demo video of the live app
   - Traffic + revenue analytics
   - Any brand assets (logo source files, domain email)
   - `Documents/` already contains the agent agreement + project overview
   - This SETUP.md serves as the buyer's operational runbook.

---

## 10. What is NOT in this repo

These live only in third‑party dashboards and must be captured manually if you want a full disaster‑recovery copy:

- Supabase Auth settings (site URL, redirect URLs, OAuth client IDs/secrets, email templates)
- Supabase project secrets (edge function env vars) — mirror them in `supabase/functions/.env.example` names, values in your password manager
- Vercel environment variables and domain config
- Korapay webhook + payout account config
- Resend domain verification records
- Google Analytics / PostHog project configuration (the IDs are in `index.html`, but dashboard settings like GA4 conversion events or PostHog dashboards are not)
- Live table data (use Supabase backups / `pg_dump`)

Keep a private "operations" doc in your password manager listing where each of the above lives.

---

## 11. Push notifications (browser/OS-level)

The subscribe side (`frontend/src/lib/push.js`, the `push_subscriptions`
table) and the send side (`supabase/functions/send-push`) now both exist.
Wiring them together needs a one-time setup:

1. **Generate a VAPID key pair** (skip if you already have one — see the
   warning below):
   ```bash
   npx web-push generate-vapid-keys
   ```
   This prints a public and private key. **Do this once and keep both —
   regenerating later silently breaks push for every already-subscribed
   user**, since their browser has the old public key baked into its
   subscription and there's no way to update it remotely; they'd have to
   revisit the site and re-enable push.

2. **Set the public key in the frontend** — `frontend/.env`:
   ```
   REACT_APP_VAPID_PUBLIC_KEY=<the public key>
   ```

3. **Deploy the edge function and set its secrets:**
   ```bash
   supabase functions deploy send-push
   supabase secrets set \
     VAPID_PUBLIC_KEY=<the public key> \
     VAPID_PRIVATE_KEY=<the private key> \
     VAPID_SUBJECT=mailto:support@rentora.com.ng
   ```
   The public key must be set in **both** places (step 2 and here) — it's
   the same value twice, once for the browser and once for the server side
   that signs pushes.

4. **Connect the trigger — Supabase Dashboard → Database → Webhooks →
   Create a new hook:**
   - Table: `user_notifications`
   - Events: `Insert`
   - Type: `Supabase Edge Functions`
   - Edge Function: `send-push`
   - HTTP method: `POST`
   This makes every new row in `user_notifications` (i.e. every existing
   call to `notifyUser()` in the app — property approved, rent released,
   move-in confirmed, etc.) automatically trigger a push, without editing
   any of those call sites individually.

5. **Test it:** log in on a device, enable push when prompted (or via
   whatever UI toggle triggers `push.js`'s subscribe flow), then trigger
   any event that calls `notifyUser()` — e.g. as an admin, approve a
   pending property — and confirm a real OS notification appears.

**Note:** `send-push` deliberately only accepts requests carrying the exact
service role key (not just any logged-in user's token) — this is what
Database Webhooks authenticate with automatically. If you ever call it by
hand for testing, you need to pass that key as the Bearer token.

---

## 12. Other known incomplete features

- **`src/lib/emailService.js` is dead code.** Nothing imports it. All real
  transactional email goes through Supabase Edge Functions (`send-email`)
  or `frontend/api/send-reply.js` instead. Don't set
  `REACT_APP_RESEND_API_KEY` thinking it's required — it isn't read by
  anything that's actually wired up, and setting it would expose a real
  Resend key in the public JS bundle.
- **`frontend/api/send-email.js` is similarly unused/dead** — see the note
  in `frontend/api/.env.example` about `FROM_EMAIL`.

---

## 13. Troubleshooting

| Symptom                                | Fix                                                            |
|----------------------------------------|------------------------------------------------------------------|
| Auth returns 401 / "invalid API key"   | Wrong Supabase URL or anon key in `frontend/.env`              |
| RLS "permission denied"                | Re‑run `04_policies.sql`; confirm user role in `public.users`  |
| Anyone can read/write tables directly, bypassing RLS | `15_enable_rls.sql` was never run — see §4 |
| Storage bucket readable/writable by anonymous users | `16_storage_lockdown.sql` was never run — see §4 |
| Anyone (even logged out) can read all users' name/email/phone via the API | `17_restrict_user_pii.sql` was never run — see §4 |
| Storage upload fails                   | Bucket missing or wrong policy — re‑run `06_storage.sql`       |
| Edge function 500                      | `supabase functions logs <n>` → check missing secret        |
| Payments not verifying                 | Korapay secret key not set in Vercel env / edge function       |
| "Unsuccessful Webhook Delivery" email  | `KORAPAY_WEBHOOK_HASH` missing/mismatched in Vercel, or webhook URL/SSL wrong — see §7 |
| Korapay balance not in bank account yet | Normal T+1 local settlement delay, not an integration bug — see §7 |
| Vercel 404 on refresh                  | Root Directory not set to `frontend`                            |
| User toggles push "on" but never receives anything | Check the Database Webhook is set up (§11 step 4) and `supabase functions logs send-push` for errors |
| Push worked before, now silently stops for everyone | VAPID keys were regenerated — see the warning in §11 step 1 |
| GA/PostHog show zero events even after clicking Accept | Check `localStorage['rentora_consent']` is `'true'`; check browser ad-blocker isn't blocking `googletagmanager.com` / `i.posthog.com` outright |
| Backend (`backend/server.py`) can't connect to Supabase | Check you used `SUPABASE_SERVICE_KEY` / `SUPABASE_ANON_KEY` (not `_ROLE_` or other names) in `backend/.env` — see §3.3 |

---

Questions during handover: leave them in the GitHub issues of the repo you transfer to the buyer.
