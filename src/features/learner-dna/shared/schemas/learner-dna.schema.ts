/**
 * @fileoverview Comprehensive Zod schemas for Learner DNA synthetic data generation
 * @module features/learner-dna/shared/schemas/learner-dna
 */

import { z } from 'zod';

/**
 * Schema for learning velocity patterns based on educational psychology research
 */
export const LearningVelocityPatternSchema = z.object({
  /** Base learning rate (concepts/hour) */
  baseRate: z.number().min(0.1).max(10.0),
  /** Acceleration factor for repeated exposure */
  acceleration: z.number().min(0.8).max(2.5),
  /** Fatigue factor after prolonged study */
  fatigueDecay: z.number().min(0.1).max(1.0),
  /** Recovery rate from fatigue */
  recoveryRate: z.number().min(0.1).max(2.0),
  /** Time pattern (morning/afternoon/evening performance) */
  timeOfDayMultipliers: z.object({
    morning: z.number().min(0.5).max(1.5),
    afternoon: z.number().min(0.5).max(1.5),
    evening: z.number().min(0.5).max(1.5),
  }),
  /** Weekly pattern variability */
  weeklyVariation: z.number().min(0.0).max(0.3),
  /** Individual consistency vs. variability */
  consistencyFactor: z.number().min(0.1).max(1.0),
});

export type LearningVelocityPattern = z.infer<typeof LearningVelocityPatternSchema>;

/**
 * Schema for Ebbinghaus forgetting curves and memory retention
 */
export const MemoryRetentionCurveSchema = z.object({
  /** Initial retention rate immediately after learning */
  initialRetention: z.number().min(0.7).max(1.0),
  /** Forgetting curve decay constant (higher = faster forgetting) */
  decayConstant: z.number().min(0.1).max(3.0),
  /** Asymptotic retention level (never fully forgotten) */
  asymptoticRetention: z.number().min(0.0).max(0.4),
  /** Spaced repetition effectiveness multiplier */
  spacedRepetitionBonus: z.number().min(1.1).max(3.0),
  /** Interference factor from similar concepts */
  interferenceFactor: z.number().min(0.8).max(1.2),
  /** Personal memory strength variation */
  memoryStrengthMultiplier: z.number().min(0.5).max(2.0),
  /** Sleep consolidation bonus */
  sleepConsolidationBonus: z.number().min(1.0).max(1.4),
});

export type MemoryRetentionCurve = z.infer<typeof MemoryRetentionCurveSchema>;

/**
 * Schema for interaction timing patterns and engagement rhythms
 */
export const InteractionTimingPatternSchema = z.object({
  /** Base response time in milliseconds */
  baseResponseTime: z.number().int().min(500).max(30000),
  /** Variability in response times (standard deviation) */
  responseVariability: z.number().min(0.1).max(2.0),
  /** Thinking time for complex questions multiplier */
  complexityMultiplier: z.number().min(1.2).max(5.0),
  /** Session duration preference in minutes */
  preferredSessionDuration: z.number().int().min(5).max(120),
  /** Break frequency (sessions per break) */
  breakFrequency: z.number().int().min(1).max(10),
  /** Engagement decline pattern */
  engagementDeclineRate: z.number().min(0.0).max(0.1),
  /** Time-of-day engagement patterns */
  engagementByHour: z.array(z.number().min(0.3).max(1.0)).length(24),
  /** Procrastination tendency */
  procrastinationFactor: z.number().min(0.0).max(2.0),
});

export type InteractionTimingPattern = z.infer<typeof InteractionTimingPatternSchema>;

/**
 * Schema for comprehension style distributions
 */
export const ComprehensionStyleSchema = z
  .object({
    /** Visual learning preference (0-1) */
    visual: z.number().min(0.0).max(1.0),
    /** Auditory learning preference (0-1) */
    auditory: z.number().min(0.0).max(1.0),
    /** Kinesthetic learning preference (0-1) */
    kinesthetic: z.number().min(0.0).max(1.0),
    /** Reading/writing preference (0-1) */
    readingWriting: z.number().min(0.0).max(1.0),
    /** Sequential vs. global processing */
    sequentialVsGlobal: z.number().min(0.0).max(1.0), // 0 = sequential, 1 = global
    /** Abstract vs. concrete thinking */
    abstractVsConcrete: z.number().min(0.0).max(1.0), // 0 = concrete, 1 = abstract
    /** Collaborative vs. independent learning */
    collaborativeVsIndependent: z.number().min(0.0).max(1.0), // 0 = independent, 1 = collaborative
    /** Processing speed preference */
    processingSpeed: z.enum(['slow_deep', 'moderate', 'fast_surface']),
  })
  .refine(
    (data) => {
      // Ensure VARK preferences sum to approximately 1.0 (±0.2 tolerance)
      const total = data.visual + data.auditory + data.kinesthetic + data.readingWriting;
      return total >= 0.8 && total <= 1.2;
    },
    {
      message: 'VARK learning preferences must sum to approximately 1.0',
    }
  );

export type ComprehensionStyle = z.infer<typeof ComprehensionStyleSchema>;

/**
 * Schema for struggle pattern indicators
 */
export const StrugglePatternIndicatorsSchema = z.object({
  /** Confusion tendency (0-1) */
  confusionTendency: z.number().min(0.0).max(1.0),
  /** Frustration tolerance (0-1, higher = more tolerant) */
  frustrationTolerance: z.number().min(0.0).max(1.0),
  /** Help-seeking behavior timing */
  helpSeekingDelay: z.number().int().min(0).max(1800), // seconds before asking for help
  /** Persistence vs. giving up tendency */
  persistenceLevel: z.number().min(0.0).max(1.0),
  /** Cognitive load capacity */
  cognitiveLoadCapacity: z.number().min(0.3).max(2.0),
  /** Anxiety sensitivity to failure */
  anxietySensitivity: z.number().min(0.0).max(1.0),
  /** Metacognitive awareness (knowing when confused) */
  metacognitiveAwareness: z.number().min(0.0).max(1.0),
  /** Error recognition speed */
  errorRecognitionSpeed: z.enum(['immediate', 'delayed', 'poor']),
  /** Imposter syndrome tendency */
  imposterSyndromeTendency: z.number().min(0.0).max(1.0),
});

export type StrugglePatternIndicators = z.infer<typeof StrugglePatternIndicatorsSchema>;

/**
 * Schema for student persona types
 */
export const StudentPersonaSchema = z.enum([
  'fast_learner',
  'struggling_student',
  'visual_learner',
  'auditory_learner',
  'kinesthetic_learner',
  'perfectionist',
  'procrastinator',
  'collaborative_learner',
  'independent_learner',
  'anxious_student',
  'confident_student',
  'deep_thinker',
  'surface_learner',
  'math_phobic',
  'high_achiever',
  'at_risk_student',
  'gifted_underachiever',
  'english_language_learner',
  'returning_adult_learner',
  'neurodivergent_learner',
]);

export type StudentPersona = z.infer<typeof StudentPersonaSchema>;

/**
 * Schema for comprehensive cognitive profile
 */
export const CognitiveProfileSchema = z.object({
  /** Unique identifier for the synthetic student */
  studentId: z.string().uuid(),
  /** Student persona type */
  persona: StudentPersonaSchema,
  /** Learning velocity patterns */
  learningVelocity: LearningVelocityPatternSchema,
  /** Memory retention characteristics */
  memoryRetention: MemoryRetentionCurveSchema,
  /** Interaction timing patterns */
  interactionTiming: InteractionTimingPatternSchema,
  /** Comprehension style preferences */
  comprehensionStyle: ComprehensionStyleSchema,
  /** Struggle pattern indicators */
  strugglePatterns: StrugglePatternIndicatorsSchema,
  /** Demographic factors (for k-anonymity testing) */
  demographics: z.object({
    ageGroup: z.enum(['18-22', '23-30', '31-40', '41-50', '50+']),
    academicLevel: z.enum(['high_school', 'undergraduate', 'graduate', 'professional']),
    priorKnowledge: z.enum(['novice', 'intermediate', 'advanced']),
    mathBackground: z.enum(['weak', 'moderate', 'strong']),
    nativeLanguage: z.enum(['english', 'spanish', 'other']),
    learningDisabilities: z.array(z.enum(['dyslexia', 'adhd', 'dyscalculia', 'autism', 'none'])),
    socioeconomicBackground: z.enum(['low', 'middle', 'high']),
  }),
  /** Temporal consistency markers */
  temporalMarkers: z.object({
    createdAt: z.date(),
    lastActive: z.date(),
    totalStudyHours: z.number().min(0),
    sessionsCompleted: z.number().int().min(0),
  }),
});

export type CognitiveProfile = z.infer<typeof CognitiveProfileSchema>;

/**
 * Schema for learning session data
 */
export const LearningSessi‌onDataSchema = z.object({
  sessionId: z.string().uuid(),
  studentId: z.string().uuid(),
  /** Session timing */
  startTime: z.date(),
  endTime: z.date(),
  duration: z.number().int().min(60), // seconds
  /** Content engagement */
  conceptsStudied: z.array(z.string()),
  questionsAnswered: z.number().int().min(0),
  correctAnswers: z.number().int().min(0),
  /** Behavioral patterns */
  responseTimesMs: z.array(z.number().int().min(100)),
  helpRequestCount: z.number().int().min(0),
  breaksCount: z.number().int().min(0),
  /** Cognitive indicators */
  confusionEvents: z.array(
    z.object({
      timestamp: z.date(),
      conceptId: z.string(),
      severity: z.enum(['low', 'medium', 'high']),
      resolved: z.boolean(),
    })
  ),
  engagementScore: z.number().min(0.0).max(1.0),
  cognitiveLoadIndicator: z.number().min(0.0).max(2.0),
  /** Learning outcomes */
  masteryGained: z.number().min(0.0).max(1.0),
  retentionExpected: z.number().min(0.0).max(1.0),
});

export type LearningSessionData = z.infer<typeof LearningSessi‌onDataSchema>;

/**
 * Schema for privacy attack testing data
 */
export const PrivacyAttackDataSchema = z.object({
  attackType: z.enum(['linkage_attack', 'membership_inference', 'attribute_inference', 'reconstruction_attack', 'differential_attack']),
  targetStudentId: z.string().uuid(),
  auxiliaryData: z.record(z.unknown()),
  attackSuccess: z.boolean(),
  confidenceScore: z.number().min(0.0).max(1.0),
  methodUsed: z.string(),
  defensesDefeated: z.array(z.string()),
  dataPointsUsed: z.number().int().min(1),
});

export type PrivacyAttackData = z.infer<typeof PrivacyAttackDataSchema>;

/**
 * Schema for synthetic data generation parameters
 */
export const SyntheticDataGenerationParamsSchema = z.object({
  /** Number of synthetic students to generate */
  studentCount: z.number().int().min(1).max(10000),
  /** Distribution of student personas */
  personaDistribution: z.record(StudentPersonaSchema, z.number().min(0).max(1)).optional(),
  /** Time range for synthetic data */
  timeRange: z.object({
    startDate: z.date(),
    endDate: z.date(),
  }),
  /** Privacy parameters */
  privacyParams: z.object({
    epsilonBudget: z.number().min(0.01).max(10.0),
    deltaPrivacy: z.number().min(0.0).max(1.0),
    kAnonymity: z.number().int().min(2).max(100),
  }),
  /** Data quality parameters */
  qualityParams: z.object({
    noiseLevelStd: z.number().min(0.0).max(0.5),
    missingDataRate: z.number().min(0.0).max(0.2),
    outlierRate: z.number().min(0.0).max(0.05),
  }),
  /** Behavioral realism constraints */
  realismConstraints: z.object({
    enforcePsychologicalConsistency: z.boolean().default(true),
    applyEducationalResearchPatterns: z.boolean().default(true),
    includeIndividualVariability: z.boolean().default(true),
    generateTemporalCorrelations: z.boolean().default(true),
  }),
});

export type SyntheticDataGenerationParams = z.infer<typeof SyntheticDataGenerationParamsSchema>;

/**
 * Validation schema for generated data quality
 */
export const DataQualityMetricsSchema = z.object({
  /** Statistical validity */
  statisticalMetrics: z.object({
    meanSquareError: z.number().min(0),
    correlationAccuracy: z.number().min(0).max(1),
    distributionKLDivergence: z.number().min(0),
  }),
  /** Educational psychology compliance */
  psychologyCompliance: z.object({
    ebbinghausCorrelation: z.number().min(0).max(1),
    learningCurveRealism: z.number().min(0).max(1),
    struggePpatternValidity: z.number().min(0).max(1),
  }),
  /** Privacy protection effectiveness */
  privacyMetrics: z.object({
    reidentificationRisk: z.number().min(0).max(1),
    attributeInferenceAccuracy: z.number().min(0).max(1),
    linkageAttackSuccess: z.number().min(0).max(1),
  }),
  /** Data utility preservation */
  utilityMetrics: z.object({
    queryAccuracy: z.number().min(0).max(1),
    statisticalUtility: z.number().min(0).max(1),
    machineLearningUtility: z.number().min(0).max(1),
  }),
});

export type DataQualityMetrics = z.infer<typeof DataQualityMetricsSchema>;

/**
 * Schema for MCP client registration
 */
export const mcpClientRegistrySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string(),

  // Client identification
  clientName: z.string().min(1).max(100),
  clientType: z.enum(['ai_assistant', 'analytics_tool', 'research_platform', 'tutoring_system']),
  clientDescription: z.string().min(1).max(500),
  clientVersion: z.string().default('1.0'),

  // Authentication and authorization
  clientSecretHash: z.string(),
  apiKeyPrefix: z.string(),
  authorizedScopes: z.array(z.string()).default([]),
  rateLimitPerMinute: z.number().int().min(1).max(1000).default(60),

  // Privacy and compliance
  privacyPolicyUrl: z.string().url().optional(),
  dataRetentionDays: z.number().int().min(0).default(0),
  anonymizationRequired: z.boolean().default(true),
  auditLoggingEnabled: z.boolean().default(true),

  // Client metadata
  contactEmail: z.string().email(),
  organization: z.string().optional(),
  certificationLevel: z.enum(['basic', 'enterprise', 'research']).optional(),

  // Status and temporal tracking
  status: z.enum(['pending', 'approved', 'suspended', 'revoked']).default('pending'),
  approvedBy: z.string().optional(),
  approvedAt: z.date().optional(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
  lastAccessAt: z.date().optional(),
});

/**
 * Schema for MCP data scopes
 */
export const mcpDataScopeSchema = z.object({
  id: z.string().uuid(),
  scopeName: z.string().min(1),
  scopeCategory: z.enum(['profile', 'behavioral', 'assessment', 'real_time', 'aggregated']),

  // Scope details
  description: z.string().min(1),
  dataSensitivityLevel: z.enum(['low', 'medium', 'high', 'critical']),
  requiresExplicitConsent: z.boolean().default(true),

  // Privacy implications
  privacyImpactScore: z.number().min(0).max(1),
  gdprArticleApplicable: z.string().optional(),
  coppaParentalConsentRequired: z.boolean().default(false),

  // Data access patterns
  dataTablesAccessed: z.array(z.string()),
  anonymizationPossible: z.boolean().default(true),
  realTimeAccessAllowed: z.boolean().default(false),

  // Compliance and audit
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
  complianceReviewDue: z.date().optional(),
});

/**
 * Schema for MCP active sessions
 */
export const mcpActiveSessionSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string(),
  userId: z.string(),
  clientId: z.string().uuid(),

  // Session details
  sessionToken: z.string(),
  grantedScopes: z.array(z.string()).default([]),
  sessionType: z.enum(['api_access', 'real_time_stream', 'batch_analysis']),

  // Access patterns
  dataAccessedCount: z.number().int().min(0).default(0),
  lastDataAccessAt: z.date().optional(),
  rateLimitExceededCount: z.number().int().min(0).default(0),

  // Privacy and security
  consentVersion: z.string(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  encryptionLevel: z.string().default('AES-256'),

  // Session lifecycle
  startedAt: z.date().default(() => new Date()),
  lastHeartbeatAt: z.date().default(() => new Date()),
  expiresAt: z.date(),
  revokedAt: z.date().optional(),
  revocationReason: z.string().optional(),

  // Compliance tracking
  auditEventsCount: z.number().int().min(0).default(0),
  privacyViolationsCount: z.number().int().min(0).default(0),
});

/**
 * Schema for MCP consent revocation queue
 */
export const mcpConsentRevocationQueueSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string(),
  userId: z.string(),

  // Revocation details
  revocationType: z.enum(['full_withdrawal', 'scope_specific', 'client_specific', 'emergency_stop']),
  affectedScopes: z.array(z.string()).default([]),
  affectedClients: z.array(z.string()).default([]),

  // Processing status
  status: z.enum(['pending', 'processing', 'completed', 'failed']).default('pending'),
  priorityLevel: z.number().int().min(1).max(10).default(5),

  // Revocation metadata
  requestedAt: z.date().default(() => new Date()),
  processedAt: z.date().optional(),
  completedAt: z.date().optional(),
  processingDurationMs: z.number().int().optional(),

  // Audit and compliance
  revocationReason: z.string().optional(),
  initiatedBy: z.enum(['user', 'parent', 'admin', 'system', 'compliance']),
  complianceFramework: z.enum(['COPPA', 'GDPR', 'FERPA']).optional(),

  // Results tracking
  sessionsRevokedCount: z.number().int().min(0).default(0),
  dataPurgedTables: z.array(z.string()).default([]),
  notificationSent: z.boolean().default(false),
});

/**
 * Schema for MCP parental controls
 */
export const mcpParentalControlsSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string(),
  userId: z.string(),
  parentEmail: z.string().email(),

  // Control settings
  externalAiAccessAllowed: z.boolean().default(false),
  allowedClientTypes: z.array(z.enum(['ai_assistant', 'analytics_tool', 'research_platform', 'tutoring_system'])).default([]),
  maxSessionDurationMinutes: z.number().int().min(1).max(480).default(30),
  allowedTimeWindows: z.array(z.object({
    start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    days: z.array(z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']))
  })).default([]),

  // Notification preferences
  notifyOnAccessRequest: z.boolean().default(true),
  notifyOnDataSharing: z.boolean().default(true),
  notifyOnPrivacyChanges: z.boolean().default(true),
  notificationFrequency: z.enum(['immediate', 'daily', 'weekly']).default('immediate'),

  // Override capabilities
  emergencyContactPhone: z.string().optional(),
  canOverrideAiAccess: z.boolean().default(true),
  canViewChildData: z.boolean().default(true),
  canExportChildData: z.boolean().default(true),

  // Compliance tracking
  coppaVerificationMethod: z.enum(['email', 'phone', 'postal', 'credit_card']),
  verificationCompletedAt: z.date(),
  verificationDocumentId: z.string().optional(),

  // Temporal tracking
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
  lastNotificationSentAt: z.date().optional(),
  nextReviewDue: z.date().optional(),
});

/**
 * Schema for Learner DNA privacy consent
 */
export const learnerDnaPrivacyConsentSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string(),
  userId: z.string(),
  consentVersion: z.string().default('1.0'),

  // Granular consent permissions
  behavioralTimingConsent: z.boolean().default(false),
  assessmentPatternsConsent: z.boolean().default(false),
  chatInteractionsConsent: z.boolean().default(false),
  crossCourseCorrelationConsent: z.boolean().default(false),
  anonymizedAnalyticsConsent: z.boolean().default(true),

  // MCP-specific external AI access consent
  externalAiAccessConsent: z.boolean().default(false),
  mcpClientScopes: z.array(z.string()).default([]),
  realTimeRevocationEnabled: z.boolean().default(true),
  externalClientRestrictions: z.record(z.any()).default({}),

  // Data collection level
  dataCollectionLevel: z.enum(['minimal', 'standard', 'comprehensive']).default('minimal'),

  // COPPA compliance for minors
  parentalConsentRequired: z.boolean().default(false),
  parentalConsentGiven: z.boolean().default(false),
  parentalEmail: z.string().email().optional(),

  // Timestamps and metadata
  consentGivenAt: z.date().default(() => new Date()),
  consentUpdatedAt: z.date().default(() => new Date()),
  withdrawalRequestedAt: z.date().optional(),
  withdrawalReason: z.string().optional(),

  // Audit information
  consentSource: z.enum(['dashboard', 'onboarding', 'policy_update', 'api', 'test']).default('dashboard'),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

/**
 * Schema for privacy consent updates
 */
export const privacyConsentUpdateSchema = z.object({
  behavioralTimingConsent: z.boolean().optional(),
  assessmentPatternsConsent: z.boolean().optional(),
  chatInteractionsConsent: z.boolean().optional(),
  crossCourseCorrelationConsent: z.boolean().optional(),
  anonymizedAnalyticsConsent: z.boolean().optional(),

  // MCP-specific consent updates
  externalAiAccessConsent: z.boolean().optional(),
  mcpClientScopes: z.array(z.string()).optional(),
  realTimeRevocationEnabled: z.boolean().optional(),
  externalClientRestrictions: z.record(z.any()).optional(),

  dataCollectionLevel: z.enum(['minimal', 'standard', 'comprehensive']).optional(),
  parentalConsentRequired: z.boolean().optional(),
  parentalConsentGiven: z.boolean().optional(),
  parentalEmail: z.string().email().optional(),
  consentSource: z.enum(['dashboard', 'onboarding', 'policy_update', 'api', 'test']).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

/**
 * Schema for behavioral pattern data
 */
export const behavioralPatternSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string(),
  userId: z.string(),
  sessionId: z.string(),

  // Pattern classification
  patternType: z.enum([
    'interaction_timing',
    'learning_velocity',
    'memory_retention',
    'comprehension_style',
    'struggle_indicators',
    'content_preferences',
  ]),
  contextType: z.enum(['chat', 'assessment', 'content_review', 'navigation']),

  // Data storage
  rawDataEncrypted: z.string(),
  rawDataHash: z.string(),
  aggregatedMetrics: z.record(z.any()).default({}),
  confidenceLevel: z.number().min(0).max(1).default(0),

  // Context and timing
  courseId: z.string().optional(),
  contentId: z.string().optional(),
  collectedAt: z.date().default(() => new Date()),
  anonymizedAt: z.date().optional(),
  purgeAt: z.date().optional(),

  // Privacy compliance
  privacyLevel: z.enum(['identifiable', 'pseudonymized', 'anonymized']).default('identifiable'),
  consentVerified: z.boolean().default(false),
});

/**
 * Schema for comprehensive Learner DNA Profile
 */
export const learnerDnaProfileSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string(),
  userId: z.string(),

  // Core cognitive attributes with confidence scoring
  learningVelocityValue: z.number().min(0).max(10),
  learningVelocityConfidence: z.number().min(0).max(1),
  learningVelocityDataPoints: z.number().int().min(0),
  learningVelocityLastUpdated: z.date(),

  memoryRetentionValue: z.number().min(0).max(1),
  memoryRetentionConfidence: z.number().min(0).max(1),
  memoryRetentionDataPoints: z.number().int().min(0),
  memoryRetentionLastUpdated: z.date(),

  struggleThresholdValue: z.number().min(0).max(1),
  struggleThresholdConfidence: z.number().min(0).max(1),
  struggleThresholdDataPoints: z.number().int().min(0),
  struggleThresholdLastUpdated: z.date(),

  // Complex attributes as JSON
  cognitiveAttributes: z.record(z.any()).default({}),
  comprehensionStyles: z.array(z.string()).default([]),
  preferredModalities: z.array(z.string()).default([]),

  // Profile quality
  profileConfidence: z.number().min(0).max(1).default(0),
  totalDataPoints: z.number().int().min(0).default(0),
  analysisQualityScore: z.number().min(0).max(1).default(0),

  // Cross-course intelligence
  crossCoursePatterns: z.record(z.any()).default({}),
  multiContextConfidence: z.number().min(0).max(1).default(0),

  // Privacy and visibility
  dataCollectionLevel: z.enum(['minimal', 'standard', 'comprehensive']).default('minimal'),
  profileVisibility: z.enum(['private', 'course_aggregate', 'anonymized']).default('private'),

  // Timestamps
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
  lastAnalyzedAt: z.date().default(() => new Date()),
});

/**
 * Schema for cognitive attribute with metadata
 */
export const cognitiveAttributeSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string(),
  userId: z.string(),
  profileId: z.string().uuid(),
  
  attribute: z.string().min(1),
  value: z.union([z.number(), z.string()]),
  confidence: z.number().min(0).max(1),
  dataPoints: z.number().int().min(0),
  lastUpdated: z.date().default(() => new Date()),
  evidenceSource: z.enum(['assessment', 'chat', 'timing', 'behavior', 'manual']),
  
  // Context information
  courseId: z.string().optional(),
  sessionId: z.string().optional(),
  contextData: z.record(z.any()).default({}),
  
  // Quality metrics
  validationScore: z.number().min(0).max(1).default(0),
  stabilityScore: z.number().min(0).max(1).default(0),
  
  // Timestamps
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

/**
 * Export all schemas for easy import
 */
export const LearnerDNASchemas = {
  LearningVelocityPattern: LearningVelocityPatternSchema,
  MemoryRetentionCurve: MemoryRetentionCurveSchema,
  InteractionTimingPattern: InteractionTimingPatternSchema,
  ComprehensionStyle: ComprehensionStyleSchema,
  StrugglePatternIndicators: StrugglePatternIndicatorsSchema,
  StudentPersona: StudentPersonaSchema,
  CognitiveProfile: CognitiveProfileSchema,
  LearningSessionData: LearningSessi‌onDataSchema,
  PrivacyAttackData: PrivacyAttackDataSchema,
  SyntheticDataGenerationParams: SyntheticDataGenerationParamsSchema,
  DataQualityMetrics: DataQualityMetricsSchema,
  LearnerDNAPrivacyConsent: learnerDnaPrivacyConsentSchema,
  PrivacyConsentUpdate: privacyConsentUpdateSchema,
  BehavioralPattern: behavioralPatternSchema,
  LearnerDNAProfile: learnerDnaProfileSchema,
  CognitiveAttribute: cognitiveAttributeSchema,

  // MCP-specific schemas
  McpClientRegistry: mcpClientRegistrySchema,
  McpDataScope: mcpDataScopeSchema,
  McpActiveSession: mcpActiveSessionSchema,
  McpConsentRevocationQueue: mcpConsentRevocationQueueSchema,
  McpParentalControls: mcpParentalControlsSchema,
} as const;
