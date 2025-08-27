import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { Context } from '../../src/types';
import contentRouter from '../../src/api/handlers/content';

describe('Content API Security Fixes', () => {
  let app: Hono<{ Bindings: Context['Bindings'] }>;
  let mockDB: any;
  let mockEnv: any;

  beforeEach(() => {
    app = new Hono<{ Bindings: Context['Bindings'] }>();
    
    mockDB = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(),
          all: vi.fn(() => ({ results: [] })),
          run: vi.fn()
        }))
      }))
    };

    mockEnv = {
      DB: mockDB,
      AI: {
        run: vi.fn()
      }
    };

    // Add middleware to set context values
    app.use('*', async (c, next) => {
      c.set('tenantId', 'test-tenant');
      c.set('userId', 'test-user');
      c.set('courseId', 'test-course');
      c.env = mockEnv;
      await next();
    });

    app.route('/api/content', contentRouter);
  });

  describe('SQL Injection Prevention', () => {
    it('should escape LIKE wildcards in search queries', async () => {
      const searchQuery = 'test%_\\pattern';
      
      const response = await app.request('/api/content/search?q=' + encodeURIComponent(searchQuery));
      
      // Check that the query was sanitized
      expect(mockDB.prepare).toHaveBeenCalled();
      const sqlCall = mockDB.prepare.mock.calls[0][0];
      expect(sqlCall).toContain('LIKE ?');
      
      const bindCall = mockDB.prepare().bind;
      expect(bindCall).toHaveBeenCalled();
      
      // The sanitized query should have escaped wildcards
      const params = bindCall.mock.calls[0];
      expect(params).toContain('%test\\%\\_\\\\pattern%');
    });

    it('should handle normal search queries without modification', async () => {
      const searchQuery = 'normal search text';
      
      const response = await app.request('/api/content/search?q=' + encodeURIComponent(searchQuery));
      
      const bindCall = mockDB.prepare().bind;
      const params = bindCall.mock.calls[0];
      expect(params).toContain('%normal search text%');
    });
  });

  describe('Course Membership Validation', () => {
    it('should deny access to search when user is not enrolled', async () => {
      // Mock no membership found
      mockDB.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(() => null), // No membership
          all: vi.fn(() => ({ results: [] }))
        }))
      }));

      const response = await app.request('/api/content/search?q=test');
      const body = await response.json();
      
      expect(response.status).toBe(403);
      expect(body.error).toContain('Access denied: You must be enrolled in this course');
    });

    it('should allow access to search when user is enrolled', async () => {
      // Mock membership found
      mockDB.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(() => ({ role: 'student' })), // Has membership
          all: vi.fn(() => ({ results: [] }))
        }))
      }));

      const response = await app.request('/api/content/search?q=test');
      
      expect(response.status).toBe(200);
    });

    it('should deny content extraction when user is not enrolled', async () => {
      // Mock no membership found
      mockDB.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(() => null), // No membership
          run: vi.fn()
        }))
      }));

      const extractRequest = {
        pageUrl: 'https://canvas.example.com/courses/123/pages/test',
        pageType: 'page',
        content: {
          html: '<p>Test</p>',
          text: 'Test',
          title: 'Test Page',
          metadata: {
            headings: [],
            links: [],
            images: [],
            lists: [],
            emphasis: [],
            tables: []
          }
        },
        timestamp: new Date().toISOString(),
        contentHash: 'testhash',
        instructorConsent: true
      };

      const response = await app.request('/api/content/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(extractRequest)
      });

      const body = await response.json();
      
      expect(response.status).toBe(403);
      expect(body.error).toContain('Access denied: You must be enrolled in this course');
    });
  });
});