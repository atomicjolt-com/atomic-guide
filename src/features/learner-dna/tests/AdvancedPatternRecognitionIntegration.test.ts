/**
 * @fileoverview Integration tests for Story 4.2 Advanced Pattern Recognition System
 * @module features/learner-dna/tests/AdvancedPatternRecognitionIntegration.test
 * 
 * End-to-end integration tests validating the complete Story 4.2 system:
 * - Full integration between AdvancedPatternRecognizer and PredictiveInterventionEngine
 * - Privacy-aware proactive chat recommendations
 * - Database consistency and performance under realistic loads
 * - Cross-feature compatibility with existing systems
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseService } from '@shared/server/services';
import { AdvancedPatternRecognizer } from '../server/services/AdvancedPatternRecognizer';
import { PredictiveInterventionEngine } from '../server/services/PredictiveInterventionEngine';
import { PrivacyControlService } from '../server/services/PrivacyControlService';
import { CognitiveDataCollector } from '../server/services/CognitiveDataCollector';
import type { 
  LearnerDNAProfile, 
  BehavioralPattern,
  LearnerDNAPrivacyConsent
} from '../shared/types';

// Mock database for integration testing
const mockDb = {
  getDb: vi.fn(() => ({
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        first: vi.fn(),
        all: vi.fn(),
        run: vi.fn()
      }))
    })),
    exec: vi.fn()
  })),
  run: vi.fn(),
  get: vi.fn()
} as unknown as DatabaseService;

// Integration test data
const testTenantId = 'tenant-integration-test';
const testUserId = 'user-integration-test';
const testCourseId = 'course-integration-test';
const testSessionId = 'session-integration-test';

function createIntegrationProfile(): LearnerDNAProfile {
  return {
    id: 'profile-integration-test',
    tenantId: testTenantId,
    userId: testUserId,
    learningVelocityValue: 1.3,
    learningVelocityConfidence: 0.85,
    learningVelocityDataPoints: 25,
    learningVelocityLastUpdated: new Date(),
    memoryRetentionValue: 0.82,
    memoryRetentionConfidence: 0.78,
    memoryRetentionDataPoints: 20,
    memoryRetentionLastUpdated: new Date(),
    struggleThresholdValue: 0.35,
    struggleThresholdConfidence: 0.75,
    struggleThresholdDataPoints: 18,
    struggleThresholdLastUpdated: new Date(),
    cognitiveAttributes: {
      learningVelocity: { value: 1.3, confidence: 0.85 },
      memoryRetention: { value: 0.82, confidence: 0.78 },
      attentionSpan: { value: 0.7, confidence: 0.6 }
    },
    comprehensionStyles: ['visual', 'analytical', 'sequential'],
    preferredModalities: ['reading', 'practice', 'interactive'],
    profileConfidence: 0.82,
    totalDataPoints: 63,
    analysisQualityScore: 0.88,
    crossCoursePatterns: {},
    multiContextConfidence: 0.6,
    dataCollectionLevel: 'comprehensive',
    profileVisibility: 'private',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    lastAnalyzedAt: new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
  };
}

function createHistoricalBehavioralPatterns(count: number): BehavioralPattern[] {
  const patterns: BehavioralPattern[] = [];
  
  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(i / 3); // 3 patterns per day
    const baseTime = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
    
    // Simulate progression from good to struggling patterns
    const progressionFactor = i / count;
    const strugglingFactor = Math.min(progressionFactor * 1.5, 1);
    
    patterns.push({
      id: `pattern-${i}`,
      tenantId: testTenantId,
      userId: testUserId,
      sessionId: `session-${Math.floor(i / 3)}`,
      patternType: 'interaction_timing',
      contextType: 'chat',
      rawDataEncrypted: `encrypted-data-${i}`,
      rawDataHash: `hash-${i}`,
      aggregatedMetrics: {
        avgResponseTimeMs: 3000 + strugglingFactor * 8000, // 3s to 11s
        responseTimeVariability: 0.2 + strugglingFactor * 0.6, // 0.2 to 0.8
        sessionDurationMinutes: 45 - strugglingFactor * 20, // 45 to 25 minutes
        breakCount: Math.floor(strugglingFactor * 5), // 0 to 5 breaks
        helpRequestCount: Math.floor(strugglingFactor * 6), // 0 to 6 help requests
        errorCount: Math.floor(strugglingFactor * 10), // 0 to 10 errors
        progressMade: 0.3 - strugglingFactor * 0.2, // 0.3 to 0.1
        attentionScore: 0.9 - strugglingFactor * 0.6, // 0.9 to 0.3
        taskSwitchCount: Math.floor(strugglingFactor * 8), // 0 to 8 switches
        cognitiveLoad: 0.3 + strugglingFactor * 1.0, // 0.3 to 1.3
        fatigueLevel: strugglingFactor * 0.8, // 0 to 0.8
        confidenceScore: 0.9 - strugglingFactor * 0.4 // 0.9 to 0.5
      },
      confidenceLevel: 0.9 - strugglingFactor * 0.3,
      courseId: testCourseId,
      contentId: `content-${i % 5}`,
      collectedAt: new Date(baseTime - (i % 3) * 2 * 60 * 60 * 1000), // Spread across day
      privacyLevel: 'identifiable',
      consentVerified: true
    });
  }
  
  return patterns;
}

function createValidConsent(): LearnerDNAPrivacyConsent {
  return {
    id: 'consent-integration-test',
    tenantId: testTenantId,
    userId: testUserId,
    consentVersion: '1.0',
    behavioralTimingConsent: true,
    assessmentPatternsConsent: true,
    chatInteractionsConsent: true,
    crossCourseCorrelationConsent: false, // Phase 1 limitation
    anonymizedAnalyticsConsent: true,
    dataCollectionLevel: 'comprehensive',
    parentalConsentRequired: false,
    parentalConsentGiven: false,
    consentGivenAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
    consentUpdatedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    consentSource: 'dashboard'
  };
}

describe('Advanced Pattern Recognition Integration Tests', () => {
  let patternRecognizer: AdvancedPatternRecognizer;
  let interventionEngine: PredictiveInterventionEngine;
  let privacyService: PrivacyControlService;
  let dataCollector: CognitiveDataCollector;
  
  beforeAll(() => {
    // Initialize integrated services
    privacyService = new PrivacyControlService(mockDb);
    dataCollector = new CognitiveDataCollector(mockDb, privacyService);
    patternRecognizer = new AdvancedPatternRecognizer(mockDb, dataCollector, privacyService);
    interventionEngine = new PredictiveInterventionEngine(mockDb, patternRecognizer, privacyService);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('End-to-End Pattern Recognition to Intervention Pipeline', () => {
    it('should complete full pipeline from data collection to proactive recommendations', async () => {
      // Arrange: Set up complete scenario with consent and historical data
      const validConsent = createValidConsent();
      const learnerProfile = createIntegrationProfile();
      const historicalPatterns = createHistoricalBehavioralPatterns(30); // 10 days of patterns
      
      // Mock privacy service
      vi.mocked(privacyService.getActiveConsent).mockResolvedValue(validConsent);
      vi.mocked(privacyService.validateDataCollectionPermission).mockResolvedValue(true);
      
      // Mock database responses for pattern recognition
      vi.mocked(mockDb.getDb().prepare().bind().all)
        .mockResolvedValueOnce({ 
          results: historicalPatterns.slice(-10).map(p => ({ // Recent patterns
            id: p.id,
            aggregated_metrics: JSON.stringify(p.aggregatedMetrics),
            collected_at: p.collectedAt?.toISOString(),
            consent_verified: 1
          }))
        })
        .mockResolvedValueOnce({ 
          results: historicalPatterns.map(p => ({ // Historical baseline
            aggregated_metrics: JSON.stringify(p.aggregatedMetrics),
            collected_at: p.collectedAt?.toISOString(),
            consent_verified: 1
          }))
        });

      // Mock learner profile retrieval
      vi.mocked(mockDb.getDb().prepare().bind().first).mockResolvedValue({
        id: learnerProfile.id,
        tenant_id: learnerProfile.tenantId,
        user_id: learnerProfile.userId,
        learning_velocity_value: learnerProfile.learningVelocityValue,
        learning_velocity_confidence: learnerProfile.learningVelocityConfidence,
        memory_retention_value: learnerProfile.memoryRetentionValue,
        struggle_threshold_value: learnerProfile.struggleThresholdValue,
        cognitive_attributes: JSON.stringify(learnerProfile.cognitiveAttributes),
        comprehension_styles: JSON.stringify(learnerProfile.comprehensionStyles),
        preferred_modalities: JSON.stringify(learnerProfile.preferredModalities),
        profile_confidence: learnerProfile.profileConfidence,
        total_data_points: learnerProfile.totalDataPoints,
        created_at: learnerProfile.createdAt.toISOString(),
        updated_at: learnerProfile.updatedAt.toISOString(),
        last_analyzed_at: learnerProfile.lastAnalyzedAt.toISOString()
      });

      // Mock intervention storage
      vi.mocked(mockDb.getDb().prepare().bind().run).mockResolvedValue({ success: true });

      // Act: Execute complete pipeline
      const startTime = Date.now();
      
      // 1. Pattern Recognition Phase
      const [strugglePrediction, behavioralAnalysis, velocityForecast] = await Promise.all([
        patternRecognizer.predictStruggle(testTenantId, testUserId, testCourseId),
        patternRecognizer.analyzeRealTimeBehavioralSignals(testTenantId, testUserId, testCourseId),
        patternRecognizer.forecastLearningVelocity(testTenantId, testUserId, testCourseId, 'test-concept')
      ]);

      // 2. Predictive Intervention Phase
      const [proactiveRecommendations, difficultyAdjustment, microTiming] = await Promise.all([
        interventionEngine.generateProactiveRecommendations(testTenantId, testUserId, testCourseId),
        interventionEngine.generateAdaptiveDifficultyAdjustment(testTenantId, testUserId, testCourseId, 0.6),
        interventionEngine.analyzeMicroInterventionTiming(testTenantId, testUserId, testCourseId)
      ]);

      const totalElapsedTime = Date.now() - startTime;

      // Assert: Comprehensive validation of end-to-end functionality
      
      // Pattern Recognition Results
      expect(strugglePrediction).toBeDefined();
      expect(strugglePrediction.riskLevel).toBeGreaterThan(0.5); // Should detect struggling pattern
      expect(strugglePrediction.confidence).toBeGreaterThan(0.5);
      expect(strugglePrediction.contributingFactors).toContain('Response time increase');
      expect(strugglePrediction.recommendations.length).toBeGreaterThan(0);

      expect(behavioralAnalysis).toBeDefined();
      expect(behavioralAnalysis.cognitiveLoad).toBeGreaterThan(0.8); // Should detect high cognitive load
      expect(behavioralAnalysis.attentionLevel).toBeLessThan(0.5); // Should detect low attention

      expect(velocityForecast).toBeDefined();
      expect(velocityForecast.estimatedMasteryTime).toBeGreaterThan(60); // Should predict longer time due to struggles
      expect(velocityForecast.personalizedStrategies.length).toBeGreaterThan(0);

      // Predictive Intervention Results
      expect(proactiveRecommendations).toBeInstanceOf(Array);
      expect(proactiveRecommendations.length).toBeGreaterThan(0);
      
      const highPriorityRecommendation = proactiveRecommendations.find(r => r.priority === 'high' || r.priority === 'urgent');
      expect(highPriorityRecommendation).toBeDefined();
      expect(highPriorityRecommendation!.message).toContain('challenging');

      expect(difficultyAdjustment).toBeDefined();
      expect(difficultyAdjustment.recommendedDifficulty).toBeLessThan(0.6); // Should recommend easier content

      expect(microTiming).toBeDefined();
      expect(microTiming.interventionType).toMatch(/^(immediate|delayed|skip)$/);

      // Performance Requirements (Story 4.2 Phase 1 MVP targets)
      expect(totalElapsedTime).toBeLessThan(30000); // Complete pipeline <30s
      
      // Integration Quality Checks
      expect(strugglePrediction.riskLevel).toBeCloseTo(
        1 - behavioralAnalysis.attentionLevel, 
        1
      ); // Risk should correlate with attention

      // Privacy Compliance
      expect(privacyService.validateDataCollectionPermission).toHaveBeenCalledWith(
        testTenantId,
        testUserId,
        'behavioral_timing'
      );
    });

    it('should handle privacy consent withdrawal gracefully', async () => {
      // Arrange: User with withdrawn consent
      vi.mocked(privacyService.validateDataCollectionPermission).mockResolvedValue(false);
      
      // Act: Attempt to run pipeline without consent
      const results = await Promise.allSettled([
        patternRecognizer.predictStruggle(testTenantId, testUserId, testCourseId),
        patternRecognizer.analyzeRealTimeBehavioralSignals(testTenantId, testUserId, testCourseId),
        interventionEngine.generateProactiveRecommendations(testTenantId, testUserId, testCourseId)
      ]);

      // Assert: All operations should fail with privacy errors
      results.forEach(result => {
        expect(result.status).toBe('rejected');
        expect(result.reason.message).toMatch(/PRIVACY_ERROR|not consented/);
      });
    });

    it('should maintain data quality under concurrent load', async () => {
      // Arrange: Multiple concurrent users
      const users = Array.from({ length: 10 }, (_, i) => `user-concurrent-${i}`);
      
      vi.mocked(privacyService.validateDataCollectionPermission).mockResolvedValue(true);
      vi.mocked(mockDb.getDb().prepare().bind().all).mockResolvedValue({
        results: createHistoricalBehavioralPatterns(5).map(p => ({
          aggregated_metrics: JSON.stringify(p.aggregatedMetrics),
          collected_at: p.collectedAt?.toISOString(),
          consent_verified: 1
        }))
      });
      vi.mocked(mockDb.getDb().prepare().bind().run).mockResolvedValue({ success: true });

      // Act: Concurrent pattern recognition for multiple users
      const startTime = Date.now();
      const concurrentPredictions = await Promise.all(
        users.map(userId => 
          patternRecognizer.predictStruggle(testTenantId, userId, testCourseId)
        )
      );
      const elapsedTime = Date.now() - startTime;

      // Assert: All predictions should succeed with quality results
      expect(concurrentPredictions).toHaveLength(10);
      concurrentPredictions.forEach(prediction => {
        expect(prediction.riskLevel).toBeGreaterThanOrEqual(0);
        expect(prediction.riskLevel).toBeLessThanOrEqual(1);
        expect(prediction.confidence).toBeGreaterThanOrEqual(0);
        expect(prediction.explainability).toEqual(expect.any(String));
      });

      // Performance under load
      expect(elapsedTime).toBeLessThan(50000); // 10 users in <50s
    });
  });

  describe('Chat Integration Validation', () => {
    it('should integrate seamlessly with proactive chat recommendations', async () => {
      // Arrange: Simulate chat interaction scenario
      const validConsent = createValidConsent();
      const strugglingPatterns = createHistoricalBehavioralPatterns(15).slice(-5); // Recent struggling patterns
      
      vi.mocked(privacyService.validateDataCollectionPermission).mockResolvedValue(true);
      vi.mocked(mockDb.getDb().prepare().bind().all)
        .mockResolvedValueOnce({ results: [] }) // No recent interventions (rate limiting)
        .mockResolvedValueOnce({ 
          results: strugglingPatterns.map(p => ({
            aggregated_metrics: JSON.stringify(p.aggregatedMetrics),
            collected_at: p.collectedAt?.toISOString(),
            consent_verified: 1
          }))
        })
        .mockResolvedValueOnce({
          results: strugglingPatterns.map(p => ({
            aggregated_metrics: JSON.stringify(p.aggregatedMetrics),
            collected_at: p.collectedAt?.toISOString(),
            consent_verified: 1
          }))
        });

      vi.mocked(mockDb.getDb().prepare().bind().run).mockResolvedValue({ success: true });

      // Act: Generate recommendations for chat interface
      const recommendations = await interventionEngine.generateProactiveRecommendations(
        testTenantId,
        testUserId,
        testCourseId,
        'current-problem'
      );

      // Assert: Chat-appropriate recommendations
      expect(recommendations).toBeInstanceOf(Array);
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.length).toBeLessThanOrEqual(3); // Limited for chat UI

      const chatRecommendation = recommendations[0];
      expect(chatRecommendation.message).toEqual(expect.any(String));
      expect(chatRecommendation.message.length).toBeGreaterThan(20); // Meaningful message
      expect(chatRecommendation.message.length).toBeLessThan(500); // Chat-appropriate length
      expect(chatRecommendation.dismissible).toBe(true); // User control
      expect(chatRecommendation.confidence).toBeGreaterThan(0.5); // High confidence for proactive delivery
    });

    it('should adapt difficulty based on cognitive state', async () => {
      // Arrange: High cognitive load scenario
      const highLoadPatterns = createHistoricalBehavioralPatterns(5).map(p => ({
        ...p,
        aggregatedMetrics: {
          ...p.aggregatedMetrics,
          cognitiveLoad: 1.5,
          fatigueLevel: 0.8,
          attentionScore: 0.3
        }
      }));

      const learnerProfile = createIntegrationProfile();

      vi.mocked(mockDb.getDb().prepare().bind().first).mockResolvedValue({
        learning_velocity_value: learnerProfile.learningVelocityValue,
        struggle_threshold_value: learnerProfile.struggleThresholdValue,
        created_at: learnerProfile.createdAt.toISOString(),
        updated_at: learnerProfile.updatedAt.toISOString(),
        last_analyzed_at: learnerProfile.lastAnalyzedAt.toISOString()
      });

      vi.mocked(mockDb.getDb().prepare().bind().all).mockResolvedValue({
        results: highLoadPatterns.map(p => ({
          aggregated_metrics: JSON.stringify(p.aggregatedMetrics),
          collected_at: p.collectedAt?.toISOString(),
          consent_verified: 1
        }))
      });

      // Act: Generate adaptive difficulty adjustment
      const adjustment = await interventionEngine.generateAdaptiveDifficultyAdjustment(
        testTenantId,
        testUserId,
        testCourseId,
        0.7, // Current difficulty
        'explanation'
      );

      // Assert: Should reduce difficulty due to high cognitive load
      expect(adjustment.recommendedDifficulty).toBeLessThan(0.7);
      expect(adjustment.adjustmentReason).toMatch(/cognitive load|struggling/i);
      expect(adjustment.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('Database Consistency and Performance', () => {
    it('should maintain referential integrity across pattern recognition data', async () => {
      // Arrange: Mock database operations that maintain consistency
      const behavioralPatterns = createHistoricalBehavioralPatterns(10);
      const learnerProfile = createIntegrationProfile();
      
      let storedRecords: any[] = [];
      vi.mocked(mockDb.getDb().prepare().bind().run).mockImplementation((data) => {
        storedRecords.push(data);
        return Promise.resolve({ success: true });
      });

      vi.mocked(privacyService.validateDataCollectionPermission).mockResolvedValue(true);
      vi.mocked(mockDb.getDb().prepare().bind().all).mockResolvedValue({
        results: behavioralPatterns.map(p => ({
          aggregated_metrics: JSON.stringify(p.aggregatedMetrics),
          collected_at: p.collectedAt?.toISOString(),
          consent_verified: 1
        }))
      });

      // Act: Execute pattern recognition with storage
      await patternRecognizer.predictStruggle(testTenantId, testUserId, testCourseId);

      // Assert: Database operations maintain consistency
      expect(storedRecords.length).toBeGreaterThan(0);
      
      // Verify stored prediction has required fields for referential integrity
      const predictionRecord = storedRecords[0];
      expect(predictionRecord).toContain(testTenantId);
      expect(predictionRecord).toContain(testUserId);
      expect(predictionRecord).toContain(testCourseId);
    });

    it('should handle database failures gracefully', async () => {
      // Arrange: Database failure scenario
      vi.mocked(privacyService.validateDataCollectionPermission).mockResolvedValue(true);
      vi.mocked(mockDb.getDb().prepare().bind().all).mockRejectedValue(new Error('Database connection failed'));

      // Act: Should not crash on database failure
      const prediction = await patternRecognizer.predictStruggle(testTenantId, testUserId, testCourseId);

      // Assert: Graceful fallback
      expect(prediction).toBeDefined();
      expect(prediction.riskLevel).toBe(0.5); // Neutral fallback
      expect(prediction.confidence).toBe(0.0);
      expect(prediction.explainability).toContain('temporarily unavailable');
    });
  });

  describe('Performance Under Realistic Conditions', () => {
    it('should meet MVP performance targets for realistic scenarios', async () => {
      // Arrange: Realistic data volumes and complexity
      const largeHistoricalDataset = createHistoricalBehavioralPatterns(100); // 30+ days of data
      const learnerProfile = createIntegrationProfile();
      
      vi.mocked(privacyService.validateDataCollectionPermission).mockResolvedValue(true);
      vi.mocked(mockDb.getDb().prepare().bind().all)
        .mockResolvedValueOnce({
          results: largeHistoricalDataset.slice(-20).map(p => ({ // Recent patterns
            aggregated_metrics: JSON.stringify(p.aggregatedMetrics),
            collected_at: p.collectedAt?.toISOString(),
            consent_verified: 1
          }))
        })
        .mockResolvedValueOnce({
          results: largeHistoricalDataset.map(p => ({ // Full historical baseline
            aggregated_metrics: JSON.stringify(p.aggregatedMetrics),
            collected_at: p.collectedAt?.toISOString(),
            consent_verified: 1
          }))
        });

      vi.mocked(mockDb.getDb().prepare().bind().first).mockResolvedValue({
        learning_velocity_value: learnerProfile.learningVelocityValue,
        created_at: learnerProfile.createdAt.toISOString(),
        updated_at: learnerProfile.updatedAt.toISOString(),
        last_analyzed_at: learnerProfile.lastAnalyzedAt.toISOString()
      });

      vi.mocked(mockDb.getDb().prepare().bind().run).mockResolvedValue({ success: true });

      // Act: Execute all major operations with realistic data
      const operations = [
        () => patternRecognizer.predictStruggle(testTenantId, testUserId, testCourseId),
        () => patternRecognizer.analyzeRealTimeBehavioralSignals(testTenantId, testUserId, testCourseId),
        () => interventionEngine.generateProactiveRecommendations(testTenantId, testUserId, testCourseId),
        () => interventionEngine.generateAdaptiveDifficultyAdjustment(testTenantId, testUserId, testCourseId, 0.5),
        () => interventionEngine.analyzeMicroInterventionTiming(testTenantId, testUserId, testCourseId)
      ];

      const performanceResults = [];
      
      for (const operation of operations) {
        const startTime = Date.now();
        const result = await operation();
        const elapsedTime = Date.now() - startTime;
        
        performanceResults.push({
          operation: operation.name,
          elapsedTime,
          result
        });
      }

      // Assert: MVP performance targets met
      performanceResults.forEach(({ operation, elapsedTime, result }) => {
        expect(elapsedTime).toBeLessThan(10000); // <10s individual operations
        expect(result).toBeDefined();
        console.log(`${operation}: ${elapsedTime}ms`);
      });

      const totalTime = performanceResults.reduce((sum, { elapsedTime }) => sum + elapsedTime, 0);
      expect(totalTime).toBeLessThan(30000); // <30s for complete analysis
    });
  });
});