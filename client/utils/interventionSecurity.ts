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
  allowedUrgencyLevels: ['low', 'medium', 'high'],
  allowedInterventionTypes: ['proactive_chat', 'content_suggestion', 'break_reminder', 'help_offer'],
  rateLimitWindowMs: 60 * 60 * 1000, // 1 hour
  actionLimitWindowMs: 60 * 1000, // 1 minute
  maxTimestampAge: 5 * 60 * 1000 // 5 minutes
};

/**
 * Validate and sanitize intervention message for security
 * 
 * Performs comprehensive security validation including:
 * - Content sanitization (XSS prevention)
 * - Rate limiting checks
 * - Data format validation
 * - Message length limits
 */
export function validateInterventionSecurity(intervention: InterventionMessage): SecurityValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Basic structure validation
  if (!intervention) {
    errors.push('Intervention message is null or undefined');
    return { isValid: false, errors, warnings };
  }
  
  // Required field validation
  if (!intervention.id || typeof intervention.id !== 'string') {
    errors.push('Missing or invalid intervention ID');
  }
  
  if (!intervention.type || typeof intervention.type !== 'string') {
    errors.push('Missing or invalid intervention type');
  } else if (!SECURITY_CONFIG.allowedInterventionTypes.includes(intervention.type)) {
    errors.push(`Invalid intervention type: ${intervention.type}`);
  }
  
  if (!intervention.message || typeof intervention.message !== 'string') {
    errors.push('Missing or invalid intervention message');
  } else if (intervention.message.length > SECURITY_CONFIG.maxMessageLength) {
    errors.push(`Intervention message too long (max ${SECURITY_CONFIG.maxMessageLength} characters)`);
  }
  
  if (!intervention.urgencyLevel || typeof intervention.urgencyLevel !== 'string') {
    errors.push('Missing or invalid urgency level');
  } else if (!SECURITY_CONFIG.allowedUrgencyLevels.includes(intervention.urgencyLevel)) {
    errors.push(`Invalid urgency level: ${intervention.urgencyLevel}`);
  }
  
  if (!intervention.timestamp || !(intervention.timestamp instanceof Date)) {
    errors.push('Missing or invalid timestamp');
  } else {
    // Check timestamp age
    const age = Date.now() - intervention.timestamp.getTime();
    if (age > SECURITY_CONFIG.maxTimestampAge) {
      warnings.push('Intervention timestamp is older than expected');
    }
  }
  
  // Contextual message validation (optional field)
  if (intervention.contextualMessage) {
    if (typeof intervention.contextualMessage !== 'string') {
      errors.push('Invalid contextual message format');
    } else if (intervention.contextualMessage.length > SECURITY_CONFIG.maxContextualMessageLength) {
      errors.push(`Contextual message too long (max ${SECURITY_CONFIG.maxContextualMessageLength} characters)`);
    }
  }
  
  // Rate limiting validation
  const rateLimitResult = validateRateLimit(intervention.id);
  if (!rateLimitResult.allowed) {
    errors.push(`Rate limit exceeded: ${rateLimitResult.reason}`);
  }
  
  // Origin validation
  if (!validateInterventionOrigin(intervention)) {
    errors.push('Intervention failed origin validation');
  }
  
  const isValid = errors.length === 0;
  const sanitizedData = isValid ? sanitizeInterventionMessage(intervention) : undefined;
  
  return {
    isValid,
    sanitizedData,
    errors,
    warnings
  };
}

/**
 * Validate rate limiting for interventions
 */
function validateRateLimit(interventionId: string): { allowed: boolean; reason: string } {
  const now = Date.now();
  
  // Clean up old entries periodically
  if (now - rateLimitState.lastReset > SECURITY_CONFIG.rateLimitWindowMs) {
    cleanupRateLimitState();
    rateLimitState.lastReset = now;
  }
  
  // Check total intervention count
  const totalInterventions = Array.from(rateLimitState.interventionCounts.values())
    .flat()
    .filter(timestamp => now - timestamp < SECURITY_CONFIG.rateLimitWindowMs)
    .length;
    
  if (totalInterventions >= SECURITY_CONFIG.maxInterventionsPerHour) {
    return {
      allowed: false,
      reason: 'Maximum interventions per hour exceeded'
    };
  }
  
  // Check same intervention count
  const sameInterventionTimestamps = rateLimitState.interventionCounts.get(interventionId) || [];
  const recentSameInterventions = sameInterventionTimestamps
    .filter(timestamp => now - timestamp < SECURITY_CONFIG.rateLimitWindowMs);
    
  if (recentSameInterventions.length >= SECURITY_CONFIG.maxSameInterventionPerHour) {
    return {
      allowed: false,
      reason: 'Maximum instances of same intervention per hour exceeded'
    };
  }
  
  // Record this intervention
  const updatedTimestamps = [...recentSameInterventions, now];
  rateLimitState.interventionCounts.set(interventionId, updatedTimestamps);
  
  return { allowed: true, reason: '' };
}

/**
 * Validate user action rate limiting
 */
export function validateUserActionRateLimit(): { allowed: boolean; reason: string } {
  const now = Date.now();
  
  // Clean up old user actions
  rateLimitState.userActionCounts = rateLimitState.userActionCounts
    .filter(timestamp => now - timestamp < SECURITY_CONFIG.actionLimitWindowMs);
  
  if (rateLimitState.userActionCounts.length >= SECURITY_CONFIG.maxUserActionsPerMinute) {
    return {
      allowed: false,
      reason: 'Maximum user actions per minute exceeded'
    };
  }
  
  // Record this action
  rateLimitState.userActionCounts.push(now);
  
  return { allowed: true, reason: '' };
}

/**
 * Clean up old rate limit entries
 */
function cleanupRateLimitState(): void {
  const now = Date.now();
  const cutoffTime = now - SECURITY_CONFIG.rateLimitWindowMs;
  
  // Clean up intervention counts
  for (const [interventionId, timestamps] of rateLimitState.interventionCounts.entries()) {
    const recentTimestamps = timestamps.filter(timestamp => timestamp > cutoffTime);
    if (recentTimestamps.length === 0) {
      rateLimitState.interventionCounts.delete(interventionId);
    } else {
      rateLimitState.interventionCounts.set(interventionId, recentTimestamps);
    }
  }
  
  // Clean up user action counts
  rateLimitState.userActionCounts = rateLimitState.userActionCounts
    .filter(timestamp => timestamp > cutoffTime);
}

/**
 * Validate intervention origin and integrity
 */
export function validateInterventionOrigin(intervention: InterventionMessage, _expectedOrigin?: string): boolean {
  // In a real implementation, this would validate HMAC signatures
  // and verify the intervention came from an authorized source
  
  // Basic validation - ensure intervention has required security fields
  if (!intervention.id || !intervention.timestamp) {
    return false;
  }
  
  // Validate UUID format for intervention ID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(intervention.id)) {
    return false;
  }
  
  // Additional origin validation would go here
  return true;
}

/**
 * Sanitize intervention message content to prevent XSS
 */
function sanitizeInterventionMessage(intervention: InterventionMessage): InterventionMessage {
  return {
    ...intervention,
    message: DOMPurify.sanitize(intervention.message, {
      ALLOWED_TAGS: SECURITY_CONFIG.allowedHtmlTags,
      ALLOWED_ATTR: [],
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false
    }),
    contextualMessage: intervention.contextualMessage ? 
      DOMPurify.sanitize(intervention.contextualMessage, {
        ALLOWED_TAGS: SECURITY_CONFIG.allowedHtmlTags,
        ALLOWED_ATTR: [],
        RETURN_DOM: false,
        RETURN_DOM_FRAGMENT: false
      }) : intervention.contextualMessage
  };
}

/**
 * Securely log intervention events without exposing sensitive data
 */
export function logInterventionEvent(
  eventType: string, 
  interventionId: string, 
  additionalData?: Record<string, any>
): void {
  // Only log non-sensitive metadata
  const logData = {
    eventType,
    interventionId: interventionId.substring(0, 8) + '...', // Partial ID for privacy
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 50) : 'unknown',
    ...additionalData
  };
  
  // Remove any potentially sensitive fields
  delete logData.message;
  delete logData.contextualMessage;
  delete logData.userId;
  delete logData.sessionId;
  
  if (process.env.NODE_ENV === 'development') {
    console.log('Intervention Security Event:', logData);
  }
  
  // In production, send to secure logging endpoint
  if (process.env.NODE_ENV === 'production') {
    // Implementation would send to secure logging service
    // fetch('/api/security/log', { method: 'POST', body: JSON.stringify(logData) });
  }
}

/**
 * Get current rate limit status (for debugging/monitoring)
 */
export function getRateLimitStatus(): {
  totalInterventions: number;
  userActions: number;
  uniqueInterventions: number;
} {
  const now = Date.now();
  const cutoffTime = now - SECURITY_CONFIG.rateLimitWindowMs;
  const actionCutoffTime = now - SECURITY_CONFIG.actionLimitWindowMs;
  
  const totalInterventions = Array.from(rateLimitState.interventionCounts.values())
    .flat()
    .filter(timestamp => timestamp > cutoffTime)
    .length;
    
  const userActions = rateLimitState.userActionCounts
    .filter(timestamp => timestamp > actionCutoffTime)
    .length;
    
  const uniqueInterventions = Array.from(rateLimitState.interventionCounts.keys()).length;
  
  return {
    totalInterventions,
    userActions,
    uniqueInterventions
  };
}

/**
 * Reset rate limit state (useful for testing)
 */
export function resetRateLimitState(): void {
  rateLimitState = {
    interventionCounts: new Map(),
    userActionCounts: [],
    lastReset: Date.now()
  };
}