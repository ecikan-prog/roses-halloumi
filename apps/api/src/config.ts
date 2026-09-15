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
});

export const env = envSchema.parse(process.env);

export const allowedOrigins = new Set(
  env.ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean) ?? [],
);

// All customer-facing Grassland Cheese communications must be sent from this identity.
export const BRAND_NAME = 'Grassland Cheese';
export const BRAND_EMAIL = 'info@grasslandcheese.com';
export const BRAND_FROM = `${BRAND_NAME} <${BRAND_EMAIL}>`;
