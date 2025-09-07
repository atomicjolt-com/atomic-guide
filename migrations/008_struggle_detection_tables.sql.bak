-- Migration 008: Struggle Detection + Proactive Chat Interventions
-- Story 5.1: Real-time behavioral signal analysis and proactive intervention system
-- Depends on: 005_learner_dna_tables.sql (privacy consent framework)

-- ============================================
-- BEHAVIORAL SIGNALS COLLECTION
-- ============================================

-- Real-time behavioral signals from Canvas monitoring
CREATE TABLE IF NOT EXISTS behavioral_signals (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    
    -- Signal classification
    signal_type TEXT NOT NULL CHECK (signal_type IN (
        'hover', 'scroll', 'idle', 'click', 'help_request', 
        'quiz_interaction', 'page_leave', 'focus_change'
    )),
    
    -- Signal metadata
    duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0 AND duration_ms <= 300000), -- Max 5 minutes
    element_context TEXT NOT NULL, -- Element or content being interacted with
    page_content_hash TEXT NOT NULL, -- Hash of page content for change detection
    
    -- Timing and context
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Security and validation
    nonce TEXT NOT NULL,
    origin TEXT NOT NULL, -- Canvas origin for security validation
    hmac_signature TEXT, -- Message integrity validation
    
    -- Privacy compliance
    consent_verified BOOLEAN DEFAULT FALSE,
    anonymized_at TIMESTAMP,
    purge_at TIMESTAMP, -- Automated data retention
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id, user_id) REFERENCES learner_dna_privacy_consent(tenant_id, user_id)
);

-- Performance-optimized indexes for real-time processing
CREATE INDEX idx_behavioral_signals_session ON behavioral_signals(session_id, timestamp);
CREATE INDEX idx_behavioral_signals_user_time ON behavioral_signals(tenant_id, user_id, timestamp);
CREATE INDEX idx_behavioral_signals_type ON behavioral_signals(signal_type, timestamp);
CREATE INDEX idx_behavioral_signals_processing ON behavioral_signals(tenant_id, user_id, session_id, timestamp);
CREATE INDEX idx_behavioral_signals_purge ON behavioral_signals(purge_at) WHERE purge_at IS NOT NULL;
CREATE INDEX idx_behavioral_signals_consent ON behavioral_signals(consent_verified, created_at);

-- ============================================
-- CANVAS PAGE CONTENT EXTRACTION
-- ============================================

-- Extracted Canvas page content for contextual interventions
CREATE TABLE IF NOT EXISTS canvas_page_content (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    
    -- Page classification
    page_type TEXT NOT NULL CHECK (page_type IN (
        'assignment', 'quiz', 'discussion', 'module', 'page', 'course', 'unknown'
    )),
    
    -- Content metadata
    course_id TEXT,
    module_name TEXT,
    assignment_title TEXT,
    content_text TEXT, -- Extracted text content (truncated to 10000 chars)
    content_hash TEXT NOT NULL, -- Content fingerprint for change detection
    difficulty REAL CHECK (difficulty BETWEEN 0.0 AND 1.0), -- Estimated difficulty
    
    -- Extraction metadata
    extracted_at TIMESTAMP NOT NULL,
    extraction_method TEXT NOT NULL CHECK (extraction_method IN ('canvas_api', 'dom_fallback')),
    metadata JSON DEFAULT '{}', -- Additional extraction metadata
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Indexes for content-aware interventions
CREATE INDEX idx_canvas_content_session ON canvas_page_content(session_id, extracted_at);
CREATE INDEX idx_canvas_content_page_type ON canvas_page_content(page_type, course_id);
CREATE INDEX idx_canvas_content_hash ON canvas_page_content(content_hash);
CREATE INDEX idx_canvas_content_difficulty ON canvas_page_content(difficulty) WHERE difficulty IS NOT NULL;

-- ============================================
-- STRUGGLE DETECTION EVENTS
-- ============================================

-- Detected struggle events with ML analysis results
CREATE TABLE IF NOT EXISTS struggle_events (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    course_id TEXT,
    
    -- Struggle analysis results
    risk_level REAL NOT NULL CHECK (risk_level BETWEEN 0.0 AND 1.0),
    confidence REAL NOT NULL CHECK (confidence BETWEEN 0.0 AND 1.0),
    time_to_struggle_minutes INTEGER, -- Estimated time until struggle
    
    -- Contributing factors (JSON array of factor names)
    contributing_factors JSON NOT NULL DEFAULT '[]',
    
    -- ML model metadata
    model_version TEXT NOT NULL DEFAULT '1.0',
    feature_vector JSON, -- Features used for prediction (for debugging)
    explainability TEXT, -- Human-readable explanation
    
    -- Behavioral signal summary
    signal_count INTEGER NOT NULL DEFAULT 0,
    signal_window_minutes INTEGER NOT NULL DEFAULT 30, -- Analysis window
    
    -- Timestamps and validity
    detected_at TIMESTAMP NOT NULL,
    valid_until TIMESTAMP, -- Prediction validity window
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Outcome tracking
    intervention_triggered BOOLEAN DEFAULT FALSE,
    intervention_effective BOOLEAN, -- Filled after evaluation
    actual_struggle_occurred BOOLEAN, -- Ground truth for model training
    feedback_collected_at TIMESTAMP,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id, user_id) REFERENCES learner_dna_privacy_consent(tenant_id, user_id)
);

-- Indexes for real-time struggle detection and analytics
CREATE INDEX idx_struggle_events_user_time ON struggle_events(tenant_id, user_id, detected_at);
CREATE INDEX idx_struggle_events_session ON struggle_events(session_id, detected_at);
CREATE INDEX idx_struggle_events_risk ON struggle_events(risk_level, confidence, detected_at);
CREATE INDEX idx_struggle_events_course ON struggle_events(course_id, detected_at);
CREATE INDEX idx_struggle_events_intervention ON struggle_events(intervention_triggered, detected_at);
CREATE INDEX idx_struggle_events_effectiveness ON struggle_events(intervention_effective) WHERE intervention_effective IS NOT NULL;
CREATE INDEX idx_struggle_events_validity ON struggle_events(valid_until) WHERE valid_until IS NOT NULL;

-- ============================================
-- PROACTIVE INTERVENTIONS
-- ============================================

-- Proactive chat interventions delivered to students
CREATE TABLE IF NOT EXISTS proactive_interventions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    struggle_event_id TEXT, -- Related struggle detection event
    
    -- Intervention details
    intervention_type TEXT NOT NULL CHECK (intervention_type IN (
        'proactive_chat', 'content_suggestion', 'break_reminder', 'help_offer'
    )),
    message TEXT NOT NULL,
    urgency_level TEXT NOT NULL CHECK (urgency_level IN ('low', 'medium', 'high')),
    
    -- Timing and context
    triggered_at TIMESTAMP NOT NULL,
    delivered_at TIMESTAMP,
    acknowledged_at TIMESTAMP,
    dismissed_at TIMESTAMP,
    
    -- Context information
    page_content_hash TEXT, -- Page context when intervention was triggered
    cognitive_load_estimate REAL CHECK (cognitive_load_estimate BETWEEN 0.0 AND 1.0),
    attention_level REAL CHECK (attention_level BETWEEN 0.0 AND 1.0),
    
    -- Outcome tracking
    user_response TEXT CHECK (user_response IN ('accepted', 'dismissed', 'ignored', 'timeout')),
    response_time_ms INTEGER, -- Time from delivery to response
    subsequent_engagement_change REAL, -- Change in engagement after intervention
    
    -- A/B testing and optimization
    strategy_variant TEXT, -- Different intervention strategies
    personalization_factors JSON DEFAULT '{}', -- Factors used for personalization
    
    -- Effectiveness measurement
    effectiveness_score REAL CHECK (effectiveness_score BETWEEN 0.0 AND 1.0),
    effectiveness_measured_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (struggle_event_id) REFERENCES struggle_events(id) ON DELETE SET NULL,
    FOREIGN KEY (tenant_id, user_id) REFERENCES learner_dna_privacy_consent(tenant_id, user_id)
);

-- Indexes for intervention analytics and optimization
CREATE INDEX idx_interventions_user_time ON proactive_interventions(tenant_id, user_id, triggered_at);
CREATE INDEX idx_interventions_session ON proactive_interventions(session_id, triggered_at);
CREATE INDEX idx_interventions_type ON proactive_interventions(intervention_type, urgency_level);
CREATE INDEX idx_interventions_response ON proactive_interventions(user_response, response_time_ms);
CREATE INDEX idx_interventions_effectiveness ON proactive_interventions(effectiveness_score) WHERE effectiveness_score IS NOT NULL;
CREATE INDEX idx_interventions_struggle ON proactive_interventions(struggle_event_id) WHERE struggle_event_id IS NOT NULL;
CREATE INDEX idx_interventions_delivery ON proactive_interventions(delivered_at) WHERE delivered_at IS NOT NULL;

-- ============================================
-- INSTRUCTOR EARLY WARNING ALERTS
-- ============================================

-- Early warning alerts sent to instructors
CREATE TABLE IF NOT EXISTS instructor_alerts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    instructor_user_id TEXT NOT NULL,
    student_user_id TEXT NOT NULL,
    
    -- Alert details
    alert_type TEXT NOT NULL CHECK (alert_type IN (
        'struggle_detected', 'engagement_drop', 'help_requests_spike', 'performance_decline'
    )),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    message TEXT NOT NULL,
    
    -- Risk assessment
    risk_score REAL NOT NULL CHECK (risk_score BETWEEN 0.0 AND 1.0),
    confidence REAL NOT NULL CHECK (confidence BETWEEN 0.0 AND 1.0),
    time_window_hours INTEGER NOT NULL DEFAULT 24, -- Analysis time window
    
    -- Supporting evidence
    struggle_events_count INTEGER NOT NULL DEFAULT 0,
    behavioral_signals_count INTEGER NOT NULL DEFAULT 0,
    intervention_attempts_count INTEGER NOT NULL DEFAULT 0,
    
    -- Privacy and anonymization
    student_anonymized BOOLEAN DEFAULT FALSE,
    anonymization_level TEXT CHECK (anonymization_level IN ('none', 'partial', 'full')),
    
    -- Alert lifecycle
    generated_at TIMESTAMP NOT NULL,
    delivered_at TIMESTAMP,
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    
    -- Instructor actions
    instructor_response TEXT CHECK (instructor_response IN (
        'contacted_student', 'adjusted_content', 'provided_resources', 
        'referred_support', 'no_action', 'false_positive'
    )),
    action_taken_at TIMESTAMP,
    action_notes TEXT,
    
    -- Effectiveness tracking
    student_outcome_improved BOOLEAN,
    outcome_measured_at TIMESTAMP,
    alert_accuracy BOOLEAN, -- Whether alert was accurate/useful
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id, student_user_id) REFERENCES learner_dna_privacy_consent(tenant_id, user_id)
);

-- Indexes for instructor dashboard and alert management
CREATE INDEX idx_instructor_alerts_instructor ON instructor_alerts(instructor_user_id, generated_at);
CREATE INDEX idx_instructor_alerts_course ON instructor_alerts(course_id, severity, generated_at);
CREATE INDEX idx_instructor_alerts_student ON instructor_alerts(tenant_id, student_user_id, generated_at);
CREATE INDEX idx_instructor_alerts_unresolved ON instructor_alerts(resolved_at, severity) WHERE resolved_at IS NULL;
CREATE INDEX idx_instructor_alerts_risk ON instructor_alerts(risk_score, confidence);
CREATE INDEX idx_instructor_alerts_response ON instructor_alerts(instructor_response, action_taken_at);
CREATE INDEX idx_instructor_alerts_outcome ON instructor_alerts(student_outcome_improved) WHERE student_outcome_improved IS NOT NULL;

-- ============================================
-- SESSION ANALYTICS AND PATTERNS
-- ============================================

-- Session-level analytics for struggle detection pattern analysis
CREATE TABLE IF NOT EXISTS struggle_session_analytics (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    course_id TEXT,
    
    -- Session metadata
    session_start TIMESTAMP NOT NULL,
    session_end TIMESTAMP,
    session_duration_minutes INTEGER,
    
    -- Behavioral signal summary
    total_signals INTEGER NOT NULL DEFAULT 0,
    hover_signals INTEGER NOT NULL DEFAULT 0,
    scroll_signals INTEGER NOT NULL DEFAULT 0,
    idle_signals INTEGER NOT NULL DEFAULT 0,
    help_request_signals INTEGER NOT NULL DEFAULT 0,
    
    -- Engagement metrics
    avg_response_time_ms INTEGER,
    response_time_variability REAL,
    page_switches INTEGER DEFAULT 0,
    content_interactions INTEGER DEFAULT 0,
    
    -- Cognitive load indicators
    estimated_cognitive_load REAL CHECK (estimated_cognitive_load BETWEEN 0.0 AND 1.0),
    attention_score REAL CHECK (attention_score BETWEEN 0.0 AND 1.0),
    fatigue_level REAL CHECK (fatigue_level BETWEEN 0.0 AND 1.0),
    
    -- Struggle indicators
    struggle_events_count INTEGER DEFAULT 0,
    max_risk_level REAL CHECK (max_risk_level BETWEEN 0.0 AND 1.0),
    interventions_triggered INTEGER DEFAULT 0,
    interventions_accepted INTEGER DEFAULT 0,
    
    -- Learning outcomes (when available)
    assessment_scores JSON DEFAULT '[]', -- Array of assessment scores during session
    content_completion_rate REAL CHECK (content_completion_rate BETWEEN 0.0 AND 1.0),
    
    -- Analytics metadata
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    analysis_version TEXT DEFAULT '1.0',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id, user_id) REFERENCES learner_dna_privacy_consent(tenant_id, user_id)
);

-- Indexes for session pattern analysis
CREATE INDEX idx_session_analytics_user ON struggle_session_analytics(tenant_id, user_id, session_start);
CREATE INDEX idx_session_analytics_course ON struggle_session_analytics(course_id, session_start);
CREATE INDEX idx_session_analytics_struggle ON struggle_session_analytics(struggle_events_count, max_risk_level);
CREATE INDEX idx_session_analytics_cognitive ON struggle_session_analytics(estimated_cognitive_load, attention_score);
CREATE INDEX idx_session_analytics_outcomes ON struggle_session_analytics(content_completion_rate) WHERE content_completion_rate IS NOT NULL;

-- ============================================
-- PREDICTION MODEL TRACKING
-- ============================================

-- Model performance and accuracy tracking for continuous improvement
CREATE TABLE IF NOT EXISTS prediction_results (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    course_id TEXT,
    
    -- Prediction details
    prediction_type TEXT NOT NULL CHECK (prediction_type IN (
        'struggle_prediction', 'velocity_forecast', 'intervention_timing',
        'cognitive_load_assessment', 'engagement_prediction'
    )),
    prediction_data JSON NOT NULL, -- Full prediction result
    confidence_score REAL NOT NULL CHECK (confidence_score BETWEEN 0.0 AND 1.0),
    
    -- Model information
    model_version TEXT NOT NULL DEFAULT '1.0',
    feature_importance JSON DEFAULT '{}',
    processing_time_ms INTEGER,
    
    -- Validation and outcomes
    ground_truth_available BOOLEAN DEFAULT FALSE,
    ground_truth_value JSON, -- Actual outcome for comparison
    prediction_accurate BOOLEAN, -- Whether prediction matched reality
    accuracy_measured_at TIMESTAMP,
    
    -- Context
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    prediction_horizon_minutes INTEGER, -- How far into future prediction was made
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Indexes for model performance analysis
CREATE INDEX idx_prediction_results_type ON prediction_results(prediction_type, model_version, created_at);
CREATE INDEX idx_prediction_results_accuracy ON prediction_results(prediction_accurate, prediction_type) WHERE prediction_accurate IS NOT NULL;
CREATE INDEX idx_prediction_results_confidence ON prediction_results(confidence_score, prediction_type);
CREATE INDEX idx_prediction_results_performance ON prediction_results(processing_time_ms);

-- ============================================
-- DATA RETENTION AND CLEANUP
-- ============================================

-- Automated data retention triggers
CREATE TRIGGER IF NOT EXISTS set_behavioral_signals_purge_date
    AFTER INSERT ON behavioral_signals
    FOR EACH ROW
    WHEN NEW.purge_at IS NULL
BEGIN
    UPDATE behavioral_signals 
    SET purge_at = datetime(NEW.created_at, '+730 days') -- 2 year retention default
    WHERE id = NEW.id;
END;

-- Privacy consent withdrawal cleanup
CREATE TRIGGER IF NOT EXISTS cleanup_on_consent_withdrawal
    AFTER UPDATE ON learner_dna_privacy_consent
    FOR EACH ROW
    WHEN OLD.withdrawal_completed_at IS NULL AND NEW.withdrawal_completed_at IS NOT NULL
BEGIN
    -- Mark behavioral signals for immediate purge
    UPDATE behavioral_signals 
    SET purge_at = CURRENT_TIMESTAMP
    WHERE tenant_id = NEW.tenant_id AND user_id = NEW.user_id;
    
    -- Mark struggle events for anonymization
    UPDATE struggle_events
    SET user_id = 'anonymized_' || substr(user_id, 1, 8)
    WHERE tenant_id = NEW.tenant_id AND user_id = NEW.user_id;
    
    -- Anonymize interventions
    UPDATE proactive_interventions
    SET user_id = 'anonymized_' || substr(user_id, 1, 8)
    WHERE tenant_id = NEW.tenant_id AND user_id = NEW.user_id;
END;

-- ============================================
-- PERFORMANCE MONITORING
-- ============================================

-- Real-time processing performance metrics
CREATE TABLE IF NOT EXISTS processing_metrics (
    id TEXT PRIMARY KEY,
    metric_type TEXT NOT NULL CHECK (metric_type IN (
        'signal_processing_latency', 'struggle_detection_latency', 
        'intervention_delivery_latency', 'content_extraction_latency'
    )),
    value_ms INTEGER NOT NULL,
    tenant_id TEXT,
    session_id TEXT,
    measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Context for performance analysis
    concurrent_sessions INTEGER,
    system_load REAL,
    additional_context JSON DEFAULT '{}'
);

-- Index for performance monitoring
CREATE INDEX idx_processing_metrics_type_time ON processing_metrics(metric_type, measured_at);
CREATE INDEX idx_processing_metrics_performance ON processing_metrics(value_ms, metric_type);

-- ============================================
-- SCHEMA VALIDATION AND CONSTRAINTS
-- ============================================

-- Ensure behavioral signals have valid consent
CREATE TRIGGER IF NOT EXISTS validate_behavioral_signal_consent
    BEFORE INSERT ON behavioral_signals
    FOR EACH ROW
BEGIN
    SELECT CASE 
        WHEN NOT EXISTS (
            SELECT 1 FROM learner_dna_privacy_consent 
            WHERE tenant_id = NEW.tenant_id 
              AND user_id = NEW.user_id 
              AND behavioral_timing_consent = TRUE
              AND withdrawal_completed_at IS NULL
        ) THEN RAISE(ABORT, 'Behavioral timing consent required')
    END;
END;

-- Ensure instructor alerts respect student privacy settings
CREATE TRIGGER IF NOT EXISTS validate_instructor_alert_privacy
    BEFORE INSERT ON instructor_alerts
    FOR EACH ROW
BEGIN
    SELECT CASE 
        WHEN NOT EXISTS (
            SELECT 1 FROM learner_dna_privacy_consent 
            WHERE tenant_id = NEW.tenant_id 
              AND user_id = NEW.student_user_id 
              AND anonymized_analytics_consent = TRUE
              AND withdrawal_completed_at IS NULL
        ) THEN RAISE(ABORT, 'Student has not consented to instructor analytics')
    END;
END;