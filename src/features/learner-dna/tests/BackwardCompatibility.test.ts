/**
 * @fileoverview Backward Compatibility Tests for MCP Privacy Framework Extensions
 * @module features/learner-dna/tests/BackwardCompatibility
 *
 * Ensures that the MCP privacy framework extensions maintain full backward compatibility
 * with existing Epic 7 privacy framework functionality.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrivacyControlService } from '../server/services/PrivacyControlService';
import { PrivacyConsentRepository } from '../server/repositories/PrivacyConsentRepository';
import { DatabaseService } from '@shared/server/services';
import type { LearnerDNAPrivacyConsent, PrivacyConsentUpdate } from '../shared/types';

describe('MCP Privacy Framework - Backward Compatibility', () => {
  let privacyService: PrivacyControlService;
  let privacyRepo: PrivacyConsentRepository;
  let mockDb: DatabaseService;
  let mockDbInstance: any;

  const mockTenantId = 'test-tenant-123';
  const mockUserId = 'test-user-456';

  beforeEach(() => {
    mockDbInstance = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({ results: [] }),
      get: vi.fn().mockResolvedValue(null),
    };

    mockDb = {
      getDb: vi.fn().mockReturnValue(mockDbInstance),
      get: vi.fn().mockImplementation((query, params) => mockDbInstance.get(query, params)),
      run: vi.fn().mockImplementation((query, params) => mockDbInstance.run(query, params)),
    } as any;

    privacyService = new PrivacyControlService(mockDb);
    privacyRepo = new PrivacyConsentRepository(mockDb);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Epic 7 Privacy Control Service Compatibility', () => {
    test('should handle existing consent collection workflow', async () => {
      // Test that the original Epic 7 consent collection still works
      const epic7ConsentData = {
        behavioralTimingConsent: true,
        assessmentPatternsConsent: true,
        chatInteractionsConsent: false,
        crossCourseCorrelationConsent: true,
        anonymizedAnalyticsConsent: true,
        dataCollectionLevel: 'standard' as const,
        parentalConsentRequired: false,
        parentalConsentGiven: false,
        consentSource: 'dashboard' as const,
        ipAddress: '192.168.1.1',
        userAgent: 'TestAgent/1.0',
      };

      // Mock successful database operations
      mockDbInstance.first.mockResolvedValue(null); // No existing consent

      const result = await privacyService.collectConsent(
        mockTenantId,
        mockUserId,
        epic7ConsentData
      );

      expect(result.id).toBeDefined();
      expect(result.tenantId).toBe(mockTenantId);
      expect(result.userId).toBe(mockUserId);
      expect(result.behavioralTimingConsent).toBe(true);
      expect(result.dataCollectionLevel).toBe('standard');

      // Verify the database INSERT was called with Epic 7 fields
      expect(mockDbInstance.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO learner_dna_privacy_consent')
      );
    });

    test('should maintain existing data validation permissions', async () => {
      const mockConsent = createLegacyConsentRecord({
        behavioral_timing_consent: 1,
        assessment_patterns_consent: 0,
        chat_interactions_consent: 1,
        cross_course_correlation_consent: 1,
        anonymized_analytics_consent: 1,
      });

      mockDbInstance.first.mockResolvedValue(mockConsent);

      // Test Epic 7 validation methods
      const hasBehavioralConsent = await privacyService.validateDataCollectionPermission(
        mockTenantId,
        mockUserId,
        'behavioral_timing'
      );

      const hasAssessmentConsent = await privacyService.validateDataCollectionPermission(
        mockTenantId,
        mockUserId,
        'assessment_patterns'
      );

      expect(hasBehavioralConsent).toBe(true);
      expect(hasAssessmentConsent).toBe(false);
    });

    test('should handle consent withdrawal with existing Epic 7 process', async () => {
      const mockConsent = createLegacyConsentRecord({
        behavioral_timing_consent: 1,
        assessment_patterns_consent: 1,
      });

      mockDbInstance.first.mockResolvedValue(mockConsent);

      const withdrawalResult = await privacyService.withdrawConsent(
        mockTenantId,
        mockUserId,
        'User requested data deletion'
      );

      expect(withdrawalResult.withdrawalId).toBeDefined();
      expect(withdrawalResult.purgeCompletionDate).toBeInstanceOf(Date);

      // Verify that the Epic 7 withdrawal process was followed
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE learner_dna_privacy_consent'),
        expect.arrayContaining([
          expect.any(String), // withdrawal date
          'User requested data deletion', // reason
          mockConsent.id, // consent ID
        ])
      );
    });

    test('should maintain Epic 7 COPPA compliance validation', async () => {
      const mockConsentWithCOPPA = createLegacyConsentRecord({
        parental_consent_required: 1,
        parental_consent_given: 0,
        parental_email: 'parent@example.com',
      });

      mockDbInstance.first.mockResolvedValue(mockConsentWithCOPPA);
      // Mock sequential database calls for the three compliance checks (FERPA, COPPA, GDPR)
      mockDbInstance.get
        .mockResolvedValueOnce({ count: 0 }) // FERPA check - no violations
        .mockResolvedValueOnce({ count: 1 }) // COPPA check - 1 violation
        .mockResolvedValueOnce({ count: 0 }); // GDPR check - no violations

      // This should follow the Epic 7 COPPA validation process
      const complianceResult = await privacyService.enforceComplianceValidation(mockTenantId);

      expect(complianceResult.coppaCompliant).toBe(false);
      expect(complianceResult.violations[0]).toMatch(/missing required parental consent/);
    });

    test('should preserve Epic 7 retention policy enforcement', async () => {
      // Test that existing retention policies are respected
      // Mock sequential database calls for the three compliance checks (FERPA, COPPA, GDPR)
      mockDbInstance.get
        .mockResolvedValueOnce({ count: 2 }) // FERPA check - 2 violations
        .mockResolvedValueOnce({ count: 0 }) // COPPA check - no violations
        .mockResolvedValueOnce({ count: 0 }); // GDPR check - no violations

      const complianceResult = await privacyService.enforceComplianceValidation(mockTenantId);

      expect(complianceResult.ferpaCompliant).toBe(false);
      expect(complianceResult.violations[0]).toMatch(/learner profiles without valid FERPA consent/);
    });
  });

  describe('Epic 7 Repository Compatibility', () => {
    test('should handle existing consent queries without MCP fields', async () => {
      const legacyConsent = createLegacyConsentRecord();
      mockDbInstance.first.mockResolvedValue(legacyConsent);

      const consent = await privacyRepo.findByUserId(mockUserId, mockTenantId);

      expect(consent).toBeDefined();
      expect(consent!.id).toBe('legacy-consent-123');
      expect(consent!.behavioralTimingConsent).toBe(false);

      // MCP fields should have safe defaults when missing from database
      expect(consent!.externalAiAccessConsent).toBe(false);
      expect(consent!.mcpClientScopes).toEqual([]);
      expect(consent!.realTimeRevocationEnabled).toBe(true);
      expect(consent!.externalClientRestrictions).toEqual({});
    });

    test('should update existing consent records to include MCP fields', async () => {
      const legacyConsent = createLegacyConsentRecord();
      mockDbInstance.first.mockResolvedValue(legacyConsent);

      // Test updating with both Epic 7 and MCP fields
      const updates: PrivacyConsentUpdate = {
        behavioralTimingConsent: true, // Epic 7 field
        externalAiAccessConsent: true, // MCP field
        mcpClientScopes: ['learner.profile.basic'], // MCP field
      };

      await privacyRepo.updateUserConsent(mockUserId, updates, mockTenantId);

      // Verify that both Epic 7 and MCP fields are handled in the same update
      expect(mockDbInstance.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE learner_dna_privacy_consent')
      );

      expect(mockDbInstance.bind).toHaveBeenCalledWith(
        expect.anything(), // behavioral_timing_consent
        expect.anything(), // external_ai_access_consent
        expect.anything(), // mcp_client_scopes
        expect.anything(), // consent_updated_at
        expect.anything(), // consent ID
      );
    });

    test('should handle consent statistics with mixed Epic 7 and MCP data', async () => {
      // Mock database results with mixed old and new consent records
      mockDbInstance.all.mockResolvedValue({
        results: [
          {
            total_consents: 5,
            active_consents: 3,
            withdrawn_consents: 2,
            parental_consent_required: 1,
            parental_consent_given: 1,
            data_collection_level: 'standard',
            level_count: 3,
            behavioral_timing_count: 2,
            assessment_patterns_count: 1,
            chat_interactions_count: 2,
            cross_course_count: 1,
            anonymized_analytics_count: 3,
          },
        ],
      });

      const stats = await privacyRepo.getConsentStatistics(mockTenantId);

      expect(stats.totalConsents).toBe(5);
      expect(stats.activeConsents).toBe(3);
      expect(stats.withdrawnConsents).toBe(2);
      expect(stats.consentsByLevel.standard).toBe(3);
      expect(stats.consentsByType.behavioralTiming).toBe(2);
    });

    test('should maintain existing COPPA workflow', async () => {
      mockDbInstance.all.mockResolvedValue({
        results: [
          createLegacyConsentRecord({
            parental_consent_required: 1,
            parental_consent_given: 0,
          }),
        ],
      });

      const usersNeedingParentalConsent = await privacyRepo.findUsersNeedingParentalConsent(mockTenantId);

      expect(usersNeedingParentalConsent).toHaveLength(1);
      expect(usersNeedingParentalConsent[0].parentalConsentRequired).toBe(true);
      expect(usersNeedingParentalConsent[0].parentalConsentGiven).toBe(false);
    });
  });

  describe('Database Migration Compatibility', () => {
    test('should handle NULL values in new MCP fields gracefully', async () => {
      // Test that NULL values in new MCP columns are handled properly
      const consentWithNullMcpFields = {
        ...createLegacyConsentRecord(),
        external_ai_access_consent: null,
        mcp_client_scopes: null,
        real_time_revocation_enabled: null,
        external_client_restrictions: null,
      };

      mockDbInstance.first.mockResolvedValue(consentWithNullMcpFields);

      const consent = await privacyRepo.findByUserId(mockUserId, mockTenantId);

      expect(consent).toBeDefined();

      // Should handle NULL values with safe defaults
      expect(consent!.externalAiAccessConsent).toBe(false);
      expect(consent!.mcpClientScopes).toEqual([]);
      expect(consent!.realTimeRevocationEnabled).toBe(true);
      expect(consent!.externalClientRestrictions).toEqual({});
    });

    test('should insert new consent with all fields (Epic 7 + MCP)', async () => {
      const fullConsentData: Omit<LearnerDNAPrivacyConsent, 'id'> = {
        tenantId: mockTenantId,
        userId: mockUserId,
        consentVersion: '2.0',

        // Epic 7 fields
        behavioralTimingConsent: true,
        assessmentPatternsConsent: false,
        chatInteractionsConsent: true,
        crossCourseCorrelationConsent: false,
        anonymizedAnalyticsConsent: true,
        dataCollectionLevel: 'comprehensive',
        parentalConsentRequired: false,
        parentalConsentGiven: false,

        // MCP fields
        externalAiAccessConsent: true,
        mcpClientScopes: ['learner.profile.basic', 'learner.behavioral.velocity'],
        realTimeRevocationEnabled: true,
        externalClientRestrictions: { maxSessionDuration: 120 },

        // Metadata
        consentGivenAt: new Date(),
        consentUpdatedAt: new Date(),
        consentSource: 'api',
        ipAddress: '192.168.1.100',
        userAgent: 'TestClient/2.0',
      };

      const consent = await privacyRepo.create({
        id: crypto.randomUUID(),
        ...fullConsentData,
      });

      expect(consent.id).toBeDefined();
      expect(consent.externalAiAccessConsent).toBe(true);
      expect(consent.mcpClientScopes).toHaveLength(2);
      expect(consent.behavioralTimingConsent).toBe(true);
      expect(consent.dataCollectionLevel).toBe('comprehensive');

      // Verify database insertion includes all fields
      expect(mockDbInstance.prepare).toHaveBeenCalledWith(
        expect.stringContaining('external_ai_access_consent')
      );
      expect(mockDbInstance.prepare).toHaveBeenCalledWith(
        expect.stringContaining('behavioral_timing_consent')
      );
    });
  });

  describe('Epic 7 Privacy Impact Assessment Compatibility', () => {
    test('should generate privacy assessments including MCP considerations', async () => {
      const assessment = await privacyService.generatePrivacyImpactAssessment(
        mockTenantId,
        'comprehensive_data_collection_with_mcp',
        'comprehensive'
      );

      expect(assessment.id).toBeDefined();
      expect(assessment.assessmentName).toBe('comprehensive_data_collection_with_mcp');
      expect(assessment.dataSensitivityScore).toBe(0.8); // Should match Epic 7 scoring
      expect(assessment.complianceFrameworks).toContain('FERPA');
      expect(assessment.complianceFrameworks).toContain('COPPA');
      expect(assessment.complianceFrameworks).toContain('GDPR');

      // Verify database insertion
      expect(mockDbInstance.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO privacy_impact_assessments'),
        expect.any(Array)
      );
    });
  });

  describe('Epic 7 Compliance Validation Compatibility', () => {
    test('should validate FERPA compliance with MCP extensions', async () => {
      // Mock database to show profiles without consent
      mockDbInstance.get
        .mockResolvedValueOnce({ count: 2 }) // FERPA violations
        .mockResolvedValueOnce({ count: 0 }) // COPPA violations
        .mockResolvedValueOnce({ count: 0 }); // GDPR violations

      const complianceResult = await privacyService.enforceComplianceValidation(mockTenantId);

      expect(complianceResult.ferpaCompliant).toBe(false);
      expect(complianceResult.coppaCompliant).toBe(true);
      expect(complianceResult.gdprCompliant).toBe(true);
      expect(complianceResult.violations).toHaveLength(1);
      expect(complianceResult.remediationActions).toContain('Review and update privacy policies');
    });
  });

  // Helper function to create legacy consent records (Epic 7 format)
  function createLegacyConsentRecord(overrides: Record<string, any> = {}): any {
    return {
      id: 'legacy-consent-123',
      tenant_id: mockTenantId,
      user_id: mockUserId,
      consent_version: '1.0',
      behavioral_timing_consent: 0,
      assessment_patterns_consent: 0,
      chat_interactions_consent: 0,
      cross_course_correlation_consent: 0,
      anonymized_analytics_consent: 1,
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
      // MCP fields should be NULL for legacy records
      external_ai_access_consent: null,
      mcp_client_scopes: null,
      real_time_revocation_enabled: null,
      external_client_restrictions: null,
      ...overrides,
    };
  }
});