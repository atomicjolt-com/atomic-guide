/**
 * @fileoverview Canvas PostMessage Integration Types
 * @module features/canvas-integration/shared/types
 * 
 * Defines TypeScript interfaces and types for secure Canvas cross-origin
 * communication, behavioral signal collection, and content extraction.
 * 
 * Security Requirements:
 * - Origin validation for all postMessage communication
 * - HMAC signature validation for message integrity
 * - Rate limiting and replay attack protection
 * - Input sanitization for all extracted content
 */

import { z } from 'zod';

/**
 * Canvas PostMessage origin validation schema
 */
export const CanvasOriginSchema = z.enum([
  'https://canvas.instructure.com',
  'https://atomicjolt.instructure.com',
  'https://community.canvaslms.com',
]).or(z.string().regex(/^https:\/\/[\w.-]+\.instructure\.com$/));

export type CanvasOrigin = z.infer<typeof CanvasOriginSchema>;

/**
 * Behavioral signal types for struggle detection
 */
export const BehavioralSignalTypeSchema = z.enum([
  'hover',        // Mouse hover indicating confusion or focus
  'scroll',       // Scrolling patterns showing content difficulty
  'idle',         // Idle periods suggesting cognitive overload
  'click',        // Click patterns indicating engagement
  'help_request', // Help-seeking behavior
  'quiz_interaction', // Quiz/assessment interaction patterns
  'page_leave',   // Page navigation patterns
  'focus_change'  // Tab/window focus changes
]);

export type BehavioralSignalType = z.infer<typeof BehavioralSignalTypeSchema>;

/**
 * Raw behavioral signal data from Canvas monitoring
 */
export const BehavioralSignalSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string(),
  signalType: BehavioralSignalTypeSchema,
  durationMs: z.number().min(0).max(300000), // Max 5 minutes
  elementContext: z.string().max(500),
  pageContentHash: z.string().max(64),
  timestamp: z.date(),
  // Security fields
  nonce: z.string(),
  hmacSignature: z.string(),
  origin: CanvasOriginSchema
});

export type BehavioralSignal = z.infer<typeof BehavioralSignalSchema>;

/**
 * Canvas page content extraction result
 */
export const CanvasPageContentSchema = z.object({
  pageType: z.enum(['assignment', 'quiz', 'discussion', 'module', 'page', 'course', 'unknown']),
  courseId: z.string().optional(),
  moduleName: z.string().optional(),
  assignmentTitle: z.string().optional(),
  contentText: z.string().max(10000).optional(), // Limit extracted content size
  contentHash: z.string(),
  difficulty: z.number().min(0).max(1).optional(),
  extractedAt: z.date(),
  extractionMethod: z.enum(['canvas_api', 'dom_fallback']),
  metadata: z.record(z.unknown()).optional()
});

export type CanvasPageContent = z.infer<typeof CanvasPageContentSchema>;

/**
 * Secure message envelope for Canvas PostMessage communication
 */
export const CanvasMessageSchema = z.object({
  type: z.enum([
    'behavioral_signal',
    'content_extraction',
    'page_context_update',
    'session_heartbeat',
    'struggle_intervention'
  ]),
  payload: z.unknown(),
  timestamp: z.date(),
  sessionId: z.string(),
  nonce: z.string(),
  hmacSignature: z.string(),
  origin: CanvasOriginSchema
});

export type CanvasMessage = z.infer<typeof CanvasMessageSchema>;

/**
 * Intervention message sent to Canvas for proactive chat
 */
export const InterventionMessageSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['proactive_chat', 'content_suggestion', 'break_reminder']),
  message: z.string().max(500),
  urgencyLevel: z.enum(['low', 'medium', 'high']),
  contextRelevant: z.boolean(),
  dismissible: z.boolean(),
  timestamp: z.date(),
  validUntil: z.date().optional(),
  contextualMessage: z.string().max(1000).optional() // Message to send to chat when accepted
});

export type InterventionMessage = z.infer<typeof InterventionMessageSchema>;

/**
 * Canvas monitoring configuration
 */
export interface CanvasMonitoringConfig {
  enabledSignalTypes: BehavioralSignalType[];
  sampleRate: number; // 0-1 for performance optimization
  maxSignalsPerMinute: number;
  contentExtractionEnabled: boolean;
  interventionEnabled: boolean;
  privacyMode: 'full' | 'minimal' | 'disabled';
}

/**
 * Struggle detection context from Canvas
 */
export interface StruggleDetectionContext {
  pageContent: CanvasPageContent;
  recentSignals: BehavioralSignal[];
  sessionDuration: number;
  interactionFrequency: number;
  cognitiveLoadEstimate: number;
}

/**
 * Canvas integration service response types
 */
export interface CanvasIntegrationResult {
  success: boolean;
  message?: string;
  data?: unknown;
  errors?: string[];
  performance?: {
    processingTimeMs: number;
    signalsProcessed: number;
  };
}

/**
 * Security validation result
 */
export interface SecurityValidationResult {
  valid: boolean;
  origin: CanvasOrigin | null;
  signatureValid: boolean;
  nonceValid: boolean;
  rateLimitPassed: boolean;
  errors: string[];
}

/**
 * Content extraction fallback configuration
 */
export interface ContentExtractionFallback {
  domSelectors: string[];
  maxRetries: number;
  timeoutMs: number;
  minContentLength: number;
  blacklistSelectors: string[];
}

/**
 * Error types for Canvas integration
 */
export class CanvasIntegrationError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CanvasIntegrationError';
  }
}

export class SecurityValidationError extends CanvasIntegrationError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'SECURITY_VALIDATION_FAILED', context);
    this.name = 'SecurityValidationError';
  }
}

export class ContentExtractionError extends CanvasIntegrationError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONTENT_EXTRACTION_FAILED', context);
    this.name = 'ContentExtractionError';
  }
}

/**
 * Canvas content reference for persistent storage
 */
export const CanvasContentReferenceSchema = z.object({
  id: z.string().uuid(),
  studentId: z.string(),
  courseId: z.string(),
  contentType: z.enum(['assignment', 'quiz', 'discussion', 'page', 'module', 'file']),
  contentId: z.string(),
  contentTitle: z.string().optional(),
  contentUrl: z.string().url().optional(),
  extractedAt: z.date(),
  metadata: z.object({
    learningObjectives: z.array(z.string()).optional(),
    concepts: z.array(z.string()).optional(),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    estimatedDuration: z.number().positive().optional(),
    prerequisites: z.array(z.string()).optional(),
  }),
  privacy: z.object({
    retentionExpires: z.date(),
    consentRequired: z.boolean(),
    anonymized: z.boolean(),
  }),
});

export type CanvasContentReference = z.infer<typeof CanvasContentReferenceSchema>;

/**
 * Canvas context state for real-time tracking
 */
export const CanvasContextStateSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string(),
  studentId: z.string(),
  currentContent: CanvasContentReferenceSchema.optional(),
  navigationHistory: z.array(z.object({
    contentId: z.string(),
    timestamp: z.date(),
    duration: z.number().min(0),
  })),
  activeAssessments: z.array(z.string()),
  lastUpdated: z.date(),
});

export type CanvasContextState = z.infer<typeof CanvasContextStateSchema>;

/**
 * PostMessage security configuration
 */
export const PostMessageSecuritySchema = z.object({
  messageId: z.string().uuid(),
  timestamp: z.date(),
  origin: CanvasOriginSchema,
  signature: z.string(),
  payload: z.unknown(),
  validated: z.boolean(),
  rateLimitKey: z.string(),
});

export type PostMessageSecurity = z.infer<typeof PostMessageSecuritySchema>;

/**
 * Canvas environment configuration
 */
export interface CanvasEnvironmentConfig {
  canvasBaseUrl: string;
  allowedOrigins: string[];
  apiVersion: string;
  features: {
    postMessageEnabled: boolean;
    contentExtractionEnabled: boolean;
    mobileSupported: boolean;
  };
  security: {
    requireHttps: boolean;
    hmacAlgorithm: string;
    maxMessageSize: number;
    rateLimitWindow: number;
  };
}

/**
 * Content analysis result from AI processing
 */
export interface ContentAnalysisResult {
  concepts: string[];
  learningObjectives: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration: number;
  prerequisites: string[];
  confidence: number;
  analysisTimestamp: Date;
}

/**
 * HMAC key management interface
 */
export interface HMACKeyManager {
  getCurrentKey(): Promise<string>;
  rotateKey(): Promise<string>;
  validateKey(keyId: string): Promise<boolean>;
  getKeyHistory(): Promise<Array<{ id: string; created: Date; expires: Date }>>;
}

/**
 * Performance monitoring metrics
 */
export interface CanvasIntegrationMetrics {
  signalProcessingLatency: number[];
  contentExtractionLatency: number[];
  originValidationSuccess: number;
  signatureValidationSuccess: number;
  rateLimitBlocked: number;
  totalSignalsProcessed: number;
  errorCounts: Record<string, number>;
}