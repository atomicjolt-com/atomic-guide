/**
 * @fileoverview Unit tests for AssessmentAIService
 * @module features/ai-assessment/server/services/__tests__/AssessmentAIService.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AssessmentAIService } from '../AssessmentAIService';
import type { ResponseAnalysis } from '../../../shared/types';

// Mock the AI binding and environment
const mockAI = {
  run: vi.fn()
};

const mockEnv = {
  AI: mockAI,
  AI_MODEL: '@cf/meta/llama-3.1-8b-instruct',
  AI_MAX_TOKENS: 2048,
  AI_TEMPERATURE: 0.7
} as any;

describe('AssessmentAIService', () => {
  let service: AssessmentAIService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AssessmentAIService(mockAI as any, mockEnv);
  });

  describe('analyzeStudentResponse', () => {
    it('should analyze a correct student response', async () => {
      const mockAIResponse = {
        response: JSON.stringify({
          understanding: {
            level: 'excellent',
            confidence: 0.92,
            conceptsUnderstood: ['photosynthesis', 'chloroplasts'],
            misconceptions: []
          },
          mastery: {
            achieved: true,
            progress: 0.95,
            nextSteps: ['explore advanced concepts'],
            readyForAdvancement: true
          },
          engagement: {
            level: 'high',
            indicators: ['detailed explanation', 'correct terminology'],
            strugglingSignals: []
          },
          feedback: {
            encouragement: 'Excellent understanding demonstrated!',
            corrections: [],
            hints: [],
            resources: []
          },
          nextQuestion: {
            type: 'advancement',
            difficulty: 4,
            concepts: ['cellular respiration'],
            suggestedQuestion: 'How does cellular respiration relate to photosynthesis?'
          },
          academicIntegrity: {
            authenticity: 'verified',
            similarityFlags: [],
            aiDetectionScore: 0.1,
            temporalAnalysis: {
              responseTime: 120000,
              consistencyScore: 0.95
            }
          }
        })
      };

      mockAI.run.mockResolvedValue(mockAIResponse);

      const result = await service.analyzeStudentResponse(
        'Photosynthesis occurs in chloroplasts where chlorophyll captures light energy to convert CO2 and water into glucose and oxygen.',
        'What is photosynthesis and where does it occur?',
        ['photosynthesis', 'cellular biology'],
        {
          previousResponses: [],
          studentId: 'student123' as any,
          sessionId: 'session123' as any
        }
      );

      expect(result.understanding.level).toBe('excellent');
      expect(result.mastery.achieved).toBe(true);
      expect(result.engagement.level).toBe('high');
      expect(result.academicIntegrity.authenticity).toBe('verified');
      expect(mockAI.run).toHaveBeenCalledWith(
        '@cf/meta/llama-3.1-8b-instruct',
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('assessment AI tutor')
            }),
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Photosynthesis occurs')
            })
          ]),
          max_tokens: 2048,
          temperature: 0.7
        })
      );
    });

    it('should detect misconceptions in student response', async () => {
      const mockAIResponse = {
        response: JSON.stringify({
          understanding: {
            level: 'partial',
            confidence: 0.65,
            conceptsUnderstood: ['photosynthesis basic concept'],
            misconceptions: [
              {
                concept: 'photosynthesis location',
                misconception: 'believes it occurs in mitochondria',
                severity: 'moderate'
              }
            ]
          },
          mastery: {
            achieved: false,
            progress: 0.4,
            nextSteps: ['clarify cellular organelles'],
            readyForAdvancement: false
          },
          engagement: {
            level: 'medium',
            indicators: ['attempted answer'],
            strugglingSignals: ['incorrect organelle']
          },
          feedback: {
            encouragement: 'Good effort! Let me help clarify a few details.',
            corrections: ['Photosynthesis actually occurs in chloroplasts, not mitochondria'],
            hints: ['Think about which organelle contains chlorophyll'],
            resources: ['cell organelle diagram']
          },
          nextQuestion: {
            type: 'remediation',
            difficulty: 2,
            concepts: ['chloroplasts', 'mitochondria'],
            suggestedQuestion: 'Can you tell me the difference between chloroplasts and mitochondria?'
          },
          academicIntegrity: {
            authenticity: 'verified',
            similarityFlags: [],
            aiDetectionScore: 0.15
          }
        })
      };

      mockAI.run.mockResolvedValue(mockAIResponse);

      const result = await service.analyzeStudentResponse(
        'Photosynthesis happens in the mitochondria where plants make energy.',
        'What is photosynthesis and where does it occur?',
        ['photosynthesis', 'cellular biology'],
        {
          previousResponses: [],
          studentId: 'student123' as any,
          sessionId: 'session123' as any
        }
      );

      expect(result.understanding.level).toBe('partial');
      expect(result.understanding.misconceptions).toHaveLength(1);
      expect(result.understanding.misconceptions[0].concept).toBe('photosynthesis location');
      expect(result.mastery.achieved).toBe(false);
      expect(result.feedback.corrections).toContain('Photosynthesis actually occurs in chloroplasts, not mitochondria');
      expect(result.nextQuestion.type).toBe('remediation');
    });

    it('should handle AI service errors gracefully', async () => {
      mockAI.run.mockRejectedValue(new Error('AI service unavailable'));

      await expect(
        service.analyzeStudentResponse(
          'Test response',
          'Test question',
          ['test'],
          {
            previousResponses: [],
            studentId: 'student123' as any,
            sessionId: 'session123' as any
          }
        )
      ).rejects.toThrow('Failed to analyze student response');
    });

    it('should handle malformed AI responses', async () => {
      mockAI.run.mockResolvedValue({ response: 'invalid json' });

      await expect(
        service.analyzeStudentResponse(
          'Test response',
          'Test question',
          ['test'],
          {
            previousResponses: [],
            studentId: 'student123' as any,
            sessionId: 'session123' as any
          }
        )
      ).rejects.toThrow('Failed to analyze student response');
    });
  });

  describe('generateFollowUpQuestion', () => {
    it('should generate advancement question for mastery', async () => {
      const mockAIResponse = {
        response: JSON.stringify({
          question: 'How does cellular respiration complement photosynthesis in plant metabolism?',
          type: 'advancement',
          difficulty: 4,
          concepts: ['cellular respiration', 'metabolic pathways'],
          expectedResponse: 'Should discuss how cellular respiration breaks down glucose produced by photosynthesis',
          hints: ['Consider what happens to glucose after photosynthesis'],
          resources: ['metabolism diagram']
        })
      };

      mockAI.run.mockResolvedValue(mockAIResponse);

      const analysis: ResponseAnalysis = {
        understanding: {
          level: 'excellent',
          confidence: 0.9,
          conceptsUnderstood: ['photosynthesis'],
          misconceptions: []
        },
        mastery: {
          achieved: true,
          progress: 0.9,
          nextSteps: ['explore advanced concepts'],
          readyForAdvancement: true
        },
        engagement: { level: 'high', indicators: [] },
        feedback: { encouragement: 'Great work!' },
        nextQuestion: {
          type: 'advancement',
          difficulty: 4,
          concepts: ['cellular respiration']
        },
        academicIntegrity: { authenticity: 'verified' }
      };

      const result = await service.generateFollowUpQuestion(
        analysis,
        ['cellular respiration', 'metabolic pathways'],
        {
          previousQuestions: [],
          masteryLevel: 0.9,
          sessionId: 'session123' as any
        }
      );

      expect(result.type).toBe('advancement');
      expect(result.difficulty).toBe(4);
      expect(result.concepts).toContain('cellular respiration');
      expect(result.question).toContain('cellular respiration');
    });

    it('should generate remediation question for misconceptions', async () => {
      const mockAIResponse = {
        response: JSON.stringify({
          question: 'Which organelle contains chlorophyll and is responsible for photosynthesis?',
          type: 'remediation',
          difficulty: 2,
          concepts: ['chloroplasts', 'cell organelles'],
          expectedResponse: 'chloroplasts',
          hints: ['This organelle is green due to chlorophyll'],
          resources: ['cell diagram']
        })
      };

      mockAI.run.mockResolvedValue(mockAIResponse);

      const analysis: ResponseAnalysis = {
        understanding: {
          level: 'partial',
          confidence: 0.5,
          conceptsUnderstood: ['photosynthesis basic'],
          misconceptions: [
            {
              concept: 'organelle location',
              misconception: 'mitochondria vs chloroplasts',
              severity: 'moderate'
            }
          ]
        },
        mastery: {
          achieved: false,
          progress: 0.4,
          nextSteps: ['clarify organelles'],
          readyForAdvancement: false
        },
        engagement: { level: 'medium', indicators: [] },
        feedback: { corrections: ['Photosynthesis occurs in chloroplasts'] },
        nextQuestion: {
          type: 'remediation',
          difficulty: 2,
          concepts: ['chloroplasts']
        },
        academicIntegrity: { authenticity: 'verified' }
      };

      const result = await service.generateFollowUpQuestion(
        analysis,
        ['chloroplasts', 'cell organelles'],
        {
          previousQuestions: [],
          masteryLevel: 0.4,
          sessionId: 'session123' as any
        }
      );

      expect(result.type).toBe('remediation');
      expect(result.difficulty).toBe(2);
      expect(result.concepts).toContain('chloroplasts');
    });
  });

  describe('generateEncouragement', () => {
    it('should generate positive encouragement for good performance', async () => {
      const mockAIResponse = {
        response: JSON.stringify({
          message: 'Excellent work! Your understanding of photosynthesis is clearly demonstrated.',
          tone: 'positive',
          personalized: true,
          nextSteps: ['Continue exploring cellular processes']
        })
      };

      mockAI.run.mockResolvedValue(mockAIResponse);

      const result = await service.generateEncouragement(
        'excellent',
        0.9,
        ['detailed response', 'correct terminology'],
        {
          sessionId: 'session123' as any,
          recentPerformance: [0.8, 0.85, 0.9]
        }
      );

      expect(result.message).toContain('Excellent work');
      expect(result.tone).toBe('positive');
      expect(result.personalized).toBe(true);
    });

    it('should generate supportive encouragement for struggling students', async () => {
      const mockAIResponse = {
        response: JSON.stringify({
          message: 'Keep going! Learning takes time, and every attempt helps you understand better.',
          tone: 'supportive',
          personalized: true,
          nextSteps: ['Review the basics', 'Try breaking down the problem']
        })
      };

      mockAI.run.mockResolvedValue(mockAIResponse);

      const result = await service.generateEncouragement(
        'partial',
        0.3,
        ['effort shown', 'some understanding'],
        {
          sessionId: 'session123' as any,
          recentPerformance: [0.2, 0.25, 0.3]
        }
      );

      expect(result.message).toContain('Keep going');
      expect(result.tone).toBe('supportive');
    });
  });

  describe('validateAcademicIntegrity', () => {
    it('should detect suspicious response patterns', async () => {
      const mockAIResponse = {
        response: JSON.stringify({
          authenticity: 'suspicious',
          confidence: 0.75,
          flags: ['response_too_perfect', 'unusual_vocabulary'],
          aiDetectionScore: 0.85,
          recommendedAction: 'flag_for_review',
          explanation: 'Response shows signs of AI generation'
        })
      };

      mockAI.run.mockResolvedValue(mockAIResponse);

      const result = await service.validateAcademicIntegrity(
        'The process of photosynthesis, a fundamental biological mechanism, utilizes chlorophyll-containing organelles...',
        {
          responseTime: 5000, // Very fast response
          previousResponses: [],
          sessionId: 'session123' as any,
          studentId: 'student123' as any
        }
      );

      expect(result.authenticity).toBe('suspicious');
      expect(result.flags).toContain('response_too_perfect');
      expect(result.aiDetectionScore).toBeGreaterThan(0.8);
    });

    it('should verify authentic student responses', async () => {
      const mockAIResponse = {
        response: JSON.stringify({
          authenticity: 'verified',
          confidence: 0.9,
          flags: [],
          aiDetectionScore: 0.15,
          recommendedAction: 'accept',
          explanation: 'Response shows natural student thought patterns'
        })
      };

      mockAI.run.mockResolvedValue(mockAIResponse);

      const result = await service.validateAcademicIntegrity(
        'I think photosynthesis is when plants make food from sunlight. It happens in the green parts.',
        {
          responseTime: 45000, // Reasonable response time
          previousResponses: [],
          sessionId: 'session123' as any,
          studentId: 'student123' as any
        }
      );

      expect(result.authenticity).toBe('verified');
      expect(result.flags).toHaveLength(0);
      expect(result.aiDetectionScore).toBeLessThan(0.3);
    });
  });
});