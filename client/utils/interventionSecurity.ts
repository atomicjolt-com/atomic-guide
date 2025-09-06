/**
 * @fileoverview Security validation utilities for intervention data
 * @module client/utils/interventionSecurity
 * 
 * Provides secure handling of intervention messages including:
 * - Content sanitization
 * - XSS prevention
 * - Rate limiting validation
 * - Data integrity checks
 */

import DOMPurify from 'isomorphic-dompurify';
import { InterventionMessage } from '@features/canvas-integration/shared/types';

/**
 * Security validation result
 */
export interface SecurityValidationResult {
  isValid: boolean;
  sanitizedData?: InterventionMessage;
  errors: string[];
  warnings: string[];
}

/**
 * Rate limiting state for intervention security
 */
interface RateLimitState {
  interventionCounts: Map<string, number[]>; // interventionId -> timestamps
  userActionCounts: number[]; // Recent user action timestamps
  lastReset: number;
}

// Global rate limiting state
let rateLimitState: RateLimitState = {
  interventionCounts: new Map(),
  userActionCounts: [],
  lastReset: Date.now()
};

/**
 * Security configuration
 */
const SECURITY_CONFIG = {
  maxInterventionsPerHour: 10,
  maxSameInterventionPerHour: 3,
  maxUserActionsPerMinute: 30,
  maxMessageLength: 500,
  maxContextualMessageLength: 1000,
  allowedHtmlTags: [] as string[], // No HTML allowed in intervention messages
  rateLimitWindowMs: 3600000, // 1 hour
  actionLimitWindowMs: 60000   // 1 minute
} as const;

/**
 * Sanitize intervention message content
 */
export function sanitizeInterventionMessage(intervention: InterventionMessage): InterventionMessage {
  return {
    ...intervention,
    message: DOMPurify.sanitize(intervention.message, { 
      ALLOWED_TAGS: SECURITY_CONFIG.allowedHtmlTags,
      ALLOWED_ATTR: [],
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false
    }),
    contextualMessage: intervention.contextualMessage 
      ? DOMPurify.sanitize(intervention.contextualMessage, { 
          ALLOWED_TAGS: SECURITY_CONFIG.allowedHtmlTags,
          ALLOWED_ATTR: [],
          RETURN_DOM: false,
          RETURN_DOM_FRAGMENT: false
        })
      : undefined
  };
}

/**
 * Validate intervention message for security issues
 */
export function validateInterventionSecurity(intervention: InterventionMessage): SecurityValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 1. Content length validation
  if (intervention.message.length > SECURITY_CONFIG.maxMessageLength) {
    errors.push(`Message exceeds maximum length of ${SECURITY_CONFIG.maxMessageLength} characters`);
  }
  
  if (intervention.contextualMessage && intervention.contextualMessage.length > SECURITY_CONFIG.maxContextualMessageLength) {
    errors.push(`Contextual message exceeds maximum length of ${SECURITY_CONFIG.maxContextualMessageLength} characters`);
  }
  
  // 2. Content sanitization check
  const originalMessage = intervention.message;
  const sanitizedMessage = DOMPurify.sanitize(intervention.message, { 
    ALLOWED_TAGS: SECURITY_CONFIG.allowedHtmlTags,
    ALLOWED_ATTR: []
  });
  
  if (originalMessage !== sanitizedMessage) {
    warnings.push('Message content was sanitized to remove potential XSS vectors');
  }
  
  // 3. Rate limiting validation
  const rateLimitResult = validateRateLimit(intervention.id);
  if (!rateLimitResult.allowed) {
    errors.push(rateLimitResult.reason);
  }
  
  // 4. Timestamp validation
  const now = new Date();
  const interventionTime = new Date(intervention.timestamp);
  const timeDiff = Math.abs(now.getTime() - interventionTime.getTime());
  
  // Allow up to 5 minutes of clock skew
  if (timeDiff > 300000) {
    warnings.push('Intervention timestamp indicates potential clock skew or replay attack');
  }
  
  // 5. Urgency level validation
  if (intervention.urgencyLevel === 'high' && !intervention.contextualMessage) {
    warnings.push('High urgency intervention without contextual message may not be effective');
  }
  
  // 6. Expiration validation
  if (intervention.validUntil && new Date(intervention.validUntil) <= now) {
    errors.push('Intervention has expired and should not be processed');
  }
  
  const isValid = errors.length === 0;
  const sanitizedData = isValid ? sanitizeInterventionMessage(intervention) : undefined;
  
  return {
    isValid,\n    sanitizedData,\n    errors,\n    warnings\n  };\n}\n\n/**\n * Validate rate limiting for interventions\n */\nfunction validateRateLimit(interventionId: string): { allowed: boolean; reason: string } {\n  const now = Date.now();\n  \n  // Clean up old entries periodically\n  if (now - rateLimitState.lastReset > SECURITY_CONFIG.rateLimitWindowMs) {\n    cleanupRateLimitState();\n    rateLimitState.lastReset = now;\n  }\n  \n  // Check total intervention count\n  const totalInterventions = Array.from(rateLimitState.interventionCounts.values())\n    .flat()\n    .filter(timestamp => now - timestamp < SECURITY_CONFIG.rateLimitWindowMs)\n    .length;\n    \n  if (totalInterventions >= SECURITY_CONFIG.maxInterventionsPerHour) {\n    return {\n      allowed: false,\n      reason: 'Maximum interventions per hour exceeded'\n    };\n  }\n  \n  // Check same intervention count\n  const sameInterventionTimestamps = rateLimitState.interventionCounts.get(interventionId) || [];\n  const recentSameInterventions = sameInterventionTimestamps\n    .filter(timestamp => now - timestamp < SECURITY_CONFIG.rateLimitWindowMs);\n    \n  if (recentSameInterventions.length >= SECURITY_CONFIG.maxSameInterventionPerHour) {\n    return {\n      allowed: false,\n      reason: 'Maximum instances of same intervention per hour exceeded'\n    };\n  }\n  \n  // Record this intervention\n  const updatedTimestamps = [...recentSameInterventions, now];\n  rateLimitState.interventionCounts.set(interventionId, updatedTimestamps);\n  \n  return { allowed: true, reason: '' };\n}\n\n/**\n * Validate user action rate limiting\n */\nexport function validateUserActionRateLimit(): { allowed: boolean; reason: string } {\n  const now = Date.now();\n  \n  // Clean up old user actions\n  rateLimitState.userActionCounts = rateLimitState.userActionCounts\n    .filter(timestamp => now - timestamp < SECURITY_CONFIG.actionLimitWindowMs);\n  \n  if (rateLimitState.userActionCounts.length >= SECURITY_CONFIG.maxUserActionsPerMinute) {\n    return {\n      allowed: false,\n      reason: 'Maximum user actions per minute exceeded'\n    };\n  }\n  \n  // Record this action\n  rateLimitState.userActionCounts.push(now);\n  \n  return { allowed: true, reason: '' };\n}\n\n/**\n * Clean up old rate limit entries\n */\nfunction cleanupRateLimitState(): void {\n  const now = Date.now();\n  const cutoffTime = now - SECURITY_CONFIG.rateLimitWindowMs;\n  \n  // Clean up intervention counts\n  for (const [interventionId, timestamps] of rateLimitState.interventionCounts.entries()) {\n    const recentTimestamps = timestamps.filter(timestamp => timestamp > cutoffTime);\n    if (recentTimestamps.length === 0) {\n      rateLimitState.interventionCounts.delete(interventionId);\n    } else {\n      rateLimitState.interventionCounts.set(interventionId, recentTimestamps);\n    }\n  }\n  \n  // Clean up user action counts\n  rateLimitState.userActionCounts = rateLimitState.userActionCounts\n    .filter(timestamp => timestamp > cutoffTime);\n}\n\n/**\n * Validate intervention origin and integrity\n */\nexport function validateInterventionOrigin(intervention: InterventionMessage, expectedOrigin?: string): boolean {\n  // In a real implementation, this would validate HMAC signatures\n  // and verify the intervention came from an authorized source\n  \n  // Basic validation - ensure intervention has required security fields\n  if (!intervention.id || !intervention.timestamp) {\n    return false;\n  }\n  \n  // Validate UUID format for intervention ID\n  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;\n  if (!uuidRegex.test(intervention.id)) {\n    return false;\n  }\n  \n  // Additional origin validation would go here\n  return true;\n}\n\n/**\n * Securely log intervention events without exposing sensitive data\n */\nexport function logInterventionEvent(\n  eventType: string, \n  interventionId: string, \n  additionalData?: Record<string, any>\n): void {\n  // Only log non-sensitive metadata\n  const logData = {\n    eventType,\n    interventionId: interventionId.substring(0, 8) + '...', // Partial ID for privacy\n    timestamp: new Date().toISOString(),\n    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 50) : 'unknown',\n    ...additionalData\n  };\n  \n  // Remove any potentially sensitive fields\n  delete logData.message;\n  delete logData.contextualMessage;\n  delete logData.userId;\n  delete logData.sessionId;\n  \n  if (process.env.NODE_ENV === 'development') {\n    console.log('Intervention Security Event:', logData);\n  }\n  \n  // In production, send to secure logging endpoint\n  if (process.env.NODE_ENV === 'production') {\n    // Implementation would send to secure logging service\n    // fetch('/api/security/log', { method: 'POST', body: JSON.stringify(logData) });\n  }\n}\n\n/**\n * Get current rate limit status (for debugging/monitoring)\n */\nexport function getRateLimitStatus(): {\n  totalInterventions: number;\n  userActions: number;\n  uniqueInterventions: number;\n} {\n  const now = Date.now();\n  const cutoffTime = now - SECURITY_CONFIG.rateLimitWindowMs;\n  const actionCutoffTime = now - SECURITY_CONFIG.actionLimitWindowMs;\n  \n  const totalInterventions = Array.from(rateLimitState.interventionCounts.values())\n    .flat()\n    .filter(timestamp => timestamp > cutoffTime)\n    .length;\n    \n  const userActions = rateLimitState.userActionCounts\n    .filter(timestamp => timestamp > actionCutoffTime)\n    .length;\n    \n  const uniqueInterventions = Array.from(rateLimitState.interventionCounts.keys()).length;\n  \n  return {\n    totalInterventions,\n    userActions,\n    uniqueInterventions\n  };\n}\n\n/**\n * Reset rate limit state (useful for testing)\n */\nexport function resetRateLimitState(): void {\n  rateLimitState = {\n    interventionCounts: new Map(),\n    userActionCounts: [],\n    lastReset: Date.now()\n  };\n}