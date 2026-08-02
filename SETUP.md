# Rentora — Setup Guide

Complete instructions to run, deploy, or hand off this project from zero. The app is a student‑housing platform (React + Supabase + Flutterwave) currently live at https://www.rentora.com.ng.

---

## 1. Repository layout

```
Rentora/
├── frontend/                 # React 19 app (CRACO). This is what Vercel deploys.
│   ├── src/                  # Pages, components, lib (supabase client, auth, api)
│   ├── api/                  # Vercel serverless functions (Flutterwave, contact form)
│   └── .env.example          # Frontend env vars (REACT_APP_*)
├── backend/                  # Optional Python service (FastAPI). Not required for prod.
├── supabase/
│   ├── schema/               # Canonical SQL — run in numeric order on a fresh project
│   │   ├── 01_tables.sql
│   │   ├── 02_functions_reference.sql
│   │   ├── 03_triggers.sql
│   │   ├── 04_policies.sql
│   │   ├── 05_indexes.sql
│   │   └── 06_storage.sql
│   └── functions/            # Edge Functions (Deno)
│       ├── _shared/          # email-config.ts — centralized sender/reply-to config
│       ├── resolve-bank/     # Verifies bank accounts via Flutterwave
│       ├── send-email/       # Transactional email via Resend
│       └── delete-account/   # Account deletion + confirmation email
├── legal-documents/          # CAC certificate, TIN, and other Nigerian registration docs
├── .gitignore
├── README.md
└── SETUP.md                  # ← you are here
```

---

## 2. What you must obtain before setup

You will need accounts and credentials for:

| Service    | Why                                     | Where to get it                                      |
|------------|-----------------------------------------|------------------------------------------------------|
| Supabase   | Database, auth, storage, edge functions | https://supabase.com → new project                   |
| Flutterwave    | Payments (tokens, inspections, rent)    | https://flutterwave.com → dashboard → API keys           |
| Resend     | Transactional email (contact, receipts) | https://resend.com → API keys                        |
| Vercel     | Frontend + serverless hosting           | https://vercel.com                                   |
| GitHub     | Source hosting / CI                     | https://github.com                                   |

Keep every key you generate in a password manager — losing them means re‑issuing and updating every environment.

---

## 3. Local development

### 3.1 Prerequisites
- Node 18+ and Yarn (`corepack enable`)
- Supabase CLI (`npm i -g supabase`) — only if you want to deploy edge functions locally
- (Optional) Python 3.11+ for the auxiliary `backend/` service

### 3.2 Install & run the frontend
```bash
cd frontend
cp .env.example .env             # fill in real values
yarn install
yarn start                       # http://localhost:3000
```

### 3.3 Create the env files
Copy every `.env.example` to a real `.env` in the same folder and fill it in:

- `frontend/.env` — client‑side (Supabase URL, anon key, Flutterwave PUBLIC key)
- `frontend/api/.env` — Vercel functions (Supabase service role, Flutterwave SECRET, Resend)
- `supabase/functions/.env` — Edge Function secrets (or use `supabase secrets set`)
- `backend/.env` — only if you run the Python service

None of these `.env` files are committed (`.gitignore` blocks them). Only the `.env.example` templates ship in git.

---

## 4. Provisioning a fresh Supabase project

1. Create a new project at https://supabase.com. Note the **Project URL** and **anon key** (Settings → API).
2. Also copy the **service_role key** — server‑side only, never expose to the browser.
3. Open **SQL Editor** and run the files in `supabase/schema/` in order:
   1. `01_tables.sql`
   2. `02_functions_reference.sql`
   3. `03_triggers.sql`
   4. `04_policies.sql`
   5. `05_indexes.sql`
   6. `06_storage.sql`
4. Under **Storage**, confirm the buckets created by `06_storage.sql` exist:
   - `property-images` (public)
   - `verification-docs` (private)
5. Deploy edge functions (from repo root):
   ```bash
   supabase link --project-ref YOUR-PROJECT-REF
   supabase functions deploy resolve-bank
   supabase functions deploy send-email
   supabase functions deploy delete-account
   supabase secrets set FLW_SECRET_KEY=sk_live_xxx RESEND_API_KEY=re_xxx \
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

---

## 7. Flutterwave setup

1. In Flutterwave dashboard → **API Keys**, copy the **public** key (for the browser) and **secret** key (for Vercel functions + Supabase edge functions).
2. Configure the webhook: Flutterwave Dashboard → Settings → Webhooks. Set the URL to `https://yourdomain.com/api/flutterwave-webhook` and copy the **Secret Hash** into Vercel env as `FLW_WEBHOOK_HASH` — this must match exactly (case-sensitive) or every webhook delivery is rejected as an invalid signature.
3. Click **Test Webhook** in the Flutterwave dashboard and confirm it returns `200 OK`. If it doesn't:
   - Confirm the domain has a valid SSL certificate (the URL loads over HTTPS in a browser).
   - Confirm `FLW_WEBHOOK_HASH` is set in Vercel and the project has been redeployed since adding it.
   - Check `vercel logs | grep webhook` for `[webhook] ERROR:` lines — the message there points at the specific failure.
4. Test with the built‑in "Simulate Payment Success" button before flipping to live keys.
5. **Settlement is not instant.** Local (NGN) transactions settle from Flutterwave's collection balance into your payout balance / bank account on a T+1 schedule — money collected today lands the next business day, later if it lands on a weekend. This is normal Flutterwave behavior, not a bug in the integration; it only affects when Rentora's own revenue reaches its bank account, not when a student's payment is marked as received in the app (that happens as soon as the webhook + `confirm-payment.js` verify the charge).

---

## 8. Handing off / selling this project

Everything a buyer needs is in this repo **except** live credentials and live data. Provide them separately:

1. **This repository** (source of truth for code + schema).
2. **Credentials handover** — share via a password manager (1Password, Bitwarden shared vault):
   - Supabase project URL, anon key, service_role key, project ref, dashboard access
   - Flutterwave account access + API keys
   - Resend API key
   - Vercel project access + custom domain / DNS registrar login
   - GitHub repo access
3. **Data export** — from Supabase Dashboard → Database → Backups, download the latest `pg_dump`. Ship the `.sql` file to the buyer over a secure channel. They restore it into their own Supabase project after running the schema (or restore the full dump and skip step 4 below).
4. **Buyer setup path** — buyer follows this SETUP.md end‑to‑end with their own accounts:
   - Fork/import repo to their GitHub
   - Create their own Supabase project → run `supabase/schema/*.sql` in order → deploy edge functions
   - Restore data dump (if included) via Supabase SQL Editor or `psql`
   - Import to their Vercel account, set env vars, deploy
   - Point their domain
5. **Rotate everything after handover** — the seller must reset Supabase service_role, Flutterwave keys, Resend key, and any OAuth client secrets so the previous owner loses access. Buyer generates their own.
6. **Optional extras to include with the sale:**
   - Screenshots / demo video of the live app
   - Traffic + revenue analytics
   - Any brand assets (logo source files, domain email)
   - This SETUP.md serves as the buyer's operational runbook.

---

## 9. What is NOT in this repo

These live only in third‑party dashboards and must be captured manually if you want a full disaster‑recovery copy:

- Supabase Auth settings (site URL, redirect URLs, OAuth client IDs/secrets, email templates)
- Supabase project secrets (edge function env vars) — mirror them in `supabase/functions/.env.example` names, values in your password manager
- Vercel environment variables and domain config
- Flutterwave webhook + payout account config
- Resend domain verification records
- Live table data (use Supabase backups / `pg_dump`)

Keep a private "operations" doc in your password manager listing where each of the above lives.

---

## 10. Troubleshooting

| Symptom                                | Fix                                                            |
|----------------------------------------|----------------------------------------------------------------|
| Auth returns 401 / "invalid API key"   | Wrong Supabase URL or anon key in `frontend/.env`              |
| RLS "permission denied"                | Re‑run `04_policies.sql`; confirm user role in `public.users`  |
| Storage upload fails                   | Bucket missing or wrong policy — re‑run `06_storage.sql`       |
| Edge function 500                      | `supabase functions logs <name>` → check missing secret        |
| Payments not verifying                 | Flutterwave secret key not set in Vercel env / edge function       |
| "Unsuccessful Webhook Delivery" email  | `FLW_WEBHOOK_HASH` missing/mismatched in Vercel, or webhook URL/SSL wrong — see §7 |
| Flutterwave balance not in bank account yet | Normal T+1 local settlement delay, not an integration bug — see §7 |
| Vercel 404 on refresh                  | Root Directory not set to `frontend`                            |

---

Questions during handover: leave them in the GitHub issues of the repo you transfer to the buyer.
