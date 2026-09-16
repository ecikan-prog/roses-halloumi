import cors from 'cors';
import express from 'express';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { allowedOrigins, env } from './config.js';
import { createContext } from './context.js';
import { ensureOrderNumberColumn } from './lib/ensureOrderNumberColumn.js';
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

// Self-heal the `Order.orderNumber` column/index before accepting requests.
// Some production databases were provisioned before this column existed and
// were never re-synced with `prisma db push`, which made every order
// creation (including the checkout "Confirm order" flow) fail with a
// "column does not exist" error. This check is idempotent and only ever
// adds the missing column/index/backfill — it never touches existing data —
// so it is safe to run on every startup.
async function start() {
  try {
    await ensureOrderNumberColumn(prisma);
  } catch (error) {
    console.error('[startup] Failed to verify/repair Order.orderNumber column. Order creation may fail until this is resolved:', error);
  }

  app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`);
  });
}

void start();
