/**
 * @fileoverview Repository for Canvas content reference data access operations.
 * @module features/canvas-integration/server/repositories/ContentReferenceRepository
 *
 * Handles persistent storage of Canvas content references with proper privacy
 * compliance, data validation, and performance optimization for assessment context.
 */

import { BaseRepository } from '@shared/server/repositories/BaseRepository';
import { DatabaseService } from '@shared/server/services/database';
import { CanvasContentReferenceSchema } from '../../shared/types';
import type { CanvasContentReference } from '../../shared/types';

/**
 * Repository for Canvas content reference data access operations.
 *
 * Manages Canvas content metadata for assessment context generation,
 * ensuring FERPA compliance and proper data retention policies.
 */
export class ContentReferenceRepository extends BaseRepository<CanvasContentReference> {
  constructor(databaseService: DatabaseService) {
    super(databaseService, 'canvas_content_references', CanvasContentReferenceSchema);
  }

  protected async performCreate(contentRef: CanvasContentReference): Promise<CanvasContentReference> {
    await this.getDb()
      .prepare(`
        INSERT INTO canvas_content_references (
          id, student_id, course_id, content_type, content_id,
          content_title, content_url, extracted_at, metadata, privacy_settings, retention_expires
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        contentRef.id,
        contentRef.studentId,
        contentRef.courseId,
        contentRef.contentType,
        contentRef.contentId,
        contentRef.contentTitle || null,
        contentRef.contentUrl || null,
        contentRef.extractedAt.toISOString(),
        JSON.stringify(contentRef.metadata),
        JSON.stringify(contentRef.privacy),
        contentRef.privacy.retentionExpires.toISOString()
      )
      .run();

    return contentRef;
  }

  protected async performUpdate(id: string, updates: Partial<CanvasContentReference>): Promise<CanvasContentReference> {
    const updateFields: string[] = [];
    const values: unknown[] = [];

    const fieldMappings: Record<string, (value: any) => any> = {
      contentTitle: (v) => v,
      contentUrl: (v) => v,
      metadata: (v) => JSON.stringify(v),
      privacy: (v) => JSON.stringify(v),
      extractedAt: (v) => v.toISOString(),
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

    values.push(id); // Add ID for WHERE clause

    await this.getDb()
      .prepare(`UPDATE canvas_content_references SET ${updateFields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    const updated = await this.findById(id);
    if (!updated) throw new Error(`Content reference ${id} not found after update`);

    return updated;
  }

  /**
   * Find content references by student ID
   */
  async findByStudentId(
    studentId: string,
    options: {
      courseId?: string;
      contentType?: CanvasContentReference['contentType'];
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<CanvasContentReference[]> {
    const { courseId, contentType, limit = 50, offset = 0 } = options;

    let query = 'SELECT * FROM canvas_content_references WHERE student_id = ?';
    const bindings: unknown[] = [studentId];

    if (courseId) {
      query += ' AND course_id = ?';
      bindings.push(courseId);
    }

    if (contentType) {
      query += ' AND content_type = ?';
      bindings.push(contentType);
    }

    // Only include non-expired content
    query += ' AND (retention_expires IS NULL OR retention_expires > CURRENT_TIMESTAMP)';
    query += ' ORDER BY extracted_at DESC LIMIT ? OFFSET ?';
    bindings.push(limit, offset);

    const results = await this.getDb()
      .prepare(query)
      .bind(...bindings)
      .all();

    return results.results.map(result => this.mapDbRowToEntity(result));
  }

  /**
   * Find content reference by content ID and student
   */
  async findByContentId(
    studentId: string,
    courseId: string,
    contentId: string
  ): Promise<CanvasContentReference | null> {
    const result = await this.getDb()
      .prepare(`
        SELECT * FROM canvas_content_references
        WHERE student_id = ? AND course_id = ? AND content_id = ?
        AND (retention_expires IS NULL OR retention_expires > CURRENT_TIMESTAMP)
        ORDER BY extracted_at DESC LIMIT 1
      `)
      .bind(studentId, courseId, contentId)
      .first();

    if (!result) return null;
    return this.mapDbRowToEntity(result);
  }

  /**
   * Find recent content for assessment context
   */
  async findRecentForAssessment(
    studentId: string,
    courseId: string,
    limitHours: number = 24,
    limit: number = 10
  ): Promise<CanvasContentReference[]> {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - limitHours);

    const results = await this.getDb()
      .prepare(`
        SELECT * FROM canvas_content_references
        WHERE student_id = ? AND course_id = ?
        AND extracted_at > ?
        AND (retention_expires IS NULL OR retention_expires > CURRENT_TIMESTAMP)
        ORDER BY extracted_at DESC
        LIMIT ?
      `)
      .bind(studentId, courseId, cutoffTime.toISOString(), limit)
      .all();

    return results.results.map(result => this.mapDbRowToEntity(result));
  }

  /**
   * Find content by learning objectives
   */
  async findByLearningObjectives(
    studentId: string,
    objectives: string[],
    courseId?: string
  ): Promise<CanvasContentReference[]> {
    let query = `
      SELECT * FROM canvas_content_references
      WHERE student_id = ?
      AND (retention_expires IS NULL OR retention_expires > CURRENT_TIMESTAMP)
    `;
    const bindings: unknown[] = [studentId];

    if (courseId) {
      query += ' AND course_id = ?';
      bindings.push(courseId);
    }

    // Use JSON search for learning objectives
    const objectiveConditions = objectives.map(() =>
      'json_extract(metadata, \'$.learningObjectives\') LIKE ?'
    ).join(' OR ');

    if (objectiveConditions) {
      query += ` AND (${objectiveConditions})`;
      objectives.forEach(obj => bindings.push(`%"${obj}"%`));
    }

    query += ' ORDER BY extracted_at DESC';

    const results = await this.getDb()
      .prepare(query)
      .bind(...bindings)
      .all();

    return results.results.map(result => this.mapDbRowToEntity(result));
  }

  /**
   * Find content requiring consent for cross-course sharing
   */
  async findRequiringConsent(
    studentId: string,
    targetCourseId: string
  ): Promise<CanvasContentReference[]> {
    const results = await this.getDb()
      .prepare(`
        SELECT * FROM canvas_content_references
        WHERE student_id = ?
        AND course_id != ?
        AND json_extract(privacy_settings, '$.consentRequired') = 1
        AND (retention_expires IS NULL OR retention_expires > CURRENT_TIMESTAMP)
        ORDER BY extracted_at DESC
      `)
      .bind(studentId, targetCourseId)
      .all();

    return results.results.map(result => this.mapDbRowToEntity(result));
  }

  /**
   * Update content metadata with analysis results
   */
  async updateMetadata(
    id: string,
    metadata: CanvasContentReference['metadata']
  ): Promise<void> {
    await this.getDb()
      .prepare(`
        UPDATE canvas_content_references
        SET metadata = ?
        WHERE id = ?
      `)
      .bind(JSON.stringify(metadata), id)
      .run();
  }

  /**
   * Anonymize content for analytics
   */
  async anonymizeContent(id: string): Promise<void> {
    const contentRef = await this.findById(id);
    if (!contentRef) {
      throw new Error(`Content reference ${id} not found`);
    }

    const anonymizedPrivacy = {
      ...contentRef.privacy,
      anonymized: true,
    };

    await this.update(id, {
      privacy: anonymizedPrivacy,
      contentTitle: undefined, // Remove PII
      contentUrl: undefined,   // Remove PII
    });
  }

  /**
   * Clean up expired content references
   */
  async cleanupExpiredContent(): Promise<number> {
    const result = await this.getDb()
      .prepare(`
        DELETE FROM canvas_content_references
        WHERE retention_expires IS NOT NULL
        AND retention_expires < CURRENT_TIMESTAMP
      `)
      .run();

    return result.changes || 0;
  }

  /**
   * Get content statistics for a student
   */
  async getContentStatistics(
    studentId: string,
    courseId?: string
  ): Promise<{
    totalContent: number;
    contentByType: Record<string, number>;
    recentActivity: number; // Last 7 days
    conceptCoverage: string[];
  }> {
    let query = `
      SELECT
        COUNT(*) as total_content,
        content_type,
        COUNT(*) as type_count,
        MAX(extracted_at) as latest_extraction
      FROM canvas_content_references
      WHERE student_id = ?
      AND (retention_expires IS NULL OR retention_expires > CURRENT_TIMESTAMP)
    `;
    const bindings: unknown[] = [studentId];

    if (courseId) {
      query += ' AND course_id = ?';
      bindings.push(courseId);
    }

    query += ' GROUP BY content_type';

    const typeResults = await this.getDb()
      .prepare(query)
      .bind(...bindings)
      .all();

    // Get recent activity count (last 7 days)
    const recentCutoff = new Date();
    recentCutoff.setDate(recentCutoff.getDate() - 7);

    let recentQuery = `
      SELECT COUNT(*) as recent_count
      FROM canvas_content_references
      WHERE student_id = ? AND extracted_at > ?
      AND (retention_expires IS NULL OR retention_expires > CURRENT_TIMESTAMP)
    `;
    const recentBindings: unknown[] = [studentId, recentCutoff.toISOString()];

    if (courseId) {
      recentQuery += ' AND course_id = ?';
      recentBindings.push(courseId);
    }

    const recentResult = await this.getDb()
      .prepare(recentQuery)
      .bind(...recentBindings)
      .first() as { recent_count: number } | null;

    // Aggregate concept coverage
    const allContent = await this.findByStudentId(studentId, { courseId });
    const conceptCoverage = new Set<string>();

    allContent.forEach(content => {
      if (content.metadata.concepts) {
        content.metadata.concepts.forEach(concept => conceptCoverage.add(concept));
      }
    });

    const contentByType: Record<string, number> = {};
    let totalContent = 0;

    typeResults.results.forEach(row => {
      const record = row as any;
      contentByType[record.content_type] = record.type_count;
      totalContent += record.type_count;
    });

    return {
      totalContent,
      contentByType,
      recentActivity: recentResult?.recent_count || 0,
      conceptCoverage: Array.from(conceptCoverage),
    };
  }

  /**
   * Helper method to convert camelCase to snake_case
   */
  private camelToSnakeCase(camelCase: string): string {
    return camelCase.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  /**
   * Helper method to map database row to entity
   */
  private mapDbRowToEntity(row: any): CanvasContentReference {
    return {
      id: row.id,
      studentId: row.student_id,
      courseId: row.course_id,
      contentType: row.content_type,
      contentId: row.content_id,
      contentTitle: row.content_title,
      contentUrl: row.content_url,
      extractedAt: new Date(row.extracted_at),
      metadata: JSON.parse(row.metadata || '{}'),
      privacy: JSON.parse(row.privacy_settings || '{}'),
    };
  }
}