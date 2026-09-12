import { TRPCError, initTRPC } from '@trpc/server';
import superjson from 'superjson';
import type { Context } from '../context.js';

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

const enforceUser = middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
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
