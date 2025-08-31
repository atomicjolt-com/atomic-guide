/**
 * @fileoverview AI-powered question generation service for assessments
 * @module features/assessment/server/services/QuestionGenerationService
 */

import { AIService } from '@shared/server/services/AIService';
import type { AssessmentConfig } from '../../shared/schemas/assessment.schema';
import type { Question } from '../../shared/schemas/assessment.schema';

/**
 * Content context for question generation
 */
export interface ContentContext {
  /** Raw content from the LMS page */
  rawContent: string;
  /** Page title */
  title?: string;
  /** Extracted key concepts */
  concepts?: string[];
  /** Learning objectives */
  objectives?: string[];
}

/**
 * Question generation options
 */
export interface QuestionGenerationOptions {
  /** Number of questions to generate */
  count: number;
  /** Question difficulty level (1-5) */
  difficulty: number;
  /** Specific question types to generate */
  questionTypes?: ('multiple_choice' | 'short_answer' | 'essay' | 'true_false')[];
  /** Focus areas for questions */
  focusAreas?: string[];
}

/**
 * Service for generating AI-powered assessment questions
 */
export class QuestionGenerationService {
  constructor(private aiService: AIService) {}

  /**
   * Generates questions based on content context and assessment configuration
   * @param context - Content context from LMS
   * @param config - Assessment configuration
   * @param options - Generation options
   * @returns Promise resolving to generated questions
   */
  async generateQuestions(
    context: ContentContext,
    config: AssessmentConfig,
    options: QuestionGenerationOptions
  ): Promise<Question[]> {
    const prompt = this.buildQuestionPrompt(context, config, options);
    
    try {
      const response = await this.aiService.generateResponse(prompt, {
        maxTokens: 2000,
        temperature: 0.7,
      });

      const questions = this.parseQuestionsFromResponse(response.response);
      return this.validateAndCleanQuestions(questions, config);
    } catch (error) {
      console.error('Failed to generate questions:', error);
      return this.getFallbackQuestions(config, options.count);
    }
  }

  /**
   * Generates questions from specific learning objectives
   * @param objectives - Learning objectives to create questions for
   * @param config - Assessment configuration
   * @param count - Number of questions to generate
   * @returns Promise resolving to generated questions
   */
  async generateFromObjectives(
    objectives: string[],
    config: AssessmentConfig,
    count: number
  ): Promise<Question[]> {
    const prompt = `Create ${count} ${config.assessmentType} assessment questions based on these learning objectives:

${objectives.map((obj, i) => `${i + 1}. ${obj}`).join('\n')}

Requirements:
- Assessment type: ${config.assessmentType}
- Focus: ${config.aiGuidance.assessmentFocus}
- Key concepts: ${config.aiGuidance.keyConceptsToTest.join(', ')}

Return as JSON array with format:
{
  "id": "uuid",
  "text": "question text",
  "type": "multiple_choice|short_answer|essay|true_false",
  "points": number,
  "options": ["A", "B", "C", "D"] (for multiple choice),
  "correctAnswer": "answer" (for multiple choice and true/false),
  "rubric": "grading criteria" (for essay questions)
}`;

    try {
      const response = await this.aiService.generateResponse(prompt, {
        maxTokens: 2000,
        temperature: 0.7,
      });

      const questions = this.parseQuestionsFromResponse(response.response);
      return this.validateAndCleanQuestions(questions, config);
    } catch (error) {
      console.error('Failed to generate questions from objectives:', error);
      return this.getFallbackQuestions(config, count);
    }
  }

  /**
   * Builds the AI prompt for question generation
   */
  private buildQuestionPrompt(
    context: ContentContext,
    config: AssessmentConfig,
    options: QuestionGenerationOptions
  ): string {
    const questionTypes = options.questionTypes || ['multiple_choice', 'short_answer'];
    const difficultyMap = {
      1: 'very easy',
      2: 'easy',
      3: 'moderate',
      4: 'challenging',
      5: 'very challenging'
    };

    return `Create ${options.count} ${config.assessmentType} assessment questions based on this content:

CONTENT:
${context.rawContent.substring(0, 3000)}

ASSESSMENT DETAILS:
- Type: ${config.assessmentType}
- Focus: ${config.aiGuidance.assessmentFocus}
- Key concepts: ${config.aiGuidance.keyConceptsToTest.join(', ')}
- Difficulty: ${difficultyMap[options.difficulty]} 
- Question types: ${questionTypes.join(', ')}
- Points per question: ${Math.floor(config.gradingSchema.maxScore / options.count)}

${options.focusAreas ? `FOCUS AREAS: ${options.focusAreas.join(', ')}` : ''}

Return as JSON array with format:
{
  "id": "uuid",
  "text": "question text",
  "type": "multiple_choice|short_answer|essay|true_false",
  "points": number,
  "options": ["A", "B", "C", "D"] (for multiple choice),
  "correctAnswer": "answer" (for multiple choice and true/false),
  "rubric": "grading criteria" (for essay questions)
}

Ensure questions are:
- Aligned with the content
- Appropriate for ${config.assessmentType} assessment
- Clear and unambiguous
- Properly formatted`;
  }

  /**
   * Parses questions from AI response
   */
  private parseQuestionsFromResponse(response: string): Question[] {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No valid JSON array found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return parsed.map((q: any) => ({
        id: q.id || crypto.randomUUID(),
        text: q.text || 'Generated question',
        type: this.validateQuestionType(q.type),
        points: Math.max(1, parseInt(q.points) || 10),
        options: q.options || undefined,
        correctAnswer: q.correctAnswer || undefined,
        rubric: q.rubric || undefined,
      }));
    } catch (error) {
      console.error('Failed to parse questions from AI response:', error);
      return [];
    }
  }

  /**
   * Validates and cleans generated questions
   */
  private validateAndCleanQuestions(questions: Question[], config: AssessmentConfig): Question[] {
    return questions
      .filter(q => q.text && q.text.length > 10)
      .map(q => ({
        ...q,
        points: Math.min(q.points, config.gradingSchema.maxScore),
        text: q.text.trim(),
      }))
      .slice(0, 10); // Limit to 10 questions max
  }

  /**
   * Validates question type
   */
  private validateQuestionType(type: string): 'multiple_choice' | 'short_answer' | 'essay' | 'true_false' {
    const validTypes = ['multiple_choice', 'short_answer', 'essay', 'true_false'];
    return validTypes.includes(type) ? type as any : 'short_answer';
  }

  /**
   * Provides fallback questions when AI generation fails
   */
  private getFallbackQuestions(config: AssessmentConfig, count: number): Question[] {
    const fallbackQuestions: Question[] = [
      {
        id: crypto.randomUUID(),
        text: `Based on the content provided, explain the key concepts related to ${config.aiGuidance.assessmentFocus}.`,
        type: 'short_answer',
        points: Math.floor(config.gradingSchema.maxScore / count) || 10,
      },
      {
        id: crypto.randomUUID(),
        text: 'Analyze the main topics discussed and provide examples of their practical application.',
        type: 'essay',
        points: Math.floor(config.gradingSchema.maxScore / count) || 10,
        rubric: 'Clear explanation of concepts, relevant examples, proper analysis',
      },
      {
        id: crypto.randomUUID(),
        text: `True or False: The content demonstrates practical applications of ${config.aiGuidance.keyConceptsToTest[0] || 'the subject matter'}.`,
        type: 'true_false',
        points: Math.floor(config.gradingSchema.maxScore / count) || 5,
        correctAnswer: 'true',
      },
    ];

    return fallbackQuestions.slice(0, count);
  }
}