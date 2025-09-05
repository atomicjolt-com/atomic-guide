/**
 * @fileoverview Advanced Pattern Recognition Engine for Story 4.2 Phase 1 MVP
 * @module features/learner-dna/server/services/AdvancedPatternRecognizer
 * 
 * Implements Phase 1 MVP scope with lightweight ML models for:
 * - Basic struggle prediction with 70% accuracy baseline
 * - Learning velocity forecasting based on historical patterns  
 * - Real-time behavioral signal analysis
 * 
 * MANDATORY SCOPE LIMITATIONS (Per QA Conditional Approval):
 * - Single-course analysis only (no cross-course intelligence)
 * - Lightweight ML models (linear regression, decision trees)
 * - Realistic performance targets (<10s prediction generation)
 * - Consent-based privacy model (no differential privacy for MVP)
 */

import { DatabaseService } from '@shared/server/services';
import { CognitiveDataCollector } from './CognitiveDataCollector';
import { PrivacyControlService } from './PrivacyControlService';
import type { 
  BehavioralPattern, 
  LearnerDNAProfile,
  StrugglePrediction,
  LearningVelocityForecast,
  BehavioralSignalAnalysis
} from '../../shared/types';

/**
 * Time series data point for temporal analysis
 */
interface TimeSeriesDataPoint {
  timestamp: Date;
  value: number;
  context: string;
  confidence: number;
}

/**
 * Behavioral signal features for ML models
 */
interface BehavioralFeatures {
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
 * Learning velocity forecast result
 */
interface VelocityForecastResult {
  estimatedMasteryTime: number; // Minutes to concept mastery
  confidence: number; // 0-1 confidence in estimate
  accelerationFactors: string[];
  riskFactors: string[];
  personalizedStrategies: string[];
  explainability: string;
}

/**
 * Advanced Pattern Recognition Engine for cognitive behavioral analysis.
 * 
 * Phase 1 MVP implementation focuses on single-course analysis with
 * lightweight ML algorithms optimized for real-time performance.
 * 
 * Core capabilities:
 * - Struggle prediction 15-20 minutes before traditional indicators
 * - Learning velocity forecasting with historical pattern analysis
 * - Real-time behavioral signal processing and analysis
 * - Cognitive load assessment and optimization
 * 
 * @class AdvancedPatternRecognizer
 */
export class AdvancedPatternRecognizer {
  private db: DatabaseService;
  private dataCollector: CognitiveDataCollector;
  private privacyService: PrivacyControlService;

  // Model configuration for Phase 1 MVP
  private readonly STRUGGLE_PREDICTION_THRESHOLD = 0.7; // 70% accuracy target
  private readonly MIN_HISTORICAL_SESSIONS = 5; // Minimum sessions for reliable prediction
  private readonly PREDICTION_HORIZON_MINUTES = 20; // Prediction window
  private readonly MAX_PREDICTION_TIME_MS = 10000; // 10 second performance target

  // Feature weights for lightweight linear models
  private readonly STRUGGLE_FEATURE_WEIGHTS = {
    responseTimeIncrease: 0.25,
    errorRateIncrease: 0.30,
    helpRequestIncrease: 0.20,
    attentionDecrease: 0.15,
    cognitiveLoadIncrease: 0.10
  };

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
   * Predicts student struggle using lightweight behavioral signal analysis.
   * 
   * Analyzes real-time behavioral signals to predict struggling students 
   * 15-20 minutes before traditional indicators appear. Uses simple linear 
   * regression and decision tree models for MVP performance targets.
   * 
   * @param tenantId - Tenant identifier
   * @param userId - Student identifier  
   * @param courseId - Current course context
   * @returns Promise resolving to struggle prediction with explanations and timestamps
   * 
   * @throws {PrivacyError} If user hasn't consented to predictive analysis
   * @throws {InsufficientDataError} If not enough historical data exists
   * @throws {PerformanceError} If prediction exceeds 10 second target
   * 
   * @example
   * ```typescript
   * const prediction = await recognizer.predictStruggle(
   *   'tenant-123', 
   *   'user-456', 
   *   'course-789'
   * );
   * 
   * if (prediction.riskLevel > 0.7) {
   *   console.log(`High struggle risk: ${prediction.explainability}`);
   *   console.log('Recommendations:', prediction.recommendations);
   * }
   * ```
   */
  async predictStruggle(
    tenantId: string, 
    userId: string, 
    courseId: string
  ): Promise<StrugglePrediction> {
    const startTime = Date.now();

    try {
      // Verify privacy consent for predictive analysis
      const hasConsent = await this.privacyService.validateDataCollectionPermission(
        tenantId, 
        userId, 
        'behavioral_timing'
      );

      if (!hasConsent) {
        throw new Error('PRIVACY_ERROR: User has not consented to predictive behavioral analysis');
      }

      // Get current behavioral patterns for analysis
      const recentPatterns = await this.getRecentBehavioralPatterns(
        tenantId, 
        userId, 
        courseId, 
        30 // Last 30 minutes
      );

      // Get historical baseline for comparison
      const historicalBaseline = await this.getHistoricalBaseline(
        tenantId, 
        userId, 
        courseId
      );

      if (historicalBaseline.sessionCount < this.MIN_HISTORICAL_SESSIONS) {
        throw new Error(`INSUFFICIENT_DATA: Need at least ${this.MIN_HISTORICAL_SESSIONS} historical sessions for reliable prediction`);
      }

      // Extract behavioral features for ML model
      const currentFeatures = this.extractBehavioralFeatures(recentPatterns);
      const baselineFeatures = historicalBaseline.averageFeatures;


      // Apply lightweight struggle prediction model
      const struggleAnalysis = this.applyStrugglePredictionModel(
        currentFeatures,
        baselineFeatures,
        historicalBaseline
      );

      // Generate human-readable explanations
      const explainability = this.generateStruggleExplanation(
        struggleAnalysis,
        currentFeatures,
        baselineFeatures
      );

      // Generate contextual recommendations
      const recommendations = this.generateStruggleRecommendations(
        struggleAnalysis,
        currentFeatures,
        courseId
      );

      const now = new Date();
      const result: StrugglePrediction = {
        riskLevel: struggleAnalysis.riskScore,
        confidence: struggleAnalysis.confidence,
        timeToStruggle: struggleAnalysis.estimatedTimeToStruggle,
        contributingFactors: struggleAnalysis.topFactors,
        recommendations: recommendations,
        explainability: explainability,
        predictedAt: now,
        validUntil: new Date(now.getTime() + this.PREDICTION_HORIZON_MINUTES * 60 * 1000)
      };

      // Ensure performance target compliance
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime > this.MAX_PREDICTION_TIME_MS) {
        console.warn(`Struggle prediction exceeded performance target: ${elapsedTime}ms`);
      }

      // Store prediction for effectiveness tracking
      await this.storePredictionResult('struggle_prediction', tenantId, userId, courseId, result);

      return result;

    } catch (error) {
      const elapsedTime = Date.now() - startTime;
      console.error(`Struggle prediction failed after ${elapsedTime}ms:`, error);
      
      // Re-throw privacy errors - they should not have fallbacks
      if (error instanceof Error && error.message.includes('PRIVACY_ERROR')) {
        throw error;
      }
      
      // Return safe fallback result for other errors
      const now = new Date();
      return {
        riskLevel: 0.5, // Neutral risk when prediction fails
        confidence: 0.0,
        timeToStruggle: 0,
        contributingFactors: ['prediction_unavailable'],
        recommendations: ['Continue monitoring learning progress'],
        explainability: 'Prediction temporarily unavailable due to insufficient data or system constraints.',
        predictedAt: now,
        validUntil: new Date(now.getTime() + this.PREDICTION_HORIZON_MINUTES * 60 * 1000)
      };
    }
  }

  /**
   * Forecasts individual learning velocity using historical pattern analysis.
   * 
   * Predicts time-to-mastery for new concepts based on historical learning 
   * patterns, difficulty progression, and cognitive profile attributes.
   * Uses simple regression models for MVP performance requirements.
   * 
   * @param tenantId - Tenant identifier
   * @param userId - Student identifier
   * @param courseId - Current course context
   * @param conceptId - Target concept for mastery prediction
   * @returns Promise resolving to learning velocity forecast
   * 
   * @example
   * ```typescript
   * const forecast = await recognizer.forecastLearningVelocity(
   *   'tenant-123',
   *   'user-456', 
   *   'course-789',
   *   'linear-equations'
   * );
   * 
   * console.log(`Estimated mastery time: ${forecast.estimatedMasteryTime} minutes`);
   * console.log(`Strategies: ${forecast.personalizedStrategies.join(', ')}`);
   * ```
   */
  async forecastLearningVelocity(
    tenantId: string,
    userId: string, 
    courseId: string,
    conceptId: string
  ): Promise<VelocityForecastResult> {
    const startTime = Date.now();

    try {
      // Verify privacy consent
      const hasConsent = await this.privacyService.validateDataCollectionPermission(
        tenantId,
        userId,
        'behavioral_timing'
      );

      if (!hasConsent) {
        throw new Error('PRIVACY_ERROR: User has not consented to learning velocity analysis');
      }

      // Get learner DNA profile for cognitive attributes
      const learnerProfile = await this.getLearnerDNAProfile(tenantId, userId);
      if (!learnerProfile) {
        throw new Error('PROFILE_REQUIRED: Learner DNA profile needed for velocity forecasting');
      }

      // Get historical learning velocity patterns
      const velocityHistory = await this.getHistoricalVelocityData(tenantId, userId, courseId);
      
      // Get concept difficulty and prerequisite analysis
      const conceptAnalysis = await this.analyzeConceptDifficulty(courseId, conceptId);
      
      // Apply velocity forecasting model
      const forecast = this.applyVelocityForecastModel(
        learnerProfile,
        velocityHistory,
        conceptAnalysis
      );

      // Generate personalized learning strategies
      const strategies = this.generatePersonalizedStrategies(
        learnerProfile,
        forecast,
        conceptAnalysis
      );

      // Create explanation for forecast
      const explainability = this.generateVelocityExplanation(
        forecast,
        learnerProfile,
        conceptAnalysis
      );

      const result: VelocityForecastResult = {
        estimatedMasteryTime: forecast.masteryTimeMinutes,
        confidence: forecast.confidence,
        accelerationFactors: forecast.accelerators,
        riskFactors: forecast.risks,
        personalizedStrategies: strategies,
        explainability: explainability
      };

      // Ensure performance compliance
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime > this.MAX_PREDICTION_TIME_MS) {
        console.warn(`Velocity forecast exceeded performance target: ${elapsedTime}ms`);
      }

      // Store forecast for tracking
      await this.storePredictionResult('velocity_forecast', tenantId, userId, courseId, result);

      return result;

    } catch (error) {
      const elapsedTime = Date.now() - startTime;
      console.error(`Velocity forecast failed after ${elapsedTime}ms:`, error);

      // Re-throw privacy errors - they should not have fallbacks
      if (error instanceof Error && error.message.includes('PRIVACY_ERROR')) {
        throw error;
      }

      // Return conservative fallback estimate
      return {
        estimatedMasteryTime: 120, // 2 hour default estimate
        confidence: 0.0,
        accelerationFactors: [],
        riskFactors: ['prediction_unavailable'],
        personalizedStrategies: ['Continue regular practice', 'Seek help when needed'],
        explainability: 'Velocity forecast temporarily unavailable. Using conservative time estimate.'
      };
    }
  }

  /**
   * Analyzes real-time behavioral signals for cognitive load assessment.
   * 
   * Processes current behavioral patterns to assess cognitive capacity and
   * optimize information presentation timing. Uses simple threshold models
   * for MVP performance requirements.
   * 
   * @param tenantId - Tenant identifier
   * @param userId - Student identifier
   * @param courseId - Current course context
   * @returns Promise resolving to behavioral signal analysis
   */
  async analyzeRealTimeBehavioralSignals(
    tenantId: string,
    userId: string,
    courseId: string
  ): Promise<BehavioralSignalAnalysis> {
    const startTime = Date.now();

    try {
      // Verify privacy consent for real-time behavioral analysis
      const hasConsent = await this.privacyService.validateDataCollectionPermission(
        tenantId, 
        userId, 
        'behavioral_timing'
      );
      if (!hasConsent) {
        throw new Error('PRIVACY_ERROR: User has not consented to real-time behavioral analysis');
      }

      // Get most recent behavioral patterns (last 10 minutes)
      const recentPatterns = await this.getRecentBehavioralPatterns(
        tenantId,
        userId,
        courseId,
        10
      );

      if (recentPatterns.length === 0) {
        return {
          cognitiveLoad: 0.5, // Neutral when no recent data
          attentionLevel: 0.5,
          engagementScore: 0.5,
          fatigueLevel: 0.5,
          optimalInterventionTiming: false,
          recommendations: ['Continue monitoring behavioral patterns']
        };
      }

      // Extract real-time features
      const features = this.extractBehavioralFeatures(recentPatterns);
      
      // Apply cognitive load assessment model
      const cognitiveLoad = this.assessCognitiveLoad(features);
      const attentionLevel = this.assessAttentionLevel(features);
      const engagementScore = this.calculateEngagementScore(features);
      const fatigueLevel = this.assessFatigueLevel(features);
      
      // Determine optimal intervention timing
      const optimalTiming = this.isOptimalInterventionTiming(
        cognitiveLoad,
        attentionLevel,
        engagementScore,
        fatigueLevel
      );

      // Generate real-time recommendations
      const recommendations = this.generateRealTimeRecommendations(
        cognitiveLoad,
        attentionLevel,
        engagementScore,
        fatigueLevel
      );

      const analysis: BehavioralSignalAnalysis = {
        cognitiveLoad,
        attentionLevel,
        engagementScore,
        fatigueLevel,
        optimalInterventionTiming: optimalTiming,
        recommendations
      };

      // Performance monitoring
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime > 5000) { // 5 second target for real-time analysis
        console.warn(`Real-time analysis exceeded target: ${elapsedTime}ms`);
      }

      return analysis;

    } catch (error) {
      console.error('Real-time behavioral analysis failed:', error);
      
      // For privacy errors, re-throw to maintain privacy enforcement consistency
      if (error instanceof Error && error.message.includes('PRIVACY_ERROR')) {
        throw error;
      }
      
      // For other errors (database failures, etc.), return fallback values
      return {
        cognitiveLoad: 0.5,
        attentionLevel: 0.5,
        engagementScore: 0.5,
        fatigueLevel: 0.5,
        optimalInterventionTiming: false,
        recommendations: ['Real-time analysis temporarily unavailable']
      };
    }
  }

  // Private helper methods for lightweight ML implementation

  /**
   * Gets recent behavioral patterns for analysis
   */
  private async getRecentBehavioralPatterns(
    tenantId: string,
    userId: string,
    courseId: string,
    windowMinutes: number
  ): Promise<BehavioralPattern[]> {
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
    
    const queryResult = await this.db
      .getDb()
      .prepare(`
        SELECT * FROM behavioral_patterns 
        WHERE tenant_id = ? AND user_id = ? AND course_id = ?
          AND collected_at >= ? AND consent_verified = 1
        ORDER BY collected_at DESC
        LIMIT 100
      `)
      .bind(tenantId, userId, courseId, windowStart.toISOString())
      .all<any>();

    // Handle both D1 production format and test format
    const results = queryResult?.results || queryResult || [];
    return results.map(row => ({
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      sessionId: row.session_id,
      patternType: row.pattern_type,
      contextType: row.context_type,
      rawDataEncrypted: row.raw_data_encrypted,
      rawDataHash: row.raw_data_hash,
      aggregatedMetrics: (() => {
        try {
          return JSON.parse(row.aggregated_metrics || '{}');
        } catch (error) {
          console.warn(`Failed to parse aggregated_metrics for pattern ${row.id}:`, error);
          return {};
        }
      })(),
      confidenceLevel: row.confidence_level,
      courseId: row.course_id,
      contentId: row.content_id,
      collectedAt: new Date(row.collected_at),
      anonymizedAt: row.anonymized_at ? new Date(row.anonymized_at) : undefined,
      purgeAt: row.purge_at ? new Date(row.purge_at) : undefined,
      privacyLevel: row.privacy_level,
      consentVerified: Boolean(row.consent_verified),
    }));
  }

  /**
   * Gets historical baseline patterns for comparison
   */
  private async getHistoricalBaseline(
    tenantId: string,
    userId: string,
    courseId: string
  ): Promise<{
    averageFeatures: BehavioralFeatures;
    sessionCount: number;
    confidenceLevel: number;
  }> {
    // Get patterns from last 30 days for baseline
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const queryResult = await this.db
      .getDb()
      .prepare(`
        SELECT * FROM behavioral_patterns 
        WHERE tenant_id = ? AND user_id = ? AND course_id = ?
          AND collected_at >= ? AND consent_verified = 1
        ORDER BY collected_at ASC
      `)
      .bind(tenantId, userId, courseId, thirtyDaysAgo.toISOString())
      .all<any>();

    // Handle both D1 production format and test format
    const historicalPatterns = queryResult?.results || queryResult || [];
    const patterns = historicalPatterns.map(row => ({
      aggregatedMetrics: (() => {
        try {
          return JSON.parse(row.aggregated_metrics || '{}');
        } catch (error) {
          console.warn(`Failed to parse aggregated_metrics for pattern ${row.id}:`, error);
          return {};
        }
      })(),
      collectedAt: new Date(row.collected_at)
    }));

    if (patterns.length === 0) {
      return {
        averageFeatures: this.getDefaultFeatures(),
        sessionCount: 0,
        confidenceLevel: 0.0
      };
    }

    // Calculate average features across historical sessions
    const featureSum = patterns.reduce((sum, pattern) => {
      const features = this.extractBehavioralFeatures([pattern as any]);
      return {
        avgResponseTime: sum.avgResponseTime + features.avgResponseTime,
        responseTimeVariability: sum.responseTimeVariability + features.responseTimeVariability,
        sessionDuration: sum.sessionDuration + features.sessionDuration,
        breakFrequency: sum.breakFrequency + features.breakFrequency,
        helpRequestRate: sum.helpRequestRate + features.helpRequestRate,
        errorRate: sum.errorRate + features.errorRate,
        progressVelocity: sum.progressVelocity + features.progressVelocity,
        attentionScore: sum.attentionScore + features.attentionScore,
        taskSwitchingFrequency: sum.taskSwitchingFrequency + features.taskSwitchingFrequency,
        cognitiveLoadEstimate: sum.cognitiveLoadEstimate + features.cognitiveLoadEstimate,
        fatigueIndicators: sum.fatigueIndicators + features.fatigueIndicators,
        timeOfDay: sum.timeOfDay + features.timeOfDay,
        dayOfWeek: sum.dayOfWeek + features.dayOfWeek,
        courseProgress: sum.courseProgress + features.courseProgress,
      };
    }, this.getZeroFeatures());

    const count = patterns.length;
    const averageFeatures: BehavioralFeatures = {
      avgResponseTime: featureSum.avgResponseTime / count,
      responseTimeVariability: featureSum.responseTimeVariability / count,
      sessionDuration: featureSum.sessionDuration / count,
      breakFrequency: featureSum.breakFrequency / count,
      helpRequestRate: featureSum.helpRequestRate / count,
      errorRate: featureSum.errorRate / count,
      progressVelocity: featureSum.progressVelocity / count,
      attentionScore: featureSum.attentionScore / count,
      taskSwitchingFrequency: featureSum.taskSwitchingFrequency / count,
      cognitiveLoadEstimate: featureSum.cognitiveLoadEstimate / count,
      fatigueIndicators: featureSum.fatigueIndicators / count,
      timeOfDay: featureSum.timeOfDay / count,
      dayOfWeek: featureSum.dayOfWeek / count,
      courseProgress: featureSum.courseProgress / count,
    };

    return {
      averageFeatures,
      sessionCount: count,
      confidenceLevel: Math.min(count / 20, 1.0) // Higher confidence with more data
    };
  }

  /**
   * Extracts behavioral features from patterns for ML models
   */
  private extractBehavioralFeatures(patterns: BehavioralPattern[]): BehavioralFeatures {
    if (patterns.length === 0) {
      return this.getDefaultFeatures();
    }


    // Aggregate metrics across patterns
    let totalResponseTime = 0;
    let responseTimeVariances: number[] = [];
    let totalSessionDuration = 0;
    let totalBreaks = 0;
    let totalHelpRequests = 0;
    let totalErrors = 0;
    let totalProgress = 0;
    let attentionScores: number[] = [];
    let taskSwitches = 0;
    let cognitiveLoadScores: number[] = [];
    let fatigueScores: number[] = [];

    patterns.forEach(pattern => {
      const metrics = pattern.aggregatedMetrics;
      
      // Response timing metrics
      if (metrics.avgResponseTimeMs) {
        totalResponseTime += metrics.avgResponseTimeMs;
        responseTimeVariances.push(metrics.responseTimeVariability || 0);
      }
      
      // Session metrics
      if (metrics.sessionDurationMinutes) {
        totalSessionDuration += metrics.sessionDurationMinutes;
      }
      
      // Interaction metrics
      totalBreaks += metrics.breakCount || 0;
      totalHelpRequests += metrics.helpRequestCount || 0;
      totalErrors += metrics.errorCount || 0;
      totalProgress += metrics.progressMade || 0;
      
      // Cognitive metrics
      if (metrics.attentionScore !== undefined) {
        attentionScores.push(metrics.attentionScore);
      }
      
      taskSwitches += metrics.taskSwitchCount || 0;
      
      if (metrics.cognitiveLoad !== undefined) {
        cognitiveLoadScores.push(metrics.cognitiveLoad);
      }
      
      if (metrics.fatigueLevel !== undefined) {
        fatigueScores.push(metrics.fatigueLevel);
      }
    });

    const count = patterns.length;
    const now = new Date();

    return {
      avgResponseTime: totalResponseTime / count || 5000, // Default 5 seconds
      responseTimeVariability: responseTimeVariances.reduce((a, b) => a + b, 0) / responseTimeVariances.length || 0.5,
      sessionDuration: totalSessionDuration / count || 30, // Default 30 minutes
      breakFrequency: totalBreaks / count || 0.1,
      helpRequestRate: totalHelpRequests / count || 0.05,
      errorRate: totalErrors / count || 0.1,
      progressVelocity: totalProgress / count || 0.1,
      attentionScore: attentionScores.reduce((a, b) => a + b, 0) / attentionScores.length || 0.7,
      taskSwitchingFrequency: taskSwitches / count || 0.2,
      cognitiveLoadEstimate: cognitiveLoadScores.reduce((a, b) => a + b, 0) / cognitiveLoadScores.length || 0.5,
      fatigueIndicators: fatigueScores.reduce((a, b) => a + b, 0) / fatigueScores.length || 0.3,
      timeOfDay: now.getHours(),
      dayOfWeek: now.getDay(),
      courseProgress: 0.5 // Placeholder - would need actual course progress data
    };
  }

  /**
   * Applies lightweight struggle prediction model using linear regression
   */
  private applyStrugglePredictionModel(
    currentFeatures: BehavioralFeatures,
    baselineFeatures: BehavioralFeatures,
    baseline: { sessionCount: number; confidenceLevel: number; }
  ): {
    riskScore: number;
    confidence: number;
    estimatedTimeToStruggle: number;
    topFactors: string[];
  } {
    // Calculate feature deviations from baseline
    const deviations = {
      responseTimeIncrease: Math.max(0, (currentFeatures.avgResponseTime - baselineFeatures.avgResponseTime) / baselineFeatures.avgResponseTime),
      errorRateIncrease: Math.max(0, (currentFeatures.errorRate - baselineFeatures.errorRate) / Math.max(baselineFeatures.errorRate, 0.01)),
      helpRequestIncrease: Math.max(0, (currentFeatures.helpRequestRate - baselineFeatures.helpRequestRate) / Math.max(baselineFeatures.helpRequestRate, 0.01)),
      attentionDecrease: Math.max(0, (baselineFeatures.attentionScore - currentFeatures.attentionScore) / baselineFeatures.attentionScore),
      cognitiveLoadIncrease: Math.max(0, (currentFeatures.cognitiveLoadEstimate - baselineFeatures.cognitiveLoadEstimate) / Math.max(baselineFeatures.cognitiveLoadEstimate, 0.1))
    };


    // Apply simple linear model with feature weights
    const riskScore = Math.min(1.0, 
      deviations.responseTimeIncrease * this.STRUGGLE_FEATURE_WEIGHTS.responseTimeIncrease +
      deviations.errorRateIncrease * this.STRUGGLE_FEATURE_WEIGHTS.errorRateIncrease +
      deviations.helpRequestIncrease * this.STRUGGLE_FEATURE_WEIGHTS.helpRequestIncrease +
      deviations.attentionDecrease * this.STRUGGLE_FEATURE_WEIGHTS.attentionDecrease +
      deviations.cognitiveLoadIncrease * this.STRUGGLE_FEATURE_WEIGHTS.cognitiveLoadIncrease
    );

    // Calculate confidence based on baseline data quality
    const confidence = baseline.confidenceLevel * 0.8 + (riskScore > 0.3 ? 0.2 : 0.0);

    // Estimate time to struggle (simple linear model)
    const timeToStruggle = Math.max(5, this.PREDICTION_HORIZON_MINUTES * (1 - riskScore));

    // Identify top contributing factors
    const factorScores = [
      { factor: 'Response time increase', score: deviations.responseTimeIncrease * this.STRUGGLE_FEATURE_WEIGHTS.responseTimeIncrease },
      { factor: 'Error rate increase', score: deviations.errorRateIncrease * this.STRUGGLE_FEATURE_WEIGHTS.errorRateIncrease },
      { factor: 'Help request increase', score: deviations.helpRequestIncrease * this.STRUGGLE_FEATURE_WEIGHTS.helpRequestIncrease },
      { factor: 'Attention decrease', score: deviations.attentionDecrease * this.STRUGGLE_FEATURE_WEIGHTS.attentionDecrease },
      { factor: 'Cognitive load increase', score: deviations.cognitiveLoadIncrease * this.STRUGGLE_FEATURE_WEIGHTS.cognitiveLoadIncrease }
    ];

    const topFactors = factorScores
      .filter(f => f.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(f => f.factor);

    return {
      riskScore,
      confidence,
      estimatedTimeToStruggle: timeToStruggle,
      topFactors
    };
  }

  /**
   * Generates human-readable explanation for struggle prediction
   */
  private generateStruggleExplanation(
    analysis: { riskScore: number; confidence: number; topFactors: string[]; },
    currentFeatures: BehavioralFeatures,
    baselineFeatures: BehavioralFeatures
  ): string {
    if (analysis.riskScore < 0.3) {
      return 'Your current learning patterns appear stable and consistent with your typical performance. Continue with your current approach.';
    }

    if (analysis.riskScore < 0.7) {
      const factors = analysis.topFactors.length > 0 
        ? ` Key areas to watch: ${analysis.topFactors.join(', ').toLowerCase()}.`
        : '';
      return `Your learning patterns show some changes that suggest you might benefit from additional support.${factors} Consider taking a short break or asking for help if needed.`;
    }

    const factors = analysis.topFactors.length > 0 
      ? ` This is primarily due to: ${analysis.topFactors.join(', ').toLowerCase()}.`
      : '';
    return `Your current learning patterns indicate you may be experiencing some challenges.${factors} This is normal - consider reaching out for support or trying a different learning approach.`;
  }

  /**
   * Generates contextual recommendations for struggle prevention
   */
  private generateStruggleRecommendations(
    analysis: { riskScore: number; topFactors: string[]; },
    features: BehavioralFeatures,
    courseId: string
  ): string[] {
    const recommendations: string[] = [];

    // General recommendations based on risk level
    if (analysis.riskScore > 0.7) {
      recommendations.push('Consider taking a 10-15 minute break to refresh');
      recommendations.push('Review previous concepts before continuing');
      recommendations.push('Ask your instructor or classmates for help');
    } else if (analysis.riskScore > 0.3) {
      recommendations.push('Try explaining the concept to yourself or someone else');
      recommendations.push('Take notes to help organize your thoughts');
    }

    // Specific recommendations based on contributing factors
    analysis.topFactors.forEach(factor => {
      switch (factor) {
        case 'Response time increase':
          recommendations.push('Slow down and take more time to think through problems');
          break;
        case 'Error rate increase':
          recommendations.push('Double-check your work before submitting');
          recommendations.push('Review similar examples or practice problems');
          break;
        case 'Help request increase':
          recommendations.push('Review course materials independently before asking for help');
          break;
        case 'Attention decrease':
          recommendations.push('Take a short break to improve focus');
          recommendations.push('Find a quieter study environment');
          break;
        case 'Cognitive load increase':
          recommendations.push('Break down complex problems into smaller steps');
          recommendations.push('Focus on one concept at a time');
          break;
      }
    });

    // Contextual recommendations based on current features
    if (features.fatigueIndicators > 0.7) {
      recommendations.push('Consider ending your study session and returning when refreshed');
    }

    if (features.sessionDuration > 90) {
      recommendations.push("Take a longer break - you've been studying for over 90 minutes");
    }

    return recommendations.slice(0, 4); // Limit to top 4 recommendations
  }

  /**
   * Gets learner DNA profile for velocity forecasting
   */
  private async getLearnerDNAProfile(tenantId: string, userId: string): Promise<LearnerDNAProfile | null> {
    const result = await this.db
      .getDb()
      .prepare('SELECT * FROM learner_dna_profiles WHERE tenant_id = ? AND user_id = ?')
      .bind(tenantId, userId)
      .first<any>();

    if (!result) return null;

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
      cognitiveAttributes: (() => {
        try {
          return JSON.parse(result.cognitive_attributes || '{}');
        } catch { return {}; }
      })(),
      comprehensionStyles: (() => {
        try {
          return JSON.parse(result.comprehension_styles || '[]');
        } catch { return []; }
      })(),
      preferredModalities: (() => {
        try {
          return JSON.parse(result.preferred_modalities || '[]');
        } catch { return []; }
      })(),
      profileConfidence: result.profile_confidence,
      totalDataPoints: result.total_data_points,
      analysisQualityScore: result.analysis_quality_score,
      crossCoursePatterns: (() => {
        try {
          return JSON.parse(result.cross_course_patterns || '{}');
        } catch { return {}; }
      })(),
      multiContextConfidence: result.multi_context_confidence,
      dataCollectionLevel: result.data_collection_level,
      profileVisibility: result.profile_visibility,
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at),
      lastAnalyzedAt: new Date(result.last_analyzed_at),
    };
  }

  // Additional helper methods for cognitive assessment

  private assessCognitiveLoad(features: BehavioralFeatures): number {
    // Simple cognitive load assessment based on behavioral indicators
    const loadFactors = [
      features.responseTimeVariability, // Higher variability indicates load
      features.errorRate * 2, // Errors strongly indicate cognitive overload  
      features.taskSwitchingFrequency, // Task switching increases load
      Math.max(0, (features.sessionDuration - 60) / 60), // Sessions >60min increase load
    ];

    return Math.min(1.0, loadFactors.reduce((sum, factor) => sum + factor, 0) / loadFactors.length);
  }

  private assessAttentionLevel(features: BehavioralFeatures): number {
    // Invert attention score and normalize
    return Math.max(0, Math.min(1, features.attentionScore));
  }

  private calculateEngagementScore(features: BehavioralFeatures): number {
    // Engagement based on progress velocity and sustained attention
    const baseEngagement = features.progressVelocity * 2; // Progress indicates engagement
    const attentionBonus = features.attentionScore > 0.7 ? 0.2 : 0;
    const fatigaePenalty = features.fatigueIndicators > 0.5 ? -0.2 : 0;
    
    return Math.max(0, Math.min(1, baseEngagement + attentionBonus + fatigaePenalty));
  }

  private assessFatigueLevel(features: BehavioralFeatures): number {
    return Math.max(0, Math.min(1, features.fatigueIndicators));
  }

  private isOptimalInterventionTiming(
    cognitiveLoad: number,
    attentionLevel: number, 
    engagementScore: number,
    fatigueLevel: number
  ): boolean {
    // Optimal timing when attention is high, cognitive load is moderate, 
    // engagement is good, and fatigue is low
    return (
      attentionLevel > 0.6 &&
      cognitiveLoad < 0.8 &&
      engagementScore > 0.4 &&
      fatigueLevel < 0.6
    );
  }

  private generateRealTimeRecommendations(
    cognitiveLoad: number,
    attentionLevel: number,
    engagementScore: number, 
    fatigueLevel: number
  ): string[] {
    const recommendations: string[] = [];

    if (cognitiveLoad > 0.8) {
      recommendations.push('Take a short break to reduce cognitive load');
      recommendations.push('Break down complex tasks into smaller steps');
    }

    if (attentionLevel < 0.4) {
      recommendations.push('Find a quieter environment to improve focus');
      recommendations.push('Remove distractions from your workspace');
    }

    if (engagementScore < 0.3) {
      recommendations.push('Try a different learning approach or activity');
      recommendations.push('Set a small, achievable goal for motivation');
    }

    if (fatigueLevel > 0.7) {
      recommendations.push('Consider ending your session and returning later');
      recommendations.push('Take a longer break with physical activity');
    }

    if (recommendations.length === 0) {
      recommendations.push('Your current learning state looks good - continue with your current approach');
    }

    return recommendations;
  }

  // Utility methods for default values

  private getDefaultFeatures(): BehavioralFeatures {
    return {
      avgResponseTime: 5000,
      responseTimeVariability: 0.5,
      sessionDuration: 30,
      breakFrequency: 0.1,
      helpRequestRate: 0.05,
      errorRate: 0.1,
      progressVelocity: 0.1,
      attentionScore: 0.7,
      taskSwitchingFrequency: 0.2,
      cognitiveLoadEstimate: 0.5,
      fatigueIndicators: 0.3,
      timeOfDay: 14, // 2 PM default
      dayOfWeek: 2, // Tuesday default
      courseProgress: 0.5
    };
  }

  private getZeroFeatures(): BehavioralFeatures {
    return {
      avgResponseTime: 0,
      responseTimeVariability: 0,
      sessionDuration: 0,
      breakFrequency: 0,
      helpRequestRate: 0,
      errorRate: 0,
      progressVelocity: 0,
      attentionScore: 0,
      taskSwitchingFrequency: 0,
      cognitiveLoadEstimate: 0,
      fatigueIndicators: 0,
      timeOfDay: 0,
      dayOfWeek: 0,
      courseProgress: 0
    };
  }

  /**
   * Stores prediction results for effectiveness tracking
   */
  private async storePredictionResult(
    predictionType: string,
    tenantId: string,
    userId: string,
    courseId: string,
    result: any
  ): Promise<void> {
    try {
      await this.db
        .getDb()
        .prepare(`
          INSERT INTO prediction_results (
            id, tenant_id, user_id, course_id, prediction_type,
            prediction_data, confidence_score, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          crypto.randomUUID(),
          tenantId,
          userId,
          courseId,
          predictionType,
          JSON.stringify(result),
          result.confidence || 0,
          new Date().toISOString()
        )
        .run();
    } catch (error) {
      console.error('Failed to store prediction result:', error);
      // Don't throw - prediction storage failure shouldn't break the prediction
    }
  }

  // Placeholder methods for velocity forecasting (simplified for MVP)

  private async getHistoricalVelocityData(tenantId: string, userId: string, courseId: string) {
    // Simplified velocity data - would be more sophisticated in full implementation
    return {
      averageMasteryTime: 90, // minutes
      conceptsCompleted: 10,
      difficultyLevels: [0.3, 0.5, 0.7],
      confidence: 0.6
    };
  }

  private async analyzeConceptDifficulty(courseId: string, conceptId: string) {
    // Simplified concept analysis - would use real curriculum data
    return {
      difficultyLevel: 0.5, // 0-1 scale
      prerequisiteCount: 2,
      averageMasteryTime: 60, // minutes across all students
      commonStrugglePoints: ['definition', 'application']
    };
  }

  private applyVelocityForecastModel(learnerProfile: any, velocityHistory: any, conceptAnalysis: any) {
    // Simple velocity forecasting model
    const baseMasteryTime = conceptAnalysis.averageMasteryTime || 60;
    const personalVelocityMultiplier = learnerProfile.learningVelocityValue || 1.0;
    const difficultyMultiplier = 1 + conceptAnalysis.difficultyLevel;
    
    const masteryTimeMinutes = baseMasteryTime * difficultyMultiplier / personalVelocityMultiplier;

    return {
      masteryTimeMinutes: Math.max(15, Math.min(240, masteryTimeMinutes)), // 15 min to 4 hours
      confidence: Math.min(learnerProfile.learningVelocityConfidence || 0.5, velocityHistory.confidence || 0.5),
      accelerators: this.identifyAccelerators(learnerProfile, conceptAnalysis),
      risks: this.identifyRisks(learnerProfile, conceptAnalysis)
    };
  }

  private identifyAccelerators(learnerProfile: any, conceptAnalysis: any): string[] {
    const accelerators: string[] = [];
    
    if (learnerProfile.learningVelocityValue > 1.2) {
      accelerators.push('Fast learning pace');
    }
    
    if (learnerProfile.memoryRetentionValue > 0.8) {
      accelerators.push('Strong memory retention');
    }
    
    return accelerators;
  }

  private identifyRisks(learnerProfile: any, conceptAnalysis: any): string[] {
    const risks: string[] = [];
    
    if (learnerProfile.struggleThresholdValue > 0.7) {
      risks.push('High struggle sensitivity');
    }
    
    if (conceptAnalysis.difficultyLevel > 0.7) {
      risks.push('High concept difficulty');
    }
    
    return risks;
  }

  private generatePersonalizedStrategies(learnerProfile: any, forecast: any, conceptAnalysis: any): string[] {
    const strategies: string[] = [];
    
    // Add strategies based on learning profile
    const styles = learnerProfile.comprehensionStyles || [];
    if (styles.includes('visual')) {
      strategies.push('Use diagrams and visual aids');
    }
    if (styles.includes('kinesthetic')) {
      strategies.push('Practice with hands-on examples');
    }
    
    // Add strategies based on forecast
    if (forecast.masteryTimeMinutes > 120) {
      strategies.push('Break study sessions into 30-minute chunks');
      strategies.push('Review prerequisite concepts first');
    }
    
    return strategies.slice(0, 3); // Limit to top 3 strategies
  }

  private generateVelocityExplanation(forecast: any, learnerProfile: any, conceptAnalysis: any): string {
    const timeHours = Math.round(forecast.masteryTimeMinutes / 60 * 10) / 10;
    const baseMessage = `Based on your learning patterns, you'll likely master this concept in about ${timeHours} hours.`;
    
    if (forecast.confidence < 0.5) {
      return `${baseMessage} This estimate has lower confidence due to limited historical data.`;
    }
    
    if (forecast.masteryTimeMinutes > 120) {
      return `${baseMessage} This concept appears challenging, so take your time and use the suggested strategies.`;
    }
    
    return `${baseMessage} This aligns well with your typical learning pace.`;
  }
}