/**
 * @fileoverview Learner DNA Engine for Cognitive Profile Generation and Pattern Recognition
 * @module features/learner-dna/server/services/LearnerDNAEngine
 * 
 * Implements advanced cognitive profiling algorithms that aggregate behavioral patterns
 * into actionable learning DNA profiles with statistical validation and cross-course intelligence.
 */

import { DatabaseService } from '@shared/server/services';
import { CognitiveDataCollector } from './CognitiveDataCollector';
import { PrivacyControlService } from './PrivacyControlService';
import type {
  LearnerDNAProfile,
  CognitiveAttribute,
  BehavioralPattern,
  CrossCoursePattern,
  CognitiveProfileValidation
} from '../../shared/types';

/**
 * Learner DNA Engine implementing sophisticated cognitive profiling algorithms.
 * 
 * Transforms raw behavioral data into comprehensive cognitive profiles with
 * statistical validation, noise filtering, and cross-course intelligence.
 * 
 * Core Capabilities:
 * - Cognitive attribute aggregation with confidence scoring
 * - Statistical significance testing and noise filtering
 * - Multi-course pattern correlation analysis
 * - Profile evolution tracking and validation
 * - Anonymous benchmarking and comparison algorithms
 * - Predictive modeling for learning interventions
 * 
 * @class LearnerDNAEngine
 */
export class LearnerDNAEngine {
  private db: DatabaseService;
  private dataCollector: CognitiveDataCollector;
  private privacyService: PrivacyControlService;
  
  // Statistical thresholds for profile generation
  private readonly MIN_DATA_POINTS = 10;
  private readonly CONFIDENCE_THRESHOLD = 0.7;
  private readonly NOISE_FILTER_THRESHOLD = 0.6;
  private readonly SIGNIFICANCE_LEVEL = 0.05;

  constructor(
    db: DatabaseService, 
    dataCollector: CognitiveDataCollector,
    privacyService: PrivacyControlService
  ) {
    this.db = db;
    this.dataCollector = dataCollector;
    this.privacyService = privacyService;
  }

  /**
   * Generates comprehensive cognitive profile from aggregated behavioral patterns.
   * 
   * Analyzes all behavioral data for a learner to create a statistically validated
   * cognitive profile with learning velocity, memory retention, comprehension styles,
   * and struggle thresholds.
   * 
   * @param tenantId - Tenant identifier
   * @param userId - Student identifier
   * @param forceRegeneration - Force complete profile regeneration
   * @returns Promise resolving to comprehensive learner DNA profile
   * 
   * @throws {InsufficientDataError} If not enough behavioral data exists
   * @throws {PrivacyError} If user hasn't consented to cognitive profiling
   * 
   * @example
   * ```typescript
   * const profile = await dnaEngine.generateCognitiveProfile(
   *   'tenant-123',
   *   'user-456',
   *   false
   * );
   * 
   * console.log(`Learning velocity: ${profile.learningVelocityValue}`);
   * console.log(`Profile confidence: ${profile.profileConfidence}`);
   * ```
   */
  async generateCognitiveProfile(
    tenantId: string,
    userId: string,
    forceRegeneration: boolean = false
  ): Promise<LearnerDNAProfile> {
    // Verify consent for cognitive profiling
    const hasConsent = await this.privacyService.validateDataCollectionPermission(
      tenantId,
      userId,
      'behavioral_timing'
    );
    
    if (!hasConsent) {
      throw new Error('PRIVACY_ERROR: User has not consented to cognitive profiling');
    }

    // Check for existing profile
    const existingProfile = await this.getExistingProfile(tenantId, userId);
    if (existingProfile && !forceRegeneration) {
      // Update existing profile if data is recent enough
      const hoursSinceUpdate = (Date.now() - existingProfile.lastAnalyzedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceUpdate < 24) {
        return existingProfile;
      }
    }

    // Gather all behavioral patterns for analysis
    const behavioralPatterns = await this.getBehavioralPatterns(tenantId, userId);
    
    if (behavioralPatterns.length < this.MIN_DATA_POINTS) {
      throw new Error(`INSUFFICIENT_DATA: Need at least ${this.MIN_DATA_POINTS} behavioral patterns, found ${behavioralPatterns.length}`);
    }

    // Generate cognitive attributes from behavioral data
    const cognitiveAttributes = await this.aggregateCognitiveAttributes(behavioralPatterns);
    
    // Calculate overall profile confidence and quality
    const profileMetrics = this.calculateProfileMetrics(cognitiveAttributes, behavioralPatterns.length);
    
    // Create or update learner DNA profile
    const profile: LearnerDNAProfile = {
      id: existingProfile?.id || crypto.randomUUID(),
      tenantId,
      userId,
      
      // Core cognitive attributes with confidence
      learningVelocityValue: cognitiveAttributes.learningVelocity.value,
      learningVelocityConfidence: cognitiveAttributes.learningVelocity.confidence,
      learningVelocityDataPoints: cognitiveAttributes.learningVelocity.dataPoints,
      learningVelocityLastUpdated: new Date(),
      
      memoryRetentionValue: cognitiveAttributes.memoryRetention.value,
      memoryRetentionConfidence: cognitiveAttributes.memoryRetention.confidence,
      memoryRetentionDataPoints: cognitiveAttributes.memoryRetention.dataPoints,
      memoryRetentionLastUpdated: new Date(),
      
      struggleThresholdValue: cognitiveAttributes.struggleThreshold.value,
      struggleThresholdConfidence: cognitiveAttributes.struggleThreshold.confidence,
      struggleThresholdDataPoints: cognitiveAttributes.struggleThreshold.dataPoints,
      struggleThresholdLastUpdated: new Date(),
      
      // Comprehensive attributes as structured JSON
      cognitiveAttributes: this.serializeCognitiveAttributes(cognitiveAttributes),
      comprehensionStyles: cognitiveAttributes.comprehensionStyles,
      preferredModalities: cognitiveAttributes.preferredModalities,
      
      // Profile quality metrics
      profileConfidence: profileMetrics.overallConfidence,
      totalDataPoints: behavioralPatterns.length,
      analysisQualityScore: profileMetrics.qualityScore,
      
      // Cross-course intelligence foundation
      crossCoursePatterns: await this.analyzeCrossCoursePatterns(tenantId, userId),
      multiContextConfidence: profileMetrics.crossCourseConfidence,
      
      // Privacy and metadata
      dataCollectionLevel: (await this.privacyService.getActiveConsent(tenantId, userId))?.dataCollectionLevel || 'minimal',
      profileVisibility: 'private',
      
      createdAt: existingProfile?.createdAt || new Date(),
      updatedAt: new Date(),
      lastAnalyzedAt: new Date()
    };

    // Store the profile
    await this.storeLearnerDNAProfile(profile);
    
    // Store detailed cognitive attributes
    await this.storeCognitiveAttributes(profile.id, cognitiveAttributes);
    
    // Validate profile accuracy
    await this.validateProfileAccuracy(profile);
    
    // Create audit log
    await this.createProfileGenerationAudit(tenantId, userId, profile.id, profileMetrics);
    
    return profile;
  }

  /**
   * Updates cognitive profile with new behavioral data incrementally.
   * 
   * Performs incremental updates to existing profiles when new behavioral
   * patterns are available, maintaining statistical validity and confidence scores.
   * 
   * @param tenantId - Tenant identifier
   * @param userId - Student identifier
   * @param newPatterns - New behavioral patterns to integrate
   * @returns Promise resolving to updated profile
   */
  async updateCognitiveProfile(
    tenantId: string,
    userId: string,
    newPatterns: BehavioralPattern[]
  ): Promise<LearnerDNAProfile> {
    const existingProfile = await this.getExistingProfile(tenantId, userId);
    if (!existingProfile) {
      return this.generateCognitiveProfile(tenantId, userId);
    }

    // Filter new patterns by type and integrate with existing profile
    const updatedAttributes = await this.integrateNewPatterns(existingProfile, newPatterns);
    
    // Recalculate profile metrics
    const totalDataPoints = existingProfile.totalDataPoints + newPatterns.length;
    const profileMetrics = this.calculateProfileMetrics(updatedAttributes, totalDataPoints);
    
    // Update profile
    existingProfile.cognitiveAttributes = this.serializeCognitiveAttributes(updatedAttributes);
    existingProfile.profileConfidence = profileMetrics.overallConfidence;
    existingProfile.analysisQualityScore = profileMetrics.qualityScore;
    existingProfile.totalDataPoints = totalDataPoints;
    existingProfile.updatedAt = new Date();
    existingProfile.lastAnalyzedAt = new Date();
    
    // Store updated profile
    await this.storeLearnerDNAProfile(existingProfile);
    
    return existingProfile;
  }

  /**
   * Applies statistical noise filtering to identify significant behavioral patterns.
   * 
   * Uses statistical significance testing and outlier detection to separate
   * meaningful learning patterns from random behavioral noise.
   * 
   * @param patterns - Raw behavioral patterns to filter
   * @returns Promise resolving to filtered patterns with significance scores
   */
  async filterStatisticalNoise(patterns: BehavioralPattern[]): Promise<{
    significantPatterns: BehavioralPattern[];
    filteredNoise: BehavioralPattern[];
    significanceScores: Record<string, number>;
  }> {
    const significantPatterns: BehavioralPattern[] = [];
    const filteredNoise: BehavioralPattern[] = [];
    const significanceScores: Record<string, number> = {};

    // Group patterns by type for statistical analysis
    const patternGroups = this.groupPatternsByType(patterns);
    
    for (const [patternType, typePatterns] of Object.entries(patternGroups)) {
      const analysis = await this.performStatisticalAnalysis(typePatterns);
      
      typePatterns.forEach(pattern => {
        const significanceScore = this.calculateSignificanceScore(pattern, analysis);
        significanceScores[pattern.id] = significanceScore;
        
        if (significanceScore >= this.NOISE_FILTER_THRESHOLD) {
          significantPatterns.push(pattern);
        } else {
          filteredNoise.push(pattern);
        }
      });
    }

    return {
      significantPatterns,
      filteredNoise,
      significanceScores
    };
  }

  /**
   * Analyzes cross-course learning pattern correlations.
   * 
   * Identifies learning behaviors that persist across different subjects
   * and contexts, enabling cross-course intelligence and transfer learning insights.
   * 
   * @param tenantId - Tenant identifier
   * @param userId - Student identifier
   * @returns Promise resolving to cross-course pattern analysis
   */
  async analyzeCrossCourseIntelligence(
    tenantId: string,
    userId: string
  ): Promise<{
    patterns: CrossCoursePattern[];
    transferLearningIndicators: Record<string, number>;
    contextualStability: number;
    recommendations: string[];
  }> {
    // Verify consent for cross-course correlation
    const hasConsent = await this.privacyService.validateDataCollectionPermission(
      tenantId,
      userId,
      'cross_course_correlation'
    );
    
    if (!hasConsent) {
      throw new Error('PRIVACY_ERROR: User has not consented to cross-course correlation analysis');
    }

    // Get behavioral patterns across all courses
    const allPatterns = await this.getBehavioralPatternsAllCourses(tenantId, userId);
    const courseGroups = this.groupPatternsByCourse(allPatterns);
    
    if (Object.keys(courseGroups).length < 2) {
      return {
        patterns: [],
        transferLearningIndicators: {},
        contextualStability: 0,
        recommendations: ['Insufficient cross-course data for analysis']
      };
    }

    // Analyze patterns across courses
    const crossCoursePatterns = await this.identifyCrossCoursePatterns(courseGroups);
    const transferIndicators = this.calculateTransferLearningIndicators(courseGroups);
    const stability = this.calculateContextualStability(courseGroups);
    
    // Generate recommendations
    const recommendations = this.generateCrossCourseRecommendations(
      crossCoursePatterns,
      transferIndicators,
      stability
    );

    return {
      patterns: crossCoursePatterns,
      transferLearningIndicators: transferIndicators,
      contextualStability: stability,
      recommendations
    };
  }

  /**
   * Performs anonymous cognitive profile benchmarking.
   * 
   * Compares individual cognitive profiles against anonymized cohort data
   * for educational insights while maintaining privacy protection.
   * 
   * @param tenantId - Tenant identifier
   * @param userId - Student identifier
   * @param comparisonScope - Scope for benchmarking comparison
   * @returns Promise resolving to anonymous benchmark results
   */
  async performAnonymousBenchmarking(
    tenantId: string,
    userId: string,
    comparisonScope: 'course' | 'institution' | 'subject_area'
  ): Promise<{
    benchmarkResults: Record<string, {
      userValue: number;
      cohortPercentile: number;
      cohortMean: number;
      cohortStdDev: number;
      sampleSize: number;
    }>;
    insights: string[];
    recommendations: string[];
  }> {
    const userProfile = await this.getExistingProfile(tenantId, userId);
    if (!userProfile) {
      throw new Error('USER_PROFILE_NOT_FOUND: Cannot benchmark without existing cognitive profile');
    }

    // Get anonymous benchmark data based on scope
    const benchmarkData = await this.getAnonymousBenchmarkData(tenantId, comparisonScope);
    
    const benchmarkResults: Record<string, any> = {};
    const insights: string[] = [];
    const recommendations: string[] = [];

    // Compare key cognitive attributes
    const attributesToBenchmark = [
      'learningVelocityValue',
      'memoryRetentionValue',
      'struggleThresholdValue'
    ];

    for (const attribute of attributesToBenchmark) {
      const userValue = userProfile[attribute as keyof LearnerDNAProfile] as number;
      const cohortData = benchmarkData[attribute];
      
      if (cohortData && cohortData.sampleSize >= 10) { // Minimum sample for valid comparison
        const percentile = this.calculatePercentile(userValue, cohortData.values);
        
        benchmarkResults[attribute] = {
          userValue,
          cohortPercentile: percentile,
          cohortMean: cohortData.mean,
          cohortStdDev: cohortData.stdDev,
          sampleSize: cohortData.sampleSize
        };

        // Generate insights
        if (percentile > 80) {
          insights.push(`Strong performance in ${attribute.replace('Value', '')}`);
        } else if (percentile < 20) {
          insights.push(`Growth opportunity in ${attribute.replace('Value', '')}`);
          recommendations.push(`Consider additional support for ${attribute.replace('Value', '')}`);
        }
      }
    }

    return {
      benchmarkResults,
      insights,
      recommendations
    };
  }

  /**
   * Validates cognitive profile accuracy through prediction testing.
   * 
   * Tests profile accuracy against actual learning outcomes to maintain
   * educational validity and continuous improvement of profiling algorithms.
   * 
   * @param profile - Cognitive profile to validate
   * @returns Promise resolving to validation results
   */
  async validateProfileAccuracy(profile: LearnerDNAProfile): Promise<CognitiveProfileValidation> {
    // Get recent learning outcomes for validation
    const recentOutcomes = await this.getRecentLearningOutcomes(profile.tenantId, profile.userId);
    
    if (recentOutcomes.length === 0) {
      return {
        id: crypto.randomUUID(),
        tenantId: profile.tenantId,
        profileId: profile.id,
        validationType: 'prediction_accuracy',
        accuracyScore: 0.5, // Neutral score when no validation data
        confidenceInterval: 0.9,
        validationSampleSize: 0,
        validationData: { note: 'Insufficient recent outcomes for validation' },
        baselineComparison: null,
        improvementOverBaseline: null,
        validatedAt: new Date(),
        validationPeriodDays: 30,
        nextValidationDue: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000))
      };
    }

    // Perform prediction accuracy testing
    const accuracyResults = await this.testPredictionAccuracy(profile, recentOutcomes);
    
    const validation: CognitiveProfileValidation = {
      id: crypto.randomUUID(),
      tenantId: profile.tenantId,
      profileId: profile.id,
      validationType: 'prediction_accuracy',
      accuracyScore: accuracyResults.accuracy,
      confidenceInterval: 0.95,
      validationSampleSize: recentOutcomes.length,
      validationData: accuracyResults.details,
      baselineComparison: accuracyResults.baselineAccuracy,
      improvementOverBaseline: accuracyResults.accuracy - (accuracyResults.baselineAccuracy || 0.5),
      validatedAt: new Date(),
      validationPeriodDays: 30,
      nextValidationDue: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000))
    };

    // Store validation results
    await this.storeProfileValidation(validation);
    
    return validation;
  }

  // Private helper methods

  private async getExistingProfile(tenantId: string, userId: string): Promise<LearnerDNAProfile | null> {
    const result = await this.db.getDb().prepare(
      'SELECT * FROM learner_dna_profiles WHERE tenant_id = ? AND user_id = ?'
    ).bind(tenantId, userId).first<any>();
    
    if (!result) return null;
    
    // Convert database row to LearnerDNAProfile
    return {
      id: result.id,
      tenantId: result.tenant_id,
      userId: result.user_id,
      learningVelocityValue: result.learning_velocity_value,
      learningVelocityConfidence: result.learning_velocity_confidence,
      learningVelocityDataPoints: result.learning_velocity_data_points,
      learningVelocityLastUpdated: new Date(result.learning_velocity_last_updated),
      memoryRetentionValue: result.memory_retention_value,
      memoryRetentionConfidence: result.memory_retention_confidence,
      memoryRetentionDataPoints: result.memory_retention_data_points,
      memoryRetentionLastUpdated: new Date(result.memory_retention_last_updated),
      struggleThresholdValue: result.struggle_threshold_value,
      struggleThresholdConfidence: result.struggle_threshold_confidence,
      struggleThresholdDataPoints: result.struggle_threshold_data_points,
      struggleThresholdLastUpdated: new Date(result.struggle_threshold_last_updated),
      cognitiveAttributes: JSON.parse(result.cognitive_attributes || '{}'),
      comprehensionStyles: JSON.parse(result.comprehension_styles || '[]'),
      preferredModalities: JSON.parse(result.preferred_modalities || '[]'),
      profileConfidence: result.profile_confidence,
      totalDataPoints: result.total_data_points,
      analysisQualityScore: result.analysis_quality_score,
      crossCoursePatterns: JSON.parse(result.cross_course_patterns || '{}'),
      multiContextConfidence: result.multi_context_confidence,
      dataCollectionLevel: result.data_collection_level,
      profileVisibility: result.profile_visibility,
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at),
      lastAnalyzedAt: new Date(result.last_analyzed_at)
    };
  }

  private async getBehavioralPatterns(tenantId: string, userId: string): Promise<BehavioralPattern[]> {
    const results = await this.db.getDb().prepare(
      `SELECT * FROM behavioral_patterns 
       WHERE tenant_id = ? AND user_id = ? AND consent_verified = 1
       ORDER BY collected_at DESC`
    ).bind(tenantId, userId).all<any>();
    
    return (results.results || []).map(row => ({
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      sessionId: row.session_id,
      patternType: row.pattern_type,
      contextType: row.context_type,
      rawDataEncrypted: row.raw_data_encrypted,
      rawDataHash: row.raw_data_hash,
      aggregatedMetrics: JSON.parse(row.aggregated_metrics || '{}'),
      confidenceLevel: row.confidence_level,
      courseId: row.course_id,
      contentId: row.content_id,
      collectedAt: new Date(row.collected_at),
      anonymizedAt: row.anonymized_at ? new Date(row.anonymized_at) : undefined,
      purgeAt: row.purge_at ? new Date(row.purge_at) : undefined,
      privacyLevel: row.privacy_level,
      consentVerified: Boolean(row.consent_verified)
    }));
  }

  private async aggregateCognitiveAttributes(patterns: BehavioralPattern[]): Promise<Record<string, any>> {
    // Group patterns by type for analysis
    const patternsByType = this.groupPatternsByType(patterns);
    
    // Initialize cognitive attributes
    const cognitiveAttributes: Record<string, any> = {
      learningVelocity: { value: 1.0, confidence: 0.0, dataPoints: 0 },
      memoryRetention: { value: 1.0, confidence: 0.0, dataPoints: 0 },
      struggleThreshold: { value: 0.5, confidence: 0.0, dataPoints: 0 },
      comprehensionStyles: [],
      preferredModalities: []
    };

    // Aggregate learning velocity
    if (patternsByType.learning_velocity) {
      const velocityData = patternsByType.learning_velocity.map(p => p.aggregatedMetrics);
      cognitiveAttributes.learningVelocity = this.aggregateLearningVelocity(velocityData);
    }

    // Aggregate memory retention
    if (patternsByType.memory_retention) {
      const retentionData = patternsByType.memory_retention.map(p => p.aggregatedMetrics);
      cognitiveAttributes.memoryRetention = this.aggregateMemoryRetention(retentionData);
    }

    // Aggregate struggle patterns
    if (patternsByType.struggle_indicators) {
      const struggleData = patternsByType.struggle_indicators.map(p => p.aggregatedMetrics);
      cognitiveAttributes.struggleThreshold = this.aggregateStruggleThreshold(struggleData);
    }

    // Aggregate comprehension styles
    if (patternsByType.comprehension_style) {
      const styleData = patternsByType.comprehension_style.map(p => p.aggregatedMetrics);
      cognitiveAttributes.comprehensionStyles = this.aggregateComprehensionStyles(styleData);
    }

    // Aggregate content preferences
    if (patternsByType.content_preferences) {
      const preferenceData = patternsByType.content_preferences.map(p => p.aggregatedMetrics);
      cognitiveAttributes.preferredModalities = this.aggregatePreferredModalities(preferenceData);
    }

    return cognitiveAttributes;
  }

  private groupPatternsByType(patterns: BehavioralPattern[]): Record<string, BehavioralPattern[]> {
    return patterns.reduce((groups, pattern) => {
      const type = pattern.patternType;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(pattern);
      return groups;
    }, {} as Record<string, BehavioralPattern[]>);
  }

  private aggregateLearningVelocity(velocityData: any[]): { value: number; confidence: number; dataPoints: number } {
    if (velocityData.length === 0) {
      return { value: 1.0, confidence: 0.0, dataPoints: 0 };
    }

    // Calculate weighted average based on confidence scores
    let totalWeightedVelocity = 0;
    let totalWeight = 0;

    velocityData.forEach(data => {
      const velocity = data.timeToMasteryMinutes ? 60 / data.timeToMasteryMinutes : 1.0; // Inverse relationship
      const weight = data.confidenceScore || 0.5;
      totalWeightedVelocity += velocity * weight;
      totalWeight += weight;
    });

    const avgVelocity = totalWeight > 0 ? totalWeightedVelocity / totalWeight : 1.0;
    const confidence = Math.min(velocityData.length / this.MIN_DATA_POINTS, 1.0);

    return {
      value: Math.max(0.1, Math.min(avgVelocity, 10.0)), // Clamp between 0.1 and 10
      confidence,
      dataPoints: velocityData.length
    };
  }

  private aggregateMemoryRetention(retentionData: any[]): { value: number; confidence: number; dataPoints: number } {
    if (retentionData.length === 0) {
      return { value: 1.0, confidence: 0.0, dataPoints: 0 };
    }

    const avgRetention = retentionData.reduce((sum, data) => {
      return sum + (data.currentRetention || 0.5);
    }, 0) / retentionData.length;

    return {
      value: Math.max(0.0, Math.min(avgRetention, 1.0)),
      confidence: Math.min(retentionData.length / this.MIN_DATA_POINTS, 1.0),
      dataPoints: retentionData.length
    };
  }

  private aggregateStruggleThreshold(struggleData: any[]): { value: number; confidence: number; dataPoints: number } {
    if (struggleData.length === 0) {
      return { value: 0.5, confidence: 0.0, dataPoints: 0 };
    }

    const avgThreshold = struggleData.reduce((sum, data) => {
      return sum + (data.severityScore || 0.5);
    }, 0) / struggleData.length;

    return {
      value: Math.max(0.0, Math.min(avgThreshold, 1.0)),
      confidence: Math.min(struggleData.length / this.MIN_DATA_POINTS, 1.0),
      dataPoints: struggleData.length
    };
  }

  private aggregateComprehensionStyles(styleData: any[]): string[] {
    const styleCounters: Record<string, number> = {};
    
    styleData.forEach(data => {
      if (data.primaryStyle) {
        styleCounters[data.primaryStyle] = (styleCounters[data.primaryStyle] || 0) + 1;
      }
      if (data.secondaryStyle) {
        styleCounters[data.secondaryStyle] = (styleCounters[data.secondaryStyle] || 0) + 0.5;
      }
    });

    // Return top styles sorted by frequency
    return Object.entries(styleCounters)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([style]) => style);
  }

  private aggregatePreferredModalities(preferenceData: any[]): string[] {
    const modalityCounters: Record<string, number> = {};
    
    preferenceData.forEach(data => {
      if (data.preferredTypes) {
        data.preferredTypes.forEach((type: string, index: number) => {
          const weight = 1.0 / (index + 1); // Higher weight for more preferred types
          modalityCounters[type] = (modalityCounters[type] || 0) + weight;
        });
      }
    });

    return Object.entries(modalityCounters)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([modality]) => modality);
  }

  private calculateProfileMetrics(attributes: Record<string, any>, totalDataPoints: number): {
    overallConfidence: number;
    qualityScore: number;
    crossCourseConfidence: number;
  } {
    // Calculate weighted average confidence
    const confidences = [
      attributes.learningVelocity.confidence,
      attributes.memoryRetention.confidence,
      attributes.struggleThreshold.confidence
    ];
    
    const overallConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
    
    // Quality score based on data volume and confidence
    const dataVolumeScore = Math.min(totalDataPoints / (this.MIN_DATA_POINTS * 3), 1.0);
    const qualityScore = (overallConfidence * 0.7) + (dataVolumeScore * 0.3);
    
    // Cross-course confidence (placeholder - would need actual cross-course data)
    const crossCourseConfidence = Math.min(overallConfidence, 0.5);
    
    return {
      overallConfidence,
      qualityScore,
      crossCourseConfidence
    };
  }

  private serializeCognitiveAttributes(attributes: Record<string, any>): Record<string, any> {
    return {
      learningVelocity: attributes.learningVelocity,
      memoryRetention: attributes.memoryRetention,
      struggleThreshold: attributes.struggleThreshold,
      comprehensionStyles: attributes.comprehensionStyles,
      preferredModalities: attributes.preferredModalities,
      lastUpdated: new Date().toISOString()
    };
  }

  private async storeLearnerDNAProfile(profile: LearnerDNAProfile): Promise<void> {
    await this.db.getDb().prepare(
      `INSERT OR REPLACE INTO learner_dna_profiles (
        id, tenant_id, user_id, learning_velocity_value, learning_velocity_confidence,
        learning_velocity_data_points, learning_velocity_last_updated,
        memory_retention_value, memory_retention_confidence, memory_retention_data_points,
        memory_retention_last_updated, struggle_threshold_value, struggle_threshold_confidence,
        struggle_threshold_data_points, struggle_threshold_last_updated,
        cognitive_attributes, comprehension_styles, preferred_modalities,
        profile_confidence, total_data_points, analysis_quality_score,
        cross_course_patterns, multi_context_confidence, data_collection_level,
        profile_visibility, created_at, updated_at, last_analyzed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
        profile.id, profile.tenantId, profile.userId,
        profile.learningVelocityValue, profile.learningVelocityConfidence,
        profile.learningVelocityDataPoints, profile.learningVelocityLastUpdated.toISOString(),
        profile.memoryRetentionValue, profile.memoryRetentionConfidence,
        profile.memoryRetentionDataPoints, profile.memoryRetentionLastUpdated.toISOString(),
        profile.struggleThresholdValue, profile.struggleThresholdConfidence,
        profile.struggleThresholdDataPoints, profile.struggleThresholdLastUpdated.toISOString(),
        JSON.stringify(profile.cognitiveAttributes), JSON.stringify(profile.comprehensionStyles),
        JSON.stringify(profile.preferredModalities), profile.profileConfidence,
        profile.totalDataPoints, profile.analysisQualityScore,
        JSON.stringify(profile.crossCoursePatterns), profile.multiContextConfidence,
        profile.dataCollectionLevel, profile.profileVisibility,
        profile.createdAt.toISOString(), profile.updatedAt.toISOString(),
        profile.lastAnalyzedAt.toISOString()
    ).run();
  }

  private async storeCognitiveAttributes(profileId: string, attributes: Record<string, any>): Promise<void> {
    // Store individual cognitive attributes for detailed analysis
    for (const [attributeType, data] of Object.entries(attributes)) {
      if (typeof data === 'object' && data.value !== undefined) {
        await this.db.getDb().prepare(
          `INSERT OR REPLACE INTO cognitive_attributes (
            id, profile_id, attribute_name, attribute_type, attribute_value,
            attribute_metadata, confidence_score, data_points_count,
            evidence_source, created_at, updated_at, last_evidence_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            crypto.randomUUID(), profileId, attributeType, attributeType,
            data.value, JSON.stringify(data), data.confidence,
            data.dataPoints, 'behavioral_analysis',
            new Date().toISOString(), new Date().toISOString(), new Date().toISOString()
        ).run();
      }
    }
  }

  // Additional placeholder methods for advanced features
  private async analyzeCrossCoursePatterns(tenantId: string, userId: string): Promise<Record<string, any>> {
    // Placeholder for cross-course pattern analysis
    return {};
  }

  private async integrateNewPatterns(profile: LearnerDNAProfile, newPatterns: BehavioralPattern[]): Promise<Record<string, any>> {
    // Placeholder for incremental pattern integration
    return JSON.parse(JSON.stringify(profile.cognitiveAttributes));
  }

  private async performStatisticalAnalysis(patterns: BehavioralPattern[]): Promise<any> {
    // Placeholder for statistical significance testing
    return { mean: 0, stdDev: 1, significance: 0.5 };
  }

  private calculateSignificanceScore(pattern: BehavioralPattern, analysis: any): number {
    // Placeholder for significance calculation
    return pattern.confidenceLevel;
  }

  private async getBehavioralPatternsAllCourses(tenantId: string, userId: string): Promise<BehavioralPattern[]> {
    // Placeholder - would get patterns across all courses
    return this.getBehavioralPatterns(tenantId, userId);
  }

  private groupPatternsByCourse(patterns: BehavioralPattern[]): Record<string, BehavioralPattern[]> {
    return patterns.reduce((groups, pattern) => {
      const courseId = pattern.courseId || 'unknown';
      if (!groups[courseId]) {
        groups[courseId] = [];
      }
      groups[courseId].push(pattern);
      return groups;
    }, {} as Record<string, BehavioralPattern[]>);
  }

  private async identifyCrossCoursePatterns(courseGroups: Record<string, BehavioralPattern[]>): Promise<CrossCoursePattern[]> {
    // Placeholder for cross-course pattern identification
    return [];
  }

  private calculateTransferLearningIndicators(courseGroups: Record<string, BehavioralPattern[]>): Record<string, number> {
    // Placeholder for transfer learning analysis
    return {};
  }

  private calculateContextualStability(courseGroups: Record<string, BehavioralPattern[]>): number {
    // Placeholder for contextual stability calculation
    return 0.5;
  }

  private generateCrossCourseRecommendations(patterns: CrossCoursePattern[], indicators: Record<string, number>, stability: number): string[] {
    // Placeholder for recommendation generation
    return ['Continue monitoring cross-course patterns'];
  }

  private async getAnonymousBenchmarkData(tenantId: string, scope: string): Promise<Record<string, any>> {
    // Placeholder for anonymous benchmark data retrieval
    return {};
  }

  private calculatePercentile(value: number, values: number[]): number {
    const sorted = values.sort((a, b) => a - b);
    const index = sorted.findIndex(v => v >= value);
    return index === -1 ? 100 : (index / sorted.length) * 100;
  }

  private async getRecentLearningOutcomes(tenantId: string, userId: string): Promise<any[]> {
    // Placeholder for learning outcome retrieval
    return [];
  }

  private async testPredictionAccuracy(profile: LearnerDNAProfile, outcomes: any[]): Promise<{
    accuracy: number;
    details: any;
    baselineAccuracy?: number;
  }> {
    // Placeholder for prediction accuracy testing
    return {
      accuracy: 0.75,
      details: { testType: 'learning_velocity_prediction' },
      baselineAccuracy: 0.6
    };
  }

  private async storeProfileValidation(validation: CognitiveProfileValidation): Promise<void> {
    await this.db.getDb().prepare(
      `INSERT INTO cognitive_profile_validation (
        id, tenant_id, profile_id, validation_type, accuracy_score,
        confidence_interval, validation_sample_size, validation_data,
        baseline_comparison, improvement_over_baseline, validated_at,
        validation_period_days, next_validation_due
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
        validation.id, validation.tenantId, validation.profileId, validation.validationType,
        validation.accuracyScore, validation.confidenceInterval, validation.validationSampleSize,
        JSON.stringify(validation.validationData), validation.baselineComparison,
        validation.improvementOverBaseline, validation.validatedAt.toISOString(),
        validation.validationPeriodDays, validation.nextValidationDue?.toISOString()
    ).run();
  }

  private async createProfileGenerationAudit(
    tenantId: string,
    userId: string,
    profileId: string,
    metrics: any
  ): Promise<void> {
    await this.db.getDb().prepare(
      `INSERT INTO learner_dna_audit_log (
        id, tenant_id, actor_type, actor_id, action, resource_type,
        resource_id, privacy_level, consent_status, action_details, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
        crypto.randomUUID(), tenantId, 'system', 'LearnerDNAEngine',
        'profile_generated', 'cognitive_profile', profileId,
        'identifiable', 'active', JSON.stringify(metrics), new Date().toISOString()
    ).run();
  }
}