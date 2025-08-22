# 4. Technical Constraints and Integration Requirements

## Existing Technology Stack

**Languages**: TypeScript/JavaScript (existing), maintaining current patterns
**Frameworks**:

- Backend: Cloudflare Workers with Hono framework (existing)
- Frontend: Vite bundling with planned React migration (architecture v1.2)
- LTI: @atomicjolt/lti-endpoints package (existing)
  **Database**:
- Cloudflare KV namespaces (existing for LTI data)
- Cloudflare D1 (planned addition for relational data)
- Durable Objects (existing for session state)
  **Infrastructure**: Cloudflare Workers edge deployment with custom domain routing
  **External Dependencies**:
- Canvas LMS APIs (existing integration)
- AI service provider (OpenAI/Anthropic - new addition)
- @atomicjolt/lti-\* packages (existing)

## Integration Approach

**Database Integration Strategy**:

- Maintain KV namespaces for existing LTI configuration (platforms, keys, tokens)
- Add D1 database for new relational data (conversations, assessments, progress)
- Use Durable Objects for real-time conversation state management
- Implement migration utilities for any KV→D1 transitions if needed

**API Integration Strategy**:

- Extend existing Hono routes with new `/api/assessment/*` endpoints
- Reuse current LTI middleware for authentication
- Add new Canvas postMessage handlers in client code
- Implement WebSocket or Server-Sent Events for real-time chat via Durable Objects

**Frontend Integration Strategy**:

- Follow React migration path for new assessment components
- Maintain vanilla JS for existing stable components during transition
- Use existing Vite build pipeline with manifest injection
- Implement lazy loading for assessment UI to minimize initial bundle size

**Testing Integration Strategy**:

- Extend existing Vitest test suite for new features
- Add integration tests for Canvas deep linking flows
- Implement mock AI service for deterministic testing
- Maintain existing test coverage standards

## Code Organization and Standards

**File Structure Approach**:

- `/src/assessment/` - New module for assessment backend logic
- `/src/services/ai/` - AI service integration layer
- `/client/components/assessment/` - React components for assessment UI
- `/src/db/d1/` - D1 schema and migration files
- Maintain existing structure for LTI core functionality

**Naming Conventions**:

- Follow existing camelCase for variables/functions
- PascalCase for React components and classes
- kebab-case for file names
- Prefix assessment-specific routes with `/api/assessment/`

**Coding Standards**:

- Maintain TypeScript strict mode
- Follow existing ESLint configuration
- Use existing Prettier formatting rules
- Apply current error handling patterns with Result types

**Documentation Standards**:

- Update CLAUDE.md with new assessment commands
- Add assessment-specific documentation to `/docs/`
- Maintain JSDoc comments for public APIs
- Include inline comments for complex algorithms

## Deployment and Operations

**Build Process Integration**:

- Extend existing `npm run build` to include D1 migrations
- Add assessment-specific environment variables to wrangler.jsonc
- Include AI service API keys in secrets management
- Maintain current manifest injection for cache busting

**Deployment Strategy**:

- Use existing Cloudflare Workers deployment pipeline
- Add D1 database creation to deployment scripts
- Implement feature flags for gradual rollout
- Maintain zero-downtime deployment approach

**Monitoring and Logging**:

- Extend existing tail logs with assessment events
- Add metrics for AI response times and costs
- Monitor D1 query performance
- Track conversation completion rates

**Configuration Management**:

- Add assessment configuration to existing config.ts
- Store AI prompts in configurable templates
- Maintain environment-specific settings in wrangler.jsonc
- Use KV for runtime configuration updates

## Risk Assessment and Mitigation

**Technical Risks**:

- **D1 scalability limits** - Mitigate with query optimization and caching strategies
- **AI API latency** - Implement streaming responses and loading states
- **Canvas API rate limits** - Add request queuing and caching layer
- **Worker CPU time limits** - Optimize AI response processing, use Durable Objects for state

**Integration Risks**:

- **Canvas postMessage compatibility** - Extensive testing across Canvas versions
- **LTI state management complexity** - Maintain clear separation between existing and new flows
- **React migration conflicts** - Incremental component migration with fallbacks

**Deployment Risks**:

- **Database migration failures** - Implement rollback procedures and data validation
- **AI service outages** - Fallback to cached responses or degraded mode
- **Breaking existing functionality** - Comprehensive regression testing suite

**Mitigation Strategies**:

- Implement comprehensive error boundaries and fallbacks
- Use feature flags for controlled rollout
- Maintain detailed audit logs for debugging
- Create runbooks for common operational issues
- Implement automated rollback triggers for critical metrics
