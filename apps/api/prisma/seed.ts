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
    { name: 'Grassland Cheese Halloumi — 1kg', unit: '1kg block', wholesalePrice: '18.50', retailPrice: '25.00', active: true },
    { name: 'Grassland Cheese Halloumi — 500g', unit: '500g block', wholesalePrice: '10.50', retailPrice: '15.00', active: true },
    { name: 'Grassland Cheese Halloumi — 200g', unit: '200g block', wholesalePrice: '5.50', retailPrice: '6.00', active: true },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { name: product.name },
      update: product,
      create: product,
    });
  }

  await prisma.product.updateMany({
    where: { name: { notIn: products.map((product) => product.name) } },
    data: { active: false },
  });

  const recipes = [
    {
      title: 'Halloumi Burger',
      description: 'A juicy burger stacked with golden grilled halloumi and fresh salad.',
      image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=80',
      steps: [
        'Slice halloumi into thick pieces and pan-grill until golden.',
        'Toast burger buns and spread with your favourite sauce.',
        'Layer halloumi, tomato, lettuce, and onion in the bun.',
        'Serve immediately with chips or a side salad.',
      ],
    },
    {
      title: 'Grilled Halloumi Skewers',
      description: 'Quick skewers with halloumi, peppers, and zucchini for easy entertaining.',
      image: 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=1200&q=80',
      steps: [
        'Cut halloumi, capsicum, and zucchini into bite-sized pieces.',
        'Thread ingredients onto skewers, alternating colours and textures.',
        'Brush lightly with olive oil and grill until charred in spots.',
        'Finish with lemon juice and herbs before serving.',
      ],
    },
    {
      title: 'Halloumi Salad Bowl',
      description: 'A fresh salad bowl topped with warm halloumi and a citrus dressing.',
      image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80',
      steps: [
        'Prepare a base of greens, cucumber, tomato, and olives.',
        'Sear halloumi slices in a hot pan until golden on both sides.',
        'Whisk olive oil, lemon, and a pinch of salt for dressing.',
        'Top the salad with warm halloumi and drizzle over dressing.',
      ],
    },
    {
      title: 'Crispy Pan-Fried Halloumi',
      description: 'Simple crispy halloumi bites that pair perfectly with dips or wraps.',
      image: 'https://images.unsplash.com/photo-1526318896980-cf78c088247c?auto=format&fit=crop&w=1200&q=80',
      steps: [
        'Slice halloumi into strips and pat dry with paper towel.',
        'Heat a non-stick pan and fry halloumi until crisp and golden.',
        'Turn once to brown both sides evenly.',
        'Serve hot with chilli honey, yoghurt dip, or flatbread.',
      ],
    },
  ] as const;

  for (const recipe of recipes) {
    await prisma.recipe.upsert({
      where: { title: recipe.title },
      update: recipe,
      create: recipe,
    });
  }

  const seededProduct = await prisma.product.findFirstOrThrow({ where: { name: 'Grassland Cheese Halloumi — 500g' } });

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
