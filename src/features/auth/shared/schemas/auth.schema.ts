/**
 * @fileoverview Authentication validation schemas using Zod
 * Epic 0: Developer Experience & Testing Infrastructure
 */

import { z } from 'zod';

/**
 * Branded types schemas
 */
export const UserIdSchema = z.string().uuid().brand<'UserId'>();
export const SessionIdSchema = z.string().uuid().brand<'SessionId'>();
export const TokenHashSchema = z.string().min(64).brand<'TokenHash'>();

/**
 * Email validation schema
 */
export const EmailSchema = z
  .string()
  .email('Invalid email address')
  .toLowerCase()
  .trim();

/**
 * Password validation schema
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    'Password must contain uppercase, lowercase, number and special character'
  );

/**
 * Login request schema
 */
export const LoginRequestSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Password is required'),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/**
 * Signup request schema
 */
export const SignupRequestSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  name: z.string().min(1, 'Name is required').max(100).optional(),
});

export type SignupRequest = z.infer<typeof SignupRequestSchema>;

/**
 * Forgot password request schema
 */
export const ForgotPasswordRequestSchema = z.object({
  email: EmailSchema,
});

export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;

/**
 * Reset password request schema
 */
export const ResetPasswordRequestSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: PasswordSchema,
});

export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;

/**
 * Verify email request schema
 */
export const VerifyEmailRequestSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export type VerifyEmailRequest = z.infer<typeof VerifyEmailRequestSchema>;

/**
 * Refresh token request schema
 */
export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;

/**
 * User schema for database
 */
export const UserSchema = z.object({
  id: UserIdSchema,
  email: EmailSchema,
  name: z.string().nullable().optional(),
  emailVerified: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;

/**
 * Session schema for database
 */
export const SessionSchema = z.object({
  id: SessionIdSchema,
  userId: UserIdSchema,
  tokenHash: TokenHashSchema,
  refreshTokenHash: TokenHashSchema.optional(),
  expiresAt: z.date(),
  lastAccessed: z.date(),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
  createdAt: z.date(),
});

export type Session = z.infer<typeof SessionSchema>;