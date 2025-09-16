/**
 * @fileoverview Content Analysis Service using Workers AI
 * @module features/canvas-integration/server/services/ContentAnalysisService
 *
 * Provides AI-powered analysis of Canvas content to extract learning objectives,
 * concepts, difficulty assessment, and metadata generation using Cloudflare Workers AI
 * for enhanced assessment context and personalized learning support.
 */

import {
  CanvasPageContent,
  ContentAnalysisResult
} from '../../shared/types';

/**
 * AI analysis configuration
 */
interface AnalysisConfig {
  maxContentLength: number;
  timeoutMs: number;
  retryAttempts: number;
  confidenceThreshold: number;
  models: {
    textAnalysis: string;
    conceptExtraction: string;
    difficultyAssessment: string;
  };
}

/**
 * Learning objective extraction result
 */
interface LearningObjectiveResult {
  objectives: string[];
  confidence: number;
  taxonomy: 'knowledge' | 'comprehension' | 'application' | 'analysis' | 'synthesis' | 'evaluation';
}

/**
 * Concept extraction result
 */
interface ConceptResult {
  concepts: Array<{
    name: string;
    importance: number;
    category: string;
    relationships: string[];
  }>;
  confidence: number;
}

/**
 * Difficulty assessment result
 */
interface DifficultyResult {
  level: 'beginner' | 'intermediate' | 'advanced';
  confidence: number;
  factors: Array<{
    factor: string;
    impact: number;
    description: string;
  }>;
  readabilityScore: number;
  complexityIndicators: string[];
}

/**
 * Content Analysis Service using Workers AI
 *
 * Provides comprehensive AI-powered analysis of Canvas content:
 * - Learning objective extraction using LLM analysis
 * - Academic concept identification and categorization
 * - Difficulty level assessment with confidence scoring
 * - Content complexity analysis and readability scoring
 * - Prerequisite detection and dependency mapping
 * - Educational taxonomy classification
 */
export class ContentAnalysisService {
  private readonly CONFIG: AnalysisConfig = {
    maxContentLength: 4000, // 4KB max for AI processing
    timeoutMs: 30000, // 30 seconds timeout
    retryAttempts: 3,
    confidenceThreshold: 0.6,
    models: {
      textAnalysis: '@cf/meta/llama-2-7b-chat-int8',
      conceptExtraction: '@cf/meta/llama-2-7b-chat-int8',
      difficultyAssessment: '@cf/meta/llama-2-7b-chat-int8'
    }
  };

  constructor(
    private aiService: any // Cloudflare Workers AI binding
  ) {}

  /**
   * Analyze Canvas content comprehensively
   */
  async analyzeContent(content: CanvasPageContent): Promise<ContentAnalysisResult> {
    if (!content.contentText || content.contentText.length < 50) {
      return this.createEmptyAnalysis();
    }

    try {
      // Prepare content for analysis
      const preparedContent = this.prepareContentForAnalysis(content);

      // Run parallel AI analyses
      const [
        objectivesResult,
        conceptsResult,
        difficultyResult
      ] = await Promise.allSettled([
        this.extractLearningObjectives(preparedContent, content.pageType),
        this.extractConcepts(preparedContent, content.pageType),
        this.assessDifficulty(preparedContent, content.pageType)
      ]);

      // Combine results
      const objectives = objectivesResult.status === 'fulfilled' ? objectivesResult.value.objectives : [];
      const concepts = conceptsResult.status === 'fulfilled' ? conceptsResult.value.concepts.map(c => c.name) : [];
      const difficulty = difficultyResult.status === 'fulfilled' ? difficultyResult.value.level : 'intermediate';

      // Calculate overall confidence
      const confidenceScores = [
        objectivesResult.status === 'fulfilled' ? objectivesResult.value.confidence : 0,
        conceptsResult.status === 'fulfilled' ? conceptsResult.value.confidence : 0,
        difficultyResult.status === 'fulfilled' ? difficultyResult.value.confidence : 0
      ];
      const overallConfidence = confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length;

      // Extract prerequisites from objectives and concepts
      const prerequisites = await this.extractPrerequisites(concepts, objectives, content.pageType);

      // Estimate duration based on content and difficulty
      const estimatedDuration = this.estimateStudyDuration(preparedContent, difficulty);

      return {
        concepts,
        learningObjectives: objectives,
        difficulty,
        estimatedDuration,
        prerequisites,
        confidence: overallConfidence,
        analysisTimestamp: new Date()
      };

    } catch (error) {
      console.error('Content analysis failed:', error);
      return this.createEmptyAnalysis();
    }
  }

  /**
   * Extract learning objectives using AI
   */
  async extractLearningObjectives(
    content: string,
    pageType: CanvasPageContent['pageType']
  ): Promise<LearningObjectiveResult> {
    const prompt = this.buildObjectiveExtractionPrompt(content, pageType);

    try {
      const response = await this.callAI(this.CONFIG.models.textAnalysis, prompt);
      return this.parseLearningObjectives(response);
    } catch (error) {
      console.error('Learning objective extraction failed:', error);
      return {
        objectives: [],
        confidence: 0,
        taxonomy: 'knowledge'
      };
    }
  }

  /**
   * Extract academic concepts using AI
   */
  async extractConcepts(
    content: string,
    pageType: CanvasPageContent['pageType']
  ): Promise<ConceptResult> {
    const prompt = this.buildConceptExtractionPrompt(content, pageType);

    try {
      const response = await this.callAI(this.CONFIG.models.conceptExtraction, prompt);
      return this.parseConcepts(response);
    } catch (error) {
      console.error('Concept extraction failed:', error);
      return {
        concepts: [],
        confidence: 0
      };
    }
  }

  /**
   * Assess content difficulty using AI
   */
  async assessDifficulty(
    content: string,
    pageType: CanvasPageContent['pageType']
  ): Promise<DifficultyResult> {
    const prompt = this.buildDifficultyAssessmentPrompt(content, pageType);

    try {
      const response = await this.callAI(this.CONFIG.models.difficultyAssessment, prompt);
      const aiResult = this.parseDifficultyAssessment(response);

      // Combine AI assessment with heuristic analysis
      const heuristicResult = this.heuristicDifficultyAssessment(content);

      return this.combineDifficultyAssessments(aiResult, heuristicResult);
    } catch (error) {
      console.error('Difficulty assessment failed:', error);
      return {
        level: 'intermediate',
        confidence: 0,
        factors: [],
        readabilityScore: 0.5,
        complexityIndicators: []
      };
    }
  }

  /**
   * Extract prerequisites from content analysis
   */
  private async extractPrerequisites(
    concepts: string[],
    objectives: string[],
    pageType: CanvasPageContent['pageType']
  ): Promise<string[]> {
    if (concepts.length === 0 && objectives.length === 0) {
      return [];
    }

    const prompt = `Based on the following learning content analysis, identify 3-5 prerequisite knowledge areas or skills that students should have before engaging with this material:

Concepts: ${concepts.join(', ')}
Learning Objectives: ${objectives.join(', ')}
Content Type: ${pageType}

List prerequisites as simple, clear statements. Format each on a new line starting with "- ".`;

    try {
      const response = await this.callAI(this.CONFIG.models.textAnalysis, prompt);
      return this.parsePrerequisites(response);
    } catch (error) {
      console.error('Prerequisite extraction failed:', error);
      return [];
    }
  }

  /**
   * Prepare content for AI analysis
   */
  private prepareContentForAnalysis(content: CanvasPageContent): string {
    let text = content.contentText || '';

    // Remove HTML tags and clean up text
    text = text.replace(/<[^>]+>/g, ' ');
    text = text.replace(/\s+/g, ' ');
    text = text.trim();

    // Truncate if too long
    if (text.length > this.CONFIG.maxContentLength) {
      text = text.substring(0, this.CONFIG.maxContentLength) + '...';
    }

    return text;
  }

  /**
   * Build learning objective extraction prompt
   */
  private buildObjectiveExtractionPrompt(
    content: string,
    pageType: CanvasPageContent['pageType']
  ): string {
    return `Analyze this ${pageType} content and extract 3-5 specific, measurable learning objectives. Focus on what students will be able to DO after engaging with this content.

Content: "${content}"

Format each learning objective starting with an action verb (e.g., "Analyze", "Create", "Evaluate", "Explain", "Apply"). List one objective per line starting with "- ".

Examples:
- Analyze the relationship between X and Y
- Create a solution for problem Z
- Evaluate the effectiveness of method A
- Explain the process of B`;
  }

  /**
   * Build concept extraction prompt
   */
  private buildConceptExtractionPrompt(
    content: string,
    pageType: CanvasPageContent['pageType']
  ): string {
    return `Extract 5-10 key academic concepts from this ${pageType} content. Focus on important terms, theories, methods, or ideas that are central to understanding the material.

Content: "${content}"

List each concept on a new line starting with "- ". Use clear, specific terminology.

Examples:
- Statistical hypothesis testing
- Object-oriented programming
- Supply and demand equilibrium
- Photosynthesis process`;
  }

  /**
   * Build difficulty assessment prompt
   */
  private buildDifficultyAssessmentPrompt(
    content: string,
    pageType: CanvasPageContent['pageType']
  ): string {
    return `Assess the difficulty level of this ${pageType} content. Consider factors like vocabulary complexity, concept abstractness, prerequisite knowledge required, and cognitive load.

Content: "${content}"

Respond with one of: "beginner", "intermediate", or "advanced"

Then explain your reasoning in 2-3 sentences, considering:
- Vocabulary and language complexity
- Abstract vs concrete concepts
- Amount of prerequisite knowledge needed
- Cognitive skills required (recall, analysis, synthesis, etc.)`;
  }

  /**
   * Call Workers AI with error handling and retries
   */
  private async callAI(model: string, prompt: string): Promise<string> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.CONFIG.retryAttempts; attempt++) {
      try {
        const response = await this.aiService.run(model, {
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 512,
          temperature: 0.1 // Low temperature for consistent results
        });

        if (response && response.response) {
          return response.response;
        } else {
          throw new Error('Empty AI response');
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('AI call failed');
        console.warn(`AI call attempt ${attempt} failed:`, lastError.message);

        // Wait before retry (exponential backoff)
        if (attempt < this.CONFIG.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    throw lastError!;
  }

  /**
   * Parse learning objectives from AI response
   */
  private parseLearningObjectives(response: string): LearningObjectiveResult {
    const lines = response.split('\n');
    const objectives: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ')) {
        const objective = trimmed.substring(2).trim();
        if (objective.length > 10 && objectives.length < 8) {
          objectives.push(objective);
        }
      }
    }

    // Determine taxonomy level based on action verbs
    const taxonomy = this.determineTaxonomyLevel(objectives);

    return {
      objectives,
      confidence: objectives.length > 0 ? 0.8 : 0.2,
      taxonomy
    };
  }

  /**
   * Parse concepts from AI response
   */
  private parseConcepts(response: string): ConceptResult {
    const lines = response.split('\n');
    const concepts: ConceptResult['concepts'] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ')) {
        const concept = trimmed.substring(2).trim();
        if (concept.length > 2 && concepts.length < 15) {
          concepts.push({
            name: concept,
            importance: 0.7, // Default importance
            category: this.categorizeConcept(concept),
            relationships: []
          });
        }
      }
    }

    return {
      concepts,
      confidence: concepts.length > 0 ? 0.8 : 0.2
    };
  }

  /**
   * Parse difficulty assessment from AI response
   */
  private parseDifficultyAssessment(response: string): DifficultyResult {
    const lowerResponse = response.toLowerCase();

    let level: 'beginner' | 'intermediate' | 'advanced' = 'intermediate';

    if (lowerResponse.includes('beginner')) {
      level = 'beginner';
    } else if (lowerResponse.includes('advanced')) {
      level = 'advanced';
    }

    // Extract reasoning factors
    const factors = this.extractDifficultyFactors(response);

    return {
      level,
      confidence: 0.7,
      factors,
      readabilityScore: 0.5, // Will be calculated separately
      complexityIndicators: []
    };
  }

  /**
   * Parse prerequisites from AI response
   */
  private parsePrerequisites(response: string): string[] {
    const lines = response.split('\n');
    const prerequisites: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ')) {
        const prerequisite = trimmed.substring(2).trim();
        if (prerequisite.length > 5 && prerequisites.length < 8) {
          prerequisites.push(prerequisite);
        }
      }
    }

    return prerequisites;
  }

  /**
   * Determine taxonomy level from learning objectives
   */
  private determineTaxonomyLevel(objectives: string[]): LearningObjectiveResult['taxonomy'] {
    const objectiveText = objectives.join(' ').toLowerCase();

    // Bloom's taxonomy verb mapping
    const taxonomyVerbs = {
      knowledge: ['define', 'list', 'name', 'identify', 'recall', 'state'],
      comprehension: ['explain', 'describe', 'summarize', 'interpret', 'classify'],
      application: ['apply', 'use', 'implement', 'solve', 'demonstrate'],
      analysis: ['analyze', 'compare', 'contrast', 'examine', 'break down'],
      synthesis: ['create', 'design', 'develop', 'construct', 'formulate'],
      evaluation: ['evaluate', 'assess', 'judge', 'critique', 'justify']
    };

    for (const [level, verbs] of Object.entries(taxonomyVerbs)) {
      if (verbs.some(verb => objectiveText.includes(verb))) {
        return level as LearningObjectiveResult['taxonomy'];
      }
    }

    return 'knowledge'; // Default
  }

  /**
   * Categorize concept
   */
  private categorizeConcept(concept: string): string {
    const lowerConcept = concept.toLowerCase();

    if (lowerConcept.includes('theory') || lowerConcept.includes('principle')) {
      return 'theory';
    } else if (lowerConcept.includes('method') || lowerConcept.includes('process')) {
      return 'methodology';
    } else if (lowerConcept.includes('formula') || lowerConcept.includes('equation')) {
      return 'formula';
    } else if (lowerConcept.includes('tool') || lowerConcept.includes('technique')) {
      return 'tool';
    } else {
      return 'concept';
    }
  }

  /**
   * Extract difficulty factors from AI response
   */
  private extractDifficultyFactors(response: string): DifficultyResult['factors'] {
    const factors: DifficultyResult['factors'] = [];

    // Look for common difficulty indicators in the response
    const indicators = {
      'vocabulary': { impact: 0.3, description: 'Complex vocabulary and terminology' },
      'abstract': { impact: 0.4, description: 'Abstract concepts requiring interpretation' },
      'prerequisite': { impact: 0.5, description: 'Requires significant prior knowledge' },
      'analysis': { impact: 0.4, description: 'Requires analytical thinking skills' },
      'synthesis': { impact: 0.5, description: 'Requires combining multiple concepts' }
    };

    const lowerResponse = response.toLowerCase();

    for (const [factor, info] of Object.entries(indicators)) {
      if (lowerResponse.includes(factor)) {
        factors.push({
          factor,
          impact: info.impact,
          description: info.description
        });
      }
    }

    return factors;
  }

  /**
   * Heuristic difficulty assessment
   */
  private heuristicDifficultyAssessment(content: string): DifficultyResult {
    let score = 0;
    const indicators: string[] = [];

    // Word length analysis
    const words = content.split(/\s+/);
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;

    if (avgWordLength > 6) {
      score += 0.2;
      indicators.push('Long average word length');
    }

    // Sentence complexity
    const sentences = content.split(/[.!?]+/);
    const avgSentenceLength = words.length / sentences.length;

    if (avgSentenceLength > 20) {
      score += 0.2;
      indicators.push('Complex sentence structure');
    }

    // Technical vocabulary indicators
    const technicalPatterns = [
      /\b\w+tion\b/g,   // -tion words
      /\b\w+ism\b/g,    // -ism words
      /\b\w+ology\b/g,  // -ology words
      /\b\w+ance\b/g    // -ance words
    ];

    let technicalWordCount = 0;
    technicalPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) technicalWordCount += matches.length;
    });

    const technicalRatio = technicalWordCount / words.length;
    if (technicalRatio > 0.1) {
      score += 0.3;
      indicators.push('High technical vocabulary');
    }

    // Determine difficulty level
    let level: 'beginner' | 'intermediate' | 'advanced';
    if (score < 0.3) level = 'beginner';
    else if (score < 0.6) level = 'intermediate';
    else level = 'advanced';

    return {
      level,
      confidence: 0.6,
      factors: [],
      readabilityScore: 1 - score, // Invert score for readability
      complexityIndicators: indicators
    };
  }

  /**
   * Combine AI and heuristic difficulty assessments
   */
  private combineDifficultyAssessments(
    aiResult: DifficultyResult,
    heuristicResult: DifficultyResult
  ): DifficultyResult {
    // Weight AI result more heavily if confidence is high
    const aiWeight = aiResult.confidence;
    const heuristicWeight = 1 - aiWeight;

    // Convert levels to numeric for averaging
    const levelToNum = { beginner: 1, intermediate: 2, advanced: 3 };
    const numToLevel = { 1: 'beginner', 2: 'intermediate', 3: 'advanced' } as const;

    const aiLevel = levelToNum[aiResult.level];
    const heuristicLevel = levelToNum[heuristicResult.level];

    const combinedLevel = Math.round(aiLevel * aiWeight + heuristicLevel * heuristicWeight);
    const finalLevel = numToLevel[combinedLevel as keyof typeof numToLevel] || 'intermediate';

    return {
      level: finalLevel,
      confidence: Math.max(aiResult.confidence, heuristicResult.confidence),
      factors: aiResult.factors,
      readabilityScore: heuristicResult.readabilityScore,
      complexityIndicators: heuristicResult.complexityIndicators
    };
  }

  /**
   * Estimate study duration based on content and difficulty
   */
  private estimateStudyDuration(content: string, difficulty: 'beginner' | 'intermediate' | 'advanced'): number {
    const wordCount = content.split(/\s+/).length;

    // Base reading time (words per minute)
    const baseReadingSpeed = 200;
    const readingTime = wordCount / baseReadingSpeed;

    // Difficulty multipliers
    const difficultyMultipliers = {
      beginner: 1.2,
      intermediate: 1.5,
      advanced: 2.0
    };

    // Comprehension and processing time
    const processingTime = readingTime * difficultyMultipliers[difficulty];

    // Convert to minutes and round to reasonable increments
    const totalMinutes = Math.ceil(processingTime * 5) * 5; // Round to nearest 5 minutes

    return Math.max(5, Math.min(120, totalMinutes)); // Clamp between 5 and 120 minutes
  }

  /**
   * Create empty analysis result
   */
  private createEmptyAnalysis(): ContentAnalysisResult {
    return {
      concepts: [],
      learningObjectives: [],
      difficulty: 'intermediate',
      estimatedDuration: 30,
      prerequisites: [],
      confidence: 0,
      analysisTimestamp: new Date()
    };
  }
}