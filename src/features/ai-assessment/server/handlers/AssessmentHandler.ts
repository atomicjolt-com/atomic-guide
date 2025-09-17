/**
 * @fileoverview Assessment API Handler
 * @module features/ai-assessment/server/handlers/AssessmentHandler
 *
 * HTTP request handlers for AI assessment system endpoints.
 * Provides REST API for session management, student interactions, and grade passback.
 *
 * Features:
 * - Session creation and management endpoints
 * - Student response processing with real-time AI feedback
 * - Grade calculation and Canvas passback integration
 * - Security validation and error handling
 * - Performance monitoring and analytics
 */

import { Context } from 'hono';
import { z } from 'zod';

import {
  AssessmentSession,
  AssessmentSessionConfig,
  AssessmentSessionId,
  AssessmentMessage,
  GradeCalculation,
  UserId,
  CourseId,
  AssessmentSessionIdSchema,
  UserIdSchema,
  CourseIdSchema,
  AssessmentSessionConfigSchema,
  AIAssessmentError,
  SessionValidationError
} from '../../shared/types.ts';

import { ConversationalAssessmentEngine } from '../services/ConversationalAssessmentEngine.ts';
import { AssessmentAIService } from '../services/AssessmentAIService.ts';
import { AssessmentSessionRepository } from '../repositories/AssessmentSessionRepository.ts';
import { CanvasGradePassbackService } from '../services/CanvasGradePassbackService.ts';
import { AssessmentContentGenerator } from '../services/AssessmentContentGenerator.ts';

/**
 * Request validation schemas
 */
const CreateSessionRequestSchema = z.object({
  configId: z.string().uuid(),
  studentId: z.string(),
  courseId: z.string(),
  assessmentTitle: z.string().min(1).max(200),
  settings: z.object({
    masteryThreshold: z.number().min(0.5).max(1.0),
    maxAttempts: z.number().min(1).max(10),
    timeLimit: z.number().min(0).optional(),
    allowHints: z.boolean(),
    showFeedback: z.boolean(),
    adaptiveDifficulty: z.boolean(),
    requireMastery: z.boolean()
  }),
  context: z.object({
    canvasAssignmentId: z.string().optional(),
    contentReference: z.string().optional(),
    learningObjectives: z.array(z.string()),
    concepts: z.array(z.string()),
    prerequisites: z.array(z.string()).optional()
  }),
  grading: z.object({
    passbackEnabled: z.boolean(),
    pointsPossible: z.number().min(0).max(1000),
    gradingRubric: z.object({
      masteryWeight: z.number().min(0).max(1),
      participationWeight: z.number().min(0).max(1),
      improvementWeight: z.number().min(0).max(1)
    }),
    canvasGradeUrl: z.string().url().optional()
  })
});

const SubmitResponseRequestSchema = z.object({
  response: z.string().min(1).max(5000),
  metadata: z.record(z.unknown()).optional()
});

const GetSessionsQuerySchema = z.object({
  studentId: z.string().optional(),
  courseId: z.string().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0)
});

/**
 * Assessment Handler
 *
 * Handles all HTTP requests for the AI assessment system with proper
 * validation, error handling, and security checks.
 */
export class AssessmentHandler {
  constructor(
    private readonly assessmentEngine: ConversationalAssessmentEngine,
    private readonly aiService: AssessmentAIService,
    private readonly sessionRepository: AssessmentSessionRepository,
    private readonly gradePassbackService: CanvasGradePassbackService,
    private readonly contentGenerator: AssessmentContentGenerator
  ) {}

  /**
   * Create new assessment session
   * POST /api/ai-assessment/sessions
   */
  async createSession(c: Context): Promise<Response> {
    try {
      const body = await c.req.json();
      const validated = CreateSessionRequestSchema.parse(body);

      // Validate user permissions
      const currentUserId = this.getCurrentUserId(c);
      if (currentUserId !== validated.studentId && !this.isInstructor(c)) {
        return c.json({
          success: false,
          error: 'Insufficient permissions to create session'
        }, 403);
      }

      // Create session configuration
      const sessionConfig: AssessmentSessionConfig = {
        configId: validated.configId as any, // Type assertion needed for branded types
        studentId: validated.studentId as UserId,
        courseId: validated.courseId as CourseId,
        assessmentTitle: validated.assessmentTitle,
        settings: validated.settings,
        context: validated.context,
        grading: validated.grading
      };

      // Initialize assessment session
      const session = await this.assessmentEngine.initializeSession(sessionConfig);

      return c.json({
        success: true,
        session,
        sessionId: session.id
      });

    } catch (error) {
      console.error('Create session error:', error);

      if (error instanceof z.ZodError) {
        return c.json({
          success: false,
          error: 'Invalid request data',
          details: error.errors
        }, 400);
      }

      if (error instanceof AIAssessmentError) {
        return c.json({
          success: false,
          error: error.message,
          code: error.code
        }, 400);
      }

      return c.json({
        success: false,
        error: 'Internal server error'
      }, 500);
    }
  }

  /**
   * Get assessment session
   * GET /api/ai-assessment/sessions/:sessionId
   */
  async getSession(c: Context): Promise<Response> {
    try {
      const sessionId = AssessmentSessionIdSchema.parse(c.req.param('sessionId'));

      // Get session
      const session = await this.assessmentEngine.getSession(sessionId);

      if (!session) {
        return c.json({
          success: false,
          error: 'Session not found'
        }, 404);
      }

      // Validate access permissions
      const currentUserId = this.getCurrentUserId(c);
      if (currentUserId !== session.config.studentId && !this.isInstructor(c)) {
        return c.json({
          success: false,
          error: 'Insufficient permissions to access session'
        }, 403);
      }

      return c.json({
        success: true,
        session
      });

    } catch (error) {
      console.error('Get session error:', error);

      if (error instanceof z.ZodError) {
        return c.json({
          success: false,
          error: 'Invalid session ID'
        }, 400);
      }

      return c.json({
        success: false,
        error: 'Internal server error'
      }, 500);
    }
  }

  /**
   * Submit student response
   * POST /api/ai-assessment/sessions/:sessionId/respond
   */
  async submitResponse(c: Context): Promise<Response> {
    try {
      const sessionId = AssessmentSessionIdSchema.parse(c.req.param('sessionId'));
      const body = await c.req.json();
      const validated = SubmitResponseRequestSchema.parse(body);

      // Get current session to validate permissions
      const currentSession = await this.assessmentEngine.getSession(sessionId);
      if (!currentSession) {
        return c.json({
          success: false,
          error: 'Session not found'
        }, 404);
      }

      // Validate student permissions
      const currentUserId = this.getCurrentUserId(c);
      if (currentUserId !== currentSession.config.studentId) {
        return c.json({
          success: false,
          error: 'Insufficient permissions to submit response'
        }, 403);
      }

      // Process student response
      const updatedSession = await this.assessmentEngine.processStudentResponse(
        sessionId,
        validated.response,
        validated.metadata
      );

      return c.json({
        success: true,
        session: updatedSession
      });

    } catch (error) {
      console.error('Submit response error:', error);

      if (error instanceof z.ZodError) {
        return c.json({
          success: false,
          error: 'Invalid request data',
          details: error.errors
        }, 400);
      }

      if (error instanceof SessionValidationError) {
        return c.json({
          success: false,
          error: error.message,
          code: error.code
        }, 400);
      }

      if (error instanceof AIAssessmentError) {
        return c.json({
          success: false,
          error: error.message,
          code: error.code
        }, 500);
      }

      return c.json({
        success: false,
        error: 'Internal server error'
      }, 500);
    }
  }

  /**
   * Retry AI response
   * POST /api/ai-assessment/sessions/:sessionId/retry
   */
  async retryResponse(c: Context): Promise<Response> {
    try {
      const sessionId = AssessmentSessionIdSchema.parse(c.req.param('sessionId'));

      // Get current session
      const session = await this.assessmentEngine.getSession(sessionId);
      if (!session) {
        return c.json({
          success: false,
          error: 'Session not found'
        }, 404);
      }

      // Validate permissions
      const currentUserId = this.getCurrentUserId(c);
      if (currentUserId !== session.config.studentId) {
        return c.json({
          success: false,
          error: 'Insufficient permissions to retry response'
        }, 403);
      }

      // Get last student message
      const studentMessages = session.conversation.filter(m => m.type === 'student');
      if (studentMessages.length === 0) {
        return c.json({
          success: false,
          error: 'No student response to retry'
        }, 400);
      }

      const lastStudentMessage = studentMessages[studentMessages.length - 1];

      // Reprocess the last response
      const updatedSession = await this.assessmentEngine.processStudentResponse(
        sessionId,
        lastStudentMessage.content,
        { retry: true }
      );

      return c.json({
        success: true,
        session: updatedSession
      });

    } catch (error) {
      console.error('Retry response error:', error);

      return c.json({
        success: false,
        error: 'Internal server error'
      }, 500);
    }
  }

  /**
   * Calculate and submit final grade
   * POST /api/ai-assessment/sessions/:sessionId/grade
   */
  async calculateGrade(c: Context): Promise<Response> {
    try {
      const sessionId = AssessmentSessionIdSchema.parse(c.req.param('sessionId'));

      // Get session
      const session = await this.assessmentEngine.getSession(sessionId);
      if (!session) {
        return c.json({
          success: false,
          error: 'Session not found'
        }, 404);
      }

      // Validate permissions (student or instructor)
      const currentUserId = this.getCurrentUserId(c);
      if (currentUserId !== session.config.studentId && !this.isInstructor(c)) {
        return c.json({
          success: false,
          error: 'Insufficient permissions to calculate grade'
        }, 403);
      }

      // Calculate final grade
      const gradeCalculation = await this.assessmentEngine.calculateFinalGrade(sessionId);

      // Submit to Canvas if enabled
      let gradePassbackResult;
      if (session.config.grading.passbackEnabled && session.config.grading.canvasGradeUrl) {
        try {
          const agsConfig = {
            lineItemsUrl: session.config.grading.canvasGradeUrl,
            accessToken: this.getCanvasAccessToken(c),
            clientId: this.getLTIClientId(c),
            deploymentId: this.getLTIDeploymentId(c),
            maxRetries: 3,
            timeoutMs: 30000,
            rateLimitDelay: 1000
          };

          gradePassbackResult = await this.gradePassbackService.submitGrade(
            gradeCalculation,
            agsConfig
          );
        } catch (gradeError) {
          console.warn('Grade passback failed:', gradeError);
          // Continue without failing the entire request
        }
      }

      return c.json({
        success: true,
        gradeCalculation,
        gradePassback: gradePassbackResult
      });

    } catch (error) {
      console.error('Calculate grade error:', error);

      if (error instanceof AIAssessmentError) {
        return c.json({
          success: false,
          error: error.message,
          code: error.code
        }, 400);
      }

      return c.json({
        success: false,
        error: 'Internal server error'
      }, 500);
    }
  }

  /**
   * List assessment sessions
   * GET /api/ai-assessment/sessions
   */
  async listSessions(c: Context): Promise<Response> {
    try {
      const query = GetSessionsQuerySchema.parse(c.req.query());

      // Build filters based on permissions
      const currentUserId = this.getCurrentUserId(c);
      const isInstructor = this.isInstructor(c);

      const filters: any = {
        limit: query.limit,
        offset: query.offset
      };

      // Apply permission-based filtering
      if (!isInstructor) {
        // Students can only see their own sessions
        filters.studentId = currentUserId as UserId;
      } else if (query.studentId) {
        // Instructors can filter by specific student
        filters.studentId = UserIdSchema.parse(query.studentId);
      }

      if (query.courseId) {
        filters.courseId = CourseIdSchema.parse(query.courseId);
      }

      if (query.status) {
        filters.status = query.status as any;
      }

      // Query sessions
      const sessions = await this.sessionRepository.querySessions(filters);

      return c.json({
        success: true,
        sessions,
        total: sessions.length,
        filters
      });

    } catch (error) {
      console.error('List sessions error:', error);

      if (error instanceof z.ZodError) {
        return c.json({
          success: false,
          error: 'Invalid query parameters',
          details: error.errors
        }, 400);
      }

      return c.json({
        success: false,
        error: 'Internal server error'
      }, 500);
    }
  }

  /**
   * Generate assessment content
   * POST /api/ai-assessment/generate-content
   */
  async generateContent(c: Context): Promise<Response> {
    try {
      // Only instructors can generate content
      if (!this.isInstructor(c)) {
        return c.json({
          success: false,
          error: 'Insufficient permissions to generate content'
        }, 403);
      }

      const body = await c.req.json();
      const { configId, contentReference, questionCount = 5 } = body;

      // This would integrate with the assessment configuration from Story 7.2
      const mockConfig = {
        id: configId,
        settings: { difficulty: 'intermediate', assessmentType: 'comprehension' },
        placements: [{ id: 'default', assessmentType: 'comprehension' }]
      };

      const result = await this.contentGenerator.generateQuestions(
        mockConfig as any,
        contentReference,
        questionCount
      );

      return c.json({
        success: true,
        questions: result.questions,
        metadata: result.metadata,
        qualityMetrics: result.qualityMetrics
      });

    } catch (error) {
      console.error('Generate content error:', error);

      return c.json({
        success: false,
        error: 'Content generation failed'
      }, 500);
    }
  }

  /**
   * Get assessment analytics
   * GET /api/ai-assessment/analytics
   */
  async getAnalytics(c: Context): Promise<Response> {
    try {
      // Only instructors can access analytics
      if (!this.isInstructor(c)) {
        return c.json({
          success: false,
          error: 'Insufficient permissions to access analytics'
        }, 403);
      }

      const query = c.req.query();
      const filters: any = {};

      if (query.courseId) {
        filters.courseId = CourseIdSchema.parse(query.courseId);
      }

      if (query.studentId) {
        filters.studentId = UserIdSchema.parse(query.studentId);
      }

      if (query.startDate && query.endDate) {
        filters.dateRange = {
          start: new Date(query.startDate),
          end: new Date(query.endDate)
        };
      }

      const analytics = await this.sessionRepository.getAnalytics(filters);

      return c.json({
        success: true,
        analytics
      });

    } catch (error) {
      console.error('Get analytics error:', error);

      return c.json({
        success: false,
        error: 'Internal server error'
      }, 500);
    }
  }

  /**
   * Health check endpoint
   * GET /api/ai-assessment/health
   */
  async healthCheck(c: Context): Promise<Response> {
    return c.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  }

  /**
   * Get current user ID from context (LTI integration)
   */
  private getCurrentUserId(c: Context): string {
    // This would be populated by LTI middleware
    return c.get('userId') || c.get('lti_user_id') || 'anonymous';
  }

  /**
   * Check if current user is an instructor
   */
  private isInstructor(c: Context): boolean {
    const roles = c.get('roles') || c.get('lti_roles') || [];
    return roles.includes('Instructor') || roles.includes('Teacher');
  }

  /**
   * Get Canvas access token for API calls
   */
  private getCanvasAccessToken(c: Context): string {
    return c.get('canvas_access_token') || '';
  }

  /**
   * Get LTI client ID
   */
  private getLTIClientId(c: Context): string {
    return c.get('lti_client_id') || '';
  }

  /**
   * Get LTI deployment ID
   */
  private getLTIDeploymentId(c: Context): string {
    return c.get('lti_deployment_id') || '';
  }
}