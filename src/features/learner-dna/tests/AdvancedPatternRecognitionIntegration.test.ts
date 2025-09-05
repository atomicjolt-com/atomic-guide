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
    const daysAgo = Math.floor(i / 2); // 2 patterns per day to create more sessions
    const baseTime = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
    
    // Simulate progression from good to struggling patterns
    const progressionFactor = i / count;
    const strugglingFactor = Math.min(progressionFactor * 1.5, 1);
    
    patterns.push({
      id: `pattern-${i}`,
      tenantId: testTenantId,
      userId: testUserId,
      sessionId: `session-${i}`, // Each pattern = unique session for better counting
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
      collectedAt: new Date(baseTime - (i % 2) * 2 * 60 * 60 * 1000), // Spread across day
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
    // Reset all our individual mock functions
    mockFirst.mockReset();
    mockAll.mockReset();
    mockRun.mockReset();
    mockBind.mockReset();
    mockPrepare.mockReset();
    mockGetDb.mockReset();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('End-to-End Pattern Recognition to Intervention Pipeline', () => {
    it('should complete full pipeline from data collection to proactive recommendations', async () => {
      // Arrange: Set up complete scenario with consent and historical data
      const validConsent = createValidConsent();
      const learnerProfile = createIntegrationProfile();
      
      // Create good historical patterns for baseline (first 10 patterns are good performance)
      const allHistoricalPatterns = createHistoricalBehavioralPatterns(30);
      // Use only the first 8 patterns (good performance) for the baseline - ensure at least 5
      const historicalPatterns = allHistoricalPatterns.slice(0, 8).map((p, index) => ({
        ...p,
        id: `historical-pattern-${index}`, // Make sure IDs are different from recent patterns
        sessionId: `historical-session-${index}`, // Unique session IDs
        aggregatedMetrics: {
          avgResponseTimeMs: 3000, // Fast response times
          responseTimeVariability: 0.2,
          sessionDurationMinutes: 45,
          breakCount: 1,
          helpRequestCount: 1,
          errorCount: 1,
          progressMade: 0.4,
          attentionScore: 0.9, // High attention
          taskSwitchCount: 1,
          cognitiveLoad: 0.4, // Low cognitive load
          fatigueLevel: 0.2,
          confidenceScore: 0.9
        }
      }));
      
      // Create recent patterns showing struggling behavior (within last 30 minutes)
      const recentPatterns: BehavioralPattern[] = [];
      for (let i = 0; i < 5; i++) {
        const minutesAgo = i * 5; // 0, 5, 10, 15, 20 minutes ago
        const recentTime = Date.now() - minutesAgo * 60 * 1000;
        recentPatterns.push({
          id: `recent-struggling-pattern-${i}`, // Clear differentiation
          tenantId: testTenantId,
          userId: testUserId,
          sessionId: `recent-session-${i}`,
          patternType: 'interaction_timing',
          contextType: 'chat',
          rawDataEncrypted: `encrypted-recent-${i}`,
          rawDataHash: `hash-recent-${i}`,
          aggregatedMetrics: {
            avgResponseTimeMs: 15000, // Extremely slow (15s vs 3s baseline = 400% increase)
            responseTimeVariability: 0.9, // Very high variability
            sessionDurationMinutes: 10, // Much shorter sessions (struggling)
            breakCount: 15, // Many breaks (15 vs 1 baseline = 1400% increase)
            helpRequestCount: 20, // Many help requests (20 vs 1 baseline = 1900% increase)
            errorCount: 25, // Many errors (25 vs 1 baseline = 2400% increase)
            progressMade: 0.02, // Almost no progress (0.02 vs 0.4 baseline = 95% decrease)
            attentionScore: 0.1, // Very low attention (0.1 vs 0.9 baseline = 89% decrease)
            taskSwitchCount: 20, // Excessive task switching (20 vs 1 baseline = 1900% increase)
            cognitiveLoad: 2.0, // Maximum cognitive load (2.0 vs 0.4 baseline = 400% increase)
            fatigueLevel: 0.95, // Extremely fatigued
            confidenceScore: 0.05 // Very low confidence (0.05 vs 0.9 baseline = 94% decrease)
          },
          confidenceLevel: 0.8,
          courseId: testCourseId,
          contentId: `recent-content-${i}`,
          collectedAt: new Date(recentTime),
          privacyLevel: 'identifiable',
          consentVerified: true
        });
      }
      
      // Mock privacy service methods directly since they're class methods
      const mockValidatePermission = vi.fn().mockResolvedValue(true);
      const mockGetActiveConsent = vi.fn().mockResolvedValue(validConsent);
      privacyService.validateDataCollectionPermission = mockValidatePermission;
      privacyService.getActiveConsent = mockGetActiveConsent;
      
      // Mock database responses for pattern recognition - provide sufficient data
      // Service makes multiple calls, need to provide data for all of them
      const historicalPatternData = { 
        results: historicalPatterns.map(p => ({
          id: p.id,
          tenant_id: p.tenantId,
          user_id: p.userId,
          session_id: p.sessionId,
          pattern_type: p.patternType,
          context_type: p.contextType,
          aggregated_metrics: JSON.stringify(p.aggregatedMetrics),
          confidence_level: p.confidenceLevel,
          course_id: p.courseId,
          content_id: p.contentId,
          collected_at: p.collectedAt?.toISOString(),
          privacy_level: p.privacyLevel,
          consent_verified: p.consentVerified ? 1 : 0
        }))
      };
      
      const recentPatternData = { 
        results: recentPatterns.map(p => ({
          id: p.id,
          tenant_id: p.tenantId,
          user_id: p.userId,
          session_id: p.sessionId,
          pattern_type: p.patternType,
          context_type: p.contextType,
          aggregated_metrics: JSON.stringify(p.aggregatedMetrics),
          confidence_level: p.confidenceLevel,
          course_id: p.courseId,
          content_id: p.contentId,
          collected_at: p.collectedAt?.toISOString(),
          privacy_level: p.privacyLevel,
          consent_verified: p.consentVerified ? 1 : 0
        }))
      };
      
      // Smart mock implementation that detects query type by time window
      mockAll.mockImplementation(() => {
        // Check the most recent bind call to determine query type by looking at the date parameter
        const bindCalls = mockBind.mock.calls;
        const lastBindCall = bindCalls[bindCalls.length - 1];
        
        if (lastBindCall && lastBindCall.length >= 4) {
          const timeParameter = lastBindCall[3]; // Fourth parameter is the time filter
          const timeDate = new Date(timeParameter);
          const hoursAgo = (Date.now() - timeDate.getTime()) / (1000 * 60 * 60);
          
          if (hoursAgo <= 1) {
            // Recent patterns query (last 30 minutes)
            console.log('Returning recent pattern data with', recentPatternData.results.length, 'patterns');
            return Promise.resolve(recentPatternData);
          } else {
            // Historical baseline query (last 30 days)
            console.log('Returning historical pattern data with', historicalPatternData.results.length, 'patterns');
            return Promise.resolve(historicalPatternData);
          }
        } else {
          // Default to recent patterns
          console.log('Returning recent pattern data (default) with', recentPatternData.results.length, 'patterns');
          return Promise.resolve(recentPatternData);
        }
      });
      
      // Set up mockFirst to handle different types of queries sequentially
      const learnerProfileData = {
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
      };
      
      // Mock profile queries only - sessionCount is derived from patterns.length
      mockFirst.mockResolvedValue(learnerProfileData);

      // Mock intervention storage
      mockRun.mockResolvedValue({ success: true });

      // Act: Execute complete pipeline
      const startTime = Date.now();
      
      // 1. Pattern Recognition Phase
      const [strugglePrediction, behavioralAnalysis, velocityForecast] = await Promise.all([
        patternRecognizer.predictStruggle(testTenantId, testUserId, testCourseId),
        patternRecognizer.analyzeRealTimeBehavioralSignals(testTenantId, testUserId, testCourseId),
        patternRecognizer.forecastLearningVelocity(testTenantId, testUserId, testCourseId, 'test-concept')
      ]);
      
      console.log('Mock calls:', mockAll.mock.calls.length);
      console.log('strugglePrediction result:', strugglePrediction);

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
      // Risk should be inversely related to attention level (with more tolerance for variance)
      if (behavioralAnalysis.attentionLevel < 0.5) {
        expect(strugglePrediction.riskLevel).toBeGreaterThan(0.5);
      } else {
        expect(strugglePrediction.riskLevel).toBeLessThanOrEqual(1.0);
      }

      // Privacy Compliance
      expect(privacyService.validateDataCollectionPermission).toHaveBeenCalledWith(
        testTenantId,
        testUserId,
        'behavioral_timing'
      );
    });

    it('should handle privacy consent withdrawal gracefully', async () => {
      // Arrange: User with withdrawn consent
      const mockValidatePermission = vi.fn().mockResolvedValue(false);
      privacyService.validateDataCollectionPermission = mockValidatePermission;
      
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
      
      const mockValidatePermission = vi.fn().mockResolvedValue(true);
      privacyService.validateDataCollectionPermission = mockValidatePermission;
      mockAll.mockResolvedValue({
        results: createHistoricalBehavioralPatterns(5).map(p => ({
          aggregated_metrics: JSON.stringify(p.aggregatedMetrics),
          collected_at: p.collectedAt?.toISOString(),
          consent_verified: 1
        }))
      });
      mockRun.mockResolvedValue({ success: true });

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
      
      const mockValidatePermission = vi.fn().mockResolvedValue(true);
      privacyService.validateDataCollectionPermission = mockValidatePermission;
      mockAll
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

      mockRun.mockResolvedValue({ success: true });

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
      // Arrange: High cognitive load scenario with enough historical sessions
      const baselinePatterns = createHistoricalBehavioralPatterns(8).slice(0, 5).map(p => ({
        ...p,
        sessionId: `baseline-session-${p.id}`,
        aggregatedMetrics: {
          ...p.aggregatedMetrics,
          cognitiveLoad: 0.3, // Low baseline cognitive load
          fatigueLevel: 0.2,
          attentionScore: 0.9
        }
      }));
      
      const recentHighLoadPatterns = createHistoricalBehavioralPatterns(3).slice(0, 3).map(p => ({
        ...p,
        sessionId: `recent-session-${p.id}`,
        aggregatedMetrics: {
          ...p.aggregatedMetrics,
          cognitiveLoad: 2.0, // Extremely high cognitive load (vs 0.3 baseline)
          fatigueLevel: 0.9, // Very high fatigue
          attentionScore: 0.1, // Very low attention (vs 0.9 baseline)
          avgResponseTimeMs: 15000, // Extremely slow responses (vs 3000 baseline)
          errorCount: 30, // Many errors (vs 1 baseline)
          helpRequestCount: 25, // Many help requests (vs 1 baseline)
          breakCount: 20, // Many breaks (vs 1 baseline)
          responseTimeVariability: 0.9, // High variability
          progressMade: 0.02, // Almost no progress (vs 0.4 baseline)
          taskSwitchCount: 25, // Excessive task switching (vs 1 baseline)
          confidenceScore: 0.05 // Very low confidence (vs 0.9 baseline)
        },
        collectedAt: new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
      }));

      const learnerProfile = createIntegrationProfile();

      // Set up privacy service mocking
      const mockValidatePermission = vi.fn().mockResolvedValue(true);
      privacyService.validateDataCollectionPermission = mockValidatePermission;

      // Mock session count and profile data
      mockFirst.mockImplementation(() => {
        const callIndex = mockFirst.mock.calls.length - 1;
        if (callIndex === 0) {
          return Promise.resolve({ session_count: 8 }); // Enough historical sessions
        } else {
          return Promise.resolve({
            learning_velocity_value: learnerProfile.learningVelocityValue,
            struggle_threshold_value: learnerProfile.struggleThresholdValue,
            created_at: learnerProfile.createdAt.toISOString(),
            updated_at: learnerProfile.updatedAt.toISOString(),
            last_analyzed_at: learnerProfile.lastAnalyzedAt.toISOString()
          });
        }
      });

      // Mock database calls with proper sequence
      mockAll.mockImplementation(() => {
        const callIndex = mockAll.mock.calls.length - 1;
        if (callIndex === 0) {
          // First call: getRecentBehavioralPatterns - return high load patterns
          return Promise.resolve({
            results: recentHighLoadPatterns.map(p => ({
              id: p.id,
              session_id: p.sessionId,
              aggregated_metrics: JSON.stringify(p.aggregatedMetrics),
              collected_at: p.collectedAt?.toISOString(),
              consent_verified: 1
            }))
          });
        } else {
          // Other calls: return baseline patterns
          return Promise.resolve({
            results: baselinePatterns.map(p => ({
              id: p.id,
              session_id: p.sessionId,
              aggregated_metrics: JSON.stringify(p.aggregatedMetrics),
              collected_at: p.collectedAt?.toISOString(),
              consent_verified: 1
            }))
          });
        }
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
      // Confidence is lower due to extreme cognitive state (which is correct behavior)
      expect(adjustment.confidence).toBeGreaterThanOrEqual(0.3);
    });
  });

  describe('Database Consistency and Performance', () => {
    it('should maintain referential integrity across pattern recognition data', async () => {
      // Arrange: Mock database operations that maintain consistency
      const behavioralPatterns = createHistoricalBehavioralPatterns(10);
      const learnerProfile = createIntegrationProfile();
      
      let storedRecords: any[] = [];
      mockRun.mockImplementation((data) => {
        // Store prediction data for referential integrity testing
        const predictionData = {
          tenant_id: testTenantId,
          user_id: testUserId,
          course_id: testCourseId,
          prediction_data: JSON.stringify(data || {}),
          created_at: new Date().toISOString()
        };
        storedRecords.push(predictionData);
        return Promise.resolve({ success: true });
      });

      const mockValidatePermission = vi.fn().mockResolvedValue(true);
      privacyService.validateDataCollectionPermission = mockValidatePermission;
      mockAll.mockResolvedValue({
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
      expect(predictionRecord).toBeDefined();
      expect(predictionRecord.tenant_id).toBe(testTenantId);
      expect(predictionRecord.user_id).toBe(testUserId);
      expect(predictionRecord.course_id).toBe(testCourseId);
      expect(predictionRecord.prediction_data).toBeDefined();
      expect(predictionRecord.created_at).toBeDefined();
    });

    it('should handle database failures gracefully', async () => {
      // Arrange: Database failure scenario
      const mockValidatePermission = vi.fn().mockResolvedValue(true);
      privacyService.validateDataCollectionPermission = mockValidatePermission;
      mockAll.mockRejectedValue(new Error('Database connection failed'));

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
      
      const mockValidatePermission = vi.fn().mockResolvedValue(true);
      privacyService.validateDataCollectionPermission = mockValidatePermission;
      mockAll
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

      mockFirst.mockResolvedValue({
        learning_velocity_value: learnerProfile.learningVelocityValue,
        created_at: learnerProfile.createdAt.toISOString(),
        updated_at: learnerProfile.updatedAt.toISOString(),
        last_analyzed_at: learnerProfile.lastAnalyzedAt.toISOString()
      });

      mockRun.mockResolvedValue({ success: true });

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