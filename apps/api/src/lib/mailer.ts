import nodemailer from 'nodemailer';
import { BRAND_FROM, env } from '../config.js';

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
let transporterInitialized = false;

function getTransporter() {
  if (transporterInitialized) {
    return transporter;
  }

  transporterInitialized = true;

  if (!env.BREVO_SMTP_HOST || !env.BREVO_SMTP_USER || !env.BREVO_SMTP_PASS) {
    // Brevo SMTP is not fully configured for this environment (e.g. local
    // development). Emails will be logged instead of sent. This must never
    // silently fall back to the old Google SMTP_* configuration.
    console.error(
      '[mailer] Brevo SMTP is not configured (missing BREVO_SMTP_HOST, BREVO_SMTP_USER, and/or BREVO_SMTP_PASS). Emails will be logged instead of sent.',
    );
    return null;
  }

  transporter = nodemailer.createTransport({
    host: env.BREVO_SMTP_HOST,
    port: env.BREVO_SMTP_PORT,
    secure: env.BREVO_SMTP_SECURE,
    auth: { user: env.BREVO_SMTP_USER, pass: env.BREVO_SMTP_PASS },
  });

  return transporter;
}

/**
 * Sends a customer-facing email from the Grassland Cheese brand identity.
 * This never throws: a failure to send an email must never break registration,
 * checkout, or any other customer-facing flow. Failures are logged instead.
 */
export async function sendMail(message: MailMessage) {
  const activeTransporter = getTransporter();

  if (!activeTransporter) {
    console.log(`[mailer] SMTP not configured, skipping send. Would have sent "${message.subject}" to ${message.to}`);
    return { sent: false as const };
  }

  try {
    await activeTransporter.sendMail({
      from: BRAND_FROM,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    return { sent: true as const };
  } catch (error) {
    console.error(`[mailer] Failed to send "${message.subject}" to ${message.to}:`, error);
    return { sent: false as const };
  }
}
