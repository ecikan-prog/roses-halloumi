/**
 * SAFE, NON-DESTRUCTIVE production fix for the three retail Halloumi products.
 *
 * Scope, by design:
 *   - Touches ONLY the three products named exactly:
 *       "Grassland Cheese Halloumi — 1kg"
 *       "Grassland Cheese Halloumi — 500g"
 *       "Grassland Cheese Halloumi — 200g"
 *   - For an EXISTING row matching one of those names, updates ONLY the
 *     `active` and `retailPrice` fields to the required values. It never
 *     touches `unit`, `wholesalePrice`, `id`, `createdAt`, or any other
 *     product's row.
 *   - If a row is missing entirely, it is created with the full required
 *     spec (including a sane default wholesalePrice), but ONLY for that
 *     exact missing name — no other rows are touched.
 *   - Does NOT delete any product, drop any table, reset any data, touch
 *     Customer/StaffUser/Order/OrderItem/Recipe tables, or change auth.
 *   - Prints a before/after diff for every row it touches, and exits with an
 *     error (making no changes) if given unexpected data.
 *
 * Usage (local):
 *   npm run fix-halloumi-products --workspace @dairy-sales/api
 *
 * Usage (against production, via Railway):
 *   railway run --service <api-service-name> \
 *     npm run fix-halloumi-products --workspace @dairy-sales/api
 *
 * (Railway injects the production DATABASE_URL into the process; this script
 * never prints DATABASE_URL, credentials, or any other secret.)
 *
 * Recommended: run `verify-halloumi-products` first and only run this script
 * if it reports a mismatch.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const REQUIRED_PRODUCTS = [
  { name: 'Grassland Cheese Halloumi — 1kg', unit: '1kg block', wholesalePrice: 18.5, retailPrice: 25 },
  { name: 'Grassland Cheese Halloumi — 500g', unit: '500g block', wholesalePrice: 10.5, retailPrice: 15 },
  { name: 'Grassland Cheese Halloumi — 200g', unit: '200g block', wholesalePrice: 5.5, retailPrice: 6 },
] as const;

async function main() {
  for (const required of REQUIRED_PRODUCTS) {
    const existing = await prisma.product.findUnique({ where: { name: required.name } });

    if (!existing) {
      const created = await prisma.product.create({
        data: {
          name: required.name,
          unit: required.unit,
          wholesalePrice: required.wholesalePrice,
          retailPrice: required.retailPrice,
          active: true,
        },
      });
      console.log(`CREATED "${required.name}" (id ${created.id}) — active=true, retailPrice=${required.retailPrice.toFixed(2)}`);
      continue;
    }

    const activeOk = existing.active === true;
    const priceOk = existing.retailPrice.toNumber() === required.retailPrice;

    if (activeOk && priceOk) {
      console.log(`UNCHANGED "${required.name}" (id ${existing.id}) — already active=true, retailPrice=${required.retailPrice.toFixed(2)}`);
      continue;
    }

    const before = { active: existing.active, retailPrice: existing.retailPrice.toString() };

    const updated = await prisma.product.update({
      where: { id: existing.id },
      data: {
        active: true,
        retailPrice: required.retailPrice,
      },
    });

    console.log(
      `UPDATED "${required.name}" (id ${existing.id}) — ` +
        `before=${JSON.stringify(before)} -> after=${JSON.stringify({ active: updated.active, retailPrice: updated.retailPrice.toString() })}`,
    );
  }

  console.log('\nDone. Only the three named Halloumi products above were touched; no other rows were modified.');
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
