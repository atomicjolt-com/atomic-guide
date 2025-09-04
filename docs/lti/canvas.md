# Canvas LTI Integration

This document provides detailed instructions for integrating Atomic Guide with Canvas LMS using LTI 1.3.

## Overview

Atomic Guide supports full integration with Canvas LMS through LTI 1.3, enabling:

- Single sign-on authentication
- Grade passback to Canvas gradebook
- Deep linking for content creation
- Names and Roles Provisioning Service (NRPS)
- Real-time roster updates
- Assignment and Grade Services (AGS)

## Canvas LTI 1.3 Setup

### 1. Developer Key Configuration

#### Step 1: Create Developer Key

1. Navigate to **Admin** → **Developer Keys** in Canvas
2. Click **+ Developer Key** → **+ LTI Key**
3. Fill in the following information:

| Field                         | Value                                                      |
| ----------------------------- | ---------------------------------------------------------- |
| Key Name                      | Atomic Guide                                               |
| Owner Email                   | admin@yourdomain.com                                       |
| Redirect URIs                 | `https://guide.yourdomain.com/lti/redirect`                |
| Method                        | Manual Entry                                               |
| Title                         | Atomic Guide - AI-Powered Learning Assistant               |
| Description                   | AI-powered video transcription and learning analytics tool |
| Target Link URI               | `https://guide.yourdomain.com/lti/launch`                  |
| OpenID Connect Initiation Url | `https://guide.yourdomain.com/lti/init`                    |

#### Step 2: Configure Tool Settings

**Privacy Level**: `Public` (required for NRPS and AGS)

**Custom Fields**:

```
course_id=$Canvas.course.id
user_id=$Canvas.user.id
user_role=$Canvas.membership.roles
context_title=$Canvas.course.name
```

**Placements**: Select the following placements:

- ✅ **Course Navigation** - Main course menu item
- ✅ **Assignment Selection** - For creating graded activities
- ✅ **Link Selection** - For embedding in course content
- ✅ **Editor Button** - Rich Content Editor integration
- ✅ **Homework Submission** - Student submission workflow

#### Step 3: Configure Services

Enable the following LTI services:

- ✅ **Names and Role Provisioning Services** - For roster access
- ✅ **Assignment and Grade Services** - For grade passback
- ✅ **Deep Linking** - For content creation

#### Step 4: Additional Settings

**Domain**: `guide.yourdomain.com`

**Tool Configuration**: Use JSON configuration:

```json
{
  "title": "Atomic Guide",
  "scopes": [
    "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem",
    "https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly",
    "https://purl.imsglobal.org/spec/lti-ags/scope/score",
    "https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly"
  ],
  "extensions": [
    {
      "platform": "canvas.instructure.com",
      "settings": {
        "platform": "canvas.instructure.com",
        "placements": [
          {
            "placement": "course_navigation",
            "message_type": "LtiResourceLinkRequest",
            "target_link_uri": "https://guide.yourdomain.com/lti/launch",
            "text": "Atomic Guide",
            "icon_url": "https://guide.yourdomain.com/images/icon-16.png"
          },
          {
            "placement": "assignment_selection",
            "message_type": "LtiDeepLinkingRequest",
            "target_link_uri": "https://guide.yourdomain.com/lti/launch",
            "text": "Atomic Guide Activity"
          },
          {
            "placement": "link_selection",
            "message_type": "LtiDeepLinkingRequest",
            "target_link_uri": "https://guide.yourdomain.com/lti/launch",
            "text": "Atomic Guide Content"
          }
        ]
      }
    }
  ]
}
```

### 2. Install Tool in Canvas

#### Step 1: Enable Developer Key

1. In Developer Keys, click **ON** for Atomic Guide key
2. Copy the **Client ID** (you'll need this for dynamic registration)

#### Step 2: Install in Course

1. Go to course **Settings** → **Apps**
2. Click **+ App** → **By Client ID**
3. Enter the Client ID from Step 1
4. Click **Submit**

#### Step 3: Configure Course Navigation

1. Go to course **Settings** → **Navigation**
2. Find "Atomic Guide" in the list
3. Drag it to desired position
4. Click **Save**

## Dynamic Registration (Alternative)

Instead of manual setup, you can use Atomic Guide's dynamic registration:

### Step 1: Initiate Registration

1. In Canvas, go to **Settings** → **Apps**
2. Click **+ App** → **By URL**
3. Enter registration URL: `https://guide.yourdomain.com/lti/register`
4. Click **Submit**

### Step 2: Complete Registration

1. Canvas will redirect to Atomic Guide's registration page
2. Review and accept the tool configuration
3. Click **Complete Registration**
4. You'll be redirected back to Canvas with the tool installed

## Canvas-Specific Features

### 1. Grade Passback Integration

Atomic Guide automatically syncs grades with Canvas gradebook:

```typescript
// Example grade passback implementation
export async function syncGradeToCanvas(grade: StudentGrade, ltiContext: LTIContext): Promise<void> {
  const agsService = new AssignmentGradeService(ltiContext);

  await agsService.postScore({
    userId: grade.userId,
    scoreGiven: grade.score,
    scoreMaximum: grade.maxScore,
    comment: grade.feedback,
    timestamp: new Date().toISOString(),
    activityProgress: 'Completed',
    gradingProgress: 'FullyGraded',
  });
}
```

### 2. Names and Roles Service

Access Canvas roster information:

```typescript
// Get course roster from Canvas
export async function getCanvasRoster(contextId: string, ltiToken: string): Promise<CanvasUser[]> {
  const nrpsService = new NamesRolesService(ltiToken);

  const members = await nrpsService.getContextMembership(contextId);

  return members.map((member) => ({
    id: member.user_id,
    name: member.name,
    email: member.email,
    roles: member.roles,
    canvasUserId: member.lis_person_sourcedid,
  }));
}
```

### 3. Deep Linking for Content

Create Canvas assignments with Atomic Guide content:

```typescript
// Deep link implementation for Canvas
export async function createCanvasAssignment(contentItems: DeepLinkingItem[], ltiContext: LTIContext): Promise<DeepLinkingResponse> {
  return {
    '@context': 'http://purl.imsglobal.org/ctx/lti/v1/ContentItem',
    '@graph': contentItems.map((item) => ({
      '@type': 'LtiLinkItem',
      url: `https://guide.yourdomain.com/content/${item.id}`,
      title: item.title,
      text: item.description,
      icon: {
        '@id': 'https://guide.yourdomain.com/images/content-icon.png',
        width: 16,
        height: 16,
      },
      lineItem: {
        scoreConstraints: {
          normalMaximum: item.maxScore,
          extraCreditMaximum: 0,
        },
        resourceId: item.id,
        tag: 'atomic-guide-assessment',
      },
    })),
  };
}
```

## Canvas API Integration

### 1. Enhanced Features with Canvas API

For advanced features, Atomic Guide can use Canvas API directly:

```typescript
// Canvas API client
export class CanvasAPIClient {
  constructor(
    private baseURL: string,
    private accessToken: string
  ) {}

  async getCourse(courseId: string): Promise<CanvasCourse> {
    const response = await fetch(`${this.baseURL}/api/v1/courses/${courseId}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    return await response.json();
  }

  async getAssignments(courseId: string): Promise<CanvasAssignment[]> {
    const response = await fetch(`${this.baseURL}/api/v1/courses/${courseId}/assignments`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    return await response.json();
  }

  async createAnnouncement(courseId: string, announcement: AnnouncementData): Promise<CanvasAnnouncement> {
    const response = await fetch(`${this.baseURL}/api/v1/courses/${courseId}/discussion_topics`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: announcement.title,
        message: announcement.message,
        is_announcement: true,
        published: announcement.published,
      }),
    });

    return await response.json();
  }
}
```

### 2. Canvas Webhooks Integration

Set up webhooks to receive Canvas events:

```typescript
// Handle Canvas webhook events
export async function handleCanvasWebhook(event: CanvasWebhookEvent, env: Env): Promise<void> {
  switch (event.event_name) {
    case 'assignment_created':
      await handleAssignmentCreated(event.body);
      break;

    case 'grade_change':
      await handleGradeChange(event.body);
      break;

    case 'enrollment_created':
      await handleEnrollmentCreated(event.body);
      break;

    case 'submission_created':
      await handleSubmissionCreated(event.body);
      break;
  }
}

async function handleAssignmentCreated(assignment: CanvasAssignment): Promise<void> {
  // Automatically create Atomic Guide activities for assignments
  if (assignment.external_tool_tag_attributes?.url?.includes('guide.yourdomain.com')) {
    await createAtomicGuideActivity({
      assignmentId: assignment.id,
      courseId: assignment.course_id,
      title: assignment.name,
      description: assignment.description,
      dueDate: assignment.due_at,
      pointsPossible: assignment.points_possible,
    });
  }
}
```

## Canvas-Specific Configuration

### 1. Canvas Environment Variables

```bash
# Canvas-specific configuration
wrangler secret put CANVAS_BASE_URL          # e.g., "https://yourinstitution.instructure.com"
wrangler secret put CANVAS_CLIENT_ID         # From Canvas Developer Key
wrangler secret put CANVAS_CLIENT_SECRET     # From Canvas Developer Key
wrangler secret put CANVAS_API_TOKEN         # For Canvas API access
wrangler secret put CANVAS_WEBHOOK_SECRET    # For webhook validation
```

### 2. Canvas Platform Configuration

```typescript
// Canvas-specific LTI configuration
export const canvasConfig: LTIPlatformConfig = {
  platform: 'canvas.instructure.com',
  clientId: env.CANVAS_CLIENT_ID,
  authLoginUrl: 'https://yourinstitution.instructure.com/api/lti/authorize_redirect',
  authTokenUrl: 'https://yourinstitution.instructure.com/login/oauth2/token',
  keySetUrl: 'https://yourinstitution.instructure.com/api/lti/security/jwks',

  // Canvas-specific claim mappings
  claimMappings: {
    userId: 'sub',
    userName: 'name',
    userEmail: 'email',
    contextId: 'https://purl.imsglobal.org/spec/lti/claim/context.id',
    contextTitle: 'https://purl.imsglobal.org/spec/lti/claim/context.title',
    roles: 'https://purl.imsglobal.org/spec/lti/claim/roles',
    resourceLink: 'https://purl.imsglobal.org/spec/lti/claim/resource_link',
  },

  // Canvas-specific services
  services: {
    namesRoles: 'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly',
    assignmentGrades: [
      'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
      'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
      'https://purl.imsglobal.org/spec/lti-ags/scope/score',
    ],
  },
};
```

## Canvas Testing

### 1. LTI Launch Testing

```typescript
// Test Canvas LTI launch flow
describe('Canvas LTI Integration', () => {
  it('should handle Canvas LTI launch', async () => {
    const mockLTIPayload = {
      iss: 'https://yourinstitution.instructure.com',
      sub: 'canvas-user-123',
      aud: 'your-client-id',
      'https://purl.imsglobal.org/spec/lti/claim/context': {
        id: 'course-456',
        title: 'Test Course',
      },
      'https://purl.imsglobal.org/spec/lti/claim/roles': ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
    };

    const jwt = await signJWT(mockLTIPayload, canvasJWK);

    const response = await app.request('/lti/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: jwt }),
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Atomic Guide');
  });
});
```

### 2. Grade Passback Testing

```typescript
// Test Canvas grade passback
describe('Canvas Grade Passback', () => {
  it('should post grades to Canvas gradebook', async () => {
    const mockGrade = {
      userId: 'canvas-user-123',
      score: 85,
      maxScore: 100,
      feedback: 'Great work on the video analysis!',
    };

    const agsService = new AssignmentGradeService({
      lineitemUrl: 'https://yourinstitution.instructure.com/api/lti/courses/456/line_items/789',
      accessToken: 'canvas-access-token',
    });

    const result = await agsService.postScore(mockGrade);
    expect(result.success).toBe(true);
  });
});
```

## Canvas Troubleshooting

### Common Issues

#### 1. LTI Launch Fails

**Symptoms**: 401 Unauthorized or invalid JWT errors
**Solutions**:

- Verify Canvas Developer Key is enabled
- Check Client ID matches in configuration
- Ensure redirect URI is exactly `https://guide.yourdomain.com/lti/redirect`
- Verify JWKS endpoint is accessible

#### 2. Grade Passback Not Working

**Symptoms**: Grades not appearing in Canvas gradebook
**Solutions**:

- Verify Assignment and Grade Services are enabled
- Check that assignment was created through Deep Linking
- Ensure proper AGS scopes are granted
- Verify line item URL is correct

#### 3. Names and Roles Service Issues

**Symptoms**: Unable to access course roster
**Solutions**:

- Enable Names and Role Provisioning Services in Canvas
- Verify NRPS scope is granted
- Check privacy level is set to "Public"
- Ensure proper authentication token

### Debug Mode

Enable Canvas-specific debugging:

```typescript
// Canvas debug mode
if (env.DEBUG_CANVAS === 'true') {
  console.log('Canvas LTI Payload:', {
    iss: payload.iss,
    sub: payload.sub,
    context: payload['https://purl.imsglobal.org/spec/lti/claim/context'],
    roles: payload['https://purl.imsglobal.org/spec/lti/claim/roles'],
  });
}
```

### Canvas Support Resources

- **Canvas LTI Documentation**: https://canvas.instructure.com/doc/api/external_tools.html
- **Canvas Developer Portal**: https://canvas.instructure.com/doc/api/
- **IMS Global LTI Specification**: https://www.imsglobal.org/spec/lti/v1p3/
- **Canvas Community**: https://community.canvaslms.com/

## Best Practices for Canvas Integration

1. **Always test in Canvas Test/Beta environment first**
2. **Use meaningful tool names and descriptions**
3. **Implement proper error handling for Canvas API calls**
4. **Cache Canvas API responses appropriately**
5. **Follow Canvas rate limiting guidelines**
6. **Use Canvas webhooks for real-time updates**
7. **Implement proper user role checking**
8. **Test with different user roles (Student, Teacher, Admin)**
9. **Handle Canvas API pagination properly**
10. **Monitor Canvas API usage and costs**
