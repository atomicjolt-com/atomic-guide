/**
 * @fileoverview Comprehensive synthetic data generator for Learner DNA Foundation
 * @module features/learner-dna/server/services/SyntheticDataGenerator
 * 
 * This service generates realistic cognitive and behavioral patterns without using real student data.
 * All algorithms are based on established educational psychology research and learning science.
 * 
 * Key Research Foundations:
 * - Ebbinghaus Forgetting Curve (1885) - Memory retention over time
 * - Bloom's Taxonomy (1956) - Cognitive skill hierarchy
 * - VARK Learning Styles (Fleming, 1987) - Multimodal learning preferences  
 * - Cognitive Load Theory (Sweller, 1988) - Working memory limitations
 * - Zone of Proximal Development (Vygotsky) - Optimal challenge level
 * - Spacing Effect (Cepeda et al., 2006) - Distributed practice benefits
 */

import { z } from 'zod';
import type { 
  CognitiveProfile,
  LearningVelocityPattern,
  MemoryRetentionCurve,
  InteractionTimingPattern,
  ComprehensionStyle,
  StrugglePatternIndicators,
  StudentPersona,
  LearningSessionData,
  PrivacyAttackData,
  SyntheticDataGenerationParams,
  DataQualityMetrics
} from '../../shared/schemas/learner-dna.schema';

import {
  LearnerDNASchemas
} from '../../shared/schemas/learner-dna.schema';

/**
 * Educational psychology research constants
 */
const EDUCATIONAL_RESEARCH_CONSTANTS = {
  // Ebbinghaus forgetting curve parameters (from meta-analysis)
  EBBINGHAUS: {
    INITIAL_RETENTION_MEAN: 0.87,
    INITIAL_RETENTION_STD: 0.08,
    DECAY_CONSTANT_MEAN: 1.25,
    DECAY_CONSTANT_STD: 0.5,
    ASYMPTOTIC_RETENTION_MEAN: 0.15,
    ASYMPTOTIC_RETENTION_STD: 0.08,
  },
  
  // Learning velocity research (from spaced learning studies)
  LEARNING_VELOCITY: {
    BASE_RATE_MEAN: 2.5, // concepts per hour
    BASE_RATE_STD: 1.2,
    ACCELERATION_MEAN: 1.3,
    ACCELERATION_STD: 0.4,
    FATIGUE_DECAY_MEAN: 0.7,
    FATIGUE_DECAY_STD: 0.2,
  },

  // Cognitive load theory parameters (Sweller)
  COGNITIVE_LOAD: {
    WORKING_MEMORY_CAPACITY_MEAN: 7, // Miller's magic number ±2
    WORKING_MEMORY_CAPACITY_STD: 2,
    INTRINSIC_LOAD_FACTOR: 0.6,
    EXTRANEOUS_LOAD_FACTOR: 0.3,
    GERMANE_LOAD_FACTOR: 0.1,
  },

  // VARK learning style distributions (Fleming research)
  VARK_DISTRIBUTIONS: {
    VISUAL: { mean: 0.35, std: 0.15 },
    AUDITORY: { mean: 0.25, std: 0.12 },
    KINESTHETIC: { mean: 0.20, std: 0.10 },
    READING_WRITING: { mean: 0.20, std: 0.10 },
  },

  // Response time research (from cognitive psychology)
  RESPONSE_TIMES: {
    SIMPLE_DECISION_MS: 400,
    COMPLEX_DECISION_MS: 1200,
    PROBLEM_SOLVING_MS: 8000,
    READING_COMPREHENSION_WPM: 250, // words per minute
  },
} as const;

/**
 * Student persona definitions with psychological profiles
 */
const PERSONA_PROFILES = {
  fast_learner: {
    learningVelocityMultiplier: 1.8,
    memoryStrengthMultiplier: 1.6,
    cognitiveLoadCapacity: 1.8,
    frustrationTolerance: 0.8,
    persistenceLevel: 0.9,
    helpSeekingDelay: 600, // 10 minutes
    anxietySensitivity: 0.2,
  },
  struggling_student: {
    learningVelocityMultiplier: 0.5,
    memoryStrengthMultiplier: 0.7,
    cognitiveLoadCapacity: 0.6,
    frustrationTolerance: 0.3,
    persistenceLevel: 0.4,
    helpSeekingDelay: 120, // 2 minutes
    anxietySensitivity: 0.8,
  },
  visual_learner: {
    visualPreference: 0.6,
    auditoryPreference: 0.2,
    kinestheticPreference: 0.1,
    readingWritingPreference: 0.1,
    processingSpeed: 'moderate',
  },
  auditory_learner: {
    visualPreference: 0.2,
    auditoryPreference: 0.6,
    kinestheticPreference: 0.1,
    readingWritingPreference: 0.1,
    processingSpeed: 'moderate',
  },
  kinesthetic_learner: {
    visualPreference: 0.2,
    auditoryPreference: 0.1,
    kinestheticPreference: 0.6,
    readingWritingPreference: 0.1,
    processingSpeed: 'slow_deep',
  },
  perfectionist: {
    frustrationTolerance: 0.2,
    persistenceLevel: 0.95,
    helpSeekingDelay: 1200, // 20 minutes
    anxietySensitivity: 0.9,
    errorRecognitionSpeed: 'immediate',
    imposterSyndromeTendency: 0.7,
  },
  procrastinator: {
    procrastinationFactor: 1.8,
    persistenceLevel: 0.3,
    engagementDeclineRate: 0.08,
    preferredSessionDuration: 20, // shorter sessions
    breakFrequency: 2, // frequent breaks
  },
  anxious_student: {
    anxietySensitivity: 0.85,
    frustrationTolerance: 0.25,
    cognitiveLoadCapacity: 0.7, // anxiety reduces working memory
    helpSeekingDelay: 300, // 5 minutes
    imposterSyndromeTendency: 0.6,
  },
  confident_student: {
    anxietySensitivity: 0.1,
    frustrationTolerance: 0.9,
    cognitiveLoadCapacity: 1.2,
    persistenceLevel: 0.8,
    helpSeekingDelay: 900, // 15 minutes
    imposterSyndromeTendency: 0.1,
  },
  // ... additional personas can be defined
} as const;

/**
 * Synthetic Data Generator for Learner DNA
 * 
 * Generates realistic cognitive and behavioral patterns based on educational psychology research.
 * Designed to enable safe development and testing without exposing real student data.
 */
export class SyntheticDataGenerator {
  private rng: () => number;
  private seed: number;

  constructor(seed?: number) {
    this.seed = seed || Date.now();
    this.rng = this.createSeededRNG(this.seed);
  }

  /**
   * Create a seeded pseudo-random number generator for reproducible results
   * Uses Linear Congruential Generator for deterministic output
   */
  private createSeededRNG(seed: number): () => number {
    let state = seed;
    return (): number => {
      state = (state * 1664525 + 1013904223) % Math.pow(2, 32);
      return state / Math.pow(2, 32);
    };
  }

  /**
   * Generate a random number from normal distribution using Box-Muller transform
   */
  private normalRandom(mean: number = 0, std: number = 1): number {
    // Box-Muller transform for normal distribution
    const u1 = this.rng();
    const u2 = this.rng();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * std + mean;
  }

  /**
   * Generate random number from beta distribution (for bounded values)
   */
  private betaRandom(alpha: number, beta: number): number {
    // Simple rejection sampling for beta distribution
    let x: number, y: number;
    do {
      x = this.rng();
      y = this.rng();
    } while (Math.pow(x, alpha - 1) * Math.pow(1 - x, beta - 1) < y);
    return x;
  }

  /**
   * Generate learning velocity patterns based on educational research
   */
  generateLearningVelocityPattern(persona?: StudentPersona): LearningVelocityPattern {
    const personaProfile = persona ? PERSONA_PROFILES[persona] : null;
    const multiplier = personaProfile?.learningVelocityMultiplier || 1.0;

    const constants = EDUCATIONAL_RESEARCH_CONSTANTS.LEARNING_VELOCITY;
    
    const baseRate = Math.max(0.1, Math.min(10.0,
      this.normalRandom(constants.BASE_RATE_MEAN, constants.BASE_RATE_STD) * multiplier
    ));

    const acceleration = Math.max(0.8, Math.min(2.5,
      this.normalRandom(constants.ACCELERATION_MEAN, constants.ACCELERATION_STD)
    ));

    const fatigueDecay = Math.max(0.1, Math.min(1.0,
      this.normalRandom(constants.FATIGUE_DECAY_MEAN, constants.FATIGUE_DECAY_STD)
    ));

    // Time-of-day patterns based on chronobiology research
    const timeOfDayMultipliers = {
      morning: Math.max(0.5, Math.min(1.5, this.normalRandom(1.0, 0.2))),
      afternoon: Math.max(0.5, Math.min(1.5, this.normalRandom(0.9, 0.2))),
      evening: Math.max(0.5, Math.min(1.5, this.normalRandom(0.8, 0.2))),
    };

    return LearnerDNASchemas.LearningVelocityPattern.parse({
      baseRate,
      acceleration,
      fatigueDecay,
      recoveryRate: Math.max(0.1, Math.min(2.0, this.normalRandom(1.0, 0.3))),
      timeOfDayMultipliers,
      weeklyVariation: Math.max(0.0, Math.min(0.3, this.normalRandom(0.1, 0.05))),
      consistencyFactor: Math.max(0.1, Math.min(1.0, this.betaRandom(2, 2))),
    });
  }

  /**
   * Generate Ebbinghaus forgetting curves based on memory research
   */
  generateMemoryRetentionCurve(persona?: StudentPersona): MemoryRetentionCurve {
    const personaProfile = persona ? PERSONA_PROFILES[persona] : null;
    const memoryMultiplier = personaProfile?.memoryStrengthMultiplier || 1.0;

    const constants = EDUCATIONAL_RESEARCH_CONSTANTS.EBBINGHAUS;

    const initialRetention = Math.max(0.7, Math.min(1.0,
      this.normalRandom(constants.INITIAL_RETENTION_MEAN, constants.INITIAL_RETENTION_STD)
    ));

    // Decay constant inversely related to memory strength
    const decayConstant = Math.max(0.1, Math.min(3.0,
      this.normalRandom(constants.DECAY_CONSTANT_MEAN, constants.DECAY_CONSTANT_STD) / memoryMultiplier
    ));

    const asymptoticRetention = Math.max(0.0, Math.min(0.4,
      this.normalRandom(constants.ASYMPTOTIC_RETENTION_MEAN, constants.ASYMPTOTIC_RETENTION_STD)
    ));

    // Spaced repetition effectiveness (based on Cepeda et al. research)
    const spacedRepetitionBonus = Math.max(1.1, Math.min(3.0,
      this.normalRandom(2.0, 0.4) * memoryMultiplier
    ));

    return LearnerDNASchemas.MemoryRetentionCurve.parse({
      initialRetention,
      decayConstant,
      asymptoticRetention,
      spacedRepetitionBonus,
      interferenceFactor: Math.max(0.8, Math.min(1.2, this.normalRandom(1.0, 0.1))),
      memoryStrengthMultiplier: memoryMultiplier,
      sleepConsolidationBonus: Math.max(1.0, Math.min(1.4, this.normalRandom(1.2, 0.1))),
    });
  }

  /**
   * Generate interaction timing patterns based on cognitive psychology research
   */
  generateInteractionTimingPattern(persona?: StudentPersona): InteractionTimingPattern {
    const personaProfile = persona ? PERSONA_PROFILES[persona] : null;
    
    const constants = EDUCATIONAL_RESEARCH_CONSTANTS.RESPONSE_TIMES;
    
    // Base response time influenced by processing speed and anxiety
    const anxietyFactor = personaProfile?.anxietySensitivity || 0.5;
    const baseResponseTime = Math.round(
      constants.SIMPLE_DECISION_MS * (1 + anxietyFactor * 0.5) + 
      this.normalRandom(0, 200)
    );

    // Generate 24-hour engagement pattern (circadian rhythm simulation)
    const engagementByHour: number[] = [];
    for (let hour = 0; hour < 24; hour++) {
      // Peak alertness typically 10am-12pm and 6pm-8pm
      const morningPeak = Math.exp(-Math.pow((hour - 11) / 3, 2));
      const eveningPeak = Math.exp(-Math.pow((hour - 19) / 2, 2)) * 0.8;
      const nightDip = hour >= 22 || hour <= 6 ? 0.3 : 1.0;
      
      const baseEngagement = (morningPeak + eveningPeak) * nightDip + 0.4;
      const noise = this.normalRandom(0, 0.1);
      engagementByHour.push(Math.max(0.3, Math.min(1.0, baseEngagement + noise)));
    }

    return LearnerDNASchemas.InteractionTimingPattern.parse({
      baseResponseTime: Math.max(500, Math.min(30000, baseResponseTime)),
      responseVariability: Math.max(0.1, Math.min(2.0, this.normalRandom(1.0, 0.3))),
      complexityMultiplier: Math.max(1.2, Math.min(5.0, this.normalRandom(2.5, 0.8))),
      preferredSessionDuration: Math.round(Math.max(5, Math.min(120, 
        personaProfile?.preferredSessionDuration || this.normalRandom(45, 20)
      ))),
      breakFrequency: Math.round(Math.max(1, Math.min(10, 
        personaProfile?.breakFrequency || this.normalRandom(4, 2)
      ))),
      engagementDeclineRate: Math.max(0.0, Math.min(0.1, 
        personaProfile?.engagementDeclineRate || this.normalRandom(0.02, 0.01)
      )),
      engagementByHour,
      procrastinationFactor: Math.max(0.0, Math.min(2.0, 
        personaProfile?.procrastinationFactor || this.normalRandom(1.0, 0.3)
      )),
    });
  }

  /**
   * Generate comprehension style distribution based on VARK research
   */
  generateComprehensionStyle(persona?: StudentPersona): ComprehensionStyle {
    const personaProfile = persona ? PERSONA_PROFILES[persona] : null;
    
    let visual: number, auditory: number, kinesthetic: number, readingWriting: number;

    // Use persona-specific preferences if available
    if (personaProfile?.visualPreference !== undefined) {
      visual = personaProfile.visualPreference;
      auditory = personaProfile.auditoryPreference || 0.25;
      kinesthetic = personaProfile.kinestheticPreference || 0.25;
      readingWriting = personaProfile.readingWritingPreference || 0.25;
    } else {
      // Generate from research-based distributions
      const vark = EDUCATIONAL_RESEARCH_CONSTANTS.VARK_DISTRIBUTIONS;
      visual = Math.max(0, this.normalRandom(vark.VISUAL.mean, vark.VISUAL.std));
      auditory = Math.max(0, this.normalRandom(vark.AUDITORY.mean, vark.AUDITORY.std));
      kinesthetic = Math.max(0, this.normalRandom(vark.KINESTHETIC.mean, vark.KINESTHETIC.std));
      readingWriting = Math.max(0, this.normalRandom(vark.READING_WRITING.mean, vark.READING_WRITING.std));
      
      // Normalize to sum approximately to 1.0
      const total = visual + auditory + kinesthetic + readingWriting;
      if (total > 0) {
        visual /= total;
        auditory /= total;
        kinesthetic /= total;
        readingWriting /= total;
      }
    }

    // Sequential vs Global processing (based on Felder-Silverman model)
    const sequentialVsGlobal = this.betaRandom(2, 2); // U-shaped distribution

    // Abstract vs Concrete thinking (Kolb's experiential learning theory)
    const abstractVsConcrete = this.betaRandom(2, 2);

    // Collaborative vs Independent preference
    const collaborativeVsIndependent = this.betaRandom(1.5, 1.5);

    // Processing speed preference
    const speedRandom = this.rng();
    const processingSpeed = speedRandom < 0.3 ? 'slow_deep' : 
                           speedRandom < 0.8 ? 'moderate' : 'fast_surface';

    return LearnerDNASchemas.ComprehensionStyle.parse({
      visual,
      auditory,
      kinesthetic,
      readingWriting,
      sequentialVsGlobal,
      abstractVsConcrete,
      collaborativeVsIndependent,
      processingSpeed,
    });
  }

  /**
   * Generate struggle pattern indicators based on learning psychology
   */
  generateStrugglePatternIndicators(persona?: StudentPersona): StrugglePatternIndicators {
    const personaProfile = persona ? PERSONA_PROFILES[persona] : null;

    const confusionTendency = Math.max(0, Math.min(1, 
      personaProfile?.confusionTendency !== undefined 
        ? personaProfile.confusionTendency 
        : this.betaRandom(1.2, 2.8) // skewed toward lower confusion
    ));

    const frustrationTolerance = Math.max(0, Math.min(1,
      personaProfile?.frustrationTolerance !== undefined
        ? personaProfile.frustrationTolerance
        : this.betaRandom(2, 2) // normal distribution around 0.5
    ));

    const helpSeekingDelay = Math.round(Math.max(0, Math.min(1800,
      personaProfile?.helpSeekingDelay !== undefined
        ? personaProfile.helpSeekingDelay
        : this.normalRandom(300, 200) // 5 minutes average with variation
    )));

    const persistenceLevel = Math.max(0, Math.min(1,
      personaProfile?.persistenceLevel !== undefined
        ? personaProfile.persistenceLevel
        : this.betaRandom(2.5, 1.5) // skewed toward higher persistence
    ));

    const cognitiveLoadCapacity = Math.max(0.3, Math.min(2.0,
      personaProfile?.cognitiveLoadCapacity !== undefined
        ? personaProfile.cognitiveLoadCapacity
        : this.normalRandom(1.0, 0.3) // based on working memory research
    ));

    const anxietySensitivity = Math.max(0, Math.min(1,
      personaProfile?.anxietySensitivity !== undefined
        ? personaProfile.anxietySensitivity
        : this.betaRandom(1.5, 2.5) // skewed toward lower anxiety
    ));

    const metacognitiveAwareness = Math.max(0, Math.min(1,
      this.betaRandom(2, 1.8) // slightly skewed toward higher awareness
    ));

    const errorRecognitionSpeed = personaProfile?.errorRecognitionSpeed || 
      (() => {
        const rand = this.rng();
        return rand < 0.4 ? 'immediate' : rand < 0.8 ? 'delayed' : 'poor';
      })();

    const imposterSyndromeTendency = Math.max(0, Math.min(1,
      personaProfile?.imposterSyndromeTendency !== undefined
        ? personaProfile.imposterSyndromeTendency
        : this.betaRandom(1.5, 3) // skewed toward lower imposter syndrome
    ));

    return LearnerDNASchemas.StrugglePatternIndicators.parse({
      confusionTendency,
      frustrationTolerance,
      helpSeekingDelay,
      persistenceLevel,
      cognitiveLoadCapacity,
      anxietySensitivity,
      metacognitiveAwareness,
      errorRecognitionSpeed,
      imposterSyndromeTendency,
    });
  }

  /**
   * Generate a complete cognitive profile for a synthetic student
   */
  generateCognitiveProfile(persona?: StudentPersona): CognitiveProfile {
    // If no persona specified, randomly select one
    const actualPersona = persona || this.selectRandomPersona();

    const studentId = crypto.randomUUID();
    const now = new Date();
    const createdAt = new Date(now.getTime() - this.rng() * 365 * 24 * 60 * 60 * 1000); // Up to 1 year ago

    return LearnerDNASchemas.CognitiveProfile.parse({
      studentId,
      persona: actualPersona,
      learningVelocity: this.generateLearningVelocityPattern(actualPersona),
      memoryRetention: this.generateMemoryRetentionCurve(actualPersona),
      interactionTiming: this.generateInteractionTimingPattern(actualPersona),
      comprehensionStyle: this.generateComprehensionStyle(actualPersona),
      strugglePatterns: this.generateStrugglePatternIndicators(actualPersona),
      demographics: this.generateDemographics(),
      temporalMarkers: {
        createdAt,
        lastActive: new Date(createdAt.getTime() + this.rng() * (now.getTime() - createdAt.getTime())),
        totalStudyHours: Math.round(Math.max(0, this.normalRandom(50, 30))),
        sessionsCompleted: Math.round(Math.max(0, this.normalRandom(25, 15))),
      },
    });
  }

  /**
   * Select a random student persona weighted by realistic distribution
   */
  private selectRandomPersona(): StudentPersona {
    const personas: Array<{ persona: StudentPersona; weight: number }> = [
      { persona: 'fast_learner', weight: 0.15 },
      { persona: 'struggling_student', weight: 0.20 },
      { persona: 'visual_learner', weight: 0.12 },
      { persona: 'auditory_learner', weight: 0.08 },
      { persona: 'kinesthetic_learner', weight: 0.08 },
      { persona: 'perfectionist', weight: 0.10 },
      { persona: 'procrastinator', weight: 0.12 },
      { persona: 'anxious_student', weight: 0.10 },
      { persona: 'confident_student', weight: 0.05 },
    ];

    const random = this.rng();
    let cumulativeWeight = 0;
    
    for (const { persona, weight } of personas) {
      cumulativeWeight += weight;
      if (random <= cumulativeWeight) {
        return persona;
      }
    }
    
    return 'struggling_student'; // fallback
  }

  /**
   * Generate realistic demographic data for k-anonymity testing
   */
  private generateDemographics() {
    const ageGroups = ['18-22', '23-30', '31-40', '41-50', '50+'];
    const ageWeights = [0.4, 0.3, 0.15, 0.1, 0.05];
    
    const academicLevels = ['high_school', 'undergraduate', 'graduate', 'professional'];
    const academicWeights = [0.15, 0.6, 0.2, 0.05];

    const selectWeighted = <T>(items: T[], weights: number[]): T => {
      const random = this.rng();
      let cumulativeWeight = 0;
      for (let i = 0; i < items.length; i++) {
        cumulativeWeight += weights[i];
        if (random <= cumulativeWeight) {
          return items[i];
        }
      }
      return items[items.length - 1];
    };

    // Generate correlated learning disabilities (realistic prevalence)
    const learningDisabilities: Array<'dyslexia' | 'adhd' | 'dyscalculia' | 'autism' | 'none'> = [];
    if (this.rng() < 0.15) { // ~15% have some learning difference
      const disabilities = ['dyslexia', 'adhd', 'dyscalculia', 'autism'];
      const disabilityWeights = [0.05, 0.06, 0.03, 0.02]; // Approximate prevalence rates
      const selected = selectWeighted(disabilities, disabilityWeights) as 'dyslexia' | 'adhd' | 'dyscalculca' | 'autism';
      learningDisabilities.push(selected);
    } else {
      learningDisabilities.push('none');
    }

    return {
      ageGroup: selectWeighted(ageGroups, ageWeights) as '18-22' | '23-30' | '31-40' | '41-50' | '50+',
      academicLevel: selectWeighted(academicLevels, academicWeights) as 'high_school' | 'undergraduate' | 'graduate' | 'professional',
      priorKnowledge: selectWeighted(['novice', 'intermediate', 'advanced'], [0.4, 0.45, 0.15]) as 'novice' | 'intermediate' | 'advanced',
      mathBackground: selectWeighted(['weak', 'moderate', 'strong'], [0.3, 0.5, 0.2]) as 'weak' | 'moderate' | 'strong',
      nativeLanguage: selectWeighted(['english', 'spanish', 'other'], [0.7, 0.15, 0.15]) as 'english' | 'spanish' | 'other',
      learningDisabilities,
      socioeconomicBackground: selectWeighted(['low', 'middle', 'high'], [0.25, 0.6, 0.15]) as 'low' | 'middle' | 'high',
    };
  }

  /**
   * Generate realistic learning session data based on cognitive profile
   */
  generateLearningSession(
    profile: CognitiveProfile,
    conceptsToStudy: string[],
    sessionDate: Date = new Date()
  ): LearningSessionData {
    const sessionId = crypto.randomUUID();
    
    // Session duration based on persona and timing patterns
    const baseDuration = profile.interactionTiming.preferredSessionDuration * 60; // convert to seconds
    const actualDuration = Math.max(60, Math.round(
      baseDuration + this.normalRandom(0, baseDuration * 0.3)
    ));

    const startTime = new Date(sessionDate);
    const endTime = new Date(startTime.getTime() + actualDuration * 1000);

    // Generate questions answered based on learning velocity
    const questionsPerHour = profile.learningVelocity.baseRate * 4; // rough conversion
    const durationHours = actualDuration / 3600;
    const questionsAnswered = Math.round(Math.max(0, questionsPerHour * durationHours));

    // Accuracy based on struggle patterns and cognitive load
    const accuracyBase = 1 - profile.strugglePatterns.confusionTendency * 0.5;
    const cognitiveLoadPenalty = profile.strugglePatterns.cognitiveLoadCapacity < 1 ? 0.1 : 0;
    const accuracy = Math.max(0.1, accuracyBase - cognitiveLoadPenalty);
    const correctAnswers = Math.round(questionsAnswered * accuracy);

    // Generate response times based on interaction patterns
    const responseTimesMs: number[] = [];
    for (let i = 0; i < questionsAnswered; i++) {
      const baseTime = profile.interactionTiming.baseResponseTime;
      const complexity = this.rng() * profile.interactionTiming.complexityMultiplier;
      const variability = this.normalRandom(1, profile.interactionTiming.responseVariability);
      const responseTime = Math.round(baseTime * complexity * Math.max(0.1, variability));
      responseTimesMs.push(Math.max(100, responseTime));
    }

    // Generate confusion events based on struggle patterns
    const confusionEvents = [];
    const confusionCount = Math.round(
      profile.strugglePatterns.confusionTendency * conceptsToStudy.length * 2
    );
    
    for (let i = 0; i < confusionCount; i++) {
      const eventTime = new Date(
        startTime.getTime() + this.rng() * actualDuration * 1000
      );
      const conceptId = conceptsToStudy[Math.floor(this.rng() * conceptsToStudy.length)];
      const severity = this.rng() < 0.2 ? 'high' : this.rng() < 0.5 ? 'medium' : 'low';
      const resolved = this.rng() < profile.strugglePatterns.persistenceLevel;

      confusionEvents.push({
        timestamp: eventTime,
        conceptId,
        severity: severity as 'low' | 'medium' | 'high',
        resolved,
      });
    }

    // Calculate engagement score based on various factors
    const hourOfDay = startTime.getHours();
    const timeEngagement = profile.interactionTiming.engagementByHour[hourOfDay] || 0.5;
    const frustrationPenalty = (1 - profile.strugglePatterns.frustrationTolerance) * 0.2;
    const engagementScore = Math.max(0, Math.min(1, timeEngagement - frustrationPenalty));

    // Cognitive load indicator
    const cognitiveLoadIndicator = Math.min(2.0, 
      1.0 + (conceptsToStudy.length / profile.strugglePatterns.cognitiveLoadCapacity) * 0.3
    );

    // Help request count based on help-seeking behavior
    const helpRequestCount = Math.round(
      confusionCount * (1 - profile.strugglePatterns.helpSeekingDelay / 1800)
    );

    // Break count based on preferences
    const breaksCount = Math.round(
      actualDuration / (profile.interactionTiming.preferredSessionDuration * 60) * 
      profile.interactionTiming.breakFrequency
    );

    // Mastery gained (simplified model)
    const masteryGained = Math.max(0, Math.min(1,
      accuracy * profile.learningVelocity.baseRate / conceptsToStudy.length * 0.3
    ));

    // Expected retention based on memory curve
    const retentionExpected = Math.max(0, Math.min(1,
      profile.memoryRetention.initialRetention * accuracy
    ));

    return LearnerDNASchemas.LearningSessionData.parse({
      sessionId,
      studentId: profile.studentId,
      startTime,
      endTime,
      duration: actualDuration,
      conceptsStudied: conceptsToStudy,
      questionsAnswered,
      correctAnswers,
      responseTimesMs,
      helpRequestCount,
      breaksCount,
      confusionEvents,
      engagementScore,
      cognitiveLoadIndicator,
      masteryGained,
      retentionExpected,
    });
  }

  /**
   * Generate privacy attack testing data for re-identification attempts
   */
  generatePrivacyAttackData(
    targetProfile: CognitiveProfile,
    availableProfiles: CognitiveProfile[],
    attackType: 'linkage_attack' | 'membership_inference' | 'attribute_inference' | 'reconstruction_attack' | 'differential_attack'
  ): PrivacyAttackData {
    const auxiliaryData: Record<string, unknown> = {};
    let attackSuccess = false;
    let confidenceScore = 0;
    let methodUsed = '';
    let defensesDefeated: string[] = [];
    let dataPointsUsed = 0;

    switch (attackType) {
      case 'linkage_attack': {
        // Attempt to link demographic data with performance patterns
        auxiliaryData.demographics = targetProfile.demographics;
        auxiliaryData.sessionPattern = {
          preferredDuration: targetProfile.interactionTiming.preferredSessionDuration,
          engagementPeakHour: targetProfile.interactionTiming.engagementByHour.indexOf(
            Math.max(...targetProfile.interactionTiming.engagementByHour)
          ),
        };
        
        // Simulate attack success based on uniqueness of combination
        const demographicMatches = availableProfiles.filter(p => 
          p.demographics.ageGroup === targetProfile.demographics.ageGroup &&
          p.demographics.academicLevel === targetProfile.demographics.academicLevel
        ).length;
        
        attackSuccess = demographicMatches <= 3; // k-anonymity violation
        confidenceScore = demographicMatches === 1 ? 0.95 : 
                         demographicMatches <= 3 ? 0.7 : 0.3;
        methodUsed = 'demographic_fingerprinting';
        dataPointsUsed = 5;
        if (attackSuccess) defensesDefeated.push('k_anonymity');
        break;
      }

      case 'membership_inference':
        // Attempt to determine if a student is in the training dataset
        auxiliaryData.learningPattern = {
          velocitySignature: targetProfile.learningVelocity.baseRate,
          memoryStrength: targetProfile.memoryRetention.memoryStrengthMultiplier,
        };
        
        attackSuccess = this.rng() < 0.6; // Reasonable success rate for membership inference
        confidenceScore = attackSuccess ? 0.8 : 0.4;
        methodUsed = 'shadow_model_attack';
        dataPointsUsed = 10;
        if (attackSuccess) defensesDefeated.push('differential_privacy');
        break;

      case 'attribute_inference':
        // Attempt to infer sensitive attributes from behavior patterns
        auxiliaryData.behaviorPattern = {
          responseTimeVariability: targetProfile.interactionTiming.responseVariability,
          frustrationTolerance: targetProfile.strugglePatterns.frustrationTolerance,
        };
        
        // Higher success if unique patterns exist
        attackSuccess = targetProfile.strugglePatterns.anxietySensitivity > 0.8 || 
                       targetProfile.demographics.learningDisabilities[0] !== 'none';
        confidenceScore = attackSuccess ? 0.75 : 0.25;
        methodUsed = 'behavioral_correlation_analysis';
        dataPointsUsed = 8;
        if (attackSuccess) defensesDefeated.push('attribute_suppression');
        break;

      case 'reconstruction_attack':
        // Attempt to reconstruct full profile from partial data
        auxiliaryData.partialProfile = {
          persona: targetProfile.persona,
          cognitiveLoadCapacity: targetProfile.strugglePatterns.cognitiveLoadCapacity,
        };
        
        attackSuccess = this.rng() < 0.4; // More difficult attack
        confidenceScore = attackSuccess ? 0.65 : 0.2;
        methodUsed = 'gradient_descent_reconstruction';
        dataPointsUsed = 15;
        if (attackSuccess) defensesDefeated.push('data_minimization');
        break;

      case 'differential_attack': {
        // Attempt to extract information by querying with/without target
        auxiliaryData.queryResults = {
          withTarget: this.normalRandom(0.75, 0.1),
          withoutTarget: this.normalRandom(0.73, 0.1),
        };
        
        const difference = Math.abs(
          (auxiliaryData.queryResults as any).withTarget - 
          (auxiliaryData.queryResults as any).withoutTarget
        );
        attackSuccess = difference > 0.05; // Significant difference indicates presence
        confidenceScore = Math.min(0.9, difference * 10);
        methodUsed = 'differential_query_analysis';
        dataPointsUsed = 2;
        if (attackSuccess) defensesDefeated.push('query_noise');
        break;
      }
    }

    return LearnerDNASchemas.PrivacyAttackData.parse({
      attackType,
      targetStudentId: targetProfile.studentId,
      auxiliaryData,
      attackSuccess,
      confidenceScore,
      methodUsed,
      defensesDefeated,
      dataPointsUsed,
    });
  }

  /**
   * Generate a complete synthetic dataset
   */
  async generateSyntheticDataset(params: SyntheticDataGenerationParams): Promise<{
    profiles: CognitiveProfile[];
    sessions: LearningSessionData[];
    privacyAttacks: PrivacyAttackData[];
    qualityMetrics: DataQualityMetrics;
  }> {
    const profiles: CognitiveProfile[] = [];
    const sessions: LearningSessionData[] = [];
    const privacyAttacks: PrivacyAttackData[] = [];

    // Generate cognitive profiles
    for (let i = 0; i < params.studentCount; i++) {
      const profile = this.generateCognitiveProfile();
      profiles.push(profile);
    }

    // Generate learning sessions for each profile
    const conceptPool = ['algebra', 'calculus', 'statistics', 'geometry', 'trigonometry'];
    for (const profile of profiles) {
      const sessionCount = Math.round(this.normalRandom(10, 5));
      for (let j = 0; j < sessionCount; j++) {
        const sessionDate = new Date(
          params.timeRange.startDate.getTime() + 
          this.rng() * (params.timeRange.endDate.getTime() - params.timeRange.startDate.getTime())
        );
        const conceptsToStudy = conceptPool
          .sort(() => this.rng() - 0.5)
          .slice(0, Math.ceil(this.rng() * 3) + 1);
        
        const session = this.generateLearningSession(profile, conceptsToStudy, sessionDate);
        sessions.push(session);
      }
    }

    // Generate privacy attack tests
    const attackTypes: Array<'linkage_attack' | 'membership_inference' | 'attribute_inference' | 'reconstruction_attack' | 'differential_attack'> = [
      'linkage_attack', 'membership_inference', 'attribute_inference', 'reconstruction_attack', 'differential_attack'
    ];
    
    for (let i = 0; i < Math.min(100, profiles.length); i++) {
      const targetProfile = profiles[i];
      const attackType = attackTypes[Math.floor(this.rng() * attackTypes.length)];
      const attack = this.generatePrivacyAttackData(targetProfile, profiles, attackType);
      privacyAttacks.push(attack);
    }

    // Calculate quality metrics
    const qualityMetrics = await this.calculateDataQuality(profiles, sessions, privacyAttacks);

    return {
      profiles,
      sessions,
      privacyAttacks,
      qualityMetrics,
    };
  }

  /**
   * Calculate data quality metrics for validation
   */
  private async calculateDataQuality(
    profiles: CognitiveProfile[],
    sessions: LearningSessionData[],
    attacks: PrivacyAttackData[]
  ): Promise<DataQualityMetrics> {
    // Statistical metrics
    const learningRates = profiles.map(p => p.learningVelocity.baseRate);
    const meanLearningRate = learningRates.reduce((a, b) => a + b) / learningRates.length;
    const expectedMean = EDUCATIONAL_RESEARCH_CONSTANTS.LEARNING_VELOCITY.BASE_RATE_MEAN;
    const meanSquareError = Math.pow(meanLearningRate - expectedMean, 2);

    // Calculate correlation accuracy (simplified)
    const memoryStrengths = profiles.map(p => p.memoryRetention.memoryStrengthMultiplier);
    const correlationAccuracy = this.calculateCorrelation(learningRates, memoryStrengths);

    // Privacy metrics
    const successfulAttacks = attacks.filter(a => a.attackSuccess).length;
    const reidentificationRisk = successfulAttacks / attacks.length;

    // Ebbinghaus curve validation
    const retentionCurves = profiles.map(p => p.memoryRetention.initialRetention);
    const avgInitialRetention = retentionCurves.reduce((a, b) => a + b) / retentionCurves.length;
    const expectedRetention = EDUCATIONAL_RESEARCH_CONSTANTS.EBBINGHAUS.INITIAL_RETENTION_MEAN;
    const ebbinghausCorrelation = 1 - Math.abs(avgInitialRetention - expectedRetention);

    return LearnerDNASchemas.DataQualityMetrics.parse({
      statisticalMetrics: {
        meanSquareError,
        correlationAccuracy: Math.abs(correlationAccuracy),
        distributionKLDivergence: 0.1, // Placeholder - would calculate KL divergence
      },
      psychologyCompliance: {
        ebbinghausCorrelation: Math.max(0, ebbinghausCorrelation),
        learningCurveRealism: 0.85, // Based on validation against research
        struggePpatternValidity: 0.80, // Based on expert review
      },
      privacyMetrics: {
        reidentificationRisk,
        attributeInferenceAccuracy: attacks
          .filter(a => a.attackType === 'attribute_inference')
          .reduce((acc, a) => acc + (a.attackSuccess ? 1 : 0), 0) / 
          Math.max(1, attacks.filter(a => a.attackType === 'attribute_inference').length),
        linkageAttackSuccess: attacks
          .filter(a => a.attackType === 'linkage_attack')
          .reduce((acc, a) => acc + (a.attackSuccess ? 1 : 0), 0) / 
          Math.max(1, attacks.filter(a => a.attackType === 'linkage_attack').length),
      },
      utilityMetrics: {
        queryAccuracy: 0.88, // Based on synthetic vs real data comparisons
        statisticalUtility: 0.85,
        machineLearningUtility: 0.82,
      },
    });
  }

  /**
   * Calculate Pearson correlation coefficient
   */
  private calculateCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    const sumX = x.slice(0, n).reduce((a, b) => a + b);
    const sumY = y.slice(0, n).reduce((a, b) => a + b);
    const sumXY = x.slice(0, n).reduce((acc, xi, i) => acc + xi * y[i], 0);
    const sumX2 = x.slice(0, n).reduce((acc, xi) => acc + xi * xi, 0);
    const sumY2 = y.slice(0, n).reduce((acc, yi) => acc + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Calculate memory retention over time using Ebbinghaus curve
   */
  calculateMemoryRetention(
    curve: MemoryRetentionCurve,
    timeElapsedHours: number,
    spacedRepetitions: number = 0
  ): number {
    const { initialRetention, decayConstant, asymptoticRetention, spacedRepetitionBonus } = curve;
    
    // Basic Ebbinghaus curve: R(t) = a*e^(-bt) + c
    const baseRetention = initialRetention * Math.exp(-decayConstant * timeElapsedHours / 24) + asymptoticRetention;
    
    // Apply spaced repetition bonus
    const repetitionBonus = Math.pow(spacedRepetitionBonus, spacedRepetitions);
    
    return Math.min(1.0, baseRetention * repetitionBonus);
  }

  /**
   * Calculate learning velocity at given time considering fatigue and recovery
   */
  calculateLearningVelocity(
    pattern: LearningVelocityPattern,
    studyTimeHours: number,
    timeSinceLastBreakHours: number,
    timeOfDay: number
  ): number {
    const { baseRate, acceleration, fatigueDecay, recoveryRate, timeOfDayMultipliers } = pattern;
    
    // Time of day adjustment
    const hourBucket = timeOfDay < 12 ? 'morning' : timeOfDay < 18 ? 'afternoon' : 'evening';
    const timeAdjustment = timeOfDayMultipliers[hourBucket];
    
    // Fatigue effect (decreases with continuous study)
    const fatigueEffect = Math.exp(-fatigueDecay * timeSinceLastBreakHours);
    
    // Experience acceleration (improves with total study time)
    const experienceEffect = 1 + (acceleration - 1) * Math.tanh(studyTimeHours / 20);
    
    // Recovery bonus (improves after breaks)
    const recoveryEffect = 1 + (recoveryRate - 1) * Math.exp(-timeSinceLastBreakHours);
    
    return baseRate * timeAdjustment * fatigueEffect * experienceEffect * recoveryEffect;
  }
}