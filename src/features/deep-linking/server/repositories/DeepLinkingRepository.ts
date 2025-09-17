/**
 * @fileoverview Deep Linking Repository
 * Data access layer for deep linking sessions, configurations, and content items
 * @module features/deep-linking/server/repositories/DeepLinkingRepository
 */

import { z } from 'zod';

/**
 * Deep linking context schema
 */
const DeepLinkingContextSchema = z.object({
  sessionId: z.string().uuid(),
  jwtClaims: z.record(z.unknown()),
  deepLinkingSettings: z.object({
    deep_link_return_url: z.string().url(),
    accept_types: z.array(z.string()),
    accept_presentation_document_targets: z.array(z.string()),
    accept_media_types: z.array(z.string()).optional(),
    accept_multiple: z.boolean().optional(),
    auto_create: z.boolean().optional(),
    data: z.string().optional(),
  }),
  canvasAssignmentContext: z.record(z.unknown()).optional(),
  createdAt: z.date(),
});

type DeepLinkingContext = z.infer<typeof DeepLinkingContextSchema>;

/**
 * Assessment configuration schema
 */
const AssessmentConfigurationSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  instructorId: z.string(),
  courseId: z.string(),
  assignmentId: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  settings: z.record(z.unknown()),
  gradingConfig: z.record(z.unknown()),
  deploymentStatus: z.enum(['draft', 'configured', 'deployed', 'archived']),
  canvasAssignmentData: z.record(z.unknown()).optional(),
  contentItems: z.array(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deployedAt: z.date().optional(),
});

type AssessmentConfiguration = z.infer<typeof AssessmentConfigurationSchema>;

/**
 * Content item log entry schema
 */
const ContentItemLogEntrySchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  configurationId: z.string(),
  contentItems: z.array(z.unknown()),
  canvasResponse: z.record(z.unknown()).optional(),
  success: z.boolean(),
  errorDetails: z.string().optional(),
  instructorId: z.string(),
  courseId: z.string(),
  canvasAssignmentId: z.string().optional(),
  deliveryMethod: z.enum(['deep_linking', 'api_direct', 'manual']),
  responseTimeMs: z.number().optional(),
  retryCount: z.number().default(0),
  createdAt: z.date(),
});

type ContentItemLogEntry = z.infer<typeof ContentItemLogEntrySchema>;

/**
 * Deep Linking Repository
 *
 * Provides data access layer for deep linking operations:
 * - Session context storage and retrieval
 * - Assessment configuration persistence
 * - Content item logging and audit trails
 * - Canvas assignment context management
 * - Performance and analytics data collection
 */
export class DeepLinkingRepository {
  constructor(private readonly db: D1Database) {}

  /**
   * Stores deep linking context from Canvas request
   *
   * @param sessionId - Unique session identifier
   * @param context - Deep linking context data
   */
  async storeDeepLinkingContext(
    sessionId: string,
    context: {
      jwtClaims: Record<string, unknown>;
      deepLinkingSettings: Record<string, unknown>;
      canvasAssignmentContext?: Record<string, unknown>;
    }
  ): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO deep_linking_contexts (
            id, session_id, jwt_claims, deep_linking_settings,
            canvas_assignment_context, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `)
        .bind(
          crypto.randomUUID(),
          sessionId,
          JSON.stringify(context.jwtClaims),
          JSON.stringify(context.deepLinkingSettings),
          context.canvasAssignmentContext ? JSON.stringify(context.canvasAssignmentContext) : null,
          new Date().toISOString()
        )
        .run();
    } catch (error) {
      console.error('Failed to store deep linking context:', error);
      throw new Error('Database error storing deep linking context');
    }
  }

  /**
   * Retrieves deep linking context by session ID
   *
   * @param sessionId - Session identifier
   * @returns Deep linking context or null if not found
   */
  async getDeepLinkingContext(sessionId: string): Promise<DeepLinkingContext | null> {
    try {
      const result = await this.db
        .prepare(`
          SELECT * FROM deep_linking_contexts
          WHERE session_id = ?
          ORDER BY created_at DESC
          LIMIT 1
        `)
        .bind(sessionId)
        .first();

      if (!result) {
        return null;
      }

      return {
        sessionId: result.session_id as string,
        jwtClaims: JSON.parse(result.jwt_claims as string),
        deepLinkingSettings: JSON.parse(result.deep_linking_settings as string),
        canvasAssignmentContext: result.canvas_assignment_context
          ? JSON.parse(result.canvas_assignment_context as string)
          : undefined,
        createdAt: new Date(result.created_at as string),
      };
    } catch (error) {
      console.error('Failed to get deep linking context:', error);
      throw new Error('Database error retrieving deep linking context');
    }
  }

  /**
   * Stores assessment configuration
   *
   * @param configuration - Assessment configuration data
   * @returns Created configuration ID
   */
  async storeAssessmentConfiguration(configuration: {
    sessionId?: string;
    instructorId: string;
    courseId: string;
    assignmentId?: string;
    title: string;
    description?: string;
    settings: Record<string, unknown>;
    gradingConfig: Record<string, unknown>;
    canvasAssignmentData?: Record<string, unknown>;
  }): Promise<string> {
    try {
      const configurationId = crypto.randomUUID();
      const now = new Date().toISOString();

      await this.db
        .prepare(`
          INSERT INTO assessment_configurations (
            id, session_id, instructor_id, course_id, assignment_id,
            title, description, settings, grading_config,
            canvas_assignment_data, deployment_status,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          configurationId,
          configuration.sessionId || null,
          configuration.instructorId,
          configuration.courseId,
          configuration.assignmentId || null,
          configuration.title,
          configuration.description || null,
          JSON.stringify(configuration.settings),
          JSON.stringify(configuration.gradingConfig),
          configuration.canvasAssignmentData ? JSON.stringify(configuration.canvasAssignmentData) : null,
          'draft',
          now,
          now
        )
        .run();

      return configurationId;
    } catch (error) {
      console.error('Failed to store assessment configuration:', error);
      throw new Error('Database error storing assessment configuration');
    }
  }

  /**
   * Retrieves assessment configuration by ID
   *
   * @param configurationId - Configuration identifier
   * @returns Assessment configuration or null if not found
   */
  async getAssessmentConfiguration(configurationId: string): Promise<AssessmentConfiguration | null> {
    try {
      const result = await this.db
        .prepare(`
          SELECT * FROM assessment_configurations
          WHERE id = ?
        `)
        .bind(configurationId)
        .first();

      if (!result) {
        return null;
      }

      return {
        id: result.id as string,
        sessionId: result.session_id as string | undefined,
        instructorId: result.instructor_id as string,
        courseId: result.course_id as string,
        assignmentId: result.assignment_id as string | undefined,
        title: result.title as string,
        description: result.description as string | undefined,
        settings: JSON.parse(result.settings as string),
        gradingConfig: JSON.parse(result.grading_config as string),
        deploymentStatus: result.deployment_status as 'draft' | 'configured' | 'deployed' | 'archived',
        canvasAssignmentData: result.canvas_assignment_data
          ? JSON.parse(result.canvas_assignment_data as string)
          : undefined,
        contentItems: result.content_items
          ? JSON.parse(result.content_items as string)
          : undefined,
        createdAt: new Date(result.created_at as string),
        updatedAt: new Date(result.updated_at as string),
        deployedAt: result.deployed_at ? new Date(result.deployed_at as string) : undefined,
      };
    } catch (error) {
      console.error('Failed to get assessment configuration:', error);
      throw new Error('Database error retrieving assessment configuration');
    }
  }

  /**
   * Updates assessment configuration
   *
   * @param configurationId - Configuration to update
   * @param updates - Fields to update
   */
  async updateAssessmentConfiguration(
    configurationId: string,
    updates: Partial<{
      title: string;
      description: string;
      settings: Record<string, unknown>;
      gradingConfig: Record<string, unknown>;
      deploymentStatus: 'draft' | 'configured' | 'deployed' | 'archived';
      contentItems: unknown[];
      canvasAssignmentData: Record<string, unknown>;
    }>
  ): Promise<void> {
    try {
      const setClause: string[] = [];
      const values: any[] = [];

      // Build dynamic SET clause
      if (updates.title !== undefined) {
        setClause.push('title = ?');
        values.push(updates.title);
      }

      if (updates.description !== undefined) {
        setClause.push('description = ?');
        values.push(updates.description);
      }

      if (updates.settings !== undefined) {
        setClause.push('settings = ?');
        values.push(JSON.stringify(updates.settings));
      }

      if (updates.gradingConfig !== undefined) {
        setClause.push('grading_config = ?');
        values.push(JSON.stringify(updates.gradingConfig));
      }

      if (updates.deploymentStatus !== undefined) {
        setClause.push('deployment_status = ?');
        values.push(updates.deploymentStatus);

        // Set deployed_at if status changes to deployed
        if (updates.deploymentStatus === 'deployed') {
          setClause.push('deployed_at = ?');
          values.push(new Date().toISOString());
        }
      }

      if (updates.contentItems !== undefined) {
        setClause.push('content_items = ?');
        values.push(JSON.stringify(updates.contentItems));
      }

      if (updates.canvasAssignmentData !== undefined) {
        setClause.push('canvas_assignment_data = ?');
        values.push(JSON.stringify(updates.canvasAssignmentData));
      }

      // Always update updated_at
      setClause.push('updated_at = ?');
      values.push(new Date().toISOString());

      // Add configuration ID for WHERE clause
      values.push(configurationId);

      if (setClause.length === 1) { // Only updated_at
        return; // No actual updates to make
      }

      await this.db
        .prepare(`
          UPDATE assessment_configurations
          SET ${setClause.join(', ')}
          WHERE id = ?
        `)
        .bind(...values)
        .run();
    } catch (error) {
      console.error('Failed to update assessment configuration:', error);
      throw new Error('Database error updating assessment configuration');
    }
  }

  /**
   * Gets assessment configurations for instructor
   *
   * @param instructorId - Instructor identifier
   * @param filters - Optional filters
   * @returns Array of configurations
   */
  async getInstructorConfigurations(
    instructorId: string,
    filters: {
      courseId?: string;
      deploymentStatus?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<AssessmentConfiguration[]> {
    try {
      let query = `
        SELECT * FROM assessment_configurations
        WHERE instructor_id = ?
      `;
      const params: any[] = [instructorId];

      if (filters.courseId) {
        query += ' AND course_id = ?';
        params.push(filters.courseId);
      }

      if (filters.deploymentStatus) {
        query += ' AND deployment_status = ?';
        params.push(filters.deploymentStatus);
      }

      query += ' ORDER BY updated_at DESC';

      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);

        if (filters.offset) {
          query += ' OFFSET ?';
          params.push(filters.offset);
        }
      }

      const results = await this.db
        .prepare(query)
        .bind(...params)
        .all();

      return results.results.map((result: any) => ({
        id: result.id,
        sessionId: result.session_id || undefined,
        instructorId: result.instructor_id,
        courseId: result.course_id,
        assignmentId: result.assignment_id || undefined,
        title: result.title,
        description: result.description || undefined,
        settings: JSON.parse(result.settings),
        gradingConfig: JSON.parse(result.grading_config),
        deploymentStatus: result.deployment_status,
        canvasAssignmentData: result.canvas_assignment_data
          ? JSON.parse(result.canvas_assignment_data)
          : undefined,
        contentItems: result.content_items
          ? JSON.parse(result.content_items)
          : undefined,
        createdAt: new Date(result.created_at),
        updatedAt: new Date(result.updated_at),
        deployedAt: result.deployed_at ? new Date(result.deployed_at) : undefined,
      }));
    } catch (error) {
      console.error('Failed to get instructor configurations:', error);
      throw new Error('Database error retrieving instructor configurations');
    }
  }

  /**
   * Logs content item generation and delivery
   *
   * @param logEntry - Content item log data
   */
  async logContentItemGeneration(logEntry: {
    sessionId: string;
    configurationId: string;
    contentItems: unknown[];
    canvasResponse?: Record<string, unknown>;
    success: boolean;
    errorDetails?: string;
    instructorId: string;
    courseId: string;
    canvasAssignmentId?: string;
    deliveryMethod: 'deep_linking' | 'api_direct' | 'manual';
    responseTimeMs?: number;
    retryCount?: number;
  }): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO content_item_log (
            id, session_id, configuration_id, content_items,
            canvas_response, success, error_details,
            instructor_id, course_id, canvas_assignment_id,
            delivery_method, response_time_ms, retry_count,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          crypto.randomUUID(),
          logEntry.sessionId,
          logEntry.configurationId,
          JSON.stringify(logEntry.contentItems),
          logEntry.canvasResponse ? JSON.stringify(logEntry.canvasResponse) : null,
          logEntry.success,
          logEntry.errorDetails || null,
          logEntry.instructorId,
          logEntry.courseId,
          logEntry.canvasAssignmentId || null,
          logEntry.deliveryMethod,
          logEntry.responseTimeMs || null,
          logEntry.retryCount || 0,
          new Date().toISOString()
        )
        .run();
    } catch (error) {
      console.error('Failed to log content item generation:', error);
      throw new Error('Database error logging content item generation');
    }
  }

  /**
   * Gets Canvas assignment context for session
   *
   * @param sessionId - Session identifier
   * @returns Canvas assignment context or null
   */
  async getCanvasAssignmentContext(sessionId: string): Promise<Record<string, unknown> | null> {
    try {
      const result = await this.db
        .prepare(`
          SELECT canvas_assignment_context
          FROM deep_linking_contexts
          WHERE session_id = ?
          ORDER BY created_at DESC
          LIMIT 1
        `)
        .bind(sessionId)
        .first();

      if (!result || !result.canvas_assignment_context) {
        return null;
      }

      return JSON.parse(result.canvas_assignment_context as string);
    } catch (error) {
      console.error('Failed to get Canvas assignment context:', error);
      throw new Error('Database error retrieving Canvas assignment context');
    }
  }

  /**
   * Updates Canvas assignment context
   *
   * @param sessionId - Session identifier
   * @param context - Canvas assignment context
   */
  async updateCanvasAssignmentContext(
    sessionId: string,
    context: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.db
        .prepare(`
          UPDATE deep_linking_contexts
          SET canvas_assignment_context = ?,
              updated_at = ?
          WHERE session_id = ?
        `)
        .bind(
          JSON.stringify(context),
          new Date().toISOString(),
          sessionId
        )
        .run();
    } catch (error) {
      console.error('Failed to update Canvas assignment context:', error);
      throw new Error('Database error updating Canvas assignment context');
    }
  }

  /**
   * Gets content item delivery statistics
   *
   * @param filters - Optional filters for statistics
   * @returns Delivery statistics
   */
  async getContentItemDeliveryStats(filters: {
    instructorId?: string;
    courseId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  } = {}): Promise<{
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    averageResponseTime: number;
    deliveryMethodBreakdown: Record<string, number>;
  }> {
    try {
      let query = `
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed,
          AVG(response_time_ms) as avg_response_time,
          delivery_method
        FROM content_item_log
        WHERE 1=1
      `;
      const params: any[] = [];

      if (filters.instructorId) {
        query += ' AND instructor_id = ?';
        params.push(filters.instructorId);
      }

      if (filters.courseId) {
        query += ' AND course_id = ?';
        params.push(filters.courseId);
      }

      if (filters.dateFrom) {
        query += ' AND created_at >= ?';
        params.push(filters.dateFrom.toISOString());
      }

      if (filters.dateTo) {
        query += ' AND created_at <= ?';
        params.push(filters.dateTo.toISOString());
      }

      query += ' GROUP BY delivery_method';

      const results = await this.db
        .prepare(query)
        .bind(...params)
        .all();

      const deliveryMethodBreakdown: Record<string, number> = {};
      let totalDeliveries = 0;
      let successfulDeliveries = 0;
      let failedDeliveries = 0;
      let totalResponseTime = 0;
      let responseTimeCount = 0;

      for (const row of results.results) {
        const result = row as any;
        const method = result.delivery_method;
        const total = result.total;

        deliveryMethodBreakdown[method] = total;
        totalDeliveries += total;
        successfulDeliveries += result.successful;
        failedDeliveries += result.failed;

        if (result.avg_response_time) {
          totalResponseTime += result.avg_response_time * total;
          responseTimeCount += total;
        }
      }

      return {
        totalDeliveries,
        successfulDeliveries,
        failedDeliveries,
        averageResponseTime: responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0,
        deliveryMethodBreakdown,
      };
    } catch (error) {
      console.error('Failed to get content item delivery stats:', error);
      throw new Error('Database error retrieving delivery statistics');
    }
  }

  /**
   * Cleans up expired sessions and related data
   *
   * @param retentionDays - Number of days to retain data
   * @returns Cleanup statistics
   */
  async cleanupExpiredData(retentionDays: number = 30): Promise<{
    sessionsDeleted: number;
    contextsDeleted: number;
    logsDeleted: number;
  }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      const cutoffIso = cutoffDate.toISOString();

      // Clean up expired sessions (handled by session security service)
      // Clean up old deep linking contexts
      const contextsResult = await this.db
        .prepare(`
          DELETE FROM deep_linking_contexts
          WHERE created_at < ?
        `)
        .bind(cutoffIso)
        .run();

      // Clean up old content item logs
      const logsResult = await this.db
        .prepare(`
          DELETE FROM content_item_log
          WHERE created_at < ?
        `)
        .bind(cutoffIso)
        .run();

      return {
        sessionsDeleted: 0, // Handled by session security service
        contextsDeleted: contextsResult.changes || 0,
        logsDeleted: logsResult.changes || 0,
      };
    } catch (error) {
      console.error('Failed to cleanup expired data:', error);
      throw new Error('Database error during cleanup operation');
    }
  }
}

/**
 * Type exports for external use
 */
export type {
  DeepLinkingContext,
  AssessmentConfiguration,
  ContentItemLogEntry,
};