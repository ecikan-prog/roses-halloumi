import cors from 'cors';
import express from 'express';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { allowedOrigins, env } from './config.js';
import { createContext } from './context.js';
import { ensureCustomerDeletedAtColumn } from './lib/ensureCustomerDeletedAtColumn.js';
import { ensureOrderSchema } from './lib/ensureOrderNumberColumn.js';
import { ensurePasswordResetTokenTable } from './lib/ensurePasswordResetTokenTable.js';
import { prisma } from './lib/prisma.js';
import { appRouter } from './router/index.js';

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.size === 0 || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin not allowed by CORS.'));
    },
  }),
);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

// Self-heal `Order` table schema drift before accepting requests. Some
// production databases were provisioned/last-synced before columns such as
// `orderNumber` existed, or with a `deliveryAddress`/`orderNotes` column too
// narrow (VARCHAR(191)) for the content the checkout flow writes to it. Both
// made order creation (the checkout "Confirm order" flow) fail with a
// database error. This check is idempotent and only ever adds missing
// columns/indexes or widens narrow text columns — it never touches existing
// data — so it is safe to run on every startup.
async function start() {
  console.log('[startup] Verifying/repairing Order table schema...');
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const stripeSecretStatus =
    stripeSecret == null ? 'missing' : stripeSecret.length === 0 ? 'empty' : stripeSecret.trim().length === 0 ? 'whitespace-only' : 'present';
  console.log(`[startup] STRIPE_SECRET_KEY runtime status: ${stripeSecretStatus}.`);

  try {
    await ensureOrderSchema(prisma);
    console.log('[startup] Order table schema self-heal pass complete.');
  } catch (error) {
    console.error('[startup] Failed to verify/repair Order table schema. Order creation may fail until this is resolved:', error);
  }

  console.log('[startup] Verifying/repairing PasswordResetToken table...');
  await ensurePasswordResetTokenTable(prisma);

  console.log('[startup] Verifying/repairing Customer.deletedAt column...');
  await ensureCustomerDeletedAtColumn(prisma);

  app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`);
  });
}

void start();
