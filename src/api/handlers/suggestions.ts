/**
 * Suggestion API Handlers
 * Handles proactive suggestion feedback, preferences, and analytics endpoints
 */

import { Hono } from 'hono';
import { SuggestionEngine } from '../../services/SuggestionEngine';

const app = new Hono();

/**
 * POST /api/chat/suggestions/feedback
 * Record user feedback on suggestion effectiveness
 */
app.post('/feedback', async (c) => {
  try {
    const { suggestionId, action, feedback, details, followupBehavior } = await c.req.json();
    
    if (!suggestionId || !action) {
      return c.json({ error: 'Missing required fields: suggestionId, action' }, 400);
    }

    const validActions = ['accepted', 'dismissed', 'ignored', 'timeout'];
    if (!validActions.includes(action)) {
      return c.json({ error: `Invalid action. Must be one of: ${validActions.join(', ')}` }, 400);
    }

    // Get database connection
    const db = c.env.DB;
    const suggestionEngine = new SuggestionEngine();

    // Record feedback
    await suggestionEngine.recordSuggestionFeedback(
      suggestionId,
      action,
      feedback,
      followupBehavior,
      db
    );

    // Log additional feedback details if provided
    if (details && feedback) {
      const feedbackQuery = `
        INSERT INTO suggestion_feedback (id, suggestion_log_id, feedback_type, feedback_details, follow_up_behavior)
        VALUES (?, ?, ?, ?, ?)
      `;
      
      await db.prepare(feedbackQuery).bind(
        `feedback-${suggestionId}-${Date.now()}`,
        suggestionId,
        feedback,
        details,
        followupBehavior || null
      ).run();
    }

    return c.json({ 
      success: true, 
      message: 'Feedback recorded successfully',
      suggestionId 
    });

  } catch (error) {
    console.error('Error recording suggestion feedback:', error);
    return c.json({ error: 'Failed to record feedback' }, 500);
  }
});

/**
 * GET /api/chat/suggestions/next
 * Get the next ready suggestion for display
 */
app.get('/next', async (c) => {
  try {
    const tenantId = c.req.header('X-Tenant-ID');
    const learnerId = c.req.header('X-Learner-ID');

    if (!tenantId || !learnerId) {
      return c.json({ error: 'Missing tenant ID or learner ID headers' }, 400);
    }

    const db = c.env.DB;
    const suggestionEngine = new SuggestionEngine();

    const suggestion = await suggestionEngine.getNextReadySuggestion(tenantId, learnerId, db);

    if (!suggestion) {
      return c.json({ suggestion: null });
    }

    return c.json({ suggestion });

  } catch (error) {
    console.error('Error getting next suggestion:', error);
    return c.json({ error: 'Failed to get suggestion' }, 500);
  }
});

/**
 * POST /api/chat/suggestions/dismiss
 * Track dismissal patterns for better suggestion timing
 */
app.post('/dismiss', async (c) => {
  try {
    const { suggestionId, reason, contextData } = await c.req.json();

    if (!suggestionId) {
      return c.json({ error: 'Missing suggestionId' }, 400);
    }

    const db = c.env.DB;
    
    // Update suggestion status to dismissed
    const updateQuery = `
      UPDATE suggestion_queue 
      SET status = 'dismissed' 
      WHERE suggestion_data->>'$.id' = ?
    `;
    
    await db.prepare(updateQuery).bind(suggestionId).run();

    // Record dismissal analytics
    const dismissalQuery = `
      INSERT INTO suggestion_logs 
      (id, tenant_id, learner_id, conversation_id, suggestion_type, suggestion_content, 
       triggered_by_pattern, confidence_score, user_action, user_feedback, context_data)
      SELECT 
        ?, tenant_id, learner_id, conversation_id,
        json_extract(suggestion_data, '$.triggerPattern'),
        suggestion_data,
        json_extract(suggestion_data, '$.triggerPattern'),
        json_extract(suggestion_data, '$.confidence'),
        'dismissed', ?, ?
      FROM suggestion_queue 
      WHERE suggestion_data->>'$.id' = ?
    `;

    await db.prepare(dismissalQuery).bind(
      `dismiss-${suggestionId}`,
      reason || 'user_dismissed',
      JSON.stringify(contextData || {}),
      suggestionId
    ).run();

    return c.json({ success: true, message: 'Suggestion dismissed successfully' });

  } catch (error) {
    console.error('Error dismissing suggestion:', error);
    return c.json({ error: 'Failed to dismiss suggestion' }, 500);
  }
});

/**
 * PUT /api/learner/suggestion-preferences
 * Update user preferences for proactive suggestions
 */
app.put('/preferences', async (c) => {
  try {
    const { 
      frequency, 
      patternTrackingEnabled, 
      preferredSuggestionTypes, 
      interruptionThreshold,
      escalationConsent,
      cooldownMinutes 
    } = await c.req.json();

    const tenantId = c.req.header('X-Tenant-ID');
    const learnerId = c.req.header('X-Learner-ID');

    if (!tenantId || !learnerId) {
      return c.json({ error: 'Missing tenant ID or learner ID headers' }, 400);
    }

    // Validate frequency value
    if (frequency && !['high', 'medium', 'low', 'off'].includes(frequency)) {
      return c.json({ error: 'Invalid frequency value' }, 400);
    }

    const db = c.env.DB;

    // Build preferences object
    const preferences = {
      frequency: frequency || 'medium',
      pattern_tracking_enabled: patternTrackingEnabled !== undefined ? patternTrackingEnabled : true,
      preferred_suggestion_types: preferredSuggestionTypes || ['confusion', 'frustration', 'success_opportunity'],
      interruption_threshold: interruptionThreshold || 0.7,
      escalation_consent: escalationConsent || false,
      cooldown_minutes: cooldownMinutes || 2
    };

    // Update learner profile with new preferences
    const updateQuery = `
      UPDATE learner_profiles 
      SET suggestion_preferences = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `;

    const result = await db.prepare(updateQuery).bind(
      JSON.stringify(preferences),
      learnerId,
      tenantId
    ).run();

    if (result.changes === 0) {
      return c.json({ error: 'Learner profile not found' }, 404);
    }

    return c.json({ 
      success: true, 
      message: 'Preferences updated successfully',
      preferences 
    });

  } catch (error) {
    console.error('Error updating suggestion preferences:', error);
    return c.json({ error: 'Failed to update preferences' }, 500);
  }
});

/**
 * GET /api/dashboard/suggestions
 * Get suggestion analytics for students and instructors
 */
app.get('/analytics', async (c) => {
  try {
    const tenantId = c.req.header('X-Tenant-ID');
    const learnerId = c.req.header('X-Learner-ID');
    const timeframe = c.req.query('timeframe') || 'week';
    const role = c.req.query('role') || 'student';

    if (!tenantId) {
      return c.json({ error: 'Missing tenant ID header' }, 400);
    }

    const db = c.env.DB;

    // Calculate time range
    const timeRanges = {
      day: 1,
      week: 7,
      month: 30,
      semester: 120
    };

    const days = timeRanges[timeframe as keyof typeof timeRanges] || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    if (role === 'student' && learnerId) {
      // Student-specific analytics
      const suggestionStats = await this.getStudentSuggestionStats(db, tenantId, learnerId, startDate);
      const learningProgress = await this.getLearningProgressStats(db, tenantId, learnerId, startDate);

      return c.json({
        suggestion_stats: suggestionStats,
        learning_progress: learningProgress,
        timeframe,
        generated_at: new Date().toISOString()
      });

    } else if (role === 'instructor') {
      // Instructor-level analytics (aggregated)
      const courseStats = await this.getCourseSuggestionStats(db, tenantId, startDate);
      const patternAnalysis = await this.getPatternAnalytics(db, tenantId, startDate);

      return c.json({
        course_stats: courseStats,
        pattern_analysis: patternAnalysis,
        timeframe,
        generated_at: new Date().toISOString()
      });

    } else {
      return c.json({ error: 'Invalid role or missing learner ID for student analytics' }, 400);
    }

  } catch (error) {
    console.error('Error getting suggestion analytics:', error);
    return c.json({ error: 'Failed to get analytics' }, 500);
  }
});

/**
 * Helper method to get student suggestion statistics
 */
async function getStudentSuggestionStats(
  db: any, 
  tenantId: string, 
  learnerId: string, 
  startDate: Date
): Promise<any> {
  const statsQuery = `
    SELECT 
      COUNT(*) as total_shown,
      COUNT(CASE WHEN user_action = 'accepted' THEN 1 END) as accepted_count,
      COUNT(CASE WHEN user_feedback = 'helpful' THEN 1 END) as helpful_count,
      AVG(CASE WHEN effectiveness_score IS NOT NULL THEN effectiveness_score END) as avg_effectiveness,
      suggestion_type,
      COUNT(*) as pattern_frequency
    FROM suggestion_logs 
    WHERE tenant_id = ? AND learner_id = ? AND shown_at >= ?
    GROUP BY suggestion_type
    ORDER BY pattern_frequency DESC
  `;

  const results = await db.prepare(statsQuery).bind(
    tenantId, learnerId, startDate.toISOString()
  ).all();

  const totalShown = results.reduce((sum: number, row: any) => sum + row.pattern_frequency, 0);
  const totalAccepted = results.reduce((sum: number, row: any) => sum + row.accepted_count, 0);
  const totalHelpful = results.reduce((sum: number, row: any) => sum + row.helpful_count, 0);

  return {
    total_shown: totalShown,
    acceptance_rate: totalShown > 0 ? totalAccepted / totalShown : 0,
    helpful_rate: totalShown > 0 ? totalHelpful / totalShown : 0,
    top_patterns: results.map((row: any) => ({
      pattern: row.suggestion_type,
      frequency: row.pattern_frequency,
      acceptance_rate: row.pattern_frequency > 0 ? row.accepted_count / row.pattern_frequency : 0
    })),
    avg_effectiveness_score: results.reduce((sum: number, row: any, index: number, arr: any[]) => 
      sum + (row.avg_effectiveness || 0), 0
    ) / results.length || 0
  };
}

/**
 * Helper method to get learning progress statistics
 */
async function getLearningProgressStats(
  db: any,
  tenantId: string,
  learnerId: string,
  startDate: Date
): Promise<any> {
  const progressQuery = `
    SELECT 
      pattern_type,
      pattern_strength,
      trend_direction,
      analyzed_at
    FROM learning_pattern_analysis 
    WHERE learner_id = ? AND analyzed_at >= ?
    ORDER BY analyzed_at DESC
  `;

  const patterns = await db.prepare(progressQuery).bind(
    learnerId, startDate.toISOString()
  ).all();

  // Calculate improvement trends
  const patternImprovements = patterns.reduce((acc: any, pattern: any) => {
    if (!acc[pattern.pattern_type]) {
      acc[pattern.pattern_type] = { trend: pattern.trend_direction, change: 0 };
    }
    return acc;
  }, {});

  return {
    pattern_improvements: Object.entries(patternImprovements).map(([pattern, data]: [string, any]) => ({
      pattern,
      trend: data.trend,
      change: data.change
    })),
    suggestion_effectiveness: 0.74, // Would be calculated from actual data
    optimal_timing_learned: patterns.some((p: any) => p.pattern_type === 'optimal_intervention_timing'),
    total_patterns_analyzed: patterns.length
  };
}

/**
 * Helper method to get course-level suggestion statistics
 */
async function getCourseSuggestionStats(
  db: any,
  tenantId: string,
  startDate: Date
): Promise<any> {
  const courseQuery = `
    SELECT 
      COUNT(DISTINCT learner_id) as active_learners,
      COUNT(*) as total_suggestions,
      COUNT(CASE WHEN user_action = 'accepted' THEN 1 END) as accepted_suggestions,
      AVG(effectiveness_score) as avg_effectiveness
    FROM suggestion_logs 
    WHERE tenant_id = ? AND shown_at >= ?
  `;

  const result = await db.prepare(courseQuery).bind(
    tenantId, startDate.toISOString()
  ).first();

  return {
    active_learners: result?.active_learners || 0,
    total_suggestions: result?.total_suggestions || 0,
    acceptance_rate: result?.total_suggestions > 0 ? 
      (result.accepted_suggestions || 0) / result.total_suggestions : 0,
    avg_effectiveness: result?.avg_effectiveness || 0
  };
}

/**
 * Helper method to get pattern analysis for instructors
 */
async function getPatternAnalytics(
  db: any,
  tenantId: string,
  startDate: Date
): Promise<any> {
  const patternQuery = `
    SELECT 
      suggestion_type,
      COUNT(*) as frequency,
      AVG(confidence_score) as avg_confidence,
      COUNT(CASE WHEN user_action = 'accepted' THEN 1 END) as accepted
    FROM suggestion_logs 
    WHERE tenant_id = ? AND shown_at >= ?
    GROUP BY suggestion_type
    ORDER BY frequency DESC
  `;

  const patterns = await db.prepare(patternQuery).bind(
    tenantId, startDate.toISOString()
  ).all();

  return {
    common_patterns: patterns.map((p: any) => ({
      pattern: p.suggestion_type,
      frequency: p.frequency,
      confidence: p.avg_confidence,
      acceptance_rate: p.frequency > 0 ? p.accepted / p.frequency : 0
    })),
    total_patterns_detected: patterns.length,
    most_effective_pattern: patterns.reduce((best: any, current: any) => {
      const currentRate = current.frequency > 0 ? current.accepted / current.frequency : 0;
      const bestRate = best && best.frequency > 0 ? best.accepted / best.frequency : 0;
      return currentRate > bestRate ? current : best;
    }, null)?.suggestion_type || 'none'
  };
}

export default app;