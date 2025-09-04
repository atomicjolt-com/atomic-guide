/**
 * @fileoverview Analytics domain-specific test utilities
 * @module tests/infrastructure/utilities/AnalyticsTestUtils
 */

import { vi } from 'vitest';
import { MockFactory } from '../mocks/MockFactory';
import { TestDataFactory } from '../builders/TestDataFactory';
import type { MockD1Database, MockQueue, MockAI } from '../types/mocks';

export interface AnalyticsEnv {
  DB: MockD1Database;
  ANALYTICS_QUEUE: MockQueue;
  AI: MockAI;
  [key: string]: any;
}

/**
 * Analytics-specific test utilities
 */
export class AnalyticsTestUtils {
  /**
   * Create a mock analytics environment with pre-configured data
   */
  static createMockAnalyticsEnv(config: {
    withData?: boolean;
    withErrors?: boolean;
    withLatency?: number;
  } = {}): AnalyticsEnv {
    const mockData = new Map<string, any>();

    if (config.withData) {
      // Add common analytics test data
      mockData.set('student_performance', TestDataFactory.analytics().build());
      mockData.set('learning_sessions', TestDataFactory.session().buildMany(10));
    }

    const db = MockFactory.createD1Database({
      data: mockData,
      latency: config.withLatency,
      failOnQuery: config.withErrors ? (query) => query.includes('ERROR') : undefined
    }) as MockD1Database;

    // Configure specific query responses
    const originalPrepare = db.prepare;
    db.prepare = vi.fn((query: string) => {
      const stmt = originalPrepare.call(db, query);
      
      // Mock specific analytics queries
      if (query.includes('SELECT * FROM student_performance')) {
        stmt.first = vi.fn().mockResolvedValue(
          AnalyticsTestUtils.getMockStudentPerformance()
        );
      }
      
      if (query.includes('SELECT * FROM learning_recommendations')) {
        stmt.all = vi.fn().mockResolvedValue({
          results: AnalyticsTestUtils.getMockRecommendations(),
          success: true,
          meta: {}
        });
      }

      return stmt;
    }) as any;

    return {
      DB: db,
      ANALYTICS_QUEUE: MockFactory.createQueue() as MockQueue,
      AI: MockFactory.createAI(
        new Map([
          ['recommendation_ai', { recommendations: ['Review arrays', 'Practice loops'] }]
        ])
      ) as MockAI
    };
  }

  /**
   * Get mock student performance data
   */
  static getMockStudentPerformance() {
    return {
      student_id: 'student-1',
      overall_mastery: 0.75,
      learning_velocity: 2.0,
      performance_data: JSON.stringify({
        conceptMasteries: { arrays: 0.8, loops: 0.7 },
        assessmentScores: [0.7, 0.75, 0.8, 0.85]
      })
    };
  }

  /**
   * Get mock recommendations
   */
  static getMockRecommendations() {
    return [
      {
        id: 'rec-1',
        type: 'review',
        priority: 'high',
        concepts_involved: JSON.stringify(['arrays']),
        suggested_actions: JSON.stringify(['Review array methods'])
      },
      {
        id: 'rec-2',
        type: 'practice',
        priority: 'medium',
        concepts_involved: JSON.stringify(['loops']),
        suggested_actions: JSON.stringify(['Complete loop exercises'])
      }
    ];
  }

  /**
   * Assert analytics event was tracked
   */
  static assertAnalyticsEvent(
    mockQueue: MockQueue,
    eventType: string,
    data?: Partial<any>
  ): void {
    expect(mockQueue.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: eventType,
        ...data
      })
    );
  }

  /**
   * Assert performance calculation
   */
  static assertPerformanceCalculated(
    mockDb: MockD1Database,
    studentId: string,
    expectedMastery?: number
  ): void {
    const stmt = mockDb.prepare('');
    expect(stmt.bind).toHaveBeenCalledWith(
      expect.stringContaining(studentId)
    );
    
    if (expectedMastery !== undefined) {
      expect(stmt.first).toHaveBeenCalledWith();
    }
  }

  /**
   * Create mock analytics batch
   */
  static createMockBatch(size: number = 5) {
    return {
      messages: Array.from({ length: size }, (_, i) => ({
        id: `msg-${i}`,
        body: {
          taskId: `task-${i}`,
          taskType: i % 2 === 0 ? 'calculate_performance' : 'generate_recommendations',
          tenantId: 'tenant-1',
          priority: 5,
          taskData: { studentId: `student-${i}` },
          timestamp: new Date().toISOString(),
          retryCount: 0
        },
        timestamp: new Date(),
        attempts: 0,
        ack: vi.fn(),
        retry: vi.fn()
      })),
      ackAll: vi.fn(),
      retryAll: vi.fn()
    };
  }

  /**
   * Generate mock performance trend data
   */
  static generatePerformanceTrend(days: number = 30) {
    const trend = [];
    let mastery = 0.5;
    
    for (let i = 0; i < days; i++) {
      mastery = Math.min(1.0, mastery + (Math.random() * 0.05));
      trend.push({
        date: new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000).toISOString(),
        mastery,
        sessionsCompleted: Math.floor(Math.random() * 5) + 1,
        conceptsLearned: Math.floor(Math.random() * 3)
      });
    }
    
    return trend;
  }
}