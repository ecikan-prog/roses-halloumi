/**
 * SAFE, NON-DESTRUCTIVE production fix for the missing `Order.orderNumber`
 * column.
 *
 * Background: `prisma/schema.prisma` declares `Order.orderNumber` (a nullable,
 * unique String), but this project pushes schema changes with `prisma db
 * push` rather than tracked migrations. If a database was provisioned before
 * `orderNumber` was added to the schema and `db push` was never re-run
 * against it, Prisma Client still generates queries that reference the
 * column, and every query against `Order` (including "Pay in 30" order
 * creation) fails with an error like:
 *
 *   The column `railway.Order.orderNumber` does not exist in the current
 *   database.
 *
 * This script:
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
 *
 * Usage (local):
 *   npm run ensure-order-number-column --workspace @dairy-sales/api
 *
 * Usage (against production, via Railway):
 *   railway run --service <api-service-name> \
 *     npm run ensure-order-number-column --workspace @dairy-sales/api
 *
 * (Railway injects the production DATABASE_URL into the process; this script
 * never prints DATABASE_URL, credentials, or any other secret.)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function buildOrderNumber(id: number) {
  return `GC-${String(id).padStart(6, '0')}`;
}

async function columnExists(table: string, column: string) {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS count
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = ${table}
      AND column_name = ${column}
  `;
  return Number(rows[0]?.count ?? 0) > 0;
}

async function indexExists(table: string, indexName: string) {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS count
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = ${table}
      AND index_name = ${indexName}
  `;
  return Number(rows[0]?.count ?? 0) > 0;
}

async function main() {
  const hasColumn = await columnExists('Order', 'orderNumber');

  if (!hasColumn) {
    console.log('Column Order.orderNumber is missing. Adding it now (nullable, non-destructive)...');
    await prisma.$executeRawUnsafe('ALTER TABLE `Order` ADD COLUMN `orderNumber` VARCHAR(191) NULL');
    console.log('Added column Order.orderNumber.');
  } else {
    console.log('Column Order.orderNumber already exists. No column change made.');
  }

  const hasUniqueIndex = await indexExists('Order', 'Order_orderNumber_key');

  if (!hasUniqueIndex) {
    console.log('Unique index Order_orderNumber_key is missing. Adding it now...');
    await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX `Order_orderNumber_key` ON `Order` (`orderNumber`)');
    console.log('Added unique index Order_orderNumber_key.');
  } else {
    console.log('Unique index Order_orderNumber_key already exists. No index change made.');
  }

  const ordersMissingNumber = await prisma.order.findMany({
    where: { orderNumber: null },
    select: { id: true },
  });

  if (ordersMissingNumber.length === 0) {
    console.log('No existing orders are missing an orderNumber. Nothing to backfill.');
  } else {
    console.log(`Backfilling orderNumber for ${ordersMissingNumber.length} existing order(s)...`);

    for (const order of ordersMissingNumber) {
      const orderNumber = buildOrderNumber(order.id);
      await prisma.order.update({ where: { id: order.id }, data: { orderNumber } });
      console.log(`  Order #${order.id} -> ${orderNumber}`);
    }
  }

  console.log('\nDone. Only the orderNumber column/index and NULL orderNumber values above were touched; no orders were deleted or reset.');
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
