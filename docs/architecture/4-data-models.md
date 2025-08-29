# 4. Data Models

## Core Assessment Models

### Conversation Model

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

**TypeScript Interface:**

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

**Relationships:**

- Has many ConversationMessages
- Belongs to AssessmentConfig
- Has one StudentProgress

### AssessmentConfig Model

**Purpose:** Instructor-defined configuration for deep-linked assessment

**Key Attributes:**

- id: string (UUID) - Configuration identifier
- platform_id: string - LTI platform identifier
- resource_link_id: string - Deep linking resource ID
- assessment_type: enum - chat, flashcards, fill_blank
- mastery_threshold: number - Required score (70-100)
- grading_schema: enum - mastery, percentage, engagement

**TypeScript Interface:**

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
  approval_status?: 'pending' | 'approved' | 'rejected';
  instructor_notes?: string;
  persona_config?: {
    type: 'encouraging' | 'socratic' | 'practical' | 'adaptive';
    tone_adjustments?: {
      formality: number; // 0-1 scale
      encouragement: number; // 0-1 scale
      detail_level: number; // 0-1 scale
    };
    adaptation_enabled?: boolean; // Allow AI to adjust persona based on student responses
  };
  video_integration?: {
    enabled: boolean;
    video_sources?: Array<{
      url: string;
      title: string;
      timestamp_mapping?: Record<string, number>; // concept -> timestamp
    }>;
    auto_extract_timestamps?: boolean;
  };
  created_by: string;
  created_at: Date;
  updated_at: Date;
  approved_by?: string;
  approved_at?: Date;
}
```

## Cognitive Learning Models

### Learner Profile Model

**Purpose:** Core cognitive profile storing individual learner's DNA
**Integration:** Links to LTI user via sub claim from JWT

**Key Attributes:**

- id: UUID - Unique identifier
- tenant_id: UUID - Institution identifier (D1 partitioning key)
- lti_user_id: String - Maps to LTI sub claim
- cognitive_profile: JSON - Memory patterns, learning velocity
- privacy_settings: JSON - Consent flags, data sharing preferences
- created_at: Timestamp - Profile creation
- updated_at: Timestamp - Last modification

**TypeScript Interface:**

```typescript
interface LearnerProfile {
  id: string;
  tenant_id: string;
  lti_user_id: string;
  cognitive_profile: {
    memory_architecture: {
      visual: number;
      textual: number;
      mathematical: number;
    };
    learning_velocity: number;
    engagement_patterns: EngagementPattern[];
  };
  privacy_settings: {
    consent_given: boolean;
    data_sharing: boolean;
    ai_analysis: boolean;
  };
  created_at: Date;
  updated_at: Date;
}
```

**Relationships:**

- References LTI platform via iss in KV
- One-to-many with LearningSession, StruggleEvent

### Learning Session Model

**Purpose:** Track individual study sessions and engagement patterns
**Integration:** Created on each LTI launch, tracks Canvas interactions

**Key Attributes:**

- id: UUID - Session identifier
- learner_id: UUID - Foreign key to LearnerProfile
- course_context: String - LTI context_id
- session_start: Timestamp - Launch time
- behavioral_signals: JSON - Hover times, scroll patterns
- interventions_delivered: Array - Help shown during session

### Knowledge Graph Model

**Purpose:** Map prerequisite relationships between concepts across courses
**Integration:** Built from course content analysis, powers predictions with 70-80% accuracy

**Key Attributes:**

- iss: UUID - Platform identifier
- concept_id: UUID - Unique concept identifier
- tenant_id: UUID - Institution scope
- concept_name: String - Human-readable name
- dependencies: Array<UUID> - Prerequisite concepts
- course_contexts: Array - LTI contexts using concept

## Message and Progress Models

### ConversationMessage Model

**Purpose:** Individual message in assessment conversation

**TypeScript Interface:**

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

### StudentProgress Model

**Purpose:** Tracks individual student progress across assessments

**TypeScript Interface:**

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

## Redux State Models

### Global Application State

**Purpose:** Centralized state management using Redux Toolkit
**Storage:** In-memory Redux store with persistence to sessionStorage for critical data

**TypeScript Interface:**

```typescript
// Redux Store Shape
interface RootState {
  auth: AuthState;
  assessment: AssessmentState;
  chat: ChatState;
  ui: UIState;
  // RTK Query API slices
  api: {
    assessmentApi: AssessmentApiState;
    chatApi: ChatApiState;
    canvasApi: CanvasApiState;
  };
}

interface AuthState {
  user: {
    id: string;
    name: string;
    email: string;
    roles: string[];
  } | null;
  ltiClaims: Record<string, any>;
  isAuthenticated: boolean;
}

interface AssessmentState {
  activeConfig: AssessmentConfig | null;
  activeConversation: Conversation | null;
  progress: StudentProgress | null;
  loading: boolean;
  error: string | null;
}

interface ChatState {
  messages: ConversationMessage[];
  isTyping: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  streamingMessage: string | null;
}
```

### Vectorize Search Models

**Purpose:** Semantic search data structures for Cloudflare Vectorize V2
**Integration:** Powers content discovery and similarity matching

**TypeScript Interface:**

```typescript
interface VectorizeVector {
  id: string;
  values: number[] | Float32Array | Float64Array; // Embedding dimensions must match index config
  metadata?: Record<string, any>; // Max 10KiB per vector
  namespace?: string; // Optional namespace for segmentation (max 1000 per index)
}

interface VectorizeQueryOptions {
  topK?: number; // Number of results to return (default: 5)
  returnValues?: boolean; // true = high precision scoring, higher latency
  returnMetadata?: 'none' | 'indexed' | 'all'; // Metadata to return
  namespace?: string; // Query within specific namespace
  filter?: Record<string, any>; // Metadata filters (requires metadata indexes)
}

interface VectorizeMatch {
  id: string;
  score: number; // Distance based on metric (cosine: -1 to 1, euclidean: 0+, dot: negative better)
  values?: number[]; // Only if returnValues: true
  metadata?: Record<string, any>;
}

interface SearchResult {
  count: number;
  matches: VectorizeMatch[];
}
```
