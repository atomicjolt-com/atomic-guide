/**
 * @fileoverview Deep Linking Session Security Service
 * Handles secure session management for LTI Deep Linking 2.0 configuration workflows
 * @module features/deep-linking/server/services/DeepLinkingSessionSecurityService
 */

import { z } from 'zod';

/**
 * Session security configuration schema
 */
const SessionSecurityConfigSchema = z.object({
  sessionTimeoutMs: z.number().min(300000).max(3600000), // 5 minutes to 1 hour
  cleanupIntervalMs: z.number().min(60000).max(300000), // 1 to 5 minutes
  maxConcurrentSessions: z.number().min(1).max(100),
  csrfTokenExpiry: z.number().min(300000).max(1800000), // 5 to 30 minutes
});

type SessionSecurityConfig = z.infer<typeof SessionSecurityConfigSchema>;

/**
 * Deep linking session security state schema
 */
const SessionSecurityStateSchema = z.object({
  sessionId: z.string().uuid(),
  instructorId: z.string().min(1),
  courseId: z.string().min(1),
  csrfToken: z.string().min(32),
  createdAt: z.date(),
  expiresAt: z.date(),
  lastActivity: z.date(),
  isValid: z.boolean(),
  origin: z.string().url(),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
});

type SessionSecurityState = z.infer<typeof SessionSecurityStateSchema>;

/**
 * Session validation result schema
 */
const SessionValidationResultSchema = z.object({
  valid: z.boolean(),
  reason: z.enum(['valid', 'expired', 'invalid_csrf', 'not_found', 'security_violation']),
  session: SessionSecurityStateSchema.optional(),
  securityFlags: z.array(z.string()).default([]),
});

type SessionValidationResult = z.infer<typeof SessionValidationResultSchema>;

/**
 * Deep Linking Session Security Service
 *
 * Provides secure session management for deep linking configuration workflows:
 * - Session creation with CSRF protection
 * - Session validation and timeout enforcement
 * - Automatic cleanup of expired sessions
 * - Security monitoring and audit logging
 */
export class DeepLinkingSessionSecurityService {
  private readonly config: SessionSecurityConfig;
  private readonly cleanupTimer: Timer | null = null;

  constructor(
    private readonly db: D1Database,
    config: Partial<SessionSecurityConfig> = {}
  ) {
    this.config = SessionSecurityConfigSchema.parse({
      sessionTimeoutMs: 1800000, // 30 minutes default
      cleanupIntervalMs: 300000, // 5 minutes default
      maxConcurrentSessions: 10,
      csrfTokenExpiry: 1800000, // 30 minutes default
      ...config,
    });

    // Start automatic cleanup
    this.startAutomaticCleanup();
  }

  /**
   * Creates a new secure deep linking session
   *
   * @param instructorId - LTI instructor user ID
   * @param courseId - LTI course ID
   * @param origin - Request origin for CSRF protection
   * @param options - Additional session options
   * @returns Created session with security tokens
   */
  async createSecureSession(
    instructorId: string,
    courseId: string,
    origin: string,
    options: {
      userAgent?: string;
      ipAddress?: string;
      platformDeploymentId: string;
      returnUrl: string;
    }
  ): Promise<SessionSecurityState> {
    // Validate inputs
    if (!instructorId || !courseId || !origin) {
      throw new Error('Missing required session parameters');
    }

    // Check concurrent session limit
    await this.enforceSessionLimits(instructorId);

    // Generate secure session ID and CSRF token
    const sessionId = crypto.randomUUID();
    const csrfToken = await this.generateCSRFToken();

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.sessionTimeoutMs);

    const session: SessionSecurityState = {
      sessionId,
      instructorId,
      courseId,
      csrfToken,
      createdAt: now,
      expiresAt,
      lastActivity: now,
      isValid: true,
      origin,
      userAgent: options.userAgent,
      ipAddress: options.ipAddress,
    };

    // Store session in database with security metadata
    await this.storeSession(session, {
      platformDeploymentId: options.platformDeploymentId,
      returnUrl: options.returnUrl,
    });

    // Log session creation for audit
    await this.auditLog('session_created', {
      sessionId,
      instructorId,
      courseId,
      origin,
      ipAddress: options.ipAddress,
    });

    return session;
  }

  /**
   * Validates a deep linking session with security checks
   *
   * @param sessionId - Session identifier
   * @param csrfToken - CSRF protection token
   * @param origin - Request origin
   * @param options - Additional validation options
   * @returns Validation result with security status
   */
  async validateSession(
    sessionId: string,
    csrfToken: string,
    origin: string,
    options: {
      updateActivity?: boolean;
      ipAddress?: string;
    } = {}
  ): Promise<SessionValidationResult> {
    try {
      // Retrieve session from database
      const sessionData = await this.getSessionData(sessionId);

      if (!sessionData) {
        return {
          valid: false,
          reason: 'not_found',
          securityFlags: ['session_not_found'],
        };
      }

      const session = SessionSecurityStateSchema.parse(sessionData);

      // Check session expiration
      if (new Date() > session.expiresAt || !session.isValid) {
        await this.invalidateSession(sessionId, 'expired');
        return {
          valid: false,
          reason: 'expired',
          securityFlags: ['session_expired'],
        };
      }

      // Validate CSRF token
      if (session.csrfToken !== csrfToken) {
        await this.auditLog('csrf_validation_failed', {
          sessionId,
          instructorId: session.instructorId,
          expectedToken: session.csrfToken.substring(0, 8) + '...',
          providedToken: csrfToken.substring(0, 8) + '...',
        });

        return {
          valid: false,
          reason: 'invalid_csrf',
          securityFlags: ['csrf_mismatch'],
        };
      }

      // Validate origin (CSRF protection)
      if (session.origin !== origin) {
        await this.auditLog('origin_validation_failed', {
          sessionId,
          instructorId: session.instructorId,
          expectedOrigin: session.origin,
          providedOrigin: origin,
        });

        return {
          valid: false,
          reason: 'security_violation',
          securityFlags: ['origin_mismatch'],
        };
      }

      // Check for suspicious activity
      const securityFlags = await this.checkSecurityFlags(session, options);

      if (securityFlags.includes('suspicious_activity')) {
        await this.invalidateSession(sessionId, 'security_violation');
        return {
          valid: false,
          reason: 'security_violation',
          securityFlags,
        };
      }

      // Update last activity timestamp
      if (options.updateActivity !== false) {
        await this.updateLastActivity(sessionId);
        session.lastActivity = new Date();
      }

      return {
        valid: true,
        reason: 'valid',
        session,
        securityFlags,
      };

    } catch (error) {
      console.error('Session validation error:', error);
      await this.auditLog('validation_error', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        valid: false,
        reason: 'security_violation',
        securityFlags: ['validation_error'],
      };
    }
  }

  /**
   * Invalidates a session and performs cleanup
   *
   * @param sessionId - Session to invalidate
   * @param reason - Reason for invalidation
   */
  async invalidateSession(sessionId: string, reason: string): Promise<void> {
    try {
      // Mark session as invalid
      await this.db
        .prepare(`
          UPDATE deep_linking_sessions
          SET is_valid = FALSE,
              invalidated_at = ?,
              invalidation_reason = ?
          WHERE session_id = ?
        `)
        .bind(new Date().toISOString(), reason, sessionId)
        .run();

      // Clean up related configuration data
      await this.cleanupSessionData(sessionId);

      // Audit log the invalidation
      await this.auditLog('session_invalidated', {
        sessionId,
        reason,
      });

    } catch (error) {
      console.error('Session invalidation error:', error);
    }
  }

  /**
   * Performs cleanup of expired sessions
   */
  async cleanupExpiredSessions(): Promise<{ cleaned: number }> {
    try {
      const now = new Date().toISOString();

      // Get expired sessions for audit
      const expiredSessions = await this.db
        .prepare(`
          SELECT session_id, instructor_id
          FROM deep_linking_sessions
          WHERE expires_at < ? OR is_valid = FALSE
        `)
        .bind(now)
        .all();

      // Delete expired sessions
      const result = await this.db
        .prepare(`
          DELETE FROM deep_linking_sessions
          WHERE expires_at < ? OR is_valid = FALSE
        `)
        .bind(now)
        .run();

      // Log cleanup activity
      if (expiredSessions.results.length > 0) {
        await this.auditLog('session_cleanup', {
          cleanedCount: expiredSessions.results.length,
          sessionIds: expiredSessions.results.map((s: any) => s.session_id),
        });
      }

      return { cleaned: result.changes || 0 };

    } catch (error) {
      console.error('Session cleanup error:', error);
      return { cleaned: 0 };
    }
  }

  /**
   * Generates a cryptographically secure CSRF token
   */
  private async generateCSRFToken(): Promise<string> {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Enforces concurrent session limits per instructor
   */
  private async enforceSessionLimits(instructorId: string): Promise<void> {
    const now = new Date().toISOString();

    // Count active sessions for instructor
    const activeCount = await this.db
      .prepare(`
        SELECT COUNT(*) as count
        FROM deep_linking_sessions
        WHERE instructor_id = ?
          AND expires_at > ?
          AND is_valid = TRUE
      `)
      .bind(instructorId, now)
      .first() as { count: number };

    if (activeCount.count >= this.config.maxConcurrentSessions) {
      // Clean up oldest sessions
      await this.db
        .prepare(`
          DELETE FROM deep_linking_sessions
          WHERE instructor_id = ?
            AND session_id IN (
              SELECT session_id
              FROM deep_linking_sessions
              WHERE instructor_id = ?
                AND expires_at > ?
                AND is_valid = TRUE
              ORDER BY created_at ASC
              LIMIT ?
            )
        `)
        .bind(
          instructorId,
          instructorId,
          now,
          activeCount.count - this.config.maxConcurrentSessions + 1
        )
        .run();
    }
  }

  /**
   * Stores session data securely in database
   */
  private async storeSession(
    session: SessionSecurityState,
    metadata: { platformDeploymentId: string; returnUrl: string }
  ): Promise<void> {
    await this.db
      .prepare(`
        INSERT INTO deep_linking_sessions (
          session_id, instructor_id, course_id, platform_deployment_id,
          return_url, csrf_token, created_at, expires_at, last_activity,
          is_valid, origin, user_agent, ip_address
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        session.sessionId,
        session.instructorId,
        session.courseId,
        metadata.platformDeploymentId,
        metadata.returnUrl,
        session.csrfToken,
        session.createdAt.toISOString(),
        session.expiresAt.toISOString(),
        session.lastActivity.toISOString(),
        session.isValid,
        session.origin,
        session.userAgent || null,
        session.ipAddress || null
      )
      .run();
  }

  /**
   * Retrieves session data from database
   */
  private async getSessionData(sessionId: string): Promise<any | null> {
    return await this.db
      .prepare(`
        SELECT * FROM deep_linking_sessions
        WHERE session_id = ?
      `)
      .bind(sessionId)
      .first();
  }

  /**
   * Updates last activity timestamp
   */
  private async updateLastActivity(sessionId: string): Promise<void> {
    await this.db
      .prepare(`
        UPDATE deep_linking_sessions
        SET last_activity = ?
        WHERE session_id = ?
      `)
      .bind(new Date().toISOString(), sessionId)
      .run();
  }

  /**
   * Checks for security flags and suspicious activity
   */
  private async checkSecurityFlags(
    session: SessionSecurityState,
    options: { ipAddress?: string }
  ): Promise<string[]> {
    const flags: string[] = [];

    // Check for IP address changes (potential session hijacking)
    if (options.ipAddress && session.ipAddress && options.ipAddress !== session.ipAddress) {
      flags.push('ip_address_changed');
    }

    // Check for rapid activity (potential automation)
    const timeSinceLastActivity = Date.now() - session.lastActivity.getTime();
    if (timeSinceLastActivity < 1000) { // Less than 1 second
      flags.push('rapid_activity');
    }

    // Check session age
    const sessionAge = Date.now() - session.createdAt.getTime();
    if (sessionAge > this.config.sessionTimeoutMs * 0.8) {
      flags.push('session_aging');
    }

    return flags;
  }

  /**
   * Cleans up session-related configuration data
   */
  private async cleanupSessionData(sessionId: string): Promise<void> {
    // Remove any temporary configuration data
    await this.db
      .prepare(`
        DELETE FROM assessment_configurations
        WHERE session_id = ? AND deployment_status = 'draft'
      `)
      .bind(sessionId)
      .run();
  }

  /**
   * Logs security events for audit purposes
   */
  private async auditLog(event: string, data: Record<string, any>): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO deep_linking_security_audit (
            id, event_type, event_data, created_at
          ) VALUES (?, ?, ?, ?)
        `)
        .bind(
          crypto.randomUUID(),
          event,
          JSON.stringify(data),
          new Date().toISOString()
        )
        .run();
    } catch (error) {
      console.error('Audit logging error:', error);
    }
  }

  /**
   * Starts automatic cleanup of expired sessions
   */
  private startAutomaticCleanup(): void {
    if (typeof setInterval !== 'undefined') {
      setInterval(() => {
        this.cleanupExpiredSessions().catch(error => {
          console.error('Automatic session cleanup failed:', error);
        });
      }, this.config.cleanupIntervalMs);
    }
  }

  /**
   * Validates session security configuration
   */
  static validateConfig(config: unknown): SessionSecurityConfig {
    return SessionSecurityConfigSchema.parse(config);
  }
}

/**
 * Factory function for creating session security service
 */
export function createDeepLinkingSessionSecurity(
  db: D1Database,
  config?: Partial<SessionSecurityConfig>
): DeepLinkingSessionSecurityService {
  return new DeepLinkingSessionSecurityService(db, config);
}

/**
 * Type exports for external use
 */
export type {
  SessionSecurityConfig,
  SessionSecurityState,
  SessionValidationResult,
};