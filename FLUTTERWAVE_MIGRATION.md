# Korapay → Flutterwave migration

Everything payment-related now goes through Flutterwave. Nothing about your
database schema, escrow logic, emails or RLS changed — only the payment
provider behind it.

## What changed

| Old (Korapay) | New (Flutterwave) |
|---|---|
| `frontend/api/korapay-init.js` | `frontend/api/flutterwave-init.js` (creates a Standard checkout link) |
| `frontend/api/korapay-verify.js` | `frontend/api/flutterwave-verify.js` (`/transactions/verify_by_reference`) |
| — | `frontend/api/_flutterwave.js` (shared auth + verify helper) |
| — | `frontend/api/flutterwave-webhook.js` (**new**, reliable server-side confirmation) |
| `frontend/src/lib/korapay.js` | `frontend/src/lib/flutterwave.js` (`openFlutterwaveCheckout`, Flutterwave Inline) |
| `confirm-payment.js` verified with Korapay | now verifies with Flutterwave, plus currency + tx_ref checks |
| `supabase/functions/resolve-bank` used Korapay banks | now uses `/v3/banks/NG` and `/v3/accounts/resolve` |
| CSP allowed `korapay.com` | CSP allows `checkout.flutterwave.com` |

The security model is unchanged and still fails closed: the browser callback
never marks anything paid — `/api/confirm-payment` re-verifies the charge
server-side (status `successful`, currency NGN, matching `tx_ref`, matching
amount) before any status transition.

`openKorapayCheckout` is still exported as an alias from
`src/lib/flutterwave.js`, so nothing breaks if an import was missed.

## Environment variables

### Vercel → Project → Settings → Environment Variables

| Name | Value | Scope |
|---|---|---|
| `REACT_APP_FLW_PUBLIC_KEY` | `FLWPUBK-...` | Production + Preview (build-time, safe in the browser) |
| `FLW_SECRET_KEY` | `FLWSECK-...` | Production + Preview (server only — never prefix with `REACT_APP_`) |
| `FLW_WEBHOOK_HASH` | your secret hash | Production + Preview |

Keep the existing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and
`REACT_APP_SUPABASE_*` variables as they are. You can delete
`KORALPAY_SECRET_KEY` and `REACT_APP_KORAPAY_PUBLIC_KEY`.

Redeploy after adding them — `REACT_APP_*` values are baked in at build time.

### Supabase (for the bank list / account resolve function)

```bash
supabase secrets set FLW_SECRET_KEY=FLWSECK-...
supabase functions deploy resolve-bank
```

### Flutterwave dashboard → Settings → Webhooks

- URL: `https://<your-domain>/api/flutterwave-webhook`
- Secret hash: the same string you saved as `FLW_WEBHOOK_HASH`

## About the v4 API keys

Flutterwave v4 (the OAuth `client_id` / `client_secret` credentials) has **no
hosted checkout page and no inline modal** — v4 only exposes direct charge
endpoints, which means your site would have to collect raw card numbers itself
and take on PCI-DSS SAQ A-EP scope, plus build your own 3-D Secure, bank
transfer and USSD screens.

This app's flow (a checkout modal that handles card + transfer + USSD for you)
maps onto Flutterwave **Standard / Inline**, which uses the classic
`FLWPUBK-...` / `FLWSECK-...` key pair. Both key sets come from the same
account: Dashboard → Settings → API Keys, and you can toggle between the v3
and v4 credentials there. Live keys work exactly the same as test keys — just
use the `FLWPUBK-...` (no `_TEST`) values.

If you specifically want the v4 direct-charge integration with your own card
form, that's a bigger rebuild (custom card/OTP/PIN UI, payload encryption,
OAuth token manager) and can be done as a follow-up.

## Testing checklist

1. Buy tokens → modal opens → pay with a Flutterwave test card → wallet credited.
2. Book an inspection → payment → inspection assigned + both emails sent.
3. Pay rent → status becomes `held` → confirm move-in releases funds.
4. Become an agent → bank dropdown loads → account number resolves to a name.
5. Kill the tab mid-payment → the webhook still confirms the transaction.
