# Production Deployment Guide: WholesaleApplication Database Migration

## Overview

This guide explains how to deploy the WholesaleApplication table migration to production. The fix involves:
1. Applying the database migration
2. Handling the case where production was built with `prisma db push` (no migration history)
3. Setting required environment variables
4. Verifying the deployment
5. Rolling back if needed

---

## Pre-Deployment Checklist

Before deploying to production, verify:

- [ ] You have access to the Railway production dashboard
- [ ] You have access to the production database (or can view its status)
- [ ] You have the BREVO API key ready
- [ ] You know the production admin email address
- [ ] You have reviewed the [Verification Steps](#verification-steps) section

---

## Part 1: Code Deployment (Railway Dashboard)

### Step 1: Deploy the PR

1. Go to your GitHub repository
2. Merge this PR to your production branch (typically `main`)
3. Railway will automatically detect the change and trigger a build

### Step 2: Wait for Deployment

Monitor the Railway deployment:
1. Go to your Railway project dashboard
2. Click on the **apps/api** service
3. Click the **Deployments** tab
4. Wait for the new deployment to complete (status should be ✅ Success)

**Expected behavior:**
- Build phase completes
- Deploy phase runs: `prisma migrate deploy` (creates the table)
- Start phase runs: migrations applied + API starts
- Health check: `/health` returns `{"status": "ok"}`

**If deployment fails:**
- Click the failed deployment to view logs
- Look for errors in the "Deploy" or "Start" phase
- See [Troubleshooting](#troubleshooting) section

---

## Part 2: Handling Production Baseline (If Needed)

### Does your production database need baseline?

If your production database was:
1. Created with `prisma db push` (instead of `prisma migrate deploy`), **OR**
2. Provisioned manually without migration history

Then you need to baseline before applying new migrations.

### Check if baseline is needed

Run this SQL query on your production database:

```sql
SELECT COUNT(*) as migration_count FROM _prisma_migrations;
```

**Results:**
- If `0` → Your database has **no migration history** (needs baseline)
- If `> 0` → Your database has migration history (baseline not needed, proceed to Part 3)

### Baseline your production database (iPad/Dashboard Only)

⚠️ **Only run this if the query above returned 0**

1. Go to your database provider (e.g., Railway, AWS RDS, Google Cloud SQL)
2. Open the SQL console / query editor
3. Run these commands in order:

```sql
-- Step 1: Create migration history table
CREATE TABLE `_prisma_migrations` (
  `id` VARCHAR(36) PRIMARY KEY,
  `checksum` VARCHAR(64) NOT NULL,
  `finished_at` DATETIME(3),
  `migration_name` VARCHAR(255) NOT NULL,
  `logs` LONGTEXT,
  `rolled_back_at` DATETIME(3),
  `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `applied_steps_count` INTEGER NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 2: Mark the initial migration as applied
-- (This prevents migration "1790277758_add_wholesale_application" from running twice)
-- NOTE: Run this command ONLY if WholesaleApplication table DOES NOT exist yet
INSERT INTO `_prisma_migrations` (
  `id`,
  `checksum`,
  `finished_at`,
  `migration_name`,
  `started_at`,
  `applied_steps_count`
) VALUES (
  '12345678901234567890123456789012',
  'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
  CURRENT_TIMESTAMP(3),
  '1790277758_add_wholesale_application',
  CURRENT_TIMESTAMP(3),
  1
);
```

**After baseline:**
- Your database now has migration history
- The migration will be marked as "applied" but the table will actually be created by the deploy
- The next deployment will create the WholesaleApplication table

---

## Part 3: Set Environment Variables

1. Go to your Railway project dashboard
2. Click on the **apps/api** service
3. Click the **Variables** tab
4. Add/verify these environment variables:

### Required

```
BREVO_API_KEY=sk_live_...
```

**Where to get it:**
1. Go to [Brevo Settings → API Keys](https://app.brevo.com/settings/keys/api)
2. Copy your live API key (starts with `sk_live_`)
3. Paste into Railway as `BREVO_API_KEY`

### Recommended

```
ADMIN_EMAIL=admin@grasslandcheese.com
MAIL_FROM=Grassland Cheese <info@grasslandcheese.com>
```

**MAIL_FROM requirements:**
- The sender domain (e.g., `grasslandcheese.com`) must be verified in Brevo
- To verify: Brevo → Settings → Sender Identities → Verify domain

### Optional

```
DATABASE_URL=...
```

**Note:** This should already be set. Verify it points to your production database.

---

## Part 4: Verify Deployment

### 4.1: Verify the Table Exists

Run this SQL query on your production database:

```sql
SELECT COUNT(*) as row_count FROM WholesaleApplication;
```

**Expected result:** `0` (the table exists but has no rows yet)

**If table doesn't exist:** Your deployment failed - see [Troubleshooting](#troubleshooting)

### 4.2: Check API Health

Call the API health endpoint:

```
GET https://your-api-domain.com/health
```

**Expected response:**
```json
{"status": "ok"}
```

### 4.3: Verify Email Configuration

Call the wholesale email check endpoint:

```
POST https://your-api-domain.com/trpc/wholesale.checkEmailConfig
```

**Expected response (if configured correctly):**
```json
{
  "configured": [
    "ADMIN_EMAIL=admin@grasslandcheese.com",
    "BREVO_API_KEY=****(configured)",
    "MAIL_FROM=(using default)"
  ],
  "missing": [],
  "readyToSend": true,
  "summary": "Email is configured and ready."
}
```

**If variables are missing:**
- Go back to Part 3
- Add the missing variables
- Wait 30 seconds for Railway to pick up the changes
- Restart the service: Railway → apps/api → Restart

### 4.4: Test Email Sending

Call the test email endpoint:

```
POST https://your-api-domain.com/trpc/wholesale.sendTestEmail
Content-Type: application/json

{"to": "your-email@example.com"}
```

**Expected response:**
```json
{"ok": true, "message": "Test email sent to your-email@example.com"}
```

**Check your email:**
- Look in your inbox (may take 1-2 minutes)
- Check spam folder if not found
- If it doesn't arrive, check the Railway logs for Brevo errors

### 4.5: Test Full Application Submission

1. Go to your website's wholesale application form
2. Fill in the form with test data:
   - Business name: TEST BUSINESS
   - Business type: **CAFÉ** (with accent - this is the key test!)
   - Contact name: Test Admin
   - Email: admin-test@example.com
   - Phone: 0201234567
   - Address: 123 Test Street, Auckland

3. Click Submit

**Expected results:**

**In the UI:**
- ✅ Success message: "Thanks — your wholesale application has been received..."
- ✅ No error banner

**In the database:**
```sql
SELECT id, businessName, businessType, email, status, createdAt 
FROM WholesaleApplication 
ORDER BY createdAt DESC LIMIT 1;
```

Expected: One row with your test data, `businessType = 'CAFÉ'`, `status = 'PENDING'`

**In Railway logs:**
```
[wholesale] Validation passed. businessType="CAFÉ", nzbn="N/A"
[wholesale] Stage: save application - SUCCESS. applicationId=1
[wholesale] Stage: send admin email - SUCCESS for applicationId=1. to="admin@example.com"
[wholesale] Stage: send customer email - SUCCESS for applicationId=1. to="admin-test@example.com"
```

**If something failed:** See [Troubleshooting](#troubleshooting)

---

## Troubleshooting

### Issue: "Unknown table 'WholesaleApplication'"

**Error in Railway logs:**
```
PrismaClientKnownRequestError: Invalid `prisma.wholesaleApplication.create()` invocation:
The table `WholesaleApplication` does not exist
```

**Causes:**
1. Migration didn't run during deployment
2. Database baseline was needed but not done (see Part 2)

**Fix:**
1. Check if your database needed baseline (run the query in Part 2)
2. If baseline is needed, do it now
3. Trigger a redeployment:
   - Make a small code change (e.g., add a comment)
   - Push to your production branch
   - Wait for Railway to rebuild and deploy

### Issue: BREVO_API_KEY not configured

**Error in Railway logs:**
```
[mailer] Brevo API key is not configured (missing BREVO_API_KEY)
[wholesale] Stage: send admin email - SKIPPED. BREVO_API_KEY not configured
```

**Fix:**
1. Go to Railway → apps/api → Variables
2. Add `BREVO_API_KEY=sk_live_...` (get from Brevo dashboard)
3. Restart the service: Railway → apps/api → Restart

### Issue: Admin not receiving emails

**Error in Railway logs:**
```
[wholesale] Stage: send admin email - SKIPPED. ADMIN_EMAIL is not configured
```

**Fix:**
1. Go to Railway → apps/api → Variables
2. Add `ADMIN_EMAIL=your-admin-email@grasslandcheese.com`
3. Restart the service: Railway → apps/api → Restart

### Issue: Email domain not verified in Brevo

**Error in Railway logs:**
```
[mailer] Failed to send "..." to ...: Sender email address not verified. Please verify your sender identity first.
```

**Fix:**
1. Log into Brevo dashboard
2. Go to Settings → Sender Identities
3. Find the sender domain (from your MAIL_FROM variable)
4. Click to verify (follow Brevo's DNS verification process)
5. Wait for verification to complete (usually instant)
6. Retry the email test

### Issue: businessType field error

**Error in Railway logs or UI:**
```
Invalid enum value. Expected one of: CAFÉ, RESTAURANT, DELI, RETAILER, DISTRIBUTOR, OTHER
```

**Cause:** Form sent a different value

**Fix:** 
- The schema accepts exactly: `CAFÉ`, `RESTAURANT`, `DELI`, `RETAILER`, `DISTRIBUTOR`, `OTHER`
- Check that the form sends these exact values with correct capitalization
- If users enter lowercase, the form should convert to uppercase

---

## Part 5: Rollback (If Needed)

### When to rollback

Rollback if:
1. The table exists but applications can't be saved (database permission issue)
2. Email sending is completely broken and can't be fixed
3. Something else breaks the wholesale flow

### How to rollback

⚠️ **Note:** You can revert the code, but the database table will remain.

### Option A: Revert to Previous Code (Recommended)

1. Go to GitHub
2. Create a revert PR: `git revert <commit-hash>`
3. Merge the revert PR to production
4. Railway will automatically redeploy with the old code

**After revert:**
- The table still exists in production (this is fine)
- Old code won't try to use it
- You can re-deploy the fix later without rebaselining

### Option B: Delete the WholesaleApplication Table (Nuclear Option)

⚠️ **Only do this if you're sure you don't want to keep the table**

1. Go to your database provider SQL console
2. Run:
```sql
DROP TABLE IF EXISTS `WholesaleApplication`;
```

3. Also delete from migration history:
```sql
DELETE FROM `_prisma_migrations` 
WHERE `migration_name` = '1790277758_add_wholesale_application';
```

4. Revert the code (Option A above)

---

## Quick Reference: One-Command Test

If you want to test everything at once, run these curl commands in order:

```bash
# 1. Check health
curl https://your-api-domain.com/health

# 2. Check email config
curl -X POST https://your-api-domain.com/trpc/wholesale.checkEmailConfig \
  -H "Content-Type: application/json" \
  -d '{}'

# 3. Send test email
curl -X POST https://your-api-domain.com/trpc/wholesale.sendTestEmail \
  -H "Content-Type: application/json" \
  -d '{"to": "your-email@example.com"}'

# 4. Submit test application
curl -X POST https://your-api-domain.com/trpc/wholesale.submitApplication \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Test Business",
    "businessType": "CAFÉ",
    "contactName": "Test Admin",
    "email": "test@example.com",
    "phone": "0201234567",
    "deliveryAddress": "123 Test Street",
    "estimatedVolume": "100kg/week",
    "productsOfInterest": "Halloumi",
    "message": "Test submission"
  }'

# 5. Check database
# Run in your database console:
# SELECT * FROM WholesaleApplication ORDER BY createdAt DESC LIMIT 1;
```

---

## What Changed

### Code Changes

1. **apps/api/nixpacks.toml**
   - Updated start command to run `prisma migrate deploy` before starting the API
   - This ensures migrations are applied even if deploy phase fails
   - Ensures prisma CLI stays in the final Docker image

2. **apps/api/src/router/wholesale.ts**
   - Already has staged error handling (4 try/catch blocks)
   - Each stage logs its status separately
   - Email failures don't block database saves

3. **apps/api/src/lib/mailer.ts**
   - Already has replyTo support for admin emails

### Database Changes

1. **WholesaleApplication table**
   - Columns: id, businessName, businessType (VARCHAR, accepts "CAFÉ"), nzbn, contactName, email, phone, deliveryAddress, estimatedVolume, productsOfInterest, message, status (enum), customerId, timestamps
   - Indexes on email, status, customerId

### No Breaking Changes

- All changes are backward compatible
- Existing orders, customers, and products are unaffected
- Can be safely redeployed multiple times

---

## Support

If something goes wrong:

1. **Check Railway logs:** Railway → apps/api → Logs tab
2. **Run health checks:** Call the endpoints in [Part 4](#part-4-verify-deployment)
3. **Check environment variables:** Railway → apps/api → Variables tab
4. **Check database:** Query `_prisma_migrations` to see what's been applied

If still stuck: Check the Rails logs for the exact error message and search for it in this guide or contact support with the error details.

---

## Migration Details

**Migration file:** `apps/api/prisma/migrations/1790277758_add_wholesale_application/migration.sql`

**What it does:**
- Creates WholesaleApplication table
- Creates indexes for email, status, and customerId
- Adds foreign key to Customer table

**What it doesn't do:**
- Doesn't modify existing tables
- Doesn't drop any tables
- Doesn't delete any data
- Fully reversible (can drop the table if needed)

---

## Timeline

```
T=0min:  Merge PR to production
T=1min:  Railway starts build
T=5min:  Build complete, deploy phase runs (migrations applied)
T=6min:  Start phase runs (migrations applied again as backup, API starts)
T=7min:  Check health endpoint
T=8min:  Check email config
T=9min:  Send test email
T=10min: Submit test application
T=12min: Verify in database
T=15min: All done!
```

Total time: ~15 minutes assuming no issues.
