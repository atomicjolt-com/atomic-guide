/**
 * @fileoverview Authentication service for Atomic Guide
 * Epic 0: Developer Experience & Testing Infrastructure
 */

import * as bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
// Use Web Crypto API instead of Node crypto
import { UserRepository } from '../repositories/user.repository';
import { EmailService } from './email.service';
import { 
  LoginRequestSchema, 
  SignupRequestSchema,
  ForgotPasswordRequestSchema,
  ResetPasswordRequestSchema,
  VerifyEmailRequestSchema,
  RefreshTokenRequestSchema,
  TokenHashSchema,
  UserIdSchema,
  SessionIdSchema
} from '../../shared/schemas/auth.schema';
import type {
  User,
  UserSession,
  AuthResponse,
  LoginResponse,
  SignupResponse,
  RefreshTokenResponse,
  JWTPayload,
  TokenHash
} from '../../shared/types/auth.types';
import { AuthError } from '../../shared/types/auth.types';

export class AuthService {
  private readonly JWT_SECRET: Uint8Array;
  private readonly JWT_EXPIRY = '24h';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';
  private readonly BCRYPT_ROUNDS = 10;

  constructor(
    private userRepository: UserRepository,
    private emailService: EmailService,
    jwtSecret: string
  ) {
    // Convert JWT secret to Uint8Array for jose
    this.JWT_SECRET = new TextEncoder().encode(jwtSecret);
  }

  /**
   * Hash a token for storage using Web Crypto API
   */
  private async hashToken(token: string): Promise<TokenHash> {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return TokenHashSchema.parse(hashHex);
  }

  /**
   * Generate JWT token
   */
  private async generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
    return await new SignJWT(payload as any)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(this.JWT_EXPIRY)
      .sign(this.JWT_SECRET);
  }

  /**
   * Generate refresh token
   */
  private async generateRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
    return await new SignJWT(payload as any)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(this.REFRESH_TOKEN_EXPIRY)
      .sign(this.JWT_SECRET);
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token: string): Promise<JWTPayload> {
    try {
      const { payload } = await jwtVerify(token, this.JWT_SECRET);
      return payload as unknown as JWTPayload;
    } catch (error) {
      throw new Error(AuthError.TOKEN_INVALID);
    }
  }

  /**
   * Login user
   */
  async login(request: unknown, userAgent?: string, ipAddress?: string): Promise<LoginResponse> {
    const { email, password } = LoginRequestSchema.parse(request);

    // Find user by email
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new Error(AuthError.INVALID_CREDENTIALS);
    }

    // Check password
    const passwordHash = await this.userRepository.getPasswordHash(email);
    if (!passwordHash) {
      throw new Error(AuthError.INVALID_CREDENTIALS);
    }

    const isValidPassword = await bcrypt.compare(password, passwordHash);
    if (!isValidPassword) {
      throw new Error(AuthError.INVALID_CREDENTIALS);
    }

    // Check if email is verified
    if (!user.emailVerified) {
      throw new Error(AuthError.EMAIL_NOT_VERIFIED);
    }

    // Generate tokens (using Web Crypto API)
    const sessionId = SessionIdSchema.parse(crypto.randomUUID());
    const token = await this.generateToken({
      userId: user.id,
      email: user.email,
      sessionId
    });
    const refreshToken = await this.generateRefreshToken({
      userId: user.id,
      email: user.email,
      sessionId
    });

    // Create session
    await this.userRepository.createSession({
      userId: user.id,
      tokenHash: await this.hashToken(token),
      refreshTokenHash: await this.hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 86400000), // 24 hours
      userAgent,
      ipAddress
    });

    return {
      user,
      token,
      refreshToken
    };
  }

  /**
   * Sign up new user
   */
  async signup(request: unknown, userAgent?: string, ipAddress?: string): Promise<SignupResponse> {
    const { email, password, name } = SignupRequestSchema.parse(request);

    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new Error(AuthError.EMAIL_ALREADY_EXISTS);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, this.BCRYPT_ROUNDS);

    // Create user
    const user = await this.userRepository.createUser({
      email,
      passwordHash,
      name
    });

    // Generate verification token
    const verificationToken = await this.userRepository.createEmailVerificationToken(user.id);

    // Send verification email
    await this.emailService.sendVerificationEmail(email, verificationToken);

    // Generate tokens (using Web Crypto API)
    const sessionId = SessionIdSchema.parse(crypto.randomUUID());
    const token = await this.generateToken({
      userId: user.id,
      email: user.email,
      sessionId
    });
    const refreshToken = await this.generateRefreshToken({
      userId: user.id,
      email: user.email,
      sessionId
    });

    // Create session
    await this.userRepository.createSession({
      userId: user.id,
      tokenHash: await this.hashToken(token),
      refreshTokenHash: await this.hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 86400000), // 24 hours
      userAgent,
      ipAddress
    });

    return {
      user,
      token,
      refreshToken,
      emailVerificationSent: true
    };
  }

  /**
   * Logout user
   */
  async logout(sessionId: string): Promise<void> {
    const validSessionId = SessionIdSchema.parse(sessionId);
    await this.userRepository.deleteSession(validSessionId);
  }

  /**
   * Logout all sessions for a user
   */
  async logoutAll(userId: string): Promise<void> {
    const validUserId = UserIdSchema.parse(userId);
    await this.userRepository.deleteUserSessions(validUserId);
  }

  /**
   * Forgot password - send reset email
   */
  async forgotPassword(request: unknown): Promise<void> {
    const { email } = ForgotPasswordRequestSchema.parse(request);

    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      // Don't reveal if user exists
      return;
    }

    // Generate reset token
    const resetToken = await this.userRepository.createPasswordResetToken(user.id);

    // Send reset email
    await this.emailService.sendPasswordResetEmail(email, resetToken);
  }

  /**
   * Reset password with token
   */
  async resetPassword(request: unknown): Promise<void> {
    const { token, password } = ResetPasswordRequestSchema.parse(request);

    // Find valid token
    const resetToken = await this.userRepository.findPasswordResetToken(token);
    if (!resetToken) {
      throw new Error(AuthError.TOKEN_INVALID);
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, this.BCRYPT_ROUNDS);

    // Update password
    await this.userRepository.updatePassword(resetToken.userId, passwordHash);

    // Mark token as used
    await this.userRepository.markPasswordResetTokenUsed(token);

    // Logout all sessions for security
    await this.userRepository.deleteUserSessions(resetToken.userId);
  }

  /**
   * Verify email with token
   */
  async verifyEmail(request: unknown): Promise<void> {
    const { token } = VerifyEmailRequestSchema.parse(request);

    // Find valid token
    const verificationToken = await this.userRepository.findEmailVerificationToken(token);
    if (!verificationToken) {
      throw new Error(AuthError.TOKEN_INVALID);
    }

    // Mark email as verified
    await this.userRepository.markEmailVerified(verificationToken.userId);

    // Mark token as used
    await this.userRepository.markEmailVerificationTokenUsed(token);
  }

  /**
   * Refresh access token
   */
  async refreshToken(request: unknown): Promise<RefreshTokenResponse> {
    const { refreshToken } = RefreshTokenRequestSchema.parse(request);

    // Verify refresh token
    let payload: JWTPayload;
    try {
      payload = await this.verifyToken(refreshToken);
    } catch {
      throw new Error(AuthError.TOKEN_INVALID);
    }

    // Find session
    const tokenHash = await this.hashToken(refreshToken);
    const session = await this.userRepository.findSessionByToken(tokenHash);
    if (!session) {
      throw new Error(AuthError.SESSION_EXPIRED);
    }

    // Generate new tokens
    const newToken = await this.generateToken({
      userId: payload.userId,
      email: payload.email,
      sessionId: payload.sessionId
    });
    const newRefreshToken = await this.generateRefreshToken({
      userId: payload.userId,
      email: payload.email,
      sessionId: payload.sessionId
    });

    // Update session with new token hashes
    await this.userRepository.createSession({
      userId: payload.userId,
      tokenHash: await this.hashToken(newToken),
      refreshTokenHash: await this.hashToken(newRefreshToken),
      expiresAt: new Date(Date.now() + 86400000), // 24 hours
      userAgent: session.userAgent,
      ipAddress: session.ipAddress
    });

    // Delete old session
    await this.userRepository.deleteSession(session.id);

    return {
      token: newToken,
      refreshToken: newRefreshToken
    };
  }

  /**
   * Check session validity
   */
  async checkSession(token: string): Promise<User | null> {
    try {
      const payload = await this.verifyToken(token);
      
      // Find session
      const tokenHash = await this.hashToken(token);
      const session = await this.userRepository.findSessionByToken(tokenHash);
      if (!session) {
        return null;
      }

      // Update last accessed
      await this.userRepository.updateSessionAccess(session.id);

      // Get user
      return await this.userRepository.findById(payload.userId);
    } catch {
      return null;
    }
  }

  /**
   * Clean up expired tokens (should be run periodically)
   */
  async cleanupExpiredTokens(): Promise<void> {
    await this.userRepository.cleanupExpiredTokens();
  }
}