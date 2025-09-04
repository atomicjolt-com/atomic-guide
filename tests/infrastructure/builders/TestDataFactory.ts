/**
 * @fileoverview Test data factory with builder pattern for consistent test data
 * @module tests/infrastructure/builders/TestDataFactory
 */

import { v4 as uuidv4 } from 'uuid';
import type { 
  LearnerProfile, 
  Tenant,
  LearnerDNAProfile,
  CognitiveProfile,
  BehavioralPattern,
  LearningSessionData,
  PrivacyConsent,
  StudentPerformanceProfile,
  LearningRecommendation
} from '@/types';

/**
 * Base builder class with common functionality
 */
abstract class BaseBuilder<T> {
  protected data: Partial<T>;

  constructor(defaults: Partial<T>) {
    this.data = { ...defaults };
  }

  /**
   * Build the final object with validation
   */
  abstract build(): T;

  /**
   * Build multiple instances with optional modifications
   */
  buildMany(count: number, modifier?: (builder: this, index: number) => void): T[] {
    return Array.from({ length: count }, (_, i) => {
      const builder = this.clone();
      modifier?.(builder, i);
      return builder.build();
    });
  }

  /**
   * Clone the builder with current state
   */
  protected abstract clone(): this;

  /**
   * Merge additional data
   */
  with(overrides: Partial<T>): this {
    Object.assign(this.data, overrides);
    return this;
  }
}

/**
 * User/Learner profile builder
 */
export class UserBuilder extends BaseBuilder<LearnerProfile> {
  constructor() {
    super({
      id: uuidv4(),
      tenant_id: 'test-tenant-' + uuidv4().slice(0, 8),
      lti_user_id: 'lti-user-' + uuidv4(),
      lti_deployment_id: 'deployment-1',
      email: `user-${uuidv4().slice(0, 8)}@test.edu`,
      name: 'Test User',
      cognitive_profile: {
        forgetting_curve_s: 1.0,
        learning_velocity: 1.0,
        optimal_difficulty: 0.7,
        preferred_modality: 'mixed'
      },
      privacy_settings: {
        data_sharing_consent: true,
        ai_interaction_consent: true,
        anonymous_analytics: true
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  withId(id: string): this {
    this.data.id = id;
    return this;
  }

  withTenant(tenantId: string): this {
    this.data.tenant_id = tenantId;
    return this;
  }

  withEmail(email: string): this {
    this.data.email = email;
    return this;
  }

  withName(name: string): this {
    this.data.name = name;
    return this;
  }

  withCognitiveProfile(profile: Partial<LearnerProfile['cognitive_profile']>): this {
    this.data.cognitive_profile = { ...this.data.cognitive_profile, ...profile };
    return this;
  }

  withPrivacySettings(settings: Partial<LearnerProfile['privacy_settings']>): this {
    this.data.privacy_settings = { ...this.data.privacy_settings, ...settings };
    return this;
  }

  withNoConsent(): this {
    this.data.privacy_settings = {
      data_sharing_consent: false,
      ai_interaction_consent: false,
      anonymous_analytics: false
    };
    return this;
  }

  withFullConsent(): this {
    this.data.privacy_settings = {
      data_sharing_consent: true,
      ai_interaction_consent: true,
      anonymous_analytics: true
    };
    return this;
  }

  asMinor(age: number = 12): this {
    this.data.metadata = { ...this.data.metadata, age, requiresParentalConsent: true };
    return this;
  }

  build(): LearnerProfile {
    return this.data as LearnerProfile;
  }

  protected clone(): this {
    const cloned = new UserBuilder();
    cloned.data = { ...this.data };
    return cloned as this;
  }
}

/**
 * Tenant builder for multi-tenancy testing
 */
export class TenantBuilder extends BaseBuilder<Tenant> {
  constructor() {
    super({
      id: uuidv4(),
      iss: 'https://canvas.test.edu',
      client_id: 'client-' + uuidv4(),
      deployment_ids: ['deployment-1'],
      institution_name: 'Test University',
      lms_type: 'canvas',
      lms_url: 'https://canvas.test.edu',
      settings: {
        features: {
          aiEnabled: true,
          analyticsEnabled: true,
          privacyEnhanced: false
        }
      },
      features: {
        ai_enabled: true,
        analytics_enabled: true,
        privacy_enhanced: false
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  withId(id: string): this {
    this.data.id = id;
    return this;
  }

  withInstitution(name: string, lmsUrl: string): this {
    this.data.institution_name = name;
    this.data.lms_url = lmsUrl;
    return this;
  }

  withLMS(type: string, iss: string): this {
    this.data.lms_type = type;
    this.data.iss = iss;
    return this;
  }

  withFeatures(features: Partial<Tenant['features']>): this {
    this.data.features = { ...this.data.features, ...features };
    return this;
  }

  build(): Tenant {
    return this.data as Tenant;
  }

  protected clone(): this {
    const cloned = new TenantBuilder();
    cloned.data = { ...this.data };
    return cloned as this;
  }
}

/**
 * Cognitive profile builder for learner DNA testing
 */
export class CognitiveProfileBuilder extends BaseBuilder<CognitiveProfile> {
  constructor() {
    super({
      learningVelocity: {
        baseRate: 2.5,
        subjectModifiers: {
          mathematics: 1.2,
          science: 1.1,
          humanities: 0.9
        },
        timeOfDayFactors: Array(24).fill(1.0),
        currentRate: 2.5,
        confidence: 0.8,
        dataPoints: 100
      },
      memoryRetention: {
        forgettingCurveS: 1.0,
        retentionStrength: 0.75,
        optimalRepetitionIntervals: [1, 3, 7, 14, 30],
        lastReviewDate: new Date().toISOString(),
        confidence: 0.85,
        dataPoints: 50
      },
      comprehensionStyle: {
        varkProfile: {
          visual: 0.3,
          auditory: 0.2,
          readingWriting: 0.3,
          kinesthetic: 0.2
        },
        bloomLevel: 'application',
        abstractionPreference: 0.6,
        confidence: 0.7,
        dataPoints: 75
      },
      interactionTimingPatterns: {
        peakHours: [10, 14, 20],
        averageSessionLength: 1800000, // 30 minutes
        breakFrequency: 0.2,
        focusDuration: 1200000, // 20 minutes
        dailyPatterns: Array(7).fill(1.0),
        confidence: 0.75,
        dataPoints: 200
      },
      strugglePatterns: {
        frustrationThreshold: 0.7,
        helpSeekingTendency: 0.5,
        persistenceScore: 0.8,
        errorPatterns: {
          syntax: 0.2,
          logic: 0.3,
          conceptual: 0.5
        },
        recoveryRate: 0.6,
        confidence: 0.65,
        dataPoints: 150
      },
      engagementMetrics: {
        intrinsicMotivation: 0.7,
        extrinsicMotivation: 0.5,
        socialLearningPreference: 0.6,
        competitiveIndex: 0.4,
        confidence: 0.8,
        dataPoints: 100
      },
      demographicContext: {
        ageGroup: '18-24',
        educationLevel: 'undergraduate',
        fieldOfStudy: 'computer_science',
        priorKnowledge: 0.5,
        languageProficiency: 1.0
      }
    });
  }

  withLearningVelocity(velocity: number): this {
    this.data.learningVelocity!.baseRate = velocity;
    this.data.learningVelocity!.currentRate = velocity;
    return this;
  }

  withVARKProfile(visual: number, auditory: number, reading: number, kinesthetic: number): this {
    this.data.comprehensionStyle!.varkProfile = {
      visual,
      auditory,
      readingWriting: reading,
      kinesthetic
    };
    return this;
  }

  withStrugglePattern(threshold: number, persistence: number): this {
    this.data.strugglePatterns!.frustrationThreshold = threshold;
    this.data.strugglePatterns!.persistenceScore = persistence;
    return this;
  }

  build(): CognitiveProfile {
    return this.data as CognitiveProfile;
  }

  protected clone(): this {
    const cloned = new CognitiveProfileBuilder();
    cloned.data = JSON.parse(JSON.stringify(this.data));
    return cloned as this;
  }
}

/**
 * Learning session builder for testing session data
 */
export class SessionBuilder extends BaseBuilder<LearningSessionData> {
  constructor() {
    super({
      sessionId: uuidv4(),
      userId: 'user-' + uuidv4(),
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 1800000).toISOString(), // 30 min session
      contentType: 'problem_solving',
      difficultyLevel: 0.7,
      completionRate: 0.85,
      correctnessRate: 0.75,
      learningVelocity: 2.5,
      engagementScore: 0.8,
      responseTimesMs: [1000, 1500, 2000, 1200, 1800],
      helpRequests: 0,
      confusionEvents: [],
      responses: [
        { questionId: 'q1', correct: true, responseTime: 1000, attempts: 1 },
        { questionId: 'q2', correct: true, responseTime: 1500, attempts: 1 },
        { questionId: 'q3', correct: false, responseTime: 2000, attempts: 2 },
        { questionId: 'q4', correct: true, responseTime: 1200, attempts: 1 },
        { questionId: 'q5', correct: true, responseTime: 1800, attempts: 1 }
      ],
      metadata: {
        deviceType: 'desktop',
        connectionQuality: 'good'
      }
    });
  }

  withUserId(userId: string): this {
    this.data.userId = userId;
    return this;
  }

  withPerformance(completion: number, correctness: number): this {
    this.data.completionRate = completion;
    this.data.correctnessRate = correctness;
    return this;
  }

  withDifficulty(level: number): this {
    this.data.difficultyLevel = level;
    return this;
  }

  withConfusionEvents(count: number): this {
    this.data.confusionEvents = Array.from({ length: count }, (_, i) => ({
      timestamp: new Date(Date.now() + i * 60000).toISOString(),
      type: 'high_response_time' as const,
      severity: 0.5 + Math.random() * 0.5
    }));
    return this;
  }

  withStruggle(): this {
    this.data.correctnessRate = 0.3;
    this.data.helpRequests = 5;
    this.data.confusionEvents = [
      { timestamp: new Date().toISOString(), type: 'repeated_errors', severity: 0.8 },
      { timestamp: new Date().toISOString(), type: 'help_request', severity: 0.6 }
    ];
    return this;
  }

  build(): LearningSessionData {
    return this.data as LearningSessionData;
  }

  protected clone(): this {
    const cloned = new SessionBuilder();
    cloned.data = JSON.parse(JSON.stringify(this.data));
    return cloned as this;
  }
}

/**
 * Performance analytics builder
 */
export class AnalyticsBuilder extends BaseBuilder<StudentPerformanceProfile> {
  constructor() {
    super({
      studentId: 'student-' + uuidv4(),
      courseId: 'course-' + uuidv4(),
      overallMastery: 0.75,
      learningVelocity: 2.5,
      timeSpentMinutes: 180,
      activeDays: 15,
      conceptMasteries: {
        arrays: 0.8,
        loops: 0.7,
        functions: 0.85,
        objects: 0.65
      },
      performanceData: {
        assessmentScores: [0.7, 0.75, 0.8, 0.85],
        averageResponseTime: 1500,
        struggledConcepts: ['recursion', 'async'],
        masteredConcepts: ['variables', 'conditionals']
      },
      recommendations: []
    });
  }

  withStudent(studentId: string, courseId: string): this {
    this.data.studentId = studentId;
    this.data.courseId = courseId;
    return this;
  }

  withMastery(overall: number, concepts?: Record<string, number>): this {
    this.data.overallMastery = overall;
    if (concepts) {
      this.data.conceptMasteries = concepts;
    }
    return this;
  }

  withRecommendations(recommendations: LearningRecommendation[]): this {
    this.data.recommendations = recommendations;
    return this;
  }

  build(): StudentPerformanceProfile {
    return this.data as StudentPerformanceProfile;
  }

  protected clone(): this {
    const cloned = new AnalyticsBuilder();
    cloned.data = JSON.parse(JSON.stringify(this.data));
    return cloned as this;
  }
}

/**
 * Assessment builder for testing
 */
export class AssessmentBuilder {
  private data: any = {
    id: uuidv4(),
    title: 'Test Assessment',
    type: 'formative',
    description: 'A test assessment',
    questions: [],
    settings: {
      shuffleQuestions: false,
      showFeedback: true,
      timeLimit: null,
      attempts: 1
    },
    metadata: {
      author: 'test-author',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };

  withTitle(title: string): this {
    this.data.title = title;
    return this;
  }

  withType(type: 'formative' | 'summative' | 'diagnostic'): this {
    this.data.type = type;
    return this;
  }

  withQuestions(count: number): this {
    this.data.questions = Array.from({ length: count }, (_, i) => ({
      id: `q${i + 1}`,
      type: 'multiple_choice',
      text: `Question ${i + 1}`,
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'A',
      points: 1
    }));
    return this;
  }

  build(): any {
    return this.data;
  }
}

/**
 * Main test data factory with presets
 */
export class TestDataFactory {
  // Builder factories
  static user = () => new UserBuilder();
  static tenant = () => new TenantBuilder();
  static cognitiveProfile = () => new CognitiveProfileBuilder();
  static session = () => new SessionBuilder();
  static analytics = () => new AnalyticsBuilder();
  static assessment = () => new AssessmentBuilder();

  // Common presets for quick test data creation
  static presets = {
    // User presets
    studentWithFullConsent: () => 
      TestDataFactory.user()
        .withFullConsent()
        .withEmail('student@test.edu')
        .withName('Test Student'),
    
    studentWithNoConsent: () =>
      TestDataFactory.user()
        .withNoConsent()
        .withEmail('noconsent@test.edu')
        .withName('No Consent Student'),
    
    minorStudent: () =>
      TestDataFactory.user()
        .asMinor(12)
        .withEmail('minor@test.edu')
        .withName('Minor Student'),
    
    instructor: () =>
      TestDataFactory.user()
        .withEmail('instructor@test.edu')
        .withName('Test Instructor')
        .with({ role: 'instructor' } as any),

    // Cognitive profile presets
    fastLearner: () =>
      TestDataFactory.cognitiveProfile()
        .withLearningVelocity(4.0)
        .withStrugglePattern(0.9, 0.95),
    
    struggleLearner: () =>
      TestDataFactory.cognitiveProfile()
        .withLearningVelocity(1.0)
        .withStrugglePattern(0.3, 0.4),
    
    visualLearner: () =>
      TestDataFactory.cognitiveProfile()
        .withVARKProfile(0.7, 0.1, 0.1, 0.1),

    // Session presets
    successfulSession: () =>
      TestDataFactory.session()
        .withPerformance(1.0, 0.95)
        .withConfusionEvents(0),
    
    strugglingSession: () =>
      TestDataFactory.session()
        .withStruggle()
        .withPerformance(0.4, 0.3),

    // Analytics presets
    highPerformance: () =>
      TestDataFactory.analytics()
        .withMastery(0.9, {
          arrays: 0.95,
          loops: 0.9,
          functions: 0.92,
          objects: 0.88
        }),
    
    needsHelp: () =>
      TestDataFactory.analytics()
        .withMastery(0.4, {
          arrays: 0.3,
          loops: 0.35,
          functions: 0.4,
          objects: 0.45
        })
        .withRecommendations([
          {
            id: 'rec-1',
            type: 'review',
            priority: 'high',
            title: 'Review Basic Concepts',
            description: 'Focus on fundamental programming concepts',
            resourceUrl: '/resources/basics',
            estimatedTime: 30,
            concepts: ['variables', 'loops', 'conditionals']
          }
        ] as any[]),

    // Multi-entity presets
    classroomSetup: () => ({
      tenant: TestDataFactory.tenant().build(),
      instructor: TestDataFactory.presets.instructor().build(),
      students: TestDataFactory.user().buildMany(20, (builder, i) => {
        builder
          .withEmail(`student${i + 1}@test.edu`)
          .withName(`Student ${i + 1}`);
      })
    }),
    
    completeTestEnvironment: () => ({
      tenant: TestDataFactory.tenant().build(),
      users: [
        TestDataFactory.presets.instructor().build(),
        ...TestDataFactory.presets.studentWithFullConsent().buildMany(10)
      ],
      sessions: TestDataFactory.session().buildMany(50),
      analytics: TestDataFactory.analytics().buildMany(10)
    })
  };

  /**
   * Generate random test data for stress testing
   */
  static generateRandom = {
    users: (count: number) => 
      TestDataFactory.user().buildMany(count, (builder, i) => {
        builder.withEmail(`random${i}@test.edu`);
      }),
    
    sessions: (count: number, userId?: string) =>
      TestDataFactory.session().buildMany(count, (builder, i) => {
        if (userId) builder.withUserId(userId);
        builder.withPerformance(
          Math.random(),
          Math.random()
        );
      }),
    
    tenants: (count: number) =>
      TestDataFactory.tenant().buildMany(count, (builder, i) => {
        builder.withInstitution(
          `University ${i}`,
          `https://lms${i}.edu`
        );
      })
  };
}