-- Prediction results storage
CREATE TABLE IF NOT EXISTS prediction_results (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    prediction_type TEXT NOT NULL,
    prediction_data TEXT NOT NULL,
    confidence_score REAL NOT NULL,
    actual_outcome TEXT,
    accuracy_score REAL,
    created_at TEXT NOT NULL,
    validated_at TEXT
);

-- Learning interventions tracking
CREATE TABLE IF NOT EXISTS learning_interventions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    course_id TEXT,
    intervention_type TEXT NOT NULL,
    priority TEXT NOT NULL,
    trigger_pattern TEXT NOT NULL,
    recommended_action TEXT NOT NULL,
    target_cognitive_attribute TEXT,
    expected_outcome TEXT,
    measurement_criteria TEXT,
    delivery_timestamp TEXT NOT NULL,
    student_response TEXT,
    response_timestamp TEXT,
    effectiveness_score REAL,
    follow_up_required BOOLEAN DEFAULT FALSE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    consent_verified BOOLEAN NOT NULL DEFAULT FALSE,
    purge_at TEXT
);

-- Early warning alerts for instructors
CREATE TABLE IF NOT EXISTS instructor_alerts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    instructor_id TEXT NOT NULL,
    student_ids TEXT NOT NULL,
    course_id TEXT NOT NULL,
    alert_type TEXT NOT NULL,
    priority TEXT NOT NULL,
    confidence REAL NOT NULL,
    alert_data TEXT NOT NULL,
    alert_message TEXT NOT NULL,
    specific_concerns TEXT NOT NULL,
    recommended_actions TEXT NOT NULL,
    trigger_data TEXT,
    acknowledged BOOLEAN DEFAULT FALSE,
    dismissed BOOLEAN DEFAULT FALSE,
    viewed BOOLEAN DEFAULT FALSE,
    instructor_acted BOOLEAN DEFAULT FALSE,
    action_taken TEXT,
    action_timestamp TEXT,
    action_effectiveness REAL,
    created_at TEXT NOT NULL,
    action_deadline TEXT,
    resolved_at TEXT,
    student_consent_verified BOOLEAN NOT NULL DEFAULT FALSE
);

-- Behavioral features
CREATE TABLE IF NOT EXISTS behavioral_features (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    course_id TEXT,
    avg_response_time REAL NOT NULL,
    response_time_variability REAL NOT NULL,
    session_duration REAL NOT NULL,
    break_frequency REAL NOT NULL,
    help_request_rate REAL NOT NULL,
    error_rate REAL NOT NULL,
    progress_velocity REAL NOT NULL,
    attention_score REAL NOT NULL,
    task_switching_frequency REAL NOT NULL,
    cognitive_load_estimate REAL NOT NULL,
    fatigue_indicators REAL NOT NULL,
    time_of_day INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL,
    course_progress REAL NOT NULL,
    confidence_level REAL NOT NULL,
    data_points_used INTEGER NOT NULL,
    extracted_at TEXT NOT NULL,
    valid_until TEXT,
    consent_verified BOOLEAN NOT NULL DEFAULT FALSE,
    anonymized_at TEXT
);

-- Predictive model metadata
CREATE TABLE IF NOT EXISTS prediction_models (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    model_name TEXT NOT NULL,
    model_type TEXT NOT NULL,
    model_version TEXT NOT NULL,
    model_parameters TEXT NOT NULL,
    feature_weights TEXT,
    training_data_size INTEGER,
    validation_accuracy REAL,
    precision_score REAL,
    recall_score REAL,
    f1_score REAL,
    created_at TEXT NOT NULL,
    last_trained_at TEXT,
    last_validation_at TEXT,
    deprecated_at TEXT,
    is_active BOOLEAN DEFAULT FALSE,
    deployment_notes TEXT
);

-- A/B testing framework
CREATE TABLE IF NOT EXISTS intervention_experiments (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    experiment_name TEXT NOT NULL,
    experiment_type TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    target_population TEXT,
    sample_size INTEGER NOT NULL,
    control_group_config TEXT NOT NULL,
    treatment_group_config TEXT NOT NULL,
    allocation_ratio REAL NOT NULL DEFAULT 0.5,
    primary_metric TEXT NOT NULL,
    secondary_metrics TEXT,
    significance_level REAL NOT NULL DEFAULT 0.05,
    minimum_effect_size REAL NOT NULL DEFAULT 0.1,
    participants_enrolled INTEGER DEFAULT 0,
    control_group_size INTEGER DEFAULT 0,
    treatment_group_size INTEGER DEFAULT 0,
    statistical_power REAL,
    p_value REAL,
    effect_size REAL,
    confidence_interval TEXT,
    status TEXT NOT NULL DEFAULT 'planned',
    results_summary TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    created_by TEXT NOT NULL
);

-- Intervention effectiveness tracking
CREATE TABLE IF NOT EXISTS intervention_outcomes (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    intervention_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    experiment_id TEXT,
    outcome_type TEXT NOT NULL,
    baseline_value REAL,
    outcome_value REAL NOT NULL,
    improvement REAL,
    measurement_window_hours INTEGER NOT NULL DEFAULT 24,
    measured_at TEXT NOT NULL,
    measurement_method TEXT NOT NULL,
    confidence_level REAL,
    intervention_delivered_at TEXT NOT NULL,
    outcome_observed_at TEXT NOT NULL,
    causal_confidence REAL
);

-- Micro-intervention timing optimization
CREATE TABLE IF NOT EXISTS intervention_timing_analysis (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    course_id TEXT,
    attention_level REAL NOT NULL,
    cognitive_load REAL NOT NULL,
    engagement_score REAL NOT NULL,
    fatigue_level REAL NOT NULL,
    optimal_timing BOOLEAN NOT NULL,
    confidence_score REAL NOT NULL,
    recommended_delay_minutes INTEGER,
    next_optimal_window TEXT,
    intervention_type TEXT NOT NULL,
    time_of_day INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL,
    session_duration_minutes INTEGER NOT NULL,
    analyzed_at TEXT NOT NULL,
    behavioral_pattern_id TEXT,
    intervention_delivered BOOLEAN DEFAULT FALSE,
    intervention_delivered_at TEXT,
    actual_effectiveness REAL
);