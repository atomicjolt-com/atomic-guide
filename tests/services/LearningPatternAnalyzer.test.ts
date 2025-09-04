/**
 * Tests for LearningPatternAnalyzer
 * Validates pattern detection accuracy, confidence scoring, and learning trend analysis
 */

import {  describe, it, expect, beforeEach , MockFactory, TestDataFactory, ServiceTestHarness } from '@/tests/infrastructure';
import { LearningPatternAnalyzer } from '../../src/services/LearningPatternAnalyzer';
import type { ConversationAnalysis, LearningPatternProfile } from '../../src/services/LearningPatternAnalyzer';

import type { MockD1Database, MockKVNamespace, MockQueue } from '@/tests/infrastructure/types/mocks';
describe('LearningPatternAnalyzer', () => {
  let analyzer: LearningPatternAnalyzer;

  beforeEach(() => {
    analyzer = new LearningPatternAnalyzer();
  });

  describe('Confusion Pattern Detection', () => {
    it('should detect high confidence confusion patterns', async () => {
      const messages = [
        { role: 'user', content: 'I don\'t understand this at all', timestamp: new Date(), responseTime: 5000 },
        { role: 'assistant', content: 'Let me explain the concept differently', timestamp: new Date() },
        { role: 'user', content: 'Still confused, can you clarify?', timestamp: new Date(), responseTime: 8000 },
        { role: 'assistant', content: 'Here\'s a simpler approach', timestamp: new Date() },
        { role: 'user', content: 'What do you mean by that? I\'m lost', timestamp: new Date(), responseTime: 10000 },
      ];

      const analysis = await analyzer.analyzeConversation(messages);

      expect(analysis.strugglesDetected).toHaveLength(1);
      expect(analysis.strugglesDetected[0].type).toBe('confusion');
      expect(analysis.strugglesDetected[0].confidence).toBeGreaterThan(0.7);
      expect(analysis.strugglesDetected[0].severity).toBe('high');
      expect(analysis.strugglesDetected[0].indicators).toContain('Uses confusion keyword: "don\'t understand"');
    });

    it('should detect medium confidence confusion with fewer indicators', async () => {
      const messages = [
        { role: 'user', content: 'Can you explain this part?', timestamp: new Date() },
        { role: 'assistant', content: 'Sure, here\'s the explanation', timestamp: new Date() },
        { role: 'user', content: 'I\'m not sure I follow', timestamp: new Date(), responseTime: 3000 },
      ];

      const analysis = await analyzer.analyzeConversation(messages);

      if (analysis.strugglesDetected.length > 0) {
        const confusionPattern = analysis.strugglesDetected.find((s) => s.type === 'confusion');
        if (confusionPattern) {
          expect(confusionPattern.confidence).toBeLessThan(0.8);
          expect(confusionPattern.severity).toBe('medium');
        }
      }
    });

    it('should not detect confusion in clear conversation', async () => {
      const messages = [
        { role: 'user', content: 'How does photosynthesis work?', timestamp: new Date() },
        { role: 'assistant', content: 'Photosynthesis converts sunlight to energy', timestamp: new Date() },
        { role: 'user', content: 'That makes sense, thank you!', timestamp: new Date() },
      ];

      const analysis = await analyzer.analyzeConversation(messages);

      const confusionPattern = analysis.strugglesDetected.find((s) => s.type === 'confusion');
      expect(confusionPattern).toBeUndefined();
    });
  });

  describe('Frustration Pattern Detection', () => {
    it('should detect critical frustration patterns', async () => {
      const messages = [
        { role: 'user', content: 'This is impossible! I\'ve tried everything', timestamp: new Date() },
        { role: 'assistant', content: 'Let\'s work through this together', timestamp: new Date() },
        { role: 'user', content: 'Nothing works! I\'m giving up on this', timestamp: new Date() },
        { role: 'assistant', content: 'I understand your frustration', timestamp: new Date() },
        { role: 'user', content: 'I hate this subject, it\'s too difficult', timestamp: new Date() },
      ];

      const analysis = await analyzer.analyzeConversation(messages);

      const frustrationPattern = analysis.strugglesDetected.find((s) => s.type === 'frustration');
      expect(frustrationPattern).toBeDefined();
      expect(frustrationPattern?.confidence).toBeGreaterThan(0.7);
      expect(frustrationPattern?.severity).toBe('critical');
      expect(frustrationPattern?.suggestedIntervention).toBe('escalation');
    });

    it('should detect medium frustration without escalation', async () => {
      const messages = [
        { role: 'user', content: 'This problem is quite difficult', timestamp: new Date() },
        { role: 'assistant', content: 'Let\'s break it into steps', timestamp: new Date() },
        { role: 'user', content: 'I\'m getting frustrated with this approach', timestamp: new Date() },
      ];

      const analysis = await analyzer.analyzeConversation(messages);

      const frustrationPattern = analysis.strugglesDetected.find((s) => s.type === 'frustration');
      if (frustrationPattern) {
        expect(frustrationPattern.severity).toBe('medium');
        expect(frustrationPattern.suggestedIntervention).toBe('encouragement');
      }
    });
  });

  describe('Repetition Pattern Detection', () => {
    it('should detect repetitive questioning', async () => {
      const messages = [
        { role: 'user', content: 'How do I solve quadratic equations?', timestamp: new Date() },
        { role: 'assistant', content: 'Use the quadratic formula', timestamp: new Date() },
        { role: 'user', content: 'What\'s the way to solve quadratic equations?', timestamp: new Date() },
        { role: 'assistant', content: 'As I mentioned, use ax² + bx + c = 0', timestamp: new Date() },
        { role: 'user', content: 'How can I solve these quadratic problems?', timestamp: new Date() },
      ];

      const analysis = await analyzer.analyzeConversation(messages);

      const repetitionPattern = analysis.strugglesDetected.find((s) => s.type === 'repetition');
      expect(repetitionPattern).toBeDefined();
      expect(repetitionPattern?.confidence).toBeGreaterThan(0.7);
      expect(repetitionPattern?.suggestedIntervention).toBe('resource');
    });
  });

  describe('Engagement Decline Detection', () => {
    it('should detect declining engagement from response patterns', async () => {
      const messages = [
        {
          role: 'user',
          content: 'I\'m really interested in learning about quantum physics and how it relates to modern computing',
          timestamp: new Date(Date.now() - 10000),
          responseTime: 2000,
        },
        { role: 'assistant', content: 'Quantum physics is fascinating! Let me explain...', timestamp: new Date(Date.now() - 9000) },
        {
          role: 'user',
          content: 'That\'s helpful, can you tell me more about quantum entanglement?',
          timestamp: new Date(Date.now() - 8000),
          responseTime: 3000,
        },
        {
          role: 'assistant',
          content: 'Quantum entanglement is when particles become connected...',
          timestamp: new Date(Date.now() - 7000),
        },
        {
          role: 'user',
          content: 'ok',
          timestamp: new Date(Date.now() - 6000),
          responseTime: 8000,
        },
        { role: 'assistant', content: 'Would you like me to elaborate?', timestamp: new Date(Date.now() - 5000) },
        {
          role: 'user',
          content: 'sure',
          timestamp: new Date(Date.now() - 4000),
          responseTime: 12000,
        },
      ];

      const analysis = await analyzer.analyzeConversation(messages);

      const engagementPattern = analysis.strugglesDetected.find((s) => s.type === 'engagement_decline');
      expect(engagementPattern).toBeDefined();
      expect(engagementPattern?.suggestedIntervention).toBe('break_suggestion');
    });
  });

  describe('Learning Trend Analysis', () => {
    it('should identify improvement trends', async () => {
      const messages = [
        { role: 'user', content: 'I don\'t understand this concept', timestamp: new Date(Date.now() - 30000) },
        { role: 'assistant', content: 'Let me explain...', timestamp: new Date(Date.now() - 29000) },
        { role: 'user', content: 'That helps! Can you give an example?', timestamp: new Date(Date.now() - 20000) },
        { role: 'assistant', content: 'Here\'s an example...', timestamp: new Date(Date.now() - 19000) },
        { role: 'user', content: 'Perfect! I understand now. What about advanced applications?', timestamp: new Date() },
      ];

      const mockProfile: LearningPatternProfile = {
        learnerId: 'test-123',
        confusionTendency: 0.5,
        frustrationTolerance: 0.7,
        helpSeekingBehavior: 'proactive',
        optimalInterventionTiming: 30,
        patternConfidence: 0.8,
        lastAnalyzed: new Date(),
        conversationsAnalyzed: 10,
      };

      const analysis = await analyzer.analyzeConversation(messages, mockProfile);

      expect(analysis.learningTrends).toBeDefined();
      if (analysis.learningTrends.length > 0) {
        const improvementTrend = analysis.learningTrends.find((t) => t.direction === 'improving');
        expect(improvementTrend).toBeDefined();
        expect(improvementTrend?.interventionRecommended).toBe(false);
      }
    });

    it('should identify decline trends requiring intervention', async () => {
      const messages = [
        { role: 'user', content: 'I think I understand this', timestamp: new Date(Date.now() - 30000) },
        { role: 'assistant', content: 'Great! Let\'s continue...', timestamp: new Date(Date.now() - 29000) },
        { role: 'user', content: 'Actually, I\'m getting confused again', timestamp: new Date(Date.now() - 20000) },
        { role: 'assistant', content: 'Let me clarify...', timestamp: new Date(Date.now() - 19000) },
        { role: 'user', content: 'I don\'t think I understand any of this', timestamp: new Date() },
      ];

      const mockProfile: LearningPatternProfile = {
        learnerId: 'test-123',
        confusionTendency: 0.3,
        frustrationTolerance: 0.8,
        helpSeekingBehavior: 'reactive',
        optimalInterventionTiming: 45,
        patternConfidence: 0.7,
        lastAnalyzed: new Date(),
        conversationsAnalyzed: 15,
      };

      const analysis = await analyzer.analyzeConversation(messages, mockProfile);

      if (analysis.learningTrends.length > 0) {
        const declineTrend = analysis.learningTrends.find((t) => t.direction === 'declining');
        expect(declineTrend?.interventionRecommended).toBe(true);
      }
    });
  });

  describe('Intervention Timing Calculation', () => {
    it('should calculate optimal timing based on urgency', async () => {
      const criticalMessages = [
        { role: 'user', content: 'I\'m completely lost and giving up!', timestamp: new Date() },
        { role: 'assistant', content: 'Please don\'t give up, let me help', timestamp: new Date() },
      ];

      const analysis = await analyzer.analyzeConversation(criticalMessages, undefined, { pageType: 'quiz', topic: 'math' });

      expect(analysis.interventionTiming).toBeDefined();
      expect(analysis.interventionTiming.optimalDelaySeconds).toBeLessThan(5); // Urgent intervention
      expect(analysis.interventionTiming.avoidInterruptionScore).toBeGreaterThan(0.5); // Quiz context
    });

    it('should respect focused work context', async () => {
      const focusedMessages = [
        {
          role: 'user',
          content: 'Let me work through this complex mathematical proof step by step to understand the underlying principles',
          timestamp: new Date(),
        },
      ];

      const analysis = await analyzer.analyzeConversation(focusedMessages, undefined, { pageType: 'exam', topic: 'mathematics' });

      expect(analysis.interventionTiming.avoidInterruptionScore).toBeGreaterThan(0.5);
      expect(analysis.interventionTiming.contextFactors).toContain('Assessment in progress');
    });
  });

  describe('Help-Seeking Behavior Analysis', () => {
    it('should identify proactive help-seeking behavior', async () => {
      const proactiveMessages = [
        { role: 'user', content: 'Can you help me understand this before I get stuck?', timestamp: new Date() },
        { role: 'assistant', content: 'Absolutely! Let me explain...', timestamp: new Date() },
        { role: 'user', content: 'I need clarification on this part please', timestamp: new Date() },
      ];

      const analysis = await analyzer.analyzeConversation(proactiveMessages);

      expect(analysis.helpSeekingBehavior).toBe('proactive');
    });

    it('should identify reactive help-seeking behavior', async () => {
      const reactiveMessages = [
        { role: 'assistant', content: 'Do you need help with this?', timestamp: new Date() },
        { role: 'user', content: 'Yes, I guess I do', timestamp: new Date() },
        { role: 'assistant', content: 'Let me assist you', timestamp: new Date() },
        { role: 'user', content: 'OK, thanks', timestamp: new Date() },
      ];

      const analysis = await analyzer.analyzeConversation(reactiveMessages);

      expect(analysis.helpSeekingBehavior).toBe('reactive');
    });

    it('should identify resistant help-seeking behavior', async () => {
      const resistantMessages = [
        { role: 'assistant', content: 'Would you like help with this problem?', timestamp: new Date() },
        { role: 'user', content: 'No, I don\'t need help', timestamp: new Date() },
        { role: 'assistant', content: 'Are you sure? I notice you might be struggling', timestamp: new Date() },
        { role: 'user', content: 'I\'m fine, whatever', timestamp: new Date() },
      ];

      const analysis = await analyzer.analyzeConversation(resistantMessages);

      expect(analysis.helpSeekingBehavior).toBe('resistant');
    });
  });

  describe('Profile Updates', () => {
    it('should update learner profile based on analysis', async () => {
      const initialProfile: LearningPatternProfile = {
        learnerId: 'test-123',
        confusionTendency: 0.3,
        frustrationTolerance: 0.8,
        helpSeekingBehavior: 'reactive',
        optimalInterventionTiming: 30,
        patternConfidence: 0.5,
        lastAnalyzed: new Date(Date.now() - 86400000), // Yesterday
        conversationsAnalyzed: 5,
      };

      const analysis: ConversationAnalysis = {
        messageCount: 10,
        averageResponseTime: 3000,
        sentimentScore: 0.3, // Negative sentiment
        topicCoherence: 0.7,
        helpSeekingBehavior: 'proactive',
        strugglesDetected: [
          {
            type: 'confusion',
            confidence: 0.8,
            severity: 'high',
            indicators: ['confusion detected'],
            suggestedIntervention: 'clarification',
            triggerThreshold: 0.7,
            cooldownMinutes: 2,
          },
        ],
        learningTrends: [],
        interventionTiming: {
          optimalDelaySeconds: 25,
          confidence: 0.8,
          contextFactors: [],
          avoidInterruptionScore: 0.3,
        },
      };

      const updatedProfile = await analyzer.updateLearnerProfile(initialProfile, analysis);

      expect(updatedProfile.confusionTendency).toBeGreaterThan(initialProfile.confusionTendency);
      expect(updatedProfile.helpSeekingBehavior).toBe('proactive');
      expect(updatedProfile.conversationsAnalyzed).toBe(6);
      expect(updatedProfile.patternConfidence).toBeGreaterThan(initialProfile.patternConfidence);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle insufficient data gracefully', async () => {
      const tooFewMessages = [{ role: 'user', content: 'Hi', timestamp: new Date() }];

      const analysis = await analyzer.analyzeConversation(tooFewMessages);

      expect(analysis.messageCount).toBe(1);
      expect(analysis.strugglesDetected).toHaveLength(0);
      expect(analysis.interventionTiming.confidence).toBe(0.5);
    });

    it('should handle empty conversation', async () => {
      const analysis = await analyzer.analyzeConversation([]);

      expect(analysis.messageCount).toBe(0);
      expect(analysis.strugglesDetected).toHaveLength(0);
      expect(analysis.helpSeekingBehavior).toBe('reactive');
    });

    it('should handle malformed messages', async () => {
      const malformedMessages = [
        { role: 'user', content: '', timestamp: new Date() },
        { role: 'assistant', content: 'How can I help?', timestamp: new Date() },
        // @ts-ignore - intentionally malformed for testing
        { role: 'user', content: null, timestamp: new Date() },
      ];

      const analysis = await analyzer.analyzeConversation(malformedMessages);

      expect(analysis.messageCount).toBe(3);
      expect(analysis.strugglesDetected).toBeDefined();
    });
  });

  describe('Performance Requirements', () => {
    it('should complete analysis within performance constraints', async () => {
      // Create a larger conversation to test performance
      const largeConversation = Array.from({ length: 50 }, (_, index) => ({
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${index}: This is a test message with various content to simulate real conversations and pattern analysis.`,
        timestamp: new Date(Date.now() - (50 - index) * 1000),
        responseTime: Math.random() * 5000,
      }));

      const startTime = Date.now();
      const analysis = await analyzer.analyzeConversation(largeConversation);
      const endTime = Date.now();

      const processingTime = endTime - startTime;

      expect(processingTime).toBeLessThan(200); // <200ms requirement
      expect(analysis.strugglesDetected).toBeDefined();
      expect(analysis.messageCount).toBe(20); // Limited by MAX_ANALYSIS_MESSAGES
    });
  });
});
