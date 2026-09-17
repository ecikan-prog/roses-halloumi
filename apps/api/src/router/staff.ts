import { CustomerType } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { issuePasswordResetEmail } from '../lib/passwordReset.js';
import { adminProcedure, router, staffProcedure } from './trpc.js';

const customerIdSchema = z.object({
  customerId: z.number().int().positive(),
});

export const staffRouter = router({
  listCustomers: staffProcedure.query(async ({ ctx }) => {
    const customers = await ctx.prisma.customer.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });

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
      const existing = await ctx.prisma.customer.findUnique({ where: { id: input.customerId } });

      if (!existing || existing.deletedAt) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found.' });
      }

      const customer = await ctx.prisma.customer.update({
        where: { id: input.customerId },
        data: { type: input.type },
      });

      return {
        id: customer.id,
        type: customer.type,
      };
    }),
  // Admin-only: initiates a password reset for a customer without ever
  // viewing, retrieving, or generating a plaintext password on the admin's
  // behalf. This reuses the exact same single-use, SHA-256-hashed,
  // 1-hour-expiry token flow as the customer self-service "forgot password"
  // feature, and sends the reset link to the customer's registered email via
  // the existing Brevo HTTPS transactional mailer.
  resetCustomerPassword: adminProcedure.input(customerIdSchema).mutation(async ({ ctx, input }) => {
    const customer = await ctx.prisma.customer.findUnique({ where: { id: input.customerId } });

    if (!customer || customer.deletedAt) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found.' });
    }

    await issuePasswordResetEmail(ctx.prisma, customer, ctx.origin);

    return { ok: true as const };
  }),
  // Admin-only: soft-deletes a customer account. The row (and its historical
  // orders, referenced via Order.customerId) is preserved for
  // accounting/audit purposes — only `deletedAt` is set. Deleting the row
  // outright would either violate the FK from Order.customerId (customerId
  // is required, non-nullable) or require destroying order history, neither
  // of which is acceptable. Any outstanding password reset tokens are
  // invalidated and the account can no longer log in or use an existing
  // session (see enforceUser in trpc.ts).
  deleteCustomer: adminProcedure.input(customerIdSchema).mutation(async ({ ctx, input }) => {
    const customer = await ctx.prisma.customer.findUnique({ where: { id: input.customerId } });

    if (!customer || customer.deletedAt) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found.' });
    }

    const now = new Date();

    await ctx.prisma.$transaction([
      ctx.prisma.customer.update({
        where: { id: input.customerId },
        data: { deletedAt: now },
      }),
      ctx.prisma.passwordResetToken.updateMany({
        where: { customerId: input.customerId, usedAt: null },
        data: { usedAt: now },
      }),
    ]);

    return { ok: true as const };
  }),
});
