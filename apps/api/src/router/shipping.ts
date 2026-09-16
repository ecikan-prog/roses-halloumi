import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { calculateShipping, isNewZealandDestination, type ShippingDestination } from '../lib/shipping.js';
import { getProductWeightKg } from '../lib/productWeights.js';
import { publicProcedure, router } from './trpc.js';

const destinationSchema = z.object({
  country: z.string().trim().min(2),
  region: z.string().trim().max(200).optional(),
  city: z.string().trim().max(200).optional(),
  postcode: z.string().trim().max(20).optional(),
});

export const shippingRouter = router({
  // Public so the checkout can preview shipping before an order is created; the
  // order creation itself always recalculates shipping server-side rather than
  // trusting the client-supplied estimate.
  estimate: publicProcedure
    .input(
      z.object({
        items: z.array(z.object({ productId: z.number().int().positive(), qty: z.number().positive() })).min(1),
        destination: destinationSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!isNewZealandDestination(input.destination.country)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'We currently only ship within New Zealand.' });
      }

      const products = await ctx.prisma.product.findMany({
        where: { id: { in: input.items.map((item) => item.productId) } },
      });

      if (products.length !== input.items.length) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'One or more products are unavailable.' });
      }

      const totalProductWeight = input.items.reduce((sum, item) => {
        const product = products.find((candidate) => candidate.id === item.productId);
        return sum + (product ? getProductWeightKg(product) * item.qty : 0);
      }, 0);

      const destination: ShippingDestination = {
        country: input.destination.country,
        region: input.destination.region,
        city: input.destination.city,
        postcode: input.destination.postcode,
      };

      const result = calculateShipping({ destination, totalProductWeight });

      return { ...result, totalProductWeight };
    }),
});
