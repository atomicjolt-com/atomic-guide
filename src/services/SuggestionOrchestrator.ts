/**
 * Suggestion Orchestrator
 * Manages suggestion timing, queue, and context to prevent spam and optimize user experience.
 * Implements intelligent cooldown periods, interruption prevention, and suggestion prioritization.
 */

import { Suggestion } from './SuggestionEngine';
import { StrugglePattern, ConversationAnalysis, LearningPatternProfile } from './LearningPatternAnalyzer';

export interface SuggestionQueue {
  id: string;
  tenantId: string;
  learnerId: string;
  conversationId: string;
  suggestionData: EnhancedSuggestion;
  priorityScore: number;
  scheduledFor: Date;
  status: 'pending' | 'shown' | 'dismissed' | 'expired' | 'cancelled';
  createdAt: Date;
  expiresAt: Date;
}

export interface EnhancedSuggestion extends Suggestion {
  confidence: number;
  triggerPattern: string;
  triggerReason: string;
  contextData: {
    pageType?: string;
    topic?: string;
    conversationLength: number;
    lastSuggestionAt?: Date;
    userEngagementScore: number;
  };
  actions: SuggestionAction[];
  displaySettings: {
    urgency: 'low' | 'medium' | 'high' | 'critical';
    displayDurationSeconds: number;
    allowDismiss: boolean;
    requireFeedback: boolean;
  };
}

export interface SuggestionAction {
  type: 'prompt' | 'resource' | 'escalation' | 'practice' | 'break';
  label: string;
  data: any;
  icon?: string;
  analytics?: {
    trackingId: string;
    expectedOutcome: string;
  };
}

export interface SuggestionPreferences {
  frequency: 'high' | 'medium' | 'low' | 'off';
  patternTrackingEnabled: boolean;
  preferredSuggestionTypes: string[];
  interruptionThreshold: number; // 0-1, higher = less interruption
  escalationConsent: boolean;
  cooldownMinutes: number;
}

export interface SuggestionContext {
  pageType?: string;
  topic?: string;
  difficulty?: number;
  userFocusScore: number; // 0-1, higher = more focused
  conversationFlowState: 'starting' | 'engaged' | 'struggling' | 'concluding';
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  sessionDuration: number; // minutes
}

export interface CooldownRule {
  type: string;
  durationMinutes: number;
  conditions: string[];
}

export class SuggestionOrchestrator {
  private readonly DEFAULT_COOLDOWN_MINUTES = 2;
  private readonly MAX_QUEUE_SIZE = 5;
  private readonly PERFORMANCE_TARGET_MS = 200; // <200ms requirement
  private readonly INTERRUPTION_THRESHOLD = 0.7;

  // Cooldown rules by suggestion type
  private readonly COOLDOWN_RULES: Record<string, CooldownRule[]> = {
    confusion: [
      { type: 'same_type', durationMinutes: 2, conditions: ['same_pattern'] },
      { type: 'any_type', durationMinutes: 1, conditions: ['recent_activity'] },
    ],
    frustration: [
      { type: 'same_type', durationMinutes: 5, conditions: ['high_severity'] },
      { type: 'same_type', durationMinutes: 3, conditions: ['medium_severity'] },
      { type: 'escalation', durationMinutes: 15, conditions: ['escalation_triggered'] },
    ],
    repetition: [
      { type: 'same_type', durationMinutes: 3, conditions: ['pattern_detected'] },
      { type: 'resource', durationMinutes: 5, conditions: ['resource_suggested'] },
    ],
    engagement_decline: [
      { type: 'break_suggestion', durationMinutes: 10, conditions: ['break_suggested'] },
      { type: 'any_type', durationMinutes: 5, conditions: ['low_engagement'] },
    ],
  };

  private suggestionQueue: Map<string, SuggestionQueue[]> = new Map();
  private lastSuggestionTimes: Map<string, Map<string, Date>> = new Map();

  constructor(private db: any) {}

  /**
   * Process conversation analysis and generate prioritized suggestions
   */
  async processSuggestions(
    analysis: ConversationAnalysis,
    learnerProfile: LearningPatternProfile,
    preferences: SuggestionPreferences,
    context: SuggestionContext,
    tenantId: string,
    learnerId: string,
    conversationId: string
  ): Promise<EnhancedSuggestion[]> {
    const startTime = Date.now();

    // Quick exit if suggestions disabled
    if (preferences.frequency === 'off' || !preferences.patternTrackingEnabled) {
      return [];
    }

    // Check if user is too focused to interrupt
    if (this.shouldAvoidInterruption(context, preferences)) {
      return [];
    }

    // Generate candidate suggestions from struggles
    const candidateSuggestions = await this.generateCandidateSuggestions(analysis, learnerProfile, context);

    // Filter by cooldown rules
    const availableSuggestions = await this.filterByCooldowns(candidateSuggestions, tenantId, learnerId);

    // Prioritize and queue suggestions
    const prioritizedSuggestions = this.prioritizeSuggestions(availableSuggestions, preferences, context);

    // Add to queue with scheduling
    const scheduledSuggestions = await this.scheduleAndQueue(prioritizedSuggestions, tenantId, learnerId, conversationId, context);

    // Ensure performance target
    const processingTime = Date.now() - startTime;
    if (processingTime > this.PERFORMANCE_TARGET_MS) {
      console.warn(`Suggestion processing took ${processingTime}ms, exceeding ${this.PERFORMANCE_TARGET_MS}ms target`);
    }

    return scheduledSuggestions.slice(0, 1); // Return only next suggestion to avoid UI clutter
  }

  /**
   * Generate candidate suggestions from analysis
   */
  private async generateCandidateSuggestions(
    analysis: ConversationAnalysis,
    learnerProfile: LearningPatternProfile,
    context: SuggestionContext
  ): Promise<EnhancedSuggestion[]> {
    const suggestions: EnhancedSuggestion[] = [];

    for (const struggle of analysis.strugglesDetected) {
      const suggestion = await this.createSuggestionFromStruggle(struggle, analysis, context);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    // Add opportunity-based suggestions
    if (analysis.sentimentScore > 0.7 && context.conversationFlowState === 'engaged') {
      const opportunitySuggestion = this.createSuccessOpportunitySuggestion(analysis, context);
      if (opportunitySuggestion) {
        suggestions.push(opportunitySuggestion);
      }
    }

    return suggestions;
  }

  /**
   * Create suggestion from detected struggle pattern
   */
  private async createSuggestionFromStruggle(
    struggle: StrugglePattern,
    analysis: ConversationAnalysis,
    context: SuggestionContext
  ): Promise<EnhancedSuggestion | null> {
    const baseId = `${struggle.type}-${Date.now()}`;

    switch (struggle.type) {
      case 'confusion':
        return {
          id: baseId,
          type: 'clarification',
          title: 'Need clarification?',
          description: 'I noticed you might be confused about this concept',
          priority: this.calculatePriority(struggle, context),
          confidence: struggle.confidence,
          triggerPattern: struggle.type,
          triggerReason: `${struggle.severity} level confusion detected`,
          contextData: {
            pageType: context.pageType,
            topic: context.topic,
            conversationLength: analysis.messageCount,
            userEngagementScore: context.userFocusScore,
          },
          actions: [
            {
              type: 'prompt',
              label: 'Explain simply',
              data: 'Can you explain this in simpler terms with an example?',
              icon: '💡',
            },
            {
              type: 'resource',
              label: 'See examples',
              data: `/examples/${context.topic || 'general'}`,
              icon: '📚',
            },
          ],
          displaySettings: {
            urgency: struggle.severity === 'critical' ? 'critical' : struggle.severity === 'high' ? 'high' : 'medium',
            displayDurationSeconds: 30,
            allowDismiss: true,
            requireFeedback: struggle.severity === 'high' || struggle.severity === 'critical',
          },
        };

      case 'frustration':
        return {
          id: baseId,
          type: 'help',
          title: struggle.severity === 'critical' ? "Let's get you some help" : 'Take a different approach',
          description:
            struggle.severity === 'critical'
              ? "It seems like you're really struggling. Let's get you the support you need."
              : "Let's try solving this step by step together",
          priority: this.calculatePriority(struggle, context),
          confidence: struggle.confidence,
          triggerPattern: struggle.type,
          triggerReason: `${struggle.severity} level frustration detected`,
          contextData: {
            pageType: context.pageType,
            topic: context.topic,
            conversationLength: analysis.messageCount,
            userEngagementScore: context.userFocusScore,
          },
          actions:
            struggle.severity === 'critical'
              ? [
                  {
                    type: 'escalation',
                    label: 'Get instructor help',
                    data: { escalationType: 'immediate', reason: 'high_frustration' },
                    icon: '🆘',
                  },
                  {
                    type: 'break',
                    label: 'Take a break',
                    data: 'Sometimes stepping away helps. Your progress is saved.',
                    icon: '☕',
                  },
                ]
              : [
                  {
                    type: 'prompt',
                    label: 'Work together',
                    data: 'Can we work through this problem together step by step?',
                    icon: '🤝',
                  },
                  {
                    type: 'practice',
                    label: 'Try easier version',
                    data: { difficulty: 'beginner', topic: context.topic },
                    icon: '🎯',
                  },
                ],
          displaySettings: {
            urgency: struggle.severity === 'critical' ? 'critical' : 'high',
            displayDurationSeconds: struggle.severity === 'critical' ? 60 : 45,
            allowDismiss: struggle.severity !== 'critical',
            requireFeedback: true,
          },
        };

      case 'repetition':
        return {
          id: baseId,
          type: 'clarification',
          title: 'Try a different question',
          description: "It looks like you're asking similar questions. Let me help you rephrase.",
          priority: this.calculatePriority(struggle, context),
          confidence: struggle.confidence,
          triggerPattern: struggle.type,
          triggerReason: 'Repetitive question pattern detected',
          contextData: {
            pageType: context.pageType,
            topic: context.topic,
            conversationLength: analysis.messageCount,
            userEngagementScore: context.userFocusScore,
          },
          actions: [
            {
              type: 'prompt',
              label: 'Rephrase question',
              data: 'Can you help me rephrase my question to get better results?',
              icon: '🔄',
            },
            {
              type: 'resource',
              label: 'Review fundamentals',
              data: '/fundamentals',
              icon: '📖',
            },
          ],
          displaySettings: {
            urgency: 'medium',
            displayDurationSeconds: 25,
            allowDismiss: true,
            requireFeedback: false,
          },
        };

      case 'engagement_decline':
        return {
          id: baseId,
          type: 'help',
          title: 'Need a break?',
          description: "You've been working hard. Sometimes a short break helps with learning.",
          priority: this.calculatePriority(struggle, context),
          confidence: struggle.confidence,
          triggerPattern: struggle.type,
          triggerReason: 'Engagement decline detected',
          contextData: {
            pageType: context.pageType,
            topic: context.topic,
            conversationLength: analysis.messageCount,
            userEngagementScore: context.userFocusScore,
          },
          actions: [
            {
              type: 'break',
              label: 'Save and take a break',
              data: 'Your progress is saved. Research shows breaks improve retention.',
              icon: '🌟',
            },
            {
              type: 'prompt',
              label: 'Summarize what we learned',
              data: "Would you like me to summarize what we've covered so far?",
              icon: '📝',
            },
          ],
          displaySettings: {
            urgency: 'low',
            displayDurationSeconds: 35,
            allowDismiss: true,
            requireFeedback: false,
          },
        };

      default:
        return null;
    }
  }

  /**
   * Create success opportunity suggestion
   */
  private createSuccessOpportunitySuggestion(analysis: ConversationAnalysis, context: SuggestionContext): EnhancedSuggestion {
    return {
      id: `success-${Date.now()}`,
      type: 'next-step',
      title: "You're doing great!",
      description: 'Ready to try something more challenging?',
      priority: 5, // Lower priority than struggle-based suggestions
      confidence: 0.8,
      triggerPattern: 'success_opportunity',
      triggerReason: 'High sentiment score and engagement detected',
      contextData: {
        pageType: context.pageType,
        topic: context.topic,
        conversationLength: analysis.messageCount,
        userEngagementScore: context.userFocusScore,
      },
      actions: [
        {
          type: 'practice',
          label: 'Try advanced problems',
          data: { difficulty: 'advanced', topic: context.topic },
          icon: '🚀',
        },
        {
          type: 'resource',
          label: 'Explore related topics',
          data: `/topics/related/${context.topic}`,
          icon: '🔍',
        },
      ],
      displaySettings: {
        urgency: 'low',
        displayDurationSeconds: 20,
        allowDismiss: true,
        requireFeedback: false,
      },
    };
  }

  /**
   * Filter suggestions by cooldown rules
   */
  private async filterByCooldowns(suggestions: EnhancedSuggestion[], tenantId: string, learnerId: string): Promise<EnhancedSuggestion[]> {
    const filtered: EnhancedSuggestion[] = [];
    const learnerKey = `${tenantId}:${learnerId}`;
    const lastSuggestions = this.lastSuggestionTimes.get(learnerKey) || new Map();

    for (const suggestion of suggestions) {
      const cooldownRules = this.COOLDOWN_RULES[suggestion.triggerPattern] || [];
      let blocked = false;

      for (const rule of cooldownRules) {
        const lastTime = lastSuggestions.get(rule.type);
        if (lastTime) {
          const minutesAgo = (Date.now() - lastTime.getTime()) / (1000 * 60);
          if (minutesAgo < rule.durationMinutes) {
            blocked = true;
            break;
          }
        }
      }

      if (!blocked) {
        filtered.push(suggestion);
      }
    }

    return filtered;
  }

  /**
   * Prioritize suggestions based on context and preferences
   */
  private prioritizeSuggestions(
    suggestions: EnhancedSuggestion[],
    preferences: SuggestionPreferences,
    context: SuggestionContext
  ): EnhancedSuggestion[] {
    return suggestions
      .map((suggestion) => ({
        ...suggestion,
        priority: this.recalculatePriority(suggestion, preferences, context),
      }))
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Schedule and queue suggestions with optimal timing
   */
  private async scheduleAndQueue(
    suggestions: EnhancedSuggestion[],
    tenantId: string,
    learnerId: string,
    conversationId: string,
    context: SuggestionContext
  ): Promise<EnhancedSuggestion[]> {
    const now = new Date();
    const scheduled: EnhancedSuggestion[] = [];

    for (let i = 0; i < Math.min(suggestions.length, 2); i++) {
      const suggestion = suggestions[i];

      // Calculate optimal delay based on urgency and context
      const delaySeconds = this.calculateOptimalDelay(suggestion, context, i);
      const scheduledFor = new Date(now.getTime() + delaySeconds * 1000);

      // Add to queue
      const queueItem: SuggestionQueue = {
        id: `queue-${suggestion.id}`,
        tenantId,
        learnerId,
        conversationId,
        suggestionData: suggestion,
        priorityScore: suggestion.priority,
        scheduledFor,
        status: 'pending',
        createdAt: now,
        expiresAt: new Date(scheduledFor.getTime() + suggestion.displaySettings.displayDurationSeconds * 1000),
      };

      // Store in database for persistence
      await this.storeSuggestionQueue(queueItem);

      // Add to memory queue
      const learnerQueue = this.suggestionQueue.get(learnerId) || [];
      learnerQueue.push(queueItem);
      this.suggestionQueue.set(learnerId, learnerQueue);

      scheduled.push(suggestion);
    }

    return scheduled;
  }

  /**
   * Check if we should avoid interrupting the user
   */
  private shouldAvoidInterruption(context: SuggestionContext, preferences: SuggestionPreferences): boolean {
    // Check user focus score
    if (context.userFocusScore > preferences.interruptionThreshold) {
      return true;
    }

    // Avoid interrupting during assessments
    if (context.pageType === 'quiz' || context.pageType === 'exam') {
      return true;
    }

    // Avoid interrupting if conversation is just starting
    if (context.conversationFlowState === 'starting') {
      return true;
    }

    return false;
  }

  /**
   * Calculate priority score for suggestion
   */
  private calculatePriority(struggle: StrugglePattern, context: SuggestionContext): number {
    let priority = struggle.confidence * 10; // Base priority from confidence

    // Adjust for severity
    const severityMultiplier = {
      critical: 2.0,
      high: 1.5,
      medium: 1.0,
      low: 0.7,
    };
    priority *= severityMultiplier[struggle.severity];

    // Adjust for context
    if (context.pageType === 'quiz' || context.pageType === 'exam') {
      priority *= 0.5; // Lower priority during assessments
    }

    if (context.userFocusScore < 0.3) {
      priority *= 1.2; // Higher priority for disengaged users
    }

    return Math.round(priority);
  }

  /**
   * Recalculate priority based on preferences and context
   */
  private recalculatePriority(suggestion: EnhancedSuggestion, preferences: SuggestionPreferences, _context: SuggestionContext): number {
    let priority = suggestion.priority;

    // Adjust for user preferences
    const frequencyMultiplier = {
      high: 1.2,
      medium: 1.0,
      low: 0.7,
      off: 0,
    };
    priority *= frequencyMultiplier[preferences.frequency];

    // Check if suggestion type is preferred
    if (!preferences.preferredSuggestionTypes.includes(suggestion.triggerPattern)) {
      priority *= 0.5;
    }

    return priority;
  }

  /**
   * Calculate optimal delay for suggestion display
   */
  private calculateOptimalDelay(suggestion: EnhancedSuggestion, context: SuggestionContext, queuePosition: number): number {
    let delay = 3; // Base delay of 3 seconds

    // Adjust for urgency
    const urgencyDelays = {
      critical: 1,
      high: 2,
      medium: 3,
      low: 5,
    };
    delay = urgencyDelays[suggestion.displaySettings.urgency];

    // Add staggering for multiple suggestions
    delay += queuePosition * 5;

    // Adjust for context
    if (context.userFocusScore > 0.7) {
      delay += 3; // Give more time if user is focused
    }

    if (context.conversationFlowState === 'concluding') {
      delay = Math.min(delay, 2); // Show quickly if conversation is ending
    }

    return delay;
  }

  /**
   * Store suggestion queue item in database
   */
  private async storeSuggestionQueue(queueItem: SuggestionQueue): Promise<void> {
    const query = `
      INSERT INTO suggestion_queue 
      (id, tenant_id, learner_id, conversation_id, suggestion_data, priority_score, scheduled_for, status, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db
      .prepare(query)
      .bind(
        queueItem.id,
        queueItem.tenantId,
        queueItem.learnerId,
        queueItem.conversationId,
        JSON.stringify(queueItem.suggestionData),
        queueItem.priorityScore,
        queueItem.scheduledFor.toISOString(),
        queueItem.status,
        queueItem.createdAt.toISOString(),
        queueItem.expiresAt.toISOString()
      )
      .run();
  }

  /**
   * Get next ready suggestion for display
   */
  async getNextSuggestion(tenantId: string, learnerId: string): Promise<EnhancedSuggestion | null> {
    const now = new Date();

    const query = `
      SELECT * FROM suggestion_queue 
      WHERE tenant_id = ? AND learner_id = ? AND status = 'pending' 
        AND scheduled_for <= ? AND expires_at > ?
      ORDER BY priority_score DESC, scheduled_for ASC
      LIMIT 1
    `;

    const result = await this.db.prepare(query).bind(tenantId, learnerId, now.toISOString(), now.toISOString()).first();

    if (!result) {
      return null;
    }

    // Mark as shown
    await this.markSuggestionShown(result.id);

    // Update last suggestion time for cooldown tracking
    const learnerKey = `${tenantId}:${learnerId}`;
    const lastTimes = this.lastSuggestionTimes.get(learnerKey) || new Map();
    lastTimes.set('any_type', now);
    lastTimes.set(JSON.parse(result.suggestion_data).triggerPattern, now);
    this.lastSuggestionTimes.set(learnerKey, lastTimes);

    return JSON.parse(result.suggestion_data);
  }

  /**
   * Mark suggestion as shown
   */
  private async markSuggestionShown(queueId: string): Promise<void> {
    const query = `
      UPDATE suggestion_queue 
      SET status = 'shown' 
      WHERE id = ?
    `;

    await this.db.prepare(query).bind(queueId).run();
  }

  /**
   * Record suggestion feedback
   */
  async recordFeedback(
    suggestionId: string,
    action: 'accepted' | 'dismissed' | 'ignored' | 'timeout',
    feedback?: string,
    _followupBehavior?: string
  ): Promise<void> {
    // This would integrate with the suggestion_logs table
    // const now = new Date();

    const logQuery = `
      INSERT INTO suggestion_logs 
      (id, tenant_id, learner_id, conversation_id, suggestion_type, suggestion_content, 
       triggered_by_pattern, confidence_score, user_action, user_feedback, response_time_ms)
      SELECT 
        ?, tenant_id, learner_id, conversation_id, 
        json_extract(suggestion_data, '$.triggerPattern'),
        suggestion_data,
        json_extract(suggestion_data, '$.triggerPattern'),
        json_extract(suggestion_data, '$.confidence'),
        ?, ?, 
        (julianday('now') - julianday(created_at)) * 24 * 60 * 60 * 1000
      FROM suggestion_queue 
      WHERE suggestion_data->>'$.id' = ?
    `;

    await this.db
      .prepare(logQuery)
      .bind(`log-${suggestionId}`, action, feedback || null, suggestionId)
      .run();
  }

  /**
   * Clean up expired suggestions
   */
  async cleanupExpiredSuggestions(): Promise<void> {
    const now = new Date();

    const query = `
      UPDATE suggestion_queue 
      SET status = 'expired' 
      WHERE status = 'pending' AND expires_at <= ?
    `;

    await this.db.prepare(query).bind(now.toISOString()).run();
  }
}
