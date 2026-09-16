import { CustomerType, PaymentMethod, PaymentStatus, PaymentTerm } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { buildOrderConfirmationEmail } from '../lib/emailTemplates.js';
import { sendMail } from '../lib/mailer.js';
import { DEPOT_ADDRESS, isNewZealandDestination, type ShippingDestination } from '../lib/shipping.js';
import { getShippingProvider } from '../lib/shippingProvider.js';
import { getProductWeightKg } from '../lib/productWeights.js';
import { protectedProcedure, router, staffProcedure } from './trpc.js';

function normalizePaymentStatus(status: PaymentStatus, dueDate: Date | null) {
  if (status === PaymentStatus.OUTSTANDING && dueDate && dueDate.getTime() < Date.now()) {
    return PaymentStatus.OVERDUE;
  }

  return status;
}

function getPrice(customerType: CustomerType, wholesalePrice: { toNumber(): number }, retailPrice: { toNumber(): number }) {
  return customerType === CustomerType.WHOLESALE ? wholesalePrice.toNumber() : retailPrice.toNumber();
}

function buildOrderNumber(id: number) {
  return `GC-${String(id).padStart(6, '0')}`;
}

// Minimum fields required to calculate a real shipping charge and to give the
// customer/admin/courier something they can actually deliver to.
const deliveryAddressSchema = z.object({
  name: z.string().trim().min(2).max(200),
  addressLine: z.string().trim().min(3).max(300),
  suburb: z.string().trim().min(1).max(200),
  region: z.string().trim().max(200).optional(),
  postcode: z.string().trim().min(1).max(20),
  country: z.string().trim().min(2).max(100),
});

type DeliveryAddressInput = z.infer<typeof deliveryAddressSchema>;

function formatDeliveryAddress(address: DeliveryAddressInput) {
  return [address.name, address.addressLine, [address.suburb, address.region].filter(Boolean).join(', '), address.postcode, address.country]
    .filter((line) => line && line.trim().length > 0)
    .join('\n');
}

export const ordersRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        customerId: z.number().int().positive().optional(),
        items: z.array(z.object({ productId: z.number().int().positive(), qty: z.number().positive() })).min(1),
        paymentTerm: z.enum(PaymentTerm),
        paymentMethod: z.enum(PaymentMethod).default(PaymentMethod.IN_APP),
        deliveryAddress: deliveryAddressSchema.optional(),
        orderNotes: z.string().trim().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Pay Now cannot be completed honestly yet: there is no connected payment
      // gateway, so we refuse to create (or worse, silently mark "paid") an
      // order for it rather than faking a successful payment. Pay in 30 is
      // unaffected and continues to work without any gateway.
      if (input.paymentTerm === PaymentTerm.PAY_NOW) {
        throw new TRPCError({
          code: 'NOT_IMPLEMENTED',
          message: 'Online card payment (Pay now) is not available yet. Please select "Pay in 30" to place your order without payment today.',
        });
      }

      const customerId = ctx.user.kind === 'customer' ? ctx.user.id : input.customerId;

      if (!customerId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Staff orders must include a customer.' });
      }

      const customer = await ctx.prisma.customer.findUnique({ where: { id: customerId } });

      if (!customer) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found.' });
      }

      const resolvedCustomerId: number = customer.id;

      if (ctx.user.kind === 'customer' && !input.deliveryAddress) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'A delivery address is required before shipping can be calculated.' });
      }

      // We currently only sell and ship within New Zealand, so shipping can't
      // be calculated (and the order shouldn't be created) for any other
      // destination.
      if (input.deliveryAddress && !isNewZealandDestination(input.deliveryAddress.country)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'We currently only ship within New Zealand.' });
      }

      const products = await ctx.prisma.product.findMany({
        where: {
          id: { in: input.items.map((item) => item.productId) },
          active: true,
        },
      });

      if (products.length !== input.items.length) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'One or more products are unavailable.' });
      }

      const orderItems = input.items.map((item) => {
        const product = products.find((candidate) => candidate.id === item.productId);

        if (!product) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Product lookup failed.' });
        }

        const unitPrice = getPrice(customer.type, product.wholesalePrice, product.retailPrice);
        return {
          productId: product.id,
          qty: item.qty,
          unitPrice,
          lineTotal: unitPrice * item.qty,
          weightKg: getProductWeightKg(product) * item.qty,
        };
      });

      const subtotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const totalProductWeight = orderItems.reduce((sum, item) => sum + item.weightKg, 0);

      // No discount is currently offered: the only discounted term (Pay Now)
      // is not available yet. Kept as a variable (rather than removed) so the
      // total calculation below doesn't need to change once Pay Now is wired
      // up to a real payment provider.
      const discountApplied = 0;

      // Shipping is always recalculated server-side from the submitted
      // delivery address and cart weight — the client-side estimate shown at
      // checkout (via shipping.estimate) is never trusted directly.
      const destination: ShippingDestination | null = input.deliveryAddress
        ? {
            country: input.deliveryAddress.country,
            region: input.deliveryAddress.region,
            city: input.deliveryAddress.suburb,
            postcode: input.deliveryAddress.postcode,
          }
        : null;
      const shipping = destination
        ? await getShippingProvider().getQuote({ origin: DEPOT_ADDRESS, destination, totalWeight: totalProductWeight }, subtotal)
        : null;
      const deliveryCharge = shipping?.amount ?? 0;
      const total = Number((subtotal - discountApplied + deliveryCharge).toFixed(2));
      // At this point PAY_NOW has already been rejected above, so paymentTerm
      // is always PAY_30 here — due date is always set 30 days out, payment
      // is always outstanding/unpaid, and the payment method is the in-app
      // placeholder (there is no card/EFTPOS transaction for deferred terms).
      const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const paymentStatus = PaymentStatus.OUTSTANDING;
      const paymentMethod = PaymentMethod.IN_APP;

      // The insert and the orderNumber assignment must succeed or fail
      // together: if we numbered the order in a separate call after the
      // create, a failure there (e.g. a database missing the orderNumber
      // column/index) would leave a half-created, un-numbered order sitting
      // in the database while the customer sees a failed "Confirm order".
      // Wrapping both in one transaction guarantees the order is only ever
      // persisted once it is fully created and numbered.
      async function createNumberedOrder() {
        return ctx.prisma.$transaction(async (tx) => {
          const createdOrder = await tx.order.create({
            data: {
              customerId: resolvedCustomerId,
              staffId: ctx.user.kind === 'staff' ? ctx.user.id : null,
              paymentTerm: input.paymentTerm,
              subtotal,
              deliveryCharge,
              deliveryAddress: input.deliveryAddress ? formatDeliveryAddress(input.deliveryAddress) : undefined,
              orderNotes: input.orderNotes,
              discountApplied,
              total,
              dueDate,
              paymentStatus,
              paymentMethod,
              orderItems: {
                create: orderItems.map((item) => ({
                  productId: item.productId,
                  qty: item.qty,
                  unitPrice: item.unitPrice,
                })),
              },
            },
            include: {
              customer: true,
              orderItems: {
                include: {
                  product: true,
                },
              },
              staff: true,
            },
          });

          const numberedOrder = await tx.order.update({
            where: { id: createdOrder.id },
            data: { orderNumber: buildOrderNumber(createdOrder.id) },
          });

          return { createdOrder, numberedOrder };
        });
      }

      let created: Awaited<ReturnType<typeof createNumberedOrder>>;

      try {
        created = await createNumberedOrder();
      } catch (error) {
        // Surface a real, useful message instead of letting the customer
        // see nothing happen. The order is guaranteed NOT to exist in the
        // database if we reach this catch block (the transaction above
        // rolled back), so we must not send a confirmation email either.
        console.error('[orders.create] Failed to create order:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'We could not place your order because of a server error. Please try again, or contact us if this keeps happening.',
          cause: error,
        });
      }

      const { createdOrder: order, numberedOrder: orderWithNumber } = created;

      // Pay in 30 confirmation email is only ever sent after the order row
      // above has been successfully created and numbered — if order creation
      // throws, we never reach this point and no email is sent.
      const confirmationEmail = buildOrderConfirmationEmail({
        name: order.customer.name,
        orderNumber: orderWithNumber.orderNumber ?? buildOrderNumber(order.id),
        items: order.orderItems.map((item) => ({
          qty: item.qty.toNumber(),
          unitPrice: item.unitPrice.toNumber(),
          productName: item.product.name,
          unit: item.product.unit,
        })),
        subtotal: order.subtotal?.toNumber() ?? subtotal,
        deliveryCharge: order.deliveryCharge.toNumber(),
        discountApplied: order.discountApplied.toNumber(),
        total: order.total.toNumber(),
        deliveryAddress: order.deliveryAddress,
        orderNotes: order.orderNotes,
        paymentTermLabel: 'Pay in 30',
        paymentStatusLabel: 'Deferred / unpaid',
      });
      void sendMail({ to: order.customer.email, ...confirmationEmail });

      return {
        id: order.id,
        orderNumber: orderWithNumber.orderNumber,
        status: order.status,
        paymentTerm: order.paymentTerm,
        paymentMethod: order.paymentMethod,
        paymentStatus: normalizePaymentStatus(order.paymentStatus, order.dueDate),
        subtotal: order.subtotal?.toNumber() ?? subtotal,
        deliveryCharge: order.deliveryCharge.toNumber(),
        isTemporaryShippingRate: shipping?.isTemporaryRate ?? false,
        shippingZoneLabel: shipping?.zoneLabel ?? null,
        totalShipmentWeightKg: shipping?.totalShipmentWeightKg ?? null,
        deliveryAddress: order.deliveryAddress,
        orderNotes: order.orderNotes,
        total: order.total.toNumber(),
        discountApplied: order.discountApplied.toNumber(),
        dueDate: order.dueDate,
        createdAt: order.createdAt,
        items: order.orderItems.map((item) => ({
          id: item.id,
          qty: item.qty.toNumber(),
          unitPrice: item.unitPrice.toNumber(),
          product: {
            id: item.product.id,
            name: item.product.name,
            unit: item.product.unit,
          },
        })),
      };
    }),
  list: protectedProcedure
    .input(
      z
        .object({
          customerId: z.number().int().positive().optional(),
          paymentStatus: z.enum(PaymentStatus).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      if (ctx.user.kind === 'customer' && input?.customerId && input.customerId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Customers can only view their own orders.' });
      }

      const customerId = ctx.user.kind === 'customer' ? ctx.user.id : input?.customerId;
      const orders = await ctx.prisma.order.findMany({
        where: customerId ? { customerId } : undefined,
        include: {
          customer: true,
          orderItems: {
            include: {
              product: true,
            },
          },
          staff: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return orders
        .map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber ?? buildOrderNumber(order.id),
          status: order.status,
          paymentTerm: order.paymentTerm,
          paymentMethod: order.paymentMethod,
          paymentStatus: normalizePaymentStatus(order.paymentStatus, order.dueDate),
          subtotal: order.subtotal?.toNumber() ?? null,
          deliveryCharge: order.deliveryCharge.toNumber(),
          deliveryAddress: order.deliveryAddress,
          orderNotes: order.orderNotes,
          discountApplied: order.discountApplied.toNumber(),
          total: order.total.toNumber(),
          dueDate: order.dueDate,
          createdAt: order.createdAt,
          customer: {
            id: order.customer.id,
            name: order.customer.name,
            type: order.customer.type,
          },
          staff: order.staff
            ? {
                id: order.staff.id,
                name: order.staff.name,
              }
            : null,
          items: order.orderItems.map((item) => ({
            id: item.id,
            qty: item.qty.toNumber(),
            unitPrice: item.unitPrice.toNumber(),
            product: {
              id: item.product.id,
              name: item.product.name,
              unit: item.product.unit,
            },
          })),
        }))
        .filter((order) => (input?.paymentStatus ? order.paymentStatus === input.paymentStatus : true));
    }),
  exportCsv: staffProcedure.query(async ({ ctx }) => {
    const orders = await ctx.prisma.order.findMany({
      include: {
        customer: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const header = 'order_id,customer_name,customer_type,status,payment_status,total,due_date,created_at';
    const rows = orders.map((order) => {
      const paymentStatus = normalizePaymentStatus(order.paymentStatus, order.dueDate);
      return [
        order.id,
        JSON.stringify(order.customer.name),
        order.customer.type,
        order.status,
        paymentStatus,
        order.total.toNumber().toFixed(2),
        order.dueDate ? order.dueDate.toISOString() : '',
        order.createdAt.toISOString(),
      ].join(',');
    });

    return [header, ...rows].join('\n');
  }),
});
