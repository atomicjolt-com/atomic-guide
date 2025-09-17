/**
 * @fileoverview Assessment Session Repository
 * @module features/ai-assessment/server/repositories/AssessmentSessionRepository
 *
 * Repository for persisting and querying assessment session data in D1 database.
 * Handles CRUD operations, session cleanup, audit trails, and analytics queries.
 *
 * Features:
 * - Full CRUD operations for assessment sessions with versioning
 * - Efficient querying for performance analytics and progress tracking
 * - Session cleanup and archival processes for data management
 * - Audit trail storage for compliance and analysis
 * - Optimized queries for instructor dashboards and reports
 */

import {
  AssessmentSession,
  AssessmentSessionId,
  AssessmentSessionStatus,
  AssessmentMessage,
  UserId,
  CourseId,
  AssessmentConfigId,
  AssessmentAnalytics,
  AIAssessmentError,
  AssessmentSessionIdSchema,
  UserIdSchema,
  CourseIdSchema,
  AssessmentSessionSchema
} from '../../shared/types.ts';

import { DatabaseService } from '../../../../shared/services/DatabaseService.ts';

/**
 * Database schema interfaces for type safety
 */
interface SessionRecord {
  id: string;
  config_id: string;
  student_id: string;
  course_id: string;
  status: string;
  progress_data: string; // JSON
  timing_data: string;   // JSON
  analytics_data: string; // JSON
  security_data: string;  // JSON
  created_at: string;
  updated_at: string;
  version: number;
}

interface MessageRecord {
  id: string;
  session_id: string;
  type: string;
  content: string;
  content_hash: string;
  metadata: string; // JSON
  integrity_data: string; // JSON
  timestamp: string;
  encrypted: number; // SQLite boolean
}

interface SessionAuditRecord {
  id: string;
  session_id: string;
  action: string;
  actor_id: string;
  timestamp: string;
  details: string; // JSON
  ip_address?: string;
}

/**
 * Query filters for session retrieval
 */
interface SessionQueryFilters {
  studentId?: UserId;
  courseId?: CourseId;
  configId?: AssessmentConfigId;
  status?: AssessmentSessionStatus;
  dateRange?: {
    start: Date;
    end: Date;
  };
  limit?: number;
  offset?: number;
}

/**
 * Assessment Session Repository
 *
 * Handles all database operations for assessment sessions with proper
 * error handling, transaction management, and data integrity.
 */
export class AssessmentSessionRepository {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Create a new assessment session
   *
   * @param session - Assessment session to create
   * @returns Created session with database ID
   */
  async createSession(session: AssessmentSession): Promise<AssessmentSession> {
    try {
      const validated = AssessmentSessionSchema.parse(session);

      await this.db.transaction(async (tx) => {
        // Insert main session record
        await tx
          .prepare(`
            INSERT INTO assessment_sessions (
              id, config_id, student_id, course_id, status,
              progress_data, timing_data, analytics_data, security_data,
              created_at, updated_at, version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            validated.id,
            validated.config.configId,
            validated.config.studentId,
            validated.config.courseId,
            validated.status,
            JSON.stringify(validated.progress),
            JSON.stringify(validated.timing),
            JSON.stringify(validated.analytics),
            JSON.stringify(validated.security),
            new Date().toISOString(),
            new Date().toISOString(),
            1
          )
          .run();

        // Insert initial conversation messages
        for (const message of validated.conversation) {
          await this.insertMessage(tx, message);
        }

        // Create audit log entry
        await this.insertAuditLog(tx, {
          sessionId: validated.id,
          action: 'session_created',
          actorId: validated.config.studentId,
          details: { configId: validated.config.configId }
        });
      });

      return validated;

    } catch (error) {
      throw new AIAssessmentError(
        `Failed to create assessment session: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SESSION_CREATE_FAILED',
        { sessionId: session.id }
      );
    }
  }

  /**
   * Retrieve assessment session by ID
   *
   * @param sessionId - Session ID to retrieve
   * @returns Assessment session or null if not found
   */
  async getSession(sessionId: AssessmentSessionId): Promise<AssessmentSession | null> {
    try {
      const validated = AssessmentSessionIdSchema.parse(sessionId);

      // Get main session record
      const sessionResult = await this.db
        .prepare(`
          SELECT * FROM assessment_sessions
          WHERE id = ?
        `)
        .bind(validated)
        .first<SessionRecord>();

      if (!sessionResult) {
        return null;
      }

      // Get conversation messages
      const messagesResult = await this.db
        .prepare(`
          SELECT * FROM assessment_messages
          WHERE session_id = ?
          ORDER BY timestamp ASC
        `)
        .bind(validated)
        .all<MessageRecord>();

      // Reconstruct session object
      const session = this.mapRecordToSession(sessionResult, messagesResult.results || []);
      return AssessmentSessionSchema.parse(session);

    } catch (error) {
      if (error instanceof AIAssessmentError) {
        throw error;
      }

      throw new AIAssessmentError(
        `Failed to retrieve assessment session: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SESSION_RETRIEVE_FAILED',
        { sessionId }
      );
    }
  }

  /**
   * Update existing assessment session
   *
   * @param session - Updated session data
   * @returns Updated session
   */
  async updateSession(session: AssessmentSession): Promise<AssessmentSession> {
    try {
      const validated = AssessmentSessionSchema.parse(session);

      await this.db.transaction(async (tx) => {
        // Get current version for optimistic locking
        const currentResult = await tx
          .prepare('SELECT version FROM assessment_sessions WHERE id = ?')
          .bind(validated.id)
          .first<{ version: number }>();

        if (!currentResult) {
          throw new AIAssessmentError(
            'Session not found for update',
            'SESSION_NOT_FOUND',
            { sessionId: validated.id }
          );
        }

        const newVersion = currentResult.version + 1;

        // Update main session record
        const updateResult = await tx
          .prepare(`
            UPDATE assessment_sessions
            SET status = ?, progress_data = ?, timing_data = ?,
                analytics_data = ?, security_data = ?, updated_at = ?, version = ?
            WHERE id = ? AND version = ?
          `)
          .bind(
            validated.status,
            JSON.stringify(validated.progress),
            JSON.stringify(validated.timing),
            JSON.stringify(validated.analytics),
            JSON.stringify(validated.security),
            new Date().toISOString(),
            newVersion,
            validated.id,
            currentResult.version
          )
          .run();

        if (updateResult.changes === 0) {
          throw new AIAssessmentError(
            'Session update failed - version conflict',
            'VERSION_CONFLICT',
            { sessionId: validated.id, currentVersion: currentResult.version }
          );
        }

        // Insert new messages (only new ones)
        const existingMessageIds = await this.getExistingMessageIds(tx, validated.id);
        const newMessages = validated.conversation.filter(
          msg => !existingMessageIds.includes(msg.id)
        );

        for (const message of newMessages) {
          await this.insertMessage(tx, message);
        }

        // Create audit log entry
        await this.insertAuditLog(tx, {
          sessionId: validated.id,
          action: 'session_updated',
          actorId: validated.config.studentId,
          details: { status: validated.status, version: newVersion }
        });
      });

      return validated;

    } catch (error) {
      if (error instanceof AIAssessmentError) {
        throw error;
      }

      throw new AIAssessmentError(
        `Failed to update assessment session: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SESSION_UPDATE_FAILED',
        { sessionId: session.id }
      );
    }
  }

  /**
   * Query assessment sessions with filters
   *
   * @param filters - Query filters and pagination
   * @returns Array of matching sessions
   */
  async querySessions(filters: SessionQueryFilters = {}): Promise<AssessmentSession[]> {
    try {
      let query = `
        SELECT * FROM assessment_sessions
        WHERE 1=1
      `;
      const bindings: unknown[] = [];

      // Apply filters
      if (filters.studentId) {
        query += ' AND student_id = ?';
        bindings.push(filters.studentId);
      }

      if (filters.courseId) {
        query += ' AND course_id = ?';
        bindings.push(filters.courseId);
      }

      if (filters.configId) {
        query += ' AND config_id = ?';
        bindings.push(filters.configId);
      }

      if (filters.status) {
        query += ' AND status = ?';
        bindings.push(filters.status);
      }

      if (filters.dateRange) {
        query += ' AND created_at >= ? AND created_at <= ?';
        bindings.push(filters.dateRange.start.toISOString());
        bindings.push(filters.dateRange.end.toISOString());
      }

      // Add ordering and pagination
      query += ' ORDER BY created_at DESC';

      if (filters.limit) {
        query += ' LIMIT ?';
        bindings.push(filters.limit);

        if (filters.offset) {
          query += ' OFFSET ?';
          bindings.push(filters.offset);
        }
      }

      const result = await this.db
        .prepare(query)
        .bind(...bindings)
        .all<SessionRecord>();

      // Get messages for each session (batch query for efficiency)
      const sessions: AssessmentSession[] = [];
      for (const sessionRecord of result.results || []) {
        const messagesResult = await this.db
          .prepare(`
            SELECT * FROM assessment_messages
            WHERE session_id = ?
            ORDER BY timestamp ASC
          `)
          .bind(sessionRecord.id)
          .all<MessageRecord>();

        const session = this.mapRecordToSession(sessionRecord, messagesResult.results || []);
        sessions.push(AssessmentSessionSchema.parse(session));
      }

      return sessions;

    } catch (error) {
      throw new AIAssessmentError(
        `Failed to query assessment sessions: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SESSION_QUERY_FAILED',
        { filters }
      );
    }
  }

  /**
   * Delete assessment session and all related data
   *
   * @param sessionId - Session ID to delete
   * @param actorId - ID of user performing deletion
   */
  async deleteSession(sessionId: AssessmentSessionId, actorId: UserId): Promise<void> {
    try {
      const validatedSessionId = AssessmentSessionIdSchema.parse(sessionId);
      const validatedActorId = UserIdSchema.parse(actorId);

      await this.db.transaction(async (tx) => {
        // Check if session exists
        const sessionExists = await tx
          .prepare('SELECT id FROM assessment_sessions WHERE id = ?')
          .bind(validatedSessionId)
          .first();

        if (!sessionExists) {
          throw new AIAssessmentError(
            'Session not found for deletion',
            'SESSION_NOT_FOUND',
            { sessionId: validatedSessionId }
          );
        }

        // Create audit log before deletion
        await this.insertAuditLog(tx, {
          sessionId: validatedSessionId,
          action: 'session_deleted',
          actorId: validatedActorId,
          details: { reason: 'manual_deletion' }
        });

        // Delete messages first (foreign key constraint)
        await tx
          .prepare('DELETE FROM assessment_messages WHERE session_id = ?')
          .bind(validatedSessionId)
          .run();

        // Delete main session record
        await tx
          .prepare('DELETE FROM assessment_sessions WHERE id = ?')
          .bind(validatedSessionId)
          .run();
      });

    } catch (error) {
      if (error instanceof AIAssessmentError) {
        throw error;
      }

      throw new AIAssessmentError(
        `Failed to delete assessment session: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SESSION_DELETE_FAILED',
        { sessionId }
      );
    }
  }

  /**
   * Get assessment analytics for course or student
   *
   * @param filters - Analytics query filters
   * @returns Assessment analytics data
   */
  async getAnalytics(filters: {
    courseId?: CourseId;
    studentId?: UserId;
    dateRange?: { start: Date; end: Date };
  }): Promise<AssessmentAnalytics> {
    try {
      // This is a simplified analytics implementation
      // In production, you might want to use dedicated analytics tables

      let query = `
        SELECT
          COUNT(*) as total_sessions,
          AVG(CASE WHEN status = 'completed' OR status = 'mastery_achieved' THEN 1.0 ELSE 0.0 END) as completion_rate,
          AVG(JSON_EXTRACT(analytics_data, '$.engagementScore')) as avg_engagement
        FROM assessment_sessions
        WHERE 1=1
      `;
      const bindings: unknown[] = [];

      if (filters.courseId) {
        query += ' AND course_id = ?';
        bindings.push(filters.courseId);
      }

      if (filters.studentId) {
        query += ' AND student_id = ?';
        bindings.push(filters.studentId);
      }

      if (filters.dateRange) {
        query += ' AND created_at >= ? AND created_at <= ?';
        bindings.push(filters.dateRange.start.toISOString());
        bindings.push(filters.dateRange.end.toISOString());
      }

      const result = await this.db
        .prepare(query)
        .bind(...bindings)
        .first<{
          total_sessions: number;
          completion_rate: number;
          avg_engagement: number;
        }>();

      // Return basic analytics (can be expanded)
      return {
        sessionId: AssessmentSessionIdSchema.parse(crypto.randomUUID()), // Placeholder
        metrics: {
          completionRate: result?.completion_rate || 0,
          averageResponseTime: 30000, // Placeholder - would need to calculate from messages
          masteryAchievementRate: result?.completion_rate || 0,
          strugglingStudentCount: 0, // Would need to analyze from sessions
          commonMisconceptions: [],
          learningProgression: []
        },
        performance: {
          averageScore: 0, // Would calculate from grade data
          scoreDistribution: [],
          improvementTracking: []
        },
        engagement: {
          averageSessionDuration: 0, // Would calculate from timing data
          abandonmentRate: 1 - (result?.completion_rate || 0),
          helpSeekingFrequency: 0,
          retryPatterns: {}
        }
      };

    } catch (error) {
      throw new AIAssessmentError(
        `Failed to get assessment analytics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ANALYTICS_QUERY_FAILED',
        { filters }
      );
    }
  }

  /**
   * Clean up old or abandoned sessions
   *
   * @param olderThanDays - Delete sessions older than this many days
   * @param statuses - Only delete sessions with these statuses
   * @returns Number of sessions cleaned up
   */
  async cleanupSessions(
    olderThanDays: number = 30,
    statuses: AssessmentSessionStatus[] = ['timeout', 'cancelled', 'error']
  ): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const placeholders = statuses.map(() => '?').join(',');
      const query = `
        DELETE FROM assessment_sessions
        WHERE created_at < ? AND status IN (${placeholders})
      `;

      const result = await this.db
        .prepare(query)
        .bind(cutoffDate.toISOString(), ...statuses)
        .run();

      return result.changes || 0;

    } catch (error) {
      throw new AIAssessmentError(
        `Failed to cleanup sessions: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SESSION_CLEANUP_FAILED',
        { olderThanDays, statuses }
      );
    }
  }

  /**
   * Insert a message record in a transaction
   */
  private async insertMessage(tx: any, message: AssessmentMessage): Promise<void> {
    await tx
      .prepare(`
        INSERT INTO assessment_messages (
          id, session_id, type, content, content_hash, metadata,
          integrity_data, timestamp, encrypted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        message.id,
        message.sessionId,
        message.type,
        message.content,
        message.contentHash,
        JSON.stringify(message.metadata || {}),
        JSON.stringify(message.integrity || {}),
        message.timestamp.toISOString(),
        message.encrypted ? 1 : 0
      )
      .run();
  }

  /**
   * Insert audit log entry
   */
  private async insertAuditLog(
    tx: any,
    entry: {
      sessionId: AssessmentSessionId;
      action: string;
      actorId: UserId;
      details: Record<string, unknown>;
      ipAddress?: string;
    }
  ): Promise<void> {
    await tx
      .prepare(`
        INSERT INTO assessment_audit_log (
          id, session_id, action, actor_id, timestamp, details, ip_address
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        crypto.randomUUID(),
        entry.sessionId,
        entry.action,
        entry.actorId,
        new Date().toISOString(),
        JSON.stringify(entry.details),
        entry.ipAddress || null
      )
      .run();
  }

  /**
   * Get existing message IDs for a session
   */
  private async getExistingMessageIds(tx: any, sessionId: AssessmentSessionId): Promise<string[]> {
    const result = await tx
      .prepare('SELECT id FROM assessment_messages WHERE session_id = ?')
      .bind(sessionId)
      .all<{ id: string }>();

    return (result.results || []).map(r => r.id);
  }

  /**
   * Map database record to session object
   */
  private mapRecordToSession(
    sessionRecord: SessionRecord,
    messageRecords: MessageRecord[]
  ): AssessmentSession {
    const messages: AssessmentMessage[] = messageRecords.map(msg => ({
      id: msg.id,
      sessionId: AssessmentSessionIdSchema.parse(msg.session_id),
      type: msg.type as AssessmentMessage['type'],
      content: msg.content,
      timestamp: new Date(msg.timestamp),
      metadata: msg.metadata ? JSON.parse(msg.metadata) : undefined,
      contentHash: msg.content_hash,
      encrypted: Boolean(msg.encrypted),
      integrity: msg.integrity_data ? JSON.parse(msg.integrity_data) : undefined
    }));

    return {
      id: AssessmentSessionIdSchema.parse(sessionRecord.id),
      config: JSON.parse(sessionRecord.config_id), // This would need proper config lookup
      status: sessionRecord.status as AssessmentSessionStatus,
      progress: JSON.parse(sessionRecord.progress_data),
      timing: {
        ...JSON.parse(sessionRecord.timing_data),
        startedAt: new Date(JSON.parse(sessionRecord.timing_data).startedAt),
        lastActivity: new Date(JSON.parse(sessionRecord.timing_data).lastActivity),
        estimatedCompletion: JSON.parse(sessionRecord.timing_data).estimatedCompletion ?
          new Date(JSON.parse(sessionRecord.timing_data).estimatedCompletion) : undefined,
        timeoutAt: JSON.parse(sessionRecord.timing_data).timeoutAt ?
          new Date(JSON.parse(sessionRecord.timing_data).timeoutAt) : undefined
      },
      conversation: messages,
      analytics: JSON.parse(sessionRecord.analytics_data),
      security: {
        ...JSON.parse(sessionRecord.security_data),
        lastValidation: new Date(JSON.parse(sessionRecord.security_data).lastValidation),
        integrityChecks: JSON.parse(sessionRecord.security_data).integrityChecks.map((check: any) => ({
          ...check,
          timestamp: new Date(check.timestamp)
        }))
      }
    };
  }
}