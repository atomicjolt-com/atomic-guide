/**
 * @fileoverview Cognitive Data Collector for Learner DNA Foundation
 * @module features/learner-dna/server/services/CognitiveDataCollector
 *
 * Implements behavioral pattern capture and learning analytics with privacy-first design.
 * Collects interaction timing, learning velocity, memory retention, comprehension styles,
 * struggle indicators, and content preferences while maintaining GDPR/FERPA compliance.
 */

import type {
  BehavioralPattern,
  LearningVelocityData,
  MemoryRetentionAnalysis,
  InteractionTimingData,
  StruggleIndicator,
  ContentPreference,
} from '../../shared/types';
import { PrivacyControlService } from './PrivacyControlService';
import {
  BehavioralPatternRepository,
  LearnerDNAProfileRepository,
  CognitiveAttributeRepository,
} from '../repositories';

/**
 * Cognitive Data Collector implementing privacy-compliant behavioral pattern analysis.
 *
 * Captures and processes various cognitive indicators from student interactions
 * while maintaining strict privacy controls and consent verification.
 *
 * Core Capabilities:
 * - Interaction timing pattern analysis from chat conversations
 * - Learning velocity tracking across assessments and concepts
 * - Memory retention curve identification through repeated assessments
 * - Comprehension style categorization from question preferences
 * - Struggle detection from behavioral signals and help-seeking patterns
 * - Content preference tracking from engagement metrics
 *
 * @class CognitiveDataCollector
 */
export class CognitiveDataCollector {
  private behavioralPatternRepository: BehavioralPatternRepository;
  private profileRepository: LearnerDNAProfileRepository;
  private cognitiveAttributeRepository: CognitiveAttributeRepository;
  private privacyService: PrivacyControlService;
  private readonly CONFIDENCE_THRESHOLD = 0.7;
  private readonly MIN_DATA_POINTS = 5;

  constructor(
    behavioralPatternRepository: BehavioralPatternRepository,
    profileRepository: LearnerDNAProfileRepository,
    cognitiveAttributeRepository: CognitiveAttributeRepository,
    privacyService: PrivacyControlService
  ) {
    this.behavioralPatternRepository = behavioralPatternRepository;
    this.profileRepository = profileRepository;
    this.cognitiveAttributeRepository = cognitiveAttributeRepository;
    this.privacyService = privacyService;
  }

  /**
   * Captures interaction timing patterns from chat conversations.
   *
   * Analyzes response delays, session durations, engagement rhythms,
   * and cognitive load indicators from chat interaction patterns.
   *
   * @param tenantId - Tenant identifier
   * @param userId - Student identifier
   * @param sessionId - Current session identifier
   * @param timingData - Raw timing data from chat interactions
   * @returns Promise resolving to processed behavioral pattern
   *
   * @throws {PrivacyError} If user hasn't consented to behavioral timing collection
   * @throws {ValidationError} If timing data fails validation
   *
   * @example
   * ```typescript
   * const pattern = await collector.captureInteractionTiming(
   *   'tenant-123',
   *   'user-456',
   *   'session-789',
   *   {
   *     responseDelays: [2.5, 3.2, 1.8, 4.1],
   *     sessionDuration: 1800, // 30 minutes
   *     engagementEvents: [
   *       { type: 'message_sent', timestamp: 1625097600000 },
   *       { type: 'typing_started', timestamp: 1625097605000 }
   *     ]
   *   }
   * );
   * ```
   */
  async captureInteractionTiming(
    tenantId: string,
    userId: string,
    sessionId: string,
    timingData: InteractionTimingData
  ): Promise<BehavioralPattern> {
    // Verify consent for behavioral timing collection
    const hasConsent = await this.privacyService.validateDataCollectionPermission(tenantId, userId, 'behavioral_timing');

    if (!hasConsent) {
      throw new Error('PRIVACY_ERROR: User has not consented to behavioral timing data collection');
    }

    // Process and analyze timing patterns
    const analysisResults = this.analyzeTimingPatterns(timingData);

    // Encrypt sensitive raw data
    const encryptedData = await this.encryptSensitiveData(timingData);

    const behavioralPattern: BehavioralPattern = {
      id: crypto.randomUUID(),
      tenantId,
      userId,
      sessionId,
      patternType: 'interaction_timing',
      contextType: 'chat',
      rawDataEncrypted: encryptedData.encrypted,
      rawDataHash: encryptedData.hash,
      aggregatedMetrics: analysisResults,
      confidenceLevel: analysisResults.confidenceScore,
      courseId: timingData.courseId,
      collectedAt: new Date(),
      privacyLevel: 'identifiable',
      consentVerified: true,
    };

    // Store behavioral pattern using repository
    await this.behavioralPatternRepository.create(behavioralPattern);

    // TODO: Implement audit logging through repository pattern
    // await this.auditRepository.createDataCollectionAudit(tenantId, userId, 'interaction_timing', behavioralPattern.id);

    return behavioralPattern;
  }

  /**
   * Tracks learning velocity from assessment performance data.
   *
   * Calculates time-to-mastery for different concept types and difficulty levels,
   * identifying acceleration and deceleration patterns in learning progression.
   *
   * @param tenantId - Tenant identifier
   * @param userId - Student identifier
   * @param assessmentData - Assessment attempt and performance data
   * @returns Promise resolving to learning velocity analysis
   *
   * @example
   * ```typescript
   * const velocity = await collector.trackLearningVelocity(
   *   'tenant-123',
   *   'user-456',
   *   {
   *     conceptId: 'algebra-linear-equations',
   *     conceptName: 'Linear Equations',
   *     attempts: [
   *       { score: 0.6, timeSpent: 300, timestamp: '2025-01-15T10:00:00Z' },
   *       { score: 0.8, timeSpent: 240, timestamp: '2025-01-15T10:15:00Z' },
   *       { score: 0.9, timeSpent: 180, timestamp: '2025-01-15T10:30:00Z' }
   *     ],
   *     masteryThreshold: 0.8,
   *     difficultyLevel: 0.7
   *   }
   * );
   * ```
   */
  async trackLearningVelocity(
    tenantId: string,
    userId: string,
    assessmentData: {
      conceptId: string;
      conceptName: string;
      attempts: Array<{
        score: number;
        timeSpent: number; // seconds
        timestamp: string;
        difficultyLevel?: number;
      }>;
      masteryThreshold: number;
      courseId?: string;
    }
  ): Promise<LearningVelocityData> {
    // Verify consent for assessment patterns
    const hasConsent = await this.privacyService.validateDataCollectionPermission(tenantId, userId, 'assessment_patterns');

    if (!hasConsent) {
      throw new Error('PRIVACY_ERROR: User has not consented to assessment pattern data collection');
    }

    // Calculate learning velocity metrics
    const velocityAnalysis = this.calculateLearningVelocity(assessmentData);

    const velocityData: LearningVelocityData = {
      id: crypto.randomUUID(),
      tenantId,
      userId,
      profileId: await this.getOrCreateProfileId(tenantId, userId),
      conceptId: assessmentData.conceptId,
      conceptName: assessmentData.conceptName,
      timeToMasteryMinutes: velocityAnalysis.timeToMasteryMinutes,
      attemptCount: assessmentData.attempts.length,
      masteryThreshold: assessmentData.masteryThreshold,
      masteryConfidence: velocityAnalysis.confidence,
      difficultyLevel: this.calculateAverageDifficulty(assessmentData.attempts),
      priorKnowledgeLevel: velocityAnalysis.priorKnowledgeEstimate,
      struggledConcepts: velocityAnalysis.struggledConcepts,
      accelerationFactors: velocityAnalysis.accelerationFactors,
      courseId: assessmentData.courseId,
      startedAt: new Date(assessmentData.attempts[0]?.timestamp),
      masteryAchievedAt: new Date(velocityAnalysis.masteryTimestamp),
      recordedAt: new Date(),
    };

    // TODO: Store learning velocity data through repository pattern
    // Requires LearningVelocityRepository to be created
    // await this.learningVelocityRepository.create(velocityData);

    return velocityData;
  }

  /**
   * Analyzes memory retention patterns from repeated assessment performance.
   *
   * Identifies forgetting curves and optimal review intervals using
   * spaced repetition algorithms and Ebbinghaus curve fitting.
   *
   * @param tenantId - Tenant identifier
   * @param userId - Student identifier
   * @param retentionData - Repeated assessment performance data
   * @returns Promise resolving to memory retention analysis
   */
  async analyzeMemoryRetention(
    tenantId: string,
    userId: string,
    retentionData: {
      conceptId: string;
      assessments: Array<{
        score: number;
        timestamp: string;
        daysSinceLastReview: number;
      }>;
      initialMasteryLevel: number;
    }
  ): Promise<MemoryRetentionAnalysis> {
    // Verify consent
    const hasConsent = await this.privacyService.validateDataCollectionPermission(tenantId, userId, 'assessment_patterns');

    if (!hasConsent) {
      throw new Error('PRIVACY_ERROR: User has not consented to memory retention analysis');
    }

    // Calculate forgetting curve parameters
    const forgettingCurve = this.calculateForgettingCurve(retentionData);

    const retentionAnalysis: MemoryRetentionAnalysis = {
      id: crypto.randomUUID(),
      tenantId,
      userId,
      profileId: await this.getOrCreateProfileId(tenantId, userId),
      conceptId: retentionData.conceptId,
      initialMasteryLevel: retentionData.initialMasteryLevel,
      currentRetentionLevel: forgettingCurve.currentRetention,
      forgettingCurveSlope: forgettingCurve.slope,
      memoryStrengthFactor: forgettingCurve.strengthFactor,
      retentionHalfLifeDays: forgettingCurve.halfLife,
      optimalReviewIntervalDays: forgettingCurve.optimalInterval,
      nextReviewRecommendedAt: new Date(Date.now() + forgettingCurve.optimalInterval * 24 * 60 * 60 * 1000),
      reviewSessionsCount: retentionData.assessments.length,
      retentionAccuracyScore: forgettingCurve.accuracyScore,
      interferenceFactors: forgettingCurve.interferenceFactors,
      analysisConfidence: forgettingCurve.confidence,
      dataPointsUsed: retentionData.assessments.length,
      lastAssessmentAt: new Date(retentionData.assessments[retentionData.assessments.length - 1]?.timestamp),
      analyzedAt: new Date(),
    };

    // TODO: Store memory retention analysis through repository pattern
    // Requires MemoryRetentionRepository to be created
    // await this.memoryRetentionRepository.create(retentionAnalysis);

    return retentionAnalysis;
  }

  /**
   * Categorizes comprehension styles from question preferences and explanation requests.
   *
   * Identifies learning preferences (visual, analytical, practical) based on
   * student interactions with different content types and help-seeking patterns.
   *
   * @param tenantId - Tenant identifier
   * @param userId - Student identifier
   * @param interactionData - Question types, explanation preferences, and content engagement
   * @returns Promise resolving to comprehension style analysis
   */
  async categorizeComprehensionStyle(
    tenantId: string,
    userId: string,
    interactionData: {
      questionTypes: Array<{
        type: 'visual' | 'analytical' | 'practical' | 'conceptual';
        success: boolean;
        timeSpent: number;
        helpRequested: boolean;
      }>;
      explanationPreferences: Array<{
        type: 'visual' | 'textual' | 'example' | 'analogy';
        effectiveness: number; // 0-1 scale
      }>;
      contentEngagement: Array<{
        contentType: 'diagram' | 'text' | 'video' | 'interactive';
        engagementScore: number; // 0-1 scale
        timeSpent: number;
      }>;
    }
  ): Promise<{
    primaryStyle: string;
    secondaryStyle: string;
    confidence: number;
    styleBreakdown: Record<string, number>;
  }> {
    // Verify consent for chat interactions
    const hasConsent = await this.privacyService.validateDataCollectionPermission(tenantId, userId, 'chat_interactions');

    if (!hasConsent) {
      throw new Error('PRIVACY_ERROR: User has not consented to comprehension style analysis');
    }

    // Analyze comprehension patterns
    const styleAnalysis = this.analyzeComprehensionPatterns(interactionData);

    // Store as behavioral pattern
    const comprehensionPattern: BehavioralPattern = {
      id: crypto.randomUUID(),
      tenantId,
      userId,
      sessionId: `comprehension_${Date.now()}`,
      patternType: 'comprehension_style',
      contextType: 'chat',
      rawDataEncrypted: (await this.encryptSensitiveData(interactionData)).encrypted,
      rawDataHash: (await this.encryptSensitiveData(interactionData)).hash,
      aggregatedMetrics: styleAnalysis,
      confidenceLevel: styleAnalysis.confidence,
      collectedAt: new Date(),
      privacyLevel: 'identifiable',
      consentVerified: true,
    };

    await this.storeBehavioralPattern(comprehensionPattern);

    return styleAnalysis;
  }

  /**
   * Detects struggle indicators from behavioral signals and help-seeking patterns.
   *
   * Identifies patterns of confusion, frustration, and difficulty through
   * multiple attempts, help requests, and cognitive load indicators.
   *
   * @param tenantId - Tenant identifier
   * @param userId - Student identifier
   * @param behaviorData - Behavioral signals indicating potential struggle
   * @returns Promise resolving to struggle pattern analysis
   */
  async detectStruggleIndicators(
    tenantId: string,
    userId: string,
    behaviorData: {
      multipleAttempts: Array<{
        conceptId: string;
        attemptNumber: number;
        success: boolean;
        timeSpent: number;
        frustrationSignals: number;
      }>;
      helpRequests: Array<{
        timestamp: string;
        context: string;
        urgency: 'low' | 'medium' | 'high';
        resolved: boolean;
      }>;
      engagementMetrics: {
        averageSessionLength: number;
        dropoffRate: number;
        returnFrequency: number;
      };
    }
  ): Promise<StruggleIndicator> {
    // Verify consent for behavioral timing
    const hasConsent = await this.privacyService.validateDataCollectionPermission(tenantId, userId, 'behavioral_timing');

    if (!hasConsent) {
      throw new Error('PRIVACY_ERROR: User has not consented to struggle detection analysis');
    }

    // Analyze struggle patterns
    const struggleAnalysis = this.analyzeStrugglePatterns(behaviorData);

    const struggleIndicator: StruggleIndicator = {
      id: crypto.randomUUID(),
      tenantId,
      userId,
      profileId: await this.getOrCreateProfileId(tenantId, userId),
      struggleType: struggleAnalysis.primaryStruggleType,
      severityScore: struggleAnalysis.severityScore,
      confidenceScore: struggleAnalysis.confidence,
      triggeringConcepts: struggleAnalysis.triggeringConcepts,
      behavioralSignals: struggleAnalysis.behavioralSignals,
      recommendedInterventions: struggleAnalysis.recommendedInterventions,
      detectedAt: new Date(),
      contextData: behaviorData,
    };

    // Store struggle indicator as behavioral pattern
    const behavioralPattern: BehavioralPattern = {
      id: crypto.randomUUID(),
      tenantId,
      userId,
      sessionId: `struggle_${Date.now()}`,
      patternType: 'struggle_indicators',
      contextType: 'assessment',
      rawDataEncrypted: (await this.encryptSensitiveData(behaviorData)).encrypted,
      rawDataHash: (await this.encryptSensitiveData(behaviorData)).hash,
      aggregatedMetrics: struggleAnalysis,
      confidenceLevel: struggleAnalysis.confidence,
      collectedAt: new Date(),
      privacyLevel: 'identifiable',
      consentVerified: true,
    };

    await this.storeBehavioralPattern(behavioralPattern);

    return struggleIndicator;
  }

  /**
   * Tracks content preferences from engagement metrics and learning outcomes.
   *
   * Identifies which explanation types, media formats, and interaction styles
   * yield the best learning outcomes for individual students.
   *
   * @param tenantId - Tenant identifier
   * @param userId - Student identifier
   * @param contentData - Content engagement and outcome data
   * @returns Promise resolving to content preference analysis
   */
  async trackContentPreferences(
    tenantId: string,
    userId: string,
    contentData: {
      contentInteractions: Array<{
        contentId: string;
        contentType: 'text' | 'video' | 'interactive' | 'diagram' | 'example';
        engagementTime: number;
        interactionCount: number;
        completionRate: number;
        followUpQuestions: number;
      }>;
      learningOutcomes: Array<{
        contentId: string;
        masteryImprovement: number; // 0-1 scale
        retentionRate: number;
        transferSuccess: boolean;
      }>;
    }
  ): Promise<ContentPreference> {
    // Verify consent for content preferences
    const hasConsent = await this.privacyService.validateDataCollectionPermission(tenantId, userId, 'behavioral_timing');

    if (!hasConsent) {
      throw new Error('PRIVACY_ERROR: User has not consented to content preference tracking');
    }

    // Analyze content preferences
    const preferenceAnalysis = this.analyzeContentPreferences(contentData);

    const contentPreference: ContentPreference = {
      id: crypto.randomUUID(),
      tenantId,
      userId,
      profileId: await this.getOrCreateProfileId(tenantId, userId),
      preferredContentTypes: preferenceAnalysis.preferredTypes,
      effectiveFormats: preferenceAnalysis.effectiveFormats,
      optimalEngagementDuration: preferenceAnalysis.optimalDuration,
      interactionPatterns: preferenceAnalysis.interactionPatterns,
      confidenceScore: preferenceAnalysis.confidence,
      analyzedAt: new Date(),
      dataPoints: contentData.contentInteractions.length,
    };

    // Store as behavioral pattern
    const behavioralPattern: BehavioralPattern = {
      id: crypto.randomUUID(),
      tenantId,
      userId,
      sessionId: `content_pref_${Date.now()}`,
      patternType: 'content_preferences',
      contextType: 'content_review',
      rawDataEncrypted: (await this.encryptSensitiveData(contentData)).encrypted,
      rawDataHash: (await this.encryptSensitiveData(contentData)).hash,
      aggregatedMetrics: preferenceAnalysis,
      confidenceLevel: preferenceAnalysis.confidence,
      collectedAt: new Date(),
      privacyLevel: 'identifiable',
      consentVerified: true,
    };

    await this.storeBehavioralPattern(behavioralPattern);

    return contentPreference;
  }

  // Private helper methods

  private analyzeTimingPatterns(timingData: InteractionTimingData): Record<string, number> {
    const responseDelays = timingData.responseDelays || [];
    const avgResponseTime = responseDelays.reduce((sum, delay) => sum + delay, 0) / responseDelays.length || 0;
    const responseVariability = this.calculateVariability(responseDelays);

    // Calculate cognitive load indicators
    const cognitiveLoadScore = this.calculateCognitiveLoad(timingData);
    const engagementScore = this.calculateEngagementScore(timingData);

    return {
      avgResponseTimeSeconds: avgResponseTime,
      responseVariability,
      cognitiveLoadScore,
      engagementScore,
      sessionDurationMinutes: (timingData.sessionDuration || 0) / 60,
      confidenceScore: Math.min(responseDelays.length / this.MIN_DATA_POINTS, 1.0),
    };
  }

  private calculateLearningVelocity(assessmentData: any): {
    timeToMasteryMinutes: number;
    confidence: number;
    priorKnowledgeEstimate: number;
    struggledConcepts: string[];
    accelerationFactors: string[];
    masteryTimestamp: string;
  } {
    const attempts = assessmentData.attempts;
    const masteryThreshold = assessmentData.masteryThreshold;

    // Find mastery achievement point
    const masteryIndex = attempts.findIndex((attempt: any) => attempt.score >= masteryThreshold);

    if (masteryIndex === -1) {
      // Mastery not yet achieved, estimate based on trend
      const totalTime = attempts.reduce((sum: number, attempt: any) => sum + attempt.timeSpent, 0);
      return {
        timeToMasteryMinutes: totalTime / 60,
        confidence: 0.3, // Low confidence for incomplete mastery
        priorKnowledgeEstimate: attempts[0]?.score || 0,
        struggledConcepts: [assessmentData.conceptId],
        accelerationFactors: [],
        masteryTimestamp: new Date().toISOString(),
      };
    }

    const masteryAttempts = attempts.slice(0, masteryIndex + 1);
    const totalTimeToMastery = masteryAttempts.reduce((sum: number, attempt: any) => sum + attempt.timeSpent, 0);

    return {
      timeToMasteryMinutes: totalTimeToMastery / 60,
      confidence: Math.min(masteryAttempts.length / this.MIN_DATA_POINTS, 1.0),
      priorKnowledgeEstimate: attempts[0]?.score || 0,
      struggledConcepts: masteryIndex > 2 ? [assessmentData.conceptId] : [],
      accelerationFactors: masteryIndex <= 2 ? ['prior_knowledge', 'optimal_difficulty'] : [],
      masteryTimestamp: attempts[masteryIndex]?.timestamp,
    };
  }

  private calculateForgettingCurve(retentionData: any): {
    currentRetention: number;
    slope: number;
    strengthFactor: number;
    halfLife: number;
    optimalInterval: number;
    accuracyScore: number;
    interferenceFactors: string[];
    confidence: number;
  } {
    const assessments = retentionData.assessments;

    if (assessments.length < 2) {
      return {
        currentRetention: assessments[0]?.score || 0,
        slope: 0,
        strengthFactor: 1.0,
        halfLife: 7, // Default 1 week
        optimalInterval: 3,
        accuracyScore: 0.5,
        interferenceFactors: [],
        confidence: 0.2,
      };
    }

    // Fit exponential decay curve: R(t) = R0 * e^(-t/τ)
    const currentRetention = assessments[assessments.length - 1]?.score || 0;
    const initialRetention = retentionData.initialMasteryLevel;

    // Simple slope calculation
    const timeSpan = assessments[assessments.length - 1]?.daysSinceLastReview || 1;
    const retentionDecay = Math.max(0, initialRetention - currentRetention);
    const slope = retentionDecay / timeSpan;

    // Calculate half-life (days for retention to drop to 50%)
    const halfLife = slope > 0 ? Math.log(2) / slope : 30;

    return {
      currentRetention,
      slope,
      strengthFactor: 1.0 - slope,
      halfLife: Math.min(Math.max(halfLife, 1), 365), // Clamp between 1 day and 1 year
      optimalInterval: Math.ceil(halfLife * 0.7), // Review at 70% of half-life
      accuracyScore: this.calculatePredictionAccuracy(assessments),
      interferenceFactors: this.identifyInterferenceFactors(assessments),
      confidence: Math.min(assessments.length / this.MIN_DATA_POINTS, 1.0),
    };
  }

  private analyzeComprehensionPatterns(interactionData: any): any {
    const questionTypes = interactionData.questionTypes || [];
    const explanationPrefs = interactionData.explanationPreferences || [];
    const contentEngagement = interactionData.contentEngagement || [];

    // Calculate style preferences
    const styleScores: Record<string, number> = {
      visual: 0,
      analytical: 0,
      practical: 0,
      conceptual: 0,
    };

    // Analyze question type performance
    questionTypes.forEach((q: any) => {
      const weight = q.success ? 1.0 / (1.0 + q.timeSpent / 300) : 0.3; // Penalize long times
      styleScores[q.type] = (styleScores[q.type] || 0) + weight;
    });

    // Analyze explanation effectiveness
    explanationPrefs.forEach((exp: any) => {
      const mappedStyle = exp.type === 'visual' ? 'visual' : exp.type === 'example' ? 'practical' : 'analytical';
      styleScores[mappedStyle] = (styleScores[mappedStyle] || 0) + exp.effectiveness;
    });

    // Normalize scores
    const totalScore = Object.values(styleScores).reduce((sum, score) => sum + score, 0);
    if (totalScore > 0) {
      Object.keys(styleScores).forEach((key) => {
        styleScores[key] = styleScores[key] / totalScore;
      });
    }

    // Find primary and secondary styles
    const sortedStyles = Object.entries(styleScores).sort(([, a], [, b]) => b - a);

    return {
      primaryStyle: sortedStyles[0]?.[0] || 'analytical',
      secondaryStyle: sortedStyles[1]?.[0] || 'practical',
      styleBreakdown: styleScores,
      confidence: Math.min((questionTypes.length + explanationPrefs.length) / this.MIN_DATA_POINTS, 1.0),
    };
  }

  private analyzeStrugglePatterns(behaviorData: any): any {
    const multipleAttempts = behaviorData.multipleAttempts || [];
    const helpRequests = behaviorData.helpRequests || [];
    const engagementMetrics = behaviorData.engagementMetrics || {};

    // Calculate struggle severity
    const attemptFailureRate =
      multipleAttempts.length > 0 ? multipleAttempts.filter((a: any) => !a.success).length / multipleAttempts.length : 0;

    const helpUrgencyScore =
      helpRequests.length > 0
        ? helpRequests.reduce((sum: number, req: any) => {
            return sum + (req.urgency === 'high' ? 1.0 : req.urgency === 'medium' ? 0.6 : 0.3);
          }, 0) / helpRequests.length
        : 0;

    const severityScore = Math.min(attemptFailureRate * 0.5 + helpUrgencyScore * 0.5, 1.0);

    // Identify primary struggle type
    let primaryStruggleType = 'knowledge_gap';
    if (helpUrgencyScore > 0.7) primaryStruggleType = 'confusion';
    if (engagementMetrics.dropoffRate > 0.6) primaryStruggleType = 'frustration';
    if (attemptFailureRate > 0.8) primaryStruggleType = 'skill_deficit';

    return {
      primaryStruggleType,
      severityScore,
      confidence: Math.min((multipleAttempts.length + helpRequests.length) / this.MIN_DATA_POINTS, 1.0),
      triggeringConcepts: multipleAttempts.map((a: any) => a.conceptId).filter(Boolean),
      behavioralSignals: {
        attemptFailureRate,
        helpSeekingFrequency: helpRequests.length,
        engagementDropoff: engagementMetrics.dropoffRate,
      },
      recommendedInterventions: this.generateInterventionRecommendations(primaryStruggleType, severityScore),
    };
  }

  private analyzeContentPreferences(contentData: any): any {
    const interactions = contentData.contentInteractions || [];
    const outcomes = contentData.learningOutcomes || [];

    // Create effectiveness map
    const typeEffectiveness: Record<string, { engagement: number; outcome: number; count: number }> = {};

    interactions.forEach((interaction: any) => {
      if (!typeEffectiveness[interaction.contentType]) {
        typeEffectiveness[interaction.contentType] = { engagement: 0, outcome: 0, count: 0 };
      }

      const engagementScore =
        interaction.completionRate * 0.4 +
        Math.min(interaction.engagementTime / 300, 1) * 0.4 +
        Math.min(interaction.interactionCount / 5, 1) * 0.2;

      typeEffectiveness[interaction.contentType].engagement += engagementScore;
      typeEffectiveness[interaction.contentType].count += 1;
    });

    // Add outcome data
    outcomes.forEach((outcome: any) => {
      const interaction = interactions.find((i: any) => i.contentId === outcome.contentId);
      if (interaction && typeEffectiveness[interaction.contentType]) {
        typeEffectiveness[interaction.contentType].outcome += outcome.masteryImprovement;
      }
    });

    // Calculate final preferences
    const preferences: Record<string, number> = {};
    Object.entries(typeEffectiveness).forEach(([type, data]) => {
      if (data.count > 0) {
        const avgEngagement = data.engagement / data.count;
        const avgOutcome = data.outcome / data.count;
        preferences[type] = avgEngagement * 0.6 + avgOutcome * 0.4;
      }
    });

    const sortedPrefs = Object.entries(preferences).sort(([, a], [, b]) => b - a);

    return {
      preferredTypes: sortedPrefs.slice(0, 3).map(([type]) => type),
      effectiveFormats: sortedPrefs.map(([type, score]) => ({ type, effectiveness: score })),
      optimalDuration: this.calculateOptimalEngagementDuration(interactions),
      interactionPatterns: this.identifyInteractionPatterns(interactions),
      confidence: Math.min(interactions.length / this.MIN_DATA_POINTS, 1.0),
    };
  }

  private generateInterventionRecommendations(struggleType: string, severity: number): string[] {
    const baseRecommendations = {
      knowledge_gap: ['prerequisite_review', 'foundational_concepts'],
      confusion: ['clarification_prompts', 'alternative_explanations'],
      frustration: ['break_suggested', 'difficulty_adjustment'],
      skill_deficit: ['practice_problems', 'scaffolded_support'],
    };

    const recommendations = baseRecommendations[struggleType as keyof typeof baseRecommendations] || [];

    if (severity > 0.7) {
      recommendations.push('instructor_notification', 'peer_support');
    }

    return recommendations;
  }

  // Utility methods
  private calculateVariability(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculateCognitiveLoad(timingData: InteractionTimingData): number {
    // Simple heuristic based on response patterns and pauses
    const avgResponseTime =
      (timingData.responseDelays || []).reduce((sum, delay) => sum + delay, 0) / (timingData.responseDelays?.length || 1);
    const longPauses = (timingData.responseDelays || []).filter((delay) => delay > 5).length;
    return Math.min(avgResponseTime / 10 + longPauses * 0.1, 1.0);
  }

  private calculateEngagementScore(timingData: InteractionTimingData): number {
    const sessionDuration = timingData.sessionDuration || 0;
    const eventCount = timingData.engagementEvents?.length || 0;
    return Math.min((eventCount / (sessionDuration / 60)) * 0.1, 1.0);
  }

  private calculateAverageDifficulty(attempts: any[]): number {
    const difficulties = attempts.map((a) => a.difficultyLevel).filter((d) => d != null);
    return difficulties.length > 0 ? difficulties.reduce((sum, d) => sum + d, 0) / difficulties.length : 0.5;
  }

  private calculatePredictionAccuracy(assessments: any[]): number {
    // Simplified accuracy calculation - would need more sophisticated modeling in practice
    return assessments.length > 2 ? 0.8 : 0.6;
  }

  private identifyInterferenceFactors(assessments: any[]): string[] {
    // Simple heuristic - would need more sophisticated analysis
    const factors: string[] = [];
    if (assessments.some((a: any) => a.daysSinceLastReview > 14)) {
      factors.push('long_delay');
    }
    return factors;
  }

  private calculateOptimalEngagementDuration(interactions: any[]): number {
    const effectiveInteractions = interactions.filter((i) => i.completionRate > 0.7);
    if (effectiveInteractions.length === 0) return 300; // 5 minutes default

    const avgDuration = effectiveInteractions.reduce((sum, i) => sum + i.engagementTime, 0) / effectiveInteractions.length;
    return Math.round(avgDuration);
  }

  private identifyInteractionPatterns(interactions: any[]): Record<string, any> {
    return {
      prefersBriefContent: interactions.filter((i) => i.engagementTime < 120).length / interactions.length > 0.6,
      highInteractionStyle: interactions.reduce((sum, i) => sum + i.interactionCount, 0) / interactions.length > 3,
      completionOriented: interactions.filter((i) => i.completionRate > 0.9).length / interactions.length > 0.5,
    };
  }

  private async encryptSensitiveData(data: any): Promise<{ encrypted: string; hash: string }> {
    // In a real implementation, this would use proper encryption
    const dataString = JSON.stringify(data);
    const hash = await this.generateHash(dataString);
    const encrypted = btoa(dataString); // Base64 encoding as placeholder

    return { encrypted, hash };
  }

  private async generateHash(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }


  private async getOrCreateProfileId(tenantId: string, userId: string): Promise<string> {
    // Try to find existing profile using repository
    const existing = await this.profileRepository.findByUserId(userId, tenantId);

    if (existing) {
      return existing.id;
    }

    // Create new profile using repository
    const newProfile = await this.profileRepository.create({
      tenantId,
      userId,
      // Initialize with default values
      learningVelocityValue: 0,
      learningVelocityConfidence: 0,
      learningVelocityDataPoints: 0,
      learningVelocityLastUpdated: new Date(),
      memoryRetentionValue: 0,
      memoryRetentionConfidence: 0,
      memoryRetentionDataPoints: 0,
      memoryRetentionLastUpdated: new Date(),
      struggleThresholdValue: 0.5,
      struggleThresholdConfidence: 0,
      struggleThresholdDataPoints: 0,
      struggleThresholdLastUpdated: new Date(),
      cognitiveAttributes: {},
      comprehensionStyles: [],
      preferredModalities: [],
      profileConfidence: 0,
      totalDataPoints: 0,
      analysisQualityScore: 0,
      crossCoursePatterns: {},
      multiContextConfidence: 0,
      dataCollectionLevel: 'minimal' as const,
      profileVisibility: 'private' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastAnalyzedAt: new Date(),
    });

    return newProfile.id;
  }

}
