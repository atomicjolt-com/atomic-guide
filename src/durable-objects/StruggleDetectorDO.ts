/**
 * StruggleDetectorDO - Durable Object for real-time struggle detection
 * Tracks learner behavior patterns and triggers interventions
 * Story 1.1 Requirement: Struggle detection Durable Object
 */

import type { DurableObjectState, DurableObjectStorage } from '@cloudflare/workers-types';

export interface StruggleSignal {
  type: 'hover_confusion' | 'rapid_scrolling' | 'idle_timeout' | 'repeated_access' | 'help_seeking';
  timestamp: number;
  confidence: number;
  duration?: number;
  element?: string;
  context?: string;
}

export interface LearnerSession {
  sessionId: string;
  learnerId: string;
  tenantId: string;
  startTime: number;
  signals: StruggleSignal[];
  struggleScore: number;
  interventionTriggered: boolean;
}

export class StruggleDetectorDO {
  private state: DurableObjectState;
  private storage: DurableObjectStorage;
  private sessions: Map<string, LearnerSession>;

  // Struggle detection thresholds
  private readonly HOVER_CONFUSION_THRESHOLD = 5000; // 5 seconds
  private readonly RAPID_SCROLL_THRESHOLD = 3; // 3 rapid scrolls
  private readonly IDLE_TIMEOUT = 120000; // 2 minutes
  private readonly STRUGGLE_SCORE_THRESHOLD = 0.7;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.storage = state.storage;
    this.sessions = new Map();

    // Initialize alarm for periodic cleanup
    this.state.blockConcurrencyWhile(async() => {
      const currentAlarm = await this.storage.getAlarm();
      if (!currentAlarm) {
        await this.storage.setAlarm(Date.now() + 300000); // 5 minutes
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    try {
      switch (url.pathname) {
        case '/signal':
          if (method === 'POST') {
            return await this.handleSignal(request);
          }
          break;

        case '/session/start':
          if (method === 'POST') {
            return await this.startSession(request);
          }
          break;

        case '/session/end':
          if (method === 'POST') {
            return await this.endSession(request);
          }
          break;

        case '/session/status':
          if (method === 'GET') {
            return await this.getSessionStatus(request);
          }
          break;

        case '/analytics':
          if (method === 'GET') {
            return await this.getAnalytics(request);
          }
          break;

        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      console.error('StruggleDetectorDO error:', error);
      return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method not allowed', { status: 405 });
  }

  /**
   * Start a new struggle detection session
   */
  private async startSession(request: Request): Promise<Response> {
    const data = await request.json<{
      sessionId: string;
      learnerId: string;
      tenantId: string;
    }>();

    const session: LearnerSession = {
      sessionId: data.sessionId,
      learnerId: data.learnerId,
      tenantId: data.tenantId,
      startTime: Date.now(),
      signals: [],
      struggleScore: 0,
      interventionTriggered: false,
    };

    this.sessions.set(data.sessionId, session);
    await this.storage.put(`session:${data.sessionId}`, session);

    return new Response(JSON.stringify({ success: true, sessionId: data.sessionId }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Handle incoming struggle signal
   */
  private async handleSignal(request: Request): Promise<Response> {
    const data = await request.json<{
      sessionId: string;
      signal: StruggleSignal;
    }>();

    const session = this.sessions.get(data.sessionId);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Add signal to session
    session.signals.push(data.signal);

    // Calculate struggle score
    const struggleScore = this.calculateStruggleScore(session);
    session.struggleScore = struggleScore;

    // Check if intervention should be triggered
    let interventionType: string | null = null;
    if (struggleScore > this.STRUGGLE_SCORE_THRESHOLD && !session.interventionTriggered) {
      interventionType = this.determineInterventionType(session);
      session.interventionTriggered = true;
    }

    // Update storage
    await this.storage.put(`session:${data.sessionId}`, session);

    return new Response(
      JSON.stringify({
        success: true,
        struggleScore,
        interventionTriggered: session.interventionTriggered,
        interventionType,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  /**
   * Calculate struggle score based on signals
   */
  private calculateStruggleScore(session: LearnerSession): number {
    if (session.signals.length === 0) return 0;

    let score = 0;
    const weights = {
      hover_confusion: 0.3,
      rapid_scrolling: 0.2,
      idle_timeout: 0.4,
      repeated_access: 0.25,
      help_seeking: 0.15,
    };

    // Count signals by type
    const signalCounts = session.signals.reduce(
      (acc, signal) => {
        acc[signal.type] = (acc[signal.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Calculate weighted score
    for (const [type, weight] of Object.entries(weights)) {
      const count = signalCounts[type] || 0;
      // Normalize count (max 5 occurrences considered)
      const normalizedCount = Math.min(count / 5, 1);
      score += normalizedCount * weight;
    }

    // Consider recency of signals (recent signals have more weight)
    const now = Date.now();
    const recentSignals = session.signals.filter(
      (s) => now - s.timestamp < 60000, // Last minute
    );

    if (recentSignals.length > 3) {
      score = Math.min(score * 1.2, 1); // Boost score for recent activity
    }

    return Math.min(score, 1); // Cap at 1
  }

  /**
   * Determine appropriate intervention type
   */
  private determineInterventionType(session: LearnerSession): string {
    const recentSignals = session.signals.slice(-5);

    // Check most common recent signal type
    const signalTypes = recentSignals.map((s) => s.type);
    const mostCommon = this.getMostCommonElement(signalTypes);

    switch (mostCommon) {
      case 'hover_confusion':
        return 'tooltip_help';
      case 'rapid_scrolling':
        return 'content_summary';
      case 'idle_timeout':
        return 'proactive_chat';
      case 'repeated_access':
        return 'resource_suggestion';
      case 'help_seeking':
        return 'instructor_notification';
      default:
        return 'proactive_chat';
    }
  }

  /**
   * Get most common element in array
   */
  private getMostCommonElement<T>(arr: T[]): T | undefined {
    const counts = new Map<T, number>();
    let maxCount = 0;
    let mostCommon: T | undefined;

    for (const item of arr) {
      const count = (counts.get(item) || 0) + 1;
      counts.set(item, count);

      if (count > maxCount) {
        maxCount = count;
        mostCommon = item;
      }
    }

    return mostCommon;
  }

  /**
   * End a struggle detection session
   */
  private async endSession(request: Request): Promise<Response> {
    const data = await request.json<{ sessionId: string }>();

    const session = this.sessions.get(data.sessionId);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Archive session data
    await this.storage.put(`archive:${data.sessionId}`, {
      ...session,
      endTime: Date.now(),
    });

    // Clean up active session
    this.sessions.delete(data.sessionId);
    await this.storage.delete(`session:${data.sessionId}`);

    return new Response(
      JSON.stringify({
        success: true,
        finalScore: session.struggleScore,
        totalSignals: session.signals.length,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  /**
   * Get current session status
   */
  private async getSessionStatus(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'sessionId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        sessionId: session.sessionId,
        duration: Date.now() - session.startTime,
        signalCount: session.signals.length,
        struggleScore: session.struggleScore,
        interventionTriggered: session.interventionTriggered,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  /**
   * Get analytics for tenant
   */
  private async getAnalytics(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const tenantId = url.searchParams.get('tenantId');

    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'tenantId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Calculate analytics for active sessions
    const tenantSessions = Array.from(this.sessions.values()).filter((s) => s.tenantId === tenantId);

    const analytics = {
      activeSessions: tenantSessions.length,
      averageStruggleScore: tenantSessions.reduce((sum, s) => sum + s.struggleScore, 0) / (tenantSessions.length || 1),
      interventionsTriggered: tenantSessions.filter((s) => s.interventionTriggered).length,
      totalSignals: tenantSessions.reduce((sum, s) => sum + s.signals.length, 0),
    };

    return new Response(JSON.stringify(analytics), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Alarm handler for periodic cleanup
   */
  async alarm(): Promise<void> {
    // Clean up old sessions (older than 1 hour)
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    for (const [sessionId, session] of this.sessions) {
      if (session.startTime < oneHourAgo) {
        // Archive before deletion
        await this.storage.put(`archive:${sessionId}`, {
          ...session,
          endTime: now,
          reason: 'timeout',
        });

        this.sessions.delete(sessionId);
        await this.storage.delete(`session:${sessionId}`);
      }
    }

    // Schedule next cleanup
    await this.storage.setAlarm(now + 300000); // 5 minutes
  }
}
