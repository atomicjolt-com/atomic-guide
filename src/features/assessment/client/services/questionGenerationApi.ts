/**
 * @fileoverview Client-side API for AI question generation
 * @module features/assessment/client/services/questionGenerationApi
 */

import type { AssessmentConfig, Question } from '../../shared/schemas/assessment.schema';

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
 * API response for question generation
 */
export interface QuestionGenerationResponse {
  success: boolean;
  questions: Question[];
  error?: string;
}

/**
 * Client-side service for AI question generation
 */
export class QuestionGenerationApi {
  private baseUrl: string;
  private jwt: string;

  constructor(jwt: string, baseUrl: string = '') {
    this.jwt = jwt;
    this.baseUrl = baseUrl;
  }

  /**
   * Generates questions based on content context
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
    try {
      const response = await fetch(`${this.baseUrl}/api/assessment/generate-questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.jwt}`,
        },
        body: JSON.stringify({
          context,
          config,
          options,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate questions: ${response.statusText}`);
      }

      const data: QuestionGenerationResponse = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Question generation failed');
      }

      return data.questions;
    } catch (error) {
      console.error('Question generation API error:', error);
      return this.getFallbackQuestions(config, options.count);
    }
  }

  /**
   * Generates questions from learning objectives
   * @param objectives - Learning objectives
   * @param config - Assessment configuration
   * @param count - Number of questions to generate
   * @returns Promise resolving to generated questions
   */
  async generateFromObjectives(
    objectives: string[],
    config: AssessmentConfig,
    count: number
  ): Promise<Question[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/assessment/generate-from-objectives`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.jwt}`,
        },
        body: JSON.stringify({
          objectives,
          config,
          count,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate questions: ${response.statusText}`);
      }

      const data: QuestionGenerationResponse = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Question generation failed');
      }

      return data.questions;
    } catch (error) {
      console.error('Question generation API error:', error);
      return this.getFallbackQuestions(config, count);
    }
  }

  /**
   * Analyzes content and suggests question opportunities
   * @param content - Content to analyze
   * @returns Promise resolving to suggested question areas
   */
  async analyzeContent(content: string): Promise<{
    concepts: string[];
    objectives: string[];
    suggestions: { area: string; questionCount: number; difficulty: number }[];
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/assessment/analyze-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.jwt}`,
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error(`Failed to analyze content: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Content analysis API error:', error);
      return {
        concepts: ['General concepts'],
        objectives: ['Understand the material'],
        suggestions: [
          { area: 'General understanding', questionCount: 3, difficulty: 2 },
          { area: 'Application', questionCount: 2, difficulty: 3 },
        ],
      };
    }
  }

  /**
   * Provides fallback questions when API fails
   */
  private getFallbackQuestions(config: AssessmentConfig, count: number): Question[] {
    const pointsPerQuestion = Math.floor(config.gradingSchema.maxScore / count) || 10;
    
    const fallbackQuestions: Question[] = [
      {
        id: crypto.randomUUID(),
        text: `Based on the content provided, explain the key concepts related to ${config.aiGuidance.assessmentFocus}.`,
        type: 'short_answer',
        points: pointsPerQuestion,
      },
      {
        id: crypto.randomUUID(),
        text: 'Analyze the main topics discussed and provide examples of their practical application.',
        type: 'essay',
        points: pointsPerQuestion,
        rubric: 'Clear explanation of concepts, relevant examples, proper analysis',
      },
      {
        id: crypto.randomUUID(),
        text: `True or False: The content demonstrates practical applications of ${config.aiGuidance.keyConceptsToTest[0] || 'the subject matter'}.`,
        type: 'true_false',
        points: Math.max(5, pointsPerQuestion),
        correctAnswer: 'true',
      },
      {
        id: crypto.randomUUID(),
        text: `Which of the following best describes ${config.aiGuidance.keyConceptsToTest[0] || 'the main concept'}?`,
        type: 'multiple_choice',
        points: pointsPerQuestion,
        options: [
          'Option A - Primary definition',
          'Option B - Secondary definition', 
          'Option C - Alternative definition',
          'Option D - None of the above'
        ],
        correctAnswer: 'Option A - Primary definition',
      },
    ];

    return fallbackQuestions.slice(0, count);
  }
}

/**
 * Creates a question generation API instance
 * @param jwt - JWT token for authentication
 * @param baseUrl - Base URL for API requests
 * @returns QuestionGenerationApi instance
 */
export function createQuestionGenerationApi(jwt: string, baseUrl?: string): QuestionGenerationApi {
  return new QuestionGenerationApi(jwt, baseUrl);
}