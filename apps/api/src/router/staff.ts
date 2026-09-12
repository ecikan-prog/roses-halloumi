import { AccountSource, CustomerType } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { hashPassword } from '../lib/auth.js';
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
  createCustomer: staffProcedure
    .input(
      z.object({
        name: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(8),
        contact: z.string().trim().min(2).optional(),
        type: z.enum(CustomerType).default(CustomerType.RETAIL),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existingCustomer = await ctx.prisma.customer.findUnique({ where: { email: input.email } });
      const existingStaff = await ctx.prisma.staffUser.findUnique({ where: { email: input.email } });

      if (existingCustomer || existingStaff) {
        throw new TRPCError({ code: 'CONFLICT', message: 'An account already exists with that email.' });
      }

      const customer = await ctx.prisma.customer.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash: await hashPassword(input.password),
          contact: input.contact,
          type: input.type,
          accountSource: AccountSource.STAFF_CREATED,
        },
      });

      return {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        type: customer.type,
        contact: customer.contact,
        accountSource: customer.accountSource,
      };
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
