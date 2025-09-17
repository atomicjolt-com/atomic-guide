/**
 * @fileoverview PostMessage Security Service for Canvas integration
 * @module features/canvas-integration/server/services/PostMessageSecurityService
 *
 * Provides comprehensive security validation for Canvas postMessage communication
 * including origin validation, HMAC signature verification, replay attack prevention,
 * and rate limiting with proper key management and rotation.
 */

import {
  CanvasMessage,
  CanvasOrigin,
  SecurityValidationResult,
  SecurityValidationError,
  CanvasEnvironmentConfig,
  HMACKeyManager
} from '../../shared/types';

/**
 * Rate limiting configuration per session
 */
interface RateLimitConfig {
  maxMessagesPerMinute: number;
  maxMessagesPerHour: number;
  burstLimit: number;
  windowSizeMs: number;
}

/**
 * Session state for rate limiting and nonce tracking
 */
interface SessionState {
  sessionId: string;
  messageCounts: { timestamp: number; count: number }[];
  usedNonces: Set<string>;
  lastCleanup: number;
  origin: string;
}

/**
 * HMAC key with metadata
 */
interface HMACKey {
  id: string;
  key: string;
  created: Date;
  expires: Date;
  active: boolean;
}

/**
 * PostMessage Security Service for Canvas Integration
 *
 * Implements comprehensive security measures for Canvas postMessage communication:
 * - Multi-layer origin validation
 * - HMAC signature verification with key rotation
 * - Replay attack prevention using nonces
 * - Rate limiting per session and origin
 * - Content sanitization and size limits
 */
export class PostMessageSecurityService implements HMACKeyManager {
  private sessionStates: Map<string, SessionState> = new Map();
  private hmacKeys: Map<string, HMACKey> = new Map();
  private currentKeyId: string | null = null;

  // Security configuration
  private readonly TRUSTED_ORIGINS = [
    'https://canvas.instructure.com',
    'https://atomicjolt.instructure.com',
    'https://community.canvaslms.com'
  ];

  private readonly ORIGIN_PATTERNS = [
    /^https:\/\/[\w.-]+\.instructure\.com$/,
    /^https:\/\/[\w.-]+\.canvaslms\.com$/
  ];

  // Rate limiting configuration
  private readonly RATE_LIMIT_CONFIG: RateLimitConfig = {
    maxMessagesPerMinute: 60,
    maxMessagesPerHour: 1800,
    burstLimit: 10,
    windowSizeMs: 60000 // 1 minute
  };

  // Security limits
  private readonly MAX_MESSAGE_SIZE = 1024 * 1024; // 1MB
  private readonly MAX_NONCE_AGE_MS = 300000; // 5 minutes
  private readonly HMAC_ALGORITHM = 'SHA-256';
  private readonly KEY_ROTATION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    private environmentConfig: CanvasEnvironmentConfig,
    private initialHmacSecret?: string
  ) {
    // Initialize with environment-specific configuration
    if (environmentConfig.allowedOrigins?.length > 0) {
      this.TRUSTED_ORIGINS.push(...environmentConfig.allowedOrigins);
    }

    // Initialize HMAC keys
    if (initialHmacSecret) {
      this.initializeHMACKeys(initialHmacSecret);
    }

    // Start periodic cleanup
    setInterval(() => this.cleanupSessionStates(), 300000); // Every 5 minutes
    setInterval(() => this.rotateExpiredKeys(), 3600000); // Every hour
  }

  /**
   * Initialize HMAC keys with initial secret
   */
  private async initializeHMACKeys(secret: string): Promise<void> {
    const keyId = crypto.randomUUID();
    const hmacKey: HMACKey = {
      id: keyId,
      key: secret,
      created: new Date(),
      expires: new Date(Date.now() + this.KEY_ROTATION_INTERVAL_MS),
      active: true
    };

    this.hmacKeys.set(keyId, hmacKey);
    this.currentKeyId = keyId;
  }

  /**
   * Validate incoming Canvas message security
   */
  async validateMessageSecurity(message: CanvasMessage): Promise<SecurityValidationResult> {
    const errors: string[] = [];
    const startTime = Date.now();

    try {
      // 1. Basic message structure validation
      if (!message || typeof message !== 'object') {
        errors.push('Invalid message structure');
        return this.createValidationResult(false, null, false, false, false, errors);
      }

      // 2. Message size validation
      const messageSize = JSON.stringify(message).length;
      if (messageSize > this.MAX_MESSAGE_SIZE) {
        errors.push(`Message size ${messageSize} exceeds maximum ${this.MAX_MESSAGE_SIZE}`);
        return this.createValidationResult(false, null, false, false, false, errors);
      }

      // 3. Origin validation
      const originValid = this.validateOrigin(message.origin);
      if (!originValid) {
        errors.push('Invalid or untrusted origin');
      }

      // 4. HMAC signature validation
      const signatureValid = await this.validateHmacSignature(message);
      if (!signatureValid) {
        errors.push('Invalid HMAC signature');
      }

      // 5. Nonce validation (replay attack prevention)
      const nonceValid = this.validateNonce(message.sessionId, message.nonce, message.timestamp);
      if (!nonceValid) {
        errors.push('Invalid or reused nonce');
      }

      // 6. Rate limiting check
      const rateLimitPassed = this.checkRateLimit(message.sessionId, message.origin);
      if (!rateLimitPassed) {
        errors.push('Rate limit exceeded');
      }

      // 7. Timestamp validation (prevent old message replay)
      const timestampValid = this.validateTimestamp(message.timestamp);
      if (!timestampValid) {
        errors.push('Message timestamp too old or invalid');
      }

      // 8. Content sanitization check
      const contentSafe = await this.validateMessageContent(message.payload);
      if (!contentSafe) {
        errors.push('Message content failed security validation');
      }

      const isValid = errors.length === 0;
      const processingTime = Date.now() - startTime;

      // Log security validation attempt
      await this.logSecurityEvent({
        messageId: crypto.randomUUID(),
        timestamp: message.timestamp,
        origin: message.origin,
        signature: message.hmacSignature,
        payload: message.payload,
        validated: isValid,
        rateLimitKey: message.sessionId,
      }, processingTime, errors);

      return this.createValidationResult(
        isValid,
        originValid ? message.origin : null,
        signatureValid,
        nonceValid,
        rateLimitPassed,
        errors
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
      errors.push(errorMessage);

      return this.createValidationResult(false, null, false, false, false, errors);
    }
  }

  /**
   * Create secure message with HMAC signature
   */
  async createSecureMessage(
    type: string,
    payload: unknown,
    sessionId: string,
    origin: CanvasOrigin
  ): Promise<CanvasMessage> {
    const timestamp = new Date();
    const nonce = crypto.randomUUID();

    // Get current HMAC key
    const currentKey = await this.getCurrentKey();
    if (!currentKey) {
      throw new SecurityValidationError('No active HMAC key available');
    }

    // Create message payload for signature
    const messageData = {
      type,
      payload,
      timestamp: timestamp.toISOString(),
      sessionId,
      nonce,
      origin
    };

    // Generate HMAC signature
    const hmacSignature = await this.generateHmacSignature(messageData, currentKey);

    return {
      type: type as any,
      payload,
      timestamp,
      sessionId,
      nonce,
      hmacSignature,
      origin
    };
  }

  /**
   * Validate Canvas origin against trusted list and patterns
   */
  private validateOrigin(origin: string): boolean {
    // Check environment-specific requirements
    if (this.environmentConfig.security.requireHttps && !origin.startsWith('https://')) {
      return false;
    }

    // Check against explicit trusted origins
    if (this.TRUSTED_ORIGINS.includes(origin)) {
      return true;
    }

    // Check against regex patterns
    return this.ORIGIN_PATTERNS.some(pattern => pattern.test(origin));
  }

  /**
   * Validate HMAC signature for message integrity
   */
  private async validateHmacSignature(message: CanvasMessage): Promise<boolean> {
    try {
      // Try current key first
      if (this.currentKeyId) {
        const currentKey = this.hmacKeys.get(this.currentKeyId);
        if (currentKey?.active) {
          const isValid = await this.verifySignature(message, currentKey.key);
          if (isValid) return true;
        }
      }

      // Try all active keys (for key rotation periods)
      for (const key of this.hmacKeys.values()) {
        if (key.active && !this.isKeyExpired(key)) {
          const isValid = await this.verifySignature(message, key.key);
          if (isValid) return true;
        }
      }

      return false;
    } catch (error) {
      console.error('HMAC validation error:', error);
      return false;
    }
  }

  /**
   * Verify signature against a specific key
   */
  private async verifySignature(message: CanvasMessage, key: string): Promise<boolean> {
    const messageData = {
      type: message.type,
      payload: message.payload,
      timestamp: message.timestamp.toISOString(),
      sessionId: message.sessionId,
      nonce: message.nonce,
      origin: message.origin
    };

    const expectedSignature = await this.generateHmacSignature(messageData, key);
    return expectedSignature === message.hmacSignature;
  }

  /**
   * Generate HMAC signature for message
   */
  private async generateHmacSignature(messageData: object, key: string): Promise<string> {
    const encoder = new TextEncoder();
    const payloadString = JSON.stringify(messageData);

    const keyData = await crypto.subtle.importKey(
      'raw',
      encoder.encode(key),
      { name: 'HMAC', hash: this.HMAC_ALGORITHM },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      keyData,
      encoder.encode(payloadString)
    );

    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Validate nonce to prevent replay attacks
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
        messageCounts: [],
        usedNonces: new Set(),
        lastCleanup: Date.now(),
        origin: ''
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
   * Validate message timestamp
   */
  private validateTimestamp(timestamp: Date): boolean {
    const now = Date.now();
    const messageTime = timestamp.getTime();

    // Reject messages older than 5 minutes
    if (now - messageTime > this.MAX_NONCE_AGE_MS) {
      return false;
    }

    // Reject messages from the future (allow 1 minute clock skew)
    if (messageTime - now > 60000) {
      return false;
    }

    return true;
  }

  /**
   * Validate message content for security issues
   */
  private async validateMessageContent(payload: unknown): Promise<boolean> {
    try {
      const payloadString = JSON.stringify(payload);

      // Basic XSS protection patterns
      const xssPatterns = [
        /<script[^>]*>/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /<iframe[^>]*>/i,
        /vbscript:/i
      ];

      for (const pattern of xssPatterns) {
        if (pattern.test(payloadString)) {
          return false;
        }
      }

      // Check for SQL injection patterns (basic)
      const sqlPatterns = [
        /union\s+select/i,
        /drop\s+table/i,
        /delete\s+from/i,
        /insert\s+into/i
      ];

      for (const pattern of sqlPatterns) {
        if (pattern.test(payloadString)) {
          return false;
        }
      }

      return true;
    } catch {
      // If we can't parse the payload, consider it unsafe
      return false;
    }
  }

  /**
   * Check rate limiting for session
   */
  private checkRateLimit(sessionId: string, origin: string): boolean {
    const now = Date.now();
    let sessionState = this.sessionStates.get(sessionId);

    if (!sessionState) {
      sessionState = {
        sessionId,
        messageCounts: [],
        usedNonces: new Set(),
        lastCleanup: now,
        origin
      };
      this.sessionStates.set(sessionId, sessionState);
    }

    // Clean up old entries
    sessionState.messageCounts = sessionState.messageCounts.filter(
      entry => now - entry.timestamp < this.RATE_LIMIT_CONFIG.windowSizeMs
    );

    // Count messages in current window
    const currentCount = sessionState.messageCounts.reduce(
      (sum, entry) => sum + entry.count, 0
    );

    // Check rate limits
    if (currentCount >= this.RATE_LIMIT_CONFIG.maxMessagesPerMinute) {
      return false;
    }

    // Add current message to count
    const lastEntry = sessionState.messageCounts[sessionState.messageCounts.length - 1];
    if (lastEntry && now - lastEntry.timestamp < 1000) {
      // Same second, increment count
      lastEntry.count++;
    } else {
      // New second, create new entry
      sessionState.messageCounts.push({ timestamp: now, count: 1 });
    }

    return true;
  }

  /**
   * Log security event for monitoring and compliance
   */
  private async logSecurityEvent(
    security: any,
    processingTime: number,
    errors: string[]
  ): Promise<void> {
    // In a real implementation, this would write to the database
    // For now, we'll log to console
    console.log('PostMessage Security Event:', {
      messageId: security.messageId,
      origin: security.origin,
      validated: security.validated,
      processingTime,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * HMAC Key Management Implementation
   */
  async getCurrentKey(): Promise<string> {
    if (!this.currentKeyId) {
      throw new Error('No HMAC key initialized');
    }

    const key = this.hmacKeys.get(this.currentKeyId);
    if (!key || !key.active || this.isKeyExpired(key)) {
      await this.rotateKey();
      return this.getCurrentKey();
    }

    return key.key;
  }

  async rotateKey(): Promise<string> {
    // Generate new key
    const keyId = crypto.randomUUID();
    const keyBytes = new Uint8Array(32);
    crypto.getRandomValues(keyBytes);
    const newKey = Array.from(keyBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const hmacKey: HMACKey = {
      id: keyId,
      key: newKey,
      created: new Date(),
      expires: new Date(Date.now() + this.KEY_ROTATION_INTERVAL_MS),
      active: true
    };

    // Add new key
    this.hmacKeys.set(keyId, hmacKey);

    // Mark old key as inactive (but keep for verification during transition)
    if (this.currentKeyId) {
      const oldKey = this.hmacKeys.get(this.currentKeyId);
      if (oldKey) {
        oldKey.active = false;
      }
    }

    this.currentKeyId = keyId;

    console.log(`HMAC key rotated: ${keyId}`);
    return newKey;
  }

  async validateKey(keyId: string): Promise<boolean> {
    const key = this.hmacKeys.get(keyId);
    return key !== undefined && !this.isKeyExpired(key);
  }

  async getKeyHistory(): Promise<Array<{ id: string; created: Date; expires: Date }>> {
    return Array.from(this.hmacKeys.values()).map(key => ({
      id: key.id,
      created: key.created,
      expires: key.expires
    }));
  }

  /**
   * Check if key is expired
   */
  private isKeyExpired(key: HMACKey): boolean {
    return Date.now() > key.expires.getTime();
  }

  /**
   * Rotate expired keys
   */
  private async rotateExpiredKeys(): Promise<void> {
    const now = Date.now();
    let needsRotation = false;

    // Check if current key is expired
    if (this.currentKeyId) {
      const currentKey = this.hmacKeys.get(this.currentKeyId);
      if (currentKey && this.isKeyExpired(currentKey)) {
        needsRotation = true;
      }
    }

    if (needsRotation) {
      await this.rotateKey();
    }

    // Clean up very old keys (keep for 48 hours after expiration)
    const cleanupThreshold = 48 * 60 * 60 * 1000; // 48 hours
    for (const [keyId, key] of this.hmacKeys.entries()) {
      if (now - key.expires.getTime() > cleanupThreshold) {
        this.hmacKeys.delete(keyId);
      }
    }
  }

  /**
   * Create validation result object
   */
  private createValidationResult(
    valid: boolean,
    origin: CanvasOrigin | null,
    signatureValid: boolean,
    nonceValid: boolean,
    rateLimitPassed: boolean,
    errors: string[]
  ): SecurityValidationResult {
    return {
      valid,
      origin,
      signatureValid,
      nonceValid,
      rateLimitPassed,
      errors
    };
  }

  /**
   * Clean up session states
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
   * Clean up old nonces from session state
   */
  private cleanupSessionNonces(sessionState: SessionState): void {
    // Clear old nonces to prevent memory leaks
    sessionState.usedNonces.clear();
    sessionState.lastCleanup = Date.now();
  }
}