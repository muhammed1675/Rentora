# Rentora - Deployment Setup Guide

## What Changed

This cleaned version includes:
- ✅ Updated `api/confirm-payment.js` with non-blocking email sending
- ✅ Removed all unused Korapay files (korapay.js, korapay-init.js, korapay-verify.js)
- ✅ Fully Flutterwave-based payment system

## Critical: Required Environment Variables

Before deploying to Vercel, set these environment variables in your Vercel project settings:

### Already Existing (Verify these are set)
```
REACT_APP_SUPABASE_URL=<your-supabase-url>
REACT_APP_SUPABASE_ANON_KEY=<your-supabase-anon-key>
FLW_SECRET_KEY=<your-flutterwave-secret-key>
FLW_WEBHOOK_HASH=<your-flutterwave-webhook-hash>
REACT_APP_FLW_PUBLIC_KEY=<your-flutterwave-public-key>
```

### CRITICAL: Newly Required (ADD THESE NOW)
```
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
SUPABASE_URL=<your-supabase-url>
```

## How to Get SUPABASE_SERVICE_ROLE_KEY

1. Go to [Supabase Dashboard](https://supabase.com)
2. Select your project
3. Click **Settings** (bottom left)
4. Click **API**
5. Copy the **Service Role Key** (labeled "service_role secret")
6. Paste into Vercel Settings > Environment Variables as `SUPABASE_SERVICE_ROLE_KEY`

## How to Get SUPABASE_URL

1. In Supabase Settings > API
2. Copy the **Project URL** (starts with https://...)
3. Paste into Vercel Settings > Environment Variables as `SUPABASE_URL`

## Deployment Steps

1. **Set Environment Variables**
   - Go to Vercel Project Settings > Environment Variables
   - Add/update the variables listed above
   - Make sure `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` are set

2. **Deploy**
   - Push changes to your repository
   - Vercel will auto-deploy
   - Or manually deploy via Vercel CLI: `vercel deploy --prod`

3. **Verify Flutterwave Webhook**
   - Go to Flutterwave Dashboard > Settings > Webhooks
   - Ensure the webhook URL is: `https://your-domain.vercel.app/api/flutterwave-webhook`
   - Ensure the webhook Secret Hash matches `FLW_WEBHOOK_HASH` in Vercel

4. **Test Payment Flow**
   - Try buying tokens
   - Try requesting an inspection
   - Try making a rent payment
   - Check that emails are received
   - Verify payment status updates to "completed" in dashboard

## Troubleshooting

### Payment shows "Pending" instead of "Completed"
**Cause:** Missing `SUPABASE_SERVICE_ROLE_KEY`
**Fix:** 
1. Get the key from Supabase Settings > API > Service Role Key
2. Add to Vercel as `SUPABASE_SERVICE_ROLE_KEY`
3. Redeploy

### Emails not arriving
**Cause:** 
- Missing `SUPABASE_SERVICE_ROLE_KEY`
- Missing `SUPABASE_URL`
- Supabase Edge Function `send-email` not deployed
**Fix:**
1. Verify both env vars are set (see above)
2. Check Supabase > Edge Functions > send-email is deployed
3. Test via Vercel Logs: `vercel logs`

### Payment stuck in "Held" state (Rent payments)
**Cause:** Email sending failed silently (now fixed)
**Status:** Should be resolved with this version

## Key Fixes in This Version

### 1. Non-Blocking Email Sending
Inspection payment confirmation emails now send in the background. Payment status is confirmed immediately even if email delivery is slow or fails temporarily.

**Before:** Payment blocked until email succeeded → if email failed, payment stayed "pending"
**After:** Payment confirmed immediately → emails sent in background → failures logged but don't block

### 2. Removed Korapay Code
- Deleted `src/lib/korapay.js`
- Deleted `api/korapay-init.js`
- Deleted `api/korapay-verify.js`

All payment flows use Flutterwave.

## Files Modified

- `api/confirm-payment.js` — Email handling now non-blocking for inspections

## Files Removed

- `src/lib/korapay.js`
- `api/korapay-init.js`
- `api/korapay-verify.js`

## Support

If payments still don't work after setup:
1. Check Vercel Logs: `vercel logs --tail`
2. Look for error messages starting with `confirm-payment:`
3. Verify all environment variables are set correctly
4. Check Flutterwave webhook is configured

---

**Ready to deploy!** Follow the steps above and your payment system will be fully functional.
