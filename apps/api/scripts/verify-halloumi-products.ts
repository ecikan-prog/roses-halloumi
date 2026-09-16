/**
 * READ-ONLY diagnostic script. Makes NO writes of any kind.
 *
 * Prints the current state of the three retail Halloumi products (and flags
 * anything unexpected) so production data can be inspected before deciding
 * whether any change is needed at all.
 *
 * Usage (local):
 *   npm run verify-halloumi-products --workspace @dairy-sales/api
 *
 * Usage (against production, via Railway — read-only, safe to run any time):
 *   railway run --service <api-service-name> \
 *     npm run verify-halloumi-products --workspace @dairy-sales/api
 *
 * (Railway injects the production DATABASE_URL into the process; this script
 * never prints DATABASE_URL, credentials, or any other secret.)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const REQUIRED_PRODUCTS = [
  { name: 'Grassland Cheese Halloumi — 1kg', retailPrice: 25 },
  { name: 'Grassland Cheese Halloumi — 500g', retailPrice: 15 },
  { name: 'Grassland Cheese Halloumi — 200g', retailPrice: 6 },
];

async function main() {
  const allProducts = await prisma.product.findMany({ orderBy: { name: 'asc' } });

  console.log(`Total products in database: ${allProducts.length}`);
  console.log('All products:');
  console.log(
    JSON.stringify(
      allProducts.map((p) => ({
        id: p.id,
        name: p.name,
        unit: p.unit,
        active: p.active,
        wholesalePrice: p.wholesalePrice.toString(),
        retailPrice: p.retailPrice.toString(),
        updatedAt: p.updatedAt,
      })),
      null,
      2,
    ),
  );

  console.log('\nRequired Halloumi SKU check:');
  let anyMismatch = false;

  for (const required of REQUIRED_PRODUCTS) {
    const match = allProducts.find((p) => p.name.trim().toLowerCase() === required.name.toLowerCase());

    if (!match) {
      anyMismatch = true;
      console.log(`  ❌ MISSING: "${required.name}" — no row with this exact name exists.`);
      continue;
    }

    const activeOk = match.active === true;
    const priceOk = match.retailPrice.toNumber() === required.retailPrice;

    if (activeOk && priceOk) {
      console.log(`  ✅ OK: "${required.name}" (id ${match.id}) — active=true, retailPrice=${required.retailPrice.toFixed(2)}`);
    } else {
      anyMismatch = true;
      console.log(
        `  ⚠️  MISMATCH: "${required.name}" (id ${match.id}) — active=${match.active} (expected true), ` +
          `retailPrice=${match.retailPrice.toString()} (expected ${required.retailPrice.toFixed(2)})`,
      );
    }
  }

  console.log(
    anyMismatch
      ? '\nResult: one or more required products are missing/inactive/mispriced. Review before running fix-halloumi-products.'
      : '\nResult: all three required Halloumi products are present, active, and correctly priced. No fix needed.',
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
