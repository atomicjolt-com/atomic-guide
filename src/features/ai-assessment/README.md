# AI Chat Assessment System (Story 7.3)

## Overview

The AI Chat Assessment System provides student-facing conversational assessments with automatic Canvas grade passback integration. This system builds upon the Canvas PostMessage Integration (Story 7.1) and Deep Linking Configuration Interface (Story 7.2) to deliver comprehensive AI-powered assessment capabilities.

## Architecture

### Vertical Slice Structure

```
src/features/ai-assessment/
├── shared/
│   └── types.ts                          # Shared TypeScript types and schemas
├── server/
│   ├── services/
│   │   ├── ConversationalAssessmentEngine.ts    # Core assessment orchestration
│   │   ├── AssessmentAIService.ts               # Workers AI integration
│   │   ├── AssessmentContentGenerator.ts        # Dynamic question generation
│   │   ├── CanvasGradePassbackService.ts       # LTI Grade Service integration
│   │   └── AssessmentSecurityService.ts         # Security and integrity validation
│   ├── repositories/
│   │   └── AssessmentSessionRepository.ts       # D1 database persistence
│   └── handlers/
│       └── AssessmentHandler.ts                 # REST API endpoints
└── client/
    └── components/
        └── ConversationalAssessmentInterface.tsx # React chat interface
```

### Database Schema

The system uses the following D1 tables (see `migrations/012_ai_chat_assessment_tables.sql`):

- `assessment_sessions` - Core session data and state
- `assessment_messages` - Conversation history
- `assessment_session_configs` - Assessment configurations
- `assessment_grade_calculations` - Grade calculations and passback tracking
- `assessment_audit_log` - Compliance and audit trail
- `assessment_security_incidents` - Academic integrity violations
- Additional supporting tables for analytics and caching

## Core Components

### 1. ConversationalAssessmentEngine

The main orchestrator that manages assessment session lifecycle:

```typescript
import { ConversationalAssessmentEngine } from './server/services/ConversationalAssessmentEngine';

// Initialize session
const session = await engine.initializeSession(sessionConfig);

// Process student response
const updatedSession = await engine.processStudentResponse(
  sessionId,
  studentResponse,
  metadata
);

// Calculate final grade
const gradeCalculation = await engine.calculateFinalGrade(sessionId);
```

### 2. AssessmentAIService

Handles all AI interactions using Workers AI:

```typescript
import { AssessmentAIService } from './server/services/AssessmentAIService';

// Analyze student response
const analysis = await aiService.analyzeStudentResponse(
  response,
  conversationContext
);

// Generate AI response
const aiResponse = await aiService.generateResponse(
  responseType,
  context
);
```

### 3. React Chat Interface

Student-facing conversational interface:

```tsx
import { ConversationalAssessmentInterface } from './client/components/ConversationalAssessmentInterface';

<ConversationalAssessmentInterface
  sessionId={sessionId}
  onComplete={(session) => console.log('Assessment completed:', session)}
  onError={(error) => console.error('Assessment error:', error)}
  autoFocus={true}
  enableVoiceInput={false}
  enableFileUpload={false}
/>
```

## Integration Points

### With Story 7.1 (Canvas PostMessage Integration)

- Uses `ContentAnalysisService` for Canvas content extraction
- Leverages behavioral signal detection for learning analytics
- Integrates with struggle detection for proactive interventions

### With Story 7.2 (Deep Linking Configuration Interface)

- Uses `AssessmentConfiguration` types and schemas
- Integrates with assessment placement and settings
- Leverages instructor-configured thresholds and criteria

### Canvas LTI Integration

The system integrates with Canvas through:

1. **LTI 1.3 Assignment and Grade Service (AGS)**
2. **Deep Linking for assessment placement**
3. **Names and Roles Provisioning Service (NRPS)**

## API Endpoints

### Assessment Session Management

```typescript
// Create new session
POST /api/ai-assessment/sessions
{
  "configId": "uuid",
  "studentId": "lti_user_id",
  "courseId": "lti_course_id",
  "assessmentTitle": "AI Assessment",
  "settings": { /* assessment settings */ },
  "context": { /* learning context */ },
  "grading": { /* grading configuration */ }
}

// Get session
GET /api/ai-assessment/sessions/:sessionId

// Submit student response
POST /api/ai-assessment/sessions/:sessionId/respond
{
  "response": "student answer text",
  "metadata": { "responseTimeMs": 5000 }
}

// Calculate and submit grade
POST /api/ai-assessment/sessions/:sessionId/grade
```

### Content Generation

```typescript
// Generate assessment questions
POST /api/ai-assessment/generate-content
{
  "configId": "uuid",
  "contentReference": "canvas_content_url",
  "questionCount": 5
}
```

### Analytics and Monitoring

```typescript
// Get assessment analytics
GET /api/ai-assessment/analytics?courseId=123&startDate=2025-01-01

// Health check
GET /api/ai-assessment/health
```

## Security Features

### Academic Integrity

- **Response Analysis**: AI-powered detection of suspicious patterns
- **Temporal Analysis**: Typing speed and timing pattern validation
- **Content Similarity**: Detection of copied or AI-generated responses
- **Session Monitoring**: Concurrent session and tampering detection

### Rate Limiting

- 30 requests per minute per user
- 200 requests per hour per user
- 5000 character limit per response
- Minimum 1 second between responses

### Data Protection

- All sensitive data encrypted in transit and at rest
- FERPA-compliant audit logging
- Secure session token management
- Input sanitization and validation

## Configuration

### Environment Variables

```bash
# Workers AI Configuration
AI_MODEL=@cf/meta/llama-3.1-8b-instruct
AI_MAX_TOKENS=2048
AI_TEMPERATURE=0.7

# Canvas Integration
CANVAS_BASE_URL=https://canvas.instructure.com
CANVAS_CLIENT_ID=your_lti_client_id
CANVAS_DEPLOYMENT_ID=your_deployment_id

# Security Settings
RATE_LIMIT_PER_MINUTE=30
RATE_LIMIT_PER_HOUR=200
MAX_RESPONSE_LENGTH=5000
```

### Assessment Configuration

```typescript
const assessmentConfig = {
  settings: {
    masteryThreshold: 0.75,        // 75% mastery required
    maxAttempts: 3,                // Maximum 3 attempts
    timeLimit: 30,                 // 30 minutes (optional)
    allowHints: true,              // AI can provide hints
    showFeedback: true,            // Show immediate feedback
    adaptiveDifficulty: true,      // Adjust difficulty based on performance
    requireMastery: true           // Must achieve mastery to complete
  },
  grading: {
    passbackEnabled: true,         // Enable Canvas grade passback
    pointsPossible: 100,           // 100 points possible
    gradingRubric: {
      masteryWeight: 0.6,          // 60% weight for concept mastery
      participationWeight: 0.3,    // 30% weight for participation
      improvementWeight: 0.1       // 10% weight for improvement
    }
  }
};
```

## Usage Examples

### Basic Assessment Session

```typescript
import { ConversationalAssessmentEngine } from './server/services/ConversationalAssessmentEngine';
import { AssessmentAIService } from './server/services/AssessmentAIService';
import { AssessmentSessionRepository } from './server/repositories/AssessmentSessionRepository';

// Initialize services
const aiService = new AssessmentAIService(env.AI);
const repository = new AssessmentSessionRepository(db);
const engine = new ConversationalAssessmentEngine(aiService, repository, db);

// Create session
const session = await engine.initializeSession({
  configId: 'assessment-config-id',
  studentId: 'student-123',
  courseId: 'course-456',
  assessmentTitle: 'Chapter 1 Understanding Check',
  settings: {
    masteryThreshold: 0.75,
    maxAttempts: 3,
    allowHints: true,
    showFeedback: true,
    adaptiveDifficulty: true,
    requireMastery: false
  },
  context: {
    learningObjectives: ['Understand key concepts', 'Apply knowledge'],
    concepts: ['concept1', 'concept2'],
    contentReference: 'canvas://assignment/123'
  },
  grading: {
    passbackEnabled: true,
    pointsPossible: 100,
    gradingRubric: {
      masteryWeight: 0.7,
      participationWeight: 0.2,
      improvementWeight: 0.1
    }
  }
});

// Process student responses
const response1 = await engine.processStudentResponse(
  session.id,
  "I think the main concept is about understanding how systems work together.",
  { responseTimeMs: 15000 }
);

const response2 = await engine.processStudentResponse(
  session.id,
  "Can you give me a hint about the second part?",
  { responseTimeMs: 8000 }
);

// Calculate final grade when session completes
if (response2.status === 'completed' || response2.status === 'mastery_achieved') {
  const grade = await engine.calculateFinalGrade(session.id);
  console.log('Final grade:', grade.numericScore);
}
```

### React Component Integration

```tsx
import React from 'react';
import { ConversationalAssessmentInterface } from './client/components/ConversationalAssessmentInterface';

export const AssessmentPage: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const handleComplete = (session) => {
    console.log('Assessment completed with status:', session.status);
    // Redirect or show completion message
  };

  const handleError = (error) => {
    console.error('Assessment error:', error);
    // Show error message to student
  };

  return (
    <div className="h-screen flex flex-col">
      <header className="bg-blue-600 text-white p-4">
        <h1>AI-Powered Assessment</h1>
      </header>
      <main className="flex-1">
        <ConversationalAssessmentInterface
          sessionId={sessionId}
          onComplete={handleComplete}
          onError={handleError}
          autoFocus={true}
          className="h-full"
        />
      </main>
    </div>
  );
};
```

## Testing

### Unit Tests

Run tests for individual components:

```bash
npm test src/features/ai-assessment/server/services/ConversationalAssessmentEngine.test.ts
npm test src/features/ai-assessment/server/services/AssessmentAIService.test.ts
npm test src/features/ai-assessment/client/components/ConversationalAssessmentInterface.test.tsx
```

### Integration Tests

Test the complete assessment flow:

```bash
npm test src/features/ai-assessment/__tests__/assessment-flow.integration.test.ts
```

### Canvas Integration Testing

Use Playwright MCP to test in Canvas:

1. Login at `https://atomicjolt.instructure.com/`
2. Navigate to test course: `https://atomicjolt.instructure.com/courses/253/external_tools/24989`
3. Launch AI assessment from within Canvas iframe
4. Test conversational flow and grade passback

## Monitoring and Analytics

### Performance Metrics

The system tracks:
- AI response latency
- Session processing time
- Grade passback success rates
- Student engagement metrics
- Academic integrity incidents

### Instructor Dashboard

Instructors can view:
- Real-time assessment progress
- Student performance analytics
- Common misconceptions identified
- AI quality metrics and feedback

## Deployment

### Database Migration

Run the assessment tables migration:

```bash
npm run db:migrate:remote
```

### Environment Setup

Ensure all required environment variables are configured in `.dev.vars` for local development and in Cloudflare Workers settings for production.

### Monitoring

Set up monitoring for:
- Assessment system health endpoint
- Grade passback error rates
- AI service availability
- Database performance
- Security incident alerts

## Future Enhancements

1. **Multi-Modal Support**: Image and video content in assessments
2. **Voice Interaction**: Speech-to-text and text-to-speech capabilities
3. **Advanced Analytics**: Machine learning-powered learning insights
4. **Collaborative Assessments**: Group-based conversational assessments
5. **Accessibility Features**: Enhanced screen reader support and keyboard navigation

## Support and Troubleshooting

### Common Issues

1. **Session Not Found**: Check session ID validity and user permissions
2. **Grade Passback Failed**: Verify Canvas LTI configuration and access tokens
3. **AI Response Timeout**: Check Workers AI service status and rate limits
4. **Security Violations**: Review academic integrity settings and thresholds

### Debug Endpoints

- `GET /api/ai-assessment/health` - System health check
- `GET /api/ai-assessment/sessions/:id` - Session state inspection
- Monitor audit logs in `assessment_audit_log` table

### Contact

For technical support, refer to the main project documentation or contact the development team through the established channels.