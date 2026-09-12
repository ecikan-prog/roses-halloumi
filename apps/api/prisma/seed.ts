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
    { name: "Rose's Halloumi Cheese (Block)", unit: 'block', wholesalePrice: '6.50', retailPrice: '9.99' },
    { name: "Rose's Halloumi Skewers", unit: 'pack', wholesalePrice: '5.80', retailPrice: '8.99' },
    { name: "Rose's Halloumi Burger", unit: 'pack', wholesalePrice: '7.20', retailPrice: '10.99' },
    { name: "Rose's Halloumi Salad Bowl", unit: 'pack', wholesalePrice: '6.90', retailPrice: '10.49' },
    { name: "Rose's Halloumi Fries", unit: 'pack', wholesalePrice: '5.50', retailPrice: '8.49' },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { name: product.name },
      update: product,
      create: product,
    });
  }

  const seededProduct = await prisma.product.findFirstOrThrow({ where: { name: "Rose's Halloumi Cheese (Block)" } });

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
