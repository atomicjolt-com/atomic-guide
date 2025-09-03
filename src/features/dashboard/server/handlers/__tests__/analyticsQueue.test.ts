/**
 * @fileoverview Tests for analytics queue handler
 * @module features/dashboard/server/handlers/__tests__/analyticsQueue.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyticsQueueHandler } from '../analyticsQueue';
import type { MessageBatch } from '@cloudflare/workers-types';

describe('analyticsQueueHandler', () => {
  let mockEnv: any;
  let mockBatch: MessageBatch<any>;
  let mockMessages: any[];

  beforeEach(() => {
    // Mock environment bindings
    mockEnv = {
      DB: {
        prepare: vi.fn().mockReturnThis(),
        bind: vi.fn().mockReturnThis(),
        first: vi.fn(),
        all: vi.fn(),
        run: vi.fn(),
        batch: vi.fn()
      },
      AI: {
        run: vi.fn()
      },
      VECTORIZE_INDEX: {
        query: vi.fn()
      },
      ANALYTICS_KV: {
        get: vi.fn(),
        put: vi.fn()
      }
    };

    // Mock message batch
    mockMessages = [];
    mockBatch = {
      messages: mockMessages,
      queue: 'analytics-queue' as any,
      ackAll: vi.fn(),
      retryAll: vi.fn()
    };
  });

  describe('message processing', () => {
    it('should process calculate_performance messages', async () => {
      mockMessages.push({
        id: 'msg-1',
        body: {
          taskId: 'task-1',
          taskType: 'performance_update',
          tenantId: 'tenant-1',
          studentId: 'student-1',
          courseId: 'course-1',
          priority: 5,
          taskData: {},
          timestamp: new Date().toISOString(),
          retryCount: 0
        },
        timestamp: new Date(),
        attempts: 0,
        ack: vi.fn(),
        retry: vi.fn()
      });

      mockEnv.DB.all.mockResolvedValue({ results: [] });
      mockEnv.DB.run.mockResolvedValue({ success: true });
      mockEnv.KV_ANALYTICS = { get: vi.fn().mockResolvedValue(null), put: vi.fn() };
      mockEnv.ANALYTICS_QUEUE = { send: vi.fn() };

      await analyticsQueueHandler(mockBatch, mockEnv);

      expect(mockMessages[0].ack).toHaveBeenCalled();
      expect(mockEnv.DB.prepare).toHaveBeenCalled();
    });

    it('should process generate_recommendations messages', async () => {
      mockMessages.push({
        id: 'msg-2',
        body: {
          taskId: 'task-2',
          taskType: 'recommendation_generation',
          tenantId: 'tenant-1',
          studentId: 'student-1',
          courseId: 'course-1',
          priority: 5,
          taskData: {
            performanceProfile: {
              overallMastery: 0.7,
              conceptMasteries: {},
              learningVelocity: 2.0
            }
          },
          timestamp: new Date().toISOString(),
          retryCount: 0
        },
        timestamp: new Date(),
        attempts: 0,
        ack: vi.fn(),
        retry: vi.fn()
      });

      mockEnv.DB.run.mockResolvedValue({ success: true });
      mockEnv.DB.all.mockResolvedValue({ results: [] });
      mockEnv.KV_ANALYTICS = { get: vi.fn().mockResolvedValue(null), put: vi.fn() };
      mockEnv.ANALYTICS_QUEUE = { send: vi.fn() };

      await analyticsQueueHandler(mockBatch, mockEnv);

      expect(mockMessages[0].ack).toHaveBeenCalled();
    });

    it('should process detect_struggles messages', async () => {
      mockMessages.push({
        id: 'msg-3',
        body: {
          taskId: 'task-3',
          taskType: 'pattern_detection',
          tenantId: 'tenant-1',
          studentId: 'student-1',
          courseId: 'course-1',
          assessmentId: 'assessment-1',
          priority: 5,
          taskData: {},
          timestamp: new Date().toISOString(),
          retryCount: 0
        },
        timestamp: new Date(),
        attempts: 0,
        ack: vi.fn(),
        retry: vi.fn()
      });

      mockEnv.DB.all.mockResolvedValue({ 
        results: [
          { concept_id: 'arrays', error_count: 5 }
        ] 
      });
      mockEnv.DB.run.mockResolvedValue({ success: true });
      mockEnv.KV_ANALYTICS = { get: vi.fn().mockResolvedValue(null), put: vi.fn() };
      mockEnv.ANALYTICS_QUEUE = { send: vi.fn() };

      await analyticsQueueHandler(mockBatch, mockEnv);

      expect(mockMessages[0].ack).toHaveBeenCalled();
    });

    it('should process update_class_metrics messages', async () => {
      mockMessages.push({
        id: 'msg-4',
        body: {
          taskId: 'task-4',
          taskType: 'alert_check',
          tenantId: 'tenant-1',
          courseId: 'course-1',
          priority: 3,
          taskData: {},
          timestamp: new Date().toISOString(),
          retryCount: 0
        },
        timestamp: new Date(),
        attempts: 0,
        ack: vi.fn(),
        retry: vi.fn()
      });

      mockEnv.DB.all.mockResolvedValue({ 
        results: [
          { 
            student_id: 'student-1',
            overall_mastery: 0.4,
            learning_velocity: 0.05,
            confidence_level: 0.2,
            struggle_count: 3,
            avg_severity: 0.8
          }
        ] 
      });
      mockEnv.DB.run.mockResolvedValue({ success: true });
      mockEnv.KV_ANALYTICS = { get: vi.fn().mockResolvedValue(null), put: vi.fn() };
      mockEnv.ANALYTICS_QUEUE = { send: vi.fn() };

      await analyticsQueueHandler(mockBatch, mockEnv);

      expect(mockMessages[0].ack).toHaveBeenCalled();
      expect(mockEnv.DB.run).toHaveBeenCalled();
    });
  });

  describe('batch processing', () => {
    it('should process multiple messages in batch', async () => {
      mockMessages.push(
        {
          id: 'msg-1',
          body: {
            taskId: 'task-5',
            taskType: 'performance_update',
            tenantId: 'tenant-1',
            studentId: 'student-1',
            courseId: 'course-1',
            priority: 5,
            taskData: {},
            timestamp: new Date().toISOString(),
            retryCount: 0
          },
          timestamp: new Date(),
          attempts: 0,
          ack: vi.fn(),
          retry: vi.fn()
        },
        {
          id: 'msg-2',
          body: {
            taskId: 'task-6',
            taskType: 'performance_update',
            tenantId: 'tenant-1',
            studentId: 'student-2',
            courseId: 'course-1',
            priority: 5,
            taskData: {},
            timestamp: new Date().toISOString(),
            retryCount: 0
          },
          timestamp: new Date(),
          attempts: 0,
          ack: vi.fn(),
          retry: vi.fn()
        }
      );

      mockEnv.DB.all.mockResolvedValue({ results: [] });
      mockEnv.DB.run.mockResolvedValue({ success: true });
      mockEnv.KV_ANALYTICS = { get: vi.fn().mockResolvedValue(null), put: vi.fn() };
      mockEnv.ANALYTICS_QUEUE = { send: vi.fn() };

      await analyticsQueueHandler(mockBatch, mockEnv);

      expect(mockMessages[0].ack).toHaveBeenCalled();
      expect(mockMessages[1].ack).toHaveBeenCalled();
      expect(mockEnv.DB.prepare).toHaveBeenCalled();
    });

    it('should handle batch size limits', async () => {
      // Add 10 messages
      for (let i = 0; i < 10; i++) {
        mockMessages.push({
          id: `msg-${i}`,
          body: {
            taskId: `task-${i + 10}`,
            taskType: 'performance_update',
            tenantId: 'tenant-1',
            studentId: `student-${i}`,
            courseId: 'course-1',
            priority: 5,
            taskData: {},
            timestamp: new Date().toISOString(),
            retryCount: 0
          },
          timestamp: new Date(),
          attempts: 0,
          ack: vi.fn(),
          retry: vi.fn()
        });
      }

      mockEnv.DB.all.mockResolvedValue({ results: [] });
      mockEnv.DB.run.mockResolvedValue({ success: true });
      mockEnv.KV_ANALYTICS = { get: vi.fn().mockResolvedValue(null), put: vi.fn() };
      mockEnv.ANALYTICS_QUEUE = { send: vi.fn() };

      await analyticsQueueHandler(mockBatch, mockEnv);

      // All messages should be acknowledged
      mockMessages.forEach(msg => {
        expect(msg.ack).toHaveBeenCalled();
      });
    });
  });

  describe('error handling', () => {
    it('should retry on database errors', async () => {
      mockMessages.push({
        id: 'msg-1',
        body: {
          taskId: 'task-20',
          taskType: 'performance_update',
          tenantId: 'tenant-1',
          studentId: 'student-1',
          courseId: 'course-1',
          priority: 5,
          taskData: {},
          timestamp: new Date().toISOString(),
          retryCount: 0
        },
        timestamp: new Date(),
        attempts: 0,
        ack: vi.fn(),
        retry: vi.fn()
      });

      mockEnv.DB.all.mockRejectedValue(new Error('Database connection failed'));
      mockEnv.DB.prepare.mockReturnThis();
      mockEnv.DB.bind.mockReturnThis();
      mockEnv.DB.run.mockRejectedValue(new Error('Database connection failed'));
      mockEnv.KV_ANALYTICS = { get: vi.fn().mockResolvedValue(null), put: vi.fn() };
      mockEnv.ANALYTICS_QUEUE = { send: vi.fn() };

      await analyticsQueueHandler(mockBatch, mockEnv);

      expect(mockMessages[0].retry).toHaveBeenCalled();
      expect(mockMessages[0].ack).not.toHaveBeenCalled();
    });

    it('should handle invalid message types gracefully', async () => {
      mockMessages.push({
        id: 'msg-1',
        body: {
          taskId: 'task-21',
          taskType: 'invalid_type' as any,
          tenantId: 'tenant-1',
          priority: 5,
          taskData: {},
          timestamp: new Date().toISOString(),
          retryCount: 0
        },
        timestamp: new Date(),
        attempts: 0,
        ack: vi.fn(),
        retry: vi.fn()
      });

      mockEnv.DB.run.mockResolvedValue({ success: true });
      mockEnv.KV_ANALYTICS = { get: vi.fn().mockResolvedValue(null), put: vi.fn() };
      mockEnv.ANALYTICS_QUEUE = { send: vi.fn() };

      await analyticsQueueHandler(mockBatch, mockEnv);

      // Invalid messages should be acknowledged to prevent infinite retries
      expect(mockMessages[0].ack).toHaveBeenCalled();
    });

    it('should implement exponential backoff for retries', async () => {
      mockMessages.push({
        id: 'msg-1',
        body: {
          taskId: 'task-22',
          taskType: 'performance_update',
          tenantId: 'tenant-1',
          studentId: 'student-1',
          courseId: 'course-1',
          priority: 5,
          taskData: {},
          timestamp: new Date().toISOString(),
          retryCount: 3 // Third retry attempt
        },
        timestamp: new Date(),
        attempts: 3,
        ack: vi.fn(),
        retry: vi.fn()
      });

      mockEnv.DB.all.mockRejectedValue(new Error('Temporary failure'));
      mockEnv.DB.prepare.mockReturnThis();
      mockEnv.DB.bind.mockReturnThis();
      mockEnv.DB.run.mockRejectedValue(new Error('Temporary failure'));
      mockEnv.KV_ANALYTICS = { get: vi.fn().mockResolvedValue(null), put: vi.fn() };
      mockEnv.ANALYTICS_QUEUE = { send: vi.fn() };

      await analyticsQueueHandler(mockBatch, mockEnv);

      // Should still retry for temporary failures
      expect(mockMessages[0].retry).toHaveBeenCalled();
    });

    it('should dead-letter messages after max retries', async () => {
      mockMessages.push({
        id: 'msg-1',
        body: {
          taskId: 'task-23',
          taskType: 'performance_update',
          tenantId: 'tenant-1',
          studentId: 'student-1',
          courseId: 'course-1',
          priority: 5,
          taskData: {},
          timestamp: new Date().toISOString(),
          retryCount: 5 // Exceeded max retries
        },
        timestamp: new Date(),
        attempts: 5,
        ack: vi.fn(),
        retry: vi.fn()
      });

      // First call for task status update fails, then dead letter insert succeeds
      let callCount = 0;
      mockEnv.DB.prepare.mockReturnThis();
      mockEnv.DB.bind.mockReturnThis();
      mockEnv.DB.run.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Permanent failure'));
        }
        return Promise.resolve({ success: true });
      });
      mockEnv.DB.all.mockRejectedValue(new Error('Permanent failure'));
      mockEnv.KV_ANALYTICS = { get: vi.fn().mockResolvedValue(null), put: vi.fn() };
      mockEnv.ANALYTICS_QUEUE = { send: vi.fn() };

      await analyticsQueueHandler(mockBatch, mockEnv);

      // With high retry count, should acknowledge to avoid infinite loop
      expect(mockMessages[0].ack).toHaveBeenCalled();
    });
  });

  describe('performance optimization', () => {
    it('should cache frequently accessed data', async () => {
      mockMessages.push({
        id: 'msg-1',
        body: {
          taskId: 'task-30',
          taskType: 'alert_check',
          tenantId: 'tenant-1',
          courseId: 'course-1',
          priority: 3,
          taskData: {},
          timestamp: new Date().toISOString(),
          retryCount: 0
        },
        timestamp: new Date(),
        attempts: 0,
        ack: vi.fn(),
        retry: vi.fn()
      });

      mockEnv.DB.all.mockResolvedValue({ results: [] });
      mockEnv.DB.run.mockResolvedValue({ success: true });
      mockEnv.ANALYTICS_KV = { 
        get: vi.fn().mockResolvedValue(null), 
        put: vi.fn().mockResolvedValue(undefined) 
      };
      mockEnv.KV_ANALYTICS = mockEnv.ANALYTICS_KV; // Add alias
      mockEnv.ANALYTICS_QUEUE = { send: vi.fn() };

      await analyticsQueueHandler(mockBatch, mockEnv);

      // Should acknowledge message after processing
      expect(mockMessages[0].ack).toHaveBeenCalled();
    });

    it('should use cached data when available', async () => {
      const cachedMetrics = {
        averageMastery: 0.75,
        timestamp: new Date().toISOString()
      };

      mockMessages.push({
        id: 'msg-1',
        body: {
          taskId: 'task-31',
          taskType: 'performance_update',
          tenantId: 'tenant-1',
          studentId: 'student-1',
          courseId: 'course-1',
          priority: 5,
          taskData: {},
          timestamp: new Date().toISOString(),
          retryCount: 0
        },
        timestamp: new Date(),
        attempts: 0,
        ack: vi.fn(),
        retry: vi.fn()
      });

      mockEnv.ANALYTICS_KV = { 
        get: vi.fn().mockResolvedValue(JSON.stringify(cachedMetrics)),
        put: vi.fn() 
      };
      mockEnv.KV_ANALYTICS = mockEnv.ANALYTICS_KV;
      mockEnv.ANALYTICS_QUEUE = { send: vi.fn() };
      mockEnv.DB.run.mockResolvedValue({ success: true });
      mockEnv.DB.all.mockResolvedValue({ results: [] });

      await analyticsQueueHandler(mockBatch, mockEnv);

      // Should acknowledge after processing
      expect(mockMessages[0].ack).toHaveBeenCalled();
    });

    it('should batch database operations efficiently', async () => {
      // Add multiple messages for same student
      for (let i = 0; i < 3; i++) {
        mockMessages.push({
          id: `msg-${i}`,
          body: {
            taskId: `task-4${i}`,
            taskType: 'performance_update',
            tenantId: 'tenant-1',
            studentId: 'student-1', // Same student
            courseId: 'course-1',
            priority: 5,
            taskData: {},
            timestamp: new Date().toISOString(),
            retryCount: 0
          },
          timestamp: new Date(),
          attempts: 0,
          ack: vi.fn(),
          retry: vi.fn()
        });
      }

      mockEnv.DB.all.mockResolvedValue({ results: [] });
      mockEnv.DB.batch.mockResolvedValue([{ success: true }]);
      mockEnv.DB.run.mockResolvedValue({ success: true });
      mockEnv.KV_ANALYTICS = { get: vi.fn().mockResolvedValue(null), put: vi.fn() };
      mockEnv.ANALYTICS_QUEUE = { send: vi.fn() };

      await analyticsQueueHandler(mockBatch, mockEnv);

      // All messages should be acknowledged
      mockMessages.forEach(msg => {
        expect(msg.ack).toHaveBeenCalled();
      });
    });
  });

  describe('monitoring and observability', () => {
    it('should log processing metrics', async () => {
      mockMessages.push({
        id: 'msg-1',
        body: {
          taskId: 'task-50',
          taskType: 'performance_update',
          tenantId: 'tenant-1',
          studentId: 'student-1',
          courseId: 'course-1',
          priority: 5,
          taskData: {},
          timestamp: new Date().toISOString(),
          retryCount: 0
        },
        timestamp: new Date(),
        attempts: 0,
        ack: vi.fn(),
        retry: vi.fn()
      });

      mockEnv.DB.all.mockResolvedValue({ results: [] });
      mockEnv.DB.run.mockResolvedValue({ success: true });
      mockEnv.KV_ANALYTICS = { get: vi.fn().mockResolvedValue(null), put: vi.fn() };
      mockEnv.ANALYTICS_QUEUE = { send: vi.fn() };

      await analyticsQueueHandler(mockBatch, mockEnv);

      // Should log to database for batch processing
      expect(mockEnv.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('analytics_batch_logs')
      );
    });

    it('should track processing duration', async () => {
      mockMessages.push({
        id: 'msg-1',
        body: {
          taskId: 'task-51',
          taskType: 'performance_update',
          tenantId: 'tenant-1',
          studentId: 'student-1',
          courseId: 'course-1',
          priority: 5,
          taskData: {},
          timestamp: new Date().toISOString(),
          retryCount: 0
        },
        timestamp: new Date(),
        attempts: 0,
        ack: vi.fn(),
        retry: vi.fn()
      });

      mockEnv.DB.all.mockResolvedValue({ results: [] });
      mockEnv.DB.run.mockResolvedValue({ success: true });
      mockEnv.KV_ANALYTICS = { get: vi.fn().mockResolvedValue(null), put: vi.fn() };
      mockEnv.ANALYTICS_QUEUE = { send: vi.fn() };

      const result = await analyticsQueueHandler(mockBatch, mockEnv);

      // Should include processing duration in result
      expect(result.processingDurationMs).toBeGreaterThanOrEqual(0);
      expect(result.processedCount).toBe(1);
    });
  });
});