# API Design and Integration

**API Integration Strategy:**

- **API Design Pattern:** RESTful for CRUD operations, WebSocket for real-time, MCP Server for AI integration
- **Authentication:** LTI JWT extended with tenant_id claim, OAuth via LMS SSO for MCP clients
- **Versioning:** `/api/` namespace for new endpoints, existing LTI paths unchanged

## New API Endpoints

### Cognitive Analytics APIs

**Profile Management**

- **Method:** GET
- **Endpoint:** `/api/learners/:learner_id/profile`
- **Purpose:** Retrieve complete learner DNA profile
- **Integration:** Validates JWT from LTI session

Request: None required (learner_id in path)

Response:

```json
{
  "learner_id": "uuid",
  "cognitive_profile": {
    "memory_architecture": {
      "visual": 0.8,
      "textual": 0.6,
      "mathematical": 0.9
    },
    "learning_velocity": 1.2,
    "engagement_patterns": []
  },
  "privacy_settings": {},
  "last_updated": "2025-01-20T10:00:00Z"
}
```

**Behavioral Signal Ingestion**

- **Method:** POST
- **Endpoint:** `/api/cognitive/signals`
- **Purpose:** Receive Canvas interaction events for processing
- **Integration:** WebSocket upgrade for real-time stream

Request:

```json
{
  "session_id": "uuid",
  "timestamp": "2025-01-20T10:00:00Z",
  "signal_type": "hover|scroll|idle|click",
  "duration_ms": 3500,
  "context": {
    "element_id": "question_5",
    "content_type": "quiz"
  }
}
```

### MCP Protocol Implementation

**MCP Server Architecture:**

```typescript
// Extends McpAgent with LTI context
export class AtomicGuideMCP extends McpAgent<McpProps, Env> {
  server = new McpServer(
    {
      name: 'Atomic Guide Cognitive Intelligence',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: { listChanged: true },
        resources: { listChanged: true },
        prompts: { listChanged: true },
      },
    }
  );
}

// OAuth Provider configuration using LMS SSO
const oauthProvider = new OAuthProvider({
  apiHandlers: {
    '/mcp/:tenant_id': mcpHandler,
  },
  defaultHandler: app, // Existing Hono app
  authorizeEndpoint: '/oauth/authorize',
  tokenEndpoint: '/oauth/token',
  // Use LMS as identity provider
  identityProvider: 'lms-sso',
});
```

**MCP Context Props:**

```typescript
export type McpProps = {
  tenantId: string;
  learnerId: string;
  lmsApiUrl: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  learnerProfile: LearnerDNA;
  courseContext: string;
};
```

**MCP OAuth Endpoints:**

- **Method:** GET
- **Endpoint:** `/.well-known/oauth-authorization-server/mcp/:tenant_id`
- **Purpose:** OAuth discovery for AI clients
- **Integration:** Returns tenant-specific OAuth configuration

- **Method:** GET/POST
- **Endpoint:** `/oauth/authorize`
- **Purpose:** Initiate OAuth flow using LMS credentials
- **Integration:** Redirects to LMS SSO, validates learner consent

- **Method:** POST
- **Endpoint:** `/oauth/token`
- **Purpose:** Exchange authorization code for access token
- **Integration:** Issues scoped tokens for specific learner profiles

- **Method:** GET
- **Endpoint:** `/mcp/:tenant_id`
- **Purpose:** MCP server endpoint for AI clients
- **Integration:** Serves learner DNA via MCP protocol to authorized clients

**MCP Tools Configuration:**

```typescript
configureTools(server, {
  // Cognitive profile retrieval
  getlearnerDNA: async (learnerId) => {
    /* D1 query */
  },
  // Learning recommendations
  getRecommendations: async (learnerId, context) => {
    /* AI inference */
  },
  // Struggle pattern analysis
  analyzePatterns: async (sessionData) => {
    /* Pattern matching */
  },
});
```

### Dashboard APIs

**Learning Sessions**

- **Method:** GET
- **Endpoint:** `/api/learners/:learner_id/sessions`
- **Purpose:** Retrieve learning session history
- **Integration:** Paginated results from D1

**Intervention History**

- **Method:** GET
- **Endpoint:** `/api/learners/:learner_id/interventions`
- **Purpose:** Track help delivered to learner
- **Integration:** Includes effectiveness metrics

### AI Guide Chat APIs

**Send Chat Message**

- **Method:** POST
- **Endpoint:** `/api/chat/message`
- **Purpose:** Process learner question with context (FR4.1)
- **Integration:** Validates session, extracts Canvas context, applies Learner DNA

Request:

```json
{
  "session_id": "uuid",
  "message": "Can you explain this concept?",
  "page_context": {
    "course_id": "CHEM101",
    "module_id": "organic_chemistry",
    "page_content": "extracted HTML/text",
    "current_element": "question_5"
  },
  "conversation_id": "uuid"
}
```

Response:

```json
{
  "response": "Based on your learning style...",
  "suggestions": ["Try this example", "Review prerequisite"],
  "media_attachments": [
    {
      "type": "latex",
      "content": "\\frac{1}{2}mv^2"
    }
  ],
  "token_usage": {
    "used": 150,
    "remaining": 9850
  }
}
```

**Get Conversation History**

- **Method:** GET
- **Endpoint:** `/api/chat/history/:conversation_id`
- **Purpose:** Retrieve previous messages for continuity (FR4.2)
- **Integration:** Returns last 20 messages from Durable Object state

**Generate Proactive Suggestion**

- **Method:** POST
- **Endpoint:** `/api/chat/suggestion`
- **Purpose:** Create contextual help offer based on struggle (FR15)
- **Integration:** Triggered by struggle detection, personalized to learner

**Chat WebSocket Connection**

- **Endpoint:** `wss://domain/ws/chat`
- **Purpose:** Real-time bidirectional chat communication
- **Protocol:** JSON messages over WebSocket

Message Types:

```typescript
type ChatMessage =
  | { type: 'user_message'; content: string; context: PageContext }
  | { type: 'ai_response'; content: string; streaming: boolean }
  | { type: 'suggestion'; content: string; trigger: 'struggle' | 'idle' }
  | { type: 'typing_indicator'; isTyping: boolean }
  | { type: 'rate_limit'; remaining: number; resetAt: number };
```
