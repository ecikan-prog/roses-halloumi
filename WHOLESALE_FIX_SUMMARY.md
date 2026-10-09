# Wholesale Application Fix - Complete Summary

## What Was Wrong

The wholesale application form was passing validation but showing a generic error banner when submitted. The root issues were:

1. **No Staged Error Handling**: A single try/catch block made it impossible to know what failed (database, email, validation)
2. **Fire-and-Forget Email Sending**: Customer email was sent with `void sendMail()`, so failures were silently ignored
3. **No Email Configuration Validation**: No way to verify email setup without analyzing logs
4. **Missing Reply-To Headers**: Admin couldn't reply directly to applicants

## What Was Fixed

### Code Changes (apps/api/src)

#### 1. `router/wholesale.ts` - Staged Error Handling
- Added separate try/catch blocks for: validate, save application, send admin email, send customer email
- Each stage logs its status with application ID and recipient email
- Database save returns success even if emails fail
- Detailed error logging for debugging

#### 2. `lib/mailer.ts` - Reply-To Support
- Added optional `replyTo` field to MailMessage type
- Updated sendMail() to include replyTo in Brevo API requests
- Admin emails now have applicant's email as reply-to

#### 3. New Admin Endpoints
- **checkEmailConfig**: Returns configured/missing env vars and readiness status
- **sendTestEmail**: Sends test email to verify Brevo API is working

#### 4. Documentation
- Created `WHOLESALE_DEPLOYMENT_GUIDE.md` with complete troubleshooting and deployment instructions

## Database Schema Verification

The migration creates the WholesaleApplication table with:
```sql
-- All required fields present:
✓ id (primary key, auto-increment)
✓ businessName, businessType, nzbn, contactName, email, phone
✓ deliveryAddress, estimatedVolume, productsOfInterest, message
✓ status (enum: PENDING, APPROVED, REJECTED)
✓ customerId (foreign key, soft link to Customer)
✓ createdAt, updatedAt (timestamps)
✓ Indexes on email, status, customerId
```

## Required Environment Variables for Production

### Essential (for email sending)
```bash
BREVO_API_KEY=sk_live_... # Get from https://app.brevo.com/settings/keys/api
```

### Recommended (for admin notifications)
```bash
ADMIN_EMAIL=admin@grasslandcheese.com
```

### Optional (custom sender email)
```bash
MAIL_FROM="Grassland Cheese <info@grasslandcheese.com>" # Must be verified domain in Brevo
```

### Already Required
```bash
DATABASE_URL=<your-production-db>
```

## Production Deployment Checklist

### Step 1: Deploy Code
Push this PR and deploy to production. The build succeeds with no TypeScript errors.

### Step 2: Run Database Migration
Once deployed, SSH into production and run:
```bash
cd apps/api
npx prisma migrate deploy
```

This applies the `1790277758_add_wholesale_application` migration to create the WholesaleApplication table.

### Step 3: Set Environment Variables in Railway
In your Railway production environment, add/verify these env vars:
```bash
BREVO_API_KEY=sk_live_...
ADMIN_EMAIL=your-admin-email@grasslandcheese.com
MAIL_FROM="Grassland Cheese <info@grasslandcheese.com>"
```

### Step 4: Verify Email Configuration
After deployment, call the health check endpoint from admin dashboard:
```
POST /trpc/wholesale.checkEmailConfig

Expected response:
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

### Step 5: Send Test Email
Verify Brevo connectivity:
```
POST /trpc/wholesale.sendTestEmail
{
  "to": "test@example.com"
}

Expected response:
{
  "ok": true,
  "message": "Test email sent to test@example.com"
}
```

### Step 6: Test Full Application Submission
Submit form with test data:
- Business name: GUIDED NZ TOURS & RENTALS
- Business type: CAFÉ
- NZBN: 1234567890987 (or leave blank)
- Contact: Erman Cikan
- Email: erman_elif@yahoo.co.nz
- Phone: 277050258
- Delivery address: 123 Test Street, Auckland

Expected results:
1. ✅ Form validates (13-digit NZBN accepted)
2. ✅ Success message shown: "Thanks — your wholesale application has been received..."
3. ✅ Row created in WholesaleApplication table
4. ✅ Admin email sent to ADMIN_EMAIL
5. ✅ Customer email sent to applicant

### Step 7: Check Server Logs
In Railway logs, you should see:
```
[wholesale] Validation passed. businessType="CAFÉ", nzbn="1234567890987"
[wholesale] Stage: save application - SUCCESS. applicationId=1
[wholesale] Stage: send admin email - SUCCESS for applicationId=1. to="admin@grasslandcheese.com"
[wholesale] Stage: send customer email - SUCCESS for applicationId=1. to="erman_elif@yahoo.co.nz"
```

## Common Issues and Fixes

### Issue: Database table doesn't exist
**Symptom**: "Unknown table 'WholesaleApplication'"
**Fix**: Run `npx prisma migrate deploy` in production

### Issue: Brevo API key not configured
**Symptom**: Emails logged instead of sent, app still saves
**Fix**: Set BREVO_API_KEY in Railway env vars

### Issue: Admin not receiving notifications
**Symptom**: Application saves and customer email sent, but admin email missing
**Fix**: Set ADMIN_EMAIL in Railway env vars

### Issue: Email domain not verified in Brevo
**Symptom**: Brevo API returns "Sender email not verified"
**Fix**: 
1. Log into Brevo dashboard
2. Go to Settings → Sender Identities
3. Verify the sender domain listed in MAIL_FROM

### Issue: businessType field type mismatch
**Status**: NOT AN ISSUE in this code
- Schema defines businessType as VARCHAR (string), not Prisma enum
- Form sends uppercase values (CAFÉ, RESTAURANT, etc.)
- Values are case-sensitive but stored correctly

## Logs to Monitor

After deployment, watch Railway logs for these stages:

**Success Pattern**:
```
[wholesale] Validation passed. businessType="CAFÉ", nzbn="1234567890987"
[wholesale] Stage: save application - SUCCESS. applicationId=N
[wholesale] Stage: send admin email - SUCCESS for applicationId=N. to="admin@grasslandcheese.com"
[wholesale] Stage: send customer email - SUCCESS for applicationId=N. to="erman_elif@yahoo.co.nz"
```

**Failure Patterns**:
```
[wholesale] Stage: save application - FAILED. businessName="...", email="..."
[wholesale] Database error details: <full stack trace>

[wholesale] Stage: send admin email - FAILED for applicationId=N
[mailer] Failed to send "..." to ...: <Brevo error details>

[wholesale] Stage: send customer email - ERROR for applicationId=N
[mailer] Failed to send "..." to ...: <Brevo error details>

[mailer] Brevo API key is not configured (missing BREVO_API_KEY)
[wholesale] Stage: send admin email - SKIPPED. ADMIN_EMAIL is not configured
```

## Data Flow

```
1. Form Submission (Mobile App)
   └─> Validation (Zod schema, client-side)
       └─> API submitApplication (public endpoint)
           ├─ Stage 1: Validate input (logs status)
           ├─ Stage 2: Save to database (MUST SUCCEED for return)
           ├─ Stage 3: Send admin email (logs failure, doesn't block)
           ├─ Stage 4: Send customer email (logs failure, doesn't block)
           └─> Return success + applicationId

2. Admin Flow
   ├─> List applications (getApplications)
   ├─> Review application
   ├─> Approve/Reject (approveApplication)
   │   └─> Creates/updates Customer if approved
   └─> (Optional) Send follow-up email
```

## Files Modified

1. `apps/api/src/router/wholesale.ts` - Complete handler refactor with staged error handling
2. `apps/api/src/lib/mailer.ts` - Added replyTo support to MailMessage type and sendMail()
3. `apps/api/WHOLESALE_DEPLOYMENT_GUIDE.md` - Complete deployment and troubleshooting guide

No mobile/UI changes needed - form already sends correct data.

## Testing Locally

To test locally before production:

1. Set env vars in `.env`:
```bash
BREVO_API_KEY=sk_test_... # Use sandbox key
ADMIN_EMAIL=you@example.com
DATABASE_URL=your_local_db
```

2. Run migration:
```bash
npm run build:api
cd apps/api
npx prisma migrate deploy
```

3. Start the API:
```bash
npm run dev:api
```

4. Call the endpoints (e.g., via Postman or curl):
```bash
# Check config
POST http://localhost:4000/trpc/wholesale.checkEmailConfig

# Send test email
POST http://localhost:4000/trpc/wholesale.sendTestEmail
{"to": "test@example.com"}

# Submit application
POST http://localhost:4000/trpc/wholesale.submitApplication
{
  "businessName": "Test Business",
  "businessType": "CAFÉ",
  "contactName": "Test User",
  "email": "test@example.com",
  "deliveryAddress": "123 Test Street",
  "phone": "0201234567"
}
```

## Summary

**Root Cause**: Monolithic error handling and silent email failures
**Solution**: Staged error handling with detailed logging, independent email operations, and email configuration validation
**Deployment Time**: ~15 minutes (code deploy + migration + env vars)
**Risk Level**: Low (migration is safe, code is backward compatible)
**Requires**: BREVO_API_KEY set in production (ADMIN_EMAIL optional but recommended)
