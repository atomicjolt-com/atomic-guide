# Webhook API

This document describes the webhook system in Atomic Guide for handling external integrations and event notifications.

## Overview

Atomic Guide provides webhook endpoints to handle events from external systems like LMS platforms, third-party services, and internal system events. Webhooks are implemented using Cloudflare Workers and support event-driven architecture.

## Webhook Endpoints

### LTI Platform Webhooks

- **URL**: `POST /webhooks/lti/events`
- **Purpose**: Handle events from LTI platforms (Canvas, Moodle, etc.)
- **Authentication**: HMAC signature verification

### Third-party Service Webhooks

- **URL**: `POST /webhooks/services/{serviceId}`
- **Purpose**: Handle events from integrated services
- **Authentication**: API key or HMAC signature

### Internal System Webhooks

- **URL**: `POST /webhooks/internal/{eventType}`
- **Purpose**: Handle internal system events
- **Authentication**: JWT token

## Security

### HMAC Signature Verification

Webhooks use HMAC SHA-256 signatures for security:

```typescript
import { verifyHMACSignature } from '@shared/server/utils/crypto';

export async function verifyWebhookSignature(request: Request, secret: string): Promise<boolean> {
  const signature = request.headers.get('X-Webhook-Signature');
  const body = await request.text();

  if (!signature) {
    return false;
  }

  return verifyHMACSignature(body, secret, signature);
}
```

### Rate Limiting

Webhook endpoints implement rate limiting:

```typescript
const RATE_LIMITS = {
  '/webhooks/lti/events': { requests: 100, window: 60 }, // 100 req/min
  '/webhooks/services/*': { requests: 50, window: 60 }, // 50 req/min
  '/webhooks/internal/*': { requests: 200, window: 60 }, // 200 req/min
};
```

## LTI Platform Webhooks

### Event Types

#### Grade Passback Events

```typescript
interface GradePassbackEvent {
  type: 'grade.created' | 'grade.updated' | 'grade.deleted';
  data: {
    userId: string;
    resourceLinkId: string;
    score: number;
    maxScore: number;
    timestamp: string;
    gradeId: string;
  };
}
```

#### Membership Events

```typescript
interface MembershipEvent {
  type: 'member.added' | 'member.removed' | 'member.updated';
  data: {
    contextId: string;
    userId: string;
    roles: string[];
    timestamp: string;
  };
}
```

#### Content Events

```typescript
interface ContentEvent {
  type: 'content.created' | 'content.updated' | 'content.deleted';
  data: {
    resourceLinkId: string;
    contentId: string;
    title: string;
    url: string;
    timestamp: string;
  };
}
```

### Handler Implementation

```typescript
export async function handleLTIWebhook(request: Request, env: Env): Promise<Response> {
  // Verify signature
  const isValid = await verifyWebhookSignature(request, env.LTI_WEBHOOK_SECRET);
  if (!isValid) {
    return new Response('Invalid signature', { status: 401 });
  }

  const event = await request.json();

  switch (event.type) {
    case 'grade.created':
    case 'grade.updated':
      return await handleGradeEvent(event, env);

    case 'member.added':
    case 'member.removed':
      return await handleMembershipEvent(event, env);

    case 'content.created':
    case 'content.updated':
      return await handleContentEvent(event, env);

    default:
      return new Response('Unknown event type', { status: 400 });
  }
}
```

## Canvas Integration Webhooks

### Canvas Event Subscription

```json
{
  "subscription": {
    "context_type": "Course",
    "context_id": "123456",
    "event_types": ["assignment_created", "assignment_updated", "grade_posted", "submission_created", "discussion_topic_created"],
    "transport_metadata": {
      "url": "https://your-domain.com/webhooks/lti/events"
    },
    "transport_type": "https"
  }
}
```

### Canvas Event Handler

```typescript
async function handleCanvasEvent(event: CanvasWebhookEvent): Promise<void> {
  switch (event.event_name) {
    case 'assignment_created':
      await processNewAssignment(event.body);
      break;

    case 'grade_posted':
      await updateStudentProgress(event.body);
      break;

    case 'discussion_topic_created':
      await indexDiscussionContent(event.body);
      break;
  }
}
```

## Moodle Integration Webhooks

### Moodle Event Configuration

```php
// Moodle webhook configuration
$webhook = new stdClass();
$webhook->name = 'Atomic Guide Integration';
$webhook->url = 'https://your-domain.com/webhooks/lti/events';
$webhook->events = [
    'course_module_created',
    'user_graded',
    'course_completed'
];
```

### Moodle Event Handler

```typescript
async function handleMoodleEvent(event: MoodleWebhookEvent): Promise<void> {
  switch (event.eventname) {
    case 'core\\event\\user_graded':
      await syncGradeData(event);
      break;

    case 'core\\event\\course_module_created':
      await processNewModule(event);
      break;
  }
}
```

## Third-party Service Webhooks

### AI Service Webhooks

#### Transcription Complete

```typescript
interface TranscriptionCompleteEvent {
  type: 'transcription.completed';
  data: {
    jobId: string;
    videoId: string;
    transcriptionUrl: string;
    confidence: number;
    duration: number;
    timestamp: string;
  };
}

async function handleTranscriptionComplete(event: TranscriptionCompleteEvent): Promise<void> {
  const { videoId, transcriptionUrl } = event.data;

  // Download and process transcription
  const transcription = await fetch(transcriptionUrl).then((r) => r.text());

  // Generate embeddings and store
  await processVideoTranscription(videoId, transcription);

  // Notify users
  await notifyTranscriptionComplete(videoId);
}
```

### External Analytics Webhooks

#### User Behavior Events

```typescript
interface UserBehaviorEvent {
  type: 'user.behavior';
  data: {
    userId: string;
    sessionId: string;
    events: Array<{
      type: 'click' | 'view' | 'interaction';
      element: string;
      timestamp: string;
      metadata?: Record<string, unknown>;
    }>;
  };
}
```

## Internal System Webhooks

### Video Processing Events

#### Video Upload Complete

```typescript
export async function handleVideoUploadComplete(videoId: string, metadata: VideoMetadata): Promise<void> {
  const event = {
    type: 'video.upload.completed',
    data: {
      videoId,
      metadata,
      timestamp: new Date().toISOString(),
    },
  };

  // Trigger webhook
  await triggerInternalWebhook(event);
}
```

### Assessment Events

#### Deep Link Created

```typescript
interface DeepLinkCreatedEvent {
  type: 'deep_link.created';
  data: {
    linkId: string;
    resourceType: 'assessment' | 'content' | 'activity';
    contextId: string;
    createdBy: string;
    configuration: Record<string, unknown>;
    timestamp: string;
  };
}
```

## Webhook Queue System

For reliable webhook processing, use Cloudflare Queues:

```typescript
export async function queueWebhookEvent(event: WebhookEvent, env: Env): Promise<void> {
  await env.WEBHOOK_QUEUE.send({
    type: event.type,
    data: event.data,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  });
}

export async function processWebhookQueue(batch: MessageBatch<WebhookEvent>, env: Env): Promise<void> {
  for (const message of batch.messages) {
    try {
      await processWebhookEvent(message.body, env);
      message.ack();
    } catch (error) {
      console.error('Webhook processing failed:', error);

      if (message.body.retryCount < 3) {
        message.body.retryCount++;
        await env.WEBHOOK_QUEUE.send(message.body);
      }

      message.ack();
    }
  }
}
```

## Error Handling and Retries

### Retry Strategy

```typescript
const RETRY_CONFIG = {
  maxRetries: 3,
  backoffMultiplier: 2,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
};

async function processWebhookWithRetry(event: WebhookEvent, retryCount: number = 0): Promise<void> {
  try {
    await processWebhookEvent(event);
  } catch (error) {
    if (retryCount < RETRY_CONFIG.maxRetries) {
      const delay = Math.min(RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, retryCount), RETRY_CONFIG.maxDelay);

      setTimeout(() => {
        processWebhookWithRetry(event, retryCount + 1);
      }, delay);
    } else {
      // Send to dead letter queue
      await sendToDeadLetterQueue(event, error);
    }
  }
}
```

### Dead Letter Queue

```typescript
async function sendToDeadLetterQueue(event: WebhookEvent, error: Error): Promise<void> {
  await env.DEAD_LETTER_QUEUE.send({
    originalEvent: event,
    error: {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    },
  });
}
```

## Monitoring and Logging

### Webhook Analytics

```typescript
interface WebhookMetrics {
  endpoint: string;
  eventType: string;
  requestCount: number;
  successCount: number;
  errorCount: number;
  avgProcessingTime: number;
  lastProcessed: string;
}

async function recordWebhookMetrics(endpoint: string, eventType: string, success: boolean, processingTime: number): Promise<void> {
  await env.WEBHOOK_ANALYTICS.put(
    `metrics:${endpoint}:${eventType}`,
    JSON.stringify({
      endpoint,
      eventType,
      success,
      processingTime,
      timestamp: new Date().toISOString(),
    })
  );
}
```

### Request Logging

```typescript
export async function logWebhookRequest(request: Request, response: Response, processingTime: number): Promise<void> {
  const logEntry = {
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries()),
    statusCode: response.status,
    processingTime,
    timestamp: new Date().toISOString(),
  };

  console.log('Webhook request:', logEntry);
}
```

## Testing Webhooks

### Mock Webhook Events

```typescript
// Test webhook handler
describe('LTI Webhook Handler', () => {
  it('should handle grade update events', async () => {
    const mockEvent = {
      type: 'grade.updated',
      data: {
        userId: 'user123',
        resourceLinkId: 'link456',
        score: 85,
        maxScore: 100,
        timestamp: '2024-01-01T12:00:00Z',
      },
    };

    const request = new Request('http://test.com/webhooks/lti/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockEvent),
    });

    const response = await handleLTIWebhook(request, env);
    expect(response.status).toBe(200);
  });
});
```

### Webhook Testing Tools

```bash
# Test webhook endpoint with curl
curl -X POST https://your-domain.com/webhooks/lti/events \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: sha256=<signature>" \
  -d '{"type": "test.event", "data": {"message": "test"}}'

# Use webhook.site for testing
curl -X POST https://webhook.site/your-unique-url \
  -H "Content-Type: application/json" \
  -d '{"event": "test"}'
```

## Best Practices

1. **Idempotency**: Ensure webhook handlers are idempotent
2. **Signature Verification**: Always verify webhook signatures
3. **Rate Limiting**: Implement appropriate rate limiting
4. **Async Processing**: Use queues for heavy processing
5. **Error Handling**: Implement proper error handling and retries
6. **Monitoring**: Monitor webhook health and performance
7. **Documentation**: Document webhook payloads and expected responses
8. **Testing**: Thoroughly test webhook handlers
9. **Security**: Use HTTPS and validate all inputs
10. **Logging**: Log all webhook events for debugging and auditing
