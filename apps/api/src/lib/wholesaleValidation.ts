import { z } from 'zod';

// Sensible maximum lengths to prevent abuse of these unauthenticated endpoints.
const NAME_MAX_LENGTH = 200;
const EMAIL_MAX_LENGTH = 254;
const PHONE_MAX_LENGTH = 40;
const ADDRESS_MAX_LENGTH = 500;
const VOLUME_MAX_LENGTH = 100;
const PRODUCTS_MAX_LENGTH = 500;
const MESSAGE_MAX_LENGTH = 1000;

function trimmedString(maxLength: number, minLength = 1) {
  return z
    .string()
    .trim()
    .min(minLength, 'This field is required.')
    .max(maxLength, `Must be ${maxLength} characters or fewer.`);
}

/**
 * Validates an NZBN (New Zealand Business Number).
 * Must be exactly 13 digits.
 * Accepts input with spaces and dashes which are stripped before validation.
 */
function nzbFieldSchema() {
  return z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      // Strip spaces and dashes
      return value.replace(/[\s-]/g, '');
    })
    .pipe(
      z
        .string()
        .refine(
          (value) => !value || /^\d{13}$/.test(value),
          'Please enter a valid 13-digit NZBN.',
        )
        .transform((value) => (value ? value : undefined))
        .optional(),
    );
}

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .email('Please enter a valid email address.')
  .max(EMAIL_MAX_LENGTH, `Must be ${EMAIL_MAX_LENGTH} characters or fewer.`);

const optionalPhoneField = z
  .string()
  .trim()
  .max(PHONE_MAX_LENGTH, `Phone must be ${PHONE_MAX_LENGTH} characters or fewer.`)
  .optional()
  .transform((value) => (value ? value : undefined));

const businessTypeEnum = z.enum(['CAFÉ', 'RESTAURANT', 'DELI', 'RETAILER', 'DISTRIBUTOR', 'OTHER']);

export const wholesaleApplicationSchema = z.object({
  businessName: trimmedString(NAME_MAX_LENGTH),
  businessType: businessTypeEnum,
  nzbn: nzbFieldSchema(),
  contactName: trimmedString(NAME_MAX_LENGTH),
  email: emailField,
  phone: optionalPhoneField,
  deliveryAddress: trimmedString(ADDRESS_MAX_LENGTH),
  estimatedVolume: trimmedString(VOLUME_MAX_LENGTH, 0).optional(),
  productsOfInterest: trimmedString(PRODUCTS_MAX_LENGTH, 0).optional(),
  message: trimmedString(MESSAGE_MAX_LENGTH, 0).optional(),
  // Honeypot field - should be empty if submitted by legitimate user
  website: z.string().max(0).optional(),
});

export type WholesaleApplicationInput = z.infer<typeof wholesaleApplicationSchema>;

/**
 * Maps Zod validation errors to field-level errors.
 * Returns an object where keys are field names and values are error messages.
 */
export function mapZodErrorsToFieldErrors(
  error: z.ZodError,
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const fieldName = issue.path.join('.');
    if (fieldName && !fieldErrors[fieldName]) {
      fieldErrors[fieldName] = issue.message;
    }
  }

  return fieldErrors;
}
