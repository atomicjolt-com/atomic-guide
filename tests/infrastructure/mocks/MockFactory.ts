/**
 * @fileoverview Centralized mock factory for consistent test mocking
 * @module tests/infrastructure/mocks/MockFactory
 */

import { vi, Mock } from 'vitest';
import type { D1Database, D1PreparedStatement, KVNamespace, Queue, Ai } from '@cloudflare/workers-types';
import type { Context } from 'hono';
import { v4 as uuidv4 } from 'uuid';

export interface MockD1Config {
  data?: Map<string, any>;
  failOnQuery?: (query: string) => boolean;
  latency?: number;
}

export interface MockKVConfig {
  data?: Map<string, any>;
  ttl?: number;
  failOnKey?: (key: string) => boolean;
}

export interface MockQueueConfig {
  messages?: any[];
  failOnSend?: boolean;
  processDelay?: number;
}

export interface MockContextConfig {
  jwt?: string;
  tenantId?: string;
  userId?: string;
  body?: any;
  query?: Record<string, string>;
  params?: Record<string, string>;
  headers?: Record<string, string>;
}

/**
 * Centralized factory for creating consistent mock objects across all tests
 */
export class MockFactory {
  private static registry = new Map<string, () => any>();

  /**
   * Create a fully-typed mock D1 database with configurable behavior
   */
  static createD1Database(config: MockD1Config = {}): D1Database {
    const { data = new Map(), failOnQuery, latency = 0 } = config;
    
    const mockStatement: D1PreparedStatement = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(async () => {
        if (latency) await new Promise(r => setTimeout(r, latency));
        return data.values().next().value || null;
      }),
      all: vi.fn(async () => {
        if (latency) await new Promise(r => setTimeout(r, latency));
        return { results: Array.from(data.values()), success: true, meta: {} };
      }),
      run: vi.fn(async () => {
        if (latency) await new Promise(r => setTimeout(r, latency));
        return { success: true, meta: { last_row_id: 1, changes: 1 } };
      }),
      raw: vi.fn(async () => {
        if (latency) await new Promise(r => setTimeout(r, latency));
        return [];
      }),
    } as unknown as D1PreparedStatement;

    const prepare = vi.fn((query: string) => {
      if (failOnQuery?.(query)) {
        throw new Error(`Database query failed: ${query}`);
      }
      return mockStatement;
    });

    return {
      prepare,
      exec: vi.fn(async (query: string) => {
        if (failOnQuery?.(query)) {
          throw new Error(`Database execution failed: ${query}`);
        }
        if (latency) await new Promise(r => setTimeout(r, latency));
        return { count: 0, duration: 1 };
      }),
      batch: vi.fn(async (statements: D1PreparedStatement[]) => {
        if (latency) await new Promise(r => setTimeout(r, latency));
        return statements.map(() => ({ success: true, meta: {} }));
      }),
      dump: vi.fn(async () => new ArrayBuffer(0)),
      // Add compatibility methods for direct access
      run: async (query: string, ...params: any[]) => {
        const stmt = prepare(query);
        if (params.length > 0) stmt.bind(...params);
        return stmt.run();
      },
      all: async (query: string, ...params: any[]) => {
        const stmt = prepare(query);
        if (params.length > 0) stmt.bind(...params);
        const result = await stmt.all();
        return result.results;
      },
      get: async (query: string, ...params: any[]) => {
        const stmt = prepare(query);
        if (params.length > 0) stmt.bind(...params);
        return stmt.first();
      }
    } as D1Database & { run: any; all: any; get: any };
  }

  /**
   * Create a mock KV namespace with configurable storage
   */
  static createKVNamespace(config: MockKVConfig = {}): KVNamespace {
    const { data = new Map(), ttl = 60000, failOnKey } = config;
    const metadata = new Map<string, any>();
    
    return {
      get: vi.fn(async (key: string, options?: any) => {
        if (failOnKey?.(key)) {
          throw new Error(`KV get failed for key: ${key}`);
        }
        const value = data.get(key);
        if (options?.type === 'json' && value) {
          return JSON.parse(value);
        }
        return value || null;
      }),
      
      getWithMetadata: vi.fn(async (key: string, options?: any) => {
        const value = data.get(key);
        const meta = metadata.get(key);
        return { value, metadata: meta };
      }),
      
      put: vi.fn(async (key: string, value: any, options?: any) => {
        if (failOnKey?.(key)) {
          throw new Error(`KV put failed for key: ${key}`);
        }
        const storedValue = typeof value === 'object' ? JSON.stringify(value) : value;
        data.set(key, storedValue);
        if (options?.metadata) {
          metadata.set(key, options.metadata);
        }
        if (options?.expirationTtl || ttl) {
          setTimeout(() => data.delete(key), options?.expirationTtl || ttl);
        }
      }),
      
      delete: vi.fn(async (key: string) => {
        data.delete(key);
        metadata.delete(key);
      }),
      
      list: vi.fn(async (options?: any) => {
        const keys = Array.from(data.keys())
          .filter(k => !options?.prefix || k.startsWith(options.prefix))
          .slice(0, options?.limit || 1000)
          .map(name => ({ name, metadata: metadata.get(name) }));
        
        return { 
          keys, 
          list_complete: keys.length < (options?.limit || 1000),
          cursor: undefined
        };
      })
    } as unknown as KVNamespace;
  }

  /**
   * Create a mock queue for testing async message processing
   */
  static createQueue(config: MockQueueConfig = {}): Queue {
    const { messages = [], failOnSend = false, processDelay = 0 } = config;
    
    return {
      send: vi.fn(async (message: any, options?: any) => {
        if (failOnSend) {
          throw new Error('Queue send failed');
        }
        if (processDelay) {
          await new Promise(r => setTimeout(r, processDelay));
        }
        messages.push({ 
          body: message, 
          timestamp: new Date(), 
          id: uuidv4(),
          ...options 
        });
      }),
      
      sendBatch: vi.fn(async (batch: any[]) => {
        if (failOnSend) {
          throw new Error('Queue batch send failed');
        }
        for (const item of batch) {
          messages.push({ 
            body: item.body, 
            timestamp: new Date(), 
            id: uuidv4() 
          });
        }
      })
    } as unknown as Queue;
  }

  /**
   * Create a mock AI service for testing AI interactions
   */
  static createAI(responses: Map<string, any> = new Map()): Ai {
    return {
      run: vi.fn(async (model: string, input: any) => {
        const response = responses.get(model) || {
          response: 'Mock AI response',
          embeddings: [[0.1, 0.2, 0.3]]
        };
        return response;
      })
    } as unknown as Ai;
  }

  /**
   * Create a mock Hono context with configurable request/response
   */
  static createHonoContext(config: MockContextConfig = {}): Context {
    const {
      jwt = 'Bearer test-jwt-token',
      tenantId = 'test-tenant',
      userId = 'test-user',
      body = {},
      query = {},
      params = {},
      headers = {}
    } = config;

    const mockReq = {
      param: vi.fn((key?: string) => key ? params[key] : params),
      query: vi.fn((key?: string) => key ? query[key] : query),
      header: vi.fn((key?: string) => {
        if (key === 'Authorization') return jwt;
        return key ? headers[key] : headers;
      }),
      json: vi.fn(async () => body),
      text: vi.fn(async () => JSON.stringify(body)),
      valid: vi.fn((target: string) => {
        switch(target) {
          case 'param': return params;
          case 'query': return query;
          case 'json': return body;
          default: return {};
        }
      }),
      raw: {} as Request,
      url: 'http://test.local/api/test',
      method: 'GET'
    };

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis()
    };

    const context: any = {
      req: mockReq,
      res: mockRes,
      env: {
        DB: MockFactory.createD1Database(),
        KV: MockFactory.createKVNamespace(),
        QUEUE: MockFactory.createQueue(),
        AI: MockFactory.createAI()
      },
      json: vi.fn((object: any, status?: number) => {
        if (status) mockRes.status(status);
        return new Response(JSON.stringify(object), {
          headers: { 'Content-Type': 'application/json' }
        });
      }),
      text: vi.fn((text: string, status?: number) => {
        if (status) mockRes.status(status);
        return new Response(text, {
          headers: { 'Content-Type': 'text/plain' }
        });
      }),
      status: vi.fn((code: number) => {
        mockRes.status(code);
        return context;
      }),
      get: vi.fn((key: string) => {
        const store: Record<string, any> = {
          tenantId,
          userId,
          jwt: jwt.replace('Bearer ', '')
        };
        return store[key];
      }),
      set: vi.fn(),
      var: {},
      header: vi.fn()
    };

    return context as Context;
  }

  /**
   * Create a mock for Durable Objects
   */
  static createDurableObject(name: string, state: Map<string, any> = new Map()) {
    return {
      state: {
        storage: {
          get: vi.fn(async (key: string) => state.get(key)),
          put: vi.fn(async (key: string, value: any) => state.set(key, value)),
          delete: vi.fn(async (key: string) => state.delete(key)),
          list: vi.fn(async () => state),
          transaction: vi.fn(async (fn: Function) => fn({
            get: (key: string) => state.get(key),
            put: (key: string, value: any) => state.set(key, value),
            delete: (key: string) => state.delete(key)
          }))
        },
        waitUntil: vi.fn(),
        id: { toString: () => `${name}-${uuidv4()}` }
      },
      fetch: vi.fn(async () => new Response('OK'))
    };
  }

  /**
   * Register a custom mock factory
   */
  static register<T>(name: string, factory: () => T): void {
    MockFactory.registry.set(name, factory);
  }

  /**
   * Get a registered mock factory
   */
  static get<T>(name: string): T {
    const factory = MockFactory.registry.get(name);
    if (!factory) {
      throw new Error(`No mock factory registered for: ${name}`);
    }
    return factory();
  }

  /**
   * Reset all registered mocks
   */
  static resetAll(): void {
    vi.clearAllMocks();
    MockFactory.registry.clear();
  }
}