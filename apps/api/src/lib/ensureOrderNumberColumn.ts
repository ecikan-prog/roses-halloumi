/**
 * SAFE, NON-DESTRUCTIVE self-healing checks for `Order` table schema drift.
 *
 * Background: this project pushes schema changes with `prisma db push`
 * rather than tracked migrations, and production deploys only run `prisma
 * generate` (see `apps/api/package.json` `build` script) — `db push` is
 * never re-run automatically against the live database. If the production
 * database was provisioned (or last synced) before a column was added to
 * `schema.prisma`, or with a narrower column type than the schema now
 * implies, Prisma Client still generates queries that assume the newer
 * shape, and those queries fail at runtime with errors such as:
 *
 *   The column `railway.Order.orderNumber` does not exist in the current
 *   database.
 *   Data too long for column 'deliveryAddress' at row 1
 *   The column `railway.Order.paymentTerm` does not exist in the current
 *   database.
 *
 * All are concrete, previously-seen root causes of "Confirm order" failing
 * in production with a generic server error: the `orders.create` mutation's
 * `prisma.$transaction(...)` throws before any response is returned, so the
 * customer sees "We could not place your order because of a server error."
 * even though nothing about the request itself was invalid. The
 * `paymentTerm` case specifically broke Pay in 30 order submission, since
 * `paymentTerm` is the column that records "Pay in 30" vs "Pay now" on every
 * order and is required (`NOT NULL`, no default) on every insert.
 *
 * `ensureOrderSchema` is called once at API startup (see `server.ts`) so
 * these fixes are applied automatically on every deploy instead of
 * depending on someone remembering to run a one-off script by hand. It is
 * also exported for reuse by the standalone
 * `scripts/ensure-order-number-column.ts` CLI.
 *
 * It:
 *   - Only ever ADDS missing columns/indexes, or WIDENS an existing text
 *     column's capacity (e.g. `VARCHAR(191)` -> `TEXT`). It never drops,
 *     narrows, or alters any column in a way that could lose data, and
 *     never touches any table other than `Order`.
 *   - Is fully idempotent: running it again when everything already matches
 *     the current schema is a no-op.
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

async function getColumnDataType(prisma: PrismaClient, table: string, column: string) {
  const rows = await prisma.$queryRaw<Array<{ DATA_TYPE: string }>>`
    SELECT DATA_TYPE
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = ${table}
      AND column_name = ${column}
  `;
  return rows[0]?.DATA_TYPE ?? null;
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

/**
 * Ensures a nullable free-text `Order` column (e.g. `deliveryAddress`,
 * `orderNotes`) exists and is a `TEXT` column, wide enough to hold the
 * multi-line, multi-field content the API builds for it. Prisma's default
 * mapping for an un-annotated `String?` column is `VARCHAR(191)`, which is
 * too small for a formatted delivery address (name + address line + suburb
 * + region + postcode + country) or a full order note, and MySQL rejects
 * the insert with "Data too long for column" — this is why "Confirm order"
 * could still fail in production even after the `orderNumber` column was
 * fixed. Widening a column never loses existing data.
 */
async function ensureWideTextColumn(prisma: PrismaClient, table: string, column: string, log: (message: string) => void) {
  const hasColumn = await columnExists(prisma, table, column);

  if (!hasColumn) {
    log(`[ensure-order-schema] Column ${table}.${column} is missing. Adding it now as TEXT (nullable, non-destructive)...`);
    await prisma.$executeRawUnsafe(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` TEXT NULL`);
    log(`[ensure-order-schema] Added column ${table}.${column}.`);
    return;
  }

  const dataType = await getColumnDataType(prisma, table, column);

  if (dataType === 'varchar') {
    log(`[ensure-order-schema] Column ${table}.${column} is a narrow VARCHAR. Widening it to TEXT (non-destructive, keeps existing data)...`);
    await prisma.$executeRawUnsafe(`ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` TEXT NULL`);
    log(`[ensure-order-schema] Widened column ${table}.${column} to TEXT.`);
  }
}

/** Adds a missing nullable/defaulted `Order` column if it doesn't already exist. Never touches an existing column. */
async function ensureColumn(prisma: PrismaClient, table: string, column: string, ddl: string, log: (message: string) => void) {
  const hasColumn = await columnExists(prisma, table, column);

  if (!hasColumn) {
    log(`[ensure-order-schema] Column ${table}.${column} is missing. Adding it now (${ddl})...`);
    await prisma.$executeRawUnsafe(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${ddl}`);
    log(`[ensure-order-schema] Added column ${table}.${column}.`);
  }
}

export async function ensureOrderNumberColumn(prisma: PrismaClient, log: (message: string) => void = console.log) {
  await ensureColumn(prisma, 'Order', 'orderNumber', 'VARCHAR(191) NULL', log);

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

/**
 * Full self-heal pass for `Order` table schema drift. Runs the existing
 * `orderNumber` column/index/backfill check, then defensively ensures every
 * other column `orders.create` relies on is present (adding it with a
 * schema-consistent, non-destructive default if missing) and widens the
 * free-text columns that were previously too small. Called once at API
 * startup — see `server.ts`.
 */
export async function ensureOrderSchema(prisma: PrismaClient, log: (message: string) => void = console.log) {
  await ensureOrderNumberColumn(prisma, log);

  // Defensive: these columns were all introduced alongside orderNumber for
  // the checkout/"Pay in 30" flow. If the production database missed one
  // `db push`, it could be missing any of them, not just orderNumber.
  await ensureColumn(prisma, 'Order', 'staffId', 'INT NULL', log);
  await ensureColumn(prisma, 'Order', 'subtotal', 'DECIMAL(10,2) NULL', log);
  await ensureColumn(prisma, 'Order', 'deliveryCharge', "DECIMAL(10,2) NOT NULL DEFAULT '0.00'", log);
  await ensureColumn(prisma, 'Order', 'discountApplied', "DECIMAL(10,2) NOT NULL DEFAULT '0.00'", log);
  await ensureColumn(prisma, 'Order', 'dueDate', 'DATETIME(3) NULL', log);
  await ensureColumn(prisma, 'Order', 'paymentStatus', "ENUM('PAID','OUTSTANDING','OVERDUE') NOT NULL DEFAULT 'OUTSTANDING'", log);
  await ensureColumn(prisma, 'Order', 'paymentMethod', "ENUM('IN_APP','EFTPOS') NOT NULL DEFAULT 'IN_APP'", log);
  // `paymentTerm` and `total` are also required (NOT NULL, no default) on
  // every `orders.create` insert, and `status` is set implicitly by its
  // schema default on every insert too. All three were missed by the
  // original defensive list above, which reproduces the exact same
  // "column does not exist" failure class documented above — just for
  // these columns instead of `orderNumber`/`deliveryAddress`. This is the
  // confirmed root cause of "Confirm order" failing for Pay in 30: the
  // production `Order` table was missing `paymentTerm` (the column that
  // distinguishes Pay in 30 from Pay now), so every insert failed before a
  // response could be returned.
  await ensureColumn(prisma, 'Order', 'paymentTerm', "ENUM('PAY_NOW','PAY_30') NOT NULL DEFAULT 'PAY_30'", log);
  await ensureColumn(prisma, 'Order', 'total', "DECIMAL(10,2) NOT NULL DEFAULT '0.00'", log);
  await ensureColumn(prisma, 'Order', 'status', "ENUM('CONFIRMED','FULFILLED','CANCELLED') NOT NULL DEFAULT 'CONFIRMED'", log);

  // deliveryAddress/orderNotes must be TEXT, not the default VARCHAR(191) —
  // see ensureWideTextColumn for why the narrower type breaks order
  // creation for realistic addresses/notes.
  await ensureWideTextColumn(prisma, 'Order', 'deliveryAddress', log);
  await ensureWideTextColumn(prisma, 'Order', 'orderNotes', log);
}
