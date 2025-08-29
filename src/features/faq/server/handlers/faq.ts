import { Hono } from 'hono';
import { FAQKnowledgeBase, type FAQSearchOptions } from '../services/FAQKnowledgeBase';
import { AIService } from '@shared/server/services';
import { sanitizeInput, sanitizeRichContent } from '@shared/server/utils/sanitizer';

type Bindings = {
  AI: any;
  KV_CACHE: any;
  VECTORIZE_INDEX: any;
  DB: any;
};

type Variables = {
  tenantId?: string;
  userId?: string;
};

const faq = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Middleware to extract tenant and user information
faq.use('*', async(c, next) => {
  // Extract tenant/user from headers or JWT (simplified for now)
  const tenantId = c.req.header('x-tenant-id') || 'default';
  const userId = c.req.header('x-user-id') || 'anonymous';

  c.set('tenantId', tenantId);
  c.set('userId', userId);

  await next();
});

// GET /api/chat/faq/search - Search FAQ database
faq.get('/search', async(c) => {
  const startTime = Date.now();

  try {
    const query = c.req.query('q');
    const courseId = c.req.query('course');
    //const moduleId = c.req.query('module');
    const limit = parseInt(c.req.query('limit') || '5');
    const fuzzy = c.req.query('fuzzy') === 'true';
    const sortBy = (c.req.query('sort') as 'relevance' | 'usage' | 'effectiveness') || 'relevance';
    const minConfidence = parseFloat(c.req.query('confidence') || '0.7');

    const tenantId = c.get('tenantId')!;

    if (!query) {
      return c.json({ error: 'Query parameter "q" is required' }, 400);
    }

    // Sanitize the query
    const sanitizedQuery = sanitizeInput(query);

    const aiService = new AIService(c.env.AI);
    const faqService = new FAQKnowledgeBase(aiService, c.env.VECTORIZE_INDEX, c.env.KV_CACHE, c.env.DB);

    const options: FAQSearchOptions = {
      fuzzySearch: fuzzy,
      sortBy,
      minConfidence,
    };

    const results = await faqService.searchSimilarFAQs(sanitizedQuery, tenantId, courseId, limit, options);

    const responseTime = Date.now() - startTime;

    // Transform results for API response
    const matches = results.map((faq) => ({
      faq_id: faq.id,
      question: faq.question,
      answer: faq.answer,
      rich_media: faq.richMediaContent || [],
      confidence: faq.similarity || 0,
      usage_count: faq.usageCount,
      effectiveness_score: faq.effectivenessScore,
      module_id: faq.moduleId,
      created_at: faq.createdAt.toISOString(),
      updated_at: faq.updatedAt.toISOString(),
    }));

    return c.json({
      matches,
      response_time_ms: responseTime,
      total_results: matches.length,
      search_options: options,
    });
  } catch {
    console.error('FAQ search error:', error);
    const responseTime = Date.now() - startTime;

    return c.json(
      {
        error: 'Failed to search FAQ database',
        response_time_ms: responseTime,
        matches: [],
      },
      500,
    );
  }
});

// POST /api/chat/faq - Create new FAQ entry
faq.post('/', async(c) => {
  try {
    const tenantId = c.get('tenantId')!;
    const userId = c.get('userId')!;

    const body = await c.req.json();
    const { question, answer, course_id, module_id, rich_media_content } = body;

    if (!question || !answer) {
      return c.json({ error: 'Question and answer are required' }, 400);
    }

    // Sanitize input content
    const sanitizedQuestion = sanitizeInput(question);
    const sanitizedAnswer = sanitizeRichContent(answer);

    // Validate and sanitize rich media content
    let sanitizedRichMedia: any[] = [];
    if (rich_media_content && Array.isArray(rich_media_content)) {
      sanitizedRichMedia = rich_media_content.map((media: any) => {
        const sanitizedContent = sanitizeInput(media.content);

        return {
          type: ['latex', 'code', 'diagram', 'video'].includes(media.type) ? media.type : 'text',
          content: sanitizedContent,
          metadata: media.metadata || {},
        };
      });
    }

    const aiService = new AIService(c.env.AI);
    const faqService = new FAQKnowledgeBase(aiService, c.env.VECTORIZE_INDEX, c.env.KV_CACHE, c.env.DB);

    const newFAQ = await faqService.addFAQ(sanitizedQuestion, sanitizedAnswer, tenantId, course_id, module_id, sanitizedRichMedia);

    // Log FAQ creation for management tracking
    await c.env.DB.prepare(
      `
      INSERT INTO faq_management_log (
        id, tenant_id, instructor_id, faq_id, action, changes_made, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    )
      .bind(
        `log_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        tenantId,
        userId,
        newFAQ.id,
        'created',
        JSON.stringify({ question: sanitizedQuestion, answer: sanitizedAnswer }),
        new Date().toISOString(),
      )
      .run();

    return c.json(
      {
        success: true,
        faq: {
          id: newFAQ.id,
          question: newFAQ.question,
          answer: newFAQ.answer,
          rich_media_content: newFAQ.richMediaContent,
          usage_count: newFAQ.usageCount,
          effectiveness_score: newFAQ.effectivenessScore,
          created_at: newFAQ.createdAt.toISOString(),
        },
      },
      201,
    );
  } catch {
    console.error('FAQ creation error:', error);
    return c.json({ error: 'Failed to create FAQ entry' }, 500);
  }
});

// PUT /api/chat/faq/:id - Update FAQ entry
faq.put('/:id', async(c) => {
  try {
    const faqId = c.req.param('id');
    const tenantId = c.get('tenantId')!;
    const userId = c.get('userId')!;

    const body = await c.req.json();
    const { question, answer, rich_media_content } = body;

    if (!question && !answer && !rich_media_content) {
      return c.json({ error: 'At least one field (question, answer, rich_media_content) must be provided' }, 400);
    }

    // Sanitize updates
    const updates: any = {};
    if (question) {
      updates.question = sanitizeInput(question);
    }
    if (answer) {
      updates.answer = sanitizeRichContent(answer);
    }

    const aiService = new AIService(c.env.AI);
    const faqService = new FAQKnowledgeBase(aiService, c.env.VECTORIZE_INDEX, c.env.KV_CACHE, c.env.DB);

    const updatedFAQ = await faqService.updateFAQ(faqId, updates, tenantId);

    // Log FAQ update
    await c.env.DB.prepare(
      `
      INSERT INTO faq_management_log (
        id, tenant_id, instructor_id, faq_id, action, changes_made, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    )
      .bind(
        `log_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        tenantId,
        userId,
        faqId,
        'updated',
        JSON.stringify(updates),
        new Date().toISOString(),
      )
      .run();

    return c.json({
      success: true,
      faq: {
        id: updatedFAQ.id,
        question: updatedFAQ.question,
        answer: updatedFAQ.answer,
        rich_media_content: updatedFAQ.richMediaContent,
        usage_count: updatedFAQ.usageCount,
        effectiveness_score: updatedFAQ.effectivenessScore,
        updated_at: updatedFAQ.updatedAt.toISOString(),
      },
    });
  } catch {
    console.error('FAQ update error:', error);
    return c.json({ error: 'Failed to update FAQ entry' }, 500);
  }
});

// DELETE /api/chat/faq/:id - Delete FAQ entry
faq.delete('/:id', async(c) => {
  try {
    const faqId = c.req.param('id');
    const tenantId = c.get('tenantId')!;
    const userId = c.get('userId')!;

    const aiService = new AIService(c.env.AI);
    const faqService = new FAQKnowledgeBase(aiService, c.env.VECTORIZE_INDEX, c.env.KV_CACHE, c.env.DB);

    await faqService.deleteFAQ(faqId, tenantId);

    // Log FAQ deletion
    await c.env.DB.prepare(
      `
      INSERT INTO faq_management_log (
        id, tenant_id, instructor_id, faq_id, action, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    )
      .bind(
        `log_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        tenantId,
        userId,
        faqId,
        'deleted',
        new Date().toISOString(),
      )
      .run();

    return c.json({ success: true, message: 'FAQ deleted successfully' });
  } catch {
    console.error('FAQ deletion error:', error);
    if (error instanceof Error && error.message === 'FAQ not found') {
      return c.json({ error: 'FAQ not found' }, 404);
    }
    return c.json({ error: 'Failed to delete FAQ entry' }, 500);
  }
});

// POST /api/chat/faq/:id/effectiveness - Update FAQ effectiveness based on user feedback
faq.post('/:id/effectiveness', async(c) => {
  try {
    const faqId = c.req.param('id');
    const tenantId = c.get('tenantId')!;

    const body = await c.req.json();
    const { engagement_time, follow_up_question, user_rating, helpfulness } = body;

    const aiService = new AIService(c.env.AI);
    const faqService = new FAQKnowledgeBase(aiService, c.env.VECTORIZE_INDEX, c.env.KV_CACHE, c.env.DB);

    await faqService.updateFAQEffectiveness(faqId, tenantId, {
      engagementTime: engagement_time,
      followUpQuestion: follow_up_question,
      userRating: user_rating,
      helpfulness,
    });

    return c.json({ success: true, message: 'FAQ effectiveness updated' });
  } catch {
    console.error('FAQ effectiveness update error:', error);
    return c.json({ error: 'Failed to update FAQ effectiveness' }, 500);
  }
});

// GET /api/dashboard/faq - FAQ management interface for instructors
faq.get('/management', async(c) => {
  try {
    const tenantId = c.get('tenantId')!;
    const courseId = c.req.query('course');
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100); // Max 100 per page
    const offset = (page - 1) * limit;

    let query = `
      SELECT *,
        COUNT(*) OVER() as total_count
      FROM faq_entries
      WHERE tenant_id = ?
    `;
    const params = [tenantId];

    if (courseId) {
      query += ' AND course_id = ?';
      params.push(courseId);
    }

    query += ` ORDER BY usage_count DESC, effectiveness_score DESC
               LIMIT ? OFFSET ?`;
    params.push(limit.toString(), offset.toString());

    const results = await c.env.DB.prepare(query)
      .bind(...params)
      .all();

    const faqs =
      results.results?.map((row: any) => ({
        id: row.id,
        question: row.question,
        answer: row.answer,
        rich_media_content: row.rich_media_content ? JSON.parse(row.rich_media_content) : [],
        course_id: row.course_id,
        module_id: row.module_id,
        usage_count: row.usage_count,
        effectiveness_score: row.effectiveness_score,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })) || [];

    const totalCount = results.results?.[0]?.total_count || 0;
    const totalPages = Math.ceil(totalCount / limit);

    return c.json({
      faqs,
      pagination: {
        current_page: page,
        total_pages: totalPages,
        total_count: totalCount,
        has_next: page < totalPages,
        has_previous: page > 1,
      },
    });
  } catch {
    console.error('FAQ management retrieval error:', error);
    return c.json({ error: 'Failed to retrieve FAQ management data' }, 500);
  }
});

// GET /api/dashboard/faq/analytics - FAQ usage analytics
faq.get('/analytics', async(c) => {
  try {
    const tenantId = c.get('tenantId')!;
    const courseId = c.req.query('course');
    const days = parseInt(c.req.query('days') || '30');

    let baseQuery = `
      SELECT
        f.id,
        f.question,
        f.usage_count,
        f.effectiveness_score,
        f.course_id,
        f.created_at
      FROM faq_entries f
      WHERE f.tenant_id = ?
    `;
    const params = [tenantId];

    if (courseId) {
      baseQuery += ' AND f.course_id = ?';
      params.push(courseId);
    }

    // Get top performing FAQs
    const topFAQs = await c.env.DB.prepare(baseQuery + ' ORDER BY f.usage_count DESC LIMIT 10')
      .bind(...params)
      .all();

    // Get usage patterns analytics
    let patternsQuery = `
      SELECT
        question_pattern,
        occurrence_count,
        last_asked,
        generated_faq_id IS NOT NULL as has_auto_faq
      FROM faq_usage_analytics
      WHERE tenant_id = ?
    `;
    const patternsParams = [tenantId];

    if (courseId) {
      patternsQuery += ' AND course_id = ?';
      patternsParams.push(courseId);
    }

    patternsQuery += ' ORDER BY occurrence_count DESC LIMIT 20';

    const patterns = await c.env.DB.prepare(patternsQuery)
      .bind(...patternsParams)
      .all();

    // Get effectiveness trends (simplified)
    const avgEffectiveness = await c.env.DB.prepare(
      `
      SELECT
        AVG(effectiveness_score) as avg_effectiveness,
        COUNT(*) as total_faqs
      FROM faq_entries
      WHERE tenant_id = ? ${courseId ? 'AND course_id = ?' : ''}
    `,
    )
      .bind(...params.slice(0, courseId ? 2 : 1))
      .first();

    return c.json({
      top_faqs:
        topFAQs.results?.map((row: any) => ({
          id: row.id,
          question: row.question,
          usage_count: row.usage_count,
          effectiveness_score: row.effectiveness_score,
          course_id: row.course_id,
        })) || [],
      usage_patterns:
        patterns.results?.map((row: any) => ({
          pattern: row.question_pattern,
          count: row.occurrence_count,
          last_asked: row.last_asked,
          has_auto_faq: row.has_auto_faq,
        })) || [],
      summary: {
        average_effectiveness: avgEffectiveness?.avg_effectiveness || 0,
        total_faqs: avgEffectiveness?.total_faqs || 0,
        analysis_period_days: days,
      },
    });
  } catch {
    console.error('FAQ analytics error:', error);
    return c.json({ error: 'Failed to retrieve FAQ analytics' }, 500);
  }
});

export default faq;
