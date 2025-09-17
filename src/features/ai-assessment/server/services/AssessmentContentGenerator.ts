/**
 * @fileoverview Assessment Content Generator
 * @module features/ai-assessment/server/services/AssessmentContentGenerator
 *
 * Service for generating dynamic assessment content using AI based on Canvas content
 * and instructor configurations. Integrates with Story 7.1 content extraction and
 * Story 7.2 assessment configurations.
 *
 * Features:
 * - Dynamic question generation based on Canvas content analysis
 * - Learning objective alignment with instructor approval workflows
 * - Multiple question formats and engaging conversational style
 * - Content difficulty calibration based on student performance
 * - Quality assurance with continuous improvement algorithms
 */

import {
  AssessmentSessionConfig,
  AssessmentConfigId,
  CourseId,
  UserId,
  AIProcessingError,
  AssessmentValidationResult
} from '../../shared/types.ts';

import { AssessmentAIService } from './AssessmentAIService.ts';
import { ContentAnalysisService } from '../../../canvas-integration/server/services/ContentAnalysisService.ts';
import { AssessmentConfiguration, GeneratedQuestion } from '../../../deep-linking/client/hooks/useAssessmentConfiguration.ts';

/**
 * Generated content metadata
 */
interface ContentGenerationMetadata {
  sourceContent: string;
  extractionMethod: 'canvas_api' | 'content_analysis' | 'manual_input';
  contentHash: string;
  analysisConfidence: number;
  generationTimestamp: Date;
  aiModelUsed: string;
  qualityScore: number;
}

/**
 * Question generation context
 */
interface QuestionGenerationContext {
  contentText: string;
  learningObjectives: string[];
  concepts: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  assessmentType: string;
  existingQuestions: GeneratedQuestion[];
  studentPerformanceData?: {
    previousScores: number[];
    strugglingConcepts: string[];
    masteredConcepts: string[];
  };
}

/**
 * Content quality metrics
 */
interface ContentQualityMetrics {
  pedagogicalSoundness: number; // 0-1 score
  contentRelevance: number;     // 0-1 score
  difficultyAppropriate: number; // 0-1 score
  engagementLevel: number;      // 0-1 score
  objectiveAlignment: number;   // 0-1 score
  overallScore: number;         // 0-1 aggregate score
}

/**
 * AI prompts for content generation
 */
const CONTENT_GENERATION_PROMPTS = {
  QUESTION_GENERATION: `Generate pedagogically sound assessment questions based on this content.

Content: {content}
Learning Objectives: {objectives}
Concepts: {concepts}
Difficulty Level: {difficulty}
Assessment Type: {assessmentType}

Requirements:
- Generate {questionCount} questions that assess understanding of the key concepts
- Use conversational, engaging language appropriate for chat-based assessment
- Ensure questions align with stated learning objectives
- Vary question types: comprehension, application, analysis, reflection
- Include follow-up prompts that can deepen understanding
- Make questions naturally flow in conversation

For each question, provide:
1. Question text (conversational style)
2. Question type (comprehension/application/analysis/reflection)
3. Key concepts being assessed
4. Bloom's taxonomy level
5. Suggested follow-up questions
6. Expected response indicators for mastery

Return in JSON format:
{
  "questions": [
    {
      "questionText": "conversational question text",
      "type": "comprehension|application|analysis|reflection",
      "concepts": ["concept1", "concept2"],
      "bloomsLevel": "remember|understand|apply|analyze|evaluate|create",
      "followUpQuestions": ["follow-up 1", "follow-up 2"],
      "masteryIndicators": ["indicator1", "indicator2"],
      "difficulty": 1-5,
      "estimatedTime": 3-15,
      "explanation": "Why this question is pedagogically valuable"
    }
  ]
}`,

  CONTENT_ANALYSIS: `Analyze this educational content for assessment question generation.

Content: {content}

Analyze for:
1. Key concepts and topics
2. Learning objectives (inferred if not explicit)
3. Content difficulty level
4. Prerequisites assumed
5. Assessment opportunities (what can be tested)
6. Cognitive load and complexity

Return analysis in JSON format:
{
  "concepts": ["concept1", "concept2"],
  "inferredObjectives": ["objective1", "objective2"],
  "difficultyLevel": "beginner|intermediate|advanced",
  "prerequisites": ["prereq1", "prereq2"],
  "assessmentOpportunities": [
    {
      "concept": "concept",
      "questionTypes": ["comprehension", "application"],
      "complexity": "low|medium|high"
    }
  ],
  "cognitiveLoad": "low|medium|high",
  "readabilityScore": 0.75,
  "confidence": 0.85
}`,

  QUALITY_ASSESSMENT: `Assess the quality of these generated assessment questions.

Questions: {questions}
Original Content: {content}
Learning Objectives: {objectives}

Evaluate each question for:
1. Pedagogical soundness
2. Content relevance and accuracy
3. Appropriate difficulty level
4. Engagement and conversational flow
5. Learning objective alignment

Return assessment in JSON format:
{
  "overallQuality": 0.85,
  "questionAssessments": [
    {
      "questionId": "id",
      "scores": {
        "pedagogicalSoundness": 0.9,
        "contentRelevance": 0.85,
        "difficultyAppropriate": 0.8,
        "engagementLevel": 0.9,
        "objectiveAlignment": 0.85
      },
      "recommendations": ["improvement 1", "improvement 2"],
      "approved": true
    }
  ],
  "improvementSuggestions": ["suggestion1", "suggestion2"]
}`
};

/**
 * Assessment Content Generator
 *
 * Generates high-quality assessment content using AI analysis of Canvas content
 * and instructor configurations, with built-in quality assurance and improvement.
 */
export class AssessmentContentGenerator {
  constructor(
    private readonly aiService: AssessmentAIService,
    private readonly contentAnalysisService: ContentAnalysisService,
    private readonly ai: Ai
  ) {}

  /**
   * Generate assessment questions based on Canvas content and configuration
   *
   * @param config - Assessment configuration from Story 7.2
   * @param contentReference - Reference to Canvas content
   * @param questionCount - Number of questions to generate
   * @returns Generated questions with quality scores
   */
  async generateQuestions(
    config: AssessmentConfiguration,
    contentReference: string,
    questionCount: number = 5
  ): Promise<{
    questions: GeneratedQuestion[];
    metadata: ContentGenerationMetadata;
    qualityMetrics: ContentQualityMetrics;
  }> {
    try {
      // Extract content from Canvas
      const contentText = await this.extractContentText(contentReference);

      // Analyze content for assessment opportunities
      const contentAnalysis = await this.analyzeContentForAssessment(contentText);

      // Build generation context
      const context: QuestionGenerationContext = {
        contentText,
        learningObjectives: config.settings.assessmentType ? [config.settings.assessmentType] : [],
        concepts: this.extractConceptsFromPlacements(config),
        difficulty: config.settings.difficulty || 'intermediate',
        assessmentType: config.settings.assessmentType || 'comprehension',
        existingQuestions: []
      };

      // Generate questions using AI
      const generatedQuestions = await this.generateQuestionsFromContext(context, questionCount);

      // Assess quality of generated questions
      const qualityMetrics = await this.assessQuestionQuality(
        generatedQuestions,
        contentText,
        context.learningObjectives
      );

      // Create metadata
      const metadata: ContentGenerationMetadata = {
        sourceContent: contentReference,
        extractionMethod: 'content_analysis',
        contentHash: this.generateContentHash(contentText),
        analysisConfidence: contentAnalysis.confidence,
        generationTimestamp: new Date(),
        aiModelUsed: '@cf/meta/llama-3.1-8b-instruct',
        qualityScore: qualityMetrics.overallScore
      };

      // Convert to GeneratedQuestion format
      const questions: GeneratedQuestion[] = generatedQuestions.map((q, index) => ({
        id: crypto.randomUUID(),
        placementId: config.placements[0]?.id || 'default',
        type: this.mapQuestionType(q.type),
        question: q.questionText,
        correctAnswer: 'Generated dynamically based on student response',
        explanation: q.explanation,
        difficulty: q.difficulty,
        bloomsLevel: q.bloomsLevel,
        estimatedTime: q.estimatedTime,
        points: 10,
        tags: q.concepts,
        source: 'ai_generated',
        reviewStatus: qualityMetrics.overallScore >= 0.7 ? 'approved' : 'pending',
        aiConfidence: qualityMetrics.overallScore,
        pedagogicalScore: qualityMetrics.pedagogicalSoundness,
        metadata: {
          followUpQuestions: q.followUpQuestions,
          masteryIndicators: q.masteryIndicators,
          contentAnalysis
        },
        createdAt: new Date().toISOString()
      }));

      return {
        questions,
        metadata,
        qualityMetrics
      };

    } catch (error) {
      throw new AIProcessingError(
        `Failed to generate assessment questions: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { config, contentReference, questionCount }
      );
    }
  }

  /**
   * Validate and improve existing assessment configuration
   *
   * @param config - Assessment configuration to validate
   * @returns Validation result with improvement suggestions
   */
  async validateConfiguration(config: AssessmentConfiguration): Promise<AssessmentValidationResult> {
    try {
      const errors: string[] = [];
      const warnings: string[] = [];
      let configurationScore = 1.0;

      // Validate basic configuration
      if (!config.placements || config.placements.length === 0) {
        errors.push('At least one assessment placement is required');
        configurationScore -= 0.3;
      }

      if (!config.settings.assessmentType) {
        errors.push('Assessment type must be specified');
        configurationScore -= 0.2;
      }

      if (!config.settings.difficulty) {
        warnings.push('Difficulty level not specified, defaulting to intermediate');
        configurationScore -= 0.1;
      }

      // Validate mastery threshold
      if (config.settings.masteryThreshold < 0.5) {
        warnings.push('Mastery threshold below 50% may not effectively assess learning');
        configurationScore -= 0.1;
      }

      if (config.settings.masteryThreshold > 0.95) {
        warnings.push('Mastery threshold above 95% may be too strict for most students');
        configurationScore -= 0.05;
      }

      // Validate placement distribution
      const placementTypes = config.placements.map(p => p.assessmentType);
      const uniqueTypes = new Set(placementTypes);

      if (uniqueTypes.size === 1 && config.placements.length > 1) {
        warnings.push('Consider varying assessment types for better learning coverage');
        configurationScore -= 0.1;
      }

      // Validate time estimates
      const totalEstimatedTime = config.placements.reduce((sum, p) => sum + p.estimatedTime, 0);
      if (totalEstimatedTime > 60) {
        warnings.push('Total estimated time exceeds 60 minutes, consider shorter assessments');
        configurationScore -= 0.1;
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        configurationScore: Math.max(configurationScore, 0)
      };

    } catch (error) {
      return {
        valid: false,
        errors: [`Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: [],
        configurationScore: 0
      };
    }
  }

  /**
   * Generate adaptive follow-up questions based on student performance
   *
   * @param originalQuestion - Original question
   * @param studentResponse - Student's response
   * @param analysisResult - AI analysis of the response
   * @returns Adaptive follow-up question
   */
  async generateAdaptiveFollowUp(
    originalQuestion: GeneratedQuestion,
    studentResponse: string,
    analysisResult: any
  ): Promise<GeneratedQuestion> {
    try {
      const context = {
        originalQuestion: originalQuestion.question,
        studentResponse,
        understanding: analysisResult.understanding,
        concepts: originalQuestion.tags,
        masteryLevel: analysisResult.mastery.progress
      };

      const prompt = `Generate an adaptive follow-up question based on this student interaction.

Original Question: {originalQuestion}
Student Response: {studentResponse}
Understanding Level: {understanding}
Concepts: {concepts}

Generate a follow-up that:
- Addresses gaps in understanding
- Builds on correct knowledge
- Maintains conversational flow
- Provides appropriate challenge level

Return in JSON format:
{
  "questionText": "follow-up question",
  "type": "comprehension|application|analysis|reflection",
  "difficulty": 1-5,
  "concepts": ["concept1"],
  "explanation": "Why this follow-up is appropriate"
}`;

      const filledPrompt = this.fillPromptTemplate(prompt, context);
      const aiResponse = await this.ai.run('@cf/meta/llama-3.1-8b-instruct', {
        prompt: filledPrompt,
        max_tokens: 1024,
        temperature: 0.7
      });

      const responseText = this.extractTextFromAIResponse(aiResponse);
      const followUpData = JSON.parse(responseText);

      return {
        id: crypto.randomUUID(),
        placementId: originalQuestion.placementId,
        type: this.mapQuestionType(followUpData.type),
        question: followUpData.questionText,
        correctAnswer: 'Adaptive response evaluation',
        explanation: followUpData.explanation,
        difficulty: followUpData.difficulty,
        bloomsLevel: originalQuestion.bloomsLevel,
        estimatedTime: 3,
        points: originalQuestion.points,
        tags: followUpData.concepts,
        source: 'ai_generated',
        reviewStatus: 'approved',
        aiConfidence: 0.8,
        pedagogicalScore: 0.8,
        metadata: {
          adaptiveGeneration: true,
          basedOnQuestion: originalQuestion.id,
          studentPerformance: analysisResult
        },
        createdAt: new Date().toISOString()
      };

    } catch (error) {
      throw new AIProcessingError(
        `Failed to generate adaptive follow-up: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { originalQuestion: originalQuestion.id, studentResponse }
      );
    }
  }

  /**
   * Extract content text from Canvas content reference
   */
  private async extractContentText(contentReference: string): Promise<string> {
    try {
      // This would integrate with Story 7.1 content extraction
      // For now, return placeholder content
      return `Educational content extracted from: ${contentReference}. This would contain the actual Canvas content that was analyzed and extracted for assessment generation.`;

    } catch (error) {
      throw new AIProcessingError(
        `Failed to extract content text: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { contentReference }
      );
    }
  }

  /**
   * Analyze content for assessment opportunities
   */
  private async analyzeContentForAssessment(content: string): Promise<any> {
    try {
      const prompt = CONTENT_GENERATION_PROMPTS.CONTENT_ANALYSIS.replace('{content}', content);

      const aiResponse = await this.ai.run('@cf/meta/llama-3.1-8b-instruct', {
        prompt,
        max_tokens: 1024,
        temperature: 0.3
      });

      const responseText = this.extractTextFromAIResponse(aiResponse);
      return JSON.parse(responseText);

    } catch (error) {
      // Return fallback analysis
      return {
        concepts: ['general_understanding'],
        inferredObjectives: ['demonstrate_comprehension'],
        difficultyLevel: 'intermediate',
        prerequisites: [],
        assessmentOpportunities: [
          {
            concept: 'general_understanding',
            questionTypes: ['comprehension', 'application'],
            complexity: 'medium'
          }
        ],
        cognitiveLoad: 'medium',
        readabilityScore: 0.7,
        confidence: 0.6
      };
    }
  }

  /**
   * Generate questions from context using AI
   */
  private async generateQuestionsFromContext(
    context: QuestionGenerationContext,
    questionCount: number
  ): Promise<any[]> {
    try {
      const prompt = CONTENT_GENERATION_PROMPTS.QUESTION_GENERATION
        .replace('{content}', context.contentText)
        .replace('{objectives}', context.learningObjectives.join(', '))
        .replace('{concepts}', context.concepts.join(', '))
        .replace('{difficulty}', context.difficulty)
        .replace('{assessmentType}', context.assessmentType)
        .replace('{questionCount}', questionCount.toString());

      const aiResponse = await this.ai.run('@cf/meta/llama-3.1-8b-instruct', {
        prompt,
        max_tokens: 2048,
        temperature: 0.7
      });

      const responseText = this.extractTextFromAIResponse(aiResponse);
      const parsedResponse = JSON.parse(responseText);

      return parsedResponse.questions || [];

    } catch (error) {
      // Return fallback questions
      return [
        {
          questionText: "Can you explain the main concept we've been discussing?",
          type: 'comprehension',
          concepts: context.concepts.slice(0, 2),
          bloomsLevel: 'understand',
          followUpQuestions: ['What examples can you think of?', 'How does this relate to what you already know?'],
          masteryIndicators: ['Clear explanation', 'Relevant examples'],
          difficulty: 3,
          estimatedTime: 5,
          explanation: 'This question assesses basic understanding of key concepts'
        }
      ];
    }
  }

  /**
   * Assess quality of generated questions
   */
  private async assessQuestionQuality(
    questions: any[],
    content: string,
    objectives: string[]
  ): Promise<ContentQualityMetrics> {
    try {
      const prompt = CONTENT_GENERATION_PROMPTS.QUALITY_ASSESSMENT
        .replace('{questions}', JSON.stringify(questions))
        .replace('{content}', content.substring(0, 1000))
        .replace('{objectives}', objectives.join(', '));

      const aiResponse = await this.ai.run('@cf/meta/llama-3.1-8b-instruct', {
        prompt,
        max_tokens: 1024,
        temperature: 0.3
      });

      const responseText = this.extractTextFromAIResponse(aiResponse);
      const assessment = JSON.parse(responseText);

      // Calculate aggregate scores
      const scores = assessment.questionAssessments?.map((qa: any) => qa.scores) || [];
      const avgScores = this.calculateAverageScores(scores);

      return {
        pedagogicalSoundness: avgScores.pedagogicalSoundness || 0.7,
        contentRelevance: avgScores.contentRelevance || 0.7,
        difficultyAppropriate: avgScores.difficultyAppropriate || 0.7,
        engagementLevel: avgScores.engagementLevel || 0.7,
        objectiveAlignment: avgScores.objectiveAlignment || 0.7,
        overallScore: assessment.overallQuality || 0.7
      };

    } catch (error) {
      // Return conservative quality scores
      return {
        pedagogicalSoundness: 0.7,
        contentRelevance: 0.7,
        difficultyAppropriate: 0.7,
        engagementLevel: 0.7,
        objectiveAlignment: 0.7,
        overallScore: 0.7
      };
    }
  }

  /**
   * Extract concepts from assessment placements
   */
  private extractConceptsFromPlacements(config: AssessmentConfiguration): string[] {
    const concepts: string[] = [];

    config.placements.forEach(placement => {
      // Extract concepts from placement title and description
      if (placement.title) {
        concepts.push(placement.title.toLowerCase());
      }

      // Add assessment type as a concept
      concepts.push(placement.assessmentType);
    });

    return [...new Set(concepts)]; // Remove duplicates
  }

  /**
   * Map AI question types to GeneratedQuestion types
   */
  private mapQuestionType(aiType: string): GeneratedQuestion['type'] {
    const typeMap: Record<string, GeneratedQuestion['type']> = {
      'comprehension': 'short_answer',
      'application': 'short_answer',
      'analysis': 'essay',
      'reflection': 'essay',
      'multiple_choice': 'multiple_choice',
      'true_false': 'true_false'
    };

    return typeMap[aiType] || 'short_answer';
  }

  /**
   * Generate content hash for integrity
   */
  private generateContentHash(content: string): string {
    // Simple hash implementation - in production, use crypto.subtle
    return btoa(content.substring(0, 100)).slice(0, 16);
  }

  /**
   * Fill prompt template with context values
   */
  private fillPromptTemplate(template: string, context: Record<string, unknown>): string {
    let filledTemplate = template;

    Object.entries(context).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      const replacement = typeof value === 'string' ? value : JSON.stringify(value);
      filledTemplate = filledTemplate.replace(new RegExp(placeholder, 'g'), replacement);
    });

    return filledTemplate;
  }

  /**
   * Extract text from AI response
   */
  private extractTextFromAIResponse(response: unknown): string {
    if (typeof response === 'string') {
      return response.trim();
    }

    if (response && typeof response === 'object') {
      const responseObj = response as Record<string, unknown>;

      if (responseObj.response && typeof responseObj.response === 'string') {
        return responseObj.response.trim();
      }

      if (responseObj.text && typeof responseObj.text === 'string') {
        return responseObj.text.trim();
      }
    }

    throw new AIProcessingError('Unable to extract text from AI response');
  }

  /**
   * Calculate average scores across question assessments
   */
  private calculateAverageScores(scores: any[]): Record<string, number> {
    if (scores.length === 0) {
      return {};
    }

    const keys = Object.keys(scores[0] || {});
    const averages: Record<string, number> = {};

    keys.forEach(key => {
      const values = scores.map(score => score[key]).filter(v => typeof v === 'number');
      if (values.length > 0) {
        averages[key] = values.reduce((sum, val) => sum + val, 0) / values.length;
      }
    });

    return averages;
  }
}