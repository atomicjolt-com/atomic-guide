# Component Architecture

## Two-UI Architecture Overview

Based on the front-end specification, Atomic Guide operates through two distinct but connected user interfaces:

1. **Persistent Overlay UI** - Always-visible indicator icon on LMS pages that expands to reveal:
   - Contextual chat interface with 380px width (desktop), 100% - 32px (mobile)
   - Inline learning activities (flash cards, quizzes, videos)
   - Quick actions and help
   - Minimal footprint (48x48px desktop, 40x40px mobile) with maximum accessibility

2. **LTI Portal UI** - Full-featured application accessed via LTI launch providing:
   - Comprehensive dashboards and analytics
   - Privacy controls and data management
   - Study scheduling and progress tracking
   - Role-specific interfaces (Student/Faculty/Coach)

**New Components:**

## 1. Cognitive Engine Service

**Responsibility:** Process behavioral signals, update learner profiles, trigger interventions
**Integration Points:** Receives data from Canvas Monitor, updates D1, triggers Intervention Service

**Key Interfaces:**

- `POST /api/cognitive/signals` - Receive behavioral data
- `GET /api/cognitive/profile/:learner_id` - Retrieve learner DNA
- WebSocket connection via Durable Objects for real-time processing

**Algorithm Implementation Details:**

```typescript
export class CognitiveEngine {
  // Spaced repetition scheduling
  private calculateNextReview(performance: number, previousInterval: number): number {
    const multiplier = performance >= 0.8 ? 1.3 : 0.6;
    const newInterval = previousInterval * multiplier;
    return Math.min(newInterval, 90); // Cap at 90 days
  }

  // Forgetting curve prediction
  private predictRetention(lastReview: Date, stability: number): number {
    const daysSince = (Date.now() - lastReview.getTime()) / (1000 * 60 * 60 * 24);
    return Math.exp(-daysSince / stability);
  }

  // Adaptive difficulty using fuzzy logic
  private adjustDifficulty(current: number, metrics: PerformanceMetrics): number {
    const { accuracy, responseTime, hintUsage } = metrics;
    const targetSuccess = 0.75; // 75% target

    if (accuracy < targetSuccess - 0.05) {
      return Math.max(current - 0.05, 0); // Decrease 5%
    } else if (accuracy > targetSuccess + 0.05) {
      return Math.min(current + 0.05, 1); // Increase 5%
    }
    return current;
  }

  // Early warning detection
  private detectAtRisk(engagement: number, success: number, weekNumber: number): boolean {
    if (weekNumber <= 6) {
      return engagement < 0.6 || success < 0.7;
    }
    return engagement < 0.5 || success < 0.65;
  }
}
```

**Dependencies:**

- **Existing Components:** LTI session validation from existing auth
- **New Components:** D1 database, Cloudflare AI for processing

**Technology Stack:** Cloudflare Worker with AI binding, Durable Objects for state

## 2. Canvas Monitor Client

**Responsibility:** Inject monitoring script, capture Canvas interactions via postMessage API, detect struggle patterns, extract page content for AI context
**Integration Points:** Loaded after LTI launch, bidirectional postMessage communication with Canvas, DOM scraping for content extraction

**Key Interfaces:**

- Canvas postMessage API for bidirectional communication
- WebSocket to Cognitive Engine for real-time data
- Redux actions for local state updates
- DOM content extraction for chat context via `lti.getPageContent`
- Secure message validation with PostMessageToken

**Dependencies:**

- **Existing Components:** Launch page provides injection point
- **New Components:** Redux store for state management, postMessage handler service

**Technology Stack:** React hooks, WebSocket client, postMessage handlers with token validation, DOM parsing

## 2a. React-Based LTI Launch Entry Point

**Responsibility:** Initialize React application after successful LTI authentication, manage JWT refresh, configure localization and client-side state
**Integration Points:** app.tsx React application. Uses a JWT for user identity and security

**Key Interfaces:**

- LTI launch validation via `LtiLaunchCheck` component
- RTK Query API configuration with JWT authorization
- Redux store configuration with initial settings and RTK Query middleware
- i18n localization for multi-language support

**Dependencies:**

- **Core Libraries:**
  - `react` and `react-dom/client` for React 18 rendering
  - `@atomicjolt/atomic-fuel` for LTI settings and JWT management
  - `@atomicjolt/lti-components` for launch validation
  - Redux Toolkit with RTK Query for state management and API calls

**Technology Stack:**

- React 18 with createRoot API
- Redux Toolkit with atomic-fuel integration
- RTK Query with custom error handling and JWT middleware
- i18next for internationalization
- date-fns for locale-aware date handling
- ReactModal for accessible modal dialogs

**Initialization Flow:**

1. Polyfill loading (ES6 promises, core-js, custom events)
2. Extract initial settings from `window.DEFAULT_SETTINGS`
3. Configure Redux store with settings, JWT, and RTK Query middleware
4. Initialize JWT refresh mechanism for authenticated user
5. Setup localization based on Canvas user language preferences
6. Initialize date picker with locale-specific formatting
7. Configure RTK Query API endpoints with JWT authorization
8. Handle Canvas reauthorization requirements via RTK Query error handler
9. Render React app with `LtiLaunchCheck` validation wrapper
10. Apply responsive sizing with `FixedResizeWrapper`

## 3. MCP OAuth Server

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

## 4. Intervention Service

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

## 5. AI Guide Chat Service

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

## 6. Chat UI Components

**Responsibility:** Render floating action button and expandable chat interface per front-end spec (FR4)
**Integration Points:** Redux state, WebSocket connection, Canvas DOM

**Key Interfaces:**

- **Floating Action Button (FAB):**
  - Circular icon (48x48px desktop, 40x40px mobile) with Atomic Jolt Yellow (#FFDD00) accent
  - State indicators: Static (60% opacity), Active (100% opacity), Pulsing (scale 1.0-1.1 animation)
  - Badge: Red (#B42318) notification dot for urgent items
  - ARIA label: "Atomic Guide Assistant - Click for help"
  - Z-index management to never obstruct LMS critical functions

- **Expandable Chat Panel:**
  - Header (56px): Context badge, title "Atomic Guide", minimize/expand/close actions
  - Chat area (max 480px height): User messages (right, #F5F5F5), AI messages (left, white with yellow border)
  - Input area (72px): Text field, send button (#FFDD00 when active), voice input
  - Typography: Rubik font family (14px regular, 16px medium for headers)
  - Draggable on desktop, fixed bottom-right on mobile (16px margin)

- **Rich Media Rendering:**
  - LaTeX math with KaTeX
  - Code snippets with syntax highlighting
  - Diagrams and charts support
  - Flash cards with swipe gestures
  - Quiz questions with radio/checkbox inputs

**Dependencies:**

- **Existing Components:** Canvas iframe positioning constraints
- **New Components:** Message queue, typing indicators, markdown renderer

**Technology Stack:** React, CSS-in-JS for dynamic positioning, KaTeX for math rendering

## Front-End Component Details

For comprehensive UI/UX specifications including:

- Detailed wireframes and mockups for all screens
- Complete design system with color palette, typography, and spacing
- User flow diagrams for all personas
- Component library specifications
- Accessibility requirements (WCAG 2.1 AA)
- Animation and micro-interaction patterns
- Performance optimization strategies

Please refer to: **`docs/front-end-spec.md`**

## Component Interaction Diagram

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
