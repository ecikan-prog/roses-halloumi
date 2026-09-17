import { CustomerType } from '@prisma/client';
import { z } from 'zod';
import { router, staffProcedure } from './trpc.js';

export const staffRouter = router({
  listCustomers: staffProcedure.query(async ({ ctx }) => {
    const customers = await ctx.prisma.customer.findMany({ orderBy: { name: 'asc' } });

    return customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      type: customer.type,
      contact: customer.contact,
      accountSource: customer.accountSource,
      createdAt: customer.createdAt,
    }));
  }),
  updateCustomerType: staffProcedure
    .input(
      z.object({
        customerId: z.number().int().positive(),
        type: z.enum(CustomerType),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const customer = await ctx.prisma.customer.update({
        where: { id: input.customerId },
        data: { type: input.type },
      });

      return {
        id: customer.id,
        type: customer.type,
      };
    }),
});
