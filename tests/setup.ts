import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Set JWT_SECRET for tests
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

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