/**
 * ChatSession Durable Object for managing real-time chat sessions
 */

import type { DurableObjectState } from '@cloudflare/workers-types';

export class ChatSessionDurableObject {
  private state: DurableObjectState;
  private sessions: Map<WebSocket, SessionInfo>;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.sessions = new Map();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    switch (url.pathname) {
      case '/websocket':
        return this.handleWebSocket(request);
      case '/broadcast':
        return this.handleBroadcast(request);
      case '/stats':
        return this.handleStats();
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    // Upgrade the request to a WebSocket
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the WebSocket connection
    this.handleSession(server, request);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private handleSession(webSocket: WebSocket, request: Request) {
    // Accept the WebSocket connection
    webSocket.accept();

    // Parse session info from request headers
    const sessionInfo: SessionInfo = {
      userId: request.headers.get('X-User-Id') || 'anonymous',
      tenantId: request.headers.get('X-Tenant-Id') || 'default',
      connectedAt: new Date().toISOString(),
    };

    // Store the session
    this.sessions.set(webSocket, sessionInfo);

    // Set up event handlers
    webSocket.addEventListener('message', async (event) => {
      try {
        const message = JSON.parse(event.data as string);
        await this.handleMessage(webSocket, message);
      } catch (error) {
        webSocket.send(
          JSON.stringify({
            type: 'error',
            message: 'Invalid message format',
          }),
        );
      }
    });

    webSocket.addEventListener('close', () => {
      this.sessions.delete(webSocket);
    });

    // Send welcome message
    webSocket.send(
      JSON.stringify({
        type: 'connected',
        sessionInfo,
        timestamp: new Date().toISOString(),
      }),
    );
  }

  private async handleMessage(sender: WebSocket, message: any) {
    const senderInfo = this.sessions.get(sender);

    if (!senderInfo) {
      return;
    }

    // Broadcast to all connected clients in the same tenant
    const broadcastMessage = {
      ...message,
      userId: senderInfo.userId,
      timestamp: new Date().toISOString(),
    };

    for (const [client, info] of this.sessions) {
      if (info.tenantId === senderInfo.tenantId) {
        try {
          client.send(JSON.stringify(broadcastMessage));
        } catch (error) {
          // Client might be disconnected
          this.sessions.delete(client);
        }
      }
    }

    // Store message in state for persistence if needed
    if (message.type === 'chat') {
      await this.storeMessage(senderInfo.tenantId, broadcastMessage);
    }
  }

  private async handleBroadcast(request: Request): Promise<Response> {
    const message = await request.json();
    const tenantId = request.headers.get('X-Tenant-Id') || 'default';

    // Broadcast to all clients in the tenant
    let count = 0;
    for (const [client, info] of this.sessions) {
      if (info.tenantId === tenantId) {
        try {
          client.send(JSON.stringify(message));
          count++;
        } catch (error) {
          this.sessions.delete(client);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        broadcastTo: count,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  private handleStats(): Response {
    const stats = {
      totalSessions: this.sessions.size,
      byTenant: {} as Record<string, number>,
    };

    for (const info of this.sessions.values()) {
      stats.byTenant[info.tenantId] = (stats.byTenant[info.tenantId] || 0) + 1;
    }

    return new Response(JSON.stringify(stats), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async storeMessage(tenantId: string, message: any) {
    // Store recent messages in Durable Object storage
    const key = `messages:${tenantId}`;
    const messages = ((await this.state.storage.get(key)) as any[]) || [];

    messages.push(message);

    // Keep only last 100 messages
    if (messages.length > 100) {
      messages.splice(0, messages.length - 100);
    }

    await this.state.storage.put(key, messages);
  }
}

interface SessionInfo {
  userId: string;
  tenantId: string;
  connectedAt: string;
}
