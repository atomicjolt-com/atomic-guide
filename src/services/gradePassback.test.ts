// TODO: Consider using ServiceTestHarness for GradePassbackService
/**
 * @fileoverview Tests for LTI AGS grade passback service
 * @module services/gradePassback.test
 */

// Mock the @atomicjolt/lti-server module BEFORE other imports
import { vi } from 'vitest';
vi.mock('@atomicjolt/lti-server', () => ({
  getLtiToken: vi.fn(),
}));

import { describe, it, expect, beforeEach, afterEach, MockFactory, TestDataFactory, ServiceTestHarness } from '@/tests/infrastructure';
import { GradePassbackService, GradePassbackError, createGradePassbackService } from './gradePassback';
import { getLtiToken } from '@atomicjolt/lti-server';
import type { Env } from '../types';

import type { MockD1Database, MockKVNamespace, MockQueue } from '@/tests/infrastructure/types/mocks';

// Mock environment
const mockEnv: Partial<Env> = {
  PLATFORMS: {
    get: vi.fn(),
  } as any,
  KEY_SETS: {
    get: vi.fn(),
  } as any,
  DB: {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        run: vi.fn(),
      })),
    })),
  } as any,
};

// Mock fetch globally
global.fetch = vi.fn();

describe('GradePassbackService', () => {
  let service: GradePassbackService;

  beforeEach(async () => {
    // Setup test infrastructure - testing GradePassbackService
    const harness = ServiceTestHarness.withDefaults(GradePassbackService, {
      database: true,
      kvStore: true,
      queue: false
    }).build();
    
    service = new GradePassbackService(mockEnv as Env);
    
    ;
  
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('submitGrade', () => {
    it('should successfully submit a grade', async () => {
      // Mock platform configuration
      (mockEnv.PLATFORMS!.get).mockResolvedValue(JSON.stringify({
        token_endpoint: 'https://canvas.test/token',
        client_id: 'test-client',
        key_id: 'test-key',
      }));

      // Mock key set
      (mockEnv.KEY_SETS!.get).mockResolvedValue(JSON.stringify({
        privateKey: 'test-private-key',
      }));

      // Mock successful getLtiToken response
      vi.mocked(getLtiToken).mockResolvedValue({ access_token: 'test-token' });

      // Mock successful score submission
      const mockScoreResponse = {
        userId: 'user123',
        scoreGiven: 85,
        scoreMaximum: 100,
        activityProgress: 'Completed',
        gradingProgress: 'FullyGraded',
        timestamp: new Date().toISOString(),
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockScoreResponse,
      } as Response);

      const request = {
        attemptId: 'attempt123',
        score: 85,
        feedback: 'Good work!',
        userId: 'user123',
        lineItemUrl: 'https://canvas.test/courses/1/line_items/1',
        activityProgress: 'Completed' as const,
        gradingProgress: 'FullyGraded' as const,
      };

      const result = await service.submitGrade(request);

      expect(result.success).toBe(true);
      expect(result.ltiGradeResponse).toMatchObject({
        userId: 'user123',
        scoreGiven: 85,
        scoreMaximum: 100,
      });
    });

    it('should retry on server errors', async () => {
      // Mock platform and key setup
      (mockEnv.PLATFORMS!.get).mockResolvedValue(JSON.stringify({
        token_endpoint: 'https://canvas.test/token',
        client_id: 'test-client',
        key_id: 'test-key',
      }));

      (mockEnv.KEY_SETS!.get).mockResolvedValue(JSON.stringify({
        privateKey: 'test-private-key',
      }));

      // Mock getLtiToken response
      vi.mocked(getLtiToken).mockResolvedValue({ access_token: 'test-token' });

      // Mock first attempt fails with 500
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      } as Response);

      // Mock second attempt succeeds
      const mockScoreResponse = {
        userId: 'user123',
        scoreGiven: 85,
        scoreMaximum: 100,
        activityProgress: 'Completed',
        gradingProgress: 'FullyGraded',
        timestamp: new Date().toISOString(),
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockScoreResponse,
      } as Response);

      const request = {
        attemptId: 'attempt123',
        score: 85,
        userId: 'user123',
        lineItemUrl: 'https://canvas.test/courses/1/line_items/1',
        activityProgress: 'Completed' as const,
        gradingProgress: 'FullyGraded' as const,
      };

      const result = await service.submitGrade(request);

      expect(result.success).toBe(true);
      expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(2); // 2 score attempts (token is mocked separately)
    });

    it('should fail after max retries', async () => {
      // Mock platform and key setup
      (mockEnv.PLATFORMS!.get).mockResolvedValue(JSON.stringify({
        token_endpoint: 'https://canvas.test/token',
        client_id: 'test-client',
        key_id: 'test-key',
      }));

      (mockEnv.KEY_SETS!.get).mockResolvedValue(JSON.stringify({
        privateKey: 'test-private-key',
      }));

      // Mock getLtiToken response
      vi.mocked(getLtiToken).mockResolvedValue({ access_token: 'test-token' });

      // Mock all attempts fail
      for (let i = 0; i < 3; i++) {
        vi.mocked(global.fetch).mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        } as Response);
      }

      const request = {
        attemptId: 'attempt123',
        score: 85,
        userId: 'user123',
        lineItemUrl: 'https://canvas.test/courses/1/line_items/1',
        activityProgress: 'Completed' as const,
        gradingProgress: 'FullyGraded' as const,
      };

      await expect(service.submitGrade(request)).rejects.toThrow(GradePassbackError);
      expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(3); // 3 score attempts (token is mocked separately)
    });

    it('should not retry on client errors', async () => {
      // Mock platform and key setup
      (mockEnv.PLATFORMS!.get).mockResolvedValue(JSON.stringify({
        token_endpoint: 'https://canvas.test/token',
        client_id: 'test-client',
        key_id: 'test-key',
      }));

      (mockEnv.KEY_SETS!.get).mockResolvedValue(JSON.stringify({
        privateKey: 'test-private-key',
      }));

      // Mock getLtiToken response
      vi.mocked(getLtiToken).mockResolvedValue({ access_token: 'test-token' });

      // Mock 400 Bad Request error (not retryable)
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      } as Response);

      const request = {
        attemptId: 'attempt123',
        score: 85,
        userId: 'user123',
        lineItemUrl: 'https://canvas.test/courses/1/line_items/1',
        activityProgress: 'Completed' as const,
        gradingProgress: 'FullyGraded' as const,
      };

      await expect(service.submitGrade(request)).rejects.toThrow(GradePassbackError);
      expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(1); // 1 score attempt (no retry, token is mocked separately)
    });
  });

  describe('calculateGrade', () => {
    it('should calculate grade percentage correctly', () => {
      const rubricScores = {
        criterion1: 20,
        criterion2: 15,
        criterion3: 10,
      };

      const grade = service.calculateGrade('attempt123', rubricScores, 50);
      expect(grade).toBe(90); // (45/50) * 100 = 90%
    });

    it('should handle perfect scores', () => {
      const rubricScores = {
        criterion1: 50,
        criterion2: 50,
      };

      const grade = service.calculateGrade('attempt123', rubricScores, 100);
      expect(grade).toBe(100);
    });

    it('should handle zero scores', () => {
      const rubricScores = {
        criterion1: 0,
        criterion2: 0,
      };

      const grade = service.calculateGrade('attempt123', rubricScores, 100);
      expect(grade).toBe(0);
    });

    it('should round to 2 decimal places', () => {
      const rubricScores = {
        criterion1: 33,
        criterion2: 33,
      };

      const grade = service.calculateGrade('attempt123', rubricScores, 100);
      expect(grade).toBe(66); // 66/100 = 66%
    });
  });

  describe('trackGradeStatus', () => {
    it('should update grade status in database', async () => {
      const mockRun = vi.fn();
      const mockBind = vi.fn(() => ({ run: mockRun }));
      const mockPrepare = vi.fn(() => ({ bind: mockBind }));
      
      (mockEnv.DB as MockD1Database).prepare = mockPrepare;

      await service.trackGradeStatus('attempt123', 'submitted');

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE assessment_attempts'));
      expect(mockBind).toHaveBeenCalledWith('submitted', null, 'attempt123');
      expect(mockRun).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const mockPrepare = vi.fn(() => {
        throw new Error('Database error');
      });
      
      (mockEnv.DB as MockD1Database).prepare = mockPrepare;

      // Should not throw
      await expect(service.trackGradeStatus('attempt123', 'failed', 'Test error'))
        .resolves.toBeUndefined();
    });
  });

  describe('createGradePassbackService', () => {
    it('should create a new service instance', () => {
      const service = createGradePassbackService(mockEnv as Env);
      expect(service).toBeInstanceOf(GradePassbackService);
    });
  });
});