# Deep Linking Story 1: Content Selection Flow

## Story Overview

As an instructor using the LMS, I want to select and embed external content from the Atomic Guide LTI tool into my course so that students can access curated learning materials directly within their course context.

## Actors

- **Instructor**: Course owner who can add and configure content
- **LMS Platform**: The Learning Management System (e.g., Canvas, Moodle) hosting the course
- **Atomic Guide Tool**: The LTI 1.3 tool providing content selection capabilities

## Preconditions

1. Atomic Guide tool is registered with the LMS via dynamic registration
2. Tool has deep linking capability enabled in configuration
3. Instructor has permissions to add external tools to the course

## Main Flow

### 1. Initiate Deep Linking

**Actor:** Instructor
**Action:** Clicks "Add External Tool" or "Add Content" in LMS course editor
**System Response:** LMS displays available external tools including Atomic Guide

### 2. Launch Deep Linking Request

**Actor:** Instructor
**Action:** Selects Atomic Guide from the tool list
**System Response:**

- LMS initiates LTI 1.3 deep linking request to `/lti/init`
- Request includes:
  - `lti_message_hint`: Platform-specific launch data
  - `login_hint`: User identifier
  - `target_link_uri`: The tool's launch URL
  - `lti_deployment_id`: Deployment identifier

### 3. OIDC Authentication Flow

**System Process:**

1. Tool receives init request at `/lti/init`
2. Tool generates state and nonce for OIDC
3. Tool redirects to platform's OIDC authorization endpoint
4. Platform validates and redirects back to `/lti/redirect` with id_token
5. Tool validates JWT and extracts deep linking claim

### 4. Deep Linking Launch

**System Process:**

- Tool validates that message type is `LtiDeepLinkingRequest`
- Tool extracts deep linking settings:
  - `accept_types`: Supported content types (link, html, image, ltiResourceLink)
  - `accept_presentation_document_targets`: iframe, window, embed
  - `accept_multiple`: Whether multiple items can be selected
  - `deep_link_return_url`: URL to return selected content

### 5. Content Selection Interface

**Actor:** Tool
**Action:** Displays content selection interface at `/lti/launch`
**UI Elements:**

- Dynamic content type selection based on `accept_types`
- If 'html' is accepted: Option to embed HTML content
- If 'link' is accepted: Option to add external links
- If 'image' is accepted: Option to embed images
- "Select Content" button to confirm selection

### 6. User Selection

**Actor:** Instructor
**Action:** Chooses content type and configures selection
**Options Based on Accept Types:**

#### Option A: HTML Content

```javascript
{
  type: 'html',
  html: '<h2>Just saying hi!</h2>',
  title: 'Hello World',
  text: 'A simple hello world example'
}
```

#### Option B: Link Content

```javascript
{
  type: 'link',
  title: 'Atomic Jolt',
  text: 'Atomic Jolt Home Page',
  url: 'https://atomicjolt.com'
}
```

#### Option C: Image Content

```javascript
{
  type: 'image',
  title: 'Atomic Jolt',
  text: 'Atomic Jolt Logo',
  url: 'https://atomic-lti-worker.atomicjolt.win/images/atomicjolt_name.png'
}
```

### 7. Sign Deep Link Response

**Actor:** Instructor
**Action:** Clicks "Select Content" button
**System Process:**

1. Client sends POST to `/lti/sign_deep_link` with:
   - Selected content items array
   - Authorization Bearer token (JWT from launch)
2. Server creates deep linking response JWT containing:
   - Selected content items
   - Message type: `LtiDeepLinkingResponse`
   - Platform and deployment IDs
3. Server signs JWT with tool's private key
4. Returns signed JWT to client

### 8. Return to Platform

**System Process:**

1. Client receives signed JWT from server
2. Client creates hidden form with:
   - Action: `deep_link_return_url` from launch settings
   - JWT field containing signed response
3. Form auto-submits via POST to platform

### 9. Platform Processing

**Actor:** LMS Platform
**Action:** Receives and validates deep linking response
**Validation Steps:**

- Verifies JWT signature using tool's public key
- Validates message type is `LtiDeepLinkingResponse`
- Extracts and stores content items

### 10. Content Confirmation

**Actor:** LMS Platform
**Action:** Displays confirmation to instructor
**Result:** Selected content is now embedded in the course

## Alternative Flows

### A1: No Accepted Types Match

**Condition:** Platform's `accept_types` doesn't include any types the tool supports
**Action:** Tool defaults to most basic type (image) with fallback content

### A2: Authentication Failure

**Condition:** JWT validation fails at any step
**Action:** Display error message "Failed to launch" to user

### A3: Deep Link Signing Failure

**Condition:** Server fails to sign deep link response
**Action:** Client displays error message and logs to console

## Technical Implementation Details

### Client-Side (app.ts/app.tsx)

- Detects deep linking mode from `launchSettings.deepLinking`
- Dynamically creates UI based on `accept_types`
- Handles content selection and API call to sign response
- Auto-submits form with signed JWT back to platform

### Server-Side (index.ts)

- `/lti/init`: Initiates OIDC flow
- `/lti/redirect`: Handles OIDC callback
- `/lti/launch`: Validates and serves launch page
- `/lti/sign_deep_link`: Signs deep linking response

### Security Considerations

- All requests authenticated with JWT Bearer tokens
- State management via Durable Objects prevents CSRF
- JWT signatures validated at each step
- CORS configured for cross-domain LTI launches

## Success Criteria

1. Instructor can successfully select content from tool
2. Selected content appears in course
3. Students can later access the embedded content
4. All JWT validations pass
5. No security warnings in browser console

## Related Components

- `@atomicjolt/lti-client`: Handles client-side LTI launch validation
- `@atomicjolt/lti-endpoints`: Provides server-side LTI handling
- `handleSignDeepLink`: Server function that signs deep link responses
- `ltiLaunch`: Client function that validates launch and sets up UI
