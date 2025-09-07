/**
 * @fileoverview Authentication types for Atomic Guide
 * Epic 0: Developer Experience & Testing Infrastructure
 */

import { z } from 'zod';

// Brand types for type safety
export type UserId = string & { readonly brand: unique symbol };
export type SessionId = string & { readonly brand: unique symbol };
export type TokenHash = string & { readonly brand: unique symbol };

/**
 * User entity from database
 */
export interface User {
  id: UserId;
  email: string;
  name?: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User session entity
 */
export interface UserSession {
  id: SessionId;
  userId: UserId;
  tokenHash: TokenHash;
  refreshTokenHash?: TokenHash;
  expiresAt: Date;
  lastAccessed: Date;
  userAgent?: string;
  ipAddress?: string;
  createdAt: Date;
}

/**
 * JWT payload structure
 */
export interface JWTPayload {
  userId: UserId;
  email: string;
  sessionId: SessionId;
  iat: number;
  exp: number;
}

/**
 * Password reset token entity
 */
export interface PasswordResetToken {
  id: string;
  userId: UserId;
  token: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

/**
 * Email verification token entity
 */
export interface EmailVerificationToken {
  id: string;
  userId: UserId;
  token: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

/**
 * Auth response types
 */
export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export interface LoginResponse extends AuthResponse {}

export interface SignupResponse extends AuthResponse {
  emailVerificationSent: boolean;
}

export interface RefreshTokenResponse {
  token: string;
  refreshToken: string;
}

/**
 * Auth error types
 */
export enum AuthError {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  RATE_LIMITED = 'RATE_LIMITED',
}