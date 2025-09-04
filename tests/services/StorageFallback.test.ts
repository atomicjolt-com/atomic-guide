// TODO: Consider using ServiceTestHarness for StorageFallbackService
/**
 * Unit tests for StorageFallback service
 * Story 1.1 Requirement: Test fallback activates on D1 timeout
 */

import {  describe, it, expect, beforeEach, vi, afterEach , MockFactory, TestDataFactory, ServiceTestHarness } from '@/tests/infrastructure';
import { StorageFallbackService } from '../../src/services/StorageFallback';
import type { KVNamespace, D1Database } from '@cloudflare/workers-types';

import type { MockD1Database, MockKVNamespace, MockQueue } from '@/tests/infrastructure/types/mocks';
// Mock KV Namespace
const createMockKV = () => {
  const store = new Map<string, any>();

  const mockKV: Partial<KVNamespace> = {
    get: vi.fn(async (key: string, type?: string) => {
      const value = store.get(key);
      if (type === 'json' && value) {
        return JSON.parse(value);
      }
      return value;
    }),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async () => ({ keys: [], list_complete: true, cursor: '' })),
  };

  return { kv: mockKV as KVNamespace, store };
};

// Mock D1 Database
const createMockD1 = (shouldFail = false, shouldTimeout = false) => {
  const mockPreparedStatement = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn(() => {
      if (shouldTimeout) {
        // Return a promise that never resolves to simulate timeout
        return new Promise(() => {});
      }
      if (shouldFail) {
        return Promise.reject(new Error('D1 database error'));
      }
      return Promise.resolve({
        id: 'profile-123',
        tenant_id: 'tenant-456',
        lti_user_id: 'user-789',
        lti_deployment_id: 'deployment-123',
        email: 'test@example.com',
        name: 'Test User',
        forgetting_curve_s: 1.0,
        learning_velocity: 1.0,
        optimal_difficulty: 0.7,
        preferred_modality: 'visual',
        data_sharing_consent: true,
        ai_interaction_consent: true,
        anonymous_analytics: true,
        created_at: '2025-01-21T00:00:00Z',
        updated_at: '2025-01-21T00:00:00Z',
      });
    }),
    run: vi.fn(async () => ({ success: true })),
  };

  const mockD1: Partial<D1Database> = {
    prepare: vi.fn(() => mockPreparedStatement),
    batch: vi.fn(async () => []),
    dump: vi.fn(async () => new ArrayBuffer(0)),
    exec: vi.fn(async () => ({ count: 0, duration: 0 })),
  };

  return { db: mockD1 as D1Database, mockPreparedStatement };
};

describe('StorageFallbackService', () => {
  let service: StorageFallbackService;
  let mockKV: ReturnType<typeof createMockKV>;
  let mockD1: ReturnType<typeof createMockD1>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockKV = createMockKV();
    mockD1 = createMockD1();
    service = new StorageFallbackService(mockKV.kv, mockD1.db);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Circuit Breaker', () => {
    it('should start with circuit closed', () => {
      const metrics = service.getMetrics();
      expect(metrics.circuitState).toBe('closed');
    });

    it('should open circuit after threshold failures', async () => {
      const failingD1 = createMockD1(true);
      service = new StorageFallbackService(mockKV.kv, failingD1.db);

      // Trigger failures
      for (let i = 0; i < 5; i++) {
        await service.getLearnerProfile('tenant-123', 'user-456');
      }

      const metrics = service.getMetrics();
      expect(metrics.circuitState).toBe('open');
      expect(metrics.d1Failures).toBe(5);
    });

    it('should move to half-open after reset timeout', async () => {
      const failingD1 = createMockD1(true);
      service = new StorageFallbackService(mockKV.kv, failingD1.db);

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        await service.getLearnerProfile('tenant-123', 'user-456');
      }

      expect(service.getMetrics().circuitState).toBe('open');

      // Advance time past reset timeout
      vi.advanceTimersByTime(61000); // 61 seconds

      // Create a new mock D1 that succeeds for half-open test
      const workingD1 = createMockD1(false);
      service = new StorageFallbackService(mockKV.kv, workingD1.db);

      // Manually set the circuit state based on previous failures
      service.setCircuitStateForTesting('open', 5, Date.now() - 61000);

      // Next request should move to half-open then succeed
      await service.getLearnerProfile('tenant-123', 'user-456');

      // Circuit should be in half-open or closed after successful request
      const finalMetrics = service.getMetrics();
      expect(['half-open', 'closed']).toContain(finalMetrics.circuitState);
    });

    it('should close circuit after successful requests in half-open', async () => {
      // Start with working D1
      service = new StorageFallbackService(mockKV.kv, mockD1.db);

      // Manually set to half-open state for testing
      service.setCircuitStateForTesting('half-open', 0);

      // Make successful requests
      for (let i = 0; i < 3; i++) {
        await service.getLearnerProfile('tenant-123', 'user-456');
      }

      // Circuit should close after enough successful requests
      const finalMetrics = service.getMetrics();
      expect(finalMetrics.circuitState).toBe('closed');
    });
  });

  describe('D1 Timeout Handling', () => {
    it('should fallback to KV on D1 timeout', async () => {
      const timeoutD1 = createMockD1(false, true);
      service = new StorageFallbackService(mockKV.kv, timeoutD1.db);

      // Store profile in KV
      const profile = {
        id: 'kv-profile',
        tenant_id: 'tenant-123',
        lti_user_id: 'user-456',
        lti_deployment_id: 'deployment-789',
        email: 'kv@example.com',
        name: 'KV User',
        cognitive_profile: {
          forgetting_curve_s: 1.2,
          learning_velocity: 0.9,
          optimal_difficulty: 0.75,
          preferred_modality: 'kinesthetic',
        },
        privacy_settings: {
          data_sharing_consent: false,
          ai_interaction_consent: true,
          anonymous_analytics: true,
        },
        created_at: '2025-01-20T00:00:00Z',
        updated_at: '2025-01-20T00:00:00Z',
      };

      await mockKV.kv.put('fallback:learner:tenant-123:user-456', JSON.stringify(profile));

      // Get profile - should timeout and fallback to KV
      const resultPromise = service.getLearnerProfile('tenant-123', 'user-456');

      // Advance timers to trigger timeout
      vi.advanceTimersByTime(150); // Advance past the 100ms timeout

      const result = await resultPromise;

      expect(result).toBeDefined();
      expect(result?.id).toBe('kv-profile');
      expect(result?.name).toBe('KV User');

      const metrics = service.getMetrics();
      expect(metrics.fallbackActivations).toBeGreaterThan(0);
      expect(metrics.kvHits).toBeGreaterThan(0);
    }, 10000);

    it('should enforce reasonable timeout for D1 operations', async () => {
      const slowD1 = createMockD1(false, true);
      service = new StorageFallbackService(mockKV.kv, slowD1.db);

      const resultPromise = service.getLearnerProfile('tenant-123', 'user-456');

      // Advance timers to trigger timeout
      vi.advanceTimersByTime(150); // Advance past the 100ms timeout

      const result = await resultPromise;

      // The operation should complete without waiting for the slow D1 operation
      // We should get null since there's no KV fallback data
      expect(result).toBeNull();

      // Verify that the fallback was triggered (D1 timeout)
      const metrics = service.getMetrics();
      expect(metrics.d1Failures).toBe(1);
    }, 10000);
  });

  describe('Read-Through Cache Pattern', () => {
    it('should update KV cache when D1 succeeds', async () => {
      await service.getLearnerProfile('tenant-123', 'user-789');

      // Check that KV was updated
      const kvData = await mockKV.kv.get('fallback:learner:tenant-123:user-789', 'json');
      expect(kvData).toBeDefined();
      expect(kvData.lti_user_id).toBe('user-789');
    });

    it('should use KV cache when D1 fails', async () => {
      // First, populate KV with a successful request
      await service.getLearnerProfile('tenant-123', 'user-789');

      // Now switch to failing D1
      const failingD1 = createMockD1(true);
      service = new StorageFallbackService(mockKV.kv, failingD1.db);

      // Should get data from KV
      const result = await service.getLearnerProfile('tenant-123', 'user-789');
      expect(result).toBeDefined();
      expect(result?.lti_user_id).toBe('user-789');
    });
  });

  describe('Write Operations', () => {
    it('should save to both D1 and KV', async () => {
      const profile = {
        id: 'profile-new',
        tenant_id: 'tenant-123',
        lti_user_id: 'user-new',
        lti_deployment_id: 'deployment-new',
        email: 'new@example.com',
        name: 'New User',
        cognitive_profile: {
          forgetting_curve_s: 1.0,
          learning_velocity: 1.0,
          optimal_difficulty: 0.7,
          preferred_modality: 'visual',
        },
        privacy_settings: {
          data_sharing_consent: true,
          ai_interaction_consent: true,
          anonymous_analytics: true,
        },
        created_at: '2025-01-21T00:00:00Z',
        updated_at: '2025-01-21T00:00:00Z',
      };

      await service.saveLearnerProfile(profile);

      // Check D1 was called
      expect(mockD1.db.prepare).toHaveBeenCalled();
      expect(mockD1.mockPreparedStatement.run).toHaveBeenCalled();

      // Check KV was updated
      const kvData = await mockKV.kv.get('fallback:learner:tenant-123:user-new', 'json');
      expect(kvData).toBeDefined();
      expect(kvData.id).toBe('profile-new');
    });

    it('should still save to KV even if D1 fails', async () => {
      const failingD1 = createMockD1(true);
      service = new StorageFallbackService(mockKV.kv, failingD1.db);

      const profile = {
        id: 'profile-kv-only',
        tenant_id: 'tenant-123',
        lti_user_id: 'user-kv',
        lti_deployment_id: 'deployment-kv',
        email: 'kv@example.com',
        name: 'KV Only User',
        cognitive_profile: {
          forgetting_curve_s: 1.0,
          learning_velocity: 1.0,
          optimal_difficulty: 0.7,
          preferred_modality: 'visual',
        },
        privacy_settings: {
          data_sharing_consent: true,
          ai_interaction_consent: true,
          anonymous_analytics: true,
        },
        created_at: '2025-01-21T00:00:00Z',
        updated_at: '2025-01-21T00:00:00Z',
      };

      await service.saveLearnerProfile(profile);

      // KV should have the data despite D1 failure
      const kvData = await mockKV.kv.get('fallback:learner:tenant-123:user-kv', 'json');
      expect(kvData).toBeDefined();
      expect(kvData.id).toBe('profile-kv-only');
    });
  });

  describe('Metrics Tracking', () => {
    it('should track fallback activations', async () => {
      const failingD1 = createMockD1(true);
      service = new StorageFallbackService(mockKV.kv, failingD1.db);

      // Store data in KV for successful fallback
      await mockKV.kv.put(
        'fallback:learner:tenant-123:user-456',
        JSON.stringify({ id: 'test1', tenant_id: 'tenant-123', lti_user_id: 'user-456' }),
      );
      await mockKV.kv.put(
        'fallback:learner:tenant-123:user-789',
        JSON.stringify({ id: 'test2', tenant_id: 'tenant-123', lti_user_id: 'user-789' }),
      );

      await service.getLearnerProfile('tenant-123', 'user-456');
      await service.getLearnerProfile('tenant-123', 'user-789');

      const metrics = service.getMetrics();
      expect(metrics.fallbackActivations).toBe(2);
      expect(metrics.d1Failures).toBe(2);
    });

    it('should track KV hits and misses', async () => {
      const failingD1 = createMockD1(true);
      service = new StorageFallbackService(mockKV.kv, failingD1.db);

      // First request - KV miss
      await service.getLearnerProfile('tenant-123', 'user-miss');

      // Store data in KV
      await mockKV.kv.put(
        'fallback:learner:tenant-123:user-hit',
        JSON.stringify({ id: 'test', tenant_id: 'tenant-123', lti_user_id: 'user-hit' }),
      );

      // Second request - KV hit
      await service.getLearnerProfile('tenant-123', 'user-hit');

      const metrics = service.getMetrics();
      expect(metrics.kvMisses).toBe(1);
      expect(metrics.kvHits).toBe(1);
    });

    it('should track last failure timestamp', async () => {
      const failingD1 = createMockD1(true);
      service = new StorageFallbackService(mockKV.kv, failingD1.db);

      await service.getLearnerProfile('tenant-123', 'user-456');

      const metrics = service.getMetrics();
      expect(metrics.lastFailure).toBeDefined();
      expect(new Date(metrics.lastFailure!).getTime()).toBeCloseTo(Date.now(), -2);
    });
  });

  describe('KV TTL', () => {
    it('should set TTL on KV entries', async () => {
      const profile = {
        id: 'profile-ttl',
        tenant_id: 'tenant-123',
        lti_user_id: 'user-ttl',
        lti_deployment_id: 'deployment-ttl',
        email: 'ttl@example.com',
        name: 'TTL User',
        cognitive_profile: {
          forgetting_curve_s: 1.0,
          learning_velocity: 1.0,
          optimal_difficulty: 0.7,
          preferred_modality: 'visual',
        },
        privacy_settings: {
          data_sharing_consent: true,
          ai_interaction_consent: true,
          anonymous_analytics: true,
        },
        created_at: '2025-01-21T00:00:00Z',
        updated_at: '2025-01-21T00:00:00Z',
      };

      await service.saveLearnerProfile(profile);

      // Verify put was called with TTL
      expect(mockKV.kv.put).toHaveBeenCalledWith(
        'fallback:learner:tenant-123:user-ttl',
        expect.any(String),
        { expirationTtl: 86400 }, // 24 hours
      );
    });
  });
});
