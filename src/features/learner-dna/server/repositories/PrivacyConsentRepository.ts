/**
 * @fileoverview Repository for privacy consent data access operations.
 * @module features/learner-dna/server/repositories/PrivacyConsentRepository
 */

import { BaseRepository } from '@shared/server/repositories/BaseRepository';
import { DatabaseService } from '@shared/server/services/database';
import { learnerDnaPrivacyConsentSchema } from '../../shared/schemas/learner-dna.schema';
import type { LearnerDNAPrivacyConsent, PrivacyConsentUpdate } from '../../shared/types';

/**
 * Repository for privacy consent data access operations.
 * 
 * Handles all database operations for privacy consent records following the established
 * repository pattern. Privacy consent is critical for GDPR/COPPA compliance and must
 * maintain complete audit trails and support granular consent management.
 */
export class PrivacyConsentRepository extends BaseRepository<LearnerDNAPrivacyConsent> {
  constructor(databaseService: DatabaseService) {
    super(databaseService, 'learner_dna_privacy_consent', learnerDnaPrivacyConsentSchema);
  }

  /**
   * Override findById to handle legacy records that may not pass current schema validation
   */
  async findById(id: string): Promise<LearnerDNAPrivacyConsent | null> {
    const result = await this.getDb()
      .prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`)
      .bind(id)
      .first();

    if (!result) return null;

    // Use our custom mapper instead of base validation for backward compatibility
    return this.mapDbRowToEntity(result);
  }

  protected async performCreate(consent: LearnerDNAPrivacyConsent): Promise<LearnerDNAPrivacyConsent> {
    await this.getDb()
      .prepare(`
        INSERT INTO learner_dna_privacy_consent (
          id, tenant_id, user_id, consent_version,
          behavioral_timing_consent, assessment_patterns_consent, chat_interactions_consent,
          cross_course_correlation_consent, anonymized_analytics_consent,
          external_ai_access_consent, mcp_client_scopes, real_time_revocation_enabled,
          external_client_restrictions, data_collection_level,
          parental_consent_required, parental_consent_given, parental_email,
          consent_given_at, consent_updated_at, withdrawal_requested_at, withdrawal_reason,
          consent_source, ip_address, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        consent.id,
        consent.tenantId,
        consent.userId,
        consent.consentVersion,
        consent.behavioralTimingConsent ? 1 : 0,
        consent.assessmentPatternsConsent ? 1 : 0,
        consent.chatInteractionsConsent ? 1 : 0,
        consent.crossCourseCorrelationConsent ? 1 : 0,
        consent.anonymizedAnalyticsConsent ? 1 : 0,
        consent.externalAiAccessConsent ? 1 : 0,
        JSON.stringify(consent.mcpClientScopes),
        consent.realTimeRevocationEnabled ? 1 : 0,
        JSON.stringify(consent.externalClientRestrictions),
        consent.dataCollectionLevel,
        consent.parentalConsentRequired ? 1 : 0,
        consent.parentalConsentGiven ? 1 : 0,
        consent.parentalEmail || null,
        consent.consentGivenAt.toISOString(),
        consent.consentUpdatedAt.toISOString(),
        consent.withdrawalRequestedAt?.toISOString() || null,
        consent.withdrawalReason || null,
        consent.consentSource,
        consent.ipAddress || null,
        consent.userAgent || null
      )
      .run();

    return consent;
  }

  protected async performUpdate(id: string, updates: Partial<LearnerDNAPrivacyConsent>): Promise<LearnerDNAPrivacyConsent> {
    // Build dynamic update query based on provided fields
    const updateFields: string[] = [];
    const values: unknown[] = [];
    
    const fieldMappings: Record<string, (value: any) => any> = {
      behavioralTimingConsent: (v) => v ? 1 : 0,
      assessmentPatternsConsent: (v) => v ? 1 : 0,
      chatInteractionsConsent: (v) => v ? 1 : 0,
      crossCourseCorrelationConsent: (v) => v ? 1 : 0,
      anonymizedAnalyticsConsent: (v) => v ? 1 : 0,
      externalAiAccessConsent: (v) => v ? 1 : 0,
      mcpClientScopes: (v) => JSON.stringify(v || []),
      realTimeRevocationEnabled: (v) => v ? 1 : 0,
      externalClientRestrictions: (v) => JSON.stringify(v || {}),
      dataCollectionLevel: (v) => v,
      parentalConsentRequired: (v) => v ? 1 : 0,
      parentalConsentGiven: (v) => v ? 1 : 0,
      parentalEmail: (v) => v || null,
      consentUpdatedAt: (v) => v.toISOString(),
      withdrawalRequestedAt: (v) => v?.toISOString() || null,
      withdrawalReason: (v) => v || null,
      consentSource: (v) => v,
      ipAddress: (v) => v || null,
      userAgent: (v) => v || null,
    };

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && fieldMappings[key]) {
        const dbField = this.camelToSnakeCase(key);
        updateFields.push(`${dbField} = ?`);
        values.push(fieldMappings[key](value));
      }
    });

    if (updateFields.length === 0) {
      throw new Error('No valid fields provided for update');
    }

    // Always update the consent_updated_at timestamp if not already provided
    if (!updateFields.some(field => field.includes('consent_updated_at'))) {
      updateFields.push('consent_updated_at = ?');
      values.push(new Date().toISOString());
    }
    values.push(id); // Add ID for WHERE clause

    await this.getDb()
      .prepare(`UPDATE learner_dna_privacy_consent SET ${updateFields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    const updated = await this.findById(id);
    if (!updated) throw new Error(`Privacy consent ${id} not found after update`);

    return updated;
  }

  /**
   * Find consent record by user ID (most recent)
   */
  async findByUserId(userId: string, tenantId?: string): Promise<LearnerDNAPrivacyConsent | null> {
    let query = 'SELECT * FROM learner_dna_privacy_consent WHERE user_id = ?';
    const bindings: unknown[] = [userId];

    if (tenantId) {
      query += ' AND tenant_id = ?';
      bindings.push(tenantId);
    }

    // Get most recent consent record
    query += ' ORDER BY consent_updated_at DESC LIMIT 1';

    const result = await this.getDb()
      .prepare(query)
      .bind(...bindings)
      .first();

    if (!result) return null;
    return this.mapDbRowToEntity(result);
  }

  /**
   * Find all consent records for a user (audit trail)
   */
  async findAllByUserId(userId: string, tenantId?: string): Promise<LearnerDNAPrivacyConsent[]> {
    let query = 'SELECT * FROM learner_dna_privacy_consent WHERE user_id = ?';
    const bindings: unknown[] = [userId];

    if (tenantId) {
      query += ' AND tenant_id = ?';
      bindings.push(tenantId);
    }

    query += ' ORDER BY consent_updated_at DESC';

    const results = await this.getDb()
      .prepare(query)
      .bind(...bindings)
      .all();

    return results.results.map(result => this.mapDbRowToEntity(result));
  }

  /**
   * Check if user has given consent for specific data collection type
   */
  async hasConsentForDataType(
    userId: string,
    dataType: keyof Pick<LearnerDNAPrivacyConsent, 
      'behavioralTimingConsent' | 'assessmentPatternsConsent' | 
      'chatInteractionsConsent' | 'crossCourseCorrelationConsent' | 
      'anonymizedAnalyticsConsent'>,
    tenantId?: string
  ): Promise<boolean> {
    const consent = await this.findByUserId(userId, tenantId);
    
    if (!consent) return false;
    if (consent.withdrawalRequestedAt) return false;
    
    return Boolean(consent[dataType]);
  }

  /**
   * Update consent preferences for a user
   */
  async updateUserConsent(
    userId: string,
    updates: PrivacyConsentUpdate,
    tenantId?: string,
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
      consentSource?: LearnerDNAPrivacyConsent['consentSource'];
    }
  ): Promise<LearnerDNAPrivacyConsent> {
    const existingConsent = await this.findByUserId(userId, tenantId);
    
    if (!existingConsent) {
      throw new Error(`No existing consent record found for user ${userId}`);
    }

    const updateData: Partial<LearnerDNAPrivacyConsent> = {
      ...updates,
      consentUpdatedAt: new Date(),
      ...(metadata && {
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        consentSource: metadata.consentSource,
      }),
    };

    return await this.update(existingConsent.id, updateData);
  }

  /**
   * Request withdrawal of consent
   */
  async requestWithdrawal(
    userId: string,
    reason: string,
    tenantId?: string,
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<LearnerDNAPrivacyConsent> {
    const consent = await this.findByUserId(userId, tenantId);
    
    if (!consent) {
      throw new Error(`No consent record found for user ${userId}`);
    }

    if (consent.withdrawalRequestedAt) {
      throw new Error(`Consent withdrawal already requested for user ${userId}`);
    }

    return await this.update(consent.id, {
      withdrawalRequestedAt: new Date(),
      withdrawalReason: reason,
      consentUpdatedAt: new Date(),
      ...(metadata && {
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      }),
      // Set all consent flags to false when withdrawing
      behavioralTimingConsent: false,
      assessmentPatternsConsent: false,
      chatInteractionsConsent: false,
      crossCourseCorrelationConsent: false,
      dataCollectionLevel: 'minimal' as const,
    });
  }

  /**
   * Find users who need parental consent
   */
  async findUsersNeedingParentalConsent(tenantId: string): Promise<LearnerDNAPrivacyConsent[]> {
    const results = await this.getDb()
      .prepare(`
        SELECT * FROM learner_dna_privacy_consent
        WHERE tenant_id = ?
          AND parental_consent_required = 1
          AND parental_consent_given = 0
          AND withdrawal_requested_at IS NULL
        ORDER BY consent_given_at DESC
      `)
      .bind(tenantId)
      .all();

    return results.results.map(result => this.mapDbRowToEntity(result));
  }

  /**
   * Find consent records pending withdrawal (for data cleanup)
   */
  async findPendingWithdrawals(tenantId: string, gracePeriodDays: number = 30): Promise<LearnerDNAPrivacyConsent[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - gracePeriodDays);

    const results = await this.getDb()
      .prepare(`
        SELECT * FROM learner_dna_privacy_consent
        WHERE tenant_id = ?
          AND withdrawal_requested_at IS NOT NULL
          AND withdrawal_requested_at <= ?
        ORDER BY withdrawal_requested_at ASC
      `)
      .bind(tenantId, cutoffDate.toISOString())
      .all();

    return results.results.map(result => this.mapDbRowToEntity(result));
  }

  /**
   * Get consent statistics for compliance reporting
   */
  async getConsentStatistics(tenantId: string, fromDate?: Date): Promise<{
    totalConsents: number;
    activeConsents: number;
    withdrawnConsents: number;
    consentsByLevel: Record<string, number>;
    consentsByType: Record<string, number>;
    parentalConsentRequired: number;
    parentalConsentGiven: number;
  }> {
    let query = `
      SELECT 
        COUNT(*) as total_consents,
        SUM(CASE WHEN withdrawal_requested_at IS NULL THEN 1 ELSE 0 END) as active_consents,
        SUM(CASE WHEN withdrawal_requested_at IS NOT NULL THEN 1 ELSE 0 END) as withdrawn_consents,
        SUM(CASE WHEN parental_consent_required = 1 THEN 1 ELSE 0 END) as parental_consent_required,
        SUM(CASE WHEN parental_consent_given = 1 THEN 1 ELSE 0 END) as parental_consent_given,
        data_collection_level,
        COUNT(*) as level_count,
        SUM(behavioral_timing_consent) as behavioral_timing_count,
        SUM(assessment_patterns_consent) as assessment_patterns_count,
        SUM(chat_interactions_consent) as chat_interactions_count,
        SUM(cross_course_correlation_consent) as cross_course_count,
        SUM(anonymized_analytics_consent) as anonymized_analytics_count
      FROM learner_dna_privacy_consent 
      WHERE tenant_id = ?
    `;
    
    const bindings: unknown[] = [tenantId];

    if (fromDate) {
      query += ' AND consent_given_at >= ?';
      bindings.push(fromDate.toISOString());
    }

    query += ' GROUP BY data_collection_level';

    const results = await this.getDb()
      .prepare(query)
      .bind(...bindings)
      .all();

    const stats = {
      totalConsents: 0,
      activeConsents: 0,
      withdrawnConsents: 0,
      consentsByLevel: {} as Record<string, number>,
      consentsByType: {} as Record<string, number>,
      parentalConsentRequired: 0,
      parentalConsentGiven: 0,
    };

    results.results.forEach(row => {
      const record = row as any;
      // Use total_consents if provided (for mock compatibility), otherwise use level_count
      stats.totalConsents += record.total_consents !== undefined ? record.total_consents : record.level_count;
      stats.activeConsents += record.active_consents || 0;
      stats.withdrawnConsents += record.withdrawn_consents || 0;
      stats.parentalConsentRequired += record.parental_consent_required || 0;
      stats.parentalConsentGiven += record.parental_consent_given || 0;
      stats.consentsByLevel[record.data_collection_level] = record.level_count;

      // Aggregate consent type counts
      stats.consentsByType.behavioralTiming = (stats.consentsByType.behavioralTiming || 0) + (record.behavioral_timing_count || 0);
      stats.consentsByType.assessmentPatterns = (stats.consentsByType.assessmentPatterns || 0) + (record.assessment_patterns_count || 0);
      stats.consentsByType.chatInteractions = (stats.consentsByType.chatInteractions || 0) + (record.chat_interactions_count || 0);
      stats.consentsByType.crossCourse = (stats.consentsByType.crossCourse || 0) + (record.cross_course_count || 0);
      stats.consentsByType.anonymizedAnalytics = (stats.consentsByType.anonymizedAnalytics || 0) + (record.anonymized_analytics_count || 0);
    });

    return stats;
  }

  /**
   * Verify consent for data collection (compliance check)
   */
  async verifyConsentForCollection(
    userId: string,
    dataTypes: Array<keyof Pick<LearnerDNAPrivacyConsent, 
      'behavioralTimingConsent' | 'assessmentPatternsConsent' | 
      'chatInteractionsConsent' | 'crossCourseCorrelationConsent' | 
      'anonymizedAnalyticsConsent'>>,
    tenantId?: string
  ): Promise<{
    hasConsent: boolean;
    missingConsents: string[];
    consentRecord: LearnerDNAPrivacyConsent | null;
  }> {
    const consent = await this.findByUserId(userId, tenantId);
    
    if (!consent) {
      return {
        hasConsent: false,
        missingConsents: dataTypes,
        consentRecord: null,
      };
    }

    if (consent.withdrawalRequestedAt) {
      return {
        hasConsent: false,
        missingConsents: ['withdrawal_requested'],
        consentRecord: consent,
      };
    }

    const missingConsents = dataTypes.filter(dataType => !consent[dataType]);

    return {
      hasConsent: missingConsents.length === 0,
      missingConsents,
      consentRecord: consent,
    };
  }

  /**
   * Check if user has external AI access consent
   */
  async hasExternalAiAccessConsent(userId: string, tenantId?: string): Promise<boolean> {
    const consent = await this.findByUserId(userId, tenantId);

    if (!consent) return false;
    if (consent.withdrawalRequestedAt) return false;

    return consent.externalAiAccessConsent;
  }

  /**
   * Get users with external AI access consent for MCP client notifications
   */
  async findUsersWithExternalAiAccess(tenantId: string): Promise<LearnerDNAPrivacyConsent[]> {
    const results = await this.getDb()
      .prepare(`
        SELECT * FROM learner_dna_privacy_consent
        WHERE tenant_id = ?
          AND external_ai_access_consent = 1
          AND withdrawal_requested_at IS NULL
        ORDER BY consent_updated_at DESC
      `)
      .bind(tenantId)
      .all();

    return results.results.map(result => this.mapDbRowToEntity(result));
  }

  /**
   * Update MCP client scopes for a user
   */
  async updateMcpClientScopes(
    userId: string,
    scopes: string[],
    tenantId?: string
  ): Promise<LearnerDNAPrivacyConsent> {
    const existingConsent = await this.findByUserId(userId, tenantId);

    if (!existingConsent) {
      throw new Error(`No existing consent record found for user ${userId}`);
    }

    return await this.update(existingConsent.id, {
      mcpClientScopes: scopes,
      consentUpdatedAt: new Date(),
    });
  }

  /**
   * Revoke external AI access consent (for MCP session termination)
   */
  async revokeExternalAiAccess(
    userId: string,
    reason: string,
    tenantId?: string
  ): Promise<LearnerDNAPrivacyConsent> {
    const consent = await this.findByUserId(userId, tenantId);

    if (!consent) {
      throw new Error(`No consent record found for user ${userId}`);
    }

    return await this.update(consent.id, {
      externalAiAccessConsent: false,
      mcpClientScopes: [],
      realTimeRevocationEnabled: false,
      withdrawalRequestedAt: new Date(),
      withdrawalReason: reason,
      consentUpdatedAt: new Date(),
    });
  }

  /**
   * Helper method to convert camelCase to snake_case for database fields
   */
  private camelToSnakeCase(camelCase: string): string {
    return camelCase.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  /**
   * Helper method to map database row to entity with backward compatibility
   * Handles NULL values for new MCP fields from legacy Epic 7 records
   */
  private mapDbRowToEntity(row: any): LearnerDNAPrivacyConsent {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      consentVersion: row.consent_version || '1.0',
      behavioralTimingConsent: Boolean(row.behavioral_timing_consent),
      assessmentPatternsConsent: Boolean(row.assessment_patterns_consent),
      chatInteractionsConsent: Boolean(row.chat_interactions_consent),
      crossCourseCorrelationConsent: Boolean(row.cross_course_correlation_consent),
      anonymizedAnalyticsConsent: Boolean(row.anonymized_analytics_consent),
      // Handle NULL values for new MCP fields with safe defaults
      externalAiAccessConsent: row.external_ai_access_consent !== null ? Boolean(row.external_ai_access_consent) : false,
      mcpClientScopes: row.mcp_client_scopes !== null ? JSON.parse(row.mcp_client_scopes || '[]') : [],
      realTimeRevocationEnabled: row.real_time_revocation_enabled !== null ? Boolean(row.real_time_revocation_enabled) : true,
      externalClientRestrictions: row.external_client_restrictions !== null ? JSON.parse(row.external_client_restrictions || '{}') : {},
      dataCollectionLevel: row.data_collection_level || 'minimal',
      parentalConsentRequired: Boolean(row.parental_consent_required),
      parentalConsentGiven: Boolean(row.parental_consent_given),
      parentalEmail: row.parental_email,
      consentGivenAt: new Date(row.consent_given_at),
      consentUpdatedAt: new Date(row.consent_updated_at),
      withdrawalRequestedAt: row.withdrawal_requested_at ? new Date(row.withdrawal_requested_at) : undefined,
      withdrawalReason: row.withdrawal_reason,
      consentSource: row.consent_source || 'dashboard',
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
    };
  }
}