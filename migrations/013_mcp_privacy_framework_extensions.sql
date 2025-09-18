-- Migration 013: MCP Privacy Framework Extensions
-- Extends Epic 7 privacy framework for external AI client integration requirements
-- Adds granular consent controls for external AI access with real-time session management

-- ============================================
-- EXTEND LEARNER DNA PRIVACY CONSENT TABLE
-- ============================================

-- Add MCP-specific consent fields to existing table
ALTER TABLE learner_dna_privacy_consent ADD COLUMN external_ai_access_consent BOOLEAN DEFAULT FALSE;
ALTER TABLE learner_dna_privacy_consent ADD COLUMN mcp_client_scopes TEXT DEFAULT '[]';
ALTER TABLE learner_dna_privacy_consent ADD COLUMN real_time_revocation_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE learner_dna_privacy_consent ADD COLUMN external_client_restrictions TEXT DEFAULT '{}';

-- Add indexes for MCP-specific queries
CREATE INDEX idx_dna_consent_external_ai ON learner_dna_privacy_consent(external_ai_access_consent, real_time_revocation_enabled);
CREATE INDEX idx_dna_consent_mcp_scopes ON learner_dna_privacy_consent(tenant_id, user_id) WHERE mcp_client_scopes != '[]';

-- ============================================
-- MCP CLIENT REGISTRATION AND AUTHENTICATION
-- ============================================

-- Track registered MCP clients for granular consent management
CREATE TABLE IF NOT EXISTS mcp_client_registry (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,

    -- Client identification
    client_name TEXT NOT NULL,
    client_type TEXT NOT NULL CHECK (client_type IN ('ai_assistant', 'analytics_tool', 'research_platform', 'tutoring_system')),
    client_description TEXT NOT NULL,
    client_version TEXT NOT NULL DEFAULT '1.0',

    -- Authentication and authorization
    client_secret_hash TEXT NOT NULL,
    api_key_prefix TEXT NOT NULL,
    authorized_scopes TEXT NOT NULL DEFAULT '[]', -- JSON array of allowed scopes
    rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,

    -- Privacy and compliance
    privacy_policy_url TEXT,
    data_retention_days INTEGER NOT NULL DEFAULT 0, -- 0 = session only
    anonymization_required BOOLEAN DEFAULT TRUE,
    audit_logging_enabled BOOLEAN DEFAULT TRUE,

    -- Client metadata
    contact_email TEXT NOT NULL,
    organization TEXT,
    certification_level TEXT CHECK (certification_level IN ('basic', 'enterprise', 'research')),

    -- Status and temporal tracking
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'suspended', 'revoked')),
    approved_by TEXT,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_access_at TIMESTAMP,

    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, client_name)
);

CREATE INDEX idx_mcp_clients_tenant ON mcp_client_registry(tenant_id, status);
CREATE INDEX idx_mcp_clients_type ON mcp_client_registry(client_type, certification_level);
CREATE INDEX idx_mcp_clients_access ON mcp_client_registry(last_access_at, status);

-- ============================================
-- GRANULAR SCOPE DEFINITIONS
-- ============================================

-- Define granular data access scopes for MCP clients
CREATE TABLE IF NOT EXISTS mcp_data_scopes (
    id TEXT PRIMARY KEY,
    scope_name TEXT NOT NULL UNIQUE,
    scope_category TEXT NOT NULL CHECK (scope_category IN ('profile', 'behavioral', 'assessment', 'real_time', 'aggregated')),

    -- Scope details
    description TEXT NOT NULL,
    data_sensitivity_level TEXT NOT NULL CHECK (data_sensitivity_level IN ('low', 'medium', 'high', 'critical')),
    requires_explicit_consent BOOLEAN DEFAULT TRUE,

    -- Privacy implications
    privacy_impact_score REAL NOT NULL CHECK (privacy_impact_score BETWEEN 0.0 AND 1.0),
    gdpr_article_applicable TEXT, -- e.g., "Article 6", "Article 9"
    coppa_parental_consent_required BOOLEAN DEFAULT FALSE,

    -- Data access patterns
    data_tables_accessed TEXT NOT NULL, -- JSON array of table names
    anonymization_possible BOOLEAN DEFAULT TRUE,
    real_time_access_allowed BOOLEAN DEFAULT FALSE,

    -- Compliance and audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    compliance_review_due TIMESTAMP
);

-- Insert predefined MCP scopes
INSERT INTO mcp_data_scopes (id, scope_name, scope_category, description, data_sensitivity_level, privacy_impact_score, data_tables_accessed, coppa_parental_consent_required) VALUES
('scope_basic_profile', 'learner.profile.basic', 'profile', 'Access to basic learner cognitive profile (anonymized metrics only)', 'low', 0.2, '["learner_dna_profiles"]', FALSE),
('scope_learning_velocity', 'learner.behavioral.velocity', 'behavioral', 'Access to learning velocity patterns and trends', 'medium', 0.4, '["learning_velocity_data", "behavioral_patterns"]', FALSE),
('scope_struggle_detection', 'learner.assessment.struggle', 'assessment', 'Access to struggle detection and intervention triggers', 'high', 0.7, '["behavioral_patterns", "cognitive_attributes"]', TRUE),
('scope_real_time_analysis', 'learner.realtime.analysis', 'real_time', 'Real-time access to learning session data for immediate intervention', 'critical', 0.9, '["behavioral_patterns", "learner_dna_profiles"]', TRUE),
('scope_cross_course_patterns', 'learner.aggregated.cross_course', 'aggregated', 'Access to anonymized cross-course learning patterns', 'medium', 0.5, '["cross_course_patterns", "anonymized_cognitive_insights"]', FALSE);

CREATE INDEX idx_mcp_scopes_category ON mcp_data_scopes(scope_category, data_sensitivity_level);
CREATE INDEX idx_mcp_scopes_consent ON mcp_data_scopes(requires_explicit_consent, coppa_parental_consent_required);

-- ============================================
-- REAL-TIME SESSION MANAGEMENT
-- ============================================

-- Track active MCP sessions for real-time consent revocation
CREATE TABLE IF NOT EXISTS mcp_active_sessions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    client_id TEXT NOT NULL,

    -- Session details
    session_token TEXT NOT NULL UNIQUE,
    granted_scopes TEXT NOT NULL DEFAULT '[]', -- JSON array of active scopes
    session_type TEXT NOT NULL CHECK (session_type IN ('api_access', 'real_time_stream', 'batch_analysis')),

    -- Access patterns
    data_accessed_count INTEGER DEFAULT 0,
    last_data_access_at TIMESTAMP,
    rate_limit_exceeded_count INTEGER DEFAULT 0,

    -- Privacy and security
    consent_version TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    encryption_level TEXT DEFAULT 'AES-256',

    -- Session lifecycle
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_heartbeat_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    revocation_reason TEXT,

    -- Compliance tracking
    audit_events_count INTEGER DEFAULT 0,
    privacy_violations_count INTEGER DEFAULT 0,

    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES mcp_client_registry(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id, user_id) REFERENCES learner_dna_privacy_consent(tenant_id, user_id)
);

CREATE INDEX idx_mcp_sessions_user ON mcp_active_sessions(tenant_id, user_id, revoked_at);
CREATE INDEX idx_mcp_sessions_client ON mcp_active_sessions(client_id, started_at);
CREATE INDEX idx_mcp_sessions_token ON mcp_active_sessions(session_token) WHERE revoked_at IS NULL;
CREATE INDEX idx_mcp_sessions_expires ON mcp_active_sessions(expires_at) WHERE revoked_at IS NULL;

-- ============================================
-- CONSENT WITHDRAWAL AUTOMATION
-- ============================================

-- Queue for processing real-time consent withdrawal
CREATE TABLE IF NOT EXISTS mcp_consent_revocation_queue (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,

    -- Revocation details
    revocation_type TEXT NOT NULL CHECK (revocation_type IN ('full_withdrawal', 'scope_specific', 'client_specific', 'emergency_stop')),
    affected_scopes TEXT DEFAULT '[]', -- JSON array of scopes to revoke
    affected_clients TEXT DEFAULT '[]', -- JSON array of client IDs to revoke

    -- Processing status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    priority_level INTEGER DEFAULT 5 CHECK (priority_level BETWEEN 1 AND 10), -- 1 = urgent

    -- Revocation metadata
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    completed_at TIMESTAMP,
    processing_duration_ms INTEGER,

    -- Audit and compliance
    revocation_reason TEXT,
    initiated_by TEXT NOT NULL CHECK (initiated_by IN ('user', 'parent', 'admin', 'system', 'compliance')),
    compliance_framework TEXT, -- 'COPPA', 'GDPR', 'FERPA'

    -- Results tracking
    sessions_revoked_count INTEGER DEFAULT 0,
    data_purged_tables TEXT DEFAULT '[]', -- JSON array of tables where data was purged
    notification_sent BOOLEAN DEFAULT FALSE,

    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_mcp_revocation_queue_status ON mcp_consent_revocation_queue(status, priority_level, requested_at);
CREATE INDEX idx_mcp_revocation_queue_user ON mcp_consent_revocation_queue(tenant_id, user_id);
CREATE INDEX idx_mcp_revocation_queue_pending ON mcp_consent_revocation_queue(status, requested_at) WHERE status = 'pending';

-- ============================================
-- PARENTAL CONTROLS FOR EXTERNAL ACCESS
-- ============================================

-- Enhanced parental controls specifically for external AI client access
CREATE TABLE IF NOT EXISTS mcp_parental_controls (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    parent_email TEXT NOT NULL,

    -- Control settings
    external_ai_access_allowed BOOLEAN DEFAULT FALSE,
    allowed_client_types TEXT DEFAULT '[]', -- JSON array of permitted client types
    max_session_duration_minutes INTEGER DEFAULT 30,
    allowed_time_windows TEXT DEFAULT '[]', -- JSON array of time windows

    -- Notification preferences
    notify_on_access_request BOOLEAN DEFAULT TRUE,
    notify_on_data_sharing BOOLEAN DEFAULT TRUE,
    notify_on_privacy_changes BOOLEAN DEFAULT TRUE,
    notification_frequency TEXT DEFAULT 'immediate' CHECK (notification_frequency IN ('immediate', 'daily', 'weekly')),

    -- Override capabilities
    emergency_contact_phone TEXT,
    can_override_ai_access BOOLEAN DEFAULT TRUE,
    can_view_child_data BOOLEAN DEFAULT TRUE,
    can_export_child_data BOOLEAN DEFAULT TRUE,

    -- Compliance tracking
    coppa_verification_method TEXT NOT NULL CHECK (coppa_verification_method IN ('email', 'phone', 'postal', 'credit_card')),
    verification_completed_at TIMESTAMP NOT NULL,
    verification_document_id TEXT,

    -- Temporal tracking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_notification_sent_at TIMESTAMP,
    next_review_due TIMESTAMP,

    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id, user_id) REFERENCES learner_dna_privacy_consent(tenant_id, user_id),
    UNIQUE(tenant_id, user_id)
);

CREATE INDEX idx_mcp_parental_controls_user ON mcp_parental_controls(tenant_id, user_id);
CREATE INDEX idx_mcp_parental_controls_email ON mcp_parental_controls(parent_email);
CREATE INDEX idx_mcp_parental_controls_review ON mcp_parental_controls(next_review_due);

-- ============================================
-- MCP AUDIT AND COMPLIANCE LOGGING
-- ============================================

-- Enhanced audit logging for MCP operations
CREATE TABLE IF NOT EXISTS mcp_audit_log (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,

    -- Actor information
    actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'parent', 'client', 'admin', 'system')),
    actor_id TEXT NOT NULL,
    client_id TEXT, -- NULL for non-client actions

    -- Action details
    action TEXT NOT NULL CHECK (action IN (
        'consent_granted', 'consent_revoked', 'scope_accessed', 'session_started',
        'session_terminated', 'data_exported', 'privacy_policy_updated',
        'parental_control_set', 'emergency_revocation', 'compliance_violation'
    )),
    resource_type TEXT NOT NULL CHECK (resource_type IN (
        'privacy_consent', 'mcp_session', 'data_scope', 'parental_control', 'client_registration'
    )),
    resource_id TEXT,

    -- Context and details
    scope_name TEXT, -- Specific scope involved if applicable
    data_sensitivity_level TEXT,
    privacy_impact_score REAL,

    -- Compliance context
    compliance_framework TEXT, -- 'COPPA', 'GDPR', 'FERPA'
    parental_consent_involved BOOLEAN DEFAULT FALSE,
    real_time_processing BOOLEAN DEFAULT FALSE,

    -- Technical context
    ip_address TEXT,
    user_agent TEXT,
    session_id TEXT,
    request_id TEXT,

    -- Detailed audit information
    action_details TEXT, -- JSON string with specific details
    before_state TEXT, -- JSON snapshot before action
    after_state TEXT, -- JSON snapshot after action

    -- Performance and security
    processing_time_ms INTEGER,
    data_volume_bytes INTEGER,
    encryption_used TEXT,

    -- Temporal tracking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES mcp_client_registry(id) ON DELETE SET NULL
);

CREATE INDEX idx_mcp_audit_tenant ON mcp_audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_mcp_audit_actor ON mcp_audit_log(actor_id, action, created_at);
CREATE INDEX idx_mcp_audit_client ON mcp_audit_log(client_id, action, created_at);
CREATE INDEX idx_mcp_audit_compliance ON mcp_audit_log(compliance_framework, parental_consent_involved);
CREATE INDEX idx_mcp_audit_sensitivity ON mcp_audit_log(data_sensitivity_level, privacy_impact_score);

-- ============================================
-- MCP PRIVACY IMPACT ASSESSMENTS
-- ============================================

-- Track privacy impact assessments for MCP integrations
CREATE TABLE IF NOT EXISTS mcp_privacy_assessments (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    client_id TEXT NOT NULL,

    -- Assessment details
    assessment_name TEXT NOT NULL,
    assessment_version TEXT NOT NULL DEFAULT '1.0',
    assessment_type TEXT NOT NULL CHECK (assessment_type IN ('initial', 'renewal', 'incident_response', 'scope_change')),

    -- Risk evaluation
    data_sensitivity_score REAL NOT NULL CHECK (data_sensitivity_score BETWEEN 0.0 AND 1.0),
    reidentification_risk REAL NOT NULL CHECK (reidentification_risk BETWEEN 0.0 AND 1.0),
    external_sharing_risk REAL NOT NULL CHECK (external_sharing_risk BETWEEN 0.0 AND 1.0),
    minor_protection_score REAL NOT NULL CHECK (minor_protection_score BETWEEN 0.0 AND 1.0),

    -- Benefits and justification
    educational_benefit_score REAL NOT NULL CHECK (educational_benefit_score BETWEEN 0.0 AND 1.0),
    innovation_benefit_score REAL NOT NULL CHECK (innovation_benefit_score BETWEEN 0.0 AND 1.0),
    research_value_score REAL NOT NULL CHECK (research_value_score BETWEEN 0.0 AND 1.0),

    -- Risk mitigation
    mitigation_measures TEXT NOT NULL, -- JSON array of measures
    privacy_controls_implemented TEXT NOT NULL, -- JSON array of controls
    monitoring_mechanisms TEXT NOT NULL, -- JSON array of monitoring tools

    -- Compliance framework coverage
    ferpa_compliant BOOLEAN DEFAULT FALSE,
    coppa_compliant BOOLEAN DEFAULT FALSE,
    gdpr_compliant BOOLEAN DEFAULT FALSE,
    additional_frameworks TEXT DEFAULT '[]', -- JSON array of other frameworks

    -- Review and approval
    assessed_by TEXT NOT NULL,
    reviewed_by TEXT,
    legal_review_by TEXT,
    approved BOOLEAN DEFAULT FALSE,
    approval_date TIMESTAMP,
    approval_conditions TEXT, -- JSON array of conditions

    -- Temporal tracking
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    next_review_due TIMESTAMP NOT NULL,
    last_review_completed TIMESTAMP,

    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES mcp_client_registry(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, client_id, assessment_version)
);

CREATE INDEX idx_mcp_assessments_client ON mcp_privacy_assessments(client_id, assessment_type);
CREATE INDEX idx_mcp_assessments_review ON mcp_privacy_assessments(next_review_due, approved);
CREATE INDEX idx_mcp_assessments_compliance ON mcp_privacy_assessments(ferpa_compliant, coppa_compliant, gdpr_compliant);

-- ============================================
-- PRIVACY COMPLIANCE MONITORING
-- ============================================

-- Real-time privacy compliance monitoring for MCP operations
CREATE TABLE IF NOT EXISTS mcp_compliance_monitoring (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,

    -- Monitoring scope
    monitoring_type TEXT NOT NULL CHECK (monitoring_type IN ('consent_drift', 'scope_violations', 'session_anomalies', 'parental_control_bypass')),
    client_id TEXT,
    user_id TEXT,

    -- Violation details
    violation_severity TEXT NOT NULL CHECK (violation_severity IN ('low', 'medium', 'high', 'critical')),
    violation_category TEXT NOT NULL CHECK (violation_category IN ('consent', 'data_access', 'retention', 'sharing', 'minor_protection')),
    violation_description TEXT NOT NULL,

    -- Detection details
    detection_method TEXT NOT NULL CHECK (detection_method IN ('automated', 'audit', 'user_report', 'parent_report')),
    confidence_score REAL NOT NULL CHECK (confidence_score BETWEEN 0.0 AND 1.0),
    false_positive_probability REAL,

    -- Response and remediation
    auto_remediation_applied BOOLEAN DEFAULT FALSE,
    remediation_actions TEXT DEFAULT '[]', -- JSON array of actions taken
    human_review_required BOOLEAN DEFAULT FALSE,
    escalation_level INTEGER DEFAULT 1 CHECK (escalation_level BETWEEN 1 AND 5),

    -- Impact assessment
    affected_users_count INTEGER DEFAULT 1,
    data_exposure_level TEXT CHECK (data_exposure_level IN ('none', 'minimal', 'moderate', 'significant')),
    regulatory_notification_required BOOLEAN DEFAULT FALSE,

    -- Resolution tracking
    status TEXT DEFAULT 'detected' CHECK (status IN ('detected', 'investigating', 'resolved', 'false_positive')),
    assigned_to TEXT,
    resolved_at TIMESTAMP,
    resolution_summary TEXT,

    -- Temporal tracking
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES mcp_client_registry(id) ON DELETE SET NULL
);

CREATE INDEX idx_mcp_monitoring_tenant ON mcp_compliance_monitoring(tenant_id, violation_severity, status);
CREATE INDEX idx_mcp_monitoring_client ON mcp_compliance_monitoring(client_id, violation_category);
CREATE INDEX idx_mcp_monitoring_user ON mcp_compliance_monitoring(user_id, detected_at);
CREATE INDEX idx_mcp_monitoring_status ON mcp_compliance_monitoring(status, escalation_level, detected_at);

-- Insert migration record
INSERT INTO schema_migrations (version, name) VALUES (13, 'mcp_privacy_framework_extensions');