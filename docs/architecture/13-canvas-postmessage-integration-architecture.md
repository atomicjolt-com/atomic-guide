# 13. Canvas postMessage Integration Architecture

## Overview

The Canvas postMessage API enables bidirectional communication between our LTI tool (running in an iframe) and the Canvas LMS platform. This integration is critical for gathering user engagement metrics, detecting learning struggles, and providing contextual AI assistance.

## PostMessage Handler Service

```typescript
export class CanvasPostMessageService {
  private postMessageToken: string | null;
  private messageHandlers: Map<string, MessageHandler>;
  private storageTarget: string = '_parent';
  private oidcAuthUrl: string;

  constructor(token?: string, storageTarget?: string) {
    this.postMessageToken = token || null;
    this.storageTarget = storageTarget || '_parent';
    this.setupMessageListeners();
    this.queryCapabilities();
  }

  // Core message sending with proper target resolution
  private sendMessage(subject: string, data: any, targetOrigin: string = '*') {
    const target = this.resolveTarget(subject);
    const message = {
      subject,
      ...data,
      ...(this.postMessageToken && { token: this.postMessageToken }),
    };
    target.postMessage(message, targetOrigin);
  }

  // Resolve correct target window based on launch context
  private resolveTarget(subject: string): Window {
    // Platform Storage messages go to specific frame
    if (subject === 'lti.put_data' || subject === 'lti.get_data') {
      if (this.storageTarget !== '_parent' && window.parent.frames[this.storageTarget]) {
        return window.parent.frames[this.storageTarget];
      }
    }
    // Check if launched in iframe vs new window/tab
    return window.parent !== window ? window.parent : window.opener || window.parent;
  }
}
```

## Canvas Content Extraction

```typescript
export class CanvasContentExtractor {
  constructor(private postMessageService: CanvasPostMessageService) {}

  async extractPageContent(): Promise<PageContent> {
    // Use Canvas API for supported pages
    const canvasContent = await this.postMessageService.getPageContent();

    if (canvasContent) {
      return this.parseCanvasContent(canvasContent);
    }

    // Fallback to DOM extraction for unsupported pages
    return this.extractFromDOM();
  }

  private extractFromDOM(): PageContent {
    // Careful DOM extraction respecting Canvas structure
    const contentArea = document.querySelector('.content, #content, [data-testid="content"]');
    return {
      text: contentArea?.textContent || '',
      structure: this.analyzeStructure(contentArea),
      metadata: this.extractMetadata(),
    };
  }
}
```

## Custom Canvas JavaScript Integration

Since Canvas postMessage API only supports content extraction (`lti.getPageContent`) and not comprehensive interaction monitoring, we need a custom JavaScript deployed to Canvas for full metrics collection:

```javascript
// canvas-monitor.js - Deployed to Canvas
(function () {
  'use strict';

  // Only activate if our LTI tool is present
  const atomicFrame = document.querySelector('iframe[src*="atomic-guide"]');
  if (!atomicFrame) return;

  // Secure message channel setup
  const ATOMIC_ORIGIN = 'https://atomic-guide.atomicjolt.win';
  const messageChannel = new MessageChannel();

  // Send port to our tool for secure communication
  atomicFrame.contentWindow.postMessage({ type: 'atomic.monitor.init', port: messageChannel.port2 }, ATOMIC_ORIGIN, [messageChannel.port2]);

  // Monitor Canvas interactions
  const monitor = {
    trackHover: (element, duration) => {
      messageChannel.port1.postMessage({
        type: 'interaction',
        action: 'hover',
        element: element.id || element.className,
        duration: duration,
        context: getPageContext(),
      });
    },

    trackIdle: (duration) => {
      messageChannel.port1.postMessage({
        type: 'interaction',
        action: 'idle',
        duration: duration,
      });
    },

    trackQuizInteraction: (questionId, timeSpent, attempts) => {
      messageChannel.port1.postMessage({
        type: 'quiz_interaction',
        questionId,
        timeSpent,
        attempts,
        struggled: timeSpent > 30000 || attempts > 2,
      });
    },
  };

  // Setup event listeners for Canvas-specific elements
  setupCanvasMonitoring(monitor);
})();
```

## Message Security Implementation

```typescript
export class SecureMessageHandler {
  private trustedOrigins = new Set([
    'https://canvas.instructure.com',
    'https://*.instructure.com',
    // Institution-specific Canvas domains
  ]);

  private messageChannelPort: MessagePort | null = null;

  constructor() {
    this.setupSecureListener();
  }

  private setupSecureListener() {
    window.addEventListener('message', (event) => {
      // Validate origin
      if (!this.isOriginTrusted(event.origin)) {
        console.warn('Rejected message from untrusted origin:', event.origin);
        return;
      }

      // Handle MessageChannel setup
      if (event.data.type === 'atomic.monitor.init' && event.ports[0]) {
        this.messageChannelPort = event.ports[0];
        this.messageChannelPort.onmessage = this.handleSecureMessage.bind(this);
        return;
      }

      // Handle regular Canvas postMessages
      this.handleCanvasMessage(event);
    });
  }

  private isOriginTrusted(origin: string): boolean {
    return this.trustedOrigins.has(origin) || origin.endsWith('.instructure.com');
  }
}
```

## Data Flow Architecture

```
┌─────────────────┐
│   Canvas LMS    │
│                 │
│ ┌─────────────┐ │     postMessage API
│ │ Custom JS   │◄├────────────────────┐
│ │  Monitor    │ │                    │
│ └──────┬──────┘ │                    │
│        │        │                    │
│  MessageChannel │                    │
│        │        │     ┌──────────────▼─────────────┐
│        │        │     │    Atomic Guide Tool       │
│        │        │     │                            │
│        └────────┼────►│  PostMessage Handler       │
│                 │     │         Service            │
│  ┌────────────┐ │     │            │               │
│  │   Canvas   │◄├─────┤            ▼               │
│  │  Content   │ │     │   Content Extractor        │
│  └────────────┘ │     │            │               │
│                 │     │            ▼               │
└─────────────────┘     │    Cognitive Engine        │
                        │            │               │
                        │            ▼               │
                        │      AI Guide Chat         │
                        └────────────────────────────┘
```
