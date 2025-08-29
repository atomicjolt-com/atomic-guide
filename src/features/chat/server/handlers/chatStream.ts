import { Context } from 'hono';
import { verify } from 'hono/jwt';
import { AIService, PromptBuilder } from '@shared/server/services';
// import { ModelRegistry } from '@shared/server/services';
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
    '\'': '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

interface ChatStreamRequest {
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

export async function handleChatStream(c: Context): Promise<Response> {
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

    const body: ChatStreamRequest = await c.req.json();

    if (!body.message || !body.session_id) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Validate message length
    if (body.message.length > 5000) {
      return c.json({ error: 'Message too long. Maximum 5000 characters allowed.' }, 400);
    }

    // Sanitize message content
    const sanitizedMessage = escapeHtml(body.message);
    const conversationId = body.conversation_id || `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Get or create conversation from Durable Object
    const doId = c.env.CHAT_CONVERSATIONS.idFromName(conversationId);
    const chatDO = c.env.CHAT_CONVERSATIONS.get(doId);

    // Store user message
    await chatDO.fetch(new Request('https://do/add-message', {
      method: 'POST',
      body: JSON.stringify({
        role: 'user',
        content: sanitizedMessage,
        timestamp: new Date().toISOString()
      })
    }));

    // Initialize services
    const aiService = new AIService(c.env.AI);
    const promptBuilder = new PromptBuilder();
    const contextEnricher = new ContextEnricher();
    const faqKnowledgeBase = new FAQKnowledgeBase(
      aiService,
      c.env.FAQ_INDEX,
      c.env.CLIENT_AUTH_TOKENS,
      c.env.DB
    );

    // Get AI configuration
    const aiConfig = await getAIConfig(c.env.DB, tenantId);

    // Check FAQ first
    const faqs = await faqKnowledgeBase.searchSimilarFAQs(
      sanitizedMessage,
      tenantId,
      body.page_context.course_id || undefined,
      1
    );

    // If high confidence FAQ match, return it immediately
    if (faqs.length > 0 && faqs[0].similarity && faqs[0].similarity > 0.9) {
      return new Response(createSSEMessage({
        type: 'complete',
        content: faqs[0].answer,
        messageId,
        conversationId,
        cached: true,
        tokensUsed: 0
      }), {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        }
      });
    }

    // Get conversation history
    const historyResponse = await chatDO.fetch(new Request('https://do/get-history'));
    const conversationHistory = await historyResponse.json() as Array<{ role: string; content: string }>;

    // Get learner profile
    const learnerProfile = await getLearnerProfile(c.env.DB, userId, tenantId);

    // Enrich context
    const pageContext = {
      courseId: body.page_context.course_id || '',
      moduleId: body.page_context.module_id || undefined,
      pageContent: body.page_context.page_content || undefined,
      currentElement: body.page_context.current_element || undefined,
      timestamp: Date.now()
    };

    const enrichedContext = await contextEnricher.enrichContext(
      pageContext,
      payload,
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
      conversationHistory: conversationHistory.slice(-10),
      currentQuestion: sanitizedMessage
    };

    const templateId = promptBuilder.selectTemplateForContext(promptContext);
    const { systemPrompt, userPrompt } = promptBuilder.buildPrompt(promptContext, templateId);

    // Create readable stream for SSE
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Start streaming in background
    (async () => {
      let fullResponse = '';
      let tokensUsed = 0;

      try {
        // Send initial message
        await writer.write(encoder.encode(createSSEMessage({
          type: 'start',
          messageId,
          conversationId
        })));

        // Stream AI response
        const stream = aiService.generateStreamingResponse(
          userPrompt,
          systemPrompt,
          {
            modelName: aiConfig.modelName,
            maxTokens: Math.min(2048, aiConfig.tokenLimitPerSession - aiConfig.tokensUsedToday),
            temperature: 0.7
          }
        );

        for await (const chunk of stream) {
          if (chunk.done) {
            break;
          }

          fullResponse += chunk.text;
          tokensUsed += Math.ceil(chunk.text.length / 4);

          // Send chunk
          await writer.write(encoder.encode(createSSEMessage({
            type: 'chunk',
            content: chunk.text
          })));
        }

        // Store complete response in conversation
        await chatDO.fetch(new Request('https://do/add-message', {
          method: 'POST',
          body: JSON.stringify({
            role: 'assistant',
            content: fullResponse,
            timestamp: new Date().toISOString()
          })
        }));

        // Track token usage
        if (tokensUsed > 0) {
          await trackTokenUsage(c.env.DB, tenantId, userId, conversationId, tokensUsed, aiConfig.modelName);
        }

        // Generate suggestions
        const suggestionEngine = new SuggestionEngine();
        const suggestions = await suggestionEngine.generateSuggestions(
          [...conversationHistory, { role: 'assistant', content: fullResponse }],
          enrichedContext,
          learnerProfile
        );

        // Send completion message with metadata
        await writer.write(encoder.encode(createSSEMessage({
          type: 'complete',
          suggestions: suggestions.map(s => s.description),
          tokensUsed,
          tokensRemaining: Math.max(0, aiConfig.tokenLimitPerSession - aiConfig.tokensUsedToday - tokensUsed)
        })));

      } catch {
        console.error('Streaming error:', error);
        await writer.write(encoder.encode(createSSEMessage({
          type: 'error',
          error: 'An error occurred while generating the response'
        })));
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable Nginx buffering
      }
    });

  } catch {
    console.error('Chat stream error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}

// Helper function to create SSE message
function createSSEMessage(data: any): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// Helper function to get AI config
async function getAIConfig(db: any, tenantId: string): Promise<any> {
  const result = await db.prepare(
    'SELECT * FROM ai_config WHERE tenant_id = ?'
  ).bind(tenantId).first();

  if (result) {
    const today = new Date().toISOString().split('T')[0];
    const usageResult = await db.prepare(`
      SELECT SUM(tokens_used) as total 
      FROM token_usage 
      WHERE tenant_id = ? AND DATE(created_at) = ?
    `).bind(tenantId, today).first();

    return {
      modelName: result.model_name || '@cf/meta/llama-3.1-8b-instruct',
      tokenLimitPerSession: result.token_limit_per_session || 10000,
      tokenLimitPerDay: result.token_limit_per_day || 100000,
      rateLimitPerMinute: result.rate_limit_per_minute || 10,
      enabled: result.enabled !== false,
      tokensUsedToday: usageResult?.total || 0
    };
  }

  return {
    modelName: '@cf/meta/llama-3.1-8b-instruct',
    tokenLimitPerSession: 10000,
    tokenLimitPerDay: 100000,
    rateLimitPerMinute: 10,
    enabled: true,
    tokensUsedToday: 0
  };
}

// Helper function to get learner profile
async function getLearnerProfile(db: any, userId: string, tenantId: string): Promise<any> {
  const result = await db.prepare(`
    SELECT * FROM learner_profiles 
    WHERE user_id = ? AND tenant_id = ?
  `).bind(userId, tenantId).first();

  if (result) {
    return {
      learningStyle: result.learning_style,
      performanceLevel: result.performance_level,
      struggleAreas: result.struggle_areas ? JSON.parse(result.struggle_areas) : [],
      preferredLanguage: result.preferred_language || 'en'
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
  
  await db.prepare(`
    INSERT INTO token_usage (id, tenant_id, user_id, conversation_id, tokens_used, model_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    tenantId,
    userId,
    conversationId,
    tokensUsed,
    modelName,
    new Date().toISOString()
  ).run();
}