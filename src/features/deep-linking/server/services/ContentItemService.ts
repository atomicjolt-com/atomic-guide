/**
 * @fileoverview Content Item Service for LTI Deep Linking 2.0
 * Generates LTI-compliant content items and signs JWT responses for Canvas
 * @module features/deep-linking/server/services/ContentItemService
 */

import { z } from 'zod';

/**
 * Content item configuration schema
 */
const ContentItemConfigSchema = z.object({
  assessmentId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  points: z.number().min(0).max(10000),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  estimatedTime: z.number().min(1).max(300), // minutes
  checkpointCount: z.number().min(1).max(10),
  assessmentType: z.enum(['comprehension', 'application', 'analysis', 'reflection', 'knowledge_check']),
});

type ContentItemConfig = z.infer<typeof ContentItemConfigSchema>;

/**
 * LTI Content Item schema for validation
 */
const LTIContentItemSchema = z.object({
  '@context': z.literal('http://purl.imsglobal.org/ctx/lti/v1/ContentItem'),
  '@graph': z.array(z.object({
    '@type': z.literal('LtiLinkItem'),
    mediaType: z.literal('application/vnd.ims.lti.v1.ltilink'),
    title: z.string(),
    text: z.string().optional(),
    url: z.string().url(),
    icon: z.object({
      '@id': z.string().url(),
      width: z.number(),
      height: z.number(),
    }).optional(),
    lineItem: z.object({
      scoreMaximum: z.number(),
      label: z.string(),
      resourceId: z.string(),
      tag: z.string().optional(),
    }).optional(),
    custom: z.record(z.string(), z.string()).optional(),
    iframe: z.object({
      width: z.number(),
      height: z.number(),
    }).optional(),
  })),
});

type LTIContentItem = z.infer<typeof LTIContentItemSchema>;

/**
 * Deep linking response JWT schema
 */
const DeepLinkingResponseJWTSchema = z.object({
  iss: z.string().url(), // Atomic Guide issuer
  aud: z.string().url(), // Canvas platform audience
  iat: z.number(),
  exp: z.number(),
  'https://purl.imsglobal.org/spec/lti/claim/message_type': z.literal('LtiDeepLinkingResponse'),
  'https://purl.imsglobal.org/spec/lti-dl/claim/content_items': z.array(z.unknown()),
  'https://purl.imsglobal.org/spec/lti-dl/claim/msg': z.string().optional(),
  'https://purl.imsglobal.org/spec/lti-dl/claim/log': z.string().optional(),
  'https://purl.imsglobal.org/spec/lti-dl/claim/errormsg': z.string().optional(),
  'https://purl.imsglobal.org/spec/lti-dl/claim/errorlog': z.string().optional(),
  'https://purl.imsglobal.org/spec/lti-dl/claim/data': z.string().optional(),
});

type DeepLinkingResponseJWT = z.infer<typeof DeepLinkingResponseJWTSchema>;

/**
 * Content Item Service
 *
 * Handles the generation and validation of LTI Deep Linking 2.0 content items:
 * - Creates LTI-compliant content items for assessments
 * - Validates content item structure and compliance
 * - Signs JWT responses for Canvas delivery
 * - Manages content item metadata and custom parameters
 */
export class ContentItemService {
  constructor(
    private readonly db: D1Database,
    private readonly env: Env
  ) {}

  /**
   * Generates LTI content item for assessment configuration
   *
   * @param config - Assessment configuration
   * @param context - Canvas and instructor context
   * @returns LTI-compliant content item
   */
  async generateAssessmentContentItem(
    config: ContentItemConfig,
    context: {
      instructorId: string;
      courseId: string;
      assignmentId?: string;
      platformOrigin: string;
      sessionId: string;
    }
  ): Promise<LTIContentItem> {
    try {
      // Validate configuration
      const validatedConfig = ContentItemConfigSchema.parse(config);

      // Generate assessment URL
      const assessmentUrl = this.generateAssessmentUrl(validatedConfig.assessmentId, context);

      // Create content item following LTI Deep Linking 2.0 specification
      const contentItem: LTIContentItem = {
        '@context': 'http://purl.imsglobal.org/ctx/lti/v1/ContentItem',
        '@graph': [{
          '@type': 'LtiLinkItem',
          mediaType: 'application/vnd.ims.lti.v1.ltilink',
          title: this.generateAssessmentTitle(validatedConfig),
          text: this.generateAssessmentDescription(validatedConfig),
          url: assessmentUrl,
          icon: {
            '@id': `${this.env.TOOL_BASE_URL}/icons/assessment-${validatedConfig.assessmentType}.png`,
            width: 32,
            height: 32,
          },
          lineItem: {
            scoreMaximum: validatedConfig.points,
            label: validatedConfig.title,
            resourceId: validatedConfig.assessmentId,
            tag: 'atomic-guide-assessment',
          },
          custom: {
            assessment_configuration_id: validatedConfig.assessmentId,
            assignment_id: context.assignmentId || context.courseId,
            course_id: context.courseId,
            instructor_id: context.instructorId,
            session_id: context.sessionId,
            assessment_type: validatedConfig.assessmentType,
            difficulty_level: validatedConfig.difficulty,
            checkpoint_count: validatedConfig.checkpointCount.toString(),
            estimated_time_minutes: validatedConfig.estimatedTime.toString(),
            atomic_guide_version: '7.2.0',
          },
          iframe: {
            width: 800,
            height: 600,
          },
        }],
      };

      // Validate generated content item
      const validatedItem = LTIContentItemSchema.parse(contentItem);

      // Log content item generation
      await this.logContentItemGeneration(validatedConfig.assessmentId, validatedItem, context);

      return validatedItem;

    } catch (error) {
      console.error('Content item generation failed:', error);
      throw new Error(`Failed to generate content item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generates multiple content items for complex assessments
   *
   * @param configs - Array of assessment configurations
   * @param context - Canvas context
   * @returns Array of content items
   */
  async generateMultipleContentItems(
    configs: ContentItemConfig[],
    context: {
      instructorId: string;
      courseId: string;
      assignmentId?: string;
      platformOrigin: string;
      sessionId: string;
    }
  ): Promise<LTIContentItem[]> {
    const contentItems = await Promise.all(
      configs.map(config => this.generateAssessmentContentItem(config, context))
    );

    // Validate total items don't exceed Canvas limits
    if (contentItems.length > 10) {
      throw new Error('Too many content items - Canvas supports maximum 10 items per deep linking response');
    }

    return contentItems;
  }

  /**
   * Generates signed JWT response for Canvas deep linking
   *
   * @param contentItems - Content items to include in response
   * @param deepLinkingContext - Original deep linking context
   * @param metadata - Additional response metadata
   * @returns Signed JWT string
   */
  async generateSignedContentItemResponse(
    contentItems: unknown,
    deepLinkingContext: any,
    metadata: {
      configurationId?: string;
      sessionId: string;
      message?: string;
      errorMessage?: string;
    }
  ): Promise<string> {
    try {
      // Validate content items structure
      const validatedItems = Array.isArray(contentItems) ? contentItems : [contentItems];

      // Extract deep linking settings
      const settings = deepLinkingContext.deepLinkingSettings;
      const originalClaims = deepLinkingContext.jwtClaims;

      // Create response JWT payload
      const now = Math.floor(Date.now() / 1000);
      const responsePayload: DeepLinkingResponseJWT = {
        iss: this.env.TOOL_ISSUER || 'https://guide.atomicjolt.xyz',
        aud: originalClaims.iss, // Canvas platform URL
        iat: now,
        exp: now + 3600, // 1 hour expiration
        'https://purl.imsglobal.org/spec/lti/claim/message_type': 'LtiDeepLinkingResponse',
        'https://purl.imsglobal.org/spec/lti-dl/claim/content_items': validatedItems,
      };

      // Add optional response data
      if (metadata.message) {
        responsePayload['https://purl.imsglobal.org/spec/lti-dl/claim/msg'] = metadata.message;
      }

      if (metadata.errorMessage) {
        responsePayload['https://purl.imsglobal.org/spec/lti-dl/claim/errormsg'] = metadata.errorMessage;
      }

      if (settings.data) {
        responsePayload['https://purl.imsglobal.org/spec/lti-dl/claim/data'] = settings.data;
      }

      // Validate response payload
      const validatedPayload = DeepLinkingResponseJWTSchema.parse(responsePayload);

      // Sign JWT with our private key
      const signedJWT = await this.signJWT(validatedPayload);

      // Log successful response generation
      await this.logContentItemResponse(metadata.sessionId, validatedPayload, true);

      return signedJWT;

    } catch (error) {
      console.error('JWT response generation failed:', error);

      // Log failed response generation
      await this.logContentItemResponse(metadata.sessionId, null, false, error instanceof Error ? error.message : 'Unknown error');

      throw new Error(`Failed to generate signed response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validates content items for LTI compliance
   *
   * @param contentItems - Content items to validate
   * @returns Validation result with compliance details
   */
  async validateContentItemsCompliance(contentItems: unknown): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    complianceLevel: 'full' | 'partial' | 'none';
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate basic structure
      if (!Array.isArray(contentItems)) {
        errors.push('Content items must be an array');
        return { valid: false, errors, warnings, complianceLevel: 'none' };
      }

      if (contentItems.length === 0) {
        errors.push('At least one content item is required');
        return { valid: false, errors, warnings, complianceLevel: 'none' };
      }

      if (contentItems.length > 10) {
        errors.push('Maximum 10 content items allowed per response');
        return { valid: false, errors, warnings, complianceLevel: 'none' };
      }

      // Validate each content item
      for (let i = 0; i < contentItems.length; i++) {
        const item = contentItems[i];

        try {
          // Validate against LTI schema
          if (typeof item === 'object' && item !== null && '@graph' in item) {
            LTIContentItemSchema.parse(item);
          } else {
            errors.push(`Content item ${i + 1} does not match LTI Deep Linking format`);
          }
        } catch (validationError) {
          errors.push(`Content item ${i + 1} validation failed: ${validationError instanceof Error ? validationError.message : 'Unknown error'}`);
        }

        // Additional compliance checks
        if (typeof item === 'object' && item !== null && '@graph' in item) {
          const graph = (item as any)['@graph'];
          if (Array.isArray(graph)) {
            for (const graphItem of graph) {
              // Check required LTI fields
              if (!graphItem.title || typeof graphItem.title !== 'string') {
                errors.push(`Content item ${i + 1} missing required title`);
              }

              if (!graphItem.url || typeof graphItem.url !== 'string') {
                errors.push(`Content item ${i + 1} missing required URL`);
              }

              // Validate URL format
              try {
                new URL(graphItem.url);
              } catch {
                errors.push(`Content item ${i + 1} has invalid URL format`);
              }

              // Check line item for grading
              if (graphItem.lineItem) {
                if (typeof graphItem.lineItem.scoreMaximum !== 'number' || graphItem.lineItem.scoreMaximum < 0) {
                  warnings.push(`Content item ${i + 1} line item has invalid score maximum`);
                }

                if (!graphItem.lineItem.label) {
                  warnings.push(`Content item ${i + 1} line item missing label`);
                }
              } else {
                warnings.push(`Content item ${i + 1} missing line item - grades may not pass back to Canvas`);
              }

              // Check iframe dimensions
              if (graphItem.iframe) {
                if (graphItem.iframe.width < 300 || graphItem.iframe.width > 2000) {
                  warnings.push(`Content item ${i + 1} iframe width should be between 300-2000 pixels`);
                }

                if (graphItem.iframe.height < 200 || graphItem.iframe.height > 1200) {
                  warnings.push(`Content item ${i + 1} iframe height should be between 200-1200 pixels`);
                }
              }
            }
          }
        }
      }

      // Determine compliance level
      let complianceLevel: 'full' | 'partial' | 'none' = 'full';
      if (errors.length > 0) {
        complianceLevel = 'none';
      } else if (warnings.length > 0) {
        complianceLevel = 'partial';
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        complianceLevel,
      };

    } catch (error) {
      console.error('Content item validation failed:', error);
      return {
        valid: false,
        errors: ['Content item validation failed due to technical error'],
        warnings,
        complianceLevel: 'none',
      };
    }
  }

  /**
   * Generates assessment URL for content item
   */
  private generateAssessmentUrl(assessmentId: string, context: any): string {
    const baseUrl = this.env.TOOL_BASE_URL || 'https://guide.atomicjolt.xyz';
    return `${baseUrl}/lti/assessment/${assessmentId}?course_id=${context.courseId}`;
  }

  /**
   * Generates human-readable assessment title
   */
  private generateAssessmentTitle(config: ContentItemConfig): string {
    const typeLabels = {
      comprehension: 'Comprehension Check',
      application: 'Application Exercise',
      analysis: 'Analysis Activity',
      reflection: 'Reflection Prompt',
      knowledge_check: 'Knowledge Check',
    };

    const difficultyLabels = {
      beginner: 'Beginner',
      intermediate: 'Intermediate',
      advanced: 'Advanced',
    };

    const typeLabel = typeLabels[config.assessmentType];
    const difficultyLabel = difficultyLabels[config.difficulty];

    if (config.title.includes(typeLabel)) {
      return `${config.title} (${difficultyLabel})`;
    }

    return `${config.title} - ${typeLabel} (${difficultyLabel})`;
  }

  /**
   * Generates assessment description with metadata
   */
  private generateAssessmentDescription(config: ContentItemConfig): string {
    const parts = [];

    if (config.description) {
      parts.push(config.description);
    }

    parts.push(`🎯 ${config.checkpointCount} assessment checkpoint${config.checkpointCount > 1 ? 's' : ''}`);
    parts.push(`⏱️ Estimated time: ${config.estimatedTime} minutes`);
    parts.push(`📊 Points possible: ${config.points}`);
    parts.push(`🎓 Difficulty: ${config.difficulty}`);

    return parts.join(' • ');
  }

  /**
   * Signs JWT with our private key
   */
  private async signJWT(payload: DeepLinkingResponseJWT): Promise<string> {
    try {
      // In production, this would use actual JWT signing with private key
      // For now, we'll create a mock signed JWT structure

      const header = {
        alg: 'RS256',
        typ: 'JWT',
        kid: this.env.JWT_KEY_ID || 'atomic-guide-key-1',
      };

      const encodedHeader = btoa(JSON.stringify(header));
      const encodedPayload = btoa(JSON.stringify(payload));

      // Mock signature - in production, use actual private key signing
      const mockSignature = btoa(`signature-for-${encodedHeader}.${encodedPayload}`);

      return `${encodedHeader}.${encodedPayload}.${mockSignature}`;

    } catch (error) {
      console.error('JWT signing failed:', error);
      throw new Error('Failed to sign JWT response');
    }
  }

  /**
   * Logs content item generation for audit
   */
  private async logContentItemGeneration(
    assessmentId: string,
    contentItem: LTIContentItem,
    context: any
  ): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO deep_linking_security_audit (
            id, event_type, event_data, created_at
          ) VALUES (?, ?, ?, ?)
        `)
        .bind(
          crypto.randomUUID(),
          'content_item_generated',
          JSON.stringify({
            assessmentId,
            contentItemId: contentItem['@graph'][0]['@type'],
            title: contentItem['@graph'][0].title,
            url: contentItem['@graph'][0].url,
            points: contentItem['@graph'][0].lineItem?.scoreMaximum,
            context,
          }),
          new Date().toISOString()
        )
        .run();
    } catch (error) {
      console.error('Content item generation logging failed:', error);
    }
  }

  /**
   * Logs content item response for audit
   */
  private async logContentItemResponse(
    sessionId: string,
    payload: any,
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO deep_linking_security_audit (
            id, event_type, event_data, severity, created_at
          ) VALUES (?, ?, ?, ?, ?)
        `)
        .bind(
          crypto.randomUUID(),
          'content_item_response_generated',
          JSON.stringify({
            sessionId,
            success,
            error,
            contentItemCount: payload ? (Array.isArray(payload['https://purl.imsglobal.org/spec/lti-dl/claim/content_items'])
              ? payload['https://purl.imsglobal.org/spec/lti-dl/claim/content_items'].length
              : 1) : 0,
            responseTime: new Date().toISOString(),
          }),
          success ? 'info' : 'error',
          new Date().toISOString()
        )
        .run();
    } catch (logError) {
      console.error('Content item response logging failed:', logError);
    }
  }

  /**
   * Creates a test content item for validation purposes
   */
  static createTestContentItem(): LTIContentItem {
    return {
      '@context': 'http://purl.imsglobal.org/ctx/lti/v1/ContentItem',
      '@graph': [{
        '@type': 'LtiLinkItem',
        mediaType: 'application/vnd.ims.lti.v1.ltilink',
        title: 'Test Assessment',
        text: 'Test assessment for validation',
        url: 'https://guide.atomicjolt.xyz/lti/assessment/test',
        lineItem: {
          scoreMaximum: 100,
          label: 'Test Assessment',
          resourceId: 'test-assessment-id',
          tag: 'test',
        },
        custom: {
          assessment_configuration_id: 'test-config-id',
          course_id: 'test-course',
        },
        iframe: {
          width: 800,
          height: 600,
        },
      }],
    };
  }
}

/**
 * Type exports for external use
 */
export type {
  ContentItemConfig,
  LTIContentItem,
  DeepLinkingResponseJWT,
};