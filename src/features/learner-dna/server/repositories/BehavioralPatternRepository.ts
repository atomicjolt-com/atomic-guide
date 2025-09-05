/**
 * @fileoverview Repository for behavioral pattern data access operations.
 * @module features/learner-dna/server/repositories/BehavioralPatternRepository
 */

import { BaseRepository } from '@shared/server/repositories/BaseRepository';
import { DatabaseService } from '@shared/server/services/database';
import { behavioralPatternSchema } from '../../shared/schemas/learner-dna.schema';
import type { BehavioralPattern } from '../../shared/types';

/**
 * Repository for behavioral pattern data access operations.
 * 
 * Handles all database operations for behavioral patterns following the established
 * repository pattern and maintaining proper data validation. Behavioral patterns
 * are privacy-sensitive data that require careful handling and encryption.
 */
export class BehavioralPatternRepository extends BaseRepository<BehavioralPattern> {
  constructor(databaseService: DatabaseService) {
    super(databaseService, 'behavioral_patterns', behavioralPatternSchema);
  }

  protected async performCreate(pattern: BehavioralPattern): Promise<BehavioralPattern> {
    await this.getDb()
      .prepare(`
        INSERT INTO behavioral_patterns (
          id, tenant_id, user_id, session_id, pattern_type, context_type,
          raw_data_encrypted, raw_data_hash, aggregated_metrics, confidence_level,
          course_id, content_id, collected_at, anonymized_at, purge_at,
          privacy_level, consent_verified
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        pattern.id,
        pattern.tenantId,
        pattern.userId,
        pattern.sessionId,
        pattern.patternType,
        pattern.contextType,
        pattern.rawDataEncrypted,
        pattern.rawDataHash,
        JSON.stringify(pattern.aggregatedMetrics),
        pattern.confidenceLevel,
        pattern.courseId || null,
        pattern.contentId || null,
        pattern.collectedAt.toISOString(),
        pattern.anonymizedAt?.toISOString() || null,
        pattern.purgeAt?.toISOString() || null,
        pattern.privacyLevel,
        pattern.consentVerified ? 1 : 0
      )
      .run();

    return pattern;
  }

  protected async performUpdate(id: string, updates: Partial<BehavioralPattern>): Promise<BehavioralPattern> {
    // Build dynamic update query based on provided fields
    const updateFields: string[] = [];
    const values: unknown[] = [];
    
    const fieldMappings: Record<string, (value: any) => any> = {
      confidenceLevel: (v) => v,
      aggregatedMetrics: (v) => JSON.stringify(v),
      anonymizedAt: (v) => v?.toISOString() || null,
      purgeAt: (v) => v?.toISOString() || null,
      privacyLevel: (v) => v,
      consentVerified: (v) => v ? 1 : 0,
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

    // Always update the updated timestamp
    updateFields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id); // Add ID for WHERE clause

    await this.getDb()
      .prepare(`UPDATE behavioral_patterns SET ${updateFields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    const updated = await this.findById(id);
    if (!updated) throw new Error(`Behavioral pattern ${id} not found after update`);

    return updated;
  }

  /**
   * Find behavioral patterns by user ID with pagination and filtering
   */
  async findByUserId(
    userId: string,
    options: {
      patternType?: BehavioralPattern['patternType'];
      contextType?: BehavioralPattern['contextType'];
      privacyLevel?: BehavioralPattern['privacyLevel'];
      limit?: number;
      offset?: number;
      includeAnonymized?: boolean;
    } = {}
  ): Promise<BehavioralPattern[]> {
    const {
      patternType,
      contextType,
      privacyLevel,
      limit = 50,
      offset = 0,
      includeAnonymized = true
    } = options;

    let query = 'SELECT * FROM behavioral_patterns WHERE user_id = ?';
    const bindings: unknown[] = [userId];

    if (patternType) {
      query += ' AND pattern_type = ?';
      bindings.push(patternType);
    }

    if (contextType) {
      query += ' AND context_type = ?';
      bindings.push(contextType);
    }

    if (privacyLevel) {
      query += ' AND privacy_level = ?';
      bindings.push(privacyLevel);
    }

    if (!includeAnonymized) {
      query += ' AND privacy_level != ?';
      bindings.push('anonymized');
    }

    query += ' ORDER BY collected_at DESC LIMIT ? OFFSET ?';
    bindings.push(limit, offset);

    const results = await this.getDb()
      .prepare(query)
      .bind(...bindings)
      .all();

    return results.results.map(result => this.mapDbRowToEntity(result));
  }

  /**
   * Find patterns by session ID
   */
  async findBySessionId(sessionId: string): Promise<BehavioralPattern[]> {
    const results = await this.getDb()
      .prepare('SELECT * FROM behavioral_patterns WHERE session_id = ? ORDER BY collected_at ASC')
      .bind(sessionId)
      .all();

    return results.results.map(result => this.mapDbRowToEntity(result));
  }

  /**
   * Find patterns by tenant and course for aggregation
   */
  async findByCourseForAggregation(
    tenantId: string,
    courseId: string,
    options: {
      patternType?: BehavioralPattern['patternType'];
      privacyLevel?: BehavioralPattern['privacyLevel'];
      consentVerifiedOnly?: boolean;
      fromDate?: Date;
      toDate?: Date;
    } = {}
  ): Promise<BehavioralPattern[]> {
    const {
      patternType,
      privacyLevel = 'anonymized',
      consentVerifiedOnly = true,
      fromDate,
      toDate
    } = options;

    let query = `
      SELECT * FROM behavioral_patterns 
      WHERE tenant_id = ? AND course_id = ? AND privacy_level = ?
    `;
    const bindings: unknown[] = [tenantId, courseId, privacyLevel];

    if (consentVerifiedOnly) {
      query += ' AND consent_verified = 1';
    }

    if (patternType) {
      query += ' AND pattern_type = ?';
      bindings.push(patternType);
    }

    if (fromDate) {
      query += ' AND collected_at >= ?';
      bindings.push(fromDate.toISOString());
    }

    if (toDate) {
      query += ' AND collected_at <= ?';
      bindings.push(toDate.toISOString());
    }

    query += ' ORDER BY collected_at DESC';

    const results = await this.getDb()
      .prepare(query)
      .bind(...bindings)
      .all();

    return results.results.map(result => this.mapDbRowToEntity(result));
  }

  /**
   * Mark patterns as anonymized (privacy protection)
   */
  async markAsAnonymized(patternIds: string[]): Promise<void> {
    if (patternIds.length === 0) return;

    const placeholders = patternIds.map(() => '?').join(',');
    const now = new Date().toISOString();

    await this.getDb()
      .prepare(`
        UPDATE behavioral_patterns 
        SET privacy_level = 'anonymized', anonymized_at = ?, updated_at = ?
        WHERE id IN (${placeholders})
      `)
      .bind(now, now, ...patternIds)
      .run();
  }

  /**
   * Mark patterns for purging based on retention policy
   */
  async markForPurging(retentionDays: number, tenantId: string): Promise<string[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const purgeDate = new Date();
    purgeDate.setDate(purgeDate.getDate() + 7); // 7 days grace period

    const results = await this.getDb()
      .prepare(`
        UPDATE behavioral_patterns 
        SET purge_at = ?
        WHERE tenant_id = ? 
          AND collected_at < ? 
          AND purge_at IS NULL
        RETURNING id
      `)
      .bind(
        purgeDate.toISOString(),
        tenantId,
        cutoffDate.toISOString()
      )
      .all();

    return results.results.map(row => (row as any).id);
  }

  /**
   * Purge patterns that are due for deletion
   */
  async purgeExpiredPatterns(): Promise<number> {
    const now = new Date().toISOString();
    
    const result = await this.getDb()
      .prepare('DELETE FROM behavioral_patterns WHERE purge_at IS NOT NULL AND purge_at <= ?')
      .bind(now)
      .run();

    return result.changes || 0;
  }

  /**
   * Count patterns by type for analytics
   */
  async countPatternsByType(tenantId: string, options: {
    courseId?: string;
    userId?: string;
    consentVerifiedOnly?: boolean;
    fromDate?: Date;
    toDate?: Date;
  } = {}): Promise<Record<string, number>> {
    const {
      courseId,
      userId,
      consentVerifiedOnly = true,
      fromDate,
      toDate
    } = options;

    let query = `
      SELECT pattern_type, COUNT(*) as count 
      FROM behavioral_patterns 
      WHERE tenant_id = ?
    `;
    const bindings: unknown[] = [tenantId];

    if (courseId) {
      query += ' AND course_id = ?';
      bindings.push(courseId);
    }

    if (userId) {
      query += ' AND user_id = ?';
      bindings.push(userId);
    }

    if (consentVerifiedOnly) {
      query += ' AND consent_verified = 1';
    }

    if (fromDate) {
      query += ' AND collected_at >= ?';
      bindings.push(fromDate.toISOString());
    }

    if (toDate) {
      query += ' AND collected_at <= ?';
      bindings.push(toDate.toISOString());
    }

    query += ' GROUP BY pattern_type';

    const results = await this.getDb()
      .prepare(query)
      .bind(...bindings)
      .all();

    const counts: Record<string, number> = {};
    results.results.forEach(row => {
      const record = row as { pattern_type: string; count: number };
      counts[record.pattern_type] = record.count;
    });

    return counts;
  }

  /**
   * Helper method to convert camelCase to snake_case for database fields
   */
  private camelToSnakeCase(camelCase: string): string {
    return camelCase.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  /**
   * Helper method to map database row to entity
   */
  private mapDbRowToEntity(row: any): BehavioralPattern {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      sessionId: row.session_id,
      patternType: row.pattern_type,
      contextType: row.context_type,
      rawDataEncrypted: row.raw_data_encrypted,
      rawDataHash: row.raw_data_hash,
      aggregatedMetrics: JSON.parse(row.aggregated_metrics || '{}'),
      confidenceLevel: row.confidence_level,
      courseId: row.course_id,
      contentId: row.content_id,
      collectedAt: new Date(row.collected_at),
      anonymizedAt: row.anonymized_at ? new Date(row.anonymized_at) : undefined,
      purgeAt: row.purge_at ? new Date(row.purge_at) : undefined,
      privacyLevel: row.privacy_level,
      consentVerified: Boolean(row.consent_verified),
    };
  }
}