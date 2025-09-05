-- Migration 005: Learner DNA Foundation - Cognitive Pattern Recognition and Data Collection
-- Story 4.1: Implements privacy-first cognitive profiling with FERPA/COPPA/GDPR compliance
-- Builds upon Epic 3 analytics foundation for behavioral pattern analysis

-- ============================================
-- PRIVACY CONSENT AND CONTROL FRAMEWORK
-- ============================================

-- Comprehensive privacy consent tracking with versioning
CREATE TABLE IF NOT EXISTS learner_dna_privacy_consent (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    consent_version TEXT NOT NULL DEFAULT '1.0',
    
    -- Granular permission controls
    behavioral_timing_consent BOOLEAN DEFAULT FALSE,
    assessment_patterns_consent BOOLEAN DEFAULT FALSE,
    chat_interactions_consent BOOLEAN DEFAULT FALSE,
    cross_course_correlation_consent BOOLEAN DEFAULT FALSE,
    anonymized_analytics_consent BOOLEAN DEFAULT TRUE,
    
    -- Data collection levels: 'minimal', 'standard', 'comprehensive'
    data_collection_level TEXT NOT NULL DEFAULT 'minimal' CHECK (data_collection_level IN ('minimal', 'standard', 'comprehensive')),
    
    -- Parent/guardian consent for COPPA compliance (students under 13)
    parental_consent_required BOOLEAN DEFAULT FALSE,
    parental_consent_given BOOLEAN DEFAULT FALSE,
    parental_email TEXT,
    
    -- Consent metadata
    consent_given_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    consent_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    withdrawal_requested_at TIMESTAMP,
    withdrawal_completed_at TIMESTAMP,
    withdrawal_reason TEXT,
    
    -- Audit and compliance tracking
    consent_source TEXT DEFAULT 'dashboard', -- 'dashboard', 'onboarding', 'policy_update'
    ip_address TEXT,
    user_agent TEXT,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, user_id, consent_version)
);

CREATE INDEX idx_dna_consent_user ON learner_dna_privacy_consent(tenant_id, user_id);
CREATE INDEX idx_dna_consent_level ON learner_dna_privacy_consent(data_collection_level, consent_given_at);
CREATE INDEX idx_dna_consent_withdrawn ON learner_dna_privacy_consent(withdrawal_requested_at);
CREATE INDEX idx_dna_consent_parental ON learner_dna_privacy_consent(parental_consent_required, parental_consent_given);

-- Data retention policies and automated purging
CREATE TABLE IF NOT EXISTS learner_dna_retention_policies (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    policy_name TEXT NOT NULL,
    data_type TEXT NOT NULL, -- 'behavioral_patterns', 'cognitive_profiles', 'anonymized_aggregates'
    retention_days INTEGER NOT NULL DEFAULT 730, -- 2 years default
    auto_purge_enabled BOOLEAN DEFAULT TRUE,
    anonymization_delay_days INTEGER DEFAULT 90, -- Anonymize after 90 days
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, policy_name, data_type)
);

CREATE INDEX idx_dna_retention_tenant ON learner_dna_retention_policies(tenant_id, data_type);

-- ============================================
-- BEHAVIORAL PATTERN COLLECTION FOUNDATION
-- ============================================

-- Core behavioral pattern storage with encryption-ready structure
CREATE TABLE IF NOT EXISTS behavioral_patterns (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    
    -- Pattern classification
    pattern_type TEXT NOT NULL CHECK (pattern_type IN (
        'interaction_timing', 'learning_velocity', 'memory_retention', 
        'comprehension_style', 'struggle_indicators', 'content_preferences'
    )),
    context_type TEXT NOT NULL CHECK (context_type IN ('chat', 'assessment', 'content_review', 'navigation')),
    
    -- Encrypted behavioral data (JSON string encrypted at rest)
    raw_data_encrypted TEXT NOT NULL,
    raw_data_hash TEXT NOT NULL, -- SHA-256 for integrity verification
    
    -- Aggregated metrics (safe for analysis)
    aggregated_metrics JSON NOT NULL DEFAULT '{}',
    confidence_level REAL NOT NULL DEFAULT 0.0 CHECK (confidence_level BETWEEN 0.0 AND 1.0),
    
    -- Context and timing
    course_id TEXT,
    content_id TEXT,
    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    anonymized_at TIMESTAMP, -- When personally identifiable patterns were removed
    purge_at TIMESTAMP, -- Scheduled for deletion based on retention policy
    
    -- Privacy compliance flags
    privacy_level TEXT DEFAULT 'identifiable' CHECK (privacy_level IN ('identifiable', 'pseudonymized', 'anonymized')),
    consent_verified BOOLEAN DEFAULT FALSE,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id, user_id, consent_verified) REFERENCES learner_dna_privacy_consent(tenant_id, user_id, behavioral_timing_consent)
);

CREATE INDEX idx_behavioral_patterns_user ON behavioral_patterns(tenant_id, user_id, pattern_type);
CREATE INDEX idx_behavioral_patterns_session ON behavioral_patterns(session_id, collected_at);
CREATE INDEX idx_behavioral_patterns_purge ON behavioral_patterns(purge_at);
CREATE INDEX idx_behavioral_patterns_context ON behavioral_patterns(tenant_id, course_id, context_type);
CREATE INDEX idx_behavioral_patterns_privacy ON behavioral_patterns(privacy_level, anonymized_at);

-- ============================================
-- COGNITIVE PROFILING ENGINE
-- ============================================

-- Core Learner DNA cognitive profiles
CREATE TABLE IF NOT EXISTS learner_dna_profiles (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    
    -- Core cognitive attributes with confidence scoring
    learning_velocity_value REAL DEFAULT 1.0,
    learning_velocity_confidence REAL DEFAULT 0.0,
    learning_velocity_data_points INTEGER DEFAULT 0,
    learning_velocity_last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    memory_retention_value REAL DEFAULT 1.0,
    memory_retention_confidence REAL DEFAULT 0.0,
    memory_retention_data_points INTEGER DEFAULT 0,
    memory_retention_last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    struggle_threshold_value REAL DEFAULT 0.5,
    struggle_threshold_confidence REAL DEFAULT 0.0,
    struggle_threshold_data_points INTEGER DEFAULT 0,
    struggle_threshold_last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Comprehensive cognitive attributes as JSON
    cognitive_attributes JSON NOT NULL DEFAULT '{}',
    comprehension_styles JSON NOT NULL DEFAULT '[]',
    preferred_modalities JSON NOT NULL DEFAULT '[]',
    
    -- Profile metadata and quality
    profile_confidence REAL DEFAULT 0.0 CHECK (profile_confidence BETWEEN 0.0 AND 1.0),
    total_data_points INTEGER DEFAULT 0,
    analysis_quality_score REAL DEFAULT 0.0,
    
    -- Temporal tracking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Cross-course intelligence foundation
    cross_course_patterns JSON DEFAULT '{}',
    multi_context_confidence REAL DEFAULT 0.0,
    
    -- Privacy and consent tracking
    data_collection_level TEXT DEFAULT 'minimal',
    profile_visibility TEXT DEFAULT 'private' CHECK (profile_visibility IN ('private', 'course_aggregate', 'anonymized')),
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, user_id)
);

CREATE INDEX idx_dna_profiles_user ON learner_dna_profiles(tenant_id, user_id);
CREATE INDEX idx_dna_profiles_confidence ON learner_dna_profiles(profile_confidence, total_data_points);
CREATE INDEX idx_dna_profiles_updated ON learner_dna_profiles(updated_at DESC);
CREATE INDEX idx_dna_profiles_visibility ON learner_dna_profiles(profile_visibility, analysis_quality_score);

-- Detailed cognitive attribute tracking
CREATE TABLE IF NOT EXISTS cognitive_attributes (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    attribute_name TEXT NOT NULL,
    attribute_type TEXT NOT NULL CHECK (attribute_type IN (
        'learning_velocity', 'memory_retention', 'comprehension_style', 
        'struggle_threshold', 'preferred_modality', 'engagement_pattern'
    )),
    
    -- Attribute value and metadata
    attribute_value REAL NOT NULL,
    attribute_metadata JSON DEFAULT '{}',
    confidence_score REAL NOT NULL DEFAULT 0.0,
    data_points_count INTEGER NOT NULL DEFAULT 1,
    evidence_source TEXT NOT NULL CHECK (evidence_source IN ('assessment', 'chat', 'timing', 'behavior', 'manual')),
    
    -- Statistical validation
    statistical_significance REAL,
    noise_filtered BOOLEAN DEFAULT FALSE,
    outlier_removed BOOLEAN DEFAULT FALSE,
    
    -- Temporal tracking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_evidence_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (profile_id) REFERENCES learner_dna_profiles(id) ON DELETE CASCADE,
    UNIQUE(profile_id, attribute_name, attribute_type)
);

CREATE INDEX idx_cognitive_attributes_profile ON cognitive_attributes(profile_id, attribute_type);
CREATE INDEX idx_cognitive_attributes_confidence ON cognitive_attributes(confidence_score, data_points_count);
CREATE INDEX idx_cognitive_attributes_significance ON cognitive_attributes(statistical_significance);

-- ============================================
-- LEARNING ANALYTICS AND PATTERN RECOGNITION
-- ============================================

-- Learning velocity calculation data
CREATE TABLE IF NOT EXISTS learning_velocity_data (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    profile_id TEXT NOT NULL,
    
    -- Concept and context
    concept_id TEXT NOT NULL,
    concept_name TEXT NOT NULL,
    course_id TEXT,
    difficulty_level REAL NOT NULL,
    
    -- Time-to-mastery metrics
    time_to_mastery_minutes INTEGER NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 1,
    mastery_threshold REAL NOT NULL DEFAULT 0.8,
    mastery_confidence REAL NOT NULL,
    
    -- Context factors
    prior_knowledge_level REAL,
    struggled_concepts JSON DEFAULT '[]',
    acceleration_factors JSON DEFAULT '[]',
    
    -- Temporal data
    started_at TIMESTAMP NOT NULL,
    mastery_achieved_at TIMESTAMP NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (profile_id) REFERENCES learner_dna_profiles(id) ON DELETE CASCADE
);

CREATE INDEX idx_velocity_data_profile ON learning_velocity_data(profile_id, concept_id);
CREATE INDEX idx_velocity_data_course ON learning_velocity_data(tenant_id, course_id, difficulty_level);
CREATE INDEX idx_velocity_data_mastery ON learning_velocity_data(time_to_mastery_minutes, mastery_confidence);

-- Memory retention curve analysis
CREATE TABLE IF NOT EXISTS memory_retention_analysis (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    profile_id TEXT NOT NULL,
    
    -- Concept tracking
    concept_id TEXT NOT NULL,
    initial_mastery_level REAL NOT NULL,
    current_retention_level REAL NOT NULL,
    
    -- Forgetting curve parameters (Ebbinghaus model)
    forgetting_curve_slope REAL NOT NULL,
    memory_strength_factor REAL NOT NULL,
    retention_half_life_days REAL NOT NULL,
    
    -- Optimal review timing
    optimal_review_interval_days INTEGER NOT NULL,
    next_review_recommended_at TIMESTAMP,
    
    -- Performance tracking
    review_sessions_count INTEGER DEFAULT 0,
    retention_accuracy_score REAL,
    interference_factors JSON DEFAULT '[]',
    
    -- Analysis metadata
    analysis_confidence REAL NOT NULL DEFAULT 0.0,
    data_points_used INTEGER NOT NULL DEFAULT 1,
    last_assessment_at TIMESTAMP NOT NULL,
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (profile_id) REFERENCES learner_dna_profiles(id) ON DELETE CASCADE,
    UNIQUE(profile_id, concept_id)
);

CREATE INDEX idx_memory_analysis_profile ON memory_retention_analysis(profile_id);
CREATE INDEX idx_memory_analysis_review ON memory_retention_analysis(next_review_recommended_at);
CREATE INDEX idx_memory_analysis_retention ON memory_retention_analysis(current_retention_level, analysis_confidence);

-- ============================================
-- PRIVACY-PROTECTED ANALYTICS AGGREGATION
-- ============================================

-- Course-level anonymized cognitive insights with differential privacy
CREATE TABLE IF NOT EXISTS anonymized_cognitive_insights (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    
    -- Aggregation metadata
    aggregation_type TEXT NOT NULL CHECK (aggregation_type IN ('course', 'module', 'concept', 'cohort')),
    aggregation_level TEXT NOT NULL,
    sample_size INTEGER NOT NULL,
    
    -- Anonymized cognitive metrics
    avg_learning_velocity REAL,
    median_learning_velocity REAL,
    learning_velocity_std_dev REAL,
    
    avg_memory_retention REAL,
    median_memory_retention REAL,
    memory_retention_std_dev REAL,
    
    common_struggle_patterns JSON DEFAULT '[]',
    effective_modalities JSON DEFAULT '[]',
    
    -- Differential privacy protection
    epsilon_privacy_budget REAL NOT NULL DEFAULT 1.0,
    noise_scale_applied REAL NOT NULL,
    k_anonymity_threshold INTEGER NOT NULL DEFAULT 5,
    
    -- Statistical metadata
    confidence_interval REAL DEFAULT 0.95,
    statistical_significance REAL,
    margin_of_error REAL,
    
    -- Temporal tracking
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP,
    data_freshness_score REAL DEFAULT 1.0,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_cognitive_insights_course ON anonymized_cognitive_insights(tenant_id, course_id);
CREATE INDEX idx_cognitive_insights_type ON anonymized_cognitive_insights(aggregation_type, calculated_at);
CREATE INDEX idx_cognitive_insights_valid ON anonymized_cognitive_insights(valid_until);

-- Cross-course pattern correlation (privacy-preserving)
CREATE TABLE IF NOT EXISTS cross_course_patterns (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    pattern_name TEXT NOT NULL,
    pattern_type TEXT NOT NULL CHECK (pattern_type IN ('velocity_correlation', 'retention_similarity', 'modality_preference', 'struggle_commonality')),
    
    -- Anonymous pattern data
    course_contexts JSON NOT NULL, -- Anonymized course identifiers
    pattern_strength REAL NOT NULL,
    statistical_confidence REAL NOT NULL,
    correlation_coefficient REAL,
    
    -- Sample and privacy protection
    sample_size INTEGER NOT NULL,
    privacy_protection_level TEXT NOT NULL DEFAULT 'anonymized',
    zero_knowledge_proof TEXT, -- For advanced privacy-preserving analysis
    
    -- Pattern metadata
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    validation_score REAL,
    educational_impact_score REAL,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_cross_course_patterns_tenant ON cross_course_patterns(tenant_id, pattern_type);
CREATE INDEX idx_cross_course_patterns_strength ON cross_course_patterns(pattern_strength, statistical_confidence);

-- ============================================
-- DATA PROCESSING AND QUALITY ASSURANCE
-- ============================================

-- Cognitive processing queue for async pattern analysis
CREATE TABLE IF NOT EXISTS cognitive_processing_queue (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    task_type TEXT NOT NULL CHECK (task_type IN (
        'behavioral_analysis', 'cognitive_profile_update', 'pattern_recognition', 
        'privacy_compliance_check', 'data_anonymization', 'retention_policy_enforcement'
    )),
    
    -- Task data and priority
    task_data JSON NOT NULL,
    priority_level INTEGER NOT NULL DEFAULT 5, -- 1 (urgent) to 10 (low)
    processing_complexity TEXT DEFAULT 'standard' CHECK (processing_complexity IN ('simple', 'standard', 'complex')),
    
    -- Status tracking
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retry')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Performance and error tracking
    processing_duration_ms INTEGER,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Privacy and compliance flags
    privacy_sensitive BOOLEAN DEFAULT TRUE,
    compliance_verified BOOLEAN DEFAULT FALSE,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_cognitive_queue_status ON cognitive_processing_queue(status, priority_level, created_at);
CREATE INDEX idx_cognitive_queue_tenant ON cognitive_processing_queue(tenant_id, task_type);
CREATE INDEX idx_cognitive_queue_pending ON cognitive_processing_queue(status, created_at) 
    WHERE status = 'pending';

-- Cognitive profiling accuracy and validation tracking
CREATE TABLE IF NOT EXISTS cognitive_profile_validation (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    profile_id TEXT NOT NULL,
    validation_type TEXT NOT NULL CHECK (validation_type IN (
        'prediction_accuracy', 'pattern_consistency', 'cross_validation', 'noise_detection'
    )),
    
    -- Validation metrics
    accuracy_score REAL NOT NULL,
    confidence_interval REAL NOT NULL,
    validation_sample_size INTEGER NOT NULL,
    
    -- Validation details
    validation_data JSON NOT NULL,
    baseline_comparison REAL,
    improvement_over_baseline REAL,
    
    -- Temporal tracking
    validated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    validation_period_days INTEGER NOT NULL,
    next_validation_due TIMESTAMP,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (profile_id) REFERENCES learner_dna_profiles(id) ON DELETE CASCADE
);

CREATE INDEX idx_profile_validation_profile ON cognitive_profile_validation(profile_id, validation_type);
CREATE INDEX idx_profile_validation_accuracy ON cognitive_profile_validation(accuracy_score, validated_at);
CREATE INDEX idx_profile_validation_due ON cognitive_profile_validation(next_validation_due);

-- ============================================
-- AUDIT AND COMPLIANCE FRAMEWORK
-- ============================================

-- Comprehensive audit log for cognitive profiling operations
CREATE TABLE IF NOT EXISTS learner_dna_audit_log (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    
    -- Actor information
    actor_type TEXT NOT NULL CHECK (actor_type IN ('student', 'instructor', 'admin', 'system', 'ai_service')),
    actor_id TEXT NOT NULL,
    
    -- Action details
    action TEXT NOT NULL CHECK (action IN (
        'consent_given', 'consent_withdrawn', 'data_collected', 'profile_generated', 
        'data_anonymized', 'data_purged', 'profile_viewed', 'insights_accessed'
    )),
    resource_type TEXT NOT NULL CHECK (resource_type IN (
        'privacy_consent', 'behavioral_pattern', 'cognitive_profile', 'anonymized_insight'
    )),
    resource_id TEXT,
    
    -- Privacy and compliance context
    privacy_level TEXT NOT NULL,
    consent_status TEXT NOT NULL,
    compliance_framework TEXT, -- 'FERPA', 'COPPA', 'GDPR'
    
    -- Technical context
    ip_address TEXT,
    user_agent TEXT,
    session_id TEXT,
    
    -- Detailed audit information
    action_details JSON DEFAULT '{}',
    data_sensitivity_level TEXT DEFAULT 'medium',
    retention_policy_applied TEXT,
    
    -- Temporal tracking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_dna_audit_tenant ON learner_dna_audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_dna_audit_actor ON learner_dna_audit_log(actor_id, action, created_at);
CREATE INDEX idx_dna_audit_resource ON learner_dna_audit_log(resource_type, resource_id);
CREATE INDEX idx_dna_audit_compliance ON learner_dna_audit_log(compliance_framework, privacy_level);

-- Privacy impact assessment tracking
CREATE TABLE IF NOT EXISTS privacy_impact_assessments (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    assessment_name TEXT NOT NULL,
    assessment_version TEXT NOT NULL DEFAULT '1.0',
    
    -- Risk assessment
    data_sensitivity_score REAL NOT NULL CHECK (data_sensitivity_score BETWEEN 0.0 AND 1.0),
    reidentification_risk REAL NOT NULL CHECK (reidentification_risk BETWEEN 0.0 AND 1.0),
    educational_benefit_score REAL NOT NULL CHECK (educational_benefit_score BETWEEN 0.0 AND 1.0),
    
    -- Mitigation measures
    mitigation_measures JSON NOT NULL,
    privacy_controls_implemented JSON NOT NULL,
    compliance_frameworks JSON NOT NULL,
    
    -- Assessment metadata
    assessed_by TEXT NOT NULL,
    reviewed_by TEXT,
    approved BOOLEAN DEFAULT FALSE,
    approval_date TIMESTAMP,
    
    -- Temporal tracking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    next_review_due TIMESTAMP,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, assessment_name, assessment_version)
);

CREATE INDEX idx_privacy_assessments_tenant ON privacy_impact_assessments(tenant_id);
CREATE INDEX idx_privacy_assessments_review ON privacy_impact_assessments(next_review_due);

-- Insert migration record
INSERT INTO schema_migrations (version, name) VALUES (5, 'learner_dna_tables');