# Data Models and Schema Changes

**New Data Models:**

## Learner Profile Model

**Purpose:** Core cognitive profile storing individual learner's DNA
**Integration:** Links to LTI user via sub claim from JWT

**Key Attributes:**

- `id`: UUID - Unique identifier
- `tenant_id`: UUID - Institution identifier (D1 partitioning key)
- `lti_user_id`: String - Maps to LTI sub claim
- `cognitive_profile`: JSON - Memory patterns, learning velocity
- `privacy_settings`: JSON - Consent flags, data sharing preferences
- `created_at`: Timestamp - Profile creation
- `updated_at`: Timestamp - Last modification

**Relationships:**

- **With Existing:** References LTI platform via tenant_id in KV
- **With New:** One-to-many with LearningSession, StruggleEvent

## Learning Session Model

**Purpose:** Track individual study sessions and engagement patterns
**Integration:** Created on each LTI launch, tracks Canvas interactions

**Key Attributes:**

- `id`: UUID - Session identifier
- `learner_id`: UUID - Foreign key to LearnerProfile
- `course_context`: String - LTI context_id
- `session_start`: Timestamp - Launch time
- `behavioral_signals`: JSON - Hover times, scroll patterns
- `interventions_delivered`: Array - Help shown during session

**Relationships:**

- **With Existing:** Maps to LTI launch via state parameter
- **With New:** One-to-many with StruggleEvent, InterventionLog

## Knowledge Graph Model

**Purpose:** Map prerequisite relationships between concepts across courses
**Integration:** Built from course content analysis, powers predictions with 70-80% accuracy

**Key Attributes:**

- `concept_id`: UUID - Unique concept identifier
- `tenant_id`: UUID - Institution scope
- `concept_name`: String - Human-readable name
- `dependencies`: Array<UUID> - Prerequisite concepts
- `course_contexts`: Array - LTI contexts using concept

**Schema Integration Strategy:**
**Database Changes Required:**

- **New D1 Databases:** One per tenant (institution)
- **New Tables:** learner_profiles, learning_sessions, struggle_events, knowledge_graph, intervention_logs
- **New Indexes:** tenant_id + lti_user_id (compound), session timestamps, concept relationships
- **Migration Strategy:** Greenfield D1 creation; no existing data to migrate

**Backward Compatibility:**

- KV namespaces unchanged for LTI platform data
- D1 queries isolated to new API endpoints only
- Graceful fallback if D1 unavailable (basic LTI still works)
