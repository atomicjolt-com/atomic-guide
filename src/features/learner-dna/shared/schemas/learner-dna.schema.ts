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
export const ComprehensionStyleSchema = z.object({
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
}).refine((data) => {
  // Ensure VARK preferences sum to approximately 1.0 (±0.2 tolerance)
  const total = data.visual + data.auditory + data.kinesthetic + data.readingWriting;
  return total >= 0.8 && total <= 1.2;
}, {
  message: 'VARK learning preferences must sum to approximately 1.0',
});

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
  'neurodivergent_learner'
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
  confusionEvents: z.array(z.object({
    timestamp: z.date(),
    conceptId: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
    resolved: z.boolean(),
  })),
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
  attackType: z.enum([
    'linkage_attack',
    'membership_inference',
    'attribute_inference',
    'reconstruction_attack',
    'differential_attack'
  ]),
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
  userAgent: z.string().optional()
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
  dataCollectionLevel: z.enum(['minimal', 'standard', 'comprehensive']).optional(),
  parentalConsentRequired: z.boolean().optional(),
  parentalConsentGiven: z.boolean().optional(),
  parentalEmail: z.string().email().optional(),
  consentSource: z.enum(['dashboard', 'onboarding', 'policy_update', 'api', 'test']).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional()
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
  patternType: z.enum(['interaction_timing', 'learning_velocity', 'memory_retention', 'comprehension_style', 'struggle_indicators', 'content_preferences']),
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
  consentVerified: z.boolean().default(false)
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
} as const;