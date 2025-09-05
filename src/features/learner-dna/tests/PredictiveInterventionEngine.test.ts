/**
 * @fileoverview Tests for Predictive Intervention Engine (Story 4.2)
 * @module features/learner-dna/tests/PredictiveInterventionEngine.test
 * 
 * Comprehensive test suite for predictive intervention capabilities:
 * - Proactive chat recommendations (AC 7)
 * - Adaptive difficulty adjustment (AC 8)
 * - Early warning alerts for instructors (AC 10)
 * - Personalized learning path generation (AC 9)
 * - Micro-intervention timing optimization (AC 11)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseService } from '@shared/server/services';
import { PredictiveInterventionEngine } from '../server/services/PredictiveInterventionEngine';
import { AdvancedPatternRecognizer } from '../server/services/AdvancedPatternRecognizer';
import { PrivacyControlService } from '../server/services/PrivacyControlService';
import type { 
  StrugglePrediction,
  LearningVelocityForecast,
  BehavioralSignalAnalysis,
  LearnerDNAProfile
} from '../shared/types';

// Mock services
const mockDb = {
  getDb: vi.fn(() => ({
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        first: vi.fn(),
        all: vi.fn(),
        run: vi.fn()
      }))
    }))
  }))
} as unknown as DatabaseService;

const mockPatternRecognizer = {
  analyzeRealTimeBehavioralSignals: vi.fn(),
  predictStruggle: vi.fn(),
  forecastLearningVelocity: vi.fn()
} as unknown as AdvancedPatternRecognizer;

const mockPrivacyService = {
  validateDataCollectionPermission: vi.fn(),
  getActiveConsent: vi.fn()
} as unknown as PrivacyControlService;

// Test data generators
function createMockStrugglePrediction(overrides: Partial<StrugglePrediction> = {}): StrugglePrediction {
  return {
    riskLevel: 0.8,
    confidence: 0.7,
    timeToStruggle: 15,
    contributingFactors: ['Response time increase', 'Error rate increase'],
    recommendations: ['Take a short break', 'Review concept fundamentals'],
    explainability: 'Your learning patterns indicate you may benefit from additional support.',
    predictedAt: new Date(),
    validUntil: new Date(Date.now() + 30 * 60 * 1000),
    ...overrides
  };
}

function createMockBehavioralAnalysis(overrides: Partial<BehavioralSignalAnalysis> = {}): BehavioralSignalAnalysis {
  return {
    cognitiveLoad: 0.6,
    attentionLevel: 0.7,
    engagementScore: 0.8,
    fatigueLevel: 0.3,
    optimalInterventionTiming: true,
    recommendations: ['Continue with current approach'],
    analyzedAt: new Date(),
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
    cognitiveAttributes: {},
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

describe('PredictiveInterventionEngine', () => {
  let interventionEngine: PredictiveInterventionEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    interventionEngine = new PredictiveInterventionEngine(
      mockDb,
      mockPatternRecognizer,
      mockPrivacyService
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Proactive Chat Recommendations (AC 7)', () => {
    it('should generate proactive recommendations for high struggle risk', async () => {
      // Arrange
      vi.mocked(mockPrivacyService.validateDataCollectionPermission).mockResolvedValue(true);
      vi.mocked(mockDb.getDb().prepare().bind().all).mockResolvedValue({ results: [] }); // No recent interventions
      
      const highRiskPrediction = createMockStrugglePrediction({
        riskLevel: 0.9,
        confidence: 0.8,
        contributingFactors: ['Response time increase', 'Error rate increase']
      });

      const behavioralAnalysis = createMockBehavioralAnalysis({
        cognitiveLoad: 0.6,
        attentionLevel: 0.7
      });

      vi.mocked(mockPatternRecognizer.analyzeRealTimeBehavioralSignals).mockResolvedValue(behavioralAnalysis);
      vi.mocked(mockPatternRecognizer.predictStruggle).mockResolvedValue(highRiskPrediction);
      vi.mocked(mockDb.getDb().prepare().bind().run).mockResolvedValue({ success: true });

      // Act
      const startTime = Date.now();
      const recommendations = await interventionEngine.generateProactiveRecommendations(
        'tenant-1',
        'user-1', 
        'course-1'
      );
      const elapsedTime = Date.now() - startTime;

      // Assert
      expect(recommendations).toBeInstanceOf(Array);
      expect(recommendations.length).toBeGreaterThan(0);
      
      const highPriorityRec = recommendations.find(r => r.priority === 'high');
      expect(highPriorityRec).toBeDefined();
      expect(highPriorityRec?.type).toBe('concept_clarification');
      expect(highPriorityRec?.message).toContain('challenging');
      expect(highPriorityRec?.actionable).toBe(true);
      expect(highPriorityRec?.dismissible).toBe(true);
      expect(highPriorityRec?.confidence).toBeGreaterThan(0.5);

      // Performance requirement
      expect(elapsedTime).toBeLessThan(10000);

      // Should include struggle-specific recommendation
      expect(recommendations.some(r => r.triggerReason.includes('struggle'))).toBe(true);
    });

    it('should respect intervention rate limits', async () => {
      // Arrange: User has reached daily intervention limit
      vi.mocked(mockPrivacyService.validateDataCollectionPermission).mockResolvedValue(true);
      
      const recentInterventions = Array.from({ length: 8 }, (_, i) => ({
        id: `intervention-${i}`,
        type: 'proactive_help',
        delivery_timestamp: new Date(Date.now() - i * 60 * 60 * 1000).toISOString()
      }));

      vi.mocked(mockDb.getDb().prepare().bind().all).mockResolvedValue({ 
        results: recentInterventions 
      });

      // Act
      const recommendations = await interventionEngine.generateProactiveRecommendations(
        'tenant-1',
        'user-1',
        'course-1'
      );

      // Assert: Should return empty array due to rate limit
      expect(recommendations).toHaveLength(0);
    });

    it('should apply cooldown filtering to prevent spam', async () => {
      // Arrange: Recent intervention of same type
      vi.mocked(mockPrivacyService.validateDataCollectionPermission).mockResolvedValue(true);
      
      // Set up the mock to return different values for consecutive calls
      const mockAll = vi.fn()
        .mockResolvedValueOnce({ results: [] }) // No daily limit reached
        .mockResolvedValueOnce({ 
          results: [{
            intervention_type: 'concept_clarification', // Use the correct field name
            delivery_timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString() // 20 min ago
          }]
        });

      mockDb.getDb = vi.fn(() => ({
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            all: mockAll,
            run: vi.fn().mockResolvedValue({ success: true }),
            first: vi.fn()
          }))
        }))
      }));

      const strugglePrediction = createMockStrugglePrediction({ riskLevel: 0.9 });
      const behavioralAnalysis = createMockBehavioralAnalysis();

      vi.mocked(mockPatternRecognizer.analyzeRealTimeBehavioralSignals).mockResolvedValue(behavioralAnalysis);
      vi.mocked(mockPatternRecognizer.predictStruggle).mockResolvedValue(strugglePrediction);

      // Act
      const recommendations = await interventionEngine.generateProactiveRecommendations(
        'tenant-1',
        'user-1',
        'course-1'
      );

      // Assert: Should filter out recent intervention types
      expect(recommendations.every(r => r.type !== 'concept_clarification')).toBe(true);
    });

    it('should generate different recommendations based on cognitive load', async () => {
      // Arrange
      vi.mocked(mockPrivacyService.validateDataCollectionPermission).mockResolvedValue(true);
      vi.mocked(mockDb.getDb().prepare().bind().all).mockResolvedValue({ results: [] });
      vi.mocked(mockDb.getDb().prepare().bind().run).mockResolvedValue({ success: true });

      const scenarios = [
        {
          name: 'High cognitive load',
          behavioralAnalysis: createMockBehavioralAnalysis({ 
            cognitiveLoad: 1.5,
            fatigueLevel: 0.8 
          }),
          expectedType: 'study_strategy'
        },
        {
          name: 'Low engagement', 
          behavioralAnalysis: createMockBehavioralAnalysis({
            engagementScore: 0.2,
            attentionLevel: 0.3
          }),
          expectedType: 'motivational'
        },
        {
          name: 'Optimal timing',
          behavioralAnalysis: createMockBehavioralAnalysis({
            optimalInterventionTiming: true,
            attentionLevel: 0.9,
            engagementScore: 0.8
          }),
          expectedType: 'practice_suggestion'
        }
      ];

      for (const scenario of scenarios) {
        vi.mocked(mockPatternRecognizer.analyzeRealTimeBehavioralSignals)
          .mockResolvedValue(scenario.behavioralAnalysis);
        vi.mocked(mockPatternRecognizer.predictStruggle)
          .mockResolvedValue(createMockStrugglePrediction({ riskLevel: 0.3 })); // Low struggle risk

        const recommendations = await interventionEngine.generateProactiveRecommendations(
          'tenant-1',
          'user-1',
          'course-1'
        );

        // Assert scenario-specific recommendations
        expect(recommendations.some(r => r.type === scenario.expectedType)).toBe(true);
      }
    });

    it('should enforce privacy consent for proactive interventions', async () => {
      // Arrange: No consent
      vi.mocked(mockPrivacyService.validateDataCollectionPermission).mockResolvedValue(false);

      // Act & Assert
      await expect(interventionEngine.generateProactiveRecommendations(
        'tenant-1',
        'user-1',
        'course-1'
      )).rejects.toThrow('PRIVACY_ERROR');
    });
  });

  describe('Adaptive Difficulty Adjustment (AC 8)', () => {
    it('should adjust difficulty based on cognitive state', async () => {
      // Arrange
      const mockProfile = createMockLearnerProfile({
        learningVelocityValue: 1.5, // Fast learner
        struggleThresholdValue: 0.3
      });

      vi.mocked(mockDb.getDb().prepare().bind().first).mockResolvedValue({
        learning_velocity_value: mockProfile.learningVelocityValue,
        struggle_threshold_value: mockProfile.struggleThresholdValue,
        created_at: mockProfile.createdAt.toISOString(),
        updated_at: mockProfile.updatedAt.toISOString(),
        last_analyzed_at: mockProfile.lastAnalyzedAt.toISOString()
      });

      const behavioralAnalysis = createMockBehavioralAnalysis({
        cognitiveLoad: 0.3, // Low cognitive load
        attentionLevel: 0.9 // High attention
      });

      const strugglePrediction = createMockStrugglePrediction({
        riskLevel: 0.2, // Low struggle risk
        confidence: 0.8
      });

      vi.mocked(mockPatternRecognizer.analyzeRealTimeBehavioralSignals).mockResolvedValue(behavioralAnalysis);
      vi.mocked(mockPatternRecognizer.predictStruggle).mockResolvedValue(strugglePrediction);

      // Act
      const adjustment = await interventionEngine.generateAdaptiveDifficultyAdjustment(
        'tenant-1',
        'user-1',
        'course-1',
        0.5 // Current difficulty
      );

      // Assert
      expect(adjustment).toBeDefined();
      expect(adjustment.currentDifficulty).toBe(0.5);
      expect(adjustment.recommendedDifficulty).toBeGreaterThanOrEqual(0.1);
      expect(adjustment.recommendedDifficulty).toBeLessThanOrEqual(0.9);
      expect(adjustment.confidence).toBeGreaterThan(0);
      expect(adjustment.confidence).toBeLessThanOrEqual(1);
      expect(adjustment.adjustmentReason).toEqual(expect.any(String));

      // Fast learner with low struggle risk should get difficulty increase
      expect(adjustment.recommendedDifficulty).toBeGreaterThanOrEqual(0.5);
    });

    it('should decrease difficulty for struggling students', async () => {
      // Arrange
      const mockProfile = createMockLearnerProfile({
        learningVelocityValue: 0.8, // Slower learner
        struggleThresholdValue: 0.7  // High struggle threshold
      });

      vi.mocked(mockDb.getDb().prepare().bind().first).mockResolvedValue({
        learning_velocity_value: mockProfile.learningVelocityValue,
        struggle_threshold_value: mockProfile.struggleThresholdValue,
        created_at: mockProfile.createdAt.toISOString(),
        updated_at: mockProfile.updatedAt.toISOString(),
        last_analyzed_at: mockProfile.lastAnalyzedAt.toISOString()
      });

      const behavioralAnalysis = createMockBehavioralAnalysis({
        cognitiveLoad: 1.2, // High cognitive load
        fatigueLevel: 0.7   // High fatigue
      });

      const strugglePrediction = createMockStrugglePrediction({
        riskLevel: 0.9, // High struggle risk
        confidence: 0.8
      });

      vi.mocked(mockPatternRecognizer.analyzeRealTimeBehavioralSignals).mockResolvedValue(behavioralAnalysis);
      vi.mocked(mockPatternRecognizer.predictStruggle).mockResolvedValue(strugglePrediction);

      // Act
      const adjustment = await interventionEngine.generateAdaptiveDifficultyAdjustment(
        'tenant-1',
        'user-1',
        'course-1',
        0.7 // Current difficulty
      );

      // Assert: Should decrease difficulty
      expect(adjustment.recommendedDifficulty).toBeLessThan(0.7);
      expect(adjustment.adjustmentReason).toMatch(/decrease.*struggle|cognitive load/i);
    });

    it('should generate graduation path for skill development', async () => {
      // Arrange: Student needs difficulty increase
      const mockProfile = createMockLearnerProfile({
        learningVelocityValue: 1.8 // Very fast learner
      });

      vi.mocked(mockDb.getDb().prepare().bind().first).mockResolvedValue({
        learning_velocity_value: mockProfile.learningVelocityValue,
        created_at: mockProfile.createdAt.toISOString(),
        updated_at: mockProfile.updatedAt.toISOString(),
        last_analyzed_at: mockProfile.lastAnalyzedAt.toISOString()
      });

      const behavioralAnalysis = createMockBehavioralAnalysis({
        cognitiveLoad: 0.2,
        attentionLevel: 0.95,
        engagementScore: 0.9
      });

      const strugglePrediction = createMockStrugglePrediction({
        riskLevel: 0.1,
        confidence: 0.9
      });

      vi.mocked(mockPatternRecognizer.analyzeRealTimeBehavioralSignals).mockResolvedValue(behavioralAnalysis);
      vi.mocked(mockPatternRecognizer.predictStruggle).mockResolvedValue(strugglePrediction);

      // Act
      const adjustment = await interventionEngine.generateAdaptiveDifficultyAdjustment(
        'tenant-1',
        'user-1',
        'course-1',
        0.3 // Low current difficulty
      );

      // Assert: Should include graduation path
      expect(adjustment.graduationPath).toBeDefined();
      expect(adjustment.graduationPath!.targetDifficulty).toBeGreaterThan(0.3);
      expect(adjustment.graduationPath!.estimatedTimeToTarget).toBeGreaterThan(0);
      expect(adjustment.graduationPath!.milestones).toBeInstanceOf(Array);
      expect(adjustment.graduationPath!.milestones.length).toBeGreaterThan(0);
    });

    it('should provide fallback on error', async () => {
      // Arrange: Database error
      const mockFirst = vi.fn().mockRejectedValue(new Error('Database error'));

      mockDb.getDb = vi.fn(() => ({
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            first: mockFirst,
            all: vi.fn().mockResolvedValue({ results: [] }),
            run: vi.fn().mockResolvedValue({ success: true })
          }))
        }))
      }));

      // Act
      const adjustment = await interventionEngine.generateAdaptiveDifficultyAdjustment(
        'tenant-1',
        'user-1',
        'course-1',
        0.6
      );

      // Assert: Safe fallback
      expect(adjustment.currentDifficulty).toBe(0.6);
      expect(adjustment.recommendedDifficulty).toBe(0.6); // No change
      expect(adjustment.confidence).toBe(0.0);
      expect(adjustment.adjustmentReason).toContain('temporarily unavailable');
    });
  });

  describe('Early Warning Alerts for Instructors (AC 10)', () => {
    it('should generate alerts for high-risk students', async () => {
      // Arrange: Mock course students
      const courseStudents = ['student-1', 'student-2', 'student-3'];
      
      const mockAll = vi.fn()
        .mockResolvedValueOnce({ 
          results: courseStudents.map(id => ({ user_id: id }))
        })
        .mockResolvedValue({ results: [] }); // Default for any other calls

      mockDb.getDb = vi.fn(() => ({
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            first: vi.fn(),
            all: mockAll,
            run: vi.fn().mockResolvedValue({ success: true })
          }))
        }))
      }));

      // Mock privacy consent for all students
      vi.mocked(mockPrivacyService.validateDataCollectionPermission).mockResolvedValue(true);

      // Mock high-risk predictions for student-1
      const highRiskPrediction = createMockStrugglePrediction({
        riskLevel: 0.9,
        confidence: 0.8,
        contributingFactors: ['Response time increase', 'High error rate']
      });

      const cognitiveOverloadAnalysis = createMockBehavioralAnalysis({
        cognitiveLoad: 1.8,
        fatigueLevel: 0.9
      });

      vi.mocked(mockPatternRecognizer.predictStruggle)
        .mockResolvedValueOnce(highRiskPrediction)
        .mockResolvedValue(createMockStrugglePrediction({ riskLevel: 0.3 })); // Low risk for others

      vi.mocked(mockPatternRecognizer.analyzeRealTimeBehavioralSignals)
        .mockResolvedValueOnce(cognitiveOverloadAnalysis)
        .mockResolvedValue(createMockBehavioralAnalysis()); // Normal for others

      // Act
      const alerts = await interventionEngine.generateEarlyWarningAlerts(
        'tenant-1',
        'course-1',
        'instructor-1'
      );

      // Assert
      expect(alerts).toBeInstanceOf(Array);
      expect(alerts.length).toBeGreaterThan(0);

      const highRiskAlert = alerts.find(a => a.severity === 'high' || a.severity === 'critical');
      expect(highRiskAlert).toBeDefined();
      expect(highRiskAlert!.studentId).toBe('student-1');
      expect(highRiskAlert!.alertType).toBe('struggle_risk');
      expect(highRiskAlert!.confidence).toBeGreaterThan(0.5);
      expect(highRiskAlert!.specificConcerns).toContain('Response time increase');
      expect(highRiskAlert!.recommendedActions).toBeInstanceOf(Array);
      expect(highRiskAlert!.recommendedActions.length).toBeGreaterThan(0);

      // Should include actionable recommendations
      const immediateActions = highRiskAlert!.recommendedActions.filter(a => a.priority === 'immediate');
      expect(immediateActions.length).toBeGreaterThan(0);
    });

    it('should respect student privacy consent', async () => {
      // Arrange: Mixed consent students
      const courseStudents = ['consented-student', 'non-consented-student'];
      vi.mocked(mockDb.getDb().prepare().bind().all)
        .mockResolvedValue({ 
          results: courseStudents.map(id => ({ user_id: id }))
        });

      // Mock consent: first student consented, second did not
      vi.mocked(mockPrivacyService.validateDataCollectionPermission)
        .mockResolvedValueOnce(true)   // consented-student
        .mockResolvedValueOnce(false); // non-consented-student

      vi.mocked(mockPatternRecognizer.predictStruggle)
        .mockResolvedValue(createMockStrugglePrediction({ riskLevel: 0.9 }));
      vi.mocked(mockPatternRecognizer.analyzeRealTimeBehavioralSignals)
        .mockResolvedValue(createMockBehavioralAnalysis());

      vi.mocked(mockDb.getDb().prepare().bind().run).mockResolvedValue({ success: true });

      // Act
      const alerts = await interventionEngine.generateEarlyWarningAlerts(
        'tenant-1',
        'course-1',
        'instructor-1'
      );

      // Assert: Should only include alerts for consented students
      expect(alerts.every(alert => alert.studentId === 'consented-student')).toBe(true);
    });

    it('should prioritize alerts by severity and confidence', async () => {
      // Arrange: Multiple students with different risk levels
      const courseStudents = ['low-risk', 'medium-risk', 'high-risk'];
      vi.mocked(mockDb.getDb().prepare().bind().all)
        .mockResolvedValue({ 
          results: courseStudents.map(id => ({ user_id: id }))
        });

      vi.mocked(mockPrivacyService.validateDataCollectionPermission).mockResolvedValue(true);

      const predictions = [
        createMockStrugglePrediction({ riskLevel: 0.2, confidence: 0.6 }), // low-risk
        createMockStrugglePrediction({ riskLevel: 0.6, confidence: 0.7 }), // medium-risk  
        createMockStrugglePrediction({ riskLevel: 0.95, confidence: 0.9 }) // high-risk
      ];

      vi.mocked(mockPatternRecognizer.predictStruggle)
        .mockResolvedValueOnce(predictions[0])
        .mockResolvedValueOnce(predictions[1])
        .mockResolvedValueOnce(predictions[2]);

      vi.mocked(mockPatternRecognizer.analyzeRealTimeBehavioralSignals)
        .mockResolvedValue(createMockBehavioralAnalysis());

      vi.mocked(mockDb.getDb().prepare().bind().run).mockResolvedValue({ success: true });

      // Act
      const alerts = await interventionEngine.generateEarlyWarningAlerts(
        'tenant-1',
        'course-1',
        'instructor-1'
      );

      // Assert: Should be sorted by severity (critical/high first) then confidence
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      for (let i = 1; i < alerts.length; i++) {
        const prevSeverity = severityOrder[alerts[i-1].severity];
        const currSeverity = severityOrder[alerts[i].severity];
        expect(prevSeverity).toBeGreaterThanOrEqual(currSeverity);
      }
    });

    it('should limit alerts to prevent instructor overwhelm', async () => {
      // Arrange: Many high-risk students
      const manyStudents = Array.from({ length: 20 }, (_, i) => `student-${i}`);
      vi.mocked(mockDb.getDb().prepare().bind().all)
        .mockResolvedValue({ 
          results: manyStudents.map(id => ({ user_id: id }))
        });

      vi.mocked(mockPrivacyService.validateDataCollectionPermission).mockResolvedValue(true);
      vi.mocked(mockPatternRecognizer.predictStruggle)
        .mockResolvedValue(createMockStrugglePrediction({ riskLevel: 0.9 }));
      vi.mocked(mockPatternRecognizer.analyzeRealTimeBehavioralSignals)
        .mockResolvedValue(createMockBehavioralAnalysis({ cognitiveLoad: 1.5 }));

      vi.mocked(mockDb.getDb().prepare().bind().run).mockResolvedValue({ success: true });

      // Act
      const alerts = await interventionEngine.generateEarlyWarningAlerts(
        'tenant-1',
        'course-1',
        'instructor-1'
      );

      // Assert: Should limit to reasonable number (e.g., top 10)
      expect(alerts.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Micro-Intervention Timing Analysis (AC 11)', () => {
    it('should identify optimal intervention timing', async () => {
      // Arrange: Optimal conditions
      const optimalAnalysis = createMockBehavioralAnalysis({
        attentionLevel: 0.9,    // High attention
        cognitiveLoad: 0.4,     // Moderate cognitive load
        engagementScore: 0.8,   // Good engagement  
        fatigueLevel: 0.2       // Low fatigue
      });

      vi.mocked(mockPatternRecognizer.analyzeRealTimeBehavioralSignals)
        .mockResolvedValue(optimalAnalysis);

      // Act
      const timing = await interventionEngine.analyzeMicroInterventionTiming(
        'tenant-1',
        'user-1',
        'course-1'
      );

      // Assert
      expect(timing).toBeDefined();
      expect(timing.isOptimalTiming).toBe(true);
      expect(timing.confidenceScore).toBeGreaterThan(0.7);
      expect(timing.interventionType).toBe('immediate');
      expect(timing.timingFactors).toBeInstanceOf(Array);
      expect(timing.timingFactors.length).toBe(4); // Attention, CognitiveLoad, Engagement, Fatigue

      // Verify timing factors
      const attentionFactor = timing.timingFactors.find(f => f.factor === 'Attention Level');
      expect(attentionFactor?.score).toBe(0.9);
      expect(attentionFactor?.weight).toBe(0.3);
    });

    it('should recommend delayed intervention when timing is suboptimal', async () => {
      // Arrange: Suboptimal but recoverable conditions
      const suboptimalAnalysis = createMockBehavioralAnalysis({
        attentionLevel: 0.5,    // Moderate attention
        cognitiveLoad: 0.8,     // Higher cognitive load
        engagementScore: 0.4,   // Lower engagement
        fatigueLevel: 0.6       // Moderate fatigue
      });

      vi.mocked(mockPatternRecognizer.analyzeRealTimeBehavioralSignals)
        .mockResolvedValue(suboptimalAnalysis);

      // Act
      const timing = await interventionEngine.analyzeMicroInterventionTiming(
        'tenant-1',
        'user-1',
        'course-1'
      );

      // Assert
      expect(timing.isOptimalTiming).toBe(false);
      expect(timing.interventionType).toBe('delayed');
      expect(timing.recommendedDelay).toBeGreaterThan(0);
      expect(timing.nextOptimalWindow).toBeInstanceOf(Date);
      expect(timing.nextOptimalWindow!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should recommend skipping intervention when conditions are poor', async () => {
      // Arrange: Poor conditions
      const poorAnalysis = createMockBehavioralAnalysis({
        attentionLevel: 0.2,    // Very low attention
        cognitiveLoad: 1.8,     // Very high cognitive load
        engagementScore: 0.1,   // Very low engagement
        fatigueLevel: 0.9       // High fatigue
      });

      vi.mocked(mockPatternRecognizer.analyzeRealTimeBehavioralSignals)
        .mockResolvedValue(poorAnalysis);

      // Act
      const timing = await interventionEngine.analyzeMicroInterventionTiming(
        'tenant-1',
        'user-1',
        'course-1'
      );

      // Assert
      expect(timing.isOptimalTiming).toBe(false);
      expect(timing.interventionType).toBe('skip');
      expect(timing.nextOptimalWindow).toBeInstanceOf(Date);
    });

    it('should handle analysis failure gracefully', async () => {
      // Arrange: Analysis failure
      vi.mocked(mockPatternRecognizer.analyzeRealTimeBehavioralSignals)
        .mockRejectedValue(new Error('Analysis failed'));

      // Act
      const timing = await interventionEngine.analyzeMicroInterventionTiming(
        'tenant-1',
        'user-1',
        'course-1'
      );

      // Assert: Safe fallback
      expect(timing.isOptimalTiming).toBe(false);
      expect(timing.confidenceScore).toBe(0.0);
      expect(timing.timingFactors).toHaveLength(0);
      expect(timing.interventionType).toBe('skip');
    });
  });

  describe('Performance and Scalability', () => {
    it('should meet performance targets for intervention generation', async () => {
      // Arrange
      vi.mocked(mockPrivacyService.validateDataCollectionPermission).mockResolvedValue(true);
      vi.mocked(mockDb.getDb().prepare().bind().all).mockResolvedValue({ results: [] });
      vi.mocked(mockDb.getDb().prepare().bind().run).mockResolvedValue({ success: true });

      vi.mocked(mockPatternRecognizer.analyzeRealTimeBehavioralSignals)
        .mockResolvedValue(createMockBehavioralAnalysis());
      vi.mocked(mockPatternRecognizer.predictStruggle)
        .mockResolvedValue(createMockStrugglePrediction());

      // Act: Test multiple intervention generations
      const interventionTimes: number[] = [];
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        await interventionEngine.generateProactiveRecommendations(
          'tenant-1',
          `user-${i}`,
          'course-1'
        );
        interventionTimes.push(Date.now() - startTime);
      }

      // Assert: Average should be well under 10 seconds
      const avgTime = interventionTimes.reduce((a, b) => a + b, 0) / interventionTimes.length;
      expect(avgTime).toBeLessThan(10000);
      expect(Math.max(...interventionTimes)).toBeLessThan(15000); // Max should be reasonable
    });

    it('should handle concurrent intervention requests', async () => {
      // Arrange
      vi.mocked(mockPrivacyService.validateDataCollectionPermission).mockResolvedValue(true);
      vi.mocked(mockDb.getDb().prepare().bind().all).mockResolvedValue({ results: [] });
      vi.mocked(mockDb.getDb().prepare().bind().run).mockResolvedValue({ success: true });

      vi.mocked(mockPatternRecognizer.analyzeRealTimeBehavioralSignals)
        .mockResolvedValue(createMockBehavioralAnalysis());
      vi.mocked(mockPatternRecognizer.predictStruggle)
        .mockResolvedValue(createMockStrugglePrediction());

      // Act: Concurrent requests
      const startTime = Date.now();
      const requests = Array.from({ length: 10 }, (_, i) =>
        interventionEngine.generateProactiveRecommendations(
          'tenant-1',
          `user-${i}`,
          'course-1'
        )
      );

      const results = await Promise.all(requests);
      const elapsedTime = Date.now() - startTime;

      // Assert
      expect(results).toHaveLength(10);
      expect(elapsedTime).toBeLessThan(20000); // Should handle 10 concurrent in <20s
      results.forEach(result => expect(result).toBeInstanceOf(Array));
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle service failures gracefully', async () => {
      // Arrange: Various service failures
      vi.mocked(mockPrivacyService.validateDataCollectionPermission).mockResolvedValue(true);
      vi.mocked(mockDb.getDb().prepare().bind().all).mockResolvedValue({ results: [] });
      
      vi.mocked(mockPatternRecognizer.analyzeRealTimeBehavioralSignals)
        .mockRejectedValue(new Error('Analysis service down'));
      vi.mocked(mockPatternRecognizer.predictStruggle)
        .mockRejectedValue(new Error('Prediction service down'));

      // Act: Should not throw
      const recommendations = await interventionEngine.generateProactiveRecommendations(
        'tenant-1',
        'user-1',
        'course-1'
      );

      // Assert: Should return empty array gracefully
      expect(recommendations).toBeInstanceOf(Array);
      expect(recommendations).toHaveLength(0);
    });

    it('should validate recommendation quality', async () => {
      // Arrange
      vi.mocked(mockPrivacyService.validateDataCollectionPermission).mockResolvedValue(true);
      vi.mocked(mockDb.getDb().prepare().bind().all).mockResolvedValue({ results: [] });
      vi.mocked(mockDb.getDb().prepare().bind().run).mockResolvedValue({ success: true });

      const analysis = createMockBehavioralAnalysis({ cognitiveLoad: 1.2 });
      const prediction = createMockStrugglePrediction({ riskLevel: 0.8 });

      vi.mocked(mockPatternRecognizer.analyzeRealTimeBehavioralSignals).mockResolvedValue(analysis);
      vi.mocked(mockPatternRecognizer.predictStruggle).mockResolvedValue(prediction);

      // Act
      const recommendations = await interventionEngine.generateProactiveRecommendations(
        'tenant-1',
        'user-1',
        'course-1'
      );

      // Assert: All recommendations should meet quality standards
      recommendations.forEach(rec => {
        expect(rec.id).toEqual(expect.any(String));
        expect(rec.type).toMatch(/^(concept_clarification|practice_suggestion|break_reminder|study_strategy|motivational)$/);
        expect(['low', 'medium', 'high', 'urgent']).toContain(rec.priority);
        expect(rec.message).toEqual(expect.any(String));
        expect(rec.message.length).toBeGreaterThan(10);
        expect(typeof rec.actionable).toBe('boolean');
        expect(typeof rec.dismissible).toBe('boolean');
        expect(rec.validUntil).toBeInstanceOf(Date);
        expect(rec.validUntil.getTime()).toBeGreaterThan(Date.now());
        expect(rec.confidence).toBeGreaterThanOrEqual(0);
        expect(rec.confidence).toBeLessThanOrEqual(1);
      });
    });
  });
});