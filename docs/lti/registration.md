# LTI Dynamic Registration Guide

This document provides comprehensive information about LTI 1.3 dynamic registration in Atomic Guide, including implementation details, platform-specific processes, and troubleshooting.

## Overview

LTI 1.3 dynamic registration automates the process of configuring learning tools with LMS platforms. Instead of manual configuration, the tool and platform exchange configuration information automatically through a standardized workflow.

## Dynamic Registration Flow

### 1. Registration Initiation

The registration process can be initiated in two ways:

#### Platform-Initiated (Recommended)

1. Administrator accesses LMS tool management
2. Selects "Register by URL" or similar option
3. Enters tool's registration URL: `https://guide.yourdomain.com/lti/register`
4. Platform makes GET request to registration URL
5. Tool responds with registration form

#### Tool-Initiated

1. Administrator accesses tool's registration page
2. Selects target platform (Canvas, Moodle, etc.)
3. Enters platform URL and credentials
4. Tool initiates registration with platform

### 2. Registration Workflow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Platform  │────▶│  Registration │────▶│    Tool     │
│     LMS     │     │   Endpoint    │     │   Service   │
└─────────────┘     └──────────────┘     └─────────────┘
        │                    │                    │
        │ 1. GET /register   │                    │
        │◀───────────────────┘                    │
        │                                         │
        │ 2. Registration Form                    │
        │────────────────────────────────────────▶│
        │                                         │
        │ 3. POST with platform data              │
        │────────────────────────────────────────▶│
        │                                         │
        │ 4. Tool configuration                   │
        │◀────────────────────────────────────────│
        │                                         │
        │ 5. Registration complete                │
        │◀────────────────────────────────────────│
```

## Registration Implementation

### 1. Registration Endpoint

```typescript
// Main registration handler
export async function handleRegistration(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === 'GET') {
    return handleRegistrationForm(request, env);
  } else if (request.method === 'POST') {
    return handleRegistrationSubmission(request, env);
  }

  return new Response('Method not allowed', { status: 405 });
}

// Serve registration form
async function handleRegistrationForm(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const openidConfiguration = url.searchParams.get('openid_configuration');
  const registrationToken = url.searchParams.get('registration_token');

  // If platform provides configuration URL, fetch platform info
  let platformInfo = null;
  if (openidConfiguration) {
    platformInfo = await fetchPlatformConfiguration(openidConfiguration);
  }

  const registrationForm = generateRegistrationForm({
    platformInfo,
    registrationToken,
    toolConfiguration: getToolConfiguration(),
  });

  return new Response(registrationForm, {
    headers: { 'Content-Type': 'text/html' },
  });
}

// Process registration submission
async function handleRegistrationSubmission(request: Request, env: Env): Promise<Response> {
  const formData = await request.formData();
  const registrationData = parseRegistrationData(formData);

  try {
    // Validate platform configuration
    await validatePlatformConfiguration(registrationData);

    // Store platform configuration
    await storePlatformConfiguration(registrationData, env);

    // Create tool registration response
    const toolConfig = createToolConfigurationResponse(registrationData);

    if (registrationData.registrationToken) {
      // Complete registration with platform
      return await completeRegistrationWithPlatform(registrationData, toolConfig, env);
    } else {
      // Return configuration for manual setup
      return new Response(JSON.stringify(toolConfig, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Registration failed:', error);
    return new Response(generateErrorPage(error.message), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}
```

### 2. Tool Configuration Generation

```typescript
// Generate tool configuration for platform
export function createToolConfigurationResponse(registrationData: RegistrationData): ToolConfiguration {
  return {
    application_type: 'web',
    response_types: ['id_token'],
    grant_types: ['implict', 'client_credentials'],
    initiate_login_uri: 'https://guide.yourdomain.com/lti/init',
    redirect_uris: ['https://guide.yourdomain.com/lti/redirect'],
    client_name: 'Atomic Guide',
    jwks_uri: 'https://guide.yourdomain.com/.well-known/jwks.json',
    logo_uri: 'https://guide.yourdomain.com/images/logo.png',
    client_uri: 'https://guide.yourdomain.com',
    tos_uri: 'https://guide.yourdomain.com/terms',
    policy_uri: 'https://guide.yourdomain.com/privacy',

    // LTI-specific configuration
    'https://purl.imsglobal.org/spec/lti-tool-configuration': {
      domain: 'guide.yourdomain.com',
      description: 'AI-powered video transcription and learning analytics',
      target_link_uri: 'https://guide.yourdomain.com/lti/launch',
      custom_parameters: {
        course_id: '$Canvas.course.id',
        user_id: '$Canvas.user.id',
        user_role: '$Canvas.membership.roles',
      },
      claims: [
        'iss',
        'sub',
        'name',
        'email',
        'https://purl.imsglobal.org/spec/lti/claim/roles',
        'https://purl.imsglobal.org/spec/lti/claim/context',
        'https://purl.imsglobal.org/spec/lti/claim/resource_link',
        'https://purl.imsglobal.org/spec/lti/claim/custom',
      ],
      messages: [
        {
          type: 'LtiResourceLinkRequest',
          target_link_uri: 'https://guide.yourdomain.com/lti/launch',
          label: 'Launch Atomic Guide',
        },
        {
          type: 'LtiDeepLinkingRequest',
          target_link_uri: 'https://guide.yourdomain.com/lti/launch',
          label: 'Create Content',
        },
      ],
      placements: [
        {
          placement: 'course_navigation',
          target_link_uri: 'https://guide.yourdomain.com/lti/launch',
          text: 'Atomic Guide',
          icon_url: 'https://guide.yourdomain.com/images/icon-16.png',
        },
        {
          placement: 'assignment_selection',
          message_type: 'LtiDeepLinkingRequest',
          target_link_uri: 'https://guide.yourdomain.com/lti/launch',
        },
      ],
    },

    // Requested OAuth scopes
    scope: [
      'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
      'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
      'https://purl.imsglobal.org/spec/lti-ags/scope/score',
      'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly',
    ].join(' '),
  };
}
```

### 3. Platform Configuration Storage

```typescript
// Store platform configuration after successful registration
export async function storePlatformConfiguration(registrationData: RegistrationData, env: Env): Promise<void> {
  const platformConfig: PlatformConfiguration = {
    platform_id: registrationData.iss,
    client_id: registrationData.client_id || crypto.randomUUID(),
    deployment_ids: [registrationData.deployment_id || 'default'],

    // Platform endpoints
    auth_login_url: registrationData.auth_login_url,
    auth_token_url: registrationData.auth_token_url,
    auth_server: registrationData.auth_server,
    key_set_url: registrationData.key_set_url,

    // Platform information
    platform_name: registrationData.platform_name,
    platform_version: registrationData.platform_version,
    platform_guid: registrationData.platform_guid,

    // Registration metadata
    registered_at: new Date().toISOString(),
    registration_method: 'dynamic',
    status: 'active',
  };

  // Store in KV namespace
  await env.PLATFORMS.put(platformConfig.platform_id, JSON.stringify(platformConfig));

  // Also store by client_id for quick lookup
  await env.PLATFORMS.put(`client:${platformConfig.client_id}`, JSON.stringify(platformConfig));
}
```

## Platform-Specific Registration

### 1. Canvas Registration

```typescript
// Canvas-specific registration handling
export class CanvasRegistrationHandler {
  async handleCanvasRegistration(registrationData: RegistrationData): Promise<CanvasRegistrationResponse> {
    // Canvas uses specific configuration format
    const canvasConfig = {
      title: 'Atomic Guide',
      scopes: [
        'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
        'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
        'https://purl.imsglobal.org/spec/lti-ags/scope/score',
        'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly',
      ],
      extensions: [
        {
          domain: 'guide.yourdomain.com',
          tool_id: 'atomic_guide',
          platform: 'canvas.instructure.com',
          settings: {
            text: 'Atomic Guide',
            icon_url: 'https://guide.yourdomain.com/images/canvas-icon.png',
            placements: [
              {
                text: 'Atomic Guide',
                placement: 'course_navigation',
                message_type: 'LtiResourceLinkRequest',
                target_link_uri: 'https://guide.yourdomain.com/lti/launch',
                canvas_icon_class: 'icon-lti',
              },
              {
                text: 'Create Activity',
                placement: 'assignment_selection',
                message_type: 'LtiDeepLinkingRequest',
                target_link_uri: 'https://guide.yourdomain.com/lti/launch',
              },
            ],
          },
        },
      ],
    };

    return canvasConfig;
  }
}
```

### 2. Moodle Registration

```typescript
// Moodle-specific registration handling
export class MoodleRegistrationHandler {
  async handleMoodleRegistration(registrationData: RegistrationData): Promise<MoodleRegistrationResponse> {
    // Moodle requires specific tool configuration
    return {
      client_name: 'Atomic Guide',
      initiate_login_uri: 'https://guide.yourdomain.com/lti/init',
      redirect_uris: ['https://guide.yourdomain.com/lti/redirect'],

      'https://purl.imsglobal.org/spec/lti-tool-configuration': {
        domain: 'guide.yourdomain.com',
        target_link_uri: 'https://guide.yourdomain.com/lti/launch',
        custom_parameters: {
          course_id: '$CourseOffering.sourcedId',
          user_id: '$User.id',
        },
        claims: [
          'sub',
          'name',
          'email',
          'https://purl.imsglobal.org/spec/lti/claim/roles',
          'https://purl.imsglobal.org/spec/lti/claim/context',
        ],
        messages: [
          {
            type: 'LtiResourceLinkRequest',
            target_link_uri: 'https://guide.yourdomain.com/lti/launch',
          },
          {
            type: 'LtiDeepLinkingRequest',
            target_link_uri: 'https://guide.yourdomain.com/lti/launch',
          },
        ],
      },
    };
  }
}
```

## Registration Form Interface

### 1. Dynamic Registration Form

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Atomic Guide - LTI Registration</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
      }
      .form-group {
        margin-bottom: 20px;
      }
      label {
        display: block;
        margin-bottom: 5px;
        font-weight: bold;
      }
      input,
      select,
      textarea {
        width: 100%;
        padding: 8px;
        border: 1px solid #ddd;
      }
      .button {
        background: #007cba;
        color: white;
        padding: 10px 20px;
        border: none;
        cursor: pointer;
      }
      .error {
        color: red;
        margin-top: 5px;
      }
      .platform-info {
        background: #f5f5f5;
        padding: 15px;
        margin-bottom: 20px;
      }
    </style>
  </head>
  <body>
    <h1>🚀 Atomic Guide LTI Registration</h1>

    <div class="platform-info" id="platformInfo" style="display: none;">
      <h3>Platform Information Detected</h3>
      <p><strong>Platform:</strong> <span id="platformName"></span></p>
      <p><strong>Version:</strong> <span id="platformVersion"></span></p>
    </div>

    <form id="registrationForm" method="POST">
      <input type="hidden" name="registration_token" id="registrationToken" />

      <div class="form-group">
        <label for="platformUrl">Platform URL *</label>
        <input type="url" name="platform_url" id="platformUrl" required placeholder="https://yourinstitution.instructure.com" />
        <div class="error" id="platformUrlError"></div>
      </div>

      <div class="form-group">
        <label for="platformType">Platform Type *</label>
        <select name="platform_type" id="platformType" required>
          <option value="">Select Platform</option>
          <option value="canvas">Canvas LMS</option>
          <option value="moodle">Moodle</option>
          <option value="blackboard">Blackboard Learn</option>
          <option value="brightspace">Brightspace</option>
          <option value="generic">Other LTI 1.3 Platform</option>
        </select>
      </div>

      <div class="form-group">
        <label for="institutionName">Institution Name *</label>
        <input type="text" name="institution_name" id="institutionName" required placeholder="University of Example" />
      </div>

      <div class="form-group">
        <label for="contactEmail">Administrator Email *</label>
        <input type="email" name="contact_email" id="contactEmail" required placeholder="admin@yourinstitution.edu" />
      </div>

      <div class="form-group" id="deploymentGroup">
        <label for="deploymentId">Deployment ID</label>
        <input type="text" name="deployment_id" id="deploymentId" placeholder="Leave blank for auto-generation" />
        <small>Used to identify this specific deployment of the tool</small>
      </div>

      <div class="form-group">
        <label>
          <input type="checkbox" name="enable_grades" checked />
          Enable grade passback to platform gradebook
        </label>
      </div>

      <div class="form-group">
        <label>
          <input type="checkbox" name="enable_nrps" checked />
          Enable Names and Roles service (roster access)
        </label>
      </div>

      <div class="form-group">
        <label>
          <input type="checkbox" name="enable_deep_linking" checked />
          Enable Deep Linking (content creation)
        </label>
      </div>

      <div class="form-group">
        <button type="submit" class="button">Complete Registration</button>
        <button type="button" class="button" onclick="downloadConfig()" style="background: #666; margin-left: 10px;">
          Download Configuration
        </button>
      </div>
    </form>

    <script>
      // Pre-populate form if platform info is available
      const urlParams = new URLSearchParams(window.location.search);
      const registrationToken = urlParams.get('registration_token');
      const openidConfig = urlParams.get('openid_configuration');

      if (registrationToken) {
        document.getElementById('registrationToken').value = registrationToken;
      }

      if (openidConfig) {
        fetchPlatformInfo(openidConfig);
      }

      async function fetchPlatformInfo(configUrl) {
        try {
          const response = await fetch(configUrl);
          const config = await response.json();

          // Show platform info
          document.getElementById('platformInfo').style.display = 'block';
          document.getElementById('platformName').textContent = config.issuer;

          // Pre-populate form
          document.getElementById('platformUrl').value = config.issuer;

          // Detect platform type
          if (config.issuer.includes('instructure.com')) {
            document.getElementById('platformType').value = 'canvas';
          } else if (config.issuer.includes('moodle')) {
            document.getElementById('platformType').value = 'moodle';
          }
        } catch (error) {
          console.error('Failed to fetch platform info:', error);
        }
      }

      function downloadConfig() {
        // Generate downloadable configuration
        const formData = new FormData(document.getElementById('registrationForm'));
        const config = generateToolConfiguration(formData);

        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'atomic-guide-lti-config.json';
        a.click();

        URL.revokeObjectURL(url);
      }
    </script>
  </body>
</html>
```

### 2. Registration Success Page

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Registration Complete - Atomic Guide</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
        text-align: center;
      }
      .success {
        color: #28a745;
        font-size: 48px;
        margin-bottom: 20px;
      }
      .config-details {
        background: #f8f9fa;
        padding: 20px;
        margin: 20px 0;
        text-align: left;
      }
      .button {
        background: #007cba;
        color: white;
        padding: 10px 20px;
        border: none;
        text-decoration: none;
        display: inline-block;
        margin: 10px;
      }
    </style>
  </head>
  <body>
    <div class="success">✅</div>
    <h1>Registration Complete!</h1>
    <p>Atomic Guide has been successfully registered with your platform.</p>

    <div class="config-details">
      <h3>Configuration Details</h3>
      <p><strong>Client ID:</strong> <code id="clientId"></code></p>
      <p><strong>Deployment ID:</strong> <code id="deploymentId"></code></p>
      <p><strong>Platform:</strong> <span id="platformName"></span></p>
      <p><strong>Registered:</strong> <span id="registeredAt"></span></p>
    </div>

    <h3>Next Steps</h3>
    <ol style="text-align: left;">
      <li>Add Atomic Guide to your course navigation or activities</li>
      <li>Test the integration with a sample launch</li>
      <li>Configure any additional settings as needed</li>
    </ol>

    <div>
      <a href="#" class="button" onclick="testLaunch()">Test Launch</a>
      <a href="https://guide.yourdomain.com/docs" class="button" style="background: #666;">Documentation</a>
    </div>

    <script>
      function testLaunch() {
        // Open test launch in new window
        window.open('/lti/test-launch', 'test_launch', 'width=800,height=600');
      }
    </script>
  </body>
</html>
```

## Registration Security

### 1. Token Validation

```typescript
// Validate registration tokens
export async function validateRegistrationToken(token: string, platformUrl: string): Promise<boolean> {
  try {
    // Decode and verify JWT registration token
    const decoded = await verifyJWT(token, await getPlatformJWKS(platformUrl));

    // Verify token claims
    return decoded.aud === 'https://guide.yourdomain.com' && decoded.exp > Date.now() / 1000 && decoded.iss === platformUrl;
  } catch (error) {
    console.error('Registration token validation failed:', error);
    return false;
  }
}
```

### 2. Platform Verification

```typescript
// Verify platform authenticity before registration
export async function verifyPlatform(platformUrl: string): Promise<boolean> {
  try {
    // Check OpenID configuration
    const configUrl = `${platformUrl}/.well-known/openid_configuration`;
    const response = await fetch(configUrl);

    if (!response.ok) {
      return false;
    }

    const config = await response.json();

    // Verify required endpoints exist
    const requiredEndpoints = ['authorization_endpoint', 'token_endpoint', 'jwks_uri'];

    return requiredEndpoints.every((endpoint) => config[endpoint]);
  } catch (error) {
    console.error('Platform verification failed:', error);
    return false;
  }
}
```

## Testing Registration

### 1. Registration Flow Testing

```typescript
// Test dynamic registration flow
describe('LTI Dynamic Registration', () => {
  it('should handle Canvas registration', async () => {
    const registrationData = {
      platform_url: 'https://canvas.test.instructure.com',
      platform_type: 'canvas',
      institution_name: 'Test University',
      contact_email: 'admin@test.edu',
      enable_grades: true,
      enable_nrps: true,
      enable_deep_linking: true,
    };

    const response = await app.request('/lti/register', {
      method: 'POST',
      body: new URLSearchParams(registrationData),
    });

    expect(response.status).toBe(200);

    const config = await response.json();
    expect(config.client_name).toBe('Atomic Guide');
    expect(config.initiate_login_uri).toBe('https://guide.yourdomain.com/lti/init');
  });

  it('should store platform configuration', async () => {
    // Test platform configuration storage
    const platformConfig = {
      platform_id: 'https://test.instructure.com',
      client_id: 'test-client-123',
      deployment_ids: ['test-deployment'],
    };

    await storePlatformConfiguration(platformConfig, env);

    const stored = await env.PLATFORMS.get('https://test.instructure.com');
    expect(JSON.parse(stored)).toMatchObject(platformConfig);
  });
});
```

### 2. Configuration Validation

```typescript
// Validate generated tool configuration
export function validateToolConfiguration(config: ToolConfiguration): string[] {
  const errors: string[] = [];

  if (!config.client_name) {
    errors.push('Client name is required');
  }

  if (!config.initiate_login_uri) {
    errors.push('Initiate login URI is required');
  }

  if (!config.redirect_uris || config.redirect_uris.length === 0) {
    errors.push('At least one redirect URI is required');
  }

  const ltiConfig = config['https://purl.imsglobal.org/spec/lti-tool-configuration'];
  if (!ltiConfig) {
    errors.push('LTI tool configuration is required');
  }

  if (!ltiConfig?.target_link_uri) {
    errors.push('Target link URI is required');
  }

  return errors;
}
```

## Troubleshooting Registration

### Common Issues

#### 1. Registration Token Invalid

**Cause**: Expired or malformed registration token
**Solution**: Restart registration process from platform

#### 2. Platform Configuration Not Found

**Cause**: OpenID configuration endpoint not accessible
**Solution**: Verify platform URL and network connectivity

#### 3. Client ID Mismatch

**Cause**: Generated client ID doesn't match platform expectations
**Solution**: Use platform-provided client ID if available

#### 4. Scope Requests Denied

**Cause**: Platform doesn't support requested scopes
**Solution**: Remove unsupported scopes from configuration

### Debug Registration Issues

```typescript
// Debug registration process
export function debugRegistration(registrationData: RegistrationData, error?: Error): void {
  console.log('Registration Debug:', {
    platformUrl: registrationData.platform_url,
    platformType: registrationData.platform_type,
    hasRegistrationToken: !!registrationData.registration_token,
    timestamp: new Date().toISOString(),
    error: error?.message,
  });
}
```

## Best Practices

1. **Always validate platform authenticity before registration**
2. **Store registration metadata for troubleshooting**
3. **Implement proper error handling and user feedback**
4. **Test registration flow with each supported platform**
5. **Provide clear documentation for manual configuration**
6. **Monitor registration success/failure rates**
7. **Implement registration token validation**
8. **Use secure communication (HTTPS) throughout**
9. **Cache platform configurations appropriately**
10. **Provide rollback capability for failed registrations**
