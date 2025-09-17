/**
 * @fileoverview Assessment Security Service
 * @module features/ai-assessment/server/services/AssessmentSecurityService
 *
 * Comprehensive security validation and academic integrity enforcement
 * for AI-powered conversational assessments.
 *
 * Features:
 * - Session validation and timeout management
 * - Academic integrity monitoring and detection
 * - Rate limiting and abuse prevention
 * - Content validation and sanitization
 * - Audit logging for compliance
 */

import {
  AssessmentSession,
  AssessmentSessionId,
  AssessmentMessage,
  UserId,
  AcademicIntegrityError,
  SecurityValidationError,
  AssessmentSessionIdSchema,
  UserIdSchema
} from '../../shared/types.ts';

import { DatabaseService } from '../../../../shared/services/DatabaseService.ts';

/**
 * Security validation result
 */
interface SecurityValidationResult {
  valid: boolean;
  violations: SecurityViolation[];
  riskScore: number; // 0-1, higher = more risk
  recommendedAction: 'allow' | 'warn' | 'block' | 'flag';
}

/**
 * Security violation record
 */
interface SecurityViolation {
  type: SecurityViolationType;
  severity: 'low' | 'medium' | 'high';
  description: string;
  evidence: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Security violation types
 */
type SecurityViolationType =
  | 'session_timeout'
  | 'invalid_session'
  | 'unauthorized_access'
  | 'rate_limit_exceeded'
  | 'suspicious_response'
  | 'timing_anomaly'
  | 'content_similarity'
  | 'ai_detection'
  | 'session_tampering'
  | 'concurrent_sessions';

/**
 * Rate limiting configuration
 */
interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  maxResponseLength: number;
  minTimeBetweenResponses: number; // milliseconds
}

/**
 * Academic integrity analysis
 */
interface IntegrityAnalysis {
  authenticity: 'verified' | 'suspicious' | 'flagged';
  similarityScore: number; // 0-1
  aiDetectionScore: number; // 0-1
  temporalPatterns: {
    responseTime: number;
    typingSpeed: number;
    pausePatterns: number[];
    consistencyScore: number;
  };
  contentAnalysis: {
    complexityScore: number;
    vocabularyLevel: number;
    styleConsistency: number;
  };
  riskFactors: string[];
}

/**
 * Session security context
 */
interface SessionSecurityContext {
  sessionId: AssessmentSessionId;
  userId: UserId;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  fingerprint: string;
}

/**
 * Default rate limiting configuration
 */
const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  maxRequestsPerMinute: 30,
  maxRequestsPerHour: 200,
  maxResponseLength: 5000,
  minTimeBetweenResponses: 1000 // 1 second
};

/**
 * Assessment Security Service
 *
 * Provides comprehensive security validation, academic integrity monitoring,
 * and abuse prevention for the AI assessment system.
 */
export class AssessmentSecurityService {
  private readonly rateLimits: RateLimitConfig;

  constructor(
    private readonly db: DatabaseService,
    rateLimits?: Partial<RateLimitConfig>
  ) {
    this.rateLimits = { ...DEFAULT_RATE_LIMITS, ...rateLimits };
  }

  /**
   * Validate session security and integrity
   *
   * @param session - Assessment session to validate
   * @param context - Security context for the request
   * @returns Security validation result
   */
  async validateSessionSecurity(
    session: AssessmentSession,
    context: SessionSecurityContext
  ): Promise<SecurityValidationResult> {
    const violations: SecurityViolation[] = [];
    let riskScore = 0;

    try {
      // 1. Session timeout validation
      if (await this.isSessionTimedOut(session)) {
        violations.push({
          type: 'session_timeout',
          severity: 'medium',
          description: 'Assessment session has timed out',
          evidence: {
            timeoutAt: session.timing.timeoutAt,
            currentTime: new Date()
          },
          timestamp: new Date()
        });
        riskScore += 0.3;
      }

      // 2. Session tampering detection
      const tamperingCheck = await this.detectSessionTampering(session);
      if (!tamperingCheck.valid) {
        violations.push({
          type: 'session_tampering',
          severity: 'high',
          description: 'Potential session tampering detected',
          evidence: tamperingCheck.evidence,
          timestamp: new Date()
        });
        riskScore += 0.4;
      }

      // 3. Rate limiting validation
      const rateLimitCheck = await this.validateRateLimit(context);
      if (!rateLimitCheck.valid) {
        violations.push({
          type: 'rate_limit_exceeded',
          severity: 'medium',
          description: 'Rate limit exceeded',
          evidence: rateLimitCheck.evidence,
          timestamp: new Date()
        });
        riskScore += 0.2;
      }

      // 4. Concurrent session detection
      const concurrentCheck = await this.detectConcurrentSessions(context.userId);
      if (concurrentCheck.count > 1) {
        violations.push({
          type: 'concurrent_sessions',
          severity: 'medium',
          description: 'Multiple concurrent assessment sessions detected',
          evidence: { sessionCount: concurrentCheck.count },
          timestamp: new Date()
        });
        riskScore += 0.2;
      }

      // 5. Access pattern analysis
      const accessPattern = await this.analyzeAccessPattern(context);
      if (accessPattern.suspicious) {
        violations.push({
          type: 'suspicious_response',
          severity: 'low',
          description: 'Unusual access pattern detected',
          evidence: accessPattern.evidence,
          timestamp: new Date()
        });
        riskScore += 0.1;
      }

      // Determine recommended action
      const recommendedAction = this.determineSecurityAction(riskScore, violations);

      return {
        valid: violations.length === 0 || recommendedAction !== 'block',
        violations,
        riskScore: Math.min(riskScore, 1.0),
        recommendedAction
      };

    } catch (error) {
      console.error('Security validation error:', error);

      return {
        valid: false,
        violations: [{
          type: 'session_tampering',
          severity: 'high',
          description: 'Security validation failed',
          evidence: { error: error instanceof Error ? error.message : 'Unknown error' },
          timestamp: new Date()
        }],
        riskScore: 1.0,
        recommendedAction: 'block'
      };
    }
  }

  /**
   * Analyze student response for academic integrity
   *
   * @param response - Student response text
   * @param session - Assessment session context
   * @param responseMetadata - Response timing and metadata
   * @returns Academic integrity analysis
   */
  async analyzeAcademicIntegrity(
    response: string,
    session: AssessmentSession,
    responseMetadata: Record<string, unknown>
  ): Promise<IntegrityAnalysis> {
    try {
      // 1. Temporal analysis
      const temporalPatterns = this.analyzeTemporalPatterns(response, responseMetadata);

      // 2. Content similarity check
      const similarityScore = await this.checkContentSimilarity(response, session);

      // 3. AI detection analysis
      const aiDetectionScore = await this.detectAIGeneration(response);

      // 4. Content complexity analysis
      const contentAnalysis = this.analyzeContentComplexity(response);

      // 5. Risk factor identification
      const riskFactors = this.identifyRiskFactors({
        temporalPatterns,
        similarityScore,
        aiDetectionScore,
        contentAnalysis
      });

      // Determine authenticity
      const authenticity = this.determineAuthenticity(
        similarityScore,
        aiDetectionScore,
        temporalPatterns.consistencyScore,
        riskFactors.length
      );

      return {
        authenticity,
        similarityScore,
        aiDetectionScore,
        temporalPatterns,
        contentAnalysis,
        riskFactors
      };

    } catch (error) {
      console.error('Academic integrity analysis error:', error);

      // Return conservative analysis on error
      return {
        authenticity: 'suspicious',
        similarityScore: 0.5,
        aiDetectionScore: 0.5,
        temporalPatterns: {
          responseTime: 0,
          typingSpeed: 0,
          pausePatterns: [],
          consistencyScore: 0.5
        },
        contentAnalysis: {
          complexityScore: 0.5,
          vocabularyLevel: 0.5,
          styleConsistency: 0.5
        },
        riskFactors: ['analysis_failed']
      };
    }
  }

  /**
   * Sanitize and validate user input
   *
   * @param input - Raw user input
   * @returns Sanitized and validated input
   */
  sanitizeInput(input: string): string {
    if (!input || typeof input !== 'string') {
      throw new SecurityValidationError('Invalid input type');
    }

    // Remove potentially dangerous content
    let sanitized = input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframe tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, ''); // Remove event handlers

    // Limit length
    if (sanitized.length > this.rateLimits.maxResponseLength) {
      sanitized = sanitized.substring(0, this.rateLimits.maxResponseLength);
    }

    // Basic content validation
    if (sanitized.trim().length === 0) {
      throw new SecurityValidationError('Empty input after sanitization');
    }

    return sanitized.trim();
  }

  /**
   * Log security incident for audit trail
   *
   * @param sessionId - Assessment session ID
   * @param incident - Security incident details
   */
  async logSecurityIncident(
    sessionId: AssessmentSessionId,
    incident: {
      type: SecurityViolationType;
      severity: 'low' | 'medium' | 'high';
      description: string;
      evidence: Record<string, unknown>;
      userId?: UserId;
    }
  ): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO assessment_security_incidents (
            id, session_id, incident_type, severity, description,
            evidence, auto_detected, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          crypto.randomUUID(),
          sessionId,
          incident.type,
          incident.severity,
          incident.description,
          JSON.stringify(incident.evidence),
          1, // auto_detected
          new Date().toISOString()
        )
        .run();

    } catch (error) {
      console.error('Failed to log security incident:', error);
    }
  }

  /**
   * Check if session has timed out
   */
  private async isSessionTimedOut(session: AssessmentSession): Promise<boolean> {
    if (!session.timing.timeoutAt) {
      return false; // No timeout configured
    }

    return new Date() > session.timing.timeoutAt;
  }

  /**
   * Detect potential session tampering
   */
  private async detectSessionTampering(session: AssessmentSession): Promise<{
    valid: boolean;
    evidence: Record<string, unknown>;
  }> {
    const evidence: Record<string, unknown> = {};

    // Check for integrity violations
    const lastValidation = session.security.lastValidation;
    const timeSinceValidation = Date.now() - lastValidation.getTime();

    if (timeSinceValidation > 600000) { // 10 minutes
      evidence.staleValidation = true;
    }

    // Check conversation integrity
    if (session.conversation.length === 0) {
      evidence.emptyConversation = true;
    }

    // Check for unusual progress patterns
    const progressRate = session.progress.currentStep / session.conversation.length;
    if (progressRate > 2) { // More than 2 steps per message is unusual
      evidence.unusualProgress = true;
    }

    const violations = Object.keys(evidence);
    return {
      valid: violations.length === 0,
      evidence
    };
  }

  /**
   * Validate rate limiting
   */
  private async validateRateLimit(context: SessionSecurityContext): Promise<{
    valid: boolean;
    evidence: Record<string, unknown>;
  }> {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    const oneHourAgo = new Date(now.getTime() - 3600000);

    try {
      // Check requests in last minute
      const recentRequests = await this.db
        .prepare(`
          SELECT COUNT(*) as count
          FROM assessment_audit_log
          WHERE actor_id = ? AND timestamp > ?
        `)
        .bind(context.userId, oneMinuteAgo.toISOString())
        .first<{ count: number }>();

      const minuteCount = recentRequests?.count || 0;
      if (minuteCount > this.rateLimits.maxRequestsPerMinute) {
        return {
          valid: false,
          evidence: {
            requestsInLastMinute: minuteCount,
            limit: this.rateLimits.maxRequestsPerMinute
          }
        };
      }

      // Check requests in last hour
      const hourlyRequests = await this.db
        .prepare(`
          SELECT COUNT(*) as count
          FROM assessment_audit_log
          WHERE actor_id = ? AND timestamp > ?
        `)
        .bind(context.userId, oneHourAgo.toISOString())
        .first<{ count: number }>();

      const hourCount = hourlyRequests?.count || 0;
      if (hourCount > this.rateLimits.maxRequestsPerHour) {
        return {
          valid: false,
          evidence: {
            requestsInLastHour: hourCount,
            limit: this.rateLimits.maxRequestsPerHour
          }
        };
      }

      return { valid: true, evidence: {} };

    } catch (error) {
      return {
        valid: false,
        evidence: { error: 'Rate limit check failed' }
      };
    }
  }

  /**
   * Detect concurrent sessions for a user
   */
  private async detectConcurrentSessions(userId: UserId): Promise<{
    count: number;
    sessions: string[];
  }> {
    try {
      const activeSessions = await this.db
        .prepare(`
          SELECT id
          FROM assessment_sessions
          WHERE student_id = ? AND status IN ('active', 'awaiting_response', 'processing')
        `)
        .bind(userId)
        .all<{ id: string }>();

      return {
        count: activeSessions.results?.length || 0,
        sessions: activeSessions.results?.map(s => s.id) || []
      };

    } catch (error) {
      return { count: 0, sessions: [] };
    }
  }

  /**
   * Analyze access patterns for anomalies
   */
  private async analyzeAccessPattern(context: SessionSecurityContext): Promise<{
    suspicious: boolean;
    evidence: Record<string, unknown>;
  }> {
    // Simple pattern analysis - can be enhanced
    const evidence: Record<string, unknown> = {};

    // Check for unusual timing
    const now = context.timestamp.getTime();
    const hour = context.timestamp.getHours();

    if (hour < 6 || hour > 23) {
      evidence.unusualHour = hour;
    }

    // Check user agent consistency
    // This would require storing previous user agents

    return {
      suspicious: Object.keys(evidence).length > 0,
      evidence
    };
  }

  /**
   * Analyze temporal patterns in response
   */
  private analyzeTemporalPatterns(
    response: string,
    metadata: Record<string, unknown>
  ): IntegrityAnalysis['temporalPatterns'] {
    const responseTime = (metadata.responseTimeMs as number) || 0;
    const characterCount = response.length;

    // Calculate typing speed (characters per minute)
    const typingSpeed = responseTime > 0 ? (characterCount / (responseTime / 60000)) : 0;

    // Simple consistency score based on reasonable typing speeds
    const averageTypingSpeed = 200; // characters per minute
    const speedRatio = typingSpeed / averageTypingSpeed;
    const consistencyScore = speedRatio > 5 || speedRatio < 0.1 ? 0.3 : 0.8;

    return {
      responseTime,
      typingSpeed,
      pausePatterns: [], // Would need more sophisticated tracking
      consistencyScore
    };
  }

  /**
   * Check content similarity against known sources
   */
  private async checkContentSimilarity(
    response: string,
    session: AssessmentSession
  ): Promise<number> {
    // Simple similarity check against previous responses in session
    const previousResponses = session.conversation
      .filter(m => m.type === 'student')
      .map(m => m.content);

    if (previousResponses.length === 0) {
      return 0;
    }

    // Calculate similarity (simplified implementation)
    let maxSimilarity = 0;
    for (const prevResponse of previousResponses) {
      const similarity = this.calculateTextSimilarity(response, prevResponse);
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }

    return maxSimilarity;
  }

  /**
   * Detect AI-generated content (simplified)
   */
  private async detectAIGeneration(response: string): Promise<number> {
    // Simplified AI detection based on patterns
    const aiIndicators = [
      /As an AI language model/i,
      /I don't have personal experiences/i,
      /I cannot provide/i,
      /Based on my knowledge/i,
      /According to my understanding/i
    ];

    let score = 0;
    for (const pattern of aiIndicators) {
      if (pattern.test(response)) {
        score += 0.3;
      }
    }

    // Check for overly perfect grammar/structure
    const sentences = response.split(/[.!?]+/);
    if (sentences.length > 3 && response.length > 200) {
      // Very structured responses might be AI-generated
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Analyze content complexity
   */
  private analyzeContentComplexity(response: string): IntegrityAnalysis['contentAnalysis'] {
    const words = response.split(/\s+/);
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);

    // Simple complexity metrics
    const avgWordsPerSentence = words.length / Math.max(sentences.length, 1);
    const complexityScore = Math.min(avgWordsPerSentence / 20, 1); // Normalize to 0-1

    // Vocabulary level (simplified)
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    const vocabularyLevel = Math.min(uniqueWords.size / words.length, 1);

    return {
      complexityScore,
      vocabularyLevel,
      styleConsistency: 0.7 // Placeholder - would need more sophisticated analysis
    };
  }

  /**
   * Identify academic integrity risk factors
   */
  private identifyRiskFactors(analysis: {
    temporalPatterns: IntegrityAnalysis['temporalPatterns'];
    similarityScore: number;
    aiDetectionScore: number;
    contentAnalysis: IntegrityAnalysis['contentAnalysis'];
  }): string[] {
    const riskFactors: string[] = [];

    if (analysis.temporalPatterns.typingSpeed > 1000) {
      riskFactors.push('excessive_typing_speed');
    }

    if (analysis.temporalPatterns.typingSpeed < 10) {
      riskFactors.push('unusually_slow_typing');
    }

    if (analysis.similarityScore > 0.8) {
      riskFactors.push('high_content_similarity');
    }

    if (analysis.aiDetectionScore > 0.5) {
      riskFactors.push('potential_ai_generation');
    }

    if (analysis.contentAnalysis.complexityScore > 0.9) {
      riskFactors.push('unusually_complex_response');
    }

    return riskFactors;
  }

  /**
   * Determine authenticity based on analysis
   */
  private determineAuthenticity(
    similarityScore: number,
    aiDetectionScore: number,
    consistencyScore: number,
    riskFactorCount: number
  ): IntegrityAnalysis['authenticity'] {
    const riskScore = (similarityScore + aiDetectionScore + (1 - consistencyScore) + (riskFactorCount * 0.1)) / 4;

    if (riskScore > 0.7) {
      return 'flagged';
    } else if (riskScore > 0.4) {
      return 'suspicious';
    } else {
      return 'verified';
    }
  }

  /**
   * Determine security action based on risk assessment
   */
  private determineSecurityAction(
    riskScore: number,
    violations: SecurityViolation[]
  ): SecurityValidationResult['recommendedAction'] {
    const highSeverityViolations = violations.filter(v => v.severity === 'high');

    if (highSeverityViolations.length > 0 || riskScore > 0.8) {
      return 'block';
    } else if (riskScore > 0.5 || violations.length > 2) {
      return 'flag';
    } else if (riskScore > 0.3 || violations.length > 0) {
      return 'warn';
    } else {
      return 'allow';
    }
  }

  /**
   * Calculate text similarity (simplified implementation)
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }
}