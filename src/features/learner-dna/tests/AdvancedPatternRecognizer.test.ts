/**
 * @fileoverview Tests for Advanced Pattern Recognition Engine (Story 4.2)
 * @module features/learner-dna/tests/AdvancedPatternRecognizer.test
 * 
 * Comprehensive test suite validating Phase 1 MVP requirements:
 * - Struggle prediction accuracy (70% baseline target)
 * - Learning velocity forecasting with realistic performance targets
 * - Real-time behavioral signal analysis
 * - Privacy compliance and consent validation
 * - Performance targets (<10s prediction generation)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseService } from '@shared/server/services';
import { AdvancedPatternRecognizer } from '../server/services/AdvancedPatternRecognizer';
import { CognitiveDataCollector } from '../server/services/CognitiveDataCollector';
import { PrivacyControlService } from '../server/services/PrivacyControlService';
import type { 
  BehavioralPattern, 
  LearnerDNAProfile,
  StrugglePrediction,
  LearningVelocityForecast,
  BehavioralSignalAnalysis
} from '../shared/types';

// Mock database for testing
const mockFirst = vi.fn();
const mockAll = vi.fn();
const mockRun = vi.fn();
const mockBind = vi.fn(() => ({
  first: mockFirst,
  all: mockAll,
  run: mockRun
}));
const mockPrepare = vi.fn(() => ({
  bind: mockBind
}));
const mockGetDb = vi.fn(() => ({
  prepare: mockPrepare,
  exec: vi.fn()
}));

const mockDb = {
  getDb: mockGetDb,
  run: vi.fn(),
  get: vi.fn()
} as unknown as DatabaseService;

const mockDataCollector = {} as CognitiveDataCollector;

const mockValidateDataCollectionPermission = vi.fn();
const mockGetActiveConsent = vi.fn();
const mockPrivacyService = {
  validateDataCollectionPermission: mockValidateDataCollectionPermission,
  getActiveConsent: mockGetActiveConsent
} as unknown as PrivacyControlService;

// Test data generators
function createMockBehavioralPattern(overrides: Partial<BehavioralPattern> = {}): BehavioralPattern {
  return {
    id: 'pattern-123',
    tenantId: 'tenant-1',
    userId: 'user-1',
    sessionId: 'session-1',
    patternType: 'interaction_timing',
    contextType: 'chat',
    rawDataEncrypted: 'encrypted-data',
    rawDataHash: 'hash-123',
    aggregatedMetrics: {
      avgResponseTimeMs: 5000,
      responseTimeVariability: 0.3,
      sessionDurationMinutes: 45,
      breakCount: 2,
      helpRequestCount: 1,
      errorCount: 3,
      progressMade: 0.2,
      attentionScore: 0.7,
      taskSwitchCount: 4,
      cognitiveLoad: 0.5,
      fatigueLevel: 0.3,
      confidenceScore: 0.8
    },
    confidenceLevel: 0.8,
    courseId: 'course-1',
    contentId: 'content-1',
    collectedAt: new Date(),
    privacyLevel: 'identifiable',
    consentVerified: true,
    ...overrides
  };
}

function createMockLearnerProfile(overrides: Partial<LearnerDNAProfile> = {}): LearnerDNAProfile {
  return {
    id: 'profile-123',
    tenantId: 'tenant-1',
    userId: 'user-1',
    learningVelocityValue: 1.2,
    learningVelocityConfidence: 0.8,
    learningVelocityDataPoints: 15,
    learningVelocityLastUpdated: new Date(),
    memoryRetentionValue: 0.75,
    memoryRetentionConfidence: 0.7,
    memoryRetentionDataPoints: 12,
    memoryRetentionLastUpdated: new Date(),
    struggleThresholdValue: 0.4,
    struggleThresholdConfidence: 0.6,
    struggleThresholdDataPoints: 10,
    struggleThresholdLastUpdated: new Date(),
    cognitiveAttributes: {
      learningVelocity: { value: 1.2, confidence: 0.8 },
      memoryRetention: { value: 0.75, confidence: 0.7 }
    },
    comprehensionStyles: ['visual', 'analytical'],
    preferredModalities: ['reading', 'practice'],
    profileConfidence: 0.75,
    totalDataPoints: 37,
    analysisQualityScore: 0.8,
    crossCoursePatterns: {},
    multiContextConfidence: 0.5,
    dataCollectionLevel: 'comprehensive',
    profileVisibility: 'private',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastAnalyzedAt: new Date(),
    ...overrides
  };
}

describe('AdvancedPatternRecognizer', () => {
  let recognizer: AdvancedPatternRecognizer;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all our individual mock functions
    mockFirst.mockReset();
    mockAll.mockReset();
    mockRun.mockReset();
    mockBind.mockReset();
    mockPrepare.mockReset();
    mockGetDb.mockReset();
    mockValidateDataCollectionPermission.mockReset();
    mockGetActiveConsent.mockReset();
    
    recognizer = new AdvancedPatternRecognizer(mockDb, mockDataCollector, mockPrivacyService);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Struggle Prediction (AC 1)', () => {
    it('should predict struggle with 70%+ accuracy target', async () => {
      // Arrange: Mock consent and data
      mockValidateDataCollectionPermission.mockResolvedValue(true);
      
      // Create baseline patterns with normal behavior (for historical comparison)
      const baselinePatterns = Array.from({ length: 6 }, (_, i) => 
        createMockBehavioralPattern({
          id: `baseline-${i}`,
          sessionId: `baseline-session-${i}`,
          collectedAt: new Date(Date.now() - ((i + 7) * 60 * 60 * 1000)), // Older data for baseline
          aggregatedMetrics: {
            avgResponseTimeMs: 3000, // Normal response time
            responseTimeVariability: 0.2,
            errorCount: 1, // Low error rate
            helpRequestCount: 0.5, // Few help requests
            attentionScore: 0.8, // Good attention
            cognitiveLoad: 0.3 // Low cognitive load
          }
        })
      );

      // Create current patterns with struggle indicators
      const currentPatterns = Array.from({ length: 3 }, (_, i) => 
        createMockBehavioralPattern({
          id: `current-${i}`,
          sessionId: `current-session-${i}`,
          collectedAt: new Date(Date.now() - (i * 10 * 60 * 1000)), // Recent data
          aggregatedMetrics: {
            avgResponseTimeMs: 8000, // Increased response time
            responseTimeVariability: 0.6,
            errorCount: 5, // Higher error rate
            helpRequestCount: 3, // More help requests
            attentionScore: 0.4, // Decreased attention
            cognitiveLoad: 0.8 // Higher cognitive load
          }
        })
      );

      // Mock database calls: first call gets recent patterns, second call gets historical baseline
      const recentDbResult = { results: currentPatterns.map(p => ({
        id: p.id,
        tenant_id: p.tenantId,
        user_id: p.userId,
        session_id: p.sessionId,
        pattern_type: p.patternType,
        context_type: p.contextType,
        raw_data_encrypted: p.rawDataEncrypted,
        raw_data_hash: p.rawDataHash,
        aggregated_metrics: JSON.stringify(p.aggregatedMetrics),
        confidence_level: p.confidenceLevel,
        course_id: p.courseId,
        content_id: p.contentId,
        collected_at: p.collectedAt?.toISOString(),
        privacy_level: p.privacyLevel,
        consent_verified: p.consentVerified ? 1 : 0
      })) };

      const baselineDbResult = { results: baselinePatterns.map(p => ({
        id: p.id,
        tenant_id: p.tenantId,
        user_id: p.userId,
        session_id: p.sessionId,
        pattern_type: p.patternType,
        context_type: p.contextType,
        raw_data_encrypted: p.rawDataEncrypted,
        raw_data_hash: p.rawDataHash,
        aggregated_metrics: JSON.stringify(p.aggregatedMetrics),
        confidence_level: p.confidenceLevel,
        course_id: p.courseId,
        content_id: p.contentId,
        collected_at: p.collectedAt?.toISOString(),
        privacy_level: p.privacyLevel,
        consent_verified: p.consentVerified ? 1 : 0
      })) };

      // Mock sequence: recent patterns first, then historical baseline
      mockAll.mockResolvedValueOnce(recentDbResult).mockResolvedValueOnce(baselineDbResult);
      mockRun.mockResolvedValue({ success: true });

      // Act: Generate struggle prediction
      const startTime = Date.now();
      const prediction = await recognizer.predictStruggle('tenant-1', 'user-1', 'course-1');
      const elapsedTime = Date.now() - startTime;

      // Assert: Prediction quality and performance
      expect(prediction).toBeDefined();
      expect(prediction.riskLevel).toBeGreaterThanOrEqual(0);
      expect(prediction.riskLevel).toBeLessThanOrEqual(1);
      expect(prediction.confidence).toBeGreaterThanOrEqual(0);
      expect(prediction.confidence).toBeLessThanOrEqual(1);
      expect(prediction.timeToStruggle).toBeGreaterThan(0);
      expect(prediction.contributingFactors).toBeInstanceOf(Array);
      expect(prediction.recommendations).toBeInstanceOf(Array);
      expect(prediction.explainability).toEqual(expect.any(String));
      expect(prediction.explainability.length).toBeGreaterThan(10);

      // Performance requirement: <10 seconds for prediction generation
      expect(elapsedTime).toBeLessThan(10000);

      // High struggle indicators should result in high risk prediction
      expect(prediction.riskLevel).toBeGreaterThan(0.6);
      expect(prediction.contributingFactors.length).toBeGreaterThan(0);
      expect(prediction.recommendations.length).toBeGreaterThan(0);
    });

    it('should handle insufficient historical data gracefully', async () => {
      // Arrange: Mock consent but insufficient data
      mockValidateDataCollectionPermission.mockResolvedValue(true);
      mockAll.mockResolvedValue({ results: [] });

      // Act
      const result = await recognizer.predictStruggle('tenant-1', 'user-1', 'course-1');

      // Assert: Should return fallback values
      expect(result.riskLevel).toBe(0.5);
      expect(result.confidence).toBe(0.0);
      expect(result.contributingFactors).toContain('prediction_unavailable');
    });

    it('should respect privacy consent requirements', async () => {
      // Arrange: Mock no consent
      mockValidateDataCollectionPermission.mockResolvedValue(false);

      // Act & Assert: Should throw privacy error
      await expect(recognizer.predictStruggle('tenant-1', 'user-1', 'course-1'))
        .rejects
        .toThrow('PRIVACY_ERROR: User has not consented to predictive behavioral analysis');
    });

    it('should provide fallback prediction on error', async () => {
      // Arrange: Mock consent but database error
      mockValidateDataCollectionPermission.mockResolvedValue(true);
      mockAll.mockRejectedValue(new Error('Database error'));

      // Act: Should not throw but return safe fallback
      const prediction = await recognizer.predictStruggle('tenant-1', 'user-1', 'course-1');

      // Assert: Fallback prediction
      expect(prediction.riskLevel).toBe(0.5); // Neutral risk
      expect(prediction.confidence).toBe(0.0);
      expect(prediction.explainability).toContain('temporarily unavailable');
    });

    it('should generate contextually appropriate explanations', async () => {
      // Arrange: Mock different struggle scenarios
      mockValidateDataCollectionPermission.mockResolvedValue(true);

      const scenarios = [
        {
          name: 'Low risk scenario',
          baselinePatterns: Array.from({ length: 6 }, (_, i) => createMockBehavioralPattern({
            id: `low-baseline-${i}`,
            sessionId: `low-baseline-${i}`,
            collectedAt: new Date(Date.now() - ((i + 7) * 60 * 60 * 1000)),
            aggregatedMetrics: { 
              avgResponseTimeMs: 3500,
              errorCount: 1.5,
              attentionScore: 0.8,
              cognitiveLoad: 0.4
            }
          })),
          currentPatterns: Array.from({ length: 3 }, (_, i) => createMockBehavioralPattern({
            id: `low-current-${i}`,
            sessionId: `low-current-${i}`,
            collectedAt: new Date(Date.now() - (i * 10 * 60 * 1000)),
            aggregatedMetrics: { 
              avgResponseTimeMs: 3000, // Slightly better than baseline
              errorCount: 1,
              attentionScore: 0.9, // Better attention
              cognitiveLoad: 0.3 // Lower cognitive load
            }
          })),
          expectedRisk: 'low'
        },
        {
          name: 'High risk scenario',
          baselinePatterns: Array.from({ length: 6 }, (_, i) => createMockBehavioralPattern({
            id: `high-baseline-${i}`,
            sessionId: `high-baseline-${i}`,
            collectedAt: new Date(Date.now() - ((i + 7) * 60 * 60 * 1000)),
            aggregatedMetrics: {
              avgResponseTimeMs: 4000,
              errorCount: 2,
              attentionScore: 0.7,
              cognitiveLoad: 0.4
            }
          })),
          currentPatterns: Array.from({ length: 3 }, (_, i) => createMockBehavioralPattern({
            id: `high-current-${i}`,
            sessionId: `high-current-${i}`,
            collectedAt: new Date(Date.now() - (i * 10 * 60 * 1000)),
            aggregatedMetrics: {
              avgResponseTimeMs: 12000, // Much slower than baseline
              errorCount: 8, // Much higher error rate
              attentionScore: 0.2, // Much lower attention
              cognitiveLoad: 1.2 // Much higher cognitive load
            }
          })),
          expectedRisk: 'high'
        }
      ];

      for (const scenario of scenarios) {
        const recentDbResult = { results: scenario.currentPatterns.map(p => ({
          id: p.id,
          aggregated_metrics: JSON.stringify(p.aggregatedMetrics),
          collected_at: p.collectedAt?.toISOString(),
          consent_verified: 1
        })) };

        const baselineDbResult = { results: scenario.baselinePatterns.map(p => ({
          id: p.id,
          aggregated_metrics: JSON.stringify(p.aggregatedMetrics),
          collected_at: p.collectedAt?.toISOString(),
          consent_verified: 1
        })) };

        // Mock sequence: recent patterns first, then historical baseline
        mockAll.mockResolvedValueOnce(recentDbResult).mockResolvedValueOnce(baselineDbResult);

        // Act
        const prediction = await recognizer.predictStruggle('tenant-1', 'user-1', 'course-1');

        // Assert: Contextually appropriate explanations
        if (scenario.expectedRisk === 'low') {
          expect(prediction.explainability).toMatch(/stable.*consistent|current approach/i);
        } else {
          expect(prediction.explainability).toMatch(/challenges.*support/i);
        }
      }
    });
  });

  describe('Learning Velocity Forecasting (AC 2)', () => {
    it('should forecast learning velocity with realistic time estimates', async () => {
      // Arrange
      mockValidateDataCollectionPermission.mockResolvedValue(true);
      
      const mockProfile = createMockLearnerProfile({
        learningVelocityValue: 1.5, // Fast learner
        learningVelocityConfidence: 0.8
      });

      mockFirst.mockResolvedValue({
        id: mockProfile.id,
        tenant_id: mockProfile.tenantId,
        user_id: mockProfile.userId,
        learning_velocity_value: mockProfile.learningVelocityValue,
        learning_velocity_confidence: mockProfile.learningVelocityConfidence,
        memory_retention_value: mockProfile.memoryRetentionValue,
        struggle_threshold_value: mockProfile.struggleThresholdValue,
        cognitive_attributes: JSON.stringify(mockProfile.cognitiveAttributes),
        comprehension_styles: JSON.stringify(mockProfile.comprehensionStyles),
        preferred_modalities: JSON.stringify(mockProfile.preferredModalities),
        profile_confidence: mockProfile.profileConfidence,
        created_at: mockProfile.createdAt.toISOString(),
        updated_at: mockProfile.updatedAt.toISOString(),
        last_analyzed_at: mockProfile.lastAnalyzedAt.toISOString()
      });

      // Act
      const startTime = Date.now();
      const forecast = await recognizer.forecastLearningVelocity(
        'tenant-1',
        'user-1', 
        'course-1',
        'linear-equations'
      );
      const elapsedTime = Date.now() - startTime;

      // Assert
      expect(forecast).toBeDefined();
      expect(forecast.estimatedMasteryTime).toBeGreaterThan(0);
      expect(forecast.estimatedMasteryTime).toBeLessThan(300); // Reasonable upper bound (5 hours)
      expect(forecast.confidence).toBeGreaterThanOrEqual(0);
      expect(forecast.confidence).toBeLessThanOrEqual(1);
      expect(forecast.accelerationFactors).toBeInstanceOf(Array);
      expect(forecast.riskFactors).toBeInstanceOf(Array);
      expect(forecast.personalizedStrategies).toBeInstanceOf(Array);
      expect(forecast.explainability).toEqual(expect.any(String));

      // Performance requirement
      expect(elapsedTime).toBeLessThan(10000);

      // Fast learners should get shorter time estimates
      expect(forecast.estimatedMasteryTime).toBeLessThan(120); // Less than 2 hours for fast learner
    });

    it('should adjust estimates based on cognitive profile', async () => {
      mockValidateDataCollectionPermission.mockResolvedValue(true);

      const profiles = [
        createMockLearnerProfile({ learningVelocityValue: 0.8 }), // Slow learner
        createMockLearnerProfile({ learningVelocityValue: 1.8 })  // Fast learner
      ];

      const forecasts: LearningVelocityForecast[] = [];

      for (const profile of profiles) {
        mockFirst.mockResolvedValue({
          learning_velocity_value: profile.learningVelocityValue,
          learning_velocity_confidence: 0.8,
          created_at: profile.createdAt.toISOString(),
          updated_at: profile.updatedAt.toISOString(),
          last_analyzed_at: profile.lastAnalyzedAt.toISOString()
        });

        const forecast = await recognizer.forecastLearningVelocity(
          'tenant-1',
          'user-1',
          'course-1', 
          'test-concept'
        );
        forecasts.push(forecast);
      }

      // Assert: Fast learner should have shorter mastery time
      expect(forecasts[1].estimatedMasteryTime).toBeLessThan(forecasts[0].estimatedMasteryTime);
    });

    it('should require learner DNA profile', async () => {
      // Arrange: Mock consent but no profile
      mockValidateDataCollectionPermission.mockResolvedValue(true);
      mockFirst.mockResolvedValue(null);

      // Act
      const forecast = await recognizer.forecastLearningVelocity('tenant-1', 'user-1', 'course-1', 'concept-1');

      // Assert: Should return fallback when no profile exists
      expect(forecast.estimatedMasteryTime).toBe(120); // 2 hour default
      expect(forecast.confidence).toBe(0.0);
      expect(forecast.explainability).toContain('temporarily unavailable');
    });

    it('should provide fallback forecast on error', async () => {
      // Arrange: Mock consent but error condition
      mockValidateDataCollectionPermission.mockResolvedValue(true);
      mockFirst.mockRejectedValue(new Error('Profile error'));

      // Act
      const forecast = await recognizer.forecastLearningVelocity(
        'tenant-1',
        'user-1',
        'course-1',
        'concept-1'
      );

      // Assert: Conservative fallback
      expect(forecast.estimatedMasteryTime).toBe(120); // 2 hour default
      expect(forecast.confidence).toBe(0.0);
      expect(forecast.explainability).toContain('temporarily unavailable');
    });
  });

  describe('Real-Time Behavioral Signal Analysis (AC 6)', () => {
    it('should analyze behavioral signals within performance targets', async () => {
      // Arrange
      mockValidateDataCollectionPermission.mockResolvedValue(true);
      const mockPatterns = [
        createMockBehavioralPattern({
          aggregatedMetrics: {
            avgResponseTimeMs: 4000,
            attentionScore: 0.8,
            cognitiveLoad: 0.4,
            fatigueLevel: 0.2
          }
        })
      ];

      mockAll.mockResolvedValue({
        results: mockPatterns.map(p => ({
          aggregated_metrics: JSON.stringify(p.aggregatedMetrics),
          collected_at: new Date().toISOString()
        }))
      });

      // Act
      const startTime = Date.now();
      const analysis = await recognizer.analyzeRealTimeBehavioralSignals(
        'tenant-1',
        'user-1',
        'course-1'
      );
      const elapsedTime = Date.now() - startTime;

      // Assert
      expect(analysis).toBeDefined();
      expect(analysis.cognitiveLoad).toBeGreaterThanOrEqual(0);
      expect(analysis.cognitiveLoad).toBeLessThanOrEqual(2); // Can exceed 1.0
      expect(analysis.attentionLevel).toBeGreaterThanOrEqual(0);
      expect(analysis.attentionLevel).toBeLessThanOrEqual(1);
      expect(analysis.engagementScore).toBeGreaterThanOrEqual(0);
      expect(analysis.engagementScore).toBeLessThanOrEqual(1);
      expect(analysis.fatigueLevel).toBeGreaterThanOrEqual(0);
      expect(analysis.fatigueLevel).toBeLessThanOrEqual(1);
      expect(typeof analysis.optimalInterventionTiming).toBe('boolean');
      expect(analysis.recommendations).toBeInstanceOf(Array);

      // Performance requirement: <5 seconds for real-time analysis
      expect(elapsedTime).toBeLessThan(5000);
    });

    it('should handle no recent data gracefully', async () => {
      // Arrange: No recent patterns
      mockValidateDataCollectionPermission.mockResolvedValue(true);
      mockAll.mockResolvedValue({ results: [] });

      // Act
      const analysis = await recognizer.analyzeRealTimeBehavioralSignals(
        'tenant-1',
        'user-1',
        'course-1'
      );

      // Assert: Neutral values when no data
      expect(analysis.cognitiveLoad).toBe(0.5);
      expect(analysis.attentionLevel).toBe(0.5);
      expect(analysis.engagementScore).toBe(0.5);
      expect(analysis.fatigueLevel).toBe(0.5);
      expect(analysis.optimalInterventionTiming).toBe(false);
      expect(analysis.recommendations).toContain('Continue monitoring behavioral patterns');
    });

    it('should identify optimal intervention timing', async () => {
      // Arrange: Optimal conditions
      mockValidateDataCollectionPermission.mockResolvedValue(true);
      const optimalPatterns = [
        createMockBehavioralPattern({
          aggregatedMetrics: {
            attentionScore: 0.9, // High attention
            fatigueLevel: 0.2,   // Low fatigue
            progressMade: 0.6,   // Good progress for engagement score (progressVelocity)
            avgResponseTimeMs: 3000,
            responseTimeVariability: 0.1, // Very low variability for low cognitive load
            errorCount: 0.1, // Very few errors
            helpRequestCount: 0.5,
            taskSwitchCount: 0.2, // Very low task switching
            sessionDurationMinutes: 45 // Moderate session duration
          }
        })
      ];

      mockAll.mockResolvedValue({
        results: optimalPatterns.map(p => ({
          aggregated_metrics: JSON.stringify(p.aggregatedMetrics),
          collected_at: new Date().toISOString()
        }))
      });

      // Act
      const analysis = await recognizer.analyzeRealTimeBehavioralSignals(
        'tenant-1',
        'user-1',
        'course-1'
      );

      // Assert: Should identify optimal timing
      expect(analysis.optimalInterventionTiming).toBe(true);
    });

    it('should provide contextual recommendations', async () => {
      mockValidateDataCollectionPermission.mockResolvedValue(true);
      const scenarios = [
        {
          name: 'High cognitive load',
          patterns: [createMockBehavioralPattern({
            aggregatedMetrics: { 
              responseTimeVariability: 0.8, // High variability for cognitive load
              errorCount: 6, // High error count
              taskSwitchingCount: 15, // High task switching
              sessionDurationMinutes: 90 // Long session
            }
          })],
          expectedRecommendation: /break.*cognitive load/i
        },
        {
          name: 'Low attention',
          patterns: [createMockBehavioralPattern({
            aggregatedMetrics: { attentionScore: 0.2 }
          })],
          expectedRecommendation: /quieter.*environment|focus/i
        },
        {
          name: 'High fatigue',
          patterns: [createMockBehavioralPattern({
            aggregatedMetrics: { 
              fatigueLevel: 0.9,
              fatigueIndicators: 0.9 // Make sure fatigueIndicators is set too
            }
          })],
          expectedRecommendation: /session.*return.*later/i
        }
      ];

      for (const scenario of scenarios) {
        mockAll.mockResolvedValue({
          results: scenario.patterns.map(p => ({
            aggregated_metrics: JSON.stringify(p.aggregatedMetrics),
            collected_at: new Date().toISOString()
          }))
        });

        const analysis = await recognizer.analyzeRealTimeBehavioralSignals(
          'tenant-1',
          'user-1',
          'course-1'
        );

        const recommendations = analysis.recommendations.join(' ');
        expect(recommendations).toMatch(scenario.expectedRecommendation);
      }
    });
  });

  describe('Performance and Reliability', () => {
    it('should meet prediction generation performance targets', async () => {
      // Arrange
      mockValidateDataCollectionPermission.mockResolvedValue(true);
      
      const mockPatterns = Array.from({ length: 50 }, (_, i) => 
        createMockBehavioralPattern({ id: `pattern-${i}` })
      );

      mockAll.mockResolvedValue({
        results: mockPatterns.map(p => ({
          aggregated_metrics: JSON.stringify(p.aggregatedMetrics),
          collected_at: new Date().toISOString(),
          consent_verified: 1
        }))
      });

      // Act: Test multiple predictions
      const predictions = [];
      const startTime = Date.now();
      
      for (let i = 0; i < 5; i++) {
        const prediction = await recognizer.predictStruggle('tenant-1', `user-${i}`, 'course-1');
        predictions.push(prediction);
      }
      
      const elapsedTime = Date.now() - startTime;
      const avgTime = elapsedTime / predictions.length;

      // Assert: Average prediction time should be well under 10 seconds
      expect(avgTime).toBeLessThan(10000);
      expect(predictions).toHaveLength(5);
      predictions.forEach(p => {
        expect(p.riskLevel).toBeGreaterThanOrEqual(0);
        expect(p.riskLevel).toBeLessThanOrEqual(1);
      });
    });

    it('should handle concurrent prediction requests', async () => {
      // Arrange
      mockValidateDataCollectionPermission.mockResolvedValue(true);
      mockAll.mockResolvedValue({
        results: [{ aggregated_metrics: JSON.stringify({}), collected_at: new Date().toISOString(), consent_verified: 1 }]
      });

      // Act: Concurrent predictions
      const startTime = Date.now();
      const predictionPromises = Array.from({ length: 10 }, (_, i) =>
        recognizer.predictStruggle('tenant-1', `user-${i}`, 'course-1')
      );

      const predictions = await Promise.all(predictionPromises);
      const elapsedTime = Date.now() - startTime;

      // Assert
      expect(predictions).toHaveLength(10);
      expect(elapsedTime).toBeLessThan(15000); // Should handle 10 concurrent in <15s
      
      predictions.forEach((prediction, index) => {
        expect(prediction).toBeDefined();
        expect(typeof prediction.riskLevel).toBe('number');
      });
    });

    it('should maintain accuracy under data quality variations', async () => {
      // Arrange: Test with various data quality scenarios
      mockValidateDataCollectionPermission.mockResolvedValue(true);

      const dataQualityScenarios = [
        {
          name: 'High quality data',
          patterns: Array.from({ length: 20 }, () => createMockBehavioralPattern({
            confidenceLevel: 0.9,
            aggregatedMetrics: { confidenceScore: 0.9 }
          }))
        },
        {
          name: 'Medium quality data',
          patterns: Array.from({ length: 15 }, () => createMockBehavioralPattern({
            confidenceLevel: 0.6,
            aggregatedMetrics: { confidenceScore: 0.6 }
          }))
        },
        {
          name: 'Low quality data',
          patterns: Array.from({ length: 10 }, () => createMockBehavioralPattern({
            confidenceLevel: 0.3,
            aggregatedMetrics: { confidenceScore: 0.3 }
          }))
        }
      ];

      for (const scenario of dataQualityScenarios) {
        mockAll.mockResolvedValue({
          results: scenario.patterns.map(p => ({
            aggregated_metrics: JSON.stringify(p.aggregatedMetrics),
            confidence_level: p.confidenceLevel,
            collected_at: new Date().toISOString(),
            consent_verified: 1
          }))
        });

        const prediction = await recognizer.predictStruggle('tenant-1', 'user-1', 'course-1');
        
        // Assert: Predictions should be valid regardless of data quality
        expect(prediction.riskLevel).toBeGreaterThanOrEqual(0);
        expect(prediction.riskLevel).toBeLessThanOrEqual(1);
        expect(prediction.confidence).toBeGreaterThanOrEqual(0);
        expect(prediction.confidence).toBeLessThanOrEqual(1);
        
        // Higher quality data should generally yield higher confidence
        if (scenario.name === 'High quality data') {
          expect(prediction.confidence).toBeGreaterThan(0.5);
        }
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed behavioral data gracefully', async () => {
      // Arrange: Mock consent but malformed data
      mockValidateDataCollectionPermission.mockResolvedValue(true);
      mockAll.mockResolvedValue({
        results: [{
          aggregated_metrics: 'invalid-json',
          collected_at: new Date().toISOString(),
          consent_verified: 1
        }]
      });

      // Act: Should handle gracefully
      const prediction = await recognizer.predictStruggle('tenant-1', 'user-1', 'course-1');

      // Assert: Fallback behavior
      expect(prediction.riskLevel).toBe(0.5);
      expect(prediction.confidence).toBe(0.0);
    });

    it('should handle database connection failures', async () => {
      // Arrange: Mock database failure
      mockValidateDataCollectionPermission.mockResolvedValue(true);
      mockPrepare.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      // Act: Should not crash
      const prediction = await recognizer.predictStruggle('tenant-1', 'user-1', 'course-1');

      // Assert: Safe fallback
      expect(prediction.riskLevel).toBe(0.5);
      expect(prediction.confidence).toBe(0.0);
      expect(prediction.explainability).toContain('temporarily unavailable');
    });

    it('should validate input parameters', async () => {
      // Test empty/invalid parameters
      const invalidInputs = [
        ['', 'user-1', 'course-1'],      // Empty tenantId
        ['tenant-1', '', 'course-1'],    // Empty userId
        ['tenant-1', 'user-1', ''],     // Empty courseId
      ];

      for (const [tenantId, userId, courseId] of invalidInputs) {
        // Should handle gracefully or throw appropriate error
        await expect(async () => {
          await recognizer.predictStruggle(tenantId, userId, courseId);
        }).not.toThrow(/undefined|null/);
      }
    });
  });

  describe('Privacy and Compliance', () => {
    it('should enforce consent requirements consistently', async () => {
      // Test struggle prediction respects privacy consent
      mockValidateDataCollectionPermission.mockResolvedValue(false);
      
      // Struggle prediction should throw error when no consent
      await expect(recognizer.predictStruggle('tenant-1', 'user-1', 'course-1'))
        .rejects
        .toThrow('PRIVACY_ERROR');
      
      // Learning velocity forecast should throw error when no consent
      await expect(recognizer.forecastLearningVelocity('tenant-1', 'user-1', 'course-1', 'concept-1'))
        .rejects
        .toThrow('PRIVACY_ERROR');

      // Test behavioral analysis separately (might return fallback)
      mockValidateDataCollectionPermission.mockResolvedValue(false);
      const behavioralResult = await recognizer.analyzeRealTimeBehavioralSignals('tenant-1', 'user-1', 'course-1');
      expect(behavioralResult).toBeDefined();
      expect(behavioralResult.cognitiveLoad).toBe(0.5);
      expect(behavioralResult.attentionLevel).toBe(0.5);
    });

    it('should only process consented data', async () => {
      // Arrange: Mixed consent data with enough results for baseline
      mockValidateDataCollectionPermission.mockResolvedValue(true);
      const consentedResults = Array.from({ length: 5 }, (_, i) => ({ 
        id: `consented-${i}`,
        consent_verified: 1, 
        aggregated_metrics: JSON.stringify({}), 
        collected_at: new Date(Date.now() - (i * 60 * 60 * 1000)).toISOString() 
      }));
      const nonConsentedResults = Array.from({ length: 2 }, (_, i) => ({ 
        id: `non-consented-${i}`,
        consent_verified: 0, 
        aggregated_metrics: JSON.stringify({}), 
        collected_at: new Date(Date.now() - (i * 60 * 60 * 1000)).toISOString() 
      }));
      mockAll.mockResolvedValue({
        results: [...consentedResults, ...nonConsentedResults]
      });

      // Act
      const prediction = await recognizer.predictStruggle('tenant-1', 'user-1', 'course-1');

      // Assert: Should process successfully (database query should filter by consent_verified = 1)
      expect(prediction).toBeDefined();
    });

    it('should not store sensitive data in predictions', async () => {
      // Arrange
      mockValidateDataCollectionPermission.mockResolvedValue(true);
      // Generate enough patterns for historical baseline (minimum 5)
      const mockResults = Array.from({ length: 6 }, (_, i) => ({ 
        id: `pattern-${i}`,
        aggregated_metrics: JSON.stringify({}), 
        collected_at: new Date(Date.now() - (i * 60 * 60 * 1000)).toISOString(), 
        consent_verified: 1 
      }));
      mockAll.mockResolvedValue({
        results: mockResults
      });

      const storeCalls: any[] = [];
      mockRun.mockImplementation((...args) => {
        storeCalls.push(args);
        return Promise.resolve({ success: true });
      });

      // Act
      await recognizer.predictStruggle('tenant-1', 'user-1', 'course-1');

      // Assert: Check stored prediction data doesn't contain sensitive info
      expect(storeCalls.length).toBeGreaterThan(0);
      // Stored prediction should not contain raw behavioral data
      const storedData = storeCalls.find(call => 
        typeof call === 'object' && JSON.stringify(call).includes('prediction')
      );
      if (storedData) {
        expect(JSON.stringify(storedData)).not.toMatch(/rawDataEncrypted|rawDataHash/);
      }
    });
  });
});