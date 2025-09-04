/**
 * @fileoverview Research pattern validation tests for synthetic data quality
 * @module features/learner-dna/tests/ResearchPatternValidation
 *
 * Validates that generated synthetic data matches established educational psychology research patterns
 */

import { describe, it, expect, beforeAll, MockFactory, TestDataFactory, ServiceTestHarness } from '@/tests/infrastructure';
import { SyntheticDataGenerator } from '../server/services/SyntheticDataGenerator';
import { CognitiveProfile, LearningSessionData } from '../shared/schemas/learner-dna.schema';

import type { MockD1Database, MockKVNamespace, MockQueue } from '@/tests/infrastructure/types/mocks';
// Helper functions for statistical calculations
function calculateCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length) throw new Error('Arrays must have same length');
  const n = x.length;

  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  const numerator = x.reduce((sum, xi, i) => sum + (xi - meanX) * (y[i] - meanY), 0);
  const denomX = Math.sqrt(x.reduce((sum, xi) => sum + Math.pow(xi - meanX, 2), 0));
  const denomY = Math.sqrt(y.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0));

  if (denomX === 0 || denomY === 0) return 0;
  return numerator / (denomX * denomY);
}

function calculateAverageResponseTime(sessions: LearningSessionData[]): number {
  const responseTimes = sessions.flatMap((s) => s.responseTimesMs || []);
  if (responseTimes.length === 0) return 0;
  return responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
}

function findPeakInRange(data: number[], startHour: number, endHour: number): number {
  let peakHour = startHour;
  let peakValue = data[startHour] || 0;

  for (let hour = startHour + 1; hour <= endHour && hour < data.length; hour++) {
    if (data[hour] > peakValue) {
      peakValue = data[hour];
      peakHour = hour;
    }
  }

  return peakHour;
}

describe('Research Pattern Validation', () => {
  let generator: SyntheticDataGenerator;
  let largeDataset: {
    profiles: CognitiveProfile[];
    sessions: LearningSessionData[];
  };

  beforeAll(async () => {
    generator = new SyntheticDataGenerator(42); // Fixed seed for reproducibility

    // Generate large dataset for statistical validation
    const profiles: CognitiveProfile[] = [];
    const sessions: LearningSessionData[] = [];

    for (let i = 0; i < 500; i++) {
      const profile = generator.generateCognitiveProfile();
      profiles.push(profile);

      // Generate 3-5 sessions per profile
      const sessionCount = 3 + Math.floor(Math.random() * 3);
      const concepts = ['algebra', 'calculus', 'statistics', 'geometry'];

      for (let j = 0; j < sessionCount; j++) {
        const sessionDate = new Date();
        sessionDate.setDate(sessionDate.getDate() - Math.floor(Math.random() * 30));
        const selectedConcepts = concepts.slice(0, 1 + Math.floor(Math.random() * 2));
        sessions.push(generator.generateLearningSession(profile, selectedConcepts, sessionDate));
      }
    }

    largeDataset = { profiles, sessions };
  });

  describe('Ebbinghaus Forgetting Curve Validation', () => {
    it('should follow the classic forgetting curve pattern', () => {
      const curves = largeDataset.profiles.map((p) => p.memoryRetention);

      // Test retention at different time intervals
      const timePoints = [1, 24, 168, 720]; // 1hr, 1day, 1week, 1month (in hours)
      const avgRetentionByTime = timePoints.map((hours) => {
        return (
          curves.reduce((sum, curve) => {
            return sum + generator.calculateMemoryRetention(curve, hours);
          }, 0) / curves.length
        );
      });

      // Classic forgetting curve: steep initial drop, then leveling off
      expect(avgRetentionByTime[0]).toBeGreaterThan(0.85); // ~87% after 1 hour
      expect(avgRetentionByTime[1]).toBeLessThan(avgRetentionByTime[0]); // Decline after 1 day
      expect(avgRetentionByTime[1]).toBeGreaterThan(0.5); // ~56% after 1 day (Ebbinghaus finding)
      expect(avgRetentionByTime[2]).toBeLessThan(avgRetentionByTime[1]); // Further decline
      expect(avgRetentionByTime[2]).toBeGreaterThan(0.25); // ~35% after 1 week
      expect(avgRetentionByTime[3]).toBeGreaterThan(0.15); // Asymptotic level reached

      // The curve should level off (less decline between week 1 and month 1)
      const weeklyDecline = avgRetentionByTime[1] - avgRetentionByTime[2];
      const monthlyDecline = avgRetentionByTime[2] - avgRetentionByTime[3];
      expect(weeklyDecline).toBeGreaterThan(monthlyDecline);
    });

    it('should demonstrate spacing effect benefits', () => {
      const curve = generator.generateMemoryRetentionCurve();

      // Compare retention with and without spaced repetition
      const noSpacingRetention = generator.calculateMemoryRetention(curve, 168, 0); // 1 week, no repetition
      const spacedRetention = generator.calculateMemoryRetention(curve, 168, 3); // 1 week, 3 repetitions

      // Spaced repetition should significantly improve retention
      expect(spacedRetention).toBeGreaterThan(noSpacingRetention);
      expect(spacedRetention / noSpacingRetention).toBeGreaterThan(1.5); // At least 50% improvement
    });

    it('should show individual differences in memory strength', () => {
      const memoryStrengths = largeDataset.profiles.map((p) => p.memoryRetention.memoryStrengthMultiplier);

      // Should have realistic distribution of memory abilities
      const mean = memoryStrengths.reduce((a, b) => a + b) / memoryStrengths.length;
      const variance = memoryStrengths.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / memoryStrengths.length;
      const stdDev = Math.sqrt(variance);

      expect(mean).toBeCloseTo(1.0, 1); // Average should be around 1.0
      expect(stdDev).toBeGreaterThan(0.2); // Meaningful individual differences
      expect(stdDev).toBeLessThan(0.6); // But not unrealistically large
    });
  });

  describe('VARK Learning Styles Research Validation', () => {
    it("should match Fleming's VARK distribution research", () => {
      const styles = largeDataset.profiles.map((p) => p.comprehensionStyle);

      // Calculate average preferences
      const avgVisual = styles.reduce((sum, s) => sum + s.visual, 0) / styles.length;
      const avgAuditory = styles.reduce((sum, s) => sum + s.auditory, 0) / styles.length;
      const avgKinesthetic = styles.reduce((sum, s) => sum + s.kinesthetic, 0) / styles.length;
      const avgReadingWriting = styles.reduce((sum, s) => sum + s.readingWriting, 0) / styles.length;

      // Should match Fleming's research findings approximately
      // Visual: ~35%, Auditory: ~25%, Kinesthetic: ~20%, Reading/Writing: ~20%
      expect(avgVisual).toBeGreaterThan(0.28); // Visual most common
      expect(avgVisual).toBeLessThan(0.42);
      expect(avgAuditory).toBeGreaterThan(0.18);
      expect(avgAuditory).toBeLessThan(0.32);
      expect(avgKinesthetic).toBeGreaterThan(0.13);
      expect(avgKinesthetic).toBeLessThan(0.27);
      expect(avgReadingWriting).toBeGreaterThan(0.13);
      expect(avgReadingWriting).toBeLessThan(0.27);

      // Visual should be most common preference
      expect(avgVisual).toBeGreaterThan(avgAuditory);
      expect(avgVisual).toBeGreaterThan(avgKinesthetic);
      expect(avgVisual).toBeGreaterThan(avgReadingWriting);
    });

    it('should show appropriate multimodal learners', () => {
      const styles = largeDataset.profiles.map((p) => p.comprehensionStyle);

      // Count students with balanced preferences (multimodal learners)
      const multimodalCount = styles.filter((style) => {
        const preferences = [style.visual, style.auditory, style.kinesthetic, style.readingWriting];
        const sortedPrefs = preferences.sort((a, b) => b - a);

        // Multimodal if top preference is less than 50% and second preference is >20%
        return sortedPrefs[0] < 0.5 && sortedPrefs[1] > 0.2;
      }).length;

      const multimodalPercentage = multimodalCount / styles.length;

      // Research suggests 60-70% of students are multimodal
      expect(multimodalPercentage).toBeGreaterThan(0.5);
      expect(multimodalPercentage).toBeLessThan(0.8);
    });
  });

  describe('Cognitive Load Theory Validation (Sweller)', () => {
    it('should respect working memory limitations', () => {
      const cognitiveCapacities = largeDataset.profiles.map((p) => p.strugglePatterns.cognitiveLoadCapacity);

      // Should be normally distributed around 1.0 (representing 7±2 working memory slots)
      const mean = cognitiveCapacities.reduce((a, b) => a + b) / cognitiveCapacities.length;
      expect(mean).toBeGreaterThan(0.85);
      expect(mean).toBeLessThan(1.15);

      // Most students should be within reasonable cognitive load range
      const withinNormalRange = cognitiveCapacities.filter((cap) => cap >= 0.7 && cap <= 1.3).length;
      const normalPercentage = withinNormalRange / cognitiveCapacities.length;
      expect(normalPercentage).toBeGreaterThan(0.7); // 70%+ within normal range
    });

    it('should show cognitive load effects on performance', () => {
      // Group profiles by cognitive load capacity
      const highCapacity = largeDataset.profiles.filter((p) => p.strugglePatterns.cognitiveLoadCapacity > 1.2);
      const lowCapacity = largeDataset.profiles.filter((p) => p.strugglePatterns.cognitiveLoadCapacity < 0.8);

      // Get sessions for these groups
      const highCapacitySessions = largeDataset.sessions.filter((s) => highCapacity.some((p) => p.studentId === s.studentId));
      const lowCapacitySessions = largeDataset.sessions.filter((s) => lowCapacity.some((p) => p.studentId === s.studentId));

      // Calculate average accuracy
      const highCapacityAccuracy =
        highCapacitySessions.reduce((sum, s) => sum + s.correctAnswers / Math.max(1, s.questionsAnswered), 0) / highCapacitySessions.length;

      const lowCapacityAccuracy =
        lowCapacitySessions.reduce((sum, s) => sum + s.correctAnswers / Math.max(1, s.questionsAnswered), 0) / lowCapacitySessions.length;

      // Higher cognitive load capacity should correlate with better performance
      expect(highCapacityAccuracy).toBeGreaterThan(lowCapacityAccuracy);
    });

    it('should show cognitive load effects on learning velocity', () => {
      // Students with higher cognitive capacity should generally learn faster
      const capacities = largeDataset.profiles.map((p) => p.strugglePatterns.cognitiveLoadCapacity);
      const velocities = largeDataset.profiles.map((p) => p.learningVelocity.baseRate);

      // Calculate correlation between capacity and velocity
      const correlation = calculateCorrelation(capacities, velocities);

      // Should show positive correlation (moderate strength expected)
      expect(correlation).toBeGreaterThan(0.2);
      expect(correlation).toBeLessThan(0.8);
    });
  });

  describe('Response Time Research Validation', () => {
    it('should follow Hick-Hyman Law for response times', () => {
      // More complex tasks should take longer
      const sessions = largeDataset.sessions;

      // Group by number of concepts studied (complexity proxy)
      const singleConceptSessions = sessions.filter((s) => s.conceptsStudied.length === 1);
      const multiConceptSessions = sessions.filter((s) => s.conceptsStudied.length >= 2);

      const avgSingleConceptTime = calculateAverageResponseTime(singleConceptSessions);
      const avgMultiConceptTime = calculateAverageResponseTime(multiConceptSessions);

      // Multi-concept sessions should have longer response times
      expect(avgMultiConceptTime).toBeGreaterThan(avgSingleConceptTime);
    });

    it('should show realistic response time distributions', () => {
      const allResponseTimes = largeDataset.sessions.flatMap((s) => s.responseTimesMs);

      // Should follow log-normal distribution (typical for reaction times)
      const logTimes = allResponseTimes.map((t) => Math.log(t));
      const mean = logTimes.reduce((a, b) => a + b) / logTimes.length;
      const variance = logTimes.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / logTimes.length;

      // Log-normal distribution should have reasonable parameters
      expect(Math.exp(mean)).toBeGreaterThan(1000); // Geometric mean > 1 second
      expect(Math.exp(mean)).toBeLessThan(10000); // But < 10 seconds
      expect(variance).toBeGreaterThan(0.1); // Meaningful variability
    });

    it('should show anxiety effects on response times', () => {
      const anxiousProfiles = largeDataset.profiles.filter((p) => p.strugglePatterns.anxietySensitivity > 0.7);
      const calmProfiles = largeDataset.profiles.filter((p) => p.strugglePatterns.anxietySensitivity < 0.3);

      const anxiousSessions = largeDataset.sessions.filter((s) => anxiousProfiles.some((p) => p.studentId === s.studentId));
      const calmSessions = largeDataset.sessions.filter((s) => calmProfiles.some((p) => p.studentId === s.studentId));

      const avgAnxiousTime = calculateAverageResponseTime(anxiousSessions);
      const avgCalmTime = calculateAverageResponseTime(calmSessions);

      // Anxious students should have longer response times
      expect(avgAnxiousTime).toBeGreaterThan(avgCalmTime);
    });
  });

  describe('Learning Progression Research Validation', () => {
    it('should show learning curves over time', () => {
      // Track students with multiple sessions to see learning progression
      const studentsWithMultipleSessions = new Map<string, LearningSessionData[]>();

      largeDataset.sessions.forEach((session) => {
        if (!studentsWithMultipleSessions.has(session.studentId)) {
          studentsWithMultipleSessions.set(session.studentId, []);
        }
        studentsWithMultipleSessions.get(session.studentId)!.push(session);
      });

      // Filter students with at least 3 sessions
      const learningProgressions = Array.from(studentsWithMultipleSessions.entries())
        .filter(([_, sessions]) => sessions.length >= 3)
        .map(([studentId, sessions]) => {
          // Sort by date
          sessions.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

          // Calculate accuracy progression
          const accuracies = sessions.map((s) => s.correctAnswers / Math.max(1, s.questionsAnswered));
          return { studentId, accuracies };
        });

      // Check that most students show some improvement over time
      const improvingStudents = learningProgressions.filter(({ accuracies }) => {
        const firstThird = accuracies.slice(0, Math.floor(accuracies.length / 3));
        const lastThird = accuracies.slice(-Math.floor(accuracies.length / 3));

        const firstAvg = firstThird.reduce((a, b) => a + b) / firstThird.length;
        const lastAvg = lastThird.reduce((a, b) => a + b) / lastThird.length;

        return lastAvg > firstAvg;
      });

      const improvementRate = improvingStudents.length / learningProgressions.length;

      // Most students should show some improvement (but not all - some plateau)
      expect(improvementRate).toBeGreaterThan(0.5);
      expect(improvementRate).toBeLessThan(0.9);
    });

    it('should show expertise effects on learning velocity', () => {
      // Students with higher base learning rates should maintain velocity better
      const fastLearners = largeDataset.profiles.filter((p) => p.learningVelocity.baseRate > 3.0);
      const slowLearners = largeDataset.profiles.filter((p) => p.learningVelocity.baseRate < 2.0);

      // Test velocity maintenance under fatigue
      const fatigueTestTime = 3; // 3 hours of study

      const fastLearnerVelocities = fastLearners.map((p) =>
        generator.calculateLearningVelocity(p.learningVelocity, 10, fatigueTestTime, 14)
      );
      const slowLearnerVelocities = slowLearners.map((p) =>
        generator.calculateLearningVelocity(p.learningVelocity, 10, fatigueTestTime, 14)
      );

      const avgFastVelocity = fastLearnerVelocities.reduce((a, b) => a + b) / fastLearnerVelocities.length;
      const avgSlowVelocity = slowLearnerVelocities.reduce((a, b) => a + b) / slowLearnerVelocities.length;

      expect(avgFastVelocity).toBeGreaterThan(avgSlowVelocity);
    });
  });

  describe('Circadian Rhythm Research Validation', () => {
    it('should show realistic time-of-day performance patterns', () => {
      const engagementPatterns = largeDataset.profiles.map((p) => p.interactionTiming.engagementByHour);

      // Calculate average engagement by hour
      const avgEngagementByHour = Array.from({ length: 24 }, (_, hour) => {
        const hourEngagements = engagementPatterns.map((pattern) => pattern[hour]);
        return hourEngagements.reduce((a, b) => a + b) / hourEngagements.length;
      });

      // Find peak hours
      const morningPeakHour = findPeakInRange(avgEngagementByHour, 8, 12);
      const eveningPeakHour = findPeakInRange(avgEngagementByHour, 18, 22);
      const nightLowHour = findLowInRange(avgEngagementByHour, 23, 6);

      // Morning peak should be higher than night low
      expect(avgEngagementByHour[morningPeakHour]).toBeGreaterThan(avgEngagementByHour[nightLowHour]);

      // Evening should be decent but not as high as morning for most people
      expect(avgEngagementByHour[morningPeakHour]).toBeGreaterThanOrEqual(avgEngagementByHour[eveningPeakHour]);

      // Night hours should be consistently low
      const nightHours = [0, 1, 2, 3, 4, 5, 23];
      const avgNightEngagement = nightHours.reduce((sum, hour) => sum + avgEngagementByHour[hour], 0) / nightHours.length;
      expect(avgNightEngagement).toBeLessThan(0.6);
    });
  });

  describe('Help-Seeking Behavior Research', () => {
    it('should show realistic help-seeking patterns', () => {
      const sessions = largeDataset.sessions;

      // Analyze relationship between confusion events and help requests
      const sessionAnalyses = sessions.map((session) => ({
        confusionCount: session.confusionEvents.length,
        helpRequestCount: session.helpRequestCount,
        duration: session.duration,
      }));

      // Students with more confusion should generally ask for more help
      const highConfusionSessions = sessionAnalyses.filter((s) => s.confusionCount >= 3);
      const lowConfusionSessions = sessionAnalyses.filter((s) => s.confusionCount <= 1);

      const avgHighConfusionHelp = highConfusionSessions.reduce((sum, s) => sum + s.helpRequestCount, 0) / highConfusionSessions.length;
      const avgLowConfusionHelp = lowConfusionSessions.reduce((sum, s) => sum + s.helpRequestCount, 0) / lowConfusionSessions.length;

      expect(avgHighConfusionHelp).toBeGreaterThan(avgLowConfusionHelp);
    });

    it('should show individual differences in help-seeking behavior', () => {
      // Students with lower help-seeking delay should ask for help more often
      const profiles = largeDataset.profiles;
      const sessions = largeDataset.sessions;

      const quickHelpSeekers = profiles.filter((p) => p.strugglePatterns.helpSeekingDelay < 300); // < 5 minutes
      const slowHelpSeekers = profiles.filter((p) => p.strugglePatterns.helpSeekingDelay > 900); // > 15 minutes

      const quickSeekerSessions = sessions.filter((s) => quickHelpSeekers.some((p) => p.studentId === s.studentId));
      const slowSeekerSessions = sessions.filter((s) => slowHelpSeekers.some((p) => p.studentId === s.studentId));

      const avgQuickSeekerHelp = quickSeekerSessions.reduce((sum, s) => sum + s.helpRequestCount, 0) / quickSeekerSessions.length;
      const avgSlowSeekerHelp = slowSeekerSessions.reduce((sum, s) => sum + s.helpRequestCount, 0) / slowSeekerSessions.length;

      expect(avgQuickSeekerHelp).toBeGreaterThan(avgSlowSeekerHelp);
    });
  });

  describe('Statistical Validity Checks', () => {
    it('should generate data with appropriate statistical properties', () => {
      const learningRates = largeDataset.profiles.map((p) => p.learningVelocity.baseRate);

      // Test for normality (simplified)
      const mean = learningRates.reduce((a, b) => a + b) / learningRates.length;
      const variance = learningRates.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / learningRates.length;
      const stdDev = Math.sqrt(variance);

      // Check that ~68% of values are within 1 standard deviation
      const withinOneStd = learningRates.filter((rate) => Math.abs(rate - mean) <= stdDev).length;
      const oneStdPercentage = withinOneStd / learningRates.length;

      expect(oneStdPercentage).toBeGreaterThan(0.6);
      expect(oneStdPercentage).toBeLessThan(0.8);
    });

    it('should maintain correlations between related variables', () => {
      const profiles = largeDataset.profiles;

      // Cognitive load capacity should correlate with learning velocity
      const capacities = profiles.map((p) => p.strugglePatterns.cognitiveLoadCapacity);
      const velocities = profiles.map((p) => p.learningVelocity.baseRate);
      const capacityVelocityCorr = calculateCorrelation(capacities, velocities);

      // Memory strength should correlate with initial retention
      const memoryStrengths = profiles.map((p) => p.memoryRetention.memoryStrengthMultiplier);
      const initialRetentions = profiles.map((p) => p.memoryRetention.initialRetention);
      const memoryRetentionCorr = calculateCorrelation(memoryStrengths, initialRetentions);

      // Frustration tolerance should negatively correlate with anxiety
      const frustrationTolerances = profiles.map((p) => p.strugglePatterns.frustrationTolerance);
      const anxieties = profiles.map((p) => p.strugglePatterns.anxietySensitivity);
      const frustrationAnxietyCorr = calculateCorrelation(frustrationTolerances, anxieties);

      expect(capacityVelocityCorr).toBeGreaterThan(0.1); // Positive correlation
      expect(memoryRetentionCorr).toBeGreaterThan(0.1); // Positive correlation
      expect(frustrationAnxietyCorr).toBeLessThan(-0.1); // Negative correlation
    });
  });
});

function findLowInRange(values: number[], startHour: number, endHour: number): number {
  const hours =
    endHour < startHour
      ? Array.from({ length: 24 }, (_, i) => i).filter((h) => h >= startHour || h <= endHour)
      : Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  let lowHour = hours[0];
  let lowValue = values[hours[0]];

  for (const hour of hours) {
    if (values[hour] < lowValue) {
      lowValue = values[hour];
      lowHour = hour;
    }
  }

  return lowHour;
}
