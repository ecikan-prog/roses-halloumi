import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  PORT: z.coerce.number().default(4000),
  ALLOWED_ORIGINS: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  // NZ Post Domestic Rating API credentials. When ALL of these are set, the
  // API rates shipments through the real NZ Post API instead of the
  // temporary static rate table (see lib/shippingProvider.ts). Leave unset
  // in any environment (e.g. local dev) that shouldn't call the live API.
  NZ_POST_API_BASE_URL: z.string().optional(),
  NZ_POST_CLIENT_ID: z.string().optional(),
  NZ_POST_CLIENT_SECRET: z.string().optional(),
  NZ_POST_SUBSCRIPTION_KEY: z.string().optional(),
  NZ_POST_ACCOUNT_NUMBER: z.string().optional(),
  NZ_POST_SITE_CODE: z.string().optional(),
  // Which published NZ Post domestic Courier product to rate with, e.g. the
  // standard overnight Courier product code or the cheaper Courier Economy
  // product code. Confirm the exact code with the NZ Post account team/API
  // docs for the connected account before going live — do not guess a code.
  NZ_POST_SERVICE_CODE: z.string().optional(),
  // Absolute base URL of the deployed customer-facing web app (e.g.
  // "https://shop.grasslandcheese.com"), used to build the link sent in
  // "forgot your password" emails. If unset, the request's Origin header is
  // used instead (see context.ts) so the link still points at whichever
  // frontend the customer is actually using.
  APP_BASE_URL: z.string().optional(),
});

export const env = envSchema.parse(process.env);

export const allowedOrigins = new Set(
  env.ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean) ?? [],
);

// All customer-facing Grassland Cheese communications must be sent from this identity.
export const BRAND_NAME = 'Grassland Cheese';
export const BRAND_EMAIL = 'info@grasslandcheese.com';
export const BRAND_FROM = `${BRAND_NAME} <${BRAND_EMAIL}>`;
