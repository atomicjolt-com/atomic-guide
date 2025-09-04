# Moodle LTI Integration

This document provides detailed instructions for integrating Atomic Guide with Moodle LMS using LTI 1.3.

## Overview

Atomic Guide fully supports Moodle integration through LTI 1.3, providing:

- Single sign-on authentication with Moodle users
- Grade passback to Moodle gradebook
- Deep linking for activity creation
- Names and Roles Provisioning Service (NRPS)
- Assignment and Grade Services (AGS)
- Moodle-specific customizations

## Moodle LTI 1.3 Setup

### 1. Enable LTI 1.3 in Moodle

#### Prerequisites

- Moodle 3.10+ (LTI 1.3 support)
- Site administrator access
- HTTPS enabled on both Moodle and Atomic Guide

#### Step 1: Enable External Tools

1. Navigate to **Site administration** → **Plugins** → **Activity modules** → **External tool**
2. Ensure **External tool** is enabled
3. Check **Show activity chooser** and **Show activity type name**

### 2. Configure External Tool

#### Step 1: Add Tool Registration

1. Go to **Site administration** → **Plugins** → **Activity modules** → **External tool** → **Manage tools**
2. Click **Configure a tool manually** (or use **Register platform**)
3. Fill in the configuration:

| Field              | Value                                       |
| ------------------ | ------------------------------------------- |
| Tool name          | Atomic Guide                                |
| Tool URL           | `https://guide.yourdomain.com/lti/launch`   |
| LTI version        | LTI 1.3                                     |
| Public key type    | RSA key                                     |
| Initiate login URL | `https://guide.yourdomain.com/lti/init`     |
| Redirection URI(s) | `https://guide.yourdomain.com/lti/redirect` |

#### Step 2: Configure Tool Settings

**Default launch container**: New window

**Privacy**:

- ✅ Share launcher's name with tool
- ✅ Share launcher's email with tool
- ✅ Accept grades from the tool

**Services**:

- ✅ IMS LTI Names and Role Provisioning
- ✅ IMS LTI Assignment and Grade Services
- ✅ Tool Settings

**Custom parameters**:

```
course_id=$CourseOffering.sourcedId
user_id=$User.id
user_role=$User.role
context_title=$CourseOffering.label
context_label=$CourseOffering.title
```

#### Step 3: Platform Configuration

After saving, Moodle will generate:

- **Platform ID** (issuer URL)
- **Client ID**
- **Public keyset URL**
- **Access token URL**
- **Authentication request URL**

Save these values - you'll need them for Atomic Guide configuration.

### 3. Configure Course-Level Tool

#### Step 1: Add External Tool Activity

1. In a course, turn editing on
2. Click **Add an activity or resource**
3. Select **External tool**
4. Configure the activity:

| Field              | Value                                     |
| ------------------ | ----------------------------------------- |
| Activity name      | Atomic Guide - Video Analysis             |
| Preconfigured tool | Select "Atomic Guide"                     |
| Tool URL           | `https://guide.yourdomain.com/lti/launch` |
| Launch container   | New window                                |

#### Step 2: Grading Configuration

- **Grade**: Set maximum grade (e.g., 100)
- **Grade category**: Choose appropriate category
- **Grade to pass**: Set passing grade if needed

## Dynamic Registration with Moodle

### Method 1: Platform Registration

1. In Moodle, go to **Site administration** → **Plugins** → **External tool** → **Manage tools**
2. Click **Register platform**
3. Enter registration URL: `https://guide.yourdomain.com/lti/register`
4. Click **Register**
5. Complete the registration flow

### Method 2: Tool Registration (Recommended)

1. Access Atomic Guide's registration endpoint: `https://guide.yourdomain.com/lti/register`
2. Select "Moodle" as the platform
3. Enter your Moodle site URL
4. Follow the automated registration process

## Moodle-Specific Implementation

### 1. Moodle LTI Context Handling

```typescript
// Moodle-specific LTI context processing
export class MoodleLTIHandler {
  async processMoodleLaunch(payload: LTIPayload): Promise<MoodleContext> {
    return {
      platform: 'moodle',
      moodleVersion: this.extractMoodleVersion(payload),
      courseId: payload['https://purl.imsglobal.org/spec/lti/claim/context']?.id,
      courseName: payload['https://purl.imsglobal.org/spec/lti/claim/context']?.title,
      userId: payload.sub,
      userName: payload.name,
      userEmail: payload.email,
      roles: payload['https://purl.imsglobal.org/spec/lti/claim/roles'] || [],

      // Moodle-specific claims
      moodleCourseId: payload['https://moodle.org/mod/lti/claim/course']?.id,
      moodleUserId: payload['https://moodle.org/mod/lti/claim/user']?.id,
      moodleInstanceId: payload['https://moodle.org/mod/lti/claim/instance']?.id,

      // Custom parameters from Moodle
      customParams: this.extractCustomParams(payload),
    };
  }

  private extractMoodleVersion(payload: LTIPayload): string {
    const iss = payload.iss;
    // Extract version from issuer or custom claims if available
    return payload['https://moodle.org/version'] || 'unknown';
  }

  private extractCustomParams(payload: LTIPayload): Record<string, string> {
    const customClaims = payload['https://purl.imsglobal.org/spec/lti/claim/custom'] || {};

    return {
      courseId: customClaims.course_id,
      userId: customClaims.user_id,
      userRole: customClaims.user_role,
      contextTitle: customClaims.context_title,
      contextLabel: customClaims.context_label,
    };
  }
}
```

### 2. Moodle Grade Passback

```typescript
// Moodle-specific grade passback implementation
export class MoodleGradeService {
  async postGradeToMoodle(grade: StudentGrade, context: MoodleContext): Promise<GradeResult> {
    const agsEndpoint = context.agsEndpoint;
    if (!agsEndpoint) {
      throw new Error('AGS endpoint not available for this launch');
    }

    const scorePayload = {
      timestamp: new Date().toISOString(),
      scoreGiven: grade.score,
      scoreMaximum: grade.maxScore,
      comment: grade.feedback,
      activityProgress: 'Completed',
      gradingProgress: 'FullyGraded',
      userId: context.userId,
    };

    const response = await fetch(`${agsEndpoint}/scores`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${context.accessToken}`,
        'Content-Type': 'application/vnd.ims.lis.v1.score+json',
      },
      body: JSON.stringify(scorePayload),
    });

    if (!response.ok) {
      throw new Error(`Grade passback failed: ${response.statusText}`);
    }

    return {
      success: true,
      gradeId: await response.json(),
    };
  }

  async getMoodleLineItems(context: MoodleContext): Promise<LineItem[]> {
    const agsEndpoint = context.agsEndpoint;

    const response = await fetch(`${agsEndpoint}/lineitems`, {
      headers: {
        Authorization: `Bearer ${context.accessToken}`,
        Accept: 'application/vnd.ims.lis.v2.lineitemcontainer+json',
      },
    });

    const data = await response.json();
    return data.lineItems || [];
  }
}
```

### 3. Moodle Names and Roles Service

```typescript
// Access Moodle course membership
export class MoodleNRPSService {
  async getMoodleCourseMembers(context: MoodleContext): Promise<MoodleMember[]> {
    const nrpsEndpoint = context.nrpsEndpoint;
    if (!nrpsEndpoint) {
      throw new Error('NRPS endpoint not available');
    }

    const response = await fetch(nrpsEndpoint, {
      headers: {
        Authorization: `Bearer ${context.accessToken}`,
        Accept: 'application/vnd.ims.lis.v2.membershipcontainer+json',
      },
    });

    const data = await response.json();

    return data.members.map((member) => ({
      userId: member.user_id,
      name: member.name,
      email: member.email,
      roles: member.roles,
      moodleUserId: member['https://moodle.org/user_id'],
      enrollmentStatus: member.status,
      picture: member.picture,
    }));
  }
}
```

### 4. Moodle Deep Linking

```typescript
// Create Moodle activities through deep linking
export async function createMoodleActivity(contentItems: DeepLinkingItem[], context: MoodleContext): Promise<DeepLinkingResponse> {
  return {
    '@context': 'http://purl.imsglobal.org/ctx/lti/v1/ContentItem',
    '@graph': contentItems.map((item) => ({
      '@type': 'LtiLinkItem',
      url: `https://guide.yourdomain.com/content/${item.id}`,
      title: item.title,
      text: item.description,
      icon: {
        '@id': 'https://guide.yourdomain.com/images/moodle-icon.png',
        width: 16,
        height: 16,
      },
      custom: {
        activity_type: item.type,
        estimated_time: item.estimatedTime?.toString(),
        difficulty_level: item.difficultyLevel,
      },
      lineItem: {
        scoreConstraints: {
          normalMaximum: item.maxScore,
          extraCreditMaximum: 0,
        },
        resourceId: item.id,
        tag: 'atomic-guide-moodle',
      },
    })),
  };
}
```

## Moodle API Integration

### 1. Moodle Web Services

Enable and use Moodle's web services for enhanced integration:

```typescript
// Moodle Web Services client
export class MoodleWSClient {
  constructor(
    private moodleUrl: string,
    private token: string
  ) {}

  async getCourse(courseId: string): Promise<MoodleCourse> {
    return await this.callWebService('core_course_get_courses', {
      options: {
        ids: [parseInt(courseId)],
      },
    });
  }

  async getEnrolledUsers(courseId: string): Promise<MoodleUser[]> {
    return await this.callWebService('core_enrol_get_enrolled_users', {
      courseid: parseInt(courseId),
    });
  }

  async createGradebookItem(courseId: string, itemName: string, maxGrade: number): Promise<MoodleGradebookItem> {
    return await this.callWebService('core_grades_create_gradecategory', {
      courseid: parseInt(courseId),
      fullname: itemName,
      options: {
        grademax: maxGrade,
      },
    });
  }

  async postGrade(courseId: string, userId: string, gradeItemId: string, grade: number): Promise<void> {
    return await this.callWebService('core_grades_update_grades', {
      source: 'atomic-guide',
      courseid: parseInt(courseId),
      component: 'mod_lti',
      grades: [
        {
          userid: parseInt(userId),
          grade: grade,
        },
      ],
    });
  }

  private async callWebService(wsfunction: string, params: Record<string, any>): Promise<any> {
    const url = new URL(`${this.moodleUrl}/webservice/rest/server.php`);
    url.searchParams.set('wstoken', this.token);
    url.searchParams.set('wsfunction', wsfunction);
    url.searchParams.set('moodlewsrestformat', 'json');

    const formData = new FormData();
    this.flattenParams(params, formData);

    const response = await fetch(url.toString(), {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (data.exception) {
      throw new Error(`Moodle WS Error: ${data.message}`);
    }

    return data;
  }

  private flattenParams(obj: any, formData: FormData, prefix = ''): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}[${key}]` : key;

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        this.flattenParams(value, formData, fullKey);
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'object') {
            this.flattenParams(item, formData, `${fullKey}[${index}]`);
          } else {
            formData.append(`${fullKey}[${index}]`, String(item));
          }
        });
      } else {
        formData.append(fullKey, String(value));
      }
    }
  }
}
```

### 2. Moodle Events Integration

Handle Moodle events via webhooks or scheduled sync:

```typescript
// Process Moodle events
export class MoodleEventProcessor {
  async processEvent(event: MoodleEvent): Promise<void> {
    switch (event.eventname) {
      case 'core\\event\\user_enrolled':
        await this.handleUserEnrollment(event);
        break;

      case 'core\\event\\course_module_created':
        await this.handleModuleCreated(event);
        break;

      case 'mod_assign\\event\\submission_created':
        await this.handleSubmissionCreated(event);
        break;

      case 'core\\event\\user_graded':
        await this.handleUserGraded(event);
        break;
    }
  }

  private async handleUserEnrollment(event: MoodleEvent): Promise<void> {
    const { userid, courseid, roleid } = event.other;

    // Sync user enrollment to Atomic Guide
    await this.syncUserEnrollment({
      moodleUserId: userid,
      moodleCourseId: courseid,
      roleId: roleid,
      enrollmentTime: new Date(event.timecreated * 1000),
    });
  }

  private async handleModuleCreated(event: MoodleEvent): Promise<void> {
    const { modulename, instanceid } = event.other;

    if (modulename === 'lti') {
      // Check if this is an Atomic Guide activity
      const ltiInstance = await this.getMoodleLTIInstance(instanceid);
      if (ltiInstance.toolurl?.includes('guide.yourdomain.com')) {
        await this.syncLTIActivity(ltiInstance);
      }
    }
  }
}
```

## Moodle Configuration

### 1. Environment Variables

```bash
# Moodle-specific configuration
wrangler secret put MOODLE_BASE_URL           # e.g., "https://moodle.yourinstitution.edu"
wrangler secret put MOODLE_WS_TOKEN           # Moodle web services token
wrangler secret put MOODLE_CLIENT_ID          # LTI client ID from Moodle
wrangler secret put MOODLE_DEPLOYMENT_ID      # LTI deployment ID
wrangler secret put MOODLE_WEBHOOK_SECRET     # For webhook validation
```

### 2. Moodle Platform Configuration

```typescript
// Moodle-specific LTI configuration
export const moodleConfig: LTIPlatformConfig = {
  platform: 'moodle',
  clientId: env.MOODLE_CLIENT_ID,
  deploymentId: env.MOODLE_DEPLOYMENT_ID,

  // Moodle LTI 1.3 endpoints
  authLoginUrl: `${env.MOODLE_BASE_URL}/mod/lti/auth.php`,
  authTokenUrl: `${env.MOODLE_BASE_URL}/mod/lti/token.php`,
  keySetUrl: `${env.MOODLE_BASE_URL}/mod/lti/certs.php`,

  // Moodle-specific claim mappings
  claimMappings: {
    userId: 'sub',
    userName: 'name',
    userEmail: 'email',
    contextId: 'https://purl.imsglobal.org/spec/lti/claim/context.id',
    contextTitle: 'https://purl.imsglobal.org/spec/lti/claim/context.title',
    roles: 'https://purl.imsglobal.org/spec/lti/claim/roles',

    // Moodle-specific claims
    moodleUserId: 'https://moodle.org/mod/lti/claim/user.id',
    moodleCourseId: 'https://moodle.org/mod/lti/claim/course.id',
    moodleInstanceId: 'https://moodle.org/mod/lti/claim/instance.id',
  },

  // Required scopes for Moodle
  scopes: [
    'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly',
    'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
    'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
    'https://purl.imsglobal.org/spec/lti-ags/scope/score',
  ],
};
```

## Moodle Testing

### 1. LTI Launch Testing

```typescript
// Test Moodle LTI integration
describe('Moodle LTI Integration', () => {
  it('should handle Moodle LTI launch', async () => {
    const mockMoodlePayload = {
      iss: 'https://moodle.yourinstitution.edu',
      sub: 'moodle-user-123',
      aud: env.MOODLE_CLIENT_ID,

      'https://purl.imsglobal.org/spec/lti/claim/context': {
        id: 'course-456',
        title: 'Introduction to AI',
      },

      'https://purl.imsglobal.org/spec/lti/claim/roles': ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],

      'https://moodle.org/mod/lti/claim/user': {
        id: 'moodle-123',
      },

      'https://moodle.org/mod/lti/claim/course': {
        id: 'course-456',
      },
    };

    const jwt = await signJWT(mockMoodlePayload, moodleJWK);

    const response = await app.request('/lti/launch', {
      method: 'POST',
      body: new URLSearchParams({ id_token: jwt }),
    });

    expect(response.status).toBe(200);
  });
});
```

### 2. Moodle Web Services Testing

```typescript
// Test Moodle WS integration
describe('Moodle Web Services', () => {
  it('should get course information', async () => {
    const wsClient = new MoodleWSClient('https://moodle.test.edu', 'test-token');

    const course = await wsClient.getCourse('123');

    expect(course).toHaveProperty('id', 123);
    expect(course).toHaveProperty('fullname');
  });
});
```

## Moodle Troubleshooting

### Common Issues

#### 1. Tool Not Appearing in Activity Chooser

**Solutions**:

- Check that External tool plugin is enabled
- Verify "Show in activity chooser" is enabled
- Clear Moodle caches: **Site administration** → **Development** → **Purge caches**

#### 2. LTI Launch Fails with Invalid JWT

**Solutions**:

- Verify Moodle site URL matches issuer in JWT
- Check client ID configuration
- Ensure redirect URI is exactly correct
- Verify Moodle's SSL certificate is valid

#### 3. Grade Passback Not Working

**Solutions**:

- Enable "Accept grades from the tool" in external tool configuration
- Verify AGS services are enabled
- Check that activity has grade settings configured
- Ensure proper line item creation

#### 4. Names and Roles Service Issues

**Solutions**:

- Enable "IMS LTI Names and Role Provisioning" service
- Check user privacy settings
- Verify NRPS endpoint accessibility

### Debug Moodle Integration

```typescript
// Moodle-specific debugging
export function debugMoodleLaunch(payload: LTIPayload): void {
  if (env.DEBUG_MOODLE === 'true') {
    console.log('Moodle LTI Debug:', {
      issuer: payload.iss,
      moodleVersion: payload['https://moodle.org/version'],
      courseId: payload['https://moodle.org/mod/lti/claim/course']?.id,
      userId: payload['https://moodle.org/mod/lti/claim/user']?.id,
      instanceId: payload['https://moodle.org/mod/lti/claim/instance']?.id,
      customParams: payload['https://purl.imsglobal.org/spec/lti/claim/custom'],
    });
  }
}
```

### Moodle Support Resources

- **Moodle LTI Documentation**: https://docs.moodle.org/en/External_tool
- **Moodle Developer Documentation**: https://docs.moodle.org/dev/LTI_2_support
- **Moodle Community**: https://moodle.org/community/
- **LTI 1.3 in Moodle**: https://docs.moodle.org/en/LTI_Advantage

## Best Practices for Moodle Integration

1. **Test thoroughly in Moodle sandbox environment**
2. **Use Moodle's built-in debugging tools**
3. **Implement proper error handling for Moodle-specific cases**
4. **Cache Moodle web service responses appropriately**
5. **Follow Moodle coding standards for custom development**
6. **Use Moodle's scheduled tasks for batch operations**
7. **Implement proper user capability checking**
8. **Test with different Moodle themes and configurations**
9. **Handle Moodle's multi-language support**
10. **Monitor Moodle performance impact**
