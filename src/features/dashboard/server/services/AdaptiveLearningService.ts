/**
 * @fileoverview Adaptive learning recommendation service with rule-based algorithms
 * @module features/dashboard/server/services/AdaptiveLearningService
 */

import { z } from 'zod';
import type { D1Database, Ai } from '@cloudflare/workers-types';
import { 
  StudentPerformanceProfile, 
  ConceptMastery, 
  LearningRecommendation,
  StrugglePattern 
} from './PerformanceAnalyticsService';

/**
 * Schema for learning style preferences
 */
export const LearningStyleSchema = z.object({
  id: z.string(),
  learnerId: z.string(),
  styleType: z.enum(['visual', 'auditory', 'kinesthetic', 'reading_writing']),
  confidenceScore: z.number().min(0).max(1),
  detectedPatterns: z.record(z.unknown()),
  manualOverride: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type LearningStyle = z.infer<typeof LearningStyleSchema>;

/**
 * Schema for content recommendation
 */
export const ContentRecommendationSchema = z.object({
  contentId: z.string(),
  contentType: z.enum(['reading', 'video', 'practice', 'assessment', 'interactive']),
  title: z.string(),
  description: z.string(),
  difficulty: z.number().min(0).max(1),
  estimatedTime: z.number().int().min(0),
  matchScore: z.number().min(0).max(1),
  matchReasons: z.array(z.string()),
  prerequisites: z.array(z.string()).default([]),
  learningObjectives: z.array(z.string()).default([]),
});

export type ContentRecommendation = z.infer<typeof ContentRecommendationSchema>;

/**
 * Schema for adaptive learning parameters
 */
export const AdaptiveLearningParamsSchema = z.object({
  studentId: z.string(),
  courseId: z.string(),
  currentMastery: z.number().min(0).max(1),
  learningVelocity: z.number().min(0),
  confidenceLevel: z.number().min(0).max(1),
  strugglingConcepts: z.array(z.string()),
  strongConcepts: z.array(z.string()),
  learningStyle: z.string().optional(),
  timeAvailable: z.number().int().min(0).optional(), // Minutes
  difficultyPreference: z.enum(['easy', 'moderate', 'challenging']).default('moderate'),
  goalType: z.enum(['mastery', 'completion', 'exploration']).default('mastery'),
});

export type AdaptiveLearningParams = z.infer<typeof AdaptiveLearningParamsSchema>;

/**
 * Schema for recommendation scoring weights
 */
export const RecommendationWeightsSchema = z.object({
  masteryGap: z.number().min(0).max(1).default(0.3),
  learningVelocity: z.number().min(0).max(1).default(0.2),
  confidenceLevel: z.number().min(0).max(1).default(0.15),
  strugglingPattern: z.number().min(0).max(1).default(0.25),
  learningStyle: z.number().min(0).max(1).default(0.1),
});

export type RecommendationWeights = z.infer<typeof RecommendationWeightsSchema>;

/**
 * Adaptive learning service providing personalized learning recommendations
 * 
 * Uses rule-based algorithms to analyze student performance, learning patterns,
 * and preferences to generate targeted learning recommendations. Supports
 * optional AI enhancement for recommendation ranking and personalization.
 * 
 * @class AdaptiveLearningService
 */
export class AdaptiveLearningService {
  // Default recommendation weights for different learning scenarios
  private static readonly DEFAULT_WEIGHTS: Record<string, RecommendationWeights> = {
    struggling: {
      masteryGap: 0.4,
      learningVelocity: 0.1,
      confidenceLevel: 0.3,
      strugglingPattern: 0.2,
      learningStyle: 0.0,
    },
    advanced: {
      masteryGap: 0.2,
      learningVelocity: 0.3,
      confidenceLevel: 0.1,
      strugglingPattern: 0.1,
      learningStyle: 0.3,
    },
    balanced: {
      masteryGap: 0.25,
      learningVelocity: 0.2,
      confidenceLevel: 0.2,
      strugglingPattern: 0.2,
      learningStyle: 0.15,
    },
  };

  constructor(
    private readonly db: D1Database,
    private readonly ai: Ai,
    private readonly tenantId: string,
    private readonly useAiEnhancement: boolean = false
  ) {}

  /**
   * Generate adaptive learning recommendations for a student
   * 
   * @param paramsOrProfile - Adaptive learning parameters or student performance profile
   * @param options - Additional options for recommendation generation
   * @returns Promise resolving to array of learning recommendations
   */
  public async generateAdaptiveRecommendations(
    paramsOrProfile: AdaptiveLearningParams | StudentPerformanceProfile,
    options?: { useAI?: boolean }
  ): Promise<LearningRecommendation[]> {
    // Convert profile to params if needed
    let params: AdaptiveLearningParams;
    
    if ('overallMastery' in paramsOrProfile) {
      // It's a StudentPerformanceProfile
      const profile = paramsOrProfile as StudentPerformanceProfile;
      const strugglingConcepts: string[] = [];
      const strongConcepts: string[] = [];
      
      profile.conceptMasteries.forEach((mastery, conceptId) => {
        if (mastery.masteryLevel < 0.5) {
          strugglingConcepts.push(conceptId);
        } else if (mastery.masteryLevel > 0.8) {
          strongConcepts.push(conceptId);
        }
      });
      
      params = {
        studentId: profile.studentId,
        courseId: profile.courseId,
        currentMastery: profile.overallMastery,
        learningVelocity: profile.learningVelocity,
        confidenceLevel: profile.confidenceLevel,
        strugglingConcepts,
        strongConcepts,
        difficultyPreference: 'moderate',
        goalType: 'mastery'
      };
    } else {
      params = paramsOrProfile as AdaptiveLearningParams;
    }
    
    const validatedParams = AdaptiveLearningParamsSchema.parse(params);
    
    // Get student performance context
    const context = await this.getStudentLearningContext(
      validatedParams.studentId,
      validatedParams.courseId
    );

    // Determine recommendation strategy based on student state
    const strategy = this.determineRecommendationStrategy(context);
    const weights = AdaptiveLearningService.DEFAULT_WEIGHTS[strategy];

    // Generate rule-based recommendations
    const ruleBasedRecommendations = await this.generateRuleBasedRecommendations(
      validatedParams,
      context,
      weights
    );

    // Optionally enhance with AI ranking
    const recommendations = this.useAiEnhancement
      ? await this.enhanceRecommendationsWithAI(ruleBasedRecommendations, context)
      : ruleBasedRecommendations;

    // Apply time constraints if specified
    if (validatedParams.timeAvailable) {
      return this.filterRecommendationsByTime(
        recommendations,
        validatedParams.timeAvailable
      );
    }

    return recommendations;
  }

  /**
   * Get comprehensive learning context for a student
   */
  private async getStudentLearningContext(
    studentId: string,
    courseId: string
  ): Promise<{
    profile: StudentPerformanceProfile | null;
    conceptMasteries: ConceptMastery[];
    recentStrugglePatterns: StrugglePattern[];
    learningStyle: LearningStyle | null;
    availableContent: ContentRecommendation[];
    prerequisiteMap: Map<string, string[]>;
  }> {
    // Get performance profile
    const profileResult = await this.db
      .prepare(`
        SELECT * FROM student_performance_profiles 
        WHERE tenant_id = ? AND student_id = ? AND course_id = ?
      `)
      .bind(this.tenantId, studentId, courseId)
      .first();

    const profile = profileResult ? {
      ...profileResult,
      performanceData: JSON.parse(profileResult.performance_data as string),
    } as StudentPerformanceProfile : null;

    // Get concept masteries
    const conceptMasteriesResult = profile
      ? await this.db
          .prepare('SELECT * FROM concept_masteries WHERE profile_id = ?')
          .bind(profile.id)
          .all()
      : { results: [] };

    const conceptMasteries = conceptMasteriesResult.results.map(row => ({
      ...row,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastAssessed: row.last_assessed,
    })) as ConceptMastery[];

    // Get recent struggle patterns
    const strugglesResult = await this.db
      .prepare(`
        SELECT * FROM struggle_patterns 
        WHERE tenant_id = ? AND student_id = ? 
          AND detected_at > datetime('now', '-30 days')
          AND (resolved_at IS NULL OR resolved_at > datetime('now', '-7 days'))
        ORDER BY severity DESC, detected_at DESC
      `)
      .bind(this.tenantId, studentId)
      .all();

    const recentStrugglePatterns = strugglesResult.results.map(row => ({
      ...row,
      conceptsInvolved: row.concepts_involved ? JSON.parse(row.concepts_involved as string) : [],
      suggestedInterventions: row.suggested_interventions ? JSON.parse(row.suggested_interventions as string) : [],
      detectedAt: row.detected_at,
      resolvedAt: row.resolved_at || undefined,
      resolutionMethod: row.resolution_method || undefined,
    })) as StrugglePattern[];

    // Get learning style
    const learningStyleResult = await this.db
      .prepare('SELECT * FROM learning_styles WHERE learner_id = ?')
      .bind(studentId)
      .first();

    const learningStyle = learningStyleResult ? {
      ...learningStyleResult,
      detectedPatterns: JSON.parse(learningStyleResult.detected_patterns as string),
      createdAt: learningStyleResult.created_at,
      updatedAt: learningStyleResult.updated_at,
    } as LearningStyle : null;

    // Get available content with analysis
    const availableContent = await this.getAvailableContent(courseId);

    // Build prerequisite map
    const prerequisiteMap = await this.buildPrerequisiteMap(courseId);

    return {
      profile,
      conceptMasteries,
      recentStrugglePatterns,
      learningStyle,
      availableContent,
      prerequisiteMap,
    };
  }

  /**
   * Determine recommendation strategy based on student performance
   */
  private determineRecommendationStrategy(context: {
    profile: StudentPerformanceProfile | null;
    conceptMasteries: ConceptMastery[];
    recentStrugglePatterns: StrugglePattern[];
  }): string {
    if (!context.profile) return 'balanced';

    const overallMastery = context.profile.overallMastery;
    const strugglingConcepts = context.conceptMasteries.filter(cm => cm.masteryLevel < 0.6).length;
    const recentStruggles = context.recentStrugglePatterns.length;

    // Struggling student strategy
    if (overallMastery < 0.5 || strugglingConcepts > 3 || recentStruggles > 2) {
      return 'struggling';
    }

    // Advanced student strategy
    if (overallMastery > 0.8 && strugglingConcepts < 2 && recentStruggles === 0) {
      return 'advanced';
    }

    // Default balanced strategy
    return 'balanced';
  }

  /**
   * Generate rule-based recommendations using learning analytics
   */
  private async generateRuleBasedRecommendations(
    params: AdaptiveLearningParams,
    context: any,
    weights: RecommendationWeights
  ): Promise<LearningRecommendation[]> {
    const recommendations: LearningRecommendation[] = [];

    // Rule 1: Address knowledge gaps (mastery < 0.7)
    const knowledgeGapRecommendations = await this.generateKnowledgeGapRecommendations(
      context,
      params,
      weights.masteryGap
    );
    recommendations.push(...knowledgeGapRecommendations);

    // Rule 2: Build on strong concepts for advancement
    const advancementRecommendations = await this.generateAdvancementRecommendations(
      context,
      params,
      weights.learningVelocity
    );
    recommendations.push(...advancementRecommendations);

    // Rule 3: Address confidence issues
    const confidenceRecommendations = await this.generateConfidenceRecommendations(
      context,
      params,
      weights.confidenceLevel
    );
    recommendations.push(...confidenceRecommendations);

    // Rule 4: Resolve struggle patterns
    const struggleRecommendations = await this.generateStruggleRecommendations(
      context,
      params,
      weights.strugglingPattern
    );
    recommendations.push(...struggleRecommendations);

    // Rule 5: Learning style optimization
    const styleRecommendations = await this.generateLearningStyleRecommendations(
      context,
      params,
      weights.learningStyle
    );
    recommendations.push(...styleRecommendations);

    // Sort by calculated priority scores
    return this.rankRecommendations(recommendations, params);
  }

  /**
   * Generate recommendations for knowledge gaps
   */
  private async generateKnowledgeGapRecommendations(
    context: any,
    _params: AdaptiveLearningParams,
    _weight: number
  ): Promise<LearningRecommendation[]> {
    const recommendations: LearningRecommendation[] = [];
    const lowMasteryConcepts = context.conceptMasteries
      .filter((cm: ConceptMastery) => cm.masteryLevel < 0.7)
      .sort((a: ConceptMastery, b: ConceptMastery) => a.masteryLevel - b.masteryLevel);

    for (const concept of lowMasteryConcepts.slice(0, 3)) {
      const prerequisites = context.prerequisiteMap.get(concept.conceptId) || [];
      const unmetPrerequisites = prerequisites.filter(prereq => {
        const prereqMastery = context.conceptMasteries.find((cm: ConceptMastery) => 
          cm.conceptId === prereq
        );
        return !prereqMastery || prereqMastery.masteryLevel < 0.8;
      });

      // If prerequisites are unmet, recommend those first
      const targetConcepts = unmetPrerequisites.length > 0 ? unmetPrerequisites : [concept.conceptId];

      recommendations.push({
        id: crypto.randomUUID(),
        profileId: context.profile?.id || '',
        recommendationType: 'review',
        priority: concept.masteryLevel < 0.4 ? 'high' : 'medium',
        conceptsInvolved: targetConcepts,
        suggestedActions: [
          `Review fundamental concepts for ${concept.conceptName}`,
          'Complete prerequisite practice exercises',
          'Watch explanatory videos',
          'Take diagnostic assessment'
        ],
        estimatedTimeMinutes: Math.ceil((0.8 - concept.masteryLevel) * 60),
        contentReferences: await this.findRelevantContent(targetConcepts, 'review'),
        reasoning: `Mastery gap identified: ${Math.round(concept.masteryLevel * 100)}% current vs 80% target`,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    return recommendations;
  }

  /**
   * Generate advancement recommendations for strong concepts
   */
  private async generateAdvancementRecommendations(
    context: any,
    _params: AdaptiveLearningParams,
    _weight: number
  ): Promise<LearningRecommendation[]> {
    const recommendations: LearningRecommendation[] = [];
    const strongConcepts = context.conceptMasteries
      .filter((cm: ConceptMastery) => 
        cm.masteryLevel >= 0.8 && cm.improvementTrend === 'improving'
      )
      .sort((a: ConceptMastery, b: ConceptMastery) => b.masteryLevel - a.masteryLevel);

    for (const concept of strongConcepts.slice(0, 2)) {
      // Find concepts that build upon this strong concept
      const advancedConcepts = await this.findAdvancedConcepts(concept.conceptId);

      if (advancedConcepts.length > 0) {
        recommendations.push({
          id: crypto.randomUUID(),
          profileId: context.profile?.id || '',
          recommendationType: 'advance',
          priority: 'medium',
          conceptsInvolved: advancedConcepts,
          suggestedActions: [
            `Explore advanced applications of ${concept.conceptName}`,
            'Complete challenge problems',
            'Begin advanced topic sequence',
            'Consider peer tutoring opportunities'
          ],
          estimatedTimeMinutes: 45,
          contentReferences: await this.findRelevantContent(advancedConcepts, 'advance'),
          reasoning: `Strong mastery in ${concept.conceptName} (${Math.round(concept.masteryLevel * 100)}%) suggests readiness for advancement`,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }
    }

    return recommendations;
  }

  /**
   * Generate confidence building recommendations
   */
  private async generateConfidenceRecommendations(
    context: any,
    params: AdaptiveLearningParams,
    _weight: number
  ): Promise<LearningRecommendation[]> {
    const recommendations: LearningRecommendation[] = [];

    if (params.confidenceLevel < 0.4) {
      recommendations.push({
        id: crypto.randomUUID(),
        profileId: context.profile?.id || '',
        recommendationType: 'practice',
        priority: 'high',
        conceptsInvolved: ['confidence_building'],
        suggestedActions: [
          'Start with easier practice problems to build confidence',
          'Use self-assessment tools',
          'Join study groups for peer support',
          'Practice time management techniques',
          'Break complex problems into smaller steps'
        ],
        estimatedTimeMinutes: 30,
        contentReferences: [],
        reasoning: `Low confidence level (${Math.round(params.confidenceLevel * 100)}%) may be impacting learning effectiveness`,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    return recommendations;
  }

  /**
   * Generate recommendations to address struggle patterns
   */
  private async generateStruggleRecommendations(
    context: any,
    _params: AdaptiveLearningParams,
    _weight: number
  ): Promise<LearningRecommendation[]> {
    const recommendations: LearningRecommendation[] = [];

    for (const pattern of context.recentStrugglePatterns.slice(0, 2)) {
      const recommendationType = this.mapPatternToRecommendationType(pattern.patternType);
      
      recommendations.push({
        id: crypto.randomUUID(),
        profileId: context.profile?.id || '',
        recommendationType,
        priority: pattern.severity > 0.7 ? 'high' : 'medium',
        conceptsInvolved: pattern.conceptsInvolved,
        suggestedActions: pattern.suggestedInterventions,
        estimatedTimeMinutes: Math.ceil(pattern.severity * 60),
        contentReferences: await this.findRelevantContent(
          pattern.conceptsInvolved, 
          recommendationType
        ),
        reasoning: `Addressing ${pattern.patternType} pattern with ${Math.round(pattern.severity * 100)}% severity`,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    return recommendations;
  }

  /**
   * Generate learning style optimized recommendations
   */
  private async generateLearningStyleRecommendations(
    context: any,
    params: AdaptiveLearningParams,
    weight: number
  ): Promise<LearningRecommendation[]> {
    const recommendations: LearningRecommendation[] = [];

    if (context.learningStyle && weight > 0) {
      const styleType = context.learningStyle.styleType;
      const optimizedContent = context.availableContent
        .filter((content: ContentRecommendation) => 
          this.isContentSuitableForLearningStyle(content, styleType)
        )
        .slice(0, 2);

      if (optimizedContent.length > 0) {
        recommendations.push({
          id: crypto.randomUUID(),
          profileId: context.profile?.id || '',
          recommendationType: 'practice',
          priority: 'medium',
          conceptsInvolved: optimizedContent.map((c: ContentRecommendation) => c.contentId),
          suggestedActions: [
            `Engage with ${styleType} learning materials`,
            'Focus on preferred content formats',
            'Use learning style strengths'
          ],
          estimatedTimeMinutes: optimizedContent.reduce(
            (total: number, content: ContentRecommendation) => total + content.estimatedTime, 
            0
          ),
          contentReferences: optimizedContent.map((c: ContentRecommendation) => c.contentId),
          reasoning: `Optimized for ${styleType} learning style preference`,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }
    }

    return recommendations;
  }

  /**
   * Enhance recommendations with AI ranking (optional)
   */
  private async enhanceRecommendationsWithAI(
    recommendations: LearningRecommendation[],
    context: any
  ): Promise<LearningRecommendation[]> {
    if (!this.useAiEnhancement || recommendations.length === 0) {
      return recommendations;
    }

    try {
      // Prepare context for AI analysis
      const aiContext = {
        studentProfile: {
          overallMastery: context.profile?.overallMastery,
          learningVelocity: context.profile?.learningVelocity,
          confidenceLevel: context.profile?.confidenceLevel,
        },
        conceptMasteries: context.conceptMasteries.map((cm: ConceptMastery) => ({
          concept: cm.conceptName,
          mastery: cm.masteryLevel,
          trend: cm.improvementTrend,
        })),
        strugglesIdentified: context.recentStrugglePatterns.map((sp: StrugglePattern) => ({
          type: sp.patternType,
          severity: sp.severity,
          concepts: sp.conceptsInvolved,
        })),
        learningStyle: context.learningStyle?.styleType,
      };

      const prompt = `Based on this student's learning profile, rank these recommendations by effectiveness:

Student Context: ${JSON.stringify(aiContext, null, 2)}

Recommendations: ${JSON.stringify(
        recommendations.map(r => ({
          id: r.id,
          type: r.recommendationType,
          priority: r.priority,
          concepts: r.conceptsInvolved,
          reasoning: r.reasoning,
        })),
        null,
        2
      )}

Please rank these recommendations from most to least effective for this student, considering their learning patterns, struggles, and style. Return a JSON array of recommendation IDs in order of effectiveness.`;

      const aiResponse = await this.ai.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          {
            role: 'system',
            content: 'You are an educational AI that analyzes student learning data to optimize recommendation effectiveness.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // Parse AI response and reorder recommendations
      if (aiResponse?.response) {
        const rankedIds = JSON.parse(aiResponse.response as string);
        const reorderedRecommendations: LearningRecommendation[] = [];
        
        // Add recommendations in AI-suggested order
        for (const id of rankedIds) {
          const rec = recommendations.find(r => r.id === id);
          if (rec) {
            reorderedRecommendations.push(rec);
          }
        }
        
        // Add any missed recommendations at the end
        for (const rec of recommendations) {
          if (!reorderedRecommendations.find(r => r.id === rec.id)) {
            reorderedRecommendations.push(rec);
          }
        }
        
        return reorderedRecommendations;
      }
    } catch (error) {
      console.warn('AI enhancement failed, using rule-based ranking:', error);
    }

    return recommendations;
  }

  /**
   * Rank recommendations by priority and effectiveness
   */
  private rankRecommendations(
    recommendations: LearningRecommendation[],
    _params: AdaptiveLearningParams
  ): LearningRecommendation[] {
    return recommendations.sort((a, b) => {
      // Primary sort: Priority (high > medium > low)
      const priorityScore = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityScore[b.priority] - priorityScore[a.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Secondary sort: Recommendation type relevance
      const typeScore = { review: 3, practice: 2, advance: 1, seek_help: 4 };
      const typeDiff = typeScore[b.recommendationType] - typeScore[a.recommendationType];
      if (typeDiff !== 0) return typeDiff;

      // Tertiary sort: Estimated time (prefer shorter for immediate action)
      const timeA = a.estimatedTimeMinutes || 30;
      const timeB = b.estimatedTimeMinutes || 30;
      return timeA - timeB;
    });
  }

  /**
   * Filter recommendations by available time
   */
  private filterRecommendationsByTime(
    recommendations: LearningRecommendation[],
    timeAvailable: number
  ): LearningRecommendation[] {
    const filtered: LearningRecommendation[] = [];
    let remainingTime = timeAvailable;

    for (const rec of recommendations) {
      const estimatedTime = rec.estimatedTimeMinutes || 30;
      if (estimatedTime <= remainingTime) {
        filtered.push(rec);
        remainingTime -= estimatedTime;
      } else if (filtered.length === 0) {
        // Always include at least one recommendation, even if it exceeds time
        filtered.push(rec);
        break;
      }
    }

    return filtered;
  }

  // Helper methods

  private async getAvailableContent(courseId: string): Promise<ContentRecommendation[]> {
    const result = await this.db
      .prepare(`
        SELECT 
          lc.id as content_id,
          lc.page_type,
          ca.key_concepts,
          ca.difficulty_indicators,
          ca.estimated_reading_time,
          ca.content_complexity
        FROM lms_content lc
        JOIN content_analysis ca ON lc.id = ca.content_id
        JOIN course_content_mapping ccm ON lc.id = ccm.content_id
        WHERE ccm.course_id = ? AND lc.tenant_id = ?
        ORDER BY ca.analysis_confidence DESC
        LIMIT 50
      `)
      .bind(courseId, this.tenantId)
      .all();

    return result.results.map(row => ({
      contentId: row.content_id as string,
      contentType: this.mapPageTypeToContentType(row.page_type as string),
      title: `Content ${row.content_id}`,
      description: 'Learning content',
      difficulty: this.mapComplexityToDifficulty(row.content_complexity as string),
      estimatedTime: Number(row.estimated_reading_time) || 30,
      matchScore: 0.5,
      matchReasons: ['Available content'],
      prerequisites: [],
      learningObjectives: [],
    }));
  }

  private async buildPrerequisiteMap(courseId: string): Promise<Map<string, string[]>> {
    const result = await this.db
      .prepare(`
        SELECT source_concept_id, target_concept_id 
        FROM concept_relationships
        WHERE tenant_id = ? AND course_id = ? 
          AND relationship_type = 'prerequisite'
      `)
      .bind(this.tenantId, courseId)
      .all();

    const map = new Map<string, string[]>();
    for (const row of result.results) {
      const target = row.target_concept_id as string;
      const source = row.source_concept_id as string;
      
      if (!map.has(target)) {
        map.set(target, []);
      }
      map.get(target)!.push(source);
    }

    return map;
  }

  private async findAdvancedConcepts(conceptId: string): Promise<string[]> {
    const result = await this.db
      .prepare(`
        SELECT target_concept_id 
        FROM concept_relationships
        WHERE tenant_id = ? AND source_concept_id = ? 
          AND relationship_type = 'builds_upon'
        ORDER BY strength DESC
        LIMIT 3
      `)
      .bind(this.tenantId, conceptId)
      .all();

    return result.results.map(row => row.target_concept_id as string);
  }

  private async findRelevantContent(
    conceptIds: string[],
    _recommendationType: string
  ): Promise<string[]> {
    if (conceptIds.length === 0) return [];

    const placeholders = conceptIds.map(() => '?').join(',');
    const result = await this.db
      .prepare(`
        SELECT DISTINCT ccm.content_id
        FROM course_content_mapping ccm
        WHERE ccm.content_id IN (${placeholders})
          AND ccm.tenant_id = ?
        LIMIT 5
      `)
      .bind(...conceptIds, this.tenantId)
      .all();

    return result.results.map(row => row.content_id as string);
  }

  private mapPatternToRecommendationType(patternType: string): 'review' | 'practice' | 'advance' | 'seek_help' {
    switch (patternType) {
      case 'knowledge_gap':
        return 'review';
      case 'skill_deficit':
        return 'practice';
      case 'confidence_issue':
        return 'seek_help';
      case 'misconception':
        return 'review';
      default:
        return 'practice';
    }
  }

  private isContentSuitableForLearningStyle(
    content: ContentRecommendation,
    styleType: string
  ): boolean {
    const suitability = {
      visual: ['interactive', 'video'],
      auditory: ['video', 'reading'],
      kinesthetic: ['interactive', 'practice'],
      reading_writing: ['reading', 'practice'],
    };

    return suitability[styleType as keyof typeof suitability]?.includes(content.contentType) || false;
  }

  private mapPageTypeToContentType(pageType: string): ContentRecommendation['contentType'] {
    const mapping = {
      assignment: 'practice',
      quiz: 'assessment',
      page: 'reading',
      discussion: 'interactive',
      module: 'reading',
    };

    return mapping[pageType as keyof typeof mapping] || 'reading';
  }

  private mapComplexityToDifficulty(complexity: string): number {
    const mapping = {
      basic: 0.3,
      intermediate: 0.6,
      advanced: 0.9,
    };

    return mapping[complexity as keyof typeof mapping] || 0.5;
  }
}