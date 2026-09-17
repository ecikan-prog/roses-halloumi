import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { prisma } from './lib/prisma.js';
import { verifyToken, type SessionUser } from './lib/auth.js';

export async function createContext({ req }: CreateExpressContextOptions) {
  const authorization = req.headers.authorization;
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
  let user: SessionUser | null = null;

  if (authorization?.startsWith('Bearer ')) {
    try {
      const payload = verifyToken(authorization.slice(7));

      user =
        payload.kind === 'staff'
          ? {
              kind: 'staff',
              id: payload.id,
              name: payload.name,
              email: payload.email,
              role: payload.role,
            }
          : {
              kind: 'customer',
              id: payload.id,
              name: payload.name,
              email: payload.email,
              type: payload.type,
              contact: payload.contact,
            };
    } catch {
      user = null;
    }
  }

  return { prisma, user, origin };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
