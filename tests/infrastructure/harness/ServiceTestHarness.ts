/**
 * @fileoverview Service test harness for standardized service testing
 * @module tests/infrastructure/harness/ServiceTestHarness
 */

import { vi, Mock } from 'vitest';
import { MockFactory } from '../mocks/MockFactory';
import type { D1Database, KVNamespace, Queue, Ai } from '@cloudflare/workers-types';

export interface ServiceDependencies {
  database?: D1Database;
  kvStore?: KVNamespace;
  queue?: Queue;
  ai?: Ai;
  [key: string]: any;
}

export interface TestHarnessResult<T> {
  service: T;
  mocks: Map<string, any>;
  dependencies: ServiceDependencies;
  reset: () => void;
  cleanup: () => Promise<void>;
  verify: () => void;
}

/**
 * Service test harness for consistent service testing setup
 */
export class ServiceTestHarness<T> {
  private mocks = new Map<string, any>();
  private dependencies: ServiceDependencies = {};
  private serviceClass: new (...args: any[]) => T;
  private constructorArgs: any[] = [];
  private cleanupFns: Array<() => Promise<void>> = [];
  private service?: T;

  constructor(serviceClass: new (...args: any[]) => T) {
    this.serviceClass = serviceClass;
  }

  /**
   * Add a D1 database mock with optional configuration
   */
  withDatabase(config?: Parameters<typeof MockFactory.createD1Database>[0]): this {
    const db = MockFactory.createD1Database(config);
    this.mocks.set('database', db);
    this.dependencies.database = db;
    this.constructorArgs.push(db);
    return this;
  }

  /**
   * Add a KV store mock with optional initial data
   */
  withKVStore(config?: Parameters<typeof MockFactory.createKVNamespace>[0]): this {
    const kv = MockFactory.createKVNamespace(config);
    this.mocks.set('kvstore', kv);
    this.dependencies.kvStore = kv;
    this.constructorArgs.push(kv);
    return this;
  }

  /**
   * Add a queue mock with optional configuration
   */
  withQueue(config?: Parameters<typeof MockFactory.createQueue>[0]): this {
    const queue = MockFactory.createQueue(config);
    this.mocks.set('queue', queue);
    this.dependencies.queue = queue;
    this.constructorArgs.push(queue);
    return this;
  }

  /**
   * Add an AI service mock with optional responses
   */
  withAI(responses?: Map<string, any>): this {
    const ai = MockFactory.createAI(responses);
    this.mocks.set('ai', ai);
    this.dependencies.ai = ai;
    this.constructorArgs.push(ai);
    return this;
  }

  /**
   * Add a custom mock dependency
   */
  withMock(name: string, mock: any, addToConstructor: boolean = true): this {
    this.mocks.set(name, mock);
    this.dependencies[name] = mock;
    if (addToConstructor) {
      this.constructorArgs.push(mock);
    }
    return this;
  }

  /**
   * Set custom constructor arguments (overrides auto-detection)
   */
  withConstructorArgs(...args: any[]): this {
    this.constructorArgs = args;
    return this;
  }

  /**
   * Add a cleanup function to be called on teardown
   */
  withCleanup(fn: () => Promise<void>): this {
    this.cleanupFns.push(fn);
    return this;
  }

  /**
   * Build the service with all configured dependencies
   */
  build(): TestHarnessResult<T> {
    // Create service instance
    this.service = new this.serviceClass(...this.constructorArgs);

    // Create reset function
    const reset = () => {
      // Reset all mocks
      this.mocks.forEach(mock => {
        if (vi.isMockFunction(mock)) {
          mock.mockClear();
        } else if (typeof mock === 'object' && mock !== null) {
          // Reset object mocks
          Object.keys(mock).forEach(key => {
            if (vi.isMockFunction(mock[key])) {
              mock[key].mockClear();
            }
          });
        }
      });

      // Reset any stateful mocks
      const db = this.mocks.get('database');
      if (db && typeof db.__reset === 'function') {
        db.__reset();
      }

      const kv = this.mocks.get('kvstore');
      if (kv && typeof kv.__reset === 'function') {
        kv.__reset();
      }
    };

    // Create cleanup function
    const cleanup = async () => {
      // Run custom cleanup functions
      await Promise.all(this.cleanupFns.map(fn => fn()));
      
      // Clear all mocks
      reset();
      
      // Clear mock registry
      this.mocks.clear();
      this.dependencies = {};
      this.constructorArgs = [];
    };

    // Create verify function for assertions
    const verify = () => {
      // Verify no unexpected calls
      this.mocks.forEach((mock, name) => {
        if (vi.isMockFunction(mock)) {
          // Can add specific verifications here
        }
      });
    };

    return {
      service: this.service,
      mocks: this.mocks,
      dependencies: this.dependencies,
      reset,
      cleanup,
      verify
    };
  }

  /**
   * Build and setup for immediate use in beforeEach
   */
  setup(): TestHarnessResult<T> {
    return this.build();
  }

  /**
   * Create a harness with common dependencies pre-configured
   */
  static withDefaults<T>(
    serviceClass: new (...args: any[]) => T,
    options: {
      database?: boolean;
      kvStore?: boolean;
      queue?: boolean;
      ai?: boolean;
    } = {}
  ): ServiceTestHarness<T> {
    const harness = new ServiceTestHarness(serviceClass);

    if (options.database !== false) {
      harness.withDatabase();
    }
    if (options.kvStore) {
      harness.withKVStore();
    }
    if (options.queue) {
      harness.withQueue();
    }
    if (options.ai) {
      harness.withAI();
    }

    return harness;
  }
}

/**
 * Quick helper for setting up a service with database
 */
export function setupServiceWithDb<T>(
  serviceClass: new (...args: any[]) => T,
  dbConfig?: Parameters<typeof MockFactory.createD1Database>[0]
): TestHarnessResult<T> {
  return new ServiceTestHarness(serviceClass)
    .withDatabase(dbConfig)
    .build();
}

/**
 * Quick helper for setting up a service with all common dependencies
 */
export function setupFullService<T>(
  serviceClass: new (...args: any[]) => T
): TestHarnessResult<T> {
  return new ServiceTestHarness(serviceClass)
    .withDatabase()
    .withKVStore()
    .withQueue()
    .withAI()
    .build();
}