/**
 * @fileoverview Assessment configuration schema and types for deep linking
 * @module client/schemas/assessment
 */

import { z } from 'zod';

/**
 * Assessment type enumeration for different assessment purposes
 */
export const assessmentTypeSchema = z.enum(['formative', 'summative', 'diagnostic']);

/**
 * Grading schema type enumeration
 */
export const gradingTypeSchema = z.enum(['points', 'percentage', 'rubric']);

/**
 * Question type enumeration
 */
export const questionTypeSchema = z.enum(['multiple_choice', 'short_answer', 'essay']);

/**
 * Rubric level schema for scoring criteria
 */
export const rubricLevelSchema = z.object({
  score: z.number().min(0),
  description: z.string().min(1, 'Level description is required'),
});

/**
 * Rubric criteria schema for assessment evaluation
 */
export const rubricCriteriaSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Criteria name is required'),
  description: z.string().min(1, 'Criteria description is required'),
  levels: z.array(rubricLevelSchema).min(2, 'At least 2 levels required'),
});

/**
 * Grading schema configuration
 */
export const gradingSchemaSchema = z.object({
  type: gradingTypeSchema,
  maxScore: z.number().positive('Max score must be positive'),
  passingScore: z.number().positive('Passing score must be positive'),
});

/**
 * Rubric configuration schema
 */
export const rubricSchema = z.object({
  criteria: z.array(rubricCriteriaSchema),
});

/**
 * Assessment question schema
 */
export const assessmentQuestionSchema = z.object({
  id: z.string().uuid(),
  text: z.string().min(1, 'Question text is required'),
  type: questionTypeSchema,
  suggestedAnswer: z.string().optional(),
  points: z.number().min(0).optional(),
});

/**
 * AI guidance configuration for assessment generation
 */
export const aiGuidanceSchema = z.object({
  assessmentFocus: z.string().min(1, 'Assessment focus is required'),
  keyConceptsToTest: z.array(z.string().min(1)),
  allowedAttempts: z.number().positive('Allowed attempts must be positive').default(1),
});

/**
 * Complete assessment configuration schema
 */
export const assessmentConfigSchema = z.object({
  assessmentType: assessmentTypeSchema,
  masteryThreshold: z.number()
    .min(0, 'Threshold must be at least 0')
    .max(100, 'Threshold cannot exceed 100'),
  gradingSchema: gradingSchemaSchema,
  rubric: rubricSchema,
  questions: z.array(assessmentQuestionSchema),
  aiGuidance: aiGuidanceSchema,
  title: z.string().min(1, 'Assessment title is required').default('AI-Guided Assessment'),
  description: z.string().optional(),
  timeLimit: z.number().min(0).optional(),
  shuffleQuestions: z.boolean().default(false),
  showFeedback: z.boolean().default(true),
});

/**
 * Default assessment configuration
 */
export const defaultAssessmentConfig: AssessmentConfig = {
  assessmentType: 'formative',
  masteryThreshold: 70,
  gradingSchema: {
    type: 'points',
    maxScore: 100,
    passingScore: 70,
  },
  rubric: {
    criteria: [],
  },
  questions: [],
  aiGuidance: {
    assessmentFocus: '',
    keyConceptsToTest: [],
    allowedAttempts: 1,
  },
  title: 'AI-Guided Assessment',
  description: '',
  shuffleQuestions: false,
  showFeedback: true,
};

// Type exports
export type AssessmentType = z.infer<typeof assessmentTypeSchema>;
export type GradingType = z.infer<typeof gradingTypeSchema>;
export type QuestionType = z.infer<typeof questionTypeSchema>;
export type RubricLevel = z.infer<typeof rubricLevelSchema>;
export type RubricCriteria = z.infer<typeof rubricCriteriaSchema>;
export type GradingSchema = z.infer<typeof gradingSchemaSchema>;
export type Rubric = z.infer<typeof rubricSchema>;
export type AssessmentQuestion = z.infer<typeof assessmentQuestionSchema>;
export type AIGuidance = z.infer<typeof aiGuidanceSchema>;
export type AssessmentConfig = z.infer<typeof assessmentConfigSchema>;

/**
 * Validates assessment configuration
 * @param config - Raw configuration data
 * @returns Validated assessment configuration
 * @throws {z.ZodError} If validation fails
 */
export function validateAssessmentConfig(config: unknown): AssessmentConfig {
  return assessmentConfigSchema.parse(config);
}

/**
 * Safely validates assessment configuration
 * @param config - Raw configuration data
 * @returns Success/error result with parsed data or errors
 */
export function safeValidateAssessmentConfig(config: unknown): 
  { success: true; data: AssessmentConfig } | 
  { success: false; errors: z.ZodError } {
  const result = assessmentConfigSchema.safeParse(config);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}