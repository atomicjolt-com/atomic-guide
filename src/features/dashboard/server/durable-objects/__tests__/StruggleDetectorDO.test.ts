/**
 * @fileoverview Tests for StruggleDetectorDO Durable Object
 * @module features/dashboard/server/durable-objects/__tests__/StruggleDetectorDO.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StruggleDetectorDO } from '../StruggleDetectorDO';
import type { DurableObjectState, DurableObjectStorage } from '@cloudflare/workers-types';

describe('StruggleDetectorDO', () => {
  let struggleDetector: StruggleDetectorDO;
  let mockState: DurableObjectState;
  let mockStorage: DurableObjectStorage;
  let mockEnv: any;

  beforeEach(() => {
    // Mock storage
    mockStorage = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      deleteAll: vi.fn(),
      list: vi.fn(),
      transaction: vi.fn(),
      getAlarm: vi.fn(),
      setAlarm: vi.fn(),
      deleteAlarm: vi.fn(),
      sync: vi.fn()
    } as any;

    // Mock state
    mockState = {
      id: { toString: () => 'test-do-id', equals: vi.fn() } as any,
      storage: mockStorage,
      blockConcurrencyWhile: vi.fn((fn) => fn()),
      waitUntil: vi.fn()
    } as any;

    // Mock environment
    mockEnv = {
      DB: {
        prepare: vi.fn().mockReturnThis(),
        bind: vi.fn().mockReturnThis(),
        first: vi.fn(),
        all: vi.fn(),
        run: vi.fn()
      },
      ANALYTICS_QUEUE: {
        send: vi.fn()
      }
    };

    struggleDetector = new StruggleDetectorDO(mockState, mockEnv);
  });

  describe('fetch handler', () => {
    it('should handle track_interaction requests', async () => {
      const request = new Request('http://do/track_interaction', {
        method: 'POST',
        body: JSON.stringify({
          studentId: 'student-1',
          courseId: 'course-1',
          interaction: {
            type: 'assessment_attempt',
            conceptId: 'arrays',
            correct: false,
            timeSpent: 120,
            confidence: 0.3
          }
        })
      });

      mockStorage.get.mockResolvedValue(null);
      mockStorage.put.mockResolvedValue(undefined);

      const response = await struggleDetector.fetch(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(mockStorage.put).toHaveBeenCalled();
    });

    it('should handle analyze_patterns requests', async () => {
      const mockInteractions = {
        'student-1': [
          { type: 'assessment_attempt', conceptId: 'loops', correct: false, timeSpent: 180 },
          { type: 'assessment_attempt', conceptId: 'loops', correct: false, timeSpent: 200 },
          { type: 'assessment_attempt', conceptId: 'loops', correct: false, timeSpent: 220 }
        ]
      };

      mockStorage.list.mockResolvedValue(new Map(Object.entries(mockInteractions)));

      const request = new Request('http://do/analyze_patterns', {
        method: 'POST',
        body: JSON.stringify({
          studentId: 'student-1',
          courseId: 'course-1'
        })
      });

      const response = await struggleDetector.fetch(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.patterns).toBeDefined();
      expect(result.patterns.length).toBeGreaterThan(0);
    });

    it('should handle get_realtime_status requests', async () => {
      const mockSessionData = {
        activeStudents: ['student-1', 'student-2'],
        recentPatterns: [
          { studentId: 'student-1', pattern: 'repeated_errors', severity: 0.7 }
        ],
        alertsGenerated: 2
      };

      mockStorage.get.mockResolvedValue(mockSessionData);

      const request = new Request('http://do/get_realtime_status', {
        method: 'GET'
      });

      const response = await struggleDetector.fetch(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.activeStudents).toHaveLength(2);
      expect(result.recentPatterns).toHaveLength(1);
    });

    it('should handle WebSocket upgrade for real-time monitoring', async () => {
      const request = new Request('http://do/ws', {
        headers: {
          'Upgrade': 'websocket'
        }
      });

      const response = await struggleDetector.fetch(request);

      expect(response.status).toBe(101);
      expect(response.webSocket).toBeDefined();
    });
  });

  describe('struggle detection logic', () => {
    it('should detect repeated error patterns', () => {
      const interactions = [
        { type: 'assessment_attempt', conceptId: 'recursion', correct: false, timeSpent: 150 },
        { type: 'assessment_attempt', conceptId: 'recursion', correct: false, timeSpent: 180 },
        { type: 'assessment_attempt', conceptId: 'recursion', correct: false, timeSpent: 200 },
        { type: 'assessment_attempt', conceptId: 'recursion', correct: false, timeSpent: 220 }
      ];

      const patterns = struggleDetector.analyzeInteractionPatterns(interactions);

      expect(patterns).toContainEqual(
        expect.objectContaining({
          type: 'repeated_errors',
          conceptId: 'recursion',
          severity: expect.any(Number)
        })
      );
      expect(patterns[0].severity).toBeGreaterThan(0.5);
    });

    it('should detect increasing time patterns', () => {
      const interactions = [
        { type: 'assessment_attempt', conceptId: 'sorting', correct: true, timeSpent: 60 },
        { type: 'assessment_attempt', conceptId: 'sorting', correct: true, timeSpent: 120 },
        { type: 'assessment_attempt', conceptId: 'sorting', correct: true, timeSpent: 240 },
        { type: 'assessment_attempt', conceptId: 'sorting', correct: false, timeSpent: 480 }
      ];

      const patterns = struggleDetector.analyzeInteractionPatterns(interactions);

      expect(patterns).toContainEqual(
        expect.objectContaining({
          type: 'increasing_time',
          conceptId: 'sorting'
        })
      );
    });

    it('should detect confidence drop patterns', () => {
      const interactions = [
        { type: 'chat_message', confidence: 0.8, sentiment: 'neutral' },
        { type: 'chat_message', confidence: 0.6, sentiment: 'confused' },
        { type: 'chat_message', confidence: 0.4, sentiment: 'frustrated' },
        { type: 'chat_message', confidence: 0.2, sentiment: 'frustrated' }
      ];

      const patterns = struggleDetector.analyzeInteractionPatterns(interactions);

      expect(patterns).toContainEqual(
        expect.objectContaining({
          type: 'confidence_drop',
          severity: expect.any(Number)
        })
      );
    });

    it('should detect help-seeking patterns', () => {
      const interactions = [
        { type: 'chat_message', message: 'I dont understand this', sentiment: 'confused' },
        { type: 'chat_message', message: 'Can you explain again?', sentiment: 'confused' },
        { type: 'chat_message', message: 'Im stuck', sentiment: 'frustrated' },
        { type: 'hint_request', conceptId: 'algorithms' },
        { type: 'hint_request', conceptId: 'algorithms' }
      ];

      const patterns = struggleDetector.analyzeInteractionPatterns(interactions);

      expect(patterns).toContainEqual(
        expect.objectContaining({
          type: 'excessive_help_seeking'
        })
      );
    });
  });

  describe('alert generation', () => {
    it('should generate instructor alert for high severity struggles', async () => {
      const highSeverityPattern = {
        type: 'repeated_errors',
        conceptId: 'data_structures',
        severity: 0.9,
        evidenceCount: 10
      };

      await struggleDetector.generateAlert(
        'student-1',
        'course-1',
        highSeverityPattern
      );

      expect(mockEnv.DB.prepare).toHaveBeenCalled();
      const query = mockEnv.DB.prepare.mock.calls[0][0];
      expect(query).toContain('INSERT INTO instructor_alerts');
    });

    it('should queue intervention for medium severity struggles', async () => {
      const mediumSeverityPattern = {
        type: 'increasing_time',
        conceptId: 'loops',
        severity: 0.6,
        evidenceCount: 5
      };

      await struggleDetector.generateAlert(
        'student-1',
        'course-1',
        mediumSeverityPattern
      );

      expect(mockEnv.ANALYTICS_QUEUE.send).toHaveBeenCalledWith({
        type: 'generate_intervention',
        studentId: 'student-1',
        pattern: mediumSeverityPattern
      });
    });

    it('should throttle alerts to prevent spam', async () => {
      const pattern = {
        type: 'repeated_errors',
        conceptId: 'arrays',
        severity: 0.8,
        evidenceCount: 5
      };

      // Set up storage mock to track throttling state
      const storageState: Record<string, any> = {};
      mockStorage.get.mockImplementation((key: string) => {
        return Promise.resolve(storageState[key]);
      });
      mockStorage.put.mockImplementation((key: string, value: any) => {
        storageState[key] = value;
        return Promise.resolve();
      });

      // Generate multiple alerts quickly
      for (let i = 0; i < 5; i++) {
        await struggleDetector.generateAlert('student-1', 'course-1', pattern);
      }

      // Should throttle after first alert
      expect(mockEnv.DB.prepare).toHaveBeenCalledTimes(1);
    });
  });

  describe('real-time WebSocket communication', () => {
    it('should broadcast struggle patterns to connected clients', () => {
      const mockWebSocket1 = { send: vi.fn(), readyState: 1 };
      const mockWebSocket2 = { send: vi.fn(), readyState: 1 };

      struggleDetector.connectedClients = new Set([mockWebSocket1, mockWebSocket2]);

      const pattern = {
        studentId: 'student-1',
        type: 'repeated_errors',
        severity: 0.7
      };

      struggleDetector.broadcastPattern(pattern);

      expect(mockWebSocket1.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'struggle_detected', data: pattern })
      );
      expect(mockWebSocket2.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'struggle_detected', data: pattern })
      );
    });

    it('should clean up disconnected clients', () => {
      const mockWebSocket1 = { send: vi.fn(), readyState: 3 }; // CLOSED
      const mockWebSocket2 = { send: vi.fn(), readyState: 1 }; // OPEN

      struggleDetector.connectedClients = new Set([mockWebSocket1, mockWebSocket2]);

      struggleDetector.cleanupDisconnectedClients();

      expect(struggleDetector.connectedClients.size).toBe(1);
      expect(struggleDetector.connectedClients.has(mockWebSocket2)).toBe(true);
    });

    it('should handle WebSocket message for subscription', async () => {
      const mockWebSocket = { 
        send: vi.fn(), 
        readyState: 1,
        addEventListener: vi.fn()
      };

      await struggleDetector.handleWebSocketMessage(
        mockWebSocket,
        JSON.stringify({
          type: 'subscribe',
          courseId: 'course-1',
          role: 'instructor'
        })
      );

      expect(struggleDetector.subscriptions.get(mockWebSocket)).toEqual({
        courseId: 'course-1',
        role: 'instructor'
      });
    });
  });

  describe('alarm handler for periodic analysis', () => {
    it('should run periodic analysis on alarm', async () => {
      mockStorage.list.mockResolvedValue(new Map([
        ['student-1', [
          { type: 'assessment_attempt', correct: false },
          { type: 'assessment_attempt', correct: false }
        ]]
      ]));

      mockEnv.ANALYTICS_QUEUE.send.mockResolvedValue(undefined);

      await struggleDetector.alarm();

      expect(mockEnv.ANALYTICS_QUEUE.send).toHaveBeenCalled();
      expect(mockStorage.setAlarm).toHaveBeenCalled(); // Schedule next alarm
    });

    it('should clean old interaction data during alarm', async () => {
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours old
      const oldInteractions = [
        { type: 'assessment_attempt', timestamp: oldDate.toISOString() }
      ];

      mockStorage.list.mockResolvedValue(new Map([
        ['student-1', oldInteractions]
      ]));

      await struggleDetector.alarm();

      expect(mockStorage.delete).toHaveBeenCalledWith('student-1');
    });
  });

  describe('data persistence', () => {
    it('should persist interaction data to storage', async () => {
      const interaction = {
        type: 'assessment_attempt',
        conceptId: 'functions',
        correct: true,
        timeSpent: 90
      };

      await struggleDetector.persistInteraction('student-1', interaction);

      expect(mockStorage.put).toHaveBeenCalledWith(
        expect.stringContaining('student-1'),
        expect.arrayContaining([
          expect.objectContaining(interaction)
        ])
      );
    });

    it('should limit stored interactions per student', async () => {
      const existingInteractions = Array(100).fill({
        type: 'assessment_attempt',
        timestamp: new Date().toISOString()
      });

      mockStorage.get.mockResolvedValue(existingInteractions);

      const newInteraction = {
        type: 'assessment_attempt',
        conceptId: 'new',
        correct: false
      };

      await struggleDetector.persistInteraction('student-1', newInteraction);

      const putCall = mockStorage.put.mock.calls[0];
      const storedInteractions = putCall[1];

      expect(storedInteractions.length).toBeLessThanOrEqual(50); // Max limit
    });
  });
});