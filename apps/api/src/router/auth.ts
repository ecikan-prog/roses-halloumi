import { AccountSource, CustomerType } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import crypto from 'node:crypto';
import { z } from 'zod';
import { env } from '../config.js';
import { hashPassword, signToken, verifyPassword } from '../lib/auth.js';
import { buildPasswordResetEmail, buildWelcomeEmail } from '../lib/emailTemplates.js';
import { sendMail } from '../lib/mailer.js';
import { protectedProcedure, publicProcedure, router } from './trpc.js';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// A single reset link is valid for 1 hour, matching the expiry stated in the
// password reset email copy (see buildPasswordResetEmail).
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hashResetToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Builds the absolute link sent in "forgot your password" emails. Prefers an
 * explicit APP_BASE_URL (recommended for production), falling back to the
 * Origin header of the request that triggered the reset so the link still
 * points at whichever frontend the customer is actually using.
 */
function buildResetLink(origin: string | undefined, token: string) {
  const baseUrl = (env.APP_BASE_URL ?? origin ?? '').replace(/\/+$/, '');
  return `${baseUrl}/reset-password?token=${token}`;
}

export const authRouter = router({
  customerRegister: publicProcedure
    .input(
      z.object({
        name: z
          .string()
          .trim()
          .min(2)
          .refine((value) => !emailPattern.test(value), {
            message: 'Enter your full name, not an email address.',
          }),
        email: z.string().email(),
        password: z.string().min(8),
        contact: z.string().trim().min(6),
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

      const welcomeEmail = buildWelcomeEmail({ name: customer.name });
      void sendMail({ to: customer.email, ...welcomeEmail });

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
  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const customer = await ctx.prisma.customer.findUnique({ where: { email: input.email } });

      // Always perform the same work and return the same generic response
      // whether or not the email matches a customer account, so this
      // endpoint never reveals which email addresses are registered.
      if (customer) {
        const rawToken = crypto.randomBytes(32).toString('hex');

        await ctx.prisma.passwordResetToken.create({
          data: {
            customerId: customer.id,
            tokenHash: hashResetToken(rawToken),
            expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
          },
        });

        const resetEmail = buildPasswordResetEmail({
          name: customer.name,
          resetLink: buildResetLink(ctx.origin, rawToken),
        });
        void sendMail({ to: customer.email, ...resetEmail });
      }

      return { ok: true as const };
    }),
  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        password: z.string().min(8),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resetToken = await ctx.prisma.passwordResetToken.findUnique({
        where: { tokenHash: hashResetToken(input.token) },
      });

      if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'This password reset link is invalid or has expired.' });
      }

      const newPasswordHash = await hashPassword(input.password);

      await ctx.prisma.$transaction([
        ctx.prisma.customer.update({
          where: { id: resetToken.customerId },
          data: { passwordHash: newPasswordHash },
        }),
        ctx.prisma.passwordResetToken.update({
          where: { id: resetToken.id },
          data: { usedAt: new Date() },
        }),
      ]);

      return { ok: true as const };
    }),
  me: protectedProcedure.query(async ({ ctx }) => ctx.user),
});
