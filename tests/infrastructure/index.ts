/**
 * @fileoverview Central export for test infrastructure
 * @module tests/infrastructure
 */

// Mock factory and types
import { MockFactory } from './mocks/MockFactory';
export { MockFactory };
export type * from './types/mocks';

// Test data builders
import {
  TestDataFactory,
  UserBuilder,
  TenantBuilder,
  CognitiveProfileBuilder,
  SessionBuilder,
  AnalyticsBuilder,
  AssessmentBuilder,
} from './builders/TestDataFactory';
export { TestDataFactory, UserBuilder, TenantBuilder, CognitiveProfileBuilder, SessionBuilder, AnalyticsBuilder, AssessmentBuilder };

// Service test harness
import { ServiceTestHarness, setupServiceWithDb, setupFullService } from './harness/ServiceTestHarness';
export { ServiceTestHarness, setupServiceWithDb, setupFullService };

// Test templates
import { ServiceTestTemplate, TestDataStore, ApiHandlerTestTemplate } from './templates/ServiceTestTemplate';
export { ServiceTestTemplate, TestDataStore, ApiHandlerTestTemplate };

// Domain-specific utilities
import { AnalyticsTestUtils } from './utilities/AnalyticsTestUtils';
export { AnalyticsTestUtils };

// Re-export common testing utilities from vitest
export { describe, it, test, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';

/**
 * Quick setup helpers for common test scenarios
 */
export const TestSetup = {
  /**
   * Create a complete test environment with all services
   */
  createFullEnvironment() {
    return {
      db: MockFactory.createD1Database(),
      kv: MockFactory.createKVNamespace(),
      queue: MockFactory.createQueue(),
      ai: MockFactory.createAI(),
      context: MockFactory.createHonoContext(),
    };
  },

  /**
   * Create a minimal test environment
   */
  createMinimalEnvironment() {
    return {
      db: MockFactory.createD1Database(),
      context: MockFactory.createHonoContext(),
    };
  },

  /**
   * Create test data for a complete classroom
   */
  createClassroom() {
    return TestDataFactory.presets.classroomSetup();
  },

  /**
   * Create test data for a single student
   */
  createStudent(withConsent: boolean = true) {
    return withConsent ? TestDataFactory.presets.studentWithFullConsent().build() : TestDataFactory.presets.studentWithNoConsent().build();
  },

  /**
   * Create test data for analytics testing
   */
  createAnalyticsData() {
    return {
      student: TestDataFactory.presets.studentWithFullConsent().build(),
      sessions: TestDataFactory.session().buildMany(10),
      analytics: TestDataFactory.analytics().build(),
    };
  },
};

/**
 * Common test assertions
 */
export const TestAssertions = {
  /**
   * Assert a mock was called with partial object match
   */
  assertCalledWithPartial(mock: any, partial: any) {
    expect(mock).toHaveBeenCalledWith(expect.objectContaining(partial));
  },

  /**
   * Assert a mock was not called
   */
  assertNotCalled(mock: any) {
    expect(mock).not.toHaveBeenCalled();
  },

  /**
   * Assert a promise resolves successfully
   */
  async assertResolves(promise: Promise<any>) {
    await expect(promise).resolves.toBeDefined();
  },

  /**
   * Assert a promise rejects with error
   */
  async assertRejects(promise: Promise<any>, errorMessage?: string) {
    if (errorMessage) {
      await expect(promise).rejects.toThrow(errorMessage);
    } else {
      await expect(promise).rejects.toThrow();
    }
  },

  /**
   * Assert an array contains an item matching partial
   */
  assertArrayContainsPartial(array: any[], partial: any) {
    expect(array).toContainEqual(expect.objectContaining(partial));
  },

  /**
   * Assert database query was called
   */
  assertDatabaseQueried(dbMock: any, queryPattern: string | RegExp) {
    expect(dbMock.prepare).toHaveBeenCalledWith(expect.stringMatching(queryPattern));
  },

  /**
   * Assert KV was accessed
   */
  assertKVAccessed(kvMock: any, key: string, operation: 'get' | 'put' | 'delete' = 'get') {
    expect(kvMock[operation]).toHaveBeenCalledWith(expect.stringContaining(key), expect.anything());
  },

  /**
   * Assert queue message was sent
   */
  assertQueueMessageSent(queueMock: any, messageType: string) {
    expect(queueMock.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: messageType,
      })
    );
  },
};

/**
 * Test cleanup utilities
 */
export const TestCleanup = {
  /**
   * Reset all mocks and clear test data
   */
  resetAll() {
    MockFactory.resetAll();
    vi.clearAllMocks();
    vi.resetAllMocks();
  },

  /**
   * Clear all timers
   */
  clearTimers() {
    vi.clearAllTimers();
    vi.useRealTimers();
  },

  /**
   * Restore all stubs
   */
  restoreAll() {
    vi.restoreAllMocks();
  },
};

// Export a default test kit with everything
export default {
  MockFactory,
  TestDataFactory,
  ServiceTestHarness,
  TestSetup,
  TestAssertions,
  TestCleanup,
  AnalyticsTestUtils,
};
