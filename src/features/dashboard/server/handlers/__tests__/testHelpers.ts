/**
 * @fileoverview Test helpers for analytics API tests
 * @module features/dashboard/server/handlers/__tests__/testHelpers
 */

import { vi } from 'vitest';
import { Hono } from 'hono';
import type { D1Database, Queue, Ai } from '@cloudflare/workers-types';
import { createAnalyticsApi } from '../analyticsApi';
import type { ServiceContainer, ServiceFactory, AnalyticsEnv } from '../serviceFactory';

/**
 * Create mock service container with all default mocks
 */
export function createMockServices(): ServiceContainer {
  return {
    analytics: {
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
      getClassWideAnalytics: vi.fn().mockResolvedValue({
        courseId: 'course-1',
        averageScore: 0.78,
        strugglingStudents: [],
        topPerformers: []
      }),
      updateRecommendationStatus: vi.fn().mockResolvedValue(true),
      queueAnalyticsTask: vi.fn().mockResolvedValue('task-123'),
      getStudentPerformanceProfile: vi.fn().mockResolvedValue({
        studentId: 'student-1',
        performanceScore: 0.85,
        recentProgress: { completed: 10, attempted: 15 },
        strugglesIdentified: [],
        recommendations: []
      })
    } as any,
    privacy: {
      validatePrivacyConsent: vi.fn().mockResolvedValue({ 
        isAllowed: true, 
        reason: 'consent_granted' 
      }),
      auditDataAccess: vi.fn().mockResolvedValue(undefined),
      getAnonymizedBenchmark: vi.fn().mockResolvedValue({
        benchmarkData: { average: 0.72, percentiles: { p50: 0.7, p90: 0.9 } }
      })
    } as any,
    adaptive: {
      generateAdaptiveRecommendations: vi.fn().mockResolvedValue([
        { id: 'rec-1', type: 'review', priority: 'high', conceptId: 'arrays' }
      ])
    } as any
  };
}

/**
 * Create mock environment bindings
 */
export function createMockEnv(): AnalyticsEnv {
  return {
    DB: {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(),
      all: vi.fn(),
      run: vi.fn(),
    } as unknown as D1Database,
    ANALYTICS_QUEUE: {
      send: vi.fn().mockResolvedValue(undefined),
    } as unknown as Queue,
    AI: {} as unknown as Ai,
  };
}

/**
 * Set up analytics API test context with mocked services
 * 
 * @param tenantId - Optional tenant ID (defaults to 'test-tenant')
 * @returns Test context with app, services, and utilities
 */
export function setupAnalyticsTest(tenantId: string = 'test-tenant') {
  const mockServices = createMockServices();
  const mockEnv = createMockEnv();
  
  // Create a factory that returns our mock services
  const mockFactory: ServiceFactory = vi.fn(() => mockServices);
  
  // Create the app with our mock factory
  const app = new Hono();
  app.route('/analytics', createAnalyticsApi(tenantId, mockFactory));
  
  return {
    app,
    mockServices,
    mockEnv,
    mockFactory,
    // Helper to make requests
    request: (path: string, options?: RequestInit) => {
      return app.request(path, options, mockEnv);
    },
    // Helper to reset all mocks
    resetMocks: () => {
      vi.clearAllMocks();
      // Reset to default successful responses
      mockServices.analytics.getStudentAnalytics.mockResolvedValue({
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
      mockServices.privacy.validatePrivacyConsent.mockResolvedValue({ 
        isAllowed: true, 
        reason: 'consent_granted' 
      });
      mockServices.privacy.auditDataAccess.mockResolvedValue(undefined);
      mockServices.adaptive.generateAdaptiveRecommendations.mockResolvedValue([
        { id: 'rec-1', type: 'review', priority: 'high', conceptId: 'arrays' }
      ]);
    }
  };
}

/**
 * Type for the test context returned by setupAnalyticsTest
 */
export type AnalyticsTestContext = ReturnType<typeof setupAnalyticsTest>;