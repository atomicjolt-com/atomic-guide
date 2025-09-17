/**
 * @fileoverview Unit tests for CanvasGradePassbackService
 * @module features/ai-assessment/server/services/__tests__/CanvasGradePassbackService.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CanvasGradePassbackService } from '../CanvasGradePassbackService';
import type { GradeCalculation } from '../../../shared/types';

// Mock fetch globally
global.fetch = vi.fn();

describe('CanvasGradePassbackService', () => {
  let service: CanvasGradePassbackService;
  let mockGradeCalculation: GradeCalculation;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CanvasGradePassbackService();

    mockGradeCalculation = {
      sessionId: 'session123' as any,
      numericScore: 85,
      letterGrade: 'B',
      components: {
        masteryScore: 80,
        participationScore: 90,
        improvementScore: 85,
        bonusPoints: 5
      },
      feedback: {
        strengths: ['Good understanding of core concepts'],
        areasForImprovement: ['Could provide more detailed explanations'],
        recommendations: ['Practice with additional examples'],
        masteryReport: 'Student has achieved proficiency in basic concepts'
      },
      passback: {
        eligible: true,
        status: 'pending'
      }
    };
  });

  describe('submitGrade', () => {
    it('should successfully submit grade to Canvas LMS', async () => {
      const mockAGSConfig = {
        lineItemsUrl: 'https://canvas.example.com/api/lti/courses/123/line_items/456',
        accessToken: 'mock_token',
        clientId: 'atomic_guide_client',
        deploymentId: 'deployment123',
        maxRetries: 3,
        timeoutMs: 30000,
        rateLimitDelay: 1000
      };

      // Mock successful AGS response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'score123',
          userId: 'user456',
          scoreGiven: 85,
          scoreMaximum: 100,
          activityProgress: 'Completed',
          gradingProgress: 'FullyGraded',
          timestamp: new Date().toISOString()
        })
      });

      const result = await service.submitGrade(mockGradeCalculation, mockAGSConfig);

      expect(result.success).toBe(true);
      expect(result.gradeSubmitted).toBe(85);
      expect(result.canvasResponse).toBeDefined();
      expect(result.submittedAt).toBeDefined();

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockAGSConfig.lineItemsUrl}/scores`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockAGSConfig.accessToken}`,
            'Content-Type': 'application/vnd.ims.lis.v1.score+json'
          }),
          body: expect.stringContaining('"scoreGiven":85')
        })
      );
    });

    it('should handle Canvas API errors with retry logic', async () => {
      const mockAGSConfig = {
        lineItemsUrl: 'https://canvas.example.com/api/lti/courses/123/line_items/456',
        accessToken: 'mock_token',
        clientId: 'atomic_guide_client',
        deploymentId: 'deployment123',
        maxRetries: 2,
        timeoutMs: 30000,
        rateLimitDelay: 100
      };

      // Mock initial failures then success
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: new Headers({ 'Retry-After': '1' })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            id: 'score123',
            userId: 'user456',
            scoreGiven: 85,
            scoreMaximum: 100,
            activityProgress: 'Completed',
            gradingProgress: 'FullyGraded'
          })
        });

      const result = await service.submitGrade(mockGradeCalculation, mockAGSConfig);

      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(2);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should fail after exceeding max retries', async () => {
      const mockAGSConfig = {
        lineItemsUrl: 'https://canvas.example.com/api/lti/courses/123/line_items/456',
        accessToken: 'mock_token',
        clientId: 'atomic_guide_client',
        deploymentId: 'deployment123',
        maxRetries: 2,
        timeoutMs: 30000,
        rateLimitDelay: 100
      };

      // Mock persistent failures
      (global.fetch as any).mockRejectedValue(new Error('Persistent network error'));

      const result = await service.submitGrade(mockGradeCalculation, mockAGSConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to submit grade after 2 retries');
      expect(result.retryCount).toBe(2);
      expect(global.fetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should handle Canvas authentication errors', async () => {
      const mockAGSConfig = {
        lineItemsUrl: 'https://canvas.example.com/api/lti/courses/123/line_items/456',
        accessToken: 'invalid_token',
        clientId: 'atomic_guide_client',
        deploymentId: 'deployment123',
        maxRetries: 1,
        timeoutMs: 30000,
        rateLimitDelay: 1000
      };

      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          error: 'invalid_token',
          error_description: 'The access token provided is invalid'
        })
      });

      const result = await service.submitGrade(mockGradeCalculation, mockAGSConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication failed');
      expect(result.canvasError).toBeDefined();
    });

    it('should validate grade data before submission', async () => {
      const invalidGradeCalculation = {
        ...mockGradeCalculation,
        numericScore: 150 // Invalid score > 100
      };

      const mockAGSConfig = {
        lineItemsUrl: 'https://canvas.example.com/api/lti/courses/123/line_items/456',
        accessToken: 'mock_token',
        clientId: 'atomic_guide_client',
        deploymentId: 'deployment123',
        maxRetries: 3,
        timeoutMs: 30000,
        rateLimitDelay: 1000
      };

      const result = await service.submitGrade(invalidGradeCalculation, mockAGSConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid grade data');
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('validateGradeData', () => {
    it('should accept valid grade data', () => {
      const isValid = service.validateGradeData(mockGradeCalculation);
      expect(isValid).toBe(true);
    });

    it('should reject grades outside valid range', () => {
      const invalidGrade = {
        ...mockGradeCalculation,
        numericScore: -5
      };

      const isValid = service.validateGradeData(invalidGrade);
      expect(isValid).toBe(false);
    });

    it('should reject grades with missing required fields', () => {
      const incompleteGrade = {
        sessionId: 'session123' as any,
        numericScore: 85
        // Missing other required fields
      } as GradeCalculation;

      const isValid = service.validateGradeData(incompleteGrade);
      expect(isValid).toBe(false);
    });
  });

  describe('formatAGSPayload', () => {
    it('should format grade data correctly for AGS submission', () => {
      const payload = service.formatAGSPayload(mockGradeCalculation, 'user123');

      expect(payload).toEqual({
        userId: 'user123',
        scoreGiven: 85,
        scoreMaximum: 100,
        comment: expect.stringContaining('Student has achieved proficiency'),
        activityProgress: 'Completed',
        gradingProgress: 'FullyGraded',
        timestamp: expect.any(String)
      });
    });

    it('should handle partial scores correctly', () => {
      const partialGrade = {
        ...mockGradeCalculation,
        numericScore: 45
      };

      const payload = service.formatAGSPayload(partialGrade, 'user123');

      expect(payload.scoreGiven).toBe(45);
      expect(payload.activityProgress).toBe('Completed');
      expect(payload.gradingProgress).toBe('FullyGraded');
    });
  });

  describe('getGradeStatus', () => {
    it('should check grade submission status from Canvas', async () => {
      const mockAGSConfig = {
        lineItemsUrl: 'https://canvas.example.com/api/lti/courses/123/line_items/456',
        accessToken: 'mock_token',
        clientId: 'atomic_guide_client',
        deploymentId: 'deployment123',
        maxRetries: 3,
        timeoutMs: 30000,
        rateLimitDelay: 1000
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ([
          {
            id: 'score123',
            userId: 'user456',
            scoreGiven: 85,
            scoreMaximum: 100,
            activityProgress: 'Completed',
            gradingProgress: 'FullyGraded',
            timestamp: '2024-01-15T10:30:00Z'
          }
        ])
      });

      const status = await service.getGradeStatus('user456', mockAGSConfig);

      expect(status.found).toBe(true);
      expect(status.scoreGiven).toBe(85);
      expect(status.gradingProgress).toBe('FullyGraded');
    });

    it('should handle cases where no grade is found', async () => {
      const mockAGSConfig = {
        lineItemsUrl: 'https://canvas.example.com/api/lti/courses/123/line_items/456',
        accessToken: 'mock_token',
        clientId: 'atomic_guide_client',
        deploymentId: 'deployment123',
        maxRetries: 3,
        timeoutMs: 30000,
        rateLimitDelay: 1000
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ([]) // Empty array - no grades found
      });

      const status = await service.getGradeStatus('user999', mockAGSConfig);

      expect(status.found).toBe(false);
      expect(status.scoreGiven).toBeUndefined();
    });
  });

  describe('error handling and resilience', () => {
    it('should handle network timeouts gracefully', async () => {
      const mockAGSConfig = {
        lineItemsUrl: 'https://canvas.example.com/api/lti/courses/123/line_items/456',
        accessToken: 'mock_token',
        clientId: 'atomic_guide_client',
        deploymentId: 'deployment123',
        maxRetries: 1,
        timeoutMs: 100, // Very short timeout
        rateLimitDelay: 1000
      };

      // Mock a request that times out
      (global.fetch as any).mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 200))
      );

      const result = await service.submitGrade(mockGradeCalculation, mockAGSConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should respect rate limiting delays', async () => {
      const mockAGSConfig = {
        lineItemsUrl: 'https://canvas.example.com/api/lti/courses/123/line_items/456',
        accessToken: 'mock_token',
        clientId: 'atomic_guide_client',
        deploymentId: 'deployment123',
        maxRetries: 1,
        timeoutMs: 30000,
        rateLimitDelay: 50 // Short delay for testing
      };

      const startTime = Date.now();

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: new Headers({ 'Retry-After': '1' })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: 'score123' })
        });

      await service.submitGrade(mockGradeCalculation, mockAGSConfig);

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThan(50); // Should have waited for rate limit
    });
  });
});