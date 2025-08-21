# Next Steps

## Story Manager Handoff

To begin implementation of this brownfield enhancement:

- Reference this architecture document for all technical decisions
- Key integration requirements: Preserve all LTI functionality, implement D1 with tenant isolation
- Existing system constraints: 50ms CPU limit, iframe security requirements
- First story: Set up D1 database with multi-tenant schema and migrations
- Maintain existing system integrity by feature-flagging all enhancements

## Developer Handoff

For developers starting implementation:

- This architecture extends the existing LTI starter - study current codebase first
- Follow existing TypeScript/Prettier/ESLint conventions already in place
- Integration requirements: All new APIs under /api/v1, preserve existing routes
- Key technical decisions: Redux Toolkit for state, CSS modules with variables, MCP via OAuth
- Implementation sequence: 1) D1 setup, 2) Basic API routes, 3) React components, 4) MCP integration
- Verify LTI launches still work after each major change

## Commercialization & Market Strategy

### Pricing Architecture

- **Institutional Licensing:** $10,000-$50,000 annually based on enrollment
- **Per-Student Cost:** $3-7 annually (dramatically lower than $50-200 competitors)
- **Pilot Pricing:** Special rates for early adopters and research partners
- **Multi-Year Discounts:** Volume pricing for 3-5 year commitments

### Confirmed Pilot Partnerships

The architecture must support these confirmed pilot institutions:

- **Utah State University** - Center for Instructional Design and Innovation
- **Utah Valley University** - STEM gateway courses
- **Harvard Medical School** - Program in Medical Education
- **Persown Connect, Inc.** - Workforce training integration

### Competitive Advantages Enabled by Architecture

1. **Native LTI Integration:** Zero workflow disruption via existing foundation
2. **Edge Computing:** Global <100ms response times via Cloudflare Workers
3. **Cross-Course Intelligence:** Unique D1 multi-tenant design enables journey tracking
4. **Cost Efficiency:** Serverless architecture enables $3-7 per student pricing
5. **Privacy-First:** Student-controlled data with FERPA/GDPR compliance built-in
6. **Zero Training:** Intuitive interfaces leveraging Canvas familiarity

## UI/UX Implementation Guidelines

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

## Recommended Implementation Epics

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
