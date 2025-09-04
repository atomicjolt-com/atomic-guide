import { describe, it, expect, beforeEach, vi, MockFactory, TestDataFactory, ServiceTestHarness } from '@/tests/infrastructure';
import { Hono } from 'hono';
import { Context } from '../../src/types';
import contentRouter from '../../src/api/handlers/content';

import type { MockD1Database, MockKVNamespace, MockQueue } from '@/tests/infrastructure/types/mocks';
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
          run: vi.fn(),
        })),
      })),
    };

    mockEnv = {
      DB: mockDB,
      AI: {
        run: vi.fn(),
      },
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
      // Create a spy for the bind function that we can track
      const bindSpy = vi.fn(() => ({
        first: vi.fn(() => ({ role: 'student' })), // Return valid membership
        all: vi.fn(() => ({ results: [] })),
        run: vi.fn(),
      }));

      // Mock successful membership check and search
      mockDB.prepare = vi.fn(() => ({
        bind: bindSpy,
      }));

      const searchQuery = 'test%_\\pattern';

      const _response = await app.request('/api/content/search?q=' + encodeURIComponent(searchQuery));

      // Check that the query was sanitized - the search SQL should be called after membership check
      expect(mockDB.prepare).toHaveBeenCalled();

      // Find the SQL call that contains LIKE (it should be the search query, not the membership check)
      const sqlCalls = mockDB.prepare.mock.calls.map((call) => call[0]);
      const searchSqlCall = sqlCalls.find((sql) => sql.includes('LIKE'));
      expect(searchSqlCall).toBeDefined();
      expect(searchSqlCall).toContain('LIKE ?');

      expect(bindSpy).toHaveBeenCalled();

      // The sanitized query should have escaped wildcards - check the bind parameters for the search call
      const searchBindCallIndex = sqlCalls.findIndex((sql) => sql.includes('LIKE'));
      if (searchBindCallIndex >= 0) {
        const params = bindSpy.mock.calls[searchBindCallIndex];
        // The sanitized query should escape %, _, and \ with \
        // Input: 'test%_\\pattern' should become 'test\%\_\\pattern' and be wrapped in %...%
        expect(params).toContain('%test\\%\\_\\\\pattern%');
      }
    });

    it('should handle normal search queries without modification', async () => {
      // Create a spy for the bind function that we can track
      const bindSpy = vi.fn(() => ({
        first: vi.fn(() => ({ role: 'student' })), // Return valid membership
        all: vi.fn(() => ({ results: [] })),
        run: vi.fn(),
      }));

      // Mock successful membership check and search
      mockDB.prepare = vi.fn(() => ({
        bind: bindSpy,
      }));

      const searchQuery = 'normal search text';

      const _response = await app.request('/api/content/search?q=' + encodeURIComponent(searchQuery));

      // Find the bind call for the search query (not the membership check)
      const sqlCalls = mockDB.prepare.mock.calls.map((call) => call[0]);
      const searchBindCallIndex = sqlCalls.findIndex((sql) => sql.includes('LIKE'));

      expect(bindSpy).toHaveBeenCalled();

      if (searchBindCallIndex >= 0) {
        const params = bindSpy.mock.calls[searchBindCallIndex];
        expect(params).toContain('%normal search text%');
      } else {
        // If no LIKE query found, this test should fail to indicate the search wasn't performed
        expect(searchBindCallIndex).toBeGreaterThan(-1);
      }
    });
  });

  describe('Course Membership Validation', () => {
    it('should deny access to search when user is not enrolled', async () => {
      // Mock no membership found
      mockDB.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(() => null), // No membership
          all: vi.fn(() => ({ results: [] })),
        })),
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
          all: vi.fn(() => ({ results: [] })),
        })),
      }));

      const response = await app.request('/api/content/search?q=test');

      expect(response.status).toBe(200);
    });

    it('should deny content extraction when user is not enrolled', async () => {
      // Mock no membership found
      mockDB.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(() => null), // No membership
          run: vi.fn(),
        })),
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
            tables: [],
          },
        },
        timestamp: new Date().toISOString(),
        contentHash: 'testhash',
        instructorConsent: true,
      };

      const response = await app.request('/api/content/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(extractRequest),
      });

      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.error).toContain('Access denied: You must be enrolled in this course');
    });
  });
});
