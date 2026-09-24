import { z } from 'zod';
import { ADMIN_EMAIL } from '../config.js';
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
    try {
      // Create the application
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

      // Send admin notification
      if (ADMIN_EMAIL) {
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
        const adminResult = await sendMail({ to: ADMIN_EMAIL, ...adminEmail });
        if (!adminResult.sent) {
          console.error(
            `[wholesale] Failed to send admin notification for wholesale application to ${ADMIN_EMAIL}. See mailer logs above for the Brevo error.`,
          );
        }
      } else {
        console.error('[wholesale] ADMIN_EMAIL is not configured; skipping admin notification for wholesale application.');
      }

      // Send acknowledgement email to applicant
      const acknowledgementEmail = buildWholesaleApplicationAcknowledgementEmail({
        contactName: input.contactName,
      });
      void sendMail({ to: input.email, ...acknowledgementEmail });

      return { ok: true as const, applicationId: application.id };
    } catch (error) {
      console.error('[wholesale] Error submitting wholesale application:', error);
      throw new Error(
        'Sorry, something went wrong submitting your application. Please try again or contact us.',
      );
    }
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
});
