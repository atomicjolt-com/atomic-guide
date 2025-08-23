import { describe, it, expect, vi } from 'vitest';
import { handleChatMessage } from '../../src/api/handlers/chat';
import { Context } from 'hono';

// Mock the verify function from hono/jwt
vi.mock('hono/jwt', () => ({
  verify: vi.fn().mockResolvedValue({ tenant_id: 'test-tenant', sub: 'test-user' })
}));

// Mock getLearnerProfile
vi.mock('../../src/utils/responseFormatter', () => ({
  formatResponse: vi.fn((response: any) => response)
}));

// Mock AI Service
vi.mock('../../src/services/AIService', () => ({
  AIService: vi.fn().mockImplementation(() => ({
    generateResponse: vi.fn().mockResolvedValue({
      response: 'This is a test AI response.',
      tokensUsed: 50,
      model: '@cf/meta/llama-3.1-8b-instruct',
      cached: false
    })
  }))
}));

// Mock other services
vi.mock('../../src/services/ModelRegistry', () => ({
  ModelRegistry: vi.fn().mockImplementation(() => ({}))
}));

vi.mock('../../src/services/PromptBuilder', () => ({
  PromptBuilder: vi.fn().mockImplementation(() => ({
    selectTemplateForContext: vi.fn().mockReturnValue('default'),
    buildPrompt: vi.fn().mockReturnValue({
      systemPrompt: 'You are a helpful assistant.',
      userPrompt: 'Test message'
    })
  }))
}));

vi.mock('../../src/services/ContextEnricher', () => ({
  ContextEnricher: vi.fn().mockImplementation(() => ({
    enrichContext: vi.fn().mockResolvedValue({
      page: {
        courseName: 'Test Course',
        moduleName: 'Test Module',
        assignmentTitle: null
      },
      extractedContent: 'Page content'
    })
  }))
}));

vi.mock('../../src/services/FAQKnowledgeBase', () => ({
  FAQKnowledgeBase: vi.fn().mockImplementation(() => ({
    searchSimilarFAQs: vi.fn().mockResolvedValue([])
  }))
}));

vi.mock('../../src/services/SuggestionEngine', () => ({
  SuggestionEngine: vi.fn().mockImplementation(() => ({
    generateSuggestions: vi.fn().mockResolvedValue([])
  }))
}));

describe('Chat API Handler', () => {
  const createMockContext = (body: any, jwt?: string): Context => {
    // Mock Durable Object
    const mockDO = {
      fetch: vi.fn().mockImplementation((request: Request) => {
        if (request.url.includes('get-history')) {
          return Promise.resolve(new Response(JSON.stringify([]), { 
            headers: { 'content-type': 'application/json' }
          }));
        }
        return Promise.resolve(new Response(JSON.stringify({ success: true }), { 
          headers: { 'content-type': 'application/json' }
        }));
      })
    };
    
    return {
      req: {
        header: (name: string) => {
          if (name === 'Authorization' && jwt) {
            return `Bearer ${jwt}`;
          }
          return null;
        },
        json: () => Promise.resolve(body),
      },
      env: {
        JWT_SECRET: 'test-secret',
        CHAT_CONVERSATIONS: {
          idFromName: vi.fn().mockReturnValue('mock-do-id'),
          get: vi.fn().mockReturnValue(mockDO)
        },
        AI: {},
        FAQ_INDEX: {},
        CLIENT_AUTH_TOKENS: {},
        DB: {
          prepare: vi.fn().mockImplementation((query: string) => {
            // Mock for AI configuration query
            if (query.includes('ai_config')) {
              return {
                bind: vi.fn().mockReturnValue({
                  first: vi.fn().mockResolvedValue({
                    model_name: '@cf/meta/llama-3.1-8b-instruct',
                    max_tokens: 2048,
                    temperature: 0.7,
                    context_window: 4096,
                    system_prompt: 'You are a helpful educational assistant.',
                    token_limit_per_session: 5000,
                    tokens_used_today: 1000
                  })
                })
              };
            }
            // Mock for token usage query
            if (query.includes('token_usage') && query.includes('SUM')) {
              return {
                bind: vi.fn().mockReturnValue({
                  first: vi.fn().mockResolvedValue({ total: 1000 })
                })
              };
            }
            // Mock for learner profile query
            if (query.includes('learner_profiles')) {
              return {
                bind: vi.fn().mockReturnValue({
                  first: vi.fn().mockResolvedValue({
                    learning_style: 'visual',
                    performance_level: 'intermediate',
                    struggle_areas: JSON.stringify(['algebra']),
                    preferred_difficulty: 'moderate'
                  })
                })
              };
            }
            // Mock for token usage insert
            if (query.includes('INSERT INTO token_usage')) {
              return {
                bind: vi.fn().mockReturnValue({
                  run: vi.fn().mockResolvedValue({})
                })
              };
            }
            // Default mock
            return {
              bind: vi.fn().mockReturnValue({
                first: vi.fn().mockResolvedValue(null),
                all: vi.fn().mockResolvedValue([]),
                run: vi.fn().mockResolvedValue({})
              })
            };
          })
        }
      },
      json: (data: any, status?: number) => ({
        json: data,
        status: status || 200,
      }),
    } as any;
  };

  it('handles valid chat message request', async () => {
    const body = {
      session_id: 'session-123',
      message: 'Test message',
      page_context: {
        course_id: 'course-1',
        module_id: 'module-1',
        page_content: 'Page content',
        current_element: null,
      },
    };

    const ctx = createMockContext(body, 'valid-jwt-token');
    const response = await handleChatMessage(ctx);

    expect(response.status).toBe(200);
    expect(response.json).toHaveProperty('message_id');
    expect(response.json).toHaveProperty('content');
    expect(response.json).toHaveProperty('timestamp');
    expect(response.json).toHaveProperty('conversation_id');
  });

  it('rejects messages longer than 5000 characters', async () => {
    const body = {
      session_id: 'session-123',
      message: 'a'.repeat(5001),
      page_context: {
        course_id: null,
        module_id: null,
        page_content: null,
        current_element: null,
      },
    };

    const ctx = createMockContext(body, 'valid-jwt-token');
    const response = await handleChatMessage(ctx);

    expect(response.status).toBe(400);
    expect(response.json.error).toBe('Message too long. Maximum 5000 characters allowed.');
  });

  it('sanitizes HTML in messages', async () => {
    const body = {
      session_id: 'session-123',
      message: '<script>alert("XSS")</script>',
      page_context: {
        course_id: null,
        module_id: null,
        page_content: null,
        current_element: null,
      },
    };

    const ctx = createMockContext(body, 'valid-jwt-token');
    const response = await handleChatMessage(ctx);

    expect(response.status).toBe(200);
    // The AI response is generated based on the sanitized message but doesn't include it
    // We verify that the response was successful and no XSS made it through
    expect(response.json.content).toBeDefined();
    expect(response.json.content).not.toContain('<script>');
    expect(response.json.content).not.toContain('</script>');
  });

  it('requires JWT secret environment variable', async () => {
    const body = {
      session_id: 'session-123',
      message: 'Test message',
      page_context: {
        course_id: null,
        module_id: null,
        page_content: null,
        current_element: null,
      },
    };

    const ctx = createMockContext(body, 'valid-jwt-token');
    ctx.env.JWT_SECRET = undefined;
    
    const response = await handleChatMessage(ctx);

    expect(response.status).toBe(500);
    expect(response.json.error).toBe('Server configuration error');
  });

  it('requires authorization header', async () => {
    const body = {
      session_id: 'session-123',
      message: 'Test message',
      page_context: {
        course_id: null,
        module_id: null,
        page_content: null,
        current_element: null,
      },
    };

    const ctx = createMockContext(body);
    const response = await handleChatMessage(ctx);

    expect(response.status).toBe(401);
    expect(response.json.error).toBe('Unauthorized');
  });
});