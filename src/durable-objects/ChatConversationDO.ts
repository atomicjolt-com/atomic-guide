/**
 * ChatConversationDO Durable Object for managing chat conversations and memory
 */

import type { DurableObjectState } from '@cloudflare/workers-types';

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    tokensUsed?: number;
    modelUsed?: string;
    cached?: boolean;
  };
}

export interface ConversationSession {
  conversationId: string;
  tenantId: string;
  userId: string;
  startedAt: string;
  lastActivityAt: string;
  messageCount: number;
  totalTokensUsed: number;
  context?: Record<string, any>;
}

export interface RateLimitInfo {
  userId: string;
  messageCount: number;
  windowStart: number;
}

export class ChatConversationDO {
  private state: DurableObjectState;
  private sessions: Map<WebSocket, SessionInfo>;
  private conversationHistory: ConversationMessage[];
  private sessionInfo: ConversationSession | null;
  private rateLimitMap: Map<string, RateLimitInfo>;
  private maxHistorySize: number = 100;
  private conversationWindowSize: number = 10;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.sessions = new Map();
    this.conversationHistory = [];
    this.sessionInfo = null;
    this.rateLimitMap = new Map();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    switch (url.pathname) {
      case '/websocket':
        return this.handleWebSocket(request);
      case '/add-message':
        return this.handleAddMessage(request);
      case '/get-history':
        return this.handleGetHistory(request);
      case '/get-context':
        return this.handleGetContext(request);
      case '/summarize':
        return this.handleSummarize(request);
      case '/check-rate-limit':
        return this.handleCheckRateLimit(request);
      case '/stats':
        return this.handleStats();
      case '/reset':
        return this.handleReset();
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  private async initializeSession(conversationId: string, tenantId: string, userId: string) {
    // Load existing session or create new one
    const storedSession = await this.state.storage.get<ConversationSession>(`session:${conversationId}`);
    
    if (storedSession) {
      this.sessionInfo = storedSession;
      // Load conversation history
      const storedHistory = await this.state.storage.get<ConversationMessage[]>(`history:${conversationId}`);
      this.conversationHistory = storedHistory || [];
    } else {
      this.sessionInfo = {
        conversationId,
        tenantId,
        userId,
        startedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        messageCount: 0,
        totalTokensUsed: 0
      };
      await this.state.storage.put(`session:${conversationId}`, this.sessionInfo);
    }
  }

  private async handleAddMessage(request: Request): Promise<Response> {
    try {
      const body = await request.json() as ConversationMessage;
      
      if (!body.role || !body.content) {
        return new Response(JSON.stringify({ error: 'Invalid message format' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Create message with ID and timestamp
      const message: ConversationMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        role: body.role,
        content: body.content,
        timestamp: body.timestamp || new Date().toISOString(),
        metadata: body.metadata
      };

      // Add to history
      this.conversationHistory.push(message);

      // Maintain sliding window
      if (this.conversationHistory.length > this.maxHistorySize) {
        // Keep the most recent messages
        this.conversationHistory = this.conversationHistory.slice(-this.maxHistorySize);
      }

      // Update session info
      if (this.sessionInfo) {
        this.sessionInfo.lastActivityAt = new Date().toISOString();
        this.sessionInfo.messageCount++;
        if (body.metadata?.tokensUsed) {
          this.sessionInfo.totalTokensUsed += body.metadata.tokensUsed;
        }

        // Persist to storage
        const conversationId = this.sessionInfo.conversationId;
        await this.state.storage.put(`history:${conversationId}`, this.conversationHistory);
        await this.state.storage.put(`session:${conversationId}`, this.sessionInfo);
      }

      // Broadcast to WebSocket clients if any
      this.broadcastMessage({
        type: 'new-message',
        message
      });

      return new Response(JSON.stringify({ 
        success: true,
        messageId: message.id
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error adding message:', error);
      return new Response(JSON.stringify({ error: 'Failed to add message' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleGetHistory(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit') || '10');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      // Get the most recent messages for context window
      const recentHistory = this.conversationHistory
        .slice(-Math.min(limit + offset, this.conversationHistory.length))
        .slice(0, limit)
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));

      return new Response(JSON.stringify(recentHistory), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error getting history:', error);
      return new Response(JSON.stringify({ error: 'Failed to get history' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleGetContext(request: Request): Promise<Response> {
    try {
      const context = {
        sessionInfo: this.sessionInfo,
        recentMessages: this.conversationHistory.slice(-this.conversationWindowSize),
        messageCount: this.conversationHistory.length
      };

      return new Response(JSON.stringify(context), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error getting context:', error);
      return new Response(JSON.stringify({ error: 'Failed to get context' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleSummarize(request: Request): Promise<Response> {
    try {
      // Create a summary of the conversation for long chats
      if (this.conversationHistory.length < 20) {
        return new Response(JSON.stringify({ 
          summary: null,
          message: 'Conversation too short for summarization'
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Simple summarization - extract key points
      const keyMessages = this.conversationHistory
        .filter((msg, index) => {
          // Keep first message, last few messages, and messages with questions
          return index === 0 || 
                 index >= this.conversationHistory.length - 3 ||
                 msg.content.includes('?') ||
                 (msg.role === 'assistant' && msg.content.length > 200);
        })
        .slice(0, 10);

      const summary = {
        totalMessages: this.conversationHistory.length,
        keyPoints: keyMessages.map(msg => ({
          role: msg.role,
          snippet: msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '')
        })),
        startTime: this.sessionInfo?.startedAt,
        lastActivity: this.sessionInfo?.lastActivityAt,
        tokensUsed: this.sessionInfo?.totalTokensUsed || 0
      };

      return new Response(JSON.stringify(summary), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error summarizing:', error);
      return new Response(JSON.stringify({ error: 'Failed to summarize' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleCheckRateLimit(request: Request): Promise<Response> {
    try {
      const body = await request.json() as { userId: string; limit: number; windowMs: number };
      const { userId, limit = 10, windowMs = 60000 } = body;

      const now = Date.now();
      const rateLimitInfo = this.rateLimitMap.get(userId);

      if (!rateLimitInfo || now - rateLimitInfo.windowStart > windowMs) {
        // New window
        this.rateLimitMap.set(userId, {
          userId,
          messageCount: 1,
          windowStart: now
        });

        return new Response(JSON.stringify({ 
          allowed: true,
          remaining: limit - 1,
          resetIn: windowMs
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if within limit
      if (rateLimitInfo.messageCount >= limit) {
        const resetIn = windowMs - (now - rateLimitInfo.windowStart);
        return new Response(JSON.stringify({ 
          allowed: false,
          remaining: 0,
          resetIn,
          retryAfter: Math.ceil(resetIn / 1000)
        }), {
          status: 429,
          headers: { 
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil(resetIn / 1000).toString()
          }
        });
      }

      // Increment counter
      rateLimitInfo.messageCount++;
      
      return new Response(JSON.stringify({ 
        allowed: true,
        remaining: limit - rateLimitInfo.messageCount,
        resetIn: windowMs - (now - rateLimitInfo.windowStart)
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Error checking rate limit:', error);
      return new Response(JSON.stringify({ error: 'Failed to check rate limit' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.handleSession(server, request);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private handleSession(webSocket: WebSocket, request: Request) {
    webSocket.accept();

    const sessionInfo: SessionInfo = {
      userId: request.headers.get('X-User-Id') || 'anonymous',
      tenantId: request.headers.get('X-Tenant-Id') || 'default',
      conversationId: request.headers.get('X-Conversation-Id') || '',
      connectedAt: new Date().toISOString(),
    };

    this.sessions.set(webSocket, sessionInfo);

    // Initialize session if needed
    if (sessionInfo.conversationId) {
      this.initializeSession(sessionInfo.conversationId, sessionInfo.tenantId, sessionInfo.userId);
    }

    webSocket.addEventListener('message', async (event) => {
      try {
        const message = JSON.parse(event.data as string);
        await this.handleWebSocketMessage(webSocket, message);
      } catch (error) {
        webSocket.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
        }));
      }
    });

    webSocket.addEventListener('close', () => {
      this.sessions.delete(webSocket);
    });

    webSocket.send(JSON.stringify({
      type: 'connected',
      sessionInfo,
      timestamp: new Date().toISOString(),
    }));
  }

  private async handleWebSocketMessage(sender: WebSocket, message: any) {
    const senderInfo = this.sessions.get(sender);
    if (!senderInfo) return;

    // Handle different message types
    switch (message.type) {
      case 'chat':
        // Add message to history
        await this.handleAddMessage(new Request('https://do/add-message', {
          method: 'POST',
          body: JSON.stringify({
            role: 'user',
            content: message.content,
            timestamp: new Date().toISOString()
          })
        }));
        break;

      case 'get-history':
        const history = this.conversationHistory.slice(-10);
        sender.send(JSON.stringify({
          type: 'history',
          messages: history
        }));
        break;

      case 'ping':
        sender.send(JSON.stringify({ type: 'pong' }));
        break;
    }
  }

  private broadcastMessage(message: any) {
    for (const [client, info] of this.sessions) {
      try {
        client.send(JSON.stringify(message));
      } catch (error) {
        this.sessions.delete(client);
      }
    }
  }

  private handleStats(): Response {
    const stats = {
      activeSessions: this.sessions.size,
      conversationLength: this.conversationHistory.length,
      sessionInfo: this.sessionInfo,
      rateLimitEntries: this.rateLimitMap.size
    };

    return new Response(JSON.stringify(stats), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleReset(): Promise<Response> {
    // Clear conversation history
    this.conversationHistory = [];
    this.rateLimitMap.clear();
    
    if (this.sessionInfo) {
      const conversationId = this.sessionInfo.conversationId;
      await this.state.storage.delete(`history:${conversationId}`);
      await this.state.storage.delete(`session:${conversationId}`);
      this.sessionInfo = null;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

interface SessionInfo {
  userId: string;
  tenantId: string;
  conversationId: string;
  connectedAt: string;
}