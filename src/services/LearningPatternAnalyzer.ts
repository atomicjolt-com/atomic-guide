/**
 * Advanced Learning Pattern Analyzer for Proactive Intervention
 * Builds upon the existing LearningStyleAnalyzer to detect struggle patterns,
 * learning trends, and optimal intervention timing for proactive help suggestions.
 */

import { LearningStyleAnalyzer } from './LearningStyleAnalyzer';

export interface StrugglePattern {
  type: 'confusion' | 'frustration' | 'repetition' | 'topic_drift' | 'engagement_decline' | 'success_plateau';
  confidence: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  indicators: string[];
  suggestedIntervention: InterventionType;
  triggerThreshold: number;
  cooldownMinutes: number;
}

export interface LearningTrend {
  pattern: string;
  direction: 'improving' | 'declining' | 'stable';
  confidence: number;
  dataPoints: number;
  timeSpan: string;
  predictedOutcome: 'success' | 'at_risk' | 'failure';
  interventionRecommended: boolean;
}

export interface InterventionTiming {
  optimalDelaySeconds: number;
  confidence: number;
  contextFactors: string[];
  avoidInterruptionScore: number;
}

export interface ConversationAnalysis {
  messageCount: number;
  averageResponseTime: number;
  sentimentScore: number;
  topicCoherence: number;
  helpSeekingBehavior: 'proactive' | 'reactive' | 'resistant';
  strugglesDetected: StrugglePattern[];
  learningTrends: LearningTrend[];
  interventionTiming: InterventionTiming;
}

export interface LearningPatternProfile {
  learnerId: string;
  confusionTendency: number;
  frustrationTolerance: number;
  helpSeekingBehavior: 'proactive' | 'reactive' | 'resistant';
  optimalInterventionTiming: number;
  patternConfidence: number;
  lastAnalyzed: Date;
  conversationsAnalyzed: number;
}

export type InterventionType = 'clarification' | 'encouragement' | 'resource' | 'escalation' | 'break_suggestion';

export class LearningPatternAnalyzer {
  private learningStyleAnalyzer: LearningStyleAnalyzer;
  private readonly MIN_MESSAGES_FOR_PATTERN = 3;
  private readonly CONFIDENCE_THRESHOLD = 0.7;
  private readonly MAX_ANALYSIS_MESSAGES = 20; // Performance constraint

  // Struggle detection patterns
  private readonly STRUGGLE_INDICATORS = {
    confusion: {
      keywords: [
        "don't understand",
        'confused',
        'what do you mean',
        'can you explain',
        'lost',
        "doesn't make sense",
        'unclear',
        'huh',
        'what?',
        "don't get it",
        'still confused',
        'more confused',
        'even more lost',
      ],
      patterns: [
        /i\s+(still\s+)?don'?t\s+(understand|get\s+it)/i,
        /what\s+do\s+you\s+mean/i,
        /can\s+you\s+explain/i,
        /i'?m\s+(still\s+)?(lost|confused)/i,
      ],
      responseLatencyThreshold: 5000, // Long pauses may indicate confusion
      severity: {
        high: ['completely lost', 'totally confused', 'no idea', 'makes no sense'],
        medium: ['confused', 'unclear', "don't understand"],
        low: ['not sure', 'maybe', 'think so'],
      },
    },
    frustration: {
      keywords: [
        'frustrated',
        'annoying',
        'difficult',
        'hard',
        'stuck',
        "can't do this",
        'giving up',
        'tried everything',
        'nothing works',
        'impossible',
        'waste of time',
        'stupid',
        'hate this',
      ],
      patterns: [
        /this\s+is\s+(too\s+)?(hard|difficult)/i,
        /i\s+can'?t\s+do\s+this/i,
        /(giving|give)\s+up/i,
        /nothing\s+works/i,
        /tried\s+everything/i,
      ],
      repetitionThreshold: 3, // Same failed approach multiple times
      severity: {
        high: ['giving up', 'hate this', 'impossible', 'waste of time'],
        medium: ['frustrated', 'stuck', 'difficult'],
        low: ['hard', 'tricky', 'challenging'],
      },
    },
    repetition: {
      similarityThreshold: 0.4, // Jaccard similarity for repeated questions
      timeWindowMinutes: 10,
      minimumRepetitions: 3,
      paraphraseDetection: true,
    },
    engagement_decline: {
      responseTimeIncrease: 2.0, // 2x slower responses
      messageQualityDecrease: 0.3, // Shorter, less thoughtful responses
      sessionDurationDecrease: 0.5, // 50% shorter sessions
      timeWindowDays: 7,
    },
  };

  // Learning trend patterns
  private readonly TREND_INDICATORS = {
    improvement: {
      successRateIncrease: 0.2,
      confidenceIncrease: 0.15,
      questionComplexityIncrease: true,
      helpSeekingDecrease: 0.1,
    },
    decline: {
      successRateDecrease: 0.15,
      confusionIncrease: 0.2,
      frustrationIncrease: 0.1,
      engagementDecrease: 0.25,
    },
  };

  constructor() {
    this.learningStyleAnalyzer = new LearningStyleAnalyzer();
  }

  /**
   * Analyze conversation for struggle patterns and learning trends
   */
  async analyzeConversation(
    messages: Array<{ role: string; content: string; timestamp: Date; responseTime?: number }>,
    learnerProfile?: LearningPatternProfile,
    context?: { pageType?: string; topic?: string; difficulty?: number }
  ): Promise<ConversationAnalysis> {
    if (messages.length < this.MIN_MESSAGES_FOR_PATTERN) {
      return this.getMinimalAnalysis(messages, context);
    }

    // Limit analysis scope for performance
    const recentMessages = messages.slice(-this.MAX_ANALYSIS_MESSAGES);

    const strugglesDetected = await this.detectStrugglePatterns(recentMessages, context);
    const learningTrends = await this.analyzeLearningTrends(recentMessages, learnerProfile);
    const interventionTiming = await this.calculateOptimalTiming(recentMessages, strugglesDetected, context);

    return {
      messageCount: recentMessages.length,
      averageResponseTime: this.calculateAverageResponseTime(recentMessages),
      sentimentScore: this.analyzeSentiment(recentMessages),
      topicCoherence: this.analyzeTopicCoherence(recentMessages),
      helpSeekingBehavior: this.analyzeHelpSeekingBehavior(recentMessages),
      strugglesDetected,
      learningTrends,
      interventionTiming,
    };
  }

  /**
   * Detect specific struggle patterns in conversation
   */
  private async detectStrugglePatterns(
    messages: Array<{ role: string; content: string; timestamp: Date; responseTime?: number }>,
    _context?: { pageType?: string; topic?: string; difficulty?: number }
  ): Promise<StrugglePattern[]> {
    const patterns: StrugglePattern[] = [];
    const userMessages = messages.filter((m) => m.role === 'user');

    // Detect confusion patterns
    const confusionScore = this.detectConfusionPattern(userMessages);
    if (confusionScore.confidence > this.CONFIDENCE_THRESHOLD) {
      patterns.push({
        type: 'confusion',
        confidence: confusionScore.confidence,
        severity: confusionScore.severity,
        indicators: confusionScore.indicators,
        suggestedIntervention: 'clarification',
        triggerThreshold: 0.7,
        cooldownMinutes: 2,
      });
    }

    // Detect frustration patterns
    const frustrationScore = this.detectFrustrationPattern(userMessages);
    if (frustrationScore.confidence > this.CONFIDENCE_THRESHOLD) {
      patterns.push({
        type: 'frustration',
        confidence: frustrationScore.confidence,
        severity: frustrationScore.severity,
        indicators: frustrationScore.indicators,
        suggestedIntervention: frustrationScore.severity === 'critical' ? 'escalation' : 'encouragement',
        triggerThreshold: 0.6,
        cooldownMinutes: 5,
      });
    }

    // Detect repetition patterns
    const repetitionScore = this.detectRepetitionPattern(userMessages);
    if (repetitionScore.confidence > 0.5) {
      // Lower threshold for repetition detection
      patterns.push({
        type: 'repetition',
        confidence: repetitionScore.confidence,
        severity: repetitionScore.severity,
        indicators: repetitionScore.indicators,
        suggestedIntervention: 'resource',
        triggerThreshold: 0.8,
        cooldownMinutes: 3,
      });
    }

    // Detect engagement decline
    const engagementScore = this.detectEngagementDecline(messages);
    if (engagementScore.confidence > 0.5) {
      // Lower threshold for engagement decline
      patterns.push({
        type: 'engagement_decline',
        confidence: engagementScore.confidence,
        severity: engagementScore.severity,
        indicators: engagementScore.indicators,
        suggestedIntervention: 'break_suggestion',
        triggerThreshold: 0.7,
        cooldownMinutes: 10,
      });
    }

    return patterns;
  }

  /**
   * Detect confusion patterns in user messages
   */
  private detectConfusionPattern(userMessages: Array<{ content: string; responseTime?: number }>): {
    confidence: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    indicators: string[];
  } {
    let score = 0;
    const indicators: string[] = [];
    const confusionData = this.STRUGGLE_INDICATORS.confusion;

    for (const message of userMessages) {
      if (!message.content) continue;
      const content = message.content.toLowerCase();

      // Check keywords
      for (const keyword of confusionData.keywords) {
        if (content.includes(keyword)) {
          score += 0.1;
          indicators.push(`Uses confusion keyword: "${keyword}"`);
        }
      }

      // Check patterns
      for (const pattern of confusionData.patterns) {
        if (pattern.test(content)) {
          score += 0.2;
          indicators.push('Uses confusion language pattern');
        }
      }

      // Check response latency
      if (message.responseTime && message.responseTime > confusionData.responseLatencyThreshold) {
        score += 0.15;
        indicators.push('Long response delay indicating processing difficulty');
      }

      // Check severity indicators
      for (const [level, phrases] of Object.entries(confusionData.severity)) {
        for (const phrase of phrases) {
          if (content.includes(phrase)) {
            score += level === 'high' ? 0.3 : level === 'medium' ? 0.2 : 0.1;
            indicators.push(`High-severity confusion: "${phrase}"`);
          }
        }
      }
    }

    const confidence = Math.min(score, 1);
    const severity = confidence > 1.2 ? 'critical' : confidence > 0.8 ? 'high' : confidence > 0.5 ? 'medium' : 'low';

    return { confidence, severity, indicators: indicators.slice(0, 5) };
  }

  /**
   * Detect frustration patterns in user messages
   */
  private detectFrustrationPattern(userMessages: Array<{ content: string }>): {
    confidence: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    indicators: string[];
  } {
    let score = 0;
    const indicators: string[] = [];
    const frustrationData = this.STRUGGLE_INDICATORS.frustration;

    for (const message of userMessages) {
      if (!message.content) continue;
      const content = message.content.toLowerCase();

      // Check keywords
      for (const keyword of frustrationData.keywords) {
        if (content.includes(keyword)) {
          score += 0.1;
          indicators.push(`Frustration keyword: "${keyword}"`);
        }
      }

      // Check patterns
      for (const pattern of frustrationData.patterns) {
        if (pattern.test(content)) {
          score += 0.2;
          indicators.push('Uses frustration language pattern');
        }
      }

      // Check severity
      for (const [level, phrases] of Object.entries(frustrationData.severity)) {
        for (const phrase of phrases) {
          if (content.includes(phrase)) {
            const severityScore = level === 'high' ? 0.4 : level === 'medium' ? 0.2 : 0.1;
            score += severityScore;
            indicators.push(`${level}-level frustration: "${phrase}"`);
          }
        }
      }
    }

    const confidence = Math.min(score, 1);
    const severity = confidence > 0.9 ? 'critical' : confidence > 0.65 ? 'high' : confidence > 0.4 ? 'medium' : 'low';

    return { confidence, severity, indicators: indicators.slice(0, 5) };
  }

  /**
   * Detect repetition patterns in user messages
   */
  private detectRepetitionPattern(userMessages: Array<{ content: string; timestamp: Date }>): {
    confidence: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    indicators: string[];
  } {
    const indicators: string[] = [];
    const repetitionData = this.STRUGGLE_INDICATORS.repetition;

    if (userMessages.length < repetitionData.minimumRepetitions) {
      return { confidence: 0, severity: 'low', indicators: [] };
    }

    let repetitionCount = 0;
    const recentMessages = userMessages.slice(-10); // Check last 10 messages

    // Simple similarity check (could be enhanced with semantic similarity)
    for (let i = 0; i < recentMessages.length - 1; i++) {
      for (let j = i + 1; j < recentMessages.length; j++) {
        if (!recentMessages[i].content || !recentMessages[j].content) continue;
        const similarity = this.calculateStringSimilarity(recentMessages[i].content, recentMessages[j].content);

        if (similarity > repetitionData.similarityThreshold) {
          repetitionCount++;
          indicators.push(`Repeated similar question: "${recentMessages[i].content.substring(0, 50)}..."`);
        }

        // Also check for topic-based similarity (keywords overlap)
        const topicSimilarity = this.calculateTopicSimilarity(recentMessages[i].content, recentMessages[j].content);
        if (topicSimilarity > 0.6) {
          repetitionCount++;
          indicators.push(`Repeated topic question: "${recentMessages[i].content.substring(0, 50)}..."`);
        }
      }
    }

    const confidence = Math.min(repetitionCount * 0.4, 1);
    const severity = confidence > 0.8 ? 'high' : confidence > 0.6 ? 'medium' : 'low';

    return { confidence, severity, indicators: indicators.slice(0, 3) };
  }

  /**
   * Detect engagement decline patterns
   */
  private detectEngagementDecline(messages: Array<{ role: string; content: string; responseTime?: number }>): {
    confidence: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    indicators: string[];
  } {
    const indicators: string[] = [];

    if (messages.length < 5) {
      return { confidence: 0, severity: 'low', indicators: [] };
    }

    const userMessages = messages.filter((m) => m.role === 'user');
    const firstHalf = userMessages.slice(0, Math.floor(userMessages.length / 2));
    const secondHalf = userMessages.slice(Math.floor(userMessages.length / 2));

    let score = 0;

    // Check response time increase
    const firstAvgTime = this.calculateAverageResponseTime(firstHalf);
    const secondAvgTime = this.calculateAverageResponseTime(secondHalf);

    if (secondAvgTime > firstAvgTime * this.STRUGGLE_INDICATORS.engagement_decline.responseTimeIncrease) {
      score += 0.3;
      indicators.push('Response times significantly increased');
    }

    // Check message quality decrease (length as proxy)
    const firstAvgLength = firstHalf.length > 0 ? firstHalf.reduce((sum, m) => sum + (m.content?.length || 0), 0) / firstHalf.length : 0;
    const secondAvgLength =
      secondHalf.length > 0 ? secondHalf.reduce((sum, m) => sum + (m.content?.length || 0), 0) / secondHalf.length : 0;

    if (secondAvgLength < firstAvgLength * (1 - this.STRUGGLE_INDICATORS.engagement_decline.messageQualityDecrease)) {
      score += 0.2;
      indicators.push('Message length and quality decreased');
    }

    // Check for disengagement language
    const disengagementPhrases = ['ok', 'fine', 'whatever', 'sure', 'i guess', 'maybe later'];
    const recentContent = secondHalf.map((m) => m.content?.toLowerCase() || '').join(' ');

    for (const phrase of disengagementPhrases) {
      if (recentContent.includes(phrase)) {
        score += 0.1;
        indicators.push('Shows disengagement language');
        break;
      }
    }

    const confidence = Math.min(score, 1);
    const severity = confidence > 0.8 ? 'critical' : confidence > 0.6 ? 'high' : confidence > 0.4 ? 'medium' : 'low';

    return { confidence, severity, indicators };
  }

  /**
   * Analyze learning trends over time
   */
  private async analyzeLearningTrends(
    messages: Array<{ role: string; content: string; timestamp: Date }>,
    learnerProfile?: LearningPatternProfile
  ): Promise<LearningTrend[]> {
    const trends: LearningTrend[] = [];

    // This would be enhanced with historical data from the database
    // For now, analyze patterns within the conversation

    if (learnerProfile && learnerProfile.conversationsAnalyzed > 5) {
      // Analyze improvement trend
      const improvementScore = this.calculateImprovementTrend(messages);
      if (improvementScore.confidence > 0.6) {
        trends.push({
          pattern: 'learning_acceleration',
          direction: 'improving',
          confidence: improvementScore.confidence,
          dataPoints: messages.length,
          timeSpan: 'current_session',
          predictedOutcome: 'success',
          interventionRecommended: false,
        });
      }

      // Analyze decline trend
      const declineScore = this.calculateDeclineTrend(messages);
      if (declineScore.confidence > 0.6) {
        trends.push({
          pattern: 'learning_difficulty_increase',
          direction: 'declining',
          confidence: declineScore.confidence,
          dataPoints: messages.length,
          timeSpan: 'current_session',
          predictedOutcome: 'at_risk',
          interventionRecommended: true,
        });
      }
    }

    return trends;
  }

  /**
   * Calculate optimal intervention timing
   */
  private async calculateOptimalTiming(
    messages: Array<{ role: string; content: string; timestamp: Date }>,
    struggles: StrugglePattern[],
    context?: { pageType?: string; topic?: string }
  ): Promise<InterventionTiming> {
    const baseDelay = 3; // 3 seconds base delay
    let optimalDelay = baseDelay;
    const contextFactors: string[] = [];
    let avoidInterruptionScore = 0;

    // Adjust timing based on struggle severity
    if (struggles.length > 0) {
      const highestSeverity = struggles.reduce(
        (max, s) => (s.severity === 'critical' ? 4 : s.severity === 'high' ? 3 : s.severity === 'medium' ? 2 : 1),
        0
      );

      if (highestSeverity >= 3) {
        optimalDelay = 1; // Urgent intervention
        contextFactors.push('High severity struggle detected');
      } else if (highestSeverity >= 2) {
        optimalDelay = 2; // Quick intervention
        contextFactors.push('Medium severity struggle detected');
      }
    }

    // Avoid interrupting focused work
    const recentUserMessages = messages.filter((m) => m.role === 'user').slice(-3);

    if (recentUserMessages.length > 0) {
      const latestMessage = recentUserMessages[recentUserMessages.length - 1];
      const messageLength = latestMessage.content?.length || 0;

      if (messageLength > 200) {
        optimalDelay += 5; // Give more time for complex thoughts
        avoidInterruptionScore += 0.3;
        contextFactors.push('User engaged in complex explanation');
      }
    }

    // Adjust for page context
    if (context?.pageType === 'quiz' || context?.pageType === 'exam') {
      optimalDelay += 10; // Don't interrupt during assessments
      avoidInterruptionScore += 0.6;
      contextFactors.push('Assessment in progress');
    }

    const confidence = Math.max(0.5, 1 - struggles.length * 0.1);

    return {
      optimalDelaySeconds: optimalDelay,
      confidence,
      contextFactors,
      avoidInterruptionScore,
    };
  }

  /**
   * Calculate improvement trend
   */
  private calculateImprovementTrend(messages: Array<{ role: string; content: string }>): {
    confidence: number;
  } {
    const userMessages = messages.filter((m) => m.role === 'user');
    const firstHalf = userMessages.slice(0, Math.floor(userMessages.length / 2));
    const secondHalf = userMessages.slice(Math.floor(userMessages.length / 2));

    let score = 0;

    // Check for positive language increase
    const positiveWords = ['understand', 'got it', 'makes sense', 'clear', 'thanks', 'helpful'];
    const firstPositive = this.countWordOccurrences(firstHalf, positiveWords);
    const secondPositive = this.countWordOccurrences(secondHalf, positiveWords);

    if (secondPositive > firstPositive) {
      score += 0.4;
    }

    // Check for question complexity increase
    const firstComplexity = this.calculateMessageComplexity(firstHalf);
    const secondComplexity = this.calculateMessageComplexity(secondHalf);

    if (secondComplexity > firstComplexity) {
      score += 0.3;
    }

    return { confidence: Math.min(score, 1) };
  }

  /**
   * Calculate decline trend
   */
  private calculateDeclineTrend(messages: Array<{ role: string; content: string }>): {
    confidence: number;
  } {
    const userMessages = messages.filter((m) => m.role === 'user');
    const firstHalf = userMessages.slice(0, Math.floor(userMessages.length / 2));
    const secondHalf = userMessages.slice(Math.floor(userMessages.length / 2));

    let score = 0;

    // Check for negative language increase
    const negativeWords = ['confused', "don't understand", 'difficult', 'stuck', 'frustrated'];
    const firstNegative = this.countWordOccurrences(firstHalf, negativeWords);
    const secondNegative = this.countWordOccurrences(secondHalf, negativeWords);

    if (secondNegative > firstNegative) {
      score += 0.5;
    }

    // Check for message quality decrease
    const firstAvgLength = firstHalf.reduce((sum, m) => sum + m.content.length, 0) / firstHalf.length;
    const secondAvgLength = secondHalf.reduce((sum, m) => sum + m.content.length, 0) / secondHalf.length;

    if (secondAvgLength < firstAvgLength * 0.7) {
      score += 0.3;
    }

    return { confidence: Math.min(score, 1) };
  }

  // Utility methods

  private getMinimalAnalysis(
    messages: Array<{ role: string; content: string }>,
    context?: { pageType?: string; topic?: string; difficulty?: number }
  ): ConversationAnalysis {
    return {
      messageCount: messages.length,
      averageResponseTime: 0,
      sentimentScore: 0.5,
      topicCoherence: 0.5,
      helpSeekingBehavior: 'reactive',
      strugglesDetected: [],
      learningTrends: [],
      interventionTiming: {
        optimalDelaySeconds: 3,
        confidence: 0.5,
        contextFactors: context?.pageType
          ? ['Assessment in progress', 'Insufficient data for analysis']
          : ['Insufficient data for analysis'],
        avoidInterruptionScore: context?.pageType === 'quiz' || context?.pageType === 'exam' ? 0.6 : 0,
      },
    };
  }

  private calculateAverageResponseTime(messages: Array<{ responseTime?: number }>): number {
    const validTimes = messages.filter((m) => m.responseTime).map((m) => m.responseTime!);
    return validTimes.length > 0 ? validTimes.reduce((sum, time) => sum + time, 0) / validTimes.length : 0;
  }

  private analyzeSentiment(messages: Array<{ role: string; content: string }>): number {
    const userMessages = messages.filter((m) => m.role === 'user');
    const positiveWords = ['good', 'great', 'thanks', 'helpful', 'understand', 'clear'];
    const negativeWords = ['bad', 'frustrated', 'confused', 'difficult', 'stuck', 'hate'];

    let positiveCount = 0;
    let negativeCount = 0;

    for (const message of userMessages) {
      if (!message.content) continue;
      // const content = message.content.toLowerCase();
      positiveCount += this.countWordOccurrences([message], positiveWords);
      negativeCount += this.countWordOccurrences([message], negativeWords);
    }

    const total = positiveCount + negativeCount;
    return total > 0 ? positiveCount / total : 0.5;
  }

  private analyzeTopicCoherence(messages: Array<{ role: string; content: string }>): number {
    if (messages.length < 2) return 1.0;

    // Simple topic coherence based on word overlap
    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < messages.length - 1; i++) {
      for (let j = i + 1; j < Math.min(i + 4, messages.length); j++) {
        const similarity = this.calculateStringSimilarity(messages[i].content, messages[j].content);
        totalSimilarity += similarity;
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0.5;
  }

  private analyzeHelpSeekingBehavior(messages: Array<{ role: string; content: string }>): 'proactive' | 'reactive' | 'resistant' {
    const userMessages = messages.filter((m) => m.role === 'user');

    const proactiveIndicators = ['can you help', 'i need help', 'could you explain', 'what should i do'];
    const reactiveIndicators = ['ok', 'i see', 'got it', 'yes'];
    const resistantIndicators = ['no', "i don't need help", 'fine', 'whatever'];

    const proactiveCount = this.countPhraseOccurrences(userMessages, proactiveIndicators);
    const reactiveCount = this.countPhraseOccurrences(userMessages, reactiveIndicators);
    const resistantCount = this.countPhraseOccurrences(userMessages, resistantIndicators);

    if (proactiveCount > reactiveCount && proactiveCount > resistantCount) {
      return 'proactive';
    } else if (resistantCount > reactiveCount) {
      return 'resistant';
    }
    return 'reactive';
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    // Simple Jaccard similarity
    if (!str1 || !str2) return 0;
    const words1 = new Set(str1.toLowerCase().split(/\W+/));
    const words2 = new Set(str2.toLowerCase().split(/\W+/));

    const intersection = new Set([...words1].filter((w) => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  private calculateTopicSimilarity(str1: string, str2: string): number {
    // Focus on content words and topic similarity
    if (!str1 || !str2) return 0;

    const stopWords = new Set(['how', 'do', 'i', 'the', 'a', 'an', 'and', 'or', 'but', 'what', 'can', 'you', 'to']);
    const words1 = str1
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));
    const words2 = str2
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));

    if (words1.length === 0 || words2.length === 0) return 0;

    const intersection = words1.filter((w) => words2.includes(w));
    return intersection.length / Math.max(words1.length, words2.length);
  }

  private countWordOccurrences(messages: Array<{ content: string }>, words: string[]): number {
    let count = 0;
    for (const message of messages) {
      if (!message.content) continue;
      const content = message.content.toLowerCase();
      for (const word of words) {
        if (content.includes(word)) {
          count++;
        }
      }
    }
    return count;
  }

  private countPhraseOccurrences(messages: Array<{ content: string }>, phrases: string[]): number {
    let count = 0;
    for (const message of messages) {
      if (!message.content) continue;
      const content = message.content.toLowerCase();
      for (const phrase of phrases) {
        if (content.includes(phrase)) {
          count++;
        }
      }
    }
    return count;
  }

  private calculateMessageComplexity(messages: Array<{ content: string }>): number {
    if (messages.length === 0) return 0;

    let totalComplexity = 0;
    for (const message of messages) {
      const words = message.content.split(/\W+/).filter((w) => w.length > 0);
      const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
      const sentenceCount = message.content.split(/[.!?]+/).length;

      totalComplexity += avgWordLength * sentenceCount;
    }

    return totalComplexity / messages.length;
  }

  /**
   * Update learner pattern profile based on analysis results
   */
  async updateLearnerProfile(currentProfile: LearningPatternProfile, analysis: ConversationAnalysis): Promise<LearningPatternProfile> {
    const updated = { ...currentProfile };

    // Update confusion tendency
    const confusionStruggle = analysis.strugglesDetected.find((s) => s.type === 'confusion');
    if (confusionStruggle) {
      updated.confusionTendency = this.updateMetricWithDecay(updated.confusionTendency, confusionStruggle.confidence, 0.1);
    }

    // Update frustration tolerance
    const frustrationStruggle = analysis.strugglesDetected.find((s) => s.type === 'frustration');
    if (frustrationStruggle) {
      updated.frustrationTolerance = this.updateMetricWithDecay(updated.frustrationTolerance, 1 - frustrationStruggle.confidence, 0.1);
    }

    // Update help-seeking behavior
    updated.helpSeekingBehavior = analysis.helpSeekingBehavior;

    // Update optimal intervention timing
    updated.optimalInterventionTiming = Math.round(
      (updated.optimalInterventionTiming + analysis.interventionTiming.optimalDelaySeconds) / 2
    );

    // Update pattern confidence
    updated.patternConfidence = Math.min(updated.patternConfidence + 0.05, 0.95);

    updated.conversationsAnalyzed++;
    updated.lastAnalyzed = new Date();

    return updated;
  }

  private updateMetricWithDecay(current: number, newValue: number, learningRate: number): number {
    return current * (1 - learningRate) + newValue * learningRate;
  }
}
