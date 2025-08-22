# 2. Requirements

## Functional Requirements

**FR1:** The system shall implement Canvas deep linking 2.0 to enable instructors to embed assessment checkpoints at strategic locations within assignments, leveraging the existing LTI 1.3 authentication (extends existing FR12)

**FR2:** The system shall extract real-time page content from Canvas via postMessage API to provide contextual awareness for AI-generated assessments (implements existing FR13)

**FR3:** The system shall provide a conversational AI chat interface that engages students in natural language discussions about reading content, with ability to reference specific page sections (extends existing FR4)

**FR4:** The system shall implement mastery-based progression requiring students to demonstrate 70-80% comprehension before advancing, aligned with cognitive load research (extends existing FR19)

**FR5:** The system shall generate dynamic assessment activities including AI-created flashcards, fill-in-the-blank exercises, and contextual discussion prompts based on current page content (extends existing FR18)

**FR6:** The system shall provide an instructor approval workflow allowing review and modification of AI-generated questions before student deployment, maintaining pedagogical control

**FR7:** The system shall integrate with Canvas Assignment and Grade Service (AGS) for automatic grade passback of assessment results to the gradebook

**FR8:** The system shall support flexible grading schemas including mastery-based (default), percentage-based, improvement tracking, and engagement scoring options

**FR9:** The system shall provide real-time instructor dashboards displaying student progress, common misconceptions, and remediation patterns across all embedded assessment points (extends existing FR10)

**FR10:** The system shall store conversation history and assessment data in Cloudflare D1 database with proper relational structure for analytics and reporting

## Non-Functional Requirements

**NFR1:** The chat interface shall maintain sub-3-second response times for AI interactions to preserve conversational flow (aligns with existing <100ms infrastructure goal)

**NFR2:** The system shall support 500+ concurrent conversations per Worker instance without performance degradation

**NFR3:** The enhancement must maintain 99.5% uptime matching current Atomic Guide reliability standards (extends existing NFR2)

**NFR4:** All student conversation data shall be encrypted at rest in D1 database and comply with FERPA requirements

**NFR5:** The system shall implement rate limiting to manage AI API costs while ensuring responsive user experience (extends existing FR14)

## Compatibility Requirements

**CR1:** All existing LTI 1.3 launch flows and authentication mechanisms must continue functioning without modification

**CR2:** Current Cloudflare KV namespace structures for platforms, keys, and tokens must remain unchanged with D1 additions being supplementary

**CR3:** The UI must maintain consistency with existing Atomic Guide design patterns and component libraries

**CR4:** New API endpoints must follow existing Hono routing patterns and middleware authentication flows
