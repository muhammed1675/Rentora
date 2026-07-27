# Flutterwave Webhook Setup & Troubleshooting

## Issue: "Unsuccessful Webhook Delivery" Email

You received this email because Flutterwave is trying to send a webhook but it's failing to reach your server.

**Impact:** Payments show as "pending" instead of "completed" even though Flutterwave received the money.

---

## Quick Fix (5 minutes)

### Step 1: Verify Environment Variables in Vercel

Go to **Vercel Dashboard → Your Project → Settings → Environment Variables**

Check that these exist:
- ✅ `FLW_WEBHOOK_HASH` (This is CRITICAL for webhook validation)
- ✅ `FLW_SECRET_KEY` (For verifying payments)
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`

If `FLW_WEBHOOK_HASH` is missing:
```
Get it from: Flutterwave Dashboard → Settings → Webhooks → Secret Hash
Add it to Vercel as: FLW_WEBHOOK_HASH
Redeploy after adding
```

### Step 2: Verify Webhook URL in Flutterwave

Go to **Flutterwave Dashboard → Settings → Webhooks**

Check these:
- **URL:** Should be exactly: `https://rentora.com.ng/api/flutterwave-webhook`
- **Secret Hash:** Should match `FLW_WEBHOOK_HASH` in Vercel exactly (case-sensitive!)

### Step 3: Test the Webhook

Click **Test Webhook** in Flutterwave Dashboard. You should get a **200 OK** response.

If you get an error, check:
1. Is the domain correct? (no typos)
2. Is the path correct? (`/api/flutterwave-webhook`)
3. Is the SSL certificate valid? (rentora.com.ng should have HTTPS)

### Step 4: Redeploy and Test

After making changes:
```bash
vercel deploy --prod
```

Then test a payment to confirm:
1. Make a test payment
2. Payment should immediately show "completed"
3. Check your email for notifications

---

## Common Issues & Fixes

### Issue 1: "Unsuccessful Webhook Delivery" - Connection Timeout

**Cause:** Flutterwave can't reach your domain

**Fix:**
- Check domain is correct: `https://rentora.com.ng/api/flutterwave-webhook`
- Verify SSL certificate is valid (visit the URL in browser)
- Check for DNS issues: `nslookup rentora.com.ng`
- Wait 5-10 minutes and try Flutterwave test again

### Issue 2: "Invalid Signature" Error in Logs

**Cause:** The `FLW_WEBHOOK_HASH` in Vercel doesn't match Flutterwave

**Fix:**
1. Go to Flutterwave Dashboard → Settings → Webhooks
2. Copy the exact Secret Hash
3. Go to Vercel → Project Settings → Environment Variables
4. Update `FLW_WEBHOOK_HASH` to match exactly (case-sensitive!)
5. Redeploy

### Issue 3: "FLW_WEBHOOK_HASH not configured" in Logs

**Cause:** Environment variable not set in Vercel

**Fix:**
1. Get Secret Hash from Flutterwave Dashboard → Settings → Webhooks
2. Add to Vercel → Project Settings → Environment Variables
3. Name: `FLW_WEBHOOK_HASH`
4. Value: (paste the Secret Hash)
5. Redeploy with `vercel deploy --prod`

### Issue 4: Payment Shows "Pending" After Successful Payment

**Cause:** Webhook wasn't processed in time

**Fix:**
1. Check all above environment variables are correct
2. Check Vercel logs: `vercel logs`
3. Look for lines starting with `[webhook]`
4. If you see errors, fix them and redeploy
5. Flutterwave will retry the webhook every few hours

---

## Debugging Steps

### Check Vercel Logs

```bash
# View live logs
vercel logs

# Look for webhook logs
vercel logs | grep webhook
```

**What to look for:**
- ✓ `[webhook] ✓ Processing payment for reference:` = webhook reached
- ✓ `[webhook] ✓ Confirmation complete` = payment was processed
- ✗ `[webhook] ERROR:` = something failed (see the error message)
- ✗ `[webhook] Called with method:` missing = webhook never called

### Manual Webhook Test

You can manually test the webhook with curl:

```bash
# Replace YOUR_SECRET_HASH with your FLW_WEBHOOK_HASH
curl -X POST https://rentora.com.ng/api/flutterwave-webhook \
  -H "verif-hash: YOUR_SECRET_HASH" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "tx_ref": "test_reference_12345",
      "status": "successful"
    }
  }'
```

Should return: `{"received":true,"reference":"test_reference_12345","processed":true}`

---

## Full Webhook Configuration Checklist

- [ ] `FLW_WEBHOOK_HASH` set in Vercel env vars
- [ ] `FLW_WEBHOOK_HASH` matches Flutterwave Secret Hash exactly
- [ ] Webhook URL in Flutterwave is: `https://rentora.com.ng/api/flutterwave-webhook`
- [ ] Domain has valid SSL certificate (HTTPS works)
- [ ] Vercel has been redeployed after env var changes
- [ ] Flutterwave test webhook returns 200 OK
- [ ] Vercel logs show `[webhook]` entries when webhook is called

---

## If Still Not Working

1. **Check Vercel logs:** `vercel logs | grep webhook`
2. **Verify environment variables:** Go to Vercel Settings → Environment Variables
3. **Verify Flutterwave webhook URL:** Must be exactly `https://rentora.com.ng/api/flutterwave-webhook`
4. **Verify Secret Hash:** Must match exactly (case-sensitive!)
5. **Test webhook:** Click "Test Webhook" in Flutterwave Dashboard
6. **Redeploy:** `vercel deploy --prod`
7. **Wait and retry:** Flutterwave retries every few minutes

---

## Understanding the Flow

```
1. User completes payment on Flutterwave
   ↓
2. Flutterwave sends webhook to: https://rentora.com.ng/api/flutterwave-webhook
   ↓
3. Webhook handler receives request with:
   - verif-hash header (validates it matches FLW_WEBHOOK_HASH)
   - Payload with transaction reference
   ↓
4. Webhook calls confirm-payment.js with the reference
   ↓
5. confirm-payment.js:
   - Verifies payment status with Flutterwave
   - Updates database to "completed"
   - Sends notification emails
   ↓
6. User sees "completed" status in dashboard
```

If any step fails, webhook delivery shows as unsuccessful, and user sees "pending" status.

---

## Contact Support

If you've verified everything above and it's still not working:
1. Check Vercel logs with: `vercel logs`
2. Check Flutterwave webhook delivery history
3. Contact Flutterwave support with:
   - Your webhook URL
   - Your project domain
   - Flutterwave ticket from "Unsuccessful Webhook Delivery" email
