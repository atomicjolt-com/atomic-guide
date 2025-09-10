/**
 * @fileoverview Cross-Course Alert Repository for managing instructor alerts
 * 
 * Provides data access layer for cross-course gap alerts, alert effectiveness tracking,
 * and batch alert processing.
 */

import type {
  CrossCourseGapAlert,
  StudentId,
  CourseId
} from '../shared/types';

// ============================================================================
// Repository Interface
// ============================================================================

interface DatabaseService {
  getDb(): D1Database;
}

interface AlertQuery {
  instructorId?: string;
  studentId?: StudentId;
  courseId?: CourseId;
  status?: 'pending' | 'acknowledged' | 'resolved' | 'dismissed';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  wasActedUpon?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
  offset?: number;
}

interface AlertEffectivenessReport {
  alertId: string;
  wasActedUpon: boolean;
  interventionType?: string;
  studentOutcome: 'improved' | 'no_change' | 'declined';
  timeToAction?: number;
  feedbackRating?: number;
  comments?: string;
  reportedAt: Date;
}

// ============================================================================
// Main Repository Class
// ============================================================================

/**
 * Cross-Course Alert Repository
 * 
 * Manages persistent storage and retrieval of instructor gap alerts
 * and effectiveness tracking data.
 */
export class CrossCourseAlertRepository {
  private db: DatabaseService;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  // ========================================================================
  // Core CRUD Operations
  // ========================================================================

  /**
   * Create new gap alert
   */
  async create(alert: Omit<CrossCourseGapAlert, 'id'>): Promise<CrossCourseGapAlert> {
    try {
      const id = this.generateAlertId();
      const fullAlert: CrossCourseGapAlert = { id, ...alert };

      await this.db.getDb()
        .prepare(`
          INSERT INTO cross_course_gap_alerts 
          (id, student_id, course_id, instructor_id, gap_type, gap_severity, 
           predicted_impact, intervention_recommendations, time_window_days, 
           status, created_at, acknowledged_at, resolved_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          fullAlert.id,
          fullAlert.studentId,
          fullAlert.courseId,
          fullAlert.instructorId,
          fullAlert.gapType,
          fullAlert.gapSeverity,
          JSON.stringify(fullAlert.predictedImpact),
          JSON.stringify(fullAlert.interventionRecommendations),
          fullAlert.timeWindowDays,
          fullAlert.status || 'pending',
          fullAlert.createdAt.toISOString(),
          fullAlert.acknowledgedAt?.toISOString() || null,
          fullAlert.resolvedAt?.toISOString() || null
        )
        .run();

      return fullAlert;
    } catch (error) {
      console.error('Failed to create alert:', error);
      throw error;
    }
  }

  /**
   * Update existing alert
   */
  async update(id: string, updates: Partial<CrossCourseGapAlert>): Promise<CrossCourseGapAlert | null> {
    try {
      const updateFields: string[] = [];
      const params: unknown[] = [];

      if (updates.status !== undefined) {
        updateFields.push('status = ?');
        params.push(updates.status);
      }

      if (updates.acknowledgedAt !== undefined) {
        updateFields.push('acknowledged_at = ?');
        params.push(updates.acknowledgedAt?.toISOString() || null);
      }

      if (updates.resolvedAt !== undefined) {
        updateFields.push('resolved_at = ?');
        params.push(updates.resolvedAt?.toISOString() || null);
      }

      if (updateFields.length === 0) {
        return this.findById(id);
      }

      const sql = `
        UPDATE cross_course_gap_alerts 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `;
      params.push(id);

      await this.db.getDb().prepare(sql).bind(...params).run();
      return this.findById(id);
    } catch (error) {
      console.error('Failed to update alert:', error);
      throw error;
    }
  }

  /**
   * Find alert by ID
   */
  async findById(id: string): Promise<CrossCourseGapAlert | null> {
    try {
      const result = await this.db.getDb()
        .prepare('SELECT * FROM cross_course_gap_alerts WHERE id = ?')
        .bind(id)
        .first();

      return result ? this.mapRowToAlert(result) : null;
    } catch (error) {
      console.error('Failed to find alert by ID:', error);
      throw error;
    }
  }

  /**
   * Find alerts with flexible querying
   */
  async find(query: AlertQuery = {}): Promise<CrossCourseGapAlert[]> {
    try {
      let sql = 'SELECT * FROM cross_course_gap_alerts WHERE 1=1';
      const params: unknown[] = [];

      if (query.instructorId) {
        sql += ' AND instructor_id = ?';
        params.push(query.instructorId);
      }

      if (query.studentId) {
        sql += ' AND student_id = ?';
        params.push(query.studentId);
      }

      if (query.courseId) {
        sql += ' AND course_id = ?';
        params.push(query.courseId);
      }

      if (query.status) {
        sql += ' AND status = ?';
        params.push(query.status);
      }

      if (query.severity) {
        sql += ' AND gap_severity = ?';
        params.push(query.severity);
      }

      if (query.wasActedUpon !== undefined) {
        sql += ' AND was_acted_upon = ?';
        params.push(query.wasActedUpon);
      }

      if (query.createdAfter) {
        sql += ' AND created_at >= ?';
        params.push(query.createdAfter.toISOString());
      }

      if (query.createdBefore) {
        sql += ' AND created_at <= ?';
        params.push(query.createdBefore.toISOString());
      }

      sql += ' ORDER BY created_at DESC';

      if (query.limit) {
        sql += ' LIMIT ?';
        params.push(query.limit);

        if (query.offset) {
          sql += ' OFFSET ?';
          params.push(query.offset);
        }
      }

      const results = await this.db.getDb().prepare(sql).bind(...params).all();
      return results.results?.map(row => this.mapRowToAlert(row)) || [];
    } catch (error) {
      console.error('Failed to find alerts:', error);
      throw error;
    }
  }

  /**
   * Count alerts matching query
   */
  async count(query: AlertQuery = {}): Promise<number> {
    try {
      let sql = 'SELECT COUNT(*) as count FROM cross_course_gap_alerts WHERE 1=1';
      const params: unknown[] = [];

      if (query.instructorId) {
        sql += ' AND instructor_id = ?';
        params.push(query.instructorId);
      }

      if (query.studentId) {
        sql += ' AND student_id = ?';
        params.push(query.studentId);
      }

      if (query.courseId) {
        sql += ' AND course_id = ?';
        params.push(query.courseId);
      }

      if (query.status) {
        sql += ' AND status = ?';
        params.push(query.status);
      }

      if (query.severity) {
        sql += ' AND gap_severity = ?';
        params.push(query.severity);
      }

      const result = await this.db.getDb().prepare(sql).bind(...params).first();
      return result?.count as number || 0;
    } catch (error) {
      console.error('Failed to count alerts:', error);
      throw error;
    }
  }

  // ========================================================================
  // Effectiveness Tracking
  // ========================================================================

  /**
   * Record alert effectiveness report
   */
  async recordEffectivenessReport(report: AlertEffectivenessReport): Promise<void> {
    try {
      await this.db.getDb()
        .prepare(`
          INSERT INTO alert_effectiveness_reports 
          (alert_id, was_acted_upon, intervention_type, student_outcome,
           time_to_action, feedback_rating, comments, reported_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          report.alertId,
          report.wasActedUpon,
          report.interventionType || null,
          report.studentOutcome,
          report.timeToAction || null,
          report.feedbackRating || null,
          report.comments || null,
          report.reportedAt.toISOString()
        )
        .run();

      // Update alert with effectiveness data
      await this.db.getDb()
        .prepare('UPDATE cross_course_gap_alerts SET was_acted_upon = ? WHERE id = ?')
        .bind(report.wasActedUpon, report.alertId)
        .run();
    } catch (error) {
      console.error('Failed to record effectiveness report:', error);
      throw error;
    }
  }

  /**
   * Get effectiveness statistics
   */
  async getEffectivenessStatistics(timeframeDays = 30): Promise<{
    totalAlerts: number;
    actionRate: number;
    averageTimeToAction: number;
    outcomeDistribution: {
      improved: number;
      no_change: number;
      declined: number;
    };
    averageFeedbackRating: number;
  }> {
    try {
      const sinceDate = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000);

      // Get total alerts
      const totalResult = await this.db.getDb()
        .prepare('SELECT COUNT(*) as count FROM cross_course_gap_alerts WHERE created_at >= ?')
        .bind(sinceDate.toISOString())
        .first();

      const totalAlerts = totalResult?.count as number || 0;

      // Get effectiveness metrics
      const effectivenessResult = await this.db.getDb()
        .prepare(`
          SELECT 
            COUNT(*) as total_reports,
            SUM(CASE WHEN was_acted_upon = 1 THEN 1 ELSE 0 END) as acted_upon,
            AVG(time_to_action) as avg_time_to_action,
            AVG(feedback_rating) as avg_rating,
            SUM(CASE WHEN student_outcome = 'improved' THEN 1 ELSE 0 END) as improved,
            SUM(CASE WHEN student_outcome = 'no_change' THEN 1 ELSE 0 END) as no_change,
            SUM(CASE WHEN student_outcome = 'declined' THEN 1 ELSE 0 END) as declined
          FROM alert_effectiveness_reports
          WHERE reported_at >= ?
        `)
        .bind(sinceDate.toISOString())
        .first();

      return {
        totalAlerts,
        actionRate: totalAlerts > 0 ? (effectivenessResult?.acted_upon as number || 0) / totalAlerts : 0,
        averageTimeToAction: effectivenessResult?.avg_time_to_action as number || 0,
        outcomeDistribution: {
          improved: effectivenessResult?.improved as number || 0,
          no_change: effectivenessResult?.no_change as number || 0,
          declined: effectivenessResult?.declined as number || 0
        },
        averageFeedbackRating: effectivenessResult?.avg_rating as number || 0
      };
    } catch (error) {
      console.error('Failed to get effectiveness statistics:', error);
      throw error;
    }
  }

  // ========================================================================
  // Batch Operations
  // ========================================================================

  /**
   * Create multiple alerts in batch
   */
  async createBatch(alerts: Array<Omit<CrossCourseGapAlert, 'id'>>): Promise<CrossCourseGapAlert[]> {
    const results: CrossCourseGapAlert[] = [];
    
    for (const alert of alerts) {
      try {
        const created = await this.create(alert);
        results.push(created);
      } catch (error) {
        console.error('Failed to create alert in batch:', error);
      }
    }
    
    return results;
  }

  /**
   * Delete alerts for a student
   */
  async deleteStudentAlerts(studentId: StudentId): Promise<number> {
    try {
      const result = await this.db.getDb()
        .prepare('DELETE FROM cross_course_gap_alerts WHERE student_id = ?')
        .bind(studentId)
        .run();

      return result.changes || 0;
    } catch (error) {
      console.error('Failed to delete student alerts:', error);
      throw error;
    }
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private mapRowToAlert(row: Record<string, unknown>): CrossCourseGapAlert {
    return {
      id: row.id as string,
      studentId: row.student_id as StudentId,
      courseId: row.course_id as CourseId,
      instructorId: row.instructor_id as string,
      gapType: row.gap_type as string,
      gapSeverity: row.gap_severity as CrossCourseGapAlert['gapSeverity'],
      predictedImpact: JSON.parse(row.predicted_impact as string),
      interventionRecommendations: JSON.parse(row.intervention_recommendations as string),
      timeWindowDays: row.time_window_days as number,
      status: row.status as CrossCourseGapAlert['status'],
      createdAt: new Date(row.created_at as string),
      acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at as string) : undefined,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at as string) : undefined
    };
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}