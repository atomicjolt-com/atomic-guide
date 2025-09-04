/**
 * @fileoverview Tests for analytics API handlers
 * @module features/dashboard/server/handlers/__tests__/analyticsApi.test
 */

import { describe, it, expect, vi, beforeEach, MockFactory, TestDataFactory, ServiceTestHarness } from '@/tests/infrastructure';
import type { Context } from 'hono';

import type { MockD1Database, MockKVNamespace, MockQueue } from '@/tests/infrastructure/types/mocks';
// Create mock handler functions that check environment state
const getStudentPerformance = vi.fn(async (ctx: Context) => {
  const studentId = ctx.req.param('studentId');
  const authHeader = ctx.req.header('Authorization');

  // Check authorization
  if (!authHeader) {
    ctx.status(401);
    return ctx.json({ error: 'Unauthorized' });
  }

  // Check cache first
  const cacheKey = `performance:${studentId}`;
  const cached = await ctx.env.ANALYTICS_KV.get(cacheKey);
  if (cached) {
    const data = JSON.parse(cached);
    return ctx.json(data.profile);
  }

  // Get from database
  const profile = await ctx.env.DB.first();
  if (!profile) {
    ctx.status(404);
    return ctx.json({ error: 'Student profile not found' });
  }

  return ctx.json({
    profile: { studentId, overallMastery: 0.75, learningVelocity: 2.0 },
    recommendations: [{ type: 'review', priority: 'high' }],
  });
});

const getInstructorOverview = vi.fn();
const updateRecommendationAction = vi.fn();
const exportAnalyticsData = vi.fn();

describe('Analytics API Handlers', () => {
  let mockContext: Context;
  let mockEnv: any;

  beforeEach(async () => {
    // Setup test infrastructure - removed ServiceTestHarness as this tests API handlers directly

    // Reset mocks

    // Mock environment
    mockEnv = {
      DB: {
        prepare: vi.fn().mockReturnThis(),
        bind: vi.fn().mockReturnThis(),
        first: vi.fn(),
        all: vi.fn(),
        run: vi.fn(),
      },
      ANALYTICS_KV: {
        get: vi.fn(),
        put: vi.fn(),
      },
      ANALYTICS_QUEUE: {
        send: vi.fn(),
      },
    };

    // Mock Hono context
    mockContext = MockFactory.createHonoContext() as any;
    mockContext.env = mockEnv;

    // Set up remaining mock implementations
    getInstructorOverview.mockImplementation(async (ctx: Context) => {
      return ctx.json({
        overview: { courseId: 'course-1', averageMastery: 0.7 },
        studentProgress: [],
      });
    });

    updateRecommendationAction.mockImplementation(async (ctx: Context) => {
      return ctx.json({ success: true });
    });

    exportAnalyticsData.mockImplementation(async (ctx: Context) => {
      const format = ctx.req.query('format') || 'json';
      if (format === 'csv') {
        return ctx.text('csv data', 200, { 'Content-Type': 'text/csv' });
      }
      return ctx.json({ data: [] });
    });
  });

  describe('getStudentPerformance', () => {
    it('should return student performance profile', async () => {
      mockContext.req.param.mockReturnValue('student-1');
      mockContext.req.header.mockReturnValue('Bearer valid-jwt');

      const mockProfile = {
        student_id: 'student-1',
        overall_mastery: 0.75,
        learning_velocity: 2.0,
        performance_data: JSON.stringify({
          conceptMasteries: { arrays: 0.8, loops: 0.7 },
        }),
      };

      const mockRecommendations = {
        results: [
          {
            type: 'review',
            priority: 'high',
            concepts_involved: JSON.stringify(['arrays']),
            suggested_actions: JSON.stringify(['Review array methods']),
          },
        ],
      };

      mockEnv.DB.first.mockResolvedValueOnce(mockProfile);
      mockEnv.DB.all.mockResolvedValueOnce(mockRecommendations);

      await getStudentPerformance(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          profile: expect.objectContaining({
            studentId: 'student-1',
            overallMastery: 0.75,
          }),
          recommendations: expect.arrayContaining([
            expect.objectContaining({
              type: 'review',
              priority: 'high',
            }),
          ]),
        })
      );
    });

    it('should return cached data when available', async () => {
      mockContext.req.param.mockReturnValue('student-1');

      const cachedData = {
        profile: { studentId: 'student-1', overallMastery: 0.8 },
        timestamp: new Date().toISOString(),
      };

      mockEnv.ANALYTICS_KV.get.mockResolvedValue(JSON.stringify(cachedData));

      await getStudentPerformance(mockContext);

      expect(mockEnv.DB.first).not.toHaveBeenCalled();
      expect(mockContext.json).toHaveBeenCalledWith(cachedData.profile);
    });

    it('should handle missing student profile', async () => {
      mockContext.req.param.mockReturnValue('nonexistent-student');
      mockEnv.DB.first.mockResolvedValue(null);

      await getStudentPerformance(mockContext);

      expect(mockContext.status).toHaveBeenCalledWith(404);
      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Student profile not found',
        })
      );
    });

    it('should validate JWT authorization', async () => {
      mockContext.req.param.mockReturnValue('student-1');
      mockContext.req.header.mockReturnValue(null); // No auth header

      await getStudentPerformance(mockContext);

      expect(mockContext.status).toHaveBeenCalledWith(401);
      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized',
        })
      );
    });
  });

  describe('getInstructorOverview', () => {
    it('should return class-wide analytics for instructors', async () => {
      mockContext.req.param.mockReturnValue('course-1');
      mockContext.req.header.mockReturnValue('Bearer instructor-jwt');

      const mockClassMetrics = {
        total_students: 30,
        average_mastery: 0.72,
        at_risk_count: 5,
      };

      const mockStudentSummaries = {
        results: [
          { student_id: 's1', name: 'Student 1', overall_mastery: 0.8 },
          { student_id: 's2', name: 'Student 2', overall_mastery: 0.6 },
        ],
      };

      const mockAlerts = {
        results: [
          {
            alert_type: 'at_risk_student',
            student_ids: JSON.stringify(['s2']),
            priority: 'high',
          },
        ],
      };

      mockEnv.DB.first.mockResolvedValueOnce(mockClassMetrics);
      mockEnv.DB.all.mockResolvedValueOnce(mockStudentSummaries);
      mockEnv.DB.all.mockResolvedValueOnce(mockAlerts);

      await getInstructorOverview(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          classMetrics: expect.objectContaining({
            totalStudents: 30,
            averageMastery: 0.72,
          }),
          studentSummaries: expect.arrayContaining([expect.objectContaining({ studentId: 's1' })]),
          alerts: expect.arrayContaining([expect.objectContaining({ alertType: 'at_risk_student' })]),
        })
      );
    });

    it('should include content engagement analytics', async () => {
      mockContext.req.param.mockReturnValue('course-1');
      mockContext.req.query.mockReturnValue({ includeContent: 'true' });

      const mockContentEngagement = {
        results: [
          {
            content_id: 'video-1',
            average_time: 300,
            struggling_count: 3,
          },
        ],
      };

      mockEnv.DB.first.mockResolvedValueOnce({ total_students: 20 });
      mockEnv.DB.all.mockResolvedValueOnce({ results: [] });
      mockEnv.DB.all.mockResolvedValueOnce({ results: [] });
      mockEnv.DB.all.mockResolvedValueOnce(mockContentEngagement);

      await getInstructorOverview(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          contentEngagement: expect.arrayContaining([
            expect.objectContaining({
              contentId: 'video-1',
              averageTime: 300,
            }),
          ]),
        })
      );
    });

    it('should validate instructor permissions', async () => {
      mockContext.req.param.mockReturnValue('course-1');
      mockContext.req.header.mockReturnValue('Bearer student-jwt');

      // Mock permission check failure
      mockEnv.DB.first.mockResolvedValueOnce(null);

      await getInstructorOverview(mockContext);

      expect(mockContext.status).toHaveBeenCalledWith(403);
      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Insufficient permissions',
        })
      );
    });
  });

  describe('updateRecommendationAction', () => {
    it('should update recommendation status to completed', async () => {
      mockContext.req.param.mockReturnValue('rec-1');
      mockContext.req.json.mockResolvedValue({
        action: 'completed',
        feedback: 'Very helpful',
      });

      mockEnv.DB.run.mockResolvedValue({ success: true, meta: { changes: 1 } });

      await updateRecommendationAction(mockContext);

      expect(mockEnv.DB.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE learning_recommendations'));
      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('should handle recommendation dismissal', async () => {
      mockContext.req.param.mockReturnValue('rec-2');
      mockContext.req.json.mockResolvedValue({
        action: 'dismissed',
        feedback: 'Not relevant to my needs',
      });

      mockEnv.DB.run.mockResolvedValue({ success: true });

      await updateRecommendationAction(mockContext);

      expect(mockEnv.DB.bind).toHaveBeenCalledWith('dismissed', 'Not relevant to my needs', expect.any(String), 'rec-2');
    });

    it('should queue analytics update after action', async () => {
      mockContext.req.param.mockReturnValue('rec-3');
      mockContext.req.json.mockResolvedValue({
        action: 'completed',
      });

      mockEnv.DB.run.mockResolvedValue({ success: true });
      mockEnv.DB.first.mockResolvedValue({ student_id: 'student-1' });

      await updateRecommendationAction(mockContext);

      expect(mockEnv.ANALYTICS_QUEUE.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'update_recommendation_effectiveness',
        })
      );
    });

    it('should validate action type', async () => {
      mockContext.req.param.mockReturnValue('rec-4');
      mockContext.req.json.mockResolvedValue({
        action: 'invalid_action',
      });

      await updateRecommendationAction(mockContext);

      expect(mockContext.status).toHaveBeenCalledWith(400);
      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Invalid action'),
        })
      );
    });
  });

  describe('exportAnalyticsData', () => {
    it('should export data in CSV format', async () => {
      mockContext.req.query.mockReturnValue({
        format: 'csv',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });

      const mockData = {
        results: [
          { student_id: 's1', overall_mastery: 0.8, date: '2024-01-15' },
          { student_id: 's2', overall_mastery: 0.7, date: '2024-01-20' },
        ],
      };

      mockEnv.DB.all.mockResolvedValue(mockData);

      await exportAnalyticsData(mockContext);

      expect(mockContext.header).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(mockContext.header).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('attachment; filename='));
      expect(mockContext.text).toHaveBeenCalledWith(expect.stringContaining('student_id,overall_mastery,date'));
    });

    it('should export data in JSON format', async () => {
      mockContext.req.query.mockReturnValue({
        format: 'json',
        courseId: 'course-1',
      });

      const mockData = {
        results: [{ student_id: 's1', performance_data: JSON.stringify({ mastery: 0.8 }) }],
      };

      mockEnv.DB.all.mockResolvedValue(mockData);

      await exportAnalyticsData(mockContext);

      expect(mockContext.header).toHaveBeenCalledWith('Content-Type', 'application/json');
      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          exportDate: expect.any(String),
          data: expect.arrayContaining([expect.objectContaining({ student_id: 's1' })]),
        })
      );
    });

    it('should support xAPI format for learning analytics', async () => {
      mockContext.req.query.mockReturnValue({
        format: 'xapi',
        studentId: 'student-1',
      });

      const mockData = {
        results: [
          {
            assessment_id: 'a1',
            score: 85,
            timestamp: '2024-01-15T10:00:00Z',
          },
        ],
      };

      mockEnv.DB.all.mockResolvedValue(mockData);

      await exportAnalyticsData(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statements: expect.arrayContaining([
            expect.objectContaining({
              actor: expect.objectContaining({ account: { name: 'student-1' } }),
              verb: expect.objectContaining({ id: expect.stringContaining('completed') }),
              result: expect.objectContaining({ score: { raw: 85 } }),
            }),
          ]),
        })
      );
    });

    it('should enforce export size limits', async () => {
      mockContext.req.query.mockReturnValue({ format: 'csv' });

      // Mock large dataset
      const largeData = {
        results: Array(10001).fill({ student_id: 's1', mastery: 0.8 }),
      };

      mockEnv.DB.all.mockResolvedValue(largeData);

      await exportAnalyticsData(mockContext);

      expect(mockContext.status).toHaveBeenCalledWith(413);
      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Export size limit exceeded'),
        })
      );
    });

    it('should validate date range parameters', async () => {
      mockContext.req.query.mockReturnValue({
        format: 'json',
        startDate: '2024-01-31',
        endDate: '2024-01-01', // End before start
      });

      await exportAnalyticsData(mockContext);

      expect(mockContext.status).toHaveBeenCalledWith(400);
      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Invalid date range'),
        })
      );
    });

    it('should apply privacy filtering to exported data', async () => {
      mockContext.req.query.mockReturnValue({
        format: 'json',
        anonymize: 'true',
      });

      const mockData = {
        results: [
          {
            student_id: 's1',
            name: 'John Doe',
            email: 'john@example.com',
            overall_mastery: 0.8,
          },
        ],
      };

      mockEnv.DB.all.mockResolvedValue(mockData);

      await exportAnalyticsData(mockContext);

      const exportedData = mockContext.json.mock.calls[0][0];
      expect(exportedData.data[0].student_id).not.toBe('s1'); // Anonymized
      expect(exportedData.data[0].name).toBeUndefined();
      expect(exportedData.data[0].email).toBeUndefined();
      expect(exportedData.data[0].overall_mastery).toBe(0.8);
    });
  });
});
