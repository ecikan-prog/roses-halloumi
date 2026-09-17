import { PrismaClient, CustomerType, AccountSource, PaymentTerm, PaymentMethod } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Seed a retail customer and a product matching the test scenario.
  const passwordHash = await bcrypt.hash('password123', 10);
  const customer = await prisma.customer.create({
    data: {
      name: 'Test Customer',
      email: 'test-customer@example.com',
      passwordHash,
      type: CustomerType.RETAIL,
      accountSource: AccountSource.SELF_REGISTERED,
    },
  });

  // Product subtotal $75 for the test: use 3x $25 halloumi 1kg (weight-per-unit 1kg x 3 = 3kg, +? ) Actually let's use 1kg product priced at $25, qty 3 = $75, weight 3kg. Combined with packaging etc will not be exactly 3.150kg but that's fine, we just want to exercise the create path.
  const product = await prisma.product.create({
    data: {
      name: 'Grassland Cheese Halloumi — 1kg',
      unit: 'each',
      wholesalePrice: 20,
      retailPrice: 25,
      active: true,
    },
  });

  console.log('Seeded customer', customer.id, 'product', product.id);
}

main()
  .catch((e) => { console.error('SEED ERROR', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
