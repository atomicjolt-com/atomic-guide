/**
 * @fileoverview TypeScript type definitions for test mocks
 * @module tests/infrastructure/types/mocks
 */

import type { D1Database, D1PreparedStatement, KVNamespace, Queue, Ai } from '@cloudflare/workers-types';
import type { Context } from 'hono';
import type { Mock } from 'vitest';

/**
 * Enhanced D1 database mock with test utilities
 */
export interface MockD1Database extends D1Database {
  __mockData: Map<string, any>;
  __failOnQuery?: (query: string) => boolean;
  __latency?: number;
  __reset: () => void;
  __setData: (key: string, value: any) => void;
  __getData: (key: string) => any;
  __getAllData: () => Map<string, any>;
  
  // Compatibility methods
  run: (query: string, ...params: any[]) => Promise<any>;
  all: (query: string, ...params: any[]) => Promise<any[]>;
  get: (query: string, ...params: any[]) => Promise<any>;
}

/**
 * Enhanced KV namespace mock with test utilities
 */
export interface MockKVNamespace extends KVNamespace {
  __store: Map<string, any>;
  __metadata: Map<string, any>;
  __ttl: number;
  __failOnKey?: (key: string) => boolean;
  __reset: () => void;
  __getData: (key: string) => any;
  __getAllData: () => Map<string, any>;
  __setFailure: (key: string, shouldFail: boolean) => void;
}

/**
 * Enhanced queue mock with message tracking
 */
export interface MockQueue extends Queue {
  __messages: Array<{
    id: string;
    body: any;
    timestamp: Date;
    options?: any;
  }>;
  __failOnSend: boolean;
  __processDelay: number;
  __reset: () => void;
  __getMessages: () => Array<any>;
  __simulateProcess: (processor: (message: any) => Promise<void>) => Promise<void>;
}

/**
 * Enhanced AI mock with response configuration
 */
export interface MockAI extends Ai {
  __responses: Map<string, any>;
  __callHistory: Array<{ model: string; input: any; timestamp: Date }>;
  __reset: () => void;
  __setResponse: (model: string, response: any) => void;
  __getCallHistory: () => Array<any>;
}

/**
 * Enhanced Hono context mock
 */
export interface MockContext extends Context {
  __mocks: {
    req: MockRequest;
    env: MockEnvironment;
    res: MockResponse;
  };
  __reset: () => void;
  __setParam: (key: string, value: string) => void;
  __setQuery: (key: string, value: string) => void;
  __setHeader: (key: string, value: string) => void;
  __setBody: (body: any) => void;
  __getJsonCalls: () => Array<any>;
  __getStatusCalls: () => Array<number>;
}

/**
 * Mock request object
 */
export interface MockRequest {
  param: Mock<[string?], any>;
  query: Mock<[string?], any>;
  header: Mock<[string?], string | undefined>;
  json: Mock<[], Promise<any>>;
  text: Mock<[], Promise<string>>;
  valid: Mock<[string], any>;
  raw: Request;
  url: string;
  method: string;
  __setters: {
    setParam: (key: string, value: string) => void;
    setQuery: (key: string, value: string) => void;
    setHeader: (key: string, value: string) => void;
    setBody: (body: any) => void;
  };
}

/**
 * Mock response object
 */
export interface MockResponse {
  status: Mock<[number], MockResponse>;
  header: Mock<[string, string], MockResponse>;
  __statusHistory: number[];
  __headerHistory: Array<{ key: string; value: string }>;
}

/**
 * Mock environment with all services
 */
export interface MockEnvironment {
  DB: MockD1Database;
  KV: MockKVNamespace;
  QUEUE: MockQueue;
  AI: MockAI;
  [key: string]: any;
}

/**
 * Test harness result with enhanced typing
 */
export interface TestHarnessResult<T> {
  service: T;
  mocks: {
    database?: MockD1Database;
    kvStore?: MockKVNamespace;
    queue?: MockQueue;
    ai?: MockAI;
    [key: string]: any;
  };
  dependencies: {
    database?: MockD1Database;
    kvStore?: MockKVNamespace;
    queue?: MockQueue;
    ai?: MockAI;
    [key: string]: any;
  };
  reset: () => void;
  cleanup: () => Promise<void>;
  verify: () => void;
  
  // Helper assertions
  assertDatabaseCalled: (times?: number) => void;
  assertKVCalled: (times?: number) => void;
  assertQueueCalled: (times?: number) => void;
  assertAICalled: (times?: number) => void;
}

/**
 * Test data builder result
 */
export interface BuilderResult<T> {
  data: T;
  persist: () => Promise<T>;
  clone: () => BuilderResult<T>;
  toJSON: () => string;
}

/**
 * Mock factory configuration
 */
export interface MockFactoryConfig {
  database?: {
    data?: Map<string, any>;
    failOnQuery?: (query: string) => boolean;
    latency?: number;
  };
  kvStore?: {
    data?: Map<string, any>;
    ttl?: number;
    failOnKey?: (key: string) => boolean;
  };
  queue?: {
    messages?: any[];
    failOnSend?: boolean;
    processDelay?: number;
  };
  ai?: {
    responses?: Map<string, any>;
    defaultResponse?: any;
  };
}

/**
 * Test assertion helpers
 */
export interface TestAssertions {
  assertCalledWith<T extends Mock>(mock: T, ...args: Parameters<T>): void;
  assertCalledTimes<T extends Mock>(mock: T, times: number): void;
  assertNotCalled<T extends Mock>(mock: T): void;
  assertLastCall<T extends Mock>(mock: T, ...args: Parameters<T>): void;
  assertReturned<T extends Mock>(mock: T, value: ReturnType<T>): void;
  assertThrew<T extends Mock>(mock: T, error: Error | string): void;
}

/**
 * Test data store for managing test entities
 */
export interface TestDataStore {
  users: Map<string, any>;
  tenants: Map<string, any>;
  sessions: Map<string, any>;
  analytics: Map<string, any>;
  
  add<T>(type: string, id: string, data: T): void;
  get<T>(type: string, id: string): T | undefined;
  getAll<T>(type: string): T[];
  delete(type: string, id: string): boolean;
  clear(type?: string): void;
  size(type?: string): number;
}

/**
 * Performance test metrics
 */
export interface PerformanceMetrics {
  name: string;
  iterations: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
  p95: number;
  p99: number;
  throughput: number;
}

/**
 * Test coverage metrics
 */
export interface CoverageMetrics {
  lines: number;
  functions: number;
  branches: number;
  statements: number;
  uncoveredLines: string[];
}