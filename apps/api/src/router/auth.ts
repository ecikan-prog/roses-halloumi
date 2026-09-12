import { AccountSource, CustomerType } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { hashPassword, signToken, verifyPassword } from '../lib/auth.js';
import { protectedProcedure, publicProcedure, router } from './trpc.js';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const authRouter = router({
  customerRegister: publicProcedure
    .input(
      z.object({
        name: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(8),
        contact: z.string().trim().min(2).optional(),
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
          type: CustomerType.RETAIL,
          accountSource: AccountSource.SELF_REGISTERED,
        },
      });

      const token = signToken({
        kind: 'customer',
        id: customer.id,
        name: customer.name,
        email: customer.email,
        type: customer.type,
        contact: customer.contact,
      });

      return {
        token,
        user: {
          kind: 'customer' as const,
          id: customer.id,
          name: customer.name,
          email: customer.email,
          type: customer.type,
          contact: customer.contact,
          accountSource: customer.accountSource,
        },
      };
    }),
  customerLogin: publicProcedure.input(credentialsSchema).mutation(async ({ ctx, input }) => {
    const customer = await ctx.prisma.customer.findUnique({ where: { email: input.email } });

    if (!customer || !(await verifyPassword(input.password, customer.passwordHash))) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid customer credentials.' });
    }

    const token = signToken({
      kind: 'customer',
      id: customer.id,
      name: customer.name,
      email: customer.email,
      type: customer.type,
      contact: customer.contact,
    });

    return {
      token,
      user: {
        kind: 'customer' as const,
        id: customer.id,
        name: customer.name,
        email: customer.email,
        type: customer.type,
        contact: customer.contact,
        accountSource: customer.accountSource,
      },
    };
  }),
  staffLogin: publicProcedure.input(credentialsSchema).mutation(async ({ ctx, input }) => {
    const staff = await ctx.prisma.staffUser.findUnique({ where: { email: input.email } });

    if (!staff || !(await verifyPassword(input.password, staff.passwordHash))) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid staff credentials.' });
    }

    const token = signToken({
      kind: 'staff',
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
    });

    return {
      token,
      user: {
        kind: 'staff' as const,
        id: staff.id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
      },
    };
  }),
  me: protectedProcedure.query(async ({ ctx }) => ctx.user),
});
