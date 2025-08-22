# 4. Data Models

## Conversation Model

**Purpose:** Represents an assessment conversation session between student and AI

**Key Attributes:**

- id: string (UUID) - Unique conversation identifier
- assessment_config_id: string - Reference to assessment configuration
- user_id: string - LTI user identifier
- course_id: string - Canvas course identifier
- status: enum - active, completed, abandoned
- started_at: timestamp - Conversation start time
- completed_at: timestamp - Completion time
- mastery_score: number - Current mastery level (0-100)

### TypeScript Interface

```typescript
interface Conversation {
  id: string;
  assessment_config_id: string;
  user_id: string;
  course_id: string;
  status: 'active' | 'completed' | 'abandoned';
  started_at: Date;
  completed_at?: Date;
  mastery_score: number;
  metadata: {
    page_content_hash?: string;
    canvas_assignment_id?: string;
  };
}
```

### Relationships

- Has many ConversationMessages
- Belongs to AssessmentConfig
- Has one StudentProgress

## AssessmentConfig Model

**Purpose:** Instructor-defined configuration for deep-linked assessment

**Key Attributes:**

- id: string (UUID) - Configuration identifier
- platform_id: string - LTI platform identifier
- resource_link_id: string - Deep linking resource ID
- assessment_type: enum - chat, flashcards, fill_blank
- mastery_threshold: number - Required score (70-100)
- grading_schema: enum - mastery, percentage, engagement

### TypeScript Interface

```typescript
interface AssessmentConfig {
  id: string;
  platform_id: string;
  resource_link_id: string;
  assessment_type: 'chat' | 'flashcards' | 'fill_blank';
  mastery_threshold: number;
  grading_schema: 'mastery' | 'percentage' | 'engagement';
  ai_config: {
    temperature: number;
    max_tokens: number;
    system_prompt?: string;
  };
  created_by: string;
  created_at: Date;
  updated_at: Date;
}
```

### Relationships

- Has many Conversations
- Has many GeneratedContent items
- Belongs to Platform (via KV)

## ConversationMessage Model

**Purpose:** Individual message in assessment conversation

**Key Attributes:**

- id: string - Message identifier
- conversation_id: string - Parent conversation
- role: enum - user, assistant, system
- content: string - Message text
- metadata: object - Context, references

### TypeScript Interface

```typescript
interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: {
    content_references?: string[];
    confidence_score?: number;
    remediation_provided?: boolean;
  };
  created_at: Date;
}
```

### Relationships

- Belongs to Conversation

## StudentProgress Model

**Purpose:** Tracks individual student progress across assessments

**Key Attributes:**

- id: string - Progress record identifier
- user_id: string - Student LTI identifier
- course_id: string - Canvas course ID
- total_assessments: number - Count of attempted assessments
- average_mastery: number - Average mastery score
- struggle_patterns: object - Identified learning gaps

### TypeScript Interface

```typescript
interface StudentProgress {
  id: string;
  user_id: string;
  course_id: string;
  total_assessments: number;
  average_mastery: number;
  struggle_patterns: {
    concepts: string[];
    remediation_count: number;
  };
  last_activity: Date;
}
```
