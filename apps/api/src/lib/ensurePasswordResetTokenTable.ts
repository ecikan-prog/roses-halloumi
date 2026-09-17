/**
 * SAFE, NON-DESTRUCTIVE self-heal for the `PasswordResetToken` table.
 *
 * Background: this project pushes schema changes with `prisma db push`
 * rather than tracked migrations, and production deploys only run `prisma
 * generate` (see `apps/api/package.json` `build` script) — `db push` is
 * never re-run automatically against the live database (see
 * `ensureOrderNumberColumn.ts` for the original, more detailed explanation
 * of this pattern). That means adding a brand new model to `schema.prisma`
 * is not enough on its own for production: the table must also be created
 * there, or every customer "forgot password" request will fail with a
 * Prisma error such as "The table `railway.PasswordResetToken` does not
 * exist in the current database."
 *
 * This check is idempotent (`CREATE TABLE IF NOT EXISTS`) and only ever
 * creates this one table if it is missing — it never touches any other
 * table or any existing data. Called once at API startup (see
 * `server.ts`), same as `ensureOrderSchema`.
 */
import type { PrismaClient } from '@prisma/client';

async function tableExists(prisma: PrismaClient, table: string) {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS count
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = ${table}
  `;
  return Number(rows[0]?.count ?? 0) > 0;
}

export async function ensurePasswordResetTokenTable(prisma: PrismaClient, log: (message: string) => void = console.log) {
  try {
    const hasTable = await tableExists(prisma, 'PasswordResetToken');

    if (hasTable) {
      log('[ensure-password-reset-token-table] Verified: PasswordResetToken table is present.');
      return;
    }

    log('[ensure-password-reset-token-table] Table PasswordResetToken is missing. Creating it now...');

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`PasswordResetToken\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`customerId\` INT NOT NULL,
        \`tokenHash\` VARCHAR(191) NOT NULL,
        \`expiresAt\` DATETIME(3) NOT NULL,
        \`usedAt\` DATETIME(3) NULL,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`PasswordResetToken_tokenHash_key\` (\`tokenHash\`),
        INDEX \`PasswordResetToken_customerId_idx\` (\`customerId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    log('[ensure-password-reset-token-table] Created table PasswordResetToken.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(
      `[ensure-password-reset-token-table] FAILED to verify/create PasswordResetToken table: ${message}. ` +
        'Customer "forgot password" requests may fail until this is resolved.',
    );
  }
}
