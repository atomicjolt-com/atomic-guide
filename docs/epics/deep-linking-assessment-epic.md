# Deep Linking Assessment Features - Brownfield Enhancement

## Epic Goal

Enable instructors to embed AI-powered conversational assessment checkpoints directly into Canvas assignments through deep linking, transforming Atomic Guide from a content delivery tool into an interactive learning platform with real-time comprehension monitoring and automated grade passback.

## Epic Description

### Existing System Context

- **Current relevant functionality:** Atomic Guide currently operates as an LTI 1.3 tool integrated with Canvas LMS, delivering content to students through the existing Cloudflare Workers-based architecture using Hono app framework
- **Technology stack:** Cloudflare Workers, TypeScript, Vite (client-side), LTI 1.3 endpoints via @atomicjolt/lti-endpoints, Cloudflare KV for state management
- **Integration points:** Canvas LTI launch flow, existing authentication system, current client-side SPA architecture, existing analytics infrastructure

### Enhancement Details

**What's being added/changed:**

- Canvas postMessage API integration for real-time page content extraction during student reading sessions
- Deep linking placement interface allowing instructors to embed assessment checkpoints through configuration modal
- AI-powered chat interface using OpenAI/Anthropic APIs for conversational student assessment
- LTI Assignment and Grade Service (AGS) integration for automatic Canvas gradebook updates
- Cloudflare D1 database for conversation history and assessment template storage

**How it integrates:**

- Extends existing `/lti/` routes with new deep linking endpoints
- Leverages current JWT signing infrastructure for secure communication
- Builds on existing client manifest injection system for chat interface delivery
- Uses established KV namespace patterns for configuration storage
- Maintains current authentication and state management through OIDC flow

**Success criteria:**

- Instructors can embed assessment checkpoints in under 5 minutes
- AI chat responses delivered in under 3 seconds
- 80% student completion rate for embedded assessments
- Automatic grade synchronization with Canvas gradebook
- Zero disruption to existing content delivery functionality

## Stories

1. **Story 1: Canvas postMessage Integration** - Implement Canvas postMessage API listener to extract page content and maintain contextual awareness during student reading sessions, storing content references in Cloudflare D1

2. **Story 2: Deep Linking Configuration Interface** - Create instructor-facing modal for embedding assessment checkpoints into Canvas assignments, including placement selection, assessment type configuration, and mastery criteria settings

3. **Story 3: AI Chat Assessment System** - Build conversational chat interface with AI backend integration, including student interaction handling, mastery tracking, and automatic grade passback via LTI AGS

## Compatibility Requirements

- [x] Existing LTI 1.3 authentication flow remains unchanged
- [x] Current content delivery functionality unaffected
- [x] Database changes isolated to new D1 instance, KV namespaces preserved
- [x] UI components follow existing Vite/TypeScript patterns
- [x] Performance maintains <100ms response for existing features
- [x] Backward compatibility with institutions not using assessment features

## Risk Mitigation

- **Primary Risk:** Canvas API rate limits or postMessage restrictions could impact real-time content extraction
- **Mitigation:** Implement content caching strategy in D1, batch API calls, and provide fallback manual content input option
- **Rollback Plan:** Feature flag in configuration to disable assessment features while preserving core LTI functionality; assessment endpoints isolated from core routes

## Definition of Done

- [x] All three stories completed with acceptance criteria met
- [x] Existing LTI launch and content delivery verified through regression testing
- [x] Deep linking flow tested across multiple Canvas instances
- [x] AI conversation quality validated by pilot instructors
- [x] Grade passback confirmed in Canvas gradebook
- [x] Documentation updated in CLAUDE.md and architecture docs
- [x] No performance degradation in existing features
- [x] Monitoring and error handling implemented for new endpoints

---

## Story Manager Handoff

"Please develop detailed user stories for this brownfield epic. Key considerations:

- This is an enhancement to an existing LTI 1.3 tool running on Cloudflare Workers with TypeScript/Vite frontend
- Integration points: Canvas postMessage API, LTI deep linking specification, LTI Assignment and Grade Service, existing JWT signing infrastructure
- Existing patterns to follow: Hono routing structure, KV namespace usage, client manifest injection, OIDC authentication flow
- Critical compatibility requirements: Must not break existing LTI launch flow, maintain sub-100ms response times for existing features, preserve current KV namespace structure
- Each story must include verification that existing content delivery functionality remains intact

The epic should maintain system integrity while delivering AI-powered conversational assessment capabilities that provide real-time comprehension insights to instructors and immediate feedback to students."
