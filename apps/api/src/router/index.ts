import { authRouter } from './auth.js';
import { catalogRouter } from './catalog.js';
import { contactRouter } from './contact.js';
import { ordersRouter } from './orders.js';
import { recipesRouter } from './recipes.js';
import { shippingRouter } from './shipping.js';
import { router } from './trpc.js';
import { staffRouter } from './staff.js';

export const appRouter = router({
  auth: authRouter,
  catalog: catalogRouter,
  recipes: recipesRouter,
  orders: ordersRouter,
  shipping: shippingRouter,
  staff: staffRouter,
  contact: contactRouter,
});

export type AppRouter = typeof appRouter;
