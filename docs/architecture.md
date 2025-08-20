# Atomic Guide Brownfield Enhancement Architecture

## Introduction

This document outlines the architectural approach for enhancing the existing LTI 1.3 starter application into **Atomic Guide/Focus** - a Progressive Cognitive Learning Infrastructure platform that achieves 40-64% improvement in knowledge retention through personalized cognitive profiling. Its primary goal is to serve as the guiding architectural blueprint for AI-driven development of new features while ensuring seamless integration with the existing LTI 1.3 foundation.

**Relationship to Existing Architecture:**
This document supplements the existing LTI starter architecture by defining how new cognitive learning components will integrate with current authentication, routing, and storage systems. Where conflicts arise between new patterns (D1 multi-tenant databases, React components) and existing patterns (KV storage, vanilla JS), this document provides guidance on maintaining consistency during the transition while preserving all working LTI 1.3 functionality.

### Existing Project Analysis

**Current Project State:**

- **Primary Purpose:** LTI 1.3 tool provider starter application with Canvas LMS integration
- **Current Tech Stack:** Cloudflare Workers (Hono framework), KV namespaces, Durable Objects, Vite bundling
- **Architecture Style:** Serverless edge computing with event-driven LTI handlers
- **Deployment Method:** Cloudflare Workers with custom domain routing

**Available Documentation:**

- CLAUDE.md with development commands and architecture overview
- Comprehensive PRD defining Atomic Guide requirements
- Existing codebase demonstrating LTI 1.3 patterns

**Identified Constraints:**

- Must maintain backward compatibility with existing LTI launches
- Frame-friendly security requirements for LMS embedding
- KV namespace limitations for relational data (driving D1 adoption)

**Key Integration Insights (from Mind Mapping):**

- Foundation provides 80% of required authentication infrastructure
- Natural extension points exist in client entry system
- Durable Objects perfectly suited for real-time struggle detection
- Incremental enhancement path available without breaking changes

### Change Log

| Change               | Date       | Version | Description                                                         | Author              |
| -------------------- | ---------- | ------- | ------------------------------------------------------------------- | ------------------- |
| Initial Architecture | 2025-08-20 | 1.0     | Created brownfield architecture for Atomic Guide enhancement        | Winston (Architect) |
| AI Guide Chat Update | 2025-08-20 | 1.1     | Added AI Guide chat interface architecture and real-time components | Winston (Architect) |
| React Migration      | 2025-08-20 | 1.2     | Documented React-based LTI launch with atomic-fuel integration      | Winston (Architect) |

## Enhancement Scope and Integration Strategy

Based on the PRD analysis, this enhancement transforms a basic LTI starter into a comprehensive cognitive learning platform with:

**Enhancement Overview:**

- **Enhancement Type:** Major Feature Addition - Progressive Cognitive Learning System
- **Scope:** Complete platform build including multi-tenant data layer, cognitive profiling, real-time monitoring, AI integration
- **Integration Impact:** High - Requires new data layer (D1), React UI framework, WebSocket connections, MCP server

**Integration Approach:**

- **Code Integration:** Preserve all existing LTI endpoints while adding new API routes under `/api/` namespace
- **Database Integration:** KV remains for platform configs; D1 added for learner data with tenant isolation
- **API Integration:** Existing LTI routes untouched; new REST/WebSocket APIs for cognitive features
- **UI Integration:** Extend launch page to React router; preserve existing vanilla JS for LTI flows
- **MCP Integration:** Deploy Cloudflare's native MCP library at `/mcp` endpoint with OAuth 2.0 authentication (GitHub/Google/institutional SSO) for secure AI client access to Learner DNA profiles

**Compatibility Requirements:**

- **Existing API Compatibility:** All LTI 1.3 endpoints remain unchanged at current paths
- **Database Schema Compatibility:** KV namespaces retained; D1 operates independently with tenant_id partitioning
- **UI/UX Consistency:** React components styled to match Canvas aesthetic; non-intrusive overlays
- **Performance Impact:** Target <100ms response maintained via edge computing; D1 queries optimized to 10-50ms
- **MCP OAuth Security:** Learner consent required before AI client access; token-scoped to specific learner profiles

## Tech Stack Alignment

**Existing Technology Stack:**

| Category          | Current Technology | Version | Usage in Enhancement   | Notes                           |
| ----------------- | ------------------ | ------- | ---------------------- | ------------------------------- |
| Runtime           | Cloudflare Workers | Latest  | Core platform runtime  | Maintains edge performance      |
| Framework         | Hono               | 4.9.1   | API routing backbone   | Extended with new routes        |
| LTI Libraries     | @atomicjolt/lti-\* | 3.3.x   | LTI 1.3 authentication | Unchanged, foundational         |
| Storage - Config  | KV Namespaces      | N/A     | Platform configs, JWKS | Retained as-is                  |
| Storage - Session | Durable Objects    | N/A     | OIDC state, real-time  | Extended for struggle detection |
| Build Tool        | Vite               | 5.x     | Asset bundling         | Extended for React              |
| Language          | TypeScript         | 5.9.2   | Type safety            | Consistent across new code      |
| Testing           | Vitest             | 3.1.4   | Unit/integration tests | Extended test coverage          |

**New Technology Additions:**

| Technology                  | Version | Purpose                      | Rationale                              | Integration Method            |
| --------------------------- | ------- | ---------------------------- | -------------------------------------- | ----------------------------- |
| Cloudflare D1               | Latest  | Multi-tenant relational data | Complex queries, tenant isolation      | New binding in wrangler.jsonc |
| React                       | 18.x    | Post-launch UI components    | Rich interactions, component reuse     | Vite configuration extension  |
| @atomicjolt/atomic-elements | Latest  | UI component library         | Consistent LTI-friendly components     | npm dependency                |
| @atomicjolt/atomic-fuel     | Latest  | LTI state & JWT management   | Proven LTI integration patterns        | Redux middleware              |
| @atomicjolt/lti-components  | Latest  | LTI launch validation        | Secure launch verification             | React component wrapper       |
| Cloudflare MCP Server       | Latest  | AI client integration        | Native OAuth support, edge deployment  | New worker route at /mcp      |
| Redux Toolkit               | 2.x     | Client state management      | Predictable state, DevTools, RTK Query | Client-side store             |
| React Router                | 6.x     | SPA navigation               | Dashboard routing                      | Post-launch pages only        |
| Apollo Client               | 3.x     | GraphQL client               | Efficient data fetching, caching       | Network layer with JWT auth  |
| i18next                     | 23.x    | Internationalization        | Multi-language support                 | React context provider        |
| date-fns                    | 3.x     | Date manipulation            | Locale-aware date formatting           | Utility functions             |
| React Modal                 | 3.x     | Accessible modals            | WCAG compliant dialogs                 | Component library             |
| Tippy.js                    | 6.x     | Tooltips and popovers        | Interactive help overlays              | React wrapper components      |
| core-js                     | 3.x     | JavaScript polyfills         | Legacy browser support                 | Runtime polyfills             |
| es6-promise                 | 4.x     | Promise polyfill             | IE11 compatibility                     | Runtime polyfill              |
| Cloudflare AI               | Latest  | Cognitive processing         | Edge inference, low latency            | Worker AI binding             |

## Data Models and Schema Changes

**New Data Models:**

### Learner Profile Model

**Purpose:** Core cognitive profile storing individual learner's DNA
**Integration:** Links to LTI user via sub claim from JWT

**Key Attributes:**

- `id`: UUID - Unique identifier
- `tenant_id`: UUID - Institution identifier (D1 partitioning key)
- `lti_user_id`: String - Maps to LTI sub claim
- `cognitive_profile`: JSON - Memory patterns, learning velocity
- `privacy_settings`: JSON - Consent flags, data sharing preferences
- `created_at`: Timestamp - Profile creation
- `updated_at`: Timestamp - Last modification

**Relationships:**

- **With Existing:** References LTI platform via tenant_id in KV
- **With New:** One-to-many with LearningSession, StruggleEvent

### Learning Session Model

**Purpose:** Track individual study sessions and engagement patterns
**Integration:** Created on each LTI launch, tracks Canvas interactions

**Key Attributes:**

- `id`: UUID - Session identifier
- `learner_id`: UUID - Foreign key to LearnerProfile
- `course_context`: String - LTI context_id
- `session_start`: Timestamp - Launch time
- `behavioral_signals`: JSON - Hover times, scroll patterns
- `interventions_delivered`: Array - Help shown during session

**Relationships:**

- **With Existing:** Maps to LTI launch via state parameter
- **With New:** One-to-many with StruggleEvent, InterventionLog

### Knowledge Graph Model

**Purpose:** Map prerequisite relationships between concepts across courses
**Integration:** Built from course content analysis, powers predictions

**Key Attributes:**

- `concept_id`: UUID - Unique concept identifier
- `tenant_id`: UUID - Institution scope
- `concept_name`: String - Human-readable name
- `dependencies`: Array<UUID> - Prerequisite concepts
- `course_contexts`: Array - LTI contexts using concept

**Schema Integration Strategy:**
**Database Changes Required:**

- **New D1 Databases:** One per tenant (institution)
- **New Tables:** learner_profiles, learning_sessions, struggle_events, knowledge_graph, intervention_logs
- **New Indexes:** tenant_id + lti_user_id (compound), session timestamps, concept relationships
- **Migration Strategy:** Greenfield D1 creation; no existing data to migrate

**Backward Compatibility:**

- KV namespaces unchanged for LTI platform data
- D1 queries isolated to new API endpoints only
- Graceful fallback if D1 unavailable (basic LTI still works)

## Component Architecture

**New Components:**

### 1. Cognitive Engine Service

**Responsibility:** Process behavioral signals, update learner profiles, trigger interventions
**Integration Points:** Receives data from Canvas Monitor, updates D1, triggers Intervention Service

**Key Interfaces:**

- `POST /api/cognitive/signals` - Receive behavioral data
- `GET /api/cognitive/profile/:learner_id` - Retrieve learner DNA
- WebSocket connection via Durable Objects for real-time processing

**Dependencies:**

- **Existing Components:** LTI session validation from existing auth
- **New Components:** D1 database, Cloudflare AI for processing

**Technology Stack:** Cloudflare Worker with AI binding, Durable Objects for state

### 2. Canvas Monitor Client

**Responsibility:** Inject monitoring script, capture Canvas interactions, detect struggle patterns, extract page content for AI context
**Integration Points:** Loaded after LTI launch, communicates via postMessage, DOM scraping for content extraction

**Key Interfaces:**

- Canvas postMessage API for event capture
- WebSocket to Cognitive Engine for real-time data
- Redux actions for local state updates
- DOM content extraction for chat context (FR13)

**Dependencies:**

- **Existing Components:** Launch page provides injection point
- **New Components:** Redux store for state management, content extractor

**Technology Stack:** React hooks, WebSocket client, postMessage handlers, DOM parsing

### 2a. React-Based LTI Launch Entry Point

**Responsibility:** Initialize React application after successful LTI authentication, manage JWT refresh, configure localization and client-side state
**Integration Points:** Replaces vanilla JS app.ts with React-based initialization, integrates with Atomic Fuel for settings and JWT management

**Key Interfaces:**

- LTI launch validation via `LtiLaunchCheck` component
- Apollo GraphQL client initialization with JWT authorization
- Redux store configuration with initial settings
- i18n localization for multi-language support

**Dependencies:**

- **Core Libraries:**
  - `react` and `react-dom/client` for React 18 rendering
  - `@atomicjolt/atomic-fuel` for LTI settings and JWT management
  - `@atomicjolt/lti-components` for launch validation
  - Redux Toolkit for state management
  - Apollo Client for GraphQL communication

**Technology Stack:** 
- React 18 with createRoot API
- Redux Toolkit with atomic-fuel integration
- Apollo Client with custom network error handling
- i18next for internationalization
- date-fns for locale-aware date handling
- ReactModal for accessible modal dialogs

**Initialization Flow:**

1. Polyfill loading (ES6 promises, core-js, custom events)
2. Extract initial settings from `window.DEFAULT_SETTINGS`
3. Configure Redux store with settings and JWT
4. Initialize JWT refresh mechanism for authenticated user
5. Setup localization based on Canvas user language preferences
6. Initialize date picker with locale-specific formatting
7. Create Apollo GraphQL client with JWT authorization
8. Handle Canvas reauthorization requirements via network error handler
9. Render React app with `LtiLaunchCheck` validation wrapper
10. Apply responsive sizing with `FixedResizeWrapper`

### 3. MCP OAuth Server

**Responsibility:** Handle OAuth flows for AI clients, serve Learner DNA via MCP protocol
**Integration Points:** OAuth providers (GitHub/Google), D1 for profile access

**Key Interfaces:**

- `/mcp/authorize` - OAuth authorization endpoint
- `/mcp/token` - Token exchange
- `/mcp/sse` - Server-sent events for MCP protocol

**Dependencies:**

- **Existing Components:** Reuses JWT utilities from LTI
- **New Components:** OAuth provider configurations

**Technology Stack:** Cloudflare MCP library, OAuth handlers

### 4. Intervention Service

**Responsibility:** Deliver contextual help based on struggle patterns and cognitive state
**Integration Points:** Triggered by Cognitive Engine, renders in Canvas via overlay

**Key Interfaces:**

- `POST /api/interventions/trigger` - Initiate intervention
- `GET /api/interventions/history` - Learner's intervention history
- Redux actions for UI rendering

**Dependencies:**

- **Existing Components:** Canvas iframe context
- **New Components:** Cognitive Engine triggers, React overlay components

**Technology Stack:** React components, SCSS modules, Redux state

### 5. AI Guide Chat Service

**Responsibility:** Provide conversational AI interface for personalized learning assistance (FR4)
**Integration Points:** Canvas content extractor, Learner DNA profiles, external AI APIs

**Key Interfaces:**

- `POST /api/chat/message` - Send chat message with context
- `GET /api/chat/history/:session_id` - Retrieve conversation history (FR4.2)
- `POST /api/chat/suggestion` - Generate proactive suggestions (FR15)
- WebSocket at `/ws/chat` for real-time messaging

**Dependencies:**

- **Existing Components:** LTI session validation, JWT utilities
- **New Components:** AI API integration, conversation state manager, FAQ knowledge base (FR17)

**Technology Stack:** Cloudflare Durable Objects for conversation state, AI gateway for multiple providers

### 6. Chat UI Components

**Responsibility:** Render floating action button and expandable chat interface (FR4)
**Integration Points:** Redux state, WebSocket connection, Canvas DOM

**Key Interfaces:**

- Floating Action Button (FAB) with struggle detection animations
- Expandable chat window with minimize/maximize controls (FR4)
- Rich media message rendering (LaTeX, code, diagrams) (FR16)
- Quick action buttons for common queries (FR4)
- Context badge showing current page/assignment

**Dependencies:**

- **Existing Components:** Canvas iframe positioning constraints
- **New Components:** Message queue, typing indicators, markdown renderer

**Technology Stack:** React, CSS-in-JS for dynamic positioning, KaTeX for math rendering

### Component Interaction Diagram

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│ LTI Launch  │────▶│Canvas Monitor│────▶│  Cognitive   │
│   (Hono)    │     │   (React)    │     │   Engine     │
└─────────────┘     └──────┬───────┘     │  (Worker+DO) │
                            │             └──────┬───────┘
                            ▼                    ▼
                    ┌──────────────┐     ┌──────────────┐
                    │   Chat UI    │────▶│ D1 Database  │
                    │  Components  │     │  (Tenant)    │
                    └──────┬───────┘     └──────────────┘
                            │                    ▲
                            ▼                    │
                    ┌──────────────┐            │
                    │  AI Guide    │────────────┘
                    │ Chat Service │
                    │ (Worker+DO)  │
                    └──────┬───────┘
                            │
                    ┌───────▼──────┐     ┌──────────────┐
                    │ Redux Store  │     │ OAuth Server │
                    │              │     │   (/mcp)     │
                    └──────────────┘     └──────────────┘
                                                 ▲
                                                 │
┌─────────────┐                                 │
│ MCP Client  │─────────────────────────────────┘
│(AI Systems) │
└─────────────┘
```

### Performance Critical Paths

**Real-time Struggle Detection Pipeline (<50ms):**

1. Canvas event capture (0ms)
2. PostMessage to monitor (1ms)
3. WebSocket to Durable Object (5ms)
4. Pattern matching algorithm (20ms)
5. Intervention trigger (30ms)
   Total: ~35-50ms (within 100ms budget)

**AI Chat Response Pipeline (<200ms target):**

1. Message reception via WebSocket (5ms)
2. Canvas context extraction (10ms)
3. Learner DNA retrieval from cache/D1 (15ms)
4. AI API call (100-150ms)
5. Response streaming initiation (20ms)
   Total: ~150-200ms (streaming for perceived speed)

**Profile Update Pipeline (<500ms):**

1. Batch signal aggregation
2. Cloudflare AI inference
3. D1 profile update
4. Cache invalidation

**Chat Rate Limiting (FR14):**

- Token budget: 10,000 tokens per learner per day
- Rate limit: 20 messages per minute per learner
- FAQ cache hit target: 40% of queries (instant response)
- Conversation history: Last 20 messages retained in memory

### Failure Isolation & Recovery

**Component Isolation Strategy:**

- Canvas Monitor failure → Core LTI functionality preserved
- Cognitive Engine failure → Graceful degradation to basic tracking
- MCP OAuth failure → Internal features continue working
- D1 failure → KV cache provides read-only fallback
- AI Chat failure → FAQ fallback and cached responses

**Circuit Breaker Patterns:**

- D1 connection pool exhaustion → Temporary KV cache
- AI inference timeout → Rule-based algorithm fallback
- WebSocket disconnection → Exponential backoff retry
- Redux store overflow → Selective state pruning
- AI API failure → FAQ knowledge base + cached responses (FR17)
- Chat rate limit exceeded → Graceful throttling with user notification

## API Design and Integration

**API Integration Strategy:**

- **API Design Pattern:** RESTful for CRUD operations, WebSocket for real-time, MCP Server for AI integration
- **Authentication:** LTI JWT extended with tenant_id claim, OAuth via LMS SSO for MCP clients
- **Versioning:** `/api/` namespace for new endpoints, existing LTI paths unchanged

### New API Endpoints

#### Cognitive Analytics APIs

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

#### MCP Protocol Implementation

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
    },
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

#### Dashboard APIs

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

#### AI Guide Chat APIs

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

## Source Tree Integration

**Existing Project Structure:**

```

atomic-guide/
├── client/ # Client-side entry points
├── src/ # Server-side Cloudflare Worker
├── public/ # Static assets
├── definitions.ts # Constants and paths
└── wrangler.jsonc # Worker configuration

```

**New File Organization:**

```

atomic-guide/
├── client/ # Existing + React components
│ ├── app.tsx # React-based LTI launch entry point
│ ├── root.tsx # Root React component
│ ├── components/ # NEW: React components
│ │ ├── dashboard/
│ │ │ ├── LearnerDashboard.tsx
│ │ │ └── FacultyDashboard.tsx
│ │ ├── cognitive/
│ │ │ ├── ProfileView.tsx
│ │ │ └── InterventionOverlay.tsx
│ │ ├── chat/ # NEW: AI Guide chat components
│ │ │ ├── ChatFAB.tsx # Floating action button
│ │ │ ├── ChatWindow.tsx # Main chat interface
│ │ │ ├── MessageList.tsx # Conversation display
│ │ │ ├── MessageInput.tsx # Input with quick actions
│ │ │ ├── ContextBadge.tsx # Current page indicator
│ │ │ └── RichMessage.tsx # LaTeX/code rendering
│ │ └── privacy/
│ │ └── PrivacyControls.tsx
│ ├── hooks/ # NEW: React hooks
│ │ ├── useCanvasMonitor.ts
│ │ ├── useLearnerProfile.ts
│ │ ├── useChat.ts # Chat WebSocket management
│ │ └── useContentExtractor.ts # Canvas DOM extraction
│ ├── store/ # NEW: Redux store
│ │ ├── configure_store.ts # Redux store configuration with atomic-fuel
│ │ ├── index.ts
│ │ ├── slices/
│ │ │ ├── learnerSlice.ts
│ │ │ ├── sessionSlice.ts
│ │ │ └── jwtSlice.ts # JWT management from atomic-fuel
│ │ └── api/ # RTK Query
│ │ ├── cognitiveApi.ts
│ │ └── chatApi.ts # Chat endpoints
│ ├── apollo/ # Apollo GraphQL configuration
│ │ ├── client.ts # Apollo client setup with JWT auth
│ │ └── cache.ts # Apollo cache configuration
│ ├── libs/ # Utility libraries
│ │ ├── i18n.ts # Localization setup
│ │ ├── datepicker.ts # Date picker initialization
│ │ ├── moment.ts # Moment.js timezone config
│ │ └── get_size.ts # Canvas iframe sizing
│ └── styles/ # NEW: CSS with variables
│ ├── base.css # Base styles & resets
│ ├── variables.css # CSS custom properties
│ └── components/
│ └── dashboard.module.css
├── src/ # Server-side Worker
│ ├── index.ts # Existing + new routes
│ ├── api/ # NEW: API handlers
│ │ ├──
│ │ │ ├── cognitive.ts
│ │ │ ├── learners.ts
│ │ │ ├── interventions.ts
│ │ │ └── chat.ts # Chat message handling
│ │ └── websocket.ts # WebSocket upgrade handler
│ ├── mcp/ # NEW: MCP implementation
│ │ ├── AtomicGuideMCP.ts
│ │ ├── tools.ts
│ │ ├── resources.ts
│ │ └── prompts.ts
│ ├── services/ # NEW: Business logic
│ │ ├── CognitiveEngine.ts
│ │ ├── StruggleDetector.ts
│ │ ├── InterventionService.ts
│ │ ├── ChatService.ts # AI chat orchestration
│ │ ├── ContentExtractor.ts # Canvas page parsing
│ │ └── FAQKnowledgeBase.ts # Cached responses (FR17)
│ ├── models/ # NEW: Data models
│ │ ├── learner.ts
│ │ ├── session.ts
│ │ ├── knowledge.ts
│ │ └── chat.ts # Chat conversation models
│ └── db/ # NEW: D1 utilities
│ ├── schema.sql # Includes chat_conversations, chat_messages
│ ├── migrations/
│ └── queries.ts
├── scripts/ # Build & deployment
│ ├── inject-manifest.js # Existing
│ └── setup-d1.js # NEW: D1 setup
└── tests/ # Test files
├── api/
└── components/

````

**CSS Architecture Pattern:**

```css
/* variables.css - Design tokens */
:root {
  /* Colors */
  --color-primary: #01579c;
  --color-text: #333333;
  --color-text-secondary: #555555;
  --color-bg: #ffffff;

  /* Typography */
  --font-family: 'Lato', sans-serif;
  --font-size-base: 16px;
  --font-weight-normal: 400;
  --font-weight-bold: 700;

  /* Spacing */
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 32px;

  /* Transitions */
  --transition-fast: 100ms ease;
}

/* Component styles using CSS modules */
.dashboard {
  font-family: var(--font-family);
  color: var(--color-text);
  padding: var(--spacing-md);
}
````

**Integration Guidelines:**

- **File Naming:** React components use PascalCase.tsx, utilities use camelCase.ts
- **Folder Organization:** Feature-based grouping within client/components and src/api
- **Import/Export Patterns:** Named exports for utilities, default exports for React components
- **CSS Organization:** CSS modules with custom properties for theming, imported directly in components

## Infrastructure and Deployment Integration

**Existing Infrastructure:**

- **Current Deployment:** Cloudflare Workers with custom domain (lti-worker.atomicjolt.win)
- **Infrastructure Tools:** Wrangler CLI, GitHub Actions
- **Environments:** Local development (localhost:8787), Production (Cloudflare edge)

**Enhancement Deployment Strategy:**

- **Deployment Approach:** Blue-green deployment with gradual rollout per tenant
- **Infrastructure Changes:** Add D1 database bindings, AI model bindings, increase CPU limits
- **Pipeline Integration:** Extend existing GitHub Actions to include D1 migrations
- **Risk Mitigation:** Feature flags per tenant, KV fallback layer for D1 failures

**Updated wrangler.jsonc Configuration:**

```jsonc
{
  // Existing KV namespaces preserved
  "kv_namespaces": [...existing...],

  // NEW: D1 database bindings (per tenant)
  "d1_databases": [
    {
      "binding": "D1_PRIMARY",
      "database_name": "atomic-guide-primary",
      "database_id": "uuid-here"
    }
  ],

  // NEW: AI model binding
  "ai": {
    "binding": "AI"
  },

  // NEW: Increased limits for cognitive processing
  "limits": {
    "cpu_ms": 50  // Increased from default 10ms
  },

  // Existing Durable Objects extended
  "durable_objects": {
    "bindings": [
      {
        "name": "OIDC_STATE",
        "class_name": "OIDCStateDurableObject"
      },
      {
        "name": "STRUGGLE_DETECTOR",  // NEW
        "class_name": "StruggleDetectorDO"
      },
      {
        "name": "CHAT_CONVERSATIONS",  // NEW: Chat state management
        "class_name": "ChatConversationDO"
      }
    ]
  }
}
```

**Critical Infrastructure Considerations (from SWOT Analysis):**

**Strengths to Leverage:**

- Edge computing provides global <100ms response times
- Zero-downtime blue-green deployments with instant rollback
- Automatic scaling without configuration
- Built-in DDoS protection and SSL

**Weaknesses to Address:**

- **D1 Performance Monitoring:** Implement comprehensive metrics before production
- **CPU Limit Management:** Design algorithms to work within 50ms constraint
- **Fallback Architecture:** KV cache layer provides read-only mode if D1 fails
- **Enhanced Observability:** Custom logging to D1 metrics tables

**Risk Mitigation Strategies:**

- **Progressive Rollout:** Start with 1-2 pilot institutions
- **Performance Gates:** D1 must achieve <10ms query times before full adoption
- **Hybrid Storage:** Keep critical configs in KV, learner data in D1
- **AI Complexity Threshold:** Use Cloudflare AI for simple inference, external APIs for complex

**Rollback Strategy:**

- **Rollback Method:** Wrangler rollback to previous deployment, D1 point-in-time recovery
- **Feature Flags:** Per-tenant feature toggles stored in KV
- **Monitoring:** Cloudflare Analytics + custom D1 metrics tables
- **Disaster Recovery:** Daily D1 exports to R2 bucket for cross-region backup

## Coding Standards and Conventions

**Existing Standards Compliance:**

- **Code Style:** TypeScript with strict mode, Prettier formatting
- **Linting Rules:** ESLint with @typescript-eslint rules
- **Testing Patterns:** Vitest for unit tests, test files colocated
- **Documentation Style:** JSDoc comments for public APIs

**Enhancement-Specific Standards:**

**TypeScript Conventions:**

```typescript
// Use interfaces for data shapes
interface LearnerProfile {
  id: string;
  tenantId: string;
  cognitiveProfile: CognitiveData;
}

// Use type for unions/aliases
type SignalType = 'hover' | 'scroll' | 'idle' | 'click';

// Explicit return types for public functions
export async function processSignal(signal: BehavioralSignal): Promise<void> {
  // Implementation
}
```

**React Component Patterns:**

```typescript
// Functional components with typed props
interface DashboardProps {
  learnerId: string;
  profile: LearnerProfile;
}

export default function LearnerDashboard({ learnerId, profile }: DashboardProps) {
  // Use hooks at top level
  const dispatch = useAppDispatch();
  const session = useAppSelector(selectCurrentSession);

  return <div className={styles.dashboard}>...</div>;
}
```

**React Application Initialization Pattern (app.tsx):**

```typescript
import 'core-js';
import 'regenerator-runtime/runtime';
import 'custom-event-polyfill';
import React from 'react';
import { createRoot } from 'react-dom/client';
import ReactModal from 'react-modal';
import es6Promise from 'es6-promise';
import i18n from 'i18next';

import { getInitialSettings } from '@atomicjolt/atomic-fuel/libs/reducers/settings';
import jwt from '@atomicjolt/atomic-fuel/libs/loaders/jwt';
import { LtiLaunchCheck } from '@atomicjolt/lti-components';
import DefaultRoot from './root';

// Polyfill es6 promises for IE
es6Promise.polyfill();

// Set app element for accessible modals
ReactModal.setAppElement('#main-app');

// Extract LTI settings from window
const settings = getInitialSettings(window.DEFAULT_SETTINGS);
const store = configureStore({ settings, jwt: window.DEFAULT_JWT });

// Setup JWT refresh for authenticated sessions
if (window.DEFAULT_JWT) {
  jwt(store.dispatch, settings.user_id);
}

// Initialize localization and render app
const language = settings.language || 'en';
const defaultLanguage = settings.default_language || 'en';

initMomentJS([language, defaultLanguage], settings.custom_canvas_user_timezone);
initLocalization(['connector', 'player'], language, defaultLanguage, settings.theme)
  .then(() => {
    // Configure date picker with locale
    const dateFnsLocale = i18n.t('dateFnsLocale', { ns: 'locale', defaultValue: '' })
                        || language.split('-')[0];
    initReactDatePicker(dateFnsLocale);

    // Setup Apollo GraphQL client
    const cache = getCache();
    const graphQLNetworkErrorHandler = (networkError) => {
      if (networkError?.result?.canvas_authorization_required) {
        // Handle Canvas reauth requirement
        store.dispatch({
          type: 'GRAPHQL_ERROR_DONE',
          error: { response: { text: 'canvas_authorization_required' }}
        });
        return true;
      }
      if (networkError?.statusCode === 401) {
        setSessionExpired(true);
        return true;
      }
      return false;
    };

    const client = getClient(settings, () => store.getState().jwt, 
                            [], cache, graphQLNetworkErrorHandler);

    // Render React application with LTI validation
    const mainApp = document.getElementById('main-app');
    createRoot(mainApp).render(
      <FixedResizeWrapper getSize={getSize}>
        <LtiLaunchCheck stateValidation={window.DEFAULT_SETTINGS.state_validation}>
          <DefaultRoot store={store} client={client} />
        </LtiLaunchCheck>
      </FixedResizeWrapper>
    );
  });
```

**Critical Integration Rules:**

- **Existing API Compatibility:** Never modify existing LTI endpoints, only extend
- **Database Integration:** Always use tenant_id in D1 queries for isolation
- **Error Handling:** Graceful degradation - LTI must work even if enhancements fail
- **Logging Consistency:** Use structured logging with request IDs

## Testing Strategy

**Integration with Existing Tests:**

- **Existing Test Framework:** Vitest with @cloudflare/vitest-pool-workers
- **Test Organization:** Tests colocated with source files (\*.test.ts)
- **Coverage Requirements:** Maintain existing coverage, target 80% for new code

**New Testing Requirements:**

### Unit Tests for New Components

- **Framework:** Vitest + React Testing Library
- **Location:** Adjacent to component files (Component.test.tsx)
- **Coverage Target:** 80% for business logic, 60% for UI components
- **Integration with Existing:** Share test utilities and mocks

### Integration Tests

- **Scope:** API endpoints, D1 operations, MCP OAuth flows
- **Existing System Verification:** Test LTI flows still work with enhancements
- **New Feature Testing:** End-to-end cognitive profiling scenarios

### Regression Testing

- **Existing Feature Verification:** Automated suite for all LTI operations
- **Automated Regression Suite:** GitHub Actions on every PR
- **Manual Testing Requirements:** Canvas iframe integration, struggle detection

**Test Data Management:**

```typescript
// Use factories for test data
export const learnerProfileFactory = (overrides?: Partial<LearnerProfile>) => ({
  id: 'test-learner-id',
  tenantId: 'test-tenant',
  cognitiveProfile: {
    /* defaults */
  },
  ...overrides,
});
```

## Security Integration

**Existing Security Measures:**

- **Authentication:** LTI 1.3 OAuth/OIDC flow
- **Authorization:** JWT validation with RSA signatures
- **Data Protection:** HTTPS only, secure cookies
- **Security Tools:** Cloudflare WAF, DDoS protection

**Enhancement Security Requirements:**

### Data Privacy & Protection

- **Learner Consent:** Explicit opt-in for cognitive profiling stored in D1
- **Data Encryption:** All PII encrypted at rest in D1 using Cloudflare encryption
- **Right to Delete:** API endpoint for GDPR/FERPA compliance
- **Audit Logging:** All data access logged with timestamps and user IDs

### MCP OAuth Security

- **Token Scoping:** OAuth tokens limited to specific learner profiles
- **Refresh Strategy:** Short-lived access tokens (1 hour), longer refresh tokens
- **Client Registration:** Dynamic registration with approved AI clients only
- **Rate Limiting:** Per-client API limits to prevent abuse

### Tenant Isolation

- **Database Level:** Separate D1 instance per tenant
- **Query Validation:** Tenant ID verified in every database operation
- **Cross-Tenant Protection:** Middleware validates tenant context
- **Admin Access:** Separate admin API with additional authentication

**Security Testing:**

- **Existing Security Tests:** LTI signature validation tests preserved
- **New Security Test Requirements:** OAuth flow tests, tenant isolation tests
- **Penetration Testing:** Required before production launch

## Next Steps

### Story Manager Handoff

To begin implementation of this brownfield enhancement:

- Reference this architecture document for all technical decisions
- Key integration requirements: Preserve all LTI functionality, implement D1 with tenant isolation
- Existing system constraints: 50ms CPU limit, iframe security requirements
- First story: Set up D1 database with multi-tenant schema and migrations
- Maintain existing system integrity by feature-flagging all enhancements

### Developer Handoff

For developers starting implementation:

- This architecture extends the existing LTI starter - study current codebase first
- Follow existing TypeScript/Prettier/ESLint conventions already in place
- Integration requirements: All new APIs under /api/v1, preserve existing routes
- Key technical decisions: Redux Toolkit for state, CSS modules with variables, MCP via OAuth
- Implementation sequence: 1) D1 setup, 2) Basic API routes, 3) React components, 4) MCP integration
- Verify LTI launches still work after each major change

### Recommended Implementation Epics

1. **Epic 1:** Multi-tenant D1 foundation + AI Guide Chat MVP (3 weeks)
   - D1 database setup with chat tables
   - Basic chat API endpoints
   - Floating action button and chat window UI
   - Canvas content extraction
   - WebSocket infrastructure

2. **Epic 2:** Enhanced Chat Intelligence + Student Dashboard (3 weeks)
   - Conversation memory and history
   - Personalized responses based on Learner DNA
   - Rich media message support
   - FAQ knowledge base integration
   - Basic student dashboard with chat history

3. **Epic 3:** Learner DNA Core + Privacy Controls (3 weeks)
   - Cognitive profiling system
   - Privacy management interfaces
   - Student consent workflows

4. **Epic 4:** Struggle Detection + Proactive Chat (2 weeks)
   - Canvas postMessage monitoring
   - Real-time struggle pattern detection
   - Proactive chat interventions
   - Chat suggestion generation

5. **Epic 5:** Cross-Course Intelligence (2 weeks)
   - Knowledge dependency mapping
   - Performance prediction algorithms
   - Chat leveraging cross-course context

6. **Epic 6:** Faculty Tools + Chat Analytics (2 weeks)
   - Faculty dashboard with chat insights
   - Common confusion point analysis
   - Custom chat response configuration

7. **Epic 7:** MCP OAuth server implementation (1 week)
   - OAuth flow for AI clients
   - MCP protocol implementation
   - Portable profile management

8. **Epic 8:** Performance optimization and testing (2 weeks)
   - Rate limiting and token budget implementation
   - Response time optimization
   - A/B testing framework
   - Load testing and scaling validation
