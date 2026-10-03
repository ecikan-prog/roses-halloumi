import { z } from 'zod';
import { ADMIN_EMAIL } from '../config.js';
import {
  buildGeneralContactAcknowledgementEmail,
  buildGeneralContactAdminEmail,
  buildWholesaleEnquiryAcknowledgementEmail,
  buildWholesaleEnquiryAdminEmail,
} from '../lib/emailTemplates.js';
import { sendMail } from '../lib/mailer.js';
import { publicProcedure, router } from './trpc.js';

// Sensible maximum lengths to prevent abuse of these unauthenticated
// endpoints. These are generous enough for legitimate enquiries while
// keeping payload/email sizes bounded.
const NAME_MAX_LENGTH = 200;
const EMAIL_MAX_LENGTH = 254;
const PHONE_MAX_LENGTH = 40;
const LOCATION_MAX_LENGTH = 300;
const MESSAGE_MAX_LENGTH = 5000;

// Trimmed, non-empty string with a maximum length. Used for every text field
// below so submissions are always normalized and bounded server-side,
// regardless of what the frontend does.
function trimmedString(maxLength: number, minLength = 1) {
  return z
    .string()
    .trim()
    .min(minLength, 'This field is required.')
    .max(maxLength, `Must be ${maxLength} characters or fewer.`);
}

const emailField = z.string().trim().toLowerCase().email('Enter a valid email address.').max(EMAIL_MAX_LENGTH);

const optionalPhoneField = z
  .string()
  .trim()
  .max(PHONE_MAX_LENGTH, `Must be ${PHONE_MAX_LENGTH} characters or fewer.`)
  .optional()
  .transform((value) => (value ? value : undefined));

const generalEnquiryTypeEnum = z.enum(['GENERAL', 'PRODUCT', 'ORDER', 'DELIVERY', 'OTHER']);

const generalEnquirySchema = z.object({
  name: trimmedString(NAME_MAX_LENGTH),
  email: emailField,
  phone: optionalPhoneField,
  enquiryType: generalEnquiryTypeEnum,
  message: trimmedString(MESSAGE_MAX_LENGTH),
});

const wholesaleEnquirySchema = z.object({
  businessName: trimmedString(NAME_MAX_LENGTH),
  contactName: trimmedString(NAME_MAX_LENGTH),
  email: emailField,
  phone: optionalPhoneField,
  businessLocation: trimmedString(LOCATION_MAX_LENGTH),
  message: trimmedString(MESSAGE_MAX_LENGTH),
});

export const contactRouter = router({
  // Public: customer login must not be required to submit a general contact
  // enquiry.
  submitGeneral: publicProcedure.input(generalEnquirySchema).mutation(async ({ input }) => {
    if (ADMIN_EMAIL) {
      const adminEmail = buildGeneralContactAdminEmail({
        name: input.name,
        email: input.email,
        phone: input.phone,
        enquiryType: input.enquiryType,
        message: input.message,
      });
      const adminResult = await sendMail({ to: ADMIN_EMAIL, ...adminEmail });
      if (!adminResult.sent) {
        console.error(
          `[contact] Failed to send admin notification for general enquiry to ${ADMIN_EMAIL}. See mailer logs above for the Brevo error.`,
        );
      }
    } else {
      console.error('[contact] ADMIN_EMAIL is not configured; skipping admin notification for general enquiry.');
    }

    const acknowledgementEmail = buildGeneralContactAcknowledgementEmail({
      name: input.name,
      enquiryType: input.enquiryType,
    });
    void sendMail({ to: input.email, ...acknowledgementEmail });

    return { ok: true as const };
  }),
  // Public: customer login must not be required to submit a wholesale
  // enquiry.
  submitWholesale: publicProcedure.input(wholesaleEnquirySchema).mutation(async ({ input }) => {
    if (ADMIN_EMAIL) {
      const adminEmail = buildWholesaleEnquiryAdminEmail({
        businessName: input.businessName,
        contactName: input.contactName,
        email: input.email,
        phone: input.phone,
        businessLocation: input.businessLocation,
        message: input.message,
      });
      const adminResult = await sendMail({ to: ADMIN_EMAIL, ...adminEmail });
      if (!adminResult.sent) {
        console.error(
          `[contact] Failed to send admin notification for wholesale enquiry to ${ADMIN_EMAIL}. See mailer logs above for the Brevo error.`,
        );
      }
    } else {
      console.error('[contact] ADMIN_EMAIL is not configured; skipping admin notification for wholesale enquiry.');
    }

    const acknowledgementEmail = buildWholesaleEnquiryAcknowledgementEmail({ contactName: input.contactName });
    void sendMail({ to: input.email, ...acknowledgementEmail });

    return { ok: true as const };
  }),
});
