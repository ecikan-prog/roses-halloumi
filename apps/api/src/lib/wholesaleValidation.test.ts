import { describe, it, expect } from 'vitest';
import { wholesaleApplicationSchema, mapZodErrorsToFieldErrors } from './wholesaleValidation.js';
import { z } from 'zod';

describe('wholesaleApplicationSchema', () => {
  describe('NZBN validation', () => {
    it('accepts valid 13-digit NZBN', () => {
      const result = wholesaleApplicationSchema.safeParse({
        businessName: 'Test Business',
        businessType: 'CAFÉ',
        nzbn: '9429000000000',
        contactName: 'John Doe',
        email: 'test@example.com',
        phone: '0212345678',
        deliveryAddress: '123 Main St',
        estimatedVolume: '100kg',
        productsOfInterest: 'Halloumi',
        message: 'Test message',
        website: '',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.nzbn).toBe('9429000000000');
      }
    });

    it('accepts NZBN with spaces', () => {
      const result = wholesaleApplicationSchema.safeParse({
        businessName: 'Test Business',
        businessType: 'CAFÉ',
        nzbn: '9429 0000 00000',
        contactName: 'John Doe',
        email: 'test@example.com',
        phone: '0212345678',
        deliveryAddress: '123 Main St',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.nzbn).toBe('9429000000000');
      }
    });

    it('accepts NZBN with dashes', () => {
      const result = wholesaleApplicationSchema.safeParse({
        businessName: 'Test Business',
        businessType: 'CAFÉ',
        nzbn: '9429-0000-00000',
        contactName: 'John Doe',
        email: 'test@example.com',
        phone: '0212345678',
        deliveryAddress: '123 Main St',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.nzbn).toBe('9429000000000');
      }
    });

    it('accepts NZBN with spaces and dashes', () => {
      const result = wholesaleApplicationSchema.safeParse({
        businessName: 'Test Business',
        businessType: 'CAFÉ',
        nzbn: '9429 0000-00000',
        contactName: 'John Doe',
        email: 'test@example.com',
        phone: '0212345678',
        deliveryAddress: '123 Main St',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.nzbn).toBe('9429000000000');
      }
    });

    it('accepts empty/undefined NZBN', () => {
      const result = wholesaleApplicationSchema.safeParse({
        businessName: 'Test Business',
        businessType: 'CAFÉ',
        contactName: 'John Doe',
        email: 'test@example.com',
        phone: '0212345678',
        deliveryAddress: '123 Main St',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.nzbn).toBeUndefined();
      }
    });

    it('rejects NZBN with invalid length (too short)', () => {
      const result = wholesaleApplicationSchema.safeParse({
        businessName: 'Test Business',
        businessType: 'CAFÉ',
        nzbn: '942900000000', // Only 12 digits
        contactName: 'John Doe',
        email: 'test@example.com',
        phone: '0212345678',
        deliveryAddress: '123 Main St',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Please enter a valid 13-digit NZBN.');
      }
    });

    it('rejects NZBN with invalid length (too long)', () => {
      const result = wholesaleApplicationSchema.safeParse({
        businessName: 'Test Business',
        businessType: 'CAFÉ',
        nzbn: '94290000000000', // 14 digits
        contactName: 'John Doe',
        email: 'test@example.com',
        phone: '0212345678',
        deliveryAddress: '123 Main St',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Please enter a valid 13-digit NZBN.');
      }
    });

    it('rejects NZBN with non-numeric characters', () => {
      const result = wholesaleApplicationSchema.safeParse({
        businessName: 'Test Business',
        businessType: 'CAFÉ',
        nzbn: '942900000000a',
        contactName: 'John Doe',
        email: 'test@example.com',
        phone: '0212345678',
        deliveryAddress: '123 Main St',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Please enter a valid 13-digit NZBN.');
      }
    });
  });

  describe('Email validation', () => {
    it('accepts valid email', () => {
      const result = wholesaleApplicationSchema.safeParse({
        businessName: 'Test Business',
        businessType: 'CAFÉ',
        contactName: 'John Doe',
        email: 'test@example.com',
        phone: '0212345678',
        deliveryAddress: '123 Main St',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('test@example.com');
      }
    });

    it('rejects invalid email', () => {
      const result = wholesaleApplicationSchema.safeParse({
        businessName: 'Test Business',
        businessType: 'CAFÉ',
        contactName: 'John Doe',
        email: 'not-an-email',
        phone: '0212345678',
        deliveryAddress: '123 Main St',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('valid email');
      }
    });

    it('lowercases email', () => {
      const result = wholesaleApplicationSchema.safeParse({
        businessName: 'Test Business',
        businessType: 'CAFÉ',
        contactName: 'John Doe',
        email: 'Test@Example.COM',
        phone: '0212345678',
        deliveryAddress: '123 Main St',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('test@example.com');
      }
    });
  });

  describe('Phone validation', () => {
    it('accepts valid phone number', () => {
      const result = wholesaleApplicationSchema.safeParse({
        businessName: 'Test Business',
        businessType: 'CAFÉ',
        contactName: 'John Doe',
        email: 'test@example.com',
        phone: '0212345678',
        deliveryAddress: '123 Main St',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.phone).toBe('0212345678');
      }
    });

    it('accepts phone with spaces and dashes', () => {
      const result = wholesaleApplicationSchema.safeParse({
        businessName: 'Test Business',
        businessType: 'CAFÉ',
        contactName: 'John Doe',
        email: 'test@example.com',
        phone: '+64 21 234 5678',
        deliveryAddress: '123 Main St',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.phone).toBe('+64 21 234 5678');
      }
    });

    it('accepts empty phone (optional)', () => {
      const result = wholesaleApplicationSchema.safeParse({
        businessName: 'Test Business',
        businessType: 'CAFÉ',
        contactName: 'John Doe',
        email: 'test@example.com',
        phone: '',
        deliveryAddress: '123 Main St',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.phone).toBeUndefined();
      }
    });

    it('rejects phone that is too long', () => {
      const result = wholesaleApplicationSchema.safeParse({
        businessName: 'Test Business',
        businessType: 'CAFÉ',
        contactName: 'John Doe',
        email: 'test@example.com',
        phone: '0212345678901234567890123456789012345678901',
        deliveryAddress: '123 Main St',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('characters or fewer');
      }
    });
  });

  describe('Required fields', () => {
    it('rejects missing business name', () => {
      const result = wholesaleApplicationSchema.safeParse({
        businessType: 'CAFÉ',
        contactName: 'John Doe',
        email: 'test@example.com',
        phone: '0212345678',
        deliveryAddress: '123 Main St',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path[0]).toBe('businessName');
      }
    });

    it('rejects missing contact name', () => {
      const result = wholesaleApplicationSchema.safeParse({
        businessName: 'Test Business',
        businessType: 'CAFÉ',
        email: 'test@example.com',
        phone: '0212345678',
        deliveryAddress: '123 Main St',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path[0]).toBe('contactName');
      }
    });

    it('rejects missing email', () => {
      const result = wholesaleApplicationSchema.safeParse({
        businessName: 'Test Business',
        businessType: 'CAFÉ',
        contactName: 'John Doe',
        phone: '0212345678',
        deliveryAddress: '123 Main St',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path[0]).toBe('email');
      }
    });

    it('rejects missing delivery address', () => {
      const result = wholesaleApplicationSchema.safeParse({
        businessName: 'Test Business',
        businessType: 'CAFÉ',
        contactName: 'John Doe',
        email: 'test@example.com',
        phone: '0212345678',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path[0]).toBe('deliveryAddress');
      }
    });
  });

  describe('Optional fields', () => {
    it('accepts valid optional fields', () => {
      const result = wholesaleApplicationSchema.safeParse({
        businessName: 'Test Business',
        businessType: 'CAFÉ',
        contactName: 'John Doe',
        email: 'test@example.com',
        phone: '0212345678',
        deliveryAddress: '123 Main St',
        nzbn: '9429000000000',
        estimatedVolume: '500 kg per month',
        productsOfInterest: 'Halloumi 500g, Halloumi 200g',
        message: 'Interested in wholesale pricing',
      });

      expect(result.success).toBe(true);
    });

    it('accepts missing optional fields', () => {
      const result = wholesaleApplicationSchema.safeParse({
        businessName: 'Test Business',
        businessType: 'CAFÉ',
        contactName: 'John Doe',
        email: 'test@example.com',
        deliveryAddress: '123 Main St',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.nzbn).toBeUndefined();
        expect(result.data.phone).toBeUndefined();
        expect(result.data.estimatedVolume).toBeUndefined();
        expect(result.data.productsOfInterest).toBeUndefined();
        expect(result.data.message).toBeUndefined();
      }
    });
  });

  describe('Field length limits', () => {
    it('accepts business name at max length', () => {
      const longName = 'A'.repeat(200);
      const result = wholesaleApplicationSchema.safeParse({
        businessName: longName,
        businessType: 'CAFÉ',
        contactName: 'John Doe',
        email: 'test@example.com',
        phone: '0212345678',
        deliveryAddress: '123 Main St',
      });

      expect(result.success).toBe(true);
    });

    it('rejects business name over max length', () => {
      const longName = 'A'.repeat(201);
      const result = wholesaleApplicationSchema.safeParse({
        businessName: longName,
        businessType: 'CAFÉ',
        contactName: 'John Doe',
        email: 'test@example.com',
        phone: '0212345678',
        deliveryAddress: '123 Main St',
      });

      expect(result.success).toBe(false);
    });

    it('accepts message at max length', () => {
      const longMessage = 'A'.repeat(1000);
      const result = wholesaleApplicationSchema.safeParse({
        businessName: 'Test Business',
        businessType: 'CAFÉ',
        contactName: 'John Doe',
        email: 'test@example.com',
        phone: '0212345678',
        deliveryAddress: '123 Main St',
        message: longMessage,
      });

      expect(result.success).toBe(true);
    });

    it('rejects message over max length', () => {
      const longMessage = 'A'.repeat(1001);
      const result = wholesaleApplicationSchema.safeParse({
        businessName: 'Test Business',
        businessType: 'CAFÉ',
        contactName: 'John Doe',
        email: 'test@example.com',
        phone: '0212345678',
        deliveryAddress: '123 Main St',
        message: longMessage,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Honeypot field', () => {
    it('accepts empty website field', () => {
      const result = wholesaleApplicationSchema.safeParse({
        businessName: 'Test Business',
        businessType: 'CAFÉ',
        contactName: 'John Doe',
        email: 'test@example.com',
        phone: '0212345678',
        deliveryAddress: '123 Main St',
        website: '',
      });

      expect(result.success).toBe(true);
    });

    it('rejects non-empty website field (honeypot)', () => {
      const result = wholesaleApplicationSchema.safeParse({
        businessName: 'Test Business',
        businessType: 'CAFÉ',
        contactName: 'John Doe',
        email: 'test@example.com',
        phone: '0212345678',
        deliveryAddress: '123 Main St',
        website: 'https://spam.com',
      });

      expect(result.success).toBe(false);
    });
  });
});

describe('mapZodErrorsToFieldErrors', () => {
  it('maps single field error correctly', () => {
    const schema = z.object({
      email: z.string().email('Invalid email'),
    });

    const result = schema.safeParse({ email: 'not-an-email' });
    if (!result.success) {
      const fieldErrors = mapZodErrorsToFieldErrors(result.error);
      expect(fieldErrors.email).toBe('Invalid email');
    }
  });

  it('maps multiple field errors correctly', () => {
    const schema = z.object({
      email: z.string().email('Invalid email'),
      phone: z.string().min(10, 'Phone too short'),
    });

    const result = schema.safeParse({ email: 'not-an-email', phone: '123' });
    if (!result.success) {
      const fieldErrors = mapZodErrorsToFieldErrors(result.error);
      expect(fieldErrors.email).toBe('Invalid email');
      expect(fieldErrors.phone).toBe('Phone too short');
    }
  });

  it('handles nested field paths', () => {
    const schema = z.object({
      address: z.object({
        street: z.string().min(1, 'Street required'),
      }),
    });

    const result = schema.safeParse({ address: { street: '' } });
    if (!result.success) {
      const fieldErrors = mapZodErrorsToFieldErrors(result.error);
      expect(fieldErrors['address.street']).toBe('Street required');
    }
  });

  it('takes only the first error for duplicate field errors', () => {
    const schema = z.object({
      email: z
        .string()
        .min(1, 'First error')
        .email('Second error'),
    });

    const result = schema.safeParse({ email: '' });
    if (!result.success) {
      const fieldErrors = mapZodErrorsToFieldErrors(result.error);
      expect(fieldErrors.email).toBe('First error');
    }
  });
});
