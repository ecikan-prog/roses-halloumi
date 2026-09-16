import { CustomerType } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { publicProcedure, router, staffProcedure } from './trpc.js';

function getUnitPrice(customerType: CustomerType, wholesalePrice: { toNumber(): number }, retailPrice: { toNumber(): number }) {
  return customerType === CustomerType.WHOLESALE ? wholesalePrice.toNumber() : retailPrice.toNumber();
}

export const catalogRouter = router({
  // Publicly readable so retail visitors can see live, active halloumi products and
  // retail pricing before creating an account. Staff-only fields (e.g. inactive
  // products) still require an authenticated staff session via includeInactive.
  listProducts: publicProcedure
    .input(
      z
        .object({
          customerId: z.number().int().positive().optional(),
          includeInactive: z.boolean().default(false),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      if (input?.includeInactive && (!ctx.user || ctx.user.kind !== 'staff')) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Staff access required.' });
      }

      let customerType: CustomerType;

      if (ctx.user && ctx.user.kind === 'customer') {
        customerType = ctx.user.type;
      } else if (input?.customerId) {
        if (!ctx.user || ctx.user.kind !== 'staff') {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Staff access required.' });
        }

        const customer = await ctx.prisma.customer.findUnique({ where: { id: input.customerId } });

        if (!customer) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found.' });
        }

        customerType = customer.type;
      } else {
        customerType = CustomerType.RETAIL;
      }

      const products = await ctx.prisma.product.findMany({
        where: input?.includeInactive ? undefined : { active: true },
        orderBy: { name: 'asc' },
      });

      return products.map((product) => ({
        id: product.id,
        name: product.name,
        unit: product.unit,
        active: product.active,
        wholesalePrice: product.wholesalePrice.toNumber(),
        retailPrice: product.retailPrice.toNumber(),
        effectivePrice: getUnitPrice(customerType, product.wholesalePrice, product.retailPrice),
        customerType,
      }));
    }),
  upsertProduct: staffProcedure
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        name: z.string().min(2),
        unit: z.string().min(1),
        wholesalePrice: z.number().positive(),
        retailPrice: z.number().positive(),
        active: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.product.upsert({
        where: { id: input.id ?? 0 },
        update: {
          name: input.name,
          unit: input.unit,
          wholesalePrice: input.wholesalePrice,
          retailPrice: input.retailPrice,
          active: input.active,
        },
        create: {
          name: input.name,
          unit: input.unit,
          wholesalePrice: input.wholesalePrice,
          retailPrice: input.retailPrice,
          active: input.active,
        },
      });
    }),
});
