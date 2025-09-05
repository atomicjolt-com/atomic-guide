/**
 * @fileoverview Predictive Intervention Engine for Story 4.2 Phase 1 MVP
 * @module features/learner-dna/server/services/PredictiveInterventionEngine
 * 
 * Implements Phase 1 MVP predictive intervention capabilities:
 * - Proactive chat recommendations without student requests  
 * - Adaptive difficulty adjustment for assessments
 * - Early warning alerts for instructors with specific recommendations
 * - Personalized learning path generation
 * - Micro-intervention timing optimization
 * 
 * MANDATORY SCOPE LIMITATIONS (Per QA Conditional Approval):
 * - Single-course analysis only (no cross-course intelligence)
 * - Consent-based privacy model (no differential privacy for MVP)
 * - Realistic performance targets (<10s intervention generation)
 * - Basic intervention strategies (advanced ML deferred to Phase 2)
 */

import { DatabaseService } from '@shared/server/services';
import { AdvancedPatternRecognizer } from './AdvancedPatternRecognizer';
import { PrivacyControlService } from './PrivacyControlService';
import type {
  BehavioralPattern,
  LearnerDNAProfile,
  StrugglePrediction,
  LearningVelocityForecast,
  BehavioralSignalAnalysis,
  LearningIntervention,
  PredictionResult
} from '../../shared/types';

/**
 * Proactive recommendation for chat system integration
 */
interface ProactiveRecommendation {
  id: string;
  type: 'concept_clarification' | 'practice_suggestion' | 'break_reminder' | 'study_strategy' | 'motivational';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  actionable: boolean;
  actionText?: string;
  actionUrl?: string;
  dismissible: boolean;
  validUntil: Date;
  triggerReason: string;
  confidence: number;
}

/**
 * Difficulty adjustment recommendation
 */
interface DifficultyAdjustment {
  currentDifficulty: number; // 0-1 scale
  recommendedDifficulty: number; // 0-1 scale
  adjustmentReason: string;
  confidence: number;
  graduationPath?: {
    targetDifficulty: number;
    estimatedTimeToTarget: number; // minutes
    milestones: Array<{ difficulty: number; concepts: string[] }>;
  };
}

/**
 * Early warning alert for instructors
 */
interface EarlyWarningAlert {
  id: string;
  studentId: string;
  alertType: 'struggle_risk' | 'disengagement' | 'cognitive_overload' | 'knowledge_gap';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  alertMessage: string;
  specificConcerns: string[];
  recommendedActions: Array<{
    action: string;
    priority: 'immediate' | 'within_24h' | 'within_week';
    expectedImpact: string;
  }>;
  triggerData: Record<string, any>;
  createdAt: Date;
  actionDeadline?: Date;
}

/**
 * Personalized learning path step
 */
interface LearningPathStep {
  stepId: string;
  conceptId: string;
  conceptName: string;
  difficulty: number;
  estimatedDuration: number; // minutes
  prerequisites: string[];
  learningObjectives: string[];
  recommendedResources: Array<{
    type: 'reading' | 'video' | 'practice' | 'quiz';
    title: string;
    url?: string;
    duration?: number;
  }>;
  adaptationReasons: string[];
}

/**
 * Micro-intervention timing analysis
 */
interface MicroInterventionTiming {
  isOptimalTiming: boolean;
  confidenceScore: number;
  timingFactors: Array<{
    factor: string;
    score: number; // 0-1
    weight: number;
  }>;
  recommendedDelay?: number; // minutes to wait for better timing
  nextOptimalWindow?: Date;
  interventionType: 'immediate' | 'delayed' | 'skip';
}

/**
 * Predictive Intervention Engine for proactive learning support.
 * 
 * Phase 1 MVP focuses on single-course interventions with consent-based
 * privacy model and realistic performance targets for production deployment.
 * 
 * Core intervention capabilities:
 * - Proactive recommendations delivered through chat interface
 * - Real-time difficulty adjustments based on cognitive load
 * - Instructor early warning system with actionable recommendations
 * - Personalized learning path optimization
 * - Optimal timing analysis for micro-interventions
 * 
 * @class PredictiveInterventionEngine
 */
export class PredictiveInterventionEngine {
  private db: DatabaseService;
  private patternRecognizer: AdvancedPatternRecognizer;
  private privacyService: PrivacyControlService;

  // Performance targets for Phase 1 MVP
  private readonly MAX_INTERVENTION_TIME_MS = 10000; // 10 second performance target
  private readonly STRUGGLE_RISK_THRESHOLD = 0.6; // Intervention trigger threshold
  private readonly HIGH_CONFIDENCE_THRESHOLD = 0.7; // High confidence interventions
  private readonly MICRO_INTERVENTION_WINDOW_MINUTES = 15; // Optimal intervention window

  // Intervention effectiveness tracking
  private readonly INTERVENTION_COOLDOWN_MINUTES = 30; // Minimum time between similar interventions
  private readonly MAX_DAILY_INTERVENTIONS = 8; // Prevent intervention overload

  constructor(
    db: DatabaseService,
    patternRecognizer: AdvancedPatternRecognizer,
    privacyService: PrivacyControlService
  ) {
    this.db = db;
    this.patternRecognizer = patternRecognizer;
    this.privacyService = privacyService;
  }

  /**
   * Generates proactive chat recommendations based on behavioral patterns.
   * 
   * Analyzes student struggle predictions and behavioral signals to automatically
   * surface contextually relevant explanations, practice problems, or study
   * strategies without waiting for student help requests.
   * 
   * @param tenantId - Tenant identifier
   * @param userId - Student identifier
   * @param courseId - Current course context
   * @param contentId - Current content context (optional)
   * @returns Promise resolving to proactive recommendations
   * 
   * @throws {PrivacyError} If user hasn't consented to proactive interventions
   * @throws {PerformanceError} If recommendation generation exceeds performance target
   * 
   * @example
   * ```typescript
   * const recommendations = await engine.generateProactiveRecommendations(
   *   'tenant-123',
   *   'user-456',
   *   'course-789'
   * );
   * 
   * for (const rec of recommendations) {
   *   if (rec.priority === 'high') {
   *     await chatService.sendProactiveMessage(userId, rec.message);
   *   }
   * }
   * ```
   */
  async generateProactiveRecommendations(
    tenantId: string,
    userId: string,
    courseId: string,
    contentId?: string
  ): Promise<ProactiveRecommendation[]> {
    const startTime = Date.now();

    try {
      // Verify privacy consent for proactive interventions
      const hasConsent = await this.privacyService.validateDataCollectionPermission(
        tenantId,
        userId,
        'behavioral_timing'
      );

      if (!hasConsent) {
        throw new Error('PRIVACY_ERROR: User has not consented to proactive interventions');
      }

      // Check intervention rate limits to prevent overload
      const recentInterventions = await this.getRecentInterventions(tenantId, userId, 24); // Last 24 hours
      if (recentInterventions.length >= this.MAX_DAILY_INTERVENTIONS) {
        console.log(`Intervention rate limit reached for user ${userId}: ${recentInterventions.length} interventions today`);
        return [];
      }

      // Get current behavioral analysis
      let behavioralAnalysis: BehavioralSignalAnalysis | null = null;
      try {
        behavioralAnalysis = await this.patternRecognizer.analyzeRealTimeBehavioralSignals(
          tenantId,
          userId,
          courseId
        );
      } catch (error) {
        console.warn('Failed to get behavioral analysis for proactive recommendations:', error);
        // Continue with null analysis - recommendations will be more limited
      }

      // Get struggle prediction
      let strugglePrediction: StrugglePrediction | null = null;
      try {
        strugglePrediction = await this.patternRecognizer.predictStruggle(
          tenantId,
          userId,
          courseId
        );
      } catch (error) {
        console.warn('Failed to get struggle prediction for proactive recommendations:', error);
        // Continue with null prediction - recommendations will be more limited
      }

      // Generate recommendations based on analysis
      const recommendations: ProactiveRecommendation[] = [];

      // Struggle prevention recommendations
      if (strugglePrediction?.riskLevel && strugglePrediction.riskLevel >= this.STRUGGLE_RISK_THRESHOLD) {
        const struggleRecommendations = await this.generateStrugglePreventionRecommendations(
          strugglePrediction,
          behavioralAnalysis,
          courseId,
          contentId
        );
        recommendations.push(...struggleRecommendations);
      }

      // Cognitive load management recommendations
      if (behavioralAnalysis?.cognitiveLoad && behavioralAnalysis.cognitiveLoad > 0.8) {
        const cognitiveLoadRecommendations = this.generateCognitiveLoadRecommendations(
          behavioralAnalysis,
          courseId
        );
        recommendations.push(...cognitiveLoadRecommendations);
      }

      // Engagement optimization recommendations
      if (behavioralAnalysis?.engagementScore && behavioralAnalysis.engagementScore < 0.4) {
        const engagementRecommendations = this.generateEngagementRecommendations(
          behavioralAnalysis,
          courseId
        );
        recommendations.push(...engagementRecommendations);
      }

      // Optimal timing recommendations
      if (behavioralAnalysis?.optimalInterventionTiming) {
        const timingRecommendations = await this.generateOptimalTimingRecommendations(
          tenantId,
          userId,
          courseId,
          behavioralAnalysis
        );
        recommendations.push(...timingRecommendations);
      }

      // Apply cooldown filtering to prevent spam
      const filteredRecommendations = await this.applyCooldownFiltering(
        tenantId,
        userId,
        recommendations
      );

      // Prioritize and limit recommendations
      const prioritizedRecommendations = this.prioritizeRecommendations(filteredRecommendations)
        .slice(0, 3); // Limit to top 3 recommendations

      // Store recommendations for effectiveness tracking
      await this.storeProactiveRecommendations(tenantId, userId, courseId, prioritizedRecommendations);

      // Performance monitoring
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime > this.MAX_INTERVENTION_TIME_MS) {
        console.warn(`Proactive recommendation generation exceeded performance target: ${elapsedTime}ms`);
      }

      return prioritizedRecommendations;

    } catch (error) {
      const elapsedTime = Date.now() - startTime;
      console.error(`Proactive recommendation generation failed after ${elapsedTime}ms:`, error);
      
      // Re-throw privacy errors
      if (error instanceof Error && error.message.includes('PRIVACY_ERROR')) {
        throw error;
      }
      
      // Return safe fallback - no recommendations rather than potentially harmful ones
      return [];
    }
  }

  /**
   * Generates adaptive difficulty adjustments for assessments and explanations.
   * 
   * Analyzes student cognitive load and struggle predictions to automatically
   * adjust assessment question difficulty and explanation complexity based on
   * predicted student readiness and current cognitive capacity.
   * 
   * @param tenantId - Tenant identifier
   * @param userId - Student identifier
   * @param courseId - Current course context
   * @param currentDifficulty - Current difficulty level (0-1)
   * @param contentType - Type of content being adjusted
   * @returns Promise resolving to difficulty adjustment recommendation
   */
  async generateAdaptiveDifficultyAdjustment(
    tenantId: string,
    userId: string,
    courseId: string,
    currentDifficulty: number,
    contentType: 'assessment' | 'explanation' | 'practice' = 'assessment'
  ): Promise<DifficultyAdjustment> {
    const startTime = Date.now();

    try {
      // Get learner profile and behavioral analysis
      const learnerProfile = await this.getLearnerProfile(tenantId, userId);
      let behavioralAnalysis: BehavioralSignalAnalysis | null = null;
      try {
        behavioralAnalysis = await this.patternRecognizer.analyzeRealTimeBehavioralSignals(
          tenantId,
          userId,
          courseId
        );
      } catch (error) {
        console.warn('Failed to get behavioral analysis for difficulty adjustment:', error);
        // Continue with null analysis - difficulty adjustment will use learner profile only
      }
      let strugglePrediction: StrugglePrediction | null = null;
      try {
        strugglePrediction = await this.patternRecognizer.predictStruggle(
          tenantId,
          userId,
          courseId
        );
      } catch (error) {
        console.warn('Failed to get struggle prediction for difficulty adjustment:', error);
        // Continue with null prediction - difficulty adjustment will use behavioral analysis only
      }

      // Calculate optimal difficulty based on cognitive state
      const optimalDifficulty = this.calculateOptimalDifficulty(
        learnerProfile,
        behavioralAnalysis,
        strugglePrediction,
        currentDifficulty,
        contentType
      );

      // Generate adjustment reasoning
      const adjustmentReason = this.generateDifficultyAdjustmentReason(
        currentDifficulty,
        optimalDifficulty,
        behavioralAnalysis,
        strugglePrediction
      );

      // Calculate confidence in adjustment
      const confidence = this.calculateAdjustmentConfidence(
        learnerProfile,
        behavioralAnalysis,
        strugglePrediction
      );

      // Generate graduation path for skill development
      const graduationPath = currentDifficulty < optimalDifficulty 
        ? this.generateGraduationPath(currentDifficulty, optimalDifficulty, learnerProfile)
        : undefined;

      const adjustment: DifficultyAdjustment = {
        currentDifficulty,
        recommendedDifficulty: optimalDifficulty,
        adjustmentReason,
        confidence,
        graduationPath
      };

      // Performance monitoring
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime > 5000) { // 5 second target for difficulty adjustment
        console.warn(`Difficulty adjustment generation exceeded target: ${elapsedTime}ms`);
      }

      return adjustment;

    } catch (error) {
      console.error('Difficulty adjustment generation failed:', error);
      
      // Return safe fallback - keep current difficulty
      return {
        currentDifficulty,
        recommendedDifficulty: currentDifficulty,
        adjustmentReason: 'Difficulty adjustment temporarily unavailable',
        confidence: 0.0
      };
    }
  }

  /**
   * Generates early warning alerts for instructors.
   * 
   * Creates intelligent notifications with specific intervention recommendations
   * when students show statistical indicators of future struggles. Provides
   * actionable insights to help instructors provide targeted support.
   * 
   * @param tenantId - Tenant identifier
   * @param courseId - Course to analyze
   * @param instructorId - Instructor identifier
   * @returns Promise resolving to early warning alerts
   */
  async generateEarlyWarningAlerts(
    tenantId: string,
    courseId: string,
    instructorId: string
  ): Promise<EarlyWarningAlert[]> {
    const startTime = Date.now();

    try {
      // Get all students in the course
      const courseStudents = await this.getCourseStudents(tenantId, courseId);
      const alerts: EarlyWarningAlert[] = [];

      // Analyze each student for early warning indicators
      for (const studentId of courseStudents) {
        // Verify student has consented to instructor visibility
        const hasConsent = await this.privacyService.validateDataCollectionPermission(
          tenantId,
          studentId,
          'behavioral_timing'
        );

        if (!hasConsent) {
          continue; // Skip students who haven't consented
        }

        try {
          // Get predictions and analysis for student
          const strugglePrediction = await this.patternRecognizer.predictStruggle(
            tenantId,
            studentId,
            courseId
          );

          const behavioralAnalysis = await this.patternRecognizer.analyzeRealTimeBehavioralSignals(
            tenantId,
            studentId,
            courseId
          );

          // Generate alerts based on risk thresholds
          const studentAlerts = await this.generateStudentAlerts(
            tenantId,
            studentId,
            courseId,
            strugglePrediction,
            behavioralAnalysis
          );

          alerts.push(...studentAlerts);

        } catch (studentError) {
          console.warn(`Failed to analyze student ${studentId} for early warnings:`, studentError);
          // Continue with other students
        }
      }

      // Sort alerts by severity and confidence
      alerts.sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
        if (severityDiff !== 0) return severityDiff;
        return b.confidence - a.confidence;
      });

      // Store alerts for tracking
      await this.storeEarlyWarningAlerts(tenantId, courseId, instructorId, alerts);

      // Performance monitoring
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime > this.MAX_INTERVENTION_TIME_MS) {
        console.warn(`Early warning alert generation exceeded performance target: ${elapsedTime}ms`);
      }

      return alerts.slice(0, 10); // Limit to top 10 alerts to prevent overwhelm

    } catch (error) {
      console.error('Early warning alert generation failed:', error);
      return [];
    }
  }

  /**
   * Generates personalized learning path with optimized sequences.
   * 
   * Creates individualized study sequences that optimize for each student's
   * learning velocity, retention patterns, and comprehension preferences.
   * 
   * @param tenantId - Tenant identifier
   * @param userId - Student identifier
   * @param courseId - Current course context
   * @param targetConcepts - Concepts to include in learning path
   * @returns Promise resolving to personalized learning path
   */
  async generatePersonalizedLearningPath(
    tenantId: string,
    userId: string,
    courseId: string,
    targetConcepts: string[]
  ): Promise<LearningPathStep[]> {
    const startTime = Date.now();

    try {
      // Get learner profile and current progress
      const learnerProfile = await this.getLearnerProfile(tenantId, userId);
      const currentProgress = await this.getCurrentProgress(tenantId, userId, courseId);
      
      // Get velocity forecast for planning
      const velocityForecasts = await Promise.all(
        targetConcepts.map(conceptId =>
          this.patternRecognizer.forecastLearningVelocity(tenantId, userId, courseId, conceptId)
        )
      );

      // Generate learning path steps
      const learningPath: LearningPathStep[] = [];
      
      for (let i = 0; i < targetConcepts.length; i++) {
        const conceptId = targetConcepts[i];
        const forecast = velocityForecasts[i];
        
        const step = await this.generateLearningPathStep(
          conceptId,
          forecast,
          learnerProfile,
          currentProgress,
          i
        );
        
        learningPath.push(step);
      }

      // Optimize path sequence based on prerequisites and difficulty progression
      const optimizedPath = this.optimizeLearningPathSequence(learningPath, learnerProfile);

      // Performance monitoring
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime > this.MAX_INTERVENTION_TIME_MS) {
        console.warn(`Learning path generation exceeded performance target: ${elapsedTime}ms`);
      }

      return optimizedPath;

    } catch (error) {
      console.error('Learning path generation failed:', error);
      
      // Return basic sequential path as fallback
      return targetConcepts.map((conceptId, index) => ({
        stepId: `step-${index}`,
        conceptId,
        conceptName: conceptId.replace(/-/g, ' '), // Simple name conversion
        difficulty: 0.5, // Neutral difficulty
        estimatedDuration: 60, // 1 hour default
        prerequisites: index > 0 ? [targetConcepts[index - 1]] : [],
        learningObjectives: [`Understand ${conceptId}`],
        recommendedResources: [
          {
            type: 'reading',
            title: `${conceptId} Overview`,
            duration: 30
          }
        ],
        adaptationReasons: ['Basic sequential path (personalization temporarily unavailable)']
      }));
    }
  }

  /**
   * Analyzes optimal micro-intervention timing.
   * 
   * Identifies optimal moments for brief learning reinforcements (2-3 minutes)
   * when student attention and receptivity are highest.
   * 
   * @param tenantId - Tenant identifier
   * @param userId - Student identifier
   * @param courseId - Current course context
   * @returns Promise resolving to micro-intervention timing analysis
   */
  async analyzeMicroInterventionTiming(
    tenantId: string,
    userId: string,
    courseId: string
  ): Promise<MicroInterventionTiming> {
    try {
      const behavioralAnalysis = await this.patternRecognizer.analyzeRealTimeBehavioralSignals(
        tenantId,
        userId,
        courseId
      );

      // Analyze timing factors
      const timingFactors = [
        {
          factor: 'Attention Level',
          score: behavioralAnalysis.attentionLevel,
          weight: 0.3
        },
        {
          factor: 'Cognitive Load',
          score: Math.max(0, 1 - behavioralAnalysis.cognitiveLoad / 2), // Invert cognitive load
          weight: 0.25
        },
        {
          factor: 'Engagement',
          score: behavioralAnalysis.engagementScore,
          weight: 0.25
        },
        {
          factor: 'Fatigue Level',
          score: Math.max(0, 1 - behavioralAnalysis.fatigueLevel), // Invert fatigue
          weight: 0.2
        }
      ];

      // Calculate overall timing score
      const overallScore = timingFactors.reduce(
        (sum, factor) => sum + (factor.score * factor.weight),
        0
      );

      const isOptimalTiming = overallScore >= 0.7;
      const confidenceScore = Math.min(overallScore, 0.95); // Cap confidence at 95%

      // Determine intervention type based on timing analysis
      let interventionType: 'immediate' | 'delayed' | 'skip';
      let recommendedDelay: number | undefined;
      let nextOptimalWindow: Date | undefined;

      if (isOptimalTiming) {
        interventionType = 'immediate';
      } else if (overallScore >= 0.4) {
        interventionType = 'delayed';
        recommendedDelay = Math.round((0.7 - overallScore) * this.MICRO_INTERVENTION_WINDOW_MINUTES);
        nextOptimalWindow = new Date(Date.now() + recommendedDelay * 60 * 1000);
      } else {
        interventionType = 'skip';
        nextOptimalWindow = new Date(Date.now() + this.MICRO_INTERVENTION_WINDOW_MINUTES * 60 * 1000);
      }

      return {
        isOptimalTiming,
        confidenceScore,
        timingFactors,
        recommendedDelay,
        nextOptimalWindow,
        interventionType
      };

    } catch (error) {
      console.error('Micro-intervention timing analysis failed:', error);
      
      return {
        isOptimalTiming: false,
        confidenceScore: 0.0,
        timingFactors: [],
        interventionType: 'skip'
      };
    }
  }

  // Private helper methods for intervention generation

  /**
   * Generates struggle prevention recommendations
   */
  private async generateStrugglePreventionRecommendations(
    strugglePrediction: StrugglePrediction,
    behavioralAnalysis: BehavioralSignalAnalysis,
    courseId: string,
    contentId?: string
  ): Promise<ProactiveRecommendation[]> {
    const recommendations: ProactiveRecommendation[] = [];

    if (strugglePrediction.riskLevel > 0.8) {
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'concept_clarification',
        priority: 'high',
        title: 'Need clarification on this concept?',
        message: `I notice you might be finding this challenging. ${strugglePrediction.explainability} Would you like me to explain this concept differently?`,
        actionable: true,
        actionText: 'Get help now',
        dismissible: true,
        validUntil: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
        triggerReason: 'High struggle risk prediction',
        confidence: strugglePrediction.confidence
      });
    }

    if (strugglePrediction.contributingFactors.includes('Response time increase')) {
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'break_reminder',
        priority: 'medium',
        title: 'Time for a short break?',
        message: 'I notice your response times have increased. Taking a 5-10 minute break can help refresh your focus and improve learning.',
        actionable: true,
        actionText: 'Take break',
        dismissible: true,
        validUntil: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
        triggerReason: 'Response time increase detected',
        confidence: 0.8
      });
    }

    return recommendations;
  }

  /**
   * Generates cognitive load management recommendations
   */
  private generateCognitiveLoadRecommendations(
    behavioralAnalysis: BehavioralSignalAnalysis,
    courseId: string
  ): ProactiveRecommendation[] {
    const recommendations: ProactiveRecommendation[] = [];

    recommendations.push({
      id: crypto.randomUUID(),
      type: 'study_strategy',
      priority: 'medium',
      title: 'Feeling overwhelmed?',
      message: 'Your cognitive load seems high right now. Try breaking down this problem into smaller steps, or focus on one concept at a time.',
      actionable: false,
      dismissible: true,
      validUntil: new Date(Date.now() + 20 * 60 * 1000), // 20 minutes
      triggerReason: 'High cognitive load detected',
      confidence: 0.75
    });

    return recommendations;
  }

  /**
   * Generates engagement optimization recommendations
   */
  private generateEngagementRecommendations(
    behavioralAnalysis: BehavioralSignalAnalysis,
    courseId: string
  ): ProactiveRecommendation[] {
    const recommendations: ProactiveRecommendation[] = [];

    recommendations.push({
      id: crypto.randomUUID(),
      type: 'motivational',
      priority: 'low',
      title: 'Try a different approach?',
      message: 'It looks like your engagement has decreased. Would you like to try a different learning activity or approach to this concept?',
      actionable: true,
      actionText: 'Suggest alternatives',
      dismissible: true,
      validUntil: new Date(Date.now() + 25 * 60 * 1000), // 25 minutes
      triggerReason: 'Low engagement detected',
      confidence: 0.6
    });

    return recommendations;
  }

  /**
   * Generates recommendations for optimal timing windows
   */
  private async generateOptimalTimingRecommendations(
    tenantId: string,
    userId: string,
    courseId: string,
    behavioralAnalysis: BehavioralSignalAnalysis
  ): Promise<ProactiveRecommendation[]> {
    const recommendations: ProactiveRecommendation[] = [];

    // This is an optimal time for learning - suggest advancing to harder concepts
    recommendations.push({
      id: crypto.randomUUID(),
      type: 'practice_suggestion',
      priority: 'medium',
      title: 'You\'re in the zone!',
      message: 'Your attention and engagement are high right now. This would be a great time to tackle a more challenging problem or learn something new.',
      actionable: true,
      actionText: 'Show me harder problems',
      dismissible: true,
      validUntil: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      triggerReason: 'Optimal learning state detected',
      confidence: 0.9
    });

    return recommendations;
  }

  /**
   * Applies cooldown filtering to prevent intervention spam
   */
  private async applyCooldownFiltering(
    tenantId: string,
    userId: string,
    recommendations: ProactiveRecommendation[]
  ): Promise<ProactiveRecommendation[]> {
    // Get recent interventions of the same type
    const recentInterventions = await this.getRecentInterventions(
      tenantId, 
      userId, 
      this.INTERVENTION_COOLDOWN_MINUTES / 60 // Convert to hours
    );

    const recentTypes = new Set(recentInterventions.map(i => i.type));

    // Filter out recommendations that are in cooldown
    return recommendations.filter(rec => !recentTypes.has(rec.type));
  }

  /**
   * Prioritizes recommendations by urgency and confidence
   */
  private prioritizeRecommendations(recommendations: ProactiveRecommendation[]): ProactiveRecommendation[] {
    const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
    
    return recommendations.sort((a, b) => {
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.confidence - a.confidence;
    });
  }

  // Additional helper methods (simplified for MVP)

  private calculateOptimalDifficulty(
    learnerProfile: LearnerDNAProfile | null,
    behavioralAnalysis: BehavioralSignalAnalysis | null,
    strugglePrediction: StrugglePrediction | null,
    currentDifficulty: number,
    contentType: string
  ): number {
    let adjustment = 0;

    // Adjust based on struggle risk
    if (strugglePrediction?.riskLevel !== undefined) {
      if (strugglePrediction.riskLevel > 0.7) {
        adjustment = -0.2; // Reduce difficulty
      } else if (strugglePrediction.riskLevel < 0.3) {
        adjustment = 0.1; // Increase difficulty slightly
      }
    }

    // Adjust based on cognitive load
    if (behavioralAnalysis?.cognitiveLoad !== undefined) {
      if (behavioralAnalysis.cognitiveLoad > 0.8) {
        adjustment -= 0.1; // Reduce difficulty
      } else if (behavioralAnalysis.cognitiveLoad < 0.4) {
        adjustment += 0.1; // Increase difficulty
      }
    }

    // Apply learning velocity factor if available
    if (learnerProfile && learnerProfile.learningVelocityValue > 1.2) {
      adjustment += 0.05; // Fast learners can handle slightly higher difficulty
    }

    const newDifficulty = Math.max(0.1, Math.min(0.9, currentDifficulty + adjustment));
    return Math.round(newDifficulty * 10) / 10; // Round to 1 decimal place
  }

  private generateDifficultyAdjustmentReason(
    currentDifficulty: number,
    optimalDifficulty: number,
    behavioralAnalysis: BehavioralSignalAnalysis,
    strugglePrediction: StrugglePrediction
  ): string {
    const difference = optimalDifficulty - currentDifficulty;
    
    if (Math.abs(difference) < 0.05) {
      return 'Current difficulty level appears appropriate for this student';
    }
    
    if (difference > 0) {
      return `Recommended to increase difficulty by ${Math.abs(difference).toFixed(1)} based on low struggle risk and good cognitive capacity`;
    } else {
      return `Recommended to decrease difficulty by ${Math.abs(difference).toFixed(1)} based on high struggle risk or cognitive load`;
    }
  }

  private calculateAdjustmentConfidence(
    learnerProfile: LearnerDNAProfile | null,
    behavioralAnalysis: BehavioralSignalAnalysis | null,
    strugglePrediction: StrugglePrediction | null
  ): number {
    let confidence = 0.5; // Base confidence

    // Higher confidence with more data
    if (learnerProfile && learnerProfile.totalDataPoints > 20) {
      confidence += 0.2;
    }

    // Higher confidence with high prediction confidence
    if (strugglePrediction?.confidence && strugglePrediction.confidence > 0.8) {
      confidence += 0.2;
    }

    // Lower confidence with extreme cognitive states
    if (behavioralAnalysis?.cognitiveLoad && behavioralAnalysis?.fatigueLevel && 
        (behavioralAnalysis.cognitiveLoad > 1.5 || behavioralAnalysis.fatigueLevel > 0.8)) {
      confidence -= 0.1;
    }

    return Math.max(0.1, Math.min(0.95, confidence));
  }

  // Database helper methods (simplified)

  private async getLearnerProfile(tenantId: string, userId: string): Promise<LearnerDNAProfile | null> {
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
      lastAnalyzedAt: new Date(result.last_analyzed_at),
    };
  }

  private async getRecentInterventions(tenantId: string, userId: string, hours: number): Promise<any[]> {
    const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const queryResult = await this.db
      .getDb()
      .prepare(`
        SELECT * FROM learning_interventions 
        WHERE tenant_id = ? AND user_id = ? AND delivery_timestamp >= ?
        ORDER BY delivery_timestamp DESC
      `)
      .bind(tenantId, userId, hoursAgo.toISOString())
      .all<any>();

    // Handle both D1 production format and test format
    const results = queryResult?.results || queryResult || [];
    return results.map(row => ({
      id: row.id,
      type: row.intervention_type || row.type, // Handle both field names for tests
      deliveryTimestamp: row.delivery_timestamp ? new Date(row.delivery_timestamp) : row.deliveryTimestamp,
      response: row.student_response
    }));
  }

  private async getCourseStudents(tenantId: string, courseId: string): Promise<string[]> {
    // Simplified - would normally query enrollment data
    const queryResult = await this.db
      .getDb()
      .prepare(`
        SELECT DISTINCT user_id FROM behavioral_patterns 
        WHERE tenant_id = ? AND course_id = ? AND consent_verified = 1
      `)
      .bind(tenantId, courseId)
      .all<any>();

    // Handle both D1 production format and test format
    const results = queryResult?.results || queryResult || [];
    return results.map(row => row.user_id);
  }

  private async generateStudentAlerts(
    tenantId: string,
    studentId: string,
    courseId: string,
    strugglePrediction: StrugglePrediction,
    behavioralAnalysis: BehavioralSignalAnalysis
  ): Promise<EarlyWarningAlert[]> {
    const alerts: EarlyWarningAlert[] = [];

    // High struggle risk alert
    if (strugglePrediction.riskLevel > 0.8 && strugglePrediction.confidence > 0.6) {
      alerts.push({
        id: crypto.randomUUID(),
        studentId,
        alertType: 'struggle_risk',
        severity: strugglePrediction.riskLevel > 0.9 ? 'critical' : 'high',
        confidence: strugglePrediction.confidence,
        alertMessage: 'Student shows high risk of struggling with current concepts',
        specificConcerns: strugglePrediction.contributingFactors,
        recommendedActions: [
          {
            action: 'Schedule one-on-one check-in with student',
            priority: 'within_24h',
            expectedImpact: 'Provide targeted support and identify specific challenges'
          },
          {
            action: 'Recommend additional practice resources',
            priority: 'immediate',
            expectedImpact: 'Reinforce foundational concepts'
          }
        ],
        triggerData: { riskLevel: strugglePrediction.riskLevel, factors: strugglePrediction.contributingFactors },
        createdAt: new Date(),
        actionDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
    }

    // Cognitive overload alert
    if (behavioralAnalysis.cognitiveLoad > 1.5 && behavioralAnalysis.fatigueLevel > 0.7) {
      alerts.push({
        id: crypto.randomUUID(),
        studentId,
        alertType: 'cognitive_overload',
        severity: 'medium',
        confidence: 0.75,
        alertMessage: 'Student showing signs of cognitive overload and fatigue',
        specificConcerns: ['High cognitive load', 'Elevated fatigue indicators'],
        recommendedActions: [
          {
            action: 'Suggest reduced course load or extended deadlines',
            priority: 'within_week',
            expectedImpact: 'Reduce stress and improve learning capacity'
          }
        ],
        triggerData: { cognitiveLoad: behavioralAnalysis.cognitiveLoad, fatigue: behavioralAnalysis.fatigueLevel },
        createdAt: new Date()
      });
    }

    return alerts;
  }

  private async storeProactiveRecommendations(
    tenantId: string,
    userId: string,
    courseId: string,
    recommendations: ProactiveRecommendation[]
  ): Promise<void> {
    for (const rec of recommendations) {
      try {
        await this.db
          .getDb()
          .prepare(`
            INSERT INTO learning_interventions (
              id, tenant_id, user_id, course_id, intervention_type, priority,
              recommended_action, trigger_pattern, delivery_timestamp, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            rec.id,
            tenantId,
            userId,
            courseId,
            rec.type,
            rec.priority,
            rec.message,
            rec.triggerReason,
            new Date().toISOString(),
            new Date().toISOString()
          )
          .run();
      } catch (error) {
        console.error('Failed to store proactive recommendation:', error);
      }
    }
  }

  private async storeEarlyWarningAlerts(
    tenantId: string,
    courseId: string,
    instructorId: string,
    alerts: EarlyWarningAlert[]
  ): Promise<void> {
    for (const alert of alerts) {
      try {
        await this.db
          .getDb()
          .prepare(`
            INSERT INTO instructor_alerts (
              id, tenant_id, instructor_id, student_id, course_id,
              alert_type, severity, confidence, alert_message,
              specific_concerns, recommended_actions, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            alert.id,
            tenantId,
            instructorId,
            alert.studentId,
            courseId,
            alert.alertType,
            alert.severity,
            alert.confidence,
            alert.alertMessage,
            JSON.stringify(alert.specificConcerns),
            JSON.stringify(alert.recommendedActions),
            alert.createdAt.toISOString()
          )
          .run();
      } catch (error) {
        console.error('Failed to store early warning alert:', error);
      }
    }
  }

  // Placeholder methods for learning path generation (simplified for MVP)

  private async getCurrentProgress(tenantId: string, userId: string, courseId: string): Promise<any> {
    return { completedConcepts: [], currentLevel: 0.5 };
  }

  private async generateLearningPathStep(
    conceptId: string,
    forecast: LearningVelocityForecast,
    learnerProfile: LearnerDNAProfile | null,
    currentProgress: any,
    stepIndex: number
  ): Promise<LearningPathStep> {
    return {
      stepId: `step-${stepIndex}`,
      conceptId,
      conceptName: conceptId.replace(/-/g, ' '),
      difficulty: 0.5,
      estimatedDuration: forecast.estimatedMasteryTime,
      prerequisites: stepIndex > 0 ? [`previous-concept-${stepIndex - 1}`] : [],
      learningObjectives: [`Master ${conceptId}`],
      recommendedResources: [
        {
          type: 'reading',
          title: `${conceptId} Guide`,
          duration: Math.round(forecast.estimatedMasteryTime * 0.4)
        },
        {
          type: 'practice',
          title: `${conceptId} Exercises`,
          duration: Math.round(forecast.estimatedMasteryTime * 0.6)
        }
      ],
      adaptationReasons: forecast.personalizedStrategies
    };
  }

  private optimizeLearningPathSequence(
    learningPath: LearningPathStep[],
    learnerProfile: LearnerDNAProfile | null
  ): LearningPathStep[] {
    // Simple optimization - sort by difficulty for MVP
    return learningPath.sort((a, b) => a.difficulty - b.difficulty);
  }

  private generateGraduationPath(
    currentDifficulty: number,
    targetDifficulty: number,
    learnerProfile: LearnerDNAProfile | null
  ): { targetDifficulty: number; estimatedTimeToTarget: number; milestones: Array<{ difficulty: number; concepts: string[] }> } {
    const difficultyGap = targetDifficulty - currentDifficulty;
    const milestoneCount = Math.max(2, Math.ceil(difficultyGap / 0.2));
    const timePerMilestone = 30; // 30 minutes per milestone
    
    const milestones = [];
    for (let i = 1; i <= milestoneCount; i++) {
      const milestoneDifficulty = currentDifficulty + (difficultyGap * i / milestoneCount);
      milestones.push({
        difficulty: Math.round(milestoneDifficulty * 10) / 10,
        concepts: [`milestone-${i}-concepts`]
      });
    }

    return {
      targetDifficulty,
      estimatedTimeToTarget: milestoneCount * timePerMilestone,
      milestones
    };
  }
}