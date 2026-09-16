/**
 * SAFE, NON-DESTRUCTIVE self-healing check for the `Order.orderNumber` column.
 *
 * Background: `prisma/schema.prisma` declares `Order.orderNumber` (a nullable,
 * unique String), but this project pushes schema changes with `prisma db
 * push` rather than tracked migrations. If a database was provisioned before
 * `orderNumber` was added to the schema and `db push` was never re-run
 * against it, Prisma Client still generates queries that reference the
 * column, and EVERY query against `Order` (including "Pay in 30" order
 * creation from the checkout "Confirm order" button) fails with an error
 * like:
 *
 *   The column `railway.Order.orderNumber` does not exist in the current
 *   database.
 *
 * This is the concrete, previously-unfixed root cause of "Confirm order"
 * silently failing in production: the order was never actually created
 * because the very first `prisma.order.create(...)` call throws as soon as
 * Prisma tries to read back the (missing) `orderNumber` column.
 *
 * This function is called once at API startup (see `server.ts`) so the fix
 * is applied automatically on every deploy instead of depending on someone
 * remembering to run a one-off script by hand. It is also exported for reuse
 * by the standalone `scripts/ensure-order-number-column.ts` CLI.
 *
 * It:
 *   - Only ever ADDS the `orderNumber` column (and its unique index) to the
 *     `Order` table if they are missing. It never drops or alters any other
 *     column, table, or row.
 *   - Is fully idempotent: running it again when the column/index already
 *     exist is a no-op.
 *   - Backfills `orderNumber` ONLY for existing rows where it is currently
 *     NULL, using the exact same `GC-000123` format the API already
 *     generates for new orders. No existing non-null orderNumber, and no
 *     other order field, is ever touched.
 *   - Never resets, recreates, or drops the database, and never deletes any
 *     order.
 */
import type { PrismaClient } from '@prisma/client';

function buildOrderNumber(id: number) {
  return `GC-${String(id).padStart(6, '0')}`;
}

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

async function indexExists(prisma: PrismaClient, table: string, indexName: string) {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS count
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = ${table}
      AND index_name = ${indexName}
  `;
  return Number(rows[0]?.count ?? 0) > 0;
}

export async function ensureOrderNumberColumn(prisma: PrismaClient, log: (message: string) => void = console.log) {
  const hasColumn = await columnExists(prisma, 'Order', 'orderNumber');

  if (!hasColumn) {
    log('[ensure-order-number-column] Column Order.orderNumber is missing. Adding it now (nullable, non-destructive)...');
    await prisma.$executeRawUnsafe('ALTER TABLE `Order` ADD COLUMN `orderNumber` VARCHAR(191) NULL');
    log('[ensure-order-number-column] Added column Order.orderNumber.');
  }

  const hasUniqueIndex = await indexExists(prisma, 'Order', 'Order_orderNumber_key');

  if (!hasUniqueIndex) {
    log('[ensure-order-number-column] Unique index Order_orderNumber_key is missing. Adding it now...');
    await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX `Order_orderNumber_key` ON `Order` (`orderNumber`)');
    log('[ensure-order-number-column] Added unique index Order_orderNumber_key.');
  }

  const ordersMissingNumber = await prisma.order.findMany({
    where: { orderNumber: null },
    select: { id: true },
  });

  for (const order of ordersMissingNumber) {
    const orderNumber = buildOrderNumber(order.id);
    await prisma.order.update({ where: { id: order.id }, data: { orderNumber } });
  }

  if (ordersMissingNumber.length > 0) {
    log(`[ensure-order-number-column] Backfilled orderNumber for ${ordersMissingNumber.length} existing order(s).`);
  }
}
