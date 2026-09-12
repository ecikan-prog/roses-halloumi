import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { StaffRole, CustomerType } from '@prisma/client';
import { env } from '../config.js';

export type SessionUser =
  | {
      kind: 'staff';
      id: number;
      name: string;
      email: string;
      role: StaffRole;
    }
  | {
      kind: 'customer';
      id: number;
      name: string;
      email: string;
      type: CustomerType;
      contact: string | null;
    };

export type TokenPayload =
  | {
      kind: 'staff';
      id: number;
      role: StaffRole;
      email: string;
      name: string;
    }
  | {
      kind: 'customer';
      id: number;
      type: CustomerType;
      email: string;
      name: string;
      contact: string | null;
    };

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: TokenPayload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string) {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}
