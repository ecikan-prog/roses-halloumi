import { CustomerType, PaymentMethod, PaymentStatus, PaymentTerm } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
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

const FREE_DELIVERY_THRESHOLD = 80;
const FLAT_DELIVERY_CHARGE = 9.95;

function getDeliveryCharge(subtotal: number) {
  return subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : FLAT_DELIVERY_CHARGE;
}

function buildOrderNumber(id: number) {
  return `GC-${String(id).padStart(6, '0')}`;
}

export const ordersRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        customerId: z.number().int().positive().optional(),
        items: z.array(z.object({ productId: z.number().int().positive(), qty: z.number().positive() })).min(1),
        paymentTerm: z.enum(PaymentTerm),
        paymentMethod: z.enum(PaymentMethod).default(PaymentMethod.IN_APP),
        deliveryAddress: z.string().trim().min(5).max(500).optional(),
        orderNotes: z.string().trim().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const customerId = ctx.user.kind === 'customer' ? ctx.user.id : input.customerId;

      if (!customerId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Staff orders must include a customer.' });
      }

      const customer = await ctx.prisma.customer.findUnique({ where: { id: customerId } });

      if (!customer) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found.' });
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
        };
      });

      const subtotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const discountApplied = input.paymentTerm === PaymentTerm.PAY_NOW ? Number((subtotal * 0.1).toFixed(2)) : 0;
      const deliveryCharge = getDeliveryCharge(subtotal);
      const total = Number((subtotal - discountApplied + deliveryCharge).toFixed(2));
      const dueDate = input.paymentTerm === PaymentTerm.PAY_30 ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null;
      const paymentStatus = input.paymentTerm === PaymentTerm.PAY_NOW ? PaymentStatus.PAID : PaymentStatus.OUTSTANDING;
      const paymentMethod = input.paymentTerm === PaymentTerm.PAY_NOW ? input.paymentMethod : PaymentMethod.IN_APP;

      const order = await ctx.prisma.order.create({
        data: {
          customerId: customer.id,
          staffId: ctx.user.kind === 'staff' ? ctx.user.id : null,
          paymentTerm: input.paymentTerm,
          subtotal,
          deliveryCharge,
          deliveryAddress: input.deliveryAddress,
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

      const orderWithNumber = await ctx.prisma.order.update({
        where: { id: order.id },
        data: { orderNumber: buildOrderNumber(order.id) },
      });

      return {
        id: order.id,
        orderNumber: orderWithNumber.orderNumber,
        status: order.status,
        paymentStatus: normalizePaymentStatus(order.paymentStatus, order.dueDate),
        subtotal: order.subtotal?.toNumber() ?? subtotal,
        deliveryCharge: order.deliveryCharge.toNumber(),
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
