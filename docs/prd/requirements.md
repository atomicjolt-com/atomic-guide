# Requirements

## Functional Requirements

**FR1:** The system shall create individual Learner DNA profiles capturing memory architecture (individualized forgetting curves following Ebbinghaus exponential decay R = e^(-t/s)), learning velocity (time to 85% mastery), and engagement patterns (optimal challenge level at 70-80% success rate)

**FR2:** ✅ ALREADY IMPLEMENTED - The system integrates with various LMSs via LTI 1.3 using the existing atomic-lti-worker foundation

**FR3:** The system shall detect learning struggles in real-time through behavioral signals (30+ second hovers indicating confusion per Brown's decay theory, repeated scrolling showing difficulty, idle patterns suggesting cognitive overload per Mayer's coherence principle) via LMS postMessage integration APIs

**FR4:** The system shall provide an AI Guide chat interface accessible via floating action button or contextual triggers, enabling students to ask questions about current page content and receive personalized explanations based on their Learner DNA profile

**FR4.1:** The chat interface shall understand the current LMS page context (course, module, assignment) to provide relevant responses without requiring students to specify context

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

**FR13:** The AI Guide chat interface shall extract and understand LMS page content via DOM scraping and postMessage API to provide contextually relevant responses

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

## Non-Functional Requirements

**NFR1:** ✅ ALREADY ACHIEVED - Cloudflare Workers edge deployment provides <100ms response times globally

**NFR2:** ✅ ALREADY ACHIEVED - Cloudflare Workers infrastructure provides 99.9% uptime with automatic failover

**NFR3:** ✅ ALREADY ACHIEVED - Cloudflare Workers auto-scales to handle concurrent users without configuration

**NFR4:** The system shall comply with FERPA, GDPR, and accessibility standards (WCAG AA minimum)

**NFR5:** The system shall leverage existing LTI dynamic registration for zero-friction institutional onboarding

**NFR6:** The system shall encrypt all Learner DNA data at rest (KV storage) and in transit using industry-standard protocols

**NFR7:** The system shall provide measurable learning outcomes within 30 days of deployment for pilot validation

**NFR8:** The system shall optimize algorithms to work within Cloudflare Workers CPU limits (50ms max)

**NFR9:** The system shall support A/B testing frameworks for continuous algorithm improvement

**NFR10:** The system shall maintain audit logs for all data access and algorithmic decisions for compliance
