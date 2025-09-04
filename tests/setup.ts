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

// Mock Cloudflare Workers WebSocketPair for tests
class MockWebSocket {
  readyState: number = 1; // OPEN
  url: string = '';
  protocol: string = '';
  extensions: string = '';
  bufferedAmount: number = 0;
  binaryType: 'blob' | 'arraybuffer' = 'blob';

  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn();

  send = vi.fn();
  close = vi.fn();

  accept = vi.fn();
}

class MockWebSocketPair {
  0: MockWebSocket;
  1: MockWebSocket;

  constructor() {
    const client = new MockWebSocket();
    const server = new MockWebSocket();

    // Link the websockets so messages sent on one are received on the other
    const originalClientSend = client.send;
    const originalServerSend = server.send;

    client.send = vi.fn((data) => {
      originalClientSend.call(client, data);
      if (server.onmessage) {
        setTimeout(() => {
          server.onmessage(new MessageEvent('message', { data }));
        }, 0);
      }
    });

    server.send = vi.fn((data) => {
      originalServerSend.call(server, data);
      if (client.onmessage) {
        setTimeout(() => {
          client.onmessage(new MessageEvent('message', { data }));
        }, 0);
      }
    });

    this[0] = client;
    this[1] = server;
  }
}

// @ts-ignore
globalThis.WebSocketPair = MockWebSocketPair;
