-- Migration 004: Student Performance Analytics Tables for Story 3.3
-- Creates analytics schema for performance tracking and adaptive learning

-- Student performance profiles
CREATE TABLE IF NOT EXISTS student_performance_profiles (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    overall_mastery REAL DEFAULT 0,
    learning_velocity REAL DEFAULT 0,
    confidence_level REAL DEFAULT 0.5,
    performance_data JSON NOT NULL, -- Detailed metrics
    last_calculated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, student_id, course_id)
);

CREATE INDEX idx_performance_profiles_student ON student_performance_profiles(tenant_id, student_id);
CREATE INDEX idx_performance_profiles_course ON student_performance_profiles(tenant_id, course_id);
CREATE INDEX idx_performance_profiles_mastery ON student_performance_profiles(overall_mastery, last_calculated);
CREATE INDEX idx_performance_profiles_updated ON student_performance_profiles(updated_at DESC);

-- Concept mastery tracking
CREATE TABLE IF NOT EXISTS concept_masteries (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    concept_id TEXT NOT NULL,
    concept_name TEXT NOT NULL,
    mastery_level REAL DEFAULT 0,
    confidence_score REAL DEFAULT 0,
    assessment_count INTEGER DEFAULT 0,
    average_response_time INTEGER DEFAULT 0,
    improvement_trend TEXT CHECK (improvement_trend IN ('improving', 'stable', 'declining')),
    last_assessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES student_performance_profiles(id) ON DELETE CASCADE,
    UNIQUE(profile_id, concept_id)
);

CREATE INDEX idx_concept_masteries_profile ON concept_masteries(profile_id);
CREATE INDEX idx_concept_masteries_concept ON concept_masteries(concept_id, mastery_level);
CREATE INDEX idx_concept_masteries_trend ON concept_masteries(improvement_trend, last_assessed);
CREATE INDEX idx_concept_masteries_low_mastery ON concept_masteries(mastery_level)
    WHERE mastery_level < 0.7;

-- Learning recommendations
CREATE TABLE IF NOT EXISTS learning_recommendations (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    recommendation_type TEXT NOT NULL CHECK (recommendation_type IN ('review', 'practice', 'advance', 'seek_help')),
    priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
    concepts_involved JSON NOT NULL,
    suggested_actions JSON NOT NULL,
    estimated_time_minutes INTEGER,
    content_references JSON, -- Story 3.1 content links
    reasoning TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dismissed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    effectiveness_score REAL, -- 0-1 based on student action
    FOREIGN KEY (profile_id) REFERENCES student_performance_profiles(id) ON DELETE CASCADE
);

CREATE INDEX idx_recommendations_profile ON learning_recommendations(profile_id, status);
CREATE INDEX idx_recommendations_priority ON learning_recommendations(priority, created_at DESC);
CREATE INDEX idx_recommendations_type ON learning_recommendations(recommendation_type, status);
CREATE INDEX idx_recommendations_active ON learning_recommendations(status, expires_at)
    WHERE status = 'active';

-- Struggle pattern detection
CREATE TABLE IF NOT EXISTS struggle_patterns (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    pattern_type TEXT NOT NULL CHECK (pattern_type IN ('misconception', 'knowledge_gap', 'skill_deficit', 'confidence_issue')),
    concepts_involved JSON NOT NULL,
    evidence_count INTEGER DEFAULT 1,
    severity REAL DEFAULT 0,
    suggested_interventions JSON,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    resolution_method TEXT,
    confidence_score REAL DEFAULT 0.5, -- 0-1 confidence in pattern detection
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_struggle_patterns_student ON struggle_patterns(tenant_id, student_id);
CREATE INDEX idx_struggle_patterns_type ON struggle_patterns(pattern_type, severity DESC);
CREATE INDEX idx_struggle_patterns_unresolved ON struggle_patterns(detected_at DESC)
    WHERE resolved_at IS NULL;
CREATE INDEX idx_struggle_patterns_severity ON struggle_patterns(severity DESC, detected_at DESC);

-- Instructor alert system
CREATE TABLE IF NOT EXISTS instructor_alerts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    instructor_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('at_risk_student', 'class_struggle', 'engagement_drop', 'mastery_milestone')),
    priority TEXT NOT NULL CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
    student_ids JSON, -- Array of affected student IDs
    alert_data JSON NOT NULL,
    acknowledged BOOLEAN DEFAULT FALSE,
    dismissed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP,
    dismissed_at TIMESTAMP,
    action_taken TEXT,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_instructor_alerts_instructor ON instructor_alerts(tenant_id, instructor_id);
CREATE INDEX idx_instructor_alerts_course ON instructor_alerts(tenant_id, course_id);
CREATE INDEX idx_instructor_alerts_priority ON instructor_alerts(priority, created_at DESC);
CREATE INDEX idx_instructor_alerts_unread ON instructor_alerts(acknowledged, dismissed, created_at DESC)
    WHERE acknowledged = FALSE AND dismissed = FALSE;

-- Analytics processing queue tracking
CREATE TABLE IF NOT EXISTS analytics_processing_queue (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    task_type TEXT NOT NULL CHECK (task_type IN ('performance_update', 'recommendation_generation', 'pattern_detection', 'alert_check')),
    task_data JSON NOT NULL,
    priority INTEGER DEFAULT 5, -- 1-10 priority scale
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retry')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    processing_duration_ms INTEGER,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_analytics_queue_status ON analytics_processing_queue(status, priority DESC, created_at);
CREATE INDEX idx_analytics_queue_tenant ON analytics_processing_queue(tenant_id, task_type);
CREATE INDEX idx_analytics_queue_pending ON analytics_processing_queue(status, created_at)
    WHERE status = 'pending';
CREATE INDEX idx_analytics_queue_failed ON analytics_processing_queue(status, retry_count, created_at)
    WHERE status = 'failed';

-- Analytics batch processing logs
CREATE TABLE IF NOT EXISTS analytics_batch_logs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    batch_id TEXT NOT NULL,
    batch_type TEXT NOT NULL CHECK (batch_type IN ('daily_analytics', 'weekly_summary', 'monthly_report', 'on_demand')),
    processed_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    total_count INTEGER DEFAULT 0,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    processing_duration_ms INTEGER,
    error_summary JSON,
    performance_metrics JSON,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_batch_logs_tenant ON analytics_batch_logs(tenant_id, batch_type);
CREATE INDEX idx_batch_logs_completed ON analytics_batch_logs(completed_at DESC);
CREATE INDEX idx_batch_logs_performance ON analytics_batch_logs(processing_duration_ms, processed_count);

-- Privacy consent for analytics
CREATE TABLE IF NOT EXISTS analytics_privacy_consent (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    course_id TEXT,
    performance_analytics_consent BOOLEAN DEFAULT TRUE,
    predictive_analytics_consent BOOLEAN DEFAULT FALSE,
    benchmark_comparison_consent BOOLEAN DEFAULT FALSE,
    instructor_visibility_consent BOOLEAN DEFAULT TRUE,
    data_retention_preference INTEGER DEFAULT 365, -- Days
    anonymization_required BOOLEAN DEFAULT FALSE,
    consent_given_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    consent_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    consent_version TEXT DEFAULT '1.0',
    withdrawal_requested_at TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, student_id, course_id)
);

CREATE INDEX idx_analytics_consent_student ON analytics_privacy_consent(tenant_id, student_id);
CREATE INDEX idx_analytics_consent_course ON analytics_privacy_consent(tenant_id, course_id);
CREATE INDEX idx_analytics_consent_predictive ON analytics_privacy_consent(predictive_analytics_consent);
CREATE INDEX idx_analytics_consent_withdrawn ON analytics_privacy_consent(withdrawal_requested_at)
    WHERE withdrawal_requested_at IS NOT NULL;

-- Anonymized benchmark data for privacy-preserving comparisons
CREATE TABLE IF NOT EXISTS anonymized_benchmarks (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    concept_id TEXT,
    assessment_id TEXT,
    benchmark_type TEXT NOT NULL CHECK (benchmark_type IN ('course_average', 'percentile_bands', 'difficulty_calibration')),
    aggregation_level TEXT NOT NULL CHECK (aggregation_level IN ('course', 'module', 'concept', 'assessment')),
    
    -- Anonymized statistics
    sample_size INTEGER NOT NULL,
    mean_score REAL,
    median_score REAL,
    std_deviation REAL,
    percentile_25 REAL,
    percentile_75 REAL,
    percentile_90 REAL,
    
    -- Differential privacy parameters
    epsilon REAL, -- Privacy budget used
    noise_scale REAL, -- Noise added for privacy
    
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP,
    confidence_interval REAL DEFAULT 0.95,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_benchmarks_course ON anonymized_benchmarks(tenant_id, course_id);
CREATE INDEX idx_benchmarks_type ON anonymized_benchmarks(benchmark_type, aggregation_level);
CREATE INDEX idx_benchmarks_valid ON anonymized_benchmarks(valid_until DESC)
    WHERE valid_until > datetime('now');
CREATE INDEX idx_benchmarks_concept ON anonymized_benchmarks(concept_id, calculated_at DESC);

-- Predictive model performance tracking
CREATE TABLE IF NOT EXISTS predictive_model_performance (
    id TEXT PRIMARY KEY,
    model_name TEXT NOT NULL,
    model_version TEXT NOT NULL,
    prediction_type TEXT NOT NULL CHECK (prediction_type IN ('at_risk', 'mastery_time', 'success_probability', 'optimal_timing')),
    
    -- Performance metrics
    accuracy REAL,
    precision_score REAL,
    recall REAL,
    f1_score REAL,
    auc_roc REAL,
    
    -- Sample information
    training_samples INTEGER,
    test_samples INTEGER,
    validation_samples INTEGER,
    
    -- Model metadata
    features_used JSON,
    hyperparameters JSON,
    training_duration_ms INTEGER,
    
    evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    model_deployed BOOLEAN DEFAULT FALSE,
    deployment_date TIMESTAMP,
    
    UNIQUE(model_name, model_version, prediction_type)
);

CREATE INDEX idx_model_performance_type ON predictive_model_performance(prediction_type, accuracy DESC);
CREATE INDEX idx_model_performance_deployed ON predictive_model_performance(model_deployed, deployment_date DESC);
CREATE INDEX idx_model_performance_latest ON predictive_model_performance(model_name, evaluated_at DESC);

-- Insert migration record
INSERT INTO schema_migrations (version, name) VALUES (4, 'analytics_tables');