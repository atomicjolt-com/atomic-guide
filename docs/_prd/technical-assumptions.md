# Technical Assumptions

## Repository Structure: Monorepo

Single repository containing all services and applications, following Google's proven approach for easier dependency management, atomic commits across services, and unified CI/CD. Structure includes Cloudflare Worker backend, React client application, shared TypeScript types, and cognitive algorithm libraries.

## Service Architecture

**CRITICAL: Multi-tenant architecture where each institution gets its own Cloudflare D1 database instance.** This ensures complete data isolation, institution-specific performance optimization, and simplified compliance with varying regional data regulations. Architecture components:

- Cloudflare Workers with up to 15-minute execution time for complex cognitive processing
- D1 SQL databases (one per tenant) with real-time backups for relational data and complex queries
- KV namespaces for global configuration and cache
- Durable Objects (proven technology) for real-time struggle detection and session management
- Cloudflare AI Models (DeepSeek V3 or OpenAI OSS models) for on-edge cognitive processing
- API integration layer for external AI providers (OpenAI, Anthropic, etc.)

## Testing Requirements

Comprehensive testing pyramid including:

- Unit tests for cognitive algorithms and React components (Vitest + React Testing Library)
- Integration tests for LMS postMessage communication and D1 database operations
- End-to-end tests for critical user journeys using Playwright
- Multi-tenant isolation testing to ensure data separation
- Performance testing for concurrent users per tenant
- A/B testing framework for algorithm optimization

## Additional Technical Assumptions and Requests

- **Frontend Framework:** React with TypeScript for type safety and component reusability
- **Component Library:** @atomicjolt/atomic-elements for consistent UI components
- **State Management:** React Context + Zustand for complex client state
- **Client Architecture:** Feature-based folder structure with clear separation of concerns (features/, shared/, utils/)
- **Styling:** CSS Modules or Tailwind for scoped, maintainable styles
- **Build System:** Vite for fast development and optimized production builds
- **Database Schema:** Carefully designed multi-tenant schema with tenant_id partitioning
- **AI/ML Strategy:** Cloudflare AI for edge inference, external APIs for complex analysis
- **Authentication:** Extend LTI 1.3 JWT with tenant context, row-level security in D1
- **API Design:** RESTful endpoints with tenant isolation, WebSocket via Durable Objects for real-time
- **Monitoring:** Cloudflare Analytics + custom D1 tables for per-tenant metrics
- **Data Privacy:** Tenant data isolation, encrypted at rest, FERPA-compliant audit logs per tenant
- **Development Tools:** Wrangler CLI, GitHub Actions CI/CD, Prettier + ESLint
- **Performance Budget:** Optimize React bundle splitting, lazy loading for <100kb initial load

## Cognitive Algorithm Implementation

Based on validated research parameters, the system will implement:

- **Spaced Repetition Algorithm:**
  - Initial review: 1-2 days after first exposure
  - Subsequent intervals: 3 days → 7 days → 14 days → 30 days → 90 days
  - Adaptive adjustment based on performance: multiply interval by 1.3 for success, by 0.6 for failure
  - Optimal spacing formula: interval = retention_goal × 0.1 to 0.3

- **Forgetting Curve Modeling:**
  - Ebbinghaus formula: R(t) = e^(-t/s) where s = individual stability coefficient
  - Track individual decay rates for different content types
  - Trigger review when predicted retention drops below 85%
  - Account for sleep consolidation with 24-48 hour minimum intervals

- **Difficulty Adjustment Logic:**
  - Target success rate: 70-80% using fuzzy logic controller
  - Input variables: response_time, accuracy, hint_usage, struggle_signals
  - Adjust difficulty in 5% increments to maintain flow state
  - Different thresholds for conceptual (75%) vs. procedural (80%) content

- **Retrieval Practice Scheduling:**
  - Frequency: 2-3 sessions per week per subject
  - Duration: 15-20 minutes per session (max 30 minutes)
  - Mix ratio: 60% new material, 40% review
  - Interleaving: Rotate between 3-4 topics per session

- **Early Warning Thresholds:**
  - Engagement: Flag if <60% of scheduled reviews completed
  - Performance: Alert if success rate drops below 65% over 5 sessions
  - Time-on-task: Concern if <50% of peer median
  - Critical period: First 6 weeks weighted 2x for intervention priority
