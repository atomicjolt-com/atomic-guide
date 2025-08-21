# Atomic Guide Brownfield Enhancement Architecture

## Introduction

This document outlines the architectural approach for enhancing the existing LTI 1.3 starter application into **Atomic Guide/Focus** - a Progressive Cognitive Learning Infrastructure platform that achieves 50-80% improvement in knowledge retention through retrieval practice (Adesope et al., 2017) and 35-50% improvement through optimal spaced repetition (Cepeda et al., 2008). Its primary goal is to serve as the guiding architectural blueprint for AI-driven development of new features while ensuring seamless integration with the existing LTI 1.3 foundation.

**Related Documentation:**

- **Front-End Specification:** See `docs/front-end-spec.md` for comprehensive UI/UX design system, user flows, wireframes, and component specifications
- **Product Requirements:** See `docs/prd.md` for complete product requirements and functional specifications

**Target Outcomes:**

- Reduce STEM gateway course failure rates by 15-25% using adaptive difficulty adjustment (Chrysafiadi et al., 2023)
- Create portable "Learner DNA" profiles with individualized forgetting curves and optimal spacing intervals
- Increase engagement by 35% through conversational assessment (Yildirim-Erbasli & Bulut, 2023)
- Enable cross-course intelligence with 70-80% accuracy in predicting performance challenges

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
- Front-end UI/UX Specification (docs/front-end-spec.md) with design system, user flows, and component specifications
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
| Canvas postMessage   | 2025-08-20 | 1.3     | Added Canvas postMessage integration architecture and security      | Winston (Architect) |
| Empirical foundation | 2025-08-20 | 1.4     | Added empirical foundations, cognitive algorithms, and use cases    | Winston (Architect) |
| Front-End Spec       | 2025-08-21 | 1.5     | Integrated UI/UX specification with design system and personas      | Winston (Architect) |

## Enhancement Scope and Integration Strategy

Based on the PRD analysis, this enhancement transforms a basic LTI starter into a comprehensive cognitive learning platform with:

**Enhancement Overview:**

- **Enhancement Type:** Major Feature Addition - Progressive Cognitive Learning System
- **Scope:** Complete platform build including multi-tenant data layer, cognitive profiling, real-time monitoring, AI integration
- **Integration Impact:** High - Requires new data layer (D1), React UI framework, WebSocket connections, MCP server
- **Target Market:** Higher education STEM gateway courses initially, expanding to K-12 and workforce training
- **Pricing Model:** $3-7 per student annually (institutional licensing $10K-$50K based on enrollment)

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

## Design System Implementation

### Atomic Jolt Brand Integration

The architecture implements the Atomic Jolt design system as specified in the front-end specification:

**Brand Colors:**

- Primary: Atomic Yellow (#FFDD00) - CTAs, active states, progress indicators
- Success: Green (#027A48) - Correct answers, achievements
- Error: Red (#B42318) - Errors, urgent alerts
- Warning: Amber (#FDB022) - Warnings, medium priority
- Info: Blue (#2563EB) - Information, secondary actions

**Typography:**

- Primary Font: Rubik (all UI text)
- Monospace: Rubik Mono (code snippets)
- Type Scale: 32px (H1) down to 11px (caption)
- Font Weights: 300 (Light), 400 (Regular), 500 (Medium)

**Spacing & Layout:**

- 8-point grid system for consistent spacing
- Maximum content width: 1200px (portal UI)
- Chat panel: 380px (desktop), 100% - 32px (mobile)
- Minimum touch targets: 44x44px

**Visual Effects:**

- Shadows: 3 elevation levels for depth
- Border radius: 6px (small), 8px (medium), 12px (large)
- Transitions: 150ms (micro), 300ms (standard), 500ms (slow)

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

| Technology                  | Version | Purpose                      | Rationale                              | Integration Method             |
| --------------------------- | ------- | ---------------------------- | -------------------------------------- | ------------------------------ |
| Cloudflare D1               | Latest  | Multi-tenant relational data | Complex queries, tenant isolation      | New binding in wrangler.jsonc  |
| React                       | 18.x    | Post-launch UI components    | Rich interactions, component reuse     | Vite configuration extension   |
| @atomicjolt/atomic-elements | Latest  | UI component library         | Consistent LTI-friendly components     | npm dependency                 |
| @atomicjolt/atomic-fuel     | Latest  | LTI state & JWT management   | Proven LTI integration patterns        | Redux middleware               |
| @atomicjolt/lti-components  | Latest  | LTI launch validation        | Secure launch verification             | React component wrapper        |
| Cloudflare MCP Server       | Latest  | AI client integration        | Native OAuth support, edge deployment  | New worker route at /mcp       |
| Redux Toolkit               | 2.x     | Client state management      | Predictable state, DevTools, RTK Query | Client-side store with API     |
| React Router                | 6.x     | SPA navigation               | Dashboard routing                      | Post-launch pages only         |
| RTK Query                   | 2.x     | Data fetching and caching    | Efficient REST/GraphQL API integration | Redux middleware with JWT auth |
| i18next                     | 23.x    | Internationalization         | Multi-language support                 | React context provider         |
| date-fns                    | 3.x     | Date manipulation            | Locale-aware date formatting           | Utility functions              |
| React Modal                 | 3.x     | Accessible modals            | WCAG compliant dialogs                 | Component library              |
| Tippy.js                    | 6.x     | Tooltips and popovers        | Interactive help overlays              | React wrapper components       |
| core-js                     | 3.x     | JavaScript polyfills         | Legacy browser support                 | Runtime polyfills              |
| es6-promise                 | 4.x     | Promise polyfill             | IE11 compatibility                     | Runtime polyfill               |
| Cloudflare AI               | Latest  | Cognitive processing         | Edge inference, low latency            | Worker AI binding              |

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

- **With Existing:** References LTI platform via iss in KV
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
**Integration:** Built from course content analysis, powers predictions with 70-80% accuracy

**Key Attributes:**

- `iss`: UUID - Platform identifier
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

## Theoretical Foundations & Cognitive Science Integration

### Memory Architecture & Learning Dynamics

The platform's cognitive engine is built on validated research principles:

#### Spaced Repetition Algorithm Implementation

Based on Cepeda et al. (2008) optimal spacing research:

- **Initial interval:** 1-2 days after first exposure
- **Progression:** 3 days → 7 days → 14 days → 30 days → 90 days
- **Adaptive adjustment:** Multiply by 1.3 for success, 0.6 for failure
- **Optimal spacing formula:** interval = retention_goal × (0.1 to 0.3)
- **Expected improvement:** 35-50% over massed practice

#### Forgetting Curve Modeling

Implementing Ebbinghaus exponential decay (Murre & Dros, 2015):

- **Core formula:** R(t) = e^(-t/s) where s = individual stability coefficient
- **Tracking:** Individual decay rates per content type
- **Trigger threshold:** Review when predicted retention < 85%
- **Sleep consolidation:** Enforce 24-48 hour minimum intervals

#### Retrieval Practice Parameters

Based on Adesope et al. (2017) meta-analysis (g=0.50-0.80):

- **Frequency:** 2-3 sessions per week per subject
- **Duration:** 15-20 minutes (max 30 minutes)
- **Mix ratio:** 60% new material, 40% review
- **Format preference:** Multiple-choice > short-answer for retention
- **Testing effect:** 50% better retention than restudying (Karpicke & Roediger, 2008)

#### Adaptive Difficulty Adjustment

Implementing Chrysafiadi et al. (2023) fuzzy logic approach:

- **Target success rate:** 70-80% for optimal challenge
- **Input variables:** response_time, accuracy, hint_usage, struggle_signals
- **Adjustment increments:** 5% difficulty changes
- **Different thresholds:** 75% conceptual, 80% procedural
- **Expected improvement:** 23% in learning outcomes

### Student Engagement Model Implementation

Students interact with Atomic Focus through natural conversations that:

1. **Monitor comprehension** using linguistic analysis to detect understanding patterns
2. **Identify knowledge gaps** through pattern recognition across current/prerequisite material
3. **Deliver personalized remediation** via adaptive dialogue (35% engagement increase per Yildirim-Erbasli & Bulut)
4. **Schedule review sessions** using individualized forgetting curves
5. **Provide actionable insights** to both students and instructors

### Instructor Support Architecture

The platform provides instructors with:

1. **Real-time class analytics** identifying comprehension trends across topics
2. **Early warning system** flagging at-risk students within first 6 weeks
3. **Data-driven insights** highlighting common misconceptions for curriculum adjustment
4. **Intervention effectiveness metrics** tracking which support strategies work best

### Implementation Evidence & Expected Outcomes

| Component          | Research Validation            | Effect Size               | Implementation Target        |
| ------------------ | ------------------------------ | ------------------------- | ---------------------------- |
| Retrieval Practice | Adesope et al., 2017           | g = 0.50-0.80             | 50-80% retention improvement |
| Spaced Repetition  | Cepeda et al., 2008            | 35-50% improvement        | Optimal spacing intervals    |
| Adaptive Spacing   | Mettler et al., 2020           | 15-20% improvement        | Personalized schedules       |
| Dynamic Difficulty | Chrysafiadi et al., 2023       | 23% improvement           | 70-80% success rate          |
| Conversational AI  | Yildirim-Erbasli & Bulut, 2023 | 35% effort increase       | Natural language interface   |
| Early Intervention | Gardner Institute, 2023        | 10-15% retention          | 6-week detection window      |
| Pedagogical Agents | Kim & Baylor, 2006             | 40% time-on-task increase | AI Guide presence            |

## Target User Personas

From the front-end specification, our architecture supports three primary personas:

### 1. Struggling STEM Student (Alex)

- **Demographics:** 18-22 years old, first-generation college student, 60% work part-time
- **Tech Proficiency:** High comfort with mobile/social apps, moderate with academic tools
- **Pain Points:** Fear of appearing "dumb," overwhelmed by course pace, unclear where to get help
- **Success Metrics:** Time to first successful interaction <10 seconds, 80% return rate after first use
- **Interface Needs:** Mobile-optimized, non-judgmental tone, progress celebration

### 2. Time-Pressed Faculty Member (Dr. Chen)

- **Demographics:** Teaching 3-4 courses, 100-150 total students, limited office hours
- **Tech Proficiency:** Varies widely, prefers minimal new tools
- **Pain Points:** Can't identify struggling students until too late, repetitive questions consume time
- **Success Metrics:** <30 seconds to actionable insights, 50% reduction in repetitive questions
- **Interface Needs:** Dashboard that loads within LMS, one-click exports, no additional logins

### 3. Academic Success Coach (Maria)

- **Demographics:** Monitors 200-300 at-risk students across departments
- **Tech Proficiency:** Comfortable with data tools and dashboards
- **Pain Points:** Reactive vs. proactive interventions, siloed data across systems
- **Success Metrics:** 2-week early warning before failure points, 25% improvement in intervention success
- **Interface Needs:** Unified view across courses, automated alerts, intervention tracking

## Use Case Implementation: Alex's Academic Journey

This section demonstrates how the architecture supports cross-course intelligence through a learner's multi-year journey:

### Freshman Year - Introductory Data Science

**System Actions:**

- Cognitive Engine identifies knowledge gaps in regression analysis through hover patterns > 30 seconds
- AI Guide chat provides personalized explanations based on Alex's visual learning preference
- Spaced repetition schedules reviews at 1, 3, 7, 14, 30-day intervals (default). Scheduling should be adjustable per user based on algorithm to determine optimal spacing per user.
- D1 stores concept mastery levels in learner profile

**Technical Implementation:**

- Canvas Monitor detects struggle via postMessage (30+ second hovers)
- Durable Object processes signals in real-time (<50ms)
- AI Guide retrieves context via `lti.getPageContent`
- Cloudflare AI generates personalized explanations

### Sophomore Year - Research Methods

**System Actions:**

- Knowledge Graph identifies connections to freshman statistics concepts
- Cross-course intelligence predicts potential struggles with hypothesis testing
- Proactive interventions triggered before confusion occurs
- Review sessions automatically include prerequisite material

**Technical Implementation:**

- D1 queries retrieve historical performance across courses
- Graph traversal algorithm identifies prerequisite chains
- Predictive model achieves 70-80% accuracy on struggle prediction
- MCP server exposes learning history to authorized AI tutors

### Junior Year - Spanish for Business

**System Actions:**

- Cognitive Engine adapts algorithms for language learning domain
- Conversational practice via AI Guide with context-aware responses
- Different spacing intervals optimized for vocabulary vs. grammar
- Multimedia responses include audio pronunciation guides

**Technical Implementation:**

- Domain-specific algorithm parameters loaded from KV config
- WebSocket maintains real-time conversation state
- Rich media handling via FR16 multimedia principles
- i18n framework supports Spanish interface

### Senior Year - Capstone Seminar

**System Actions:**

- Platform integrates four years of learning data
- AI Guide references concepts from all prior courses
- Comprehensive learner DNA profile guides final project support
- Instructor dashboard shows complete learning journey

**Technical Implementation:**

- D1 aggregates 4 years of data (optimized queries <10ms)
- MCP OAuth allows external AI tools to access full profile
- Faculty API provides anonymized class-wide insights
- Export functionality for learner data portability

### Institutional Impact Tracking

Throughout Alex's journey, the platform provides institutions with:

- Aggregate analytics showing retention improvements (10-15% expected)
- Early warning alerts preventing failure (flagged within 6 weeks)
- Curriculum insights based on common struggle patterns
- ROI metrics demonstrating $13,000+ savings per retained student

## Component Architecture

### Two-UI Architecture Overview

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

### 1. Cognitive Engine Service

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

### 2. Canvas Monitor Client

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

### 2a. React-Based LTI Launch Entry Point

**Responsibility:** Initialize React application after successful LTI authentication, manage JWT refresh, configure localization and client-side state
**Integration Points:** Replaces vanilla JS app.ts with React-based initialization, integrates with Atomic Fuel for settings and JWT management

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

### Front-End Component Details

For comprehensive UI/UX specifications including:

- Detailed wireframes and mockups for all screens
- Complete design system with color palette, typography, and spacing
- User flow diagrams for all personas
- Component library specifications
- Accessibility requirements (WCAG 2.1 AA)
- Animation and micro-interaction patterns
- Performance optimization strategies

Please refer to: **`docs/front-end-spec.md`**

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

## Canvas postMessage Integration Architecture

### Overview

The Canvas postMessage API enables bidirectional communication between our LTI tool (running in an iframe) and the Canvas LMS platform. This integration is critical for gathering user engagement metrics, detecting learning struggles, and providing contextual AI assistance.

### Architecture Components

#### 1. PostMessage Handler Service

**Responsibility:** Centralized service for all Canvas postMessage communication
**Location:** `client/services/CanvasPostMessageService.ts`

```typescript
export class CanvasPostMessageService {
  private postMessageToken: string | null;
  private messageHandlers: Map<string, MessageHandler>;
  private storageTarget: string = '_parent';
  private oidcAuthUrl: string;

  constructor(token?: string, storageTarget?: string) {
    this.postMessageToken = token || null;
    this.storageTarget = storageTarget || '_parent';
    this.setupMessageListeners();
    this.queryCapabilities();
  }

  // Core message sending with proper target resolution
  private sendMessage(subject: string, data: any, targetOrigin: string = '*') {
    const target = this.resolveTarget(subject);
    const message = {
      subject,
      ...data,
      ...(this.postMessageToken && { token: this.postMessageToken }),
    };
    target.postMessage(message, targetOrigin);
  }

  // Resolve correct target window based on launch context
  private resolveTarget(subject: string): Window {
    // Platform Storage messages go to specific frame
    if (subject === 'lti.put_data' || subject === 'lti.get_data') {
      if (this.storageTarget !== '_parent' && window.parent.frames[this.storageTarget]) {
        return window.parent.frames[this.storageTarget];
      }
    }
    // Check if launched in iframe vs new window/tab
    return window.parent !== window ? window.parent : window.opener || window.parent;
  }
}
```

#### 2. Canvas Content Extraction

**Responsibility:** Extract page content for AI context using Canvas API
**Integration:** Uses `lti.getPageContent` for assignments and wiki pages

```typescript
export class CanvasContentExtractor {
  constructor(private postMessageService: CanvasPostMessageService) {}

  async extractPageContent(): Promise<PageContent> {
    // Use Canvas API for supported pages
    const canvasContent = await this.postMessageService.getPageContent();

    if (canvasContent) {
      return this.parseCanvasContent(canvasContent);
    }

    // Fallback to DOM extraction for unsupported pages
    return this.extractFromDOM();
  }

  private extractFromDOM(): PageContent {
    // Careful DOM extraction respecting Canvas structure
    const contentArea = document.querySelector('.content, #content, [data-testid="content"]');
    return {
      text: contentArea?.textContent || '',
      structure: this.analyzeStructure(contentArea),
      metadata: this.extractMetadata(),
    };
  }
}
```

#### 3. Message Types Implementation

##### Core Canvas Messages Used

```typescript
// Get page content for AI context
canvasService.getPageContent().then((content) => {
  // Send to AI with proper context
  aiService.processWithContext(content);
});

// Monitor scroll events for engagement tracking
canvasService.enableScrollEvents((scrollData) => {
  cognitiveEngine.trackEngagement({
    type: 'scroll',
    position: scrollData.scrollY,
    timestamp: Date.now(),
  });
});

// Resize frame based on content
canvasService.resizeFrame(calculatedHeight);

// Show alerts for important notifications
canvasService.showAlert({
  type: 'info',
  message: 'AI Guide is ready to help!',
  title: 'Atomic Guide',
});
```

##### Platform Storage for Persistence

```typescript
// Store learner preferences using Canvas storage
await canvasService.putData(
  'learner_preferences',
  JSON.stringify({
    aiEnabled: true,
    struggledDetection: true,
    notificationLevel: 'medium',
  }),
);

// Retrieve stored data
const preferences = await canvasService.getData('learner_preferences');
```

### Custom Canvas JavaScript Integration

#### Deployment Strategy

Since Canvas postMessage API only supports content extraction (`lti.getPageContent`) and not comprehensive interaction monitoring, we need a custom JavaScript deployed to Canvas for full metrics collection:

1. **Custom JavaScript Deployment:**
   - Deploy monitoring script via Canvas Theme Editor or institution-level JavaScript
   - Script captures user interactions and sends to our tool via postMessage
   - Must be approved by Canvas administrator

2. **Monitoring Script Architecture:**

```javascript
// canvas-monitor.js - Deployed to Canvas
(function () {
  'use strict';

  // Only activate if our LTI tool is present
  const atomicFrame = document.querySelector('iframe[src*="atomic-guide"]');
  if (!atomicFrame) return;

  // Secure message channel setup
  const ATOMIC_ORIGIN = 'https://atomic-guide.atomicjolt.win';
  const messageChannel = new MessageChannel();

  // Send port to our tool for secure communication
  atomicFrame.contentWindow.postMessage({ type: 'atomic.monitor.init', port: messageChannel.port2 }, ATOMIC_ORIGIN, [messageChannel.port2]);

  // Monitor Canvas interactions
  const monitor = {
    trackHover: (element, duration) => {
      messageChannel.port1.postMessage({
        type: 'interaction',
        action: 'hover',
        element: element.id || element.className,
        duration: duration,
        context: getPageContext(),
      });
    },

    trackIdle: (duration) => {
      messageChannel.port1.postMessage({
        type: 'interaction',
        action: 'idle',
        duration: duration,
      });
    },

    trackQuizInteraction: (questionId, timeSpent, attempts) => {
      messageChannel.port1.postMessage({
        type: 'quiz_interaction',
        questionId,
        timeSpent,
        attempts,
        struggled: timeSpent > 30000 || attempts > 2,
      });
    },
  };

  // Setup event listeners for Canvas-specific elements
  setupCanvasMonitoring(monitor);
})();
```

#### Message Security Implementation

```typescript
export class SecureMessageHandler {
  private trustedOrigins = new Set([
    'https://canvas.instructure.com',
    'https://*.instructure.com',
    // Institution-specific Canvas domains
  ]);

  private messageChannelPort: MessagePort | null = null;

  constructor() {
    this.setupSecureListener();
  }

  private setupSecureListener() {
    window.addEventListener('message', (event) => {
      // Validate origin
      if (!this.isOriginTrusted(event.origin)) {
        console.warn('Rejected message from untrusted origin:', event.origin);
        return;
      }

      // Handle MessageChannel setup
      if (event.data.type === 'atomic.monitor.init' && event.ports[0]) {
        this.messageChannelPort = event.ports[0];
        this.messageChannelPort.onmessage = this.handleSecureMessage.bind(this);
        return;
      }

      // Handle regular Canvas postMessages
      this.handleCanvasMessage(event);
    });
  }

  private handleSecureMessage(event: MessageEvent) {
    // Process monitoring data from our custom script
    const { type, action, ...data } = event.data;

    // Validate message structure
    if (!this.validateMessageStructure(event.data)) {
      return;
    }

    // Process based on type
    switch (type) {
      case 'interaction':
        this.processInteraction(action, data);
        break;
      case 'quiz_interaction':
        this.processQuizInteraction(data);
        break;
    }
  }

  private isOriginTrusted(origin: string): boolean {
    return this.trustedOrigins.has(origin) || origin.endsWith('.instructure.com');
  }
}
```

### LTI Placement Configuration

To support Canvas postMessage integration, we need to configure appropriate LTI placements:

```typescript
// src/config.ts updates
export function getToolConfiguration(platformConfig: PlatformConfiguration, host: string): ToolConfiguration {
  const params: ToolConfigurationParams = {
    // ... existing config
    courseNav: true,
    accountNav: true, // NEW: For institution-wide access
    userNav: true, // NEW: For learner dashboard access
    // Custom placements for monitoring
    customPlacements: [
      {
        placement: 'top_navigation',
        message_type: 'LtiResourceLinkRequest',
        canvas_icon_class: 'icon-stats',
        windowTarget: '_blank', // Opens in new tab for persistent monitoring
      },
      {
        placement: 'course_navigation',
        message_type: 'LtiResourceLinkRequest',
        default: 'enabled',
        display_type: 'default',
      },
    ],
    // Canvas-specific extensions
    canvas: {
      privacy_level: 'public', // Required for names/roles
      custom_fields: {
        post_message_token: '$com.instructure.PostMessageToken',
        canvas_user_id: '$Canvas.user.id',
        canvas_course_id: '$Canvas.course.id',
      },
    },
  };

  return buildToolConfiguration(params);
}
```

### Data Flow Architecture

```
┌─────────────────┐
│   Canvas LMS    │
│                 │
│ ┌─────────────┐ │     postMessage API
│ │ Custom JS   │◄├────────────────────┐
│ │  Monitor    │ │                    │
│ └──────┬──────┘ │                    │
│        │        │                    │
│  MessageChannel │                    │
│        │        │     ┌──────────────▼─────────────┐
│        │        │     │    Atomic Guide Tool       │
│        │        │     │                            │
│        └────────┼────►│  PostMessage Handler       │
│                 │     │         Service            │
│  ┌────────────┐ │     │            │               │
│  │   Canvas   │◄├─────┤            ▼               │
│  │  Content   │ │     │   Content Extractor        │
│  └────────────┘ │     │            │               │
│                 │     │            ▼               │
└─────────────────┘     │    Cognitive Engine        │
                        │            │               │
                        │            ▼               │
                        │      AI Guide Chat         │
                        └────────────────────────────┘
```

### Security Considerations

#### Origin Validation

- Always validate message origins against known Canvas domains
- Use institution-specific domain whitelist
- Reject messages from unexpected origins

#### Token Validation

- Use PostMessageToken when provided by Canvas
- Validate token on every sensitive operation
- Implement token expiry and refresh

#### MessageChannel Security

- Use MessageChannel for custom script communication
- Establish secure channel during initialization
- Never expose ports to untrusted contexts

#### Data Sanitization

- Sanitize all data received via postMessage
- Validate message structure and types
- Prevent XSS through content injection

#### Rate Limiting

- Implement rate limiting on message processing
- Throttle rapid message sequences
- Detect and block message flooding

### Implementation Roadmap

1. **Phase 1: Basic Canvas Integration (Week 1)**
   - Implement PostMessage handler service
   - Add Canvas content extraction via `lti.getPageContent`
   - Setup message event listeners
   - Configure LTI placements

2. **Phase 2: Secure Communication (Week 2)**
   - Implement origin validation
   - Add PostMessageToken support
   - Setup MessageChannel for custom script
   - Add rate limiting

3. **Phase 3: Custom Monitoring Script (Week 3)**
   - Develop Canvas monitoring JavaScript
   - Implement interaction tracking
   - Add struggle detection logic
   - Test with Canvas sandbox

4. **Phase 4: Production Deployment (Week 4)**
   - Canvas administrator approval
   - Deploy custom script to production
   - Monitor performance and security
   - Iterate based on usage data

### Performance Optimization

#### Message Batching

```typescript
class MessageBatcher {
  private queue: Message[] = [];
  private flushInterval = 100; // ms

  addMessage(message: Message) {
    this.queue.push(message);
    this.scheduleFlush();
  }

  private flush() {
    if (this.queue.length === 0) return;

    // Send batch to cognitive engine
    this.cognitiveEngine.processBatch(this.queue);
    this.queue = [];
  }
}
```

#### Caching Strategy

- Cache Canvas page content for 5 minutes
- Store user preferences in localStorage
- Implement LRU cache for processed messages

#### Throttling

- Throttle scroll events to max 10/second
- Debounce hover tracking to 500ms
- Limit API calls to 100/minute per user

## Accessibility & Responsive Design Implementation

### WCAG 2.1 AA Compliance

Per the front-end specification, the architecture ensures accessibility through:

**Visual Accessibility:**

- Color contrast ratios: 4.5:1 for normal text, 3:1 for large text (18px+)
- Focus indicators: 2px solid #FFDD00 outline with 2px offset
- Text sizing: Support 200% zoom without horizontal scrolling
- Minimum 14px for body text with user-adjustable preferences

**Interaction Accessibility:**

- All interactive elements keyboard navigable via Tab
- Logical tab order following visual flow
- Skip links for repetitive content
- Screen reader support with semantic HTML5 and ARIA labels
- Touch targets: Minimum 44x44px with 8px spacing

**Cognitive Accessibility (AAA considerations):**

- Consistent navigation across pages
- Clear, simple language (8th grade reading level target)
- No automatic timeouts without warning
- Progress indicators for multi-step processes
- Help available on every screen via AI Guide

### Responsive Breakpoints

| Breakpoint | Min Width | Max Width | Target Devices | Key Adaptations                     |
| ---------- | --------- | --------- | -------------- | ----------------------------------- |
| Mobile     | 320px     | 767px     | Phones         | Single column, FAB above thumb zone |
| Tablet     | 768px     | 1023px    | Tablets        | Two column, FAB in side rail        |
| Desktop    | 1024px    | 1439px    | Laptops        | Full layout, FAB bottom-right       |
| Wide       | 1440px    | -         | Large monitors | Maximum 1200px content width        |

### Animation & Micro-interactions

Following the front-end spec motion principles:

**Key Animations:**

- FAB pulse: 2s breathing animation (opacity 0.6 to 1.0) when struggle detected
- Chat message appearance: 300ms slide-in with ease-out
- Card flip: 400ms 3D rotation for flash cards
- Progress milestone: Scale(1.2) pulse with spring easing
- Success celebration: 400ms scale pulse for achievements

**Reduced Motion Support:**
When `prefers-reduced-motion: reduce`:

- Replace animations with instant transitions
- Keep only essential motion (loading indicators)
- Disable auto-playing videos and parallax effects

### Performance Critical Paths

1. Canvas event capture via custom JS (0ms)
2. MessageChannel communication (1ms)
3. PostMessage validation & processing (2ms)
4. WebSocket to Durable Object (5ms)
5. Pattern matching algorithm (20ms)
6. Intervention trigger (30ms)
   Total: ~38-50ms (within 100ms budget)

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

**Front-End Performance Goals:**

- Initial Load: <3s on 3G connection
- Time to Interactive: <5s on average hardware
- Interaction Response: <100ms for user inputs
- Animation FPS: Consistent 60fps for all animations
- Bundle Size: <200kb initial JavaScript bundle

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
│ │ ├── chat/ # NEW: AI Guide chat components per front-end spec
│ │ │ ├── ChatFAB.tsx # Floating action button (48x48px, Atomic Yellow)
│ │ │ ├── ChatWindow.tsx # Main chat interface (380px width desktop)
│ │ │ ├── MessageList.tsx # Conversation display with message bubbles
│ │ │ ├── MessageInput.tsx # Input with voice & quick actions (72px height)
│ │ │ ├── ContextBadge.tsx # Current page indicator (56px header)
│ │ │ ├── RichMessage.tsx # LaTeX/code/media rendering
│ │ │ └── ActivityCard.tsx # Flash cards, quizzes, practice problems
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
│ │ └── api/ # RTK Query endpoints
│ │ ├── cognitiveApi.ts # Cognitive analytics API
│ │ ├── chatApi.ts # Chat endpoints
│ │ ├── learnerApi.ts # Learner profile API
│ │ └── baseApi.ts # Base API configuration with JWT
│ ├── libs/ # Utility libraries
│ │ ├── i18n.ts # Localization setup
│ │ ├── datepicker.ts # Date picker initialization
│ │ ├── moment.ts # Moment.js timezone config
│ │ └── get_size.ts # Canvas iframe sizing
│ └── styles/ # NEW: CSS with Atomic Jolt design system
│ ├── base.css # Base styles & resets
│ ├── variables.css # Design tokens from front-end spec
│ ├── typography.css # Rubik font system
│ ├── animations.css # Micro-interactions & transitions
│ └── components/
│ ├── dashboard.module.css
│ ├── chat.module.css # Chat-specific styles
│ └── overlay.module.css # Persistent overlay styles
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
/* variables.css - Design tokens from front-end spec */
:root {
  /* Core Brand Colors */
  --color-primary: #FFDD00; /* Atomic Yellow */
  --color-primary-hover: #F5D000;
  --color-success: #027A48;
  --color-error: #B42318;
  --color-warning: #FDB022;
  --color-info: #2563EB;

  /* Text Colors */
  --color-text: #333333;
  --color-text-secondary: #666666;
  --color-text-tertiary: #999999;

  /* Backgrounds */
  --color-bg: #FFFFFF;
  --color-bg-off-white: #FFFDF0;
  --color-bg-gray: #F5F5F5;

  /* Typography - Rubik Font System */
  --font-family: 'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-family-mono: 'Rubik Mono', 'Courier New', monospace;
  --font-size-h1: 32px;
  --font-size-h2: 24px;
  --font-size-h3: 20px;
  --font-size-body-lg: 16px;
  --font-size-body: 14px;
  --font-size-small: 12px;
  --font-weight-light: 300;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --line-height-base: 1.5;

  /* Spacing - 8-point Grid System */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-2xl: 48px;
  --spacing-3xl: 64px;

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.12);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.15);
  --shadow-lg: 0 10px 20px rgba(0,0,0,0.20);
  --shadow-focus: 0 0 0 3px rgba(255,221,0,0.25);

  /* Border Radius */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 50%;

  /* Transitions */
  --transition-micro: 150ms ease-in-out;
  --transition-standard: 300ms ease-in-out;
  --transition-slow: 500ms ease-in-out;

  /* Minimum Touch Targets */
  --touch-target-min: 44px;
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

**RTK Query Configuration Pattern:**

```typescript
// store/api/baseApi.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '../index';

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    prepareHeaders: (headers, { getState }) => {
      // Add JWT token to all requests
      const token = (getState() as RootState).jwt;
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Learner', 'Session', 'Chat', 'Intervention'],
  endpoints: () => ({}),
});

// store/api/cognitiveApi.ts
import { baseApi } from './baseApi';

export const cognitiveApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getLearnerProfile: builder.query<LearnerProfile, string>({
      query: (learnerId) => `learners/${learnerId}/profile`,
      providesTags: ['Learner'],
    }),
    updateLearnerProfile: builder.mutation<LearnerProfile, UpdateProfileRequest>({
      query: ({ learnerId, ...body }) => ({
        url: `learners/${learnerId}/profile`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Learner'],
    }),
    sendBehavioralSignals: builder.mutation<void, BehavioralSignal>({
      query: (signal) => ({
        url: 'cognitive/signals',
        method: 'POST',
        body: signal,
      }),
    }),
  }),
});

export const { useGetLearnerProfileQuery, useUpdateLearnerProfileMutation, useSendBehavioralSignalsMutation } = cognitiveApi;

// store/configure_store.ts
import { configureStore as rtkconfigureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { baseApi } from './api/baseApi';
import settingsReducer from './slices/settingsSlice';
import jwtReducer from './slices/jwtSlice';

export function configureStore({ settings, jwt, apiBaseUrl }) {
  const store = rtkconfigureStore({
    reducer: {
      settings: settingsReducer,
      jwt: jwtReducer,
      [baseApi.reducerPath]: baseApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          // Ignore these action types
          ignoredActions: ['jwt/refresh'],
        },
      }).concat(baseApi.middleware),
    preloadedState: {
      settings,
      jwt,
    },
  });

  // Setup listeners for refetch on focus/reconnect
  setupListeners(store.dispatch);

  return store;
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

  // RTK Query hooks for data fetching
  const { data: learnerData, isLoading } = useGetLearnerProfileQuery(learnerId);
  const [updateProfile] = useUpdateLearnerProfileMutation();

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
import { configureStore } from './store/configure_store';
import DefaultRoot from './root';

// Polyfill es6 promises for IE
es6Promise.polyfill();

// Set app element for accessible modals
ReactModal.setAppElement('#main-app');

// Extract LTI settings from window
const settings = getInitialSettings(window.DEFAULT_SETTINGS);

// Configure Redux store with RTK Query middleware
const store = configureStore({
  settings,
  jwt: window.DEFAULT_JWT,
  // RTK Query will be configured within the store setup
  apiBaseUrl: settings.api_url || window.location.origin
});

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

    // RTK Query error handling is configured in the store middleware
    // Canvas reauthorization and 401 errors are handled by the baseApi configuration

    // Render React application with LTI validation
    const mainApp = document.getElementById('main-app');
    createRoot(mainApp).render(
      <FixedResizeWrapper getSize={getSize}>
        <LtiLaunchCheck stateValidation={window.DEFAULT_SETTINGS.state_validation}>
          <DefaultRoot store={store} />
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

### Commercialization & Market Strategy

#### Pricing Architecture

- **Institutional Licensing:** $10,000-$50,000 annually based on enrollment
- **Per-Student Cost:** $3-7 annually (dramatically lower than $50-200 competitors)
- **Pilot Pricing:** Special rates for early adopters and research partners
- **Multi-Year Discounts:** Volume pricing for 3-5 year commitments

#### Confirmed Pilot Partnerships

The architecture must support these confirmed pilot institutions:

- **Utah State University** - Center for Instructional Design and Innovation
- **Utah Valley University** - STEM gateway courses
- **Harvard Medical School** - Program in Medical Education
- **Persown Connect, Inc.** - Workforce training integration

#### Competitive Advantages Enabled by Architecture

1. **Native LTI Integration:** Zero workflow disruption via existing foundation
2. **Edge Computing:** Global <100ms response times via Cloudflare Workers
3. **Cross-Course Intelligence:** Unique D1 multi-tenant design enables journey tracking
4. **Cost Efficiency:** Serverless architecture enables $3-7 per student pricing
5. **Privacy-First:** Student-controlled data with FERPA/GDPR compliance built-in
6. **Zero Training:** Intuitive interfaces leveraging Canvas familiarity

### UI/UX Implementation Guidelines

When implementing the front-end components, developers should:

1. **Reference the Front-End Spec:** Always consult `docs/front-end-spec.md` for:
   - Exact pixel dimensions and spacing
   - Color values and usage guidelines
   - Typography specifications
   - Animation timings and easing functions
   - Accessibility requirements

2. **Use Design Tokens:** Implement all styles using CSS custom properties defined in `variables.css`

3. **Follow Component Patterns:** Each component in the spec has:
   - Visual hierarchy guidelines
   - State management requirements
   - Interaction patterns
   - Responsive behavior
   - Performance optimizations

4. **Maintain Brand Voice:** Follow the voice and tone guidelines:
   - Encouraging and supportive
   - Clear and concise
   - Academic but approachable
   - Confident without being condescending

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
