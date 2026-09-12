import { authRouter } from './auth.js';
import { catalogRouter } from './catalog.js';
import { ordersRouter } from './orders.js';
import { router } from './trpc.js';
import { staffRouter } from './staff.js';

export const appRouter = router({
  auth: authRouter,
  catalog: catalogRouter,
  orders: ordersRouter,
  staff: staffRouter,
});

export type AppRouter = typeof appRouter;
