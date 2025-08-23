-- Atomic Guide D1 Database Schema
-- Multi-tenant cognitive learning platform
-- Each institution gets its own D1 database instance for complete data isolation

-- ============================================
-- CORE TENANT AND USER MANAGEMENT
-- ============================================

-- Multi-tenant support table (required by Story 1.1)
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY, -- UUID for tenant
    iss TEXT NOT NULL, -- Platform issuer URL from LTI
    client_id TEXT NOT NULL, -- OAuth client ID for this tenant
    deployment_ids JSON DEFAULT '[]', -- LTI deployment identifiers array
    institution_name TEXT NOT NULL,
    lms_type TEXT NOT NULL, -- 'canvas', 'blackboard', 'moodle', 'brightspace'
    lms_url TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    settings JSON DEFAULT '{}', -- Institution-specific settings
    features JSON DEFAULT '{"chat": true, "cognitive_profiling": true, "struggle_detection": true}',
    UNIQUE(iss, client_id)
);

CREATE INDEX idx_tenants_iss_client ON tenants(iss, client_id);

-- Learner profiles with cognitive DNA
CREATE TABLE IF NOT EXISTS learner_profiles (
    id TEXT PRIMARY KEY, -- UUID for learner profile
    tenant_id TEXT NOT NULL, -- Foreign key to tenants.id
    lti_user_id TEXT NOT NULL, -- From LTI launch
    lti_deployment_id TEXT NOT NULL,
    email TEXT,
    name TEXT,

    -- Cognitive DNA attributes
    forgetting_curve_s REAL DEFAULT 1.0, -- Ebbinghaus S parameter (memory strength)
    learning_velocity REAL DEFAULT 1.0, -- Speed to reach 85% mastery (normalized)
    optimal_difficulty REAL DEFAULT 0.7, -- Target success rate (0.7-0.8 optimal)
    preferred_modality TEXT DEFAULT 'mixed', -- 'visual', 'auditory', 'kinesthetic', 'reading', 'mixed'

    -- Engagement patterns
    peak_performance_time TEXT, -- 'morning', 'afternoon', 'evening', 'night'
    avg_session_duration INTEGER DEFAULT 0, -- Minutes
    total_sessions INTEGER DEFAULT 0,
    last_active_at DATETIME,

    -- Privacy controls
    data_sharing_consent BOOLEAN DEFAULT FALSE,
    ai_interaction_consent BOOLEAN DEFAULT TRUE,
    anonymous_analytics BOOLEAN DEFAULT TRUE,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    UNIQUE(tenant_id, lti_user_id)
);

CREATE INDEX idx_learner_profiles_lookup ON learner_profiles(tenant_id, lti_user_id, lti_deployment_id);
CREATE INDEX idx_learner_profiles_active ON learner_profiles(tenant_id, last_active_at);

-- ============================================
-- LEARNING SESSIONS AND ENGAGEMENT
-- ============================================

-- Track individual learning sessions
CREATE TABLE IF NOT EXISTS learning_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    learner_profile_id INTEGER NOT NULL,
    lti_context_id TEXT NOT NULL, -- Course ID from LTI
    session_id TEXT NOT NULL UNIQUE, -- UUID for session

    -- Session metadata
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    duration_seconds INTEGER DEFAULT 0,
    page_views INTEGER DEFAULT 0,
    interactions INTEGER DEFAULT 0,

    -- Context
    content_type TEXT, -- 'lecture', 'assignment', 'quiz', 'discussion', 'resource'
    content_id TEXT, -- LMS resource ID
    content_title TEXT,

    -- Cognitive metrics
    engagement_score REAL DEFAULT 0, -- 0-1 normalized
    struggle_events INTEGER DEFAULT 0,
    help_requests INTEGER DEFAULT 0,

    FOREIGN KEY (learner_profile_id) REFERENCES learner_profiles(id) ON DELETE CASCADE
);

CREATE INDEX idx_learning_sessions_learner ON learning_sessions(learner_profile_id, started_at);
CREATE INDEX idx_learning_sessions_context ON learning_sessions(tenant_id, lti_context_id);

-- ============================================
-- STRUGGLE DETECTION AND INTERVENTIONS
-- ============================================

-- Capture struggle events for pattern analysis
CREATE TABLE IF NOT EXISTS struggle_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    learner_profile_id INTEGER NOT NULL,
    session_id TEXT NOT NULL,

    -- Event details
    event_type TEXT NOT NULL, -- 'hover_confusion', 'rapid_scrolling', 'idle_timeout', 'repeated_access', 'help_seeking'
    event_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    confidence_score REAL DEFAULT 0.5, -- 0-1 confidence in struggle detection

    -- Context
    page_element TEXT, -- DOM selector or element identifier
    content_context TEXT, -- Surrounding content/topic
    duration_ms INTEGER, -- Duration of struggle signal

    -- Intervention
    intervention_triggered BOOLEAN DEFAULT FALSE,
    intervention_type TEXT, -- 'chat_prompt', 'resource_suggestion', 'instructor_alert'
    intervention_accepted BOOLEAN,

    metadata JSON DEFAULT '{}',

    FOREIGN KEY (learner_profile_id) REFERENCES learner_profiles(id) ON DELETE CASCADE
);

CREATE INDEX idx_struggle_events_session ON struggle_events(session_id);
CREATE INDEX idx_struggle_events_learner ON struggle_events(learner_profile_id, event_timestamp);

-- Track intervention effectiveness
CREATE TABLE IF NOT EXISTS intervention_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    learner_profile_id INTEGER NOT NULL,
    struggle_event_id INTEGER,

    -- Intervention details
    intervention_type TEXT NOT NULL, -- 'proactive_chat', 'resource_link', 'peer_connection', 'instructor_notification'
    triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    accepted_at DATETIME,
    dismissed_at DATETIME,

    -- Effectiveness metrics
    effectiveness_score REAL, -- -1 to 1 (negative if made worse)
    time_to_resolution_seconds INTEGER,
    follow_up_actions INTEGER DEFAULT 0,

    -- Content
    intervention_content JSON, -- Structured data about what was offered
    learner_feedback TEXT,

    FOREIGN KEY (learner_profile_id) REFERENCES learner_profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (struggle_event_id) REFERENCES struggle_events(id) ON DELETE SET NULL
);

CREATE INDEX idx_intervention_logs_learner ON intervention_logs(learner_profile_id, triggered_at);
CREATE INDEX idx_intervention_logs_effectiveness ON intervention_logs(effectiveness_score);

-- ============================================
-- AI CHAT SYSTEM
-- ============================================

-- Chat conversations
CREATE TABLE IF NOT EXISTS chat_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    learner_profile_id INTEGER NOT NULL,
    conversation_id TEXT NOT NULL UNIQUE, -- UUID

    -- Metadata
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    message_count INTEGER DEFAULT 0,

    -- Context
    lti_context_id TEXT, -- Course context
    initial_context TEXT, -- What triggered the conversation
    conversation_topic TEXT, -- Extracted main topic

    -- Status
    status TEXT DEFAULT 'active', -- 'active', 'idle', 'closed'
    satisfaction_rating INTEGER, -- 1-5 stars
    resolution_status TEXT, -- 'resolved', 'escalated', 'abandoned'

    FOREIGN KEY (learner_profile_id) REFERENCES learner_profiles(id) ON DELETE CASCADE
);

CREATE INDEX idx_chat_conversations_learner ON chat_conversations(learner_profile_id, last_message_at);
CREATE INDEX idx_chat_conversations_active ON chat_conversations(tenant_id, status);

-- Individual chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,

    -- Message details
    message_id TEXT NOT NULL UNIQUE, -- UUID
    sender_type TEXT NOT NULL, -- 'learner', 'ai', 'system'
    message_content TEXT NOT NULL,

    -- Metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    tokens_used INTEGER DEFAULT 0,
    model_used TEXT, -- 'gpt-4', 'claude-3', 'llama-2', etc.

    -- Context and enrichment
    detected_intent TEXT, -- 'question', 'confusion', 'clarification', 'practice'
    confidence_score REAL DEFAULT 0,
    page_context JSON, -- Captured DOM/page state

    -- Moderation
    flagged BOOLEAN DEFAULT FALSE,
    flag_reason TEXT,

    FOREIGN KEY (conversation_id) REFERENCES chat_conversations(conversation_id) ON DELETE CASCADE
);

CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversation_id, created_at);
CREATE INDEX idx_chat_messages_flagged ON chat_messages(tenant_id, flagged);

-- ============================================
-- KNOWLEDGE GRAPH AND DEPENDENCIES
-- ============================================

-- Knowledge concepts and relationships
CREATE TABLE IF NOT EXISTS knowledge_graph (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,

    -- Concept identification
    concept_id TEXT NOT NULL UNIQUE,
    concept_name TEXT NOT NULL,
    concept_type TEXT, -- 'topic', 'skill', 'prerequisite', 'learning_objective'

    -- Course association
    lti_context_id TEXT, -- Course this concept belongs to
    module_id TEXT, -- Module/unit within course

    -- Metadata
    difficulty_level REAL DEFAULT 0.5, -- 0-1 normalized
    importance_weight REAL DEFAULT 0.5, -- 0-1 for prerequisite chains

    -- Relationships stored as JSON for flexibility
    prerequisites JSON DEFAULT '[]', -- Array of concept_ids
    related_concepts JSON DEFAULT '[]', -- Array of concept_ids

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_knowledge_graph_concept ON knowledge_graph(tenant_id, concept_id);
CREATE INDEX idx_knowledge_graph_context ON knowledge_graph(tenant_id, lti_context_id);

-- Learner mastery of concepts
CREATE TABLE IF NOT EXISTS concept_mastery (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    learner_profile_id INTEGER NOT NULL,
    concept_id TEXT NOT NULL,

    -- Mastery metrics
    mastery_level REAL DEFAULT 0, -- 0-1 current mastery
    confidence_interval REAL DEFAULT 0.5, -- Uncertainty in mastery estimate

    -- Practice statistics
    attempts INTEGER DEFAULT 0,
    successes INTEGER DEFAULT 0,
    last_practiced_at DATETIME,

    -- Spaced repetition
    next_review_at DATETIME,
    review_interval_days INTEGER DEFAULT 1,
    ease_factor REAL DEFAULT 2.5, -- SM-2 algorithm ease

    -- Predictions
    predicted_retention REAL, -- Predicted mastery at next review
    risk_score REAL DEFAULT 0, -- Risk of forgetting (0-1)

    FOREIGN KEY (learner_profile_id) REFERENCES learner_profiles(id) ON DELETE CASCADE,
    UNIQUE(learner_profile_id, concept_id)
);

CREATE INDEX idx_concept_mastery_learner ON concept_mastery(learner_profile_id);
CREATE INDEX idx_concept_mastery_review ON concept_mastery(tenant_id, next_review_at);
CREATE INDEX idx_concept_mastery_risk ON concept_mastery(tenant_id, risk_score);

-- ============================================
-- ANALYTICS AND AGGREGATIONS
-- ============================================

-- Course-level analytics (updated periodically)
CREATE TABLE IF NOT EXISTS course_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    lti_context_id TEXT NOT NULL,

    -- Aggregate metrics
    total_learners INTEGER DEFAULT 0,
    active_learners_7d INTEGER DEFAULT 0,
    avg_engagement_score REAL DEFAULT 0,

    -- Performance metrics
    avg_mastery_level REAL DEFAULT 0,
    at_risk_learners INTEGER DEFAULT 0,
    struggle_event_rate REAL DEFAULT 0, -- Events per learner per day

    -- Chat metrics
    chat_sessions_total INTEGER DEFAULT 0,
    chat_satisfaction_avg REAL DEFAULT 0,
    chat_resolution_rate REAL DEFAULT 0,

    -- Temporal
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    period_start DATETIME,
    period_end DATETIME,

    UNIQUE(tenant_id, lti_context_id, calculated_at)
);

CREATE INDEX idx_course_analytics_context ON course_analytics(tenant_id, lti_context_id, calculated_at);

-- Instructor dashboard preferences
CREATE TABLE IF NOT EXISTS instructor_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    lti_user_id TEXT NOT NULL, -- Instructor's LTI ID

    -- Dashboard settings
    dashboard_layout JSON DEFAULT '{}',
    alert_thresholds JSON DEFAULT '{"struggle_rate": 0.3, "at_risk_mastery": 0.6}',
    notification_preferences JSON DEFAULT '{"email": true, "in_app": true}',

    -- Privacy settings for this instructor
    show_individual_data BOOLEAN DEFAULT TRUE,
    anonymize_below_threshold INTEGER DEFAULT 5, -- Anonymize groups smaller than N

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, lti_user_id)
);

-- ============================================
-- AUDIT AND COMPLIANCE
-- ============================================

-- Audit log for FERPA compliance
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,

    -- Actor
    actor_type TEXT NOT NULL, -- 'learner', 'instructor', 'admin', 'system'
    actor_id TEXT NOT NULL,

    -- Action
    action TEXT NOT NULL, -- 'view', 'export', 'delete', 'modify'
    resource_type TEXT NOT NULL, -- 'profile', 'analytics', 'chat', etc.
    resource_id TEXT,

    -- Details
    ip_address TEXT,
    user_agent TEXT,
    details JSON DEFAULT '{}',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_tenant_time ON audit_logs(tenant_id, created_at);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id, created_at);

-- ============================================
-- MIGRATIONS AND VERSIONING
-- ============================================

-- Track schema versions and migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial migration
INSERT INTO schema_migrations (version, name) VALUES (1, 'initial_schema');

-- ============================================
-- AI CHAT ENHANCEMENTS (Story 1.3)
-- ============================================

-- FAQ Knowledge Base
CREATE TABLE IF NOT EXISTS faq_entries (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    course_id TEXT,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    vector_id TEXT, -- Reference to Cloudflare Vectorize entry
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_faq_tenant_course ON faq_entries(tenant_id, course_id);
CREATE INDEX idx_faq_vector ON faq_entries(vector_id);

-- Token usage tracking
CREATE TABLE IF NOT EXISTS token_usage (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    conversation_id TEXT,
    tokens_used INTEGER NOT NULL,
    model_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_token_usage_user ON token_usage(tenant_id, user_id);
CREATE INDEX idx_token_usage_date ON token_usage(tenant_id, created_at);

-- AI Configuration per tenant
CREATE TABLE IF NOT EXISTS ai_config (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL UNIQUE,
    model_name TEXT NOT NULL DEFAULT '@cf/meta/llama-3.1-8b-instruct',
    token_limit_per_session INTEGER DEFAULT 10000,
    token_limit_per_day INTEGER DEFAULT 100000,
    rate_limit_per_minute INTEGER DEFAULT 10,
    rate_limit_burst INTEGER DEFAULT 3,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT -- admin user ID
);

CREATE INDEX idx_ai_config_tenant ON ai_config(tenant_id);