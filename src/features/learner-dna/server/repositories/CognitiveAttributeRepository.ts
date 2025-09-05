/**
 * @fileoverview Repository for cognitive attribute data access operations.
 * @module features/learner-dna/server/repositories/CognitiveAttributeRepository
 */

import { BaseRepository } from '@shared/server/repositories/BaseRepository';
import { DatabaseService } from '@shared/server/services/database';
import { cognitiveAttributeSchema } from '../../shared/schemas/learner-dna.schema';
import type { CognitiveAttribute } from '../../shared/types';

/**
 * Repository for cognitive attribute data access operations.
 * 
 * Handles all database operations for individual cognitive attributes that make up
 * learner DNA profiles. Attributes are granular data points with confidence scores
 * and evidence sources that contribute to overall profile insights.
 */
export class CognitiveAttributeRepository extends BaseRepository<CognitiveAttribute> {
  constructor(databaseService: DatabaseService) {
    super(databaseService, 'cognitive_attributes', cognitiveAttributeSchema);
  }

  protected async performCreate(attribute: CognitiveAttribute): Promise<CognitiveAttribute> {
    await this.getDb()
      .prepare(`
        INSERT INTO cognitive_attributes (
          id, tenant_id, user_id, profile_id,
          attribute, value, confidence, data_points, last_updated, evidence_source,
          course_id, session_id, context_data,
          validation_score, stability_score,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        attribute.id,
        attribute.tenantId,
        attribute.userId,
        attribute.profileId,
        attribute.attribute,
        typeof attribute.value === 'string' ? attribute.value : attribute.value.toString(),
        attribute.confidence,
        attribute.dataPoints,
        attribute.lastUpdated.toISOString(),
        attribute.evidenceSource,
        attribute.courseId || null,
        attribute.sessionId || null,
        JSON.stringify(attribute.contextData),
        attribute.validationScore,
        attribute.stabilityScore,
        attribute.createdAt.toISOString(),
        attribute.updatedAt.toISOString()
      )
      .run();

    return attribute;
  }

  protected async performUpdate(id: string, updates: Partial<CognitiveAttribute>): Promise<CognitiveAttribute> {
    // Build dynamic update query based on provided fields
    const updateFields: string[] = [];
    const values: unknown[] = [];
    
    const fieldMappings: Record<string, (value: any) => any> = {
      attribute: (v) => v,
      value: (v) => typeof v === 'string' ? v : v.toString(),
      confidence: (v) => v,
      dataPoints: (v) => v,
      lastUpdated: (v) => v.toISOString(),
      evidenceSource: (v) => v,
      courseId: (v) => v || null,
      sessionId: (v) => v || null,
      contextData: (v) => JSON.stringify(v),
      validationScore: (v) => v,
      stabilityScore: (v) => v,
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

    // Always update the updated_at timestamp
    updateFields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id); // Add ID for WHERE clause

    await this.getDb()
      .prepare(`UPDATE cognitive_attributes SET ${updateFields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    const updated = await this.findById(id);
    if (!updated) throw new Error(`Cognitive attribute ${id} not found after update`);

    return updated;
  }

  /**
   * Find attributes by profile ID
   */
  async findByProfileId(profileId: string): Promise<CognitiveAttribute[]> {
    const results = await this.getDb()
      .prepare('SELECT * FROM cognitive_attributes WHERE profile_id = ? ORDER BY last_updated DESC')
      .bind(profileId)
      .all();

    return results.results.map(result => this.mapDbRowToEntity(result));
  }

  /**
   * Find attributes by user ID with filtering options
   */
  async findByUserId(
    userId: string,
    options: {
      attributeName?: string;
      evidenceSource?: CognitiveAttribute['evidenceSource'];
      courseId?: string;
      minConfidence?: number;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<CognitiveAttribute[]> {
    const {
      attributeName,
      evidenceSource,
      courseId,
      minConfidence = 0,
      limit = 50,
      offset = 0
    } = options;

    let query = 'SELECT * FROM cognitive_attributes WHERE user_id = ? AND confidence >= ?';
    const bindings: unknown[] = [userId, minConfidence];

    if (attributeName) {
      query += ' AND attribute = ?';
      bindings.push(attributeName);
    }

    if (evidenceSource) {
      query += ' AND evidence_source = ?';
      bindings.push(evidenceSource);
    }

    if (courseId) {
      query += ' AND course_id = ?';
      bindings.push(courseId);
    }

    query += ' ORDER BY confidence DESC, last_updated DESC LIMIT ? OFFSET ?';
    bindings.push(limit, offset);

    const results = await this.getDb()
      .prepare(query)
      .bind(...bindings)
      .all();

    return results.results.map(result => this.mapDbRowToEntity(result));
  }

  /**
   * Find specific attribute by name for a profile
   */
  async findAttributeByName(
    profileId: string,
    attributeName: string
  ): Promise<CognitiveAttribute | null> {
    const result = await this.getDb()
      .prepare('SELECT * FROM cognitive_attributes WHERE profile_id = ? AND attribute = ? ORDER BY last_updated DESC LIMIT 1')
      .bind(profileId, attributeName)
      .first();

    if (!result) return null;
    return this.mapDbRowToEntity(result);
  }

  /**
   * Update or create attribute (upsert behavior)
   */
  async upsertAttribute(
    profileId: string,
    userId: string,
    tenantId: string,
    attributeName: string,
    value: number | string,
    confidence: number,
    evidenceSource: CognitiveAttribute['evidenceSource'],
    additionalData?: {
      courseId?: string;
      sessionId?: string;
      contextData?: Record<string, any>;
      validationScore?: number;
      stabilityScore?: number;
    }
  ): Promise<CognitiveAttribute> {
    const existing = await this.findAttributeByName(profileId, attributeName);
    
    if (existing) {
      // Update existing attribute
      const updatedDataPoints = existing.dataPoints + 1;
      const updatedConfidence = Math.min(confidence, 1.0);
      
      return await this.update(existing.id, {
        value,
        confidence: updatedConfidence,
        dataPoints: updatedDataPoints,
        lastUpdated: new Date(),
        evidenceSource,
        ...(additionalData?.courseId && { courseId: additionalData.courseId }),
        ...(additionalData?.sessionId && { sessionId: additionalData.sessionId }),
        ...(additionalData?.contextData && { 
          contextData: { ...existing.contextData, ...additionalData.contextData }
        }),
        ...(additionalData?.validationScore !== undefined && { 
          validationScore: additionalData.validationScore
        }),
        ...(additionalData?.stabilityScore !== undefined && { 
          stabilityScore: additionalData.stabilityScore 
        }),
      });
    } else {
      // Create new attribute
      return await this.create({
        tenantId,
        userId,
        profileId,
        attribute: attributeName,
        value,
        confidence,
        dataPoints: 1,
        lastUpdated: new Date(),
        evidenceSource,
        courseId: additionalData?.courseId,
        sessionId: additionalData?.sessionId,
        contextData: additionalData?.contextData || {},
        validationScore: additionalData?.validationScore || 0,
        stabilityScore: additionalData?.stabilityScore || 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  /**
   * Get attribute statistics for a profile
   */
  async getAttributeStatistics(profileId: string): Promise<{
    totalAttributes: number;
    averageConfidence: number;
    attributesBySource: Record<string, number>;
    highConfidenceAttributes: number; // confidence > 0.7
    recentAttributes: number; // updated in last 24 hours
  }> {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const results = await this.getDb()
      .prepare(`
        SELECT 
          COUNT(*) as total_attributes,
          AVG(confidence) as avg_confidence,
          evidence_source,
          COUNT(*) as source_count,
          SUM(CASE WHEN confidence > 0.7 THEN 1 ELSE 0 END) as high_confidence_count,
          SUM(CASE WHEN last_updated >= ? THEN 1 ELSE 0 END) as recent_count
        FROM cognitive_attributes 
        WHERE profile_id = ?
        GROUP BY evidence_source
      `)
      .bind(twentyFourHoursAgo.toISOString(), profileId)
      .all();

    const stats = {
      totalAttributes: 0,
      averageConfidence: 0,
      attributesBySource: {} as Record<string, number>,
      highConfidenceAttributes: 0,
      recentAttributes: 0,
    };

    results.results.forEach(row => {
      const record = row as any;
      stats.totalAttributes += record.source_count;
      stats.averageConfidence = record.avg_confidence || 0;
      stats.attributesBySource[record.evidence_source] = record.source_count;
      stats.highConfidenceAttributes += record.high_confidence_count || 0;
      stats.recentAttributes += record.recent_count || 0;
    });

    return stats;
  }

  /**
   * Find attributes needing validation (low stability scores)
   */
  async findAttributesNeedingValidation(
    tenantId: string,
    maxStabilityScore: number = 0.5,
    minDataPoints: number = 3
  ): Promise<CognitiveAttribute[]> {
    const results = await this.getDb()
      .prepare(`
        SELECT * FROM cognitive_attributes 
        WHERE tenant_id = ? 
          AND stability_score <= ?
          AND data_points >= ?
        ORDER BY stability_score ASC, last_updated DESC
        LIMIT 100
      `)
      .bind(tenantId, maxStabilityScore, minDataPoints)
      .all();

    return results.results.map(result => this.mapDbRowToEntity(result));
  }

  /**
   * Get unique attribute names for a tenant
   */
  async getUniqueAttributeNames(tenantId: string): Promise<string[]> {
    const results = await this.getDb()
      .prepare('SELECT DISTINCT attribute FROM cognitive_attributes WHERE tenant_id = ? ORDER BY attribute')
      .bind(tenantId)
      .all();

    return results.results.map(row => (row as any).attribute);
  }

  /**
   * Find attributes by evidence source with aggregation
   */
  async findAttributesByEvidenceSource(
    tenantId: string,
    evidenceSource: CognitiveAttribute['evidenceSource'],
    options: {
      minConfidence?: number;
      minDataPoints?: number;
      fromDate?: Date;
      toDate?: Date;
      limit?: number;
    } = {}
  ): Promise<CognitiveAttribute[]> {
    const {
      minConfidence = 0,
      minDataPoints = 1,
      fromDate,
      toDate,
      limit = 100
    } = options;

    let query = `
      SELECT * FROM cognitive_attributes 
      WHERE tenant_id = ? AND evidence_source = ? 
        AND confidence >= ? AND data_points >= ?
    `;
    const bindings: unknown[] = [tenantId, evidenceSource, minConfidence, minDataPoints];

    if (fromDate) {
      query += ' AND last_updated >= ?';
      bindings.push(fromDate.toISOString());
    }

    if (toDate) {
      query += ' AND last_updated <= ?';
      bindings.push(toDate.toISOString());
    }

    query += ' ORDER BY confidence DESC, last_updated DESC LIMIT ?';
    bindings.push(limit);

    const results = await this.getDb()
      .prepare(query)
      .bind(...bindings)
      .all();

    return results.results.map(result => this.mapDbRowToEntity(result));
  }

  /**
   * Clean up old attributes beyond retention period
   */
  async cleanupOldAttributes(retentionDays: number, tenantId: string): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.getDb()
      .prepare('DELETE FROM cognitive_attributes WHERE tenant_id = ? AND created_at < ?')
      .bind(tenantId, cutoffDate.toISOString())
      .run();

    return result.changes || 0;
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
  private mapDbRowToEntity(row: any): CognitiveAttribute {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      profileId: row.profile_id,
      attribute: row.attribute,
      value: this.parseValue(row.value),
      confidence: row.confidence,
      dataPoints: row.data_points,
      lastUpdated: new Date(row.last_updated),
      evidenceSource: row.evidence_source,
      courseId: row.course_id,
      sessionId: row.session_id,
      contextData: JSON.parse(row.context_data || '{}'),
      validationScore: row.validation_score,
      stabilityScore: row.stability_score,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Helper to parse value from database (could be number or string)
   */
  private parseValue(value: string): number | string {
    // Try to parse as number first
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && isFinite(numValue)) {
      return numValue;
    }
    return value;
  }
}