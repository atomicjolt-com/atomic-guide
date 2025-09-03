-- Migration 002: LMS Content Integration Tables for Stories 3.1/3.2
-- Creates bridge tables needed for analytics in Story 3.3
-- Complements existing lms_content and assessment tables

-- Course content mapping for better organization
CREATE TABLE IF NOT EXISTS course_content_mapping (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    content_id TEXT NOT NULL, -- Reference to lms_content.id
    module_id TEXT,
    module_name TEXT,
    content_order INTEGER DEFAULT 0,
    content_weight REAL DEFAULT 1.0, -- Importance for analytics
    prerequisite_content_ids JSON DEFAULT '[]', -- Array of content_id dependencies
    learning_objectives JSON DEFAULT '[]', -- Structured learning outcomes
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (content_id) REFERENCES lms_content(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, course_id, content_id)
);

CREATE INDEX idx_course_content_course ON course_content_mapping(tenant_id, course_id);
CREATE INDEX idx_course_content_module ON course_content_mapping(tenant_id, course_id, module_id);
CREATE INDEX idx_course_content_order ON course_content_mapping(course_id, content_order);

-- Content-assessment relationships for analytics correlation
CREATE TABLE IF NOT EXISTS content_assessment_links (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    content_id TEXT NOT NULL, -- Reference to lms_content.id
    assessment_id TEXT NOT NULL, -- Reference to assessment_configs.id
    relationship_type TEXT NOT NULL CHECK (relationship_type IN ('tests_content', 'prerequisite', 'reinforces', 'applies')),
    confidence_score REAL DEFAULT 0.8, -- 0-1 confidence in relationship
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT, -- System or instructor ID
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (content_id) REFERENCES lms_content(id) ON DELETE CASCADE,
    FOREIGN KEY (assessment_id) REFERENCES assessment_configs(id) ON DELETE CASCADE,
    UNIQUE(content_id, assessment_id, relationship_type)
);

CREATE INDEX idx_content_assessment_content ON content_assessment_links(content_id);
CREATE INDEX idx_content_assessment_assessment ON content_assessment_links(assessment_id);
CREATE INDEX idx_content_assessment_type ON content_assessment_links(relationship_type, confidence_score);

-- Learning pathway tracking for sequence analysis
CREATE TABLE IF NOT EXISTS learning_pathways (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    pathway_name TEXT NOT NULL,
    pathway_description TEXT,
    content_sequence JSON NOT NULL, -- Ordered array of content_id references
    assessment_checkpoints JSON DEFAULT '[]', -- Assessment points in pathway
    estimated_duration_minutes INTEGER,
    difficulty_progression REAL DEFAULT 0.5, -- How difficulty increases 0-1
    success_rate REAL, -- Historical success rate for this pathway
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT, -- Instructor or system ID
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, course_id, pathway_name)
);

CREATE INDEX idx_learning_pathways_course ON learning_pathways(tenant_id, course_id);
CREATE INDEX idx_learning_pathways_success ON learning_pathways(success_rate DESC);

-- Student learning pathway progress tracking
CREATE TABLE IF NOT EXISTS student_pathway_progress (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    student_id TEXT NOT NULL, -- Learner's LTI user ID
    pathway_id TEXT NOT NULL,
    current_content_id TEXT, -- Current position in pathway
    completed_content_ids JSON DEFAULT '[]', -- Array of completed content IDs
    content_completion_times JSON DEFAULT '{}', -- content_id -> completion_time mapping
    assessment_scores JSON DEFAULT '{}', -- assessment_id -> score mapping
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completion_percentage REAL DEFAULT 0.0,
    estimated_completion_date TIMESTAMP,
    struggle_points JSON DEFAULT '[]', -- Content IDs where student struggled
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (pathway_id) REFERENCES learning_pathways(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, student_id, pathway_id)
);

CREATE INDEX idx_student_pathway_student ON student_pathway_progress(tenant_id, student_id);
CREATE INDEX idx_student_pathway_pathway ON student_pathway_progress(pathway_id, completion_percentage);
CREATE INDEX idx_student_pathway_active ON student_pathway_progress(last_accessed_at DESC) 
    WHERE completion_percentage < 1.0;

-- Content difficulty calibration based on student performance
CREATE TABLE IF NOT EXISTS content_difficulty_calibration (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    content_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    
    -- Statistical measures
    average_time_seconds INTEGER NOT NULL,
    median_time_seconds INTEGER NOT NULL,
    success_rate REAL NOT NULL, -- 0-1 completion/comprehension rate
    struggle_rate REAL NOT NULL, -- 0-1 rate of struggle events
    
    -- Engagement metrics
    average_engagement_score REAL DEFAULT 0.5,
    bounce_rate REAL DEFAULT 0.0, -- Students who leave quickly
    return_rate REAL DEFAULT 0.0, -- Students who come back
    
    -- Sample size and confidence
    sample_size INTEGER NOT NULL,
    confidence_interval REAL NOT NULL, -- 0-1 statistical confidence
    last_calculated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Difficulty classification
    difficulty_tier TEXT CHECK (difficulty_tier IN ('beginner', 'intermediate', 'advanced', 'expert')),
    relative_difficulty REAL, -- 0-1 relative to other content in course
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (content_id) REFERENCES lms_content(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, content_id, course_id)
);

CREATE INDEX idx_content_difficulty_content ON content_difficulty_calibration(content_id);
CREATE INDEX idx_content_difficulty_course ON content_difficulty_calibration(tenant_id, course_id);
CREATE INDEX idx_content_difficulty_tier ON content_difficulty_calibration(difficulty_tier, relative_difficulty);
CREATE INDEX idx_content_difficulty_success ON content_difficulty_calibration(success_rate, sample_size);

-- Assessment question difficulty analysis
CREATE TABLE IF NOT EXISTS question_difficulty_analysis (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    question_id TEXT NOT NULL, -- Reference to assessment_questions.id
    assessment_id TEXT NOT NULL,
    
    -- Performance statistics
    total_attempts INTEGER DEFAULT 0,
    correct_attempts INTEGER DEFAULT 0,
    success_rate REAL DEFAULT 0.0,
    average_response_time_seconds INTEGER DEFAULT 0,
    
    -- Common wrong answers for MC questions
    wrong_answer_patterns JSON DEFAULT '{}',
    common_misconceptions JSON DEFAULT '[]',
    
    -- Difficulty metrics
    discrimination_index REAL, -- How well question separates high/low performers
    difficulty_index REAL, -- Classical test theory difficulty
    point_biserial_correlation REAL, -- Item-total correlation
    
    -- Classification
    difficulty_tier TEXT CHECK (difficulty_tier IN ('easy', 'medium', 'hard', 'very_hard')),
    needs_review BOOLEAN DEFAULT FALSE,
    
    last_calculated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sample_size INTEGER DEFAULT 0,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES assessment_questions(id) ON DELETE CASCADE,
    FOREIGN KEY (assessment_id) REFERENCES assessment_configs(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, question_id)
);

CREATE INDEX idx_question_difficulty_question ON question_difficulty_analysis(question_id);
CREATE INDEX idx_question_difficulty_assessment ON question_difficulty_analysis(assessment_id);
CREATE INDEX idx_question_difficulty_rate ON question_difficulty_analysis(success_rate, sample_size);
CREATE INDEX idx_question_difficulty_review ON question_difficulty_analysis(needs_review, last_calculated);

-- Student performance snapshots for trend analysis
CREATE TABLE IF NOT EXISTS performance_snapshots (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    snapshot_date DATE NOT NULL,
    
    -- Overall metrics
    overall_mastery_score REAL DEFAULT 0.0, -- 0-1 overall course mastery
    content_completion_rate REAL DEFAULT 0.0, -- 0-1 content completed
    assessment_average_score REAL DEFAULT 0.0, -- Average across all assessments
    
    -- Engagement metrics
    total_time_spent_minutes INTEGER DEFAULT 0,
    session_count INTEGER DEFAULT 0,
    chat_interaction_count INTEGER DEFAULT 0,
    help_seeking_frequency REAL DEFAULT 0.0, -- Help requests per hour
    
    -- Learning velocity
    concepts_mastered_this_period INTEGER DEFAULT 0,
    assessments_completed_this_period INTEGER DEFAULT 0,
    learning_velocity REAL DEFAULT 0.0, -- Concepts per day
    
    -- Risk indicators
    consecutive_poor_performances INTEGER DEFAULT 0,
    time_since_last_success_days INTEGER DEFAULT 0,
    struggle_event_rate REAL DEFAULT 0.0, -- Struggles per session
    at_risk_flag BOOLEAN DEFAULT FALSE,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, student_id, course_id, snapshot_date)
);

CREATE INDEX idx_performance_snapshots_student ON performance_snapshots(tenant_id, student_id);
CREATE INDEX idx_performance_snapshots_course ON performance_snapshots(tenant_id, course_id, snapshot_date);
CREATE INDEX idx_performance_snapshots_at_risk ON performance_snapshots(at_risk_flag, snapshot_date DESC);
CREATE INDEX idx_performance_snapshots_mastery ON performance_snapshots(overall_mastery_score, snapshot_date);

-- Concept relationship graph for prerequisite analysis
CREATE TABLE IF NOT EXISTS concept_relationships (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    source_concept_id TEXT NOT NULL, -- From knowledge_graph.concept_id
    target_concept_id TEXT NOT NULL, -- From knowledge_graph.concept_id
    relationship_type TEXT NOT NULL CHECK (relationship_type IN ('prerequisite', 'corequisite', 'related', 'builds_upon', 'contradicts')),
    strength REAL DEFAULT 0.5, -- 0-1 strength of relationship
    evidence_source TEXT, -- 'instructor_defined', 'content_analysis', 'student_performance'
    statistical_evidence JSON DEFAULT '{}', -- Performance correlation data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    validated_at TIMESTAMP,
    validation_confidence REAL, -- 0-1 confidence in relationship
    UNIQUE(tenant_id, source_concept_id, target_concept_id, relationship_type)
);

CREATE INDEX idx_concept_relationships_source ON concept_relationships(tenant_id, source_concept_id);
CREATE INDEX idx_concept_relationships_target ON concept_relationships(tenant_id, target_concept_id);
CREATE INDEX idx_concept_relationships_type ON concept_relationships(relationship_type, strength);
CREATE INDEX idx_concept_relationships_course ON concept_relationships(tenant_id, course_id);

-- Insert migration record
INSERT INTO schema_migrations (version, name) VALUES (2, 'lms_content_integration_tables');