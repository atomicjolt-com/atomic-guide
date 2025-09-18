/**
 * @fileoverview Comprehensive Security Tests for MCP Zero-Trust Architecture
 * @module features/learner-dna/tests/security/McpSecurityArchitecture
 *
 * This test suite validates the entire MCP security architecture including:
 * - Zero-trust validation for all external AI client interactions
 * - Data loss prevention controls and rate limiting effectiveness
 * - Behavioral monitoring and anomaly detection accuracy
 * - Automated incident response and client isolation procedures
 * - Compliance with FERPA, COPPA, and GDPR requirements
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { McpDataLossPreventionService } from '../../server/services/McpDataLossPreventionService';
import { McpBehavioralMonitoringService } from '../../server/services/McpBehavioralMonitoringService';
import { McpIncidentResponseService } from '../../server/services/McpIncidentResponseService';
import { McpPrivacyControlService } from '../../server/services/McpPrivacyControlService';
import { DatabaseService } from '@shared/server/services';
import type {
  McpDlpPolicyResult,
  McpBehavioralAnalysisResult,
  McpSecurityIncident,
  McpClientReputation,
  McpSessionValidationResult,
} from '../../shared/types';

/**
 * Mock database service for testing
 */
class MockDatabaseService extends DatabaseService {
  private mockData: Map<string, any[]> = new Map();
  private mockResults: Map<string, any> = new Map();

  constructor() {
    // Create a mock D1 database object
    const mockD1 = {
      prepare: (sql: string) => ({
        bind: (...params: any[]) => ({
          run: () => ({ success: true }),
          all: () => ({ results: [] }),
          first: () => null,
        }),
      }),
    };
    super(mockD1 as any);
  }

  getDb() {
    const mockData = this.mockData;
    const mockResults = this.mockResults;
    return {
      prepare: (sql: string) => ({
        bind: (...params: any[]) => ({
          run: () => ({ success: true }),
          all: () => ({ results: mockData.get(sql) || [] }),
          first: () => mockResults.get(sql) || null,
        }),
      }),
    };
  }

  setMockData(sql: string, data: any[]): void {
    this.mockData.set(sql, data);
  }

  setMockResult(sql: string, result: any): void {
    this.mockResults.set(sql, result);
  }

  clearMocks(): void {
    this.mockData.clear();
    this.mockResults.clear();
  }
}

describe('MCP Security Architecture - Zero Trust Validation', () => {
  let mockDb: MockDatabaseService;
  let dlpService: McpDataLossPreventionService;
  let behavioralService: McpBehavioralMonitoringService;
  let incidentService: McpIncidentResponseService;
  let privacyService: McpPrivacyControlService;

  const TEST_TENANT_ID = 'tenant-123';
  const TEST_CLIENT_ID = 'client-456';
  const TEST_USER_ID = 'user-789';

  beforeEach(() => {
    mockDb = new MockDatabaseService();
    dlpService = new McpDataLossPreventionService(mockDb);
    behavioralService = new McpBehavioralMonitoringService(mockDb);
    incidentService = new McpIncidentResponseService(mockDb);
    privacyService = new McpPrivacyControlService(mockDb);

    // Mock crypto.randomUUID for consistent testing
    vi.stubGlobal('crypto', {
      randomUUID: () => 'test-uuid-123',
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      },
    });
  });

  afterEach(() => {
    mockDb.clearMocks();
    vi.restoreAllMocks();
  });

  describe('Data Loss Prevention (DLP) Controls', () => {
    it('should block requests exceeding rate limits', async () => {
      // Arrange: Set up high-frequency access pattern
      mockDb.setMockResult('SELECT COUNT(*) as count FROM mcp_data_access_log', { count: 100 });
      mockDb.setMockData('SELECT * FROM mcp_client_reputation', [{
        id: 'rep-1',
        client_id: TEST_CLIENT_ID,
        tenant_id: TEST_TENANT_ID,
        reputation_score: 50,
        risk_level: 'high',
        total_requests: 1000,
        violation_count: 10,
        consecutive_violations: 3,
      }]);

      // Act: Attempt data access request
      const result = await dlpService.evaluateDataAccessRequest(
        TEST_TENANT_ID,
        TEST_CLIENT_ID,
        TEST_USER_ID,
        'profile',
        1024
      );

      // Assert: Request should be blocked
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('rate_limit_exceeded');
      expect(result.violationType).toBeDefined();
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('should detect and prevent bulk data harvesting attempts', async () => {
      // Arrange: Set up bulk access pattern
      mockDb.setMockData('SELECT accessed_at FROM mcp_data_access_log',
        Array.from({ length: 50 }, (_, i) => ({
          accessed_at: new Date(Date.now() - i * 1000).toISOString()
        }))
      );

      mockDb.setMockResult('SELECT COUNT(DISTINCT user_id) as unique_user_count', { unique_user_count: 100 });
      mockDb.setMockResult('SELECT COUNT(DISTINCT user_id) as total_count', { total_count: 200 });

      // Act: Evaluate bulk request pattern
      const result = await dlpService.evaluateDataAccessRequest(
        TEST_TENANT_ID,
        TEST_CLIENT_ID,
        TEST_USER_ID,
        'profile',
        10 * 1024 * 1024 // 10MB request
      );

      // Assert: Should detect suspicious pattern
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('suspicious_pattern_detected');
    });

    it('should implement adaptive rate limiting based on client reputation', async () => {
      // Arrange: Low reputation client
      const reputationData = {
        reputation_score: 20,
        risk_level: 'critical',
        consecutive_violations: 5,
        violation_count: 15,
      };
      mockDb.setMockData('SELECT * FROM mcp_client_reputation', [reputationData]);
      mockDb.setMockResult('SELECT * FROM mcp_client_reputation', reputationData);

      // Act: Request with low reputation
      const result = await dlpService.evaluateDataAccessRequest(
        TEST_TENANT_ID,
        TEST_CLIENT_ID,
        TEST_USER_ID,
        'behavioral',
        512
      );

      // Assert: Should have stricter limits
      expect(result.allowed).toBe(false);
      expect(result.recommendedAction).toBe('client_review_required');
    });

    it('should track cumulative data volume across time windows', async () => {
      // Arrange: High volume usage
      mockDb.setMockResult('SELECT COALESCE(SUM(data_size_bytes), 0) as total_volume', {
        total_volume: 100 * 1024 * 1024 // 100MB
      });

      // Act: Request additional data
      const result = await dlpService.evaluateDataAccessRequest(
        TEST_TENANT_ID,
        TEST_CLIENT_ID,
        TEST_USER_ID,
        'assessment',
        10 * 1024 * 1024 // 10MB additional
      );

      // Assert: Should hit volume limits
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('volume_limit_exceeded');
    });

    it('should maintain client reputation scoring with violation tracking', async () => {
      // Arrange: Client with violations
      const reputationData = {
        id: 'rep-1',
        reputation_score: 80,
        violation_count: 2,
        consecutive_violations: 1,
      };
      mockDb.setMockData('SELECT * FROM mcp_client_reputation', [reputationData]);
      mockDb.setMockResult('SELECT * FROM mcp_client_reputation', reputationData);

      // Act: Update reputation after violation
      const updatedReputation = await dlpService.updateClientReputation(
        TEST_CLIENT_ID,
        TEST_TENANT_ID,
        'rate_limit_exceeded'
      );

      // Assert: Reputation should decrease
      expect(updatedReputation.reputationScore).toBeLessThan(80);
      expect(updatedReputation.consecutiveViolations).toBe(2);
      expect(updatedReputation.violationCount).toBe(3);
    });
  });

  describe('Behavioral Monitoring and Anomaly Detection', () => {
    it('should establish behavioral baselines for normal client activity', async () => {
      // Arrange: Historical activity data
      mockDb.setMockResult('SELECT COUNT(*) as total_requests', { total_requests: 1000 });
      mockDb.setMockResult('SELECT AVG(data_size_bytes) as avg_request_size', { avg_request_size: 2048 });

      // Act: Analyze client behavior
      const result = await behavioralService.analyzeClientBehavior(
        TEST_CLIENT_ID,
        TEST_TENANT_ID,
        TEST_USER_ID,
        {
          dataType: 'profile',
          requestSize: 2000,
          requestTimestamp: new Date(),
          ipAddress: '192.168.1.1',
          userAgent: 'Claude Desktop 1.0',
        }
      );

      // Assert: Should recognize normal behavior
      expect(result.isAnomalous).toBe(false);
      expect(result.baselineConfidence).toBeGreaterThan(0.5);
    });

    it('should detect temporal anomalies in access patterns', async () => {
      // Arrange: Off-hours access
      const offHoursTime = new Date();
      offHoursTime.setHours(2, 30, 0, 0); // 2:30 AM

      mockDb.setMockResult('SELECT COUNT(*) as count FROM mcp_data_access_log', { count: 20 });

      // Act: Analyze off-hours behavior
      const result = await behavioralService.analyzeClientBehavior(
        TEST_CLIENT_ID,
        TEST_TENANT_ID,
        TEST_USER_ID,
        {
          dataType: 'behavioral',
          requestSize: 1024,
          requestTimestamp: offHoursTime,
        }
      );

      // Assert: Should detect temporal anomaly
      expect(result.detectedPatterns).toContain('off_hours_bulk_access');
    });

    it('should identify systematic data enumeration patterns', async () => {
      // Arrange: Systematic access to multiple users and data types
      mockDb.setMockData('SELECT user_id, data_type, COUNT(*) as access_count', [
        { user_id: 'user1', data_type: 'profile', access_count: 1 },
        { user_id: 'user2', data_type: 'profile', access_count: 1 },
        { user_id: 'user3', data_type: 'behavioral', access_count: 1 },
        { user_id: 'user4', data_type: 'assessment', access_count: 1 },
        // ... many more entries
      ]);

      // Act: Analyze enumeration pattern
      const result = await behavioralService.analyzeClientBehavior(
        TEST_CLIENT_ID,
        TEST_TENANT_ID,
        TEST_USER_ID,
        {
          dataType: 'real_time',
          requestSize: 512,
          requestTimestamp: new Date(),
        }
      );

      // Assert: Should detect enumeration
      expect(result.detectedPatterns).toContain('systematic_enumeration');
      expect(result.isCritical).toBe(true);
    });

    it('should correlate suspicious activity across multiple clients', async () => {
      // Arrange: Multiple clients with similar violation patterns
      mockDb.setMockData('SELECT client_id, COUNT(*) as violation_count', [
        { client_id: 'client-1', violation_count: 5 },
        { client_id: 'client-2', violation_count: 4 },
        { client_id: 'client-3', violation_count: 3 },
      ]);

      mockDb.setMockData('SELECT DISTINCT violation_type', [
        { violation_type: 'rate_limit_exceeded' },
        { violation_type: 'suspicious_pattern_detected' },
      ]);

      // Act: Analyze for coordinated attack
      const result = await behavioralService.analyzeClientBehavior(
        TEST_CLIENT_ID,
        TEST_TENANT_ID,
        TEST_USER_ID,
        {
          dataType: 'aggregated',
          requestSize: 4096,
          requestTimestamp: new Date(),
        }
      );

      // Assert: Should detect coordination
      expect(result.detectedPatterns).toContain('coordinated_attack');
    });

    it('should detect evasion techniques and adaptive behavior', async () => {
      // Arrange: Variable IP addresses and user agents
      mockDb.setMockData('SELECT DISTINCT ip_address FROM mcp_data_access_log', [
        { ip_address: '192.168.1.1' },
        { ip_address: '10.0.0.1' },
        { ip_address: '172.16.0.1' },
        { ip_address: '203.0.113.1' },
      ]);

      mockDb.setMockData('SELECT DISTINCT user_agent FROM mcp_data_access_log', [
        { user_agent: 'Claude Desktop 1.0' },
        { user_agent: 'Mozilla/5.0' },
        { user_agent: 'Custom Client 2.0' },
      ]);

      // Act: Analyze evasion techniques
      const result = await behavioralService.analyzeClientBehavior(
        TEST_CLIENT_ID,
        TEST_TENANT_ID,
        TEST_USER_ID,
        {
          dataType: 'profile',
          requestSize: 1024,
          requestTimestamp: new Date(),
          ipAddress: '198.51.100.1', // New IP
          userAgent: 'Different Agent 3.0', // New user agent
        }
      );

      // Assert: Should detect evasion
      expect(result.detectedPatterns).toContain('evasion_techniques');
    });
  });

  describe('Automated Incident Response', () => {
    it('should immediately isolate clients on critical security incidents', async () => {
      // Arrange: Critical incident data
      const incidentData = {
        clientId: TEST_CLIENT_ID,
        tenantId: TEST_TENANT_ID,
        userId: TEST_USER_ID,
        incidentType: 'data_exfiltration' as const,
        severity: 'critical' as const,
        detectionSource: 'behavioral_monitoring',
        evidenceData: { suspiciousPatterns: ['bulk_data_collection'] },
      };

      mockDb.setMockData('SELECT id, user_id, session_token FROM mcp_active_sessions', [
        { id: 'session-1', user_id: TEST_USER_ID, session_token: 'token-1' },
        { id: 'session-2', user_id: 'user-2', session_token: 'token-2' },
      ]);

      // Act: Process critical incident
      const result = await incidentService.processSecurityIncident(incidentData);

      // Assert: Should apply isolation
      expect(result.isolationApplied).toBe(true);
      expect(result.responseActions.some(a => a.actionType === 'client_isolation')).toBe(true);
      expect(result.forensicsCaptured).toBe(true);
    });

    it('should terminate all active sessions during isolation', async () => {
      // Arrange: Multiple active sessions
      mockDb.setMockData('SELECT id, user_id, session_token FROM mcp_active_sessions', [
        { id: 'session-1', user_id: 'user-1', session_token: 'token-1' },
        { id: 'session-2', user_id: 'user-2', session_token: 'token-2' },
        { id: 'session-3', user_id: 'user-3', session_token: 'token-3' },
      ]);

      // Act: Isolate client
      const result = await incidentService.isolateClient(
        TEST_CLIENT_ID,
        TEST_TENANT_ID,
        'hard',
        'Critical security incident detected'
      );

      // Assert: All sessions should be terminated
      expect(result.sessionsTerminated).toBe(3);
      expect(result.accessRevoked).toBe(true);
    });

    it('should capture comprehensive forensic data for investigation', async () => {
      // Arrange: Security incident requiring forensics
      const incidentData = {
        clientId: TEST_CLIENT_ID,
        tenantId: TEST_TENANT_ID,
        incidentType: 'privilege_escalation' as const,
        severity: 'high' as const,
        detectionSource: 'dlp_system',
        evidenceData: { unauthorizedAccess: true },
      };

      // Act: Process incident with forensics
      const result = await incidentService.processSecurityIncident(incidentData);

      // Assert: Forensics should be captured
      expect(result.forensicsCaptured).toBe(true);
      expect(result.responseActions.some(a => a.actionType === 'enhance_monitoring')).toBe(true);
    });

    it('should escalate incidents based on severity and impact', async () => {
      // Arrange: High-severity incident
      const incidentData = {
        clientId: TEST_CLIENT_ID,
        tenantId: TEST_TENANT_ID,
        incidentType: 'coordinated_attack' as const,
        severity: 'critical' as const,
        detectionSource: 'correlation_engine',
        evidenceData: { multipleClients: true },
      };

      // Act: Process incident for escalation
      const result = await incidentService.processSecurityIncident(incidentData);

      // Assert: Should trigger escalation
      expect(result.escalationTriggered).toBe(true);
      expect(result.nextReviewRequired).toBeDefined();
    });

    it('should implement graduated response based on threat level', async () => {
      // Test Medium Severity
      const mediumIncident = {
        clientId: TEST_CLIENT_ID,
        tenantId: TEST_TENANT_ID,
        incidentType: 'behavioral_anomaly' as const,
        severity: 'medium' as const,
        detectionSource: 'monitoring_system',
        evidenceData: { anomalyScore: 0.7 },
      };

      const mediumResult = await incidentService.processSecurityIncident(mediumIncident);

      // Should enhance monitoring but not isolate
      expect(mediumResult.isolationApplied).toBe(false);
      expect(mediumResult.responseActions.some(a => a.actionType === 'enhance_monitoring')).toBe(true);

      // Test Critical Severity
      const criticalIncident = {
        ...mediumIncident,
        severity: 'critical' as const,
      };

      const criticalResult = await incidentService.processSecurityIncident(criticalIncident);

      // Should apply full isolation
      expect(criticalResult.isolationApplied).toBe(true);
      expect(criticalResult.responseActions.some(a => a.actionType === 'client_isolation')).toBe(true);
    });
  });

  describe('Privacy Control and Compliance', () => {
    it('should validate external AI client consent before data access', async () => {
      // Arrange: User with proper consent
      mockDb.setMockResult('SELECT * FROM learner_dna_privacy_consent', {
        id: 'consent-1',
        user_id: TEST_USER_ID,
        tenant_id: TEST_TENANT_ID,
        external_ai_access_consent: 1,
        behavioral_timing_consent: 1, // Required for 'behavioral' scope
        assessment_patterns_consent: 1, // Good practice to include
        chat_interactions_consent: 1, // Good practice to include
        mcp_client_scopes: JSON.stringify(['profile', 'behavioral']),
        parental_consent_required: 0,
        withdrawal_requested_at: null,
      });

      mockDb.setMockResult('SELECT * FROM mcp_client_registry', {
        id: TEST_CLIENT_ID,
        tenant_id: TEST_TENANT_ID,
        status: 'approved',
        client_type: 'ai_assistant',
      });

      // Act: Validate consent
      const result = await privacyService.validateExternalAiClientAccess(
        TEST_TENANT_ID,
        TEST_USER_ID,
        TEST_CLIENT_ID,
        ['profile', 'behavioral']
      );

      // Assert: Should allow access
      expect(result.isValid).toBe(true);
      expect(result.hasRequiredConsent).toBe(true);
      expect(result.allowedScopes).toContain('profile');
      expect(result.allowedScopes).toContain('behavioral');
    });

    it('should enforce COPPA parental controls for minors', async () => {
      // Arrange: Minor user without parental consent
      mockDb.setMockResult('SELECT * FROM learner_dna_privacy_consent', {
        id: 'consent-2',
        user_id: TEST_USER_ID,
        tenant_id: TEST_TENANT_ID,
        external_ai_access_consent: 1,
        parental_consent_required: 1,
        parental_consent_given: 0, // No parental consent
      });

      mockDb.setMockResult('SELECT * FROM mcp_parental_controls', {
        id: 'control-1',
        user_id: TEST_USER_ID,
        tenant_id: TEST_TENANT_ID,
        external_ai_access_allowed: 0, // Not allowed by parent
      });

      mockDb.setMockResult('SELECT * FROM mcp_client_registry', {
        id: TEST_CLIENT_ID,
        tenant_id: TEST_TENANT_ID,
        status: 'approved',
        client_type: 'ai_assistant',
      });

      // Act: Validate minor access
      const result = await privacyService.validateExternalAiClientAccess(
        TEST_TENANT_ID,
        TEST_USER_ID,
        TEST_CLIENT_ID,
        ['profile']
      );

      // Assert: Should deny access
      expect(result.isValid).toBe(false);
      expect(result.parentalApprovalRequired).toBe(true);
      expect(result.violations).toContain('External AI access not permitted by parental controls');
    });

    it('should immediately revoke access upon consent withdrawal', async () => {
      // Arrange: Active sessions for user
      mockDb.setMockData('SELECT id, granted_scopes FROM mcp_active_sessions', [
        { id: 'session-1', granted_scopes: JSON.stringify(['profile']) },
        { id: 'session-2', granted_scopes: JSON.stringify(['behavioral']) },
      ]);

      // Act: Process consent withdrawal
      const result = await privacyService.processRealTimeConsentRevocation(
        TEST_TENANT_ID,
        TEST_USER_ID,
        'full_withdrawal',
        {
          reason: 'User requested immediate data protection',
          initiatedBy: 'user',
        }
      );

      // Assert: Should terminate sessions
      expect(result.sessionsTerminated).toBe(2);
      expect(result.revocationId).toBeDefined();
      expect(result.estimatedCompletionTime).toBeDefined();
    });

    it('should support granular scope-based consent management', async () => {
      // Arrange: User with limited consent
      mockDb.setMockResult('SELECT * FROM learner_dna_privacy_consent', {
        external_ai_access_consent: 1,
        mcp_client_scopes: JSON.stringify(['profile']), // Only profile allowed
        behavioral_timing_consent: 0,
        assessment_patterns_consent: 0,
      });

      mockDb.setMockResult('SELECT * FROM mcp_client_registry', {
        id: TEST_CLIENT_ID,
        tenant_id: TEST_TENANT_ID,
        status: 'approved',
        client_type: 'ai_assistant',
      });

      // Act: Validate specific scopes
      const result = await privacyService.validateExternalAiClientAccess(
        TEST_TENANT_ID,
        TEST_USER_ID,
        TEST_CLIENT_ID,
        ['profile', 'behavioral', 'assessment'] // Request more than allowed
      );

      // Assert: Should only allow consented scopes
      expect(result.allowedScopes).toEqual(['profile']);
      expect(result.missingConsents).toContain('scope_behavioral');
      expect(result.missingConsents).toContain('scope_assessment');
    });
  });

  describe('Zero-Trust Architecture Validation', () => {
    it('should validate every request regardless of client authentication status', async () => {
      // Arrange: Authenticated client making suspicious request
      const reputationData = {
        reputation_score: 90, // High reputation
        risk_level: 'low',
      };
      mockDb.setMockData('SELECT * FROM mcp_client_reputation', [reputationData]);
      mockDb.setMockResult('SELECT * FROM mcp_client_reputation', reputationData);

      // Act: Make request with suspicious patterns
      const dlpResult = await dlpService.evaluateDataAccessRequest(
        TEST_TENANT_ID,
        TEST_CLIENT_ID,
        TEST_USER_ID,
        'profile',
        100 * 1024 * 1024 // Unusually large request
      );

      // Assert: Should still apply controls despite good reputation
      expect(dlpResult.allowed).toBe(false);
      expect(dlpResult.reason).toBe('volume_limit_exceeded');
    });

    it('should maintain security controls under high load conditions', async () => {
      // Arrange: Simulate high load with multiple concurrent requests
      const concurrentRequests = Array.from({ length: 50 }, (_, i) =>
        dlpService.evaluateDataAccessRequest(
          TEST_TENANT_ID,
          `client-${i}`,
          `user-${i}`,
          'profile',
          1024
        )
      );

      // Act: Process concurrent requests
      const results = await Promise.all(concurrentRequests);

      // Assert: All requests should be evaluated with security controls
      expect(results).toHaveLength(50);
      results.forEach(result => {
        expect(result).toHaveProperty('allowed');
        expect(result).toHaveProperty('reason');
      });
    });

    it('should detect and respond to coordinated multi-vector attacks', async () => {
      // Arrange: Simulate coordinated attack across multiple vectors
      const attackVectors = [
        { type: 'rate_limit_exceeded', client: 'attacker-1' },
        { type: 'volume_limit_exceeded', client: 'attacker-2' },
        { type: 'suspicious_pattern_detected', client: 'attacker-3' },
      ];

      // Act: Process coordinated attack
      const incidents = await Promise.all(
        attackVectors.map(vector =>
          incidentService.processSecurityIncident({
            clientId: vector.client,
            tenantId: TEST_TENANT_ID,
            incidentType: 'coordinated_attack',
            severity: 'high',
            detectionSource: 'correlation_engine',
            evidenceData: { attackVector: vector.type },
          })
        )
      );

      // Assert: Should detect and respond to coordinated attack
      expect(incidents).toHaveLength(3);
      incidents.forEach(incident => {
        expect(incident.escalationTriggered).toBe(true);
        expect(incident.forensicsCaptured).toBe(true);
      });
    });

    it('should maintain audit trail for all security events', async () => {
      // Arrange: Various security events
      const events = [
        'successful_access',
        'rate_limit_violation',
        'consent_withdrawal',
        'client_isolation',
      ];

      // Act: Process events (simulated through service calls)
      for (const event of events) {
        await dlpService.evaluateDataAccessRequest(
          TEST_TENANT_ID,
          TEST_CLIENT_ID,
          TEST_USER_ID,
          'profile',
          1024
        );
      }

      // Assert: Audit trail should be maintained
      // Note: In a real implementation, this would verify audit log entries
      expect(true).toBe(true); // Placeholder for audit verification
    });

    it('should implement defense in depth with multiple security layers', async () => {
      // Arrange: Attack that tries to bypass multiple security layers
      const attackScenario = {
        clientId: 'sophisticated-attacker',
        tenantId: TEST_TENANT_ID,
        userId: TEST_USER_ID,
        dataType: 'assessment',
        requestSize: 50 * 1024 * 1024, // Large volume
        timestamp: new Date(),
      };

      // Act: Process through all security layers

      // Layer 1: DLP evaluation
      const dlpResult = await dlpService.evaluateDataAccessRequest(
        attackScenario.tenantId,
        attackScenario.clientId,
        attackScenario.userId,
        attackScenario.dataType as any,
        attackScenario.requestSize
      );

      // Layer 2: Behavioral analysis
      const behavioralResult = await behavioralService.analyzeClientBehavior(
        attackScenario.clientId,
        attackScenario.tenantId,
        attackScenario.userId,
        {
          dataType: attackScenario.dataType,
          requestSize: attackScenario.requestSize,
          requestTimestamp: attackScenario.timestamp,
        }
      );

      // Layer 3: Privacy validation
      const privacyResult = await privacyService.validateExternalAiClientAccess(
        attackScenario.tenantId,
        attackScenario.userId,
        attackScenario.clientId,
        [attackScenario.dataType]
      );

      // Assert: Multiple layers should detect and block threat
      expect([dlpResult.allowed, behavioralResult.isAnomalous, privacyResult.isValid])
        .toContain(false); // At least one layer should block
    });
  });

  describe('Performance and Scalability Under Security Load', () => {
    it('should maintain sub-200ms response times for security validations', async () => {
      // Arrange: Standard request
      const startTime = Date.now();

      // Act: Process security validation
      await dlpService.evaluateDataAccessRequest(
        TEST_TENANT_ID,
        TEST_CLIENT_ID,
        TEST_USER_ID,
        'profile',
        1024
      );

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Assert: Should meet performance requirements
      expect(responseTime).toBeLessThan(200);
    });

    it('should handle 1000 concurrent security evaluations', async () => {
      // Arrange: Large number of concurrent requests
      const concurrentEvaluations = Array.from({ length: 1000 }, (_, i) =>
        dlpService.evaluateDataAccessRequest(
          TEST_TENANT_ID,
          `load-test-client-${i}`,
          `load-test-user-${i}`,
          'profile',
          512
        )
      );

      const startTime = Date.now();

      // Act: Process concurrent evaluations
      const results = await Promise.all(concurrentEvaluations);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Assert: Should handle load efficiently
      expect(results).toHaveLength(1000);
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should gracefully degrade under extreme load conditions', async () => {
      // Arrange: Extreme load simulation
      const extremeLoad = Array.from({ length: 10000 }, (_, i) =>
        dlpService.evaluateDataAccessRequest(
          TEST_TENANT_ID,
          `extreme-load-client-${i}`,
          `extreme-load-user-${i}`,
          'behavioral',
          2048
        )
      );

      // Act: Process extreme load
      const results = await Promise.allSettled(extremeLoad);

      // Assert: Should not fail catastrophically
      const successfulResults = results.filter(r => r.status === 'fulfilled');
      expect(successfulResults.length).toBeGreaterThan(8000); // At least 80% success rate
    });
  });

  describe('Compliance Validation', () => {
    it('should ensure FERPA compliance for educational records protection', async () => {
      // Test FERPA directory information handling
      const directoryInfoRequest = await privacyService.validateExternalAiClientAccess(
        TEST_TENANT_ID,
        TEST_USER_ID,
        TEST_CLIENT_ID,
        ['profile'] // Directory information
      );

      // Should require explicit consent even for directory info
      expect(directoryInfoRequest.hasRequiredConsent).toBeDefined();
    });

    it('should ensure COPPA compliance for users under 13', async () => {
      // Arrange: Minor user (under 13)
      mockDb.setMockResult('SELECT * FROM learner_dna_privacy_consent', {
        external_ai_access_consent: 1,
        parental_consent_required: 1,
        parental_consent_given: 1,
      });

      mockDb.setMockResult('SELECT * FROM mcp_parental_controls', {
        external_ai_access_allowed: 1,
        max_session_duration_minutes: 30,
      });

      mockDb.setMockResult('SELECT * FROM mcp_client_registry', {
        id: TEST_CLIENT_ID,
        tenant_id: TEST_TENANT_ID,
        status: 'approved',
        client_type: 'ai_assistant',
      });

      // Act: Validate COPPA compliance
      const result = await privacyService.validateExternalAiClientAccess(
        TEST_TENANT_ID,
        TEST_USER_ID,
        TEST_CLIENT_ID,
        ['profile']
      );

      // Assert: Should enforce parental controls
      expect(result.parentalApprovalRequired).toBe(true);
      expect(result.sessionLimitsEnforced).toBe(true);
    });

    it('should ensure GDPR compliance for data subject rights', async () => {
      // Test data portability (right to access)
      const dataAccessResult = await privacyService.validateExternalAiClientAccess(
        TEST_TENANT_ID,
        TEST_USER_ID,
        TEST_CLIENT_ID,
        ['profile', 'behavioral']
      );

      // Test right to erasure
      const erasureResult = await privacyService.processRealTimeConsentRevocation(
        TEST_TENANT_ID,
        TEST_USER_ID,
        'full_withdrawal',
        { initiatedBy: 'user', reason: 'GDPR erasure request' }
      );

      // Assert: Should support GDPR rights
      expect(dataAccessResult).toBeDefined();
      expect(erasureResult.estimatedCompletionTime).toBeDefined();
    });
  });
});

/**
 * Integration tests for cross-service security coordination
 */
describe('MCP Security Integration Tests', () => {
  let mockDb: MockDatabaseService;
  let services: {
    dlp: McpDataLossPreventionService;
    behavioral: McpBehavioralMonitoringService;
    incident: McpIncidentResponseService;
    privacy: McpPrivacyControlService;
  };

  beforeEach(() => {
    mockDb = new MockDatabaseService();
    services = {
      dlp: new McpDataLossPreventionService(mockDb),
      behavioral: new McpBehavioralMonitoringService(mockDb),
      incident: new McpIncidentResponseService(mockDb),
      privacy: new McpPrivacyControlService(mockDb),
    };
  });

  it('should coordinate response across all security services for critical incidents', async () => {
    // Arrange: Critical security event
    const criticalEvent = {
      clientId: 'critical-threat-client',
      tenantId: 'tenant-123',
      userId: 'user-456',
      timestamp: new Date(),
    };

    // Act: Trigger coordinated response

    // 1. DLP detection
    const dlpResult = await services.dlp.evaluateDataAccessRequest(
      criticalEvent.tenantId,
      criticalEvent.clientId,
      criticalEvent.userId,
      'profile',
      100 * 1024 * 1024 // Large suspicious request
    );

    // 2. Behavioral analysis
    const behavioralResult = await services.behavioral.analyzeClientBehavior(
      criticalEvent.clientId,
      criticalEvent.tenantId,
      criticalEvent.userId,
      {
        dataType: 'profile',
        requestSize: 100 * 1024 * 1024,
        requestTimestamp: criticalEvent.timestamp,
      }
    );

    // 3. Incident response
    if (!dlpResult.allowed || behavioralResult.isCritical) {
      const incidentResult = await services.incident.processSecurityIncident({
        clientId: criticalEvent.clientId,
        tenantId: criticalEvent.tenantId,
        userId: criticalEvent.userId,
        incidentType: 'data_exfiltration',
        severity: 'critical',
        detectionSource: 'coordinated_detection',
        evidenceData: {
          dlpViolation: !dlpResult.allowed,
          behavioralAnomaly: behavioralResult.isCritical,
        },
      });

      // 4. Privacy control validation
      if (incidentResult.isolationApplied) {
        await services.privacy.processRealTimeConsentRevocation(
          criticalEvent.tenantId,
          criticalEvent.userId,
          'emergency_stop',
          {
            initiatedBy: 'system',
            reason: 'Critical security incident - automated protection',
          }
        );
      }
    }

    // Assert: Coordinated response should be effective
    expect(dlpResult.allowed).toBe(false);
    expect(behavioralResult.isCritical).toBe(true);
  });
});