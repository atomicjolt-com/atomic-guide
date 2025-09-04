/**
 * @fileoverview API handlers for student performance analytics
 * @module features/dashboard/server/handlers/analyticsApi
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { D1Database, Queue, Ai } from '@cloudflare/workers-types';
import { PerformanceAnalyticsService } from '../services/PerformanceAnalyticsService';
import { PrivacyPreservingAnalytics } from '../services/PrivacyPreservingAnalytics';
import { AdaptiveLearningService } from '../services/AdaptiveLearningService';

/**
 * Environment interface for analytics API
 */
interface AnalyticsEnv {
  DB: D1Database;
  ANALYTICS_QUEUE: Queue;
  AI: Ai;
}

/**
 * Request validation schemas
 */
const StudentAnalyticsParamsSchema = z.object({
  studentId: z.string().min(1),
  courseId: z.string().min(1).optional(),
});

const InstructorAnalyticsParamsSchema = z.object({
  courseId: z.string().min(1),
});

const RecommendationActionSchema = z.object({
  recommendationId: z.string().min(1),
  action: z.enum(['completed', 'dismissed', 'modified']),
  feedback: z.string().optional(),
});

const BenchmarkRequestSchema = z.object({
  courseId: z.string().min(1),
  benchmarkType: z.enum(['course_average', 'percentile_bands', 'difficulty_calibration']),
  aggregationLevel: z.enum(['course', 'module', 'concept', 'assessment']),
  conceptId: z.string().optional(),
  assessmentId: z.string().optional(),
});

const AdaptiveRecommendationsSchema = z.object({
  studentId: z.string().min(1),
  courseId: z.string().min(1),
  timeAvailable: z.number().int().min(0).optional(),
  difficultyPreference: z.enum(['easy', 'moderate', 'challenging']).default('moderate'),
  goalType: z.enum(['mastery', 'completion', 'exploration']).default('mastery'),
});

/**
 * Create analytics API router with all endpoints
 *
 * @param tenantId - Tenant identifier for multi-tenancy
 * @returns Hono router with analytics endpoints
 */
export function createAnalyticsApi(tenantId: string): Hono<{ Bindings: AnalyticsEnv }> {
  const api = new Hono<{ Bindings: AnalyticsEnv }>();

  // Middleware to initialize services
  api.use('*', async (c, next) => {
    const analyticsService = new PerformanceAnalyticsService(c.env.DB, c.env.ANALYTICS_QUEUE, tenantId);

    const privacyService = new PrivacyPreservingAnalytics(c.env.DB, tenantId);

    const adaptiveLearningService = new AdaptiveLearningService(
      c.env.DB,
      c.env.AI,
      tenantId,
      true // Enable AI enhancement
    );

    c.set('analyticsService', analyticsService);
    c.set('privacyService', privacyService);
    c.set('adaptiveLearningService', adaptiveLearningService);

    await next();
  });

  /**
   * GET /analytics/student/:studentId/performance
   * Get comprehensive student performance analytics
   */
  api.get('/student/:studentId/performance', zValidator('param', StudentAnalyticsParamsSchema), async (c) => {
    try {
      const { studentId } = c.req.valid('param');
      const courseId = c.req.query('courseId');

      const analyticsService = c.get('analyticsService') as PerformanceAnalyticsService;
      const privacyService = c.get('privacyService') as PrivacyPreservingAnalytics;

      // Validate privacy consent
      const consentResult = await privacyService.validatePrivacyConsent(studentId, courseId, 'performance');

      if (!consentResult.isAllowed) {
        return c.json(
          {
            success: false,
            error: 'Access denied: ' + consentResult.reason,
          },
          403
        );
      }

      if (!courseId) {
        return c.json(
          {
            success: false,
            error: 'courseId query parameter is required',
          },
          400
        );
      }

      // Get student analytics
      const analytics = await analyticsService.getStudentAnalytics(studentId, courseId);

      // Audit access
      await privacyService.auditDataAccess(studentId, 'student', 'view_profile', `Student performance analytics for course ${courseId}`);

      return c.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      console.error('Student analytics error:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to retrieve student analytics',
        },
        500
      );
    }
  });

  /**
   * GET /analytics/instructor/:courseId/overview
   * Get course-wide analytics for instructors
   */
  api.get('/instructor/:courseId/overview', zValidator('param', InstructorAnalyticsParamsSchema), async (c) => {
    try {
      const { courseId } = c.req.valid('param');
      const instructorId = c.req.header('X-Instructor-ID'); // From JWT or context

      if (!instructorId) {
        return c.json(
          {
            success: false,
            error: 'Instructor authentication required',
          },
          401
        );
      }

      const _analyticsService = c.get('analyticsService') as PerformanceAnalyticsService;
      const privacyService = c.get('privacyService') as PrivacyPreservingAnalytics;

      // Get aggregated course metrics
      const courseMetrics = await getCourseMetrics(c.env.DB, tenantId, courseId);

      // Get student summaries with privacy filtering
      const studentSummaries = await getStudentSummaries(c.env.DB, tenantId, courseId, privacyService);

      // Get instructor alerts
      const alerts = await getInstructorAlerts(c.env.DB, tenantId, instructorId, courseId);

      // Get content engagement analytics
      const contentEngagement = await getContentEngagement(c.env.DB, tenantId, courseId);

      // Audit access
      await privacyService.auditDataAccess(instructorId, 'instructor', 'view_profile', `Course analytics overview for ${courseId}`);

      return c.json({
        success: true,
        data: {
          classMetrics: courseMetrics,
          studentSummaries,
          alerts,
          contentEngagement,
        },
      });
    } catch (error) {
      console.error('Instructor analytics error:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to retrieve instructor analytics',
        },
        500
      );
    }
  });

  /**
   * POST /analytics/recommendations/:studentId/action
   * Handle student actions on recommendations
   */
  api.post(
    '/recommendations/:studentId/action',
    zValidator('param', z.object({ studentId: z.string() })),
    zValidator('json', RecommendationActionSchema),
    async (c) => {
      try {
        const { studentId } = c.req.valid('param');
        const { recommendationId, action, feedback } = c.req.valid('json');

        const analyticsService = c.get('analyticsService') as PerformanceAnalyticsService;

        // Update recommendation status
        await c.env.DB.prepare(
          `
            UPDATE learning_recommendations 
            SET status = ?, updated_at = datetime('now'),
                effectiveness_score = CASE 
                  WHEN ? = 'completed' THEN 1.0
                  WHEN ? = 'dismissed' THEN 0.2
                  ELSE effectiveness_score
                END
            WHERE id = ?
          `
        )
          .bind(action === 'completed' ? 'completed' : action === 'dismissed' ? 'dismissed' : 'active', action, action, recommendationId)
          .run();

        // Log feedback if provided
        if (feedback) {
          await c.env.DB.prepare(
            `
              INSERT INTO audit_logs (
                tenant_id, actor_type, actor_id, action, resource_type,
                resource_id, details, created_at
              ) VALUES (?, 'student', ?, 'recommendation_feedback', 'learning_recommendation', ?, ?, datetime('now'))
            `
          )
            .bind(tenantId, studentId, recommendationId, JSON.stringify({ action, feedback }))
            .run();
        }

        // Generate new recommendations if action was completed
        if (action === 'completed') {
          // Queue recommendation regeneration
          await analyticsService.queueAnalyticsTask({
            taskType: 'recommendation_generation',
            tenantId,
            studentId,
            priority: 5,
            taskData: { triggeredBy: 'recommendation_completed' },
          });
        }

        return c.json({
          success: true,
          message: 'Recommendation action processed successfully',
        });
      } catch (error) {
        console.error('Recommendation action error:', error);
        return c.json(
          {
            success: false,
            error: 'Failed to process recommendation action',
          },
          500
        );
      }
    }
  );

  /**
   * GET /analytics/benchmarks
   * Get anonymized benchmark data for comparison
   */
  api.get('/benchmarks', zValidator('query', BenchmarkRequestSchema), async (c) => {
    try {
      const params = c.req.valid('query');
      const privacyService = c.get('privacyService') as PrivacyPreservingAnalytics;

      // Get anonymized benchmark
      const benchmark = await privacyService.getAnonymizedBenchmark(
        params.courseId,
        params.benchmarkType,
        params.aggregationLevel,
        params.conceptId,
        params.assessmentId
      );

      if (!benchmark) {
        return c.json(
          {
            success: false,
            error: 'Insufficient data for privacy-preserving benchmark',
          },
          404
        );
      }

      // Audit benchmark access
      await privacyService.auditDataAccess(
        'anonymous',
        'system',
        'generate_benchmark',
        `Benchmark: ${params.benchmarkType} for ${params.courseId}`
      );

      return c.json({
        success: true,
        data: benchmark,
      });
    } catch (error) {
      console.error('Benchmark error:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to generate benchmark data',
        },
        500
      );
    }
  });

  /**
   * POST /analytics/recommendations/adaptive
   * Generate adaptive learning recommendations
   */
  api.post('/recommendations/adaptive', zValidator('json', AdaptiveRecommendationsSchema), async (c) => {
    try {
      const params = c.req.valid('json');
      const adaptiveLearningService = c.get('adaptiveLearningService') as AdaptiveLearningService;
      const privacyService = c.get('privacyService') as PrivacyPreservingAnalytics;

      // Validate privacy consent
      const consentResult = await privacyService.validatePrivacyConsent(params.studentId, params.courseId, 'performance');

      if (!consentResult.isAllowed) {
        return c.json(
          {
            success: false,
            error: 'Access denied: ' + consentResult.reason,
          },
          403
        );
      }

      // Get student performance context
      const analyticsService = c.get('analyticsService') as PerformanceAnalyticsService;
      const analytics = await analyticsService.getStudentAnalytics(params.studentId, params.courseId);

      if (!analytics.profile) {
        return c.json(
          {
            success: false,
            error: 'Student performance profile not found',
          },
          404
        );
      }

      // Generate adaptive recommendations
      const recommendations = await adaptiveLearningService.generateAdaptiveRecommendations({
        studentId: params.studentId,
        courseId: params.courseId,
        currentMastery: analytics.profile.overallMastery,
        learningVelocity: analytics.profile.learningVelocity,
        confidenceLevel: analytics.profile.confidenceLevel,
        strugglingConcepts: analytics.conceptMasteries.filter((cm) => cm.masteryLevel < 0.7).map((cm) => cm.conceptId),
        strongConcepts: analytics.conceptMasteries.filter((cm) => cm.masteryLevel >= 0.8).map((cm) => cm.conceptId),
        timeAvailable: params.timeAvailable,
        difficultyPreference: params.difficultyPreference,
        goalType: params.goalType,
      });

      return c.json({
        success: true,
        data: {
          recommendations,
          generatedAt: new Date().toISOString(),
          context: {
            overallMastery: analytics.profile.overallMastery,
            strugglingConceptsCount: analytics.conceptMasteries.filter((cm) => cm.masteryLevel < 0.7).length,
            strongConceptsCount: analytics.conceptMasteries.filter((cm) => cm.masteryLevel >= 0.8).length,
          },
        },
      });
    } catch (error) {
      console.error('Adaptive recommendations error:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to generate adaptive recommendations',
        },
        500
      );
    }
  });

  /**
   * POST /analytics/queue/process
   * Trigger analytics processing for a student
   */
  api.post(
    '/queue/process',
    zValidator(
      'json',
      z.object({
        studentId: z.string().min(1),
        courseId: z.string().min(1),
        taskTypes: z.array(z.enum(['performance_update', 'recommendation_generation', 'pattern_detection', 'alert_check'])),
        priority: z.number().int().min(1).max(10).default(5),
      })
    ),
    async (c) => {
      try {
        const { studentId, courseId, taskTypes, priority } = c.req.valid('json');
        const analyticsService = c.get('analyticsService') as PerformanceAnalyticsService;

        const taskIds: string[] = [];

        // Queue each requested task type
        for (const taskType of taskTypes) {
          const taskId = await analyticsService.queueAnalyticsTask({
            taskType,
            tenantId,
            studentId,
            courseId,
            priority,
            taskData: { triggeredBy: 'api_request' },
          });
          taskIds.push(taskId);
        }

        return c.json({
          success: true,
          data: {
            message: 'Analytics processing queued successfully',
            taskIds,
            queuedAt: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.error('Queue processing error:', error);
        return c.json(
          {
            success: false,
            error: 'Failed to queue analytics processing',
          },
          500
        );
      }
    }
  );

  return api;
}

// Helper functions

async function getCourseMetrics(
  db: D1Database,
  tenantId: string,
  courseId: string
): Promise<{
  totalStudents: number;
  averageMastery: number;
  atRiskCount: number;
  strugglingConcepts: string[];
}> {
  const metricsResult = await db
    .prepare(
      `
      SELECT 
        COUNT(*) as total_students,
        AVG(overall_mastery) as average_mastery,
        COUNT(CASE WHEN overall_mastery < 0.5 THEN 1 END) as at_risk_count
      FROM student_performance_profiles 
      WHERE tenant_id = ? AND course_id = ?
    `
    )
    .bind(tenantId, courseId)
    .first();

  const strugglingConceptsResult = await db
    .prepare(
      `
      SELECT cm.concept_name, COUNT(*) as struggling_count
      FROM concept_masteries cm
      JOIN student_performance_profiles spp ON cm.profile_id = spp.id
      WHERE spp.tenant_id = ? AND spp.course_id = ? AND cm.mastery_level < 0.6
      GROUP BY cm.concept_name
      ORDER BY struggling_count DESC
      LIMIT 5
    `
    )
    .bind(tenantId, courseId)
    .all();

  return {
    totalStudents: Number(metricsResult?.total_students) || 0,
    averageMastery: Number(metricsResult?.average_mastery) || 0,
    atRiskCount: Number(metricsResult?.at_risk_count) || 0,
    strugglingConcepts: strugglingConceptsResult.results.map((row) => row.concept_name as string),
  };
}

async function getStudentSummaries(
  db: D1Database,
  tenantId: string,
  courseId: string,
  _privacyService: PrivacyPreservingAnalytics
): Promise<
  Array<{
    studentId: string;
    name?: string;
    overallMastery: number;
    riskLevel: 'low' | 'medium' | 'high';
    lastActive: string;
  }>
> {
  const result = await db
    .prepare(
      `
      SELECT 
        spp.student_id,
        spp.overall_mastery,
        spp.last_calculated,
        lp.name,
        MAX(ls.last_message_at) as last_active
      FROM student_performance_profiles spp
      LEFT JOIN learner_profiles lp ON spp.student_id = lp.lti_user_id AND spp.tenant_id = lp.tenant_id
      LEFT JOIN chat_conversations cc ON lp.id = cc.learner_profile_id
      LEFT JOIN learning_sessions ls ON lp.id = ls.learner_profile_id
      JOIN analytics_privacy_consent apc ON spp.student_id = apc.student_id 
        AND spp.course_id = apc.course_id
      WHERE spp.tenant_id = ? AND spp.course_id = ?
        AND apc.instructor_visibility_consent = TRUE
        AND apc.withdrawal_requested_at IS NULL
      GROUP BY spp.student_id, spp.overall_mastery, spp.last_calculated, lp.name
      ORDER BY spp.overall_mastery ASC
    `
    )
    .bind(tenantId, courseId)
    .all();

  return result.results.map((row) => ({
    studentId: row.student_id as string,
    name: row.name as string | undefined,
    overallMastery: Number(row.overall_mastery) || 0,
    riskLevel: getRiskLevel(Number(row.overall_mastery) || 0),
    lastActive: (row.last_active || row.last_calculated) as string,
  }));
}

async function getInstructorAlerts(
  db: D1Database,
  tenantId: string,
  instructorId: string,
  courseId: string
): Promise<
  Array<{
    id: string;
    alertType: string;
    priority: string;
    studentIds: string[];
    alertData: Record<string, unknown>;
    createdAt: string;
    acknowledged: boolean;
  }>
> {
  const result = await db
    .prepare(
      `
      SELECT 
        id, alert_type, priority, student_ids, alert_data,
        created_at, acknowledged
      FROM instructor_alerts 
      WHERE tenant_id = ? AND course_id = ? AND dismissed = FALSE
      ORDER BY 
        CASE priority 
          WHEN 'urgent' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          ELSE 4 
        END,
        created_at DESC
      LIMIT 20
    `
    )
    .bind(tenantId, courseId)
    .all();

  return result.results.map((row) => ({
    id: row.id as string,
    alertType: row.alert_type as string,
    priority: row.priority as string,
    studentIds: JSON.parse(row.student_ids as string),
    alertData: JSON.parse(row.alert_data as string),
    createdAt: row.created_at as string,
    acknowledged: Boolean(row.acknowledged),
  }));
}

async function getContentEngagement(
  db: D1Database,
  tenantId: string,
  courseId: string
): Promise<
  Array<{
    contentId: string;
    averageTime: number;
    strugglingStudents: number;
    recommendedTiming: number;
  }>
> {
  const result = await db
    .prepare(
      `
      SELECT 
        ce.content_id,
        AVG(ce.total_time_seconds) as average_time,
        COUNT(CASE WHEN ce.hover_confusion_events > 2 THEN 1 END) as struggling_students,
        COUNT(*) as total_students
      FROM content_engagement ce
      JOIN course_content_mapping ccm ON ce.content_id = ccm.content_id
      WHERE ce.tenant_id = ? AND ccm.course_id = ?
        AND ce.session_end IS NOT NULL
        AND ce.total_time_seconds > 0
      GROUP BY ce.content_id
      HAVING COUNT(*) >= 5  -- Minimum sample size
      ORDER BY struggling_students DESC
      LIMIT 10
    `
    )
    .bind(tenantId, courseId)
    .all();

  return result.results.map((row) => ({
    contentId: row.content_id as string,
    averageTime: Number(row.average_time) || 0,
    strugglingStudents: Number(row.struggling_students) || 0,
    recommendedTiming: calculateRecommendedTiming(
      Number(row.average_time) || 0,
      Number(row.struggling_students) || 0,
      Number(row.total_students) || 1
    ),
  }));
}

function getRiskLevel(mastery: number): 'low' | 'medium' | 'high' {
  if (mastery < 0.4) return 'high';
  if (mastery < 0.7) return 'medium';
  return 'low';
}

function calculateRecommendedTiming(averageTime: number, strugglingCount: number, totalStudents: number): number {
  const struggleRate = strugglingCount / totalStudents;
  const baseTime = averageTime / 60; // Convert to minutes

  // Add buffer time based on struggle rate
  return Math.ceil(baseTime * (1 + struggleRate * 0.5));
}
