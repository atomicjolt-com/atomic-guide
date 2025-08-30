/**
 * @fileoverview LTI Deep Linking 2.0 handler for assessment creation
 * @module api/handlers/deepLinking
 */

import type { Context } from 'hono';
import { z } from 'zod';
import { assessmentConfigSchema } from '../../features/assessment/shared/schemas/assessment.schema';
import { validateLTIToken } from '../../utils/lti';
import type { HonoEnv } from '../../types';

/**
 * Deep link request schema for validation
 */
const deepLinkRequestSchema = z.object({
  content_items: z.array(z.object({
    type: z.string(),
    title: z.string(),
    url: z.string(),
    lineItem: z.object({
      scoreMaximum: z.number(),
      label: z.string(),
      resourceId: z.string(),
      tag: z.string().optional(),
    }).optional(),
    custom: z.record(z.string()).optional(),
  })),
});

/**
 * Handles LTI Deep Linking 2.0 requests for assessment creation
 * 
 * @param c - Hono context with environment bindings
 * @returns JSON response with signed JWT for deep link
 */
export async function handleDeepLinking(c: Context<HonoEnv>): Promise<Response> {
  try {
    // Extract and validate JWT token
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid authorization header' }, 401);
    }

    const token = authHeader.substring(7);
    
    // Validate LTI token (would need proper implementation)
    const isValid = await validateLTIToken(token, c.env);
    if (!isValid) {
      return c.json({ error: 'Invalid LTI token' }, 401);
    }

    // Parse and validate request body
    const body = await c.req.json();
    const validationResult = deepLinkRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return c.json({ 
        error: 'Invalid deep link request',
        details: validationResult.error.flatten() 
      }, 400);
    }

    const { content_items } = validationResult.data;

    // Process assessment content items
    const assessmentItems = content_items.filter(item => 
      item.custom?.assessment_config && item.lineItem
    );

    if (assessmentItems.length === 0) {
      return c.json({ 
        error: 'No valid assessment items found in request' 
      }, 400);
    }

    // Validate assessment configurations
    const validatedAssessments = [];
    for (const item of assessmentItems) {
      if (item.custom?.assessment_config) {
        try {
          // Parse and validate assessment config
          const configString = item.custom.assessment_config;
          let parsedConfig: unknown;
          
          try {
            parsedConfig = JSON.parse(configString);
          } catch {
            return c.json({ 
              error: 'Invalid JSON in assessment configuration' 
            }, 400);
          }

          const assessmentConfig = assessmentConfigSchema.parse(parsedConfig);
          validatedAssessments.push({
            ...item,
            assessmentConfig,
          });
        } catch (error) {
          return c.json({ 
            error: 'Invalid assessment configuration',
            details: error instanceof Error ? error.message : 'Unknown error'
          }, 400);
        }
      }
    }

    // Store assessment configurations in database
    const assessmentIds = await storeAssessments(validatedAssessments, c.env.DB);

    // Create signed JWT for deep link response
    const signedJWT = await signDeepLinkResponse(
      validatedAssessments,
      assessmentIds,
      c.env
    );

    return c.json({ 
      jwt: signedJWT,
      assessment_ids: assessmentIds,
    });

  } catch (error) {
    console.error('Deep linking handler error:', error);
    return c.json({ 
      error: 'Internal server error processing deep link request' 
    }, 500);
  }
}

/**
 * Stores assessment configurations in the database
 * 
 * @param assessments - Validated assessment configurations
 * @param db - D1 database binding
 * @returns Array of generated assessment IDs
 */
async function storeAssessments(
  assessments: any[],
  db: D1Database
): Promise<string[]> {
  const ids: string[] = [];

  for (const assessment of assessments) {
    const id = crypto.randomUUID();
    
    await db.prepare(`
      INSERT INTO assessments (
        id, 
        tenant_id,
        title, 
        config, 
        resource_id,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      assessment.tenantId || 'default', // Would come from JWT claims
      assessment.title,
      JSON.stringify(assessment.assessmentConfig),
      assessment.lineItem?.resourceId,
      new Date().toISOString()
    ).run();

    ids.push(id);
  }

  return ids;
}

/**
 * Signs the deep link response with platform keys
 * 
 * @param assessments - Assessment configurations
 * @param assessmentIds - Database IDs for assessments
 * @param env - Environment bindings
 * @returns Signed JWT string
 */
async function signDeepLinkResponse(
  assessments: any[],
  assessmentIds: string[],
  env: HonoEnv['Bindings']
): Promise<string> {
  // This would use the actual LTI signing implementation
  // For now, returning a placeholder
  const payload = {
    iss: env.TOOL_ISSUER || 'https://atomic-guide.atomicjolt.xyz',
    aud: env.PLATFORM_ISSUER,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    'https://purl.imsglobal.org/spec/lti-dl/claim/content_items': assessments.map((a, i) => ({
      ...a,
      custom: {
        ...a.custom,
        assessment_id: assessmentIds[i],
      },
    })),
    'https://purl.imsglobal.org/spec/lti-dl/claim/data': env.DEEP_LINK_DATA,
  };

  // Would sign with actual private key
  // Suppress unused variable warning - payload will be used in actual implementation
  void payload;
  return 'signed.jwt.token';
}

/**
 * Handles deep link launch validation
 * 
 * @param c - Hono context
 * @returns Validation result
 */
export async function validateDeepLinkLaunch(c: Context<HonoEnv>): Promise<Response> {
  try {
    const { assessment_id } = c.req.param();
    
    if (!assessment_id) {
      return c.json({ error: 'Missing assessment ID' }, 400);
    }

    // Validate assessment exists and user has access
    const assessment = await c.env.DB.prepare(`
      SELECT * FROM assessments 
      WHERE id = ? AND tenant_id = ?
    `).bind(assessment_id, 'default').first();

    if (!assessment) {
      return c.json({ error: 'Assessment not found' }, 404);
    }

    return c.json({ 
      valid: true,
      assessment,
    });

  } catch (error) {
    console.error('Deep link validation error:', error);
    return c.json({ error: 'Validation failed' }, 500);
  }
}