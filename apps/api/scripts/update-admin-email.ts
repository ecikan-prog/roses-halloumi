/**
 * One-off, production-safe maintenance script to change the email address of an
 * existing ADMIN staff account (e.g. admin@dairysales.local -> info@grasslandcheese.com)
 * WITHOUT creating a duplicate account, without touching customer accounts/auth,
 * and without exposing/printing any password hash.
 *
 * This intentionally does NOT touch the Customer table or customer authentication,
 * and does NOT change role, id, or passwordHash unless a new password is explicitly
 * provided via ADMIN_NEW_PASSWORD.
 *
 * Usage (run once, review the output before confirming in your terminal):
 *
 *   ADMIN_CURRENT_EMAIL=admin@dairysales.local \
 *   ADMIN_NEW_EMAIL=info@grasslandcheese.com \
 *   npm run update-admin-email --workspace @dairy-sales/api
 *
 * Optional: rotate the password at the same time (never printed/logged):
 *
 *   ADMIN_CURRENT_EMAIL=admin@dairysales.local \
 *   ADMIN_NEW_EMAIL=info@grasslandcheese.com \
 *   ADMIN_NEW_PASSWORD='replace-with-a-strong-password' \
 *   npm run update-admin-email --workspace @dairy-sales/api
 *
 * To run this against the production database via Railway:
 *
 *   railway run --service <api-service-name> \
 *     npm run update-admin-email --workspace @dairy-sales/api
 *
 * (Railway injects the production DATABASE_URL into the process; pass
 * ADMIN_CURRENT_EMAIL/ADMIN_NEW_EMAIL/ADMIN_NEW_PASSWORD as additional
 * environment variables on that same command.)
 */
import { PrismaClient, StaffRole } from '@prisma/client';
import { hashPassword } from '../src/lib/auth.js';

const prisma = new PrismaClient();

async function main() {
  const currentEmail = process.env.ADMIN_CURRENT_EMAIL;
  const newEmail = process.env.ADMIN_NEW_EMAIL;
  const newPassword = process.env.ADMIN_NEW_PASSWORD;

  if (!currentEmail || !newEmail) {
    throw new Error('Both ADMIN_CURRENT_EMAIL and ADMIN_NEW_EMAIL environment variables are required.');
  }

  if (currentEmail === newEmail) {
    throw new Error('ADMIN_CURRENT_EMAIL and ADMIN_NEW_EMAIL must be different.');
  }

  if (newPassword && newPassword.length < 8) {
    throw new Error('ADMIN_NEW_PASSWORD must be at least 8 characters.');
  }

  // 1. Pre-checks (read-only).
  const existingAdmin = await prisma.staffUser.findUnique({ where: { email: currentEmail } });

  if (!existingAdmin) {
    throw new Error(`No StaffUser found with email "${currentEmail}". Aborting without changes.`);
  }

  if (existingAdmin.role !== StaffRole.ADMIN) {
    throw new Error(
      `StaffUser "${currentEmail}" has role "${existingAdmin.role}", not "${StaffRole.ADMIN}". Aborting without changes.`,
    );
  }

  const conflictingStaff = await prisma.staffUser.findUnique({ where: { email: newEmail } });

  if (conflictingStaff) {
    throw new Error(
      `A StaffUser already exists with email "${newEmail}" (id ${conflictingStaff.id}). Aborting to avoid creating a duplicate admin account.`,
    );
  }

  const conflictingCustomer = await prisma.customer.findUnique({ where: { email: newEmail } });

  if (conflictingCustomer) {
    throw new Error(
      `A Customer already exists with email "${newEmail}" (id ${conflictingCustomer.id}). Aborting to avoid a login collision with customer accounts.`,
    );
  }

  // 2. The actual change: a single-row update by id, preserving id/role/passwordHash
  // unless a new password was explicitly requested.
  const updated = await prisma.staffUser.update({
    where: { id: existingAdmin.id },
    data: {
      email: newEmail,
      ...(newPassword ? { passwordHash: await hashPassword(newPassword) } : {}),
    },
  });

  // 3. Post-change verification (never print passwordHash).
  console.log('Admin email updated successfully.');
  console.log(
    JSON.stringify(
      {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        passwordRotated: Boolean(newPassword),
        updatedAt: updated.updatedAt,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
