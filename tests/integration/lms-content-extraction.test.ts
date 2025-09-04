import { describe, it, expect, beforeEach, afterEach, vi, MockFactory, TestDataFactory, ServiceTestHarness } from '@/tests/infrastructure';
import { LMSContentExtractor } from '@features/content/client/services/LMSContentExtractor';

import type { MockD1Database, MockKVNamespace, MockQueue } from '@/tests/infrastructure/types/mocks';
describe('LMS Content Extraction Integration', () => {
  let extractor: LMSContentExtractor;
  let mockPostMessage: any;
  let originalPostMessage: any;
  let mockLocation: any;

  beforeEach(async () => {
    // Setup test infrastructure - testing LMSContentExtractor directly
    const harness = ServiceTestHarness.withDefaults(LMSContentExtractor, {
      database: false,
      kvStore: false,
      queue: false,
    }).build();

    // Store original postMessage
    originalPostMessage = window.parent.postMessage;

    // Mock postMessage
    mockPostMessage = vi.fn();
    Object.defineProperty(window.parent, 'postMessage', {
      value: mockPostMessage,
      writable: true,
      configurable: true,
    });

    // Mock window.location for Canvas LMS detection
    mockLocation = {
      hostname: 'school.instructure.com',
      href: 'https://school.instructure.com/',
      protocol: 'https:',
      pathname: '/',
      search: '',
      hash: '',
    };

    // Replace window.location with our mock
    Object.defineProperty(window, 'location', {
      value: mockLocation,
      writable: true,
      configurable: true,
    });

    // Mock sessionStorage
    const mockStorage = new Map();
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: (key: string) => mockStorage.get(key),
        setItem: (key: string, value: string) => mockStorage.set(key, value),
        removeItem: (key: string) => mockStorage.delete(key),
        clear: () => mockStorage.clear(),
      },
      writable: true,
    });

    // Set up LMS origin for secure postMessage
    window.sessionStorage.setItem('lms_origin', 'https://canvas.instructure.com');
    window.sessionStorage.setItem('lti_shared_secret', 'test-secret-key');

    // Mock crypto API for hashing
    if (!global.crypto) {
      global.crypto = {
        subtle: {
          digest: vi.fn(async (_algorithm, _data) => {
            // Simple mock hash
            return new ArrayBuffer(32);
          }),
          importKey: vi.fn(async () => ({})),
          sign: vi.fn(async () => new ArrayBuffer(32)),
        },
        getRandomValues: vi.fn((arr) => {
          for (let i = 0; i < arr.length; i++) {
            arr[i] = Math.floor(Math.random() * 256);
          }
          return arr;
        }),
      } as any;
    }

    extractor = new LMSContentExtractor({
      validateOrigin: true,
      allowedOrigins: ['.instructure.com', '.canvaslms.com'],
      maxRetries: 2,
      timeout: 1000,
    });
  });

  afterEach(() => {
    // Restore original postMessage
    window.parent.postMessage = originalPostMessage;

    // Clean up extractor if it exists
    if (extractor) {
      extractor.destroy();
    }
  });

  describe('PostMessage Security', () => {
    it('should send postMessage with specific origin instead of wildcard', async () => {
      // Simulate sending a message
      const _messagePromise = extractor.sendPostMessage('lti.getPageContent', {});

      // Wait for postMessage to be called
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockPostMessage).toHaveBeenCalled();
      const [message, targetOrigin] = mockPostMessage.mock.calls[0];

      // Should NOT use wildcard origin
      expect(targetOrigin).not.toBe('*');
      // Should use specific origin
      expect(targetOrigin).toBe('https://canvas.instructure.com');

      // Message should include signature
      expect(message).toHaveProperty('signature');
      expect(message).toHaveProperty('timestamp');
    });

    it('should validate origin of incoming messages', () => {
      const validOrigin = 'https://canvas.instructure.com';
      const invalidOrigin = 'https://malicious.com';

      // Test valid origin
      const isValid = extractor.isValidOrigin(validOrigin);
      expect(isValid).toBe(true);

      // Test invalid origin
      const isInvalid = extractor.isValidOrigin(invalidOrigin);
      expect(isInvalid).toBe(false);
    });

    it('should use cryptographic hashing for content', async () => {
      const content = '<h1>Test Content</h1><p>This is test content.</p>';

      const hash = await extractor.hashContent(content);

      // Should return a hex string (SHA-256 produces 64 hex characters)
      expect(hash).toMatch(/^[a-f0-9]+$/);
      expect(hash.length).toBeGreaterThan(0);

      // Same content should produce same hash
      const hash2 = await extractor.hashContent(content);
      expect(hash2).toBe(hash);
    });
  });

  describe('Content Extraction Workflow', () => {
    it('should handle complete extraction workflow', async () => {
      // Mock the postMessage response
      const mockResponse = {
        url: 'https://canvas.instructure.com/courses/123/assignments/456',
        title: 'Assignment 1',
        content: '<h1>Assignment 1</h1><p>Complete the following tasks...</p>',
      };

      // Set up message handler to simulate LMS response
      setTimeout(() => {
        const event = new MessageEvent('message', {
          data: {
            subject: 'lti.getPageContent',
            message_id: mockPostMessage.mock.calls[0]?.[0]?.message_id,
            data: mockResponse,
          },
          origin: 'https://canvas.instructure.com',
        });
        window.dispatchEvent(event);
      }, 50);

      const result = await extractor.extractPageContent();

      expect(result).toBeDefined();
      expect(result.pageUrl).toBe(mockResponse.url);
      expect(result.pageType).toBe('assignment');
      expect(result.content.title).toBe(mockResponse.title);
      expect(result.content.html).toBeTruthy();
      expect(result.contentHash).toBeTruthy();
      expect(result.lmsType).toBe('canvas');
    });

    it('should detect different LMS page types', () => {
      const testCases = [
        { url: '/courses/123/assignments/456', type: 'assignment' },
        { url: '/courses/123/discussion_topics/789', type: 'discussion' },
        { url: '/courses/123/modules/111', type: 'module' },
        { url: '/courses/123/pages/welcome', type: 'page' },
        { url: '/courses/123/quizzes/222', type: 'quiz' },
      ];

      for (const testCase of testCases) {
        const pageType = extractor.detectPageType(testCase.url, 'canvas');
        expect(pageType).toBe(testCase.type);
      }
    });

    it('should sanitize extracted HTML content', () => {
      const maliciousHtml = `
        <div>
          <script>alert('XSS')</script>
          <p>Normal content</p>
          <style>body { display: none; }</style>
          <iframe src="evil.com"></iframe>
        </div>
      `;

      const sanitized = extractor.sanitizeHtml(maliciousHtml);

      // Should remove scripts
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');

      // Should remove styles
      expect(sanitized).not.toContain('<style>');

      // Should replace iframes with placeholder
      expect(sanitized).not.toContain('<iframe');
      expect(sanitized).toContain('[Embedded content');

      // Should keep safe content
      expect(sanitized).toContain('Normal content');
    });
  });

  describe('Error Handling and Retry Logic', () => {
    it('should retry on extraction failure', async () => {
      let attemptCount = 0;

      // Mock sendPostMessage to fail first time, succeed second time
      extractor.sendPostMessage = vi.fn(async () => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('Network error');
        }
        return {
          url: 'https://canvas.instructure.com/courses/123/pages/test',
          content: '<p>Test content</p>',
        };
      });

      const result = await extractor.extractPageContent();

      expect(attemptCount).toBe(2);
      expect(result).toBeDefined();
      expect(result.content.text).toContain('Test content');
    });

    it('should handle timeout gracefully', async () => {
      // Create extractor with very short timeout
      const timeoutExtractor = new LMSContentExtractor({
        timeout: 10, // 10ms timeout
        maxRetries: 0,
      });

      // Don't send any response to trigger timeout
      await expect(timeoutExtractor.extractPageContent()).rejects.toThrow('timeout');

      timeoutExtractor.destroy();
    });
  });

  describe('Content Monitoring', () => {
    it('should detect content changes during monitoring', (done) => {
      const initialContent = {
        url: 'https://canvas.instructure.com/courses/123/pages/test',
        content: '<p>Original content</p>',
        title: 'Test Page',
      };

      const updatedContent = {
        url: 'https://canvas.instructure.com/courses/123/pages/test',
        content: '<p>Updated content</p>',
        title: 'Test Page',
      };

      let callCount = 0;

      // Mock extractPageContent
      extractor.extractPageContent = vi.fn(async () => {
        callCount++;
        const content = callCount === 1 ? initialContent : updatedContent;
        return {
          pageUrl: content.url,
          pageType: 'page',
          content: {
            html: content.content,
            text: content.content.replace(/<[^>]*>/g, ''),
            title: content.title,
            metadata: { headings: [], links: [], images: [], lists: [], emphasis: [], tables: [] },
          },
          timestamp: new Date().toISOString(),
          contentHash: callCount === 1 ? 'hash1' : 'hash2',
          lmsType: 'canvas',
        };
      });

      // Listen for content change event
      extractor.onContentChange((change) => {
        expect(change.previous.contentHash).toBe('hash1');
        expect(change.current.contentHash).toBe('hash2');
        expect(change.current.content.text).toContain('Updated content');

        extractor.stopContentMonitoring();
        done();
      });

      // Start monitoring with short interval for testing
      extractor.options.monitoringInterval = 100;
      extractor.startContentMonitoring();
    });
  });

  describe('Multi-LMS Support', () => {
    it('should detect different LMS platforms', () => {
      const testCases = [
        { hostname: 'school.instructure.com', expected: 'canvas' },
        { hostname: 'canvas.university.edu', expected: 'canvas' },
        { hostname: 'learn.moodle.org', expected: 'moodle' },
        { hostname: 'school.moodlecloud.com', expected: 'moodle' },
        { hostname: 'learn.blackboard.com', expected: 'blackboard' },
        { hostname: 'school.brightspace.com', expected: 'd2l' },
        { hostname: 'custom-lms.edu', expected: 'unknown' },
      ];

      for (const testCase of testCases) {
        // Update the mock location hostname
        mockLocation.hostname = testCase.hostname;

        const lmsType = extractor.detectLMSType();
        expect(lmsType).toBe(testCase.expected);
      }
    });
  });
});
