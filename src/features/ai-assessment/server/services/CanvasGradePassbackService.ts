/**
 * @fileoverview Canvas Grade Passback Service
 * @module features/ai-assessment/server/services/CanvasGradePassbackService
 *
 * Service for Canvas LTI Assignment and Grade Service integration.
 * Handles secure grade passback with comprehensive error handling and retry logic.
 *
 * Features:
 * - LTI 1.3 Assignment and Grade Service (AGS) integration
 * - Secure grade submission with JWT authentication
 * - Retry logic and error handling for network issues
 * - Grade validation and formatting for Canvas compatibility
 * - Audit logging for compliance and debugging
 */

import {
  GradePassback,
  GradeCalculation,
  AssessmentSessionId,
  UserId,
  CourseId,
  GradePassbackError,
  AIAssessmentError,
  GradePassbackSchema,
  GradeCalculationSchema
} from '../../shared/types.ts';

import { DatabaseService } from '../../../../shared/services/DatabaseService.ts';

/**
 * LTI Assignment and Grade Service configuration
 */
interface AGSConfig {
  lineItemsUrl: string;      // Canvas line items endpoint
  scoreUrl?: string;         // Specific score submission URL
  accessToken: string;       // OAuth 2.0 access token
  clientId: string;          // LTI client ID
  deploymentId: string;      // LTI deployment ID
  maxRetries: number;        // Maximum retry attempts
  timeoutMs: number;         // Request timeout
  rateLimitDelay: number;    // Delay between requests
}

/**
 * Canvas line item for gradebook integration
 */
interface CanvasLineItem {
  id: string;
  scoreMaximum: number;
  label: string;
  resourceId: string;
  resourceLinkId: string;
  tag?: string;
  startDateTime?: string;
  endDateTime?: string;
  https_canvas_instructure_com_lti_submission_type?: {
    type: string;
    external_tool_url: string;
  };
}

/**
 * Canvas score submission payload
 */
interface CanvasScoreSubmission {
  userId: string;
  scoreGiven: number;
  scoreMaximum: number;
  comment?: string;
  timestamp: string;
  activityProgress: 'Initialized' | 'Started' | 'InProgress' | 'Submitted' | 'Completed';
  gradingProgress: 'NotReady' | 'Failed' | 'Pending' | 'PendingManual' | 'FullyGraded';
  submission?: {
    submittedAt: string;
    data?: string;
  };
}

/**
 * Grade passback result
 */
interface GradePassbackResult {
  success: boolean;
  gradeId?: string;
  score: number;
  maxScore: number;
  submittedAt: Date;
  canvasResponse?: unknown;
  error?: string;
  retryCount: number;
}

/**
 * Canvas Grade Passback Service
 *
 * Handles all Canvas LTI grade passback operations with proper error handling,
 * retry logic, and compliance logging.
 */
export class CanvasGradePassbackService {
  constructor(
    private readonly db: DatabaseService
  ) {}

  /**
   * Submit grade to Canvas gradebook using LTI Assignment and Grade Service
   *
   * @param gradeCalculation - Calculated grade from assessment
   * @param agsConfig - Canvas AGS configuration
   * @returns Grade passback result
   */
  async submitGrade(
    gradeCalculation: GradeCalculation,
    agsConfig: AGSConfig
  ): Promise<GradePassbackResult> {
    const validatedGrade = GradeCalculationSchema.parse(gradeCalculation);

    try {
      // Check if grade passback is eligible
      if (!validatedGrade.passback.eligible) {
        throw new GradePassbackError(
          'Grade passback not eligible for this session',
          { sessionId: validatedGrade.sessionId }
        );
      }

      // Get or create Canvas line item
      const lineItem = await this.ensureLineItem(agsConfig, validatedGrade);

      // Prepare score submission
      const scoreSubmission = this.prepareScoreSubmission(validatedGrade, lineItem);

      // Submit grade with retry logic
      const result = await this.submitScoreWithRetry(
        scoreSubmission,
        agsConfig,
        lineItem.id
      );

      // Update grade calculation record
      await this.updateGradePassbackStatus(
        validatedGrade.sessionId,
        result.success ? 'submitted' : 'error',
        result.gradeId,
        result.error
      );

      // Log grade passback attempt
      await this.logGradePassback(validatedGrade, agsConfig, result);

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update grade calculation with error
      await this.updateGradePassbackStatus(
        validatedGrade.sessionId,
        'error',
        undefined,
        errorMessage
      );

      // Log failed attempt
      await this.logGradePassback(validatedGrade, agsConfig, {
        success: false,
        score: validatedGrade.numericScore,
        maxScore: 100,
        submittedAt: new Date(),
        error: errorMessage,
        retryCount: 0
      });

      throw new GradePassbackError(
        `Grade passback failed: ${errorMessage}`,
        { sessionId: validatedGrade.sessionId, error: errorMessage }
      );
    }
  }

  /**
   * Retrieve grade from Canvas gradebook
   *
   * @param sessionId - Assessment session ID
   * @param agsConfig - Canvas AGS configuration
   * @returns Current grade information from Canvas
   */
  async retrieveGrade(
    sessionId: AssessmentSessionId,
    agsConfig: AGSConfig
  ): Promise<{
    score: number;
    maxScore: number;
    submittedAt: Date;
    gradingProgress: string;
  } | null> {
    try {
      // Get grade calculation record
      const gradeRecord = await this.db
        .prepare(`
          SELECT canvas_grade_id, numeric_score, submitted_at
          FROM assessment_grade_calculations
          WHERE session_id = ?
        `)
        .bind(sessionId)
        .first<{
          canvas_grade_id: string;
          numeric_score: number;
          submitted_at: string;
        }>();

      if (!gradeRecord?.canvas_grade_id) {
        return null;
      }

      // Retrieve from Canvas
      const response = await this.makeCanvasRequest(
        'GET',
        `${agsConfig.lineItemsUrl}/${gradeRecord.canvas_grade_id}/scores`,
        agsConfig.accessToken
      );

      if (!response.ok) {
        throw new GradePassbackError(
          `Failed to retrieve grade: ${response.status} ${response.statusText}`,
          { sessionId, canvasGradeId: gradeRecord.canvas_grade_id }
        );
      }

      const gradeData = await response.json();

      return {
        score: gradeData.scoreGiven || gradeRecord.numeric_score,
        maxScore: gradeData.scoreMaximum || 100,
        submittedAt: new Date(gradeRecord.submitted_at),
        gradingProgress: gradeData.gradingProgress || 'FullyGraded'
      };

    } catch (error) {
      throw new GradePassbackError(
        `Failed to retrieve grade: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { sessionId }
      );
    }
  }

  /**
   * Update grade in Canvas (for instructor overrides)
   *
   * @param sessionId - Assessment session ID
   * @param newScore - New score to set
   * @param agsConfig - Canvas AGS configuration
   * @param comment - Optional comment for the grade change
   * @returns Update result
   */
  async updateGrade(
    sessionId: AssessmentSessionId,
    newScore: number,
    agsConfig: AGSConfig,
    comment?: string
  ): Promise<GradePassbackResult> {
    try {
      // Validate score
      if (newScore < 0 || newScore > 100) {
        throw new GradePassbackError(
          'Score must be between 0 and 100',
          { sessionId, newScore }
        );
      }

      // Get existing grade record
      const gradeRecord = await this.db
        .prepare(`
          SELECT canvas_grade_id
          FROM assessment_grade_calculations
          WHERE session_id = ?
        `)
        .bind(sessionId)
        .first<{ canvas_grade_id: string }>();

      if (!gradeRecord?.canvas_grade_id) {
        throw new GradePassbackError(
          'No existing grade found for update',
          { sessionId }
        );
      }

      // Prepare update submission
      const updateSubmission: CanvasScoreSubmission = {
        userId: 'current_user', // Will be resolved by Canvas
        scoreGiven: newScore,
        scoreMaximum: 100,
        comment: comment || `Grade updated to ${newScore}`,
        timestamp: new Date().toISOString(),
        activityProgress: 'Completed',
        gradingProgress: 'FullyGraded'
      };

      // Submit update to Canvas
      const response = await this.makeCanvasRequest(
        'PUT',
        `${agsConfig.lineItemsUrl}/${gradeRecord.canvas_grade_id}/scores`,
        agsConfig.accessToken,
        updateSubmission
      );

      const success = response.ok;
      const result: GradePassbackResult = {
        success,
        gradeId: gradeRecord.canvas_grade_id,
        score: newScore,
        maxScore: 100,
        submittedAt: new Date(),
        retryCount: 0,
        canvasResponse: success ? await response.json() : undefined,
        error: success ? undefined : `${response.status}: ${response.statusText}`
      };

      // Update local record
      if (success) {
        await this.db
          .prepare(`
            UPDATE assessment_grade_calculations
            SET numeric_score = ?, submitted_at = ?, passback_status = 'submitted'
            WHERE session_id = ?
          `)
          .bind(newScore, new Date().toISOString(), sessionId)
          .run();
      }

      return result;

    } catch (error) {
      throw new GradePassbackError(
        `Failed to update grade: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { sessionId, newScore }
      );
    }
  }

  /**
   * Ensure Canvas line item exists for the assessment
   */
  private async ensureLineItem(
    agsConfig: AGSConfig,
    gradeCalculation: GradeCalculation
  ): Promise<CanvasLineItem> {
    try {
      // Check if line item already exists
      const response = await this.makeCanvasRequest(
        'GET',
        agsConfig.lineItemsUrl,
        agsConfig.accessToken
      );

      if (response.ok) {
        const lineItems = await response.json();

        // Look for existing line item for this assessment
        const existingItem = lineItems.find((item: CanvasLineItem) =>
          item.resourceId === gradeCalculation.sessionId
        );

        if (existingItem) {
          return existingItem;
        }
      }

      // Create new line item
      const lineItemData = {
        scoreMaximum: 100,
        label: 'AI Assessment',
        resourceId: gradeCalculation.sessionId,
        tag: 'ai_assessment',
        submission: {
          type: 'external_tool',
          external_tool_url: `${globalThis.location?.origin}/assessment/${gradeCalculation.sessionId}`
        }
      };

      const createResponse = await this.makeCanvasRequest(
        'POST',
        agsConfig.lineItemsUrl,
        agsConfig.accessToken,
        lineItemData
      );

      if (!createResponse.ok) {
        throw new GradePassbackError(
          `Failed to create line item: ${createResponse.status} ${createResponse.statusText}`,
          { sessionId: gradeCalculation.sessionId }
        );
      }

      return await createResponse.json();

    } catch (error) {
      throw new GradePassbackError(
        `Failed to ensure line item: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { sessionId: gradeCalculation.sessionId }
      );
    }
  }

  /**
   * Prepare score submission payload for Canvas
   */
  private prepareScoreSubmission(
    gradeCalculation: GradeCalculation,
    lineItem: CanvasLineItem
  ): CanvasScoreSubmission {
    return {
      userId: 'current_user', // Canvas will resolve this to the current student
      scoreGiven: gradeCalculation.numericScore,
      scoreMaximum: lineItem.scoreMaximum,
      comment: this.formatGradeFeedback(gradeCalculation.feedback),
      timestamp: new Date().toISOString(),
      activityProgress: 'Completed',
      gradingProgress: 'FullyGraded',
      submission: {
        submittedAt: new Date().toISOString(),
        data: JSON.stringify({
          masteryReport: gradeCalculation.feedback.masteryReport,
          scoreComponents: gradeCalculation.components
        })
      }
    };
  }

  /**
   * Submit score to Canvas with retry logic
   */
  private async submitScoreWithRetry(
    scoreSubmission: CanvasScoreSubmission,
    agsConfig: AGSConfig,
    lineItemId: string,
    attempt: number = 1
  ): Promise<GradePassbackResult> {
    try {
      const response = await this.makeCanvasRequest(
        'POST',
        `${agsConfig.lineItemsUrl}/${lineItemId}/scores`,
        agsConfig.accessToken,
        scoreSubmission
      );

      if (response.ok) {
        const responseData = await response.json();

        return {
          success: true,
          gradeId: responseData.id || lineItemId,
          score: scoreSubmission.scoreGiven,
          maxScore: scoreSubmission.scoreMaximum,
          submittedAt: new Date(),
          canvasResponse: responseData,
          retryCount: attempt - 1
        };
      }

      // Handle specific error cases
      if (response.status === 429) {
        // Rate limited - wait and retry
        if (attempt < agsConfig.maxRetries) {
          await this.delay(agsConfig.rateLimitDelay * attempt);
          return this.submitScoreWithRetry(scoreSubmission, agsConfig, lineItemId, attempt + 1);
        }
      }

      if (response.status >= 500 && attempt < agsConfig.maxRetries) {
        // Server error - retry with exponential backoff
        await this.delay(Math.pow(2, attempt) * 1000);
        return this.submitScoreWithRetry(scoreSubmission, agsConfig, lineItemId, attempt + 1);
      }

      // Non-retryable error
      const errorText = await response.text();
      return {
        success: false,
        score: scoreSubmission.scoreGiven,
        maxScore: scoreSubmission.scoreMaximum,
        submittedAt: new Date(),
        error: `${response.status}: ${response.statusText} - ${errorText}`,
        retryCount: attempt - 1
      };

    } catch (error) {
      if (attempt < agsConfig.maxRetries) {
        await this.delay(Math.pow(2, attempt) * 1000);
        return this.submitScoreWithRetry(scoreSubmission, agsConfig, lineItemId, attempt + 1);
      }

      return {
        success: false,
        score: scoreSubmission.scoreGiven,
        maxScore: scoreSubmission.scoreMaximum,
        submittedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
        retryCount: attempt - 1
      };
    }
  }

  /**
   * Make authenticated request to Canvas API
   */
  private async makeCanvasRequest(
    method: string,
    url: string,
    accessToken: string,
    body?: unknown
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/vnd.ims.lis.v2.lineitem+json',
      'Accept': 'application/vnd.ims.lis.v2.lineitem+json'
    };

    const options: RequestInit = {
      method,
      headers
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    return fetch(url, options);
  }

  /**
   * Update grade passback status in database
   */
  private async updateGradePassbackStatus(
    sessionId: AssessmentSessionId,
    status: 'pending' | 'submitted' | 'error',
    gradeId?: string,
    errorMessage?: string
  ): Promise<void> {
    await this.db
      .prepare(`
        UPDATE assessment_grade_calculations
        SET passback_status = ?, canvas_grade_id = ?, error_message = ?, submitted_at = ?
        WHERE session_id = ?
      `)
      .bind(
        status,
        gradeId || null,
        errorMessage || null,
        status === 'submitted' ? new Date().toISOString() : null,
        sessionId
      )
      .run();
  }

  /**
   * Log grade passback attempt for audit trail
   */
  private async logGradePassback(
    gradeCalculation: GradeCalculation,
    agsConfig: AGSConfig,
    result: GradePassbackResult
  ): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO canvas_lti_integrations (
            id, session_id, integration_type, canvas_endpoint,
            request_data, response_data, http_status, success,
            error_message, retry_count, created_at, completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          crypto.randomUUID(),
          gradeCalculation.sessionId,
          'grade_passback',
          agsConfig.lineItemsUrl,
          JSON.stringify({
            score: result.score,
            maxScore: result.maxScore,
            feedback: gradeCalculation.feedback
          }),
          JSON.stringify(result.canvasResponse || {}),
          result.success ? 200 : 400,
          result.success ? 1 : 0,
          result.error || null,
          result.retryCount,
          new Date().toISOString(),
          new Date().toISOString()
        )
        .run();

    } catch (error) {
      console.error('Failed to log grade passback:', error);
      // Don't throw - logging failure shouldn't break grade passback
    }
  }

  /**
   * Format grade feedback for Canvas display
   */
  private formatGradeFeedback(feedback: GradeCalculation['feedback']): string {
    const parts: string[] = [];

    if (feedback.strengths.length > 0) {
      parts.push(`**Strengths:**\n${feedback.strengths.map(s => `• ${s}`).join('\n')}`);
    }

    if (feedback.areasForImprovement.length > 0) {
      parts.push(`**Areas for Improvement:**\n${feedback.areasForImprovement.map(a => `• ${a}`).join('\n')}`);
    }

    if (feedback.recommendations.length > 0) {
      parts.push(`**Recommendations:**\n${feedback.recommendations.map(r => `• ${r}`).join('\n')}`);
    }

    if (feedback.masteryReport) {
      parts.push(`**Assessment Summary:**\n${feedback.masteryReport}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Delay execution for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}