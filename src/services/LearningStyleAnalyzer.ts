/**
 * LearningStyleAnalyzer Service
 * Detects and analyzes learner's preferred learning style using the VARK model
 * (Visual, Auditory, Reading/Writing, Kinesthetic)
 */

export type LearningStyle = 'visual' | 'auditory' | 'kinesthetic' | 'reading_writing';

export interface LearningStylePattern {
  style: LearningStyle;
  confidence: number;
  indicators: string[];
}

export interface LearningStyleAnalysis {
  primaryStyle: LearningStyle;
  secondaryStyle?: LearningStyle;
  confidence: number;
  patterns: LearningStylePattern[];
  recommendedFormats: string[];
}

export interface InteractionPattern {
  messageContent: string;
  responsePreference?: string;
  engagementLevel?: number;
  mediaRequests?: string[];
  timestamp: string;
}

export class LearningStyleAnalyzer {
  private readonly MIN_INTERACTIONS_FOR_DETECTION = 5;
  private readonly CONFIDENCE_THRESHOLD = 0.7;

  // Keywords and patterns for each learning style
  private readonly STYLE_INDICATORS = {
    visual: {
      keywords: ['show', 'see', 'look', 'diagram', 'chart', 'picture', 'visualize', 'image', 'graph', 'map', 'color', 'highlight'],
      requestPatterns: ['show me', 'can I see', 'draw', 'illustrate', 'demonstrate visually'],
      contentPreferences: ['diagrams', 'flowcharts', 'mind maps', 'infographics'],
    },
    auditory: {
      keywords: ['hear', 'listen', 'sound', 'tell', 'explain', 'discuss', 'talk', 'voice', 'speak', 'audio'],
      requestPatterns: ['explain to me', 'tell me about', 'can you describe', 'walk me through'],
      contentPreferences: ['verbal explanations', 'discussions', 'audio content', 'podcasts'],
    },
    kinesthetic: {
      keywords: ['do', 'try', 'practice', 'hands-on', 'experience', 'feel', 'touch', 'action', 'exercise', 'example'],
      requestPatterns: ['let me try', 'can I practice', 'show me how to do', 'give me an example'],
      contentPreferences: ['interactive exercises', 'simulations', 'practice problems', 'real-world examples'],
    },
    reading_writing: {
      keywords: ['read', 'write', 'list', 'note', 'text', 'document', 'summary', 'outline', 'bullet', 'step-by-step'],
      requestPatterns: ['write it down', 'give me the steps', 'list the', 'summarize', 'outline'],
      contentPreferences: ['written instructions', 'lists', 'notes', 'documentation'],
    },
  };

  /**
   * Analyze interaction patterns to detect learning style
   */
  public async analyze(interactions: InteractionPattern[]): Promise<LearningStyleAnalysis> {
    if (interactions.length < this.MIN_INTERACTIONS_FOR_DETECTION) {
      return this.getDefaultAnalysis();
    }

    const styleScores = this.calculateStyleScores(interactions);
    const patterns = this.detectPatterns(interactions, styleScores);
    const sortedStyles = this.rankStyles(styleScores);

    const primaryStyle = sortedStyles[0].style;
    const secondaryStyle = sortedStyles[1]?.score > 0.3 ? sortedStyles[1].style : undefined;
    const confidence = this.calculateConfidence(styleScores, interactions.length);

    return {
      primaryStyle,
      secondaryStyle,
      confidence,
      patterns,
      recommendedFormats: this.getRecommendedFormats(primaryStyle, secondaryStyle),
    };
  }

  /**
   * Calculate scores for each learning style based on interactions
   */
  private calculateStyleScores(interactions: InteractionPattern[]): Map<LearningStyle, number> {
    const scores = new Map<LearningStyle, number>();

    // Initialize scores
    (['visual', 'auditory', 'kinesthetic', 'reading_writing'] as LearningStyle[]).forEach((style) => {
      scores.set(style, 0);
    });

    interactions.forEach((interaction) => {
      const content = interaction.messageContent.toLowerCase();

      // Check for style indicators
      for (const [style, indicators] of Object.entries(this.STYLE_INDICATORS)) {
        let styleScore = 0;

        // Check keywords
        indicators.keywords.forEach((keyword) => {
          if (content.includes(keyword)) {
            styleScore += 1;
          }
        });

        // Check request patterns
        indicators.requestPatterns.forEach((pattern) => {
          if (content.includes(pattern)) {
            styleScore += 2; // Request patterns are stronger indicators
          }
        });

        // Check media requests
        if (interaction.mediaRequests) {
          interaction.mediaRequests.forEach((mediaType) => {
            if (this.matchesStyleMedia(style as LearningStyle, mediaType)) {
              styleScore += 3; // Direct media requests are strong indicators
            }
          });
        }

        // Update score with engagement weight
        const engagementMultiplier = interaction.engagementLevel || 1;
        scores.set(style as LearningStyle, scores.get(style as LearningStyle)! + styleScore * engagementMultiplier);
      }
    });

    // Normalize scores
    const total = Array.from(scores.values()).reduce((sum, score) => sum + score, 0);
    if (total > 0) {
      scores.forEach((score, style) => {
        scores.set(style, score / total);
      });
    }

    return scores;
  }

  /**
   * Detect specific patterns in learning behavior
   */
  private detectPatterns(interactions: InteractionPattern[], styleScores: Map<LearningStyle, number>): LearningStylePattern[] {
    const patterns: LearningStylePattern[] = [];

    styleScores.forEach((score, style) => {
      if (score > 0.2) {
        // Only include significant patterns
        const indicators = this.findIndicators(interactions, style);
        patterns.push({
          style,
          confidence: score,
          indicators,
        });
      }
    });

    return patterns;
  }

  /**
   * Find specific indicators for a learning style in interactions
   */
  private findIndicators(interactions: InteractionPattern[], style: LearningStyle): string[] {
    const indicators = new Set<string>();
    const styleData = this.STYLE_INDICATORS[style];

    interactions.forEach((interaction) => {
      const content = interaction.messageContent.toLowerCase();

      styleData.keywords.forEach((keyword) => {
        if (content.includes(keyword)) {
          indicators.add(`Uses "${keyword}" frequently`);
        }
      });

      styleData.requestPatterns.forEach((pattern) => {
        if (content.includes(pattern)) {
          indicators.add(`Requests: "${pattern}"`);
        }
      });
    });

    return Array.from(indicators).slice(0, 5); // Return top 5 indicators
  }

  /**
   * Rank learning styles by score
   */
  private rankStyles(scores: Map<LearningStyle, number>): Array<{ style: LearningStyle; score: number }> {
    return Array.from(scores.entries())
      .map(([style, score]) => ({ style, score }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate confidence in the analysis
   */
  private calculateConfidence(scores: Map<LearningStyle, number>, interactionCount: number): number {
    const sortedScores = Array.from(scores.values()).sort((a, b) => b - a);

    // Factors affecting confidence:
    // 1. Difference between top two scores (clarity)
    const clarity = sortedScores[0] - (sortedScores[1] || 0);

    // 2. Number of interactions (sample size)
    const sampleConfidence = Math.min(interactionCount / 20, 1); // Max confidence at 20 interactions

    // 3. Strength of primary style
    const strength = sortedScores[0];

    // Combined confidence
    const confidence = clarity * 0.4 + sampleConfidence * 0.3 + strength * 0.3;

    return Math.min(confidence, 1); // Cap at 1
  }

  /**
   * Check if media type matches learning style
   */
  private matchesStyleMedia(style: LearningStyle, mediaType: string): boolean {
    const mediaMap: Record<LearningStyle, string[]> = {
      visual: ['image', 'diagram', 'video', 'chart', 'graph'],
      auditory: ['audio', 'podcast', 'voice', 'speech'],
      kinesthetic: ['interactive', 'simulation', 'game', 'practice'],
      reading_writing: ['text', 'document', 'pdf', 'article'],
    };

    return mediaMap[style]?.some((type) => mediaType.includes(type)) || false;
  }

  /**
   * Get recommended content formats for learning styles
   */
  private getRecommendedFormats(primary: LearningStyle, secondary?: LearningStyle): string[] {
    const formats: string[] = [];

    // Primary style recommendations
    formats.push(...this.STYLE_INDICATORS[primary].contentPreferences);

    // Secondary style recommendations
    if (secondary) {
      formats.push(...this.STYLE_INDICATORS[secondary].contentPreferences.slice(0, 2));
    }

    return formats;
  }

  /**
   * Get default analysis when insufficient data
   */
  private getDefaultAnalysis(): LearningStyleAnalysis {
    return {
      primaryStyle: 'reading_writing', // Default to most common style
      confidence: 0,
      patterns: [],
      recommendedFormats: ['written instructions', 'step-by-step guides'],
    };
  }

  /**
   * Update learning style based on feedback
   */
  public async refineAnalysis(
    currentAnalysis: LearningStyleAnalysis,
    feedback: { helpful: boolean; preferredFormat?: string }
  ): Promise<LearningStyleAnalysis> {
    // Adjust confidence based on feedback
    const confidenceAdjustment = feedback.helpful ? 0.05 : -0.05;
    const newConfidence = Math.max(0, Math.min(1, currentAnalysis.confidence + confidenceAdjustment));

    // If user specified a preferred format, analyze it
    if (feedback.preferredFormat) {
      const inferredStyle = this.inferStyleFromFormat(feedback.preferredFormat);
      if (inferredStyle && inferredStyle !== currentAnalysis.primaryStyle) {
        // Consider switching primary and secondary styles
        return {
          ...currentAnalysis,
          primaryStyle: inferredStyle,
          secondaryStyle: currentAnalysis.primaryStyle,
          confidence: newConfidence * 0.8, // Reduce confidence when switching
        };
      }
    }

    return {
      ...currentAnalysis,
      confidence: newConfidence,
    };
  }

  /**
   * Infer learning style from content format preference
   */
  private inferStyleFromFormat(format: string): LearningStyle | null {
    const formatLower = format.toLowerCase();

    if (formatLower.includes('visual') || formatLower.includes('diagram') || formatLower.includes('image')) {
      return 'visual';
    }
    if (formatLower.includes('audio') || formatLower.includes('explain') || formatLower.includes('talk')) {
      return 'auditory';
    }
    if (formatLower.includes('practice') || formatLower.includes('example') || formatLower.includes('try')) {
      return 'kinesthetic';
    }
    if (formatLower.includes('text') || formatLower.includes('write') || formatLower.includes('list')) {
      return 'reading_writing';
    }

    return null;
  }

  /**
   * Generate personalized explanation format based on learning style
   */
  public formatExplanation(content: string, style: LearningStyle): string {
    switch (style) {
      case 'visual':
        return this.formatVisualExplanation(content);
      case 'auditory':
        return this.formatAuditoryExplanation(content);
      case 'kinesthetic':
        return this.formatKinestheticExplanation(content);
      case 'reading_writing':
        return this.formatReadingWritingExplanation(content);
      default:
        return content;
    }
  }

  private formatVisualExplanation(content: string): string {
    return `📊 **Visual Overview:**\n\n${content}\n\n💡 *Tip: Look for patterns and relationships in the visual elements provided.*`;
  }

  private formatAuditoryExplanation(content: string): string {
    return `🎧 **Let me explain:**\n\n${content}\n\n💬 *Think of this as a conversation - feel free to ask follow-up questions!*`;
  }

  private formatKinestheticExplanation(content: string): string {
    return `🤹 **Let's try it out:**\n\n${content}\n\n✋ *Practice suggestion: Try applying this concept with a hands-on example.*`;
  }

  private formatReadingWritingExplanation(content: string): string {
    const points = content.split('. ').filter((p) => p.length > 0);
    const formatted = points.map((point, i) => `${i + 1}. ${point}`).join('\n');
    return `📝 **Key Points:**\n\n${formatted}\n\n📌 *Note: Consider writing these points in your own words for better retention.*`;
  }
}
