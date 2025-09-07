/**
 * @fileoverview User repository for authentication
 * Epic 0: Developer Experience & Testing Infrastructure
 */

import type { D1Database } from '@cloudflare/workers-types';
import { v4 as uuidv4 } from 'uuid';
import { UserIdSchema, SessionIdSchema, TokenHashSchema } from '../../shared/schemas/auth.schema';
import type { 
  User, 
  UserSession, 
  PasswordResetToken, 
  EmailVerificationToken,
  UserId,
  SessionId,
  TokenHash
} from '../../shared/types/auth.types';

export class UserRepository {
  constructor(private db: D1Database) {}

  /**
   * Create a new user
   */
  async createUser(data: {
    email: string;
    passwordHash: string;
    name?: string;
  }): Promise<User> {
    const id = UserIdSchema.parse(uuidv4());
    const now = new Date();

    await this.db
      .prepare(
        `INSERT INTO users (id, email, password_hash, name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(id, data.email.toLowerCase(), data.passwordHash, data.name || null, now.toISOString(), now.toISOString())
      .run();

    return {
      id,
      email: data.email.toLowerCase(),
      name: data.name,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db
      .prepare(
        `SELECT id, email, name, email_verified, created_at, updated_at
         FROM users WHERE email = ?`
      )
      .bind(email.toLowerCase())
      .first();

    if (!result) return null;

    return {
      id: UserIdSchema.parse(result.id),
      email: result.email as string,
      name: result.name as string | undefined,
      emailVerified: Boolean(result.email_verified),
      createdAt: new Date(result.created_at as string),
      updatedAt: new Date(result.updated_at as string),
    };
  }

  /**
   * Find user by ID
   */
  async findById(id: UserId): Promise<User | null> {
    const result = await this.db
      .prepare(
        `SELECT id, email, name, email_verified, created_at, updated_at
         FROM users WHERE id = ?`
      )
      .bind(id)
      .first();

    if (!result) return null;

    return {
      id: UserIdSchema.parse(result.id),
      email: result.email as string,
      name: result.name as string | undefined,
      emailVerified: Boolean(result.email_verified),
      createdAt: new Date(result.created_at as string),
      updatedAt: new Date(result.updated_at as string),
    };
  }

  /**
   * Get password hash for user
   */
  async getPasswordHash(email: string): Promise<string | null> {
    const result = await this.db
      .prepare(`SELECT password_hash FROM users WHERE email = ?`)
      .bind(email.toLowerCase())
      .first();

    return result?.password_hash as string | null;
  }

  /**
   * Update user email verified status
   */
  async markEmailVerified(userId: UserId): Promise<void> {
    await this.db
      .prepare(
        `UPDATE users SET email_verified = TRUE, updated_at = ? WHERE id = ?`
      )
      .bind(new Date().toISOString(), userId)
      .run();
  }

  /**
   * Update user password
   */
  async updatePassword(userId: UserId, passwordHash: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`
      )
      .bind(passwordHash, new Date().toISOString(), userId)
      .run();
  }

  /**
   * Create user session
   */
  async createSession(data: {
    userId: UserId;
    tokenHash: TokenHash;
    refreshTokenHash?: TokenHash;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<UserSession> {
    const id = SessionIdSchema.parse(uuidv4());
    const now = new Date();

    await this.db
      .prepare(
        `INSERT INTO user_sessions 
         (id, user_id, token_hash, refresh_token_hash, expires_at, last_accessed, user_agent, ip_address, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        data.userId,
        data.tokenHash,
        data.refreshTokenHash || null,
        data.expiresAt.toISOString(),
        now.toISOString(),
        data.userAgent || null,
        data.ipAddress || null,
        now.toISOString()
      )
      .run();

    return {
      id,
      userId: data.userId,
      tokenHash: data.tokenHash,
      refreshTokenHash: data.refreshTokenHash,
      expiresAt: data.expiresAt,
      lastAccessed: now,
      userAgent: data.userAgent,
      ipAddress: data.ipAddress,
      createdAt: now,
    };
  }

  /**
   * Find session by token hash
   */
  async findSessionByToken(tokenHash: TokenHash): Promise<UserSession | null> {
    const result = await this.db
      .prepare(
        `SELECT * FROM user_sessions 
         WHERE token_hash = ? AND expires_at > datetime('now')`
      )
      .bind(tokenHash)
      .first();

    if (!result) return null;

    return {
      id: SessionIdSchema.parse(result.id),
      userId: UserIdSchema.parse(result.user_id),
      tokenHash: TokenHashSchema.parse(result.token_hash),
      refreshTokenHash: result.refresh_token_hash ? TokenHashSchema.parse(result.refresh_token_hash as string) : undefined,
      expiresAt: new Date(result.expires_at as string),
      lastAccessed: new Date(result.last_accessed as string),
      userAgent: result.user_agent as string | undefined,
      ipAddress: result.ip_address as string | undefined,
      createdAt: new Date(result.created_at as string),
    };
  }

  /**
   * Update session last accessed time
   */
  async updateSessionAccess(sessionId: SessionId): Promise<void> {
    await this.db
      .prepare(
        `UPDATE user_sessions SET last_accessed = ? WHERE id = ?`
      )
      .bind(new Date().toISOString(), sessionId)
      .run();
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: SessionId): Promise<void> {
    await this.db
      .prepare(`DELETE FROM user_sessions WHERE id = ?`)
      .bind(sessionId)
      .run();
  }

  /**
   * Delete all user sessions
   */
  async deleteUserSessions(userId: UserId): Promise<void> {
    await this.db
      .prepare(`DELETE FROM user_sessions WHERE user_id = ?`)
      .bind(userId)
      .run();
  }

  /**
   * Create password reset token
   */
  async createPasswordResetToken(userId: UserId): Promise<string> {
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    await this.db
      .prepare(
        `INSERT INTO password_reset_tokens (id, user_id, token, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(uuidv4(), userId, token, expiresAt.toISOString(), new Date().toISOString())
      .run();

    return token;
  }

  /**
   * Find valid password reset token
   */
  async findPasswordResetToken(token: string): Promise<PasswordResetToken | null> {
    const result = await this.db
      .prepare(
        `SELECT * FROM password_reset_tokens 
         WHERE token = ? AND expires_at > datetime('now') AND used = FALSE`
      )
      .bind(token)
      .first();

    if (!result) return null;

    return {
      id: result.id as string,
      userId: UserIdSchema.parse(result.user_id),
      token: result.token as string,
      expiresAt: new Date(result.expires_at as string),
      used: Boolean(result.used),
      createdAt: new Date(result.created_at as string),
    };
  }

  /**
   * Mark password reset token as used
   */
  async markPasswordResetTokenUsed(token: string): Promise<void> {
    await this.db
      .prepare(`UPDATE password_reset_tokens SET used = TRUE WHERE token = ?`)
      .bind(token)
      .run();
  }

  /**
   * Create email verification token
   */
  async createEmailVerificationToken(userId: UserId): Promise<string> {
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 86400000); // 24 hours

    await this.db
      .prepare(
        `INSERT INTO email_verification_tokens (id, user_id, token, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(uuidv4(), userId, token, expiresAt.toISOString(), new Date().toISOString())
      .run();

    return token;
  }

  /**
   * Find valid email verification token
   */
  async findEmailVerificationToken(token: string): Promise<EmailVerificationToken | null> {
    const result = await this.db
      .prepare(
        `SELECT * FROM email_verification_tokens 
         WHERE token = ? AND expires_at > datetime('now') AND used = FALSE`
      )
      .bind(token)
      .first();

    if (!result) return null;

    return {
      id: result.id as string,
      userId: UserIdSchema.parse(result.user_id),
      token: result.token as string,
      expiresAt: new Date(result.expires_at as string),
      used: Boolean(result.used),
      createdAt: new Date(result.created_at as string),
    };
  }

  /**
   * Mark email verification token as used
   */
  async markEmailVerificationTokenUsed(token: string): Promise<void> {
    await this.db
      .prepare(`UPDATE email_verification_tokens SET used = TRUE WHERE token = ?`)
      .bind(token)
      .run();
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens(): Promise<void> {
    const now = new Date().toISOString();
    
    // Clean up expired sessions
    await this.db
      .prepare(`DELETE FROM user_sessions WHERE expires_at < ?`)
      .bind(now)
      .run();

    // Clean up expired password reset tokens
    await this.db
      .prepare(`DELETE FROM password_reset_tokens WHERE expires_at < ?`)
      .bind(now)
      .run();

    // Clean up expired email verification tokens
    await this.db
      .prepare(`DELETE FROM email_verification_tokens WHERE expires_at < ?`)
      .bind(now)
      .run();
  }
}