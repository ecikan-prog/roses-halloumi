import { PrismaClient, PaymentTerm, PaymentMethod } from '@prisma/client';
import { getShippingProvider } from '../src/lib/shippingProvider.js';
import { getProductWeightKg } from '../src/lib/productWeights.js';
import { DEPOT_ADDRESS, isNewZealandDestination } from '../src/lib/shipping.js';

const prisma = new PrismaClient();

function buildOrderNumber(id: number) {
  return `GC-${String(id).padStart(6, '0')}`;
}

async function main() {
  const customer = await prisma.customer.findFirstOrThrow({ where: { email: 'test-customer@example.com' } });
  const product = await prisma.product.findFirstOrThrow({ where: { name: 'Grassland Cheese Halloumi — 1kg' } });

  const items = [{ productId: product.id, qty: 3 }]; // 3 x $25 = $75 subtotal
  const deliveryAddress = {
    name: 'South Islander',
    addressLine: '123 Test Street',
    suburb: 'Riccarton',
    region: 'Canterbury',
    postcode: '8041', // South Island, urban (no rural keyword)
    country: 'New Zealand',
  };

  if (!isNewZealandDestination(deliveryAddress.country)) throw new Error('bad country');

  const products = await prisma.product.findMany({ where: { id: { in: items.map((i) => i.productId) }, active: true } });
  const orderItems = items.map((item) => {
    const p = products.find((c) => c.id === item.productId)!;
    const unitPrice = p.retailPrice.toNumber();
    return { productId: p.id, qty: item.qty, unitPrice, lineTotal: unitPrice * item.qty, weightKg: getProductWeightKg(p) * item.qty };
  });

  const subtotal = orderItems.reduce((s, i) => s + i.lineTotal, 0);
  const totalProductWeight = orderItems.reduce((s, i) => s + i.weightKg, 0);
  console.log('subtotal', subtotal, 'totalProductWeight', totalProductWeight);

  const destination = {
    country: deliveryAddress.country,
    region: deliveryAddress.region,
    city: deliveryAddress.suburb,
    postcode: deliveryAddress.postcode,
  };

  const shipping = await getShippingProvider().getQuote({ origin: DEPOT_ADDRESS, destination, totalWeight: totalProductWeight }, subtotal);
  console.log('shipping quote', shipping);

  const deliveryCharge = shipping?.amount ?? 0;
  const discountApplied = 0;
  const total = Number((subtotal - discountApplied + deliveryCharge).toFixed(2));
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const created = await prisma.$transaction(async (tx) => {
    const createdOrder = await tx.order.create({
      data: {
        customerId: customer.id,
        staffId: null,
        paymentTerm: PaymentTerm.PAY_30,
        subtotal,
        deliveryCharge,
        deliveryAddress: [deliveryAddress.name, deliveryAddress.addressLine, [deliveryAddress.suburb, deliveryAddress.region].filter(Boolean).join(', '), deliveryAddress.postcode, deliveryAddress.country].join('\n'),
        orderNotes: undefined,
        discountApplied,
        total,
        dueDate,
        paymentStatus: 'OUTSTANDING',
        paymentMethod: PaymentMethod.IN_APP,
        orderItems: {
          create: orderItems.map((item) => ({ productId: item.productId, qty: item.qty, unitPrice: item.unitPrice })),
        },
      },
      include: { customer: true, orderItems: { include: { product: true } }, staff: true },
    });

    const numberedOrder = await tx.order.update({ where: { id: createdOrder.id }, data: { orderNumber: buildOrderNumber(createdOrder.id) } });
    return { createdOrder, numberedOrder };
  });

  console.log('ORDER CREATED', created.numberedOrder.orderNumber, created.createdOrder.id);
}

main()
  .catch((e) => {
    console.error('REPRO ERROR:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
