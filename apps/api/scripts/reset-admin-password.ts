/**
 * One-off, production-safe maintenance script to reset the password of the
 * existing ADMIN staff account identified by email (e.g. info@grasslandcheese.com)
 * WITHOUT creating a duplicate account, without touching customer accounts/auth,
 * and without exposing/printing the new password, its hash, or any derived value.
 *
 * This intentionally does NOT touch the Customer table or customer authentication,
 * and does NOT change id, name, email, or role. It updates ONLY passwordHash on
 * the single matching StaffUser row, using the existing bcrypt hashing helper
 * (hashPassword from src/lib/auth.ts).
 *
 * Usage (run once, review the output before confirming in your terminal):
 *
 *   ADMIN_EMAIL=info@grasslandcheese.com \
 *   ADMIN_NEW_PASSWORD='replace-with-a-strong-password' \
 *   npm run reset-admin-password --workspace @dairy-sales/api
 *
 * To run this against the production database via Railway:
 *
 *   railway run --service <api-service-name> \
 *     ADMIN_EMAIL=info@grasslandcheese.com \
 *     ADMIN_NEW_PASSWORD='replace-with-a-strong-password' \
 *     npm run reset-admin-password --workspace @dairy-sales/api
 *
 * (Railway injects the production DATABASE_URL into the process.)
 */
import { PrismaClient, StaffRole } from '@prisma/client';
import { hashPassword } from '../src/lib/auth.js';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const newPassword = process.env.ADMIN_NEW_PASSWORD;

  if (!email) {
    throw new Error('ADMIN_EMAIL environment variable is required.');
  }

  if (!newPassword) {
    throw new Error('ADMIN_NEW_PASSWORD environment variable is required.');
  }

  if (newPassword.length < 8) {
    throw new Error('ADMIN_NEW_PASSWORD must be at least 8 characters.');
  }

  // 1. Pre-checks (read-only).
  const existingAdmin = await prisma.staffUser.findUnique({ where: { email } });

  if (!existingAdmin) {
    throw new Error(`No StaffUser found with email "${email}". Aborting without changes.`);
  }

  if (existingAdmin.role !== StaffRole.ADMIN) {
    throw new Error(
      `StaffUser "${email}" has role "${existingAdmin.role}", not "${StaffRole.ADMIN}". Aborting without changes.`,
    );
  }

  // 2. The actual change: a single-row update by id, updating ONLY passwordHash.
  // id, name, email, and role are preserved exactly as they were.
  const newPasswordHash = await hashPassword(newPassword);
  const updated = await prisma.staffUser.update({
    where: { id: existingAdmin.id },
    data: {
      passwordHash: newPasswordHash,
    },
  });

  // 3. Post-change verification (never print passwordHash, newPassword, or any
  // value derived from either).
  console.log('Admin password reset successfully.');
  console.log(
    JSON.stringify(
      {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
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
