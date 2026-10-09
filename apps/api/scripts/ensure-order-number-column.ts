/**
 * SAFE, NON-DESTRUCTIVE production fix for `Order` table schema drift
 * (missing columns such as `orderNumber`, and narrow `deliveryAddress`/
 * `orderNotes` columns that are too small for their content).
 *
 * NOTE: as of this change the API also runs this same, idempotent check
 * automatically on every startup (see `src/server.ts` /
 * `src/lib/ensureOrderNumberColumn.ts`'s `ensureOrderSchema`), so production
 * should self-heal on deploy without needing this script run by hand. It is
 * kept as a standalone CLI for manually checking/fixing a database
 * out-of-band.
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
import { ensureOrderSchema } from '../src/lib/ensureOrderNumberColumn.js';

const prisma = new PrismaClient();

async function main() {
  await ensureOrderSchema(prisma, console.log);
  console.log('\nDone. Only missing Order columns/indexes were added and narrow text columns were widened; no orders were deleted or reset.');
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
