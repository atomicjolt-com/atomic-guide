-- Migration 003: Assessment Tables for Story 3.2
-- AI-Powered Assessment Deep Linking Integration
-- Creates assessment storage schema with tenant isolation

-- Assessment configurations table
CREATE TABLE IF NOT EXISTS assessment_configs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    created_by TEXT NOT NULL, -- Instructor's LTI user ID
    config JSON NOT NULL,
    content_context JSON, -- From Story 3.1 content extraction
    title TEXT NOT NULL,
    description TEXT,
    assessment_type TEXT NOT NULL CHECK (assessment_type IN ('formative', 'summative', 'diagnostic')),
    max_attempts INTEGER DEFAULT 1,
    time_limit_minutes INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_assessment_configs_tenant_course ON assessment_configs(tenant_id, course_id);
CREATE INDEX idx_assessment_configs_creator ON assessment_configs(created_by, created_at);
CREATE INDEX idx_assessment_configs_type ON assessment_configs(assessment_type);

-- Assessment attempts table for tracking student progress
CREATE TABLE IF NOT EXISTS assessment_attempts (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL,
    student_id TEXT NOT NULL, -- Learner's LTI user ID
    attempt_number INTEGER NOT NULL,
    score REAL,
    max_score REAL,
    status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'abandoned', 'expired')),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    submitted_at TIMESTAMP,
    chat_conversation_id TEXT,
    ai_feedback JSON, -- Structured feedback from AI
    grade_passback_status TEXT CHECK (grade_passback_status IN ('pending', 'success', 'failed', 'not_required')),
    grade_passback_error TEXT,
    metadata JSON DEFAULT '{}',
    FOREIGN KEY (assessment_id) REFERENCES assessment_configs(id) ON DELETE CASCADE,
    UNIQUE(assessment_id, student_id, attempt_number)
);

CREATE INDEX idx_assessment_attempts_assessment ON assessment_attempts(assessment_id, attempt_number);
CREATE INDEX idx_assessment_attempts_student ON assessment_attempts(student_id, started_at);
CREATE INDEX idx_assessment_attempts_status ON assessment_attempts(status, started_at);
CREATE INDEX idx_assessment_attempts_grading ON assessment_attempts(grade_passback_status);

-- Assessment conversations table for chat history
CREATE TABLE IF NOT EXISTS assessment_conversations (
    id TEXT PRIMARY KEY,
    attempt_id TEXT NOT NULL,
    messages JSON NOT NULL, -- Array of chat messages with timestamps
    ai_context JSON, -- AI conversation context and state
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    message_count INTEGER DEFAULT 0,
    total_tokens_used INTEGER DEFAULT 0,
    conversation_summary TEXT, -- AI-generated summary of key points
    FOREIGN KEY (attempt_id) REFERENCES assessment_attempts(id) ON DELETE CASCADE
);

CREATE INDEX idx_assessment_conversations_attempt ON assessment_conversations(attempt_id);
CREATE INDEX idx_assessment_conversations_activity ON assessment_conversations(last_message_at DESC);

-- Assessment questions table for storing individual questions
CREATE TABLE IF NOT EXISTS assessment_questions (
    id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL,
    question_order INTEGER NOT NULL,
    question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'open_ended', 'true_false', 'essay', 'code')),
    question_text TEXT NOT NULL,
    question_data JSON, -- Question-specific data (options, correct answers, etc.)
    points REAL DEFAULT 1.0,
    difficulty_level REAL DEFAULT 0.5, -- 0-1 scale
    content_reference TEXT, -- Reference to specific content from Story 3.1
    ai_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessment_configs(id) ON DELETE CASCADE
);

CREATE INDEX idx_assessment_questions_assessment ON assessment_questions(assessment_id, question_order);
CREATE INDEX idx_assessment_questions_type ON assessment_questions(question_type);

-- Assessment responses table for student answers
CREATE TABLE IF NOT EXISTS assessment_responses (
    id TEXT PRIMARY KEY,
    attempt_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    response_data JSON NOT NULL, -- Student's answer(s)
    score REAL,
    ai_feedback TEXT, -- AI-generated feedback for this response
    auto_graded BOOLEAN DEFAULT FALSE,
    instructor_feedback TEXT,
    response_time_seconds INTEGER, -- Time spent on this question
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (attempt_id) REFERENCES assessment_attempts(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES assessment_questions(id) ON DELETE CASCADE,
    UNIQUE(attempt_id, question_id)
);

CREATE INDEX idx_assessment_responses_attempt ON assessment_responses(attempt_id);
CREATE INDEX idx_assessment_responses_question ON assessment_responses(question_id);
CREATE INDEX idx_assessment_responses_grading ON assessment_responses(auto_graded, score);

-- Assessment analytics aggregation table
CREATE TABLE IF NOT EXISTS assessment_analytics (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    assessment_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    
    -- Aggregate metrics
    total_attempts INTEGER DEFAULT 0,
    completed_attempts INTEGER DEFAULT 0,
    average_score REAL DEFAULT 0,
    pass_rate REAL DEFAULT 0,
    
    -- Performance insights
    average_completion_time_minutes INTEGER DEFAULT 0,
    most_difficult_questions JSON, -- Question IDs with low success rates
    common_struggle_points JSON, -- Patterns from chat conversations
    
    -- Time-based analytics
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    period_start TIMESTAMP,
    period_end TIMESTAMP,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (assessment_id) REFERENCES assessment_configs(id) ON DELETE CASCADE,
    UNIQUE(assessment_id, calculated_at)
);

CREATE INDEX idx_assessment_analytics_assessment ON assessment_analytics(assessment_id, calculated_at);
CREATE INDEX idx_assessment_analytics_course ON assessment_analytics(tenant_id, course_id);
CREATE INDEX idx_assessment_analytics_performance ON assessment_analytics(pass_rate, average_score);

-- Deep linking audit log for tracking assessment creation
CREATE TABLE IF NOT EXISTS deep_linking_audit (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    instructor_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    assessment_id TEXT,
    action TEXT NOT NULL, -- 'request', 'create', 'update', 'delete'
    request_data JSON,
    response_data JSON,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_deep_linking_audit_tenant ON deep_linking_audit(tenant_id, created_at DESC);
CREATE INDEX idx_deep_linking_audit_instructor ON deep_linking_audit(instructor_id, created_at DESC);
CREATE INDEX idx_deep_linking_audit_assessment ON deep_linking_audit(assessment_id);

-- Insert migration record
INSERT INTO schema_migrations (version, name) VALUES (3, 'assessment_tables');