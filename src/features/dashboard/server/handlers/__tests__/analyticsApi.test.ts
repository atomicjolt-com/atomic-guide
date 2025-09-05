/**
 * @fileoverview Tests for analytics API handlers
 * @module features/dashboard/server/handlers/__tests__/analyticsApi.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupAnalyticsTest, type AnalyticsTestContext } from './testHelpers';
import { PerformanceAnalyticsService } from '../services/PerformanceAnalyticsService';
import { PrivacyPreservingAnalytics } from '../services/PrivacyPreservingAnalytics';
import { AdaptiveLearningService } from '../services/AdaptiveLearningService';

// Mock the service classes
vi.mock('../services/PerformanceAnalyticsService');
vi.mock('../services/PrivacyPreservingAnalytics');  
vi.mock('../services/AdaptiveLearningService');

describe('Analytics API Handlers', () => {
  let testContext: AnalyticsTestContext;

  beforeEach(() => {
    testContext = setupAnalyticsTest('test-tenant');
    testContext.resetMocks();
  });

  describe('GET /analytics/student/:studentId/performance', () => {
    it('should return student performance profile', async () => {
      const res = await testContext.request('/analytics/student/student-1/performance?courseId=course-1', {
        method: 'GET',
        headers: {
          'X-Instructor-ID': 'instructor-1'
        }
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        success: true,
        data: {
          profile: {
            studentId: 'student-1',
            overallMastery: 0.75,
            learningVelocity: 2.0,
            confidenceLevel: 0.8
          },
          conceptMasteries: [
            { conceptId: 'arrays', masteryLevel: 0.8 },
            { conceptId: 'loops', masteryLevel: 0.6 }
          ]
        }
      });

      expect(testContext.mockServices.analytics.getStudentAnalytics).toHaveBeenCalledWith(
        'student-1', 
        'course-1'
      );
    });

    it('should return 400 when courseId is missing', async () => {
      const res = await testContext.request('/analytics/student/student-1/performance', {
        method: 'GET',
        headers: {
          'X-Instructor-ID': 'instructor-1'
        }
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toEqual({
        success: false,
        error: 'courseId query parameter is required'
      });
    });

    it('should handle privacy consent denial', async () => {
      testContext.mockServices.privacy.validatePrivacyConsent.mockResolvedValue({ 
        isAllowed: false, 
        reason: 'consent_withdrawn' 
      });

      const res = await testContext.request('/analytics/student/student-1/performance?courseId=course-1', {
        method: 'GET',
        headers: {
          'X-Instructor-ID': 'instructor-1'
        }
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data).toEqual({
        success: false,
        error: 'Access denied: consent_withdrawn'
      });
    });

    it('should handle service errors gracefully', async () => {
      testContext.mockServices.analytics.getStudentAnalytics.mockRejectedValue(
        new Error('Database error')
      );

      const res = await testContext.request('/analytics/student/student-1/performance?courseId=course-1', {
        method: 'GET',
        headers: {
          'X-Instructor-ID': 'instructor-1'
        }
      });

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toContain('Failed to retrieve student analytics');
    });
  });

  describe('GET /analytics/instructor/:courseId/overview', () => {
    it('should return class-wide analytics for instructors', async () => {
      const res = await testContext.request('/analytics/instructor/course-1/overview', {
        method: 'GET',
        headers: {
          'X-Instructor-ID': 'instructor-1'
        }
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        success: true,
        data: {
          classMetrics: expect.objectContaining({
            totalStudents: expect.any(Number),
            averageMastery: expect.any(Number),
            atRiskCount: expect.any(Number)
          }),
          studentSummaries: expect.any(Array),
          alerts: expect.any(Array),
          contentEngagement: expect.any(Array)
        }
      });

      expect(testContext.mockServices.privacy.auditDataAccess).toHaveBeenCalled();
    });

    it('should require instructor authentication', async () => {
      const res = await testContext.request('/analytics/instructor/course-1/overview', {
        method: 'GET'
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data).toEqual({
        success: false,
        error: 'Instructor authentication required'
      });
    });

    it('should handle database errors gracefully', async () => {
      // Mock database to fail
      const mockEnv = testContext.mockEnv;
      (mockEnv.DB.first as any).mockRejectedValue(new Error('Database connection failed'));

      const res = await testContext.request('/analytics/instructor/course-1/overview', {
        method: 'GET',
        headers: {
          'X-Instructor-ID': 'instructor-1'
        }
      });

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data).toEqual({
        success: false,
        error: 'Failed to retrieve instructor analytics'
      });
    });
  });

  describe('POST /analytics/recommendations/:studentId/action', () => {
    it('should update recommendation status to completed', async () => {
      const res = await testContext.request('/analytics/recommendations/student-1/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Student-ID': 'student-1'
        },
        body: JSON.stringify({
          recommendationId: 'rec-123',
          action: 'completed',
          feedback: 'Helpful'
        })
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        success: true,
        message: 'Recommendation action processed successfully'
      });
    });

    it('should handle recommendation dismissal', async () => {
      const res = await testContext.request('/analytics/recommendations/student-1/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Student-ID': 'student-1'
        },
        body: JSON.stringify({
          recommendationId: 'rec-456',
          action: 'dismissed',
          feedback: 'Not relevant'
        })
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        success: true,
        message: 'Recommendation action processed successfully'
      });
    });

    it('should queue analytics update after completion', async () => {
      const res = await testContext.request('/analytics/recommendations/student-1/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Student-ID': 'student-1'
        },
        body: JSON.stringify({
          recommendationId: 'rec-789',
          action: 'completed'
        })
      });

      expect(res.status).toBe(200);
      expect(testContext.mockServices.analytics.queueAnalyticsTask).toHaveBeenCalledWith({
        taskType: 'recommendation_generation',
        tenantId: 'test-tenant',
        studentId: 'student-1',
        priority: 5,
        taskData: { triggeredBy: 'recommendation_completed' }
      });
    });

    it('should validate request body', async () => {
      const res = await testContext.request('/analytics/recommendations/student-1/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Student-ID': 'student-1'
        },
        body: JSON.stringify({
          action: 'invalid-action'
        })
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /analytics/benchmarks', () => {
    it('should return benchmark data', async () => {
      const res = await testContext.request('/analytics/benchmarks?courseId=course-1&benchmarkType=course_average&aggregationLevel=course', {
        method: 'GET',
        headers: {
          'X-Instructor-ID': 'instructor-1'
        }
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        success: true,
        data: {
          average: 0.72, 
          percentiles: { p50: 0.7, p90: 0.9 }
        }
      });

      expect(testContext.mockServices.privacy.getAnonymizedBenchmark).toHaveBeenCalled();
    });

    it('should handle insufficient data for benchmark', async () => {
      testContext.mockServices.privacy.getAnonymizedBenchmark.mockResolvedValue(null);

      const res = await testContext.request('/analytics/benchmarks?courseId=course-1&benchmarkType=course_average&aggregationLevel=course', {
        method: 'GET',
        headers: {
          'X-Instructor-ID': 'instructor-1'
        }
      });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data).toEqual({
        success: false,
        error: 'Insufficient data for privacy-preserving benchmark'
      });
    });

    it('should validate query parameters', async () => {
      const res = await testContext.request('/analytics/benchmarks?benchmarkType=invalid', {
        method: 'GET',
        headers: {
          'X-Instructor-ID': 'instructor-1'
        }
      });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /analytics/recommendations/adaptive', () => {
    it('should generate adaptive recommendations', async () => {
      const res = await testContext.request('/analytics/recommendations/adaptive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Student-ID': 'student-1'
        },
        body: JSON.stringify({
          studentId: 'student-1',
          courseId: 'course-1',
          timeAvailable: 30,
          difficultyPreference: 'moderate',
          goalType: 'mastery'
        })
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        success: true,
        data: {
          recommendations: [
            { id: 'rec-1', type: 'review', priority: 'high', conceptId: 'arrays' }
          ],
          generatedAt: expect.any(String),
          context: expect.objectContaining({
            overallMastery: expect.any(Number),
            strugglingConceptsCount: expect.any(Number),
            strongConceptsCount: expect.any(Number)
          })
        }
      });

      expect(testContext.mockServices.adaptive.generateAdaptiveRecommendations).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: 'student-1',
          courseId: 'course-1',
          timeAvailable: 30,
          difficultyPreference: 'moderate',
          goalType: 'mastery'
        })
      );
    });

    it('should handle missing student profile', async () => {
      testContext.mockServices.analytics.getStudentAnalytics.mockResolvedValue({
        profile: null,
        conceptMasteries: []
      });

      const res = await testContext.request('/analytics/recommendations/adaptive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Student-ID': 'student-1'
        },
        body: JSON.stringify({
          studentId: 'student-1',
          courseId: 'course-1'
        })
      });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data).toEqual({
        success: false,
        error: 'Student performance profile not found'
      });
    });
  });

  describe('POST /analytics/queue/process', () => {
    it('should queue analytics processing tasks', async () => {
      const res = await testContext.request('/analytics/queue/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          studentId: 'student-1',
          courseId: 'course-1',
          taskTypes: ['performance_update', 'recommendation_generation'],
          priority: 7
        })
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        success: true,
        data: {
          message: 'Analytics processing queued successfully',
          taskIds: ['task-123', 'task-123'],
          queuedAt: expect.any(String)
        }
      });

      expect(testContext.mockServices.analytics.queueAnalyticsTask).toHaveBeenCalledTimes(2);
    });
  });
});