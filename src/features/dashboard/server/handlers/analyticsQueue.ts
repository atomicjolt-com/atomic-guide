/**
 * @fileoverview Analytics queue consumer handler for async processing
 * @module features/dashboard/server/handlers/analyticsQueue
 */

import { z } from 'zod';
import type { MessageBatch, Queue } from '@cloudflare/workers-types';
import { PerformanceAnalyticsService } from '../services/PerformanceAnalyticsService';
import { PrivacyPreservingAnalytics } from '../services/PrivacyPreservingAnalytics';

/**
 * Schema for analytics queue message
 */
export const AnalyticsQueueMessageSchema = z.object({
  taskId: z.string(),
  taskType: z.enum(['performance_update', 'recommendation_generation', 'pattern_detection', 'alert_check']),
  tenantId: z.string(),
  studentId: z.string().optional(),
  courseId: z.string().optional(),
  assessmentId: z.string().optional(),
  priority: z.number().int().min(1).max(10),
  taskData: z.record(z.unknown()),
  timestamp: z.string().datetime().optional(),
  retryCount: z.number().int().min(0).default(0),
});

export type AnalyticsQueueMessage = z.infer<typeof AnalyticsQueueMessageSchema>;

/**
 * Schema for batch processing result
 */
export const BatchProcessingResultSchema = z.object({
  batchId: z.string(),
  processedCount: z.number().int().min(0),
  failedCount: z.number().int().min(0),
  totalCount: z.number().int().min(0),
  processingDurationMs: z.number().int().min(0),
  errors: z.array(z.object({
    taskId: z.string(),
    error: z.string(),
    retryable: z.boolean(),
  })),
  metrics: z.record(z.unknown()),
});

export type BatchProcessingResult = z.infer<typeof BatchProcessingResultSchema>;

/**
 * Analytics queue consumer for processing performance analytics tasks
 * 
 * Handles async processing of student performance updates, pattern detection,
 * recommendation generation, and instructor alerts with proper error handling
 * and retry logic.
 * 
 * @class AnalyticsQueueConsumer
 */
export class AnalyticsQueueConsumer {
  constructor(
    private readonly analyticsService: PerformanceAnalyticsService,
    private readonly privacyService: PrivacyPreservingAnalytics,
    private readonly env: {
      DB: D1Database;
      ANALYTICS_QUEUE: Queue;
    }
  ) {}

  /**
   * Process analytics queue message batch
   * 
   * @param batch - Message batch from Cloudflare Queue
   * @returns Promise resolving to processing result
   */
  public async processBatch(batch: MessageBatch<AnalyticsQueueMessage>): Promise<BatchProcessingResult> {
    const batchId = crypto.randomUUID();
    const startTime = Date.now();
    
    let processedCount = 0;
    let failedCount = 0;
    const errors: Array<{ taskId: string; error: string; retryable: boolean }> = [];
    const metrics = {
      startTime: new Date().toISOString(),
      batchSize: batch.messages.length,
      taskTypes: {} as Record<string, number>,
    };

    // Log batch start
    await this.logBatchStart(batchId, batch.messages.length);

    try {
      // Process messages concurrently with controlled concurrency
      const concurrencyLimit = 5; // Process max 5 messages at once
      const chunks = this.chunkArray(batch.messages, concurrencyLimit);

      for (const chunk of chunks) {
        const chunkPromises = chunk.map(message => this.processMessage(message));
        const chunkResults = await Promise.allSettled(chunkPromises);

        for (let i = 0; i < chunkResults.length; i++) {
          const result = chunkResults[i];
          const message = chunk[i];
          
          // Track task types
          const taskType = message.body.taskType;
          metrics.taskTypes[taskType] = (metrics.taskTypes[taskType] || 0) + 1;

          if (result.status === 'fulfilled') {
            if (result.value.success) {
              processedCount++;
              // Acknowledge successful message
              message.ack();
            } else {
              failedCount++;
              errors.push({
                taskId: message.body.taskId,
                error: result.value.error || 'Unknown error',
                retryable: result.value.retryable || false,
              });
              
              if (result.value.retryable) {
                // Let message retry
                message.retry();
              } else {
                // Acknowledge failed message to prevent infinite retries
                message.ack();
              }
            }
          } else {
            failedCount++;
            errors.push({
              taskId: message.body.taskId,
              error: result.reason?.message || 'Processing failed',
              retryable: true,
            });
            message.retry();
          }
        }
      }

    } catch (error) {
      console.error('Analytics batch processing error:', error);
      
      // Retry all messages on batch-level failure
      batch.messages.forEach(message => message.retry());
      
      throw error;
    }

    const processingDurationMs = Date.now() - startTime;

    // Log batch completion
    await this.logBatchCompletion(
      batchId,
      processedCount,
      failedCount,
      batch.messages.length,
      processingDurationMs,
      errors,
      metrics
    );

    return {
      batchId,
      processedCount,
      failedCount,
      totalCount: batch.messages.length,
      processingDurationMs,
      errors,
      metrics,
    };
  }

  /**
   * Process individual analytics message
   * 
   * @param message - Queue message to process
   * @returns Promise resolving to processing result
   */
  private async processMessage(message: { body: AnalyticsQueueMessage }): Promise<{
    success: boolean;
    error?: string;
    retryable?: boolean;
  }> {
    const taskStartTime = Date.now();
    
    try {
      // Validate message
      const validatedMessage = AnalyticsQueueMessageSchema.parse(message.body);
      
      // Update task status to processing
      await this.updateTaskStatus(validatedMessage.taskId, 'processing');

      // Route to appropriate handler based on task type
      switch (validatedMessage.taskType) {
        case 'performance_update':
          await this.handlePerformanceUpdate(validatedMessage);
          break;
          
        case 'recommendation_generation':
          await this.handleRecommendationGeneration(validatedMessage);
          break;
          
        case 'pattern_detection':
          await this.handlePatternDetection(validatedMessage);
          break;
          
        case 'alert_check':
          await this.handleAlertCheck(validatedMessage);
          break;
          
        default:
          throw new Error(`Unknown task type: ${validatedMessage.taskType}`);
      }

      const processingDuration = Date.now() - taskStartTime;
      
      // Update task status to completed
      await this.updateTaskStatus(
        validatedMessage.taskId, 
        'completed', 
        undefined, 
        processingDuration
      );

      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Determine if error is retryable
      const retryable = this.isRetryableError(error);
      
      // Update task status to failed
      await this.updateTaskStatus(
        message.body.taskId,
        'failed',
        errorMessage
      );

      return {
        success: false,
        error: errorMessage,
        retryable,
      };
    }
  }

  /**
   * Handle performance update task
   */
  private async handlePerformanceUpdate(message: AnalyticsQueueMessage): Promise<void> {
    if (!message.studentId || !message.courseId) {
      throw new Error('Performance update requires studentId and courseId');
    }

    // Validate privacy consent
    const consentResult = await this.privacyService.validatePrivacyConsent(
      message.studentId,
      message.courseId,
      'performance'
    );

    if (!consentResult.isAllowed) {
      throw new Error(`Privacy consent validation failed: ${consentResult.reason}`);
    }

    // Update performance profile
    await this.analyticsService.updatePerformanceProfile(
      message.studentId,
      message.courseId
    );

    // Audit the operation
    await this.privacyService.auditDataAccess(
      'system',
      'system',
      'view_profile',
      `Performance update for student ${message.studentId} in course ${message.courseId}`
    );
  }

  /**
   * Handle recommendation generation task
   */
  private async handleRecommendationGeneration(message: AnalyticsQueueMessage): Promise<void> {
    if (!message.studentId || !message.courseId) {
      throw new Error('Recommendation generation requires studentId and courseId');
    }

    // Generate recommendations
    const recommendations = await this.analyticsService.generateRecommendations(
      message.studentId,
      message.courseId
    );

    // Store recommendations in database
    for (const recommendation of recommendations) {
      await this.env.DB
        .prepare(`
          INSERT INTO learning_recommendations (
            id, profile_id, recommendation_type, priority, concepts_involved,
            suggested_actions, estimated_time_minutes, content_references,
            reasoning, status, created_at, updated_at, expires_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          recommendation.id,
          recommendation.profileId,
          recommendation.recommendationType,
          recommendation.priority,
          JSON.stringify(recommendation.conceptsInvolved),
          JSON.stringify(recommendation.suggestedActions),
          recommendation.estimatedTimeMinutes || null,
          recommendation.contentReferences ? JSON.stringify(recommendation.contentReferences) : null,
          recommendation.reasoning,
          recommendation.status,
          recommendation.createdAt,
          recommendation.updatedAt,
          recommendation.expiresAt || null
        )
        .run();
    }
  }

  /**
   * Handle pattern detection task
   */
  private async handlePatternDetection(message: AnalyticsQueueMessage): Promise<void> {
    if (!message.studentId || !message.courseId) {
      throw new Error('Pattern detection requires studentId and courseId');
    }

    // Detect learning patterns
    const patterns = await this.analyticsService.detectLearningPatterns(
      message.studentId,
      message.courseId
    );

    // Store detected patterns
    for (const pattern of patterns) {
      await this.env.DB
        .prepare(`
          INSERT INTO struggle_patterns (
            id, tenant_id, student_id, pattern_type, concepts_involved,
            evidence_count, severity, suggested_interventions,
            detected_at, confidence_score
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          pattern.id,
          pattern.tenantId,
          pattern.studentId,
          pattern.patternType,
          JSON.stringify(pattern.conceptsInvolved),
          pattern.evidenceCount,
          pattern.severity,
          JSON.stringify(pattern.suggestedInterventions),
          pattern.detectedAt,
          pattern.confidenceScore
        )
        .run();
    }
  }

  /**
   * Handle alert check task
   */
  private async handleAlertCheck(message: AnalyticsQueueMessage): Promise<void> {
    if (!message.courseId) {
      throw new Error('Alert check requires courseId');
    }

    // Check for at-risk students
    const atRiskStudents = await this.identifyAtRiskStudents(
      message.tenantId,
      message.courseId
    );

    // Create instructor alerts for at-risk students
    if (atRiskStudents.length > 0) {
      const alertId = crypto.randomUUID();
      
      await this.env.DB
        .prepare(`
          INSERT INTO instructor_alerts (
            id, tenant_id, instructor_id, course_id, alert_type,
            priority, student_ids, alert_data, created_at
          ) VALUES (?, ?, ?, ?, 'at_risk_student', 'high', ?, ?, datetime('now'))
        `)
        .bind(
          alertId,
          message.tenantId,
          'system', // Will be routed to course instructors
          message.courseId,
          JSON.stringify(atRiskStudents.map(s => s.studentId)),
          JSON.stringify({
            message: `${atRiskStudents.length} students identified as at-risk`,
            students: atRiskStudents,
            detectionTimestamp: new Date().toISOString(),
          })
        )
        .run();
    }
  }

  /**
   * Identify at-risk students in a course
   */
  private async identifyAtRiskStudents(tenantId: string, courseId: string): Promise<Array<{
    studentId: string;
    riskScore: number;
    reasons: string[];
  }>> {
    const result = await this.env.DB
      .prepare(`
        SELECT 
          spp.student_id,
          spp.overall_mastery,
          spp.learning_velocity,
          spp.confidence_level,
          COUNT(sp.id) as struggle_count,
          AVG(sp.severity) as avg_severity
        FROM student_performance_profiles spp
        LEFT JOIN struggle_patterns sp ON spp.student_id = sp.student_id 
          AND sp.resolved_at IS NULL
        WHERE spp.tenant_id = ? AND spp.course_id = ?
        GROUP BY spp.student_id, spp.overall_mastery, spp.learning_velocity, spp.confidence_level
      `)
      .bind(tenantId, courseId)
      .all();

    const atRiskStudents: Array<{
      studentId: string;
      riskScore: number;
      reasons: string[];
    }> = [];

    for (const row of result.results) {
      const overallMastery = Number(row.overall_mastery) || 0;
      const learningVelocity = Number(row.learning_velocity) || 0;
      const confidenceLevel = Number(row.confidence_level) || 0.5;
      const struggleCount = Number(row.struggle_count) || 0;
      const avgSeverity = Number(row.avg_severity) || 0;

      const reasons: string[] = [];
      let riskScore = 0;

      // Low mastery risk
      if (overallMastery < 0.5) {
        riskScore += 0.4;
        reasons.push('Low overall mastery');
      }

      // Low learning velocity risk
      if (learningVelocity < 0.1) {
        riskScore += 0.2;
        reasons.push('Slow learning progress');
      }

      // Low confidence risk
      if (confidenceLevel < 0.3) {
        riskScore += 0.2;
        reasons.push('Low confidence level');
      }

      // Struggle patterns risk
      if (struggleCount > 2) {
        riskScore += 0.2;
        reasons.push('Multiple unresolved struggles');
      }

      if (avgSeverity > 0.7) {
        riskScore += 0.1;
        reasons.push('High severity struggles');
      }

      // Consider at-risk if score > 0.6
      if (riskScore > 0.6) {
        atRiskStudents.push({
          studentId: row.student_id as string,
          riskScore: Math.min(riskScore, 1.0),
          reasons,
        });
      }
    }

    return atRiskStudents;
  }

  /**
   * Update task status in database
   */
  private async updateTaskStatus(
    taskId: string,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    errorMessage?: string,
    processingDuration?: number
  ): Promise<void> {
    const updateFields = ['status = ?'];
    const params = [status];

    if (status === 'processing') {
      updateFields.push('started_at = datetime(\'now\')');
    }

    if (status === 'completed' || status === 'failed') {
      updateFields.push('completed_at = datetime(\'now\')');
    }

    if (errorMessage) {
      updateFields.push('error_message = ?');
      params.push(errorMessage);
    }

    if (processingDuration) {
      updateFields.push('processing_duration_ms = ?');
      params.push(processingDuration);
    }

    params.push(taskId);

    await this.env.DB
      .prepare(`
        UPDATE analytics_processing_queue 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `)
      .bind(...params)
      .run();
  }

  /**
   * Log batch processing start
   */
  private async logBatchStart(batchId: string, messageCount: number): Promise<void> {
    await this.env.DB
      .prepare(`
        INSERT INTO analytics_batch_logs (
          id, tenant_id, batch_id, batch_type, total_count, started_at
        ) VALUES (?, 'system', ?, 'queue_processing', ?, datetime('now'))
      `)
      .bind(crypto.randomUUID(), batchId, messageCount)
      .run();
  }

  /**
   * Log batch processing completion
   */
  private async logBatchCompletion(
    batchId: string,
    processedCount: number,
    failedCount: number,
    totalCount: number,
    processingDurationMs: number,
    errors: Array<{ taskId: string; error: string; retryable: boolean }>,
    metrics: Record<string, unknown>
  ): Promise<void> {
    await this.env.DB
      .prepare(`
        UPDATE analytics_batch_logs 
        SET 
          processed_count = ?,
          failed_count = ?,
          completed_at = datetime('now'),
          processing_duration_ms = ?,
          error_summary = ?,
          performance_metrics = ?
        WHERE batch_id = ?
      `)
      .bind(
        processedCount,
        failedCount,
        processingDurationMs,
        JSON.stringify(errors),
        JSON.stringify(metrics),
        batchId
      )
      .run();
  }

  /**
   * Determine if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      // Network/temporary errors are retryable
      if (message.includes('network') || 
          message.includes('timeout') || 
          message.includes('rate limit') ||
          message.includes('service unavailable')) {
        return true;
      }
      
      // Data/validation errors are not retryable
      if (message.includes('validation') || 
          message.includes('invalid') || 
          message.includes('not found') ||
          message.includes('privacy consent')) {
        return false;
      }
    }
    
    // Default to retryable for unknown errors
    return true;
  }

  /**
   * Split array into chunks of specified size
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}