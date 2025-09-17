/**
 * @fileoverview Deep Linking Handler for LTI 1.3 Deep Linking 2.0
 * Handles Canvas deep linking requests and manages configuration workflows
 * @module features/deep-linking/server/handlers/DeepLinkingHandler
 */

import type { Context } from 'hono';
import { z } from 'zod';
import { createDeepLinkingSessionSecurity } from '../services/DeepLinkingSessionSecurityService';
import { createCanvasContentSanitizationService } from '../services/CanvasContentSanitizationService';
import { ContentItemService } from '../services/ContentItemService';
import { DeepLinkingRepository } from '../repositories/DeepLinkingRepository';

/**
 * LTI Deep Linking request JWT claims schema
 */
const DeepLinkingJWTClaimsSchema = z.object({
  iss: z.string().url(), // Canvas platform issuer
  aud: z.string(), // Atomic Guide client ID
  sub: z.string(), // Instructor user ID
  iat: z.number(),
  exp: z.number(),
  nonce: z.string().optional(),

  // LTI specific claims
  'https://purl.imsglobal.org/spec/lti/claim/message_type': z.literal('LtiDeepLinkingRequest'),
  'https://purl.imsglobal.org/spec/lti/claim/version': z.literal('1.3.0'),
  'https://purl.imsglobal.org/spec/lti/claim/deployment_id': z.string(),
  'https://purl.imsglobal.org/spec/lti/claim/target_link_uri': z.string().url(),
  'https://purl.imsglobal.org/spec/lti/claim/resource_link': z.object({
    id: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
  }).optional(),
  'https://purl.imsglobal.org/spec/lti/claim/context': z.object({
    id: z.string(),
    label: z.string().optional(),
    title: z.string().optional(),
    type: z.array(z.string()).optional(),
  }),
  'https://purl.imsglobal.org/spec/lti/claim/roles': z.array(z.string()),

  // Deep linking specific claims
  'https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings': z.object({
    deep_link_return_url: z.string().url(),
    accept_types: z.array(z.string()),
    accept_presentation_document_targets: z.array(z.string()),
    accept_media_types: z.array(z.string()).optional(),
    accept_multiple: z.boolean().optional(),
    auto_create: z.boolean().optional(),
    title: z.string().optional(),
    text: z.string().optional(),
    data: z.string().optional(),
  }),

  // Canvas assignment context (if available)
  'https://purl.imsglobal.org/spec/lti/claim/custom': z.record(z.string(), z.string()).optional(),
});

type DeepLinkingJWTClaims = z.infer<typeof DeepLinkingJWTClaimsSchema>;

/**
 * Deep linking response schema for content item submission
 */
const DeepLinkingResponseSchema = z.object({
  content_items: z.array(z.unknown()),
  configuration_id: z.string().uuid().optional(),
  session_id: z.string().uuid(),
  csrf_token: z.string(),
});

type DeepLinkingResponse = z.infer<typeof DeepLinkingResponseSchema>;

/**
 * Deep Linking Handler
 *
 * Processes LTI 1.3 Deep Linking 2.0 requests from Canvas:
 * 1. Validates incoming JWT tokens from Canvas
 * 2. Creates secure configuration sessions
 * 3. Launches assessment configuration interface
 * 4. Processes configuration submissions
 * 5. Generates and signs content items for Canvas
 */
export class DeepLinkingHandler {
  private readonly sessionSecurity;
  private readonly contentSanitizer;
  private readonly contentItemService;
  private readonly repository;

  constructor(
    private readonly db: D1Database,
    private readonly ai: Ai,
    private readonly env: Env
  ) {
    this.sessionSecurity = createDeepLinkingSessionSecurity(db);
    this.contentSanitizer = createCanvasContentSanitizationService();
    this.contentItemService = new ContentItemService(db, env);
    this.repository = new DeepLinkingRepository(db);
  }

  /**
   * Handles incoming Canvas deep linking requests
   *
   * @param c - Hono context with request data
   * @returns Redirect to configuration interface or error response
   */
  async handleDeepLinkingRequest(c: Context<{ Bindings: Env }>): Promise<Response> {
    try {
      // Extract and validate JWT from request
      const jwtToken = this.extractJWTFromRequest(c);
      if (!jwtToken) {
        return c.json({ error: 'Missing or invalid LTI JWT token' }, 400);
      }

      // Validate and decode JWT claims
      const claims = await this.validateAndDecodeJWT(jwtToken);

      // Verify instructor permissions
      if (!this.isInstructorRole(claims['https://purl.imsglobal.org/spec/lti/claim/roles'])) {
        return c.json({
          error: 'Insufficient permissions for assessment configuration',
          required_role: 'instructor'
        }, 403);
      }

      // Extract request context
      const origin = c.req.header('origin') || c.req.header('referer') || '';
      const userAgent = c.req.header('user-agent');
      const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for');

      // Create secure session
      const session = await this.sessionSecurity.createSecureSession(
        claims.sub, // instructor ID
        claims['https://purl.imsglobal.org/spec/lti/claim/context'].id, // course ID
        origin,
        {
          userAgent,
          ipAddress,
          platformDeploymentId: claims['https://purl.imsglobal.org/spec/lti/claim/deployment_id'],
          returnUrl: claims['https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings'].deep_link_return_url,
        }
      );

      // Store deep linking context
      await this.repository.storeDeepLinkingContext(session.sessionId, {
        jwtClaims: claims,
        deepLinkingSettings: claims['https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings'],
        canvasAssignmentContext: await this.extractCanvasAssignmentContext(claims),
      });

      // Generate configuration interface URL
      const configurationUrl = new URL(`/lti/deep-link/configure/${session.sessionId}`, c.req.url);
      configurationUrl.searchParams.set('csrf_token', session.csrfToken);
      configurationUrl.searchParams.set('course_id', claims['https://purl.imsglobal.org/spec/lti/claim/context'].id);

      // Log successful deep linking request
      await this.auditLog('deep_linking_request_success', {
        sessionId: session.sessionId,
        instructorId: claims.sub,
        courseId: claims['https://purl.imsglobal.org/spec/lti/claim/context'].id,
        platformIssuer: claims.iss,
        deploymentId: claims['https://purl.imsglobal.org/spec/lti/claim/deployment_id'],
      });

      // Redirect to configuration interface
      return c.redirect(configurationUrl.toString());

    } catch (error) {
      console.error('Deep linking request failed:', error);

      // Log the failure for debugging
      await this.auditLog('deep_linking_request_failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });

      return c.json({
        error: 'Deep linking request processing failed',
        message: 'Please try again or contact support if the issue persists',
      }, 500);
    }
  }

  /**
   * Serves the assessment configuration interface
   *
   * @param c - Hono context
   * @returns Configuration interface HTML
   */
  async serveConfigurationInterface(c: Context<{ Bindings: Env }>): Promise<Response> {
    try {
      const sessionId = c.req.param('sessionId');
      const csrfToken = c.req.query('csrf_token') || '';
      const origin = c.req.header('origin') || c.req.header('referer') || '';

      if (!sessionId) {
        return c.json({ error: 'Missing session ID' }, 400);
      }

      // Validate session
      const validation = await this.sessionSecurity.validateSession(sessionId, csrfToken, origin, {
        updateActivity: true,
      });

      if (!validation.valid || !validation.session) {
        return c.json({
          error: 'Invalid or expired session',
          reason: validation.reason,
          redirect_to: '/lti/error?reason=session_expired'
        }, 401);
      }

      // Get deep linking context
      const context = await this.repository.getDeepLinkingContext(sessionId);
      if (!context) {
        return c.json({ error: 'Deep linking context not found' }, 404);
      }

      // Get Canvas assignment context if available
      const canvasContext = await this.repository.getCanvasAssignmentContext(sessionId);

      // Prepare launch settings for client
      const launchSettings = {
        sessionId,
        csrfToken,
        instructorId: validation.session.instructorId,
        courseId: validation.session.courseId,
        deepLinkingSettings: context.deepLinkingSettings,
        canvasAssignmentContext: canvasContext,
        returnUrl: context.deepLinkingSettings.deep_link_return_url,
        acceptedTypes: context.deepLinkingSettings.accept_types,
        acceptMultiple: context.deepLinkingSettings.accept_multiple || false,
        platformOrigin: new URL(context.jwtClaims.iss).origin,
      };

      // Return the configuration interface HTML
      return c.html(this.generateConfigurationInterfaceHTML(launchSettings));

    } catch (error) {
      console.error('Configuration interface error:', error);
      return c.json({ error: 'Failed to load configuration interface' }, 500);
    }
  }

  /**
   * Processes assessment configuration and generates content items
   *
   * @param c - Hono context with configuration data
   * @returns Content items response for Canvas
   */
  async processConfigurationSubmission(c: Context<{ Bindings: Env }>): Promise<Response> {
    try {
      // Parse and validate request
      const body = await c.req.json();
      const submission = DeepLinkingResponseSchema.parse(body);

      const origin = c.req.header('origin') || '';

      // Validate session
      const validation = await this.sessionSecurity.validateSession(
        submission.session_id,
        submission.csrf_token,
        origin
      );

      if (!validation.valid || !validation.session) {
        return c.json({
          error: 'Invalid session',
          reason: validation.reason
        }, 401);
      }

      // Get deep linking context
      const context = await this.repository.getDeepLinkingContext(submission.session_id);
      if (!context) {
        return c.json({ error: 'Deep linking context not found' }, 404);
      }

      // Sanitize content items
      const sanitizationResult = await this.contentSanitizer.sanitizeContentItems(
        submission.content_items,
        {
          instructorId: validation.session.instructorId,
          courseId: validation.session.courseId,
          platformOrigin: new URL(context.jwtClaims.iss).origin,
          sessionId: submission.session_id,
        }
      );

      if (!sanitizationResult.sanitized || !sanitizationResult.content) {
        return c.json({
          error: 'Content items failed security validation',
          warnings: sanitizationResult.warnings,
          securityFlags: sanitizationResult.securityFlags,
        }, 400);
      }

      // Generate signed JWT response for Canvas
      const signedJWT = await this.contentItemService.generateSignedContentItemResponse(
        sanitizationResult.content,
        context,
        {
          configurationId: submission.configuration_id,
          sessionId: submission.session_id,
        }
      );

      // Log successful content item generation
      await this.repository.logContentItemGeneration({
        sessionId: submission.session_id,
        configurationId: submission.configuration_id || 'direct',
        contentItems: sanitizationResult.content,
        success: true,
        instructorId: validation.session.instructorId,
        courseId: validation.session.courseId,
        deliveryMethod: 'deep_linking',
      });

      // Mark session as completed
      await this.sessionSecurity.invalidateSession(submission.session_id, 'completed');

      // Return signed JWT for Canvas
      return c.json({
        jwt: signedJWT,
        content_items: sanitizationResult.content,
        warnings: sanitizationResult.warnings,
        security_flags: sanitizationResult.securityFlags,
      });

    } catch (error) {
      console.error('Configuration submission failed:', error);

      await this.auditLog('configuration_submission_failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });

      return c.json({
        error: 'Configuration submission failed',
        message: 'Please check your configuration and try again',
      }, 500);
    }
  }

  /**
   * Validates LTI session for configuration interface access
   */
  async validateLTIAccess(c: Context<{ Bindings: Env }>): Promise<Response> {
    try {
      const sessionId = c.req.param('sessionId');
      const csrfToken = c.req.query('csrf_token') || '';
      const origin = c.req.header('origin') || '';

      if (!sessionId) {
        return c.json({ error: 'Missing session ID' }, 400);
      }

      const validation = await this.sessionSecurity.validateSession(sessionId, csrfToken, origin);

      if (!validation.valid) {
        return c.json({
          valid: false,
          reason: validation.reason,
          redirect_url: '/lti/error?reason=' + validation.reason,
        });
      }

      const context = await this.repository.getDeepLinkingContext(sessionId);

      return c.json({
        valid: true,
        session: validation.session,
        context: context ? {
          platformIssuer: context.jwtClaims.iss,
          courseId: context.jwtClaims['https://purl.imsglobal.org/spec/lti/claim/context'].id,
          acceptedTypes: context.deepLinkingSettings.accept_types,
          returnUrl: context.deepLinkingSettings.deep_link_return_url,
        } : null,
      });

    } catch (error) {
      console.error('LTI access validation failed:', error);
      return c.json({ valid: false, reason: 'validation_error' }, 500);
    }
  }

  /**
   * Extracts JWT token from request (POST body or query parameter)
   */
  private extractJWTFromRequest(c: Context): string | null {
    // Try Authorization header first
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try request body (Canvas deep linking format)
    const formData = c.req.raw.body;
    if (formData) {
      // Handle form-encoded JWT parameter
      const jwt = c.req.query('id_token') || c.req.query('JWT');
      if (jwt) return jwt;
    }

    return null;
  }

  /**
   * Validates and decodes JWT token from Canvas
   */
  private async validateAndDecodeJWT(token: string): Promise<DeepLinkingJWTClaims> {
    try {
      // In production, this would validate the JWT signature with Canvas public keys
      // For now, we'll decode and validate the structure

      // Split JWT parts
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      // Decode payload (base64url)
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

      // Validate JWT claims structure
      const claims = DeepLinkingJWTClaimsSchema.parse(payload);

      // Validate token expiration
      const now = Math.floor(Date.now() / 1000);
      if (claims.exp < now) {
        throw new Error('JWT token has expired');
      }

      // Validate issued time (not too far in the future)
      if (claims.iat > now + 300) { // 5 minutes tolerance
        throw new Error('JWT issued time is invalid');
      }

      // Validate audience (our client ID)
      if (claims.aud !== this.env.LTI_CLIENT_ID) {
        throw new Error('JWT audience mismatch');
      }

      return claims;

    } catch (error) {
      console.error('JWT validation failed:', error);
      throw new Error(`Invalid JWT token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Checks if user has instructor role for assessment configuration
   */
  private isInstructorRole(roles: string[]): boolean {
    const instructorRoles = [
      'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor',
      'http://purl.imsglobal.org/vocab/lis/v2/membership#Faculty',
      'http://purl.imsglobal.org/vocab/lis/v2/membership#ContentDeveloper',
      'Instructor',
      'Faculty',
    ];

    return roles.some(role => instructorRoles.includes(role));
  }

  /**
   * Extracts Canvas assignment context from JWT claims
   */
  private async extractCanvasAssignmentContext(claims: DeepLinkingJWTClaims): Promise<any> {
    const custom = claims['https://purl.imsglobal.org/spec/lti/claim/custom'] || {};
    const resourceLink = claims['https://purl.imsglobal.org/spec/lti/claim/resource_link'];
    const context = claims['https://purl.imsglobal.org/spec/lti/claim/context'];

    return {
      assignmentId: custom.assignment_id || resourceLink?.id,
      assignmentTitle: custom.assignment_title || resourceLink?.title,
      courseId: context.id,
      courseName: context.title || context.label,
      contextType: context.type,
      customParams: custom,
    };
  }

  /**
   * Generates the configuration interface HTML
   */
  private generateConfigurationInterfaceHTML(launchSettings: any): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Assessment Configuration - Atomic Guide</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #FFFDF0;
            color: #333;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #FFDD00, #EBCB00);
            padding: 20px;
            color: #333;
        }
        .loading {
            padding: 40px;
            text-align: center;
        }
        .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #FFDD00;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 2s linear infinite;
            margin: 0 auto 20px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .error {
            padding: 20px;
            background: #FEF3F2;
            border: 1px solid #F87171;
            border-radius: 4px;
            color: #B42318;
            margin: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 Assessment Configuration</h1>
            <p>Configure AI-powered assessment checkpoints for your Canvas assignment</p>
        </div>

        <div id="app">
            <div class="loading">
                <div class="spinner"></div>
                <p>Loading assessment configuration interface...</p>
            </div>
        </div>
    </div>

    <script>
        // Pass launch settings to client application
        window.LAUNCH_SETTINGS = ${JSON.stringify(launchSettings)};
        window.DEEP_LINKING_MODE = true;

        // Load the React application
        const script = document.createElement('script');
        script.src = '/static/js/deep-linking-app.js';
        script.onerror = function() {
            document.getElementById('app').innerHTML = \`
                <div class="error">
                    <h3>⚠️ Application Loading Failed</h3>
                    <p>Unable to load the assessment configuration interface. Please refresh the page or contact support.</p>
                    <button onclick="window.location.reload()" style="
                        background: #FFDD00;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-weight: bold;
                    ">Retry</button>
                </div>
            \`;
        };
        document.head.appendChild(script);
    </script>
</body>
</html>`;
  }

  /**
   * Logs audit events for security and debugging
   */
  private async auditLog(eventType: string, data: Record<string, any>): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO deep_linking_security_audit (
            id, event_type, event_data, created_at
          ) VALUES (?, ?, ?, ?)
        `)
        .bind(
          crypto.randomUUID(),
          eventType,
          JSON.stringify(data),
          new Date().toISOString()
        )
        .run();
    } catch (error) {
      console.error('Audit logging failed:', error);
    }
  }
}

/**
 * Factory function for creating deep linking handler
 */
export function createDeepLinkingHandler(
  db: D1Database,
  ai: Ai,
  env: Env
): DeepLinkingHandler {
  return new DeepLinkingHandler(db, ai, env);
}

/**
 * Type exports
 */
export type {
  DeepLinkingJWTClaims,
  DeepLinkingResponse,
};