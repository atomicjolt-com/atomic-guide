/**
 * Database utility functions for Atomic Guide
 * Provides helper functions for common database operations
 */

import type { D1Database, D1Result } from '@cloudflare/workers-types';

/**
 * Database query result type
 */
export interface QueryResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: D1Result['meta'];
}

/**
 * Learner profile type
 */
export interface LearnerProfile {
  id: number;
  tenant_id: string;
  lti_user_id: string;
  lti_deployment_id: string;
  email?: string;
  name?: string;
  forgetting_curve_s: number;
  learning_velocity: number;
  optimal_difficulty: number;
  preferred_modality: string;
  peak_performance_time?: string;
  avg_session_duration: number;
  total_sessions: number;
  last_active_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Learning session type
 */
export interface LearningSession {
  id: number;
  tenant_id: string;
  learner_profile_id: number;
  lti_context_id: string;
  session_id: string;
  started_at: string;
  ended_at?: string;
  duration_seconds: number;
  engagement_score: number;
  struggle_events: number;
}

/**
 * Struggle event type
 */
export interface StruggleEvent {
  id: number;
  tenant_id: string;
  learner_profile_id: number;
  session_id: string;
  event_type: string;
  event_timestamp: string;
  confidence_score: number;
  intervention_triggered: boolean;
}

/**
 * Execute a database query with error handling
 */
export async function executeQuery<T = any>(db: D1Database, query: string, params: any[] = []): Promise<QueryResult<T>> {
  try {
    const stmt = db.prepare(query);
    const result = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

    return {
      success: true,
      data: result.results as T,
      meta: result.meta,
    };
  } catch (error) {
    console.error('Database query error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}

/**
 * Get or create learner profile
 */
export async function getOrCreateLearnerProfile(
  db: D1Database,
  tenantId: string,
  ltiUserId: string,
  ltiDeploymentId: string,
  email?: string,
  name?: string,
): Promise<LearnerProfile | null> {
  // First try to get existing profile
  const existing = await db
    .prepare(
      `
    SELECT * FROM learner_profiles
    WHERE tenant_id = ? AND lti_user_id = ? AND lti_deployment_id = ?
  `,
    )
    .bind(tenantId, ltiUserId, ltiDeploymentId)
    .first<LearnerProfile>();

  if (existing) {
    // Update last active timestamp
    await db
      .prepare(
        `
      UPDATE learner_profiles
      SET last_active_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      )
      .bind(existing.id)
      .run();

    return existing;
  }

  // Create new profile
  const result = await db
    .prepare(
      `
    INSERT INTO learner_profiles (
      tenant_id, lti_user_id, lti_deployment_id, email, name
    ) VALUES (?, ?, ?, ?, ?)
    RETURNING *
  `,
    )
    .bind(tenantId, ltiUserId, ltiDeploymentId, email, name)
    .first<LearnerProfile>();

  return result;
}

/**
 * Create a new learning session
 */
export async function createLearningSession(
  db: D1Database,
  tenantId: string,
  learnerProfileId: number,
  ltiContextId: string,
  contentType?: string,
  contentId?: string,
  contentTitle?: string,
): Promise<string> {
  const sessionId = generateSessionId();

  await db
    .prepare(
      `
    INSERT INTO learning_sessions (
      tenant_id, learner_profile_id, lti_context_id, session_id,
      content_type, content_id, content_title
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .bind(tenantId, learnerProfileId, ltiContextId, sessionId, contentType, contentId, contentTitle)
    .run();

  return sessionId;
}

/**
 * End a learning session
 */
export async function endLearningSession(db: D1Database, sessionId: string): Promise<void> {
  await db
    .prepare(
      `
    UPDATE learning_sessions
    SET ended_at = CURRENT_TIMESTAMP,
        duration_seconds = CAST((julianday(CURRENT_TIMESTAMP) - julianday(started_at)) * 86400 AS INTEGER)
    WHERE session_id = ?
  `,
    )
    .bind(sessionId)
    .run();
}

/**
 * Record a struggle event
 */
export async function recordStruggleEvent(
  db: D1Database,
  tenantId: string,
  learnerProfileId: number,
  sessionId: string,
  eventType: string,
  confidence: number,
  pageElement?: string,
  contentContext?: string,
  durationMs?: number,
): Promise<number> {
  const result = await db
    .prepare(
      `
    INSERT INTO struggle_events (
      tenant_id, learner_profile_id, session_id,
      event_type, confidence_score, page_element, content_context, duration_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `,
    )
    .bind(tenantId, learnerProfileId, sessionId, eventType, confidence, pageElement, contentContext, durationMs)
    .first<{ id: number }>();

  return result?.id || 0;
}

/**
 * Get learner's concept mastery
 */
export async function getLearnerMastery(db: D1Database, learnerProfileId: number, conceptId?: string): Promise<any[]> {
  let query = `
    SELECT cm.*, kg.concept_name, kg.difficulty_level
    FROM concept_mastery cm
    JOIN knowledge_graph kg ON cm.concept_id = kg.concept_id
    WHERE cm.learner_profile_id = ?
  `;

  const params: (number | string)[] = [learnerProfileId];

  if (conceptId) {
    query += ' AND cm.concept_id = ?';
    params.push(conceptId);
  }

  query += ' ORDER BY cm.risk_score DESC';

  const result = await db
    .prepare(query)
    .bind(...params)
    .all();
  return result.results;
}

/**
 * Update concept mastery after practice
 */
export async function updateConceptMastery(db: D1Database, learnerProfileId: number, conceptId: string, success: boolean): Promise<void> {
  // Get current mastery
  const current = await db
    .prepare(
      `
    SELECT * FROM concept_mastery
    WHERE learner_profile_id = ? AND concept_id = ?
  `,
    )
    .bind(learnerProfileId, conceptId)
    .first<any>();

  if (!current) {
    // Create new mastery record
    await db
      .prepare(
        `
      INSERT INTO concept_mastery (
        tenant_id, learner_profile_id, concept_id,
        mastery_level, attempts, successes, last_practiced_at
      ) VALUES (
        (SELECT tenant_id FROM learner_profiles WHERE id = ?),
        ?, ?, ?, 1, ?, CURRENT_TIMESTAMP
      )
    `,
      )
      .bind(learnerProfileId, learnerProfileId, conceptId, success ? 0.6 : 0.3, success ? 1 : 0)
      .run();
  } else {
    // Update existing record
    const newAttempts = current.attempts + 1;
    const newSuccesses = current.successes + (success ? 1 : 0);
    const newMastery = Math.min(1, newSuccesses / newAttempts);

    // Update ease factor based on performance (SM-2 algorithm)
    let newEase = current.ease_factor;
    if (success) {
      newEase = Math.min(2.5, newEase + 0.1);
    } else {
      newEase = Math.max(1.3, newEase - 0.2);
    }

    // Calculate next review interval
    const newInterval = success ? Math.ceil(current.review_interval_days * newEase) : 1;

    await db
      .prepare(
        `
      UPDATE concept_mastery
      SET mastery_level = ?,
          attempts = ?,
          successes = ?,
          last_practiced_at = CURRENT_TIMESTAMP,
          ease_factor = ?,
          review_interval_days = ?,
          next_review_at = datetime('now', '+' || ? || ' days'),
          risk_score = ?
      WHERE learner_profile_id = ? AND concept_id = ?
    `,
      )
      .bind(
        newMastery,
        newAttempts,
        newSuccesses,
        newEase,
        newInterval,
        newInterval,
        1 - newMastery, // Risk score is inverse of mastery
        learnerProfileId,
        conceptId,
      )
      .run();
  }
}

/**
 * Get at-risk learners for a course
 */
export async function getAtRiskLearners(db: D1Database, tenantId: string, ltiContextId: string, threshold: number = 0.6): Promise<any[]> {
  const result = await db
    .prepare(
      `
    SELECT DISTINCT
      lp.*,
      AVG(cm.mastery_level) as avg_mastery,
      MAX(cm.risk_score) as max_risk,
      COUNT(DISTINCT se.id) as recent_struggles
    FROM learner_profiles lp
    LEFT JOIN concept_mastery cm ON lp.id = cm.learner_profile_id
    LEFT JOIN learning_sessions ls ON lp.id = ls.learner_profile_id
      AND ls.lti_context_id = ?
      AND ls.started_at > datetime('now', '-7 days')
    LEFT JOIN struggle_events se ON lp.id = se.learner_profile_id
      AND se.event_timestamp > datetime('now', '-24 hours')
    WHERE lp.tenant_id = ?
    GROUP BY lp.id
    HAVING avg_mastery < ? OR max_risk > ? OR recent_struggles > 5
    ORDER BY max_risk DESC, avg_mastery ASC
  `,
    )
    .bind(ltiContextId, tenantId, threshold, 1 - threshold)
    .all();

  return result.results;
}

/**
 * Get course analytics
 */
export async function getCourseAnalytics(db: D1Database, tenantId: string, ltiContextId: string): Promise<any> {
  // Get the most recent analytics or calculate new ones
  const recent = await db
    .prepare(
      `
    SELECT * FROM course_analytics
    WHERE tenant_id = ? AND lti_context_id = ?
      AND calculated_at > datetime('now', '-1 hour')
    ORDER BY calculated_at DESC
    LIMIT 1
  `,
    )
    .bind(tenantId, ltiContextId)
    .first();

  if (recent) {
    return recent;
  }

  // Calculate fresh analytics
  const analytics = await db
    .prepare(
      `
    SELECT
      COUNT(DISTINCT lp.id) as total_learners,
      COUNT(DISTINCT CASE
        WHEN ls.started_at > datetime('now', '-7 days') THEN lp.id
      END) as active_learners_7d,
      AVG(ls.engagement_score) as avg_engagement_score,
      AVG(cm.mastery_level) as avg_mastery_level,
      COUNT(DISTINCT CASE
        WHEN cm.risk_score > 0.5 THEN lp.id
      END) as at_risk_learners,
      COUNT(se.id) * 1.0 / COUNT(DISTINCT lp.id) / 7 as struggle_event_rate,
      COUNT(DISTINCT cc.id) as chat_sessions_total,
      AVG(cc.satisfaction_rating) as chat_satisfaction_avg,
      AVG(CASE
        WHEN cc.resolution_status = 'resolved' THEN 1.0 ELSE 0.0
      END) as chat_resolution_rate
    FROM learner_profiles lp
    LEFT JOIN learning_sessions ls ON lp.id = ls.learner_profile_id
      AND ls.lti_context_id = ?
    LEFT JOIN concept_mastery cm ON lp.id = cm.learner_profile_id
    LEFT JOIN struggle_events se ON lp.id = se.learner_profile_id
      AND se.event_timestamp > datetime('now', '-7 days')
    LEFT JOIN chat_conversations cc ON lp.id = cc.learner_profile_id
      AND cc.lti_context_id = ?
    WHERE lp.tenant_id = ?
  `,
    )
    .bind(ltiContextId, ltiContextId, tenantId)
    .first();

  // Store the calculated analytics
  if (analytics) {
    await db
      .prepare(
        `
      INSERT INTO course_analytics (
        tenant_id, lti_context_id,
        total_learners, active_learners_7d, avg_engagement_score,
        avg_mastery_level, at_risk_learners, struggle_event_rate,
        chat_sessions_total, chat_satisfaction_avg, chat_resolution_rate,
        period_start, period_end
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-7 days'), datetime('now'))
    `,
      )
      .bind(
        tenantId,
        ltiContextId,
        analytics.total_learners,
        analytics.active_learners_7d,
        analytics.avg_engagement_score,
        analytics.avg_mastery_level,
        analytics.at_risk_learners,
        analytics.struggle_event_rate,
        analytics.chat_sessions_total,
        analytics.chat_satisfaction_avg,
        analytics.chat_resolution_rate,
      )
      .run();
  }

  return analytics;
}

/**
 * Log an audit event
 */
export async function logAuditEvent(
  db: D1Database,
  tenantId: string,
  actorType: string,
  actorId: string,
  action: string,
  resourceType: string,
  resourceId?: string,
  details?: any,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> {
  await db
    .prepare(
      `
    INSERT INTO audit_logs (
      tenant_id, actor_type, actor_id,
      action, resource_type, resource_id,
      ip_address, user_agent, details
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .bind(tenantId, actorType, actorId, action, resourceType, resourceId, ipAddress, userAgent, JSON.stringify(details || {}))
    .run();
}

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Batch insert helper for better performance
 */
export async function batchInsert<T>(
  db: D1Database,
  table: string,
  columns: string[],
  values: T[][],
  batchSize: number = 100,
): Promise<void> {
  const placeholders = columns.map(() => '?').join(', ');
  const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

  for (let i = 0; i < values.length; i += batchSize) {
    const batch = values.slice(i, i + batchSize);
    const statements = batch.map((row) => db.prepare(query).bind(...row));
    await db.batch(statements);
  }
}

/**
 * Health check for database connectivity
 */
export async function healthCheck(db: D1Database): Promise<boolean> {
  try {
    const result = await db.prepare('SELECT 1 as healthy').first<{ healthy: number }>();
    return result?.healthy === 1;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}
