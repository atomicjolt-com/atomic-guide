-- Migration 012: AI Chat Assessment System Tables for Story 7.3
-- Conversational Assessment Engine with Grade Passback Integration
-- Creates schema for AI-powered conversational assessments

-- Assessment sessions table for conversational assessments
CREATE TABLE IF NOT EXISTS assessment_sessions (
    id TEXT PRIMARY KEY,
    config_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN (
        'created', 'active', 'awaiting_response', 'processing',
        'mastery_achieved', 'max_attempts', 'timeout', 'completed', 'cancelled', 'error'
    )),

    -- Progress tracking
    progress_data TEXT NOT NULL, -- JSON: progress, concepts mastered, etc.
    timing_data TEXT NOT NULL,   -- JSON: start time, duration, timeouts
    analytics_data TEXT NOT NULL, -- JSON: engagement score, learning patterns
    security_data TEXT NOT NULL, -- JSON: session token, integrity checks

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    version INTEGER DEFAULT 1,

    -- Indexes for efficient querying
    FOREIGN KEY (config_id) REFERENCES assessment_configs(id) ON DELETE CASCADE
);

CREATE INDEX idx_assessment_sessions_student ON assessment_sessions(student_id, created_at DESC);
CREATE INDEX idx_assessment_sessions_course ON assessment_sessions(course_id, status);
CREATE INDEX idx_assessment_sessions_config ON assessment_sessions(config_id);
CREATE INDEX idx_assessment_sessions_status ON assessment_sessions(status, updated_at);

-- Assessment messages table for conversation history
CREATE TABLE IF NOT EXISTS assessment_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN (
        'system', 'student', 'feedback', 'question', 'hint',
        'encouragement', 'mastery_check', 'summary'
    )),
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    metadata TEXT, -- JSON: AI confidence, understanding level, etc.
    integrity_data TEXT, -- JSON: authenticity, similarity scores
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    encrypted INTEGER DEFAULT 0,

    FOREIGN KEY (session_id) REFERENCES assessment_sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_assessment_messages_session ON assessment_messages(session_id, timestamp);
CREATE INDEX idx_assessment_messages_type ON assessment_messages(type, timestamp);
CREATE INDEX idx_assessment_messages_hash ON assessment_messages(content_hash);

-- Assessment session configurations table
CREATE TABLE IF NOT EXISTS assessment_session_configs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,

    -- Settings
    mastery_threshold REAL NOT NULL DEFAULT 0.75,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    time_limit INTEGER, -- minutes, NULL = unlimited
    allow_hints INTEGER DEFAULT 1,
    show_feedback INTEGER DEFAULT 1,
    adaptive_difficulty INTEGER DEFAULT 1,
    require_mastery INTEGER DEFAULT 1,

    -- Context
    canvas_assignment_id TEXT,
    content_reference TEXT,
    learning_objectives TEXT NOT NULL, -- JSON array
    concepts TEXT NOT NULL, -- JSON array
    prerequisites TEXT, -- JSON array

    -- Grading
    passback_enabled INTEGER DEFAULT 1,
    points_possible REAL NOT NULL DEFAULT 100,
    mastery_weight REAL NOT NULL DEFAULT 0.6,
    participation_weight REAL NOT NULL DEFAULT 0.3,
    improvement_weight REAL NOT NULL DEFAULT 0.1,
    canvas_grade_url TEXT,

    -- Metadata
    created_by TEXT NOT NULL,
    course_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active INTEGER DEFAULT 1
);

CREATE INDEX idx_assessment_session_configs_course ON assessment_session_configs(course_id, active);
CREATE INDEX idx_assessment_session_configs_creator ON assessment_session_configs(created_by, created_at DESC);
CREATE INDEX idx_assessment_session_configs_assignment ON assessment_session_configs(canvas_assignment_id);

-- Grade calculations table for passback tracking
CREATE TABLE IF NOT EXISTS assessment_grade_calculations (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    numeric_score REAL NOT NULL,
    letter_grade TEXT,

    -- Score components
    mastery_score REAL NOT NULL,
    participation_score REAL NOT NULL,
    improvement_score REAL NOT NULL,
    bonus_points REAL DEFAULT 0,

    -- Feedback
    strengths TEXT, -- JSON array
    areas_for_improvement TEXT, -- JSON array
    recommendations TEXT, -- JSON array
    mastery_report TEXT NOT NULL,

    -- Canvas passback tracking
    passback_eligible INTEGER NOT NULL DEFAULT 0,
    canvas_grade_id TEXT,
    submitted_at TIMESTAMP,
    passback_status TEXT CHECK (passback_status IN ('pending', 'submitted', 'error')),
    error_message TEXT,

    -- Metadata
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (session_id) REFERENCES assessment_sessions(id) ON DELETE CASCADE,
    UNIQUE(session_id) -- One grade calculation per session
);

CREATE INDEX idx_grade_calculations_session ON assessment_grade_calculations(session_id);
CREATE INDEX idx_grade_calculations_passback ON assessment_grade_calculations(passback_status, submitted_at);
CREATE INDEX idx_grade_calculations_canvas ON assessment_grade_calculations(canvas_grade_id);

-- Assessment audit log for compliance and debugging
CREATE TABLE IF NOT EXISTS assessment_audit_log (
    id TEXT PRIMARY KEY,
    session_id TEXT,
    action TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    details TEXT, -- JSON with action-specific data
    ip_address TEXT,
    user_agent TEXT,

    FOREIGN KEY (session_id) REFERENCES assessment_sessions(id) ON DELETE SET NULL
);

CREATE INDEX idx_assessment_audit_session ON assessment_audit_log(session_id, timestamp);
CREATE INDEX idx_assessment_audit_actor ON assessment_audit_log(actor_id, timestamp DESC);
CREATE INDEX idx_assessment_audit_action ON assessment_audit_log(action, timestamp DESC);

-- Assessment performance metrics for monitoring
CREATE TABLE IF NOT EXISTS assessment_performance_metrics (
    id TEXT PRIMARY KEY,
    metric_type TEXT NOT NULL, -- 'ai_latency', 'session_processing', 'grade_passback', etc.
    value REAL NOT NULL,
    unit TEXT NOT NULL, -- 'milliseconds', 'count', 'percentage', etc.
    session_id TEXT,
    course_id TEXT,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT, -- JSON with additional context

    FOREIGN KEY (session_id) REFERENCES assessment_sessions(id) ON DELETE SET NULL
);

CREATE INDEX idx_performance_metrics_type ON assessment_performance_metrics(metric_type, recorded_at);
CREATE INDEX idx_performance_metrics_session ON assessment_performance_metrics(session_id);
CREATE INDEX idx_performance_metrics_course ON assessment_performance_metrics(course_id, recorded_at);

-- Assessment content generation cache for AI responses
CREATE TABLE IF NOT EXISTS assessment_content_cache (
    id TEXT PRIMARY KEY,
    content_hash TEXT NOT NULL,
    content_type TEXT NOT NULL, -- 'welcome_message', 'response_analysis', 'ai_response', etc.
    prompt_hash TEXT NOT NULL,
    ai_response TEXT NOT NULL,
    confidence_score REAL,
    usage_count INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,

    UNIQUE(content_hash, prompt_hash)
);

CREATE INDEX idx_content_cache_hash ON assessment_content_cache(content_hash, prompt_hash);
CREATE INDEX idx_content_cache_type ON assessment_content_cache(content_type, last_used_at);
CREATE INDEX idx_content_cache_expires ON assessment_content_cache(expires_at);

-- Assessment security incidents for academic integrity
CREATE TABLE IF NOT EXISTS assessment_security_incidents (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    incident_type TEXT NOT NULL, -- 'suspicious_response', 'timing_anomaly', 'similarity_detected', etc.
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    description TEXT NOT NULL,
    evidence TEXT, -- JSON with supporting data
    auto_detected INTEGER DEFAULT 1,
    reviewed INTEGER DEFAULT 0,
    reviewer_id TEXT,
    reviewed_at TIMESTAMP,
    resolution TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (session_id) REFERENCES assessment_sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_security_incidents_session ON assessment_security_incidents(session_id, created_at);
CREATE INDEX idx_security_incidents_severity ON assessment_security_incidents(severity, reviewed);
CREATE INDEX idx_security_incidents_type ON assessment_security_incidents(incident_type, created_at);

-- Assessment learning objectives mapping
CREATE TABLE IF NOT EXISTS assessment_learning_objectives (
    id TEXT PRIMARY KEY,
    config_id TEXT NOT NULL,
    objective_id TEXT NOT NULL,
    objective_text TEXT NOT NULL,
    bloom_level TEXT CHECK (bloom_level IN ('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create')),
    weight REAL DEFAULT 1.0,
    mastery_threshold REAL DEFAULT 0.75,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (config_id) REFERENCES assessment_session_configs(id) ON DELETE CASCADE,
    UNIQUE(config_id, objective_id)
);

CREATE INDEX idx_learning_objectives_config ON assessment_learning_objectives(config_id);
CREATE INDEX idx_learning_objectives_bloom ON assessment_learning_objectives(bloom_level);

-- Canvas LTI integration tracking
CREATE TABLE IF NOT EXISTS canvas_lti_integrations (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    integration_type TEXT NOT NULL, -- 'grade_passback', 'content_item', 'names_roles', etc.
    canvas_endpoint TEXT NOT NULL,
    request_data TEXT, -- JSON
    response_data TEXT, -- JSON
    http_status INTEGER,
    success INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,

    FOREIGN KEY (session_id) REFERENCES assessment_sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_canvas_integrations_session ON canvas_lti_integrations(session_id, created_at);
CREATE INDEX idx_canvas_integrations_type ON canvas_lti_integrations(integration_type, success);
CREATE INDEX idx_canvas_integrations_status ON canvas_lti_integrations(http_status, created_at);

-- Insert migration record
INSERT INTO schema_migrations (version, name) VALUES (12, 'ai_chat_assessment_tables');