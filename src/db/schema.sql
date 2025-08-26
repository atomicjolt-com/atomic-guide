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

-- ============================================
-- STORY 2.1: CONVERSATION MEMORY & PERSONALIZED LEARNING
-- ============================================

-- Conversation summaries for quick history access
CREATE TABLE IF NOT EXISTS conversation_summaries (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    learner_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    summary TEXT NOT NULL,
    topics JSON DEFAULT '[]', -- Array of detected topics
    message_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES chat_conversations(conversation_id) ON DELETE CASCADE
);

CREATE INDEX idx_summaries_learner ON conversation_summaries(tenant_id, learner_id);
CREATE INDEX idx_summaries_conversation ON conversation_summaries(conversation_id);
CREATE INDEX idx_summaries_updated ON conversation_summaries(updated_at DESC);

-- Learning styles preferences
CREATE TABLE IF NOT EXISTS learning_styles (
    id TEXT PRIMARY KEY,
    learner_id TEXT NOT NULL UNIQUE,
    style_type TEXT NOT NULL, -- 'visual', 'auditory', 'kinesthetic', 'reading_writing'
    confidence_score REAL DEFAULT 0.5,
    detected_patterns JSON DEFAULT '{}', -- Pattern analysis data
    manual_override BOOLEAN DEFAULT FALSE, -- If learner manually set preference
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_learning_style_learner ON learning_styles(learner_id);

-- Privacy settings per learner
CREATE TABLE IF NOT EXISTS privacy_settings (
    id TEXT PRIMARY KEY,
    learner_id TEXT NOT NULL UNIQUE,
    conversation_retention BOOLEAN DEFAULT TRUE,
    data_sharing BOOLEAN DEFAULT FALSE,
    analytics_tracking BOOLEAN DEFAULT TRUE,
    personalized_learning BOOLEAN DEFAULT TRUE,
    deletion_requested_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_privacy_settings_learner ON privacy_settings(learner_id);

-- Update chat_messages table to include learner_id for better isolation
ALTER TABLE chat_messages ADD COLUMN learner_id TEXT;
CREATE INDEX idx_chat_messages_learner ON chat_messages(tenant_id, learner_id);

-- ============================================
-- STORY 2.2: RICH MEDIA CHAT RESPONSES AND KNOWLEDGE BASE
-- ============================================

-- Enhanced FAQ knowledge base with rich media support
ALTER TABLE faq_entries ADD COLUMN module_id TEXT;
ALTER TABLE faq_entries ADD COLUMN question_hash TEXT;
ALTER TABLE faq_entries ADD COLUMN rich_media_content JSON DEFAULT '{}';
ALTER TABLE faq_entries ADD COLUMN effectiveness_score REAL DEFAULT 0.5;

-- Create new indexes for enhanced FAQ functionality
CREATE INDEX idx_faq_course_hash ON faq_entries(tenant_id, course_id, question_hash);
CREATE INDEX idx_faq_search ON faq_entries(tenant_id, course_id);
CREATE INDEX idx_faq_usage ON faq_entries(usage_count DESC);

-- Media effectiveness tracking for personalized learning
CREATE TABLE IF NOT EXISTS media_effectiveness (
    id TEXT PRIMARY KEY,
    learner_id TEXT NOT NULL,
    media_type TEXT NOT NULL, -- 'latex', 'code', 'diagram', 'video'
    content_context TEXT,
    shown_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    interaction_score REAL, -- 0-1 based on engagement
    comprehension_followup BOOLEAN, -- Did they ask follow-up questions?
    engagement_time_seconds INTEGER DEFAULT 0,
    copy_clipboard_count INTEGER DEFAULT 0,
    fullscreen_activated BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (learner_id) REFERENCES learner_profiles(id)
);

CREATE INDEX idx_media_effectiveness_learner ON media_effectiveness(learner_id, media_type);
CREATE INDEX idx_media_effectiveness_context ON media_effectiveness(content_context, shown_at);

-- Add media preferences to learner_profiles
ALTER TABLE learner_profiles ADD COLUMN media_preferences JSON DEFAULT '{"prefers_visual": true, "math_notation_style": "latex", "code_highlight_theme": "light", "diagram_complexity": "detailed", "bandwidth_preference": "high"}';

-- Enhanced chat_messages for rich media content
ALTER TABLE chat_messages ADD COLUMN rich_media_content JSON DEFAULT '{}';
ALTER TABLE chat_messages ADD COLUMN from_faq_id TEXT;
ALTER TABLE chat_messages ADD COLUMN media_load_time_ms INTEGER DEFAULT 0;

-- FAQ usage analytics for auto-generation
CREATE TABLE IF NOT EXISTS faq_usage_analytics (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    question_pattern TEXT NOT NULL, -- Normalized question pattern
    occurrence_count INTEGER DEFAULT 1,
    last_asked TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    generated_faq_id TEXT, -- Reference to auto-generated FAQ
    manual_review_needed BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (generated_faq_id) REFERENCES faq_entries(id) ON DELETE SET NULL
);

CREATE INDEX idx_faq_usage_pattern ON faq_usage_analytics(tenant_id, course_id, question_pattern);
CREATE INDEX idx_faq_usage_count ON faq_usage_analytics(occurrence_count DESC);

-- Instructor FAQ management tracking
CREATE TABLE IF NOT EXISTS faq_management_log (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    instructor_id TEXT NOT NULL,
    faq_id TEXT NOT NULL,
    action TEXT NOT NULL, -- 'created', 'updated', 'deleted', 'approved', 'rejected'
    changes_made JSON DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (faq_id) REFERENCES faq_entries(id) ON DELETE CASCADE
);

CREATE INDEX idx_faq_mgmt_instructor ON faq_management_log(tenant_id, instructor_id);
CREATE INDEX idx_faq_mgmt_faq ON faq_management_log(faq_id, created_at);

-- Rich media cache for performance optimization
CREATE TABLE IF NOT EXISTS rich_media_cache (
    id TEXT PRIMARY KEY,
    content_hash TEXT NOT NULL UNIQUE, -- SHA-256 of content
    media_type TEXT NOT NULL,
    content_data TEXT NOT NULL, -- Rendered/processed content
    original_content TEXT NOT NULL,
    cache_metadata JSON DEFAULT '{}',
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP -- Optional expiration
);

CREATE INDEX idx_rich_media_cache_hash ON rich_media_cache(content_hash);
CREATE INDEX idx_rich_media_cache_type ON rich_media_cache(media_type, last_accessed);
CREATE INDEX idx_rich_media_cache_expires ON rich_media_cache(expires_at);

-- ============================================
-- STORY 2.3: PROACTIVE HELP SUGGESTIONS AND LEARNING PATTERN RECOGNITION
-- ============================================

-- Suggestion tracking and analytics
CREATE TABLE IF NOT EXISTS suggestion_logs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    learner_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    suggestion_type TEXT NOT NULL, -- 'confusion', 'frustration', 'repetition', 'success_opportunity'
    suggestion_content JSON NOT NULL, -- Full suggestion data including actions
    triggered_by_pattern TEXT NOT NULL, -- Pattern that triggered suggestion
    confidence_score REAL NOT NULL, -- 0-1 confidence in suggestion relevance
    shown_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_action TEXT, -- 'accepted', 'dismissed', 'ignored', 'timeout'
    user_feedback TEXT, -- 'helpful', 'not_helpful', 'too_frequent', 'wrong_timing'
    effectiveness_score REAL, -- Calculated effectiveness metric based on outcome
    response_time_ms INTEGER, -- Time from trigger to display
    context_data JSON DEFAULT '{}', -- Page context and LMS data
    FOREIGN KEY (learner_id) REFERENCES learner_profiles(id)
);

CREATE INDEX idx_suggestion_logs_learner ON suggestion_logs(tenant_id, learner_id);
CREATE INDEX idx_suggestion_logs_pattern ON suggestion_logs(suggestion_type, triggered_by_pattern);
CREATE INDEX idx_suggestion_logs_effectiveness ON suggestion_logs(effectiveness_score DESC);
CREATE INDEX idx_suggestion_logs_conversation ON suggestion_logs(conversation_id);

-- Learning pattern analysis and trend tracking
CREATE TABLE IF NOT EXISTS learning_pattern_analysis (
    id TEXT PRIMARY KEY,
    learner_id TEXT NOT NULL,
    pattern_type TEXT NOT NULL, -- 'confusion_trend', 'success_rate', 'topic_mastery', 'engagement_decline'
    pattern_data JSON NOT NULL, -- Detailed pattern analysis including confidence intervals
    confidence_level REAL NOT NULL,
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    conversations_analyzed INTEGER NOT NULL,
    pattern_strength REAL NOT NULL, -- 0-1 strength of detected pattern
    trend_direction TEXT, -- 'improving', 'declining', 'stable'
    intervention_recommended BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (learner_id) REFERENCES learner_profiles(id)
);

CREATE INDEX idx_pattern_analysis_learner ON learning_pattern_analysis(learner_id, pattern_type);
CREATE INDEX idx_pattern_analysis_strength ON learning_pattern_analysis(pattern_strength DESC);
CREATE INDEX idx_pattern_analysis_intervention ON learning_pattern_analysis(intervention_recommended, analyzed_at);

-- Suggestion feedback and improvement tracking
CREATE TABLE IF NOT EXISTS suggestion_feedback (
    id TEXT PRIMARY KEY,
    suggestion_log_id TEXT NOT NULL,
    feedback_type TEXT NOT NULL, -- 'helpful', 'not_helpful', 'too_frequent', 'wrong_timing', 'irrelevant'
    feedback_details TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    follow_up_behavior TEXT, -- What the learner did after the suggestion
    learning_outcome_improved BOOLEAN,
    FOREIGN KEY (suggestion_log_id) REFERENCES suggestion_logs(id) ON DELETE CASCADE
);

CREATE INDEX idx_suggestion_feedback_log ON suggestion_feedback(suggestion_log_id);
CREATE INDEX idx_suggestion_feedback_type ON suggestion_feedback(feedback_type, submitted_at);

-- Enhanced learner profiles with suggestion preferences
ALTER TABLE learner_profiles ADD COLUMN suggestion_preferences JSON DEFAULT '{
    "frequency": "medium",
    "pattern_tracking_enabled": true,
    "preferred_suggestion_types": ["confusion", "frustration", "success_opportunity"],
    "interruption_threshold": 0.7,
    "escalation_consent": false,
    "cooldown_minutes": 2
}';

ALTER TABLE learner_profiles ADD COLUMN learning_patterns JSON DEFAULT '{
    "confusion_tendency": 0.5,
    "frustration_tolerance": 0.7,
    "help_seeking_behavior": "reactive",
    "optimal_intervention_timing": 30,
    "pattern_confidence": 0
}';

-- Suggestion queue management for preventing spam
CREATE TABLE IF NOT EXISTS suggestion_queue (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    learner_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    suggestion_data JSON NOT NULL,
    priority_score REAL NOT NULL,
    scheduled_for TIMESTAMP NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'shown', 'dismissed', 'expired'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    FOREIGN KEY (learner_id) REFERENCES learner_profiles(id)
);

CREATE INDEX idx_suggestion_queue_learner ON suggestion_queue(tenant_id, learner_id, status);
CREATE INDEX idx_suggestion_queue_scheduled ON suggestion_queue(scheduled_for, status);
CREATE INDEX idx_suggestion_queue_priority ON suggestion_queue(priority_score DESC, scheduled_for);

-- Academic support escalation tracking
CREATE TABLE IF NOT EXISTS academic_support_escalations (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    learner_id TEXT NOT NULL,
    pattern_analysis_id TEXT,
    escalation_type TEXT NOT NULL, -- 'severe_struggle', 'repeated_failure', 'extended_confusion'
    severity_score REAL NOT NULL, -- 0-1 severity assessment
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    instructor_notified_at TIMESTAMP,
    instructor_response TEXT,
    resolution_status TEXT DEFAULT 'open', -- 'open', 'addressed', 'no_action_needed', 'closed'
    resolution_notes TEXT,
    student_consent_given BOOLEAN DEFAULT FALSE,
    privacy_level TEXT DEFAULT 'anonymized', -- 'full_detail', 'summary_only', 'anonymized'
    FOREIGN KEY (learner_id) REFERENCES learner_profiles(id),
    FOREIGN KEY (pattern_analysis_id) REFERENCES learning_pattern_analysis(id)
);

CREATE INDEX idx_escalations_learner ON academic_support_escalations(tenant_id, learner_id);
CREATE INDEX idx_escalations_instructor ON academic_support_escalations(tenant_id, instructor_notified_at);
CREATE INDEX idx_escalations_severity ON academic_support_escalations(severity_score DESC, triggered_at);
CREATE INDEX idx_escalations_status ON academic_support_escalations(resolution_status, triggered_at);