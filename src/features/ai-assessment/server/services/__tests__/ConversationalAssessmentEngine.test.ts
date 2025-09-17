/**
 * @fileoverview Unit tests for ConversationalAssessmentEngine
 * @module features/ai-assessment/server/services/__tests__/ConversationalAssessmentEngine.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConversationalAssessmentEngine } from '../ConversationalAssessmentEngine';
import type {
  AssessmentSessionConfig,
  AssessmentSession,
  AssessmentSessionId,
  ResponseAnalysis
} from '../../../shared/types';

// Mock dependencies
const mockSessionRepository = {
  createSession: vi.fn(),
  getSession: vi.fn(),
  updateSession: vi.fn(),
  addMessage: vi.fn(),
  querySessions: vi.fn(),
  getAnalytics: vi.fn()
};

const mockAIService = {
  analyzeStudentResponse: vi.fn(),
  generateFollowUpQuestion: vi.fn(),
  generateEncouragement: vi.fn(),
  validateAcademicIntegrity: vi.fn()
};

const mockEnv = {
  ASSESSMENT_SESSION_TIMEOUT: 3600000, // 1 hour
  MAX_SESSION_MESSAGES: 100,
  MASTERY_THRESHOLD: 0.8
} as any;

describe('ConversationalAssessmentEngine', () => {
  let engine: ConversationalAssessmentEngine;
  let mockSessionConfig: AssessmentSessionConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new ConversationalAssessmentEngine(
      mockSessionRepository as any,
      mockAIService as any,
      mockEnv
    );

    mockSessionConfig = {
      configId: 'config123' as any,
      studentId: 'student123' as any,
      courseId: 'course123' as any,
      assessmentTitle: 'Photosynthesis Assessment',
      settings: {
        masteryThreshold: 0.8,
        maxAttempts: 3,
        timeLimit: 60,
        allowHints: true,
        showFeedback: true,
        adaptiveDifficulty: true,
        requireMastery: false
      },
      context: {
        learningObjectives: ['Understand photosynthesis process'],
        concepts: ['photosynthesis', 'chloroplasts', 'cellular respiration'],
        prerequisites: ['basic biology']
      },
      grading: {
        passbackEnabled: true,
        pointsPossible: 100,
        gradingRubric: {
          masteryWeight: 0.7,
          participationWeight: 0.2,
          improvementWeight: 0.1
        }
      }
    };
  });

  describe('initializeSession', () => {
    it('should create and initialize a new assessment session', async () => {
      const mockSession: AssessmentSession = {
        id: 'session123' as any,
        config: mockSessionConfig,
        status: 'created',
        progress: {
          currentStep: 0,
          totalSteps: 5,
          masteryAchieved: false,
          attemptNumber: 1,
          conceptsMastered: [],
          conceptsNeedWork: [],
          overallScore: undefined
        },
        timing: {
          startedAt: new Date(),
          lastActivity: new Date(),
          timeSpentMs: 0,
          timeoutAt: new Date(Date.now() + 3600000)
        },
        conversation: [],
        analytics: {
          engagementScore: 0,
          strugglingIndicators: [],
          learningPatterns: {}
        },
        security: {
          sessionToken: 'secure_token_123',
          lastValidation: new Date(),
          integrityChecks: []
        }
      };

      mockSessionRepository.createSession.mockResolvedValue(mockSession);

      const result = await engine.initializeSession(mockSessionConfig);

      expect(mockSessionRepository.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          config: mockSessionConfig,
          status: 'created'
        })
      );

      expect(result).toEqual(mockSession);
      expect(result.status).toBe('created');
      expect(result.progress.attemptNumber).toBe(1);
    });

    it('should set appropriate timeout based on time limit', async () => {
      const configWithTimeout = {
        ...mockSessionConfig,
        settings: {
          ...mockSessionConfig.settings,
          timeLimit: 30 // 30 minutes
        }
      };

      mockSessionRepository.createSession.mockImplementation((session) =>
        Promise.resolve(session)
      );

      const result = await engine.initializeSession(configWithTimeout);

      const expectedTimeout = new Date(Date.now() + (30 * 60 * 1000)); // 30 minutes
      const actualTimeout = result.timing.timeoutAt;

      expect(actualTimeout).toBeDefined();
      // Allow 1 second tolerance for timing differences
      expect(Math.abs(actualTimeout!.getTime() - expectedTimeout.getTime())).toBeLessThan(1000);
    });
  });

  describe('processStudentResponse', () => {
    it('should process a correct student response and advance to next question', async () => {
      const mockSession: AssessmentSession = {
        id: 'session123' as any,
        config: mockSessionConfig,
        status: 'active',
        progress: {
          currentStep: 1,
          totalSteps: 5,
          masteryAchieved: false,
          attemptNumber: 1,
          conceptsMastered: [],
          conceptsNeedWork: [],
          overallScore: 0.7
        },
        timing: {
          startedAt: new Date(),
          lastActivity: new Date(),
          timeSpentMs: 60000,
          timeoutAt: new Date(Date.now() + 3600000)
        },
        conversation: [
          {
            id: 'msg1',
            sessionId: 'session123' as any,
            type: 'question',
            content: 'What is photosynthesis?',
            timestamp: new Date(),
            contentHash: 'hash1',
            encrypted: false
          }
        ],
        analytics: {
          engagementScore: 0.8,
          strugglingIndicators: [],
          learningPatterns: {}
        },
        security: {
          sessionToken: 'secure_token_123',
          lastValidation: new Date(),
          integrityChecks: []
        }
      };

      const mockAnalysis: ResponseAnalysis = {
        understanding: {
          level: 'excellent',
          confidence: 0.9,
          conceptsUnderstood: ['photosynthesis'],
          misconceptions: []
        },
        mastery: {
          achieved: true,
          progress: 0.9,
          nextSteps: ['explore cellular respiration'],
          readyForAdvancement: true
        },
        engagement: {
          level: 'high',
          indicators: ['detailed response', 'correct terminology']
        },
        feedback: {
          encouragement: 'Excellent understanding!',
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
          aiDetectionScore: 0.1
        }
      };

      mockSessionRepository.getSession.mockResolvedValue(mockSession);
      mockAIService.analyzeStudentResponse.mockResolvedValue(mockAnalysis);
      mockAIService.generateFollowUpQuestion.mockResolvedValue({
        question: 'How does cellular respiration relate to photosynthesis?',
        type: 'advancement',
        difficulty: 4,
        concepts: ['cellular respiration'],
        expectedResponse: 'Should explain the relationship between the two processes',
        hints: ['Think about what happens to glucose from photosynthesis']
      });

      mockSessionRepository.updateSession.mockResolvedValue({
        ...mockSession,
        status: 'active',
        progress: {
          ...mockSession.progress,
          currentStep: 2,
          conceptsMastered: ['photosynthesis']
        }
      });

      const studentResponse = 'Photosynthesis is the process where plants use sunlight, carbon dioxide, and water to create glucose and oxygen in chloroplasts.';

      const result = await engine.processStudentResponse(
        'session123' as AssessmentSessionId,
        studentResponse,
        { responseTime: 45000 }
      );

      expect(mockAIService.analyzeStudentResponse).toHaveBeenCalledWith(
        studentResponse,
        'What is photosynthesis?',
        ['photosynthesis', 'chloroplasts', 'cellular respiration'],
        expect.objectContaining({
          sessionId: 'session123',
          previousResponses: []
        })
      );

      expect(result.progress.conceptsMastered).toContain('photosynthesis');
      expect(result.conversation).toHaveLength(3); // original question + student response + follow-up question
    });

    it('should handle misconceptions and provide remediation', async () => {
      const mockSession: AssessmentSession = {
        id: 'session123' as any,
        config: mockSessionConfig,
        status: 'active',
        progress: {
          currentStep: 1,
          totalSteps: 5,
          masteryAchieved: false,
          attemptNumber: 1,
          conceptsMastered: [],
          conceptsNeedWork: [],
          overallScore: 0.4
        },
        timing: {
          startedAt: new Date(),
          lastActivity: new Date(),
          timeSpentMs: 30000,
          timeoutAt: new Date(Date.now() + 3600000)
        },
        conversation: [
          {
            id: 'msg1',
            sessionId: 'session123' as any,
            type: 'question',
            content: 'Where does photosynthesis occur in plant cells?',
            timestamp: new Date(),
            contentHash: 'hash1',
            encrypted: false
          }
        ],
        analytics: {
          engagementScore: 0.6,
          strugglingIndicators: ['misconception detected'],
          learningPatterns: {}
        },
        security: {
          sessionToken: 'secure_token_123',
          lastValidation: new Date(),
          integrityChecks: []
        }
      };

      const mockAnalysis: ResponseAnalysis = {
        understanding: {
          level: 'partial',
          confidence: 0.4,
          conceptsUnderstood: ['plants do photosynthesis'],
          misconceptions: [
            {
              concept: 'organelle location',
              misconception: 'believes it occurs in mitochondria',
              severity: 'moderate'
            }
          ]
        },
        mastery: {
          achieved: false,
          progress: 0.3,
          nextSteps: ['clarify organelle functions'],
          readyForAdvancement: false
        },
        engagement: {
          level: 'medium',
          indicators: ['attempted answer'],
          strugglingSignals: ['incorrect organelle identification']
        },
        feedback: {
          encouragement: 'Good effort! Let me help clarify.',
          corrections: ['Photosynthesis actually occurs in chloroplasts, not mitochondria'],
          hints: ['Remember that chloroplasts contain chlorophyll'],
          resources: ['cell organelle diagram']
        },
        nextQuestion: {
          type: 'remediation',
          difficulty: 2,
          concepts: ['chloroplasts', 'mitochondria'],
          suggestedQuestion: 'What is the difference between chloroplasts and mitochondria?'
        },
        academicIntegrity: {
          authenticity: 'verified'
        }
      };

      mockSessionRepository.getSession.mockResolvedValue(mockSession);
      mockAIService.analyzeStudentResponse.mockResolvedValue(mockAnalysis);
      mockAIService.generateFollowUpQuestion.mockResolvedValue({
        question: 'What is the difference between chloroplasts and mitochondria?',
        type: 'remediation',
        difficulty: 2,
        concepts: ['chloroplasts', 'mitochondria'],
        expectedResponse: 'Should distinguish between the organelles',
        hints: ['One is for photosynthesis, one is for cellular respiration']
      });

      const studentResponse = 'Photosynthesis happens in the mitochondria where plants make energy.';

      const result = await engine.processStudentResponse(
        'session123' as AssessmentSessionId,
        studentResponse,
        { responseTime: 30000 }
      );

      expect(result.progress.conceptsNeedWork).toContain('organelle location');
      expect(result.analytics.strugglingIndicators).toContain('misconception detected');

      // Should have feedback message with corrections
      const feedbackMessage = result.conversation.find(msg => msg.type === 'feedback');
      expect(feedbackMessage?.content).toContain('Photosynthesis actually occurs in chloroplasts');
    });

    it('should detect academic integrity violations', async () => {
      const mockSession: AssessmentSession = {
        id: 'session123' as any,
        config: mockSessionConfig,
        status: 'active',
        progress: {
          currentStep: 1,
          totalSteps: 5,
          masteryAchieved: false,
          attemptNumber: 1,
          conceptsMastered: [],
          conceptsNeedWork: [],
          overallScore: 0.5
        },
        timing: {
          startedAt: new Date(),
          lastActivity: new Date(),
          timeSpentMs: 15000,
          timeoutAt: new Date(Date.now() + 3600000)
        },
        conversation: [],
        analytics: {
          engagementScore: 0.5,
          strugglingIndicators: [],
          learningPatterns: {}
        },
        security: {
          sessionToken: 'secure_token_123',
          lastValidation: new Date(),
          integrityChecks: []
        }
      };

      const mockAnalysis: ResponseAnalysis = {
        understanding: {
          level: 'excellent',
          confidence: 0.95,
          conceptsUnderstood: ['photosynthesis'],
          misconceptions: []
        },
        mastery: {
          achieved: true,
          progress: 0.95,
          nextSteps: [],
          readyForAdvancement: true
        },
        engagement: {
          level: 'high',
          indicators: ['perfect response']
        },
        feedback: {
          encouragement: 'Excellent response!'
        },
        nextQuestion: {
          type: 'advancement',
          difficulty: 5,
          concepts: ['advanced topics']
        },
        academicIntegrity: {
          authenticity: 'suspicious',
          similarityFlags: ['ai_generated_text', 'unusually_perfect'],
          aiDetectionScore: 0.9,
          temporalAnalysis: {
            responseTime: 5000, // Very fast for complex response
            consistencyScore: 0.2
          }
        }
      };

      mockSessionRepository.getSession.mockResolvedValue(mockSession);
      mockAIService.analyzeStudentResponse.mockResolvedValue(mockAnalysis);

      const suspiciousResponse = 'The intricate process of photosynthesis, a fundamental autotrophic mechanism, operates through the utilization of chlorophyll-containing organelles...';

      const result = await engine.processStudentResponse(
        'session123' as AssessmentSessionId,
        suspiciousResponse,
        { responseTime: 5000 }
      );

      // Should add integrity check record
      expect(result.security.integrityChecks).toHaveLength(1);
      expect(result.security.integrityChecks[0].result).toBe('warning');
      expect(result.security.integrityChecks[0].type).toContain('academic_integrity');
    });
  });

  describe('calculateFinalGrade', () => {
    it('should calculate grade based on mastery, participation, and improvement', async () => {
      const mockSession: AssessmentSession = {
        id: 'session123' as any,
        config: mockSessionConfig,
        status: 'completed',
        progress: {
          currentStep: 5,
          totalSteps: 5,
          masteryAchieved: true,
          attemptNumber: 2,
          conceptsMastered: ['photosynthesis', 'chloroplasts'],
          conceptsNeedWork: [],
          overallScore: 0.85
        },
        timing: {
          startedAt: new Date(Date.now() - 900000), // 15 minutes ago
          lastActivity: new Date(),
          timeSpentMs: 900000,
          timeoutAt: new Date(Date.now() + 3600000)
        },
        conversation: [
          // Mock conversation with multiple exchanges
          { id: '1', sessionId: 'session123' as any, type: 'question', content: 'Q1', timestamp: new Date(), contentHash: 'h1', encrypted: false },
          { id: '2', sessionId: 'session123' as any, type: 'student', content: 'A1', timestamp: new Date(), contentHash: 'h2', encrypted: false },
          { id: '3', sessionId: 'session123' as any, type: 'feedback', content: 'F1', timestamp: new Date(), contentHash: 'h3', encrypted: false },
          { id: '4', sessionId: 'session123' as any, type: 'question', content: 'Q2', timestamp: new Date(), contentHash: 'h4', encrypted: false },
          { id: '5', sessionId: 'session123' as any, type: 'student', content: 'A2', timestamp: new Date(), contentHash: 'h5', encrypted: false }
        ],
        analytics: {
          engagementScore: 0.8,
          strugglingIndicators: [],
          learningPatterns: {
            improvementTrend: 'positive',
            responseQuality: 'high'
          }
        },
        security: {
          sessionToken: 'secure_token_123',
          lastValidation: new Date(),
          integrityChecks: []
        }
      };

      mockSessionRepository.getSession.mockResolvedValue(mockSession);

      const result = await engine.calculateFinalGrade('session123' as AssessmentSessionId);

      expect(result.sessionId).toBe('session123');
      expect(result.numericScore).toBeGreaterThan(70); // Should be high due to mastery
      expect(result.components.masteryScore).toBeGreaterThan(80);
      expect(result.components.participationScore).toBeGreaterThan(70);
      expect(result.feedback.strengths).toBeDefined();
      expect(result.feedback.masteryReport).toContain('mastery');
    });

    it('should handle incomplete sessions appropriately', async () => {
      const incompleteSession: AssessmentSession = {
        id: 'session123' as any,
        config: mockSessionConfig,
        status: 'timeout',
        progress: {
          currentStep: 2,
          totalSteps: 5,
          masteryAchieved: false,
          attemptNumber: 1,
          conceptsMastered: [],
          conceptsNeedWork: ['photosynthesis'],
          overallScore: 0.3
        },
        timing: {
          startedAt: new Date(Date.now() - 3700000), // Over 1 hour ago
          lastActivity: new Date(Date.now() - 100000),
          timeSpentMs: 3600000,
          timeoutAt: new Date(Date.now() - 100000) // Timed out
        },
        conversation: [
          { id: '1', sessionId: 'session123' as any, type: 'question', content: 'Q1', timestamp: new Date(), contentHash: 'h1', encrypted: false },
          { id: '2', sessionId: 'session123' as any, type: 'student', content: 'Incomplete answer', timestamp: new Date(), contentHash: 'h2', encrypted: false }
        ],
        analytics: {
          engagementScore: 0.4,
          strugglingIndicators: ['timeout', 'low_engagement'],
          learningPatterns: {}
        },
        security: {
          sessionToken: 'secure_token_123',
          lastValidation: new Date(),
          integrityChecks: []
        }
      };

      mockSessionRepository.getSession.mockResolvedValue(incompleteSession);

      const result = await engine.calculateFinalGrade('session123' as AssessmentSessionId);

      expect(result.numericScore).toBeLessThan(50); // Should be low due to incompletion
      expect(result.feedback.areasForImprovement).toContain('Complete the full assessment');
      expect(result.passback.eligible).toBe(false); // Incomplete sessions shouldn't be eligible for passback
    });
  });

  describe('getSession', () => {
    it('should retrieve and validate session', async () => {
      const mockSession: AssessmentSession = {
        id: 'session123' as any,
        config: mockSessionConfig,
        status: 'active',
        progress: {
          currentStep: 2,
          totalSteps: 5,
          masteryAchieved: false,
          attemptNumber: 1,
          conceptsMastered: ['basic_concepts'],
          conceptsNeedWork: [],
          overallScore: 0.6
        },
        timing: {
          startedAt: new Date(),
          lastActivity: new Date(),
          timeSpentMs: 120000,
          timeoutAt: new Date(Date.now() + 3600000)
        },
        conversation: [],
        analytics: {
          engagementScore: 0.7,
          strugglingIndicators: [],
          learningPatterns: {}
        },
        security: {
          sessionToken: 'secure_token_123',
          lastValidation: new Date(),
          integrityChecks: []
        }
      };

      mockSessionRepository.getSession.mockResolvedValue(mockSession);

      const result = await engine.getSession('session123' as AssessmentSessionId);

      expect(result).toEqual(mockSession);
      expect(mockSessionRepository.getSession).toHaveBeenCalledWith('session123');
    });

    it('should return null for non-existent sessions', async () => {
      mockSessionRepository.getSession.mockResolvedValue(null);

      const result = await engine.getSession('nonexistent' as AssessmentSessionId);

      expect(result).toBeNull();
    });
  });
});