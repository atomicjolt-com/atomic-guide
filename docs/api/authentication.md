# API Authentication

This document describes the authentication mechanisms used in Atomic Guide's API endpoints.

## Overview

Atomic Guide uses JWT (JSON Web Token) based authentication for API requests. The authentication system is built on top of LTI 1.3 security standards and integrates with Cloudflare Workers security features.

## Authentication Flow

### 1. LTI Launch Authentication

The primary authentication method is through LTI 1.3 launch:

1. Platform initiates OIDC flow at `/lti/init`
2. User is redirected to platform's authorization endpoint
3. Platform redirects back to `/lti/redirect` with authorization code
4. Worker validates JWT and creates session
5. Client receives JWT in `window.LAUNCH_SETTINGS.jwt`

### 2. API Request Authentication

All API requests must include the JWT token in the Authorization header:

```typescript
const response = await fetch('/api/endpoint', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${window.LAUNCH_SETTINGS.jwt}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(data),
});
```

## JWT Token Structure

The JWT token contains the following claims:

```typescript
interface JWTPayload {
  sub: string; // User ID
  iss: string; // Platform issuer
  aud: string; // Tool client ID
  exp: number; // Expiration timestamp
  iat: number; // Issued at timestamp
  nonce: string; // Unique nonce

  // LTI-specific claims
  'https://purl.imsglobal.org/spec/lti/claim/context': {
    id: string;
    label: string;
    title: string;
  };
  'https://purl.imsglobal.org/spec/lti/claim/roles': string[];
  'https://purl.imsglobal.org/spec/lti/claim/resource_link': {
    id: string;
  };
}
```

## API Endpoints Authentication

### Public Endpoints

These endpoints do not require authentication:

- `GET /` - Home page
- `GET /lti/init` - LTI initialization
- `GET /lti/redirect` - LTI redirect handler
- `POST /lti/register` - Dynamic registration

### Protected Endpoints

All other API endpoints require valid JWT authentication:

```typescript
// Chat API
POST / api / chat / message;
GET / api / chat / history;

// Assessment API
POST / api / assessment / deep - link;
GET / api / assessment / results;

// Analytics API
GET / api / analytics / performance;
GET / api / analytics / engagement;

// Content API
POST / api / content / extract;
GET / api / content / search;

// Settings API
GET / api / settings / user;
PUT / api / settings / user;
```

## Server-Side JWT Validation

JWT validation is handled automatically by the middleware:

```typescript
import { verifyJWT } from '@shared/server/services/auth';

export async function authenticatedHandler(request: Request, env: Env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 });
  }

  const token = authHeader.slice(7);
  try {
    const payload = await verifyJWT(token, env);
    // Handle authenticated request
    return handleRequest(request, payload);
  } catch (error) {
    return new Response('Invalid token', { status: 401 });
  }
}
```

## Client-Side Authentication

### Accessing JWT Token

The JWT token is available in the global `LAUNCH_SETTINGS` object:

```typescript
// Check if user is authenticated
if (window.LAUNCH_SETTINGS?.jwt) {
  // User is authenticated
  const jwt = window.LAUNCH_SETTINGS.jwt;
}
```

### API Client Helper

Use the provided API client for authenticated requests:

```typescript
import { apiClient } from '@shared/client/services/api';

// API client automatically includes JWT token
const response = await apiClient.post('/api/chat/message', {
  message: 'Hello, world!',
});
```

## Token Refresh

JWT tokens are long-lived and tied to the LTI session. Token refresh is not implemented as tokens are renewed with each LTI launch.

## Error Handling

Common authentication errors and their responses:

| Error                    | Status | Response                                |
| ------------------------ | ------ | --------------------------------------- |
| Missing token            | 401    | `{"error": "Authentication required"}`  |
| Invalid token            | 401    | `{"error": "Invalid token"}`            |
| Expired token            | 401    | `{"error": "Token expired"}`            |
| Insufficient permissions | 403    | `{"error": "Insufficient permissions"}` |

## Security Considerations

1. **Token Storage**: Tokens are stored in memory only, not in localStorage
2. **HTTPS Only**: All authentication flows require HTTPS in production
3. **Token Validation**: Tokens are validated on every request
4. **Audience Validation**: JWT audience claim is validated against client ID
5. **Issuer Validation**: JWT issuer is validated against platform configuration

## Development and Testing

For development, you can generate test tokens using the `/lti/test-token` endpoint (development only):

```bash
curl -X POST https://your-domain.com/lti/test-token \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user", "contextId": "test-context"}'
```

## Troubleshooting

### Common Issues

1. **401 Unauthorized**: Check that JWT token is included in Authorization header
2. **Invalid token**: Verify token format and ensure it hasn't expired
3. **CORS errors**: Ensure requests are made from the same origin or configure CORS
4. **Missing claims**: Verify that required LTI claims are present in the token

### Debug Mode

Enable debug logging to troubleshoot authentication issues:

```typescript
// In development environment
const debug = env.ENVIRONMENT === 'development';
if (debug) {
  console.log('JWT payload:', payload);
}
```
