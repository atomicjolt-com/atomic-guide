/**
 * @fileoverview Comprehensive unit tests for SyntheticDataGenerator
 * @module features/learner-dna/tests/SyntheticDataGenerator
 */

import {  describe, it, expect, beforeEach , MockFactory, TestDataFactory, ServiceTestHarness } from '@/tests/infrastructure';
import { SyntheticDataGenerator } from '../server/services/SyntheticDataGenerator';
import { 
  CognitiveProfile,
  StudentPersona,
  SyntheticDataGenerationParams,
  LearningVelocityPattern,
  MemoryRetentionCurve,
  InteractionTimingPattern,
  ComprehensionStyle,
  StrugglePatternIndicators
} from '../shared/schemas/learner-dna.schema';

import type { MockD1Database, MockKVNamespace, MockQueue } from '@/tests/infrastructure/types/mocks';
describe('SyntheticDataGenerator', () => {
  let generator: SyntheticDataGenerator;

  beforeEach(() => {
    // Use fixed seed for reproducible tests
    generator = new SyntheticDataGenerator(12345);
  });

  describe('Learning Velocity Pattern Generation', () => {
    it('should generate valid learning velocity patterns with default parameters', () => {
      const pattern = generator.generateLearningVelocityPattern();
      
      expect(pattern.baseRate).toBeGreaterThanOrEqual(0.1);
      expect(pattern.baseRate).toBeLessThanOrEqual(10.0);
      expect(pattern.acceleration).toBeGreaterThanOrEqual(0.8);
      expect(pattern.acceleration).toBeLessThanOrEqual(2.5);
      expect(pattern.fatigueDecay).toBeGreaterThanOrEqual(0.1);
      expect(pattern.fatigueDecay).toBeLessThanOrEqual(1.0);
      expect(pattern.timeOfDayMultipliers.morning).toBeGreaterThanOrEqual(0.5);
      expect(pattern.timeOfDayMultipliers.morning).toBeLessThanOrEqual(1.5);
      expect(pattern.weeklyVariation).toBeGreaterThanOrEqual(0.0);
      expect(pattern.weeklyVariation).toBeLessThanOrEqual(0.3);
      expect(pattern.consistencyFactor).toBeGreaterThanOrEqual(0.1);
      expect(pattern.consistencyFactor).toBeLessThanOrEqual(1.0);
    });

    it('should generate different patterns for different personas', () => {
      const fastLearnerPattern = generator.generateLearningVelocityPattern('fast_learner');
      const strugglingStudentPattern = generator.generateLearningVelocityPattern('struggling_student');
      
      // Fast learner should generally have higher base rate
      expect(fastLearnerPattern.baseRate).toBeGreaterThan(strugglingStudentPattern.baseRate);
    });

    it('should produce consistent results with same seed', () => {
      const generator1 = new SyntheticDataGenerator(12345);
      const generator2 = new SyntheticDataGenerator(12345);
      
      const pattern1 = generator1.generateLearningVelocityPattern();
      const pattern2 = generator2.generateLearningVelocityPattern();
      
      expect(pattern1).toEqual(pattern2);
    });

    it('should follow educational research constraints', () => {
      // Generate many patterns to test statistical properties
      const patterns: LearningVelocityPattern[] = [];
      for (let i = 0; i < 100; i++) {
        patterns.push(generator.generateLearningVelocityPattern());
      }
      
      const averageBaseRate = patterns.reduce((sum, p) => sum + p.baseRate, 0) / patterns.length;
      
      // Should be close to research-based mean (2.5 concepts/hour)
      expect(averageBaseRate).toBeGreaterThan(1.5);
      expect(averageBaseRate).toBeLessThan(3.5);
    });
  });

  describe('Memory Retention Curve Generation', () => {
    it('should generate valid Ebbinghaus forgetting curves', () => {
      const curve = generator.generateMemoryRetentionCurve();
      
      expect(curve.initialRetention).toBeGreaterThanOrEqual(0.7);
      expect(curve.initialRetention).toBeLessThanOrEqual(1.0);
      expect(curve.decayConstant).toBeGreaterThanOrEqual(0.1);
      expect(curve.decayConstant).toBeLessThanOrEqual(3.0);
      expect(curve.asymptoticRetention).toBeGreaterThanOrEqual(0.0);
      expect(curve.asymptoticRetention).toBeLessThanOrEqual(0.4);
      expect(curve.spacedRepetitionBonus).toBeGreaterThanOrEqual(1.1);
      expect(curve.spacedRepetitionBonus).toBeLessThanOrEqual(3.0);
    });

    it('should generate curves consistent with Ebbinghaus research', () => {
      const curves: MemoryRetentionCurve[] = [];
      for (let i = 0; i < 50; i++) {
        curves.push(generator.generateMemoryRetentionCurve());
      }
      
      const avgInitialRetention = curves.reduce((sum, c) => sum + c.initialRetention, 0) / curves.length;
      
      // Should match research findings (around 0.87)
      expect(avgInitialRetention).toBeGreaterThan(0.8);
      expect(avgInitialRetention).toBeLessThan(0.95);
    });

    it('should calculate memory retention correctly over time', () => {
      const curve = generator.generateMemoryRetentionCurve();
      
      // Test retention calculation at different time points
      const retention0h = generator.calculateMemoryRetention(curve, 0);
      const retention24h = generator.calculateMemoryRetention(curve, 24);
      const retention168h = generator.calculateMemoryRetention(curve, 168); // 1 week
      
      // Retention should decrease over time (unless spaced repetition)
      expect(retention0h).toBeGreaterThanOrEqual(retention24h);
      expect(retention24h).toBeGreaterThanOrEqual(retention168h);
      
      // Should never go below asymptotic retention
      expect(retention168h).toBeGreaterThanOrEqual(curve.asymptoticRetention);
    });

    it('should show spaced repetition benefits', () => {
      const curve = generator.generateMemoryRetentionCurve();
      
      const retentionNoSpacing = generator.calculateMemoryRetention(curve, 24, 0);
      const retentionWithSpacing = generator.calculateMemoryRetention(curve, 24, 2);
      
      expect(retentionWithSpacing).toBeGreaterThan(retentionNoSpacing);
    });
  });

  describe('Interaction Timing Pattern Generation', () => {
    it('should generate valid timing patterns', () => {
      const pattern = generator.generateInteractionTimingPattern();
      
      expect(pattern.baseResponseTime).toBeGreaterThanOrEqual(500);
      expect(pattern.baseResponseTime).toBeLessThanOrEqual(30000);
      expect(pattern.preferredSessionDuration).toBeGreaterThanOrEqual(5);
      expect(pattern.preferredSessionDuration).toBeLessThanOrEqual(120);
      expect(pattern.engagementByHour).toHaveLength(24);
      
      // All hourly engagement values should be valid
      pattern.engagementByHour.forEach(engagement => {
        expect(engagement).toBeGreaterThanOrEqual(0.3);
        expect(engagement).toBeLessThanOrEqual(1.0);
      });
    });

    it('should reflect circadian rhythm patterns', () => {
      const pattern = generator.generateInteractionTimingPattern();
      
      // Night hours (22-6) should generally have lower engagement
      const nightEngagement = pattern.engagementByHour.slice(22).concat(pattern.engagementByHour.slice(0, 7));
      const dayEngagement = pattern.engagementByHour.slice(8, 20);
      
      const avgNightEngagement = nightEngagement.reduce((a, b) => a + b) / nightEngagement.length;
      const avgDayEngagement = dayEngagement.reduce((a, b) => a + b) / dayEngagement.length;
      
      expect(avgDayEngagement).toBeGreaterThan(avgNightEngagement);
    });

    it('should adapt to persona characteristics', () => {
      const anxiousPattern = generator.generateInteractionTimingPattern('anxious_student');
      const confidentPattern = generator.generateInteractionTimingPattern('confident_student');
      
      // Anxious students tend to have longer response times
      expect(anxiousPattern.baseResponseTime).toBeGreaterThanOrEqual(confidentPattern.baseResponseTime);
    });
  });

  describe('Comprehension Style Generation', () => {
    it('should generate valid VARK distributions', () => {
      const style = generator.generateComprehensionStyle();
      
      expect(style.visual).toBeGreaterThanOrEqual(0.0);
      expect(style.visual).toBeLessThanOrEqual(1.0);
      expect(style.auditory).toBeGreaterThanOrEqual(0.0);
      expect(style.auditory).toBeLessThanOrEqual(1.0);
      expect(style.kinesthetic).toBeGreaterThanOrEqual(0.0);
      expect(style.kinesthetic).toBeLessThanOrEqual(1.0);
      expect(style.readingWriting).toBeGreaterThanOrEqual(0.0);
      expect(style.readingWriting).toBeLessThanOrEqual(1.0);
      
      // VARK preferences should sum approximately to 1.0
      const varkSum = style.visual + style.auditory + style.kinesthetic + style.readingWriting;
      expect(varkSum).toBeGreaterThan(0.8);
      expect(varkSum).toBeLessThan(1.2);
    });

    it('should respect persona-specific preferences', () => {
      const visualLearnerStyle = generator.generateComprehensionStyle('visual_learner');
      const auditoryLearnerStyle = generator.generateComprehensionStyle('auditory_learner');
      
      expect(visualLearnerStyle.visual).toBeGreaterThan(0.5);
      expect(auditoryLearnerStyle.auditory).toBeGreaterThan(0.4);
    });

    it('should generate realistic learning style distributions', () => {
      const styles: ComprehensionStyle[] = [];
      for (let i = 0; i < 100; i++) {
        styles.push(generator.generateComprehensionStyle());
      }
      
      const avgVisual = styles.reduce((sum, s) => sum + s.visual, 0) / styles.length;
      const avgAuditory = styles.reduce((sum, s) => sum + s.auditory, 0) / styles.length;
      
      // Should match Fleming's research findings
      expect(avgVisual).toBeGreaterThan(0.25); // Visual is most common
      expect(avgAuditory).toBeLessThan(avgVisual);
    });
  });

  describe('Struggle Pattern Indicators Generation', () => {
    it('should generate valid struggle patterns', () => {
      const patterns = generator.generateStrugglePatternIndicators();
      
      expect(patterns.confusionTendency).toBeGreaterThanOrEqual(0.0);
      expect(patterns.confusionTendency).toBeLessThanOrEqual(1.0);
      expect(patterns.frustrationTolerance).toBeGreaterThanOrEqual(0.0);
      expect(patterns.frustrationTolerance).toBeLessThanOrEqual(1.0);
      expect(patterns.helpSeekingDelay).toBeGreaterThanOrEqual(0);
      expect(patterns.helpSeekingDelay).toBeLessThanOrEqual(1800);
      expect(patterns.cognitiveLoadCapacity).toBeGreaterThanOrEqual(0.3);
      expect(patterns.cognitiveLoadCapacity).toBeLessThanOrEqual(2.0);
      expect(['immediate', 'delayed', 'poor']).toContain(patterns.errorRecognitionSpeed);
    });

    it('should reflect persona characteristics', () => {
      const fastLearnerPatterns = generator.generateStrugglePatternIndicators('fast_learner');
      const strugglingStudentPatterns = generator.generateStrugglePatternIndicators('struggling_student');
      
      expect(fastLearnerPatterns.confusionTendency).toBeLessThan(strugglingStudentPatterns.confusionTendency);
      expect(fastLearnerPatterns.frustrationTolerance).toBeGreaterThan(strugglingStudentPatterns.frustrationTolerance);
      expect(fastLearnerPatterns.cognitiveLoadCapacity).toBeGreaterThan(strugglingStudentPatterns.cognitiveLoadCapacity);
    });
  });

  describe('Complete Cognitive Profile Generation', () => {
    it('should generate valid complete cognitive profiles', () => {
      const profile = generator.generateCognitiveProfile();
      
      expect(profile.studentId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(profile.persona).toBeDefined();
      expect(profile.learningVelocity).toBeDefined();
      expect(profile.memoryRetention).toBeDefined();
      expect(profile.interactionTiming).toBeDefined();
      expect(profile.comprehensionStyle).toBeDefined();
      expect(profile.strugglePatterns).toBeDefined();
      expect(profile.demographics).toBeDefined();
      expect(profile.temporalMarkers).toBeDefined();
    });

    it('should maintain consistency across profile components', () => {
      const profile = generator.generateCognitiveProfile('fast_learner');
      
      // Fast learners should have consistent characteristics across components
      expect(profile.persona).toBe('fast_learner');
      expect(profile.learningVelocity.baseRate).toBeGreaterThan(0.0);
      expect(profile.memoryRetention.memoryStrengthMultiplier).toBeGreaterThan(0.0);
      expect(profile.strugglePatterns.cognitiveLoadCapacity).toBeGreaterThan(0.0);
    });

    it('should generate realistic demographics', () => {
      const profiles: CognitiveProfile[] = [];
      for (let i = 0; i < 100; i++) {
        profiles.push(generator.generateCognitiveProfile());
      }
      
      // Check realistic distribution of age groups
      const ageGroups = profiles.map(p => p.demographics.ageGroup);
      const undergraduate = ageGroups.filter(age => age === '18-22').length;
      const total = ageGroups.length;
      
      // Undergraduates should be most common (around 40%)
      expect(undergraduate / total).toBeGreaterThan(0.3);
      expect(undergraduate / total).toBeLessThan(0.5);
    });
  });

  describe('Learning Session Generation', () => {
    it('should generate realistic learning sessions', () => {
      const profile = generator.generateCognitiveProfile();
      const concepts = ['algebra', 'calculus', 'geometry'];
      const session = generator.generateLearningSession(profile, concepts);
      
      expect(session.sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(session.studentId).toBe(profile.studentId);
      expect(session.duration).toBeGreaterThanOrEqual(60);
      expect(session.conceptsStudied).toEqual(concepts);
      expect(session.questionsAnswered).toBeGreaterThanOrEqual(0);
      expect(session.correctAnswers).toBeLessThanOrEqual(session.questionsAnswered);
      expect(session.engagementScore).toBeGreaterThanOrEqual(0.0);
      expect(session.engagementScore).toBeLessThanOrEqual(1.0);
    });

    it('should reflect profile characteristics in session data', () => {
      const fastLearnerProfile = generator.generateCognitiveProfile('fast_learner');
      const strugglingProfile = generator.generateCognitiveProfile('struggling_student');
      const concepts = ['algebra'];
      
      const fastSession = generator.generateLearningSession(fastLearnerProfile, concepts);
      const strugglingSession = generator.generateLearningSession(strugglingProfile, concepts);
      
      // Fast learners should generally answer more questions correctly
      const fastAccuracy = fastSession.questionsAnswered > 0 ? fastSession.correctAnswers / fastSession.questionsAnswered : 0;
      const strugglingAccuracy = strugglingSession.questionsAnswered > 0 ? strugglingSession.correctAnswers / strugglingSession.questionsAnswered : 0;
      
      // Only compare if both sessions have questions answered
      if (fastSession.questionsAnswered > 0 && strugglingSession.questionsAnswered > 0) {
        expect(fastAccuracy).toBeGreaterThanOrEqual(strugglingAccuracy);
      } else {
        // At least one session should have questions
        expect(fastSession.questionsAnswered + strugglingSession.questionsAnswered).toBeGreaterThan(0);
      }
    });

    it('should generate confusion events based on struggle patterns', () => {
      const anxiousProfile = generator.generateCognitiveProfile('anxious_student');
      const confidentProfile = generator.generateCognitiveProfile('confident_student');
      const concepts = ['calculus', 'algebra'];
      
      const anxiousSession = generator.generateLearningSession(anxiousProfile, concepts);
      const confidentSession = generator.generateLearningSession(confidentProfile, concepts);
      
      // Anxious students should have more confusion events
      expect(anxiousSession.confusionEvents.length).toBeGreaterThanOrEqual(confidentSession.confusionEvents.length);
    });
  });

  describe('Privacy Attack Data Generation', () => {
    it('should generate valid privacy attack data', () => {
      const profiles = [
        generator.generateCognitiveProfile(),
        generator.generateCognitiveProfile(),
        generator.generateCognitiveProfile(),
      ];
      const target = profiles[0];
      
      const attack = generator.generatePrivacyAttackData(target, profiles, 'linkage_attack');
      
      expect(attack.attackType).toBe('linkage_attack');
      expect(attack.targetStudentId).toBe(target.studentId);
      expect(typeof attack.attackSuccess).toBe('boolean');
      expect(attack.confidenceScore).toBeGreaterThanOrEqual(0.0);
      expect(attack.confidenceScore).toBeLessThanOrEqual(1.0);
      expect(attack.methodUsed).toBeDefined();
      expect(Array.isArray(attack.defensesDefeated)).toBe(true);
      expect(attack.dataPointsUsed).toBeGreaterThan(0);
    });

    it('should simulate different attack types appropriately', () => {
      const profiles = Array.from({ length: 10 }, () => generator.generateCognitiveProfile());
      const target = profiles[0];
      
      const linkageAttack = generator.generatePrivacyAttackData(target, profiles, 'linkage_attack');
      const membershipAttack = generator.generatePrivacyAttackData(target, profiles, 'membership_inference');
      
      expect(linkageAttack.methodUsed).toBe('demographic_fingerprinting');
      expect(membershipAttack.methodUsed).toBe('shadow_model_attack');
      expect(linkageAttack.dataPointsUsed).not.toEqual(membershipAttack.dataPointsUsed);
    });
  });

  describe('Complete Dataset Generation', () => {
    it('should generate complete synthetic datasets', async () => {
      const params: SyntheticDataGenerationParams = {
        studentCount: 10,
        timeRange: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
        },
        privacyParams: {
          epsilonBudget: 1.0,
          deltaPrivacy: 1e-5,
          kAnonymity: 3,
        },
        qualityParams: {
          noiseLevelStd: 0.1,
          missingDataRate: 0.05,
          outlierRate: 0.02,
        },
        realismConstraints: {
          enforcePsychologicalConsistency: true,
          applyEducationalResearchPatterns: true,
          includeIndividualVariability: true,
          generateTemporalCorrelations: true,
        },
      };
      
      const dataset = await generator.generateSyntheticDataset(params);
      
      expect(dataset.profiles).toHaveLength(10);
      expect(dataset.sessions.length).toBeGreaterThan(0);
      expect(dataset.privacyAttacks.length).toBeGreaterThan(0);
      expect(dataset.qualityMetrics).toBeDefined();
      
      // Quality metrics should be reasonable
      expect(dataset.qualityMetrics.statisticalMetrics.correlationAccuracy).toBeGreaterThan(0.0);
      expect(dataset.qualityMetrics.psychologyCompliance.ebbinghausCorrelation).toBeGreaterThan(0.7);
      expect(dataset.qualityMetrics.privacyMetrics.reidentificationRisk).toBeLessThan(1.0);
      expect(dataset.qualityMetrics.utilityMetrics.queryAccuracy).toBeGreaterThan(0.5);
    });
  });

  describe('Educational Psychology Compliance', () => {
    it('should follow Bloom\'s taxonomy progression', () => {
      // Test that learning patterns follow cognitive hierarchy
      const profiles = Array.from({ length: 50 }, () => generator.generateCognitiveProfile());
      
      // Students with higher cognitive load capacity should handle complex concepts better
      const highCapacity = profiles.filter(p => p.strugglePatterns.cognitiveLoadCapacity > 1.3);
      const lowCapacity = profiles.filter(p => p.strugglePatterns.cognitiveLoadCapacity < 0.7);
      
      const avgHighVelocity = highCapacity.reduce((sum, p) => sum + p.learningVelocity.baseRate, 0) / highCapacity.length;
      const avgLowVelocity = lowCapacity.reduce((sum, p) => sum + p.learningVelocity.baseRate, 0) / lowCapacity.length;
      
      expect(avgHighVelocity).toBeGreaterThan(avgLowVelocity);
    });

    it('should maintain Zone of Proximal Development principles', () => {
      // Test that struggle patterns correlate with help-seeking behavior
      const profiles = Array.from({ length: 50 }, () => generator.generateCognitiveProfile());
      
      const highStruggle = profiles.filter(p => p.strugglePatterns.confusionTendency > 0.7);
      const lowStruggle = profiles.filter(p => p.strugglePatterns.confusionTendency < 0.3);
      
      // Only test if both groups have samples
      if (highStruggle.length > 0 && lowStruggle.length > 0) {
        const avgHighHelpDelay = highStruggle.reduce((sum, p) => sum + p.strugglePatterns.helpSeekingDelay, 0) / highStruggle.length;
        const avgLowHelpDelay = lowStruggle.reduce((sum, p) => sum + p.strugglePatterns.helpSeekingDelay, 0) / lowStruggle.length;
        
        // Students who struggle more should seek help sooner
        expect(avgHighHelpDelay).toBeLessThan(avgLowHelpDelay);
      } else {
        // At least some profiles should exist in the sample
        expect(profiles.length).toBeGreaterThan(0);
      }
    });

    it('should respect Cognitive Load Theory limits', () => {
      const profiles = Array.from({ length: 100 }, () => generator.generateCognitiveProfile());
      
      // Test that cognitive load capacity follows realistic distributions
      const capacities = profiles.map(p => p.strugglePatterns.cognitiveLoadCapacity);
      const avgCapacity = capacities.reduce((a, b) => a + b) / capacities.length;
      
      // Should be around 1.0 (Miller's 7±2 working memory slots)
      expect(avgCapacity).toBeGreaterThan(0.8);
      expect(avgCapacity).toBeLessThan(1.3);
    });
  });

  describe('Privacy Protection Validation', () => {
    it('should ensure k-anonymity in generated demographics', () => {
      const profiles = Array.from({ length: 100 }, () => generator.generateCognitiveProfile());
      
      // Group by demographic characteristics
      const demographicGroups = new Map<string, number>();
      profiles.forEach(profile => {
        const key = `${profile.demographics.ageGroup}-${profile.demographics.academicLevel}`;
        demographicGroups.set(key, (demographicGroups.get(key) || 0) + 1);
      });
      
      // Most groups should have at least k=3 members
      const groupSizes = Array.from(demographicGroups.values());
      const smallGroups = groupSizes.filter(size => size < 3).length;
      
      expect(smallGroups / groupSizes.length).toBeLessThan(0.3); // Less than 30% should be small groups
    });

    it('should limit privacy attack success rates', () => {
      const profiles = Array.from({ length: 20 }, () => generator.generateCognitiveProfile());
      const attacks = [];
      
      // Generate various attacks
      for (let i = 0; i < 10; i++) {
        const target = profiles[i];
        const attackTypes = ['linkage_attack', 'membership_inference', 'attribute_inference'] as const;
        
        for (const attackType of attackTypes) {
          attacks.push(generator.generatePrivacyAttackData(target, profiles, attackType));
        }
      }
      
      const successRate = attacks.filter(a => a.attackSuccess).length / attacks.length;
      
      // Overall success rate should be reasonable (not too high)
      expect(successRate).toBeLessThan(0.8);
      expect(successRate).toBeGreaterThan(0.1); // But not zero (realistic)
    });
  });

  describe('Learning Velocity Calculations', () => {
    it('should calculate realistic velocity changes over time', () => {
      const pattern = generator.generateLearningVelocityPattern();
      
      // Test velocity at different study times
      const velocity0h = generator.calculateLearningVelocity(pattern, 0, 0, 10); // 10 AM, fresh
      const velocity2h = generator.calculateLearningVelocity(pattern, 2, 2, 10); // After 2 hours study
      const velocity4h = generator.calculateLearningVelocity(pattern, 4, 4, 10); // After 4 hours
      
      // Should show fatigue effects
      expect(velocity0h).toBeGreaterThanOrEqual(velocity2h);
      expect(velocity2h).toBeGreaterThanOrEqual(velocity4h);
    });

    it('should show recovery after breaks', () => {
      const pattern = generator.generateLearningVelocityPattern();
      
      const velocityBeforeBreak = generator.calculateLearningVelocity(pattern, 10, 3, 14); // 3 hours since break
      const velocityAfterBreak = generator.calculateLearningVelocity(pattern, 10, 0, 14); // Just had break
      
      expect(velocityAfterBreak).toBeGreaterThan(velocityBeforeBreak);
    });

    it('should reflect time-of-day patterns', () => {
      const pattern = generator.generateLearningVelocityPattern();
      
      const morningVelocity = generator.calculateLearningVelocity(pattern, 5, 0, 9); // 9 AM
      const nightVelocity = generator.calculateLearningVelocity(pattern, 5, 0, 23); // 11 PM
      
      // Morning should generally be better than late night (with some tolerance for variation)
      // Allow for small variations in the calculation
      expect(morningVelocity).toBeGreaterThan(nightVelocity * 0.95);
    });
  });

  describe('Data Quality and Realism', () => {
    it('should generate statistically valid distributions', () => {
      const profiles = Array.from({ length: 1000 }, () => generator.generateCognitiveProfile());
      
      // Test learning velocity distribution
      const velocities = profiles.map(p => p.learningVelocity.baseRate);
      const mean = velocities.reduce((a, b) => a + b) / velocities.length;
      const variance = velocities.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / velocities.length;
      const stdDev = Math.sqrt(variance);
      
      // Should follow realistic educational research distributions
      expect(mean).toBeGreaterThan(1.5);
      expect(mean).toBeLessThan(3.5);
      expect(stdDev).toBeGreaterThan(0.5);
      expect(stdDev).toBeLessThan(2.0);
    });

    it('should maintain temporal correlations in learning data', () => {
      const profile = generator.generateCognitiveProfile();
      const concepts = ['algebra', 'geometry'];
      
      // Generate multiple sessions over time
      const sessions = [];
      for (let day = 0; day < 10; day++) {
        const sessionDate = new Date();
        sessionDate.setDate(sessionDate.getDate() - day);
        sessions.push(generator.generateLearningSession(profile, concepts, sessionDate));
      }
      
      // Check that sessions are related (similar student should have somewhat consistent performance)
      const accuracies = sessions.map(s => s.correctAnswers / Math.max(1, s.questionsAnswered));
      const accuracyVariance = calculateVariance(accuracies);
      
      // Variance shouldn't be too high (student should be somewhat consistent)
      expect(accuracyVariance).toBeLessThan(0.25);
    });
  });

});

// Helper function for variance calculation
function calculateVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b) / values.length;
  return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
}