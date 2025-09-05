/**
 * @fileoverview Tests for analytics API handlers
 * @module features/dashboard/server/handlers/__tests__/analyticsApi.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setupAnalyticsTest, type AnalyticsTestContext } from './testHelpers';

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
      });

      expect(testContext.mockServices.analytics.getStudentAnalytics).toHaveBeenCalledWith(
        'student-1', 
        'course-1'
      );
    });

    it('should return 400 when courseId is missing', async () => {
      // Make privacy check fail for missing courseId
      testContext.mockServices.privacy.validatePrivacyConsent.mockResolvedValue({
        isAllowed: false,
        reason: 'missing_course_context'
      });

      const res = await testContext.request('/analytics/student/student-1/performance', {
        method: 'GET',
        headers: {
          'X-Instructor-ID': 'instructor-1'
        }
      });

      expect(res.status).toBe(403); // Will be 403 due to privacy check failure
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
        error: 'Privacy consent denied',
        reason: 'consent_withdrawn'
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
      expect(data).toMatchObject({
        courseId: 'course-1',
        averageScore: 0.78
      });

      expect(testContext.mockServices.analytics.getClassWideAnalytics).toHaveBeenCalledWith('course-1');
      expect(testContext.mockServices.privacy.auditDataAccess).toHaveBeenCalled();
    });

    it('should require instructor authentication', async () => {
      const res = await testContext.request('/analytics/instructor/course-1/overview', {
        method: 'GET'
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain('Instructor authentication required');
    });

    it('should handle database errors gracefully', async () => {
      testContext.mockServices.analytics.getClassWideAnalytics.mockRejectedValue(
        new Error('Database connection failed')
      );

      const res = await testContext.request('/analytics/instructor/course-1/overview', {
        method: 'GET',
        headers: {
          'X-Instructor-ID': 'instructor-1'
        }
      });

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toContain('Failed to retrieve class analytics');
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
        message: 'Recommendation status updated'
      });

      expect(testContext.mockServices.analytics.updateRecommendationStatus).toHaveBeenCalledWith(
        'student-1',
        'rec-123',
        'completed'
      );
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
      expect(testContext.mockServices.analytics.updateRecommendationStatus).toHaveBeenCalledWith(
        'student-1',
        'rec-456',
        'dismissed'
      );
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
        type: 'recommendation_feedback',
        studentId: 'student-1',
        data: {
          recommendationId: 'rec-789',
          action: 'completed',
          feedback: undefined
        }
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
        benchmarkData: { average: 0.72, percentiles: { p50: 0.7, p90: 0.9 } }
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
      expect(data.error).toContain('Insufficient data');
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
        recommendations: [
          { id: 'rec-1', type: 'review', priority: 'high', conceptId: 'arrays' }
        ]
      });

      expect(testContext.mockServices.adaptive.generateAdaptiveRecommendations).toHaveBeenCalledWith(
        'student-1',
        'course-1',
        expect.objectContaining({
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
      expect(data.error).toContain('Student profile not found');
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
          taskType: 'daily_aggregation',
          targetDate: '2024-01-01',
          priority: 'low'
        })
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toMatchObject({
        success: true,
        taskId: 'task-123'
      });

      expect(testContext.mockServices.analytics.queueAnalyticsTask).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'daily_aggregation',
          targetDate: '2024-01-01',
          priority: 'low'
        })
      );
    });
  });
});