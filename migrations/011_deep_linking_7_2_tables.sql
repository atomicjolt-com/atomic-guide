-- Migration 011: Deep Linking Configuration Interface Tables for Story 7.2
-- Creates comprehensive schema for deep linking session management and assessment configuration
-- Extends Story 7.1 foundations with full instructor configuration workflow support

-- Deep linking contexts table for storing Canvas request context
CREATE TABLE IF NOT EXISTS deep_linking_contexts (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    jwt_claims TEXT NOT NULL, -- JSON JWT claims from Canvas
    deep_linking_settings TEXT NOT NULL, -- JSON deep linking settings
    canvas_assignment_context TEXT, -- JSON Canvas assignment context
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_deep_linking_contexts_session ON deep_linking_contexts(session_id);
CREATE INDEX idx_deep_linking_contexts_created ON deep_linking_contexts(created_at DESC);

-- Deep linking sessions table for secure session management
CREATE TABLE IF NOT EXISTS deep_linking_sessions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL UNIQUE,
    instructor_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    platform_deployment_id TEXT NOT NULL,
    return_url TEXT NOT NULL,
    accept_types TEXT, -- JSON array of accepted content types
    accept_presentation_targets TEXT, -- JSON array of accepted presentation targets
    state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'configuring', 'completed', 'expired')),
    csrf_token TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_valid BOOLEAN DEFAULT TRUE,
    origin TEXT NOT NULL, -- Origin URL for CSRF protection
    user_agent TEXT,
    ip_address TEXT,
    configuration_data TEXT, -- JSON configuration state
    invalidated_at DATETIME,
    invalidation_reason TEXT
);

CREATE INDEX idx_deep_linking_sessions_session ON deep_linking_sessions(session_id);
CREATE INDEX idx_deep_linking_sessions_instructor ON deep_linking_sessions(instructor_id, created_at DESC);
CREATE INDEX idx_deep_linking_sessions_expiry ON deep_linking_sessions(expires_at, is_valid);
CREATE INDEX idx_deep_linking_sessions_state ON deep_linking_sessions(state, last_activity DESC);

-- Assessment configurations table (enhanced from existing structure)
CREATE TABLE IF NOT EXISTS assessment_configurations (
    id TEXT PRIMARY KEY,
    session_id TEXT, -- Link to deep linking session
    instructor_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    assignment_id TEXT, -- Canvas assignment ID when available
    title TEXT NOT NULL,
    description TEXT,

    -- Assessment settings
    settings TEXT NOT NULL, -- JSON settings object
    grading_config TEXT NOT NULL, -- JSON grading configuration
    deployment_status TEXT DEFAULT 'draft' CHECK (deployment_status IN ('draft', 'configured', 'deployed', 'archived')),

    -- Canvas integration metadata
    canvas_assignment_data TEXT, -- JSON Canvas assignment metadata
    content_items TEXT, -- JSON generated content items

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deployed_at DATETIME,

    FOREIGN KEY (session_id) REFERENCES deep_linking_sessions(session_id),
    FOREIGN KEY (instructor_id) REFERENCES users(id)
);

CREATE INDEX idx_assessment_configurations_session ON assessment_configurations(session_id);
CREATE INDEX idx_assessment_configurations_instructor ON assessment_configurations(instructor_id, created_at DESC);
CREATE INDEX idx_assessment_configurations_course ON assessment_configurations(course_id, deployment_status);
CREATE INDEX idx_assessment_configurations_assignment ON assessment_configurations(assignment_id);
CREATE INDEX idx_assessment_configurations_status ON assessment_configurations(deployment_status, updated_at DESC);

-- Assessment checkpoints table for placement management
CREATE TABLE IF NOT EXISTS assessment_checkpoints (
    id TEXT PRIMARY KEY,
    configuration_id TEXT NOT NULL,
    placement_data TEXT NOT NULL, -- JSON placement information with selectors and coordinates
    assessment_type TEXT NOT NULL CHECK (assessment_type IN ('comprehension', 'application', 'analysis', 'reflection', 'knowledge_check')),
    difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    metadata TEXT, -- JSON metadata including estimated time, learning objectives
    order_index INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (configuration_id) REFERENCES assessment_configurations(id) ON DELETE CASCADE
);

CREATE INDEX idx_assessment_checkpoints_config ON assessment_checkpoints(configuration_id, order_index);
CREATE INDEX idx_assessment_checkpoints_type ON assessment_checkpoints(assessment_type, difficulty);
CREATE INDEX idx_assessment_checkpoints_active ON assessment_checkpoints(is_active, created_at DESC);

-- Enhanced assessment questions table with AI generation metadata
CREATE TABLE IF NOT EXISTS assessment_questions_v2 (
    id TEXT PRIMARY KEY,
    checkpoint_id TEXT NOT NULL,
    question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'short_answer', 'essay', 'true_false', 'fill_blank')),
    question_text TEXT NOT NULL,
    question_data TEXT, -- JSON options, answers, etc.
    explanation TEXT,
    difficulty_score REAL,

    -- AI generation metadata
    source_type TEXT NOT NULL CHECK (source_type IN ('ai_generated', 'instructor_created', 'template', 'imported')),
    review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected', 'modified')),
    ai_confidence REAL,
    ai_generation_metadata TEXT, -- JSON metadata from AI generation

    -- Pedagogical metadata
    question_metadata TEXT, -- JSON metadata including Bloom's level, cognitive load
    content_reference TEXT, -- Reference to source content

    -- Review and approval workflow
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME,
    reviewed_by TEXT, -- Instructor ID who reviewed
    review_notes TEXT,

    -- Version control
    version INTEGER DEFAULT 1,
    parent_question_id TEXT, -- Reference to original if this is a modification

    FOREIGN KEY (checkpoint_id) REFERENCES assessment_checkpoints(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

CREATE INDEX idx_assessment_questions_v2_checkpoint ON assessment_questions_v2(checkpoint_id, question_type);
CREATE INDEX idx_assessment_questions_v2_review ON assessment_questions_v2(review_status, created_at DESC);
CREATE INDEX idx_assessment_questions_v2_source ON assessment_questions_v2(source_type, ai_confidence DESC);
CREATE INDEX idx_assessment_questions_v2_reviewer ON assessment_questions_v2(reviewed_by, reviewed_at DESC);

-- Assessment templates table for reusable configurations
CREATE TABLE IF NOT EXISTS assessment_templates (
    id TEXT PRIMARY KEY,
    instructor_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    tags TEXT, -- JSON array of tags

    -- Template structure
    template_data TEXT NOT NULL, -- JSON template structure with checkpoints and questions
    usage_stats TEXT, -- JSON usage statistics
    sharing_config TEXT, -- JSON sharing configuration

    -- Template metadata
    difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    estimated_time_minutes INTEGER,
    target_audience TEXT,
    subject_area TEXT,

    -- Usage tracking
    times_used INTEGER DEFAULT 0,
    average_rating REAL DEFAULT 0,
    total_ratings INTEGER DEFAULT 0,

    -- Sharing and collaboration
    is_public BOOLEAN DEFAULT FALSE,
    is_institutional BOOLEAN DEFAULT FALSE,
    allow_modification BOOLEAN DEFAULT TRUE,
    attribution TEXT,

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME,

    FOREIGN KEY (instructor_id) REFERENCES users(id)
);

CREATE INDEX idx_assessment_templates_instructor ON assessment_templates(instructor_id, created_at DESC);
CREATE INDEX idx_assessment_templates_category ON assessment_templates(category, is_public);
CREATE INDEX idx_assessment_templates_sharing ON assessment_templates(is_public, average_rating DESC);
CREATE INDEX idx_assessment_templates_usage ON assessment_templates(times_used DESC, average_rating DESC);
CREATE INDEX idx_assessment_templates_search ON assessment_templates(title, description, tags);

-- Template usage tracking table
CREATE TABLE IF NOT EXISTS template_usage_log (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL,
    instructor_id TEXT NOT NULL,
    configuration_id TEXT, -- Assessment configuration created from template
    usage_type TEXT NOT NULL CHECK (usage_type IN ('preview', 'applied', 'modified', 'shared')),
    usage_context TEXT, -- JSON context data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (template_id) REFERENCES assessment_templates(id),
    FOREIGN KEY (instructor_id) REFERENCES users(id),
    FOREIGN KEY (configuration_id) REFERENCES assessment_configurations(id)
);

CREATE INDEX idx_template_usage_template ON template_usage_log(template_id, created_at DESC);
CREATE INDEX idx_template_usage_instructor ON template_usage_log(instructor_id, created_at DESC);
CREATE INDEX idx_template_usage_type ON template_usage_log(usage_type, created_at DESC);

-- Content item generation log for tracking Canvas submissions
CREATE TABLE IF NOT EXISTS content_item_log (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    configuration_id TEXT NOT NULL,
    content_items TEXT NOT NULL, -- JSON content items sent to Canvas
    canvas_response TEXT, -- JSON Canvas response
    success BOOLEAN NOT NULL,
    error_details TEXT,

    -- Security and audit information
    instructor_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    canvas_assignment_id TEXT,

    -- Delivery metadata
    delivery_method TEXT DEFAULT 'deep_linking' CHECK (delivery_method IN ('deep_linking', 'api_direct', 'manual')),
    response_time_ms INTEGER,
    retry_count INTEGER DEFAULT 0,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (session_id) REFERENCES deep_linking_sessions(session_id),
    FOREIGN KEY (configuration_id) REFERENCES assessment_configurations(id),
    FOREIGN KEY (instructor_id) REFERENCES users(id)
);

CREATE INDEX idx_content_item_log_session ON content_item_log(session_id, created_at DESC);
CREATE INDEX idx_content_item_log_config ON content_item_log(configuration_id);
CREATE INDEX idx_content_item_log_success ON content_item_log(success, created_at DESC);
CREATE INDEX idx_content_item_log_instructor ON content_item_log(instructor_id, created_at DESC);

-- Deep linking security audit log
CREATE TABLE IF NOT EXISTS deep_linking_security_audit (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    event_data TEXT NOT NULL, -- JSON event details
    severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),

    -- Context information
    session_id TEXT,
    instructor_id TEXT,
    course_id TEXT,
    ip_address TEXT,
    user_agent TEXT,

    -- Detection metadata
    security_flags TEXT, -- JSON array of security flags
    action_taken TEXT, -- What action was taken in response

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (session_id) REFERENCES deep_linking_sessions(session_id)
);

CREATE INDEX idx_security_audit_event ON deep_linking_security_audit(event_type, severity, created_at DESC);
CREATE INDEX idx_security_audit_session ON deep_linking_security_audit(session_id, created_at DESC);
CREATE INDEX idx_security_audit_instructor ON deep_linking_security_audit(instructor_id, created_at DESC);
CREATE INDEX idx_security_audit_severity ON deep_linking_security_audit(severity, created_at DESC);

-- AI content validation log
CREATE TABLE IF NOT EXISTS ai_content_validation_log (
    id TEXT PRIMARY KEY,
    question_id TEXT,
    checkpoint_id TEXT,
    validation_type TEXT NOT NULL CHECK (validation_type IN ('question_generation', 'content_review', 'batch_validation', 'template_validation')),

    -- Validation results
    validation_result TEXT NOT NULL, -- JSON validation result
    passed BOOLEAN NOT NULL,
    confidence_score REAL,
    issues_found TEXT, -- JSON array of issues
    suggestions TEXT, -- JSON array of suggestions

    -- AI model information
    ai_model TEXT,
    ai_version TEXT,
    processing_time_ms INTEGER,

    -- Content metadata
    content_type TEXT,
    content_length INTEGER,
    content_hash TEXT, -- Hash for deduplication

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (question_id) REFERENCES assessment_questions_v2(id),
    FOREIGN KEY (checkpoint_id) REFERENCES assessment_checkpoints(id)
);

CREATE INDEX idx_ai_validation_question ON ai_content_validation_log(question_id, created_at DESC);
CREATE INDEX idx_ai_validation_checkpoint ON ai_content_validation_log(checkpoint_id, created_at DESC);
CREATE INDEX idx_ai_validation_result ON ai_content_validation_log(passed, confidence_score DESC);
CREATE INDEX idx_ai_validation_type ON ai_content_validation_log(validation_type, created_at DESC);
CREATE INDEX idx_ai_validation_hash ON ai_content_validation_log(content_hash);

-- Canvas integration status tracking
CREATE TABLE IF NOT EXISTS canvas_integration_status (
    id TEXT PRIMARY KEY,
    configuration_id TEXT NOT NULL,
    canvas_assignment_id TEXT,
    integration_type TEXT NOT NULL CHECK (integration_type IN ('deep_linking', 'grade_passback', 'content_sync', 'metadata_sync')),

    -- Status tracking
    status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'success', 'failed', 'retry')),
    last_attempt_at DATETIME,
    next_retry_at DATETIME,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,

    -- Canvas API response data
    canvas_response TEXT, -- JSON Canvas API response
    error_message TEXT,
    error_code TEXT,

    -- Metadata
    metadata TEXT, -- JSON additional metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (configuration_id) REFERENCES assessment_configurations(id)
);

CREATE INDEX idx_canvas_integration_config ON canvas_integration_status(configuration_id, integration_type);
CREATE INDEX idx_canvas_integration_status ON canvas_integration_status(status, last_attempt_at DESC);
CREATE INDEX idx_canvas_integration_retry ON canvas_integration_status(status, next_retry_at);
CREATE INDEX idx_canvas_integration_assignment ON canvas_integration_status(canvas_assignment_id);

-- Instructor feedback on AI-generated content
CREATE TABLE IF NOT EXISTS ai_content_feedback (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL,
    instructor_id TEXT NOT NULL,

    -- Feedback ratings (1-5 scale)
    quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
    relevance_rating INTEGER CHECK (relevance_rating BETWEEN 1 AND 5),
    clarity_rating INTEGER CHECK (clarity_rating BETWEEN 1 AND 5),
    difficulty_rating INTEGER CHECK (difficulty_rating BETWEEN 1 AND 5),

    -- Qualitative feedback
    feedback_text TEXT,
    improvement_suggestions TEXT,
    would_use_again BOOLEAN,

    -- Context
    usage_context TEXT, -- How the question was used
    student_performance_data TEXT, -- JSON student performance if available

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (question_id) REFERENCES assessment_questions_v2(id),
    FOREIGN KEY (instructor_id) REFERENCES users(id),
    UNIQUE(question_id, instructor_id)
);

CREATE INDEX idx_ai_feedback_question ON ai_content_feedback(question_id);
CREATE INDEX idx_ai_feedback_instructor ON ai_content_feedback(instructor_id, created_at DESC);
CREATE INDEX idx_ai_feedback_ratings ON ai_content_feedback(quality_rating, relevance_rating, clarity_rating);

-- Configuration backup and versioning
CREATE TABLE IF NOT EXISTS configuration_backups (
    id TEXT PRIMARY KEY,
    configuration_id TEXT NOT NULL,
    backup_type TEXT NOT NULL CHECK (backup_type IN ('manual', 'auto_save', 'pre_deployment', 'version_control')),

    -- Backup data
    configuration_snapshot TEXT NOT NULL, -- JSON complete configuration snapshot
    backup_metadata TEXT, -- JSON backup metadata

    -- Version control
    version_number INTEGER NOT NULL,
    parent_backup_id TEXT, -- Reference to parent backup for versioning
    change_summary TEXT, -- Summary of changes from parent

    -- Context
    created_by TEXT, -- Instructor who triggered backup
    trigger_event TEXT, -- What triggered this backup

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (configuration_id) REFERENCES assessment_configurations(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (parent_backup_id) REFERENCES configuration_backups(id)
);

CREATE INDEX idx_config_backups_config ON configuration_backups(configuration_id, version_number DESC);
CREATE INDEX idx_config_backups_type ON configuration_backups(backup_type, created_at DESC);
CREATE INDEX idx_config_backups_creator ON configuration_backups(created_by, created_at DESC);

-- Performance metrics for monitoring
CREATE TABLE IF NOT EXISTS deep_linking_performance_metrics (
    id TEXT PRIMARY KEY,
    metric_type TEXT NOT NULL CHECK (metric_type IN ('session_duration', 'configuration_time', 'ai_generation_time', 'canvas_integration_time', 'user_workflow_time')),

    -- Metric data
    metric_value REAL NOT NULL,
    metric_unit TEXT NOT NULL, -- 'milliseconds', 'seconds', 'count', etc.
    metric_context TEXT, -- JSON context data

    -- Dimensions for analysis
    session_id TEXT,
    instructor_id TEXT,
    course_id TEXT,
    configuration_id TEXT,

    -- Additional metadata
    user_agent TEXT,
    browser_info TEXT,
    device_type TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (session_id) REFERENCES deep_linking_sessions(session_id),
    FOREIGN KEY (instructor_id) REFERENCES users(id),
    FOREIGN KEY (configuration_id) REFERENCES assessment_configurations(id)
);

CREATE INDEX idx_performance_metrics_type ON deep_linking_performance_metrics(metric_type, created_at DESC);
CREATE INDEX idx_performance_metrics_session ON deep_linking_performance_metrics(session_id);
CREATE INDEX idx_performance_metrics_instructor ON deep_linking_performance_metrics(instructor_id, metric_type);
CREATE INDEX idx_performance_metrics_value ON deep_linking_performance_metrics(metric_type, metric_value);

-- Insert migration record
INSERT INTO schema_migrations (version, name) VALUES (11, 'deep_linking_7_2_tables');