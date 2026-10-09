/**
 * SAFE, NON-DESTRUCTIVE self-heal for the `Customer.deletedAt` column.
 *
 * Background: this project pushes schema changes with `prisma db push`
 * rather than tracked migrations, and production deploys only run `prisma
 * generate` (see `apps/api/package.json` `build` script) — `db push` is
 * never re-run automatically against the live database (see
 * `ensureOrderNumberColumn.ts` for the original, more detailed explanation
 * of this pattern, and `ensurePasswordResetTokenTable.ts` for the same
 * pattern applied to a whole table). That means adding a new column to
 * `schema.prisma` is not enough on its own for production: the column must
 * also exist there, or every query that touches it (admin "Delete customer",
 * customer login) will fail with a Prisma error such as "The column
 * `railway.Customer.deletedAt` does not exist in the current database."
 *
 * This check is idempotent and only ever ADDS the single missing
 * `deletedAt` column — it never drops or alters any other column, never
 * touches any other table, and never modifies existing data. Called once at
 * API startup (see `server.ts`), same as `ensureOrderSchema` and
 * `ensurePasswordResetTokenTable`.
 */
import type { PrismaClient } from '@prisma/client';

async function columnExists(prisma: PrismaClient, table: string, column: string) {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS count
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = ${table}
      AND column_name = ${column}
  `;
  return Number(rows[0]?.count ?? 0) > 0;
}

export async function ensureCustomerDeletedAtColumn(
  prisma: PrismaClient,
  log: (message: string) => void = console.log,
) {
  try {
    const hasColumn = await columnExists(prisma, 'Customer', 'deletedAt');

    if (hasColumn) {
      log('[ensure-customer-deleted-at-column] Verified: Customer.deletedAt column is present.');
      return;
    }

    log('[ensure-customer-deleted-at-column] Column Customer.deletedAt is missing. Adding it now...');

    await prisma.$executeRawUnsafe(`
      ALTER TABLE \`Customer\`
      ADD COLUMN \`deletedAt\` DATETIME(3) NULL;
    `);

    log('[ensure-customer-deleted-at-column] Added column Customer.deletedAt.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(
      `[ensure-customer-deleted-at-column] FAILED to verify/add Customer.deletedAt column: ${message}. ` +
        'Admin "Delete customer" and customer login checks may fail until this is resolved.',
    );
  }
}
