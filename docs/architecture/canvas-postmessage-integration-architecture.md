# Canvas postMessage Integration Architecture

## Overview

The Canvas postMessage API enables bidirectional communication between our LTI tool (running in an iframe) and the Canvas LMS platform. This integration is critical for gathering user engagement metrics, detecting learning struggles, and providing contextual AI assistance.

## Architecture Components

### 1. PostMessage Handler Service

**Responsibility:** Centralized service for all Canvas postMessage communication
**Location:** `client/services/CanvasPostMessageService.ts`

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

### 2. Canvas Content Extraction

**Responsibility:** Extract page content for AI context using Canvas API
**Integration:** Uses `lti.getPageContent` for assignments and wiki pages

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

### 3. Message Types Implementation

#### Core Canvas Messages Used

```typescript
// Get page content for AI context
canvasService.getPageContent().then((content) => {
  // Send to AI with proper context
  aiService.processWithContext(content);
});

// Monitor scroll events for engagement tracking
canvasService.enableScrollEvents((scrollData) => {
  cognitiveEngine.trackEngagement({
    type: 'scroll',
    position: scrollData.scrollY,
    timestamp: Date.now(),
  });
});

// Resize frame based on content
canvasService.resizeFrame(calculatedHeight);

// Show alerts for important notifications
canvasService.showAlert({
  type: 'info',
  message: 'AI Guide is ready to help!',
  title: 'Atomic Guide',
});
```

#### Platform Storage for Persistence

```typescript
// Store learner preferences using Canvas storage
await canvasService.putData(
  'learner_preferences',
  JSON.stringify({
    aiEnabled: true,
    struggledDetection: true,
    notificationLevel: 'medium',
  }),
);

// Retrieve stored data
const preferences = await canvasService.getData('learner_preferences');
```

## Custom Canvas JavaScript Integration

### Deployment Strategy

Since Canvas postMessage API only supports content extraction (`lti.getPageContent`) and not comprehensive interaction monitoring, we need a custom JavaScript deployed to Canvas for full metrics collection:

1. **Custom JavaScript Deployment:**
   - Deploy monitoring script via Canvas Theme Editor or institution-level JavaScript
   - Script captures user interactions and sends to our tool via postMessage
   - Must be approved by Canvas administrator

2. **Monitoring Script Architecture:**

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

### Message Security Implementation

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

  private handleSecureMessage(event: MessageEvent) {
    // Process monitoring data from our custom script
    const { type, action, ...data } = event.data;

    // Validate message structure
    if (!this.validateMessageStructure(event.data)) {
      return;
    }

    // Process based on type
    switch (type) {
      case 'interaction':
        this.processInteraction(action, data);
        break;
      case 'quiz_interaction':
        this.processQuizInteraction(data);
        break;
    }
  }

  private isOriginTrusted(origin: string): boolean {
    return this.trustedOrigins.has(origin) || origin.endsWith('.instructure.com');
  }
}
```

## LTI Placement Configuration

To support Canvas postMessage integration, we need to configure appropriate LTI placements:

```typescript
// src/config.ts updates
export function getToolConfiguration(platformConfig: PlatformConfiguration, host: string): ToolConfiguration {
  const params: ToolConfigurationParams = {
    // ... existing config
    courseNav: true,
    accountNav: true, // NEW: For institution-wide access
    userNav: true, // NEW: For learner dashboard access
    // Custom placements for monitoring
    customPlacements: [
      {
        placement: 'top_navigation',
        message_type: 'LtiResourceLinkRequest',
        canvas_icon_class: 'icon-stats',
        windowTarget: '_blank', // Opens in new tab for persistent monitoring
      },
      {
        placement: 'course_navigation',
        message_type: 'LtiResourceLinkRequest',
        default: 'enabled',
        display_type: 'default',
      },
    ],
    // Canvas-specific extensions
    canvas: {
      privacy_level: 'public', // Required for names/roles
      custom_fields: {
        post_message_token: '$com.instructure.PostMessageToken',
        canvas_user_id: '$Canvas.user.id',
        canvas_course_id: '$Canvas.course.id',
      },
    },
  };

  return buildToolConfiguration(params);
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

## Security Considerations

### Origin Validation

- Always validate message origins against known Canvas domains
- Use institution-specific domain whitelist
- Reject messages from unexpected origins

### Token Validation

- Use PostMessageToken when provided by Canvas
- Validate token on every sensitive operation
- Implement token expiry and refresh

### MessageChannel Security

- Use MessageChannel for custom script communication
- Establish secure channel during initialization
- Never expose ports to untrusted contexts

### Data Sanitization

- Sanitize all data received via postMessage
- Validate message structure and types
- Prevent XSS through content injection

### Rate Limiting

- Implement rate limiting on message processing
- Throttle rapid message sequences
- Detect and block message flooding

## Implementation Roadmap

1. **Phase 1: Basic Canvas Integration (Week 1)**
   - Implement PostMessage handler service
   - Add Canvas content extraction via `lti.getPageContent`
   - Setup message event listeners
   - Configure LTI placements

2. **Phase 2: Secure Communication (Week 2)**
   - Implement origin validation
   - Add PostMessageToken support
   - Setup MessageChannel for custom script
   - Add rate limiting

3. **Phase 3: Custom Monitoring Script (Week 3)**
   - Develop Canvas monitoring JavaScript
   - Implement interaction tracking
   - Add struggle detection logic
   - Test with Canvas sandbox

4. **Phase 4: Production Deployment (Week 4)**
   - Canvas administrator approval
   - Deploy custom script to production
   - Monitor performance and security
   - Iterate based on usage data

## Performance Optimization

### Message Batching

```typescript
class MessageBatcher {
  private queue: Message[] = [];
  private flushInterval = 100; // ms

  addMessage(message: Message) {
    this.queue.push(message);
    this.scheduleFlush();
  }

  private flush() {
    if (this.queue.length === 0) return;

    // Send batch to cognitive engine
    this.cognitiveEngine.processBatch(this.queue);
    this.queue = [];
  }
}
```

### Caching Strategy

- Cache Canvas page content for 5 minutes
- Store user preferences in localStorage
- Implement LRU cache for processed messages

### Throttling

- Throttle scroll events to max 10/second
- Debounce hover tracking to 500ms
- Limit API calls to 100/minute per user
