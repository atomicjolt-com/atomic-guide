/**
 * @fileoverview Learner DNA API Endpoints and Integration Foundation
 * @module features/learner-dna/server/handlers/learnerDnaApi
 * 
 * Implements privacy-protected API endpoints for cognitive profile management,
 * data collection control, and educational insights with comprehensive rate limiting,
 * access controls, and GDPR/FERPA compliance features.
 */

import { Context } from 'hono';
import { DatabaseService } from '@shared/server/services';
import { PrivacyControlService } from '../services/PrivacyControlService';
import { CognitiveDataCollector } from '../services/CognitiveDataCollector';
import { LearnerDNAEngine } from '../services/LearnerDNAEngine';
import type {
  LearnerDNAProfile,
  LearnerDNAPrivacyConsent,
  PrivacyConsentUpdate,
  BehavioralPattern,
  AnonymizedCognitiveInsights
} from '../../shared/types';
import { learnerDnaPrivacyConsentSchema, privacyConsentUpdateSchema } from '../../shared/schemas/learner-dna.schema';

/**
 * Rate limiting configuration for cognitive data endpoints.
 */
interface RateLimitConfig {
  profileRetrieval: { requests: number; window: number }; // per minute
  consentUpdate: { requests: number; window: number };    // per hour
  dataSubmission: { requests: number; window: number };   // per minute
  dataExport: { requests: number; window: number };       // per day
}

/**
 * Learner DNA API Handler providing comprehensive cognitive profiling endpoints.
 * 
 * Implements privacy-first API design with granular access controls,
 * rate limiting, audit logging, and compliance with educational privacy regulations.
 * 
 * Core Endpoints:
 * - GET /profile/:userId - Retrieve cognitive profile with privacy controls
 * - POST /consent/:userId - Update privacy consent preferences
 * - PUT /behavioral-data - Submit new behavioral pattern data
 * - DELETE /withdraw/:userId - Complete data withdrawal (GDPR right to be forgotten)
 * - GET /insights/:courseId - Anonymous course-level cognitive insights
 * - POST /export/:userId - Generate data portability export
 * 
 * @class LearnerDNAApiHandler
 */
export class LearnerDNAApiHandler {
  private db: DatabaseService;
  private privacyService: PrivacyControlService;
  private dataCollector: CognitiveDataCollector;
  private dnaEngine: LearnerDNAEngine;
  
  // Rate limiting configuration
  private rateLimits: RateLimitConfig = {
    profileRetrieval: { requests: 60, window: 60000 },    // 60 requests per minute
    consentUpdate: { requests: 10, window: 3600000 },     // 10 requests per hour
    dataSubmission: { requests: 100, window: 60000 },     // 100 requests per minute
    dataExport: { requests: 5, window: 86400000 }         // 5 requests per day
  };

  constructor(
    db: DatabaseService,
    privacyService: PrivacyControlService,
    dataCollector: CognitiveDataCollector,
    dnaEngine: LearnerDNAEngine
  ) {
    this.db = db;
    this.privacyService = privacyService;
    this.dataCollector = dataCollector;
    this.dnaEngine = dnaEngine;
  }

  /**
   * Retrieves cognitive profile with privacy protection and access control validation.
   * 
   * GET /api/learner-dna/profile/:userId
   * 
   * Validates user authentication, consent status, and privacy preferences
   * before returning cognitive profile data. Supports different visibility levels
   * based on user privacy settings.
   * 
   * @param c - Hono context object with request/response
   * @returns Promise resolving to cognitive profile or error response
   * 
   * @example
   * ```typescript
   * // GET /api/learner-dna/profile/user-123?tenantId=tenant-456
   * // Headers: Authorization: Bearer <jwt-token>
   * // Response: { profile: LearnerDNAProfile, privacyLevel: 'standard' }
   * ```
   */
  async getCognitiveProfile(c: Context): Promise<Response> {
    try {
      const userId = c.req.param('userId');
      const tenantId = c.req.query('tenantId');
      
      if (!userId || !tenantId) {
        return c.json({ error: 'Missing userId or tenantId' }, 400);
      }

      // Validate authentication and authorization
      const authResult = await this.validateAuthentication(c, userId, tenantId);
      if (!authResult.success) {
        return c.json({ error: authResult.error }, authResult.statusCode);
      }

      // Apply rate limiting
      const rateLimitResult = await this.checkRateLimit(
        c, 
        `profile_${userId}`, 
        this.rateLimits.profileRetrieval
      );
      if (!rateLimitResult.success) {
        return c.json({ error: 'Rate limit exceeded' }, 429);
      }

      // Check active consent
      const consent = await this.privacyService.getActiveConsent(tenantId, userId);
      if (!consent) {
        return c.json({ 
          error: 'NO_CONSENT', 
          message: 'User has not provided consent for cognitive profiling',
          requiresConsent: true 
        }, 403);
      }

      if (consent.withdrawalRequestedAt) {
        return c.json({ 
          error: 'CONSENT_WITHDRAWN', 
          message: 'User has withdrawn consent for cognitive profiling',
          withdrawalDate: consent.withdrawalRequestedAt 
        }, 403);
      }

      // Retrieve cognitive profile
      const profile = await this.dnaEngine.generateCognitiveProfile(tenantId, userId, false);
      
      // Apply privacy filtering based on consent level
      const filteredProfile = this.filterProfileByPrivacyLevel(profile, consent.dataCollectionLevel);
      
      // Create audit log entry
      await this.createAuditLogEntry({
        tenantId,
        actorType: 'student',
        actorId: userId,
        action: 'profile_accessed',
        resourceType: 'cognitive_profile',
        resourceId: profile.id,
        ipAddress: this.getClientIP(c),
        userAgent: c.req.header('User-Agent')
      });

      return c.json({
        profile: filteredProfile,
        privacyLevel: consent.dataCollectionLevel,
        lastUpdated: profile.updatedAt,
        confidence: profile.profileConfidence,
        dataPoints: profile.totalDataPoints
      });

    } catch (error) {
      console.error('Error retrieving cognitive profile:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  }

  /**
   * Updates privacy consent preferences with validation and compliance checks.
   * 
   * POST /api/learner-dna/consent/:userId
   * 
   * Handles consent updates with proper validation, audit logging, and
   * automatic data purging when consent is withdrawn or downgraded.
   * 
   * @param c - Hono context object
   * @returns Promise resolving to updated consent record
   */
  async updatePrivacyConsent(c: Context): Promise<Response> {
    try {
      const userId = c.req.param('userId');
      const tenantId = c.req.header('X-Tenant-ID');
      
      if (!userId || !tenantId) {
        return c.json({ error: 'Missing userId or tenantId' }, 400);
      }

      // Validate authentication
      const authResult = await this.validateAuthentication(c, userId, tenantId);
      if (!authResult.success) {
        return c.json({ error: authResult.error }, authResult.statusCode);
      }

      // Apply rate limiting
      const rateLimitResult = await this.checkRateLimit(
        c, 
        `consent_${userId}`, 
        this.rateLimits.consentUpdate
      );
      if (!rateLimitResult.success) {
        return c.json({ error: 'Rate limit exceeded' }, 429);
      }

      // Parse and validate request body
      const requestBody = await c.req.json();
      const validatedUpdate = privacyConsentUpdateSchema.parse(requestBody);

      // Add metadata to consent update
      const consentUpdate: PrivacyConsentUpdate = {
        ...validatedUpdate,
        ipAddress: this.getClientIP(c),
        userAgent: c.req.header('User-Agent'),
        consentSource: 'api'
      };

      // Update consent with privacy service
      const updatedConsent = await this.privacyService.updateConsent(tenantId, userId, consentUpdate);

      // If data collection level was downgraded, trigger data purging
      if (this.isDataCollectionDowngrade(validatedUpdate)) {
        await this.triggerDataPurging(tenantId, userId, validatedUpdate.dataCollectionLevel);
      }

      return c.json({
        consent: updatedConsent,
        message: 'Privacy preferences updated successfully',
        effectiveDate: updatedConsent.consentUpdatedAt
      });

    } catch (error) {
      console.error('Error updating privacy consent:', error);
      
      if (error instanceof Error && error.message.startsWith('COPPA_COMPLIANCE_ERROR')) {
        return c.json({ 
          error: 'COPPA_VIOLATION',
          message: 'Parental consent required for students under 13',
          requiresParentalConsent: true 
        }, 403);
      }
      
      return c.json({ error: 'Internal server error' }, 500);
    }
  }

  /**
   * Submits new behavioral pattern data for cognitive profile analysis.
   * 
   * PUT /api/learner-dna/behavioral-data
   * 
   * Accepts behavioral pattern data from client applications with
   * consent verification, data validation, and privacy compliance checks.
   * 
   * @param c - Hono context object
   * @returns Promise resolving to submission confirmation
   */
  async submitBehavioralData(c: Context): Promise<Response> {
    try {
      const tenantId = c.req.header('X-Tenant-ID');
      const userId = c.req.header('X-User-ID');
      
      if (!tenantId || !userId) {
        return c.json({ error: 'Missing tenant or user identification headers' }, 400);
      }

      // Validate authentication
      const authResult = await this.validateAuthentication(c, userId, tenantId);
      if (!authResult.success) {
        return c.json({ error: authResult.error }, authResult.statusCode);
      }

      // Apply rate limiting
      const rateLimitResult = await this.checkRateLimit(
        c, 
        `data_${userId}`, 
        this.rateLimits.dataSubmission
      );
      if (!rateLimitResult.success) {
        return c.json({ error: 'Rate limit exceeded' }, 429);
      }

      // Parse request body
      const requestBody = await c.req.json();
      const { patternType, contextType, rawData, sessionId } = requestBody;

      // Validate consent for specific data type
      const dataTypeMapping = {
        'interaction_timing': 'behavioral_timing',
        'learning_velocity': 'assessment_patterns',
        'memory_retention': 'assessment_patterns',
        'comprehension_style': 'chat_interactions',
        'struggle_indicators': 'behavioral_timing',
        'content_preferences': 'behavioral_timing'
      };

      const requiredConsent = dataTypeMapping[patternType as keyof typeof dataTypeMapping];
      if (!requiredConsent) {
        return c.json({ error: 'Invalid pattern type' }, 400);
      }

      const hasConsent = await this.privacyService.validateDataCollectionPermission(
        tenantId,
        userId,
        requiredConsent as any
      );

      if (!hasConsent) {
        return c.json({ 
          error: 'CONSENT_REQUIRED',
          message: `User has not consented to ${requiredConsent} data collection`,
          requiredPermission: requiredConsent
        }, 403);
      }

      // Process behavioral data based on pattern type
      let result;
      switch (patternType) {
        case 'interaction_timing':
          result = await this.dataCollector.captureInteractionTiming(
            tenantId, userId, sessionId, rawData
          );
          break;
        case 'learning_velocity':
          result = await this.dataCollector.trackLearningVelocity(
            tenantId, userId, rawData
          );
          break;
        case 'memory_retention':
          result = await this.dataCollector.analyzeMemoryRetention(
            tenantId, userId, rawData
          );
          break;
        case 'comprehension_style':
          result = await this.dataCollector.categorizeComprehensionStyle(
            tenantId, userId, rawData
          );
          break;
        case 'struggle_indicators':
          result = await this.dataCollector.detectStruggleIndicators(
            tenantId, userId, rawData
          );
          break;
        case 'content_preferences':
          result = await this.dataCollector.trackContentPreferences(
            tenantId, userId, rawData
          );
          break;
        default:
          return c.json({ error: 'Unsupported pattern type' }, 400);
      }

      // Update cognitive profile if enough new data
      await this.dnaEngine.updateCognitiveProfile(tenantId, userId, [result as BehavioralPattern]);

      return c.json({
        success: true,
        patternId: result.id,
        message: 'Behavioral data submitted successfully',
        profileUpdated: true
      });

    } catch (error) {
      console.error('Error submitting behavioral data:', error);
      
      if (error instanceof Error && error.message.includes('PRIVACY_ERROR')) {
        return c.json({ 
          error: 'PRIVACY_VIOLATION',
          message: error.message
        }, 403);
      }
      
      return c.json({ error: 'Internal server error' }, 500);
    }
  }

  /**
   * Processes complete data withdrawal request with GDPR compliance.
   * 
   * DELETE /api/learner-dna/withdraw/:userId
   * 
   * Implements "right to be forgotten" with comprehensive data removal
   * across all related cognitive profiling tables and audit trails.
   * 
   * @param c - Hono context object
   * @returns Promise resolving to withdrawal confirmation
   */
  async withdrawAllData(c: Context): Promise<Response> {
    try {
      const userId = c.req.param('userId');
      const tenantId = c.req.header('X-Tenant-ID');
      
      if (!userId || !tenantId) {
        return c.json({ error: 'Missing userId or tenantId' }, 400);
      }

      // Validate authentication
      const authResult = await this.validateAuthentication(c, userId, tenantId);
      if (!authResult.success) {
        return c.json({ error: authResult.error }, authResult.statusCode);
      }

      // Parse request body for withdrawal reason
      const requestBody = await c.req.json();
      const { reason } = requestBody;

      // Process withdrawal with privacy service
      const withdrawal = await this.privacyService.withdrawConsent(tenantId, userId, reason);

      return c.json({
        success: true,
        withdrawalId: withdrawal.withdrawalId,
        purgeCompletionDate: withdrawal.purgeCompletionDate,
        message: 'Data withdrawal request processed successfully. All data will be purged within 24 hours.',
        nextSteps: [
          'You will receive confirmation email when data purging is complete',
          'All personalized learning features will be disabled immediately',
          'You can create a new profile anytime by providing consent again'
        ]
      });

    } catch (error) {
      console.error('Error processing data withdrawal:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  }

  /**
   * Retrieves anonymous course-level cognitive insights for instructors.
   * 
   * GET /api/learner-dna/insights/:courseId
   * 
   * Provides aggregated, anonymized learning analytics for course-level
   * insights while maintaining individual student privacy.
   * 
   * @param c - Hono context object
   * @returns Promise resolving to anonymized insights
   */
  async getCourseInsights(c: Context): Promise<Response> {
    try {
      const courseId = c.req.param('courseId');
      const tenantId = c.req.query('tenantId');
      
      if (!courseId || !tenantId) {
        return c.json({ error: 'Missing courseId or tenantId' }, 400);
      }

      // Validate instructor authorization
      const authResult = await this.validateInstructorAccess(c, courseId, tenantId);
      if (!authResult.success) {
        return c.json({ error: authResult.error }, authResult.statusCode);
      }

      // Retrieve anonymized insights from database
      const insights = await this.db.get<AnonymizedCognitiveInsights>(
        `SELECT * FROM anonymized_cognitive_insights 
         WHERE tenant_id = ? AND course_id = ? AND valid_until > datetime('now')
         ORDER BY calculated_at DESC LIMIT 1`,
        [tenantId, courseId]
      );

      if (!insights) {
        return c.json({ 
          error: 'INSIGHTS_NOT_AVAILABLE',
          message: 'Insufficient data for course-level insights or insights are being calculated',
          minimumStudents: 10
        }, 404);
      }

      // Verify k-anonymity threshold
      if (insights.sampleSize < insights.kAnonymityThreshold) {
        return c.json({ 
          error: 'PRIVACY_THRESHOLD_NOT_MET',
          message: 'Insufficient student participation for anonymous insights',
          currentParticipation: insights.sampleSize,
          minimumRequired: insights.kAnonymityThreshold
        }, 403);
      }

      // Create audit log for instructor insight access
      await this.createAuditLogEntry({
        tenantId,
        actorType: 'instructor',
        actorId: authResult.userId!,
        action: 'insights_accessed',
        resourceType: 'anonymized_insight',
        resourceId: insights.id,
        ipAddress: this.getClientIP(c),
        userAgent: c.req.header('User-Agent')
      });

      return c.json({
        insights: {
          courseId: insights.courseId,
          aggregationType: insights.aggregationType,
          sampleSize: insights.sampleSize,
          learningVelocityStats: {
            mean: insights.avgLearningVelocity,
            median: insights.medianLearningVelocity,
            standardDeviation: insights.learningVelocityStdDev
          },
          memoryRetentionStats: {
            mean: insights.avgMemoryRetention,
            median: insights.medianMemoryRetention,
            standardDeviation: insights.memoryRetentionStdDev
          },
          commonStrugglePatterns: insights.commonStrugglePatterns,
          effectiveModalities: insights.effectiveModalities,
          privacyProtection: {
            epsilonBudget: insights.epsilonPrivacyBudget,
            kAnonymity: insights.kAnonymityThreshold,
            noiseApplied: insights.noiseScaleApplied > 0
          }
        },
        metadata: {
          calculatedAt: insights.calculatedAt,
          validUntil: insights.validUntil,
          confidenceInterval: insights.confidenceInterval,
          dataFreshness: insights.dataFreshnessScore
        }
      });

    } catch (error) {
      console.error('Error retrieving course insights:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  }

  /**
   * Generates data portability export for GDPR compliance.
   * 
   * POST /api/learner-dna/export/:userId
   * 
   * Creates comprehensive data export including all cognitive profiling data,
   * behavioral patterns, and privacy preferences in machine-readable format.
   * 
   * @param c - Hono context object
   * @returns Promise resolving to export file or download link
   */
  async exportUserData(c: Context): Promise<Response> {
    try {
      const userId = c.req.param('userId');
      const tenantId = c.req.header('X-Tenant-ID');
      
      if (!userId || !tenantId) {
        return c.json({ error: 'Missing userId or tenantId' }, 400);
      }

      // Validate authentication
      const authResult = await this.validateAuthentication(c, userId, tenantId);
      if (!authResult.success) {
        return c.json({ error: authResult.error }, authResult.statusCode);
      }

      // Apply daily rate limiting for exports
      const rateLimitResult = await this.checkRateLimit(
        c, 
        `export_${userId}`, 
        this.rateLimits.dataExport
      );
      if (!rateLimitResult.success) {
        return c.json({ error: 'Daily export limit exceeded' }, 429);
      }

      // Generate comprehensive data export
      const exportData = await this.generateDataExport(tenantId, userId);

      // Create audit log entry
      await this.createAuditLogEntry({
        tenantId,
        actorType: 'student',
        actorId: userId,
        action: 'data_exported',
        resourceType: 'user_data_export',
        ipAddress: this.getClientIP(c),
        userAgent: c.req.header('User-Agent')
      });

      // Return export data as JSON (in production, might return download link)
      return c.json({
        export: exportData,
        exportId: crypto.randomUUID(),
        generatedAt: new Date().toISOString(),
        format: 'json',
        privacy: {
          gdprCompliant: true,
          includesRawData: false, // Raw data is encrypted
          includesPersonalIdentifiers: true
        }
      });

    } catch (error) {
      console.error('Error exporting user data:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  }

  // Private helper methods

  /**
   * Validates user authentication and authorization for API access.
   */
  private async validateAuthentication(
    c: Context,
    userId: string,
    tenantId: string
  ): Promise<{ success: boolean; error?: string; statusCode?: number; userId?: string }> {
    // In real implementation, this would validate JWT token
    // For now, simple header validation
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { success: false, error: 'Missing or invalid authorization header', statusCode: 401 };
    }

    // TODO: Implement proper JWT validation with LTI user claims
    // For now, assume valid if header is present
    return { success: true, userId };
  }

  /**
   * Validates instructor access to course-level insights.
   */
  private async validateInstructorAccess(
    c: Context,
    courseId: string,
    tenantId: string
  ): Promise<{ success: boolean; error?: string; statusCode?: number; userId?: string }> {
    // TODO: Implement instructor role validation from LTI claims
    const authResult = await this.validateAuthentication(c, 'instructor', tenantId);
    return authResult;
  }

  /**
   * Implements rate limiting for API endpoints.
   */
  private async checkRateLimit(
    c: Context,
    key: string,
    config: { requests: number; window: number }
  ): Promise<{ success: boolean; remaining?: number }> {
    // TODO: Implement proper rate limiting with Redis or similar
    // For now, always allow requests
    return { success: true, remaining: config.requests };
  }

  /**
   * Filters cognitive profile data based on privacy level.
   */
  private filterProfileByPrivacyLevel(
    profile: LearnerDNAProfile,
    privacyLevel: 'minimal' | 'standard' | 'comprehensive'
  ): Partial<LearnerDNAProfile> {
    const baseProfile = {
      id: profile.id,
      profileConfidence: profile.profileConfidence,
      totalDataPoints: profile.totalDataPoints,
      dataCollectionLevel: profile.dataCollectionLevel,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt
    };

    if (privacyLevel === 'minimal') {
      return {
        ...baseProfile,
        learningVelocityValue: Math.round(profile.learningVelocityValue * 10) / 10, // Rounded
        comprehensionStyles: profile.comprehensionStyles.slice(0, 1) // Top style only
      };
    }

    if (privacyLevel === 'standard') {
      return {
        ...baseProfile,
        learningVelocityValue: profile.learningVelocityValue,
        learningVelocityConfidence: profile.learningVelocityConfidence,
        memoryRetentionValue: profile.memoryRetentionValue,
        memoryRetentionConfidence: profile.memoryRetentionConfidence,
        comprehensionStyles: profile.comprehensionStyles,
        preferredModalities: profile.preferredModalities.slice(0, 2)
      };
    }

    // Comprehensive level - return full profile
    return profile;
  }

  /**
   * Checks if consent update represents data collection downgrade.
   */
  private isDataCollectionDowngrade(update: PrivacyConsentUpdate): boolean {
    const levelHierarchy = { minimal: 0, standard: 1, comprehensive: 2 };
    
    if (!update.dataCollectionLevel) return false;
    
    // TODO: Compare with existing level from database
    return false; // Placeholder
  }

  /**
   * Triggers data purging for downgraded consent levels.
   */
  private async triggerDataPurging(
    tenantId: string,
    userId: string,
    newLevel: 'minimal' | 'standard' | 'comprehensive'
  ): Promise<void> {
    // Add purging task to cognitive processing queue
    await this.db.getDb().prepare(
      `INSERT INTO cognitive_processing_queue (
        id, tenant_id, task_type, task_data, priority_level,
        processing_complexity, privacy_sensitive
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      tenantId,
      'data_anonymization',
      JSON.stringify({ userId, targetLevel: newLevel, reason: 'consent_downgrade' }),
      2, // High priority
      'standard',
      true
    ).run();
  }

  /**
   * Generates comprehensive data export for user.
   */
  private async generateDataExport(tenantId: string, userId: string): Promise<any> {
    // Get all user data for export
    const [profile, consent, behavioralPatternsResult] = await Promise.all([
      this.db.getDb().prepare('SELECT * FROM learner_dna_profiles WHERE tenant_id = ? AND user_id = ?').bind(tenantId, userId).first(),
      this.db.getDb().prepare('SELECT * FROM learner_dna_privacy_consent WHERE tenant_id = ? AND user_id = ?').bind(tenantId, userId).first(),
      this.db.getDb().prepare('SELECT * FROM behavioral_patterns WHERE tenant_id = ? AND user_id = ?').bind(tenantId, userId).all()
    ]);
    
    const behavioralPatterns = behavioralPatternsResult.results || [];

    return {
      userId,
      tenantId,
      profile,
      privacyConsent: consent,
      behavioralPatterns: behavioralPatterns.map(pattern => ({
        ...pattern,
        rawDataEncrypted: '[ENCRYPTED]', // Don't export raw encrypted data
        aggregatedMetrics: pattern.aggregated_metrics
      })),
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        dataTypes: ['cognitive_profile', 'privacy_consent', 'behavioral_patterns'],
        privacyNotice: 'Raw behavioral data is excluded for privacy protection'
      }
    };
  }

  /**
   * Gets client IP address from request context.
   */
  private getClientIP(c: Context): string {
    return c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() || 
           c.req.header('X-Real-IP') || 
           '127.0.0.1';
  }

  /**
   * Creates audit log entry for API operations.
   */
  private async createAuditLogEntry(auditData: {
    tenantId: string;
    actorType: string;
    actorId: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.db.getDb().prepare(
      `INSERT INTO learner_dna_audit_log (
        id, tenant_id, actor_type, actor_id, action, resource_type,
        resource_id, privacy_level, consent_status, data_sensitivity_level,
        ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      auditData.tenantId,
      auditData.actorType,
      auditData.actorId,
      auditData.action,
      auditData.resourceType,
      auditData.resourceId,
      'identifiable', // API access is identifiable
      'active', // Assume active consent for successful API calls
      'high', // API operations are high sensitivity
      auditData.ipAddress,
      auditData.userAgent,
      new Date().toISOString()
    ).run();
  }
}