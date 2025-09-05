/**
 * @fileoverview Repository for Learner DNA profile data access operations.
 * @module features/learner-dna/server/repositories/LearnerDNAProfileRepository
 */

import { BaseRepository } from '@shared/server/repositories/BaseRepository';
import { DatabaseService } from '@shared/server/services/database';
import { learnerDnaProfileSchema } from '../../shared/schemas/learner-dna.schema';
import type { LearnerDNAProfile } from '../../shared/types';

/**
 * Repository for Learner DNA profile data access operations.
 * 
 * Handles all database operations for learner DNA profiles following the established
 * repository pattern. Profiles contain aggregated cognitive insights and must maintain
 * privacy controls and data quality metrics.
 */
export class LearnerDNAProfileRepository extends BaseRepository<LearnerDNAProfile> {
  constructor(databaseService: DatabaseService) {
    super(databaseService, 'learner_dna_profiles', learnerDnaProfileSchema);
  }

  protected async performCreate(profile: LearnerDNAProfile): Promise<LearnerDNAProfile> {
    await this.getDb()
      .prepare(`
        INSERT INTO learner_dna_profiles (
          id, tenant_id, user_id,
          learning_velocity_value, learning_velocity_confidence, learning_velocity_data_points, learning_velocity_last_updated,
          memory_retention_value, memory_retention_confidence, memory_retention_data_points, memory_retention_last_updated,
          struggle_threshold_value, struggle_threshold_confidence, struggle_threshold_data_points, struggle_threshold_last_updated,
          cognitive_attributes, comprehension_styles, preferred_modalities,
          profile_confidence, total_data_points, analysis_quality_score,
          cross_course_patterns, multi_context_confidence,
          data_collection_level, profile_visibility,
          created_at, updated_at, last_analyzed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        profile.id,
        profile.tenantId,
        profile.userId,
        profile.learningVelocityValue,
        profile.learningVelocityConfidence,
        profile.learningVelocityDataPoints,
        profile.learningVelocityLastUpdated.toISOString(),
        profile.memoryRetentionValue,
        profile.memoryRetentionConfidence,
        profile.memoryRetentionDataPoints,
        profile.memoryRetentionLastUpdated.toISOString(),
        profile.struggleThresholdValue,
        profile.struggleThresholdConfidence,
        profile.struggleThresholdDataPoints,
        profile.struggleThresholdLastUpdated.toISOString(),
        JSON.stringify(profile.cognitiveAttributes),
        JSON.stringify(profile.comprehensionStyles),
        JSON.stringify(profile.preferredModalities),
        profile.profileConfidence,
        profile.totalDataPoints,
        profile.analysisQualityScore,
        JSON.stringify(profile.crossCoursePatterns),
        profile.multiContextConfidence,
        profile.dataCollectionLevel,
        profile.profileVisibility,
        profile.createdAt.toISOString(),
        profile.updatedAt.toISOString(),
        profile.lastAnalyzedAt.toISOString()
      )
      .run();

    return profile;
  }

  protected async performUpdate(id: string, updates: Partial<LearnerDNAProfile>): Promise<LearnerDNAProfile> {
    // Build dynamic update query based on provided fields
    const updateFields: string[] = [];
    const values: unknown[] = [];
    
    const fieldMappings: Record<string, (value: any) => any> = {
      learningVelocityValue: (v) => v,
      learningVelocityConfidence: (v) => v,
      learningVelocityDataPoints: (v) => v,
      learningVelocityLastUpdated: (v) => v.toISOString(),
      memoryRetentionValue: (v) => v,
      memoryRetentionConfidence: (v) => v,
      memoryRetentionDataPoints: (v) => v,
      memoryRetentionLastUpdated: (v) => v.toISOString(),
      struggleThresholdValue: (v) => v,
      struggleThresholdConfidence: (v) => v,
      struggleThresholdDataPoints: (v) => v,
      struggleThresholdLastUpdated: (v) => v.toISOString(),
      cognitiveAttributes: (v) => JSON.stringify(v),
      comprehensionStyles: (v) => JSON.stringify(v),
      preferredModalities: (v) => JSON.stringify(v),
      profileConfidence: (v) => v,
      totalDataPoints: (v) => v,
      analysisQualityScore: (v) => v,
      crossCoursePatterns: (v) => JSON.stringify(v),
      multiContextConfidence: (v) => v,
      dataCollectionLevel: (v) => v,
      profileVisibility: (v) => v,
      lastAnalyzedAt: (v) => v.toISOString(),
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
      .prepare(`UPDATE learner_dna_profiles SET ${updateFields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    const updated = await this.findById(id);
    if (!updated) throw new Error(`Learner DNA profile ${id} not found after update`);

    return updated;
  }

  /**
   * Find profile by user ID
   */
  async findByUserId(userId: string, tenantId?: string): Promise<LearnerDNAProfile | null> {
    let query = 'SELECT * FROM learner_dna_profiles WHERE user_id = ?';
    const bindings: unknown[] = [userId];

    if (tenantId) {
      query += ' AND tenant_id = ?';
      bindings.push(tenantId);
    }

    query += ' ORDER BY updated_at DESC LIMIT 1';

    const result = await this.getDb()
      .prepare(query)
      .bind(...bindings)
      .first();

    if (!result) return null;
    return this.mapDbRowToEntity(result);
  }

  /**
   * Find profiles by tenant with quality filtering
   */
  async findByTenant(
    tenantId: string,
    options: {
      minProfileConfidence?: number;
      minDataPoints?: number;
      dataCollectionLevel?: LearnerDNAProfile['dataCollectionLevel'];
      profileVisibility?: LearnerDNAProfile['profileVisibility'];
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<LearnerDNAProfile[]> {
    const {
      minProfileConfidence = 0,
      minDataPoints = 0,
      dataCollectionLevel,
      profileVisibility,
      limit = 50,
      offset = 0
    } = options;

    let query = `
      SELECT * FROM learner_dna_profiles 
      WHERE tenant_id = ? AND profile_confidence >= ? AND total_data_points >= ?
    `;
    const bindings: unknown[] = [tenantId, minProfileConfidence, minDataPoints];

    if (dataCollectionLevel) {
      query += ' AND data_collection_level = ?';
      bindings.push(dataCollectionLevel);
    }

    if (profileVisibility) {
      query += ' AND profile_visibility = ?';
      bindings.push(profileVisibility);
    }

    query += ' ORDER BY analysis_quality_score DESC, updated_at DESC LIMIT ? OFFSET ?';
    bindings.push(limit, offset);

    const results = await this.getDb()
      .prepare(query)
      .bind(...bindings)
      .all();

    return results.results.map(result => this.mapDbRowToEntity(result));
  }

  /**
   * Update cognitive attribute for a profile
   */
  async updateCognitiveAttribute(
    profileId: string,
    attribute: string,
    value: number,
    confidence: number,
    dataPoints: number
  ): Promise<void> {
    const profile = await this.findById(profileId);
    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    // Update cognitive attributes
    const updatedAttributes = {
      ...profile.cognitiveAttributes,
      [attribute]: {
        value,
        confidence,
        dataPoints,
        lastUpdated: new Date().toISOString()
      }
    };

    // Recalculate overall profile confidence
    const attributeConfidences = Object.values(updatedAttributes).map((attr: any) => attr.confidence || 0);
    const newProfileConfidence = attributeConfidences.length > 0 
      ? attributeConfidences.reduce((sum, conf) => sum + conf, 0) / attributeConfidences.length 
      : 0;

    await this.update(profileId, {
      cognitiveAttributes: updatedAttributes,
      profileConfidence: Math.min(newProfileConfidence, 1.0),
      totalDataPoints: profile.totalDataPoints + dataPoints,
      lastAnalyzedAt: new Date(),
      updatedAt: new Date()
    });
  }

  /**
   * Update learning velocity metrics
   */
  async updateLearningVelocity(
    profileId: string,
    value: number,
    confidence: number,
    additionalDataPoints: number
  ): Promise<void> {
    const profile = await this.findById(profileId);
    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    await this.update(profileId, {
      learningVelocityValue: value,
      learningVelocityConfidence: confidence,
      learningVelocityDataPoints: profile.learningVelocityDataPoints + additionalDataPoints,
      learningVelocityLastUpdated: new Date(),
      totalDataPoints: profile.totalDataPoints + additionalDataPoints,
      lastAnalyzedAt: new Date(),
      updatedAt: new Date()
    });
  }

  /**
   * Update memory retention metrics
   */
  async updateMemoryRetention(
    profileId: string,
    value: number,
    confidence: number,
    additionalDataPoints: number
  ): Promise<void> {
    const profile = await this.findById(profileId);
    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    await this.update(profileId, {
      memoryRetentionValue: value,
      memoryRetentionConfidence: confidence,
      memoryRetentionDataPoints: profile.memoryRetentionDataPoints + additionalDataPoints,
      memoryRetentionLastUpdated: new Date(),
      totalDataPoints: profile.totalDataPoints + additionalDataPoints,
      lastAnalyzedAt: new Date(),
      updatedAt: new Date()
    });
  }

  /**
   * Update struggle threshold metrics
   */
  async updateStruggleThreshold(
    profileId: string,
    value: number,
    confidence: number,
    additionalDataPoints: number
  ): Promise<void> {
    const profile = await this.findById(profileId);
    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    await this.update(profileId, {
      struggleThresholdValue: value,
      struggleThresholdConfidence: confidence,
      struggleThresholdDataPoints: profile.struggleThresholdDataPoints + additionalDataPoints,
      struggleThresholdLastUpdated: new Date(),
      totalDataPoints: profile.totalDataPoints + additionalDataPoints,
      lastAnalyzedAt: new Date(),
      updatedAt: new Date()
    });
  }

  /**
   * Find profiles that need analysis update
   */
  async findProfilesNeedingAnalysis(
    tenantId: string,
    stalenessHours: number = 24,
    minDataPointsForUpdate: number = 10
  ): Promise<LearnerDNAProfile[]> {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - stalenessHours);

    const results = await this.getDb()
      .prepare(`
        SELECT * FROM learner_dna_profiles 
        WHERE tenant_id = ? 
          AND (
            last_analyzed_at < ? 
            OR total_data_points % ? = 0
          )
          AND profile_confidence > 0
        ORDER BY last_analyzed_at ASC
        LIMIT 50
      `)
      .bind(tenantId, cutoffTime.toISOString(), minDataPointsForUpdate)
      .all();

    return results.results.map(result => this.mapDbRowToEntity(result));
  }

  /**
   * Get profile quality statistics for a tenant
   */
  async getQualityStatistics(tenantId: string): Promise<{
    totalProfiles: number;
    highQualityProfiles: number; // confidence > 0.7
    averageConfidence: number;
    averageDataPoints: number;
    profilesByCollectionLevel: Record<string, number>;
  }> {
    const results = await this.getDb()
      .prepare(`
        SELECT 
          COUNT(*) as total_profiles,
          SUM(CASE WHEN profile_confidence > 0.7 THEN 1 ELSE 0 END) as high_quality_profiles,
          AVG(profile_confidence) as avg_confidence,
          AVG(total_data_points) as avg_data_points,
          data_collection_level,
          COUNT(*) as level_count
        FROM learner_dna_profiles 
        WHERE tenant_id = ?
        GROUP BY data_collection_level
      `)
      .bind(tenantId)
      .all();

    const aggregated = {
      totalProfiles: 0,
      highQualityProfiles: 0,
      averageConfidence: 0,
      averageDataPoints: 0,
      profilesByCollectionLevel: {} as Record<string, number>
    };

    results.results.forEach(row => {
      const record = row as any;
      aggregated.totalProfiles += record.level_count;
      aggregated.highQualityProfiles += record.high_quality_profiles;
      aggregated.averageConfidence = record.avg_confidence || 0;
      aggregated.averageDataPoints = record.avg_data_points || 0;
      aggregated.profilesByCollectionLevel[record.data_collection_level] = record.level_count;
    });

    return aggregated;
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
  private mapDbRowToEntity(row: any): LearnerDNAProfile {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      learningVelocityValue: row.learning_velocity_value,
      learningVelocityConfidence: row.learning_velocity_confidence,
      learningVelocityDataPoints: row.learning_velocity_data_points,
      learningVelocityLastUpdated: new Date(row.learning_velocity_last_updated),
      memoryRetentionValue: row.memory_retention_value,
      memoryRetentionConfidence: row.memory_retention_confidence,
      memoryRetentionDataPoints: row.memory_retention_data_points,
      memoryRetentionLastUpdated: new Date(row.memory_retention_last_updated),
      struggleThresholdValue: row.struggle_threshold_value,
      struggleThresholdConfidence: row.struggle_threshold_confidence,
      struggleThresholdDataPoints: row.struggle_threshold_data_points,
      struggleThresholdLastUpdated: new Date(row.struggle_threshold_last_updated),
      cognitiveAttributes: JSON.parse(row.cognitive_attributes || '{}'),
      comprehensionStyles: JSON.parse(row.comprehension_styles || '[]'),
      preferredModalities: JSON.parse(row.preferred_modalities || '[]'),
      profileConfidence: row.profile_confidence,
      totalDataPoints: row.total_data_points,
      analysisQualityScore: row.analysis_quality_score,
      crossCoursePatterns: JSON.parse(row.cross_course_patterns || '{}'),
      multiContextConfidence: row.multi_context_confidence,
      dataCollectionLevel: row.data_collection_level,
      profileVisibility: row.profile_visibility,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastAnalyzedAt: new Date(row.last_analyzed_at),
    };
  }
}