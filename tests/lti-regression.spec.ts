/**
 * LTI 1.3 Regression Test Specifications
 * Ensures all existing LTI functionality remains intact during brownfield enhancements
 *
 * Critical: These tests MUST pass before any new feature deployment
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { UnstableDevWorker } from 'wrangler';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';

describe('LTI 1.3 Regression Tests', () => {
  let worker: UnstableDevWorker;

  // Test configuration
  const TEST_DOMAIN = 'http://localhost:8787';
  const TEST_ISS = 'https://canvas.test.edu';
  const TEST_CLIENT_ID = 'test_client_123';
  const TEST_DEPLOYMENT_ID = 'deployment_456';
  const TEST_USER_ID = 'user_789';
  const TEST_CONTEXT_ID = 'course_101';

  // Mock JWT keys for testing
  const testPrivateKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA1234567890...
-----END RSA PRIVATE KEY-----`;

  const testPublicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1234567890...
-----END PUBLIC KEY-----`;

  beforeAll(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true },
      local: true,
      vars: {
        ENVIRONMENT: 'test',
      },
    });
  });

  afterAll(async () => {
    await worker.stop();
  });

  describe('Core LTI Endpoints', () => {
    describe('GET /lti/jwks', () => {
      it('should return valid JWKS with public keys', async () => {
        const response = await worker.fetch('/lti/jwks');

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('application/json');

        const jwks = await response.json();
        expect(jwks).toHaveProperty('keys');
        expect(Array.isArray(jwks.keys)).toBe(true);
        expect(jwks.keys.length).toBeGreaterThan(0);

        // Validate JWKS structure
        jwks.keys.forEach((key: any) => {
          expect(key).toHaveProperty('kty');
          expect(key).toHaveProperty('use', 'sig');
          expect(key).toHaveProperty('kid');
          expect(key).toHaveProperty('n'); // RSA modulus
          expect(key).toHaveProperty('e'); // RSA exponent
        });
      });

      it('should maintain consistent key IDs across requests', async () => {
        const response1 = await worker.fetch('/lti/jwks');
        const jwks1 = await response1.json();

        const response2 = await worker.fetch('/lti/jwks');
        const jwks2 = await response2.json();

        expect(jwks1.keys[0].kid).toBe(jwks2.keys[0].kid);
      });
    });

    describe('POST /lti/init', () => {
      it('should handle OIDC initialization request', async () => {
        const initParams = new URLSearchParams({
          iss: TEST_ISS,
          login_hint: TEST_USER_ID,
          target_link_uri: `${TEST_DOMAIN}/lti/launch`,
          lti_message_hint: 'test_hint',
          client_id: TEST_CLIENT_ID,
          lti_deployment_id: TEST_DEPLOYMENT_ID,
        });

        const response = await worker.fetch('/lti/init', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: initParams.toString(),
        });

        expect(response.status).toBe(302); // Redirect to platform auth

        const location = response.headers.get('location');
        expect(location).toBeTruthy();
        expect(location).toContain('response_type=id_token');
        expect(location).toContain('response_mode=form_post');
        expect(location).toContain('scope=openid');
        expect(location).toContain('prompt=none');

        // Verify state and nonce are generated
        const url = new URL(location!);
        expect(url.searchParams.get('state')).toBeTruthy();
        expect(url.searchParams.get('nonce')).toBeTruthy();
      });

      it('should reject invalid issuer', async () => {
        const initParams = new URLSearchParams({
          iss: 'https://invalid.issuer.com',
          login_hint: TEST_USER_ID,
          target_link_uri: `${TEST_DOMAIN}/lti/launch`,
          client_id: TEST_CLIENT_ID,
          lti_deployment_id: TEST_DEPLOYMENT_ID,
        });

        const response = await worker.fetch('/lti/init', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: initParams.toString(),
        });

        expect(response.status).toBe(400);
        const error = await response.text();
        expect(error).toContain('Invalid platform');
      });

      it('should require all mandatory parameters', async () => {
        const requiredParams = ['iss', 'login_hint', 'target_link_uri'];

        for (const missingParam of requiredParams) {
          const params: any = {
            iss: TEST_ISS,
            login_hint: TEST_USER_ID,
            target_link_uri: `${TEST_DOMAIN}/lti/launch`,
            client_id: TEST_CLIENT_ID,
            lti_deployment_id: TEST_DEPLOYMENT_ID,
          };

          delete params[missingParam];

          const response = await worker.fetch('/lti/init', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(params).toString(),
          });

          expect(response.status).toBe(400);
          const error = await response.text();
          expect(error).toContain(missingParam);
        }
      });
    });

    describe('POST /lti/redirect', () => {
      it('should handle authentication response with valid JWT', async () => {
        // Create a valid JWT for testing
        const now = Math.floor(Date.now() / 1000);
        const idToken = jwt.sign(
          {
            iss: TEST_ISS,
            sub: TEST_USER_ID,
            aud: TEST_CLIENT_ID,
            exp: now + 3600,
            iat: now,
            nonce: 'test_nonce_123',
            'https://purl.imsglobal.org/spec/lti/claim/deployment_id': TEST_DEPLOYMENT_ID,
            'https://purl.imsglobal.org/spec/lti/claim/message_type': 'LtiResourceLinkRequest',
            'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
            'https://purl.imsglobal.org/spec/lti/claim/resource_link': {
              id: 'resource_123',
              title: 'Test Resource',
            },
            'https://purl.imsglobal.org/spec/lti/claim/context': {
              id: TEST_CONTEXT_ID,
              title: 'Test Course',
              type: ['CourseSection'],
            },
          },
          testPrivateKey,
          { algorithm: 'RS256', keyid: 'test_key_1' },
        );

        const response = await worker.fetch('/lti/redirect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            id_token: idToken,
            state: 'valid_state_123',
          }).toString(),
        });

        expect(response.status).toBe(302); // Redirect to launch

        const location = response.headers.get('location');
        expect(location).toContain('/lti/launch');
        expect(location).toContain('token=');
      });

      it('should reject expired JWT', async () => {
        const expiredTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
        const idToken = jwt.sign(
          {
            iss: TEST_ISS,
            sub: TEST_USER_ID,
            aud: TEST_CLIENT_ID,
            exp: expiredTime + 60, // Expired
            iat: expiredTime,
            nonce: 'test_nonce_123',
            'https://purl.imsglobal.org/spec/lti/claim/deployment_id': TEST_DEPLOYMENT_ID,
            'https://purl.imsglobal.org/spec/lti/claim/message_type': 'LtiResourceLinkRequest',
            'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
          },
          testPrivateKey,
          { algorithm: 'RS256', keyid: 'test_key_1' },
        );

        const response = await worker.fetch('/lti/redirect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            id_token: idToken,
            state: 'valid_state_123',
          }).toString(),
        });

        expect(response.status).toBe(401);
        const error = await response.text();
        expect(error).toContain('expired');
      });

      it('should validate required LTI claims', async () => {
        const requiredClaims = [
          'https://purl.imsglobal.org/spec/lti/claim/deployment_id',
          'https://purl.imsglobal.org/spec/lti/claim/message_type',
          'https://purl.imsglobal.org/spec/lti/claim/version',
        ];

        for (const missingClaim of requiredClaims) {
          const now = Math.floor(Date.now() / 1000);
          const claims: any = {
            iss: TEST_ISS,
            sub: TEST_USER_ID,
            aud: TEST_CLIENT_ID,
            exp: now + 3600,
            iat: now,
            nonce: 'test_nonce_123',
            'https://purl.imsglobal.org/spec/lti/claim/deployment_id': TEST_DEPLOYMENT_ID,
            'https://purl.imsglobal.org/spec/lti/claim/message_type': 'LtiResourceLinkRequest',
            'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
          };

          delete claims[missingClaim];

          const idToken = jwt.sign(claims, testPrivateKey, {
            algorithm: 'RS256',
            keyid: 'test_key_1',
          });

          const response = await worker.fetch('/lti/redirect', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              id_token: idToken,
              state: 'valid_state_123',
            }).toString(),
          });

          expect(response.status).toBe(400);
        }
      });
    });

    describe('GET /lti/launch', () => {
      it('should serve launch page with valid token', async () => {
        const launchToken = jwt.sign(
          {
            user_id: TEST_USER_ID,
            context_id: TEST_CONTEXT_ID,
            roles: ['Instructor'],
            resource_link_id: 'resource_123',
          },
          'test_secret',
        );

        const response = await worker.fetch(`/lti/launch?token=${launchToken}`);

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('text/html');

        const html = await response.text();
        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('app.js'); // Should include app script
        expect(html).toContain('app.css'); // Should include styles
      });

      it('should reject launch without token', async () => {
        const response = await worker.fetch('/lti/launch');

        expect(response.status).toBe(400);
        const error = await response.text();
        expect(error).toContain('token');
      });

      it('should set appropriate security headers', async () => {
        const launchToken = jwt.sign(
          {
            user_id: TEST_USER_ID,
            context_id: TEST_CONTEXT_ID,
          },
          'test_secret',
        );

        const response = await worker.fetch(`/lti/launch?token=${launchToken}`);

        // Check frame options for LMS embedding
        expect(response.headers.get('x-frame-options')).toBe('ALLOWALL');

        // Check CSP headers
        const csp = response.headers.get('content-security-policy');
        expect(csp).toContain('frame-ancestors');
      });
    });

    describe('POST /lti/register', () => {
      it('should handle dynamic registration request', async () => {
        const registrationToken = 'test_registration_token';

        const response = await worker.fetch(
          `/lti/register?openid_configuration=https://canvas.test.edu/.well-known/openid-configuration&registration_token=${registrationToken}`,
          {
            method: 'POST',
          },
        );

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('application/json');

        const registration = await response.json();

        // Validate registration response structure
        expect(registration).toHaveProperty('application_type', 'web');
        expect(registration).toHaveProperty('grant_types');
        expect(registration.grant_types).toContain('implicit');
        expect(registration.grant_types).toContain('client_credentials');

        expect(registration).toHaveProperty('initiate_login_uri');
        expect(registration.initiate_login_uri).toContain('/lti/init');

        expect(registration).toHaveProperty('redirect_uris');
        expect(registration.redirect_uris).toContain(`${TEST_DOMAIN}/lti/redirect`);

        expect(registration).toHaveProperty('jwks_uri');
        expect(registration.jwks_uri).toContain('/lti/jwks');

        // Validate LTI configuration
        expect(registration).toHaveProperty('https://purl.imsglobal.org/spec/lti-tool-configuration');
        const ltiConfig = registration['https://purl.imsglobal.org/spec/lti-tool-configuration'];

        expect(ltiConfig).toHaveProperty('domain');
        expect(ltiConfig).toHaveProperty('target_link_uri');
        expect(ltiConfig).toHaveProperty('claims');
        expect(ltiConfig).toHaveProperty('messages');
      });

      it('should require openid_configuration parameter', async () => {
        const response = await worker.fetch('/lti/register', {
          method: 'POST',
        });

        expect(response.status).toBe(400);
        const error = await response.text();
        expect(error).toContain('openid_configuration');
      });
    });

    describe('POST /lti/names_and_roles', () => {
      it('should return roster with valid service token', async () => {
        const serviceToken = jwt.sign(
          {
            iss: TEST_ISS,
            sub: TEST_CLIENT_ID,
            aud: `${TEST_DOMAIN}/lti/names_and_roles`,
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000),
            context_id: TEST_CONTEXT_ID,
          },
          testPrivateKey,
          { algorithm: 'RS256' },
        );

        const response = await worker.fetch('/lti/names_and_roles', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            context_id: TEST_CONTEXT_ID,
          }),
        });

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('application/vnd.ims.lti-nrps.v2.membershipcontainer+json');

        const roster = await response.json();
        expect(roster).toHaveProperty('id');
        expect(roster).toHaveProperty('context');
        expect(roster).toHaveProperty('members');
        expect(Array.isArray(roster.members)).toBe(true);
      });

      it('should require authorization header', async () => {
        const response = await worker.fetch('/lti/names_and_roles', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            context_id: TEST_CONTEXT_ID,
          }),
        });

        expect(response.status).toBe(401);
        const error = await response.text();
        expect(error).toContain('Authorization');
      });

      it('should validate context_id in request', async () => {
        const serviceToken = jwt.sign(
          {
            iss: TEST_ISS,
            sub: TEST_CLIENT_ID,
            aud: `${TEST_DOMAIN}/lti/names_and_roles`,
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000),
            context_id: TEST_CONTEXT_ID,
          },
          testPrivateKey,
          { algorithm: 'RS256' },
        );

        const response = await worker.fetch('/lti/names_and_roles', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            context_id: 'different_context',
          }),
        });

        expect(response.status).toBe(403);
        const error = await response.text();
        expect(error).toContain('context');
      });
    });

    describe('POST /lti/sign_deep_link', () => {
      it('should sign deep link content items', async () => {
        const deepLinkRequest = {
          iss: TEST_ISS,
          aud: TEST_CLIENT_ID,
          deployment_id: TEST_DEPLOYMENT_ID,
          message: 'Selection complete',
          content_items: [
            {
              type: 'ltiResourceLink',
              title: 'Test Resource',
              url: 'https://tool.example.com/resource/123',
              custom: {
                chapter: '12',
                section: '3',
              },
            },
          ],
        };

        const response = await worker.fetch('/lti/sign_deep_link', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(deepLinkRequest),
        });

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('application/json');

        const result = await response.json();
        expect(result).toHaveProperty('jwt');

        // Decode and validate the JWT structure
        const decoded = jwt.decode(result.jwt, { complete: true });
        expect(decoded).toBeTruthy();
        expect(decoded?.payload).toHaveProperty('iss');
        expect(decoded?.payload).toHaveProperty('aud', TEST_ISS);
        expect(decoded?.payload).toHaveProperty('https://purl.imsglobal.org/spec/lti-dl/claim/content_items');
      });

      it('should require content_items in request', async () => {
        const response = await worker.fetch('/lti/sign_deep_link', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            iss: TEST_ISS,
            aud: TEST_CLIENT_ID,
            deployment_id: TEST_DEPLOYMENT_ID,
          }),
        });

        expect(response.status).toBe(400);
        const error = await response.text();
        expect(error).toContain('content_items');
      });
    });
  });

  describe('Platform Configuration Persistence', () => {
    it('should maintain platform configurations across requests', async () => {
      // First request to establish platform
      const initParams1 = new URLSearchParams({
        iss: TEST_ISS,
        login_hint: 'user1',
        target_link_uri: `${TEST_DOMAIN}/lti/launch`,
        client_id: TEST_CLIENT_ID,
        lti_deployment_id: TEST_DEPLOYMENT_ID,
      });

      const response1 = await worker.fetch('/lti/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: initParams1.toString(),
      });

      expect(response1.status).toBe(302);

      // Second request with same platform
      const initParams2 = new URLSearchParams({
        iss: TEST_ISS,
        login_hint: 'user2',
        target_link_uri: `${TEST_DOMAIN}/lti/launch`,
        client_id: TEST_CLIENT_ID,
        lti_deployment_id: TEST_DEPLOYMENT_ID,
      });

      const response2 = await worker.fetch('/lti/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: initParams2.toString(),
      });

      expect(response2.status).toBe(302);

      // Both should redirect to same auth endpoint
      const location1 = response1.headers.get('location');
      const location2 = response2.headers.get('location');

      const url1 = new URL(location1!);
      const url2 = new URL(location2!);

      expect(url1.origin).toBe(url2.origin);
      expect(url1.pathname).toBe(url2.pathname);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed JWT gracefully', async () => {
      const response = await worker.fetch('/lti/redirect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          id_token: 'not.a.valid.jwt',
          state: 'test_state',
        }).toString(),
      });

      expect(response.status).toBe(400);
      const error = await response.text();
      expect(error).toContain('Invalid token');
    });

    it('should handle missing state parameter', async () => {
      const now = Math.floor(Date.now() / 1000);
      const idToken = jwt.sign(
        {
          iss: TEST_ISS,
          sub: TEST_USER_ID,
          aud: TEST_CLIENT_ID,
          exp: now + 3600,
          iat: now,
          nonce: 'test_nonce',
        },
        testPrivateKey,
        { algorithm: 'RS256' },
      );

      const response = await worker.fetch('/lti/redirect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          id_token: idToken,
        }).toString(),
      });

      expect(response.status).toBe(400);
      const error = await response.text();
      expect(error).toContain('state');
    });

    it('should handle concurrent launches without collision', async () => {
      const launches = Array.from({ length: 10 }, (_, i) => {
        const params = new URLSearchParams({
          iss: TEST_ISS,
          login_hint: `user_${i}`,
          target_link_uri: `${TEST_DOMAIN}/lti/launch`,
          client_id: TEST_CLIENT_ID,
          lti_deployment_id: TEST_DEPLOYMENT_ID,
        });

        return worker.fetch('/lti/init', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        });
      });

      const responses = await Promise.all(launches);

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(302);
      });

      // Each should have unique state
      const states = responses.map((r) => {
        const location = r.headers.get('location');
        const url = new URL(location!);
        return url.searchParams.get('state');
      });

      const uniqueStates = new Set(states);
      expect(uniqueStates.size).toBe(10);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should respond to JWKS endpoint within 100ms', async () => {
      const start = performance.now();
      const response = await worker.fetch('/lti/jwks');
      const duration = performance.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(100);
    });

    it('should handle launch flow within 200ms', async () => {
      const launchToken = jwt.sign(
        {
          user_id: TEST_USER_ID,
          context_id: TEST_CONTEXT_ID,
        },
        'test_secret',
      );

      const start = performance.now();
      const response = await worker.fetch(`/lti/launch?token=${launchToken}`);
      const duration = performance.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(200);
    });
  });
});

describe('Backward Compatibility Tests', () => {
  let worker: UnstableDevWorker;

  beforeAll(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true },
      local: true,
    });
  });

  afterAll(async () => {
    await worker.stop();
  });

  it('should maintain existing route structure', async () => {
    const routes = [
      { path: '/lti/init', method: 'POST' },
      { path: '/lti/redirect', method: 'POST' },
      { path: '/lti/launch', method: 'GET' },
      { path: '/lti/jwks', method: 'GET' },
      { path: '/lti/register', method: 'POST' },
      { path: '/lti/names_and_roles', method: 'POST' },
      { path: '/lti/sign_deep_link', method: 'POST' },
    ];

    for (const route of routes) {
      const response = await worker.fetch(route.path, {
        method: route.method,
      });

      // Should not return 404
      expect(response.status).not.toBe(404);
    }
  });

  it('should preserve existing response formats', async () => {
    // JWKS format
    const jwksResponse = await worker.fetch('/lti/jwks');
    const jwks = await jwksResponse.json();
    expect(jwks).toHaveProperty('keys');

    // Registration format
    const regResponse = await worker.fetch('/lti/register?openid_configuration=https://test.edu/.well-known/openid-configuration', {
      method: 'POST',
    });
    const registration = await regResponse.json();
    expect(registration).toHaveProperty('application_type');
    expect(registration).toHaveProperty('initiate_login_uri');
  });
});
