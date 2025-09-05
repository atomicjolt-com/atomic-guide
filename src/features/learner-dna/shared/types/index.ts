/**
 * @fileoverview TypeScript type exports for learner DNA feature
 * @module features/learner-dna/shared/types
 */

// Re-export all schema types for easy importing
export type {
  LearningVelocityPattern,
  MemoryRetentionCurve,
  InteractionTimingPattern,
  ComprehensionStyle,
  StrugglePatternIndicators,
  StudentPersona,
  CognitiveProfile,
  LearningSessionData,
  PrivacyAttackData,
  SyntheticDataGenerationParams,
  DataQualityMetrics,
} from '../schemas/learner-dna.schema';

// Export schema objects
export { LearnerDNASchemas } from '../schemas/learner-dna.schema';

/**
 * Additional utility types for working with learner DNA data
 */

/**
 * Branded type for learner DNA student IDs
 */
export type LearnerDNAStudentId = string & { readonly brand: unique symbol };

/**
 * Learning analytics aggregation levels
 */
export type AggregationLevel = 'individual' | 'cohort' | 'course' | 'institution';

/**
 * Time window for analytics
 */
export interface TimeWindow {
  start: Date;
  end: Date;
  granularity: 'hour' | 'day' | 'week' | 'month';
}

/**
 * Learning outcome categories based on Bloom's taxonomy
 */
export type LearningOutcome = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';

/**
 * Difficulty levels for learning content
 */
export type DifficultyLevel = 'novice' | 'intermediate' | 'advanced' | 'expert';

/**
 * Learning modalities for content delivery
 */
export type LearningModality = 'visual' | 'auditory' | 'kinesthetic' | 'reading' | 'multimodal';

/**
 * Intervention types for personalized learning
 */
export type InterventionType =
  | 'remediation'
  | 'acceleration'
  | 'practice'
  | 'review'
  | 'assessment'
  | 'help_seeking'
  | 'break_suggestion'
  | 'difficulty_adjustment';

/**
 * Learning state indicators
 */
export interface LearningState {
  engagement: number; // 0-1
  frustration: number; // 0-1
  confusion: number; // 0-1
  confidence: number; // 0-1
  cognitiveLoad: number; // 0-2+
  motivation: number; // 0-1
}

/**
 * Adaptive learning recommendation
 */
export interface AdaptiveLearningRecommendation {
  id: string;
  studentId: LearnerDNAStudentId;
  type: InterventionType;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  confidence: number; // 0-1
  reasoning: string;
  suggestedAction: string;
  estimatedTimeMinutes: number;
  expectedOutcome: LearningOutcome;
  createdAt: Date;
  expiresAt?: Date;
}

/**
 * Learning trajectory point
 */
export interface LearningTrajectoryPoint {
  timestamp: Date;
  conceptId: string;
  masteryLevel: number; // 0-1
  confidence: number; // 0-1
  attempts: number;
  timeSpent: number; // seconds
  helpRequested: boolean;
}

/**
 * Cognitive model prediction
 */
export interface CognitivePrediction {
  studentId: LearnerDNAStudentId;
  predictionType: 'mastery_time' | 'success_probability' | 'optimal_difficulty' | 'at_risk';
  value: number;
  confidence: number; // 0-1
  features: Record<string, number>;
  modelVersion: string;
  createdAt: Date;
}

/**
 * Privacy-preserving analytics result
 */
export interface PrivacyPreservingResult<T> {
  data: T;
  privacyParams: {
    epsilon: number;
    delta: number;
    kAnonymity: number;
  };
  noiseAdded: boolean;
  confidenceInterval: [number, number];
  sampleSize: number;
}

/**
 * Research pattern validation result
 */
export interface ResearchValidationResult {
  patternName: string;
  expectedValue: number;
  observedValue: number;
  confidenceInterval: [number, number];
  pValue: number;
  effectSize: number;
  interpretation: 'significant' | 'not_significant' | 'marginal';
  researchSource: string;
}

/**
 * Synthetic data quality assessment
 */
export interface SyntheticDataQuality {
  fidelity: number; // How well it matches real data patterns (0-1)
  utility: number; // How useful for intended purpose (0-1)
  privacy: number; // Privacy protection level (0-1)
  diversity: number; // Coverage of edge cases (0-1)
  consistency: number; // Internal logical consistency (0-1)
  realism: number; // Behavioral realism (0-1)
}

/**
 * Learning analytics event
 */
export interface LearningEvent {
  id: string;
  studentId: LearnerDNAStudentId;
  sessionId: string;
  eventType: 'page_view' | 'question_attempt' | 'help_request' | 'resource_access' | 'submission' | 'break';
  timestamp: Date;
  conceptId?: string;
  responseTime?: number;
  accuracy?: number;
  metadata: Record<string, unknown>;
}

/**
 * Learner DNA Privacy Consent for comprehensive data protection
 */
export interface LearnerDNAPrivacyConsent {
  id: string;
  tenantId: string;
  userId: string;
  consentVersion: string;

  // Granular consent permissions
  behavioralTimingConsent: boolean;
  assessmentPatternsConsent: boolean;
  chatInteractionsConsent: boolean;
  crossCourseCorrelationConsent: boolean;
  anonymizedAnalyticsConsent: boolean;

  // Data collection level
  dataCollectionLevel: 'minimal' | 'standard' | 'comprehensive';

  // COPPA compliance for minors
  parentalConsentRequired: boolean;
  parentalConsentGiven: boolean;
  parentalEmail?: string;

  // Timestamps and metadata
  consentGivenAt: Date;
  consentUpdatedAt: Date;
  withdrawalRequestedAt?: Date;
  withdrawalReason?: string;

  // Audit information
  consentSource: 'dashboard' | 'onboarding' | 'policy_update' | 'api' | 'test';
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Privacy consent update data for modifications
 */
export interface PrivacyConsentUpdate {
  behavioralTimingConsent?: boolean;
  assessmentPatternsConsent?: boolean;
  chatInteractionsConsent?: boolean;
  crossCourseCorrelationConsent?: boolean;
  anonymizedAnalyticsConsent?: boolean;
  dataCollectionLevel?: 'minimal' | 'standard' | 'comprehensive';
  parentalConsentRequired?: boolean;
  parentalConsentGiven?: boolean;
  parentalEmail?: string;
  consentSource?: 'dashboard' | 'onboarding' | 'policy_update' | 'api' | 'test';
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Behavioral pattern data structure for cognitive analysis
 */
export interface BehavioralPattern {
  id: string;
  tenantId: string;
  userId: string;
  sessionId: string;

  // Pattern classification
  patternType:
    | 'interaction_timing'
    | 'learning_velocity'
    | 'memory_retention'
    | 'comprehension_style'
    | 'struggle_indicators'
    | 'content_preferences';
  contextType: 'chat' | 'assessment' | 'content_review' | 'navigation';

  // Data storage
  rawDataEncrypted: string;
  rawDataHash: string;
  aggregatedMetrics: Record<string, any>;
  confidenceLevel: number;

  // Context and timing
  courseId?: string;
  contentId?: string;
  collectedAt: Date;
  anonymizedAt?: Date;
  purgeAt?: Date;

  // Privacy compliance
  privacyLevel: 'identifiable' | 'pseudonymized' | 'anonymized';
  consentVerified: boolean;
}

/**
 * Comprehensive Learner DNA Profile
 */
export interface LearnerDNAProfile {
  id: string;
  tenantId: string;
  userId: string;

  // Core cognitive attributes with confidence scoring
  learningVelocityValue: number;
  learningVelocityConfidence: number;
  learningVelocityDataPoints: number;
  learningVelocityLastUpdated: Date;

  memoryRetentionValue: number;
  memoryRetentionConfidence: number;
  memoryRetentionDataPoints: number;
  memoryRetentionLastUpdated: Date;

  struggleThresholdValue: number;
  struggleThresholdConfidence: number;
  struggleThresholdDataPoints: number;
  struggleThresholdLastUpdated: Date;

  // Complex attributes as JSON
  cognitiveAttributes: Record<string, any>;
  comprehensionStyles: string[];
  preferredModalities: string[];

  // Profile quality
  profileConfidence: number;
  totalDataPoints: number;
  analysisQualityScore: number;

  // Cross-course intelligence
  crossCoursePatterns: Record<string, any>;
  multiContextConfidence: number;

  // Privacy and visibility
  dataCollectionLevel: 'minimal' | 'standard' | 'comprehensive';
  profileVisibility: 'private' | 'course_aggregate' | 'anonymized';

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastAnalyzedAt: Date;
}

/**
 * Interaction timing data from chat conversations
 */
export interface InteractionTimingData {
  responseDelays: number[]; // seconds
  sessionDuration: number; // seconds
  courseId?: string;
  engagementEvents: Array<{
    type: string;
    timestamp: number;
  }>;
}

/**
 * Learning velocity tracking data
 */
export interface LearningVelocityData {
  id: string;
  tenantId: string;
  userId: string;
  profileId: string;

  conceptId: string;
  conceptName: string;
  timeToMasteryMinutes: number;
  attemptCount: number;
  masteryThreshold: number;
  masteryConfidence: number;
  difficultyLevel: number;

  priorKnowledgeLevel?: number;
  struggledConcepts: string[];
  accelerationFactors: string[];

  courseId?: string;
  startedAt: Date;
  masteryAchievedAt: Date;
  recordedAt: Date;
}

/**
 * Memory retention analysis results
 */
export interface MemoryRetentionAnalysis {
  id: string;
  tenantId: string;
  userId: string;
  profileId: string;

  conceptId: string;
  initialMasteryLevel: number;
  currentRetentionLevel: number;

  // Forgetting curve parameters
  forgettingCurveSlope: number;
  memoryStrengthFactor: number;
  retentionHalfLifeDays: number;

  // Optimal review timing
  optimalReviewIntervalDays: number;
  nextReviewRecommendedAt?: Date;

  // Performance metrics
  reviewSessionsCount: number;
  retentionAccuracyScore?: number;
  interferenceFactors: string[];

  // Analysis metadata
  analysisConfidence: number;
  dataPointsUsed: number;
  lastAssessmentAt: Date;
  analyzedAt: Date;
}

/**
 * Struggle indicator detection
 */
export interface StruggleIndicator {
  id: string;
  tenantId: string;
  userId: string;
  profileId: string;

  struggleType: string;
  severityScore: number;
  confidenceScore: number;
  triggeringConcepts: string[];
  behavioralSignals: Record<string, any>;
  recommendedInterventions: string[];
  detectedAt: Date;
  contextData: any;
}

/**
 * Content preference tracking
 */
export interface ContentPreference {
  id: string;
  tenantId: string;
  userId: string;
  profileId: string;

  preferredContentTypes: string[];
  effectiveFormats: Array<{ type: string; effectiveness: number }>;
  optimalEngagementDuration: number;
  interactionPatterns: Record<string, any>;
  confidenceScore: number;
  analyzedAt: Date;
  dataPoints: number;
}

/**
 * Cross-course learning patterns
 */
export interface CrossCoursePattern {
  id: string;
  tenantId: string;
  patternName: string;
  patternType: 'velocity_correlation' | 'retention_similarity' | 'modality_preference' | 'struggle_commonality';

  courseContexts: any[]; // Anonymized course identifiers
  patternStrength: number;
  statisticalConfidence: number;
  correlationCoefficient?: number;

  sampleSize: number;
  privacyProtectionLevel: string;
  zeroKnowledgeProof?: string;

  detectedAt: Date;
  validationScore?: number;
  educationalImpactScore?: number;
}

/**
 * Cognitive attribute with metadata
 */
export interface CognitiveAttribute {
  attribute: string;
  value: number | string;
  confidence: number;
  dataPoints: number;
  lastUpdated: Date;
  evidenceSource: 'assessment' | 'chat' | 'timing' | 'behavior' | 'manual';
}

/**
 * Data retention policy configuration
 */
export interface DataRetentionPolicy {
  id: string;
  tenantId: string;
  policyName: string;
  dataType: string;
  retentionDays: number;
  autoPurgeEnabled: boolean;
  anonymizationDelayDays: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Privacy impact assessment
 */
export interface PrivacyImpactAssessment {
  id: string;
  tenantId: string;
  assessmentName: string;
  assessmentVersion: string;

  dataSensitivityScore: number;
  reidentificationRisk: number;
  educationalBenefitScore: number;

  mitigationMeasures: string[];
  privacyControlsImplemented: string[];
  complianceFrameworks: string[];

  assessedBy: string;
  reviewedBy?: string;
  approved: boolean;
  approvalDate?: Date;

  createdAt: Date;
  updatedAt: Date;
  nextReviewDue: Date;
}

/**
 * Privacy impact scoring for transparency
 */
export interface PrivacyImpactScore {
  dataType: string;
  sensitivityLevel: 'low' | 'medium' | 'high';
  reidentificationRisk: number;
  educationalBenefit: number;
  mitigationMeasures: string[];
}

/**
 * Anonymized cognitive insights for course-level analytics
 */
export interface AnonymizedCognitiveInsights {
  id: string;
  tenantId: string;
  courseId: string;

  aggregationType: 'course' | 'module' | 'concept' | 'cohort';
  aggregationLevel: string;
  sampleSize: number;

  // Anonymized metrics
  avgLearningVelocity?: number;
  medianLearningVelocity?: number;
  learningVelocityStdDev?: number;

  avgMemoryRetention?: number;
  medianMemoryRetention?: number;
  memoryRetentionStdDev?: number;

  commonStrugglePatterns: any[];
  effectiveModalities: any[];

  // Privacy protection
  epsilonPrivacyBudget: number;
  noiseScaleApplied: number;
  kAnonymityThreshold: number;

  // Statistical metadata
  confidenceInterval: number;
  statisticalSignificance?: number;
  marginOfError?: number;

  // Temporal tracking
  calculatedAt: Date;
  validUntil?: Date;
  dataFreshnessScore: number;
}

/**
 * Cognitive profile validation results
 */
export interface CognitiveProfileValidation {
  id: string;
  tenantId: string;
  profileId: string;
  validationType: 'prediction_accuracy' | 'pattern_consistency' | 'cross_validation' | 'noise_detection';

  accuracyScore: number;
  confidenceInterval: number;
  validationSampleSize: number;

  validationData: any;
  baselineComparison?: number;
  improvementOverBaseline?: number;

  validatedAt: Date;
  validationPeriodDays: number;
  nextValidationDue?: Date;
}

/**
 * Consent audit entry for compliance tracking
 */
export interface ConsentAuditEntry {
  id: string;
  tenantId: string;
  actorType: 'student' | 'instructor' | 'admin' | 'system' | 'ai_service';
  actorId: string;
  action:
    | 'consent_given'
    | 'consent_withdrawn'
    | 'data_collected'
    | 'profile_generated'
    | 'data_anonymized'
    | 'data_purged'
    | 'profile_viewed'
    | 'insights_accessed';
  resourceType: 'privacy_consent' | 'behavioral_pattern' | 'cognitive_profile' | 'anonymized_insight';
  resourceId?: string;
  privacyLevel: string;
  consentStatus: string;
  actionDetails?: any;
  dataSensitivityLevel?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

/**
 * Learner DNA data export format
 */
export interface LearnerDNADataExport {
  version: string;
  exportDate: Date;
  studentId: LearnerDNAStudentId;
  privacyLevel: 'full' | 'anonymized' | 'aggregated';
  timeRange: TimeWindow;
  cognitiveProfile: CognitiveProfile;
  sessions: LearningSessionData[];
  trajectories: LearningTrajectoryPoint[];
  patterns: BehavioralPattern[];
  recommendations: AdaptiveLearningRecommendation[];
  qualityMetrics: SyntheticDataQuality;
}

/**
 * Research study configuration
 */
export interface ResearchStudyConfig {
  name: string;
  description: string;
  hypotheses: string[];
  population: {
    size: number;
    demographics: Record<string, any>;
    inclusion: string[];
    exclusion: string[];
  };
  duration: {
    start: Date;
    end: Date;
    followUpMonths?: number;
  };
  interventions: Array<{
    name: string;
    type: InterventionType;
    parameters: Record<string, unknown>;
    controlGroup: boolean;
  }>;
  measuredOutcomes: LearningOutcome[];
  ethicsApproval: string;
  dataGovernance: {
    retention: number; // days
    sharing: 'none' | 'anonymized' | 'aggregated';
    consent: string[];
  };
}

/**
 * Model validation metrics
 */
export interface ModelValidationMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  auc: number;
  calibrationError: number;
  fairnessMetrics: Record<string, number>;
  interpretabilityScore: number;
  robustness: number;
  generalization: number;
}

/**
 * Feature importance for ML models
 */
export interface FeatureImportance {
  featureName: string;
  importance: number;
  confidence: number;
  interpretation: string;
  category: 'cognitive' | 'behavioral' | 'temporal' | 'contextual';
}

/**
 * A/B test configuration for personalized learning
 */
export interface ABTestConfig {
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  variants: Array<{
    name: string;
    weight: number; // 0-1, must sum to 1
    parameters: Record<string, unknown>;
  }>;
  successMetrics: string[];
  minimumSampleSize: number;
  significanceLevel: number; // e.g., 0.05
  powerLevel: number; // e.g., 0.8
}

/**
 * Story 4.2 Advanced Pattern Recognition Types
 */

/**
 * Struggle prediction result with confidence and explanations
 */
export interface StrugglePrediction {
  riskLevel: number; // 0-1 probability of struggle
  confidence: number; // 0-1 confidence in prediction
  timeToStruggle: number; // Estimated minutes until struggle
  contributingFactors: string[];
  recommendations: string[];
  explainability: string; // Human-readable explanation
  predictedAt: Date;
  validUntil: Date;
}

/**
 * Learning velocity forecast with personalized recommendations
 */
export interface LearningVelocityForecast {
  estimatedMasteryTime: number; // Minutes to concept mastery
  confidence: number; // 0-1 confidence in estimate
  accelerationFactors: string[];
  riskFactors: string[];
  personalizedStrategies: string[];
  explainability: string;
  forecastedAt: Date;
  validUntil: Date;
}

/**
 * Real-time behavioral signal analysis
 */
export interface BehavioralSignalAnalysis {
  cognitiveLoad: number; // 0-2+ current cognitive load
  attentionLevel: number; // 0-1 current attention level
  engagementScore: number; // 0-1 current engagement
  fatigueLevel: number; // 0-1 current fatigue level
  optimalInterventionTiming: boolean; // Whether now is optimal for intervention
  recommendations: string[]; // Real-time recommendations
  analyzedAt?: Date;
}

/**
 * Behavioral features extracted for ML models
 */
export interface BehavioralFeatures {
  // Interaction timing patterns
  avgResponseTime: number;
  responseTimeVariability: number;
  sessionDuration: number;
  breakFrequency: number;

  // Learning engagement patterns  
  helpRequestRate: number;
  errorRate: number;
  progressVelocity: number;
  attentionScore: number;

  // Cognitive load indicators
  taskSwitchingFrequency: number;
  cognitiveLoadEstimate: number;
  fatigueIndicators: number;
  
  // Context information
  timeOfDay: number; // 0-23 hour
  dayOfWeek: number; // 0-6
  courseProgress: number; // 0-1 completion percentage
}

/**
 * Time series data point for temporal pattern analysis
 */
export interface TimeSeriesDataPoint {
  timestamp: Date;
  value: number;
  context: string;
  confidence: number;
}

/**
 * Prediction result storage for effectiveness tracking
 */
export interface PredictionResult {
  id: string;
  tenantId: string;
  userId: string;
  courseId: string;
  predictionType: 'struggle_prediction' | 'velocity_forecast' | 'behavioral_analysis';
  predictionData: Record<string, any>;
  confidenceScore: number;
  actualOutcome?: Record<string, any>;
  accuracyScore?: number;
  createdAt: Date;
  validatedAt?: Date;
}

/**
 * Learning intervention recommendation
 */
export interface LearningIntervention {
  id: string;
  userId: string;
  interventionType: 'proactive_help' | 'difficulty_adjustment' | 'study_strategy' | 'early_warning';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  triggerPattern: string;
  recommendedAction: string;
  targetCognitiveAttribute: string;
  expectedOutcome: string;
  measurementCriteria: string[];
  deliveryTimestamp: Date;
  studentResponse?: 'accepted' | 'dismissed' | 'ignored';
  effectivenessScore?: number;
  followUpRequired?: boolean;
}

// Utility type guards
export function isLearnerDNAStudentId(value: string): value is LearnerDNAStudentId {
  return typeof value === 'string' && value.length > 0;
}

export function isValidTimeWindow(timeWindow: TimeWindow): boolean {
  return timeWindow.start < timeWindow.end;
}

export function isValidLearningState(state: LearningState): boolean {
  const values = [state.engagement, state.frustration, state.confusion, state.confidence, state.motivation];
  return values.every((v) => v >= 0 && v <= 1) && state.cognitiveLoad >= 0 && state.cognitiveLoad <= 2;
}
