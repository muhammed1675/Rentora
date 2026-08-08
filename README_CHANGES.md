# Rentora — refund flow + account-deletion fix

Drop these files into the matching paths in your actual repo (they mirror
the folder structure: `supabase/...`, `frontend/...`). Every file here is
either brand new or a full replacement of an existing file — no partial
diffs to apply by hand.

## Files in this bundle

| Path | Status | What it does |
|---|---|---|
| `supabase/schema/09_refund_and_delete_fixes.sql` | new | Migration — run once in Supabase SQL Editor |
| `frontend/api/_flutterwave.js` | replace | Adds `refundTransaction()` / `verifyById()` helpers |
| `frontend/api/admin-refund-payment.js` | new | Admin-only refund endpoint (Vercel serverless) |
| `supabase/functions/send-email/index.ts` | replace | Adds 2 new quiet email templates |
| `supabase/functions/delete-account/index.ts` | replace | Stops erasing name/phone on deletion |
| `frontend/src/pages/AdminDashboard.jsx` | replace | Adds "Resolve" button + refund dialog in Escrow tab |
| `frontend/src/lib/api.js` | replace | Adds `adminAPI.refundRentPayment()` |

## Deploy order

1. **Run the SQL migration first.**
   Supabase Dashboard → SQL Editor → paste the full contents of
   `09_refund_and_delete_fixes.sql` → Run. Safe to re-run if needed.

2. **Deploy the two edge functions.**
   ```
   supabase functions deploy send-email
   supabase functions deploy delete-account
   ```

3. **Push the frontend/API changes** (git commit + push, or however you
   deploy to Vercel). `admin-refund-payment.js` will be picked up
   automatically as a new serverless function — no extra Vercel config
   needed, it uses the same env vars `confirm-payment.js` already has
   (`FLW_SECRET_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `REACT_APP_SUPABASE_ANON_KEY`).

## Before using this on a real held payment

- Test the refund flow against a **test/sandbox Flutterwave transaction**
  first — I haven't been able to run this against your live Supabase or
  Flutterwave account, only checked that the code is syntactically valid.
- Confirm `FLW_SECRET_KEY` in your Vercel project has refund permissions
  enabled on the Flutterwave dashboard (some merchant accounts need this
  turned on separately from payment collection).
- After running the migration, spot-check that `users_can_read_all` in
  Supabase → Database → Policies now shows the updated `USING` clause —
  RLS policy edits are easy to get subtly wrong, worth eyeballing once.

## What each fix actually does, briefly

- **Refund flow**: admin clicks "Resolve" on a held payment → picks a
  reason → the student is refunded in full via Flutterwave → the
  property's `status` is set to `'rejected'`, dropping it out of every
  public listing query for good (it does NOT return to `'available'`).
  No refund UI exists anywhere except this one admin screen.
- **Account deletion**: `full_name` and `phone` are no longer wiped when
  someone deletes their account. `deleted_at` is still set, and a new RLS
  policy hides that row from every other user — only admins can still see
  it, e.g. to answer a legitimate school/EFCC request about who was
  behind an account.
