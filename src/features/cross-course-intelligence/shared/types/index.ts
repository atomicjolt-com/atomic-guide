/**
 * @fileoverview Cross-Course Intelligence shared types and interfaces
 * Defines core data structures for knowledge dependency mapping and performance correlation
 */

// ============================================================================
// Core Cross-Course Intelligence Types
// ============================================================================

/**
 * Represents a knowledge dependency relationship between courses
 */
export interface KnowledgeDependency {
  id: string;
  prerequisiteCourse: string;
  prerequisiteConcept: string;
  dependentCourse: string;
  dependentConcept: string;
  dependencyStrength: number; // 0-1 correlation strength
  validationScore: number; // ML model confidence in relationship
  correlationCoefficient?: number; // Statistical correlation (-1 to 1)
  sampleSize?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Cross-course performance correlation data for a student
 */
export interface CrossCoursePerformanceCorrelation {
  id: string;
  studentId: string;
  courseSequence: string[]; // Array of course IDs in sequence
  correlationMatrix: number[][]; // Performance correlation between courses
  knowledgeGaps: KnowledgeGap[];
  academicRiskScore: number; // 0-1 overall academic risk
  riskFactors: RiskFactor[];
  generatedAt: Date;
  expiresAt?: Date;
}

/**
 * Identified knowledge gap requiring attention
 */
export interface KnowledgeGap {
  id: string;
  prerequisiteCourse: string;
  concept: string;
  gapSeverity: number; // 0-1 severity score
  impactedCourses: string[];
  remediationPriority: 'low' | 'medium' | 'high' | 'critical';
  estimatedReviewTime?: number; // Minutes needed for remediation
  prerequisiteTopics?: string[];
}

/**
 * Risk factor contributing to academic risk score
 */
export interface RiskFactor {
  id: string;
  category: 'prerequisite_gap' | 'performance_trend' | 'correlation_issue' | 'learning_velocity';
  description: string;
  impact: number; // 0-1 impact on overall risk
  confidence: number; // 0-1 confidence in this risk factor
  courses: string[]; // Affected courses
  timeframe: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
}

/**
 * Cross-course consent management
 */
export interface CrossCourseConsent {
  id: string;
  studentId: string;
  sourceCourse: string;
  targetCourse: string;
  consentType: 'performance_data' | 'behavioral_patterns' | 'learning_analytics' | 'all';
  consentGranted: boolean;
  consentDate: Date;
  expirationDate?: Date;
  withdrawnAt?: Date;
}

/**
 * Cross-course gap alert for instructors
 */
export interface CrossCourseGapAlert {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  instructorId: string;
  courseId: string;
  prerequisiteCourse: string;
  gapArea: string;
  gapConcept: string;
  riskScore: number;
  impactPrediction: ImpactPrediction;
  recommendations: InterventionRecommendation[];
  status: 'new' | 'acknowledged' | 'in-progress' | 'resolved' | 'dismissed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  predictedImpactDate?: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Predicted impact of a knowledge gap
 */
export interface ImpactPrediction {
  timeline: number; // Days until impact manifests
  severity: number; // 0-1 severity of predicted impact
  affectedAssignments?: string[];
  performanceDropPrediction: number; // Expected performance decrease (0-1)
  confidence: number; // 0-1 confidence in prediction
}

/**
 * Intervention recommendation for addressing gaps
 */
export interface InterventionRecommendation {
  id: string;
  type: 'review_session' | 'practice_assignment' | 'tutor_referral' | 'prerequisite_refresh';
  description: string;
  estimatedEffectiveness: number; // 0-1 expected effectiveness
  timeCommitment: number; // Minutes required
  difficulty: 'easy' | 'moderate' | 'challenging';
  resources?: ResourceLink[];
  priority: number; // 1-5 implementation priority
}

/**
 * Resource link for intervention recommendations
 */
export interface ResourceLink {
  id: string;
  title: string;
  url: string;
  type: 'video' | 'article' | 'practice' | 'interactive';
  estimatedTime: number; // Minutes to complete
}

/**
 * Knowledge transfer opportunity between courses
 */
export interface KnowledgeTransferOpportunity {
  id: string;
  studentId: string;
  sourceCourse: string;
  targetCourse: string;
  sourceConcept: string;
  targetConcept: string;
  transferType: 'positive' | 'negative' | 'neutral';
  opportunityStrength: number; // 0-1 strength of transfer opportunity
  recommendation: string;
  status: 'identified' | 'suggested' | 'acted_upon' | 'dismissed';
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Dashboard and UI Types
// ============================================================================

/**
 * Dashboard view modes
 */
export type DashboardView = 'overview' | 'dependencies' | 'gaps' | 'trends';

/**
 * Course status in cross-course analysis
 */
export interface CourseStatus {
  id: string;
  name: string;
  code: string;
  performance: number; // 0-1 current performance
  status: 'strong' | 'at-risk' | 'struggling';
  enrollmentStatus: 'active' | 'completed' | 'dropped';
  prerequisites: string[];
  dependents: string[];
}

/**
 * Action item for student dashboard
 */
export interface ActionItem {
  id: string;
  type: 'knowledge-gap' | 'review-needed' | 'strength-opportunity';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  course: string;
  estimatedTime: number;
  dueDate?: Date;
  completed: boolean;
}

/**
 * Alert filtering and sorting options
 */
export type AlertFilter = 'all' | 'high-risk' | 'new-alerts' | 'acknowledged' | 'critical';
export type AlertSort = 'risk-score' | 'gap-severity' | 'student-name' | 'course' | 'date-created';

/**
 * Performance correlation visualization data
 */
export interface PerformanceCorrelation {
  course1: string;
  course2: string;
  correlation: number; // -1 to 1 correlation coefficient
  confidence: number; // 0-1 confidence in correlation
  sampleSize: number;
  trendDirection: 'positive' | 'negative' | 'neutral';
}

// ============================================================================
// API and Service Types
// ============================================================================

/**
 * Cross-course analytics request parameters
 */
export interface CrossCourseAnalyticsRequest {
  studentId: string;
  includeHistorical?: boolean;
  courseFilters?: string[];
  analysisDepth?: 'basic' | 'detailed' | 'comprehensive';
}

/**
 * Cross-course analytics response
 */
export interface CrossCourseAnalyticsResponse {
  studentId: string;
  academicRiskScore: number;
  activeCourses: CourseStatus[];
  knowledgeDependencies: KnowledgeDependency[];
  performanceCorrelations: PerformanceCorrelation[];
  knowledgeGaps: KnowledgeGap[];
  actionItems: ActionItem[];
  transferOpportunities: KnowledgeTransferOpportunity[];
  lastUpdated: Date;
  dataFreshness: number; // Hours since last update
}

/**
 * Consent update request
 */
export interface ConsentUpdateRequest {
  studentId: string;
  sourceCourse: string;
  targetCourse: string;
  consentType: CrossCourseConsent['consentType'];
  consentGranted: boolean;
  expirationDate?: Date;
}

/**
 * Gap analysis request parameters
 */
export interface GapAnalysisRequest {
  studentId: string;
  targetCourses: string[];
  analysisWindow?: number; // Days of data to analyze
  includePreventive?: boolean; // Include preventive gap detection
}

/**
 * Instructor alert query parameters
 */
export interface InstructorAlertQuery {
  instructorId: string;
  courseId?: string;
  status?: CrossCourseGapAlert['status'];
  priority?: CrossCourseGapAlert['priority'];
  limit?: number;
  offset?: number;
  sortBy?: AlertSort;
  sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// Chat Integration Types
// ============================================================================

/**
 * Cross-course context for chat messages
 */
export interface CrossCourseContext {
  courseName: string;
  courseCode: string;
  relevanceScore: number; // 0-1 relevance to current question
  description: string;
  connectionType: 'prerequisite' | 'dependent' | 'parallel' | 'transfer';
}

/**
 * Enhanced chat message with cross-course capabilities
 */
export interface EnhancedChatMessage {
  content: string;
  timestamp: Date;
  isFromUser: boolean;
  relatedCourses?: string[];
  prerequisiteLinks?: PrerequisiteConcept[];
  knowledgeTransferOpportunities?: KnowledgeTransferOpportunity[];
  crossCourseContext?: CrossCourseContext[];
  gapIdentification?: KnowledgeGap;
}

/**
 * Prerequisite concept explanation
 */
export interface PrerequisiteConcept {
  concept: string;
  course: string;
  explanation: string;
  reviewResources: ResourceLink[];
  masteryLevel: number; // 0-1 student's current mastery
}

// ============================================================================
// Utility and Helper Types
// ============================================================================

/**
 * Branded type for Student ID
 */
export type StudentId = string & { readonly brand: unique symbol };

/**
 * Branded type for Course ID
 */
export type CourseId = string & { readonly brand: unique symbol };

/**
 * Time-based data point for trend analysis
 */
export interface TimeSeriesDataPoint {
  timestamp: Date;
  value: number;
  courseId: string;
  metricType: 'performance' | 'engagement' | 'risk_score';
}

/**
 * Statistical summary for correlation analysis
 */
export interface CorrelationAnalysis {
  correlation: number;
  pValue: number;
  confidence: number;
  sampleSize: number;
  significanceLevel: 'high' | 'medium' | 'low' | 'none';
}

/**
 * Configuration for cross-course analysis
 */
export interface CrossCourseConfig {
  enableProactiveAlerts: boolean;
  gapDetectionSensitivity: number; // 0-1, higher = more sensitive
  correlationThreshold: number; // Minimum correlation to consider
  riskThreshold: number; // Risk score threshold for alerts
  dataRetentionDays: number;
  anonymizationLevel: 'none' | 'partial' | 'full';
}

/**
 * Error types for cross-course operations
 */
export type CrossCourseError = 
  | 'INSUFFICIENT_CONSENT'
  | 'INSUFFICIENT_DATA'
  | 'CORRELATION_FAILED'
  | 'GAP_ANALYSIS_FAILED'
  | 'INVALID_COURSE_SEQUENCE'
  | 'PRIVACY_VIOLATION'
  | 'SYSTEM_OVERLOAD';

/**
 * Result type for operations that might fail
 */
export interface CrossCourseResult<T> {
  success: boolean;
  data?: T;
  error?: {
    type: CrossCourseError;
    message: string;
    details?: Record<string, unknown>;
  };
}

// ============================================================================
// Export all types
// ============================================================================

export type {
  // Core types are already exported inline above
};