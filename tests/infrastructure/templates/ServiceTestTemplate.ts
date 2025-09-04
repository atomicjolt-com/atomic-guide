/**
 * @fileoverview Base template for service testing
 * @module tests/infrastructure/templates/ServiceTestTemplate
 */

import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { ServiceTestHarness } from '../harness/ServiceTestHarness';
import { TestDataFactory } from '../builders/TestDataFactory';
import type { TestHarnessResult } from '../types/mocks';

/**
 * Abstract base class for service testing
 * Provides consistent setup, teardown, and helper methods
 */
export abstract class ServiceTestTemplate<T> {
  protected harness!: TestHarnessResult<T>;
  protected testData!: TestDataStore;
  protected serviceClass!: new (...args: any[]) => T;

  /**
   * Get the service class to test
   */
  protected abstract getServiceClass(): new (...args: any[]) => T;

  /**
   * Configure the test harness with dependencies
   */
  protected abstract configureHarness(harness: ServiceTestHarness<T>): ServiceTestHarness<T>;

  /**
   * Optional: Set up test data before each test
   */
  protected setupTestData(): void {
    // Override in subclasses if needed
  }

  /**
   * Optional: Additional setup logic
   */
  protected async additionalSetup(): Promise<void> {
    // Override in subclasses if needed
  }

  /**
   * Optional: Additional cleanup logic
   */
  protected async additionalCleanup(): Promise<void> {
    // Override in subclasses if needed
  }

  /**
   * Create the test suite
   */
  createTestSuite(suiteName: string, testFn: () => void): void {
    describe(suiteName, () => {
      beforeEach(async () => {
        await this.setup();
      });

      afterEach(async () => {
        await this.teardown();
      });

      testFn();
    });
  }

  /**
   * Standard setup
   */
  private async setup(): Promise<void> {
    // Initialize test data store
    this.testData = new TestDataStore();
    
    // Get service class
    this.serviceClass = this.getServiceClass();
    
    // Create and configure harness
    const baseHarness = new ServiceTestHarness(this.serviceClass);
    const configuredHarness = this.configureHarness(baseHarness);
    
    // Build the harness
    this.harness = configuredHarness.build();
    
    // Set up test data
    this.setupTestData();
    
    // Additional setup
    await this.additionalSetup();
  }

  /**
   * Standard teardown
   */
  private async teardown(): Promise<void> {
    // Additional cleanup first
    await this.additionalCleanup();
    
    // Reset mocks
    this.harness.reset();
    
    // Clean up harness
    await this.harness.cleanup();
    
    // Clear test data
    this.testData.clear();
    
    // Clear all vitest mocks
    vi.clearAllMocks();
  }

  /**
   * Helper: Get the service instance
   */
  protected get service(): T {
    return this.harness.service;
  }

  /**
   * Helper: Get a specific mock
   */
  protected getMock(name: string): any {
    return this.harness.mocks.get(name);
  }

  /**
   * Helper: Get the database mock
   */
  protected get dbMock() {
    return this.harness.mocks.get('database');
  }

  /**
   * Helper: Get the KV mock
   */
  protected get kvMock() {
    return this.harness.mocks.get('kvstore');
  }

  /**
   * Helper: Get the queue mock
   */
  protected get queueMock() {
    return this.harness.mocks.get('queue');
  }

  /**
   * Helper: Get the AI mock
   */
  protected get aiMock() {
    return this.harness.mocks.get('ai');
  }

  /**
   * Helper: Create a test user
   */
  protected createTestUser(overrides?: any) {
    return TestDataFactory.user().with(overrides).build();
  }

  /**
   * Helper: Create a test tenant
   */
  protected createTestTenant(overrides?: any) {
    return TestDataFactory.tenant().with(overrides).build();
  }

  /**
   * Helper: Assert no errors
   */
  protected assertNoErrors(): void {
    // Check that no error methods were called
    const db = this.dbMock;
    if (db) {
      expect(db.exec).not.toHaveBeenCalledWith(
        expect.stringMatching(/ERROR/)
      );
    }
  }

  /**
   * Helper: Assert method called with partial match
   */
  protected assertCalledWithPartial(mock: any, partial: any): void {
    expect(mock).toHaveBeenCalledWith(
      expect.objectContaining(partial)
    );
  }
}

/**
 * Test data store for managing test entities
 */
export class TestDataStore {
  private stores = new Map<string, Map<string, any>>();

  constructor() {
    // Initialize common stores
    this.stores.set('users', new Map());
    this.stores.set('tenants', new Map());
    this.stores.set('sessions', new Map());
    this.stores.set('analytics', new Map());
  }

  add<T>(type: string, id: string, data: T): void {
    if (!this.stores.has(type)) {
      this.stores.set(type, new Map());
    }
    this.stores.get(type)!.set(id, data);
  }

  get<T>(type: string, id: string): T | undefined {
    return this.stores.get(type)?.get(id);
  }

  getAll<T>(type: string): T[] {
    const store = this.stores.get(type);
    return store ? Array.from(store.values()) : [];
  }

  delete(type: string, id: string): boolean {
    return this.stores.get(type)?.delete(id) || false;
  }

  clear(type?: string): void {
    if (type) {
      this.stores.get(type)?.clear();
    } else {
      this.stores.forEach(store => store.clear());
    }
  }

  size(type?: string): number {
    if (type) {
      return this.stores.get(type)?.size || 0;
    }
    return Array.from(this.stores.values()).reduce((sum, store) => sum + store.size, 0);
  }
}

/**
 * Quick template for API handler tests
 */
export abstract class ApiHandlerTestTemplate {
  protected mockContext: any;
  protected mockEnv: any;

  beforeEach(): void {
    this.setupMocks();
  }

  afterEach(): void {
    vi.clearAllMocks();
  }

  protected abstract setupMocks(): void;

  protected createMockContext(overrides?: any) {
    return {
      req: {
        param: vi.fn(),
        query: vi.fn(),
        header: vi.fn(),
        json: vi.fn(),
        valid: vi.fn()
      },
      env: this.mockEnv,
      json: vi.fn(),
      text: vi.fn(),
      status: vi.fn().mockReturnThis(),
      get: vi.fn(),
      set: vi.fn(),
      ...overrides
    };
  }

  protected assertJsonResponse(expectedData: any, expectedStatus?: number) {
    if (expectedStatus) {
      expect(this.mockContext.status).toHaveBeenCalledWith(expectedStatus);
    }
    expect(this.mockContext.json).toHaveBeenCalledWith(
      expect.objectContaining(expectedData)
    );
  }

  protected assertErrorResponse(expectedError: string, expectedStatus: number) {
    expect(this.mockContext.status).toHaveBeenCalledWith(expectedStatus);
    expect(this.mockContext.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining(expectedError)
      })
    );
  }
}