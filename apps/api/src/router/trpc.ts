import { TRPCError, initTRPC } from '@trpc/server';
import superjson from 'superjson';
import type { Context } from '../context.js';

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

const enforceUser = middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  // A customer's JWT stays valid until it expires even after an admin
  // deletes (soft-deletes) their account, since the token is self-contained
  // and not otherwise revocable. Re-check the account's deletedAt status on
  // every protected call so a deleted customer can never keep using an
  // already-issued session.
  if (ctx.user.kind === 'customer') {
    const customer = await ctx.prisma.customer.findUnique({
      where: { id: ctx.user.id },
      select: { deletedAt: true },
    });

    if (!customer || customer.deletedAt) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

const enforceStaff = middleware(({ ctx, next }) => {
  if (!ctx.user || ctx.user.kind !== 'staff') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Staff access required.' });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

const enforceAdmin = middleware(({ ctx, next }) => {
  if (!ctx.user || ctx.user.kind !== 'staff' || ctx.user.role !== 'ADMIN') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required.' });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(enforceUser);
export const staffProcedure = t.procedure.use(enforceStaff);
export const adminProcedure = t.procedure.use(enforceAdmin);
