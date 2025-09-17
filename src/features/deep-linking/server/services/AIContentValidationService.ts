/**
 * @fileoverview AI Content Validation Service
 * Provides comprehensive validation and screening for AI-generated assessment content
 * @module features/deep-linking/server/services/AIContentValidationService
 */

import { z } from 'zod';

/**
 * Content validation configuration schema
 */
const ContentValidationConfigSchema = z.object({
  enableProfanityFilter: z.boolean().default(true),
  enableBiasDetection: z.boolean().default(true),
  enableEducationalAppropriatenessCheck: z.boolean().default(true),
  enableCulturalSensitivityCheck: z.boolean().default(true),
  minConfidenceThreshold: z.number().min(0).max(1).default(0.8),
  maxQuestionLength: z.number().min(100).max(5000).default(2000),
  allowedLanguages: z.array(z.string()).default(['en']),
  prohibitedTopics: z.array(z.string()).default([]),
  requiredEducationalLevel: z.enum(['elementary', 'middle', 'high-school', 'college', 'graduate']).optional(),
});

type ContentValidationConfig = z.infer<typeof ContentValidationConfigSchema>;

/**
 * Question content schema for validation
 */
const QuestionContentSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['multiple_choice', 'short_answer', 'essay', 'true_false', 'fill_blank']),
  question: z.string().min(10).max(2000),
  options: z.array(z.string()).optional(),
  correctAnswer: z.union([z.string(), z.array(z.string())]).optional(),
  explanation: z.string().max(1000),
  difficulty: z.number().min(0).max(1),
  bloomsLevel: z.enum(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']),
  aiConfidence: z.number().min(0).max(1),
  sourceContent: z.string().optional(),
});

type QuestionContent = z.infer<typeof QuestionContentSchema>;

/**
 * Validation result schema
 */
const ValidationResultSchema = z.object({
  valid: z.boolean(),
  confidence: z.number().min(0).max(1),
  issues: z.array(z.object({
    type: z.enum(['profanity', 'bias', 'inappropriate', 'cultural_insensitive', 'low_quality', 'off_topic']),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    message: z.string(),
    suggestion: z.string().optional(),
    affectedText: z.string().optional(),
  })),
  suggestions: z.array(z.string()),
  educationalAlignment: z.object({
    appropriate: z.boolean(),
    level: z.string(),
    bloomsAlignment: z.boolean(),
    cognitiveLoad: z.number().min(0).max(1),
  }),
  metrics: z.object({
    readabilityScore: z.number().min(0).max(100),
    complexityScore: z.number().min(0).max(1),
    clarityScore: z.number().min(0).max(1),
    relevanceScore: z.number().min(0).max(1),
  }),
});

type ValidationResult = z.infer<typeof ValidationResultSchema>;

/**
 * Content appropriateness filters
 */
interface ContentFilter {
  name: string;
  validate(content: string, context?: any): Promise<{
    passed: boolean;
    confidence: number;
    issues: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
      suggestion?: string;
      affectedText?: string;
    }>;
  }>;
}

/**
 * AI Content Validation Service
 *
 * Provides comprehensive validation and screening for AI-generated assessment content:
 * - Educational appropriateness validation
 * - Content quality and clarity assessment
 * - Bias and cultural sensitivity detection
 * - Profanity and inappropriate content filtering
 * - Pedagogical alignment verification
 */
export class AIContentValidationService {
  private readonly config: ContentValidationConfig;
  private readonly contentFilters: ContentFilter[] = [];

  constructor(
    private readonly ai: Ai,
    config: Partial<ContentValidationConfig> = {}
  ) {
    this.config = ContentValidationConfigSchema.parse(config);
    this.initializeContentFilters();
  }

  /**
   * Validates AI-generated question content for educational appropriateness
   *
   * @param question - Question content to validate
   * @param context - Additional context for validation
   * @returns Comprehensive validation result
   */
  async validateQuestion(
    question: QuestionContent,
    context: {
      courseLevel?: string;
      subject?: string;
      targetAudience?: string;
      institutionPolicies?: string[];
    } = {}
  ): Promise<ValidationResult> {
    try {
      // Validate question schema
      const validatedQuestion = QuestionContentSchema.parse(question);

      // Run all content filters
      const filterResults = await this.runContentFilters(validatedQuestion, context);

      // Analyze educational alignment
      const educationalAlignment = await this.analyzeEducationalAlignment(validatedQuestion, context);

      // Calculate content metrics
      const metrics = await this.calculateContentMetrics(validatedQuestion);

      // Determine overall validation result
      const issues = filterResults.flatMap(result => result.issues);
      const criticalIssues = issues.filter(issue => issue.severity === 'critical');
      const highIssues = issues.filter(issue => issue.severity === 'high');

      const valid = criticalIssues.length === 0 &&
                   highIssues.length === 0 &&
                   educationalAlignment.appropriate &&
                   metrics.clarityScore >= this.config.minConfidenceThreshold;

      // Generate improvement suggestions
      const suggestions = await this.generateImprovementSuggestions(validatedQuestion, issues, metrics);

      // Calculate overall confidence
      const confidence = this.calculateOverallConfidence(filterResults, educationalAlignment, metrics);

      return {
        valid,
        confidence,
        issues,
        suggestions,
        educationalAlignment,
        metrics,
      };

    } catch (error) {
      console.error('Question validation error:', error);

      return {
        valid: false,
        confidence: 0,
        issues: [{
          type: 'low_quality',
          severity: 'critical',
          message: 'Question validation failed due to technical error',
          suggestion: 'Please regenerate the question',
        }],
        suggestions: ['Regenerate the question with simpler content'],
        educationalAlignment: {
          appropriate: false,
          level: 'unknown',
          bloomsAlignment: false,
          cognitiveLoad: 1,
        },
        metrics: {
          readabilityScore: 0,
          complexityScore: 1,
          clarityScore: 0,
          relevanceScore: 0,
        },
      };
    }
  }

  /**
   * Validates multiple questions in batch
   *
   * @param questions - Array of questions to validate
   * @param context - Validation context
   * @returns Array of validation results
   */
  async validateQuestionBatch(
    questions: QuestionContent[],
    context: any = {}
  ): Promise<ValidationResult[]> {
    const results = await Promise.all(
      questions.map(question => this.validateQuestion(question, context))
    );

    // Log batch validation metrics
    const validCount = results.filter(r => r.valid).length;
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

    console.log(`Batch validation: ${validCount}/${results.length} valid, avg confidence: ${avgConfidence.toFixed(2)}`);

    return results;
  }

  /**
   * Sanitizes question content for security
   *
   * @param question - Question to sanitize
   * @returns Sanitized question content
   */
  sanitizeQuestionContent(question: QuestionContent): QuestionContent {
    const sanitized = { ...question };

    // Remove potentially dangerous HTML/JavaScript
    sanitized.question = this.sanitizeText(sanitized.question);
    sanitized.explanation = this.sanitizeText(sanitized.explanation);

    if (sanitized.options) {
      sanitized.options = sanitized.options.map(option => this.sanitizeText(option));
    }

    if (typeof sanitized.correctAnswer === 'string') {
      sanitized.correctAnswer = this.sanitizeText(sanitized.correctAnswer);
    } else if (Array.isArray(sanitized.correctAnswer)) {
      sanitized.correctAnswer = sanitized.correctAnswer.map(answer => this.sanitizeText(answer));
    }

    return sanitized;
  }

  /**
   * Initializes content filtering pipeline
   */
  private initializeContentFilters(): void {
    if (this.config.enableProfanityFilter) {
      this.contentFilters.push(new ProfanityFilter());
    }

    if (this.config.enableBiasDetection) {
      this.contentFilters.push(new BiasDetectionFilter(this.ai));
    }

    if (this.config.enableEducationalAppropriatenessCheck) {
      this.contentFilters.push(new EducationalAppropriatenessFilter(this.ai));
    }

    if (this.config.enableCulturalSensitivityCheck) {
      this.contentFilters.push(new CulturalSensitivityFilter(this.ai));
    }

    this.contentFilters.push(new QualityAssuranceFilter(this.ai));
  }

  /**
   * Runs all content filters on question
   */
  private async runContentFilters(
    question: QuestionContent,
    context: any
  ): Promise<Array<{ name: string; passed: boolean; confidence: number; issues: any[] }>> {
    const results = [];

    for (const filter of this.contentFilters) {
      try {
        const result = await filter.validate(question.question, { question, context });
        results.push({
          name: filter.name,
          ...result,
        });
      } catch (error) {
        console.error(`Filter ${filter.name} failed:`, error);
        results.push({
          name: filter.name,
          passed: false,
          confidence: 0,
          issues: [{
            type: 'low_quality',
            severity: 'medium' as const,
            message: `Content filter ${filter.name} failed`,
          }],
        });
      }
    }

    return results;
  }

  /**
   * Analyzes educational alignment and appropriateness
   */
  private async analyzeEducationalAlignment(
    question: QuestionContent,
    context: any
  ): Promise<{
    appropriate: boolean;
    level: string;
    bloomsAlignment: boolean;
    cognitiveLoad: number;
  }> {
    try {
      const prompt = `Analyze this educational question for pedagogical appropriateness:

Question: ${question.question}
Explanation: ${question.explanation}
Intended Bloom's Level: ${question.bloomsLevel}
Difficulty: ${question.difficulty}
Course Context: ${context.subject || 'General'}
Target Level: ${context.courseLevel || 'College'}

Evaluate:
1. Is the question educationally appropriate for the target level?
2. Does it align with the intended Bloom's taxonomy level?
3. What is the cognitive load (0-1 scale)?
4. What educational level does this question actually target?

Respond in JSON format:
{
  "appropriate": boolean,
  "level": "elementary|middle|high-school|college|graduate",
  "bloomsAlignment": boolean,
  "cognitiveLoad": number,
  "reasoning": "explanation"
}`;

      const result = await this.ai.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
      });

      const analysis = JSON.parse(result.response);

      return {
        appropriate: analysis.appropriate || false,
        level: analysis.level || 'unknown',
        bloomsAlignment: analysis.bloomsAlignment || false,
        cognitiveLoad: Math.min(Math.max(analysis.cognitiveLoad || 0.5, 0), 1),
      };

    } catch (error) {
      console.error('Educational alignment analysis failed:', error);
      return {
        appropriate: false,
        level: 'unknown',
        bloomsAlignment: false,
        cognitiveLoad: 0.8,
      };
    }
  }

  /**
   * Calculates content quality metrics
   */
  private async calculateContentMetrics(question: QuestionContent): Promise<{
    readabilityScore: number;
    complexityScore: number;
    clarityScore: number;
    relevanceScore: number;
  }> {
    try {
      // Calculate readability using simple metrics
      const readabilityScore = this.calculateReadabilityScore(question.question);

      // Calculate complexity based on sentence structure and vocabulary
      const complexityScore = this.calculateComplexityScore(question.question);

      // Use AI to assess clarity
      const clarityScore = await this.assessContentClarity(question);

      // Assess relevance to source content if available
      const relevanceScore = question.sourceContent
        ? await this.assessContentRelevance(question.question, question.sourceContent)
        : question.aiConfidence;

      return {
        readabilityScore,
        complexityScore,
        clarityScore,
        relevanceScore,
      };

    } catch (error) {
      console.error('Content metrics calculation failed:', error);
      return {
        readabilityScore: 50,
        complexityScore: 0.5,
        clarityScore: 0.5,
        relevanceScore: 0.5,
      };
    }
  }

  /**
   * Generates improvement suggestions based on validation results
   */
  private async generateImprovementSuggestions(
    question: QuestionContent,
    issues: any[],
    metrics: any
  ): Promise<string[]> {
    const suggestions: string[] = [];

    // Suggestions based on issues
    if (issues.some(i => i.type === 'profanity')) {
      suggestions.push('Remove or replace inappropriate language');
    }

    if (issues.some(i => i.type === 'bias')) {
      suggestions.push('Revise content to be more inclusive and unbiased');
    }

    if (issues.some(i => i.type === 'cultural_insensitive')) {
      suggestions.push('Consider cultural sensitivity in examples and language');
    }

    // Suggestions based on metrics
    if (metrics.clarityScore < 0.7) {
      suggestions.push('Improve question clarity by simplifying language and structure');
    }

    if (metrics.readabilityScore < 40) {
      suggestions.push('Improve readability by using shorter sentences and common words');
    }

    if (metrics.complexityScore > 0.8) {
      suggestions.push('Reduce question complexity to match target difficulty level');
    }

    if (metrics.relevanceScore < 0.7) {
      suggestions.push('Improve alignment with source content and learning objectives');
    }

    return suggestions;
  }

  /**
   * Calculates overall confidence score
   */
  private calculateOverallConfidence(
    filterResults: any[],
    educationalAlignment: any,
    metrics: any
  ): number {
    const filterConfidence = filterResults.reduce((sum, r) => sum + r.confidence, 0) / filterResults.length;
    const educationConfidence = educationalAlignment.appropriate ? 0.9 : 0.3;
    const metricsConfidence = (metrics.clarityScore + metrics.relevanceScore) / 2;

    return (filterConfidence + educationConfidence + metricsConfidence) / 3;
  }

  /**
   * Sanitizes text content for security
   */
  private sanitizeText(text: string): string {
    // Remove HTML tags and potentially dangerous content
    return text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }

  /**
   * Calculates simple readability score
   */
  private calculateReadabilityScore(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const syllables = words.reduce((count, word) => count + this.countSyllables(word), 0);

    if (sentences.length === 0 || words.length === 0) return 0;

    // Simplified Flesch Reading Ease formula
    const avgWordsPerSentence = words.length / sentences.length;
    const avgSyllablesPerWord = syllables / words.length;

    const score = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * Counts syllables in a word (simple approximation)
   */
  private countSyllables(word: string): number {
    const vowels = word.toLowerCase().match(/[aeiouy]+/g);
    return vowels ? Math.max(vowels.length, 1) : 1;
  }

  /**
   * Calculates complexity score based on sentence structure
   */
  private calculateComplexityScore(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.length > 0);

    if (sentences.length === 0 || words.length === 0) return 0.5;

    const avgWordsPerSentence = words.length / sentences.length;
    const longWords = words.filter(w => w.length > 6).length;
    const longWordRatio = longWords / words.length;

    // Normalize to 0-1 scale
    const sentenceComplexity = Math.min(avgWordsPerSentence / 20, 1);
    const vocabularyComplexity = longWordRatio;

    return (sentenceComplexity + vocabularyComplexity) / 2;
  }

  /**
   * Assesses content clarity using AI
   */
  private async assessContentClarity(question: QuestionContent): Promise<number> {
    try {
      const prompt = `Rate the clarity of this question on a scale of 0-1:

Question: ${question.question}

Consider:
- Is the question clearly worded?
- Is it unambiguous?
- Would students understand what is being asked?

Respond with just a number between 0 and 1.`;

      const result = await this.ai.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 10,
      });

      const score = parseFloat(result.response.trim());
      return isNaN(score) ? 0.5 : Math.min(Math.max(score, 0), 1);

    } catch (error) {
      console.error('Clarity assessment failed:', error);
      return 0.5;
    }
  }

  /**
   * Assesses content relevance to source material
   */
  private async assessContentRelevance(question: string, sourceContent: string): Promise<number> {
    try {
      const prompt = `Rate how well this question relates to the source content (0-1 scale):

Source Content: ${sourceContent.substring(0, 500)}...
Question: ${question}

Consider:
- Does the question test understanding of the source content?
- Are the concepts directly related?
- Would answering this question demonstrate learning from the source?

Respond with just a number between 0 and 1.`;

      const result = await this.ai.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 10,
      });

      const score = parseFloat(result.response.trim());
      return isNaN(score) ? 0.5 : Math.min(Math.max(score, 0), 1);

    } catch (error) {
      console.error('Relevance assessment failed:', error);
      return 0.5;
    }
  }
}

/**
 * Content filter implementations
 */

class ProfanityFilter implements ContentFilter {
  name = 'ProfanityFilter';

  // Basic profanity word list (in production, use a comprehensive library)
  private readonly profanityWords = new Set([
    // Add appropriate profanity detection words
    'inappropriate', 'offensive', // Placeholder - use proper profanity detection
  ]);

  async validate(content: string): Promise<{
    passed: boolean;
    confidence: number;
    issues: any[];
  }> {
    const words = content.toLowerCase().split(/\s+/);
    const profanityFound = words.some(word => this.profanityWords.has(word));

    return {
      passed: !profanityFound,
      confidence: profanityFound ? 0.9 : 1.0,
      issues: profanityFound ? [{
        type: 'profanity',
        severity: 'high' as const,
        message: 'Inappropriate language detected',
        suggestion: 'Remove or replace inappropriate language',
      }] : [],
    };
  }
}

class BiasDetectionFilter implements ContentFilter {
  name = 'BiasDetectionFilter';

  constructor(private ai: Ai) {}

  async validate(content: string): Promise<{
    passed: boolean;
    confidence: number;
    issues: any[];
  }> {
    try {
      const prompt = `Analyze this content for bias, stereotypes, or discriminatory language:

Content: ${content}

Check for:
- Gender bias
- Racial or ethnic bias
- Religious bias
- Socioeconomic bias
- Cultural bias
- Age bias

Respond in JSON format:
{
  "hasBias": boolean,
  "confidence": number,
  "biasTypes": ["type1", "type2"],
  "explanation": "brief explanation"
}`;

      const result = await this.ai.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
      });

      const analysis = JSON.parse(result.response);

      return {
        passed: !analysis.hasBias,
        confidence: analysis.confidence || 0.8,
        issues: analysis.hasBias ? [{
          type: 'bias',
          severity: 'medium' as const,
          message: `Potential bias detected: ${analysis.explanation}`,
          suggestion: 'Revise content to be more inclusive and unbiased',
        }] : [],
      };

    } catch (error) {
      console.error('Bias detection failed:', error);
      return {
        passed: true,
        confidence: 0.5,
        issues: [],
      };
    }
  }
}

class EducationalAppropriatenessFilter implements ContentFilter {
  name = 'EducationalAppropriatenessFilter';

  constructor(private ai: Ai) {}

  async validate(content: string, context?: any): Promise<{
    passed: boolean;
    confidence: number;
    issues: any[];
  }> {
    try {
      const question = context?.question;
      const targetLevel = context?.context?.courseLevel || 'college';

      const prompt = `Evaluate if this educational content is appropriate for ${targetLevel} level students:

Content: ${content}
${question ? `Question Type: ${question.type}` : ''}
${question ? `Difficulty Level: ${question.difficulty}` : ''}

Check for:
- Age-appropriate content
- Educational value
- Appropriate complexity for level
- Safe learning environment

Respond in JSON format:
{
  "appropriate": boolean,
  "confidence": number,
  "issues": ["issue1", "issue2"],
  "reasoning": "brief explanation"
}`;

      const result = await this.ai.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
      });

      const analysis = JSON.parse(result.response);

      return {
        passed: analysis.appropriate,
        confidence: analysis.confidence || 0.8,
        issues: analysis.appropriate ? [] : [{
          type: 'inappropriate',
          severity: 'high' as const,
          message: `Content not appropriate for target level: ${analysis.reasoning}`,
          suggestion: 'Adjust content to match educational level and appropriateness standards',
        }],
      };

    } catch (error) {
      console.error('Educational appropriateness check failed:', error);
      return {
        passed: true,
        confidence: 0.5,
        issues: [],
      };
    }
  }
}

class CulturalSensitivityFilter implements ContentFilter {
  name = 'CulturalSensitivityFilter';

  constructor(private ai: Ai) {}

  async validate(content: string): Promise<{
    passed: boolean;
    confidence: number;
    issues: any[];
  }> {
    try {
      const prompt = `Analyze this content for cultural sensitivity issues:

Content: ${content}

Check for:
- Cultural stereotypes
- Insensitive references
- Exclusionary language
- Cultural assumptions
- Religious insensitivity

Respond in JSON format:
{
  "culturallySensitive": boolean,
  "confidence": number,
  "issues": ["issue1", "issue2"],
  "suggestions": ["suggestion1", "suggestion2"]
}`;

      const result = await this.ai.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
      });

      const analysis = JSON.parse(result.response);

      return {
        passed: analysis.culturallySensitive,
        confidence: analysis.confidence || 0.8,
        issues: analysis.culturallySensitive ? [] : [{
          type: 'cultural_insensitive',
          severity: 'medium' as const,
          message: `Cultural sensitivity concerns: ${analysis.issues?.join(', ')}`,
          suggestion: analysis.suggestions?.join(', ') || 'Consider cultural sensitivity in examples and language',
        }],
      };

    } catch (error) {
      console.error('Cultural sensitivity check failed:', error);
      return {
        passed: true,
        confidence: 0.5,
        issues: [],
      };
    }
  }
}

class QualityAssuranceFilter implements ContentFilter {
  name = 'QualityAssuranceFilter';

  constructor(private ai: Ai) {}

  async validate(content: string, context?: any): Promise<{
    passed: boolean;
    confidence: number;
    issues: any[];
  }> {
    const issues: any[] = [];

    // Check content length
    if (content.length < 10) {
      issues.push({
        type: 'low_quality',
        severity: 'high' as const,
        message: 'Content too short to be meaningful',
        suggestion: 'Provide more detailed content',
      });
    }

    if (content.length > 2000) {
      issues.push({
        type: 'low_quality',
        severity: 'medium' as const,
        message: 'Content may be too long for student attention',
        suggestion: 'Consider breaking into smaller parts',
      });
    }

    // Check for proper grammar and structure
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length === 0) {
      issues.push({
        type: 'low_quality',
        severity: 'high' as const,
        message: 'No complete sentences found',
        suggestion: 'Ensure content has proper sentence structure',
      });
    }

    // Check for question marks in questions
    const question = context?.question;
    if (question?.type === 'multiple_choice' && !content.includes('?')) {
      issues.push({
        type: 'low_quality',
        severity: 'low' as const,
        message: 'Question may be missing question mark',
        suggestion: 'Ensure questions are properly formatted',
      });
    }

    return {
      passed: issues.filter(i => i.severity === 'high').length === 0,
      confidence: issues.length === 0 ? 1.0 : Math.max(0.3, 1.0 - (issues.length * 0.2)),
      issues,
    };
  }
}

/**
 * Factory function for creating AI content validation service
 */
export function createAIContentValidationService(
  ai: Ai,
  config?: Partial<ContentValidationConfig>
): AIContentValidationService {
  return new AIContentValidationService(ai, config);
}

/**
 * Type exports
 */
export type {
  ContentValidationConfig,
  QuestionContent,
  ValidationResult,
};