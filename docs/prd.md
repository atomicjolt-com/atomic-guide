# Atomic Guide/Focus Product Requirements Document (PRD)

## Goals and Background Context

### Goals
- Achieve 40-64% improvement in knowledge retention through personalized cognitive profiling (validated through institutional pilots)
- Reduce STEM gateway course failure rates by 15-25% in higher education institutions  
- Create portable "Learner DNA" profiles that work across institutional, AI client, and standalone environments with strong privacy protections
- Build trust through faculty champions and measurable early wins in pilot programs
- Deliver <100ms response times globally through edge computing architecture with robust fallbacks
- Enable cross-course intelligence that predicts and prevents learning struggles, starting with well-mapped STEM sequences

### Background Context

Atomic Guide/Focus addresses the critical problem that 70% of learning is forgotten within 24 hours by creating a Progressive Cognitive Learning Infrastructure platform. The solution combines research-backed cognitive science with real-time AI optimization to deliver measurable retention improvements, initially focused on STEM gateway courses where failure rates of 15-30% create significant institutional costs. In the current higher education landscape, with 17:1 student-to-faculty ratios, personalized learning at scale has become impossible without technological intervention that respects both student privacy and faculty autonomy.

The platform leverages unique access to academic journey data via LTI 1.3 integration, creating cross-course intelligence that no existing solution provides. By combining institutional credibility through Canvas integration with universal AI enhancement through MCP (Model Context Protocol), Atomic Guide creates portable cognitive profiles that transform institutional learning data into personal learning assets. The system is designed with privacy-first principles, giving students control over their data while providing faculty with actionable insights that enhance rather than replace their teaching methods.

### Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-08-20 | 1.0 | Initial PRD creation based on Project Brief | John (PM) |
| 2025-08-20 | 1.1 | Updated goals and context based on stakeholder analysis and risk assessment | John (PM) |

## Requirements

### Functional Requirements

**FR1:** The system shall create individual Learner DNA profiles capturing memory architecture (forgetting curves for visual/textual/mathematical content), learning velocity, and engagement patterns

**FR2:** ✅ ALREADY IMPLEMENTED - The system integrates with Canvas LMS via LTI 1.3 using the existing atomic-lti-worker foundation

**FR3:** The system shall detect learning struggles in real-time through behavioral signals (30+ second hovers indicating confusion, repeated scrolling showing difficulty, idle patterns suggesting overload) via Canvas postMessage integration

**FR4:** The system shall provide non-intrusive intervention suggestions timed to cognitive state without disrupting the learning flow

**FR5:** The system shall implement MCP (Model Context Protocol) to deliver Learner DNA profiles to AI clients (Claude, ChatGPT, others) for enhanced personalization

**FR6:** The system shall create knowledge dependency graphs mapping prerequisite concepts across course catalogs to identify learning gaps

**FR7:** The system shall predict performance challenges ("will struggle with organic chemistry Week 4 based on algebra gaps") with confidence scores

**FR8:** The system shall generate optimal study schedules coordinating review across multiple courses based on cognitive load and spacing algorithms

**FR9:** The system shall provide students with privacy controls to manage, export, or delete their Learner DNA profiles

**FR10:** The system shall generate faculty dashboards showing aggregate learning patterns without compromising individual student privacy

**FR11:** The system shall store and retrieve Learner DNA profiles using Cloudflare KV namespaces for persistence

**FR12:** The system shall implement deep linking capabilities to navigate directly to specific course content or assessments

### Non-Functional Requirements

**NFR1:** ✅ ALREADY ACHIEVED - Cloudflare Workers edge deployment provides <100ms response times globally

**NFR2:** ✅ ALREADY ACHIEVED - Cloudflare Workers infrastructure provides 99.9% uptime with automatic failover

**NFR3:** ✅ ALREADY ACHIEVED - Cloudflare Workers auto-scales to handle concurrent users without configuration

**NFR4:** The system shall comply with FERPA, GDPR, and accessibility standards (WCAG AA minimum)

**NFR5:** The system shall leverage existing LTI dynamic registration for zero-friction institutional onboarding

**NFR6:** The system shall encrypt all Learner DNA data at rest (KV storage) and in transit using industry-standard protocols

**NFR7:** The system shall provide measurable learning outcomes within 30 days of deployment for pilot validation

**NFR8:** The system shall optimize algorithms to work within Cloudflare Workers CPU limits (10ms-50ms max)

**NFR9:** The system shall support A/B testing frameworks for continuous algorithm improvement

**NFR10:** The system shall maintain audit logs for all data access and algorithmic decisions for compliance

## User Interface Design Goals

### Overall UX Vision
Create an invisible intelligence layer that enhances existing learning workflows without adding cognitive burden. The interface should feel like a natural extension of Canvas, appearing only when needed with contextual, personalized interventions that respect the learner's cognitive state and privacy preferences. The system must actively communicate privacy protection and provide user control over all interventions.

### Key Interaction Paradigms
- **Ambient Intelligence:** UI elements appear contextually based on detected struggle patterns, not constant overlays
- **Progressive Disclosure:** Start minimal, reveal complexity only as learners demonstrate readiness
- **Non-Disruptive Assistance:** Interventions that enhance focus rather than breaking it with smart throttling
- **Cognitive State Awareness:** Interface adapts based on detected attention, confusion, or overload signals
- **Privacy-First Design:** Clear privacy indicators showing what's being tracked and user-controlled quiet modes
- **Role-Based Experiences:** Distinct interfaces optimized for students, faculty, coaches, and administrators

### Core Screens and Views
- **LTI Launch Landing:** Initial profile creation and onboarding flow within Canvas with privacy preferences
- **Student Learning Dashboard:** Personal cognitive insights, progress visualization, and privacy controls
- **Intervention Overlay:** Context-sensitive help with sensitivity slider and dismiss options
- **Mobile Study Companion:** Responsive review schedules and quick progress checks
- **Privacy Control Center:** Data management, tracking transparency widget, and profile export options
- **Faculty Analytics Dashboard:** 30-second aggregate insights with one-click struggling student reports
- **Academic Success Coach Portal:** Early warning system with customizable alert thresholds
- **Admin Configuration Panel:** Institution-wide settings and compliance audit tools

### Accessibility: WCAG AA
Full compliance with WCAG AA standards including keyboard navigation, screen reader support, and cognitive accessibility features. Customizable intervention thresholds for students with disabilities, ensuring the system adapts to diverse baseline cognitive patterns without stigmatization.

### Branding
Clean, academic aesthetic that complements Canvas's interface without competing for attention. Subtle use of color psychology to indicate cognitive states (green for optimal learning zone, amber for challenge, red for overload). Positive framing that celebrates growth rather than highlighting deficits. Professional appearance suitable for board presentations while remaining approachable for students.

### Target Device and Platforms: Web Responsive
Desktop/laptop optimized for in-depth study sessions with full intervention capabilities. Mobile-first design for review features, schedule checking, and quick progress monitoring. Tablet-optimized for reading and review sessions. Parent portal access via mobile-friendly digest emails when applicable.

## Technical Assumptions

### Repository Structure: Monorepo
Single repository containing all services and applications, following Google's proven approach for easier dependency management, atomic commits across services, and unified CI/CD. Structure includes Cloudflare Worker backend, React client application, shared TypeScript types, and cognitive algorithm libraries.

### Service Architecture
**CRITICAL: Multi-tenant architecture where each institution gets its own Cloudflare D1 database instance.** This ensures complete data isolation, institution-specific performance optimization, and simplified compliance with varying regional data regulations. Architecture components:
- Cloudflare Workers with up to 15-minute execution time for complex cognitive processing
- D1 SQL databases (one per tenant) with real-time backups for relational data and complex queries
- KV namespaces for global configuration and cache
- Durable Objects (proven technology) for real-time struggle detection and session management
- Cloudflare AI Models (DeepSeek V3 or OpenAI OSS models) for on-edge cognitive processing
- API integration layer for external AI providers (OpenAI, Anthropic, etc.)

### Testing Requirements
Comprehensive testing pyramid including:
- Unit tests for cognitive algorithms and React components (Vitest + React Testing Library)
- Integration tests for Canvas postMessage communication and D1 database operations
- End-to-end tests for critical user journeys using Playwright
- Multi-tenant isolation testing to ensure data separation
- Performance testing for concurrent users per tenant
- A/B testing framework for algorithm optimization

### Additional Technical Assumptions and Requests
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

## Epic List

**Epic 1: Multi-Tenant Foundation + Basic Student & Faculty Dashboards**
Establish multi-tenant infrastructure with D1 database provisioning, extend existing LTI 1.3 integration, and deliver immediate value through basic student learning dashboard and faculty insights panel. This ensures both technical foundation and user-facing value from Day 1.

**Epic 2: Learner DNA Core + Privacy Controls**
Build the cognitive profiling system that captures memory patterns, learning velocity, and engagement DNA with comprehensive privacy controls, data management interfaces, and student consent workflows. This establishes trust while building core algorithms.

**Epic 3: Struggle Detection + Simple Interventions**
Implement Canvas postMessage monitoring, real-time struggle pattern detection via Durable Objects, and contextual intervention delivery. This proves the core concept with measurable learning improvements.

**Epic 4: Cross-Course Intelligence**
Create knowledge dependency mapping, prerequisite gap analysis, and performance prediction algorithms using Cloudflare AI models. This delivers the unique differentiation that no competitor offers.

**Epic 5: MCP/AI Enhancement**
Implement Model Context Protocol endpoints, enable Learner DNA delivery to AI clients (Claude, ChatGPT), and create portable profile management. This expands the platform beyond institutional boundaries.

**Epic 6: Advanced Analytics & Optimization**
Build sophisticated analytics for academic success coaches, advanced faculty tools, A/B testing framework, and algorithm optimization based on real usage data. This refines and optimizes based on lessons learned.