-- Migration 006: Advanced Pattern Recognition Tables for Story 4.2
-- 
-- Creates database schema extensions for advanced cognitive profiling
-- and predictive intervention capabilities
--
-- SCOPE: Phase 1 MVP with single-course analysis only
-- PRIVACY: Consent-based data collection with clear retention policies

-- Prediction results storage for effectiveness tracking
CREATE TABLE IF NOT EXISTS prediction_results (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    prediction_type TEXT NOT NULL CHECK (prediction_type IN (
        'struggle_prediction',
        'velocity_forecast', 
        'behavioral_analysis',
        'cognitive_load',
        'engagement_score'
    )),
    prediction_data TEXT NOT NULL, -- JSON blob with prediction details
    confidence_score REAL NOT NULL CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    actual_outcome TEXT, -- JSON blob with actual results for validation
    accuracy_score REAL CHECK (accuracy_score >= 0.0 AND accuracy_score <= 1.0),
    created_at TEXT NOT NULL,
    validated_at TEXT,
    
    -- Indexes for performance
    FOREIGN KEY (tenant_id, user_id) REFERENCES learner_dna_profiles(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_prediction_results_user_course ON prediction_results(tenant_id, user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_prediction_results_type_created ON prediction_results(prediction_type, created_at);
CREATE INDEX IF NOT EXISTS idx_prediction_results_validation ON prediction_results(validated_at) WHERE validated_at IS NOT NULL;

-- Learning interventions tracking
CREATE TABLE IF NOT EXISTS learning_interventions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    course_id TEXT,
    intervention_type TEXT NOT NULL CHECK (intervention_type IN (
        'proactive_help',
        'difficulty_adjustment', 
        'study_strategy',
        'early_warning',
        'break_reminder',
        'engagement_boost',
        'concept_clarification'
    )),
    priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    trigger_pattern TEXT NOT NULL,
    recommended_action TEXT NOT NULL,
    target_cognitive_attribute TEXT,
    expected_outcome TEXT,
    measurement_criteria TEXT, -- JSON array of success criteria
    
    -- Delivery and response tracking
    delivery_timestamp TEXT NOT NULL,
    student_response TEXT CHECK (student_response IN ('accepted', 'dismissed', 'ignored')),
    response_timestamp TEXT,
    effectiveness_score REAL CHECK (effectiveness_score >= 0.0 AND effectiveness_score <= 1.0),
    follow_up_required BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    
    -- Privacy compliance
    consent_verified BOOLEAN NOT NULL DEFAULT FALSE,
    purge_at TEXT -- Automatic deletion date
);

CREATE INDEX IF NOT EXISTS idx_learning_interventions_user ON learning_interventions(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_learning_interventions_course ON learning_interventions(course_id);
CREATE INDEX IF NOT EXISTS idx_learning_interventions_delivery ON learning_interventions(delivery_timestamp);
CREATE INDEX IF NOT EXISTS idx_learning_interventions_type ON learning_interventions(intervention_type);
CREATE INDEX IF NOT EXISTS idx_learning_interventions_effectiveness ON learning_interventions(effectiveness_score) WHERE effectiveness_score IS NOT NULL;

-- Early warning alerts for instructors
CREATE TABLE IF NOT EXISTS instructor_alerts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    instructor_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    
    -- Alert classification
    alert_type TEXT NOT NULL CHECK (alert_type IN (
        'struggle_risk',
        'disengagement',
        'cognitive_overload', 
        'knowledge_gap',
        'performance_decline',
        'attention_issues'
    )),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    confidence REAL NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
    
    -- Alert content
    alert_message TEXT NOT NULL,
    specific_concerns TEXT NOT NULL, -- JSON array
    recommended_actions TEXT NOT NULL, -- JSON array with priority and expected impact
    trigger_data TEXT, -- JSON blob with supporting data
    
    -- Action tracking
    instructor_viewed BOOLEAN DEFAULT FALSE,
    instructor_acted BOOLEAN DEFAULT FALSE,
    action_taken TEXT,
    action_timestamp TEXT,
    action_effectiveness REAL CHECK (action_effectiveness >= 0.0 AND action_effectiveness <= 1.0),
    
    -- Timing
    created_at TEXT NOT NULL,
    action_deadline TEXT,
    resolved_at TEXT,
    
    -- Privacy compliance
    student_consent_verified BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_instructor_alerts_instructor ON instructor_alerts(tenant_id, instructor_id);
CREATE INDEX IF NOT EXISTS idx_instructor_alerts_student ON instructor_alerts(tenant_id, student_id);
CREATE INDEX IF NOT EXISTS idx_instructor_alerts_course ON instructor_alerts(course_id);
CREATE INDEX IF NOT EXISTS idx_instructor_alerts_severity ON instructor_alerts(severity, created_at);
CREATE INDEX IF NOT EXISTS idx_instructor_alerts_unviewed ON instructor_alerts(instructor_viewed, created_at) WHERE instructor_viewed = FALSE;

-- Advanced behavioral features for ML models
CREATE TABLE IF NOT EXISTS behavioral_features (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    course_id TEXT,
    
    -- Interaction timing features
    avg_response_time REAL NOT NULL,
    response_time_variability REAL NOT NULL,
    session_duration REAL NOT NULL, -- minutes
    break_frequency REAL NOT NULL,
    
    -- Learning engagement features
    help_request_rate REAL NOT NULL,
    error_rate REAL NOT NULL,
    progress_velocity REAL NOT NULL,
    attention_score REAL NOT NULL CHECK (attention_score >= 0.0 AND attention_score <= 1.0),
    
    -- Cognitive load features
    task_switching_frequency REAL NOT NULL,
    cognitive_load_estimate REAL NOT NULL,
    fatigue_indicators REAL NOT NULL CHECK (fatigue_indicators >= 0.0 AND fatigue_indicators <= 1.0),
    
    -- Context features
    time_of_day INTEGER NOT NULL CHECK (time_of_day >= 0 AND time_of_day <= 23),
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    course_progress REAL NOT NULL CHECK (course_progress >= 0.0 AND course_progress <= 1.0),
    
    -- Feature quality
    confidence_level REAL NOT NULL CHECK (confidence_level >= 0.0 AND confidence_level <= 1.0),
    data_points_used INTEGER NOT NULL,
    
    -- Metadata
    extracted_at TEXT NOT NULL,
    valid_until TEXT,
    
    -- Privacy compliance
    consent_verified BOOLEAN NOT NULL DEFAULT FALSE,
    anonymized_at TEXT,
    
    FOREIGN KEY (tenant_id, user_id, session_id) REFERENCES behavioral_patterns(tenant_id, user_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_behavioral_features_user_session ON behavioral_features(tenant_id, user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_behavioral_features_course ON behavioral_features(course_id, extracted_at);
CREATE INDEX IF NOT EXISTS idx_behavioral_features_time ON behavioral_features(time_of_day, day_of_week);
CREATE INDEX IF NOT EXISTS idx_behavioral_features_consent ON behavioral_features(consent_verified, extracted_at);

-- Predictive model metadata and versioning
CREATE TABLE IF NOT EXISTS prediction_models (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    model_name TEXT NOT NULL,
    model_type TEXT NOT NULL CHECK (model_type IN (
        'struggle_prediction',
        'learning_velocity',
        'memory_retention',
        'engagement_prediction',
        'cognitive_load'
    )),
    model_version TEXT NOT NULL,
    
    -- Model configuration
    model_parameters TEXT NOT NULL, -- JSON blob
    feature_weights TEXT, -- JSON blob with feature importance
    training_data_size INTEGER,
    validation_accuracy REAL CHECK (validation_accuracy >= 0.0 AND validation_accuracy <= 1.0),
    
    -- Performance metrics
    precision_score REAL CHECK (precision_score >= 0.0 AND precision_score <= 1.0),
    recall_score REAL CHECK (recall_score >= 0.0 AND recall_score <= 1.0),
    f1_score REAL CHECK (f1_score >= 0.0 AND f1_score <= 1.0),
    
    -- Model lifecycle
    created_at TEXT NOT NULL,
    last_trained_at TEXT,
    last_validation_at TEXT,
    deprecated_at TEXT,
    
    -- Deployment status
    is_active BOOLEAN DEFAULT FALSE,
    deployment_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_prediction_models_tenant_type ON prediction_models(tenant_id, model_type);
CREATE INDEX IF NOT EXISTS idx_prediction_models_active ON prediction_models(is_active, model_type) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_prediction_models_performance ON prediction_models(validation_accuracy, created_at);

-- A/B testing framework for intervention effectiveness
CREATE TABLE IF NOT EXISTS intervention_experiments (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    experiment_name TEXT NOT NULL,
    experiment_type TEXT NOT NULL,
    
    -- Experiment configuration
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    target_population TEXT, -- JSON with selection criteria
    sample_size INTEGER NOT NULL,
    
    -- Variants
    control_group_config TEXT NOT NULL, -- JSON
    treatment_group_config TEXT NOT NULL, -- JSON
    allocation_ratio REAL NOT NULL DEFAULT 0.5, -- 0.5 = 50/50 split
    
    -- Success metrics
    primary_metric TEXT NOT NULL,
    secondary_metrics TEXT, -- JSON array
    significance_level REAL NOT NULL DEFAULT 0.05,
    minimum_effect_size REAL NOT NULL DEFAULT 0.1,
    
    -- Results
    participants_enrolled INTEGER DEFAULT 0,
    control_group_size INTEGER DEFAULT 0,
    treatment_group_size INTEGER DEFAULT 0,
    statistical_power REAL CHECK (statistical_power >= 0.0 AND statistical_power <= 1.0),
    p_value REAL CHECK (p_value >= 0.0 AND p_value <= 1.0),
    effect_size REAL,
    confidence_interval TEXT, -- JSON with lower/upper bounds
    
    -- Status
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN (
        'planned', 'active', 'completed', 'cancelled', 'failed'
    )),
    results_summary TEXT,
    
    -- Metadata
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    created_by TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_intervention_experiments_tenant ON intervention_experiments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_intervention_experiments_status ON intervention_experiments(status, start_date);
CREATE INDEX IF NOT EXISTS idx_intervention_experiments_active ON intervention_experiments(end_date) WHERE status = 'active';

-- Intervention effectiveness tracking
CREATE TABLE IF NOT EXISTS intervention_outcomes (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    intervention_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    experiment_id TEXT, -- Link to A/B test if applicable
    
    -- Outcome measurement
    outcome_type TEXT NOT NULL CHECK (outcome_type IN (
        'learning_improvement',
        'engagement_increase',
        'struggle_reduction',
        'completion_rate',
        'satisfaction_score',
        'time_to_mastery'
    )),
    baseline_value REAL,
    outcome_value REAL NOT NULL,
    improvement REAL, -- Calculated improvement over baseline
    
    -- Measurement context
    measurement_window_hours INTEGER NOT NULL DEFAULT 24,
    measured_at TEXT NOT NULL,
    measurement_method TEXT NOT NULL,
    confidence_level REAL CHECK (confidence_level >= 0.0 AND confidence_level <= 1.0),
    
    -- Attribution
    intervention_delivered_at TEXT NOT NULL,
    outcome_observed_at TEXT NOT NULL,
    causal_confidence REAL CHECK (causal_confidence >= 0.0 AND causal_confidence <= 1.0),
    
    FOREIGN KEY (intervention_id) REFERENCES learning_interventions(id),
    FOREIGN KEY (experiment_id) REFERENCES intervention_experiments(id)
);

CREATE INDEX IF NOT EXISTS idx_intervention_outcomes_intervention ON intervention_outcomes(intervention_id);
CREATE INDEX IF NOT EXISTS idx_intervention_outcomes_user ON intervention_outcomes(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_intervention_outcomes_experiment ON intervention_outcomes(experiment_id) WHERE experiment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_intervention_outcomes_type ON intervention_outcomes(outcome_type, measured_at);

-- Micro-intervention timing optimization data
CREATE TABLE IF NOT EXISTS intervention_timing_analysis (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    course_id TEXT,
    
    -- Timing factors
    attention_level REAL NOT NULL CHECK (attention_level >= 0.0 AND attention_level <= 1.0),
    cognitive_load REAL NOT NULL,
    engagement_score REAL NOT NULL CHECK (engagement_score >= 0.0 AND engagement_score <= 1.0),
    fatigue_level REAL NOT NULL CHECK (fatigue_level >= 0.0 AND fatigue_level <= 1.0),
    
    -- Timing recommendation
    optimal_timing BOOLEAN NOT NULL,
    confidence_score REAL NOT NULL CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    recommended_delay_minutes INTEGER,
    next_optimal_window TEXT,
    intervention_type TEXT NOT NULL CHECK (intervention_type IN ('immediate', 'delayed', 'skip')),
    
    -- Context
    time_of_day INTEGER NOT NULL CHECK (time_of_day >= 0 AND time_of_day <= 23),
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    session_duration_minutes INTEGER NOT NULL,
    
    -- Analysis metadata
    analyzed_at TEXT NOT NULL,
    behavioral_pattern_id TEXT, -- Reference to triggering behavioral pattern
    
    -- Outcome tracking
    intervention_delivered BOOLEAN DEFAULT FALSE,
    intervention_delivered_at TEXT,
    actual_effectiveness REAL CHECK (actual_effectiveness >= 0.0 AND actual_effectiveness <= 1.0),
    
    FOREIGN KEY (behavioral_pattern_id) REFERENCES behavioral_patterns(id)
);

CREATE INDEX IF NOT EXISTS idx_timing_analysis_user ON intervention_timing_analysis(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_timing_analysis_optimal ON intervention_timing_analysis(optimal_timing, analyzed_at);
CREATE INDEX IF NOT EXISTS idx_timing_analysis_time ON intervention_timing_analysis(time_of_day, day_of_week);
CREATE INDEX IF NOT EXISTS idx_timing_analysis_delivered ON intervention_timing_analysis(intervention_delivered) WHERE intervention_delivered = TRUE;

-- Data retention and privacy compliance triggers
CREATE TRIGGER IF NOT EXISTS prediction_results_auto_purge
AFTER INSERT ON prediction_results
WHEN NEW.created_at < date('now', '-90 days')
BEGIN
    DELETE FROM prediction_results WHERE created_at < date('now', '-90 days');
END;

CREATE TRIGGER IF NOT EXISTS learning_interventions_auto_purge  
AFTER INSERT ON learning_interventions
WHEN NEW.purge_at IS NOT NULL AND NEW.purge_at < datetime('now')
BEGIN
    DELETE FROM learning_interventions WHERE purge_at < datetime('now');
END;

-- Performance optimization views
CREATE VIEW IF NOT EXISTS intervention_effectiveness_summary AS
SELECT 
    li.intervention_type,
    COUNT(*) as total_interventions,
    COUNT(li.student_response) as responses,
    ROUND(AVG(CASE WHEN li.student_response = 'accepted' THEN 1.0 ELSE 0.0 END) * 100, 1) as acceptance_rate,
    ROUND(AVG(li.effectiveness_score), 2) as avg_effectiveness,
    COUNT(io.id) as measured_outcomes,
    ROUND(AVG(io.improvement), 2) as avg_improvement
FROM learning_interventions li
LEFT JOIN intervention_outcomes io ON li.id = io.intervention_id
WHERE li.consent_verified = TRUE
GROUP BY li.intervention_type;

CREATE VIEW IF NOT EXISTS student_risk_summary AS
SELECT 
    pr.tenant_id,
    pr.user_id,
    pr.course_id,
    MAX(CASE WHEN pr.prediction_type = 'struggle_prediction' THEN 
        JSON_EXTRACT(pr.prediction_data, '$.riskLevel') 
        ELSE NULL END) as current_struggle_risk,
    MAX(CASE WHEN pr.prediction_type = 'behavioral_analysis' THEN 
        JSON_EXTRACT(pr.prediction_data, '$.cognitiveLoad') 
        ELSE NULL END) as current_cognitive_load,
    MAX(pr.created_at) as last_analysis_at,
    COUNT(DISTINCT li.id) as recent_interventions
FROM prediction_results pr
LEFT JOIN learning_interventions li ON pr.user_id = li.user_id 
    AND li.delivery_timestamp >= date('now', '-7 days')
WHERE pr.created_at >= date('now', '-24 hours')
GROUP BY pr.tenant_id, pr.user_id, pr.course_id;

-- Analytics aggregation for course-level insights (anonymized)
CREATE VIEW IF NOT EXISTS course_learning_patterns AS
SELECT 
    bf.tenant_id,
    bf.course_id,
    bf.time_of_day,
    bf.day_of_week,
    COUNT(*) as session_count,
    ROUND(AVG(bf.avg_response_time), 0) as avg_response_time,
    ROUND(AVG(bf.attention_score), 2) as avg_attention,
    ROUND(AVG(bf.cognitive_load_estimate), 2) as avg_cognitive_load,
    ROUND(AVG(bf.course_progress), 2) as avg_progress,
    COUNT(DISTINCT bf.user_id) as student_count
FROM behavioral_features bf
WHERE bf.consent_verified = TRUE
  AND bf.anonymized_at IS NULL
  AND bf.extracted_at >= date('now', '-30 days')
GROUP BY bf.tenant_id, bf.course_id, bf.time_of_day, bf.day_of_week
HAVING student_count >= 5; -- k-anonymity protection

-- Migration completion marker
INSERT OR REPLACE INTO schema_version (version, applied_at, description) 
VALUES (6, datetime('now'), 'Advanced pattern recognition and predictive interventions for Story 4.2 Phase 1 MVP');