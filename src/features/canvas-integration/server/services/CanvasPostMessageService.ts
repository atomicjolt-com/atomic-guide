/**
 * @fileoverview Canvas PostMessage Integration Service
 * @module features/canvas-integration/server/services/CanvasPostMessageService
 * 
 * Provides secure cross-origin communication with Canvas LMS for behavioral
 * signal collection and content extraction. Implements comprehensive security
 * validation, rate limiting, and performance monitoring.
 * 
 * Security Features:
 * - Origin whitelist validation
 * - HMAC signature verification
 * - Nonce-based replay attack prevention
 * - Rate limiting per session/origin
 * - Input sanitization and validation
 * 
 * Performance Requirements:
 * - <100ms signal processing latency P95
 * - >99% message delivery success rate
 * - Graceful degradation for API limitations
 */

import { DatabaseService } from '@shared/server/services';
import { PrivacyControlService } from '@features/learner-dna/server/services/PrivacyControlService';
import {
  BehavioralSignal,
  BehavioralSignalSchema,
  CanvasMessage,
  CanvasMessageSchema,
  CanvasPageContent,
  CanvasPageContentSchema,
  CanvasOrigin,
  SecurityValidationResult,
  CanvasIntegrationResult,
  CanvasIntegrationMetrics,
  SecurityValidationError,
  ContentExtractionError
} from '../../shared/types';

/**
 * Rate limiting configuration per session
 */
interface RateLimitConfig {
  maxSignalsPerMinute: number;
  maxSignalsPerHour: number;
  burstLimit: number;
  windowSizeMs: number;
}

/**
 * Session state for rate limiting and nonce tracking
 */
interface SessionState {
  sessionId: string;
  signalCounts: { timestamp: number; count: number }[];
  usedNonces: Set<string>;
  lastCleanup: number;
}

/**
 * Canvas PostMessage Integration Service
 * 
 * Handles secure bidirectional communication between Canvas LMS and 
 * Atomic Guide for behavioral signal collection and proactive interventions.
 */
export class CanvasPostMessageService {
  private db: DatabaseService;
  private privacyService: PrivacyControlService;
  private metrics: CanvasIntegrationMetrics;
  private sessionStates: Map<string, SessionState>;
  private hmacSecret: string;

  // Security configuration
  private readonly TRUSTED_ORIGINS = [
    'https://canvas.instructure.com',
    'https://atomicjolt.instructure.com', 
    'https://community.canvaslms.com'
  ];

  private readonly ORIGIN_REGEX = /^https:\/\/[\w.-]+\.instructure\.com$/;

  // Rate limiting configuration
  private readonly RATE_LIMIT_CONFIG: RateLimitConfig = {
    maxSignalsPerMinute: 60,
    maxSignalsPerHour: 1800,
    burstLimit: 10,
    windowSizeMs: 60000 // 1 minute
  };

  // Performance targets
  private readonly SIGNAL_PROCESSING_TIMEOUT_MS = 5000;
  private readonly CONTENT_EXTRACTION_TIMEOUT_MS = 10000;
  private readonly MAX_NONCE_AGE_MS = 300000; // 5 minutes

  constructor(
    db: DatabaseService,
    privacyService: PrivacyControlService,
    hmacSecret: string
  ) {
    this.db = db;
    this.privacyService = privacyService;
    this.hmacSecret = hmacSecret;
    this.sessionStates = new Map();
    this.metrics = {
      signalProcessingLatency: [],
      contentExtractionLatency: [],
      originValidationSuccess: 0,
      signatureValidationSuccess: 0,
      rateLimitBlocked: 0,
      totalSignalsProcessed: 0,
      errorCounts: {}
    };

    // Periodic cleanup of session states
    setInterval(() => this.cleanupSessionStates(), 300000); // Every 5 minutes
  }

  /**
   * Processes incoming behavioral signals from Canvas monitoring script
   * 
   * @param rawMessage - Raw postMessage data from Canvas
   * @param tenantId - Tenant identifier
   * @param userId - User identifier
   * @returns Processing result with performance metrics
   */
  async processBehavioralSignal(
    rawMessage: unknown,
    tenantId: string,
    userId: string
  ): Promise<CanvasIntegrationResult> {
    const startTime = Date.now();

    try {
      // Parse and validate message structure
      const message = CanvasMessageSchema.parse(rawMessage);
      
      // Security validation
      const securityResult = await this.validateMessageSecurity(message);
      if (!securityResult.valid) {
        this.recordError('SECURITY_VALIDATION_FAILED');
        return {
          success: false,
          errors: securityResult.errors,
          performance: {
            processingTimeMs: Date.now() - startTime,
            signalsProcessed: 0
          }
        };
      }

      // Privacy consent validation
      const hasConsent = await this.privacyService.validateDataCollectionPermission(
        tenantId,
        userId,
        'behavioral_timing'
      );

      if (!hasConsent) {
        this.recordError('PRIVACY_CONSENT_REQUIRED');
        return {
          success: false,
          message: 'Behavioral signal processing requires user consent',
          performance: {
            processingTimeMs: Date.now() - startTime,
            signalsProcessed: 0
          }
        };
      }

      // Rate limiting check
      if (!this.checkRateLimit(message.sessionId)) {
        this.metrics.rateLimitBlocked++;
        this.recordError('RATE_LIMIT_EXCEEDED');
        return {
          success: false,
          message: 'Rate limit exceeded for session',
          performance: {
            processingTimeMs: Date.now() - startTime,
            signalsProcessed: 0
          }
        };
      }

      // Process behavioral signals based on message type
      let processedCount = 0;
      
      switch (message.type) {
        case 'behavioral_signal':
          processedCount = await this.processBehavioralSignalPayload(
            message.payload,
            tenantId,
            userId,
            message.sessionId
          );
          break;
          
        case 'content_extraction':
          await this.processContentExtraction(
            message.payload,
            tenantId,
            userId,
            message.sessionId
          );
          break;
          
        case 'page_context_update':
          await this.processPageContextUpdate(
            message.payload,
            tenantId,
            userId,
            message.sessionId
          );
          break;
          
        default:
          throw new Error(`Unsupported message type: ${message.type}`);
      }

      // Record successful processing
      this.metrics.totalSignalsProcessed += processedCount;
      const _processingTime = Date.now() - startTime;
      this.metrics.signalProcessingLatency.push(_processingTime);

      // Performance monitoring
      if (_processingTime > this.SIGNAL_PROCESSING_TIMEOUT_MS) {
        console.warn(`Signal processing exceeded target: ${_processingTime}ms`);
      }

      return {
        success: true,
        message: `Successfully processed ${processedCount} signals`,
        performance: {
          processingTimeMs: processingTime,
          signalsProcessed: processedCount
        }
      };

    } catch (error) {
      const _processingTime = Date.now() - startTime;
      console.error('Behavioral signal processing failed:', error);
      
      this.recordError(error instanceof Error ? error.constructor.name : 'UNKNOWN_ERROR');
      
      return {
        success: false,
        message: 'Signal processing failed',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        performance: {
          processingTimeMs: processingTime,
          signalsProcessed: 0
        }
      };
    }
  }

  /**
   * Extracts content from Canvas page using API or DOM fallback
   * 
   * @param pageUrl - Canvas page URL
   * @param tenantId - Tenant identifier
   * @param sessionId - Session identifier
   * @returns Extracted page content
   */
  async extractCanvasPageContent(
    pageUrl: string,
    tenantId: string,
    sessionId: string
  ): Promise<CanvasPageContent> {
    const startTime = Date.now();

    try {
      // Validate URL origin
      const url = new URL(pageUrl);
      const origin = `${url.protocol}//${url.hostname}`;
      
      if (!this.isValidOrigin(origin)) {
        throw new ContentExtractionError(
          'Invalid Canvas origin for content extraction',
          { origin, url: pageUrl }
        );
      }

      // Attempt Canvas API extraction first
      let content: CanvasPageContent | null = null;
      
      try {
        content = await this.extractViaCanvasAPI(pageUrl, tenantId);
      } catch (apiError) {
        console.warn('Canvas API extraction failed, falling back to DOM:', apiError);
        // Fallback to DOM extraction will be implemented in client-side script
      }

      // If API extraction failed, return minimal fallback content
      if (!content) {
        content = this.createFallbackContent(pageUrl);
      }

      const _processingTime = Date.now() - startTime;
      this.metrics.contentExtractionLatency.push(_processingTime);

      // Store extracted content for struggle detection
      await this.storeExtractedContent(content, tenantId, sessionId);

      return content;

    } catch (error) {
      const _processingTime = Date.now() - startTime;
      console.error('Content extraction failed:', error);
      
      this.recordError(error instanceof Error ? error.constructor.name : 'CONTENT_EXTRACTION_ERROR');
      
      // Return minimal fallback to prevent system failure
      return this.createFallbackContent(pageUrl);
    }
  }

  /**
   * Sends proactive intervention message to Canvas iframe
   * 
   * @param interventionMessage - Message to send
   * @param targetOrigin - Canvas origin to send to
   * @param sessionId - Session identifier
   * @returns Success result
   */
  async sendProactiveIntervention(
    interventionMessage: any,
    targetOrigin: CanvasOrigin,
    sessionId: string
  ): Promise<CanvasIntegrationResult> {
    const startTime = Date.now();

    try {
      // Validate target origin
      if (!this.isValidOrigin(targetOrigin)) {
        throw new SecurityValidationError(
          'Invalid target origin for intervention',
          { origin: targetOrigin }
        );
      }

      // Create secure message envelope
      const secureMessage = await this.createSecureMessage(
        'struggle_intervention',
        interventionMessage,
        sessionId,
        targetOrigin
      );

      // TODO: Implement actual postMessage sending to Canvas
      // This would be handled by client-side JavaScript in the Canvas monitoring script
      console.log('Intervention message prepared for sending:', {
        type: secureMessage.type,
        sessionId: secureMessage.sessionId,
        timestamp: secureMessage.timestamp
      });

      return {
        success: true,
        message: 'Intervention message prepared for delivery',
        performance: {
          processingTimeMs: Date.now() - startTime,
          signalsProcessed: 0
        }
      };

    } catch (error) {
      console.error('Failed to send proactive intervention:', error);
      
      return {
        success: false,
        message: 'Failed to prepare intervention message',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        performance: {
          processingTimeMs: Date.now() - startTime,
          signalsProcessed: 0
        }
      };
    }
  }

  /**
   * Gets current performance metrics
   */
  getMetrics(): CanvasIntegrationMetrics {
    return {
      ...this.metrics,
      signalProcessingLatency: [...this.metrics.signalProcessingLatency],
      contentExtractionLatency: [...this.metrics.contentExtractionLatency],
      errorCounts: { ...this.metrics.errorCounts }
    };
  }

  // Private helper methods

  /**
   * Validates message security (origin, signature, nonce)
   */
  private async validateMessageSecurity(message: CanvasMessage): Promise<SecurityValidationResult> {
    const errors: string[] = [];
    
    // Origin validation
    const validOrigin = this.isValidOrigin(message.origin);
    if (!validOrigin) {
      errors.push('Invalid or untrusted origin');
    } else {
      this.metrics.originValidationSuccess++;
    }

    // HMAC signature validation
    const signatureValid = await this.validateHmacSignature(message);
    if (!signatureValid) {
      errors.push('Invalid HMAC signature');
    } else {
      this.metrics.signatureValidationSuccess++;
    }

    // Nonce validation (prevent replay attacks)
    const nonceValid = this.validateNonce(message.sessionId, message.nonce, message.timestamp);
    if (!nonceValid) {
      errors.push('Invalid or reused nonce');
    }

    // Rate limiting check
    const rateLimitPassed = this.checkRateLimit(message.sessionId);

    return {
      valid: errors.length === 0,
      origin: validOrigin ? message.origin : null,
      signatureValid,
      nonceValid,
      rateLimitPassed,
      errors
    };
  }

  /**
   * Validates Canvas origin against trusted list
   */
  private isValidOrigin(origin: string): boolean {
    // Check against explicit trusted origins
    if (this.TRUSTED_ORIGINS.includes(origin)) {
      return true;
    }

    // Check against regex pattern for instructure domains
    return this.ORIGIN_REGEX.test(origin);
  }

  /**
   * Validates HMAC signature for message integrity
   */
  private async validateHmacSignature(message: CanvasMessage): Promise<boolean> {
    try {
      // Create message payload for signature verification
      const payloadString = JSON.stringify({
        type: message.type,
        payload: message.payload,
        timestamp: message.timestamp.toISOString(),
        sessionId: message.sessionId,
        nonce: message.nonce,
        origin: message.origin
      });

      // Generate expected signature using Web Crypto API
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(this.hmacSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
      );

      const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(payloadString)
      );

      const expectedSignature = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      return expectedSignature === message.hmacSignature;

    } catch (error) {
      console.error('HMAC validation error:', error);
      return false;
    }
  }

  /**
   * Validates nonce to prevent replay attacks
   */
  private validateNonce(sessionId: string, nonce: string, timestamp: Date): boolean {
    // Check if nonce is too old
    const age = Date.now() - timestamp.getTime();
    if (age > this.MAX_NONCE_AGE_MS) {
      return false;
    }

    // Get or create session state
    let sessionState = this.sessionStates.get(sessionId);
    if (!sessionState) {
      sessionState = {
        sessionId,
        signalCounts: [],
        usedNonces: new Set(),
        lastCleanup: Date.now()
      };
      this.sessionStates.set(sessionId, sessionState);
    }

    // Check if nonce was already used
    if (sessionState.usedNonces.has(nonce)) {
      return false;
    }

    // Add nonce to used set
    sessionState.usedNonces.add(nonce);

    // Cleanup old nonces if needed
    if (Date.now() - sessionState.lastCleanup > this.MAX_NONCE_AGE_MS) {
      this.cleanupSessionNonces(sessionState);
    }

    return true;
  }

  /**
   * Checks rate limiting for session
   */
  private checkRateLimit(sessionId: string): boolean {
    const now = Date.now();
    let sessionState = this.sessionStates.get(sessionId);

    if (!sessionState) {
      sessionState = {
        sessionId,
        signalCounts: [],
        usedNonces: new Set(),
        lastCleanup: now
      };
      this.sessionStates.set(sessionId, sessionState);
    }

    // Clean up old entries
    sessionState.signalCounts = sessionState.signalCounts.filter(
      entry => now - entry.timestamp < this.RATE_LIMIT_CONFIG.windowSizeMs
    );

    // Count signals in current window
    const currentCount = sessionState.signalCounts.reduce(
      (sum, entry) => sum + entry.count, 0
    );

    // Check rate limits
    if (currentCount >= this.RATE_LIMIT_CONFIG.maxSignalsPerMinute) {
      return false;
    }

    // Add current signal to count
    const lastEntry = sessionState.signalCounts[sessionState.signalCounts.length - 1];
    if (lastEntry && now - lastEntry.timestamp < 1000) {
      // Same second, increment count
      lastEntry.count++;
    } else {
      // New second, create new entry
      sessionState.signalCounts.push({ timestamp: now, count: 1 });
    }

    return true;
  }

  /**
   * Processes behavioral signal payload
   */
  private async processBehavioralSignalPayload(
    payload: unknown,
    tenantId: string,
    userId: string,
    _sessionId: string
  ): Promise<number> {
    // Parse behavioral signals from payload
    let signals: BehavioralSignal[];
    
    if (Array.isArray(payload)) {
      signals = payload.map(signal => BehavioralSignalSchema.parse(signal));
    } else {
      signals = [BehavioralSignalSchema.parse(payload)];
    }

    // Store signals in database for struggle detection
    let processedCount = 0;
    
    for (const signal of signals) {
      try {
        await this.storeBehavioralSignal(signal, tenantId, userId);
        processedCount++;
      } catch (error) {
        console.error('Failed to store behavioral signal:', error);
        // Continue processing other signals
      }
    }

    return processedCount;
  }

  /**
   * Stores behavioral signal in database
   */
  private async storeBehavioralSignal(
    signal: BehavioralSignal,
    tenantId: string,
    userId: string
  ): Promise<void> {
    await this.db.getDb()
      .prepare(`
        INSERT INTO behavioral_signals (
          id, tenant_id, user_id, session_id, signal_type,
          duration_ms, element_context, page_content_hash,
          timestamp, nonce, origin, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        signal.id,
        tenantId,
        userId,
        signal.sessionId,
        signal.signalType,
        signal.durationMs,
        signal.elementContext,
        signal.pageContentHash,
        signal.timestamp.toISOString(),
        signal.nonce,
        signal.origin,
        new Date().toISOString()
      )
      .run();
  }

  /**
   * Processes content extraction request
   */
  private async processContentExtraction(
    payload: unknown,
    tenantId: string,
    userId: string,
    sessionId: string
  ): Promise<void> {
    const contentData = CanvasPageContentSchema.parse(payload);
    await this.storeExtractedContent(contentData, tenantId, sessionId);
  }

  /**
   * Processes page context update
   */
  private async processPageContextUpdate(
    payload: unknown,
    tenantId: string,
    userId: string,
    sessionId: string
  ): Promise<void> {
    // Store page context for struggle detection context
    console.log('Page context update:', { payload, tenantId, userId, sessionId });
    // Implementation would store context updates for real-time analysis
  }

  /**
   * Extracts content via Canvas API (when available)
   */
  private async extractViaCanvasAPI(
    _pageUrl: string,
    _tenantId: string
  ): Promise<CanvasPageContent | null> {
    // This would implement Canvas API calls for content extraction
    // For MVP, return null to force DOM fallback
    return null;
  }

  /**
   * Creates fallback content when extraction fails
   */
  private createFallbackContent(_pageUrl: string): CanvasPageContent {
    return {
      pageType: 'unknown',
      contentText: 'Content extraction unavailable',
      contentHash: this.generateContentHash('fallback'),
      extractedAt: new Date(),
      extractionMethod: 'dom_fallback'
    };
  }

  /**
   * Stores extracted content for struggle detection
   */
  private async storeExtractedContent(
    content: CanvasPageContent,
    tenantId: string,
    sessionId: string
  ): Promise<void> {
    await this.db.getDb()
      .prepare(`
        INSERT OR REPLACE INTO canvas_page_content (
          id, tenant_id, session_id, page_type, course_id,
          module_name, assignment_title, content_text, content_hash,
          difficulty, extracted_at, extraction_method, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        crypto.randomUUID(),
        tenantId,
        sessionId,
        content.pageType,
        content.courseId || null,
        content.moduleName || null,
        content.assignmentTitle || null,
        content.contentText || null,
        content.contentHash,
        content.difficulty || null,
        content.extractedAt.toISOString(),
        content.extractionMethod,
        JSON.stringify(content.metadata || {}),
        new Date().toISOString()
      )
      .run();
  }

  /**
   * Creates secure message with HMAC signature
   */
  private async createSecureMessage(
    type: string,
    payload: unknown,
    sessionId: string,
    origin: string
  ): Promise<CanvasMessage> {
    const timestamp = new Date();
    const nonce = crypto.randomUUID();

    // Generate HMAC signature
    const payloadString = JSON.stringify({
      type, payload, timestamp: timestamp.toISOString(), sessionId, nonce, origin
    });

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.hmacSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payloadString)
    );

    const hmacSignature = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return {
      type: type as any,
      payload,
      timestamp,
      sessionId,
      nonce,
      hmacSignature,
      origin: origin as CanvasOrigin
    };
  }

  /**
   * Generates content hash for change detection
   */
  private generateContentHash(content: string): string {
    // Simple hash function for content fingerprinting
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Records error for metrics tracking
   */
  private recordError(errorType: string): void {
    this.metrics.errorCounts[errorType] = (this.metrics.errorCounts[errorType] || 0) + 1;
  }

  /**
   * Cleans up old session states
   */
  private cleanupSessionStates(): void {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour

    for (const [sessionId, state] of this.sessionStates.entries()) {
      if (now - state.lastCleanup > maxAge) {
        this.sessionStates.delete(sessionId);
      } else {
        this.cleanupSessionNonces(state);
      }
    }
  }

  /**
   * Cleans up old nonces from session state
   */
  private cleanupSessionNonces(sessionState: SessionState): void {
    // For performance, we'll just clear the nonce set periodically
    // In production, you might want to implement a more sophisticated cleanup
    sessionState.usedNonces.clear();
    sessionState.lastCleanup = Date.now();
  }
}