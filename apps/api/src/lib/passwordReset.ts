/**
 * Shared helper for issuing customer password-reset tokens, used by both:
 *  - the customer-facing "forgot your password" flow (auth.requestPasswordReset)
 *  - the admin-initiated "Reset password" action (staff.resetCustomerPassword)
 *
 * A single-use, time-limited token is created and only its SHA-256 hash is
 * ever persisted (see `PasswordResetToken` in schema.prisma) — the plaintext
 * token only ever exists in memory long enough to build the reset link and
 * hand it to the mailer. It is never logged and never returned to the admin
 * or customer caller directly; it only ever reaches the customer via the
 * email sent through the existing Brevo HTTPS transactional mailer.
 */
import type { Customer, PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import { env } from '../config.js';
import { buildPasswordResetEmail } from './emailTemplates.js';
import { sendMail } from './mailer.js';

// A single reset link is valid for 1 hour, matching the expiry stated in the
// password reset email copy (see buildPasswordResetEmail).
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export function hashResetToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Builds the absolute link sent in "forgot your password" emails. Prefers an
 * explicit APP_BASE_URL (recommended for production), falling back to the
 * Origin header of the request that triggered the reset so the link still
 * points at whichever frontend triggered it.
 */
export function buildResetLink(origin: string | undefined, token: string) {
  const baseUrl = (env.APP_BASE_URL ?? origin ?? '').replace(/\/+$/, '');
  return `${baseUrl}/reset-password?token=${token}`;
}

/**
 * Creates a new password-reset token for `customer` and emails the reset
 * link to their registered address via the Brevo HTTPS API. Never returns
 * or logs the raw token or any other secret.
 */
export async function issuePasswordResetEmail(
  prisma: PrismaClient,
  customer: Pick<Customer, 'id' | 'name' | 'email'>,
  origin: string | undefined,
) {
  const rawToken = crypto.randomBytes(32).toString('hex');

  await prisma.passwordResetToken.create({
    data: {
      customerId: customer.id,
      tokenHash: hashResetToken(rawToken),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  const resetEmail = buildPasswordResetEmail({
    name: customer.name,
    resetLink: buildResetLink(origin, rawToken),
  });
  void sendMail({ to: customer.email, ...resetEmail });
}
