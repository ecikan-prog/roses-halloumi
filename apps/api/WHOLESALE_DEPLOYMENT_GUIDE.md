# Wholesale Application Deployment Guide

## Overview

This document explains the wholesale application submission system, common issues, and deployment requirements.

## Root Cause Analysis

The previous implementation had the following issues:

1. **Monolithic Error Handling**: A single try/catch block made it impossible to distinguish between database errors and email sending failures
2. **Silent Email Failures**: Email send operations were fire-and-forget (`void sendMail()`) without result checking
3. **Email Configuration Validation**: No way to verify email configuration without sending actual emails
4. **Missing Reply-To Header**: Admin emails didn't include applicant's email as reply-to address

### What Was Fixed

#### 1. Staged Error Handling with Detailed Logging
The `submitApplication` handler now has separate try/catch blocks for each stage:
- **Stage: validate** - Zod validation (catches schema mismatches early)
- **Stage: save application** - Database save (returns error only if this fails)
- **Stage: send admin email** - Admin notification (logs failure but doesn't block success)
- **Stage: send customer email** - Customer acknowledgement (logs failure but doesn't block success)

Each stage logs:
- Success/failure status
- Application ID
- Recipient email (for email stages)
- Full error details server-side

#### 2. Independent Email Sending
- Database save now completes before sending any emails
- Email failures don't affect the user's success message
- Emails are awaited (not fire-and-forget) so failures are properly captured and logged

#### 3. Email Configuration Validation
Added two new admin endpoints:
- `wholesale.checkEmailConfig` - Returns configured/missing env vars and readiness status
- `wholesale.sendTestEmail` - Sends test email to verify Brevo API is working

#### 4. Reply-To Header
Admin emails now include `replyTo: applicant's email` so admins can reply directly to the applicant.

## Required Environment Variables

For the wholesale application to work in production, you need:

### Required for Email Sending
```bash
BREVO_API_KEY=<your-brevo-api-key>
```
- Get this from https://app.brevo.com/settings/keys/api
- This is the only required variable for basic email sending

### Recommended for Admin Notifications
```bash
ADMIN_EMAIL=<admin-email@grasslandcheese.com>
```
- Where admin notifications about new applications will be sent
- If not set, admin emails are skipped but the application is still saved

### Optional: Custom Sender Email
```bash
MAIL_FROM="Grassland Cheese <info@grasslandcheese.com>"
```
- Overrides the default sender identity for all transactional emails
- Must be an address on a verified/authenticated Brevo domain
- If not set, defaults to `Grassland Cheese <info@grasslandcheese.com>`

## Pre-Deployment Checklist

### 1. Database Migration
Ensure the migration has been applied to your production database:

```bash
cd apps/api
npx prisma migrate deploy
```

This creates the `WholesaleApplication` table with:
- `id` (auto-increment primary key)
- `businessName`, `businessType`, `nzbn`, `contactName`, `email`, `phone`
- `deliveryAddress`, `estimatedVolume`, `productsOfInterest`, `message`
- `status` (enum: PENDING, APPROVED, REJECTED)
- `customerId` (foreign key to Customer)
- `createdAt`, `updatedAt` timestamps
- Indexes on `email`, `status`, `customerId`

### 2. Environment Variables
Set in your Railway production environment or `.env` file:

```bash
# Essential
DATABASE_URL=<your-database-url>
BREVO_API_KEY=<your-brevo-api-key>

# Recommended
ADMIN_EMAIL=admin@grasslandcheese.com
MAIL_FROM="Grassland Cheese <info@grasslandcheese.com>"

# Optional (for lost password links in emails)
APP_BASE_URL=https://shop.grasslandcheese.com
```

### 3. Brevo Email Provider Setup
1. Create account at https://app.brevo.com
2. Navigate to Settings → Keys & tokens → REST API v3
3. Copy your API key to `BREVO_API_KEY`
4. Verify your sender domain in Brevo account settings
5. Ensure sender email is on the verified domain

### 4. Email Template Verification
The system uses two email templates:
- **Admin Email**: Lists all application details with Reply-To set to applicant's email
- **Customer Email**: Thank you message acknowledging receipt of application

Both templates are styled HTML emails with plain text fallbacks.

## Testing in Production

### 1. Health Check
Before deployment or after changes, verify email configuration:

```bash
# In the admin dashboard or via API:
trpc.wholesale.checkEmailConfig()
```

This returns:
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

### 2. Test Email Send
Send a test email to verify Brevo connectivity:

```bash
trpc.wholesale.sendTestEmail({ to: "test@example.com" })
```

This will:
- Send a test email via Brevo API
- Return success/failure status
- Log full error details if it fails

### 3. Full Application Test
Submit a test wholesale application with:
- Business name: GUIDED NZ TOURS & RENTALS
- Business type: CAFÉ
- NZBN: 1234567890987
- Contact: Erman Cikan
- Email: erman_elif@yahoo.co.nz
- Phone: 277050258
- Delivery address: Any address

Expected result:
1. ✅ Form validates (NZBN accepted as 13 digits)
2. ✅ Success message displayed: "Thanks — your wholesale application has been received..."
3. ✅ Application row created in database
4. ✅ Admin notification email sent to ADMIN_EMAIL
5. ✅ Customer acknowledgement email sent to applicant's email
6. ✅ Server logs show each stage with SUCCESS status

### 4. Check Server Logs
After submission, check Railway logs for output like:

```
[wholesale] Validation passed. businessType="CAFÉ", nzbn="1234567890987"
[wholesale] Stage: save application - SUCCESS. applicationId=1
[wholesale] Stage: send admin email - SUCCESS for applicationId=1. to="admin@grasslandcheese.com"
[wholesale] Stage: send customer email - SUCCESS for applicationId=1. to="erman_elif@yahoo.co.nz"
```

## Troubleshooting

### Symptom: Generic error banner "Sorry, something went wrong..."

**Check 1: Database Connectivity**
```bash
# Verify table exists:
mysql> SELECT * FROM WholesaleApplication LIMIT 1;
# If table doesn't exist, run: npx prisma migrate deploy
```

**Check 2: Application Data Type Mismatch**
- businessType should be stored as a string (e.g., "CAFÉ")
- The schema accepts: CAFÉ, RESTAURANT, DELI, RETAILER, DISTRIBUTOR, OTHER
- These values are case-sensitive

**Check 3: Email Configuration**
Run health check:
```bash
trpc.wholesale.checkEmailConfig()
```

Should show no missing vars and `readyToSend: true`.

### Symptom: Admin/Customer Email Not Received

**Check 1: Verify Email Configuration**
```bash
BREVO_API_KEY=<value>
ADMIN_EMAIL=<value> # for admin email
MAIL_FROM="Name <email@domain>" # must be on verified domain
```

**Check 2: Sender Domain Verification**
- Log into Brevo dashboard
- Go to Settings → Sender Identities
- Verify the sender domain is marked as "verified"

**Check 3: Test Email Send**
```bash
trpc.wholesale.sendTestEmail({ to: "test@your-domain.com" })
```

**Check 4: Check Server Logs**
Look for messages like:
```
[mailer] Failed to send "..." to ...: <error details>
[wholesale] Stage: send admin email - FAILED
[wholesale] Stage: send customer email - FAILED
```

### Symptom: "BREVO_API_KEY is not configured"

The system falls back to logging emails instead of sending them:
```
[mailer] Brevo API key is not configured (missing BREVO_API_KEY). Emails will be logged instead of sent.
[mailer] Brevo API not configured, skipping send. Would have sent "..." to ...
```

**Fix**: Set the `BREVO_API_KEY` environment variable in production.

### Symptom: "ADMIN_EMAIL is not configured"

This is a warning, not an error. Admin notifications are skipped but applications are still saved.

**Status**: Application saves and customer email is sent, but admin doesn't get notified.

**Fix**: Set the `ADMIN_EMAIL` environment variable to receive notifications.

## Admin Operations

### View Applications
In admin dashboard, `wholesale.getApplications` returns all submitted applications with:
- All form data (business name, type, NZBN, contact, email, phone, address, etc.)
- Status (PENDING, APPROVED, REJECTED)
- Linked customer (if approved)
- Created/updated timestamps

### Approve Application
`wholesale.approveApplication({ applicationId, status: 'APPROVED' })` will:
1. Update application status to APPROVED
2. Create a new Customer account if one doesn't exist
3. Set customer type to WHOLESALE
4. Link the application to the customer

Admin should then:
1. Set a password for the new customer (or send password reset email)
2. Configure wholesale pricing tier
3. Set minimum order requirements if any

### Reject Application
`wholesale.approveApplication({ applicationId, status: 'REJECTED' })` will:
1. Update application status to REJECTED
2. Does NOT delete or modify any customer data

Consider sending a follow-up email to the applicant explaining the rejection.

## Database Schema

```sql
CREATE TABLE `WholesaleApplication` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `businessName` VARCHAR(191) NOT NULL,
    `businessType` VARCHAR(191) NOT NULL,         -- String, not enum
    `nzbn` VARCHAR(191),                          -- Optional, 13 digits
    `contactName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191),
    `deliveryAddress` TEXT NOT NULL,
    `estimatedVolume` VARCHAR(191),               -- Free text, e.g., "100kg/week"
    `productsOfInterest` VARCHAR(191),
    `message` TEXT,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `customerId` INTEGER,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    
    INDEX `WholesaleApplication_email_idx`(`email`),
    INDEX `WholesaleApplication_status_idx`(`status`),
    INDEX `WholesaleApplication_customerId_idx`(`customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## Logs to Monitor

### Normal Operation
```
[wholesale] Validation passed. businessType="...", nzbn="..."
[wholesale] Stage: save application - SUCCESS. applicationId=N
[wholesale] Stage: send admin email - SUCCESS for applicationId=N. to="..."
[wholesale] Stage: send customer email - SUCCESS for applicationId=N. to="..."
```

### Email Configuration Issues
```
[mailer] Brevo API key is not configured (missing BREVO_API_KEY)
[mailer] Failed to send "..." to ...: <error from Brevo API>
[wholesale] Stage: send admin email - FAILED for applicationId=N
[wholesale] Stage: send customer email - ERROR for applicationId=N
```

### Database Issues
```
[wholesale] Stage: save application - FAILED. businessName="...", email="..."
[wholesale] Database error details: <full error stack>
```

### Missing Configuration
```
[wholesale] Stage: send admin email - SKIPPED. ADMIN_EMAIL is not configured
```

## Summary: What to Do in Production

### Before Deploying:
1. Set `BREVO_API_KEY` in Railway environment variables
2. Set `ADMIN_EMAIL` in Railway environment variables (optional but recommended)
3. Optionally set `MAIL_FROM` if using a custom sender domain
4. Run `npx prisma migrate deploy` once (handles migration automatically in Railway)

### After Deploying:
1. Use admin endpoint to check email configuration: `wholesale.checkEmailConfig()`
2. Send a test email: `wholesale.sendTestEmail({ to: "your-email@example.com" })`
3. Submit a test application through the form
4. Verify application is saved in database
5. Verify emails are received (check spam folder if not in inbox)

### If Something Breaks:
1. Check Railway logs for stage-specific error messages
2. Run `checkEmailConfig()` to verify all env vars are set
3. Run `sendTestEmail()` to verify Brevo connectivity
4. Check that Brevo sender domain is verified in Brevo dashboard
5. Check database has the WholesaleApplication table with all required columns

## Contact

For issues or questions about the wholesale system:
1. Check this guide for your specific symptom
2. Review Railway production logs for detailed error messages
3. Contact the development team with the application ID and exact error log
