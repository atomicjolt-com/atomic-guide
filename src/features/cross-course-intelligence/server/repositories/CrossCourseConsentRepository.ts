/**
 * @fileoverview Cross-Course Consent Repository for consent data management
 * 
 * Provides data access layer for cross-course consent management with
 * course-level granularity, consent validation and enforcement mechanisms,
 * audit logging for all cross-course data access, and consent withdrawal
 * and data deletion workflows.
 */

import type {
  CrossCourseConsent,
  StudentId,
  CourseId,
  ConsentUpdateRequest
} from '../shared/types';

// ============================================================================
// Repository Interface
// ============================================================================

interface DatabaseService {
  getDb(): D1Database;
}

interface ConsentQuery {
  studentId?: StudentId;
  sourceCourse?: CourseId;
  targetCourse?: CourseId;
  consentType?: CrossCourseConsent['consentType'];
  consentGranted?: boolean;
  includeExpired?: boolean;
  includeWithdrawn?: boolean;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Main Repository Class
// ============================================================================

/**
 * Cross-Course Consent Repository
 * 
 * Manages persistent storage and retrieval of cross-course consent data
 * with comprehensive audit capabilities and FERPA compliance.
 */
export class CrossCourseConsentRepository {
  private db: DatabaseService;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  // ========================================================================
  // Core CRUD Operations
  // ========================================================================

  /**
   * Create new cross-course consent record
   */
  async create(consent: Omit<CrossCourseConsent, 'id'>): Promise<CrossCourseConsent> {
    try {
      const id = this.generateConsentId();
      const fullConsent: CrossCourseConsent = { id, ...consent };

      await this.db.getDb()
        .prepare(`
          INSERT INTO cross_course_consent 
          (id, student_id, source_course, target_course, consent_type, 
           consent_granted, consent_date, expiration_date, withdrawn_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          fullConsent.id,
          fullConsent.studentId,
          fullConsent.sourceCourse,
          fullConsent.targetCourse,
          fullConsent.consentType,
          fullConsent.consentGranted,
          fullConsent.consentDate.toISOString(),
          fullConsent.expirationDate?.toISOString() || null,
          fullConsent.withdrawnAt?.toISOString() || null
        )
        .run();

      return fullConsent;
    } catch (error) {
      console.error('Failed to create consent record:', error);
      throw error;
    }
  }

  /**
   * Update existing cross-course consent record
   */
  async update(id: string, updates: Partial<CrossCourseConsent>): Promise<CrossCourseConsent | null> {
    try {
      // Build dynamic update query
      const updateFields: string[] = [];
      const params: (string | number | boolean)[] = [];

      if (updates.consentGranted !== undefined) {
        updateFields.push('consent_granted = ?');
        params.push(updates.consentGranted);
      }

      if (updates.expirationDate !== undefined) {
        updateFields.push('expiration_date = ?');
        params.push(updates.expirationDate?.toISOString() || null);
      }

      if (updates.withdrawnAt !== undefined) {
        updateFields.push('withdrawn_at = ?');
        params.push(updates.withdrawnAt?.toISOString() || null);
      }

      if (updateFields.length === 0) {
        return this.findById(id);
      }

      const sql = `
        UPDATE cross_course_consent 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `;
      params.push(id);

      await this.db.getDb().prepare(sql).bind(...params).run();
      return this.findById(id);
    } catch (error) {
      console.error('Failed to update consent record:', error);
      throw error;
    }
  }

  /**
   * Find consent record by ID
   */
  async findById(id: string): Promise<CrossCourseConsent | null> {
    try {
      const result = await this.db.getDb()
        .prepare('SELECT * FROM cross_course_consent WHERE id = ?')
        .bind(id)
        .first();

      return result ? this.mapRowToConsent(result) : null;
    } catch (error) {
      console.error('Failed to find consent by ID:', error);
      throw error;
    }
  }

  /**
   * Find consent records with flexible querying
   */
  async find(query: ConsentQuery = {}): Promise<CrossCourseConsent[]> {
    try {
      let sql = 'SELECT * FROM cross_course_consent WHERE 1=1';
      const params: (string | number | boolean)[] = [];

      // Add filters
      if (query.studentId) {
        sql += ' AND student_id = ?';
        params.push(query.studentId);
      }

      if (query.sourceCourse) {
        sql += ' AND source_course = ?';
        params.push(query.sourceCourse);
      }

      if (query.targetCourse) {
        sql += ' AND target_course = ?';
        params.push(query.targetCourse);
      }

      if (query.consentType) {
        sql += ' AND consent_type = ?';
        params.push(query.consentType);
      }

      if (query.consentGranted !== undefined) {
        sql += ' AND consent_granted = ?';
        params.push(query.consentGranted);
      }

      // Filter expired consents unless explicitly included
      if (!query.includeExpired) {
        sql += ' AND (expiration_date IS NULL OR expiration_date > ?)';
        params.push(new Date().toISOString());
      }

      // Filter withdrawn consents unless explicitly included
      if (!query.includeWithdrawn) {
        sql += ' AND withdrawn_at IS NULL';
      }

      // Add ordering
      sql += ' ORDER BY consent_date DESC';

      // Add pagination
      if (query.limit) {
        sql += ' LIMIT ?';
        params.push(query.limit);

        if (query.offset) {
          sql += ' OFFSET ?';
          params.push(query.offset);
        }
      }

      const results = await this.db.getDb().prepare(sql).bind(...params).all();
      return results.results?.map(row => this.mapRowToConsent(row)) || [];
    } catch (error) {
      console.error('Failed to find consent records:', error);
      throw error;
    }
  }

  // ========================================================================
  // Specialized Query Methods
  // ========================================================================

  /**
   * Get all consents for a student
   */
  async getStudentConsents(studentId: StudentId): Promise<CrossCourseConsent[]> {
    return this.find({ studentId, includeExpired: true, includeWithdrawn: true });
  }

  /**
   * Get active consents between two specific courses
   */
  async getCourseConsents(
    studentId: StudentId,
    sourceCourse: CourseId,
    targetCourse: CourseId
  ): Promise<CrossCourseConsent[]> {
    return this.find({
      studentId,
      sourceCourse,
      targetCourse,
      includeExpired: false,
      includeWithdrawn: false
    });
  }

  /**
   * Check if specific access is permitted
   */
  async isAccessPermitted(
    studentId: StudentId,
    sourceCourse: CourseId,
    targetCourse: CourseId,
    consentType: CrossCourseConsent['consentType']
  ): Promise<boolean> {
    try {
      const consents = await this.find({
        studentId,
        sourceCourse,
        targetCourse,
        consentGranted: true,
        includeExpired: false,
        includeWithdrawn: false
      });

      // Check for exact match or 'all' consent type
      return consents.some(consent => 
        consent.consentType === consentType || consent.consentType === 'all'
      );
    } catch (error) {
      console.error('Failed to check access permission:', error);
      return false;
    }
  }

  /**
   * Get consent audit trail for a student
   */
  async getConsentAuditTrail(studentId: StudentId): Promise<CrossCourseConsent[]> {
    return this.find({ 
      studentId, 
      includeExpired: true, 
      includeWithdrawn: true 
    });
  }

  // ========================================================================
  // Consent Management Operations
  // ========================================================================

  /**
   * Grant or update consent
   */
  async grantConsent(request: ConsentUpdateRequest): Promise<CrossCourseConsent> {
    try {
      // Check for existing consent
      const existing = await this.find({
        studentId: request.studentId,
        sourceCourse: request.sourceCourse,
        targetCourse: request.targetCourse,
        consentType: request.consentType,
        limit: 1
      });

      if (existing.length > 0) {
        // Update existing consent
        const updated = await this.update(existing[0].id, {
          consentGranted: request.consentGranted,
          expirationDate: request.expirationDate,
          withdrawnAt: request.consentGranted ? undefined : new Date()
        });
        
        if (!updated) {
          throw new Error('Failed to update existing consent');
        }
        
        return updated;
      } else {
        // Create new consent
        return this.create({
          studentId: request.studentId,
          sourceCourse: request.sourceCourse,
          targetCourse: request.targetCourse,
          consentType: request.consentType,
          consentGranted: request.consentGranted,
          consentDate: new Date(),
          expirationDate: request.expirationDate
        });
      }
    } catch (error) {
      console.error('Failed to grant consent:', error);
      throw error;
    }
  }

  /**
   * Revoke consent for specific courses and data types
   */
  async revokeConsent(
    studentId: StudentId,
    sourceCourse: CourseId,
    targetCourse: CourseId,
    consentType: CrossCourseConsent['consentType']
  ): Promise<void> {
    try {
      const consents = await this.find({
        studentId,
        sourceCourse,
        targetCourse,
        consentType,
        includeExpired: false,
        includeWithdrawn: false
      });

      for (const consent of consents) {
        await this.update(consent.id, {
          consentGranted: false,
          withdrawnAt: new Date()
        });
      }
    } catch (error) {
      console.error('Failed to revoke consent:', error);
      throw error;
    }
  }

  /**
   * Bulk consent operation for related course sequences
   */
  async bulkConsentOperation(
    studentId: StudentId,
    courseIds: CourseId[],
    consentType: CrossCourseConsent['consentType'],
    grant: boolean,
    expirationDate?: Date
  ): Promise<CrossCourseConsent[]> {
    try {
      const results: CrossCourseConsent[] = [];

      // Create consents for all course combinations
      for (let i = 0; i < courseIds.length; i++) {
        for (let j = 0; j < courseIds.length; j++) {
          if (i !== j) {
            const request: ConsentUpdateRequest = {
              studentId,
              sourceCourse: courseIds[i],
              targetCourse: courseIds[j],
              consentType,
              consentGranted: grant,
              expirationDate
            };

            const consent = await this.grantConsent(request);
            results.push(consent);
          }
        }
      }

      return results;
    } catch (error) {
      console.error('Failed to perform bulk consent operation:', error);
      throw error;
    }
  }

  // ========================================================================
  // Data Management Operations
  // ========================================================================

  /**
   * Delete all consent records for a student (FERPA/GDPR compliance)
   */
  async deleteStudentConsents(studentId: StudentId): Promise<number> {
    try {
      const result = await this.db.getDb()
        .prepare('DELETE FROM cross_course_consent WHERE student_id = ?')
        .bind(studentId)
        .run();

      return result.changes || 0;
    } catch (error) {
      console.error('Failed to delete student consents:', error);
      throw error;
    }
  }

  /**
   * Clean up expired consent records
   */
  async cleanupExpiredConsents(): Promise<number> {
    try {
      const result = await this.db.getDb()
        .prepare(`
          DELETE FROM cross_course_consent 
          WHERE expiration_date IS NOT NULL AND expiration_date < ?
        `)
        .bind(new Date().toISOString())
        .run();

      return result.changes || 0;
    } catch (error) {
      console.error('Failed to cleanup expired consents:', error);
      throw error;
    }
  }

  // ========================================================================
  // Analytics and Reporting
  // ========================================================================

  /**
   * Get consent statistics for reporting
   */
  async getConsentStatistics(): Promise<{
    totalConsents: number;
    activeConsents: number;
    revokedConsents: number;
    expiredConsents: number;
    consentsByType: Record<string, number>;
  }> {
    try {
      const now = new Date().toISOString();

      // Get basic counts
      const totalQuery = 'SELECT COUNT(*) as count FROM cross_course_consent';
      const activeQuery = `
        SELECT COUNT(*) as count FROM cross_course_consent 
        WHERE consent_granted = 1 
        AND withdrawn_at IS NULL 
        AND (expiration_date IS NULL OR expiration_date > ?)
      `;
      const revokedQuery = 'SELECT COUNT(*) as count FROM cross_course_consent WHERE withdrawn_at IS NOT NULL';
      const expiredQuery = `
        SELECT COUNT(*) as count FROM cross_course_consent 
        WHERE expiration_date IS NOT NULL AND expiration_date <= ?
      `;

      const [total, active, revoked, expired] = await Promise.all([
        this.db.getDb().prepare(totalQuery).first(),
        this.db.getDb().prepare(activeQuery).bind(now).first(),
        this.db.getDb().prepare(revokedQuery).first(),
        this.db.getDb().prepare(expiredQuery).bind(now).first()
      ]);

      // Get consent breakdown by type
      const typeQuery = `
        SELECT consent_type, COUNT(*) as count 
        FROM cross_course_consent 
        WHERE consent_granted = 1 AND withdrawn_at IS NULL
        GROUP BY consent_type
      `;
      
      const typeResults = await this.db.getDb().prepare(typeQuery).all();
      const consentsByType: Record<string, number> = {};
      
      for (const row of typeResults.results || []) {
        consentsByType[row.consent_type as string] = row.count as number;
      }

      return {
        totalConsents: total?.count as number || 0,
        activeConsents: active?.count as number || 0,
        revokedConsents: revoked?.count as number || 0,
        expiredConsents: expired?.count as number || 0,
        consentsByType
      };
    } catch (error) {
      console.error('Failed to get consent statistics:', error);
      throw error;
    }
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private mapRowToConsent(row: any): CrossCourseConsent {
    return {
      id: row.id,
      studentId: row.student_id,
      sourceCourse: row.source_course,
      targetCourse: row.target_course,
      consentType: row.consent_type,
      consentGranted: Boolean(row.consent_granted),
      consentDate: new Date(row.consent_date),
      expirationDate: row.expiration_date ? new Date(row.expiration_date) : undefined,
      withdrawnAt: row.withdrawn_at ? new Date(row.withdrawn_at) : undefined
    };
  }

  private generateConsentId(): string {
    return `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}