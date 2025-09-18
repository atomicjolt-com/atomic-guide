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

// ============================================
// MCP SECURITY ARCHITECTURE TYPES
// ============================================

/**
 * MCP Client Registry for external AI client management
 */
export interface McpClientRegistry {
  id: string;
  tenantId: string;
  clientName: string;
  clientType: 'ai_assistant' | 'research_tool' | 'analytics_platform' | 'custom_integration';
  clientDescription?: string;
  clientVersion?: string;
  clientSecretHash: string;
  apiKeyPrefix?: string;
  authorizedScopes: string[];
  rateLimitPerMinute: number;
  privacyPolicyUrl?: string;
  dataRetentionDays: number;
  anonymizationRequired: boolean;
  auditLoggingEnabled: boolean;
  contactEmail: string;
  organization?: string;
  certificationLevel?: 'basic' | 'verified' | 'enterprise' | 'research';
  status: 'pending' | 'approved' | 'suspended' | 'revoked';
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  lastAccessAt?: Date;
}

/**
 * Client reputation and risk scoring system
 */
export interface McpClientReputation {
  id: string;
  clientId: string;
  tenantId: string;
  reputationScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  totalRequests: number;
  successfulRequests: number;
  violationCount: number;
  lastViolationAt?: Date;
  consecutiveViolations: number;
  maxConsecutiveViolations: number;
  averageRequestSize: number;
  largestRequestSize: number;
  suspiciousPatternCount: number;
  offHoursActivityRatio: number;
  crossTenantAttempts: number;
  dataTypeDiversityScore: number;
  behavioralAnomalyScore: number;
  complianceViolationCount: number;
  lastComplianceViolationAt?: Date;
  automationProbability: number;
  trustScore: number;
  createdAt: Date;
  updatedAt: Date;
  lastRequestAt?: Date;
  reputationHistory: Array<{
    timestamp: Date;
    score: number;
    event: string;
    details?: any;
  }>;
}

/**
 * Data Loss Prevention policy evaluation result
 */
export interface McpDlpPolicyResult {
  allowed: boolean;
  reason: string;
  violationType?: string;
  retryAfterSeconds?: number;
  reputationImpact?: number;
  recommendedAction?: string;
  enhancedMonitoring?: boolean;
}

/**
 * Rate limiting configuration per data type and risk level
 */
export interface McpRateLimitConfig {
  id: string;
  tenantId: string;
  dataType: string;
  riskLevel: string;
  requestsPerMinute: number;
  windowPeriodMinutes: number;
  burstAllowance: number;
  maxConcurrentSessions: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Volume tracking for cumulative data access monitoring
 */
export interface McpVolumeTracking {
  id: string;
  clientId: string;
  tenantId: string;
  userId: string;
  dataType: string;
  trackingDate: Date;
  totalBytes: number;
  requestCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * DLP violations and policy enforcement records
 */
export interface McpDlpViolation {
  id: string;
  tenantId: string;
  clientId: string;
  userId?: string;
  violationType: 'rate_limit_exceeded' | 'volume_limit_exceeded' | 'suspicious_pattern_detected' | 'compliance_violation' | 'unauthorized_access' | 'data_exfiltration_attempt' | 'cross_tenant_access' | 'privilege_escalation' | 'evasion_detected';
  violationDetails: string; // JSON string
  detectedAt: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
  automaticResponse?: string;
  manualReviewRequired: boolean;
  complianceImpact?: string;
  notificationSent: boolean;
}

/**
 * Data access logging for forensics and analysis
 */
export interface McpDataAccessLog {
  id: string;
  tenantId: string;
  clientId: string;
  userId: string;
  dataType: string;
  dataSizeBytes: number;
  accessedAt: Date;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  successful: boolean;
  errorMessage?: string;
  processingTimeMs?: number;
}

/**
 * Behavioral baselines for normal client activity
 */
export interface McpBehavioralBaseline {
  id: string;
  clientId: string;
  tenantId: string;
  version: number;
  learningPeriodDays: number;
  totalSamples: number;
  averageRequestSize: number;
  requestSizeStdDev: number;
  averageRequestsPerHour: number;
  peakHours: number[];
  lowActivityHours: number[];
  weekdayPatterns: Record<string, number>;
  dataTypeDistribution: Record<string, number>;
  averageSessionDuration: number;
  sessionDurationStdDev: number;
  commonIpRanges: string[];
  commonUserAgents: string[];
  confidenceScore: number;
  createdAt: Date;
  updatedAt: Date;
  lastAnalysisAt: Date;
  nextUpdateDue: Date;
}

/**
 * Client activity tracking for behavioral analysis
 */
export interface McpClientActivity {
  id: string;
  clientId: string;
  tenantId: string;
  userId: string;
  dataType: string;
  requestSize: number;
  requestTimestamp: Date;
  sessionDuration?: number;
  ipAddress?: string;
  userAgent?: string;
  additionalMetadata?: string; // JSON string
  analysisCompleted: boolean;
  anomalyScores?: string; // JSON string
  riskLevel?: 'pending' | 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Behavioral anomalies and threat detection
 */
export interface McpBehavioralAnomaly {
  id: string;
  clientId: string;
  tenantId: string;
  userId?: string;
  anomalyType: 'temporal_anomaly' | 'volume_anomaly' | 'velocity_anomaly' | 'pattern_anomaly' | 'behavioral_deviation' | 'evasion_techniques' | 'coordinated_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  detectedAt: Date;
  anomalyScores: string; // JSON string
  detectedPatterns: string[];
  riskIndicators: string[];
  automaticResponse?: string;
  investigationRequired: boolean;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
  falsePositive: boolean;
  suppressSimilar: boolean;
}

/**
 * Security incidents and threat management
 */
export interface McpSecurityIncident {
  id: string;
  clientId: string;
  tenantId: string;
  userId?: string;
  incidentType: 'behavioral_anomaly' | 'dlp_violation' | 'authentication_failure' | 'privilege_escalation' | 'data_exfiltration' | 'coordinated_attack' | 'compliance_violation' | 'unauthorized_access';
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectionSource: string;
  detectedAt: Date;
  title: string;
  description: string;
  status: 'active' | 'investigating' | 'contained' | 'resolved' | 'false_positive';
  assignedTo?: string;
  resolvedAt?: Date;
  resolutionNotes?: string;
  falsePositive: boolean;
  suppressSimilar: boolean;
  relatedIncidents: string[];
  evidenceCollected: boolean;
  investigationRequired: boolean;
  complianceReportingRequired: boolean;
  estimatedImpact?: string;
  mitigationSteps: string[];
  lessonsLearned?: string;
}

/**
 * Client isolation and access control
 */
export interface McpClientIsolation {
  id: string;
  clientId: string;
  tenantId: string;
  isolationLevel: 'soft' | 'hard' | 'complete';
  reason: string;
  initiatedAt: Date;
  initiatedBy: string;
  duration?: number; // minutes
  expiresAt?: Date;
  status: 'active' | 'expired' | 'revoked' | 'completed';
  sessionsTerminated: number;
  accessPointsBlocked: string[];
  notificationsSent: number;
  rollbackProcedureId?: string;
  manualOverrideRequired: boolean;
  complianceImpact?: string;
  auditTrail: Array<{
    timestamp: Date;
    action: string;
    details?: any;
  }>;
}

/**
 * Forensic data capture for investigation
 */
export interface McpForensicCapture {
  id: string;
  incidentId: string;
  clientId: string;
  tenantId: string;
  userId?: string;
  captureTimestamp: Date;
  captureReason: string;
  dataTypes: string[];
  retentionPeriod: number; // days
  accessRestrictions: string[];
  encryptionLevel: string;
  integrityHash: string;
  complianceNotes?: string;
  investigationStatus: 'pending' | 'active' | 'completed' | 'archived';
  evidenceChain: Array<{
    timestamp: Date;
    action: string;
    actor: string;
    details?: any;
  }>;
  exportedAt?: Date;
  purgedAt?: Date;
}

/**
 * Data scope definitions for granular access control
 */
export interface McpDataScope {
  id: string;
  scopeName: string;
  scopeCategory: 'profile' | 'behavioral' | 'assessment' | 'real_time' | 'aggregated';
  description: string;
  dataSensitivityLevel: 'public' | 'internal' | 'confidential' | 'restricted';
  requiresExplicitConsent: boolean;
  privacyImpactScore: number; // 1-10
  gdprArticleApplicable?: string;
  coppaParentalConsentRequired: boolean;
  dataTablesAccessed: string[];
  anonymizationPossible: boolean;
  realTimeAccessAllowed: boolean;
  createdAt: Date;
  updatedAt: Date;
  complianceReviewDue?: Date;
}

/**
 * Active MCP sessions with enhanced security tracking
 */
export interface McpActiveSession {
  id: string;
  tenantId: string;
  userId: string;
  clientId: string;
  sessionToken: string;
  grantedScopes: string[];
  sessionType: 'api_access' | 'real_time_stream' | 'batch_analysis';
  dataAccessedCount: number;
  lastDataAccessAt?: Date;
  rateLimitExceededCount: number;
  consentVersion: string;
  ipAddress?: string;
  userAgent?: string;
  encryptionLevel: string;
  startedAt: Date;
  lastHeartbeatAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
  revocationReason?: string;
  auditEventsCount: number;
  privacyViolationsCount: number;
}

/**
 * Consent revocation queue for real-time processing
 */
export interface McpConsentRevocationQueue {
  id: string;
  tenantId: string;
  userId: string;
  revocationType: 'full_withdrawal' | 'scope_specific' | 'client_specific' | 'emergency_stop';
  affectedScopes: string[];
  affectedClients: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priorityLevel: number; // 1-5
  requestedAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  processingDurationMs?: number;
  revocationReason?: string;
  initiatedBy: 'user' | 'parent' | 'admin' | 'system' | 'compliance';
  complianceFramework?: string;
  sessionsRevokedCount: number;
  dataPurgedTables: string[];
  notificationSent: boolean;
}

/**
 * Parental controls for COPPA compliance
 */
export interface McpParentalControls {
  id: string;
  tenantId: string;
  userId: string;
  parentEmail: string;
  externalAiAccessAllowed: boolean;
  allowedClientTypes: string[];
  maxSessionDurationMinutes: number;
  allowedTimeWindows: Array<{
    days: string[];
    start: string;
    end: string;
  }>;
  notifyOnAccessRequest: boolean;
  notifyOnDataSharing: boolean;
  notifyOnPrivacyChanges: boolean;
  notificationFrequency: 'immediate' | 'daily' | 'weekly';
  emergencyContactPhone?: string;
  canOverrideAiAccess: boolean;
  canViewChildData: boolean;
  canExportChildData: boolean;
  coppaVerificationMethod: 'email' | 'phone' | 'postal_mail' | 'credit_card' | 'digital_signature';
  verificationCompletedAt: Date;
  verificationDocumentId?: string;
  createdAt: Date;
  updatedAt: Date;
  lastNotificationSentAt?: Date;
  nextReviewDue?: Date;
}

/**
 * Security alerts and notifications
 */
export interface McpSecurityAlert {
  id: string;
  tenantId: string;
  alertType: 'dlp_violation' | 'behavioral_anomaly' | 'security_incident' | 'compliance_violation' | 'client_isolation' | 'consent_revocation' | 'system_breach' | 'data_exfiltration';
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  description: string;
  sourceService: string;
  relatedClientId?: string;
  relatedUserId?: string;
  relatedIncidentId?: string;
  alertData?: any;
  createdAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
  escalated: boolean;
  escalationLevel: number;
  notificationSent: boolean;
}

// ============================================
// ANALYSIS AND MONITORING RESULT TYPES
// ============================================

/**
 * Session validation result for external AI client access
 */
export interface McpSessionValidationResult {
  isValid: boolean;
  hasRequiredConsent: boolean;
  allowedScopes: string[];
  missingConsents: string[];
  violations: string[];
  parentalApprovalRequired: boolean;
  sessionLimitsEnforced: boolean;
  expiresAt?: Date;
}

/**
 * Client permission validation result
 */
export interface McpClientPermissionResult {
  allowed: boolean;
  grantedScopes: string[];
  deniedScopes: string[];
  reason?: string;
  requiresAdditionalConsent: boolean;
  parentalOverrideRequired: boolean;
}

/**
 * Anomaly scores for multi-dimensional analysis
 */
export interface McpAnomalyScore {
  temporal: number;
  volume: number;
  velocity: number;
  dataTypePattern: number;
  sessionBehavior: number;
  geographic: number;
  userAgent: number;
  composite: number;
  calculatedAt: Date;
  baselineVersion?: number;
}

/**
 * Behavioral pattern detection result
 */
export interface McpBehavioralPattern {
  patternType: string;
  confidence: number;
  description: string;
  firstDetected: Date;
  occurrenceCount: number;
  associatedRisks: string[];
  mitigationRecommendations: string[];
}

/**
 * Comprehensive behavioral analysis result
 */
export interface McpBehavioralAnalysisResult {
  clientId: string;
  tenantId: string;
  userId: string;
  analysisTimestamp: Date;
  isAnomalous: boolean;
  isCritical: boolean;
  overallRiskScore: number;
  anomalyScores: McpAnomalyScore;
  detectedPatterns: string[];
  threatIndicators: string[];
  recommendedActions: string[];
  anomalyRecord?: McpBehavioralAnomaly;
  baselineConfidence: number;
  requiresImmediateAttention: boolean;
  forensicDataCaptured: boolean;
}

/**
 * Client risk assessment result
 */
export interface McpClientRiskAssessment {
  clientId: string;
  tenantId: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number; // 0-1
  riskFactors: Array<{
    factor: string;
    weight: number;
    score: number;
    description: string;
  }>;
  recommendedActions: string[];
  assessmentTimestamp: Date;
  validUntil: Date;
}

/**
 * Incident response action
 */
export interface McpResponseAction {
  actionType: string;
  executedAt: Date;
  result: 'success' | 'failed' | 'partial';
  details?: string;
  duration?: number; // minutes
  reversible: boolean;
  automatedExecution: boolean;
}

/**
 * Incident classification result
 */
export interface McpIncidentClassification {
  incidentId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  complexity: 'low' | 'medium' | 'high';
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  dataCompromiseRisk: 'low' | 'medium' | 'high';
  complianceImpact: string;
  businessImpact: string;
  technicalImpact: string;
  attackVector: string;
  attackerProfile: string;
  mitigationStrategy: string;
  recoveryComplexity: 'low' | 'medium' | 'high';
  legalImplications: string;
  classifiedAt: Date;
  classificationConfidence: number;
  reviewRequired: boolean;
}

/**
 * Incident response summary
 */
export interface McpIncidentResponse {
  incidentId: string;
  responseActions: McpResponseAction[];
  isolationApplied: boolean;
  escalationTriggered: boolean;
  forensicsCaptured: boolean;
  estimatedResolutionTime: Date;
  nextReviewRequired: Date;
}

/**
 * Escalation rule configuration
 */
export interface McpEscalationRule {
  id: string;
  tenantId?: string;
  level: number;
  triggerConditions: {
    severity?: string[];
    incidentType?: string[];
    riskScore?: number;
    timeThreshold?: number; // minutes
  };
  stakeholders: string[];
  timeThreshold: number; // minutes
  autoEscalate: boolean;
}

/**
 * Notification configuration
 */
export interface McpNotificationConfig {
  securityTeamImmediate: boolean;
  complianceOfficerThreshold: string;
  executiveThreshold: string;
  userNotificationRequired: boolean;
}

/**
 * Recovery procedure definition
 */
export interface McpRecoveryProcedure {
  id: string;
  incidentId: string;
  procedureType: string;
  steps: Array<{
    order: number;
    description: string;
    automated: boolean;
    completed: boolean;
    completedAt?: Date;
  }>;
  estimatedDuration: number; // minutes
  requiredApprovals: string[];
  rollbackPossible: boolean;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

/**
 * Threat indicator for correlation analysis
 */
export interface McpThreatIndicator {
  id: string;
  indicatorType: string;
  value: string;
  confidence: number;
  source: string;
  firstSeen: Date;
  lastSeen: Date;
  associatedThreats: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Real-time monitoring configuration
 */
export interface McpRealTimeMonitoringConfig {
  enabled: boolean;
  samplingRate: number; // 0-1
  alertThresholds: {
    anomalyScore: number;
    violationRate: number;
    reputationScore: number;
  };
  monitoringInterval: number; // seconds
  retentionPeriod: number; // days
}

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

  // MCP-specific external AI access consent
  externalAiAccessConsent: boolean;
  mcpClientScopes: string[];
  realTimeRevocationEnabled: boolean;
  externalClientRestrictions: Record<string, any>;

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

  // MCP-specific consent updates
  externalAiAccessConsent?: boolean;
  mcpClientScopes?: string[];
  realTimeRevocationEnabled?: boolean;
  externalClientRestrictions?: Record<string, any>;

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
  id: string;
  tenantId: string;
  userId: string;
  profileId: string;
  
  attribute: string;
  value: number | string;
  confidence: number;
  dataPoints: number;
  lastUpdated: Date;
  evidenceSource: 'assessment' | 'chat' | 'timing' | 'behavior' | 'manual';
  
  // Context information
  courseId?: string;
  sessionId?: string;
  contextData: Record<string, any>;
  
  // Quality metrics
  validationScore: number;
  stabilityScore: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
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

/**
 * MCP-specific type definitions for external AI client integration
 */

/**
 * MCP Client registry for managing external AI clients
 */
export interface McpClientRegistry {
  id: string;
  tenantId: string;

  // Client identification
  clientName: string;
  clientType: 'ai_assistant' | 'analytics_tool' | 'research_platform' | 'tutoring_system';
  clientDescription: string;
  clientVersion: string;

  // Authentication and authorization
  clientSecretHash: string;
  apiKeyPrefix: string;
  authorizedScopes: string[];
  rateLimitPerMinute: number;

  // Privacy and compliance
  privacyPolicyUrl?: string;
  dataRetentionDays: number;
  anonymizationRequired: boolean;
  auditLoggingEnabled: boolean;

  // Client metadata
  contactEmail: string;
  organization?: string;
  certificationLevel?: 'basic' | 'enterprise' | 'research';

  // Status and temporal tracking
  status: 'pending' | 'approved' | 'suspended' | 'revoked';
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  lastAccessAt?: Date;
}

/**
 * MCP Data Scope definitions for granular permissions
 */
export interface McpDataScope {
  id: string;
  scopeName: string;
  scopeCategory: 'profile' | 'behavioral' | 'assessment' | 'real_time' | 'aggregated';

  // Scope details
  description: string;
  dataSensitivityLevel: 'low' | 'medium' | 'high' | 'critical';
  requiresExplicitConsent: boolean;

  // Privacy implications
  privacyImpactScore: number;
  gdprArticleApplicable?: string;
  coppaParentalConsentRequired: boolean;

  // Data access patterns
  dataTablesAccessed: string[];
  anonymizationPossible: boolean;
  realTimeAccessAllowed: boolean;

  // Compliance and audit
  createdAt: Date;
  updatedAt: Date;
  complianceReviewDue?: Date;
}

/**
 * MCP Active Session for real-time session management
 */
export interface McpActiveSession {
  id: string;
  tenantId: string;
  userId: string;
  clientId: string;

  // Session details
  sessionToken: string;
  grantedScopes: string[];
  sessionType: 'api_access' | 'real_time_stream' | 'batch_analysis';

  // Access patterns
  dataAccessedCount: number;
  lastDataAccessAt?: Date;
  rateLimitExceededCount: number;

  // Privacy and security
  consentVersion: string;
  ipAddress?: string;
  userAgent?: string;
  encryptionLevel: string;

  // Session lifecycle
  startedAt: Date;
  lastHeartbeatAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
  revocationReason?: string;

  // Compliance tracking
  auditEventsCount: number;
  privacyViolationsCount: number;
}

/**
 * MCP Consent Revocation Queue for real-time processing
 */
export interface McpConsentRevocationQueue {
  id: string;
  tenantId: string;
  userId: string;

  // Revocation details
  revocationType: 'full_withdrawal' | 'scope_specific' | 'client_specific' | 'emergency_stop';
  affectedScopes: string[];
  affectedClients: string[];

  // Processing status
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priorityLevel: number;

  // Revocation metadata
  requestedAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  processingDurationMs?: number;

  // Audit and compliance
  revocationReason?: string;
  initiatedBy: 'user' | 'parent' | 'admin' | 'system' | 'compliance';
  complianceFramework?: 'COPPA' | 'GDPR' | 'FERPA';

  // Results tracking
  sessionsRevokedCount: number;
  dataPurgedTables: string[];
  notificationSent: boolean;
}

/**
 * MCP Parental Controls for COPPA compliance
 */
export interface McpParentalControls {
  id: string;
  tenantId: string;
  userId: string;
  parentEmail: string;

  // Control settings
  externalAiAccessAllowed: boolean;
  allowedClientTypes: Array<'ai_assistant' | 'analytics_tool' | 'research_platform' | 'tutoring_system'>;
  maxSessionDurationMinutes: number;
  allowedTimeWindows: Array<{
    start: string;
    end: string;
    days: Array<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'>;
  }>;

  // Notification preferences
  notifyOnAccessRequest: boolean;
  notifyOnDataSharing: boolean;
  notifyOnPrivacyChanges: boolean;
  notificationFrequency: 'immediate' | 'daily' | 'weekly';

  // Override capabilities
  emergencyContactPhone?: string;
  canOverrideAiAccess: boolean;
  canViewChildData: boolean;
  canExportChildData: boolean;

  // Compliance tracking
  coppaVerificationMethod: 'email' | 'phone' | 'postal' | 'credit_card';
  verificationCompletedAt: Date;
  verificationDocumentId?: string;

  // Temporal tracking
  createdAt: Date;
  updatedAt: Date;
  lastNotificationSentAt?: Date;
  nextReviewDue?: Date;
}

/**
 * MCP Session validation result
 */
export interface McpSessionValidationResult {
  isValid: boolean;
  hasRequiredConsent: boolean;
  allowedScopes: string[];
  missingConsents: string[];
  violations: string[];
  parentalApprovalRequired: boolean;
  sessionLimitsEnforced: boolean;
  expiresAt?: Date;
}

/**
 * MCP Client permission check result
 */
export interface McpClientPermissionResult {
  hasPermission: boolean;
  grantedScopes: string[];
  deniedScopes: string[];
  rateLimitStatus: {
    remaining: number;
    resetAt: Date;
  };
  complianceIssues: string[];
  parentalControlsActive: boolean;
}
