/**
 * @fileoverview Cross-Course Intelligence Zod validation schemas
 * Provides comprehensive validation for all cross-course intelligence data structures
 */

import { z } from 'zod';

// ============================================================================
// Base validation schemas
// ============================================================================

const NonEmptyString = z.string().min(1, 'Cannot be empty');
const PercentageScore = z.number().min(0).max(1, 'Must be between 0 and 1');
const CorrelationScore = z.number().min(-1).max(1, 'Must be between -1 and 1');
const PositiveInteger = z.number().int().positive();
const NonNegativeInteger = z.number().int().min(0);

// ============================================================================
// Core entity schemas
// ============================================================================

export const KnowledgeDependencySchema = z.object({
  id: NonEmptyString,
  prerequisiteCourse: NonEmptyString,
  prerequisiteConcept: NonEmptyString,
  dependentCourse: NonEmptyString,
  dependentConcept: NonEmptyString,
  dependencyStrength: PercentageScore,
  validationScore: PercentageScore,
  correlationCoefficient: CorrelationScore.optional(),
  sampleSize: NonNegativeInteger.optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const KnowledgeGapSchema = z.object({
  id: NonEmptyString,
  prerequisiteCourse: NonEmptyString,
  concept: NonEmptyString,
  gapSeverity: PercentageScore,
  impactedCourses: z.array(NonEmptyString),
  remediationPriority: z.enum(['low', 'medium', 'high', 'critical']),
  estimatedReviewTime: PositiveInteger.optional(),
  prerequisiteTopics: z.array(NonEmptyString).optional()
});

export const RiskFactorSchema = z.object({
  id: NonEmptyString,
  category: z.enum(['prerequisite_gap', 'performance_trend', 'correlation_issue', 'learning_velocity']),
  description: NonEmptyString,
  impact: PercentageScore,
  confidence: PercentageScore,
  courses: z.array(NonEmptyString),
  timeframe: z.enum(['immediate', 'short_term', 'medium_term', 'long_term'])
});

export const CrossCoursePerformanceCorrelationSchema = z.object({
  id: NonEmptyString,
  studentId: NonEmptyString,
  courseSequence: z.array(NonEmptyString).min(2, 'Must have at least 2 courses'),
  correlationMatrix: z.array(z.array(CorrelationScore)),
  knowledgeGaps: z.array(KnowledgeGapSchema),
  academicRiskScore: PercentageScore,
  riskFactors: z.array(RiskFactorSchema),
  generatedAt: z.date(),
  expiresAt: z.date().optional()
}).refine(data => {
  // Validate correlation matrix dimensions
  const n = data.courseSequence.length;
  return data.correlationMatrix.length === n && 
         data.correlationMatrix.every(row => row.length === n);
}, {
  message: "Correlation matrix dimensions must match course sequence length"
});

// Base schema without refinements for .omit() operations
const CrossCourseConsentBaseSchema = z.object({
  id: NonEmptyString,
  studentId: NonEmptyString,
  sourceCourse: NonEmptyString,
  targetCourse: NonEmptyString,
  consentType: z.enum(['performance_data', 'behavioral_patterns', 'learning_analytics', 'all']),
  consentGranted: z.boolean(),
  consentDate: z.date(),
  expirationDate: z.date().optional(),
  withdrawnAt: z.date().optional()
});

// Refined schema with validations
export const CrossCourseConsentSchema = CrossCourseConsentBaseSchema.refine(data => {
  // If withdrawn, withdrawnAt should be provided
  return !data.withdrawnAt || !data.consentGranted;
}, {
  message: "Withdrawn consent cannot be granted"
}).refine(data => {
  // Expiration date should be in the future if provided
  return !data.expirationDate || data.expirationDate > data.consentDate;
}, {
  message: "Expiration date must be after consent date"
});

// ============================================================================
// Alert and intervention schemas
// ============================================================================

export const ResourceLinkSchema = z.object({
  id: NonEmptyString,
  title: NonEmptyString,
  url: z.string().url('Must be a valid URL'),
  type: z.enum(['video', 'article', 'practice', 'interactive']),
  estimatedTime: PositiveInteger
});

export const InterventionRecommendationSchema = z.object({
  id: NonEmptyString,
  type: z.enum(['review_session', 'practice_assignment', 'tutor_referral', 'prerequisite_refresh']),
  description: NonEmptyString,
  estimatedEffectiveness: PercentageScore,
  timeCommitment: PositiveInteger,
  difficulty: z.enum(['easy', 'moderate', 'challenging']),
  resources: z.array(ResourceLinkSchema).optional(),
  priority: z.number().int().min(1).max(5)
});

export const ImpactPredictionSchema = z.object({
  timeline: PositiveInteger,
  severity: PercentageScore,
  affectedAssignments: z.array(NonEmptyString).optional(),
  performanceDropPrediction: PercentageScore,
  confidence: PercentageScore
});

// Base schema without refinements for .omit() operations
const CrossCourseGapAlertBaseSchema = z.object({
  id: NonEmptyString,
  studentId: NonEmptyString,
  studentName: NonEmptyString,
  studentEmail: z.string().email('Must be a valid email'),
  instructorId: NonEmptyString,
  courseId: NonEmptyString,
  prerequisiteCourse: NonEmptyString,
  gapArea: NonEmptyString,
  gapConcept: NonEmptyString,
  riskScore: PercentageScore,
  impactPrediction: ImpactPredictionSchema,
  recommendations: z.array(InterventionRecommendationSchema).min(1, 'Must have at least one recommendation'),
  status: z.enum(['new', 'acknowledged', 'in-progress', 'resolved', 'dismissed']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  predictedImpactDate: z.date().optional(),
  acknowledgedAt: z.date().optional(),
  acknowledgedBy: NonEmptyString.optional(),
  resolvedAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});

// Refined schema with validations
export const CrossCourseGapAlertSchema = CrossCourseGapAlertBaseSchema.refine(data => {
  // If acknowledged, acknowledgedAt and acknowledgedBy should be provided
  return data.status !== 'acknowledged' || (data.acknowledgedAt && data.acknowledgedBy);
}, {
  message: "Acknowledged alerts must have acknowledgedAt and acknowledgedBy"
}).refine(data => {
  // If resolved, resolvedAt should be provided
  return data.status !== 'resolved' || data.resolvedAt;
}, {
  message: "Resolved alerts must have resolvedAt"
});

export const KnowledgeTransferOpportunitySchema = z.object({
  id: NonEmptyString,
  studentId: NonEmptyString,
  sourceCourse: NonEmptyString,
  targetCourse: NonEmptyString,
  sourceConcept: NonEmptyString,
  targetConcept: NonEmptyString,
  transferType: z.enum(['positive', 'negative', 'neutral']),
  opportunityStrength: PercentageScore,
  recommendation: NonEmptyString,
  status: z.enum(['identified', 'suggested', 'acted_upon', 'dismissed']),
  createdAt: z.date(),
  updatedAt: z.date()
});

// ============================================================================
// Dashboard and UI schemas
// ============================================================================

export const CourseStatusSchema = z.object({
  id: NonEmptyString,
  name: NonEmptyString,
  code: NonEmptyString,
  performance: PercentageScore,
  status: z.enum(['strong', 'at-risk', 'struggling']),
  enrollmentStatus: z.enum(['active', 'completed', 'dropped']),
  prerequisites: z.array(NonEmptyString),
  dependents: z.array(NonEmptyString)
});

export const ActionItemSchema = z.object({
  id: NonEmptyString,
  type: z.enum(['knowledge-gap', 'review-needed', 'strength-opportunity']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  title: NonEmptyString,
  description: NonEmptyString,
  course: NonEmptyString,
  estimatedTime: PositiveInteger,
  dueDate: z.date().optional(),
  completed: z.boolean()
});

export const PerformanceCorrelationSchema = z.object({
  course1: NonEmptyString,
  course2: NonEmptyString,
  correlation: CorrelationScore,
  confidence: PercentageScore,
  sampleSize: PositiveInteger,
  trendDirection: z.enum(['positive', 'negative', 'neutral'])
});

// ============================================================================
// API request/response schemas
// ============================================================================

export const CrossCourseAnalyticsRequestSchema = z.object({
  studentId: NonEmptyString,
  includeHistorical: z.boolean().default(false),
  courseFilters: z.array(NonEmptyString).optional(),
  analysisDepth: z.enum(['basic', 'detailed', 'comprehensive']).default('detailed')
});

export const CrossCourseAnalyticsResponseSchema = z.object({
  studentId: NonEmptyString,
  academicRiskScore: PercentageScore,
  activeCourses: z.array(CourseStatusSchema),
  knowledgeDependencies: z.array(KnowledgeDependencySchema),
  performanceCorrelations: z.array(PerformanceCorrelationSchema),
  knowledgeGaps: z.array(KnowledgeGapSchema),
  actionItems: z.array(ActionItemSchema),
  transferOpportunities: z.array(KnowledgeTransferOpportunitySchema),
  lastUpdated: z.date(),
  dataFreshness: NonNegativeInteger
});

export const ConsentUpdateRequestSchema = z.object({
  studentId: NonEmptyString,
  sourceCourse: NonEmptyString,
  targetCourse: NonEmptyString,
  consentType: z.enum(['performance_data', 'behavioral_patterns', 'learning_analytics', 'all']),
  consentGranted: z.boolean(),
  expirationDate: z.date().optional()
}).refine(data => {
  // If granting consent with expiration, expiration must be in future
  return !data.consentGranted || !data.expirationDate || data.expirationDate > new Date();
}, {
  message: "Expiration date must be in the future when granting consent"
});

export const GapAnalysisRequestSchema = z.object({
  studentId: NonEmptyString,
  targetCourses: z.array(NonEmptyString).min(1, 'Must specify at least one target course'),
  analysisWindow: PositiveInteger.default(30),
  includePreventive: z.boolean().default(true)
});

export const InstructorAlertQuerySchema = z.object({
  instructorId: NonEmptyString,
  courseId: NonEmptyString.optional(),
  status: z.enum(['new', 'acknowledged', 'in-progress', 'resolved', 'dismissed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: NonNegativeInteger.default(0),
  sortBy: z.enum(['risk-score', 'gap-severity', 'student-name', 'course', 'date-created']).default('risk-score'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// ============================================================================
// Chat integration schemas
// ============================================================================

export const CrossCourseContextSchema = z.object({
  courseName: NonEmptyString,
  courseCode: NonEmptyString,
  relevanceScore: PercentageScore,
  description: NonEmptyString,
  connectionType: z.enum(['prerequisite', 'dependent', 'parallel', 'transfer'])
});

export const PrerequisiteConceptSchema = z.object({
  concept: NonEmptyString,
  course: NonEmptyString,
  explanation: NonEmptyString,
  reviewResources: z.array(ResourceLinkSchema),
  masteryLevel: PercentageScore
});

export const EnhancedChatMessageSchema = z.object({
  content: NonEmptyString,
  timestamp: z.date(),
  isFromUser: z.boolean(),
  relatedCourses: z.array(NonEmptyString).optional(),
  prerequisiteLinks: z.array(PrerequisiteConceptSchema).optional(),
  knowledgeTransferOpportunities: z.array(KnowledgeTransferOpportunitySchema).optional(),
  crossCourseContext: z.array(CrossCourseContextSchema).optional(),
  gapIdentification: KnowledgeGapSchema.optional()
});

// ============================================================================
// Configuration and utility schemas
// ============================================================================

export const CrossCourseConfigSchema = z.object({
  enableProactiveAlerts: z.boolean(),
  gapDetectionSensitivity: PercentageScore,
  correlationThreshold: PercentageScore,
  riskThreshold: PercentageScore,
  dataRetentionDays: PositiveInteger,
  anonymizationLevel: z.enum(['none', 'partial', 'full'])
});

export const TimeSeriesDataPointSchema = z.object({
  timestamp: z.date(),
  value: z.number(),
  courseId: NonEmptyString,
  metricType: z.enum(['performance', 'engagement', 'risk_score'])
});

export const CorrelationAnalysisSchema = z.object({
  correlation: CorrelationScore,
  pValue: z.number().min(0).max(1),
  confidence: PercentageScore,
  sampleSize: PositiveInteger,
  significanceLevel: z.enum(['high', 'medium', 'low', 'none'])
});

// ============================================================================
// Database input/output schemas
// ============================================================================

export const CreateKnowledgeDependencySchema = KnowledgeDependencySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const UpdateKnowledgeDependencySchema = CreateKnowledgeDependencySchema.partial();

export const CreateCrossCourseConsentSchema = CrossCourseConsentBaseSchema.omit({
  id: true,
  consentDate: true,
  withdrawnAt: true
});

export const CreateGapAlertSchema = CrossCourseGapAlertBaseSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  acknowledgedAt: true,
  acknowledgedBy: true,
  resolvedAt: true
});

// ============================================================================
// Branded type creation helpers
// ============================================================================

export const StudentIdSchema = z.string().uuid().brand<'StudentId'>();
export const CourseIdSchema = z.string().min(1).brand<'CourseId'>();

// ============================================================================
// Type inference helpers
// ============================================================================

export type KnowledgeDependency = z.infer<typeof KnowledgeDependencySchema>;
export type KnowledgeGap = z.infer<typeof KnowledgeGapSchema>;
export type RiskFactor = z.infer<typeof RiskFactorSchema>;
export type CrossCoursePerformanceCorrelation = z.infer<typeof CrossCoursePerformanceCorrelationSchema>;
export type CrossCourseConsent = z.infer<typeof CrossCourseConsentSchema>;
export type CrossCourseGapAlert = z.infer<typeof CrossCourseGapAlertSchema>;
export type KnowledgeTransferOpportunity = z.infer<typeof KnowledgeTransferOpportunitySchema>;
export type CourseStatus = z.infer<typeof CourseStatusSchema>;
export type ActionItem = z.infer<typeof ActionItemSchema>;
export type PerformanceCorrelation = z.infer<typeof PerformanceCorrelationSchema>;
export type CrossCourseAnalyticsRequest = z.infer<typeof CrossCourseAnalyticsRequestSchema>;
export type CrossCourseAnalyticsResponse = z.infer<typeof CrossCourseAnalyticsResponseSchema>;
export type ConsentUpdateRequest = z.infer<typeof ConsentUpdateRequestSchema>;
export type GapAnalysisRequest = z.infer<typeof GapAnalysisRequestSchema>;
export type InstructorAlertQuery = z.infer<typeof InstructorAlertQuerySchema>;
export type CrossCourseContext = z.infer<typeof CrossCourseContextSchema>;
export type PrerequisiteConcept = z.infer<typeof PrerequisiteConceptSchema>;
export type EnhancedChatMessage = z.infer<typeof EnhancedChatMessageSchema>;
export type CrossCourseConfig = z.infer<typeof CrossCourseConfigSchema>;
export type TimeSeriesDataPoint = z.infer<typeof TimeSeriesDataPointSchema>;
export type CorrelationAnalysis = z.infer<typeof CorrelationAnalysisSchema>;
export type ResourceLink = z.infer<typeof ResourceLinkSchema>;
export type InterventionRecommendation = z.infer<typeof InterventionRecommendationSchema>;
export type ImpactPrediction = z.infer<typeof ImpactPredictionSchema>;

// Create schemas
export type CreateKnowledgeDependency = z.infer<typeof CreateKnowledgeDependencySchema>;
export type UpdateKnowledgeDependency = z.infer<typeof UpdateKnowledgeDependencySchema>;
export type CreateCrossCourseConsent = z.infer<typeof CreateCrossCourseConsentSchema>;
export type CreateGapAlert = z.infer<typeof CreateGapAlertSchema>;

// Branded types
export type StudentId = z.infer<typeof StudentIdSchema>;
export type CourseId = z.infer<typeof CourseIdSchema>;

// ============================================================================
// Validation result type
// ============================================================================

export type ValidationResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: z.ZodError;
};

/**
 * Safely validate data against a schema
 */
export function validateSafely<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}

/**
 * Create validation middleware for API endpoints
 */
export function createValidator<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): T => {
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new Error(`Validation failed: ${result.error.message}`);
    }
    return result.data;
  };
}