/**
 * @fileoverview LTI Assignment and Grade Services (AGS) integration for grade passback
 * @module services/gradePassback
 */

import { z } from 'zod';
import { getLtiToken } from '@atomicjolt/lti-server';
import type { Env } from '../types';

/**
 * Grade passback request schema
 */
const GradePassbackSchema = z.object({
  attemptId: z.string(),
  score: z.number().min(0).max(100),
  feedback: z.string().optional(),
  userId: z.string(),
  lineItemUrl: z.string().url(),
  activityProgress: z.enum(['Initialized', 'Started', 'InProgress', 'Submitted', 'Completed']).default('Completed'),
  gradingProgress: z.enum(['NotReady', 'Failed', 'Pending', 'PendingManual', 'FullyGraded']).default('FullyGraded'),
});

export type GradePassbackRequest = z.infer<typeof GradePassbackSchema>;

/**
 * LTI Score schema for AGS
 */
const LtiScoreSchema = z.object({
  userId: z.string(),
  scoreGiven: z.number(),
  scoreMaximum: z.number(),
  activityProgress: z.string(),
  gradingProgress: z.string(),
  comment: z.string().optional(),
  timestamp: z.string().datetime(),
});

export type LtiScore = z.infer<typeof LtiScoreSchema>;

/**
 * Error class for grade passback failures
 */
export class GradePassbackError extends Error {
  constructor(
    message: string,
    public readonly attemptId: string,
    public readonly statusCode?: number,
    public readonly retryable: boolean = true
  ) {
    super(message);
    this.name = 'GradePassbackError';
  }
}

/**
 * Service for handling LTI AGS grade passback operations
 */
export class GradePassbackService {
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // milliseconds

  constructor(private readonly env: Env) {}

  /**
   * Submit a grade to the LMS via LTI AGS
   * 
   * @param request - Grade passback request
   * @returns Promise resolving to submission response
   * @throws {GradePassbackError} If submission fails after retries
   */
  async submitGrade(request: GradePassbackRequest): Promise<{
    success: boolean;
    ltiGradeResponse?: LtiScore;
    error?: string;
  }> {
    try {
      // Validate request
      const validated = GradePassbackSchema.parse(request);

      // Get OAuth token for AGS
      const accessToken = await this.getAgsAccessToken(validated.lineItemUrl);

      // Prepare score payload
      const scorePayload: LtiScore = {
        userId: validated.userId,
        scoreGiven: validated.score,
        scoreMaximum: 100,
        activityProgress: validated.activityProgress,
        gradingProgress: validated.gradingProgress,
        comment: validated.feedback,
        timestamp: new Date().toISOString(),
      };

      // Submit score with retry logic
      const response = await this.submitScoreWithRetry(
        validated.lineItemUrl + '/scores',
        scorePayload,
        accessToken
      );

      return {
        success: true,
        ltiGradeResponse: response,
      };
    } catch (error) {
      console.error('Grade passback failed:', error);

      if (error instanceof GradePassbackError) {
        throw error;
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get OAuth access token for AGS operations
   * 
   * @param lineItemUrl - The line item URL from LTI launch
   * @returns Promise resolving to access token
   */
  private async getAgsAccessToken(lineItemUrl: string): Promise<string> {
    try {
      // Extract platform URL from line item URL
      const url = new URL(lineItemUrl);
      const platformUrl = `${url.protocol}//${url.host}`;

      // Get platform configuration
      const platform = await this.env.PLATFORMS.get(platformUrl);
      if (!platform) {
        throw new Error('Platform configuration not found');
      }

      const platformConfig = JSON.parse(platform);

      // Get OAuth token using atomic-jolt library
      const tokenResponse = await getLtiToken({
        tokenUrl: platformConfig.token_endpoint,
        clientId: platformConfig.client_id,
        keyId: platformConfig.key_id,
        privateKey: await this.getPrivateKey(),
        scopes: [
          'https://purl.imsglobal.org/spec/lti-ags/scope/score',
          'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
        ],
      });

      return tokenResponse.access_token;
    } catch (error) {
      console.error('AGS token error:', error);
      throw new GradePassbackError(
        'Failed to obtain AGS access token',
        '',
        401,
        false
      );
    }
  }

  /**
   * Get private key for JWT signing
   * 
   * @returns Promise resolving to private key
   */
  private async getPrivateKey(): Promise<string> {
    const keySet = await this.env.KEY_SETS.get('default');
    if (!keySet) {
      throw new Error('Key set not found');
    }

    const keys = JSON.parse(keySet);
    return keys.privateKey;
  }

  /**
   * Submit score with exponential backoff retry
   * 
   * @param url - Score submission URL
   * @param payload - Score payload
   * @param accessToken - OAuth access token
   * @param attempt - Current attempt number
   * @returns Promise resolving to LTI score response
   */
  private async submitScoreWithRetry(
    url: string,
    payload: LtiScore,
    accessToken: string,
    attempt: number = 1
  ): Promise<LtiScore> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/vnd.ims.lis.v1.score+json',
          'Accept': 'application/vnd.ims.lis.v1.score+json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // Check if error is retryable
        const retryable = response.status >= 500 || response.status === 429;
        
        if (retryable && attempt < this.maxRetries) {
          // Exponential backoff
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          return this.submitScoreWithRetry(url, payload, accessToken, attempt + 1);
        }

        throw new GradePassbackError(
          `Score submission failed: ${response.status} - ${errorText}`,
          payload.userId,
          response.status,
          false
        );
      }

      // Parse and validate response
      const responseData = await response.json();
      return LtiScoreSchema.parse(responseData);
    } catch (error) {
      if (error instanceof GradePassbackError) {
        throw error;
      }

      // Network errors are retryable
      if (attempt < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.submitScoreWithRetry(url, payload, accessToken, attempt + 1);
      }

      throw new GradePassbackError(
        `Score submission failed after ${attempt} attempts`,
        payload.userId,
        undefined,
        false
      );
    }
  }

  /**
   * Calculate grade based on assessment rubric
   * 
   * @param attemptId - Assessment attempt ID
   * @param rubricScores - Scores for each rubric criterion
   * @param maxScore - Maximum possible score
   * @returns Calculated percentage score
   */
  calculateGrade(
    attemptId: string,
    rubricScores: Record<string, number>,
    maxScore: number = 100
  ): number {
    const totalScore = Object.values(rubricScores).reduce((sum, score) => sum + score, 0);
    const percentage = (totalScore / maxScore) * 100;
    
    // Round to 2 decimal places
    return Math.round(percentage * 100) / 100;
  }

  /**
   * Track grade submission status
   * 
   * @param attemptId - Assessment attempt ID
   * @param status - Submission status
   * @param error - Error details if failed
   */
  async trackGradeStatus(
    attemptId: string,
    status: 'pending' | 'submitted' | 'failed',
    error?: string
  ): Promise<void> {
    try {
      // Store status in database for tracking
      const query = `
        UPDATE assessment_attempts
        SET grade_status = ?, grade_error = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      
      await this.env.DB.prepare(query)
        .bind(status, error || null, attemptId)
        .run();
    } catch (err) {
      console.error('Failed to track grade status:', err);
    }
  }
}

/**
 * Factory function to create grade passback service
 * 
 * @param env - Worker environment
 * @returns GradePassbackService instance
 */
export function createGradePassbackService(env: Env): GradePassbackService {
  return new GradePassbackService(env);
}