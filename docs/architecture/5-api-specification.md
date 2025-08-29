# 5. API Specification

## REST API Specification

```yaml
openapi: 3.0.0
info:
  title: Atomic Guide Assessment API
  version: 1.0.0
  description: Deep linking assessment endpoints for Canvas LTI integration
servers:
  - url: https://atomic-guide.atomicjolt.com/api
    description: Production API

paths:
  /assessment/config:
    post:
      summary: Create assessment configuration
      security:
        - ltiJWT: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/AssessmentConfig'
      responses:
        201:
          description: Configuration created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AssessmentConfig'

  /assessment/config/{id}:
    get:
      summary: Get assessment configuration
      security:
        - ltiJWT: []
      parameters:
        - in: path
          name: id
          required: true
          schema:
            type: string
      responses:
        200:
          description: Configuration retrieved

  /assessment/conversation:
    post:
      summary: Start new conversation
      security:
        - ltiJWT: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                assessment_config_id:
                  type: string
                page_content:
                  type: string
      responses:
        201:
          description: Conversation started
          content:
            application/json:
              schema:
                type: object
                properties:
                  conversation_id:
                    type: string
                  websocket_url:
                    type: string

  /assessment/conversation/{id}/message:
    post:
      summary: Send message in conversation
      security:
        - ltiJWT: []
      parameters:
        - in: path
          name: id
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
                context:
                  type: object
      responses:
        200:
          description: Message processed

  /assessment/grade:
    post:
      summary: Submit grade to Canvas AGS
      security:
        - ltiJWT: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                conversation_id:
                  type: string
                score:
                  type: number
      responses:
        200:
          description: Grade submitted

  /assessment/analytics:
    get:
      summary: Get instructor analytics
      security:
        - ltiJWT: []
      parameters:
        - in: query
          name: course_id
          schema:
            type: string
        - in: query
          name: assignment_id
          schema:
            type: string
      responses:
        200:
          description: Analytics data
          content:
            application/json:
              schema:
                type: object
                properties:
                  student_progress:
                    type: array
                  common_misconceptions:
                    type: array
                  completion_rates:
                    type: object

components:
  schemas:
    AssessmentConfig:
      type: object
      required:
        - assessment_type
        - mastery_threshold
        - grading_schema
      properties:
        assessment_type:
          type: string
          enum: [chat, flashcards, fill_blank]
        mastery_threshold:
          type: number
          minimum: 70
          maximum: 100
        grading_schema:
          type: string
          enum: [mastery, percentage, engagement]
        ai_config:
          type: object
          properties:
            temperature:
              type: number
            max_tokens:
              type: integer
            system_prompt:
              type: string

  securitySchemes:
    ltiJWT:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

## Cognitive Analytics APIs

### Profile Management

- **Method:** GET
- **Endpoint:** `/api/learners/:learner_id/profile`
- **Purpose:** Retrieve complete learner DNA profile
- **Integration:** Validates JWT from LTI session

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

### Behavioral Signal Ingestion

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

## AI Guide Chat APIs

### Send Chat Message

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

### Chat WebSocket Connection

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

## RTK Query API Implementation

### API Slice Configuration

**Purpose:** Centralized API management with caching, invalidation, and optimistic updates
**Integration:** Automatic integration with Redux store

```typescript
// Assessment API Slice
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const assessmentApi = createApi({
  reducerPath: 'assessmentApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/assessment',
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.token;
      if (token) headers.set('authorization', `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ['Assessment', 'Conversation', 'Progress'],
  endpoints: (builder) => ({
    getAssessmentConfig: builder.query<AssessmentConfig, string>({
      query: (id) => `/config/${id}`,
      providesTags: ['Assessment'],
    }),
    createConversation: builder.mutation<Conversation, CreateConversationDto>({
      query: (data) => ({
        url: '/conversation',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Conversation'],
    }),
    streamChat: builder.mutation<void, ChatMessage>({
      queryFn: async (message, api, extraOptions, baseQuery) => {
        // WebSocket streaming implementation
        const ws = new WebSocket(`${WS_URL}/chat`);
        // Handle streaming responses
        return { data: undefined };
      },
    }),
  }),
});

// Canvas API Integration
export const canvasApi = createApi({
  reducerPath: 'canvasApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api/canvas' }),
  endpoints: (builder) => ({
    getNamesAndRoles: builder.query<CanvasRoster, void>({
      query: () => '/names_and_roles',
      transformResponse: (response: any) => response.members,
    }),
    submitGrade: builder.mutation<void, GradeSubmission>({
      query: (grade) => ({
        url: '/grade',
        method: 'POST',
        body: grade,
      }),
    }),
  }),
});
```

### Real-time WebSocket Integration

```typescript
// Chat WebSocket middleware for Redux
export const chatWebSocketMiddleware: Middleware = (store) => {
  let socket: WebSocket | null = null;

  return (next) => (action) => {
    if (startConversation.match(action)) {
      socket = new WebSocket(action.payload.websocketUrl);

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        store.dispatch(addChatMessage(message));
      };

      socket.onerror = () => {
        store.dispatch(setChatConnectionStatus('disconnected'));
      };
    }

    if (sendMessage.match(action) && socket) {
      socket.send(JSON.stringify(action.payload));
    }

    return next(action);
  };
};
```

## MCP Protocol Implementation

### MCP Server Architecture

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
```

### MCP OAuth Endpoints

- **Method:** GET
- **Endpoint:** `/.well-known/oauth-authorization-server/mcp/:tenant_id`
- **Purpose:** OAuth discovery for AI clients

- **Method:** GET/POST
- **Endpoint:** `/oauth/authorize`
- **Purpose:** Initiate OAuth flow using LMS credentials

- **Method:** POST
- **Endpoint:** `/oauth/token`
- **Purpose:** Exchange authorization code for access token

- **Method:** GET
- **Endpoint:** `/mcp/:tenant_id`
- **Purpose:** MCP server endpoint for AI clients
