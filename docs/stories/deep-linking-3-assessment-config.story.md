# Deep Linking Story 3: Assessment Configuration via LTI Resource Link

## Story Overview

As an instructor, I want to configure and embed assessments from the Atomic Guide tool that can report grades back to the LMS gradebook, so students can complete activities that automatically sync their scores with the course grading system.

## Actors

- **Instructor**: Creates and configures graded assessments
- **Student**: Completes assessments for grades
- **LMS Platform**: Manages gradebook and grade passback
- **Atomic Guide Tool**: Provides assessment creation and grading

## Preconditions

1. Tool has Assignment and Grade Services (AGS) scopes enabled
2. Platform supports LTI 1.3 grade passback
3. Deep linking request includes 'ltiResourceLink' in accept_types
4. Tool configuration includes AGS endpoints

## Main Flow

### 1. Assessment Type Detection

**System Context:** Platform sends deep linking request
**Detection Logic:**

```javascript
// Check if platform accepts LTI Resource Links
if (launchSettings.deepLinking?.accept_types?.includes('ltiResourceLink')) {
  // Enable assessment creation mode
  showAssessmentBuilder();
}
```

### 2. Assessment Builder Interface

**Actor:** Tool
**Action:** Displays assessment configuration UI
**Configuration Options:**

```typescript
interface AssessmentConfig {
  // Basic Information
  title: string;
  description: string;
  instructions: string;

  // Grading Settings
  maxScore: number;
  passingScore: number;
  attempts: number | 'unlimited';

  // Timing
  timeLimit?: number; // in minutes
  availableFrom?: Date;
  availableUntil?: Date;

  // Assessment Type
  type: 'quiz' | 'assignment' | 'discussion' | 'practice';

  // Grade Passback
  scoreType: 'percentage' | 'points' | 'complete/incomplete';
  releaseGrades: 'immediate' | 'manual' | 'after_due_date';
}
```

### 3. LTI Resource Link Creation

**System Process:**

```javascript
const ltiResourceLink = {
  type: 'ltiResourceLink',
  title: 'Chapter 5 Quiz',
  text: 'Assessment on data structures',
  url: 'https://atomicguide.example.com/assessments/quiz-123',

  // LTI-specific properties
  custom: {
    assessment_id: 'quiz-123',
    max_score: 100,
    attempts_allowed: 3,
    time_limit: 30,
  },

  // Line item for gradebook
  lineItem: {
    scoreMaximum: 100,
    label: 'Chapter 5 Quiz',
    resourceId: 'quiz-123',
    tag: 'assessment',
    startDateTime: '2024-01-15T09:00:00Z',
    endDateTime: '2024-01-22T23:59:59Z',
  },

  // Available dates
  available: {
    startDateTime: '2024-01-15T09:00:00Z',
    endDateTime: '2024-01-22T23:59:59Z',
  },

  // Submission format
  submission: {
    startDateTime: '2024-01-15T09:00:00Z',
    endDateTime: '2024-01-22T23:59:59Z',
  },
};
```

### 4. Assessment Components

#### Component A: Quiz Assessment

```javascript
{
  type: 'ltiResourceLink',
  title: 'Unit 3 Quiz',
  url: buildAssessmentUrl('quiz', quizId),
  custom: {
    questions: [
      {
        type: 'multiple_choice',
        question: 'What is the time complexity of quicksort?',
        options: ['O(n)', 'O(n log n)', 'O(n²)', 'O(log n)'],
        correct: 1,
        points: 10
      },
      {
        type: 'true_false',
        question: 'Arrays have constant time access',
        correct: true,
        points: 5
      }
    ]
  },
  lineItem: {
    scoreMaximum: 100,
    label: 'Unit 3 Quiz'
  }
}
```

#### Component B: Assignment Submission

```javascript
{
  type: 'ltiResourceLink',
  title: 'Programming Assignment 2',
  url: buildAssessmentUrl('assignment', assignmentId),
  custom: {
    submission_types: ['file_upload', 'text_entry'],
    allowed_extensions: ['.py', '.java', '.cpp'],
    max_file_size: 10485760, // 10MB
    rubric_id: 'rubric-456'
  },
  lineItem: {
    scoreMaximum: 150,
    label: 'Programming Assignment 2',
    resourceId: 'assignment-789'
  }
}
```

#### Component C: Auto-Graded Exercise

```javascript
{
  type: 'ltiResourceLink',
  title: 'Practice Exercises',
  url: buildAssessmentUrl('practice', exerciseId),
  custom: {
    auto_grade: true,
    show_solution_after: 'submission',
    partial_credit: true,
    exercise_bank: 'data_structures_basics'
  },
  lineItem: {
    scoreMaximum: 50,
    label: 'Practice Exercises',
    tag: 'formative'
  }
}
```

### 5. Grade Line Item Configuration

**Actor:** Instructor
**Action:** Configures gradebook settings
**Line Item Properties:**

```typescript
interface LineItem {
  scoreMaximum: number; // Maximum points possible
  label: string; // Gradebook column name
  resourceId?: string; // Unique identifier
  tag?: string; // Category tag
  resourceLinkId?: string; // Link to resource
  startDateTime?: string; // ISO 8601 date
  endDateTime?: string; // ISO 8601 date

  // Grading type extension
  'https://atomicjolt.com/lineitem': {
    gradingType: 'points' | 'percentage' | 'letter_grade';
    latePolicy: 'accept' | 'reject' | 'deduct_percentage';
    lateDeduction?: number;
  };
}
```

### 6. Platform Registration

**System Process:**

1. Tool sends deep link response with LTI Resource Link
2. Platform creates grade line item in gradebook
3. Platform stores assessment configuration
4. Platform assigns unique resource_link_id

### 7. Student Launch Flow

#### Launch Initiation

**Actor:** Student
**Action:** Clicks on assessment in course
**Platform Process:**

```javascript
// Platform sends launch with additional claims
{
  "https://purl.imsglobal.org/spec/lti/claim/message_type": "LtiResourceLinkRequest",
  "https://purl.imsglobal.org/spec/lti/claim/resource_link": {
    "id": "resource-link-123",
    "title": "Chapter 5 Quiz",
    "description": "Assessment on data structures"
  },
  "https://purl.imsglobal.org/spec/lti-ags/claim/endpoint": {
    "scope": [
      "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem",
      "https://purl.imsglobal.org/spec/lti-ags/scope/score"
    ],
    "lineitems": "https://lms.example.com/api/lti/courses/123/line_items",
    "lineitem": "https://lms.example.com/api/lti/courses/123/line_items/456"
  }
}
```

#### Assessment Loading

**Tool Process:**

```javascript
async function loadAssessment(launchData) {
  // Extract assessment ID from resource link
  const assessmentId = launchData.resource_link.id;

  // Load assessment configuration
  const assessment = await fetchAssessment(assessmentId);

  // Check attempt limits
  const attempts = await getUserAttempts(launchData.user.id, assessmentId);

  if (attempts >= assessment.maxAttempts) {
    return showMaxAttemptsReached();
  }

  // Initialize assessment session
  return initializeAssessment(assessment, launchData);
}
```

### 8. Assessment Completion

#### Score Calculation

**System Process:**

```javascript
function calculateScore(responses, answerKey) {
  let totalPoints = 0;
  let earnedPoints = 0;

  responses.forEach((response, index) => {
    const question = answerKey[index];
    totalPoints += question.points;

    if (evaluateResponse(response, question)) {
      earnedPoints += question.points;
    }
  });

  return {
    scoreGiven: earnedPoints,
    scoreMaximum: totalPoints,
    scorePassed: earnedPoints >= totalPoints * 0.7,
    comment: generateFeedback(responses, answerKey),
  };
}
```

### 9. Grade Passback

#### OAuth 2.0 Token Request

**System Process:**

```javascript
async function getAccessToken(env) {
  const response = await fetch(launchData.ags.token_url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: await createClientAssertion(env),
      scope: 'https://purl.imsglobal.org/spec/lti-ags/scope/score',
    }),
  });

  const token = await response.json();
  return token.access_token;
}
```

#### Score Submission

**System Process:**

```javascript
async function submitScore(score, lineItemUrl, accessToken) {
  const scorePayload = {
    timestamp: new Date().toISOString(),
    scoreGiven: score.earned,
    scoreMaximum: score.maximum,
    activityProgress: 'Completed',
    gradingProgress: 'FullyGraded',
    userId: launchData.sub,
    comment: score.feedback,
  };

  const response = await fetch(`${lineItemUrl}/scores`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/vnd.ims.lis.v1.score+json',
    },
    body: JSON.stringify(scorePayload),
  });

  return response.ok;
}
```

### 10. Gradebook Update

**Actor:** LMS Platform
**Action:** Updates student grade
**Process:**

1. Validates score submission JWT
2. Updates gradebook with new score
3. Applies any grade policies (late penalties, curves)
4. Notifies student if configured

## Advanced Features

### Feature A: Rubric-Based Grading

```javascript
{
  type: 'ltiResourceLink',
  custom: {
    rubric: {
      criteria: [
        {
          id: 'content',
          description: 'Content Quality',
          levels: [
            { points: 10, description: 'Excellent' },
            { points: 7, description: 'Good' },
            { points: 4, description: 'Needs Improvement' },
            { points: 0, description: 'Missing' }
          ]
        }
      ]
    }
  }
}
```

### Feature B: Peer Assessment

```javascript
{
  type: 'ltiResourceLink',
  custom: {
    peer_review: {
      enabled: true,
      reviews_per_student: 3,
      anonymous: true,
      due_date: '2024-01-25T23:59:59Z'
    }
  }
}
```

### Feature C: Adaptive Testing

```javascript
{
  type: 'ltiResourceLink',
  custom: {
    adaptive: {
      initial_difficulty: 'medium',
      question_bank_size: 100,
      target_accuracy: 0.7,
      max_questions: 20
    }
  }
}
```

## Error Handling

### E1: Grade Passback Failure

**Condition:** AGS endpoint returns error
**Recovery:**

1. Store score locally in queue
2. Retry with exponential backoff
3. Alert instructor after 3 failures
4. Provide manual grade export option

### E2: Invalid Assessment Configuration

**Condition:** Required fields missing
**Response:**

```javascript
if (!assessment.lineItem?.scoreMaximum) {
  return {
    error: 'Invalid configuration',
    message: 'Assessment must have maximum score defined',
    field: 'lineItem.scoreMaximum',
  };
}
```

### E3: Token Expiration

**Condition:** OAuth token expires during submission
**Recovery:**

1. Detect 401 response
2. Request new token
3. Retry score submission
4. Update token cache

## Security Considerations

### Authentication Chain

1. Student authenticates with LMS
2. LMS generates signed JWT for launch
3. Tool validates JWT signature
4. Tool requests OAuth token for AGS
5. Tool submits scores with OAuth token

### Data Protection

```javascript
// Encrypt sensitive assessment data
function encryptAssessmentData(data, key) {
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(data))
  );
  return { encrypted, iv };
}
```

### Attempt Verification

```javascript
// Prevent attempt manipulation
async function verifyAttempt(userId, assessmentId, attemptToken) {
  const stored = await env.ATTEMPTS.get(`${userId}:${assessmentId}`);
  const attempt = JSON.parse(stored);

  // Verify token matches
  if (attempt.token !== attemptToken) {
    throw new Error('Invalid attempt token');
  }

  // Check time limits
  if (Date.now() > attempt.expiresAt) {
    throw new Error('Attempt expired');
  }

  return attempt;
}
```

## Success Metrics

1. 100% of valid scores successfully posted to gradebook
2. Assessment load time under 2 seconds
3. Grade passback completed within 5 seconds
4. Zero data loss for submitted assessments
5. Full compliance with LTI 1.3 AGS specification

## Implementation Notes

### Database Schema

```sql
-- Assessment configurations
CREATE TABLE assessments (
  id UUID PRIMARY KEY,
  title VARCHAR(255),
  config JSONB,
  created_by VARCHAR(255),
  created_at TIMESTAMP
);

-- Student attempts
CREATE TABLE attempts (
  id UUID PRIMARY KEY,
  assessment_id UUID REFERENCES assessments(id),
  user_id VARCHAR(255),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  score DECIMAL(5,2),
  responses JSONB
);

-- Grade sync queue
CREATE TABLE grade_queue (
  id UUID PRIMARY KEY,
  attempt_id UUID REFERENCES attempts(id),
  status VARCHAR(50),
  retry_count INT DEFAULT 0,
  last_error TEXT,
  next_retry TIMESTAMP
);
```

### State Management

```javascript
// Using Durable Objects for attempt state
export class AssessmentAttemptDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const { method, action } = await request.json();

    switch (action) {
      case 'start':
        return this.startAttempt(request);
      case 'submit':
        return this.submitAnswer(request);
      case 'complete':
        return this.completeAttempt(request);
    }
  }
}
```

## Related Components

- AGS Library: `@atomicjolt/lti-ags`
- Score submission: `src/services/grading.ts`
- Assessment storage: `src/db/assessments.ts`
- OAuth handling: `src/auth/oauth.ts`
