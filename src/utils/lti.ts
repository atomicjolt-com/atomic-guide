/**
 * @fileoverview LTI token validation utilities for secure authentication
 * @module utils/lti
 */

import { verify } from 'hono/jwt';

/**
 * Interface for LTI token payload structure
 */
interface LTITokenPayload {
  sub: string; // User ID
  iss: string; // Platform issuer
  aud: string; // Tool client ID
  exp?: number; // Expiration time
  iat?: number; // Issued at time
  'https://purl.imsglobal.org/spec/lti/claim/deployment_id': string;
  'https://purl.imsglobal.org/spec/lti/claim/target_link_uri': string;
  'https://purl.imsglobal.org/spec/lti/claim/context': {
    id: string;
    title?: string;
    type?: string[];
  };
  'https://purl.imsglobal.org/spec/lti/claim/roles': string[];
  'https://purl.imsglobal.org/spec/lti/claim/resource_link'?: {
    id: string;
    title?: string;
    description?: string;
  };
  tenant_id?: string; // Custom claim for multi-tenancy
}

/**
 * Validates an LTI JWT token and returns payload if valid
 * 
 * @param token - JWT token string to validate
 * @param env - Environment bindings containing JWT_SECRET
 * @returns Promise resolving to true if token is valid, false otherwise
 * @throws {Error} If token validation fails due to server error
 */
export async function validateLTIToken(
  token: string,
  env: Env
): Promise<boolean> {
  try {
    if (!token) {
      return false;
    }

    // Get JWT secret from environment
    const secret = env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET environment variable is not set');
      throw new Error('JWT configuration error');
    }

    // Verify the token
    const payload = await verify(token, secret) as unknown as LTITokenPayload;
    
    // Validate required LTI claims
    return validateLTIPayload(payload);
    
  } catch (error) {
    console.error('LTI token validation failed:', error);
    return false;
  }
}

/**
 * Validates LTI token payload structure and required claims
 * 
 * @param payload - Decoded JWT payload
 * @returns True if payload contains required LTI claims
 */
function validateLTIPayload(payload: LTITokenPayload): boolean {
  // Check required LTI claims
  if (!payload.sub) {
    console.error('Missing required claim: sub (user ID)');
    return false;
  }

  if (!payload.iss) {
    console.error('Missing required claim: iss (platform issuer)');
    return false;
  }

  if (!payload.aud) {
    console.error('Missing required claim: aud (tool client ID)');
    return false;
  }

  // Check LTI-specific claims
  if (!payload['https://purl.imsglobal.org/spec/lti/claim/deployment_id']) {
    console.error('Missing required LTI claim: deployment_id');
    return false;
  }

  if (!payload['https://purl.imsglobal.org/spec/lti/claim/target_link_uri']) {
    console.error('Missing required LTI claim: target_link_uri');
    return false;
  }

  if (!payload['https://purl.imsglobal.org/spec/lti/claim/context']?.id) {
    console.error('Missing required LTI claim: context.id');
    return false;
  }

  if (!Array.isArray(payload['https://purl.imsglobal.org/spec/lti/claim/roles']) || 
      payload['https://purl.imsglobal.org/spec/lti/claim/roles'].length === 0) {
    console.error('Missing or invalid LTI claim: roles');
    return false;
  }

  // Check token expiration
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    console.error('Token has expired');
    return false;
  }

  // Check issued at time (not too far in the future)
  if (payload.iat && payload.iat > Math.floor(Date.now() / 1000) + 300) {
    console.error('Token issued too far in the future');
    return false;
  }

  return true;
}

/**
 * Extracts user information from validated LTI token payload
 * 
 * @param token - JWT token string (must be validated first)
 * @param env - Environment bindings containing JWT_SECRET
 * @returns Promise resolving to user information or null if invalid
 */
export async function extractLTIUserInfo(
  token: string,
  env: Env
): Promise<{
  userId: string;
  tenantId: string;
  contextId: string;
  roles: string[];
  deploymentId: string;
} | null> {
  try {
    const secret = env.JWT_SECRET;
    if (!secret) {
      return null;
    }

    const payload = await verify(token, secret) as unknown as LTITokenPayload;
    
    if (!validateLTIPayload(payload)) {
      return null;
    }

    return {
      userId: payload.sub,
      tenantId: payload.tenant_id || payload['https://purl.imsglobal.org/spec/lti/claim/deployment_id'],
      contextId: payload['https://purl.imsglobal.org/spec/lti/claim/context'].id,
      roles: payload['https://purl.imsglobal.org/spec/lti/claim/roles'],
      deploymentId: payload['https://purl.imsglobal.org/spec/lti/claim/deployment_id'],
    };
    
  } catch (error) {
    console.error('Failed to extract LTI user info:', error);
    return null;
  }
}

/**
 * Checks if user has instructor role based on LTI roles
 * 
 * @param roles - Array of LTI role URIs
 * @returns True if user has instructor-level permissions
 */
export function hasInstructorRole(roles: string[]): boolean {
  const instructorRoles = [
    'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor',
    'http://purl.imsglobal.org/vocab/lis/v2/membership#ContentDeveloper',
    'http://purl.imsglobal.org/vocab/lis/v2/membership#TeachingAssistant',
    'Instructor',
    'ContentDeveloper',
    'TeachingAssistant',
  ];
  
  return roles.some(role => instructorRoles.includes(role));
}

/**
 * Checks if user has student role based on LTI roles
 * 
 * @param roles - Array of LTI role URIs
 * @returns True if user has student-level permissions
 */
export function hasStudentRole(roles: string[]): boolean {
  const studentRoles = [
    'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner',
    'Learner',
    'Student',
  ];
  
  return roles.some(role => studentRoles.includes(role));
}