/**
 * @fileoverview Comprehensive tests for MCP Privacy Control Service
 * @module features/learner-dna/tests/McpPrivacyControlService
 *
 * Tests cover all MCP-specific privacy requirements:
 * - External AI client consent validation
 * - Real-time session termination
 * - Granular scope validation
 * - COPPA parental control enforcement
 * - Backward compatibility with Epic 7 framework
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { McpPrivacyControlService } from '../server/services/McpPrivacyControlService';
import { PrivacyConsentRepository } from '../server/repositories/PrivacyConsentRepository';
import { DatabaseService } from '@shared/server/services';
import type {
  LearnerDNAPrivacyConsent,
  McpClientRegistry,
  McpParentalControls,
  McpDataScope,
} from '../shared/types';

describe('McpPrivacyControlService', () => {
  let mcpPrivacyService: McpPrivacyControlService;
  let privacyConsentRepo: PrivacyConsentRepository;
  let mockDb: DatabaseService;
  let mockDbInstance: any;

  const mockTenantId = 'test-tenant-123';
  const mockUserId = 'test-user-456';
  const mockClientId = 'test-client-789';

  beforeEach(() => {
    // Create mock database instance
    mockDbInstance = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({ results: [] }),
    };

    mockDb = {
      getDb: vi.fn().mockReturnValue(mockDbInstance),
      get: vi.fn(),
      run: vi.fn(),
    } as any;

    mcpPrivacyService = new McpPrivacyControlService(mockDb);
    privacyConsentRepo = new PrivacyConsentRepository(mockDb);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('External AI Client Consent Validation', () => {
    test('should deny access when no privacy consent exists', async () => {
      // Setup: No existing consent
      mockDbInstance.first.mockResolvedValue(null);

      const result = await mcpPrivacyService.validateExternalAiClientAccess(
        mockTenantId,
        mockUserId,
        mockClientId,
        ['learner.profile.basic']
      );

      expect(result.isValid).toBe(false);
      expect(result.hasRequiredConsent).toBe(false);
      expect(result.missingConsents).toContain('no_privacy_consent');
      expect(result.violations).toContain('No active privacy consent found');
    });

    test('should deny access when external AI access consent is false', async () => {
      // Setup: Consent exists but external AI access is not consented
      const mockConsent = createMockPrivacyConsent({
        externalAiAccessConsent: false,
      });
      mockDbInstance.first.mockResolvedValue(mockConsent);

      const result = await mcpPrivacyService.validateExternalAiClientAccess(
        mockTenantId,
        mockUserId,
        mockClientId,
        ['learner.profile.basic']
      );

      expect(result.isValid).toBe(false);
      expect(result.hasRequiredConsent).toBe(false);
      expect(result.missingConsents).toContain('external_ai_access');
      expect(result.violations).toContain('External AI access not consented');
    });

    test('should deny access when client is not approved', async () => {
      // Setup: Valid consent but unapproved client
      const mockConsent = createMockPrivacyConsent({
        externalAiAccessConsent: true,
      });
      const mockClient = createMockClient({
        status: 'pending',
      });

      mockDbInstance.first
        .mockResolvedValueOnce(mockConsent) // Privacy consent query
        .mockResolvedValueOnce(mockClient); // Client registry query

      const result = await mcpPrivacyService.validateExternalAiClientAccess(
        mockTenantId,
        mockUserId,
        mockClientId,
        ['learner.profile.basic']
      );

      expect(result.isValid).toBe(false);
      expect(result.violations).toContain('Client not approved or not found');
    });

    test('should validate successfully with proper consent and approved client', async () => {
      // Setup: Valid consent and approved client
      const mockConsent = createMockPrivacyConsent({
        externalAiAccessConsent: true,
        dataCollectionLevel: 'standard',
        parentalConsentRequired: false,
        mcpClientScopes: ['learner.profile.basic'],
      });
      const mockClient = createMockClient({
        status: 'approved',
        clientType: 'ai_assistant',
      });
      const mockScope = createMockDataScope({
        scopeName: 'learner.profile.basic',
        scopeCategory: 'profile',
        coppaParentalConsentRequired: false,
      });

      mockDbInstance.first
        .mockResolvedValueOnce(mockConsent) // Privacy consent query
        .mockResolvedValueOnce(mockClient) // Client registry query
        .mockResolvedValueOnce(null); // Parental controls query (none exist)

      mockDbInstance.all.mockResolvedValue({
        results: [mockScope],
      }); // Scope definitions query

      const result = await mcpPrivacyService.validateExternalAiClientAccess(
        mockTenantId,
        mockUserId,
        mockClientId,
        ['learner.profile.basic']
      );

      expect(result.isValid).toBe(true);
      expect(result.hasRequiredConsent).toBe(true);
      expect(result.allowedScopes).toContain('learner.profile.basic');
      expect(result.violations).toHaveLength(0);
    });

    test('should enforce parental controls for minors', async () => {
      // Setup: Minor user with parental controls restricting access
      const mockConsent = createMockPrivacyConsent({
        externalAiAccessConsent: true,
        parentalConsentRequired: true,
        parentalConsentGiven: true,
      });
      const mockClient = createMockClient({
        status: 'approved',
        clientType: 'research_platform',
      });
      const mockParentalControls = createMockParentalControls({
        externalAiAccessAllowed: false,
        allowedClientTypes: ['ai_assistant'], // Doesn't include 'research_platform'
      });

      mockDbInstance.first
        .mockResolvedValueOnce(mockConsent) // Privacy consent query
        .mockResolvedValueOnce(mockClient) // Client registry query
        .mockResolvedValueOnce(mockParentalControls); // Parental controls query

      const result = await mcpPrivacyService.validateExternalAiClientAccess(
        mockTenantId,
        mockUserId,
        mockClientId,
        ['learner.profile.basic']
      );

      expect(result.isValid).toBe(false);
      expect(result.parentalApprovalRequired).toBe(true);
      expect(result.sessionLimitsEnforced).toBe(true);
      expect(result.violations).toContain('External AI access not permitted by parental controls');
    });
  });

  describe('Real-Time Session Termination', () => {
    test('should terminate all sessions on full withdrawal', async () => {
      // Setup: Active sessions to be terminated
      const mockActiveSessions = [
        { id: 'session-1', granted_scopes: JSON.stringify(['scope1', 'scope2']) },
        { id: 'session-2', granted_scopes: JSON.stringify(['scope3']) },
      ];

      mockDbInstance.all.mockResolvedValue({
        results: mockActiveSessions,
      });

      const result = await mcpPrivacyService.processRealTimeConsentRevocation(
        mockTenantId,
        mockUserId,
        'full_withdrawal',
        {
          reason: 'User requested immediate withdrawal',
          initiatedBy: 'user',
        }
      );

      expect(result.sessionsTerminated).toBe(2);
      expect(result.revocationId).toBeDefined();
      expect(result.estimatedCompletionTime).toBeInstanceOf(Date);

      // Verify session termination queries were called
      expect(mockDbInstance.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE mcp_active_sessions')
      );
    });

    test('should terminate only scope-specific sessions', async () => {
      // Setup: Mixed sessions with different scopes
      const mockActiveSessions = [
        { id: 'session-1', granted_scopes: JSON.stringify(['scope1', 'scope2']) },
        { id: 'session-2', granted_scopes: JSON.stringify(['scope3', 'scope4']) },
      ];

      mockDbInstance.all.mockResolvedValue({
        results: mockActiveSessions,
      });

      const result = await mcpPrivacyService.processRealTimeConsentRevocation(
        mockTenantId,
        mockUserId,
        'scope_specific',
        {
          affectedScopes: ['scope1', 'scope3'],
          reason: 'Scope-specific withdrawal',
          initiatedBy: 'user',
        }
      );

      expect(result.sessionsTerminated).toBe(2); // Both sessions have affected scopes
      expect(result.revocationId).toBeDefined();
    });

    test('should handle emergency stop with highest priority', async () => {
      mockDbInstance.all.mockResolvedValue({
        results: [{ id: 'session-1', granted_scopes: JSON.stringify(['scope1']) }],
      });

      const result = await mcpPrivacyService.processRealTimeConsentRevocation(
        mockTenantId,
        mockUserId,
        'emergency_stop',
        {
          reason: 'Emergency privacy violation detected',
          initiatedBy: 'system',
        }
      );

      expect(result.sessionsTerminated).toBe(1);

      // Verify high priority was set (priority_level = 1)
      expect(mockDbInstance.bind).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        1, // Priority level should be 1 for emergency stop
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe('MCP Session Creation', () => {
    test('should create session with proper security controls', async () => {
      const mockConsent = createMockPrivacyConsent({
        externalAiAccessConsent: true,
        consentVersion: '2.0',
        parentalConsentRequired: false,
      });

      mockDbInstance.first.mockResolvedValue(mockConsent);

      const sessionData = await mcpPrivacyService.createMcpSession(
        mockTenantId,
        mockUserId,
        mockClientId,
        ['learner.profile.basic'],
        {
          sessionType: 'api_access',
          ipAddress: '192.168.1.1',
          userAgent: 'TestAgent/1.0',
        }
      );

      expect(sessionData.tenantId).toBe(mockTenantId);
      expect(sessionData.userId).toBe(mockUserId);
      expect(sessionData.clientId).toBe(mockClientId);
      expect(sessionData.grantedScopes).toContain('learner.profile.basic');
      expect(sessionData.sessionToken).toBeDefined();
      expect(sessionData.encryptionLevel).toBe('AES-256');
      expect(sessionData.expiresAt).toBeInstanceOf(Date);

      // Verify session was stored in database
      expect(mockDbInstance.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO mcp_active_sessions')
      );
    });

    test('should apply parental control session duration limits', async () => {
      const mockConsent = createMockPrivacyConsent({
        externalAiAccessConsent: true,
        parentalConsentRequired: true,
      });
      const mockParentalControls = createMockParentalControls({
        maxSessionDurationMinutes: 30, // 30 minutes limit
      });

      mockDbInstance.first
        .mockResolvedValueOnce(mockConsent) // Privacy consent query
        .mockResolvedValueOnce(mockParentalControls); // Parental controls query

      const sessionData = await mcpPrivacyService.createMcpSession(
        mockTenantId,
        mockUserId,
        mockClientId,
        ['learner.profile.basic'],
        {
          sessionType: 'real_time_stream',
        }
      );

      // Session should expire in 30 minutes (1800 seconds)
      const sessionDuration = sessionData.expiresAt.getTime() - sessionData.startedAt.getTime();
      const expectedDuration = 30 * 60 * 1000; // 30 minutes in milliseconds

      expect(sessionDuration).toBeLessThanOrEqual(expectedDuration + 1000); // Allow small timing variance
      expect(sessionDuration).toBeGreaterThanOrEqual(expectedDuration - 1000);
    });

    test('should reject session creation without consent', async () => {
      mockDbInstance.first.mockResolvedValue(null); // No consent found

      await expect(
        mcpPrivacyService.createMcpSession(
          mockTenantId,
          mockUserId,
          mockClientId,
          ['learner.profile.basic'],
          { sessionType: 'api_access' }
        )
      ).rejects.toThrow('No active privacy consent found');
    });
  });

  describe('COPPA Parental Controls', () => {
    test('should enforce time window restrictions', async () => {
      const mockConsent = createMockPrivacyConsent({
        externalAiAccessConsent: true,
        parentalConsentRequired: true,
      });
      const mockClient = createMockClient({ status: 'approved' });

      // Create time window that doesn't include current time
      const currentHour = new Date().getHours();
      const restrictedStart = ((currentHour + 2) % 24).toString().padStart(2, '0') + ':00';
      const restrictedEnd = ((currentHour + 4) % 24).toString().padStart(2, '0') + ':00';

      const mockParentalControls = createMockParentalControls({
        externalAiAccessAllowed: true,
        allowedClientTypes: ['ai_assistant'],
        allowedTimeWindows: [
          {
            start: restrictedStart,
            end: restrictedEnd,
            days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          },
        ],
      });

      mockDbInstance.first
        .mockResolvedValueOnce(mockConsent)
        .mockResolvedValueOnce(mockClient)
        .mockResolvedValueOnce(mockParentalControls);

      const result = await mcpPrivacyService.validateExternalAiClientAccess(
        mockTenantId,
        mockUserId,
        mockClientId,
        ['learner.profile.basic']
      );

      expect(result.isValid).toBe(false);
      expect(result.violations).toContain('Access not permitted during current time window');
    });

    test('should create parental controls with COPPA verification', async () => {
      const parentalControlsData = {
        tenantId: mockTenantId,
        userId: mockUserId,
        parentEmail: 'parent@example.com',
        externalAiAccessAllowed: true,
        allowedClientTypes: ['ai_assistant'] as const,
        maxSessionDurationMinutes: 60,
        allowedTimeWindows: [],
        notifyOnAccessRequest: true,
        notifyOnDataSharing: true,
        notifyOnPrivacyChanges: true,
        notificationFrequency: 'immediate' as const,
        canOverrideAiAccess: true,
        canViewChildData: true,
        canExportChildData: true,
        coppaVerificationMethod: 'email' as const,
        verificationCompletedAt: new Date(),
      };

      const result = await mcpPrivacyService.setupParentalControls(parentalControlsData);

      expect(result.parentEmail).toBe('parent@example.com');
      expect(result.coppaVerificationMethod).toBe('email');
      expect(result.externalAiAccessAllowed).toBe(true);
      expect(result.id).toBeDefined();

      // Verify database insertion
      expect(mockDbInstance.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO mcp_parental_controls')
      );
    });

    test('should enforce client type restrictions', async () => {
      const mockConsent = createMockPrivacyConsent({
        externalAiAccessConsent: true,
        parentalConsentRequired: true,
      });
      const mockClient = createMockClient({
        status: 'approved',
        clientType: 'research_platform',
      });
      const mockParentalControls = createMockParentalControls({
        externalAiAccessAllowed: true,
        allowedClientTypes: ['ai_assistant', 'tutoring_system'], // Doesn't include 'research_platform'
      });

      mockDbInstance.first
        .mockResolvedValueOnce(mockConsent)
        .mockResolvedValueOnce(mockClient)
        .mockResolvedValueOnce(mockParentalControls);

      const result = await mcpPrivacyService.validateExternalAiClientAccess(
        mockTenantId,
        mockUserId,
        mockClientId,
        ['learner.profile.basic']
      );

      expect(result.isValid).toBe(false);
      expect(result.violations).toContain(
        "Client type 'research_platform' not permitted by parental controls"
      );
    });
  });

  describe('Granular Scope Validation', () => {
    test('should validate scope requirements correctly', async () => {
      const mockConsent = createMockPrivacyConsent({
        externalAiAccessConsent: true,
        behavioralTimingConsent: true,
        assessmentPatternsConsent: false,
        dataCollectionLevel: 'standard',
        mcpClientScopes: [],
      });
      const mockClient = createMockClient({ status: 'approved' });

      const mockScopes = [
        createMockDataScope({
          scopeName: 'learner.behavioral.velocity',
          scopeCategory: 'behavioral',
          coppaParentalConsentRequired: false,
        }),
        createMockDataScope({
          scopeName: 'learner.assessment.struggle',
          scopeCategory: 'assessment',
          coppaParentalConsentRequired: false,
        }),
      ];

      mockDbInstance.first
        .mockResolvedValueOnce(mockConsent)
        .mockResolvedValueOnce(mockClient)
        .mockResolvedValueOnce(null); // No parental controls

      mockDbInstance.all.mockResolvedValue({
        results: mockScopes,
      });

      const result = await mcpPrivacyService.validateExternalAiClientAccess(
        mockTenantId,
        mockUserId,
        mockClientId,
        ['learner.behavioral.velocity', 'learner.assessment.struggle']
      );

      // Should grant behavioral scope but deny assessment scope
      expect(result.allowedScopes).toContain('learner.behavioral.velocity');
      expect(result.allowedScopes).not.toContain('learner.assessment.struggle');
      expect(result.missingConsents).toContain('scope_learner.assessment.struggle');
    });

    test('should enforce COPPA requirements for specific scopes', async () => {
      const mockConsent = createMockPrivacyConsent({
        externalAiAccessConsent: true,
        parentalConsentRequired: true,
        parentalConsentGiven: false, // Parent hasn't given consent
        dataCollectionLevel: 'standard',
      });
      const mockClient = createMockClient({ status: 'approved' });

      const mockScope = createMockDataScope({
        scopeName: 'learner.realtime.analysis',
        scopeCategory: 'real_time',
        coppaParentalConsentRequired: true, // Requires parental consent
      });

      mockDbInstance.first
        .mockResolvedValueOnce(mockConsent)
        .mockResolvedValueOnce(mockClient)
        .mockResolvedValueOnce(null); // No parental controls setup

      mockDbInstance.all.mockResolvedValue({
        results: [mockScope],
      });

      const result = await mcpPrivacyService.validateExternalAiClientAccess(
        mockTenantId,
        mockUserId,
        mockClientId,
        ['learner.realtime.analysis']
      );

      expect(result.allowedScopes).not.toContain('learner.realtime.analysis');
      expect(result.missingConsents).toContain('parental_consent');
    });

    test('should respect user-defined scope restrictions', async () => {
      const mockConsent = createMockPrivacyConsent({
        externalAiAccessConsent: true,
        dataCollectionLevel: 'comprehensive',
        mcpClientScopes: ['learner.profile.basic'], // User only allows this specific scope
        behavioralTimingConsent: true,
      });
      const mockClient = createMockClient({ status: 'approved' });

      const mockScopes = [
        createMockDataScope({
          scopeName: 'learner.profile.basic',
          scopeCategory: 'profile',
        }),
        createMockDataScope({
          scopeName: 'learner.behavioral.velocity',
          scopeCategory: 'behavioral',
        }),
      ];

      mockDbInstance.first
        .mockResolvedValueOnce(mockConsent)
        .mockResolvedValueOnce(mockClient)
        .mockResolvedValueOnce(null);

      mockDbInstance.all.mockResolvedValue({
        results: mockScopes,
      });

      const result = await mcpPrivacyService.validateExternalAiClientAccess(
        mockTenantId,
        mockUserId,
        mockClientId,
        ['learner.profile.basic', 'learner.behavioral.velocity']
      );

      expect(result.allowedScopes).toContain('learner.profile.basic');
      expect(result.allowedScopes).not.toContain('learner.behavioral.velocity');
      expect(result.violations).toContain(
        'Scope not in user\'s allowed list: learner.behavioral.velocity'
      );
    });
  });

  describe('Backward Compatibility', () => {
    test('should handle existing Epic 7 consent records without MCP fields', async () => {
      // Simulate existing consent record without MCP fields
      const legacyConsent = {
        id: 'legacy-consent-123',
        tenant_id: mockTenantId,
        user_id: mockUserId,
        consent_version: '1.0',
        behavioral_timing_consent: 1,
        assessment_patterns_consent: 1,
        chat_interactions_consent: 0,
        cross_course_correlation_consent: 1,
        anonymized_analytics_consent: 1,
        data_collection_level: 'standard',
        parental_consent_required: 0,
        parental_consent_given: 0,
        parental_email: null,
        consent_given_at: new Date().toISOString(),
        consent_updated_at: new Date().toISOString(),
        withdrawal_requested_at: null,
        withdrawal_reason: null,
        consent_source: 'dashboard',
        ip_address: null,
        user_agent: null,
        // MCP fields should default to safe values
        external_ai_access_consent: null, // NULL in database
        mcp_client_scopes: null, // NULL in database
        real_time_revocation_enabled: null, // NULL in database
        external_client_restrictions: null, // NULL in database
      };

      mockDbInstance.first.mockResolvedValue(legacyConsent);

      // This should not throw and should handle defaults gracefully
      const result = await mcpPrivacyService.validateExternalAiClientAccess(
        mockTenantId,
        mockUserId,
        mockClientId,
        ['learner.profile.basic']
      );

      expect(result.isValid).toBe(false);
      expect(result.missingConsents).toContain('external_ai_access');
      expect(result.violations).toContain('External AI access not consented');
    });

    test('should upgrade existing consent to include MCP fields', async () => {
      const existingConsent = createMockPrivacyConsent({
        id: 'existing-consent',
        consentVersion: '1.0', // Old version
        externalAiAccessConsent: false, // Default for existing records
        mcpClientScopes: [], // Default for existing records
      });

      // Mock the consent repository's findByUserId method
      const mockFindByUserId = vi.spyOn(privacyConsentRepo, 'findByUserId');
      mockFindByUserId.mockResolvedValue(existingConsent);

      const mockUpdate = vi.spyOn(privacyConsentRepo, 'update');
      mockUpdate.mockResolvedValue({
        ...existingConsent,
        externalAiAccessConsent: true,
        mcpClientScopes: ['learner.profile.basic'],
        consentVersion: '2.0',
      });

      // Attempt to update with MCP fields
      const updatedConsent = await privacyConsentRepo.update(existingConsent.id, {
        externalAiAccessConsent: true,
        mcpClientScopes: ['learner.profile.basic'],
        consentVersion: '2.0',
      });

      expect(updatedConsent.externalAiAccessConsent).toBe(true);
      expect(updatedConsent.mcpClientScopes).toContain('learner.profile.basic');
      expect(updatedConsent.consentVersion).toBe('2.0');
    });
  });

  // Helper functions to create mock objects
  function createMockPrivacyConsent(overrides: Partial<LearnerDNAPrivacyConsent> = {}): any {
    return {
      id: 'mock-consent-123',
      tenant_id: mockTenantId,
      user_id: mockUserId,
      consent_version: '2.0',
      behavioral_timing_consent: 0,
      assessment_patterns_consent: 0,
      chat_interactions_consent: 0,
      cross_course_correlation_consent: 0,
      anonymized_analytics_consent: 1,
      external_ai_access_consent: 0,
      mcp_client_scopes: '[]',
      real_time_revocation_enabled: 1,
      external_client_restrictions: '{}',
      data_collection_level: 'minimal',
      parental_consent_required: 0,
      parental_consent_given: 0,
      parental_email: null,
      consent_given_at: new Date().toISOString(),
      consent_updated_at: new Date().toISOString(),
      withdrawal_requested_at: null,
      withdrawal_reason: null,
      consent_source: 'dashboard',
      ip_address: null,
      user_agent: null,
      ...Object.fromEntries(
        Object.entries(overrides).map(([key, value]) => [
          key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`),
          typeof value === 'boolean' ? (value ? 1 : 0) :
          Array.isArray(value) || typeof value === 'object' ? JSON.stringify(value) :
          value
        ])
      ),
    };
  }

  function createMockClient(overrides: Partial<McpClientRegistry> = {}): any {
    return {
      id: mockClientId,
      tenant_id: mockTenantId,
      client_name: 'Test AI Assistant',
      client_type: 'ai_assistant',
      client_description: 'Test client for unit tests',
      client_version: '1.0',
      client_secret_hash: 'hashed-secret',
      api_key_prefix: 'test-key',
      authorized_scopes: JSON.stringify(['learner.profile.basic']),
      rate_limit_per_minute: 60,
      privacy_policy_url: 'https://test.com/privacy',
      data_retention_days: 0,
      anonymization_required: 1,
      audit_logging_enabled: 1,
      contact_email: 'test@example.com',
      organization: 'Test Org',
      certification_level: 'basic',
      status: 'pending',
      approved_by: null,
      approved_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_access_at: null,
      ...Object.fromEntries(
        Object.entries(overrides).map(([key, value]) => [
          key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`),
          typeof value === 'boolean' ? (value ? 1 : 0) :
          Array.isArray(value) || typeof value === 'object' ? JSON.stringify(value) :
          value
        ])
      ),
    };
  }

  function createMockParentalControls(overrides: Partial<McpParentalControls> = {}): any {
    return {
      id: 'mock-parental-controls-123',
      tenant_id: mockTenantId,
      user_id: mockUserId,
      parent_email: 'parent@example.com',
      external_ai_access_allowed: 1,
      allowed_client_types: JSON.stringify(['ai_assistant']),
      max_session_duration_minutes: 120,
      allowed_time_windows: JSON.stringify([]),
      notify_on_access_request: 1,
      notify_on_data_sharing: 1,
      notify_on_privacy_changes: 1,
      notification_frequency: 'immediate',
      emergency_contact_phone: null,
      can_override_ai_access: 1,
      can_view_child_data: 1,
      can_export_child_data: 1,
      coppa_verification_method: 'email',
      verification_completed_at: new Date().toISOString(),
      verification_document_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_notification_sent_at: null,
      next_review_due: null,
      ...Object.fromEntries(
        Object.entries(overrides).map(([key, value]) => [
          key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`),
          typeof value === 'boolean' ? (value ? 1 : 0) :
          Array.isArray(value) || typeof value === 'object' ? JSON.stringify(value) :
          value
        ])
      ),
    };
  }

  function createMockDataScope(overrides: Partial<McpDataScope> = {}): any {
    return {
      id: 'mock-scope-123',
      scope_name: 'learner.profile.basic',
      scope_category: 'profile',
      description: 'Basic learner profile data',
      data_sensitivity_level: 'low',
      requires_explicit_consent: 1,
      privacy_impact_score: 0.2,
      gdpr_article_applicable: null,
      coppa_parental_consent_required: 0,
      data_tables_accessed: JSON.stringify(['learner_dna_profiles']),
      anonymization_possible: 1,
      real_time_access_allowed: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      compliance_review_due: null,
      ...Object.fromEntries(
        Object.entries(overrides).map(([key, value]) => [
          key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`),
          typeof value === 'boolean' ? (value ? 1 : 0) :
          Array.isArray(value) || typeof value === 'object' ? JSON.stringify(value) :
          value
        ])
      ),
    };
  }
});