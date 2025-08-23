# LTI 1.3 Developer Guide for AI Developers

## Executive Summary

This guide provides comprehensive documentation for AI developers working with LTI 1.3 implementations, specifically focusing on how to leverage the Atomic Jolt libraries to simplify LTI integration tasks. LTI (Learning Tools Interoperability) 1.3 is the modern standard for integrating external educational tools with Learning Management Systems (LMS).

## Understanding LTI 1.3 Core Concepts

### What is LTI 1.3?

LTI 1.3 is a secure, modern protocol that enables seamless integration between Learning Management Systems (platforms) and external educational tools. It replaces the older LTI 1.1 standard with improved security using OAuth 2.0, OpenID Connect, and JWT tokens.

### Key Components

1. **Platform**: The LMS or learning environment (Canvas, Blackboard, Moodle, etc.)
2. **Tool**: The external application providing educational functionality
3. **Security Model**: OAuth 2.0 + OpenID Connect + JWT
4. **Message Exchange**: Secure, signed messages using JSON Web Tokens

### Core LTI 1.3 Services

#### 1. Resource Link Launch
- Primary workflow for launching external tools from LMS
- Carries user context, course information, and permissions
- Uses JWT for secure message passing

#### 2. Deep Linking (LTI-DL v2.0)
- Enables content selection and configuration
- Workflow:
  - Platform initiates deep linking request
  - User selects content in tool
  - Tool returns selected items to platform
- Supports multiple content types (links, files, HTML, images)

#### 3. Names and Roles Provisioning Services (NRPS v2.0)
- Retrieves course roster and user roles
- Requires OAuth 2.0 access token with specific scope
- Supports pagination and filtering
- Privacy-conscious with consent-based data sharing

#### 4. Assignment and Grade Services (AGS v2.0)
- Manages gradebook integration
- Three core services:
  - Line Items: Manage gradebook columns
  - Scores: Submit grades
  - Results: Retrieve grades
- Replaces Basic Outcomes from LTI 1.1

## Atomic Jolt Libraries Overview

### Library Architecture

```
@atomicjolt/lti-endpoints  → Server-side Cloudflare Workers endpoints
@atomicjolt/lti-server     → Server-side utilities for any Node.js environment
@atomicjolt/lti-client     → Client-side JavaScript for browser
@atomicjolt/lti-components → React UI components for LTI features
@atomicjolt/lti-types      → TypeScript type definitions
```

### When to Use Each Library

#### @atomicjolt/lti-endpoints
**Use when**: Building on Cloudflare Workers
**Purpose**: Complete endpoint implementation for serverless LTI
**Key Features**:
- Pre-built routes for OIDC, redirect, and launch
- KV namespace integration for state management
- JWT validation and signing
- Platform registration support

#### @atomicjolt/lti-server
**Use when**: Building on traditional Node.js servers
**Purpose**: Server-side LTI handling utilities
**Key Features**:
- JWT validation
- Nonce and state management
- Platform integration helpers
- Security utilities

#### @atomicjolt/lti-client
**Use when**: Implementing client-side LTI interactions
**Purpose**: Browser-based LTI launch handling
**Key Features**:
- `initOIDCLaunch()`: Handle OIDC initialization
- `ltiLaunch()`: Process final launch
- State management in browser
- Post-message communication

#### @atomicjolt/lti-components
**Use when**: Building React-based LTI tools
**Purpose**: Pre-built UI components for LTI features
**Key Features**:
- React components for common LTI UI patterns
- TypeScript support
- Integration with other atomic-libs packages

#### @atomicjolt/lti-types
**Use when**: Any TypeScript LTI implementation
**Purpose**: Type safety for LTI development
**Key Features**:
- Complete LTI 1.3 type definitions
- Message type interfaces
- Claim type definitions
- Service type definitions

## Implementation Patterns

### Basic LTI Launch Flow

```typescript
// 1. Platform initiates at /lti/init
import { handleOIDCInit } from '@atomicjolt/lti-endpoints';

// 2. Handle redirect from platform at /lti/redirect
import { validateRedirect } from '@atomicjolt/lti-endpoints';

// 3. Process launch at /lti/launch
import { IdToken } from '@atomicjolt/lti-types';
import { validateLaunch } from '@atomicjolt/lti-endpoints';

// Client-side
import { ltiLaunch } from '@atomicjolt/lti-client';
await ltiLaunch();
```

### Deep Linking Implementation

```typescript
// Receive deep linking request
import { DeepLinkingRequest } from '@atomicjolt/lti-types';

// Return selected content
const response = {
  type: 'LtiDeepLinkingResponse',
  content_items: [
    {
      type: 'ltiResourceLink',
      title: 'Selected Resource',
      url: 'https://tool.example/resource/123'
    }
  ]
};
```

### Names and Roles Service

```typescript
// Server-side: Request roster
const roster = await fetchNamesAndRoles(accessToken, contextMembershipsUrl);

// Handle pagination
if (roster.headers['link']?.includes('rel="next"')) {
  // Fetch next page
}
```

### Assignment and Grade Services

```typescript
// Create line item
const lineItem = {
  scoreMaximum: 100,
  label: 'Assignment 1',
  resourceId: 'assignment-123'
};

// Submit score
const score = {
  userId: 'user-123',
  scoreGiven: 85,
  scoreMaximum: 100,
  activityProgress: 'Completed',
  gradingProgress: 'FullyGraded'
};
```

## Best Practices for AI Developers

### 1. Security First
- Always validate JWT signatures
- Check nonce to prevent replay attacks
- Use HTTPS for all communications
- Store sensitive data in secure KV namespaces

### 2. Type Safety
- Use `@atomicjolt/lti-types` for all LTI data structures
- Leverage TypeScript's type checking
- Validate incoming data against type definitions

### 3. Error Handling
```typescript
try {
  const token = await validateJWT(request);
} catch (error) {
  if (error.code === 'INVALID_SIGNATURE') {
    // Handle invalid signature
  }
  // Log and handle appropriately
}
```

### 4. State Management
- Use Cloudflare KV for persistent state
- Implement proper state cleanup
- Handle concurrent requests safely

### 5. Service Integration
- Check for service availability in JWT claims
- Request appropriate OAuth scopes
- Handle service-specific errors gracefully

## Common Implementation Scenarios

### Scenario 1: Basic Tool Launch
```typescript
// Using @atomicjolt/lti-endpoints on Cloudflare Workers
import { Hono } from 'hono';
import { handleLTILaunch } from '@atomicjolt/lti-endpoints';

const app = new Hono();
app.post('/lti/launch', handleLTILaunch);
```

### Scenario 2: Grade Passback
```typescript
// Submit grade after student completes activity
async function submitGrade(studentId: string, score: number) {
  const accessToken = await getAccessToken();
  const lineItemUrl = getLineItemUrl();
  
  await postScore(accessToken, lineItemUrl, {
    userId: studentId,
    scoreGiven: score,
    scoreMaximum: 100,
    activityProgress: 'Completed',
    gradingProgress: 'FullyGraded'
  });
}
```

### Scenario 3: Content Selection with Deep Linking
```typescript
// Handle deep linking selection
async function handleContentSelection(items: ContentItem[]) {
  const jwt = createDeepLinkingResponse(items);
  return redirect(platform.deep_link_return_url, { JWT: jwt });
}
```

### Scenario 4: Roster Retrieval
```typescript
// Get course roster for instructor dashboard
async function getCourseRoster(contextId: string) {
  const accessToken = await getAccessToken();
  const members = await fetchNamesAndRoles(
    accessToken,
    contextMembershipsUrl,
    { role: 'Instructor' }
  );
  return members;
}
```

## Troubleshooting Guide

### Common Issues and Solutions

1. **JWT Validation Failures**
   - Verify platform's public key is cached correctly
   - Check token expiration
   - Ensure clock synchronization

2. **State Management Issues**
   - Verify KV namespaces are configured
   - Check state cookie settings
   - Ensure proper cleanup of expired states

3. **Service Access Denied**
   - Verify OAuth scopes in access token
   - Check service URLs in JWT claims
   - Ensure platform has enabled services

4. **Deep Linking Failures**
   - Validate content item format
   - Check return URL configuration
   - Verify JWT signing

## Migration from LTI 1.1

### Key Differences
- OAuth 1.0a → OAuth 2.0 + OIDC
- XML messages → JWT
- Basic Outcomes → Assignment and Grade Services
- No built-in roster → Names and Roles Service

### Migration Steps
1. Update security implementation to JWT
2. Implement OIDC flow
3. Update grade passback to AGS
4. Add NRPS for roster access
5. Update content selection to Deep Linking

## Testing and Development

### Local Development Setup
```bash
# Install dependencies
npm install @atomicjolt/lti-endpoints @atomicjolt/lti-types

# Set up KV namespaces for Cloudflare Workers
npx wrangler kv:namespace create KEY_SETS
npx wrangler kv:namespace create REMOTE_JWKS
npx wrangler kv:namespace create CLIENT_AUTH_TOKENS
npx wrangler kv:namespace create PLATFORMS

# Start development server
npm run dev
```

### Testing Checklist
- [ ] OIDC initialization flow
- [ ] JWT validation
- [ ] State management
- [ ] Deep linking workflow
- [ ] Grade submission
- [ ] Roster retrieval
- [ ] Error handling
- [ ] Security validations

## Resources and References

### Specifications
- [LTI 1.3 Core](https://www.imsglobal.org/spec/lti/v1p3)
- [LTI NRPS v2.0](https://www.imsglobal.org/spec/lti-nrps/v2p0)
- [LTI AGS v2.0](https://www.imsglobal.org/spec/lti-ags/v2p0)
- [LTI Deep Linking v2.0](https://www.imsglobal.org/spec/lti-dl/v2p0)

### Atomic Jolt Libraries
- [@atomicjolt/lti-endpoints](https://www.npmjs.com/package/@atomicjolt/lti-endpoints)
- [@atomicjolt/lti-client](https://www.npmjs.com/package/@atomicjolt/lti-client)
- [@atomicjolt/lti-server](https://www.npmjs.com/package/@atomicjolt/lti-server)
- [@atomicjolt/lti-components](https://www.npmjs.com/package/@atomicjolt/lti-components)
- [@atomicjolt/lti-types](https://www.npmjs.com/package/@atomicjolt/lti-types)

### Example Implementation
- [Atomic LTI Worker](https://github.com/atomicjolt/atomic-lti-worker)

## Summary

The Atomic Jolt LTI libraries provide a comprehensive, type-safe, and modern approach to implementing LTI 1.3. By leveraging these libraries:

1. **Reduce complexity**: Pre-built implementations for common LTI patterns
2. **Ensure security**: Built-in JWT validation and OAuth handling
3. **Maintain type safety**: Complete TypeScript definitions
4. **Accelerate development**: Focus on educational features, not protocol implementation
5. **Support modern architecture**: Optimized for serverless and edge computing

For AI developers implementing LTI functionality, always start with the appropriate Atomic Jolt library for your environment, use the type definitions for safety, and follow the LTI 1.3 specification for compliance.