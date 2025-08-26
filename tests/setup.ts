import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Set JWT_SECRET for tests
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

// Mock PrismJS and its components to prevent initialization errors in tests
vi.mock('prismjs', () => ({
  default: {
    highlight: (code: string, grammar: any, language: string) => code,
    languages: {
      javascript: {},
      typescript: {},
      python: {},
      java: {},
      cpp: {},
      c: {},
      csharp: {},
      php: {},
      ruby: {},
      go: {},
      rust: {},
      sql: {},
      json: {},
      markdown: {},
      bash: {},
      'class-name': {}, // Add class-name property that cpp component expects
      extend: vi.fn(),
      insertBefore: vi.fn(),
    },
    highlightElement: vi.fn(),
    highlightAll: vi.fn(),
    hooks: {
      add: vi.fn(),
      run: vi.fn(),
    },
  },
}));

// Mock all Prism component imports - must be individual statements
vi.mock('prismjs/components/prism-javascript', () => ({}));
vi.mock('prismjs/components/prism-typescript', () => ({}));
vi.mock('prismjs/components/prism-python', () => ({}));
vi.mock('prismjs/components/prism-java', () => ({}));
vi.mock('prismjs/components/prism-c', () => ({}));
vi.mock('prismjs/components/prism-cpp', () => ({}));
vi.mock('prismjs/components/prism-csharp', () => ({}));
vi.mock('prismjs/components/prism-php', () => ({}));
vi.mock('prismjs/components/prism-ruby', () => ({}));
vi.mock('prismjs/components/prism-go', () => ({}));
vi.mock('prismjs/components/prism-rust', () => ({}));
vi.mock('prismjs/components/prism-sql', () => ({}));
vi.mock('prismjs/components/prism-json', () => ({}));
vi.mock('prismjs/components/prism-markdown', () => ({}));
vi.mock('prismjs/components/prism-bash', () => ({}));

// Mock Prism themes
vi.mock('prismjs/themes/prism.css', () => ({}));
vi.mock('prismjs/themes/prism-dark.css', () => ({}));

// Mock scrollIntoView for tests
if (typeof window !== 'undefined') {
  Element.prototype.scrollIntoView = vi.fn();
}

// Fix AbortSignal compatibility for MSW in Node environment
if (typeof globalThis.AbortSignal === 'undefined') {
  const { AbortController } = require('abort-controller');
  globalThis.AbortController = AbortController;
  globalThis.AbortSignal = AbortController.AbortSignal;
}

// Polyfill fetch if not available
if (typeof globalThis.fetch === 'undefined') {
  const nodeFetch = require('node-fetch');
  globalThis.fetch = nodeFetch;
  globalThis.Headers = nodeFetch.Headers;
  globalThis.Request = nodeFetch.Request;
  globalThis.Response = nodeFetch.Response;
}
