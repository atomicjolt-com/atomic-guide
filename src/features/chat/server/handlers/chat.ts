import { Context } from 'hono';
import { verify } from 'hono/jwt';
import { z } from 'zod';
import { AIService, ModelRegistry, PromptBuilder } from '@shared/server/services';
import { ContextEnricher } from '../services/ContextEnricher';
import { FAQKnowledgeBase } from '@features/faq/server/services/FAQKnowledgeBase';
import { SuggestionEngine } from '../services/SuggestionEngine';

// HTML escape function to prevent XSS
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

interface ChatMessageRequest {
  session_id: string;
  message: string;
  page_context: {
    course_id: string | null;
    module_id: string | null;
    page_content: string | null;
    current_element: string | null;
  };
  conversation_id?: string;
}

interface ChatMessageResponse {
  message_id: string;
  content: string;
  timestamp: string;
  conversation_id: string;
  suggestions?: string[];
  media_attachments?: Array<{
    type: 'latex' | 'code' | 'diagram';
    content: string;
  }>;
  token_usage?: {
    used: number;
    remaining: number;
  };
}

export async function handleChatMessage(c: Context): Promise<Response> {
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

    const tenantId = payload.tenant_id || payload.sub;
    const userId = payload.sub || payload.user_id;
    if (!tenantId) {
      return c.json({ error: 'Missing tenant ID' }, 400);
    }

    const body: ChatMessageRequest = await c.req.json();

    if (!body.message || !body.session_id) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Validate message length
    if (body.message.length > 5000) {
      return c.json({ error: 'Message too long. Maximum 5000 characters allowed.' }, 400);
    }

    // Sanitize message content to prevent XSS
    const sanitizedMessage = escapeHtml(body.message);

    const conversationId = body.conversation_id || `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Get or create conversation from Durable Object
    const doId = c.env.CHAT_CONVERSATIONS.idFromName(conversationId);
    const chatDO = c.env.CHAT_CONVERSATIONS.get(doId);

    // Store user message in conversation
    await chatDO.fetch(
      new Request('https://do/add-message', {
        method: 'POST',
        body: JSON.stringify({
          role: 'user',
          content: sanitizedMessage,
          timestamp: new Date().toISOString(),
        }),
      })
    );

    // Initialize AI services
    const aiService = new AIService(c.env.AI);
    const _modelRegistry = new ModelRegistry();
    const promptBuilder = new PromptBuilder();
    const contextEnricher = new ContextEnricher();
    const faqKnowledgeBase = new FAQKnowledgeBase(aiService, c.env.FAQ_INDEX, c.env.CLIENT_AUTH_TOKENS, c.env.DB);
    const suggestionEngine = new SuggestionEngine();

    // Get AI configuration for tenant
    const aiConfig = await getAIConfig(c.env.DB, tenantId);

    // Check FAQ first for quick responses
    const faqs = await faqKnowledgeBase.searchSimilarFAQs(sanitizedMessage, tenantId, body.page_context.course_id || undefined, 3);

    let responseContent: string;
    let tokensUsed = 0;
    let suggestions: string[] = [];

    // If high confidence FAQ match, use it
    if (faqs.length > 0 && faqs[0].similarity && faqs[0].similarity > 0.9) {
      responseContent = faqs[0].answer;
      tokensUsed = 0; // No AI tokens used for FAQ
    } else {
      // Get conversation history from Durable Object
      const historyResponse = await chatDO.fetch(new Request('https://do/get-history'));
      const conversationHistory = (await historyResponse.json()) as Array<{ role: string; content: string }>;

      // Get learner profile if available
      const learnerProfile = await getLearnerProfile(c.env.DB, userId, tenantId);

      // Enrich context
      const pageContext = {
        courseId: body.page_context.course_id || '',
        moduleId: body.page_context.module_id || undefined,
        pageContent: body.page_context.page_content || undefined,
        currentElement: body.page_context.current_element || undefined,
        timestamp: Date.now(),
      };

      const enrichedContext = await contextEnricher.enrichContext(
        pageContext,
        payload, // LTI claims
        learnerProfile,
        { sessionId: body.session_id }
      );

      // Build prompt
      const promptContext = {
        courseName: enrichedContext.page.courseName,
        moduleName: enrichedContext.page.moduleName,
        assignmentTitle: enrichedContext.page.assignmentTitle,
        pageContent: enrichedContext.extractedContent,
        learnerProfile: learnerProfile,
        conversationHistory: conversationHistory.slice(-10), // Last 10 messages
        currentQuestion: sanitizedMessage,
      };

      const templateId = promptBuilder.selectTemplateForContext(promptContext);
      const { systemPrompt, userPrompt } = promptBuilder.buildPrompt(promptContext, templateId);

      // Generate AI response
      const aiResponse = await aiService.generateResponse(userPrompt, systemPrompt, {
        modelName: aiConfig.modelName,
        maxTokens: Math.min(2048, aiConfig.tokenLimitPerSession - aiConfig.tokensUsedToday),
        temperature: 0.7,
      });

      responseContent = aiResponse.response;
      tokensUsed = aiResponse.tokensUsed || 0;

      // Generate suggestions
      const suggestionsData = await suggestionEngine.generateSuggestions(conversationHistory, enrichedContext, learnerProfile);
      suggestions = suggestionsData.map((s) => s.description);
    }

    // Store AI response in conversation
    await chatDO.fetch(
      new Request('https://do/add-message', {
        method: 'POST',
        body: JSON.stringify({
          role: 'assistant',
          content: responseContent,
          timestamp: new Date().toISOString(),
        }),
      })
    );

    // Track token usage
    if (tokensUsed > 0) {
      await trackTokenUsage(c.env.DB, tenantId, userId, conversationId, tokensUsed, aiConfig.modelName);
    }

    const response: ChatMessageResponse = {
      message_id: messageId,
      content: responseContent,
      timestamp: new Date().toISOString(),
      conversation_id: conversationId,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      token_usage: {
        used: tokensUsed,
        remaining: Math.max(0, aiConfig.tokenLimitPerSession - aiConfig.tokensUsedToday - tokensUsed),
      },
    };

    return c.json(response, 200);
  } catch (error) {
    console.error('Chat message error:', error);

    // Provide user-friendly error messages
    if (error instanceof Error) {
      if (error.message.includes('rate limit')) {
        return c.json(
          {
            error: 'Too many requests. Please wait a moment before sending another message.',
            retryAfter: 60,
          },
          429
        );
      }

      if (error.message.includes('token limit')) {
        return c.json(
          {
            error: 'Conversation has reached the token limit. Please start a new conversation.',
            code: 'TOKEN_LIMIT_EXCEEDED',
          },
          403
        );
      }

      if (error.message.includes('AI service')) {
        // Fallback to helpful message when AI fails
        return c.json(
          {
            message_id: `msg-${Date.now()}`,
            content:
              "I'm experiencing technical difficulties at the moment. While I work on resolving this, you might want to:\n\n• Review your course materials\n• Check the discussion forums\n• Contact your instructor directly\n\nPlease try again in a few moments.",
            timestamp: new Date().toISOString(),
            conversation_id: body.conversation_id || '',
            fallback: true,
          },
          200
        );
      }
    }

    return c.json({ error: 'An unexpected error occurred. Please try again.' }, 500);
  }
}

// Helper function to get AI config for tenant
async function getAIConfig(db: any, tenantId: string): Promise<any> {
  const result = await db.prepare('SELECT * FROM ai_config WHERE tenant_id = ?').bind(tenantId).first();

  if (result) {
    // Get today's token usage
    const today = new Date().toISOString().split('T')[0];
    const usageResult = await db
      .prepare(
        `
      SELECT SUM(tokens_used) as total 
      FROM token_usage 
      WHERE tenant_id = ? AND DATE(created_at) = ?
    `
      )
      .bind(tenantId, today)
      .first();

    return {
      modelName: result.model_name || '@cf/meta/llama-3.1-8b-instruct',
      tokenLimitPerSession: result.token_limit_per_session || 10000,
      tokenLimitPerDay: result.token_limit_per_day || 100000,
      rateLimitPerMinute: result.rate_limit_per_minute || 10,
      rateLimitBurst: result.rate_limit_burst || 3,
      enabled: result.enabled !== false,
      tokensUsedToday: usageResult?.total || 0,
    };
  }

  // Return defaults if no config exists
  return {
    modelName: '@cf/meta/llama-3.1-8b-instruct',
    tokenLimitPerSession: 10000,
    tokenLimitPerDay: 100000,
    rateLimitPerMinute: 10,
    rateLimitBurst: 3,
    enabled: true,
    tokensUsedToday: 0,
  };
}

// Helper function to get learner profile
async function getLearnerProfile(db: any, userId: string, tenantId: string): Promise<any> {
  const result = await db
    .prepare(
      `
    SELECT * FROM learner_profiles 
    WHERE user_id = ? AND tenant_id = ?
  `
    )
    .bind(userId, tenantId)
    .first();

  if (result) {
    return {
      learningStyle: result.learning_style,
      performanceLevel: result.performance_level,
      struggleAreas: result.struggle_areas ? JSON.parse(result.struggle_areas) : [],
      preferredLanguage: result.preferred_language || 'en',
    };
  }

  return null;
}

// Helper function to track token usage
async function trackTokenUsage(
  db: any,
  tenantId: string,
  userId: string,
  conversationId: string,
  tokensUsed: number,
  modelName: string
): Promise<void> {
  const id = `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  await db
    .prepare(
      `
    INSERT INTO token_usage (id, tenant_id, user_id, conversation_id, tokens_used, model_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `
    )
    .bind(id, tenantId, userId, conversationId, tokensUsed, modelName, new Date().toISOString())
    .run();
}

// Search endpoint schemas
const searchQuerySchema = z.object({
  query: z.string().min(1).max(500).optional(), // Add length constraints
  topic: z.string().min(1).max(100).optional(), // Add length constraints
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export async function searchChatHistory(c: Context) {
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
    const params = searchQuerySchema.parse(queryParams);

    const { DB } = c.env;
    const tenantId = payload.tenant_id || payload['https://purl.imsglobal.org/spec/lti/claim/deployment_id'];
    const learnerId = payload.sub || payload.user_id;

    let query = `
      SELECT 
        cs.id,
        cs.conversation_id,
        cs.summary AS title,
        cs.summary,
        cs.topics,
        cs.created_at AS started_at,
        cs.updated_at AS last_message_at,
        COUNT(DISTINCT cm.id) AS message_count
      FROM conversation_summaries cs
      LEFT JOIN chat_messages cm ON cm.conversation_id = cs.conversation_id
      WHERE cs.tenant_id = ? AND cs.learner_id = ?
    `;

    const queryParts: string[] = [];
    const queryValues: any[] = [tenantId, learnerId];

    if (params.query) {
      // Sanitize query to prevent SQL injection through LIKE patterns
      const sanitizedQuery = params.query.replace(/[%_\\]/g, '\\$&');
      queryParts.push('(cs.summary LIKE ? OR cs.topics LIKE ?)');
      const searchPattern = `%${sanitizedQuery}%`;
      queryValues.push(searchPattern, searchPattern);
    }

    if (params.topic) {
      // Sanitize topic to prevent SQL injection through LIKE patterns
      const sanitizedTopic = params.topic.replace(/[%_\\]/g, '\\$&');
      queryParts.push('cs.topics LIKE ?');
      queryValues.push(`%${sanitizedTopic}%`);
    }

    if (params.startDate) {
      queryParts.push('cs.created_at >= ?');
      queryValues.push(params.startDate);
    }

    if (params.endDate) {
      queryParts.push('cs.created_at <= ?');
      queryValues.push(params.endDate);
    }

    if (queryParts.length > 0) {
      query += ` AND ${queryParts.join(' AND ')}`;
    }

    query += `
      GROUP BY cs.id
      ORDER BY cs.updated_at DESC
      LIMIT ? OFFSET ?
    `;
    queryValues.push(params.limit, params.offset);

    const result = await DB.prepare(query)
      .bind(...queryValues)
      .all();

    const conversations = result.results.map((row: any) => ({
      id: row.id,
      conversationId: row.conversation_id,
      title: row.title || 'Untitled Conversation',
      summary: row.summary,
      topics: row.topics ? JSON.parse(row.topics) : [],
      messageCount: row.message_count || 0,
      startedAt: row.started_at,
      lastMessageAt: row.last_message_at,
    }));

    const countQuery = `
      SELECT COUNT(*) as total
      FROM conversation_summaries cs
      WHERE cs.tenant_id = ? AND cs.learner_id = ?
      ${queryParts.length > 0 ? `AND ${queryParts.join(' AND ')}` : ''}
    `;

    const countResult = await DB.prepare(countQuery)
      .bind(...queryValues.slice(0, -2))
      .first();

    return c.json({
      conversations,
      total: countResult?.total || 0,
      limit: params.limit,
      offset: params.offset,
    });
  } catch (error) {
    console.error('Error searching chat history:', error);
    return c.json({ error: 'Failed to search chat history' }, 500);
  }
}

export async function getChatConversation(c: Context) {
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

    const conversationId = c.req.param('conversationId');
    if (!conversationId) {
      return c.json({ error: 'Conversation ID required' }, 400);
    }

    const { DB, CHAT_CONVERSATIONS } = c.env;
    const tenantId = payload.tenant_id || payload['https://purl.imsglobal.org/spec/lti/claim/deployment_id'];
    const learnerId = payload.sub || payload.user_id;

    const summaryResult = await DB.prepare(
      `
      SELECT 
        id,
        conversation_id,
        summary,
        topics,
        created_at AS started_at,
        updated_at AS last_message_at
      FROM conversation_summaries
      WHERE tenant_id = ? AND learner_id = ? AND conversation_id = ?
    `
    )
      .bind(tenantId, learnerId, conversationId)
      .first();

    if (!summaryResult) {
      return c.json({ error: 'Conversation not found' }, 404);
    }

    const doId = CHAT_CONVERSATIONS.idFromName(`${tenantId}:${conversationId}`);
    const stub = CHAT_CONVERSATIONS.get(doId);

    const response = await stub.fetch(
      new Request('https://do/messages', {
        method: 'GET',
      })
    );

    const messages = await response.json();

    return c.json({
      id: summaryResult.id,
      conversationId: summaryResult.conversation_id,
      title: summaryResult.summary?.split('.')[0] || 'Untitled Conversation',
      summary: summaryResult.summary,
      topics: summaryResult.topics ? JSON.parse(summaryResult.topics) : [],
      startedAt: summaryResult.started_at,
      lastMessageAt: summaryResult.last_message_at,
      messages: messages || [],
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return c.json({ error: 'Failed to fetch conversation' }, 500);
  }
}

export async function exportUserData(c: Context) {
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

    const format = c.req.query('format') || 'json';
    const { DB } = c.env;
    const tenantId = payload.tenant_id || payload['https://purl.imsglobal.org/spec/lti/claim/deployment_id'];
    const learnerId = payload.sub || payload.user_id;

    // Get all conversations
    const conversationsResult = await DB.prepare(
      `
      SELECT 
        cs.*,
        COUNT(cm.id) as message_count
      FROM conversation_summaries cs
      LEFT JOIN chat_messages cm ON cm.conversation_id = cs.conversation_id
      WHERE cs.tenant_id = ? AND cs.learner_id = ?
      GROUP BY cs.id
      ORDER BY cs.created_at DESC
    `
    )
      .bind(tenantId, learnerId)
      .all();

    // Get all messages
    const messagesResult = await DB.prepare(
      `
      SELECT * FROM chat_messages
      WHERE tenant_id = ? AND learner_id = ?
      ORDER BY created_at DESC
    `
    )
      .bind(tenantId, learnerId)
      .all();

    // Get learner profile
    const profileResult = await DB.prepare(
      `
      SELECT * FROM learner_profiles
      WHERE tenant_id = ? AND user_id = ?
    `
    )
      .bind(tenantId, learnerId)
      .first();

    // Get learning style
    const learningStyleResult = await DB.prepare(
      `
      SELECT * FROM learning_styles
      WHERE learner_id = ?
    `
    )
      .bind(learnerId)
      .first();

    const exportData = {
      exportDate: new Date().toISOString(),
      userId: learnerId,
      tenantId: tenantId,
      profile: profileResult || null,
      learningStyle: learningStyleResult || null,
      conversations: conversationsResult.results.map((conv: any) => ({
        ...conv,
        topics: conv.topics ? JSON.parse(conv.topics) : [],
      })),
      messages: messagesResult.results,
      statistics: {
        totalConversations: conversationsResult.results.length,
        totalMessages: messagesResult.results.length,
        dateRange: {
          earliest: messagesResult.results[messagesResult.results.length - 1]?.created_at || null,
          latest: messagesResult.results[0]?.created_at || null,
        },
      },
    };

    if (format === 'csv') {
      // Convert to CSV format
      const csvData = convertToCSV(exportData);
      return new Response(csvData, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="atomic-guide-export-${Date.now()}.csv"`,
        },
      });
    } else {
      // Return JSON format
      return new Response(JSON.stringify(exportData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="atomic-guide-export-${Date.now()}.json"`,
        },
      });
    }
  } catch (error) {
    console.error('Error exporting user data:', error);
    return c.json({ error: 'Failed to export user data' }, 500);
  }
}

function convertToCSV(data: any): string {
  const csvRows: string[] = [];

  // Add header section
  csvRows.push('Export Information');
  csvRows.push(`Export Date,${data.exportDate}`);
  csvRows.push(`User ID,${data.userId}`);
  csvRows.push(`Tenant ID,${data.tenantId}`);
  csvRows.push('');

  // Add statistics
  csvRows.push('Statistics');
  csvRows.push(`Total Conversations,${data.statistics.totalConversations}`);
  csvRows.push(`Total Messages,${data.statistics.totalMessages}`);
  csvRows.push(`Earliest Message,${data.statistics.dateRange.earliest || 'N/A'}`);
  csvRows.push(`Latest Message,${data.statistics.dateRange.latest || 'N/A'}`);
  csvRows.push('');

  // Add conversations
  csvRows.push('Conversations');
  csvRows.push('ID,Summary,Topics,Created At,Updated At,Message Count');
  data.conversations.forEach((conv: any) => {
    csvRows.push(
      [
        conv.id,
        `"${conv.summary?.replace(/"/g, '""') || ''}"`,
        `"${conv.topics?.join(', ') || ''}"`,
        conv.created_at,
        conv.updated_at,
        conv.message_count,
      ].join(',')
    );
  });
  csvRows.push('');

  // Add messages
  csvRows.push('Messages');
  csvRows.push('ID,Conversation ID,Role,Content,Created At');
  data.messages.forEach((msg: any) => {
    csvRows.push([msg.id, msg.conversation_id, msg.role, `"${msg.content?.replace(/"/g, '""') || ''}"`, msg.created_at].join(','));
  });

  return csvRows.join('\n');
}

export async function deleteChatConversation(c: Context) {
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

    const conversationId = c.req.param('conversationId');
    if (!conversationId) {
      return c.json({ error: 'Conversation ID required' }, 400);
    }

    const { DB } = c.env;
    const tenantId = payload.tenant_id || payload['https://purl.imsglobal.org/spec/lti/claim/deployment_id'];
    const learnerId = payload.sub || payload.user_id;

    const verifyResult = await DB.prepare(
      `
      SELECT id FROM conversation_summaries
      WHERE tenant_id = ? AND learner_id = ? AND conversation_id = ?
    `
    )
      .bind(tenantId, learnerId, conversationId)
      .first();

    if (!verifyResult) {
      return c.json({ error: 'Conversation not found or unauthorized' }, 404);
    }

    await DB.prepare(
      `
      DELETE FROM chat_messages
      WHERE tenant_id = ? AND conversation_id = ?
    `
    )
      .bind(tenantId, conversationId)
      .run();

    await DB.prepare(
      `
      DELETE FROM conversation_summaries
      WHERE tenant_id = ? AND learner_id = ? AND conversation_id = ?
    `
    )
      .bind(tenantId, learnerId, conversationId)
      .run();

    return c.json({ success: true, message: 'Conversation deleted successfully' });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return c.json({ error: 'Failed to delete conversation' }, 500);
  }
}
