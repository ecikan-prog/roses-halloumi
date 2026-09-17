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
  // Brevo (formerly Sendinblue) SMTP credentials used to send all Grassland
  // Cheese transactional emails (welcome, password reset, order
  // confirmation, etc). This is a distinct configuration from the SMTP_*
  // variables above (existing Google configuration) and must not be
  // conflated with them.
  BREVO_SMTP_HOST: z.string().optional(),
  BREVO_SMTP_PORT: z.coerce.number().default(587),
  BREVO_SMTP_SECURE: z.coerce.boolean().default(false),
  BREVO_SMTP_USER: z.string().optional(),
  BREVO_SMTP_PASS: z.string().optional(),
  // Brevo Transactional Email HTTPS API key. Railway Hobby blocks/times out
  // outbound SMTP (ETIMEDOUT on the 'CONN' command), so all Grassland
  // Cheese transactional emails (welcome, password reset, order
  // confirmation, etc) are now sent via the Brevo HTTPS API instead of the
  // BREVO_SMTP_* credentials above. Those SMTP variables are left in place
  // (unused) for now and must not be removed.
  BREVO_API_KEY: z.string().optional(),
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
  // Overrides the "Name <email@domain>" sender identity used by sendMail()
  // for every transactional email (welcome, password reset, order
  // confirmation, etc). Must be an address on the authenticated/verified
  // Grassland Cheese sending domain. If unset, falls back to the
  // info@grasslandcheese.com identity below.
  MAIL_FROM: z.string().optional(),
  // Recipient for admin-facing transactional notifications (e.g. contact
  // form submissions, new order alerts), so the address is configurable per
  // environment instead of hard-coded to a specific person's inbox. Unused
  // until an admin-facing notification email is implemented.
  ADMIN_EMAIL: z.string().optional(),
});

export const env = envSchema.parse(process.env);

export const allowedOrigins = new Set(
  env.ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean) ?? [],
);

// All customer-facing Grassland Cheese communications must be sent from this identity.
export const BRAND_NAME = 'Grassland Cheese';
export const BRAND_EMAIL = 'info@grasslandcheese.com';
export const BRAND_FROM = env.MAIL_FROM ?? `${BRAND_NAME} <${BRAND_EMAIL}>`;
// Brevo's transactional email API expects the sender as separate name/email
// fields rather than a single "Name <email@domain>" string. Parsed once here
// from BRAND_FROM so MAIL_FROM overrides continue to work unchanged.
const BRAND_FROM_MATCH = BRAND_FROM.match(/^(.*)<(.+)>$/);
export const BRAND_FROM_NAME = BRAND_FROM_MATCH ? BRAND_FROM_MATCH[1].trim() : BRAND_NAME;
export const BRAND_FROM_EMAIL = BRAND_FROM_MATCH ? BRAND_FROM_MATCH[2].trim() : BRAND_FROM.trim();
// Configurable recipient for future admin-facing notifications; no email
// currently sends to this address (see requirement audit — no contact form
// or admin order-notification email exists yet).
export const ADMIN_EMAIL = env.ADMIN_EMAIL;
