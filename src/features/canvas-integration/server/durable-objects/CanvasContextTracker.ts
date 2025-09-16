/**
 * @fileoverview Canvas Context Tracker Durable Object
 * @module features/canvas-integration/server/durable-objects/CanvasContextTracker
 *
 * Manages real-time Canvas page context tracking per student session using
 * Cloudflare Durable Objects for consistent state management across requests.
 * Handles context persistence, multi-tab support, and session expiration.
 */

import {
  CanvasContextState,
  CanvasContextStateSchema,
  CanvasContentReference,
  CanvasContentReferenceSchema
} from '../../shared/types';

/**
 * Navigation history entry
 */
interface NavigationEntry {
  contentId: string;
  timestamp: Date;
  duration: number;
  pageType?: string;
  url?: string;
}

/**
 * Context update event
 */
interface ContextUpdateEvent {
  type: 'navigation' | 'content_change' | 'assessment_start' | 'assessment_end' | 'session_end';
  sessionId: string;
  studentId: string;
  contentId?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Canvas Context Tracker Durable Object
 *
 * Provides real-time Canvas page context tracking with the following features:
 * - Session-based state management
 * - Multi-tab context tracking
 * - Navigation history with duration tracking
 * - Active assessment management
 * - Automatic session cleanup and expiration
 * - WebSocket broadcasting for real-time updates
 */
export class CanvasContextTracker implements DurableObject {
  private state: DurableObjectState;
  private env: any;
  private sessions: Map<string, WebSocket[]> = new Map();
  private contextStates: Map<string, CanvasContextState> = new Map();

  // Configuration constants
  private readonly SESSION_TIMEOUT_MS = 3600000; // 1 hour
  private readonly MAX_NAVIGATION_HISTORY = 50;
  private readonly CONTEXT_SYNC_INTERVAL = 30000; // 30 seconds
  private readonly MAX_SESSIONS_PER_STUDENT = 5;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;

    // Start periodic context synchronization
    this.state.setAlarm(Date.now() + this.CONTEXT_SYNC_INTERVAL);
  }

  /**
   * Handle HTTP requests to the Durable Object
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (request.method) {
        case 'GET':
          if (path === '/context') {
            return await this.handleGetContext(request);
          } else if (path === '/sessions') {
            return await this.handleGetSessions(request);
          }
          break;

        case 'POST':
          if (path === '/update') {
            return await this.handleUpdateContext(request);
          } else if (path === '/navigation') {
            return await this.handleNavigationEvent(request);
          } else if (path === '/assessment') {
            return await this.handleAssessmentEvent(request);
          }
          break;

        case 'DELETE':
          if (path === '/session') {
            return await this.handleEndSession(request);
          }
          break;

        default:
          // Handle WebSocket upgrade
          if (request.headers.get('Upgrade') === 'websocket') {
            return await this.handleWebSocketUpgrade(request);
          }
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('CanvasContextTracker error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  /**
   * Handle WebSocket upgrade for real-time context updates
   */
  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      return new Response('Missing sessionId parameter', { status: 400 });
    }

    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected websocket upgrade', { status: 400 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Accept the WebSocket connection
    server.accept();

    // Add to session tracking
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, []);
    }
    this.sessions.get(sessionId)!.push(server);

    // Handle WebSocket messages
    server.addEventListener('message', (event) => {
      this.handleWebSocketMessage(sessionId, event.data);
    });

    server.addEventListener('close', () => {
      this.removeWebSocketFromSession(sessionId, server);
    });

    // Send initial context state
    const contextState = await this.getContextState(sessionId);
    if (contextState) {
      server.send(JSON.stringify({
        type: 'context_state',
        data: contextState
      }));
    }

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * Handle WebSocket messages
   */
  private async handleWebSocketMessage(sessionId: string, data: string): Promise<void> {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'heartbeat':
          await this.updateSessionActivity(sessionId);
          break;
        case 'context_request':
          const contextState = await this.getContextState(sessionId);
          this.broadcastToSession(sessionId, {
            type: 'context_state',
            data: contextState
          });
          break;
        default:
          console.warn('Unknown WebSocket message type:', message.type);
      }
    } catch (error) {
      console.error('WebSocket message handling error:', error);
    }
  }

  /**
   * Get context state for a session
   */
  private async handleGetContext(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      return new Response('Missing sessionId parameter', { status: 400 });
    }

    const contextState = await this.getContextState(sessionId);

    if (!contextState) {
      return new Response('Context not found', { status: 404 });
    }

    return new Response(JSON.stringify(contextState), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Get all active sessions
   */
  private async handleGetSessions(request: Request): Promise<Response> {
    const sessions = Array.from(this.contextStates.keys());
    return new Response(JSON.stringify({ sessions }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Handle context update
   */
  private async handleUpdateContext(request: Request): Promise<Response> {
    const updateData = await request.json();
    const { sessionId, studentId, currentContent } = updateData;

    if (!sessionId || !studentId) {
      return new Response('Missing required parameters', { status: 400 });
    }

    await this.updateContext(sessionId, studentId, currentContent);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Handle navigation event
   */
  private async handleNavigationEvent(request: Request): Promise<Response> {
    const eventData = await request.json();
    const { sessionId, contentId, pageType, url, previousContentId } = eventData;

    if (!sessionId || !contentId) {
      return new Response('Missing required parameters', { status: 400 });
    }

    await this.recordNavigation(sessionId, contentId, pageType, url, previousContentId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Handle assessment event
   */
  private async handleAssessmentEvent(request: Request): Promise<Response> {
    const eventData = await request.json();
    const { sessionId, assessmentId, action } = eventData;

    if (!sessionId || !assessmentId || !action) {
      return new Response('Missing required parameters', { status: 400 });
    }

    await this.updateAssessmentState(sessionId, assessmentId, action);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Handle session end
   */
  private async handleEndSession(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      return new Response('Missing sessionId parameter', { status: 400 });
    }

    await this.endSession(sessionId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Get context state from storage or memory
   */
  private async getContextState(sessionId: string): Promise<CanvasContextState | null> {
    // Check memory first
    let contextState = this.contextStates.get(sessionId);

    if (!contextState) {
      // Load from durable storage
      const stored = await this.state.storage.get(`context:${sessionId}`);
      if (stored) {
        contextState = CanvasContextStateSchema.parse(stored);
        this.contextStates.set(sessionId, contextState);
      }
    }

    return contextState || null;
  }

  /**
   * Update context state
   */
  private async updateContext(
    sessionId: string,
    studentId: string,
    currentContent?: CanvasContentReference
  ): Promise<void> {
    let contextState = await this.getContextState(sessionId);

    if (!contextState) {
      // Create new context state
      contextState = {
        id: crypto.randomUUID(),
        sessionId,
        studentId,
        currentContent,
        navigationHistory: [],
        activeAssessments: [],
        lastUpdated: new Date()
      };
    } else {
      // Update existing context
      contextState.currentContent = currentContent;
      contextState.lastUpdated = new Date();
    }

    // Validate the context state
    const validatedState = CanvasContextStateSchema.parse(contextState);

    // Store in memory and durable storage
    this.contextStates.set(sessionId, validatedState);
    await this.state.storage.put(`context:${sessionId}`, validatedState);

    // Update session activity
    await this.updateSessionActivity(sessionId);

    // Broadcast update to connected clients
    this.broadcastToSession(sessionId, {
      type: 'context_updated',
      data: validatedState
    });
  }

  /**
   * Record navigation event
   */
  private async recordNavigation(
    sessionId: string,
    contentId: string,
    pageType?: string,
    url?: string,
    previousContentId?: string
  ): Promise<void> {
    const contextState = await this.getContextState(sessionId);
    if (!contextState) return;

    // Calculate duration on previous page
    let duration = 0;
    if (previousContentId && contextState.navigationHistory.length > 0) {
      const lastEntry = contextState.navigationHistory[contextState.navigationHistory.length - 1];
      if (lastEntry.contentId === previousContentId) {
        duration = Date.now() - lastEntry.timestamp.getTime();
      }
    }

    // Add new navigation entry
    const navigationEntry: NavigationEntry = {
      contentId,
      timestamp: new Date(),
      duration,
      pageType,
      url
    };

    contextState.navigationHistory.push(navigationEntry);

    // Limit navigation history size
    if (contextState.navigationHistory.length > this.MAX_NAVIGATION_HISTORY) {
      contextState.navigationHistory = contextState.navigationHistory.slice(-this.MAX_NAVIGATION_HISTORY);
    }

    contextState.lastUpdated = new Date();

    // Save updated state
    this.contextStates.set(sessionId, contextState);
    await this.state.storage.put(`context:${sessionId}`, contextState);

    // Broadcast navigation event
    this.broadcastToSession(sessionId, {
      type: 'navigation_event',
      data: { contentId, pageType, timestamp: navigationEntry.timestamp }
    });
  }

  /**
   * Update assessment state
   */
  private async updateAssessmentState(
    sessionId: string,
    assessmentId: string,
    action: 'start' | 'end' | 'pause' | 'resume'
  ): Promise<void> {
    const contextState = await this.getContextState(sessionId);
    if (!contextState) return;

    switch (action) {
      case 'start':
        if (!contextState.activeAssessments.includes(assessmentId)) {
          contextState.activeAssessments.push(assessmentId);
        }
        break;
      case 'end':
        contextState.activeAssessments = contextState.activeAssessments.filter(
          id => id !== assessmentId
        );
        break;
      // 'pause' and 'resume' don't modify the active assessments array
    }

    contextState.lastUpdated = new Date();

    // Save updated state
    this.contextStates.set(sessionId, contextState);
    await this.state.storage.put(`context:${sessionId}`, contextState);

    // Broadcast assessment event
    this.broadcastToSession(sessionId, {
      type: 'assessment_event',
      data: { assessmentId, action, timestamp: new Date() }
    });
  }

  /**
   * Update session activity timestamp
   */
  private async updateSessionActivity(sessionId: string): Promise<void> {
    await this.state.storage.put(`activity:${sessionId}`, Date.now());
  }

  /**
   * End session and cleanup
   */
  private async endSession(sessionId: string): Promise<void> {
    // Remove from memory
    this.contextStates.delete(sessionId);

    // Close WebSocket connections
    const sockets = this.sessions.get(sessionId);
    if (sockets) {
      sockets.forEach(socket => {
        try {
          socket.close();
        } catch (error) {
          // Ignore close errors
        }
      });
      this.sessions.delete(sessionId);
    }

    // Remove from durable storage
    await this.state.storage.delete(`context:${sessionId}`);
    await this.state.storage.delete(`activity:${sessionId}`);
  }

  /**
   * Broadcast message to all WebSockets in a session
   */
  private broadcastToSession(sessionId: string, message: any): void {
    const sockets = this.sessions.get(sessionId);
    if (!sockets) return;

    const messageString = JSON.stringify(message);

    // Send to all connected WebSockets
    sockets.forEach(socket => {
      try {
        socket.send(messageString);
      } catch (error) {
        // Remove failed WebSocket
        this.removeWebSocketFromSession(sessionId, socket);
      }
    });
  }

  /**
   * Remove WebSocket from session tracking
   */
  private removeWebSocketFromSession(sessionId: string, socket: WebSocket): void {
    const sockets = this.sessions.get(sessionId);
    if (sockets) {
      const index = sockets.indexOf(socket);
      if (index !== -1) {
        sockets.splice(index, 1);
      }

      // Clean up empty session
      if (sockets.length === 0) {
        this.sessions.delete(sessionId);
      }
    }
  }

  /**
   * Handle alarm for periodic maintenance
   */
  async alarm(): Promise<void> {
    try {
      // Clean up expired sessions
      await this.cleanupExpiredSessions();

      // Sync context states to database (if needed)
      await this.syncContextStatestoDatabase();

      // Schedule next alarm
      this.state.setAlarm(Date.now() + this.CONTEXT_SYNC_INTERVAL);
    } catch (error) {
      console.error('Context tracker alarm error:', error);
      // Still schedule next alarm even if this one failed
      this.state.setAlarm(Date.now() + this.CONTEXT_SYNC_INTERVAL);
    }
  }

  /**
   * Clean up expired sessions
   */
  private async cleanupExpiredSessions(): Promise<void> {
    const now = Date.now();
    const allKeys = await this.state.storage.list();

    for (const key of allKeys.keys()) {
      if (key.startsWith('activity:')) {
        const sessionId = key.substring(9); // Remove 'activity:' prefix
        const lastActivity = allKeys.get(key) as number;

        // Check if session has expired
        if (now - lastActivity > this.SESSION_TIMEOUT_MS) {
          console.log(`Cleaning up expired session: ${sessionId}`);
          await this.endSession(sessionId);
        }
      }
    }
  }

  /**
   * Sync context states to external database
   */
  private async syncContextStatestoDatabase(): Promise<void> {
    // In a full implementation, this would sync important context states
    // to the main database for persistence across Durable Object restarts
    // For now, we'll just log the sync operation
    const activeSessionCount = this.contextStates.size;
    console.log(`Context sync: ${activeSessionCount} active sessions`);
  }
}