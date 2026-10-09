import { BRAND_FROM_EMAIL, BRAND_FROM_NAME, env } from '../config.js';

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Sends a customer-facing email from the Grassland Cheese brand identity
 * using the Brevo HTTPS Transactional Email API (not SMTP). Railway Hobby
 * blocks/times out outbound SMTP connections, so this avoids the
 * `ETIMEDOUT` / `command: 'CONN'` failures seen with the previous BREVO_SMTP_*
 * based transport.
 *
 * This never throws: a failure to send an email must never break
 * registration, checkout, or any other customer-facing flow. Failures are
 * logged instead.
 */
export async function sendMail(message: MailMessage) {
  if (!env.BREVO_API_KEY) {
    console.error(
      '[mailer] Brevo API key is not configured (missing BREVO_API_KEY). Emails will be logged instead of sent.',
    );
    console.log(`[mailer] Brevo API not configured, skipping send. Would have sent "${message.subject}" to ${message.to}`);
    return { sent: false as const };
  }

  try {
    const body: any = {
      sender: { name: BRAND_FROM_NAME, email: BRAND_FROM_EMAIL },
      to: [{ email: message.to }],
      subject: message.subject,
      htmlContent: message.html,
      textContent: message.text,
    };

    // Add replyTo if provided
    if (message.replyTo) {
      body.replyTo = { email: message.replyTo };
    }

    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'api-key': env.BREVO_API_KEY,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Brevo API responded with ${response.status} ${response.statusText}: ${body}`);
    }

    return { sent: true as const };
  } catch (error) {
    console.error(`[mailer] Failed to send "${message.subject}" to ${message.to}:`, error);
    return { sent: false as const };
  }
}
