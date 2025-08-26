/**
 * ChatConversationDO Durable Object for managing chat conversations and memory
 */

import type { DurableObjectState } from '@cloudflare/workers-types';
import { z } from 'zod';
import { sanitizeInput } from '../utils/sanitizer';

// Zod schemas for input validation
const ConversationMessageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(50000), // Prevent extremely large messages
  timestamp: z.string().optional(),
  metadata: z
    .object({
      tokensUsed: z.number().min(0).optional(),
      modelUsed: z.string().max(100).optional(),
      cached: z.boolean().optional(),
      learningStyle: z.enum(['visual', 'auditory', 'kinesthetic', 'reading_writing', 'mixed']).optional(),
      topics: z.array(z.string().max(100)).max(20).optional(), // Limit topics array
    })
    .optional(),
});

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    tokensUsed?: number;
    modelUsed?: string;
    cached?: boolean;
    learningStyle?: string;
    topics?: string[];
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
  learningStyle?: string;
  topics?: string[];
  summaryGenerated?: boolean;
  lastSummaryAt?: string;
}

export interface ConversationSummary {
  conversationId: string;
  summary: string;
  keyTopics: string[];
  totalMessages: number;
  startTime: string;
  endTime: string;
  learningStyleDetected?: string;
  tokensUsed: number;
}

export interface RateLimitInfo {
  userId: string;
  messageCount: number;
  windowStart: number;
}

// Request body interfaces
export interface RestoreStateRequestBody {
  conversationId: string;
}

export interface CheckRateLimitRequestBody {
  userId: string;
  limit?: number;
  windowMs?: number;
}

export interface AnalyzePatternsRequestBody {
  includeContext?: boolean;
}

export interface SuggestProactiveRequestBody {
  triggerContext?: {
    triggerType?: string;
    pageType?: string;
    topic?: string;
    confidence?: number;
    timestamp?: string;
  };
  learnerProfile?: {
    learningStyle?: string;
    secondaryStyle?: string;
    struggleAreas?: string[];
    preferredLanguage?: string;
    learningVelocity?: number;
    topics?: string[];
    mediaPreferences?: {
      prefers_visual?: boolean;
      math_notation_style?: string;
      code_highlight_theme?: string;
      bandwidth_preference?: string;
    };
  };
  preferences?: Record<string, any>;
}

export interface UpdateSuggestionStateRequestBody {
  suggestionId: string;
  state: 'shown' | 'dismissed' | 'accepted' | 'acted_upon';
  feedback?: string;
  timestamp?: string;
}

export class ChatConversationDO {
  private state: DurableObjectState;
  private sessions: Map<WebSocket, SessionInfo>;
  private conversationHistory: ConversationMessage[];
  private sessionInfo: ConversationSession | null;
  private rateLimitMap: Map<string, RateLimitInfo>;
  private maxHistorySize: number = 100;
  private conversationWindowSize: number = 10;
  private conversationSummaries: ConversationSummary[];
  private retentionDays: number = 90;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.sessions = new Map();
    this.conversationHistory = [];
    this.sessionInfo = null;
    this.rateLimitMap = new Map();
    this.conversationSummaries = [];
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
      case '/generate-summary':
        return this.handleGenerateSummary(request);
      case '/get-summaries':
        return this.handleGetSummaries(request);
      case '/check-rate-limit':
        return this.handleCheckRateLimit(request);
      case '/persist-state':
        return this.handlePersistState(request);
      case '/restore-state':
        return this.handleRestoreState(request);
      case '/cleanup-old-data':
        return this.handleCleanupOldData(request);
      case '/stats':
        return this.handleStats();
      case '/reset':
        return this.handleReset();
      case '/analyze-patterns':
        return this.handleAnalyzePatterns(request);
      case '/suggest-proactive':
        return this.handleSuggestProactive(request);
      case '/update-suggestion-state':
        return this.handleUpdateSuggestionState(request);
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
        totalTokensUsed: 0,
      };
      await this.state.storage.put(`session:${conversationId}`, this.sessionInfo);
    }
  }

  private async handleAddMessage(request: Request): Promise<Response> {
    try {
      const rawBody = await request.json();

      // Validate input using Zod schema
      const validationResult = ConversationMessageSchema.safeParse(rawBody);
      if (!validationResult.success) {
        console.error('Message validation failed:', validationResult.error.issues);
        return new Response(
          JSON.stringify({
            error: 'Invalid message format',
            details: validationResult.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      const body = validationResult.data;

      // Create message with ID and timestamp, sanitizing content
      const message: ConversationMessage = {
        id: body.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        role: body.role,
        content: this.sanitizeContent(body.content),
        timestamp: body.timestamp || new Date().toISOString(),
        metadata: body.metadata,
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
        message,
      });

      return new Response(
        JSON.stringify({
          success: true,
          messageId: message.id,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } catch (error) {
      console.error('Error adding message:', error);
      return new Response(JSON.stringify({ error: 'Failed to add message' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
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
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

      return new Response(JSON.stringify(recentHistory), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error getting history:', error);
      return new Response(JSON.stringify({ error: 'Failed to get history' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  private async handleGetContext(request: Request): Promise<Response> {
    try {
      const context = {
        sessionInfo: this.sessionInfo,
        recentMessages: this.conversationHistory.slice(-this.conversationWindowSize),
        messageCount: this.conversationHistory.length,
      };

      return new Response(JSON.stringify(context), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error getting context:', error);
      return new Response(JSON.stringify({ error: 'Failed to get context' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  private async handleSummarize(request: Request): Promise<Response> {
    try {
      // Return existing summary or key points from conversation
      if (this.conversationHistory.length < 5) {
        return new Response(
          JSON.stringify({
            summary: null,
            message: 'Conversation too short for summarization',
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      // Extract topics from conversation
      const topics = new Set<string>();
      this.conversationHistory.forEach((msg) => {
        if (msg.metadata?.topics) {
          msg.metadata.topics.forEach((topic) => topics.add(topic));
        }
      });

      // Simple summarization - extract key points
      const keyMessages = this.conversationHistory
        .filter((msg, index) => {
          // Keep first message, last few messages, and messages with questions
          return (
            index === 0 ||
            index >= this.conversationHistory.length - 3 ||
            msg.content.includes('?') ||
            (msg.role === 'assistant' && msg.content.length > 200)
          );
        })
        .slice(0, 10);

      const summary = {
        totalMessages: this.conversationHistory.length,
        keyPoints: keyMessages.map((msg) => ({
          role: msg.role,
          snippet: msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : ''),
        })),
        topics: Array.from(topics),
        startTime: this.sessionInfo?.startedAt,
        lastActivity: this.sessionInfo?.lastActivityAt,
        tokensUsed: this.sessionInfo?.totalTokensUsed || 0,
        learningStyle: this.sessionInfo?.learningStyle,
      };

      return new Response(JSON.stringify(summary), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error summarizing:', error);
      return new Response(JSON.stringify({ error: 'Failed to summarize' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  private async handleGenerateSummary(request: Request): Promise<Response> {
    try {
      if (!this.sessionInfo || this.conversationHistory.length < 5) {
        return new Response(
          JSON.stringify({
            error: 'Insufficient conversation data for summary generation',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      // Extract key topics from conversation
      const topics = new Set<string>();
      const learningPatterns = new Map<string, number>();

      this.conversationHistory.forEach((msg) => {
        if (msg.metadata?.topics) {
          msg.metadata.topics.forEach((topic) => topics.add(topic));
        }
        if (msg.metadata?.learningStyle) {
          const count = learningPatterns.get(msg.metadata.learningStyle) || 0;
          learningPatterns.set(msg.metadata.learningStyle, count + 1);
        }
      });

      // Determine dominant learning style
      let dominantStyle = this.sessionInfo.learningStyle;
      if (learningPatterns.size > 0) {
        dominantStyle = Array.from(learningPatterns.entries()).sort((a, b) => b[1] - a[1])[0][0];
      }

      // Create comprehensive summary
      const summary: ConversationSummary = {
        conversationId: this.sessionInfo.conversationId,
        summary: this.generateTextSummary(),
        keyTopics: Array.from(topics),
        totalMessages: this.conversationHistory.length,
        startTime: this.sessionInfo.startedAt,
        endTime: this.sessionInfo.lastActivityAt,
        learningStyleDetected: dominantStyle,
        tokensUsed: this.sessionInfo.totalTokensUsed,
      };

      // Store summary
      this.conversationSummaries.push(summary);
      await this.state.storage.put(`summary:${this.sessionInfo.conversationId}:${Date.now()}`, summary);

      // Update session info
      this.sessionInfo.summaryGenerated = true;
      this.sessionInfo.lastSummaryAt = new Date().toISOString();
      await this.state.storage.put(`session:${this.sessionInfo.conversationId}`, this.sessionInfo);

      return new Response(JSON.stringify(summary), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error generating summary:', error);
      return new Response(JSON.stringify({ error: 'Failed to generate summary' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  private generateTextSummary(): string {
    // Extract main topics and questions from conversation
    const questions = this.conversationHistory
      .filter((msg) => msg.role === 'user' && msg.content.includes('?'))
      .map((msg) => msg.content.substring(0, 100));

    const concepts = this.conversationHistory
      .filter((msg) => msg.role === 'assistant')
      .map((msg) => {
        // Extract key concepts (simplified - in production would use NLP)
        const words = msg.content.split(' ');
        return words.filter((word) => word.length > 7).slice(0, 3);
      })
      .flat();

    const uniqueConcepts = [...new Set(concepts)].slice(0, 5);

    return (
      `This conversation covered ${questions.length} questions focusing on: ${uniqueConcepts.join(', ')}. ` +
      `The discussion included ${this.conversationHistory.length} messages over ` +
      `${this.calculateDuration()} with a focus on ${this.sessionInfo?.topics?.join(', ') || 'general topics'}.`
    );
  }

  private calculateDuration(): string {
    if (!this.sessionInfo) return 'unknown duration';

    const start = new Date(this.sessionInfo.startedAt).getTime();
    const end = new Date(this.sessionInfo.lastActivityAt).getTime();
    const durationMs = end - start;

    if (durationMs < 60000) return `${Math.round(durationMs / 1000)} seconds`;
    if (durationMs < 3600000) return `${Math.round(durationMs / 60000)} minutes`;
    return `${Math.round(durationMs / 3600000)} hours`;
  }

  private async handleGetSummaries(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit') || '10');

      // Get stored summaries
      const summaryKeys = await this.state.storage.list({ prefix: 'summary:' });
      const summaries: ConversationSummary[] = [];

      for (const [key, value] of summaryKeys) {
        if (value && typeof value === 'object') {
          summaries.push(value as ConversationSummary);
        }
      }

      // Sort by end time (most recent first)
      summaries.sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());

      return new Response(
        JSON.stringify({
          summaries: summaries.slice(0, limit),
          total: summaries.length,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } catch (error) {
      console.error('Error getting summaries:', error);
      return new Response(JSON.stringify({ error: 'Failed to get summaries' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  private async handlePersistState(request: Request): Promise<Response> {
    try {
      if (!this.sessionInfo) {
        return new Response(JSON.stringify({ error: 'No active session' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const conversationId = this.sessionInfo.conversationId;

      // Persist conversation history
      await this.state.storage.put(`history:${conversationId}`, this.conversationHistory);

      // Persist session info
      await this.state.storage.put(`session:${conversationId}`, this.sessionInfo);

      // Persist summaries if any
      if (this.conversationSummaries.length > 0) {
        await this.state.storage.put(`summaries:${conversationId}`, this.conversationSummaries);
      }

      // Store state snapshot for recovery
      const stateSnapshot = {
        conversationId,
        timestamp: new Date().toISOString(),
        messageCount: this.conversationHistory.length,
        lastMessageId: this.conversationHistory[this.conversationHistory.length - 1]?.id,
      };

      await this.state.storage.put(`snapshot:${conversationId}`, stateSnapshot);

      return new Response(
        JSON.stringify({
          success: true,
          persisted: {
            messages: this.conversationHistory.length,
            summaries: this.conversationSummaries.length,
          },
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } catch (error) {
      console.error('Error persisting state:', error);
      return new Response(JSON.stringify({ error: 'Failed to persist state' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  private async handleRestoreState(request: Request): Promise<Response> {
    try {
      const body = (await request.json()) as RestoreStateRequestBody;
      const { conversationId } = body;

      // Restore session info
      const storedSession = await this.state.storage.get<ConversationSession>(`session:${conversationId}`);

      if (!storedSession) {
        return new Response(JSON.stringify({ error: 'Session not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      this.sessionInfo = storedSession;

      // Restore conversation history
      const storedHistory = await this.state.storage.get<ConversationMessage[]>(`history:${conversationId}`);
      this.conversationHistory = storedHistory || [];

      // Restore summaries
      const storedSummaries = await this.state.storage.get<ConversationSummary[]>(`summaries:${conversationId}`);
      this.conversationSummaries = storedSummaries || [];

      return new Response(
        JSON.stringify({
          success: true,
          restored: {
            messages: this.conversationHistory.length,
            summaries: this.conversationSummaries.length,
            sessionInfo: this.sessionInfo,
          },
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } catch (error) {
      console.error('Error restoring state:', error);
      return new Response(JSON.stringify({ error: 'Failed to restore state' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  private async handleCleanupOldData(request: Request): Promise<Response> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

      let deletedCount = 0;

      // List all stored items
      const allKeys = await this.state.storage.list();

      for (const [key, value] of allKeys) {
        if (value && typeof value === 'object') {
          const item = value as any;

          // Check if item has a timestamp and is older than retention period
          if (item.timestamp || item.lastActivityAt || item.endTime) {
            const itemDate = new Date(item.timestamp || item.lastActivityAt || item.endTime);

            if (itemDate < cutoffDate) {
              await this.state.storage.delete(key);
              deletedCount++;
            }
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          deletedItems: deletedCount,
          retentionDays: this.retentionDays,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } catch (error) {
      console.error('Error cleaning up old data:', error);
      return new Response(JSON.stringify({ error: 'Failed to cleanup old data' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  private async handleCheckRateLimit(request: Request): Promise<Response> {
    try {
      const body = (await request.json()) as CheckRateLimitRequestBody;
      const { userId, limit = 10, windowMs = 60000 } = body;

      if (!userId) {
        return new Response(JSON.stringify({ error: 'userId is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const now = Date.now();
      const rateLimitInfo = this.rateLimitMap.get(userId);

      if (!rateLimitInfo || now - rateLimitInfo.windowStart > windowMs) {
        // New window
        this.rateLimitMap.set(userId, {
          userId,
          messageCount: 1,
          windowStart: now,
        });

        return new Response(
          JSON.stringify({
            allowed: true,
            remaining: limit - 1,
            resetIn: windowMs,
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      // Check if within limit
      if (rateLimitInfo.messageCount >= limit) {
        const resetIn = windowMs - (now - rateLimitInfo.windowStart);
        return new Response(
          JSON.stringify({
            allowed: false,
            remaining: 0,
            resetIn,
            retryAfter: Math.ceil(resetIn / 1000),
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': Math.ceil(resetIn / 1000).toString(),
            },
          },
        );
      }

      // Increment counter
      rateLimitInfo.messageCount++;

      return new Response(
        JSON.stringify({
          allowed: true,
          remaining: limit - rateLimitInfo.messageCount,
          resetIn: windowMs - (now - rateLimitInfo.windowStart),
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } catch (error) {
      console.error('Error checking rate limit:', error);
      return new Response(JSON.stringify({ error: 'Failed to check rate limit' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
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

    webSocket.send(
      JSON.stringify({
        type: 'connected',
        sessionInfo,
        timestamp: new Date().toISOString(),
      }),
    );
  }

  private async handleWebSocketMessage(sender: WebSocket, message: any) {
    const senderInfo = this.sessions.get(sender);
    if (!senderInfo) return;

    // Handle different message types
    switch (message.type) {
      case 'chat':
        // Add message to history with metadata
        await this.handleAddMessage(
          new Request('https://do/add-message', {
            method: 'POST',
            body: JSON.stringify({
              role: 'user',
              content: message.content,
              timestamp: new Date().toISOString(),
              metadata: {
                learningStyle: message.learningStyle,
                topics: message.topics,
              },
            }),
          }),
        );
        break;

      case 'get-history':
        const history = this.conversationHistory.slice(-10);
        sender.send(
          JSON.stringify({
            type: 'history',
            messages: history,
          }),
        );
        break;

      case 'get-context':
        const context = {
          sessionInfo: this.sessionInfo,
          recentMessages: this.conversationHistory.slice(-this.conversationWindowSize),
          messageCount: this.conversationHistory.length,
        };
        sender.send(
          JSON.stringify({
            type: 'context',
            data: context,
          }),
        );
        break;

      case 'restore-state':
        if (message.conversationId) {
          await this.handleRestoreState(
            new Request('https://do/restore-state', {
              method: 'POST',
              body: JSON.stringify({ conversationId: message.conversationId }),
            }),
          );
          sender.send(
            JSON.stringify({
              type: 'state-restored',
              conversationId: message.conversationId,
              messageCount: this.conversationHistory.length,
            }),
          );
        }
        break;

      case 'persist-state':
        await this.handlePersistState(
          new Request('https://do/persist-state', {
            method: 'POST',
          }),
        );
        sender.send(
          JSON.stringify({
            type: 'state-persisted',
            messageCount: this.conversationHistory.length,
          }),
        );
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

  private sanitizeContent(content: string): string {
    // Use centralized sanitization utility
    return sanitizeInput(content).trim();
  }

  private handleStats(): Response {
    const stats = {
      activeSessions: this.sessions.size,
      conversationLength: this.conversationHistory.length,
      sessionInfo: this.sessionInfo,
      rateLimitEntries: this.rateLimitMap.size,
    };

    return new Response(JSON.stringify(stats), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Analyze conversation patterns for proactive suggestions
   */
  private async handleAnalyzePatterns(request: Request): Promise<Response> {
    try {
      if (!this.sessionInfo || this.conversationHistory.length < 3) {
        return new Response(
          JSON.stringify({
            patterns: [],
            message: 'Insufficient conversation data for pattern analysis',
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      const body = (await request.json()) as AnalyzePatternsRequestBody;
      const { includeContext = true } = body;

      // Prepare messages with timestamps and response times
      const messagesForAnalysis = this.conversationHistory.map((msg, index) => {
        const previousMsg = this.conversationHistory[index - 1];
        const responseTime = previousMsg ? new Date(msg.timestamp).getTime() - new Date(previousMsg.timestamp).getTime() : 0;

        return {
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
          responseTime: responseTime > 0 ? responseTime : undefined,
        };
      });

      // Extract context information
      const context = includeContext
        ? {
            pageType: this.sessionInfo.context?.pageType,
            topic: this.sessionInfo.topics?.[0],
            difficulty: this.sessionInfo.context?.difficulty || 0.5,
            userFocusScore: this.calculateUserFocusScore(),
            sessionDuration: this.calculateSessionDuration(),
          }
        : {};

      // Return data for analysis by the suggestion engine
      return new Response(
        JSON.stringify({
          conversationId: this.sessionInfo.conversationId,
          tenantId: this.sessionInfo.tenantId,
          learnerId: this.sessionInfo.userId,
          messages: messagesForAnalysis,
          context,
          sessionInfo: {
            messageCount: this.conversationHistory.length,
            totalTokensUsed: this.sessionInfo.totalTokensUsed,
            startedAt: this.sessionInfo.startedAt,
            lastActivityAt: this.sessionInfo.lastActivityAt,
          },
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } catch (error) {
      console.error('Error analyzing patterns:', error);
      return new Response(JSON.stringify({ error: 'Failed to analyze patterns' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  /**
   * Handle proactive suggestion requests
   */
  private async handleSuggestProactive(request: Request): Promise<Response> {
    try {
      const body = (await request.json()) as SuggestProactiveRequestBody;
      const { triggerContext, learnerProfile, preferences } = body;

      if (!this.sessionInfo) {
        return new Response(JSON.stringify({ error: 'No active session' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Store trigger context for suggestion orchestration
      const suggestionContext = {
        conversationId: this.sessionInfo.conversationId,
        tenantId: this.sessionInfo.tenantId,
        learnerId: this.sessionInfo.userId,
        triggeredAt: new Date().toISOString(),
        triggerContext,
        conversationState: {
          messageCount: this.conversationHistory.length,
          lastActivity: this.sessionInfo.lastActivityAt,
          topics: this.sessionInfo.topics || [],
          sessionDuration: this.calculateSessionDuration(),
        },
      };

      // Store in durable object state for persistence
      await this.state.storage.put(`suggestion_context:${this.sessionInfo.conversationId}:${Date.now()}`, suggestionContext);

      return new Response(
        JSON.stringify({
          success: true,
          suggestionContext,
          readyForProcessing: true,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } catch (error) {
      console.error('Error handling proactive suggestion:', error);
      return new Response(JSON.stringify({ error: 'Failed to handle suggestion request' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  /**
   * Update suggestion state (shown, dismissed, accepted)
   */
  private async handleUpdateSuggestionState(request: Request): Promise<Response> {
    try {
      const body = (await request.json()) as UpdateSuggestionStateRequestBody;
      const { suggestionId, state, feedback, timestamp } = body;

      if (!suggestionId || !state) {
        return new Response(JSON.stringify({ error: 'Missing suggestionId or state' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Store suggestion state update
      const stateUpdate = {
        suggestionId,
        state,
        feedback,
        timestamp: timestamp || new Date().toISOString(),
        conversationId: this.sessionInfo?.conversationId,
        contextAtTime: {
          messageCount: this.conversationHistory.length,
          lastMessage: this.conversationHistory[this.conversationHistory.length - 1]?.content?.substring(0, 100),
          sessionDuration: this.calculateSessionDuration(),
        },
      };

      await this.state.storage.put(`suggestion_state:${suggestionId}`, stateUpdate);

      // Broadcast to connected clients
      this.broadcastMessage({
        type: 'suggestion-state-updated',
        suggestionId,
        state,
        feedback,
      });

      return new Response(
        JSON.stringify({
          success: true,
          updated: stateUpdate,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } catch (error) {
      console.error('Error updating suggestion state:', error);
      return new Response(JSON.stringify({ error: 'Failed to update suggestion state' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  /**
   * Calculate user focus score based on recent activity
   */
  private calculateUserFocusScore(): number {
    if (this.conversationHistory.length < 3) return 0.5;

    const recentMessages = this.conversationHistory.slice(-5);
    const userMessages = recentMessages.filter((m) => m.role === 'user');

    if (userMessages.length === 0) return 0.3;

    // Calculate focus based on message quality and consistency
    let focusScore = 0;

    // Message length consistency (focused users have consistent message lengths)
    const avgLength = userMessages.reduce((sum, m) => sum + m.content.length, 0) / userMessages.length;
    const lengthVariance = userMessages.reduce((sum, m) => sum + Math.pow(m.content.length - avgLength, 2), 0) / userMessages.length;
    const lengthConsistency = Math.max(0, 1 - lengthVariance / (avgLength * avgLength));
    focusScore += lengthConsistency * 0.3;

    // Response time consistency (focused users respond at consistent intervals)
    if (userMessages.length >= 2) {
      const responseTimes: number[] = [];
      for (let i = 1; i < userMessages.length; i++) {
        const prevTime = new Date(userMessages[i - 1].timestamp).getTime();
        const currTime = new Date(userMessages[i].timestamp).getTime();
        responseTimes.push(currTime - prevTime);
      }

      const avgResponseTime = responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length;
      const timeVariance = responseTimes.reduce((sum, t) => sum + Math.pow(t - avgResponseTime, 2), 0) / responseTimes.length;
      const timeConsistency = Math.max(0, 1 - timeVariance / (avgResponseTime * avgResponseTime));
      focusScore += timeConsistency * 0.3;
    }

    // Message quality (focused users ask detailed questions)
    const questionCount = userMessages.filter((m) => m.content.includes('?')).length;
    const questionRatio = questionCount / userMessages.length;
    focusScore += Math.min(questionRatio * 2, 1) * 0.2;

    // Topic consistency (focused users stay on topic)
    const topics = new Set<string>();
    userMessages.forEach((m) => {
      if (m.metadata?.topics) {
        m.metadata.topics.forEach((t) => topics.add(t));
      }
    });
    const topicConsistency = topics.size <= 2 ? 1 : Math.max(0, 1 - (topics.size - 2) * 0.2);
    focusScore += topicConsistency * 0.2;

    return Math.min(Math.max(focusScore, 0), 1);
  }

  /**
   * Calculate session duration in minutes
   */
  private calculateSessionDuration(): number {
    if (!this.sessionInfo) return 0;

    const start = new Date(this.sessionInfo.startedAt).getTime();
    const end = new Date(this.sessionInfo.lastActivityAt).getTime();
    return Math.round((end - start) / (1000 * 60));
  }

  private async handleReset(): Promise<Response> {
    // Clear conversation history
    this.conversationHistory = [];
    this.rateLimitMap.clear();

    if (this.sessionInfo) {
      const conversationId = this.sessionInfo.conversationId;
      await this.state.storage.delete(`history:${conversationId}`);
      await this.state.storage.delete(`session:${conversationId}`);

      // Clean up suggestion-related data
      const suggestionKeys = await this.state.storage.list({ prefix: `suggestion_context:${conversationId}` });
      for (const [key] of suggestionKeys) {
        await this.state.storage.delete(key);
      }

      const stateKeys = await this.state.storage.list({ prefix: 'suggestion_state:' });
      for (const [key] of stateKeys) {
        await this.state.storage.delete(key);
      }

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
