import { describe, it, expect, vi } from 'vitest';
import { handleChatMessage } from '../../src/api/handlers/chat';
import { Context } from 'hono';

// Mock the verify function from hono/jwt
vi.mock('hono/jwt', () => ({
  verify: vi.fn().mockResolvedValue({ tenant_id: 'test-tenant', sub: 'test-user' })
}));

describe('Chat API Handler', () => {
  const createMockContext = (body: any, jwt?: string): Context => {
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
    // The message should be sanitized in the response
    expect(response.json.content).toContain('&lt;script&gt;');
    expect(response.json.content).not.toContain('<script>');
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