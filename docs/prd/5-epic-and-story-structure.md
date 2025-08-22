# 5. Epic and Story Structure

## Epic Approach

**Epic Structure Decision**: Single comprehensive epic for deep linking assessment features

**Rationale**: Based on the project brief and existing architecture, this enhancement represents a cohesive feature set that should be delivered as one epic. The deep linking, chat interface, assessment generation, and grade passback are tightly integrated components that depend on each other for value delivery. Breaking into multiple epics would create incomplete user experiences and complicate testing.

## Epic 1: Canvas Deep Linking Assessment Integration

**Epic Goal**: Enable instructors to embed AI-powered conversational assessment checkpoints into Canvas assignments through deep linking, providing real-time comprehension feedback to students and learning insights to instructors

**Integration Requirements**:

- Preserve all existing LTI 1.3 authentication and launch flows
- Extend current Cloudflare Workers architecture without breaking changes
- Maintain backward compatibility with existing Atomic Guide content delivery
- Integrate with planned React migration and D1 database adoption

## Story 1.1: D1 Database Setup and Migration Foundation

As a **developer**,
I want **to establish the D1 database schema and migration infrastructure**,
so that **we have a reliable foundation for storing conversation and assessment data**.

**Acceptance Criteria:**

1. D1 database created in Cloudflare with appropriate bindings in wrangler.jsonc
2. Schema includes tables for: conversations, assessment_configs, student_progress, generated_content
3. Migration scripts created and tested for initial schema
4. Database connection utilities added to extend existing KV usage patterns
5. Basic CRUD operations tested with sample data

**Integration Verification:**

- IV1: Existing KV namespace operations continue functioning unchanged
- IV2: Worker deployment succeeds with D1 bindings added
- IV3: No performance impact on existing LTI launch flows

## Story 1.2: Canvas postMessage API Integration Layer

As a **developer**,
I want **to implement Canvas postMessage handlers for content extraction**,
so that **the AI can understand page context for assessment generation**.

**Acceptance Criteria:**

1. Client-side postMessage listener implemented following Canvas documentation
2. Content extraction handles text, images, and embedded media appropriately
3. Extracted content sanitized and structured for AI consumption
4. Rate limiting implemented to respect Canvas API constraints
5. Error handling for various Canvas page structures

**Integration Verification:**

- IV1: Existing client application continues loading without errors
- IV2: No interference with current LTI message handling
- IV3: Performance remains within acceptable limits (<100ms added latency)

## Story 1.3: AI Service Integration and Prompt Engineering

As a **developer**,
I want **to integrate OpenAI/Anthropic API for assessment generation**,
so that **we can create contextual questions and conversations**.

**Acceptance Criteria:**

1. AI service client implemented with configurable provider support
2. Prompt templates created for different assessment types
3. Response streaming implemented for real-time chat experience
4. Token usage tracking and cost management utilities
5. Fallback handling for API failures or rate limits

**Integration Verification:**

- IV1: AI integration isolated from core LTI functionality
- IV2: Worker CPU time remains within 10ms limit using streaming
- IV3: Existing features unaffected by AI service availability

## Story 1.4: Deep Linking Configuration Interface

As an **instructor**,
I want **to configure and embed assessment checkpoints via deep linking**,
so that **I can strategically place formative assessments in my assignments**.

**Acceptance Criteria:**

1. Deep linking 2.0 endpoint implemented at `/lti/deep_link`
2. Configuration modal UI built with React components
3. Settings include: assessment type, mastery threshold, grading schema
4. Preview functionality shows assessment appearance
5. Configuration saved to D1 with proper associations

**Integration Verification:**

- IV1: Standard LTI launches continue working without deep linking
- IV2: Deep link response properly formatted for Canvas
- IV3: UI components follow existing design system

## Story 1.5: Student Chat Assessment Experience

As a **student**,
I want **to engage with AI assessments embedded in my assignments**,
so that **I can verify understanding and get immediate help**.

**Acceptance Criteria:**

1. Chat interface renders at configured checkpoints
2. Conversation maintains context about current page content
3. Responses include remediation with page references
4. Progress tracked toward mastery threshold
5. Help/hint options available without penalty

**Integration Verification:**

- IV1: Assessment UI doesn't interfere with content reading
- IV2: Chat state properly maintained across page navigation
- IV3: Mobile responsive design works in Canvas app

## Story 1.6: Assessment Approval Workflow

As an **instructor**,
I want **to review and approve AI-generated assessment content**,
so that **I maintain pedagogical control over student experiences**.

**Acceptance Criteria:**

1. Approval queue interface shows pending AI content
2. Edit capabilities for questions and responses
3. Bulk approval actions for efficiency
4. Template library for saving successful assessments
5. Version tracking for modified content

**Integration Verification:**

- IV1: Approval workflow optional (can use auto-approve)
- IV2: Changes properly propagate to student views
- IV3: Existing instructor features remain accessible

## Story 1.7: Grade Passback Integration

As an **instructor**,
I want **assessment results automatically recorded in Canvas gradebook**,
so that **I don't need manual grade entry**.

**Acceptance Criteria:**

1. LTI Assignment and Grade Service (AGS) integration implemented
2. Mastery-based scores converted to selected grading schema
3. Grade passback triggered on assessment completion
4. Partial credit handled for incomplete attempts
5. Grade sync status visible to instructors

**Integration Verification:**

- IV1: Grade passback doesn't affect existing assignment scores
- IV2: Proper OAuth2 token handling for AGS calls
- IV3: Graceful degradation if gradebook unavailable

## Story 1.8: Real-time Analytics Dashboard

As an **instructor**,
I want **to monitor student progress and identify struggling learners**,
so that **I can provide timely interventions**.

**Acceptance Criteria:**

1. Dashboard shows real-time progress across assessments
2. Common misconception patterns identified and highlighted
3. Individual student drill-down with conversation history
4. Export capabilities for further analysis
5. Privacy controls respect FERPA requirements

**Integration Verification:**

- IV1: Dashboard performance doesn't impact assessment operations
- IV2: Analytics data properly aggregated from D1
- IV3: Existing reporting features continue functioning

## Story 1.9: Performance Optimization and Load Testing

As a **developer**,
I want **to optimize and load test the complete assessment system**,
so that **we can handle production scale reliably**.

**Acceptance Criteria:**

1. Load tests simulate 500+ concurrent conversations
2. Response times consistently under 3 seconds
3. D1 query optimization reduces database load
4. Caching strategies implemented for common queries
5. Monitoring alerts configured for performance issues

**Integration Verification:**

- IV1: System maintains 99.5% uptime under load
- IV2: No degradation of existing feature performance
- IV3: Graceful degradation under extreme load

---

_This PRD provides comprehensive guidance for implementing deep linking assessment features within the existing Atomic Guide LTI 1.3 tool. The enhancement builds on documented architecture plans while maintaining backward compatibility and system integrity throughout the development process._
