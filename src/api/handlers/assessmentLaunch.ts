/**
 * @fileoverview Handler for launching assessments from deep links
 * @module api/handlers/assessmentLaunch
 */

import type { Context } from 'hono';
import { z } from 'zod';
import { validateLTIToken } from '../../utils/lti';
import { assessmentConfigSchema } from '../../features/assessment/shared/schemas/assessment.schema';

/**
 * Assessment launch request schema
 */
const assessmentLaunchSchema = z.object({
  assessment_id: z.string().uuid(),
  user_id: z.string(),
  context_id: z.string(),
  resource_link_id: z.string(),
  attempt_number: z.number().int().positive().optional(),
});

/**
 * Handles assessment launch from Canvas deep link
 *
 * @param c - Hono context with environment bindings
 * @returns Assessment launch data or error
 */
export async function handleAssessmentLaunch(c: Context<{ Bindings: Env }>): Promise<Response> {
  try {
    // Validate authorization
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid authorization' }, 401);
    }

    const token = authHeader.substring(7);
    const isValid = await validateLTIToken(token, c.env);

    if (!isValid) {
      return c.json({ error: 'Invalid LTI token' }, 401);
    }

    // Parse and validate request
    const body = await c.req.json();
    const validationResult = assessmentLaunchSchema.safeParse(body);

    if (!validationResult.success) {
      return c.json(
        {
          error: 'Invalid launch request',
          details: validationResult.error.flatten(),
        },
        400
      );
    }

    const { assessment_id, user_id, context_id, resource_link_id } = validationResult.data;

    // Fetch assessment configuration
    const assessment = await c.env.DB.prepare(
      `
      SELECT * FROM assessments 
      WHERE id = ? AND tenant_id = ?
    `
    )
      .bind(assessment_id, context_id)
      .first();

    if (!assessment) {
      return c.json({ error: 'Assessment not found' }, 404);
    }

    // Parse and validate stored configuration
    let config;
    try {
      const parsedConfig = JSON.parse(assessment.config as string);
      config = assessmentConfigSchema.parse(parsedConfig);
    } catch (error) {
      console.error('Invalid stored assessment config:', error);
      return c.json({ error: 'Invalid assessment configuration' }, 500);
    }

    // Check for existing attempts
    const existingAttempts = await c.env.DB.prepare(
      `
      SELECT COUNT(*) as count FROM assessment_attempts
      WHERE assessment_id = ? AND user_id = ? AND status = 'completed'
    `
    )
      .bind(assessment_id, user_id)
      .first();

    const attemptCount = existingAttempts?.count || 0;

    // Validate attempt limit
    if (attemptCount >= config.aiGuidance.allowedAttempts) {
      return c.json(
        {
          error: 'Maximum attempts exceeded',
          allowed_attempts: config.aiGuidance.allowedAttempts,
          attempts_used: attemptCount,
        },
        403
      );
    }

    // Create new attempt
    const attemptId = crypto.randomUUID();
    const startedAt = new Date().toISOString();

    await c.env.DB.prepare(
      `
      INSERT INTO assessment_attempts (
        id,
        assessment_id,
        user_id,
        context_id,
        resource_link_id,
        started_at,
        status,
        attempt_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
      .bind(attemptId, assessment_id, user_id, context_id, resource_link_id, startedAt, 'in_progress', attemptCount + 1)
      .run();

    // Generate session token for the attempt
    const sessionToken = await generateSessionToken(attemptId, user_id, assessment_id, c.env);

    // Return launch data
    return c.json({
      success: true,
      attempt_id: attemptId,
      session_token: sessionToken,
      assessment: {
        id: assessment_id,
        title: config.title,
        description: config.description,
        type: config.assessmentType,
        questions: config.questions.map((q) => ({
          id: q.id,
          text: q.text,
          type: q.type,
          points: q.points,
        })),
        time_limit: config.timeLimit,
        shuffle_questions: config.shuffleQuestions,
        show_feedback: config.showFeedback,
        mastery_threshold: config.masteryThreshold,
      },
      attempt: {
        number: attemptCount + 1,
        max_attempts: config.aiGuidance.allowedAttempts,
        started_at: startedAt,
      },
      ai_guidance: {
        focus: config.aiGuidance.assessmentFocus,
        key_concepts: config.aiGuidance.keyConceptsToTest,
      },
    });
  } catch (error) {
    console.error('Assessment launch error:', error);
    return c.json(
      {
        error: 'Failed to launch assessment',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

/**
 * Handles assessment submission and grading
 *
 * @param c - Hono context
 * @returns Submission result with grade
 */
export async function handleAssessmentSubmission(c: Context<{ Bindings: Env }>): Promise<Response> {
  try {
    const { attempt_id } = c.req.param();
    const body = await c.req.json();

    // Validate attempt exists and is in progress
    const attempt = await c.env.DB.prepare(
      `
      SELECT * FROM assessment_attempts
      WHERE id = ? AND status = 'in_progress'
    `
    )
      .bind(attempt_id)
      .first();

    if (!attempt) {
      return c.json(
        {
          error: 'Invalid or completed attempt',
        },
        400
      );
    }

    // Calculate score (simplified - would use AI for evaluation)
    const responses = body.responses || {};
    const score = calculateScore(responses);

    // Update attempt with results
    await c.env.DB.prepare(
      `
      UPDATE assessment_attempts
      SET 
        completed_at = ?,
        score = ?,
        status = 'completed',
        responses = ?
      WHERE id = ?
    `
    )
      .bind(new Date().toISOString(), score, JSON.stringify(responses), attempt_id)
      .run();

    // Send grade to LMS via AGS
    await sendGradeToLMS(attempt.resource_link_id as string, attempt.user_id as string, score, c.env);

    return c.json({
      success: true,
      score,
      status: 'completed',
      feedback: generateFeedback(score, responses),
    });
  } catch (error) {
    console.error('Submission error:', error);
    return c.json({ error: 'Failed to submit assessment' }, 500);
  }
}

/**
 * Retrieves assessment attempt history for a user
 *
 * @param c - Hono context
 * @returns Array of attempt records
 */
export async function getAssessmentHistory(c: Context<{ Bindings: Env }>): Promise<Response> {
  try {
    const { assessment_id, user_id } = c.req.query();

    if (!assessment_id || !user_id) {
      return c.json({ error: 'Missing required parameters' }, 400);
    }

    const attempts = await c.env.DB.prepare(
      `
      SELECT 
        id,
        attempt_number,
        started_at,
        completed_at,
        score,
        status
      FROM assessment_attempts
      WHERE assessment_id = ? AND user_id = ?
      ORDER BY started_at DESC
    `
    )
      .bind(assessment_id, user_id)
      .all();

    return c.json({
      success: true,
      attempts: attempts.results || [],
    });
  } catch (error) {
    console.error('History retrieval error:', error);
    return c.json({ error: 'Failed to retrieve history' }, 500);
  }
}

/**
 * Generates a session token for assessment attempt
 */
async function generateSessionToken(attemptId: string, userId: string, assessmentId: string, _env: Env): Promise<string> {
  // Simplified token generation - would use proper JWT
  const payload = {
    attempt_id: attemptId,
    user_id: userId,
    assessment_id: assessmentId,
    exp: Date.now() + 3600000, // 1 hour
  };

  return btoa(JSON.stringify(payload));
}

/**
 * Calculates score from responses
 */
function calculateScore(responses: Record<string, any>): number {
  // Simplified scoring - would use AI evaluation
  const totalQuestions = Object.keys(responses).length;
  if (totalQuestions === 0) return 0;

  // Mock scoring logic
  let correct = 0;
  for (const [_questionId, response] of Object.entries(responses)) {
    // Simplified - would check against correct answers
    if (response && response !== '') {
      correct += 0.7; // Partial credit
    }
  }

  return Math.round((correct / totalQuestions) * 100);
}

/**
 * Generates feedback based on score and responses
 */
function generateFeedback(score: number, _responses: Record<string, any>): string {
  if (score >= 90) {
    return 'Excellent work! You have demonstrated strong mastery of the material.';
  } else if (score >= 70) {
    return 'Good job! You have a solid understanding with room for improvement.';
  } else if (score >= 50) {
    return 'Fair attempt. Consider reviewing the material and trying again.';
  } else {
    return 'This topic needs more practice. Review the content and reach out for help if needed.';
  }
}

/**
 * Sends grade to LMS via Assignment and Grade Services
 */
async function sendGradeToLMS(resourceLinkId: string, userId: string, score: number, _env: Env): Promise<void> {
  // This would integrate with LTI AGS
  // Placeholder for actual implementation
  console.log(`Sending grade ${score} for user ${userId} to LMS`);
}
