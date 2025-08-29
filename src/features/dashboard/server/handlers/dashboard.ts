import { Context } from 'hono';
import { verify } from 'hono/jwt';
import { z } from 'zod';

// Schema for query parameters
const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0)
});

const insightsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

// Schema for learning style update
const learningStyleUpdateSchema = z.object({
  styleType: z.enum(['visual', 'auditory', 'kinesthetic', 'reading_writing']),
  manualOverride: z.boolean().default(true)
});

// Schema for conversation ID parameter
const conversationIdSchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);

// Helper function to validate JWT payload
function validateJWTPayload(payload: any): { tenantId: string; learnerId: string } {
  if (!payload.tenant_id && !payload['https://purl.imsglobal.org/spec/lti/claim/deployment_id']) {
    throw new Error('Invalid tenant information in token');
  }
  if (!payload.sub && !payload.user_id) {
    throw new Error('Invalid user information in token');
  }
  
  const tenantId = payload.tenant_id || payload['https://purl.imsglobal.org/spec/lti/claim/deployment_id'];
  const learnerId = payload.sub || payload.user_id;
  
  // Validate that IDs are reasonable strings
  if (typeof tenantId !== 'string' || tenantId.length === 0 || tenantId.length > 255) {
    throw new Error('Invalid tenant ID format');
  }
  if (typeof learnerId !== 'string' || learnerId.length === 0 || learnerId.length > 255) {
    throw new Error('Invalid learner ID format');
  }
  
  return { tenantId, learnerId };
}

// Get paginated conversation history
export async function getConversations(c: Context) {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.substring(7);
    const secret = c.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET environment variable is not set');
      return c.json({ error: 'Server configuration error' }, 500);
    }

    let payload;
    try {
      payload = await verify(token, secret);
    } catch {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const queryParams = c.req.query();
    const { limit, offset } = paginationSchema.parse(queryParams);

    const { DB } = c.env;
    const { tenantId, learnerId } = validateJWTPayload(payload);

    // Get conversations with summaries
    const result = await DB.prepare(`
      SELECT 
        cs.id,
        cs.conversation_id,
        cs.summary AS title,
        cs.summary,
        cs.topics,
        cs.message_count,
        cs.created_at AS started_at,
        cs.updated_at AS last_message_at,
        cc.status,
        cc.satisfaction_rating
      FROM conversation_summaries cs
      LEFT JOIN chat_conversations cc ON cc.conversation_id = cs.conversation_id
      WHERE cs.tenant_id = ? AND cs.learner_id = ?
      ORDER BY cs.updated_at DESC
      LIMIT ? OFFSET ?
    `).bind(tenantId, learnerId, limit, offset).all();

    // Get total count
    const countResult = await DB.prepare(`
      SELECT COUNT(*) as total
      FROM conversation_summaries
      WHERE tenant_id = ? AND learner_id = ?
    `).bind(tenantId, learnerId).first();

    const conversations = result.results.map((row: any) => ({
      id: row.id,
      conversationId: row.conversation_id,
      title: row.title || 'Untitled Conversation',
      summary: row.summary,
      topics: row.topics ? JSON.parse(row.topics) : [],
      messageCount: row.message_count || 0,
      startedAt: row.started_at,
      lastMessageAt: row.last_message_at,
      status: row.status || 'closed',
      satisfactionRating: row.satisfaction_rating
    }));

    return c.json({
      conversations,
      pagination: {
        total: countResult?.total || 0,
        limit,
        offset,
        hasMore: offset + limit < (countResult?.total || 0)
      }
    });
  } catch {
    console.error('Error fetching conversations:', error);
    return c.json({ error: 'Failed to fetch conversations' }, 500);
  }
}

// Get learning insights and analytics
export async function getLearningInsights(c: Context) {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.substring(7);
    const secret = c.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET environment variable is not set');
      return c.json({ error: 'Server configuration error' }, 500);
    }

    let payload;
    try {
      payload = await verify(token, secret);
    } catch {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const queryParams = c.req.query();
    const { startDate, endDate } = insightsQuerySchema.parse(queryParams);

    const { DB } = c.env;
    const { tenantId, learnerId } = validateJWTPayload(payload);

    // Build date filter
    let _dateFilter = '';
    const dateParams: any[] = [];
    if (startDate) {
      dateFilter += ' AND cm.created_at >= ?';
      dateParams.push(startDate);
    }
    if (endDate) {
      dateFilter += ' AND cm.created_at <= ?';
      dateParams.push(endDate);
    }

    // Get topic frequencies
    const topicsResult = await DB.prepare(`
      SELECT 
        topics,
        COUNT(*) as count
      FROM conversation_summaries
      WHERE tenant_id = ? AND learner_id = ?
      GROUP BY topics
    `).bind(tenantId, learnerId).all();

    // Process topics (they're stored as JSON arrays)
    const topicFrequencyMap = new Map<string, number>();
    let totalTopicCount = 0;
    
    topicsResult.results.forEach((row: any) => {
      if (row.topics) {
        const topics = JSON.parse(row.topics);
        topics.forEach((topic: string) => {
          topicFrequencyMap.set(topic, (topicFrequencyMap.get(topic) || 0) + 1);
          totalTopicCount++;
        });
      }
    });

    const topicFrequencies = Array.from(topicFrequencyMap.entries())
      .map(([topic, count]) => ({
        topic,
        count,
        percentage: Math.round((count / totalTopicCount) * 100)
      }))
      .sort((a, b) => b.count - a.count);

    // Get learning patterns (messages per day for last 7 days)
    const learningPatternsResult = await DB.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as questions_asked,
        COUNT(DISTINCT conversation_id) as conversations
      FROM chat_messages
      WHERE tenant_id = ? AND learner_id = ? 
        AND sender_type = 'learner'
        AND created_at >= datetime('now', '-7 days')
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `).bind(tenantId, learnerId).all();

    const learningPatterns = learningPatternsResult.results.map((row: any) => ({
      date: row.date,
      questionsAsked: row.questions_asked,
      topicsExplored: 0, // Would need more complex query
      averageResponseTime: 0, // Would need response time tracking
      conversationsStarted: row.conversations
    }));

    // Get learning style
    const learningStyleResult = await DB.prepare(`
      SELECT 
        style_type,
        confidence_score
      FROM learning_styles
      WHERE learner_id = ?
    `).bind(learnerId).first();

    // Calculate metrics
    const totalMessagesResult = await DB.prepare(`
      SELECT COUNT(*) as total
      FROM chat_messages
      WHERE tenant_id = ? AND learner_id = ? AND sender_type = 'learner'
    `).bind(tenantId, learnerId).first();

    const totalConversationsResult = await DB.prepare(`
      SELECT COUNT(*) as total
      FROM conversation_summaries
      WHERE tenant_id = ? AND learner_id = ?
    `).bind(tenantId, learnerId).first();

    const avgMessagesPerConversation = totalConversationsResult?.total > 0
      ? Math.round(totalMessagesResult?.total / totalConversationsResult?.total)
      : 0;

    // Get recent activity trend (compare last 7 days to previous 7 days)
    const recentActivityResult = await DB.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM chat_messages 
         WHERE tenant_id = ? AND learner_id = ? 
         AND created_at >= datetime('now', '-7 days')) as recent,
        (SELECT COUNT(*) FROM chat_messages 
         WHERE tenant_id = ? AND learner_id = ? 
         AND created_at >= datetime('now', '-14 days')
         AND created_at < datetime('now', '-7 days')) as previous
    `).bind(tenantId, learnerId, tenantId, learnerId).first();

    const trend = recentActivityResult?.recent > recentActivityResult?.previous ? 'up' : 
                  recentActivityResult?.recent < recentActivityResult?.previous ? 'down' : 'neutral';
    const changePercent = recentActivityResult?.previous > 0
      ? Math.round(((recentActivityResult?.recent - recentActivityResult?.previous) / recentActivityResult?.previous) * 100)
      : 0;

    const metrics = [
      {
        label: 'Total Questions',
        value: totalMessagesResult?.total || 0,
        trend: trend,
        change: `${changePercent > 0 ? '+' : ''}${changePercent}%`
      },
      {
        label: 'Conversations',
        value: totalConversationsResult?.total || 0
      },
      {
        label: 'Avg Messages/Conv',
        value: avgMessagesPerConversation
      },
      {
        label: 'Topics Explored',
        value: topicFrequencyMap.size
      }
    ];

    return c.json({
      metrics,
      topicFrequencies: topicFrequencies.slice(0, 10), // Top 10 topics
      learningPatterns,
      learningStyle: learningStyleResult ? {
        type: learningStyleResult.style_type,
        confidence: learningStyleResult.confidence_score
      } : null
    });
  } catch {
    console.error('Error fetching learning insights:', error);
    return c.json({ error: 'Failed to fetch learning insights' }, 500);
  }
}

// Update learner's learning style preference
export async function updateLearningStyle(c: Context) {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.substring(7);
    const secret = c.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET environment variable is not set');
      return c.json({ error: 'Server configuration error' }, 500);
    }

    let payload;
    try {
      payload = await verify(token, secret);
    } catch {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const body = await c.req.json();
    const validatedBody = learningStyleUpdateSchema.parse(body);
    const { styleType, manualOverride } = validatedBody;

    const { DB } = c.env;
    const { learnerId } = validateJWTPayload(payload);
    const id = `style_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check if style exists
    const existing = await DB.prepare(`
      SELECT id FROM learning_styles WHERE learner_id = ?
    `).bind(learnerId).first();

    if (existing) {
      // Update existing
      await DB.prepare(`
        UPDATE learning_styles
        SET style_type = ?, manual_override = ?, updated_at = CURRENT_TIMESTAMP
        WHERE learner_id = ?
      `).bind(styleType, manualOverride ? 1 : 0, learnerId).run();
    } else {
      // Insert new
      await DB.prepare(`
        INSERT INTO learning_styles (id, learner_id, style_type, manual_override)
        VALUES (?, ?, ?, ?)
      `).bind(id, learnerId, styleType, manualOverride ? 1 : 0).run();
    }

    return c.json({ success: true, styleType });
  } catch {
    console.error('Error updating learning style:', error);
    return c.json({ error: 'Failed to update learning style' }, 500);
  }
}

// Get conversation summary by ID
export async function getConversationSummary(c: Context) {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.substring(7);
    const secret = c.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET environment variable is not set');
      return c.json({ error: 'Server configuration error' }, 500);
    }

    let payload;
    try {
      payload = await verify(token, secret);
    } catch {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const rawConversationId = c.req.param('conversationId');
    if (!rawConversationId) {
      return c.json({ error: 'Conversation ID required' }, 400);
    }
    
    // Validate conversation ID format
    const validationResult = conversationIdSchema.safeParse(rawConversationId);
    if (!validationResult.success) {
      return c.json({ error: 'Invalid conversation ID format' }, 400);
    }
    const conversationId = validationResult.data;

    const { DB } = c.env;
    const { tenantId, learnerId } = validateJWTPayload(payload);

    const result = await DB.prepare(`
      SELECT 
        id,
        conversation_id,
        summary,
        topics,
        message_count,
        created_at,
        updated_at
      FROM conversation_summaries
      WHERE tenant_id = ? AND learner_id = ? AND conversation_id = ?
    `).bind(tenantId, learnerId, conversationId).first();

    if (!result) {
      return c.json({ error: 'Conversation summary not found' }, 404);
    }

    return c.json({
      id: result.id,
      conversationId: result.conversation_id,
      summary: result.summary,
      topics: result.topics ? JSON.parse(result.topics) : [],
      messageCount: result.message_count,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    });
  } catch {
    console.error('Error fetching conversation summary:', error);
    return c.json({ error: 'Failed to fetch conversation summary' }, 500);
  }
}