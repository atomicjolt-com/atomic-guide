/**
 * @fileoverview AI Assessment System Types
 * @module features/ai-assessment/shared/types
 *
 * Defines TypeScript interfaces and types for conversational AI assessments,
 * grade passback integration, session management, and student interactions.
 *
 * Security Requirements:
 * - All student responses encrypted in transit and at rest
 * - Assessment session validation and timeout management
 * - Academic integrity monitoring and validation
 * - Canvas LTI grade passback security compliance
 */

import { z } from 'zod';

/**
 * Branded type for Assessment Session ID
 */
export const AssessmentSessionIdSchema = z.string().uuid().brand<'AssessmentSessionId'>();
export type AssessmentSessionId = z.infer<typeof AssessmentSessionIdSchema>;

/**
 * Branded type for Assessment Configuration ID
 */
export const AssessmentConfigIdSchema = z.string().uuid().brand<'AssessmentConfigId'>();
export type AssessmentConfigId = z.infer<typeof AssessmentConfigIdSchema>;

/**
 * Branded type for User ID
 */
export const UserIdSchema = z.string().brand<'UserId'>();
export type UserId = z.infer<typeof UserIdSchema>;

/**
 * Branded type for Course ID
 */
export const CourseIdSchema = z.string().brand<'CourseId'>();
export type CourseId = z.infer<typeof CourseIdSchema>;

/**
 * Assessment session status enumeration
 */
export const AssessmentSessionStatusSchema = z.enum([
  'created',        // Session created but not started
  'active',         // Student actively engaged in assessment
  'awaiting_response', // Waiting for student input
  'processing',     // AI processing student response
  'mastery_achieved', // Student achieved mastery
  'max_attempts',   // Maximum attempts reached
  'timeout',        // Session timed out
  'completed',      // Assessment completed successfully
  'cancelled',      // Session cancelled by student/instructor
  'error'          // Technical error occurred
]);

export type AssessmentSessionStatus = z.infer<typeof AssessmentSessionStatusSchema>;

/**
 * AI conversation message types
 */
export const MessageTypeSchema = z.enum([
  'system',         // System/AI messages
  'student',        // Student responses
  'feedback',       // AI feedback on responses
  'question',       // Assessment questions
  'hint',          // Hints provided to student
  'encouragement', // Encouraging messages
  'mastery_check', // Mastery verification questions
  'summary'        // Assessment summary
]);

export type MessageType = z.infer<typeof MessageTypeSchema>;

/**
 * Conversation message schema
 */
export const AssessmentMessageSchema = z.object({
  id: z.string().uuid(),
  sessionId: AssessmentSessionIdSchema,
  type: MessageTypeSchema,
  content: z.string().max(5000),
  timestamp: z.date(),
  metadata: z.object({
    aiConfidence: z.number().min(0).max(1).optional(),
    understandingLevel: z.enum(['low', 'medium', 'high']).optional(),
    questionDifficulty: z.number().min(1).max(5).optional(),
    conceptsAddressed: z.array(z.string()).optional(),
    misconceptionDetected: z.boolean().optional(),
    masteryIndicators: z.array(z.string()).optional(),
    responseTimeMs: z.number().min(0).optional(),
    analysisResults: z.record(z.unknown()).optional()
  }).optional(),
  // Security and integrity
  contentHash: z.string(),
  encrypted: z.boolean().default(false),
  integrity: z.object({
    originalContent: z.string().optional(), // For academic integrity
    similarityScore: z.number().min(0).max(1).optional(),
    authenticity: z.enum(['verified', 'suspicious', 'flagged']).optional()
  }).optional()
});

export type AssessmentMessage = z.infer<typeof AssessmentMessageSchema>;

/**
 * Assessment session configuration
 */
export const AssessmentSessionConfigSchema = z.object({
  configId: AssessmentConfigIdSchema,
  studentId: UserIdSchema,
  courseId: CourseIdSchema,
  assessmentTitle: z.string().max(200),
  settings: z.object({
    masteryThreshold: z.number().min(0.5).max(1.0),
    maxAttempts: z.number().min(1).max(10),
    timeLimit: z.number().min(0).optional(), // minutes, 0 = unlimited
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

export type AssessmentSessionConfig = z.infer<typeof AssessmentSessionConfigSchema>;

/**
 * Assessment session state
 */
export const AssessmentSessionSchema = z.object({
  id: AssessmentSessionIdSchema,
  config: AssessmentSessionConfigSchema,
  status: AssessmentSessionStatusSchema,
  progress: z.object({
    currentStep: z.number().min(0),
    totalSteps: z.number().min(1),
    masteryAchieved: z.boolean(),
    attemptNumber: z.number().min(1),
    conceptsMastered: z.array(z.string()),
    conceptsNeedWork: z.array(z.string()),
    overallScore: z.number().min(0).max(1).optional()
  }),
  timing: z.object({
    startedAt: z.date(),
    lastActivity: z.date(),
    estimatedCompletion: z.date().optional(),
    timeSpentMs: z.number().min(0),
    timeoutAt: z.date().optional()
  }),
  conversation: z.array(AssessmentMessageSchema),
  analytics: z.object({
    engagementScore: z.number().min(0).max(1),
    strugglingIndicators: z.array(z.string()),
    learningPatterns: z.record(z.unknown()),
    interventionsTrigger: z.array(z.string()).optional()
  }),
  // Security and compliance
  security: z.object({
    sessionToken: z.string(),
    lastValidation: z.date(),
    integrityChecks: z.array(z.object({
      timestamp: z.date(),
      type: z.string(),
      result: z.enum(['pass', 'warning', 'fail']),
      details: z.string().optional()
    }))
  })
});

export type AssessmentSession = z.infer<typeof AssessmentSessionSchema>;

/**
 * AI response analysis result
 */
export const ResponseAnalysisSchema = z.object({
  understanding: z.object({
    level: z.enum(['none', 'partial', 'good', 'excellent']),
    confidence: z.number().min(0).max(1),
    conceptsUnderstood: z.array(z.string()),
    misconceptions: z.array(z.object({
      concept: z.string(),
      misconception: z.string(),
      severity: z.enum(['minor', 'moderate', 'major'])
    }))
  }),
  mastery: z.object({
    achieved: z.boolean(),
    progress: z.number().min(0).max(1),
    nextSteps: z.array(z.string()),
    readyForAdvancement: z.boolean()
  }),
  engagement: z.object({
    level: z.enum(['low', 'medium', 'high']),
    indicators: z.array(z.string()),
    strugglingSignals: z.array(z.string()).optional()
  }),
  feedback: z.object({
    encouragement: z.string().optional(),
    corrections: z.array(z.string()).optional(),
    hints: z.array(z.string()).optional(),
    resources: z.array(z.string()).optional()
  }),
  nextQuestion: z.object({
    type: z.enum(['reinforcement', 'advancement', 'remediation', 'mastery_check']),
    difficulty: z.number().min(1).max(5),
    concepts: z.array(z.string()),
    suggestedQuestion: z.string().optional()
  }),
  academicIntegrity: z.object({
    authenticity: z.enum(['verified', 'suspicious', 'flagged']),
    similarityFlags: z.array(z.string()).optional(),
    aiDetectionScore: z.number().min(0).max(1).optional(),
    temporalAnalysis: z.object({
      responseTime: z.number(),
      typingPattern: z.string().optional(),
      consistencyScore: z.number().min(0).max(1)
    }).optional()
  })
});

export type ResponseAnalysis = z.infer<typeof ResponseAnalysisSchema>;

/**
 * Grade calculation result
 */
export const GradeCalculationSchema = z.object({
  sessionId: AssessmentSessionIdSchema,
  numericScore: z.number().min(0).max(100),
  letterGrade: z.string().optional(),
  components: z.object({
    masteryScore: z.number().min(0).max(100),
    participationScore: z.number().min(0).max(100),
    improvementScore: z.number().min(0).max(100),
    bonusPoints: z.number().min(0).max(20).optional()
  }),
  feedback: z.object({
    strengths: z.array(z.string()),
    areasForImprovement: z.array(z.string()),
    recommendations: z.array(z.string()),
    masteryReport: z.string()
  }),
  passback: z.object({
    eligible: z.boolean(),
    canvasGradeId: z.string().optional(),
    submittedAt: z.date().optional(),
    status: z.enum(['pending', 'submitted', 'error']).optional(),
    errorMessage: z.string().optional()
  })
});

export type GradeCalculation = z.infer<typeof GradeCalculationSchema>;

/**
 * Canvas LTI grade passback payload
 */
export const GradePassbackSchema = z.object({
  sessionId: AssessmentSessionIdSchema,
  studentId: UserIdSchema,
  courseId: CourseIdSchema,
  assignmentId: z.string(),
  score: z.number().min(0).max(100),
  maxScore: z.number().min(0).max(1000),
  feedback: z.string().max(5000).optional(),
  submittedAt: z.date(),
  gradeUrl: z.string().url(),
  activityProgress: z.enum(['Initialized', 'Started', 'InProgress', 'Submitted', 'Completed']),
  gradingProgress: z.enum(['NotReady', 'Failed', 'Pending', 'PendingManual', 'FullyGraded'])
});

export type GradePassback = z.infer<typeof GradePassbackSchema>;

/**
 * Assessment analytics data
 */
export const AssessmentAnalyticsSchema = z.object({
  sessionId: AssessmentSessionIdSchema,
  metrics: z.object({
    completionRate: z.number().min(0).max(1),
    averageResponseTime: z.number().min(0),
    masteryAchievementRate: z.number().min(0).max(1),
    strugglingStudentCount: z.number().min(0),
    commonMisconceptions: z.array(z.object({
      concept: z.string(),
      frequency: z.number().min(0),
      students: z.array(UserIdSchema)
    })),
    learningProgression: z.array(z.object({
      concept: z.string(),
      averageMastery: z.number().min(0).max(1),
      timeToMastery: z.number().min(0) // minutes
    }))
  }),
  performance: z.object({
    averageScore: z.number().min(0).max(100),
    scoreDistribution: z.array(z.object({
      range: z.string(),
      count: z.number().min(0)
    })),
    improvementTracking: z.array(z.object({
      studentId: UserIdSchema,
      initialScore: z.number().min(0).max(100),
      finalScore: z.number().min(0).max(100),
      improvement: z.number()
    }))
  }),
  engagement: z.object({
    averageSessionDuration: z.number().min(0),
    abandonmentRate: z.number().min(0).max(1),
    helpSeekingFrequency: z.number().min(0),
    retryPatterns: z.record(z.number())
  })
});

export type AssessmentAnalytics = z.infer<typeof AssessmentAnalyticsSchema>;

/**
 * Error types for AI assessment system
 */
export class AIAssessmentError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AIAssessmentError';
  }
}

export class SessionValidationError extends AIAssessmentError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'SESSION_VALIDATION_FAILED', context);
    this.name = 'SessionValidationError';
  }
}

export class AIProcessingError extends AIAssessmentError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'AI_PROCESSING_FAILED', context);
    this.name = 'AIProcessingError';
  }
}

export class GradePassbackError extends AIAssessmentError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'GRADE_PASSBACK_FAILED', context);
    this.name = 'GradePassbackError';
  }
}

export class AcademicIntegrityError extends AIAssessmentError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'ACADEMIC_INTEGRITY_VIOLATION', context);
    this.name = 'AcademicIntegrityError';
  }
}

/**
 * Assessment configuration validation result
 */
export interface AssessmentValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  configurationScore: number; // 0-1 for quality assessment
}

/**
 * AI service configuration
 */
export interface AIServiceConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
  retryAttempts: number;
  contextWindowSize: number;
}

/**
 * Canvas integration configuration
 */
export interface CanvasIntegrationConfig {
  baseUrl: string;
  accessToken: string;
  apiVersion: string;
  gradePassbackEnabled: boolean;
  maxRetries: number;
  timeoutMs: number;
}

/**
 * Performance monitoring metrics
 */
export interface AssessmentPerformanceMetrics {
  aiResponseLatency: number[];
  sessionProcessingLatency: number[];
  gradePassbackLatency: number[];
  errorCounts: Record<string, number>;
  activeSessionCount: number;
  memoryUsage: number;
  databaseLatency: number[];
}