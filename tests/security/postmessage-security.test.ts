import {  describe, it, expect, beforeEach, vi , MockFactory, TestDataFactory, ServiceTestHarness } from '@/tests/infrastructure';
import { LMSContentExtractor } from '@features/content/client/services/LMSContentExtractor';

import type { MockD1Database, MockKVNamespace, MockQueue } from '@/tests/infrastructure/types/mocks';
describe('PostMessage Security Fixes', () => {
  let extractor: LMSContentExtractor;
  let mockSessionStorage: Record<string, string>;

  beforeEach(() => {
    mockSessionStorage = {};
    
    // Mock sessionStorage
    global.sessionStorage = {
      getItem: vi.fn((key) => mockSessionStorage[key] || null),
      setItem: vi.fn((key, value) => {mockSessionStorage[key] = value;}),
      removeItem: vi.fn((key) => {delete mockSessionStorage[key];}),
      clear: vi.fn(() => {mockSessionStorage = {};}),
      length: 0,
      key: vi.fn()
    } as Storage;

    // Mock window.parent.postMessage
    global.window.parent = {
      postMessage: vi.fn()
    } as any;

    extractor = new LMSContentExtractor();
  });

  describe('HMAC Signature Security', () => {
    it('should throw error when LTI shared secret is missing', async () => {
      // Don't set any secret in sessionStorage
      const message = { data: 'test' };
      
      await expect(extractor['generateMessageSignature'](message))
        .rejects.toThrow('LTI shared secret not found. Cannot authenticate message.');
    });

    it('should generate signature when valid secret exists', async () => {
      mockSessionStorage['lti_shared_secret'] = 'valid-secret-key';
      const message = { data: 'test' };
      
      const signature = await extractor['generateMessageSignature'](message);
      expect(signature).toBeDefined();
      expect(signature).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex string
    });
  });

  describe('Domain Validation Security', () => {
    it('should reject malicious subdomain bypass attempts', () => {
      const extractor = new LMSContentExtractor({
        allowedOrigins: ['.instructure.com']
      });

      // Valid domains should pass
      expect(extractor['isValidOrigin']('https://canvas.instructure.com')).toBe(true);
      expect(extractor['isValidOrigin']('https://instructure.com')).toBe(true);
      
      // Malicious bypass attempts should fail
      expect(extractor['isValidOrigin']('https://evil.instructure.com.attacker.com')).toBe(false);
      expect(extractor['isValidOrigin']('https://instructure.com.evil.com')).toBe(false);
    });

    it('should properly validate exact domain matches', () => {
      const extractor = new LMSContentExtractor({
        allowedOrigins: ['canvas.instructure.com']
      });

      expect(extractor['isValidOrigin']('https://canvas.instructure.com')).toBe(true);
      expect(extractor['isValidOrigin']('https://other.instructure.com')).toBe(false);
      expect(extractor['isValidOrigin']('https://canvas.instructure.com.evil.com')).toBe(false);
    });
  });

  describe('Target Origin Security', () => {
    it('should throw error when no valid origin can be determined', () => {
      // No LMS origin in sessionStorage
      // No valid referrer
      Object.defineProperty(document, 'referrer', {
        value: '',
        writable: true
      });

      expect(() => extractor['getTargetOrigin']())
        .toThrow('Unable to determine secure target origin for postMessage. Please configure LMS origin.');
    });

    it('should use validated LMS origin from sessionStorage', () => {
      mockSessionStorage['lms_origin'] = 'https://canvas.instructure.com';
      
      const targetOrigin = extractor['getTargetOrigin']();
      expect(targetOrigin).toBe('https://canvas.instructure.com');
    });

    it('should validate referrer origin before using it', () => {
      Object.defineProperty(document, 'referrer', {
        value: 'https://evil.com',
        writable: true
      });

      // Should throw because evil.com is not in allowed origins
      expect(() => extractor['getTargetOrigin']())
        .toThrow('Unable to determine secure target origin for postMessage. Please configure LMS origin.');
    });
  });
});