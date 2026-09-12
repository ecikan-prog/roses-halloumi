import bcrypt from 'bcryptjs';
import { PrismaClient, AccountSource, CustomerType, PaymentMethod, PaymentStatus, PaymentTerm, StaffRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  await prisma.staffUser.upsert({
    where: { email: 'admin@dairysales.local' },
    update: {},
    create: {
      name: 'Dairy Admin',
      email: 'admin@dairysales.local',
      passwordHash,
      role: StaffRole.ADMIN,
    },
  });

  await prisma.staffUser.upsert({
    where: { email: 'staff@dairysales.local' },
    update: {},
    create: {
      name: 'Order Staff',
      email: 'staff@dairysales.local',
      passwordHash,
      role: StaffRole.STAFF,
    },
  });

  const wholesaleCustomer = await prisma.customer.upsert({
    where: { email: 'wholesale@dairysales.local' },
    update: {},
    create: {
      name: 'Corner Grocer',
      email: 'wholesale@dairysales.local',
      passwordHash,
      type: CustomerType.WHOLESALE,
      contact: 'Sam Buyer',
      accountSource: AccountSource.STAFF_CREATED,
    },
  });

  const retailCustomer = await prisma.customer.upsert({
    where: { email: 'retail@dairysales.local' },
    update: {},
    create: {
      name: 'Retail Shopper',
      email: 'retail@dairysales.local',
      passwordHash,
      type: CustomerType.RETAIL,
      contact: 'Alex Shopper',
      accountSource: AccountSource.SELF_REGISTERED,
    },
  });

  const products = [
    { name: 'Halloumi Block', unit: 'pack', wholesalePrice: '7.80', retailPrice: '9.50' },
    { name: 'Greek Yoghurt Tub', unit: 'tub', wholesalePrice: '4.40', retailPrice: '5.90' },
    { name: 'Feta Crumble', unit: 'bag', wholesalePrice: '5.10', retailPrice: '6.80' },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { name: product.name },
      update: product,
      create: product,
    });
  }

  const seededProduct = await prisma.product.findFirstOrThrow({ where: { name: 'Halloumi Block' } });

  await prisma.order.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      customerId: wholesaleCustomer.id,
      paymentTerm: PaymentTerm.PAY_30,
      discountApplied: 0,
      total: 15.6,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      paymentStatus: PaymentStatus.OUTSTANDING,
      paymentMethod: PaymentMethod.IN_APP,
      orderItems: {
        create: [{ productId: seededProduct.id, qty: 2, unitPrice: 7.8 }],
      },
    },
  });

  await prisma.order.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      customerId: retailCustomer.id,
      paymentTerm: PaymentTerm.PAY_NOW,
      discountApplied: 1.9,
      total: 17.1,
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: PaymentMethod.EFTPOS,
      orderItems: {
        create: [{ productId: seededProduct.id, qty: 2, unitPrice: 9.5 }],
      },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
