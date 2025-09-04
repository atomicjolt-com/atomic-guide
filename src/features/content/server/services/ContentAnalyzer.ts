import { Ai } from '@cloudflare/ai';

export interface Concept {
  concept: string;
  importance: number;
  category: 'definition' | 'process' | 'example' | 'theory' | 'principle' | 'formula';
  context?: string;
}

export interface LearningObjective {
  objective: string;
  bloomLevel: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
  confidence: number;
  keywords?: string[];
}

export interface Prerequisite {
  concept: string;
  importance: number;
  source: string;
  relatedConcepts?: string[];
}

export interface AssessmentOpportunity {
  location: string;
  type: 'comprehension' | 'application' | 'analysis' | 'synthesis' | 'evaluation';
  difficulty: number;
  reasoning: string;
  suggestedQuestionTypes?: string[];
}

export interface ContentAnalysis {
  keyConcepts: Concept[];
  learningObjectives: LearningObjective[];
  prerequisiteKnowledge: Prerequisite[];
  assessmentOpportunities: AssessmentOpportunity[];
  readabilityScore?: number;
  estimatedReadingTime?: number;
  contentComplexity?: 'basic' | 'intermediate' | 'advanced';
  topicCategories?: string[];
}

export interface ContentExtractionData {
  pageUrl: string;
  pageType: string;
  content: {
    html: string;
    text: string;
    title: string;
    metadata: {
      headings: Array<{ level: number; text: string }>;
      links: Array<{ url: string; text: string }>;
      images: Array<{ src: string; alt: string }>;
      lists: Array<{ type: string; items: string[] }>;
      emphasis: Array<{ type: string; text: string }>;
      tables: Array<{ headers: string[]; rows: string[][] }>;
    };
  };
  timestamp: string;
  contentHash: string;
}

export class ContentAnalyzer {
  private ai: Ai;

  constructor(ai: Ai) {
    this.ai = ai;
  }

  async analyzeContent(content: ContentExtractionData): Promise<ContentAnalysis> {
    const [keyConcepts, learningObjectives, prerequisiteKnowledge, assessmentOpportunities, additionalMetrics] = await Promise.all([
      this.extractKeyConcepts(content.content.text, content.content.metadata),
      this.identifyLearningObjectives(content.content.text, content.content.metadata),
      this.detectPrerequisites(content.content.text),
      this.suggestAssessmentPoints(content.content.text, content.content.metadata),
      this.analyzeContentMetrics(content.content.text),
    ]);

    return {
      keyConcepts,
      learningObjectives,
      prerequisiteKnowledge,
      assessmentOpportunities,
      ...additionalMetrics,
    };
  }

  async extractKeyConcepts(text: string, metadata: any): Promise<Concept[]> {
    const concepts: Concept[] = [];

    const headingConcepts = this.extractConceptsFromHeadings(metadata.headings);
    concepts.push(...headingConcepts);

    const emphasisConcepts = this.extractConceptsFromEmphasis(metadata.emphasis);
    concepts.push(...emphasisConcepts);

    const definitionPatterns = [
      /(?:is defined as|refers to|means?|denotes?)\s+([^.]+)/gi,
      /(?:^|\n)([A-Z][^:]+):\s+[A-Z]/g,
      /\b(?:concept|principle|theory|law|rule|formula) of ([^.]+)/gi,
    ];

    for (const pattern of definitionPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const conceptText = match[1].trim();
        if (conceptText.length > 3 && conceptText.length < 100) {
          concepts.push({
            concept: this.cleanConceptText(conceptText),
            importance: 0.7,
            category: 'definition',
            context: match[0],
          });
        }
      }
    }

    const aiConcepts = await this.extractConceptsWithAI(text);
    concepts.push(...aiConcepts);

    return this.deduplicateAndRankConcepts(concepts);
  }

  private extractConceptsFromHeadings(headings: Array<{ level: number; text: string }>): Concept[] {
    return headings
      .filter((h) => h.text.length > 3 && h.text.length < 100)
      .map((h) => ({
        concept: this.cleanConceptText(h.text),
        importance: 1.0 - h.level * 0.15,
        category: 'principle' as const,
      }));
  }

  private extractConceptsFromEmphasis(emphasis: Array<{ type: string; text: string }>): Concept[] {
    return emphasis
      .filter((e) => e.text.length > 3 && e.text.length < 50)
      .filter((e) => /^[A-Z]/.test(e.text))
      .map((e) => ({
        concept: this.cleanConceptText(e.text),
        importance: e.type === 'bold' ? 0.8 : 0.6,
        category: 'definition' as const,
      }));
  }

  private async extractConceptsWithAI(text: string): Promise<Concept[]> {
    try {
      const prompt = `Extract key academic concepts from this text. Return JSON array with: concept (name), importance (0-1), category (definition/process/example/theory/principle/formula). Text: ${text.substring(0, 2000)}`;

      const response = await this.ai.run('@cf/meta/llama-3.1-8b-instruct', {
        prompt,
        max_tokens: 500,
        temperature: 0.3,
      });

      const result = response.response || response.text || '';
      const jsonMatch = result.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.filter((c: any) => c.concept && typeof c.importance === 'number' && c.category);
      }
    } catch (error) {
      console.error('AI concept extraction failed:', error);
    }

    return [];
  }

  async identifyLearningObjectives(text: string, _metadata: any): Promise<LearningObjective[]> {
    const objectives: LearningObjective[] = [];

    const objectivePatterns = [
      /(?:learning objectives?|goals?|outcomes?)[\s:]+([^.]+(?:\.[^.]+){0,3})/gi,
      /(?:students? will be able to|you will learn to)\s+([^.]+)/gi,
      /(?:by the end[^,]+,?)\s+(?:students?|you) (?:will|should)\s+([^.]+)/gi,
      /(?:objectives?|aims?)(?:\s+are)?:?\s*\n((?:[-•*]\s*[^\n]+\n?){1,5})/gi,
    ];

    for (const pattern of objectivePatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const objective = this.parseObjective(match[1]);
        if (objective) {
          objectives.push(objective);
        }
      }
    }

    const bloomVerbs = {
      remember: ['define', 'list', 'identify', 'name', 'recall', 'recognize', 'state'],
      understand: ['explain', 'describe', 'summarize', 'interpret', 'classify', 'compare'],
      apply: ['apply', 'demonstrate', 'solve', 'use', 'implement', 'execute', 'carry out'],
      analyze: ['analyze', 'examine', 'investigate', 'differentiate', 'distinguish', 'organize'],
      evaluate: ['evaluate', 'assess', 'critique', 'judge', 'justify', 'defend', 'argue'],
      create: ['create', 'design', 'develop', 'construct', 'produce', 'formulate', 'compose'],
    };

    // Look for action verbs that indicate learning objectives
    const actionVerbPatterns =
      /\b(?:will\s+)?(understand|explain|apply|analyze|evaluate|create|solve|design|implement|demonstrate)\b[^.,;]+/gi;
    const actionPhrases = text.match(actionVerbPatterns);

    if (actionPhrases) {
      for (const phrase of actionPhrases) {
        const bloomLevel = this.determineBloomLevel(phrase, bloomVerbs);
        if (bloomLevel) {
          objectives.push({
            objective: this.cleanObjectiveText(phrase),
            bloomLevel,
            confidence: 0.6,
            keywords: this.extractKeywords(phrase),
          });
        }
      }
    }

    return this.deduplicateObjectives(objectives);
  }

  private parseObjective(text: string): LearningObjective | null {
    const cleaned = this.cleanObjectiveText(text);
    if (cleaned.length < 10 || cleaned.length > 200) return null;

    const bloomLevel = this.determineBloomLevelFromText(cleaned);

    return {
      objective: cleaned,
      bloomLevel,
      confidence: 0.7,
      keywords: this.extractKeywords(cleaned),
    };
  }

  private determineBloomLevel(text: string, bloomVerbs: Record<string, string[]>): LearningObjective['bloomLevel'] | null {
    const lowerText = text.toLowerCase();

    for (const [level, verbs] of Object.entries(bloomVerbs)) {
      for (const verb of verbs) {
        if (lowerText.includes(verb)) {
          return level as LearningObjective['bloomLevel'];
        }
      }
    }

    return null;
  }

  private determineBloomLevelFromText(text: string): LearningObjective['bloomLevel'] {
    const lower = text.toLowerCase();

    if (/\b(create|design|develop|construct|produce)/.test(lower)) return 'create';
    if (/\b(evaluate|assess|critique|judge)/.test(lower)) return 'evaluate';
    if (/\b(analyze|examine|investigate|differentiate)/.test(lower)) return 'analyze';
    if (/\b(apply|demonstrate|solve|use|implement)/.test(lower)) return 'apply';
    if (/\b(explain|describe|summarize|interpret)/.test(lower)) return 'understand';

    return 'remember';
  }

  async detectPrerequisites(text: string): Promise<Prerequisite[]> {
    const prerequisites: Prerequisite[] = [];

    const prereqPatterns = [
      /(?:prerequisites?:?)\s+([^.]+)/gi,
      /(?:prior knowledge|requires? understanding of|assumes? knowledge of)\s+([^.]+)/gi,
      /(?:builds? upon|based on)\s+([^.]+)/gi,
      /(?:familiarity with|knowledge of|understanding of)\s+([^.]+?)(?:is|are)?\s+(?:required|necessary|essential)/gi,
    ];

    for (const pattern of prereqPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const prereqText = match[1].trim();
        const concepts = this.extractPrerequisiteConcepts(prereqText);

        for (const concept of concepts) {
          prerequisites.push({
            concept,
            importance: 0.8,
            source: match[0].substring(0, 100),
          });
        }
      }
    }

    const referencePatterns = [
      /\b(?:recall|remember|from|as discussed in|as covered in)\s+(?:the )?(previous|earlier|last)\s+(?:chapter|section|module|unit)/gi,
      /\b(?:Chapter|Section|Module|Unit)\s+\d+/gi,
    ];

    for (const pattern of referencePatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        prerequisites.push({
          concept: `Content from ${match[0]}`,
          importance: 0.6,
          source: match[0],
        });
      }
    }

    return this.deduplicatePrerequisites(prerequisites);
  }

  private extractPrerequisiteConcepts(text: string): string[] {
    const concepts: string[] = [];

    // Split on common separators, but preserve "and" within compound concepts
    const items = text.split(/[,;]|\s+and\s+(?![a-z])/i);

    for (const item of items) {
      const cleaned = item
        .trim()
        .replace(/^(the|a|an|understanding of|knowledge of)\s+/i, '')
        .replace(/\.$/, '');
      if (cleaned.length > 2 && cleaned.length < 100) {
        concepts.push(cleaned);
      }
    }

    return concepts;
  }

  async suggestAssessmentPoints(text: string, metadata: any): Promise<AssessmentOpportunity[]> {
    const opportunities: AssessmentOpportunity[] = [];

    const sections = this.identifyContentSections(text, metadata.headings);

    for (const section of sections) {
      const complexity = this.assessSectionComplexity(section.content);

      if (complexity.hasDefinitions) {
        opportunities.push({
          location: section.heading || `Section at position ${section.start}`,
          type: 'comprehension',
          difficulty: 0.3,
          reasoning: 'Section contains definitions suitable for comprehension checks',
          suggestedQuestionTypes: ['definition matching', 'true/false', 'fill-in-the-blank'],
        });
      }

      if (complexity.hasExamples) {
        opportunities.push({
          location: section.heading || `Section at position ${section.start}`,
          type: 'application',
          difficulty: 0.5,
          reasoning: 'Section includes examples that can be used for application questions',
          suggestedQuestionTypes: ['problem solving', 'scenario-based', 'calculation'],
        });
      }

      if (complexity.hasComparisons) {
        opportunities.push({
          location: section.heading || `Section at position ${section.start}`,
          type: 'analysis',
          difficulty: 0.7,
          reasoning: 'Section contains comparisons suitable for analytical thinking',
          suggestedQuestionTypes: ['compare/contrast', 'relationship analysis', 'categorization'],
        });
      }

      if (complexity.hasEvaluativeContent) {
        opportunities.push({
          location: section.heading || `Section at position ${section.start}`,
          type: 'evaluation',
          difficulty: 0.8,
          reasoning: 'Section includes evaluative content for critical thinking assessment',
          suggestedQuestionTypes: ['critique', 'judgment', 'recommendation'],
        });
      }

      if (section.content.length > 500 && complexity.conceptDensity > 0.3) {
        opportunities.push({
          location: section.heading || `Section at position ${section.start}`,
          type: 'synthesis',
          difficulty: 0.9,
          reasoning: 'Dense content section suitable for synthesis questions',
          suggestedQuestionTypes: ['essay', 'integration', 'creative application'],
        });
      }
    }

    return opportunities;
  }

  private identifyContentSections(
    text: string,
    headings: Array<{ level: number; text: string }>
  ): Array<{ heading?: string; content: string; start: number }> {
    const sections: Array<{ heading?: string; content: string; start: number }> = [];

    if (headings.length === 0) {
      const paragraphs = text.split(/\n\n+/);
      let position = 0;

      for (const para of paragraphs) {
        if (para.length > 100) {
          sections.push({
            content: para,
            start: position,
          });
        }
        position += para.length + 2;
      }
    } else {
      for (let i = 0; i < headings.length; i++) {
        const heading = headings[i];
        const headingIndex = text.indexOf(heading.text);

        if (headingIndex !== -1) {
          const nextHeadingIndex = i < headings.length - 1 ? text.indexOf(headings[i + 1].text, headingIndex + 1) : text.length;

          const sectionContent = text.substring(headingIndex, nextHeadingIndex);

          sections.push({
            heading: heading.text,
            content: sectionContent,
            start: headingIndex,
          });
        }
      }
    }

    return sections;
  }

  private assessSectionComplexity(text: string): {
    hasDefinitions: boolean;
    hasExamples: boolean;
    hasComparisons: boolean;
    hasEvaluativeContent: boolean;
    conceptDensity: number;
  } {
    const lower = text.toLowerCase();

    return {
      hasDefinitions: /\b(is|are|means?|refers? to|defined as|denotes?)\b/.test(lower),
      hasExamples: /\b(for example|for instance|such as|e\.g\.|including|like)\b/.test(lower),
      hasComparisons: /\b(however|whereas|unlike|similar|different|compare|contrast|versus|vs\.)\b/.test(lower),
      hasEvaluativeContent:
        /\b(advantage|disadvantage|benefit|drawback|strength|weakness|pros?|cons?|better|worse|effective|ineffective)\b/.test(lower),
      conceptDensity: this.calculateConceptDensity(text),
    };
  }

  private calculateConceptDensity(text: string): number {
    const words = text.split(/\s+/).length;
    const technicalTerms = text.match(/\b[A-Z][a-z]*[A-Z][a-zA-Z]*\b|\b\w+(?:tion|ment|ance|ence|ity|ism|ology|graphy)\b/g);
    const termCount = technicalTerms ? technicalTerms.length : 0;

    return Math.min(termCount / words, 1);
  }

  private async analyzeContentMetrics(text: string): Promise<{
    readabilityScore?: number;
    estimatedReadingTime?: number;
    contentComplexity?: 'basic' | 'intermediate' | 'advanced';
    topicCategories?: string[];
  }> {
    const words = text.split(/\s+/).length;
    const sentences = text.split(/[.!?]+/).length;
    const syllables = this.countSyllables(text);

    const fleschScore = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);

    const readingTime = Math.ceil(words / 250);

    let complexity: 'basic' | 'intermediate' | 'advanced';
    if (fleschScore >= 60) {
      complexity = 'basic';
    } else if (fleschScore >= 30) {
      complexity = 'intermediate';
    } else {
      complexity = 'advanced';
    }

    const categories = await this.identifyTopicCategories(text);

    return {
      readabilityScore: Math.max(0, Math.min(100, fleschScore)),
      estimatedReadingTime: readingTime,
      contentComplexity: complexity,
      topicCategories: categories,
    };
  }

  private countSyllables(text: string): number {
    const words = text.toLowerCase().split(/\s+/);
    let totalSyllables = 0;

    for (const word of words) {
      const cleaned = word.replace(/[^a-z]/g, '');
      if (cleaned.length === 0) continue;

      let syllables = cleaned.replace(/[^aeiou]/g, '').length;

      syllables -= (cleaned.match(/[aeiou]{2,}/g) || []).length;

      if (cleaned.endsWith('e') && syllables > 1) {
        syllables--;
      }

      totalSyllables += Math.max(1, syllables);
    }

    return totalSyllables;
  }

  private async identifyTopicCategories(text: string): Promise<string[]> {
    const categories: Set<string> = new Set();

    const categoryKeywords: Record<string, string[]> = {
      Mathematics: ['equation', 'formula', 'calculate', 'algebra', 'geometry', 'calculus', 'theorem', 'proof'],
      Science: ['experiment', 'hypothesis', 'theory', 'molecule', 'atom', 'cell', 'organism', 'reaction'],
      Technology: ['algorithm', 'software', 'hardware', 'programming', 'database', 'network', 'system', 'code'],
      History: ['century', 'era', 'civilization', 'revolution', 'war', 'empire', 'dynasty', 'historical'],
      Literature: ['author', 'novel', 'poem', 'character', 'plot', 'theme', 'narrative', 'literary'],
      Psychology: ['behavior', 'cognitive', 'emotion', 'personality', 'mental', 'consciousness', 'perception'],
      Business: ['market', 'strategy', 'management', 'finance', 'revenue', 'profit', 'organization', 'economic'],
      Philosophy: ['ethics', 'morality', 'existence', 'knowledge', 'truth', 'logic', 'argument', 'reasoning'],
    };

    const lower = text.toLowerCase();

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      const matchCount = keywords.filter((keyword) => lower.includes(keyword)).length;
      if (matchCount >= 2) {
        categories.add(category);
      }
    }

    return Array.from(categories);
  }

  private cleanConceptText(text: string): string {
    return text
      .trim()
      .replace(/^(the|a|an)\s+/i, '')
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s-]/g, '')
      .substring(0, 100);
  }

  private cleanObjectiveText(text: string): string {
    return text
      .trim()
      .replace(/^[-•*]\s*/, '')
      .replace(/\s+/g, ' ')
      .replace(/\n/g, ' ')
      .substring(0, 200);
  }

  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      'as',
      'is',
      'was',
      'are',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'must',
      'can',
      'shall',
    ]);

    const words = text
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .filter((word) => !stopWords.has(word));

    const wordFreq = new Map<string, number>();

    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }

    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  private deduplicateAndRankConcepts(concepts: Concept[]): Concept[] {
    const uniqueConcepts = new Map<string, Concept>();

    for (const concept of concepts) {
      const key = concept.concept.toLowerCase();
      const existing = uniqueConcepts.get(key);

      if (!existing || concept.importance > existing.importance) {
        uniqueConcepts.set(key, concept);
      }
    }

    return Array.from(uniqueConcepts.values())
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 20);
  }

  private deduplicateObjectives(objectives: LearningObjective[]): LearningObjective[] {
    const uniqueObjectives = new Map<string, LearningObjective>();

    for (const obj of objectives) {
      const key = obj.objective.toLowerCase().substring(0, 50);
      const existing = uniqueObjectives.get(key);

      if (!existing || obj.confidence > existing.confidence) {
        uniqueObjectives.set(key, obj);
      }
    }

    return Array.from(uniqueObjectives.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);
  }

  private deduplicatePrerequisites(prerequisites: Prerequisite[]): Prerequisite[] {
    const uniquePrereqs = new Map<string, Prerequisite>();

    for (const prereq of prerequisites) {
      const key = prereq.concept.toLowerCase();
      const existing = uniquePrereqs.get(key);

      if (!existing || prereq.importance > existing.importance) {
        uniquePrereqs.set(key, prereq);
      }
    }

    return Array.from(uniquePrereqs.values())
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 15);
  }
}
