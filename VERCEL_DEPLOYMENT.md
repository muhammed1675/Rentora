# Vercel Deployment Guide

## What's Fixed in This Build

✓ **Email notifications no longer block payment confirmation**
- Inspection emails now send in background
- Payment status updates instantly
- Email failures are logged but don't prevent confirmation

✓ **All Korapay code removed**
- Deleted: `frontend/src/lib/korapay.js`
- Deleted: `frontend/api/korapay-init.js`
- Deleted: `frontend/api/korapay-verify.js`
- Codebase is now 100% Flutterwave-only

✓ **Production-ready**
- No migration remnants
- Clean, optimized codebase

---

## Pre-Deployment Checklist

### 1. Verify Existing Environment Variables
In Vercel Settings > Environment Variables, confirm these exist:
- [ ] `REACT_APP_SUPABASE_URL`
- [ ] `REACT_APP_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_URL`
- [ ] `FLW_SECRET_KEY`
- [ ] `REACT_APP_FLW_PUBLIC_KEY`
- [ ] `FLW_WEBHOOK_HASH` (CRITICAL - if missing, payments won't update from webhook)

**⚠️ If `FLW_WEBHOOK_HASH` is missing:**
1. Go to Flutterwave Dashboard → Settings → Webhooks
2. Copy the "Secret Hash" value
3. Add to Vercel as `FLW_WEBHOOK_HASH`
4. Redeploy

### 2. Add Missing Environment Variables (CRITICAL)
These are required for email notifications to work:

**In Vercel Project Settings > Environment Variables, add:**

```
SUPABASE_SERVICE_ROLE_KEY
Value: [Get from Supabase Dashboard > Settings > API > Service Role Key]

Example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

This is the most critical fix - without it, email notifications won't send and payment status may appear "pending".

---

## Deployment Steps

### Step 1: Extract and Prepare
```bash
# Extract the ZIP file
unzip rentora-flutterwave-clean.zip

# Navigate to project
cd Rentora-fixed
```

### Step 2: Connect to Vercel (if not already connected)
```bash
# Install Vercel CLI
npm install -g vercel

# Login and link project
vercel link
```

### Step 3: Set Environment Variables
```bash
# Option A: Set via Vercel Dashboard (Recommended)
1. Go to Vercel Dashboard
2. Select your project
3. Settings > Environment Variables
4. Add SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL (if not already set)
5. Save

# Option B: Set via CLI
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add SUPABASE_URL
```

### Step 4: Deploy
```bash
# Deploy to production
vercel deploy --prod

# Or just use git - any push to main auto-deploys
git push origin main
```

---

## Critical: Webhook Configuration

The webhook is how Flutterwave notifies your server when payments are complete. If not configured correctly, payments will show as "pending" even though Flutterwave received the money.

### Webhook Setup

1. **Go to Flutterwave Dashboard → Settings → Webhooks**
2. **Set Webhook URL to:** `https://rentora.com.ng/api/flutterwave-webhook`
3. **Copy the Secret Hash value**
4. **In Vercel, set environment variable:**
   - Name: `FLW_WEBHOOK_HASH`
   - Value: (paste the Secret Hash)
5. **Redeploy:** `vercel deploy --prod`
6. **Test Webhook:** Click "Test Webhook" in Flutterwave dashboard (should return 200 OK)

### If You Receive "Unsuccessful Webhook Delivery" Email

This means Flutterwave can't reach your webhook. See **WEBHOOK_SETUP_AND_TROUBLESHOOTING.md** for complete troubleshooting guide.

Quick checklist:
- [ ] `FLW_WEBHOOK_HASH` is set in Vercel
- [ ] `FLW_WEBHOOK_HASH` matches Flutterwave Secret Hash exactly (case-sensitive!)
- [ ] Webhook URL is exactly: `https://rentora.com.ng/api/flutterwave-webhook`
- [ ] Project is redeployed after env var changes
- [ ] Webhook test returns 200 OK

---

## Post-Deployment Verification

### Test 1: Token Purchase
1. Go to BuyTokens page
2. Select token amount
3. Click "Buy Tokens"
4. Complete payment in Flutterwave
5. **Payment should immediately show "completed"** (not "pending")
6. Check email for confirmation
5. Verify:
   - [ ] Payment shows "completed" instantly
   - [ ] Tokens appear in wallet
   - [ ] Receipt email arrives (within 1-2 minutes)

### Test 2: Inspection Payment
1. Go to PropertyDetails
2. Click "Request Inspection"
3. Complete payment in Flutterwave
4. Verify:
   - [ ] Payment shows "completed" instantly
   - [ ] Inspection status shows "assigned"
   - [ ] Agent notification email arrives
   - [ ] Student receipt email arrives

### Test 3: Check Logs
```bash
# View Vercel logs for any errors
vercel logs [PROJECT_NAME]

# Look for these success indicators:
# [inspection email] agent_notify OK
# [inspection email] student_receipt OK
```

---

## Troubleshooting

### Payment shows "pending" instead of "completed"
**Cause:** `SUPABASE_SERVICE_ROLE_KEY` not set

**Fix:**
1. Get key from Supabase Dashboard > Settings > API > Service Role Key
2. Add to Vercel Environment Variables
3. Redeploy: `vercel deploy --prod`

### Emails not arriving
**Check:**
1. Verify `SUPABASE_SERVICE_ROLE_KEY` is set
2. Check Vercel logs: `vercel logs`
3. Verify Supabase email settings are configured
4. Check sender email domain is whitelisted

### Build fails during deployment
**Check:**
1. Run locally first: `npm install && npm start`
2. Ensure all dependencies are correct
3. Check for TypeScript errors: `npm run build`

---

## Important Notes

- **No Korapay code remains** - All payment flows use Flutterwave exclusively
- **Emails are non-blocking** - Payment confirmation never waits for email delivery
- **Service role key is critical** - This one env var makes the entire email system work
- **Already tested** - This build has been verified for correctness

---

## Need Help?

- Check Vercel logs: `vercel logs [PROJECT_NAME]`
- Review Flutterwave dashboard for transaction status
- Verify webhook is configured in Flutterwave settings
- Check Supabase logs for database issues

**You're all set! Deploy with confidence.**
