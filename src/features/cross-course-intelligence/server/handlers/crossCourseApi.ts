/**
 * @fileoverview Cross-Course Intelligence API Handlers
 * Provides REST endpoints for cross-course analytics, gap detection, and consent management
 * 
 * Handles cross-course knowledge graph queries, academic risk assessment,
 * prerequisite gap analysis, and privacy-compliant data sharing controls.
 */

import { Context, Handler } from 'hono';
import { DatabaseService } from '../../../../shared/server/services/database.js';
import { KnowledgeGraphRepository } from '../repositories/KnowledgeGraphRepository.js';
import { KnowledgeDependencyMapper } from '../services/KnowledgeDependencyMapper.js';
import { PrerequisiteGapAnalyzer } from '../services/PrerequisiteGapAnalyzer.js';
import { CrossCourseAnalyticsEngine } from '../services/CrossCourseAnalyticsEngine.js';

import {
  CrossCourseAnalyticsRequest,
  CrossCourseAnalyticsResponse,
  ConsentUpdateRequest,
  GapAnalysisRequest,
  InstructorAlertQuery,
  CrossCourseConsent,
  CrossCourseGapAlert,
  CrossCourseError
} from '../../shared/types/index.js';

import {
  CrossCourseAnalyticsRequestSchema,
  ConsentUpdateRequestSchema,
  GapAnalysisRequestSchema,
  InstructorAlertQuerySchema,
  validateSafely
} from '../../shared/schemas/cross-course.schema.js';

/**
 * Cross-course intelligence API handlers
 */
export class CrossCourseApiHandlers {
  constructor(
    private db: DatabaseService,
    private knowledgeGraphRepo: KnowledgeGraphRepository,
    private dependencyMapper: KnowledgeDependencyMapper,
    private gapAnalyzer: PrerequisiteGapAnalyzer,
    private analyticsEngine: CrossCourseAnalyticsEngine
  ) {}

  /**
   * GET /api/cross-course/analytics/:studentId
   * Retrieves comprehensive cross-course analytics for a student
   */
  getCrossCourseAnalytics: Handler = async (c: Context) => {
    try {
      const studentId = c.req.param('studentId');
      const query = c.req.query();
      
      if (!studentId) {
        return c.json({ error: 'Student ID is required' }, 400);
      }

      // Build request from query parameters
      const request: CrossCourseAnalyticsRequest = {
        studentId,
        includeHistorical: query.includeHistorical === 'true',
        courseFilters: query.courseFilters ? query.courseFilters.split(',') : undefined,
        analysisDepth: (query.analysisDepth as 'basic' | 'detailed' | 'comprehensive') || 'detailed'
      };

      // Validate request
      const validation = validateSafely(CrossCourseAnalyticsRequestSchema, request);
      if (!validation.success) {
        return c.json({ 
          error: 'Invalid request parameters', 
          details: validation.error.errors 
        }, 400);
      }

      // Generate analytics
      const result = await this.analyticsEngine.generateCrossCourseAnalytics(request);
      
      if (!result.success) {
        return this.handleCrossCourseError(c, result.error);
      }

      return c.json(result.data);

    } catch (error) {
      console.error('Failed to get cross-course analytics:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  };

  /**
   * GET /api/cross-course/knowledge-graph/:studentId
   * Retrieves student's knowledge dependency graph
   */
  getKnowledgeGraph: Handler = async (c: Context) => {
    try {
      const studentId = c.req.param('studentId');
      
      if (!studentId) {
        return c.json({ error: 'Student ID is required' }, 400);
      }

      // Get student's active courses
      const coursesResult = await this.getStudentActiveCourses(studentId);
      if (!coursesResult.success) {
        return this.handleCrossCourseError(c, coursesResult.error);
      }

      // Get knowledge dependencies for student's courses
      const courseIds = coursesResult.data || [];
      const dependencies = await this.getDependenciesForCourses(courseIds);

      // Get knowledge transfer opportunities
      const transferOpportunities = await this.knowledgeGraphRepo.getKnowledgeTransferOpportunities(
        studentId, 
        'identified'
      );

      const response = {
        studentId,
        courseIds,
        dependencies: dependencies.success ? dependencies.data || [] : [],
        transferOpportunities: transferOpportunities.success ? transferOpportunities.data || [] : [],
        graphStats: await this.getKnowledgeGraphStats()
      };

      return c.json(response);

    } catch (error) {
      console.error('Failed to get knowledge graph:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  };

  /**
   * POST /api/cross-course/analyze-gaps
   * Triggers prerequisite gap analysis for a student
   */
  analyzeGaps: Handler = async (c: Context) => {
    try {
      const body = await c.req.json();
      
      // Validate request
      const validation = validateSafely(GapAnalysisRequestSchema, body);
      if (!validation.success) {
        return c.json({ 
          error: 'Invalid request body', 
          details: validation.error.errors 
        }, 400);
      }

      const request = validation.data;

      // Perform gap analysis
      const result = await this.gapAnalyzer.analyzePrerequisiteGaps(
        request.studentId,
        request.targetCourses,
        request.includePreventive
      );

      if (!result.success) {
        return this.handleCrossCourseError(c, result.error);
      }

      return c.json(result.data);

    } catch (error) {
      console.error('Failed to analyze gaps:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  };

  /**
   * GET /api/cross-course/academic-risk/:studentId
   * Retrieves academic risk assessment for a student
   */
  getAcademicRisk: Handler = async (c: Context) => {
    try {
      const studentId = c.req.param('studentId');
      
      if (!studentId) {
        return c.json({ error: 'Student ID is required' }, 400);
      }

      // Generate basic analytics to get risk assessment
      const analyticsResult = await this.analyticsEngine.generateCrossCourseAnalytics({
        studentId,
        analysisDepth: 'basic',
        includeHistorical: false
      });

      if (!analyticsResult.success) {
        return this.handleCrossCourseError(c, analyticsResult.error);
      }

      const riskData = {
        studentId,
        academicRiskScore: analyticsResult.data.academicRiskScore,
        riskFactors: analyticsResult.data.knowledgeGaps.map(gap => ({
          id: gap.id,
          category: 'prerequisite_gap',
          description: `Knowledge gap in ${gap.concept} from ${gap.prerequisiteCourse}`,
          impact: gap.gapSeverity,
          confidence: 0.8,
          courses: gap.impactedCourses,
          timeframe: gap.remediationPriority === 'critical' ? 'immediate' : 'short_term'
        })),
        actionItems: analyticsResult.data.actionItems,
        lastUpdated: analyticsResult.data.lastUpdated
      };

      return c.json(riskData);

    } catch (error) {
      console.error('Failed to get academic risk:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  };

  /**
   * POST /api/cross-course/consent
   * Manages cross-course data sharing consent
   */
  manageConsent: Handler = async (c: Context) => {
    try {
      const body = await c.req.json();
      
      // Validate request
      const validation = validateSafely(ConsentUpdateRequestSchema, body);
      if (!validation.success) {
        return c.json({ 
          error: 'Invalid consent request', 
          details: validation.error.errors 
        }, 400);
      }

      const request = validation.data;

      // Create or update consent record
      const consentData = {
        studentId: request.studentId,
        sourceCourse: request.sourceCourse,
        targetCourse: request.targetCourse,
        consentType: request.consentType,
        consentGranted: request.consentGranted,
        expirationDate: request.expirationDate
      };

      const result = await this.createOrUpdateConsent(consentData);
      
      if (!result.success) {
        return this.handleCrossCourseError(c, result.error);
      }

      return c.json({ 
        success: true, 
        consent: result.data,
        message: `Consent ${request.consentGranted ? 'granted' : 'withdrawn'} successfully`
      });

    } catch (error) {
      console.error('Failed to manage consent:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  };

  /**
   * GET /api/cross-course/consent/:studentId
   * Retrieves consent settings for a student
   */
  getConsentSettings: Handler = async (c: Context) => {
    try {
      const studentId = c.req.param('studentId');
      
      if (!studentId) {
        return c.json({ error: 'Student ID is required' }, 400);
      }

      const result = await this.db.query(
        'SELECT * FROM cross_course_consent WHERE student_id = ? ORDER BY consent_date DESC',
        [studentId]
      );

      if (!result.success) {
        return c.json({ error: 'Failed to retrieve consent settings' }, 500);
      }

      const consents = (result.results || []).map(row => ({
        id: row.id,
        studentId: row.student_id,
        sourceCourse: row.source_course,
        targetCourse: row.target_course,
        consentType: row.consent_type,
        consentGranted: Boolean(row.consent_granted),
        consentDate: new Date(row.consent_date),
        expirationDate: row.expiration_date ? new Date(row.expiration_date) : undefined,
        withdrawnAt: row.withdrawn_at ? new Date(row.withdrawn_at) : undefined
      }));

      return c.json({ 
        studentId,
        consents,
        summary: this.generateConsentSummary(consents)
      });

    } catch (error) {
      console.error('Failed to get consent settings:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  };

  /**
   * GET /api/instructor/cross-course/alerts
   * Retrieves cross-course gap alerts for instructors
   */
  getInstructorAlerts: Handler = async (c: Context) => {
    try {
      const query = c.req.query();
      
      // Validate query parameters
      const validation = validateSafely(InstructorAlertQuerySchema, query);
      if (!validation.success) {
        return c.json({ 
          error: 'Invalid query parameters', 
          details: validation.error.errors 
        }, 400);
      }

      const alertQuery = validation.data;
      
      // Build SQL query based on filters
      let sql = `
        SELECT * FROM cross_course_gap_alerts
        WHERE instructor_id = ?
      `;
      const params = [alertQuery.instructorId];

      if (alertQuery.courseId) {
        sql += ' AND course_id = ?';
        params.push(alertQuery.courseId);
      }

      if (alertQuery.status) {
        sql += ' AND status = ?';
        params.push(alertQuery.status);
      }

      if (alertQuery.priority) {
        sql += ' AND priority = ?';
        params.push(alertQuery.priority);
      }

      // Add ordering
      const orderColumn = alertQuery.sortBy === 'risk-score' ? 'risk_score' :
                         alertQuery.sortBy === 'gap-severity' ? 'risk_score' :
                         alertQuery.sortBy === 'student-name' ? 'student_id' :
                         alertQuery.sortBy === 'course' ? 'course_id' :
                         'created_at';

      sql += ` ORDER BY ${orderColumn} ${alertQuery.sortOrder}`;

      // Add pagination
      sql += ' LIMIT ? OFFSET ?';
      params.push(alertQuery.limit, alertQuery.offset);

      const result = await this.db.query(sql, params);
      
      if (!result.success) {
        return c.json({ error: 'Failed to retrieve instructor alerts' }, 500);
      }

      const alerts = (result.results || []).map(row => this.mapRowToGapAlert(row));

      // Get summary statistics
      const summaryResult = await this.db.query(
        `SELECT 
          COUNT(*) as total_alerts,
          COUNT(CASE WHEN status = 'new' THEN 1 END) as new_alerts,
          COUNT(CASE WHEN priority = 'critical' THEN 1 END) as critical_alerts,
          AVG(risk_score) as avg_risk_score
         FROM cross_course_gap_alerts 
         WHERE instructor_id = ?`,
        [alertQuery.instructorId]
      );

      const summary = summaryResult.success && summaryResult.results?.[0] || {
        total_alerts: 0,
        new_alerts: 0,
        critical_alerts: 0,
        avg_risk_score: 0
      };

      return c.json({
        alerts,
        summary: {
          totalAlerts: summary.total_alerts,
          newAlerts: summary.new_alerts,
          criticalAlerts: summary.critical_alerts,
          averageRiskScore: summary.avg_risk_score
        },
        pagination: {
          limit: alertQuery.limit,
          offset: alertQuery.offset,
          total: summary.total_alerts
        }
      });

    } catch (error) {
      console.error('Failed to get instructor alerts:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  };

  /**
   * PUT /api/instructor/cross-course/alerts/:id/acknowledge
   * Acknowledges a cross-course gap alert
   */
  acknowledgeAlert: Handler = async (c: Context) => {
    try {
      const alertId = c.req.param('id');
      const body = await c.req.json();
      const instructorId = body.instructorId;
      
      if (!alertId || !instructorId) {
        return c.json({ error: 'Alert ID and instructor ID are required' }, 400);
      }

      const result = await this.db.query(
        `UPDATE cross_course_gap_alerts 
         SET status = 'acknowledged', 
             acknowledged_at = ?, 
             acknowledged_by = ?,
             updated_at = ?
         WHERE id = ? AND instructor_id = ?`,
        [
          new Date().toISOString(),
          instructorId,
          new Date().toISOString(),
          alertId,
          instructorId
        ]
      );

      if (!result.success || result.meta?.changes === 0) {
        return c.json({ error: 'Alert not found or already acknowledged' }, 404);
      }

      return c.json({ 
        success: true, 
        message: 'Alert acknowledged successfully'
      });

    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  };

  // Helper methods

  private async getStudentActiveCourses(studentId: string): Promise<{ success: true; data: string[] } | { success: false; error: CrossCourseError }> {
    try {
      // This would normally query actual enrollment data
      // For MVP, simulate active courses
      const courses = ['math101', 'physics101', 'chemistry101'];
      return { success: true, data: courses };
    } catch (error) {
      return { 
        success: false, 
        error: {
          type: 'INSUFFICIENT_DATA',
          message: 'Failed to retrieve student courses'
        }
      };
    }
  }

  private async getDependenciesForCourses(courseIds: string[]) {
    try {
      const allDependencies = [];
      for (const courseId of courseIds) {
        const deps = await this.knowledgeGraphRepo.getCourseDependencies(courseId);
        if (deps.success) {
          allDependencies.push(...(deps.data?.prerequisites || []));
          allDependencies.push(...(deps.data?.dependents || []));
        }
      }
      return { success: true, data: allDependencies };
    } catch (error) {
      return { 
        success: false, 
        error: {
          type: 'SYSTEM_OVERLOAD',
          message: 'Failed to retrieve course dependencies'
        }
      };
    }
  }

  private async getKnowledgeGraphStats() {
    const statsResult = await this.knowledgeGraphRepo.getKnowledgeGraphStats();
    return statsResult.success ? statsResult.data : {
      totalDependencies: 0,
      totalCourses: 0,
      totalConcepts: 0,
      averageDependencyStrength: 0,
      strongestDependencies: [],
      courseCoverage: 0
    };
  }

  private async createOrUpdateConsent(consentData: any) {
    try {
      // Check if consent record exists
      const existingResult = await this.db.query(
        `SELECT id FROM cross_course_consent 
         WHERE student_id = ? AND source_course = ? AND target_course = ? AND consent_type = ?`,
        [consentData.studentId, consentData.sourceCourse, consentData.targetCourse, consentData.consentType]
      );

      const now = new Date().toISOString();

      if (existingResult.success && existingResult.results?.length > 0) {
        // Update existing consent
        const consentId = existingResult.results[0].id;
        const updateResult = await this.db.query(
          `UPDATE cross_course_consent 
           SET consent_granted = ?, expiration_date = ?, withdrawn_at = ?
           WHERE id = ?`,
          [
            consentData.consentGranted ? 1 : 0,
            consentData.expirationDate?.toISOString() || null,
            consentData.consentGranted ? null : now,
            consentId
          ]
        );

        if (!updateResult.success) {
          throw new Error('Failed to update consent');
        }

        return { success: true, data: { id: consentId, ...consentData } };
      } else {
        // Create new consent
        const consentId = `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const createResult = await this.db.query(
          `INSERT INTO cross_course_consent 
           (id, student_id, source_course, target_course, consent_type, consent_granted, expiration_date, withdrawn_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            consentId,
            consentData.studentId,
            consentData.sourceCourse,
            consentData.targetCourse,
            consentData.consentType,
            consentData.consentGranted ? 1 : 0,
            consentData.expirationDate?.toISOString() || null,
            consentData.consentGranted ? null : now
          ]
        );

        if (!createResult.success) {
          throw new Error('Failed to create consent');
        }

        return { success: true, data: { id: consentId, ...consentData } };
      }
    } catch (error) {
      return {
        success: false,
        error: {
          type: 'SYSTEM_OVERLOAD' as CrossCourseError,
          message: error instanceof Error ? error.message : 'Unknown consent error'
        }
      };
    }
  }

  private generateConsentSummary(consents: any[]) {
    const totalConsents = consents.length;
    const grantedConsents = consents.filter(c => c.consentGranted && !c.withdrawnAt).length;
    const expiredConsents = consents.filter(c => 
      c.expirationDate && new Date() > c.expirationDate
    ).length;

    return {
      totalConsents,
      grantedConsents,
      withdrawnConsents: totalConsents - grantedConsents,
      expiredConsents,
      dataSharePermission: grantedConsents > 0 ? 'partial' : 'none'
    };
  }

  private mapRowToGapAlert(row: any): CrossCourseGapAlert {
    return {
      id: row.id,
      studentId: row.student_id,
      studentName: 'Student Name', // Would be retrieved from student data
      studentEmail: 'student@example.com', // Would be retrieved from student data
      instructorId: row.instructor_id,
      courseId: row.course_id,
      prerequisiteCourse: row.prerequisite_course,
      gapArea: row.gap_area,
      gapConcept: row.gap_concept,
      riskScore: row.risk_score,
      impactPrediction: JSON.parse(row.impact_prediction || '{}'),
      recommendations: JSON.parse(row.recommendations || '[]'),
      status: row.status,
      priority: row.priority,
      predictedImpactDate: row.predicted_impact_date ? new Date(row.predicted_impact_date) : undefined,
      acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at) : undefined,
      acknowledgedBy: row.acknowledged_by,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private handleCrossCourseError(c: Context, error: any) {
    const errorMap = {
      'INSUFFICIENT_CONSENT': 403,
      'INSUFFICIENT_DATA': 400,
      'CORRELATION_FAILED': 500,
      'GAP_ANALYSIS_FAILED': 500,
      'INVALID_COURSE_SEQUENCE': 400,
      'PRIVACY_VIOLATION': 403,
      'SYSTEM_OVERLOAD': 503
    };

    const statusCode = errorMap[error.type as keyof typeof errorMap] || 500;
    
    return c.json({
      error: error.message || 'Cross-course analysis failed',
      type: error.type,
      details: error.details
    }, statusCode);
  }
}