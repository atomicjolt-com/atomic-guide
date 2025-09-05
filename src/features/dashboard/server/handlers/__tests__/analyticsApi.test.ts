/**
 * @fileoverview Tests for analytics API handlers
 * @module features/dashboard/server/handlers/__tests__/analyticsApi.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { D1Database, Queue, Ai } from '@cloudflare/workers-types';

// Create persistent mocks
const mockValidatePrivacyConsent = vi.fn();
const mockAuditDataAccess = vi.fn();
const mockGetAnonymizedBenchmark = vi.fn();
const mockQueueAnalyticsTask = vi.fn();

// Mock the service classes before imports
vi.mock('../../services/PerformanceAnalyticsService', () => ({
  PerformanceAnalyticsService: vi.fn().mockImplementation(() => ({
    getStudentAnalytics: vi.fn().mockResolvedValue({
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
    }),
    queueAnalyticsTask: mockQueueAnalyticsTask,
    getClassWideAnalytics: vi.fn().mockResolvedValue({
      courseId: 'course-1',
      averageScore: 0.78,
      strugglingStudents: [],
      topPerformers: []
    }),
    updateRecommendationStatus: vi.fn().mockResolvedValue(true)
  }))
}));

vi.mock('../../services/PrivacyPreservingAnalytics', () => ({
  PrivacyPreservingAnalytics: vi.fn().mockImplementation(() => ({
    validatePrivacyConsent: mockValidatePrivacyConsent,
    auditDataAccess: mockAuditDataAccess,
    getAnonymizedBenchmark: mockGetAnonymizedBenchmark
  }))
}));

vi.mock('../../services/AdaptiveLearningService', () => ({
  AdaptiveLearningService: vi.fn().mockImplementation(() => ({
    generateAdaptiveRecommendations: vi.fn().mockResolvedValue([
      { id: 'rec-1', type: 'review', priority: 'high', conceptId: 'arrays' }
    ])
  }))
}));

// Import after mocks are set up
import { createAnalyticsApi } from '../analyticsApi';

// Helper to create mock environment
const createMockEnv = () => ({
  DB: {
    prepare: vi.fn().mockReturnThis(),
    bind: vi.fn().mockReturnThis(),
    first: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
  } as unknown as D1Database,
  ANALYTICS_QUEUE: {
    send: vi.fn(),
  } as unknown as Queue,
  AI: {} as unknown as Ai,
});

describe('Analytics API Handlers', () => {
  let app: Hono;
  let mockEnv: ReturnType<typeof createMockEnv>;
  const tenantId = 'test-tenant';

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset mocks to default behavior
    mockValidatePrivacyConsent.mockResolvedValue({ 
      isAllowed: true, 
      reason: 'consent_granted' 
    });
    mockAuditDataAccess.mockResolvedValue(undefined);
    mockGetAnonymizedBenchmark.mockResolvedValue({
      benchmarkData: { average: 0.72, percentiles: { p50: 0.7, p90: 0.9 } }
    });
    mockQueueAnalyticsTask.mockResolvedValue('task-123');
    
    mockEnv = createMockEnv();
    app = new Hono();
    
    // Mount the analytics API
    app.route('/analytics', createAnalyticsApi(tenantId));
  });

  describe('GET /analytics/student/:studentId/performance', () => {
    it('should return student performance profile', async () => {
      const res = await app.request('/analytics/student/student-1/performance?courseId=course-1', {
        method: 'GET',
        headers: {
          'X-Instructor-ID': 'instructor-1'
        }
      }, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        success: true,
        data: expect.objectContaining({
          profile: expect.objectContaining({
            studentId: 'student-1',
            overallMastery: 0.75,
          }),
          conceptMasteries: expect.arrayContaining([
            expect.objectContaining({
              conceptId: 'arrays',
              masteryLevel: 0.8
            })
          ])
        })
      });
    });

    it('should return 400 when courseId is missing', async () => {
      const res = await app.request('/analytics/student/student-1/performance', {
        method: 'GET'
      }, mockEnv);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toEqual({
        success: false,
        error: 'courseId query parameter is required'
      });
    });

    it('should handle privacy consent denial', async () => {
      // Override privacy consent for this test
      mockValidatePrivacyConsent.mockResolvedValue({
        isAllowed: false,
        reason: 'no_consent'
      });

      const res = await app.request('/analytics/student/student-1/performance?courseId=course-1', {
        method: 'GET'
      }, mockEnv);

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data).toEqual({
        success: false,
        error: 'Access denied: no_consent'
      });
    });

    it('should handle service errors gracefully', async () => {
      // Mock privacy service to allow access first
      vi.mocked(PrivacyPreservingAnalytics).mockImplementation(() => ({
        validatePrivacyConsent: vi.fn().mockResolvedValue({ isAllowed: true, reason: 'consent_granted' }),
        auditDataAccess: vi.fn().mockResolvedValue(undefined),
        getAnonymizedBenchmark: vi.fn().mockResolvedValue({ benchmarkData: { average: 0.72 } })
      }));

      // Mock service to throw error for this test
      vi.mocked(PerformanceAnalyticsService).mockImplementation(() => ({
        getStudentAnalytics: vi.fn().mockRejectedValue(new Error('Database error')),
        queueAnalyticsTask: vi.fn().mockResolvedValue('task-123')
      }));

      const res = await app.request('/analytics/student/student-1/performance?courseId=course-1', {
        method: 'GET'
      }, mockEnv);

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data).toEqual({
        success: false,
        error: 'Failed to retrieve student analytics'
      });
    });
  });

  describe('GET /analytics/instructor/:courseId/overview', () => {
    it('should return class-wide analytics for instructors', async () => {
      // Mock database responses for helper functions
      mockEnv.DB.first
        .mockResolvedValueOnce({ total_students: 30, average_mastery: 0.72, at_risk_count: 5 })
        .mockResolvedValueOnce({ concept_name: 'arrays' });
      
      mockEnv.DB.all
        .mockResolvedValueOnce({ results: [{ concept_name: 'arrays' }] })
        .mockResolvedValueOnce({ results: [{ student_id: 's1', name: 'Student 1', overall_mastery: 0.8, last_active: '2024-01-01' }] })
        .mockResolvedValueOnce({ results: [{ id: 'alert-1', alert_type: 'at_risk_student', priority: 'high', student_ids: '["s2"]', alert_data: '{}', created_at: '2024-01-01', acknowledged: false }] })
        .mockResolvedValueOnce({ results: [{ content_id: 'video-1', average_time: 300, struggling_students: 3, total_students: 30 }] });

      const res = await app.request('/analytics/instructor/course-1/overview', {
        method: 'GET',
        headers: {
          'X-Instructor-ID': 'instructor-1'
        }
      }, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        success: true,
        data: expect.objectContaining({
          classMetrics: expect.objectContaining({
            totalStudents: 30,
            averageMastery: 0.72,
            atRiskCount: 5
          }),
          studentSummaries: expect.arrayContaining([
            expect.objectContaining({ 
              studentId: 's1',
              overallMastery: 0.8
            })
          ]),
          alerts: expect.arrayContaining([
            expect.objectContaining({ 
              alertType: 'at_risk_student',
              priority: 'high'
            })
          ])
        })
      });
    });

    it('should require instructor authentication', async () => {
      const res = await app.request('/analytics/instructor/course-1/overview', {
        method: 'GET'
        // No X-Instructor-ID header
      }, mockEnv);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data).toEqual({
        success: false,
        error: 'Instructor authentication required'
      });
    });

    it('should handle database errors gracefully', async () => {
      mockEnv.DB.first.mockRejectedValue(new Error('Database connection failed'));

      const res = await app.request('/analytics/instructor/course-1/overview', {
        method: 'GET',
        headers: {
          'X-Instructor-ID': 'instructor-1'
        }
      }, mockEnv);

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
      mockEnv.DB.run.mockResolvedValue({ success: true, meta: { changes: 1 } });
      
      const res = await app.request('/analytics/recommendations/student-1/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recommendationId: 'rec-1',
          action: 'completed',
          feedback: 'Very helpful'
        })
      }, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        success: true,
        message: 'Recommendation action processed successfully'
      });
      
      expect(mockEnv.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE learning_recommendations')
      );
    });

    it('should handle recommendation dismissal', async () => {
      mockEnv.DB.run.mockResolvedValue({ success: true });
      
      const res = await app.request('/analytics/recommendations/student-1/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recommendationId: 'rec-2',
          action: 'dismissed',
          feedback: 'Not relevant to my needs'
        })
      }, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        success: true,
        message: 'Recommendation action processed successfully'
      });
      
      expect(mockEnv.DB.bind).toHaveBeenCalledWith(
        'dismissed', 'dismissed', 'dismissed', 'rec-2'
      );
    });

    it('should queue analytics update after completion', async () => {
      // Mock the analytics service to call the queue when queueAnalyticsTask is invoked
      const mockQueueAnalyticsTask = vi.fn().mockImplementation(async (task) => {
        await mockEnv.ANALYTICS_QUEUE.send(task);
        return 'task-123';
      });
      
      vi.mocked(PerformanceAnalyticsService).mockImplementation(() => ({
        getStudentAnalytics: vi.fn().mockResolvedValue({
          profile: { studentId: 'student-1', overallMastery: 0.75 },
          conceptMasteries: []
        }),
        queueAnalyticsTask: mockQueueAnalyticsTask
      }));
      
      mockEnv.DB.run.mockResolvedValue({ success: true });
      
      const res = await app.request('/analytics/recommendations/student-1/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recommendationId: 'rec-3',
          action: 'completed'
        })
      }, mockEnv);

      expect(res.status).toBe(200);
      // Verify analytics task was queued
      expect(mockEnv.ANALYTICS_QUEUE.send).toHaveBeenCalled();
    });

    it('should validate request body', async () => {
      const res = await app.request('/analytics/recommendations/student-1/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recommendationId: 'rec-4',
          action: 'invalid_action'
        })
      }, mockEnv);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
    });
  });

  describe('GET /analytics/benchmarks', () => {
    it('should return benchmark data', async () => {
      const res = await app.request('/analytics/benchmarks?courseId=course-1&benchmarkType=course_average&aggregationLevel=course', {
        method: 'GET'
      }, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        success: true,
        data: expect.objectContaining({
          benchmarkData: expect.any(Object)
        })
      });
    });

    it('should handle insufficient data for benchmark', async () => {
      // Mock privacy service to return null for insufficient data
      vi.mocked(PrivacyPreservingAnalytics).mockImplementation(() => ({
        validatePrivacyConsent: vi.fn().mockResolvedValue({ 
          isAllowed: true, 
          reason: 'consent_granted' 
        }),
        auditDataAccess: vi.fn().mockResolvedValue(undefined),
        getAnonymizedBenchmark: vi.fn().mockResolvedValue(null)
      }));

      const res = await app.request('/analytics/benchmarks?courseId=course-1&benchmarkType=course_average&aggregationLevel=course', {
        method: 'GET'
      }, mockEnv);

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data).toEqual({
        success: false,
        error: 'Insufficient data for privacy-preserving benchmark'
      });
    });

    it('should validate query parameters', async () => {
      const res = await app.request('/analytics/benchmarks', {
        method: 'GET'
        // Missing required courseId parameter
      }, mockEnv);

      expect(res.status).toBe(400);
    });

  });

  describe('POST /analytics/recommendations/adaptive', () => {
    it('should generate adaptive recommendations', async () => {
      // Reset mocks to ensure clean state
      vi.mocked(PrivacyPreservingAnalytics).mockImplementation(() => ({
        validatePrivacyConsent: vi.fn().mockResolvedValue({ isAllowed: true, reason: 'consent_granted' }),
        auditDataAccess: vi.fn().mockResolvedValue(undefined),
        getAnonymizedBenchmark: vi.fn().mockResolvedValue({ benchmarkData: { average: 0.72 } })
      }));

      vi.mocked(PerformanceAnalyticsService).mockImplementation(() => ({
        getStudentAnalytics: vi.fn().mockResolvedValue({
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
        }),
        queueAnalyticsTask: vi.fn().mockResolvedValue('task-123')
      }));

      vi.mocked(AdaptiveLearningService).mockImplementation(() => ({
        generateAdaptiveRecommendations: vi.fn().mockResolvedValue([
          { id: 'rec-1', type: 'review', priority: 'high', conceptId: 'loops' }
        ])
      }));

      const res = await app.request('/analytics/recommendations/adaptive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          studentId: 'student-1',
          courseId: 'course-1',
          timeAvailable: 30,
          difficultyPreference: 'moderate',
          goalType: 'mastery'
        })
      }, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        success: true,
        data: expect.objectContaining({
          recommendations: expect.arrayContaining([
            expect.objectContaining({
              id: 'rec-1',
              type: 'review',
              priority: 'high'
            })
          ]),
          generatedAt: expect.any(String),
          context: expect.objectContaining({
            overallMastery: 0.75
          })
        })
      });
    });

    it('should handle missing student profile', async () => {
      // Mock service to return null profile
      vi.mocked(PerformanceAnalyticsService).mockImplementation(() => ({
        getStudentAnalytics: vi.fn().mockResolvedValue({
          profile: null,
          conceptMasteries: []
        }),
        queueAnalyticsTask: vi.fn().mockResolvedValue('task-123')
      }));

      const res = await app.request('/analytics/recommendations/adaptive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          studentId: 'student-1',
          courseId: 'course-1'
        })
      }, mockEnv);

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

      const res = await app.request('/analytics/queue/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          studentId: 'student-1',
          courseId: 'course-1',
          taskTypes: ['performance_update', 'recommendation_generation'],
          priority: 5
        })
      }, mockEnv);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        success: true,
        data: expect.objectContaining({
          message: 'Analytics processing queued successfully',
          taskIds: ['task-123', 'task-123'],
          queuedAt: expect.any(String)
        })
      });
    });
  });
});
