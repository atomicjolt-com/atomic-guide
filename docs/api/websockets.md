# WebSocket API

This document describes the WebSocket implementation in Atomic Guide using Cloudflare Durable Objects for real-time features.

## Overview

Atomic Guide uses Cloudflare Durable Objects to provide WebSocket connections for real-time features like chat, live analytics, and collaborative learning sessions.

## WebSocket Endpoints

### Chat WebSocket

- **URL**: `wss://your-domain.com/api/chat/ws`
- **Purpose**: Real-time chat messaging
- **Durable Object**: `ChatRoomDurableObject`

### Analytics WebSocket

- **URL**: `wss://your-domain.com/api/analytics/ws`
- **Purpose**: Live performance metrics and dashboards
- **Durable Object**: `AnalyticsDurableObject`

### Collaboration WebSocket

- **URL**: `wss://your-domain.com/api/collaboration/ws`
- **Purpose**: Real-time collaborative learning sessions
- **Durable Object**: `CollaborationDurableObject`

## Connection Authentication

WebSocket connections require JWT authentication via query parameter or initial message:

### Query Parameter Authentication

```typescript
const ws = new WebSocket(`wss://your-domain.com/api/chat/ws?token=${encodeURIComponent(jwt)}&contextId=${contextId}`);
```

### Initial Message Authentication

```typescript
const ws = new WebSocket('wss://your-domain.com/api/chat/ws');

ws.onopen = () => {
  ws.send(
    JSON.stringify({
      type: 'auth',
      token: jwt,
      contextId: contextId,
    })
  );
};
```

## Message Format

All WebSocket messages use a standardized JSON format:

```typescript
interface WebSocketMessage {
  type: string;
  id?: string;
  timestamp: string;
  data: unknown;
  error?: string;
}
```

## Chat WebSocket API

### Connection

```typescript
import { ChatWebSocketClient } from '@features/chat/client/services/ChatWebSocketClient';

const chatClient = new ChatWebSocketClient({
  url: 'wss://your-domain.com/api/chat/ws',
  token: window.LAUNCH_SETTINGS.jwt,
  contextId: 'context_123',
});

await chatClient.connect();
```

### Outgoing Messages

#### Send Chat Message

```typescript
chatClient.send({
  type: 'message',
  data: {
    content: 'Hello, everyone!',
    messageType: 'text',
  },
});
```

#### Send Typing Indicator

```typescript
chatClient.send({
  type: 'typing',
  data: {
    isTyping: true,
  },
});
```

#### Request Message History

```typescript
chatClient.send({
  type: 'history',
  data: {
    limit: 50,
    before: '2024-01-01T00:00:00Z',
  },
});
```

### Incoming Messages

#### New Message

```typescript
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'message') {
    const { id, content, author, timestamp } = message.data;
    displayMessage({ id, content, author, timestamp });
  }
};
```

#### Typing Indicator

```typescript
if (message.type === 'typing') {
  const { userId, isTyping } = message.data;
  updateTypingIndicator(userId, isTyping);
}
```

#### User Joined/Left

```typescript
if (message.type === 'user_joined') {
  const { userId, username } = message.data;
  showUserJoined(username);
}

if (message.type === 'user_left') {
  const { userId, username } = message.data;
  showUserLeft(username);
}
```

## Analytics WebSocket API

### Connection

```typescript
import { AnalyticsWebSocketClient } from '@features/dashboard/client/services/AnalyticsWebSocketClient';

const analyticsClient = new AnalyticsWebSocketClient({
  url: 'wss://your-domain.com/api/analytics/ws',
  token: window.LAUNCH_SETTINGS.jwt,
  contextId: 'context_123',
});
```

### Subscribe to Metrics

```typescript
analyticsClient.send({
  type: 'subscribe',
  data: {
    metrics: ['engagement', 'performance', 'activity'],
  },
});
```

### Real-time Metric Updates

```typescript
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === 'metric_update') {
    const { metric, value, timestamp } = message.data;
    updateDashboard(metric, value);
  }
};
```

## Collaboration WebSocket API

### Session Management

```typescript
// Join collaboration session
collaborationClient.send({
  type: 'join_session',
  data: {
    sessionId: 'session_123',
    role: 'participant',
  },
});

// Leave session
collaborationClient.send({
  type: 'leave_session',
  data: {
    sessionId: 'session_123',
  },
});
```

### Collaborative Editing

```typescript
// Send edit operation
collaborationClient.send({
  type: 'edit',
  data: {
    operation: 'insert',
    position: 42,
    content: 'Hello World',
    version: 15,
  },
});

// Receive edit operation
if (message.type === 'edit') {
  const { operation, position, content, author } = message.data;
  applyEdit(operation, position, content, author);
}
```

## Error Handling

### Connection Errors

```typescript
ws.onerror = (error) => {
  console.error('WebSocket error:', error);
  showErrorMessage('Connection error occurred');
};

ws.onclose = (event) => {
  if (event.code !== 1000) {
    console.error('WebSocket closed unexpectedly:', event.code, event.reason);
    attemptReconnection();
  }
};
```

### Message Validation

```typescript
import { webSocketMessageSchema } from '@shared/schemas/websocket';

ws.onmessage = (event) => {
  try {
    const message = webSocketMessageSchema.parse(JSON.parse(event.data));
    handleMessage(message);
  } catch (error) {
    console.error('Invalid message format:', error);
  }
};
```

## Durable Object Implementation

### Chat Room Durable Object

```typescript
export class ChatRoomDurableObject implements DurableObject {
  private sessions: Map<WebSocket, SessionInfo> = new Map();

  async fetch(request: Request): Promise<Response> {
    const { 0: client, 1: server } = new WebSocketPair();

    await this.handleWebSocketConnection(server, request);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private async handleWebSocketConnection(ws: WebSocket, request: Request): Promise<void> {
    ws.accept();

    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(ws, message);
    });

    ws.addEventListener('close', () => {
      this.sessions.delete(ws);
    });
  }

  private broadcast(message: WebSocketMessage, exclude?: WebSocket): void {
    const data = JSON.stringify(message);

    for (const [ws, session] of this.sessions.entries()) {
      if (ws !== exclude && ws.readyState === WebSocket.READY_STATE_OPEN) {
        ws.send(data);
      }
    }
  }
}
```

## Rate Limiting

WebSocket connections are rate limited to prevent abuse:

- **Connection Rate**: 10 connections per minute per IP
- **Message Rate**: 100 messages per minute per connection
- **Broadcast Rate**: 1000 messages per minute per room

```typescript
// Rate limiting example
if (this.messageCount > this.messageLimit) {
  ws.send(
    JSON.stringify({
      type: 'error',
      error: 'Rate limit exceeded',
    })
  );
  ws.close(1008, 'Rate limit exceeded');
}
```

## Monitoring and Debugging

### Connection Status

```typescript
// Client-side connection monitoring
class WebSocketMonitor {
  private pingInterval: NodeJS.Timeout | null = null;

  startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  handlePong(): void {
    // Connection is alive
  }
}
```

### Server-side Logging

```typescript
// Log WebSocket events
console.log('WebSocket connection established', {
  userId: session.userId,
  contextId: session.contextId,
  timestamp: new Date().toISOString(),
});
```

## Best Practices

1. **Reconnection Logic**: Implement exponential backoff for reconnections
2. **Message Queuing**: Queue messages when disconnected and send when reconnected
3. **Heartbeat**: Use ping/pong to detect connection health
4. **Error Handling**: Gracefully handle all error scenarios
5. **Resource Cleanup**: Always clean up resources on disconnect
6. **Authentication**: Validate authentication on every message
7. **Rate Limiting**: Implement both client and server-side rate limiting

## Testing WebSockets

### Unit Testing

```typescript
// Mock WebSocket for testing
class MockWebSocket {
  readyState = WebSocket.OPEN;
  onmessage: ((event: MessageEvent) => void) | null = null;

  send(data: string): void {
    // Simulate message sending
  }

  simulateMessage(data: unknown): void {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) } as MessageEvent);
    }
  }
}
```

### Integration Testing

```typescript
// Test WebSocket endpoints
describe('Chat WebSocket', () => {
  it('should handle chat messages', async () => {
    const ws = new WebSocket('ws://localhost:8787/api/chat/ws?token=test');

    await new Promise((resolve) => {
      ws.onopen = resolve;
    });

    ws.send(
      JSON.stringify({
        type: 'message',
        data: { content: 'Test message' },
      })
    );

    const response = await waitForMessage(ws);
    expect(response.type).toBe('message');
  });
});
```
