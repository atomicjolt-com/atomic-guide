/**
 * Unit tests for DatabaseService tenant isolation
 * Story 1.1 Requirement: Verify tenant isolation cannot be bypassed
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseService } from '../../src/services/database';
import type { D1Database } from '@cloudflare/workers-types';

// Mock D1 Database
const createMockD1 = () => {
  const mockResults = new Map<string, any>();
  
  const mockPreparedStatement = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn(async () => mockResults.get('first')),
    all: vi.fn(async () => ({ results: mockResults.get('all') || [] })),
    run: vi.fn(async () => ({ success: true }))
  };
  
  const mockD1: Partial<D1Database> = {
    prepare: vi.fn(() => mockPreparedStatement as any),
    batch: vi.fn(async (statements) => []),
    dump: vi.fn(async () => new ArrayBuffer(0)),
    exec: vi.fn(async () => ({ count: 0, duration: 0 }))
  };
  
  return {
    db: mockD1 as D1Database,
    mockPreparedStatement,
    mockResults
  };
};

describe('DatabaseService - Tenant Isolation', () => {
  let dbService: DatabaseService;
  let mockD1: ReturnType<typeof createMockD1>;
  
  beforeEach(() => {
    mockD1 = createMockD1();
    dbService = new DatabaseService(mockD1.db);
  });
  
  describe('Tenant Creation', () => {
    it('should create a new tenant with unique ISS and client ID', async () => {
      mockD1.mockResults.set('first', {
        id: 'tenant-123',
        iss: 'https://canvas.example.edu',
        client_id: 'client-456',
        deployment_ids: '[]',
        institution_name: 'Example University',
        lms_type: 'canvas',
        lms_url: 'https://canvas.example.edu',
        settings: '{}',
        features: '{"chat": true}',
        created_at: '2025-01-21T00:00:00Z',
        updated_at: '2025-01-21T00:00:00Z'
      });
      
      const tenant = await dbService.createTenant(
        'https://canvas.example.edu',
        'client-456',
        'Example University',
        'canvas',
        'https://canvas.example.edu'
      );
      
      expect(tenant).toBeDefined();
      expect(tenant.id).toBe('tenant-123');
      expect(tenant.iss).toBe('https://canvas.example.edu');
      expect(tenant.client_id).toBe('client-456');
      expect(mockD1.mockPreparedStatement.bind).toHaveBeenCalled();
    });
    
    it('should enforce unique constraint on ISS and client ID', async () => {
      // First call fails with unique constraint error
      mockD1.mockPreparedStatement.first.mockRejectedValueOnce(
        new Error('UNIQUE constraint failed')
      );
      
      // Second call (findTenantByIssAndClientId) returns existing tenant
      mockD1.mockResults.set('first', {
        id: 'existing-tenant',
        iss: 'https://canvas.example.edu',
        client_id: 'client-456',
        deployment_ids: '[]',
        institution_name: 'Existing University',
        lms_type: 'canvas',
        lms_url: 'https://canvas.example.edu',
        settings: '{}',
        features: '{"chat": true}',
        created_at: '2025-01-20T00:00:00Z',
        updated_at: '2025-01-20T00:00:00Z'
      });
      
      const tenant = await dbService.createTenant(
        'https://canvas.example.edu',
        'client-456',
        'New University',
        'canvas',
        'https://canvas.example.edu'
      );
      
      // Should return existing tenant instead of creating new one
      expect(tenant.id).toBe('existing-tenant');
      expect(tenant.institution_name).toBe('Existing University');
    });
  });
  
  describe('Learner Profile Isolation', () => {
    it('should enforce tenant_id when creating learner profiles', async () => {
      // First call returns null (no existing profile)
      // Second call returns the created profile
      let callCount = 0;
      mockD1.mockPreparedStatement.first.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return null; // No existing profile
        }
        return {
          id: 'new-profile',
          tenant_id: 'tenant-123',
          lti_user_id: 'user-456'
        }; // Created profile
      });
      
      await dbService.createOrUpdateLearnerProfile(
        'tenant-123',
        'user-456',
        'deployment-789',
        'student@example.edu',
        'Test Student'
      );
      
      // Verify bind was called with tenant_id
      const bindCalls = mockD1.mockPreparedStatement.bind.mock.calls;
      expect(bindCalls[0]).toContain('tenant-123'); // Check first query
      expect(bindCalls[1]).toContain('tenant-123'); // Check insert query
    });
    
    it('should not allow access to profiles from different tenants', async () => {
      // Setup: Profile exists for tenant-123
      mockD1.mockResults.set('first', {
        id: 'profile-1',
        tenant_id: 'tenant-123',
        lti_user_id: 'user-456',
        lti_deployment_id: 'deployment-789',
        email: 'student@example.edu',
        name: 'Test Student'
      });
      
      // Test: Try to access with correct tenant
      const profile1 = await dbService.findLearnerProfile('tenant-123', 'user-456');
      expect(profile1).toBeDefined();
      expect(profile1?.tenant_id).toBe('tenant-123');
      
      // Test: Try to access with different tenant (should return null)
      mockD1.mockResults.set('first', null);
      const profile2 = await dbService.findLearnerProfile('tenant-999', 'user-456');
      expect(profile2).toBeNull();
      
      // Verify queries included tenant_id
      const bindCalls = mockD1.mockPreparedStatement.bind.mock.calls;
      expect(bindCalls[0]).toEqual(['tenant-123', 'user-456']);
      expect(bindCalls[1]).toEqual(['tenant-999', 'user-456']);
    });
    
    it('should only return profiles for the specified tenant', async () => {
      mockD1.mockResults.set('all', [
        {
          id: 'profile-1',
          tenant_id: 'tenant-123',
          lti_user_id: 'user-1',
          name: 'Student 1'
        },
        {
          id: 'profile-2',
          tenant_id: 'tenant-123',
          lti_user_id: 'user-2',
          name: 'Student 2'
        }
      ]);
      
      const profiles = await dbService.getLearnerProfilesByTenant('tenant-123', 10, 0);
      
      expect(profiles).toHaveLength(2);
      expect(profiles.every(p => p.tenant_id === 'tenant-123')).toBe(true);
      
      // Verify query included tenant_id
      expect(mockD1.mockPreparedStatement.bind).toHaveBeenCalledWith('tenant-123', 10, 0);
    });
  });
  
  describe('Cross-Tenant Protection', () => {
    it('should fail when trying to update profile without tenant_id', async () => {
      // Profile doesn't exist for wrong tenant
      mockD1.mockResults.set('first', null);
      
      await expect(
        dbService.updateLearnerCognitiveProfile(
          'wrong-tenant',
          'user-456',
          { learning_velocity: 1.5 }
        )
      ).rejects.toThrow('Learner profile not found');
    });
    
    it('should fail when trying to update privacy settings without proper tenant', async () => {
      // Profile doesn't exist for wrong tenant
      mockD1.mockResults.set('first', null);
      
      await expect(
        dbService.updateLearnerPrivacySettings(
          'wrong-tenant',
          'user-456',
          { data_sharing_consent: true }
        )
      ).rejects.toThrow('Learner profile not found');
    });
  });
  
  describe('Transaction Support', () => {
    it('should support atomic operations through transaction helper', async () => {
      const result = await dbService.transaction(async () => {
        return 'test-result';
      });
      
      expect(result).toBe('test-result');
    });
  });
  
  describe('Health Check', () => {
    it('should return true when database is healthy', async () => {
      mockD1.mockResults.set('first', { healthy: 1 });
      
      const isHealthy = await dbService.healthCheck();
      expect(isHealthy).toBe(true);
    });
    
    it('should return false when database is unhealthy', async () => {
      mockD1.mockPreparedStatement.first.mockRejectedValueOnce(new Error('Database error'));
      
      const isHealthy = await dbService.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });
  
  describe('Statistics', () => {
    it('should return tenant-specific statistics', async () => {
      mockD1.mockResults.set('first', {
        learner_count: 50,
        session_count: 200,
        chat_count: 75
      });
      
      const stats = await dbService.getStats('tenant-123');
      
      expect(stats.learner_count).toBe(50);
      expect(stats.session_count).toBe(200);
      expect(stats.chat_count).toBe(75);
      
      // Verify tenant_id was included in query
      expect(mockD1.mockPreparedStatement.bind).toHaveBeenCalledWith(
        'tenant-123',
        'tenant-123',
        'tenant-123'
      );
    });
    
    it('should return global statistics when no tenant specified', async () => {
      mockD1.mockResults.set('first', {
        tenant_count: 10,
        total_learners: 500,
        total_sessions: 2000
      });
      
      const stats = await dbService.getStats();
      
      expect(stats.tenant_count).toBe(10);
      expect(stats.total_learners).toBe(500);
      expect(stats.total_sessions).toBe(2000);
    });
  });
});

describe('DatabaseService - Query Isolation', () => {
  it('should always include tenant_id in prepared statements', () => {
    const { db } = createMockD1();
    const dbService = new DatabaseService(db);
    
    // Check that prepared statements are initialized with tenant_id parameters
    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining('WHERE tenant_id = ? AND lti_user_id = ?')
    );
    
    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining('WHERE iss = ? AND client_id = ?')
    );
  });
  
  it('should fail queries without tenant_id parameter', async () => {
    const { db, mockPreparedStatement } = createMockD1();
    const dbService = new DatabaseService(db);
    
    // Try to access profile without proper tenant binding
    mockPreparedStatement.bind.mockImplementation((...args) => {
      if (args.length < 2 || !args[0]) {
        throw new Error('Missing required tenant_id parameter');
      }
      return mockPreparedStatement;
    });
    
    await expect(
      dbService.findLearnerProfile('', 'user-456')
    ).rejects.toThrow('Missing required tenant_id parameter');
  });
});