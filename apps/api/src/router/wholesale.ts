import { z } from 'zod';
import { ADMIN_EMAIL, env } from '../config.js';
import {
  buildWholesaleApplicationAcknowledgementEmail,
  buildWholesaleApplicationAdminEmail,
} from '../lib/emailTemplates.js';
import { sendMail } from '../lib/mailer.js';
import { wholesaleApplicationSchema, mapZodErrorsToFieldErrors } from '../lib/wholesaleValidation.js';
import { adminProcedure, publicProcedure, router } from './trpc.js';

export const wholesaleRouter = router({
  // Public: no customer login required to submit wholesale application
  submitApplication: publicProcedure.input(wholesaleApplicationSchema).mutation(async ({ ctx, input }) => {
    let applicationId: number | undefined;

    // STAGE 1: Validate input data
    try {
      // Validation already done by Zod schema above, but we can log it
      console.log(
        `[wholesale] Validation passed. businessType="${input.businessType}", nzbn="${input.nzbn ?? 'N/A'}"`,
      );
    } catch (error) {
      console.error('[wholesale] Stage: validate - Unexpected error during validation:', error);
      throw new Error(
        'Sorry, something went wrong submitting your application. Please try again or contact us.',
      );
    }

    // STAGE 2: Save application to database
    try {
      const application = await ctx.prisma.wholesaleApplication.create({
        data: {
          businessName: input.businessName,
          businessType: input.businessType,
          nzbn: input.nzbn,
          contactName: input.contactName,
          email: input.email,
          phone: input.phone,
          deliveryAddress: input.deliveryAddress,
          estimatedVolume: input.estimatedVolume,
          productsOfInterest: input.productsOfInterest,
          message: input.message,
        },
      });
      applicationId = application.id;
      console.log(`[wholesale] Stage: save application - SUCCESS. applicationId=${applicationId}`);
    } catch (error) {
      console.error(
        `[wholesale] Stage: save application - FAILED. businessName="${input.businessName}", email="${input.email}"`,
      );
      console.error(`[wholesale] Database error details:`, error);
      throw new Error(
        'Sorry, something went wrong submitting your application. Please try again or contact us.',
      );
    }

    // STAGE 3: Send admin notification email (non-blocking - success doesn't depend on this)
    if (ADMIN_EMAIL) {
      try {
        const adminEmail = buildWholesaleApplicationAdminEmail({
          businessName: input.businessName,
          businessType: input.businessType,
          nzbn: input.nzbn,
          contactName: input.contactName,
          email: input.email,
          phone: input.phone,
          deliveryAddress: input.deliveryAddress,
          estimatedVolume: input.estimatedVolume,
          productsOfInterest: input.productsOfInterest,
          message: input.message,
        });
        const adminResult = await sendMail({
          to: ADMIN_EMAIL,
          ...adminEmail,
          replyTo: input.email,
        });
        if (!adminResult.sent) {
          console.error(
            `[wholesale] Stage: send admin email - FAILED for applicationId=${applicationId}. to="${ADMIN_EMAIL}". See mailer logs above for the Brevo error.`,
          );
        } else {
          console.log(
            `[wholesale] Stage: send admin email - SUCCESS for applicationId=${applicationId}. to="${ADMIN_EMAIL}"`,
          );
        }
      } catch (error) {
        console.error(
          `[wholesale] Stage: send admin email - ERROR for applicationId=${applicationId}. Unexpected error:`,
          error,
        );
      }
    } else {
      console.warn(
        `[wholesale] Stage: send admin email - SKIPPED. ADMIN_EMAIL is not configured for applicationId=${applicationId}`,
      );
    }

    // STAGE 4: Send customer acknowledgement email (non-blocking - success doesn't depend on this)
    try {
      const acknowledgementEmail = buildWholesaleApplicationAcknowledgementEmail({
        contactName: input.contactName,
      });
      const customerResult = await sendMail({
        to: input.email,
        ...acknowledgementEmail,
      });
      if (!customerResult.sent) {
        console.error(
          `[wholesale] Stage: send customer email - FAILED for applicationId=${applicationId}. to="${input.email}". See mailer logs above for the Brevo error.`,
        );
      } else {
        console.log(
          `[wholesale] Stage: send customer email - SUCCESS for applicationId=${applicationId}. to="${input.email}"`,
        );
      }
    } catch (error) {
      console.error(
        `[wholesale] Stage: send customer email - ERROR for applicationId=${applicationId}. Unexpected error:`,
        error,
      );
    }

    return { ok: true as const, applicationId };
  }),

  // Admin: get all wholesale applications
  getApplications: adminProcedure.query(async ({ ctx }) => {
    const applications = await ctx.prisma.wholesaleApplication.findMany({
      orderBy: { createdAt: 'desc' },
      include: { customer: true },
    });
    return applications;
  }),

  // Admin: update application status and create/update customer if approved
  approveApplication: adminProcedure
    .input(
      z.object({
        applicationId: z.number(),
        status: z.enum(['APPROVED', 'REJECTED']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const application = await ctx.prisma.wholesaleApplication.findUnique({
        where: { id: input.applicationId },
        include: { customer: true },
      });

      if (!application) {
        throw new Error('Application not found');
      }

      // Update the application status
      const updated = await ctx.prisma.wholesaleApplication.update({
        where: { id: input.applicationId },
        data: {
          status: input.status,
        },
      });

      // If approving, ensure customer exists and mark as wholesale
      if (input.status === 'APPROVED') {
        let customer = application.customer;
        if (!customer) {
          // Create a placeholder customer account for approved applications without an account yet
          customer = await ctx.prisma.customer.create({
            data: {
              name: application.contactName,
              email: application.email,
              passwordHash: '', // No password set - they'll need to reset it or the admin will create it
              type: 'WHOLESALE',
              accountSource: 'STAFF_CREATED',
              wholesaleApprovedAt: new Date(),
            },
          });
        } else {
          // Update existing customer to WHOLESALE type and mark as approved
          customer = await ctx.prisma.customer.update({
            where: { id: customer.id },
            data: {
              type: 'WHOLESALE',
              wholesaleApprovedAt: new Date(),
            },
          });
        }

        // Link the customer to the application
        await ctx.prisma.wholesaleApplication.update({
          where: { id: input.applicationId },
          data: { customerId: customer.id },
        });
      }

      return { ok: true as const, updated };
    }),

  // Admin: health check for email configuration
  checkEmailConfig: adminProcedure.query(async () => {
    const missingVars: string[] = [];
    const configuredVars: string[] = [];

    if (!ADMIN_EMAIL) {
      missingVars.push('ADMIN_EMAIL');
    } else {
      configuredVars.push(`ADMIN_EMAIL=${ADMIN_EMAIL}`);
    }

    if (!env.BREVO_API_KEY) {
      missingVars.push('BREVO_API_KEY');
    } else {
      configuredVars.push('BREVO_API_KEY=****(configured)');
    }

    configuredVars.push(`MAIL_FROM=${env.MAIL_FROM || '(using default)'}`);

    return {
      configured: configuredVars,
      missing: missingVars,
      readyToSend: missingVars.length === 0,
      summary: missingVars.length === 0 ? 'Email is configured and ready.' : `Missing env vars: ${missingVars.join(', ')}`,
    };
  }),

  // Dev-only: send a test email to verify Brevo configuration
  sendTestEmail: adminProcedure
    .input(z.object({ to: z.string().email() }))
    .mutation(async ({ input }) => {
      const result = await sendMail({
        to: input.to,
        subject: '[TEST] Grassland Cheese Email Configuration Test',
        html: '<p>This is a test email to verify Brevo email configuration is working correctly.</p>',
        text: 'This is a test email to verify Brevo email configuration is working correctly.',
      });

      if (!result.sent) {
        console.error(`[wholesale] Test email send failed`);
        throw new Error('Failed to send test email. Check server logs for details.');
      }

      return {
        ok: true as const,
        message: `Test email sent to ${input.to}`,
      };
    }),
});
