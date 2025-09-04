# Atomic Guide Brownfield Architecture Document

## Introduction

This document captures the CURRENT STATE of the Atomic Guide codebase, a Cloudflare Workers-based LTI 1.3 tool that is being enhanced with AI-powered chat features and deep linking assessment capabilities. It serves as a reference for AI agents working on the planned enhancements outlined in the PRD.

### Document Scope

Focused on areas relevant to: Adding AI Guide chat interface, deep linking assessments, multi-tenant D1 database foundation, and instructor productivity tools as specified in the PRD.

### Change Log

| Date       | Version | Description                 | Author  |
| ---------- | ------- | --------------------------- | ------- |
| 2025-08-22 | 1.0     | Initial brownfield analysis | Analyst |

## Quick Reference - Key Files and Entry Points

### Critical Files for Understanding the System

- **Main Entry**: `src/index.ts` - Hono app handling all LTI routes and services
- **Configuration**: `src/config.ts`, `definitions.ts`, `wrangler.jsonc`
- **Core Business Logic**: `src/api/handlers/`, `src/services/`, `src/durable-objects/`
- **Client Entry Points**: `client/app.tsx` (LTI launch), `client/home.ts` (home page), `client/app-init.ts` (OIDC init)
- **Database Schema**: `src/db/schema.sql` - Multi-tenant D1 database structure
- **LTI Integration**: Uses `@atomicjolt/lti-*` packages for all protocol handling
- **Key Algorithms**: `src/tool_jwt.ts` (JWT signing), `src/register.ts` (dynamic registration)

### Enhancement Impact Areas (From PRD)

These files/modules will be affected by the planned AI chat and assessment enhancements:

- **Chat System**: `src/api/handlers/chat.ts`, `client/components/chat/`, `src/durable-objects/ChatConversationDO.ts`
- **Database**: `src/db/` - D1 integration for conversation storage
- **Client State**: `client/store/` - Redux toolkit for state management
- **LTI Services**: Will extend `/lti/sign_deep_link` for assessment deep linking
- **New Modules Needed**: `/src/assessment/`, `/src/services/ai/`, content extraction handlers

## High Level Architecture

### Technical Summary

The system is a serverless edge-based LTI 1.3 tool built on Cloudflare Workers, providing sub-100ms response times globally. It handles LTI authentication, dynamic registration, and is being enhanced with AI-powered learning features.

### Actual Tech Stack (from package.json)

| Category         | Technology         | Version    | Notes                                          |
| ---------------- | ------------------ | ---------- | ---------------------------------------------- |
| Runtime          | Cloudflare Workers | Latest     | Edge computing with global distribution        |
| Framework        | Hono               | 4.9.1      | Lightweight web framework for Workers          |
| LTI Libraries    | @atomicjolt/lti-\* | Various    | Complete LTI 1.3 implementation                |
| Frontend         | React              | 19.1.0     | SPA for client interface                       |
| State Management | Redux Toolkit      | 2.8.2      | Client-side state with RTK Query for API calls |
| Build System     | Vite               | 5.x        | Fast HMR and optimized builds                  |
| Database         | Cloudflare D1      | Configured | SQL database (SQLite-based) for edge           |
| KV Storage       | Cloudflare KV      | Active     | Key-value storage for platform configs         |
| Durable Objects  | Cloudflare DO      | Active     | Stateful edge computing for real-time features |
| AI Integration   | Cloudflare AI      | Configured | Edge AI inference (binding configured)         |
| TypeScript       | TypeScript         | 5.9.2      | Strict mode enforced                           |
| Testing          | Vitest             | 3.1.4      | Unit and integration testing                   |

### Repository Structure Reality Check

- Type: Monorepo containing Worker backend and React SPA frontend
- Package Manager: npm with package-lock.json
- Notable: Client code built with Vite and served as static assets, manifest injection for cache busting

## Source Tree and Module Organization

### Project Structure (Actual)

```text
atomic-guide/
├── src/                         # Cloudflare Worker backend
│   ├── index.ts                 # Main Hono app entry point
│   ├── api/
│   │   └── handlers/
│   │       └── chat.ts          # Chat API handler (placeholder implementation)
│   ├── config.ts                # LTI tool configuration
│   ├── db/
│   │   ├── schema.sql           # D1 database schema (comprehensive)
│   │   ├── migrations.ts        # Migration utilities (placeholder)
│   │   └── test-connection.ts   # DB connection testing
│   ├── durable-objects/
│   │   ├── ChatConversationDO.ts    # Chat state management
│   │   └── StruggleDetectorDO.ts    # Struggle detection (placeholder)
│   ├── html/                    # Server-rendered HTML templates
│   ├── libs/
│   │   └── manifest.ts          # Asset manifest handling
│   ├── register.ts              # Dynamic registration handler
│   ├── services/
│   │   ├── database.ts          # D1 database service (placeholder)
│   │   └── StorageFallback.ts  # KV/D1 fallback logic
│   └── tool_jwt.ts             # JWT signing utilities
├── client/                      # React SPA frontend
│   ├── app.tsx                  # Main LTI launch app
│   ├── app-init.ts              # OIDC initialization
│   ├── home.ts                  # Home page entry
│   ├── components/
│   │   └── chat/                # Chat UI components
│   │       ├── ChatFAB.tsx     # Floating action button
│   │       ├── ChatWindow.tsx  # Main chat interface
│   │       └── MessageList.tsx # Message display
│   ├── store/                   # Redux state management
│   │   ├── configure_store.ts  # Store setup
│   │   ├── api/
│   │   │   ├── baseApi.ts      # RTK Query base
│   │   │   └── chatApi.ts      # Chat API slice
│   │   └── slices/
│   │       ├── chatSlice.ts    # Chat state
│   │       └── jwtSlice.ts     # JWT management
│   └── styles/                  # CSS modules
├── public/                      # Static assets
│   ├── images/                  # Logos and icons
│   └── styles.css              # Global styles
├── tests/                       # Test suites
├── definitions.ts               # Global constants and paths
├── wrangler.jsonc              # Cloudflare deployment config
└── vite.config.ts              # Vite build configuration
```

### Key Modules and Their Purpose

- **LTI Core**: `src/index.ts` handles all LTI 1.3 protocol flows via `@atomicjolt/lti-endpoints`
- **Authentication**: JWT-based auth using Cloudflare KV for key storage, `src/tool_jwt.ts` for signing
- **Chat System**: Basic implementation in `src/api/handlers/chat.ts` with placeholder responses
- **Database Layer**: D1 schema defined but not fully integrated, multi-tenant support planned
- **Client Application**: React SPA with Redux for state, chat UI components ready for AI integration
- **Dynamic Registration**: Full support via `/lti/register` endpoint with platform config storage

## Data Models and APIs

### Data Models

Database schema comprehensively defined in `src/db/schema.sql`:

- **Tenants**: Multi-tenant support with institution isolation
- **Learner Profiles**: Cognitive DNA attributes (forgetting curves, learning velocity)
- **Learning Sessions**: Engagement tracking and metrics
- **Struggle Events**: Pattern detection for interventions
- **Chat System**: Conversations and messages with context
- **Knowledge Graph**: Concept dependencies and mastery tracking
- **Analytics**: Course-level aggregations and instructor dashboards

### API Specifications

Current endpoints:

- **LTI Endpoints**: `/lti/init`, `/lti/redirect`, `/lti/launch`, `/lti/jwks`
- **Dynamic Registration**: `/lti/register`, `/lti/register_finish`
- **LTI Services**: `/lti/names_and_roles`, `/lti/sign_deep_link`
- **Chat API**: `/api/chat/message` (POST) - JWT authenticated
- **Health Check**: `/up` - Returns version and status

Planned additions from PRD:

- `/api/assessment/*` - Assessment configuration and results
- WebSocket/SSE for real-time chat via Durable Objects
- Canvas postMessage handlers for content extraction

## Technical Debt and Known Issues

### Critical Technical Debt

1. **Chat Implementation**: Currently returns placeholder responses, needs AI service integration
2. **D1 Database**: Schema created but not connected to application logic
3. **Durable Objects**: Defined but not implementing actual functionality
4. **Client-Server Split**: Some components use vanilla JS (deep linking) while others use React
5. **Test Coverage**: Many tests skipped due to RTK Query/fetch mock issues

### Workarounds and Gotchas

- **Frame Options**: Set to `ALLOWALL` for LMS iframe embedding (security consideration)
- **CSP Headers**: Allows `unsafe-inline` and `unsafe-eval` for LMS compatibility
- **Manifest Injection**: Custom script `scripts/inject-manifest.js` for cache busting
- **JWT Secret**: Not configured in environment, needs setup for production
- **D1 Database IDs**: Placeholder values in `wrangler.jsonc` need actual IDs

## Integration Points and External Dependencies

### External Services

| Service          | Purpose         | Integration Type | Key Files                  |
| ---------------- | --------------- | ---------------- | -------------------------- |
| LMS Platforms    | LTI launches    | LTI 1.3 protocol | `src/index.ts`             |
| Cloudflare KV    | Config storage  | Native binding   | All LTI endpoints          |
| Cloudflare D1    | Relational data | Native binding   | `src/db/` (not integrated) |
| Cloudflare AI    | Edge inference  | Native binding   | Configured but unused      |
| External AI APIs | Chat responses  | REST (planned)   | Not implemented            |

### Internal Integration Points

- **LTI Launch Flow**: OIDC authentication → JWT validation → Client app launch
- **Asset Serving**: Vite builds → Manifest generation → Dynamic script injection
- **State Management**: Server JWT → Client Redux store → API authentication
- **Durable Objects**: WebSocket connections for real-time features (planned)

## Development and Deployment

### Local Development Setup

1. Clone repository and run `npm install`
2. Create `.dev.vars` with JWT_SECRET and other secrets
3. Run `npm run dev` - starts at http://localhost:8787
4. Known issue: D1 database requires manual setup with `scripts/setup-d1.sh`

### Build and Deployment Process

- **Build Command**: `npm run build` - TypeScript compilation, Vite build, manifest injection
- **Check Command**: `npm run check` - Validates before deployment
- **Deployment**: `npm run deploy` - Deploys to Cloudflare Workers
- **Environments**: Production at lti-worker.atomicjolt.win

## Testing Reality

### Current Test Coverage

- Unit Tests: Partial coverage with Vitest
- Integration Tests: Separate config `vitest.integration.config.ts`
- E2E Tests: None
- Many tests skipped due to RTK Query compatibility issues

### Running Tests

```bash
npm test                    # Runs unit tests
npm run test:integration    # Runs integration tests (requires setup)
```

## Enhancement PRD Impact Analysis

### Files That Will Need Modification

Based on the PRD requirements, these files will be affected:

1. **Chat AI Integration**:
   - `src/api/handlers/chat.ts` - Replace placeholder with AI service calls
   - `client/components/chat/` - Enhance UI for rich media responses
   - `src/durable-objects/ChatConversationDO.ts` - Implement real-time state

2. **D1 Database Integration**:
   - `src/services/database.ts` - Implement CRUD operations
   - `src/db/migrations.ts` - Create migration system
   - All API handlers - Add database persistence

3. **Deep Linking Assessments**:
   - `src/index.ts` - Add new `/lti/deep_link` endpoint
   - New: `src/assessment/` module for assessment logic
   - Client: Assessment configuration UI components

4. **Canvas Integration**:
   - New: postMessage handlers for content extraction
   - Client: DOM scraping utilities
   - API: Context enrichment for chat

### New Files/Modules Needed

- `src/services/ai/` - AI service integration layer (OpenAI, Anthropic)
- `src/assessment/` - Assessment generation and grading
- `client/components/assessment/` - Assessment UI components
- `client/utils/canvas-integration.ts` - Canvas API helpers
- `src/services/content-extractor.ts` - Page content extraction

### Integration Considerations

- Must maintain backward compatibility with existing LTI flows
- AI service calls need streaming for responsiveness
- D1 migrations must be reversible
- Canvas postMessage must handle cross-origin properly
- Rate limiting essential for AI API cost management

## Appendix - Useful Commands and Scripts

### Frequently Used Commands

```bash
npm run dev         # Start local development
npm run build       # Production build
npm run check       # Validate before deploy
npm run deploy      # Deploy to Cloudflare
npm run tail        # View live logs
npm test            # Run tests
```

### Database Commands

```bash
npm run db:setup    # Initialize D1 database
npm run db:seed     # Seed test data
npm run db:query    # Execute SQL queries
```

### Debugging and Troubleshooting

- **Logs**: `npm run tail` or check Cloudflare dashboard
- **Local Testing**: Use Wrangler's local mode with `--local` flag
- **Common Issues**:
  - KV namespace IDs must match in wrangler.jsonc
  - JWT_SECRET must be set for chat API
  - D1 requires manual database creation
  - Frame-ancestors CSP for LMS embedding

### Key Configuration Files

- `wrangler.jsonc` - Cloudflare deployment settings
- `definitions.ts` - Application constants and paths
- `src/config.ts` - LTI tool configuration
- `.dev.vars` - Local development secrets (create manually)

## Critical Constraints and Considerations

### Technical Constraints

1. **Worker Limits**: 50ms CPU time, 128MB memory, 10ms startup
2. **D1 Limits**: 500MB per database, 1000 queries/sec
3. **KV Limits**: 25MB value size, eventual consistency
4. **Durable Objects**: Regional isolation affects latency

### Migration Path

1. D1 database IDs need to be created and configured
2. JWT_SECRET must be added to Worker secrets
3. AI service API keys need secure storage
4. Gradual React migration for remaining vanilla JS components
5. Test coverage improvement required before major changes

### Security Considerations

- FERPA compliance required for student data
- Multi-tenant isolation critical in D1 schema
- JWT validation for all authenticated endpoints
- Rate limiting needed for AI endpoints
- Audit logging for compliance (schema exists, not implemented)

---

This document reflects the actual state of the Atomic Guide system as of August 2025, including technical debt, partial implementations, and preparation for the AI-powered enhancements described in the PRD. The codebase is well-structured for the planned features but requires significant implementation work to achieve the PRD goals.
