# Wholesale Application Fix - Quick Start for Production

## The Issue (Fixed ✓)
Wholesale application form submissions showed generic error banner "Sorry, something went wrong..." regardless of actual cause. Real errors were hidden in logs.

## The Root Cause
- Monolithic error handling (single try/catch)
- Silent email failures (fire-and-forget sending)
- No way to verify email configuration
- Missing reply-to headers for admin emails

## What You Need to Do (3 Steps)

### 1. Deploy Code
```bash
# Merge and deploy this PR to production
# No breaking changes - safe to deploy immediately
```

### 2. Set Environment Variables in Railway
Add these to your production environment variables:

**Required:**
```
BREVO_API_KEY=sk_live_...
```
Get from: https://app.brevo.com/settings/keys/api

**Recommended:**
```
ADMIN_EMAIL=admin@grasslandcheese.com
MAIL_FROM=Grassland Cheese <info@grasslandcheese.com>
```

### 3. Run Database Migration (One Time)
```bash
cd apps/api
npx prisma migrate deploy
```
This creates the WholesaleApplication table if it doesn't exist.

## Verify It Works (5 Minutes)

### Step 1: Check Email Configuration
Call the health check endpoint:
```bash
POST /trpc/wholesale.checkEmailConfig
```
Should return: `"readyToSend": true` and no missing vars.

### Step 2: Test Email Sending
```bash
POST /trpc/wholesale.sendTestEmail
{
  "to": "your-email@example.com"
}
```
Check your email (may be in spam folder).

### Step 3: Submit Test Application
Fill form with:
- Business name: GUIDED NZ TOURS & RENTALS
- Business type: CAFÉ
- Contact: Erman Cikan
- Email: erman_elif@yahoo.co.nz
- Phone: 277050258
- Address: Any address

Expected: Success message ✓

### Step 4: Verify in Database
```sql
SELECT id, businessName, status, createdAt FROM WholesaleApplication 
ORDER BY createdAt DESC LIMIT 1;
```
Should show your test submission.

### Step 5: Check Logs
In Railway logs, you should see:
```
[wholesale] Validation passed...
[wholesale] Stage: save application - SUCCESS. applicationId=1
[wholesale] Stage: send admin email - SUCCESS...
[wholesale] Stage: send customer email - SUCCESS...
```

## What's Different Now

### Before (Broken)
```
Form Submit → Single try/catch → Generic Error
Logs: "Error submitting wholesale application: [error details hidden]"
User: Doesn't know what failed
Admin: Doesn't know applications are being submitted
```

### After (Fixed)
```
Form Submit → Staged Error Handling → Success (even if email fails)
Logs: Four stages logged separately with IDs
User: Sees success if app saves
Admin: Gets notification email + can use health check
```

## New Features

### 1. Health Check Endpoint
```bash
POST /trpc/wholesale.checkEmailConfig

Returns:
{
  "configured": ["ADMIN_EMAIL=...", "BREVO_API_KEY=...", "MAIL_FROM=..."],
  "missing": [],
  "readyToSend": true,
  "summary": "Email is configured and ready."
}
```

### 2. Test Email Endpoint
```bash
POST /trpc/wholesale.sendTestEmail
{"to": "test@example.com"}

Returns:
{"ok": true, "message": "Test email sent to test@example.com"}
```

### 3. Staged Logging
Each operation now logs its stage and status:
- `[wholesale] Stage: validate - ...`
- `[wholesale] Stage: save application - ...`
- `[wholesale] Stage: send admin email - ...`
- `[wholesale] Stage: send customer email - ...`

### 4. Reply-To Headers
Admin emails now include applicant's email as reply-to, so admins can reply directly.

## Troubleshooting

| Symptom | Check | Fix |
|---------|-------|-----|
| Generic error banner | Health check returns missing BREVO_API_KEY | Set BREVO_API_KEY in Railway env vars |
| App saves but admin doesn't get email | Health check returns missing ADMIN_EMAIL | Set ADMIN_EMAIL in Railway env vars |
| Test email fails | Check Railway logs | Check Brevo dashboard - sender domain must be verified |
| "Unknown table 'WholesaleApplication'" | Check database | Run `npx prisma migrate deploy` |
| businessType mismatch errors | Check form values | Form sends uppercase (CAFÉ, RESTAURANT, etc.) - schema accepts these |

## Files Changed

1. **apps/api/src/router/wholesale.ts**
   - Staged error handling (4 separate try/catch blocks)
   - Each stage logs with applicationId and recipient email
   - Database save succeeds independently of emails
   - New endpoints: checkEmailConfig, sendTestEmail

2. **apps/api/src/lib/mailer.ts**
   - Added optional `replyTo` field to MailMessage type
   - Updated sendMail() to use replyTo in Brevo API

3. **Documentation**
   - WHOLESALE_DEPLOYMENT_GUIDE.md (comprehensive reference)
   - WHOLESALE_FIX_SUMMARY.md (detailed summary)

## Security & Quality

- ✅ No security vulnerabilities found (CodeQL scan)
- ✅ TypeScript build succeeds with no errors
- ✅ Backward compatible - no breaking changes
- ✅ Follows existing code patterns and logging standards
- ✅ No new dependencies added

## Support

If something fails:

1. Check Railway logs for the specific stage that failed
2. Run health check: `POST /trpc/wholesale.checkEmailConfig`
3. Run test email: `POST /trpc/wholesale.sendTestEmail`
4. Reference WHOLESALE_DEPLOYMENT_GUIDE.md for detailed troubleshooting

## Production Rollout Timeline

```
T=0min:   Deploy code
T=1min:   Restart Railway
T=2min:   Run prisma migrate deploy (creates table)
T=3min:   Set BREVO_API_KEY in Railway env vars
T=5min:   Restart Railway to pick up env vars
T=6min:   Run health check - should pass
T=7min:   Run test email - should succeed
T=8min:   Test form submission
T=10min:  Monitor logs for any errors
T=15min:  Live in production!
```

Total time: ~15 minutes with zero downtime.

## Questions?

This fix includes:
1. Detailed stage-by-stage error logging
2. Health check endpoint to verify configuration
3. Test email endpoint to verify connectivity
4. Complete deployment guide
5. Troubleshooting reference

Everything you need to diagnose and fix any issues is in the logs and health check endpoints.
