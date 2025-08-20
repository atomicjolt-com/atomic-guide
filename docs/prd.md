# Atomic Guide/Focus Product Requirements Document (PRD)

## Goals and Background Context

### Goals

- Achieve 50-80% improvement in knowledge retention through retrieval practice (Adesope et al., 2017: g=0.50-0.80) and optimal spaced repetition (Cepeda et al., 2008: 35-50% improvement)
- Reduce STEM gateway course failure rates by 15-25% using adaptive difficulty adjustment (Chrysafiadi et al., 2023: 23% improvement) and early intervention systems (Gardner Institute, 2023: 10-15% retention improvement)
- Create portable "Learner DNA" profiles incorporating individual forgetting curves, optimal spacing intervals, and personalized difficulty thresholds across environments
- Build trust through faculty champions using conversational assessment to increase engagement by 35% (Yildirim-Erbasli & Bulut, 2023) while reducing test anxiety
- Deliver <100ms response times globally through edge computing architecture with robust fallbacks
- Enable cross-course intelligence using knowledge dependency graphs and prerequisite mapping, predicting struggles with 70-80% accuracy based on prior performance patterns

### Background Context

Atomic Guide/Focus addresses the critical problem that 70% of learning is forgotten within 24 hours (Murre & Dros, 2015) by creating a Progressive Cognitive Learning Infrastructure platform. The solution combines research-backed cognitive science with real-time AI optimization to deliver measurable retention improvements of 50-80% through retrieval practice (Adesope et al., 2017) and 35-50% through optimal spaced repetition (Cepeda et al., 2008). Initially focused on STEM gateway courses where failure rates of 15-30% create significant institutional costs ($13,000+ per student in excess credits, Kramer et al., 2018), the platform leverages proven interventions that reduce DFW rates by 10-15% (Tyton Partners, 2022). In the current higher education landscape, with 17:1 student-to-faculty ratios and 47% part-time faculty (NCES, 2024), personalized learning at scale has become impossible without technological intervention that respects both student privacy and faculty autonomy.

The platform leverages unique access to academic journey data via LTI 1.3 integration, creating cross-course intelligence that no existing solution provides. By combining institutional credibility through Canvas integration with universal AI enhancement through MCP (Model Context Protocol), Atomic Guide creates portable cognitive profiles that transform institutional learning data into personal learning assets. The system is designed with privacy-first principles, giving students control over their data while providing faculty with actionable insights that enhance rather than replace their teaching methods.

### Change Log

| Date       | Version | Description                                                                 | Author    |
| ---------- | ------- | --------------------------------------------------------------------------- | --------- |
| 2025-08-20 | 1.0     | Initial PRD creation based on Project Brief                                 | John (PM) |
| 2025-08-20 | 1.1     | Updated goals and context based on stakeholder analysis and risk assessment | John (PM) |
| 2025-08-20 | 1.2     | Added comprehensive AI Guide chat interface UX and technical requirements   | John (PM) |
| 2025-08-20 | 1.3     | Incorporated IES SBIR grant details: implementation, use cases, empirical support | John (PM) |

## Implementation and Use

### Student Engagement Model

Students will engage with Atomic Focus (AF) through natural conversations about their coursework, during which the system will:

1. **Monitor comprehension** using sophisticated linguistic analysis to detect understanding patterns in real-time
2. **Identify knowledge gaps** through real-time pattern recognition across current and prerequisite material
3. **Deliver personalized remediation** via adaptive dialogue tailored to individual learning styles
4. **Schedule review sessions** tailored to individual forgetting patterns using spaced repetition algorithms
5. **Provide actionable insights** on learning progress to both students and instructors

### Instructor Support Features

For instructors, AF will offer:

1. **Real-time class-wide analytics** to identify trends in student comprehension across topics and modules
2. **Early warning indicators** for at-risk students, enabling timely interventions before failure points
3. **Data-driven insights** into common areas of misunderstanding to guide curriculum adjustments

## Use Case: Alex's Academic Journey

Alex, a first-generation college student, uses AF across multiple courses to enhance retention and application of key concepts throughout their academic career:

### Freshman Year - Introductory Data Science
- AF identifies Alex's knowledge gaps in foundational topics like regression analysis
- Through adaptive conversations and targeted feedback, Alex builds confidence and comprehension
- Spaced repetition ensures retention of statistical concepts critical for future coursework
- Result: Alex masters concepts that would typically be forgotten within weeks

### Sophomore Year - Research Methods
- AF reinforces knowledge from prior courses, detecting connections to freshman statistics
- Helps Alex apply statistical techniques to survey design and hypothesis testing
- Personalized review sessions ensure Alex retains and applies earlier learning effectively
- Result: Cross-course intelligence prevents typical sophomore struggle with prerequisites

### Junior Year - Spanish for Business
- AF adapts to Alex's progress in a non-STEM domain, offering conversational practice
- Simulated business scenarios provide contextual language learning
- Adaptive feedback strengthens grammar and vocabulary, improving fluency and retention
- Result: Demonstrates AF's versatility beyond STEM subjects

### Senior Year - Capstone Seminar
- AF integrates knowledge from prior courses across all four years
- Guides Alex through interdisciplinary analyses of environmental policy
- Provides practice scenarios and feedback to support final presentation
- Result: Alex graduates with retained, integrated knowledge ready for workforce application

### Institutional Impact
Throughout Alex's journey, instructors use AF's class-wide analytics to track trends and intervene early, enhancing overall learning outcomes for the entire cohort.

## Requirements

### Functional Requirements

**FR1:** The system shall create individual Learner DNA profiles capturing memory architecture (individualized forgetting curves following Ebbinghaus exponential decay R = e^(-t/s)), learning velocity (time to 85% mastery), and engagement patterns (optimal challenge level at 70-80% success rate)

**FR2:** ✅ ALREADY IMPLEMENTED - The system integrates with Canvas LMS via LTI 1.3 using the existing atomic-lti-worker foundation

**FR3:** The system shall detect learning struggles in real-time through behavioral signals (30+ second hovers indicating confusion per Brown's decay theory, repeated scrolling showing difficulty, idle patterns suggesting cognitive overload per Mayer's coherence principle) via Canvas postMessage integration

**FR4:** The system shall provide an AI Guide chat interface accessible via floating action button or contextual triggers, enabling students to ask questions about current page content and receive personalized explanations based on their Learner DNA profile

**FR4.1:** The chat interface shall understand the current Canvas page context (course, module, assignment) to provide relevant responses without requiring students to specify context

**FR4.2:** The AI Guide shall maintain conversation history within a learning session and reference previous interactions for continuity

**FR4.3:** The system shall provide non-intrusive intervention suggestions timed to cognitive state without disrupting the learning flow

**FR5:** The system shall implement MCP (Model Context Protocol) to deliver Learner DNA profiles to AI clients (Claude, ChatGPT, others) for enhanced personalization

**FR6:** The system shall create knowledge dependency graphs mapping prerequisite concepts across course catalogs to identify learning gaps

**FR7:** The system shall predict performance challenges ("will struggle with organic chemistry Week 4 based on algebra gaps") with confidence scores

**FR8:** The system shall generate optimal study schedules using Cepeda's temporal ridgeline (spacing = 10-30% of retention interval), coordinating review across multiple courses with initial 1-2 day intervals, then exponentially increasing based on Pavlik & Anderson's ACT-R model

**FR9:** The system shall provide students with privacy controls to manage, export, or delete their Learner DNA profiles

**FR10:** The system shall generate faculty dashboards showing aggregate learning patterns without compromising individual student privacy

**FR11:** The system shall store and retrieve Learner DNA profiles using Cloudflare KV namespaces for persistence

**FR12:** The system shall implement deep linking capabilities to navigate directly to specific course content or assessments

**FR13:** The AI Guide chat interface shall extract and understand Canvas page content via DOM scraping and postMessage API to provide contextually relevant responses

**FR14:** The chat interface shall implement rate limiting and conversation token budgets to manage API costs while ensuring responsive user experience

**FR15:** The system shall provide proactive chat suggestions based on detected struggle patterns ("I noticed you've been on this problem for a while. Would you like help understanding the concept?")

**FR16:** The chat interface shall support rich media responses following Mayer's multimedia principles - coherent content (d=0.86), signaled essentials (d=0.48), segmented delivery (d=0.61) - including LaTeX math rendering, code snippets, diagrams, and embedded videos

**FR17:** The AI Guide shall maintain a knowledge base of frequently asked questions per course/module to provide instant responses without API calls

**FR18:** The system shall implement retrieval practice with 2-3 low-stakes quizzes per week, using both multiple-choice (stronger effect) and short-answer formats per Adesope et al. meta-analysis

**FR19:** The system shall adjust difficulty dynamically using fuzzy logic to maintain 70-80% success rate, tracking response time, accuracy, and hint usage per Chrysafiadi et al.

**FR20:** The system shall provide both open-book (d=0.51) and closed-book (d=0.80) testing options, with system recommendations based on content type per Agarwal et al.

**FR21:** The system shall implement early warning detection within first 6 weeks of course, triggering interventions for at-risk students showing <60% engagement or <70% success rate

**FR22:** The system shall distinguish between storage strength and retrieval strength per Bjork & Bjork's New Theory of Disuse, prioritizing items with high storage but low retrieval strength

**FR23:** The system shall enforce maximum 20-30 minute study sessions with mandatory breaks to optimize attention and consolidation per cognitive load research

**FR24:** The system shall implement "desirable difficulties" by introducing controlled challenges that reduce immediate performance but enhance long-term retention per Soderstrom & Bjork

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

- **AI Guide Chat Interface:** Persistent floating action button (FAB) that expands into conversational AI interface, positioned to avoid Canvas UI elements
- **Context-Aware Conversations:** Chat understands current page content, allowing questions like "explain this concept" or "why is this important" without specifying what "this" is
- **Ambient Intelligence:** UI elements appear contextually based on detected struggle patterns, not constant overlays
- **Progressive Disclosure:** Start minimal, reveal complexity only as learners demonstrate readiness
- **Non-Disruptive Assistance:** Interventions that enhance focus rather than breaking it with smart throttling
- **Cognitive State Awareness:** Interface adapts based on detected attention, confusion, or overload signals
- **Privacy-First Design:** Clear privacy indicators showing what's being tracked and user-controlled quiet modes
- **Role-Based Experiences:** Distinct interfaces optimized for students, faculty, coaches, and administrators

### Core Screens and Views

- **AI Guide Chat Interface:** 
  - Floating action button (FAB) with pulsing animation during detected struggle
  - Expandable chat window with message history and typing indicators
  - Context badge showing current page/assignment being discussed
  - Quick action buttons for common queries ("Explain this", "Give me an example", "Why is this important?")
  - Minimize/maximize controls to continue learning while keeping chat accessible
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

### Cognitive Algorithm Implementation

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

## Theoretical & Empirical Support

### Cognitive Science Foundation

AF is built on rigorously validated cognitive science principles with demonstrated efficacy:

#### Memory Consolidation and Retrieval Dynamics
- Leverages the New Theory of Disuse (Bjork & Bjork, 1992) distinguishing between storage strength (permanent) and retrieval strength (temporary accessibility)
- Implements optimal spacing intervals at 10-30% of desired retention interval (Cepeda et al., 2008), with 35-50% improvement over massed practice
- Memory consolidation occurs in waves requiring 24-48 hour intervals for synaptic consolidation (Dudai et al., 2015)
- Validates Ebbinghaus forgetting curve showing 70% information loss within 24 hours without review (Murre & Dros, 2015)

#### Retrieval Practice Effects
- Meta-analysis of 217 effect sizes shows practice testing produces g=0.50 effect size across 67,234 participants (Adesope et al., 2017)
- Closed-book testing (d=0.80) outperforms open-book (d=0.51) but both beat passive review (Agarwal et al., 2008)
- Critical finding: Testing is learning, not just assessment - produces 50% better retention than restudying (Karpicke & Roediger, 2008)
- Multiple-choice practice yields stronger effects than short-answer, benefits persist across retention intervals

#### Adaptive Learning Optimization
- Fuzzy logic difficulty adjustment improves outcomes by 23% while maintaining flow state (Chrysafiadi et al., 2023)
- Adaptive spacing outperforms fixed spacing by 15-20% with better transfer to novel problems (Mettler et al., 2020)
- ACT-R cognitive models predict optimal schedules with 35% retention improvement (Pavlik & Anderson, 2008)
- Target 70-80% success rate for optimal challenge level without frustration

#### Social-Interactive Learning
- Conversational assessment increases test-taking effort by 35% while reducing anxiety (Yildirim-Erbasli & Bulut, 2023)
- High-competency pedagogical agents best for informational support, peer-like agents for motivation (Kim & Baylor, 2006)
- Agent presence increases time-on-task by 40%, critical for struggling learners
- Multimedia principles: Remove extraneous content (d=0.86), highlight essentials (d=0.48), segment content (d=0.61) (Mayer & Fiorella, 2021)

### Implementation Evidence

Comprehensive research validates AF's core components:

| Component | Research Finding | Effect Size | Source |
|-----------|-----------------|-------------|---------|
| Retrieval Practice | Improves retention vs. restudying | g = 0.50-0.80 | Adesope et al., 2017 |
| Spaced Repetition | Optimal intervals improve retention | 35-50% improvement | Cepeda et al., 2008 |
| Adaptive Spacing | Outperforms fixed schedules | 15-20% improvement | Mettler et al., 2020 |
| Dynamic Difficulty | Maintains flow state | 23% improvement | Chrysafiadi et al., 2023 |
| Conversational AI | Increases engagement | 35% effort increase | Yildirim-Erbasli & Bulut, 2023 |
| Early Intervention | Improves retention rates | 10-15% improvement | Gardner Institute, 2023 |
| Gamified Learning | Accelerates real-world outcomes | 25% faster goal achievement | Kerfoot et al., 2014 |
| Pedagogical Agents | Increases time-on-task | 40% increase | Kim & Baylor, 2006 |

### Optimal Parameters from Research

- **Testing Frequency:** 2-3 times per week for optimal retention
- **Initial Spacing:** 1-2 days for first review, exponentially increasing
- **Spacing Formula:** Gap = 10-30% of desired retention interval
- **Success Rate Target:** 70-80% for maintaining optimal challenge
- **Session Length:** 20-30 minutes maximum for sustained attention
- **Review Threshold:** Trigger review when confidence drops below 85%
- **Feedback Timing:** Immediate for facts, delayed for conceptual understanding

## Market Analysis & Competitive Positioning

### Educational Technology Landscape Gaps

#### Traditional LMS Limitations (Canvas, Blackboard)
- Focus on content delivery without adaptive learning capabilities
- Lack integrated spaced repetition and retention tools
- No cross-course intelligence or prerequisite tracking
- Missing real-time struggle detection and intervention

#### Spaced Repetition Platform Shortcomings (Anki, Quizlet)
- Require manual content creation by students
- Limited to simple fact memorization without conceptual understanding
- No integration with institutional learning systems
- Lack instructor visibility and curriculum alignment

#### AI Tutoring Platform Constraints (Carnegie Learning, Third Space Learning)
- Subject-specific implementations without cross-disciplinary support
- High costs ($50-200 per student) limiting accessibility
- Require significant instructor training and onboarding
- Separate platforms creating workflow disruption

### Atomic Focus Competitive Advantages

1. **AI-Powered Adaptation**: Real-time adjustments based on individual cognitive profiles
2. **Evidence-Based Design**: Grounded in validated cognitive science research
3. **Seamless Integration**: Native LTI 1.3 integration requiring no workflow changes
4. **Cost-Effective**: $3-7 per student annually vs. $50-200 for competitors
5. **Cross-Course Intelligence**: Unique capability to track learning across entire academic journey
6. **Privacy-First Architecture**: Student-controlled data with FERPA/COPPA compliance
7. **Zero Training Required**: Intuitive interface for both students and faculty

## Commercialization Strategy

### Pricing Model

#### Institutional Licensing
- Annual costs: $10,000-$50,000 based on enrollment size
- Per-student cost: $3-7 annually (dramatically lower than competitors)
- Volume discounts for multi-year commitments
- Pilot pricing for early adopters

#### Implementation Requirements
- Minimal resources leveraging existing LMS infrastructure via LTI
- Faculty training: Self-paced, completed in 2-3 hours
- No additional hardware or software requirements
- IT involvement limited to initial LTI configuration

### Go-to-Market Phases

#### Year 1: Market Entry
- Focus on higher education gateway courses (high failure rate STEM)
- Pilot partnerships confirmed:
  - Utah State University (Center for Instructional Design and Innovation)
  - Utah Valley University
  - Harvard Medical School (Program in Medical Education)
  - Persown Connect, Inc.
- Leverage Atomic Jolt's existing user base (3+ million users across products)
- Target 10-15 institutional pilots for validation

#### Years 2-3: Expansion
- Adapt for K-12 market (simplified interface, parent portals)
- Adult basic education and workforce training
- International markets with localization
- Corporate training partnerships

#### Revenue Streams
- Primary: Institutional licenses (SaaS model)
- Secondary: Individual premium subscriptions
- Tertiary: Certification programs and professional development
- Future: Data insights and research partnerships (anonymized, with consent)

### Strategic Partnerships

- **LMS Vendors**: Existing relationships with Instructure (Canvas), Brightspace, Blackboard
- **Academic Institutions**: Letters of support from key stakeholders
- **Research Partners**: Collaboration opportunities for efficacy studies
- **AI Providers**: Integration potential with OpenAI, Anthropic, Google

## Universal Design & Accessibility

### Compliance Standards
- **ADA Title II**: Full compliance for public institutions
- **WCAG 2.1 AA**: Exceeds minimum accessibility requirements
- **Section 508**: Federal accessibility standards
- **FERPA/COPPA**: Student privacy protection

### Accessibility Features
- Screen reader compatibility with semantic HTML and ARIA labels
- High-contrast modes and customizable color schemes
- Multilingual interfaces supporting 10+ languages at launch
- Full keyboard navigation without mouse dependency
- Closed captions and transcripts for all media content
- Adjustable timing for auto-advancing content
- Clear focus indicators and skip navigation links
- Compatible with assistive technologies (JAWS, NVDA, Dragon)

### Inclusive Design Principles
- Cognitive accessibility with clear, simple language options
- Multiple representation modes (visual, auditory, textual)
- Customizable intervention thresholds for diverse learners
- Non-stigmatizing support that adapts to baseline abilities
- Parent/caregiver access portals where appropriate

## Epic List

**Epic 1: Multi-Tenant Foundation + AI Guide Chat MVP**
Establish multi-tenant infrastructure with D1 database provisioning, extend existing LTI 1.3 integration, and deliver immediate value through AI Guide chat interface MVP. This includes floating action button, basic chat UI, Canvas content extraction, and context-aware Q&A capabilities. This ensures both technical foundation and core user-facing value from Day 1.

**Epic 2: Enhanced Chat Intelligence + Student Dashboard**
Expand chat capabilities with conversation memory, personalized explanations based on learning style, proactive help suggestions, and rich media responses. Add basic student learning dashboard showing chat history, saved explanations, and personal insights. This creates sticky user engagement.

**Epic 3: Learner DNA Core + Privacy Controls**
Build the cognitive profiling system that captures memory patterns, learning velocity, and engagement DNA with comprehensive privacy controls, data management interfaces, and student consent workflows. This establishes trust while building core algorithms.

**Epic 4: Struggle Detection + Proactive Chat Interventions**
Implement Canvas postMessage monitoring, real-time struggle pattern detection via Durable Objects, and proactive chat interventions. Chat bot initiates conversations when struggle is detected. This proves the core concept with measurable learning improvements.

**Epic 5: Cross-Course Intelligence**
Create knowledge dependency mapping, prerequisite gap analysis, and performance prediction algorithms using Cloudflare AI models. Chat interface leverages this to provide predictive help. This delivers the unique differentiation that no competitor offers.

**Epic 6: Faculty Tools + Chat Analytics**
Build faculty dashboard showing aggregate chat interactions, common confusion points, and learning bottlenecks. Enable faculty to customize chat responses and add course-specific explanations. This creates faculty buy-in and improves content.

**Epic 7: MCP/AI Enhancement**
Implement Model Context Protocol endpoints, enable Learner DNA delivery to AI clients (Claude, ChatGPT), and create portable profile management. This expands the platform beyond institutional boundaries.

**Epic 8: Advanced Analytics & Optimization**
Build sophisticated analytics for academic success coaches, advanced chat effectiveness metrics, A/B testing framework for response strategies, and algorithm optimization based on real usage data. This refines and optimizes based on lessons learned.
