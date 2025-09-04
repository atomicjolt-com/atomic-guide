# 2. High Level Architecture

## Technical Summary

The Atomic Guide Deep Linking Assessment Features extend the existing Cloudflare Workers-based LTI 1.3 tool with AI-powered conversational assessment capabilities delivered through a serverless edge architecture. The platform achieves 50-80% improvement in knowledge retention through retrieval practice and 35-50% improvement through optimal spaced repetition, serving as a Progressive Cognitive Learning Infrastructure.

The frontend leverages a progressive React migration strategy for new assessment components while maintaining vanilla JavaScript for stable existing features, communicating with backend services via WebSocket connections through Durable Objects for real-time chat experiences. Canvas postMessage API integration enables contextual content extraction while deep linking 2.0 provides seamless assessment embedding, all orchestrated through the existing Hono framework extended with new AI service integrations.

## Platform and Infrastructure Choice

**Platform:** Cloudflare Workers + Cloudflare Services
**Key Services:** Workers (compute), KV (config storage), D1 (relational data), Durable Objects (real-time state), R2 (file storage if needed)
**Deployment Host and Regions:** Global edge deployment via Cloudflare's 275+ data centers

## Repository Structure (Vertical Slice Architecture)

**Structure:** Feature-based vertical slices with shared module
**Monorepo Tool:** Native npm workspaces (existing)
**Package Organization:**

```
src/
├── features/           # Feature-based vertical slices
│   ├── chat/          # Chat feature (client + server + tests)
│   ├── assessment/    # Assessment & deep linking
│   ├── content/       # Content extraction & awareness
│   ├── dashboard/     # Analytics & insights
│   ├── lti/          # LTI protocol handling
│   ├── settings/      # User preferences
│   └── faq/          # Knowledge base
└── shared/            # Cross-feature shared code
    ├── client/        # Shared UI components, hooks
    ├── server/        # Shared services, utilities
    ├── schemas/       # Common data schemas
    └── types/        # Shared TypeScript types
```

Each feature contains:

- `client/` - React components, hooks, store
- `server/` - API handlers, services, durable objects
- `shared/` - Feature-internal shared code
- `tests/` - Feature-specific tests

## High Level Architecture Diagram

```mermaid
graph TB
    subgraph "Canvas LMS"
        Canvas[Canvas Pages]
        DeepLink[Deep Linking 2.0]
        AGS[Assignment & Grade Service]
    end

    subgraph "Client Layer"
        Launch[LTI Launch Page]
        AssessUI[Assessment Chat UI]
        ConfigModal[Deep Link Config Modal]
        Dashboard[Instructor Dashboard]
        Monitor[Canvas Monitor Client]
    end

    subgraph "Cloudflare Edge"
        subgraph "Worker Services"
            Hono[Hono App Router]
            LTI[LTI Endpoints]
            AssessAPI[Assessment API]
            AIService[AI Service Client]
            CogEngine[Cognitive Engine]
            MCP[MCP OAuth Server]
        end

        subgraph "Storage"
            KV[(KV Namespaces)]
            D1[(D1 Database)]
            DO[Durable Objects]
        end
    end

    subgraph "External Services"
        OpenAI[OpenAI/Anthropic API]
        MCPClient[MCP AI Clients]
    end

    Canvas -->|postMessage| Monitor
    Canvas -->|postMessage| AssessUI
    Canvas -->|LTI Launch| Launch
    DeepLink -->|Config| ConfigModal

    Monitor -->|WebSocket| CogEngine
    Launch --> Hono
    AssessUI -->|WebSocket| DO
    ConfigModal --> AssessAPI
    Dashboard --> AssessAPI

    Hono --> LTI
    Hono --> AssessAPI
    AssessAPI --> AIService
    AssessAPI --> CogEngine
    AIService --> OpenAI

    CogEngine --> D1
    CogEngine --> DO

    LTI --> KV
    AssessAPI --> D1
    DO --> D1

    AGS <-->|Grade Passback| AssessAPI
    MCPClient <-->|OAuth| MCP
    MCP --> D1
```

## Architectural Patterns

- **Serverless Edge Computing:** Cloudflare Workers for global low-latency assessment delivery - _Rationale:_ Maintains existing infrastructure while scaling to handle real-time AI interactions
- **Event-Driven LTI Handlers:** Async processing of LTI events with existing patterns - _Rationale:_ Proven reliability for Canvas integration with minimal changes needed
- **Component-Based UI with Progressive Enhancement:** React for new assessment features, vanilla JS for stable components - _Rationale:_ Allows incremental migration without disrupting existing functionality
- **Repository Pattern for Data Access:** Abstract D1 database operations behind service interfaces - _Rationale:_ Enables testing and potential future database migrations
- **WebSocket via Durable Objects:** Real-time bidirectional communication for chat - _Rationale:_ Cloudflare's native solution for stateful connections at edge
- **Command Query Responsibility Segregation (CQRS):** Separate read/write paths for assessment data - _Rationale:_ Optimizes for high-read instructor dashboards and write-heavy student interactions
- **Backend for Frontend (BFF) Pattern:** Assessment API tailored for UI needs - _Rationale:_ Reduces client complexity and API chattiness for mobile Canvas users
