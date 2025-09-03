/**
 * @fileoverview Student performance analytics service for Story 3.3
 * @module features/dashboard/server/services/PerformanceAnalyticsService
 */

import { z } from 'zod';
import type { D1Database, Queue } from '@cloudflare/workers-types';

/**
 * Schema for student performance profile data
 */
export const StudentPerformanceProfileSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  studentId: z.string(),
  courseId: z.string(),
  overallMastery: z.number().min(0).max(1),
  learningVelocity: z.number().min(0),
  confidenceLevel: z.number().min(0).max(1),
  performanceData: z.record(z.unknown()),
  lastCalculated: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type StudentPerformanceProfile = z.infer<typeof StudentPerformanceProfileSchema>;

/**
 * Schema for concept mastery data
 */
export const ConceptMasterySchema = z.object({
  id: z.string(),
  profileId: z.string(),
  conceptId: z.string(),
  conceptName: z.string(),
  masteryLevel: z.number().min(0).max(1),
  confidenceScore: z.number().min(0).max(1),
  assessmentCount: z.number().int().min(0),
  averageResponseTime: z.number().int().min(0),
  improvementTrend: z.enum(['improving', 'stable', 'declining']),
  lastAssessed: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ConceptMastery = z.infer<typeof ConceptMasterySchema>;

/**
 * Schema for learning recommendations
 */
export const LearningRecommendationSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  recommendationType: z.enum(['review', 'practice', 'advance', 'seek_help']),
  priority: z.enum(['high', 'medium', 'low']),
  conceptsInvolved: z.array(z.string()),
  suggestedActions: z.array(z.string()),
  estimatedTimeMinutes: z.number().int().min(0).optional(),
  contentReferences: z.array(z.string()).optional(),
  reasoning: z.string(),
  status: z.enum(['active', 'completed', 'dismissed']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  effectivenessScore: z.number().min(0).max(1).optional(),
});

export type LearningRecommendation = z.infer<typeof LearningRecommendationSchema>;

/**
 * Schema for struggle patterns
 */
export const StrugglePatternSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  studentId: z.string(),
  patternType: z.enum(['misconception', 'knowledge_gap', 'skill_deficit', 'confidence_issue']),
  conceptsInvolved: z.array(z.string()),
  evidenceCount: z.number().int().min(1),
  severity: z.number().min(0).max(1),
  suggestedInterventions: z.array(z.string()),
  detectedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
  resolutionMethod: z.string().optional(),
  confidenceScore: z.number().min(0).max(1),
});

export type StrugglePattern = z.infer<typeof StrugglePatternSchema>;

/**
 * Schema for analytics processing tasks
 */
export const AnalyticsTaskSchema = z.object({
  taskType: z.enum(['performance_update', 'recommendation_generation', 'pattern_detection', 'alert_check']),
  tenantId: z.string(),
  studentId: z.string().optional(),
  courseId: z.string().optional(),
  assessmentId: z.string().optional(),
  priority: z.number().int().min(1).max(10).default(5),
  taskData: z.record(z.unknown()).default({}),
});

export type AnalyticsTask = z.infer<typeof AnalyticsTaskSchema>;

/**
 * Performance analytics service for processing student data and generating insights
 * 
 * Implements async processing using Cloudflare Queues for scalability and performance.
 * Provides rule-based analytics with optional AI enhancement capabilities.
 * 
 * @class PerformanceAnalyticsService
 */
export class PerformanceAnalyticsService {
  constructor(
    private readonly db: D1Database,
    private readonly analyticsQueue: Queue,
    private readonly tenantId: string
  ) {}

  /**
   * Queue analytics processing task for async execution
   * 
   * @param task - Analytics task to be processed
   * @returns Promise resolving to task queue ID
   * @throws {Error} If task validation or queuing fails
   */
  public async queueAnalyticsTask(task: AnalyticsTask): Promise<string> {
    const validatedTask = AnalyticsTaskSchema.parse(task);
    
    const taskId = crypto.randomUUID();
    
    // Add to local queue tracking
    await this.db
      .prepare(`
        INSERT INTO analytics_processing_queue (
          id, tenant_id, task_type, task_data, priority, status
        ) VALUES (?, ?, ?, ?, ?, 'pending')
      `)
      .bind(
        taskId,
        this.tenantId,
        validatedTask.taskType,
        JSON.stringify(validatedTask),
        validatedTask.priority
      )
      .run();

    // Send to Cloudflare Queue for processing
    await this.analyticsQueue.send({
      taskId,
      ...validatedTask,
    });

    return taskId;
  }

  /**
   * Calculate overall mastery score for a student based on concept masteries
   * 
   * Uses weighted average based on concept importance and assessment frequency.
   * 
   * @param studentId - Student's LTI user ID
   * @param courseId - Course identifier
   * @returns Promise resolving to mastery score (0-1)
   */
  public async calculateOverallMastery(studentId: string, courseId: string): Promise<number> {
    const result = await this.db
      .prepare(`
        SELECT 
          cm.mastery_level,
          cm.confidence_score,
          cm.assessment_count,
          ccm.content_weight
        FROM concept_masteries cm
        JOIN student_performance_profiles spp ON cm.profile_id = spp.id
        LEFT JOIN course_content_mapping ccm ON cm.concept_id = ccm.content_id 
          AND ccm.course_id = ?
        WHERE spp.tenant_id = ? AND spp.student_id = ? AND spp.course_id = ?
      `)
      .bind(courseId, this.tenantId, studentId, courseId)
      .all();

    if (result.results.length === 0) {
      return 0;
    }

    let weightedSum = 0;
    let totalWeight = 0;

    for (const row of result.results) {
      const mastery = Number(row.mastery_level) || 0;
      const confidence = Number(row.confidence_score) || 0.5;
      const assessmentCount = Number(row.assessment_count) || 1;
      const contentWeight = Number(row.content_weight) || 1.0;
      
      // Weight by content importance, confidence, and assessment frequency
      const weight = contentWeight * confidence * Math.min(assessmentCount / 3, 1);
      
      weightedSum += mastery * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? Math.min(weightedSum / totalWeight, 1) : 0;
  }

  /**
   * Calculate learning velocity based on concept mastery progression
   * 
   * @param studentId - Student's LTI user ID
   * @param courseId - Course identifier
   * @param daysPeriod - Number of days to analyze (default: 30)
   * @returns Promise resolving to learning velocity (concepts per day)
   */
  public async calculateLearningVelocity(
    studentId: string,
    courseId: string,
    daysPeriod: number = 30
  ): Promise<number> {
    const result = await this.db
      .prepare(`
        SELECT 
          COUNT(*) as mastered_concepts,
          MIN(cm.last_assessed) as earliest_assessment,
          MAX(cm.last_assessed) as latest_assessment
        FROM concept_masteries cm
        JOIN student_performance_profiles spp ON cm.profile_id = spp.id
        WHERE spp.tenant_id = ? AND spp.student_id = ? AND spp.course_id = ?
          AND cm.mastery_level >= 0.8
          AND cm.last_assessed > datetime('now', '-' || ? || ' days')
      `)
      .bind(this.tenantId, studentId, courseId, daysPeriod)
      .first();

    if (!result || !result.mastered_concepts) {
      return 0;
    }

    const masteredCount = Number(result.mastered_concepts);
    const earliestDate = new Date(result.earliest_assessment as string);
    const latestDate = new Date(result.latest_assessment as string);
    
    const daysDifference = Math.max(
      (latestDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24),
      1
    );

    return masteredCount / daysDifference;
  }

  /**
   * Detect learning patterns and knowledge gaps for a student
   * 
   * @param studentId - Student's LTI user ID
   * @param courseId - Course identifier
   * @returns Promise resolving to array of detected patterns
   */
  public async detectLearningPatterns(
    studentId: string,
    courseId: string
  ): Promise<StrugglePattern[]> {
    // Get assessment performance data
    const assessmentData = await this.db
      .prepare(`
        SELECT 
          ar.question_id,
          ar.score,
          ar.response_time_seconds,
          aq.difficulty_level,
          aq.content_reference,
          aq.question_type,
          ac.assessment_type
        FROM assessment_responses ar
        JOIN assessment_attempts aa ON ar.attempt_id = aa.id
        JOIN assessment_configs ac ON aa.assessment_id = ac.id
        JOIN assessment_questions aq ON ar.question_id = aq.id
        WHERE ac.tenant_id = ? AND aa.student_id = ? AND ac.course_id = ?
          AND aa.status = 'completed'
        ORDER BY aa.started_at DESC
        LIMIT 100
      `)
      .bind(this.tenantId, studentId, courseId)
      .all();

    const patterns: StrugglePattern[] = [];

    // Pattern 1: Consistent low performance on specific concepts
    const conceptScores = new Map<string, number[]>();
    for (const row of assessmentData.results) {
      const conceptId = row.content_reference as string;
      if (conceptId) {
        if (!conceptScores.has(conceptId)) {
          conceptScores.set(conceptId, []);
        }
        conceptScores.get(conceptId)!.push(Number(row.score) || 0);
      }
    }

    for (const [conceptId, scores] of conceptScores) {
      if (scores.length >= 3) {
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        if (avgScore < 0.6) {
          patterns.push({
            id: crypto.randomUUID(),
            tenantId: this.tenantId,
            studentId,
            patternType: 'knowledge_gap',
            conceptsInvolved: [conceptId],
            evidenceCount: scores.length,
            severity: Math.max(0, (0.6 - avgScore) / 0.6),
            suggestedInterventions: [
              'Review prerequisite concepts',
              'Additional practice problems',
              'One-on-one tutoring session'
            ],
            detectedAt: new Date().toISOString(),
            confidenceScore: Math.min(scores.length / 5, 1),
          });
        }
      }
    }

    // Pattern 2: Response time patterns indicating confusion
    const responseTimeData = assessmentData.results
      .map(row => ({
        questionType: row.question_type as string,
        responseTime: Number(row.response_time_seconds) || 0,
        difficulty: Number(row.difficulty_level) || 0.5,
        score: Number(row.score) || 0,
      }))
      .filter(item => item.responseTime > 0);

    if (responseTimeData.length >= 10) {
      // Calculate expected response time based on difficulty
      const avgTimeByDifficulty = responseTimeData.reduce((acc, item) => {
        const difficultyBucket = Math.floor(item.difficulty * 4) / 4; // 0, 0.25, 0.5, 0.75, 1
        if (!acc[difficultyBucket]) acc[difficultyBucket] = [];
        acc[difficultyBucket].push(item.responseTime);
        return acc;
      }, {} as Record<number, number[]>);

      // Detect unusually long response times with poor performance
      const longResponseLowScore = responseTimeData.filter(item => {
        const expectedTimes = avgTimeByDifficulty[Math.floor(item.difficulty * 4) / 4] || [];
        const avgExpected = expectedTimes.reduce((a, b) => a + b, 0) / expectedTimes.length;
        return item.responseTime > avgExpected * 1.5 && item.score < 0.5;
      });

      if (longResponseLowScore.length >= 3) {
        patterns.push({
          id: crypto.randomUUID(),
          tenantId: this.tenantId,
          studentId,
          patternType: 'confidence_issue',
          conceptsInvolved: ['general_confidence'],
          evidenceCount: longResponseLowScore.length,
          severity: Math.min(longResponseLowScore.length / responseTimeData.length, 1),
          suggestedInterventions: [
            'Time management strategies',
            'Test anxiety support',
            'Confidence building exercises'
          ],
          detectedAt: new Date().toISOString(),
          confidenceScore: 0.7,
        });
      }
    }

    return patterns;
  }

  /**
   * Generate personalized learning recommendations based on performance data
   * 
   * @param studentId - Student's LTI user ID
   * @param courseId - Course identifier
   * @returns Promise resolving to array of learning recommendations
   */
  public async generateRecommendations(
    studentId: string,
    courseId: string
  ): Promise<LearningRecommendation[]> {
    // Get student performance profile
    const profileResult = await this.db
      .prepare(`
        SELECT * FROM student_performance_profiles 
        WHERE tenant_id = ? AND student_id = ? AND course_id = ?
      `)
      .bind(this.tenantId, studentId, courseId)
      .first();

    if (!profileResult) {
      return [];
    }

    const profile = StudentPerformanceProfileSchema.parse({
      ...profileResult,
      performanceData: JSON.parse(profileResult.performance_data as string),
    });

    const recommendations: LearningRecommendation[] = [];

    // Get low mastery concepts
    const lowMasteryResult = await this.db
      .prepare(`
        SELECT * FROM concept_masteries 
        WHERE profile_id = ? AND mastery_level < 0.7
        ORDER BY mastery_level ASC
        LIMIT 5
      `)
      .bind(profile.id)
      .all();

    // Generate review recommendations for low mastery concepts
    for (const row of lowMasteryResult.results) {
      const mastery = ConceptMasterySchema.parse({
        ...row,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastAssessed: row.last_assessed,
      });

      recommendations.push({
        id: crypto.randomUUID(),
        profileId: profile.id,
        recommendationType: 'review',
        priority: mastery.masteryLevel < 0.4 ? 'high' : 'medium',
        conceptsInvolved: [mastery.conceptId],
        suggestedActions: [
          `Review ${mastery.conceptName} fundamentals`,
          'Complete practice exercises',
          'Watch explanatory videos'
        ],
        estimatedTimeMinutes: Math.ceil(30 + (0.7 - mastery.masteryLevel) * 60),
        contentReferences: [], // Would be populated from content analysis
        reasoning: `Mastery level of ${Math.round(mastery.masteryLevel * 100)}% is below target threshold`,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      });
    }

    // Get recently mastered concepts for advancement recommendations
    const recentMasteryResult = await this.db
      .prepare(`
        SELECT * FROM concept_masteries 
        WHERE profile_id = ? AND mastery_level >= 0.8 AND improvement_trend = 'improving'
        ORDER BY last_assessed DESC
        LIMIT 3
      `)
      .bind(profile.id)
      .all();

    // Generate advancement recommendations
    for (const row of recentMasteryResult.results) {
      const mastery = ConceptMasterySchema.parse({
        ...row,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastAssessed: row.last_assessed,
      });

      // Find related advanced concepts
      const relatedConceptsResult = await this.db
        .prepare(`
          SELECT target_concept_id, strength FROM concept_relationships
          WHERE tenant_id = ? AND source_concept_id = ? 
            AND relationship_type = 'builds_upon'
          ORDER BY strength DESC
          LIMIT 2
        `)
        .bind(this.tenantId, mastery.conceptId)
        .all();

      if (relatedConceptsResult.results.length > 0) {
        recommendations.push({
          id: crypto.randomUUID(),
          profileId: profile.id,
          recommendationType: 'advance',
          priority: 'medium',
          conceptsInvolved: relatedConceptsResult.results.map(r => r.target_concept_id as string),
          suggestedActions: [
            'Explore advanced applications',
            'Complete challenge problems',
            'Begin next topic sequence'
          ],
          estimatedTimeMinutes: 45,
          contentReferences: [],
          reasoning: `Strong performance in ${mastery.conceptName} suggests readiness for advanced topics`,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
        });
      }
    }

    return recommendations;
  }

  /**
   * Update student performance profile with latest analytics
   * 
   * @param studentId - Student's LTI user ID
   * @param courseId - Course identifier
   * @returns Promise resolving to updated performance profile
   */
  public async updatePerformanceProfile(
    studentId: string,
    courseId: string
  ): Promise<StudentPerformanceProfile> {
    // Calculate latest metrics
    const overallMastery = await this.calculateOverallMastery(studentId, courseId);
    const learningVelocity = await this.calculateLearningVelocity(studentId, courseId);
    
    // Get confidence level from chat interactions
    const confidenceResult = await this.db
      .prepare(`
        SELECT AVG(confidence_score) as avg_confidence
        FROM chat_messages cm
        JOIN chat_conversations cc ON cm.conversation_id = cc.conversation_id
        JOIN learner_profiles lp ON cc.learner_profile_id = lp.id
        WHERE lp.tenant_id = ? AND lp.lti_user_id = ?
          AND cm.created_at > datetime('now', '-30 days')
          AND cm.confidence_score IS NOT NULL
      `)
      .bind(this.tenantId, studentId)
      .first();

    const confidenceLevel = Number(confidenceResult?.avg_confidence) || 0.5;

    const performanceData = {
      lastAnalyzed: new Date().toISOString(),
      conceptCount: await this.getConceptCount(studentId, courseId),
      assessmentCount: await this.getAssessmentCount(studentId, courseId),
      averageSessionTime: await this.getAverageSessionTime(studentId, courseId),
    };

    // Upsert performance profile
    const profileId = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db
      .prepare(`
        INSERT INTO student_performance_profiles (
          id, tenant_id, student_id, course_id, overall_mastery, 
          learning_velocity, confidence_level, performance_data, 
          last_calculated, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(tenant_id, student_id, course_id) 
        DO UPDATE SET
          overall_mastery = excluded.overall_mastery,
          learning_velocity = excluded.learning_velocity,
          confidence_level = excluded.confidence_level,
          performance_data = excluded.performance_data,
          last_calculated = excluded.last_calculated,
          updated_at = excluded.updated_at
      `)
      .bind(
        profileId,
        this.tenantId,
        studentId,
        courseId,
        overallMastery,
        learningVelocity,
        confidenceLevel,
        JSON.stringify(performanceData),
        now,
        now,
        now
      )
      .run();

    // Return updated profile
    const updatedProfile = await this.db
      .prepare(`
        SELECT * FROM student_performance_profiles 
        WHERE tenant_id = ? AND student_id = ? AND course_id = ?
      `)
      .bind(this.tenantId, studentId, courseId)
      .first();

    return StudentPerformanceProfileSchema.parse({
      ...updatedProfile,
      performanceData: JSON.parse(updatedProfile!.performance_data as string),
    });
  }

  /**
   * Get concept count for performance data
   */
  private async getConceptCount(studentId: string, courseId: string): Promise<number> {
    const result = await this.db
      .prepare(`
        SELECT COUNT(*) as count
        FROM concept_masteries cm
        JOIN student_performance_profiles spp ON cm.profile_id = spp.id
        WHERE spp.tenant_id = ? AND spp.student_id = ? AND spp.course_id = ?
      `)
      .bind(this.tenantId, studentId, courseId)
      .first();

    return Number(result?.count) || 0;
  }

  /**
   * Get assessment count for performance data
   */
  private async getAssessmentCount(studentId: string, courseId: string): Promise<number> {
    const result = await this.db
      .prepare(`
        SELECT COUNT(*) as count
        FROM assessment_attempts aa
        JOIN assessment_configs ac ON aa.assessment_id = ac.id
        WHERE ac.tenant_id = ? AND aa.student_id = ? AND ac.course_id = ?
          AND aa.status = 'completed'
      `)
      .bind(this.tenantId, studentId, courseId)
      .first();

    return Number(result?.count) || 0;
  }

  /**
   * Get average session time for performance data
   */
  private async getAverageSessionTime(studentId: string, courseId: string): Promise<number> {
    const result = await this.db
      .prepare(`
        SELECT AVG(duration_seconds) as avg_duration
        FROM learning_sessions ls
        JOIN learner_profiles lp ON ls.learner_profile_id = lp.id
        WHERE lp.tenant_id = ? AND lp.lti_user_id = ? AND ls.lti_context_id = ?
          AND ls.duration_seconds > 0
          AND ls.started_at > datetime('now', '-30 days')
      `)
      .bind(this.tenantId, studentId, courseId)
      .first();

    return Number(result?.avg_duration) || 0;
  }

  /**
   * Get student performance data for analytics dashboard
   * 
   * @param studentId - Student's LTI user ID
   * @param courseId - Course identifier
   * @returns Promise resolving to comprehensive performance data
   */
  public async getStudentAnalytics(studentId: string, courseId: string): Promise<{
    profile: StudentPerformanceProfile | null;
    conceptMasteries: ConceptMastery[];
    recommendations: LearningRecommendation[];
    strugglesIdentified: StrugglePattern[];
    progressHistory: Array<{
      date: string;
      overallMastery: number;
      conceptScores: Record<string, number>;
    }>;
  }> {
    // Get performance profile
    const profileResult = await this.db
      .prepare(`
        SELECT * FROM student_performance_profiles 
        WHERE tenant_id = ? AND student_id = ? AND course_id = ?
      `)
      .bind(this.tenantId, studentId, courseId)
      .first();

    const profile = profileResult 
      ? StudentPerformanceProfileSchema.parse({
          ...profileResult,
          performanceData: JSON.parse(profileResult.performance_data as string),
        })
      : null;

    // Get concept masteries
    const conceptMasteriesResult = profile 
      ? await this.db
          .prepare('SELECT * FROM concept_masteries WHERE profile_id = ?')
          .bind(profile.id)
          .all()
      : { results: [] };

    const conceptMasteries = conceptMasteriesResult.results.map(row =>
      ConceptMasterySchema.parse({
        ...row,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastAssessed: row.last_assessed,
      })
    );

    // Get active recommendations
    const recommendationsResult = profile
      ? await this.db
          .prepare(`
            SELECT * FROM learning_recommendations 
            WHERE profile_id = ? AND status = 'active'
            ORDER BY priority DESC, created_at DESC
          `)
          .bind(profile.id)
          .all()
      : { results: [] };

    const recommendations = recommendationsResult.results.map(row =>
      LearningRecommendationSchema.parse({
        ...row,
        conceptsInvolved: JSON.parse(row.concepts_involved as string),
        suggestedActions: JSON.parse(row.suggested_actions as string),
        contentReferences: row.content_references 
          ? JSON.parse(row.content_references as string) 
          : undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        expiresAt: row.expires_at || undefined,
        effectivenessScore: row.effectiveness_score || undefined,
      })
    );

    // Get struggle patterns
    const strugglesResult = await this.db
      .prepare(`
        SELECT * FROM struggle_patterns 
        WHERE tenant_id = ? AND student_id = ? AND resolved_at IS NULL
        ORDER BY severity DESC, detected_at DESC
      `)
      .bind(this.tenantId, studentId)
      .all();

    const strugglesIdentified = strugglesResult.results.map(row =>
      StrugglePatternSchema.parse({
        ...row,
        conceptsInvolved: JSON.parse(row.concepts_involved as string),
        suggestedInterventions: JSON.parse(row.suggested_interventions as string),
        detectedAt: row.detected_at,
        resolvedAt: row.resolved_at || undefined,
        resolutionMethod: row.resolution_method || undefined,
      })
    );

    // Get progress history from performance snapshots
    const progressResult = await this.db
      .prepare(`
        SELECT 
          snapshot_date as date,
          overall_mastery_score as overallMastery
        FROM performance_snapshots 
        WHERE tenant_id = ? AND student_id = ? AND course_id = ?
        ORDER BY snapshot_date DESC
        LIMIT 30
      `)
      .bind(this.tenantId, studentId, courseId)
      .all();

    const progressHistory = progressResult.results.map(row => ({
      date: row.date as string,
      overallMastery: Number(row.overallMastery) || 0,
      conceptScores: {}, // TODO: Implement detailed concept score tracking
    }));

    return {
      profile,
      conceptMasteries,
      recommendations,
      strugglesIdentified,
      progressHistory,
    };
  }

  /**
   * Calculate comprehensive student performance metrics
   */
  public async calculateStudentPerformance(
    tenantId: string,
    studentId: string,
    courseId: string
  ): Promise<StudentPerformanceProfile & { 
    strugglesIdentified: StrugglePattern[]; 
    conceptMasteries: Map<string, ConceptMastery> 
  }> {
    // Get assessment attempts
    const attemptsResult = await this.db
      .prepare(`
        SELECT aa.score, aa.max_score, aa.time_spent, aa.question_count
        FROM assessment_attempts aa
        WHERE aa.tenant_id = ? AND aa.student_id = ? 
          AND aa.course_id = ? AND aa.status = 'completed'
      `)
      .bind(tenantId, studentId, courseId)
      .all();

    // Calculate overall mastery
    let totalScore = 0;
    let maxPossibleScore = 0;
    let totalTimeSpent = 0;
    
    attemptsResult.results.forEach(attempt => {
      totalScore += Number(attempt.score) || 0;
      maxPossibleScore += Number(attempt.max_score) || 0;
      totalTimeSpent += Number(attempt.time_spent) || 0;
    });
    
    const overallMastery = maxPossibleScore > 0 ? totalScore / maxPossibleScore : 0;

    // Get concept-level data
    const conceptsResult = await this.db
      .prepare(`
        SELECT concept_id, SUM(correct_count) as correct_count, 
               SUM(total_count) as total_count
        FROM concept_performance
        WHERE tenant_id = ? AND student_id = ? AND course_id = ?
        GROUP BY concept_id
      `)
      .bind(tenantId, studentId, courseId)
      .all();

    // Build concept masteries
    const conceptMasteries = new Map<string, ConceptMastery>();
    const strugglingConcepts: string[] = [];
    
    conceptsResult.results.forEach(concept => {
      const correct = Number(concept.correct_count) || 0;
      const total = Number(concept.total_count) || 0;
      const masteryLevel = total > 0 ? correct / total : 0;
      
      if (masteryLevel < 0.5) {
        strugglingConcepts.push(concept.concept_id as string);
      }
      
      conceptMasteries.set(concept.concept_id as string, {
        id: crypto.randomUUID(),
        profileId: '',
        conceptId: concept.concept_id as string,
        conceptName: concept.concept_id as string,
        masteryLevel,
        confidenceScore: 0.8,
        assessmentCount: 5,
        averageResponseTime: 30,
        improvementTrend: 'stable',
        lastAssessed: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        commonMistakes: []
      } as any);
    });

    // Identify struggle patterns
    const strugglesIdentified: StrugglePattern[] = [];
    
    if (strugglingConcepts.length > 0) {
      strugglesIdentified.push({
        id: crypto.randomUUID(),
        tenantId,
        studentId,
        patternType: 'knowledge_gap',
        conceptsInvolved: strugglingConcepts,
        evidenceCount: strugglingConcepts.length,
        severity: Math.max(0.5, 1 - overallMastery),
        suggestedInterventions: ['Review foundational concepts', 'Practice problems'],
        detectedAt: new Date().toISOString(),
        resolvedAt: undefined,
        resolutionMethod: undefined,
        confidenceScore: 0.8
      });
    }

    // Calculate learning velocity (concepts mastered per hour)
    const conceptsMastered = Array.from(conceptMasteries.values()).filter(c => c.masteryLevel > 0.7).length;
    const learningVelocity = totalTimeSpent > 0 ? (conceptsMastered * 3600) / totalTimeSpent : 0;

    return {
      id: crypto.randomUUID(),
      tenantId,
      studentId,
      courseId,
      overallMastery,
      learningVelocity,
      confidenceLevel: 0.7,
      performanceData: {},
      lastCalculated: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      strugglesIdentified,
      conceptMasteries,
      recommendedActions: []
    } as any;
  }

  /**
   * Analyze concept mastery for a student
   */
  public async analyzeConceptMastery(
    tenantId: string,
    studentId: string,
    courseId: string
  ): Promise<ConceptMastery[]> {
    const result = await this.db
      .prepare(`
        SELECT 
          concept_id,
          concept_name,
          SUM(correct_count) as correct_count,
          SUM(total_count) as total_count,
          AVG(response_time) as avg_response_time
        FROM concept_performance
        WHERE tenant_id = ? AND student_id = ? AND course_id = ?
        GROUP BY concept_id, concept_name
      `)
      .bind(tenantId, studentId, courseId)
      .all();

    return result.results.map(row => ({
      id: crypto.randomUUID(),
      profileId: '',
      conceptId: row.concept_id as string,
      conceptName: row.concept_name as string || row.concept_id as string,
      masteryLevel: Number(row.correct_count) / Math.max(1, Number(row.total_count)),
      confidenceScore: 0.8,
      assessmentCount: Number(row.total_count),
      averageResponseTime: Number(row.avg_response_time) || 30,
      improvementTrend: 'stable',
      lastAssessed: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      commonMistakes: []
    } as any));
  }

  /**
   * Detect struggle patterns for a student
   */
  public async detectStrugglePatterns(
    tenantId: string,
    studentId: string,
    courseId: string
  ): Promise<StrugglePattern[]> {
    const patterns: StrugglePattern[] = [];
    
    // Get low-performing concepts
    const result = await this.db
      .prepare(`
        SELECT concept_id, SUM(correct_count) as correct, SUM(total_count) as total
        FROM concept_performance
        WHERE tenant_id = ? AND student_id = ? AND course_id = ?
        GROUP BY concept_id
        HAVING (CAST(correct AS REAL) / CAST(total AS REAL)) < 0.5
      `)
      .bind(tenantId, studentId, courseId)
      .all();

    if (result.results.length > 0) {
      const conceptsInvolved = result.results.map(r => r.concept_id as string);
      
      patterns.push({
        id: crypto.randomUUID(),
        tenantId,
        studentId,
        patternType: 'knowledge_gap',
        conceptsInvolved,
        evidenceCount: result.results.length,
        severity: 0.8,
        suggestedInterventions: ['Review material', 'Seek help'],
        detectedAt: new Date().toISOString(),
        confidenceScore: 0.9
      });
    }

    return patterns;
  }

  /**
   * Save performance profile to database
   */
  public async savePerformanceProfile(
    profile: StudentPerformanceProfile
  ): Promise<void> {
    await this.db
      .prepare(`
        INSERT OR REPLACE INTO student_performance_profiles (
          id, tenant_id, student_id, course_id, overall_mastery,
          learning_velocity, confidence_level, performance_data,
          last_calculated, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        profile.id,
        profile.tenantId,
        profile.studentId,
        profile.courseId,
        profile.overallMastery,
        profile.learningVelocity,
        profile.confidenceLevel,
        JSON.stringify(profile.performanceData),
        profile.lastCalculated,
        profile.createdAt,
        profile.updatedAt
      )
      .run();
  }

  /**
   * Get aggregate class metrics
   */
  public async getClassMetrics(
    tenantId: string,
    courseId: string
  ): Promise<{
    averageMastery: number;
    strugglingConcepts: { conceptId: string; averageMastery: number }[];
    topPerformers: string[];
    needsSupport: string[];
  }> {
    // Get average mastery
    const avgResult = await this.db
      .prepare(`
        SELECT AVG(overall_mastery) as avg_mastery
        FROM student_performance_profiles
        WHERE tenant_id = ? AND course_id = ?
      `)
      .bind(tenantId, courseId)
      .first();

    const averageMastery = Number(avgResult?.avg_mastery) || 0;

    // Get struggling concepts (average mastery < 0.6)
    const strugglingResult = await this.db
      .prepare(`
        SELECT concept_id, AVG(mastery_level) as avg_mastery
        FROM concept_masteries cm
        JOIN student_performance_profiles spp ON cm.profile_id = spp.id
        WHERE spp.tenant_id = ? AND spp.course_id = ?
        GROUP BY concept_id
        HAVING avg_mastery < 0.6
      `)
      .bind(tenantId, courseId)
      .all();

    const strugglingConcepts = strugglingResult.results.map(r => ({
      conceptId: r.concept_id as string,
      averageMastery: Number(r.avg_mastery) || 0
    }));

    // Get top performers and those needing support
    const studentsResult = await this.db
      .prepare(`
        SELECT student_id, overall_mastery
        FROM student_performance_profiles
        WHERE tenant_id = ? AND course_id = ?
        ORDER BY overall_mastery DESC
      `)
      .bind(tenantId, courseId)
      .all();

    const topPerformers = studentsResult.results
      .filter(s => Number(s.overall_mastery) >= 0.9)
      .map(s => s.student_id as string);

    const needsSupport = studentsResult.results
      .filter(s => Number(s.overall_mastery) < 0.6)
      .map(s => s.student_id as string);

    return {
      averageMastery,
      strugglingConcepts,
      topPerformers,
      needsSupport
    };
  }
}