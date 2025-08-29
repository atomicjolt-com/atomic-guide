import { Hono } from 'hono';
import { Context } from '../../types';
import { ContentAnalyzer } from '../../services/ContentAnalyzer';
import { z } from 'zod';
import { nanoid } from 'nanoid';

const contentExtractionSchema = z.object({
  pageUrl: z.string().url(),
  pageType: z.enum(['assignment', 'discussion', 'module', 'page', 'quiz', 'unknown']),
  lmsType: z.enum(['canvas', 'moodle', 'blackboard', 'd2l', 'unknown']).optional(),
  content: z.object({
    html: z.string(),
    text: z.string(),
    title: z.string(),
    metadata: z.object({
      headings: z.array(z.object({
        level: z.number(),
        text: z.string(),
        id: z.string().optional()
      })),
      links: z.array(z.object({
        url: z.string(),
        text: z.string(),
        target: z.string().optional()
      })),
      images: z.array(z.object({
        src: z.string(),
        alt: z.string(),
        title: z.string().optional()
      })),
      lists: z.array(z.object({
        type: z.enum(['ordered', 'unordered']),
        items: z.array(z.string())
      })),
      emphasis: z.array(z.object({
        type: z.enum(['bold', 'italic', 'underline']),
        text: z.string()
      })),
      tables: z.array(z.object({
        headers: z.array(z.string()),
        rows: z.array(z.array(z.string()))
      }))
    })
  }),
  timestamp: z.string(),
  contentHash: z.string(),
  instructorConsent: z.boolean()
});

const contentEngagementSchema = z.object({
  contentId: z.string(),
  pageUrl: z.string().url(),
  sessionId: z.string(),
  engagementData: z.object({
    scrollDepth: z.number().min(0).max(100),
    timeSpent: z.number().min(0),
    interactions: z.array(z.object({
      type: z.string(),
      timestamp: z.string(),
      element: z.string().optional()
    })),
    hoverEvents: z.number().default(0),
    rapidScrollEvents: z.number().default(0)
  })
});

const app = new Hono<Context>();

async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

async function checkInstructorPermissions(
  env: any,
  tenantId: string,
  instructorId: string,
  courseId: string
): Promise<boolean> {
  const settings = await env.DB.prepare(
    `SELECT extraction_enabled, auto_extract FROM content_extraction_settings 
     WHERE tenant_id = ? AND instructor_id = ? AND course_id = ?`
  ).bind(tenantId, instructorId, courseId).first();

  return settings?.extraction_enabled || false;
}

async function checkCourseMembership(
  env: any,
  tenantId: string,
  userId: string,
  courseId: string
): Promise<boolean> {
  // Check if user is enrolled in the course or is an instructor
  const membership = await env.DB.prepare(
    `SELECT role FROM course_enrollments 
     WHERE tenant_id = ? AND user_id = ? AND course_id = ? 
     AND status = 'active'`
  ).bind(tenantId, userId, courseId).first();
  
  return membership !== null;
}

async function logContentAudit(
  env: any,
  tenantId: string,
  actorId: string,
  action: string,
  contentId?: string,
  pageUrl?: string,
  success: boolean = true,
  errorMessage?: string
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO content_extraction_audit (
      id, tenant_id, actor_id, actor_type, action, content_id, page_url,
      success, error_message, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(
    nanoid(),
    tenantId,
    actorId,
    'instructor',
    action,
    contentId,
    pageUrl,
    success ? 1 : 0,
    errorMessage
  ).run();
}

async function trackProcessingMetrics(
  env: any,
  tenantId: string,
  operation: string,
  durationMs: number,
  contentId?: string,
  contentSizeBytes?: number,
  success: boolean = true,
  errorType?: string
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO content_processing_metrics (
      id, tenant_id, content_id, operation, duration_ms, content_size_bytes,
      success, error_type, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(
    nanoid(),
    tenantId,
    contentId,
    operation,
    durationMs,
    contentSizeBytes,
    success ? 1 : 0,
    errorType
  ).run();
}

app.post('/extract', async (c) => {
  const startTime = Date.now();
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const courseId = c.get('courseId');

  try {
    const body = await c.req.json();
    const validated = contentExtractionSchema.parse(body);

    if (!validated.instructorConsent) {
      await logContentAudit(c.env, tenantId, userId, 'extract', undefined, validated.pageUrl, false, 'No instructor consent');
      return c.json({ error: 'Instructor consent required for content extraction' }, 403);
    }

    // First check if user is a member of the course
    const hasMembership = await checkCourseMembership(c.env, tenantId, userId, courseId);
    if (!hasMembership) {
      await logContentAudit(c.env, tenantId, userId, 'extract', undefined, validated.pageUrl, false, 'Not enrolled in course');
      return c.json({ error: 'Access denied: You must be enrolled in this course to extract content' }, 403);
    }

    // Then check instructor permissions for content extraction
    const hasPermission = await checkInstructorPermissions(c.env, tenantId, userId, courseId);
    if (!hasPermission) {
      await logContentAudit(c.env, tenantId, userId, 'extract', undefined, validated.pageUrl, false, 'Permission denied');
      return c.json({ error: 'Content extraction not enabled for this course' }, 403);
    }

    const contentId = nanoid();
    const contentHash = await hashContent(validated.content.html);

    const existing = await c.env.DB.prepare(
      `SELECT id, version_number FROM lms_content 
       WHERE tenant_id = ? AND page_url = ? AND content_hash = ?`
    ).bind(tenantId, validated.pageUrl, contentHash).first();

    if (existing) {
      await trackProcessingMetrics(c.env, tenantId, 'cache_hit', Date.now() - startTime, existing.id);
      return c.json({
        contentId: existing.id,
        analysisId: existing.id,
        extractionStatus: 'cached',
        processingTime: Date.now() - startTime
      });
    }

    const existingPage = await c.env.DB.prepare(
      `SELECT id, version_number, content_hash FROM lms_content 
       WHERE tenant_id = ? AND page_url = ? 
       ORDER BY version_number DESC LIMIT 1`
    ).bind(tenantId, validated.pageUrl).first();

    const versionNumber = existingPage ? existingPage.version_number + 1 : 1;

    await c.env.DB.prepare(
      `INSERT INTO lms_content (
        id, tenant_id, page_url, page_type, lms_type, content_hash,
        raw_content, processed_content, version_number, created_by,
        extraction_consent, extraction_method
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      contentId,
      tenantId,
      validated.pageUrl,
      validated.pageType,
      validated.lmsType || 'unknown',
      contentHash,
      validated.content.html,
      JSON.stringify({
        title: validated.content.title,
        text: validated.content.text,
        metadata: validated.content.metadata
      }),
      versionNumber,
      userId,
      1,
      'postmessage'
    ).run();

    if (existingPage) {
      await c.env.DB.prepare(
        `INSERT INTO content_versions (
          id, content_id, version_number, content_hash, change_magnitude
        ) VALUES (?, ?, ?, ?, ?)`
      ).bind(
        nanoid(),
        contentId,
        versionNumber,
        contentHash,
        'moderate'
      ).run();
    }

    const analyzer = new ContentAnalyzer(c.env.AI);
    const analysis = await analyzer.analyzeContent({
      pageUrl: validated.pageUrl,
      pageType: validated.pageType,
      content: validated.content,
      timestamp: validated.timestamp,
      contentHash
    });

    await c.env.DB.prepare(
      `INSERT INTO content_analysis (
        id, content_id, key_concepts, learning_objectives,
        prerequisite_concepts, difficulty_indicators,
        assessment_opportunities, analysis_confidence,
        readability_score, estimated_reading_time,
        content_complexity, topic_categories
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      nanoid(),
      contentId,
      JSON.stringify(analysis.keyConcepts),
      JSON.stringify(analysis.learningObjectives),
      JSON.stringify(analysis.prerequisiteKnowledge),
      JSON.stringify({}),
      JSON.stringify(analysis.assessmentOpportunities),
      0.85,
      analysis.readabilityScore,
      analysis.estimatedReadingTime,
      analysis.contentComplexity,
      JSON.stringify(analysis.topicCategories)
    ).run();

    await logContentAudit(c.env, tenantId, userId, 'extract', contentId, validated.pageUrl, true);
    await trackProcessingMetrics(
      c.env,
      tenantId,
      'extraction',
      Date.now() - startTime,
      contentId,
      new Blob([validated.content.html]).size,
      true
    );

    return c.json({
      contentId,
      analysisId: contentId,
      extractionStatus: 'success',
      processingTime: Date.now() - startTime
    });
  } catch (error) {
    await logContentAudit(c.env, tenantId, userId, 'extract', undefined, undefined, false, error.message);
    await trackProcessingMetrics(c.env, tenantId, 'extraction', Date.now() - startTime, undefined, undefined, false, 'extraction_error');
    
    console.error('Content extraction error:', error);
    return c.json({ error: 'Failed to extract content' }, 500);
  }
});

app.get('/context/:pageUrl', async (c) => {
  const startTime = Date.now();
  const tenantId = c.get('tenantId');
  const pageUrl = decodeURIComponent(c.req.param('pageUrl'));

  try {
    const cachedContent = await c.env.CONTENT_CACHE.get(`context:${tenantId}:${pageUrl}`);
    if (cachedContent) {
      await trackProcessingMetrics(c.env, tenantId, 'cache_hit', Date.now() - startTime);
      return c.json(JSON.parse(cachedContent));
    }

    const content = await c.env.DB.prepare(
      `SELECT 
        lc.id, lc.page_url, lc.page_type, lc.processed_content,
        lc.extracted_at, lc.version_number,
        ca.key_concepts, ca.learning_objectives, ca.prerequisite_concepts,
        ca.assessment_opportunities, ca.readability_score,
        ca.estimated_reading_time, ca.content_complexity, ca.topic_categories
      FROM lms_content lc
      LEFT JOIN content_analysis ca ON lc.id = ca.content_id
      WHERE lc.tenant_id = ? AND lc.page_url = ?
      ORDER BY lc.version_number DESC
      LIMIT 1`
    ).bind(tenantId, pageUrl).first();

    if (!content) {
      await trackProcessingMetrics(c.env, tenantId, 'cache_miss', Date.now() - startTime);
      return c.json({ error: 'Content not found' }, 404);
    }

    const engagementStats = await c.env.DB.prepare(
      `SELECT 
        COUNT(DISTINCT learner_id) as total_sessions,
        AVG(total_time_seconds) as avg_time_spent,
        AVG(scroll_depth_percent) as avg_scroll_depth,
        SUM(hover_confusion_events) as total_confusion_events,
        SUM(rapid_scroll_events) as total_rapid_scrolls
      FROM content_engagement
      WHERE content_id = ? AND tenant_id = ?`
    ).bind(content.id, tenantId).first();

    const assessmentData = await c.env.DB.prepare(
      `SELECT 
        location_identifier, assessment_type, difficulty_level,
        success_threshold, effectiveness_score
      FROM content_assessments
      WHERE content_id = ?
      ORDER BY effectiveness_score DESC
      LIMIT 5`
    ).bind(content.id).all();

    const response = {
      content: {
        id: content.id,
        pageUrl: content.page_url,
        pageType: content.page_type,
        processedContent: {
          keyConcepts: JSON.parse(content.key_concepts || '[]'),
          learningObjectives: JSON.parse(content.learning_objectives || '[]'),
          prerequisiteKnowledge: JSON.parse(content.prerequisite_concepts || '[]'),
          assessmentOpportunities: JSON.parse(content.assessment_opportunities || '[]'),
          readabilityScore: content.readability_score,
          estimatedReadingTime: content.estimated_reading_time,
          contentComplexity: content.content_complexity,
          topicCategories: JSON.parse(content.topic_categories || '[]')
        },
        extractedAt: content.extracted_at,
        version: content.version_number
      },
      engagement: {
        totalSessions: engagementStats?.total_sessions || 0,
        averageTimeSpent: engagementStats?.avg_time_spent || 0,
        averageScrollDepth: engagementStats?.avg_scroll_depth || 0,
        commonStruggles: [],
        optimalAssessmentPoints: assessmentData.results.map(a => ({
          location: a.location_identifier,
          type: a.assessment_type,
          difficulty: a.difficulty_level,
          successThreshold: a.success_threshold,
          effectivenessScore: a.effectiveness_score
        }))
      }
    };

    await c.env.CONTENT_CACHE.put(
      `context:${tenantId}:${pageUrl}`,
      JSON.stringify(response),
      { expirationTtl: 300 }
    );

    await trackProcessingMetrics(c.env, tenantId, 'cache_miss', Date.now() - startTime, content.id);

    return c.json(response);
  } catch (error) {
    await trackProcessingMetrics(c.env, tenantId, 'error', Date.now() - startTime, undefined, undefined, false, 'context_error');
    console.error('Context retrieval error:', error);
    return c.json({ error: 'Failed to retrieve content context' }, 500);
  }
});

app.post('/engagement', async (c) => {
  const tenantId = c.get('tenantId');
  const learnerId = c.get('userId');

  try {
    const body = await c.req.json();
    const validated = contentEngagementSchema.parse(body);

    const engagementId = nanoid();

    await c.env.DB.prepare(
      `INSERT INTO content_engagement (
        id, tenant_id, learner_id, content_id, page_url, session_id,
        engagement_data, total_time_seconds, scroll_depth_percent,
        interaction_count, hover_confusion_events, rapid_scroll_events
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      engagementId,
      tenantId,
      learnerId,
      validated.contentId,
      validated.pageUrl,
      validated.sessionId,
      JSON.stringify(validated.engagementData),
      validated.engagementData.timeSpent,
      validated.engagementData.scrollDepth,
      validated.engagementData.interactions.length,
      validated.engagementData.hoverEvents,
      validated.engagementData.rapidScrollEvents
    ).run();

    if (validated.engagementData.hoverEvents > 3 || validated.engagementData.rapidScrollEvents > 2) {
      const assessmentOpportunity = {
        location: `High confusion area at ${validated.engagementData.scrollDepth}% scroll`,
        type: 'comprehension',
        difficulty: 0.3,
        reasoning: 'Multiple confusion indicators detected'
      };

      await c.env.DB.prepare(
        `INSERT INTO content_assessments (
          id, content_id, assessment_type, location_identifier,
          difficulty_level, suggested_questions, optimal_timing
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        nanoid(),
        validated.contentId,
        assessmentOpportunity.type,
        assessmentOpportunity.location,
        assessmentOpportunity.difficulty,
        JSON.stringify([]),
        'immediate'
      ).run();
    }

    return c.json({
      engagementId,
      tracked: true,
      assessmentSuggested: validated.engagementData.hoverEvents > 3 || validated.engagementData.rapidScrollEvents > 2
    });
  } catch (error) {
    console.error('Engagement tracking error:', error);
    return c.json({ error: 'Failed to track engagement' }, 500);
  }
});

app.get('/search', async (c) => {
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const courseId = c.get('courseId');
  const query = c.req.query('q');
  const pageType = c.req.query('type');
  const limit = parseInt(c.req.query('limit') || '10');

  if (!query) {
    return c.json({ error: 'Search query required' }, 400);
  }

  // Verify user has access to the course content
  const hasMembership = await checkCourseMembership(c.env, tenantId, userId, courseId);
  if (!hasMembership) {
    return c.json({ error: 'Access denied: You must be enrolled in this course to search its content' }, 403);
  }

  try {
    let sql = `
      SELECT 
        lc.id, lc.page_url, lc.page_type, lc.processed_content,
        ca.key_concepts, ca.learning_objectives, ca.content_complexity
      FROM lms_content lc
      LEFT JOIN content_analysis ca ON lc.id = ca.content_id
      WHERE lc.tenant_id = ?
        AND (lc.raw_content LIKE ? OR json_extract(lc.processed_content, '$.title') LIKE ?)
    `;

    // Sanitize search query to prevent SQL injection through LIKE patterns
    const sanitizedQuery = query.replace(/[%_\\]/g, '\\$&'); // Escape LIKE wildcards
    const params: any[] = [tenantId, `%${sanitizedQuery}%`, `%${sanitizedQuery}%`];

    if (pageType) {
      sql += ' AND lc.page_type = ?';
      params.push(pageType);
    }

    sql += ' ORDER BY lc.extracted_at DESC LIMIT ?';
    params.push(limit);

    const results = await c.env.DB.prepare(sql).bind(...params).all();

    return c.json({
      query,
      results: results.results.map(r => ({
        id: r.id,
        pageUrl: r.page_url,
        pageType: r.page_type,
        title: JSON.parse(r.processed_content).title,
        keyConcepts: JSON.parse(r.key_concepts || '[]').slice(0, 5),
        learningObjectives: JSON.parse(r.learning_objectives || '[]').slice(0, 3),
        complexity: r.content_complexity
      })),
      total: results.results.length
    });
  } catch (error) {
    console.error('Content search error:', error);
    return c.json({ error: 'Search failed' }, 500);
  }
});

app.post('/settings', async (c) => {
  const tenantId = c.get('tenantId');
  const instructorId = c.get('userId');
  const courseId = c.get('courseId');

  try {
    const body = await c.req.json();

    const existing = await c.env.DB.prepare(
      `SELECT id FROM content_extraction_settings 
       WHERE tenant_id = ? AND instructor_id = ? AND course_id = ?`
    ).bind(tenantId, instructorId, courseId).first();

    if (existing) {
      await c.env.DB.prepare(
        `UPDATE content_extraction_settings 
         SET extraction_enabled = ?, auto_extract = ?, content_types_allowed = ?,
             retention_days = ?, anonymize_engagement = ?, require_student_consent = ?,
             updated_at = datetime('now')
         WHERE id = ?`
      ).bind(
        body.extractionEnabled ? 1 : 0,
        body.autoExtract ? 1 : 0,
        JSON.stringify(body.contentTypesAllowed || ['assignment', 'page', 'module']),
        body.retentionDays || 90,
        body.anonymizeEngagement !== false ? 1 : 0,
        body.requireStudentConsent ? 1 : 0,
        existing.id
      ).run();
    } else {
      await c.env.DB.prepare(
        `INSERT INTO content_extraction_settings (
          id, tenant_id, instructor_id, course_id, extraction_enabled,
          auto_extract, content_types_allowed, retention_days,
          anonymize_engagement, require_student_consent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        nanoid(),
        tenantId,
        instructorId,
        courseId,
        body.extractionEnabled ? 1 : 0,
        body.autoExtract ? 1 : 0,
        JSON.stringify(body.contentTypesAllowed || ['assignment', 'page', 'module']),
        body.retentionDays || 90,
        body.anonymizeEngagement !== false ? 1 : 0,
        body.requireStudentConsent ? 1 : 0
      ).run();
    }

    await logContentAudit(c.env, tenantId, instructorId, 'settings_update', undefined, undefined, true);

    return c.json({ success: true, message: 'Settings updated' });
  } catch (error) {
    console.error('Settings update error:', error);
    return c.json({ error: 'Failed to update settings' }, 500);
  }
});

export default app;