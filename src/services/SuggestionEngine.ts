export interface Suggestion {
  id: string;
  type: 'help' | 'resource' | 'practice' | 'clarification' | 'next-step';
  title: string;
  description: string;
  action?: {
    type: 'link' | 'prompt' | 'activity';
    data: any;
  };
  priority: number;
  context?: string;
}

export interface ConversationPattern {
  confusion: number;
  frustration: number;
  repetition: number;
  topicDrift: number;
  successRate: number;
}

export class SuggestionEngine {
  private patternThresholds = {
    confusion: 0.6,
    frustration: 0.5,
    repetition: 0.7,
    topicDrift: 0.6,
    lowSuccess: 0.3
  };

  constructor() {}

  async generateSuggestions(
    conversationHistory: Array<{ role: string; content: string }>,
    currentContext: any,
    learnerProfile?: any
  ): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];
    
    // Analyze conversation patterns
    const patterns = this.analyzeConversationPatterns(conversationHistory);
    
    // Generate suggestions based on patterns
    if (patterns.confusion > this.patternThresholds.confusion) {
      suggestions.push(...this.generateConfusionSuggestions(currentContext));
    }
    
    if (patterns.frustration > this.patternThresholds.frustration) {
      suggestions.push(...this.generateFrustrationSuggestions());
    }
    
    if (patterns.repetition > this.patternThresholds.repetition) {
      suggestions.push(...this.generateRepetitionSuggestions(conversationHistory));
    }
    
    if (patterns.topicDrift > this.patternThresholds.topicDrift) {
      suggestions.push(...this.generateTopicDriftSuggestions(currentContext));
    }
    
    if (patterns.successRate < this.patternThresholds.lowSuccess) {
      suggestions.push(...this.generateStruggleSuggestions(learnerProfile));
    }
    
    // Add proactive help based on context
    suggestions.push(...this.generateContextualSuggestions(currentContext, learnerProfile));
    
    // Sort by priority and return top suggestions
    return this.prioritizeSuggestions(suggestions).slice(0, 3);
  }

  private analyzeConversationPatterns(history: Array<{ role: string; content: string }>): ConversationPattern {
    const patterns: ConversationPattern = {
      confusion: 0,
      frustration: 0,
      repetition: 0,
      topicDrift: 0,
      successRate: 0.5
    };

    if (history.length < 2) {
      return patterns;
    }

    const userMessages = history.filter(m => m.role === 'user').map(m => m.content.toLowerCase());
    
    // Detect confusion indicators
    const confusionPhrases = [
      "i don't understand", "confused", "what do you mean", "can you explain",
      "i'm lost", "doesn't make sense", "huh", "what?", "i don't get it"
    ];
    patterns.confusion = this.calculatePatternScore(userMessages, confusionPhrases);
    
    // Detect frustration
    const frustrationPhrases = [
      "this is hard", "frustrated", "giving up", "can't do this", "too difficult",
      "annoying", "stuck", "nothing works", "tried everything"
    ];
    patterns.frustration = this.calculatePatternScore(userMessages, frustrationPhrases);
    
    // Detect repetition
    patterns.repetition = this.calculateRepetitionScore(userMessages);
    
    // Detect topic drift
    patterns.topicDrift = this.calculateTopicDriftScore(history);
    
    // Calculate success rate
    patterns.successRate = this.calculateSuccessRate(history);
    
    return patterns;
  }

  private calculatePatternScore(messages: string[], phrases: string[]): number {
    if (messages.length === 0) return 0;
    
    let matchCount = 0;
    for (const message of messages) {
      for (const phrase of phrases) {
        if (message.includes(phrase)) {
          matchCount++;
          break;
        }
      }
    }
    
    return matchCount / messages.length;
  }

  private calculateRepetitionScore(messages: string[]): number {
    if (messages.length < 3) return 0;
    
    const recentMessages = messages.slice(-5);
    const uniqueTopics = new Set<string>();
    
    for (const message of recentMessages) {
      const words = message.split(/\W+/).filter(w => w.length > 4);
      words.forEach(w => uniqueTopics.add(w));
    }
    
    // High repetition = low unique topics
    const avgWordsPerMessage = 10;
    const expectedUnique = recentMessages.length * avgWordsPerMessage * 0.3;
    
    return Math.max(0, 1 - (uniqueTopics.size / expectedUnique));
  }

  private calculateTopicDriftScore(history: Array<{ role: string; content: string }>): number {
    if (history.length < 4) return 0;
    
    const messages = history.map(m => m.content.toLowerCase());
    const initialTopic = this.extractMainTopic(messages[0]);
    const recentTopic = this.extractMainTopic(messages[messages.length - 1]);
    
    if (!initialTopic || !recentTopic) return 0;
    
    // Simple topic comparison
    const initialWords = new Set(initialTopic.split(/\W+/));
    const recentWords = new Set(recentTopic.split(/\W+/));
    
    let overlap = 0;
    for (const word of initialWords) {
      if (recentWords.has(word)) overlap++;
    }
    
    const similarity = overlap / Math.max(initialWords.size, recentWords.size);
    return 1 - similarity; // High drift = low similarity
  }

  private calculateSuccessRate(history: Array<{ role: string; content: string }>): number {
    const userMessages = history.filter(m => m.role === 'user').map(m => m.content.toLowerCase());
    
    const successPhrases = [
      "thank you", "thanks", "got it", "understand now", "makes sense",
      "perfect", "great", "helpful", "solved", "working now"
    ];
    
    const successScore = this.calculatePatternScore(userMessages, successPhrases);
    return successScore;
  }

  private extractMainTopic(text: string): string {
    // Simple topic extraction - return most frequent meaningful words
    const words = text.toLowerCase()
      .split(/\W+/)
      .filter(w => w.length > 4 && !this.isStopWord(w));
    
    return words.slice(0, 5).join(' ');
  }

  private isStopWord(word: string): boolean {
    const stopWords = [
      'about', 'after', 'before', 'being', 'between', 'during',
      'having', 'should', 'there', 'these', 'those', 'through',
      'under', 'where', 'which', 'while', 'would'
    ];
    return stopWords.includes(word);
  }

  private generateConfusionSuggestions(context: any): Suggestion[] {
    return [
      {
        id: 'confusion-1',
        type: 'clarification',
        title: 'Need clarification?',
        description: 'Let me break this down into simpler steps',
        action: {
          type: 'prompt',
          data: 'Can you explain this in simpler terms with an example?'
        },
        priority: 9,
        context: 'confusion_detected'
      },
      {
        id: 'confusion-2',
        type: 'resource',
        title: 'View related examples',
        description: 'See similar problems with solutions',
        action: {
          type: 'link',
          data: `/examples/${context.topicId || 'general'}`
        },
        priority: 7,
        context: 'confusion_detected'
      }
    ];
  }

  private generateFrustrationSuggestions(): Suggestion[] {
    return [
      {
        id: 'frustration-1',
        type: 'help',
        title: 'Take a different approach',
        description: "Let's try solving this step by step together",
        action: {
          type: 'prompt',
          data: 'Can we work through this problem together step by step?'
        },
        priority: 10,
        context: 'frustration_detected'
      },
      {
        id: 'frustration-2',
        type: 'resource',
        title: 'Request instructor help',
        description: 'Get direct help from your instructor',
        action: {
          type: 'link',
          data: '/request-help'
        },
        priority: 8,
        context: 'frustration_detected'
      }
    ];
  }

  private generateRepetitionSuggestions(history: Array<{ role: string; content: string }>): Suggestion[] {
    return [
      {
        id: 'repetition-1',
        type: 'clarification',
        title: 'Try a different question',
        description: 'Rephrase your question for better results',
        action: {
          type: 'prompt',
          data: 'Can you help me rephrase my question?'
        },
        priority: 8,
        context: 'repetition_detected'
      },
      {
        id: 'repetition-2',
        type: 'resource',
        title: 'Review fundamentals',
        description: 'Review the basic concepts first',
        action: {
          type: 'link',
          data: '/fundamentals'
        },
        priority: 6,
        context: 'repetition_detected'
      }
    ];
  }

  private generateTopicDriftSuggestions(context: any): Suggestion[] {
    return [
      {
        id: 'drift-1',
        type: 'next-step',
        title: 'Return to original topic',
        description: 'Get back to your original question',
        action: {
          type: 'prompt',
          data: `Let's return to the original topic about ${context.initialTopic || 'your question'}`
        },
        priority: 7,
        context: 'topic_drift_detected'
      }
    ];
  }

  private generateStruggleSuggestions(learnerProfile: any): Suggestion[] {
    const suggestions: Suggestion[] = [
      {
        id: 'struggle-1',
        type: 'practice',
        title: 'Practice with easier problems',
        description: 'Build confidence with simpler exercises',
        action: {
          type: 'activity',
          data: { difficulty: 'beginner', topic: learnerProfile?.currentTopic }
        },
        priority: 8,
        context: 'struggle_detected'
      }
    ];

    if (learnerProfile?.learningStyle === 'visual') {
      suggestions.push({
        id: 'struggle-2',
        type: 'resource',
        title: 'Watch video explanation',
        description: 'Visual demonstration of the concept',
        action: {
          type: 'link',
          data: '/videos/topic-explanation'
        },
        priority: 7,
        context: 'struggle_detected'
      });
    }

    return suggestions;
  }

  private generateContextualSuggestions(context: any, learnerProfile: any): Suggestion[] {
    const suggestions: Suggestion[] = [];

    // Suggest based on page type
    if (context.pageType === 'quiz' || context.pageType === 'exam') {
      suggestions.push({
        id: 'context-quiz',
        type: 'practice',
        title: 'Practice similar problems',
        description: 'Prepare with practice questions',
        action: {
          type: 'activity',
          data: { type: 'practice-quiz', topic: context.topic }
        },
        priority: 6,
        context: 'quiz_context'
      });
    }

    // Suggest based on time of day
    const hour = new Date().getHours();
    if (hour >= 22 || hour <= 6) {
      suggestions.push({
        id: 'context-time',
        type: 'help',
        title: 'Save and continue tomorrow',
        description: 'Rest helps with learning retention',
        action: {
          type: 'prompt',
          data: 'Would you like me to summarize what we covered so you can review it tomorrow?'
        },
        priority: 5,
        context: 'late_night'
      });
    }

    // Suggest based on performance
    if (learnerProfile?.recentPerformance === 'improving') {
      suggestions.push({
        id: 'context-performance',
        type: 'next-step',
        title: 'Ready for advanced topics',
        description: "You're doing great! Try more challenging material",
        action: {
          type: 'link',
          data: '/advanced-topics'
        },
        priority: 4,
        context: 'performance_improving'
      });
    }

    return suggestions;
  }

  private prioritizeSuggestions(suggestions: Suggestion[]): Suggestion[] {
    // Sort by priority (higher first) and deduplicate
    const seen = new Set<string>();
    const unique: Suggestion[] = [];
    
    suggestions.sort((a, b) => b.priority - a.priority);
    
    for (const suggestion of suggestions) {
      const key = `${suggestion.type}-${suggestion.title}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(suggestion);
      }
    }
    
    return unique;
  }

  formatSuggestionsForDisplay(suggestions: Suggestion[]): string {
    if (suggestions.length === 0) return '';
    
    const formatted = suggestions.map(s => {
      let display = `**${s.title}**\n${s.description}`;
      if (s.action?.type === 'prompt') {
        display += `\n_Try asking: "${s.action.data}"_`;
      }
      return display;
    });
    
    return '\n\n💡 **Suggestions:**\n' + formatted.join('\n\n');
  }
}