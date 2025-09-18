-- Migration 014: MCP Security Architecture for External AI Client Protection
--
-- This migration creates comprehensive security infrastructure for the Model Context Protocol (MCP)
-- server to enable secure external AI client access with zero-trust architecture.
--
-- Security Components:
-- 1. Data Loss Prevention (DLP) controls and monitoring
-- 2. Behavioral monitoring and anomaly detection
-- 3. Automated incident response and client isolation
-- 4. Comprehensive audit trails and forensic capture
-- 5. Client reputation scoring and risk assessment

-- ============================================
-- MCP CLIENT REGISTRY AND REPUTATION
-- ============================================

-- Extended client registry for MCP-specific security controls
CREATE TABLE IF NOT EXISTS mcp_client_registry (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    client_name TEXT NOT NULL,
    client_type TEXT NOT NULL CHECK (client_type IN ('ai_assistant', 'research_tool', 'analytics_platform', 'custom_integration')),
    client_description TEXT,
    client_version TEXT,
    client_secret_hash TEXT NOT NULL,
    api_key_prefix TEXT,
    authorized_scopes JSON NOT NULL DEFAULT '[]',
    rate_limit_per_minute INTEGER NOT NULL DEFAULT 10,
    privacy_policy_url TEXT,
    data_retention_days INTEGER NOT NULL DEFAULT 30,
    anonymization_required BOOLEAN NOT NULL DEFAULT TRUE,
    audit_logging_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    contact_email TEXT NOT NULL,
    organization TEXT,
    certification_level TEXT CHECK (certification_level IN ('basic', 'verified', 'enterprise', 'research')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'suspended', 'revoked')),
    approved_by TEXT,
    approved_at TIMESTAMP,
    suspended_at TIMESTAMP,
    suspension_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_access_at TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Client reputation and risk scoring
CREATE TABLE IF NOT EXISTS mcp_client_reputation (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    reputation_score REAL NOT NULL DEFAULT 100.0 CHECK (reputation_score >= 0 AND reputation_score <= 100),
    risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    total_requests INTEGER NOT NULL DEFAULT 0,
    successful_requests INTEGER NOT NULL DEFAULT 0,
    violation_count INTEGER NOT NULL DEFAULT 0,
    last_violation_at TIMESTAMP,
    consecutive_violations INTEGER NOT NULL DEFAULT 0,
    max_consecutive_violations INTEGER NOT NULL DEFAULT 0,
    average_request_size REAL NOT NULL DEFAULT 0,
    largest_request_size INTEGER NOT NULL DEFAULT 0,
    suspicious_pattern_count INTEGER NOT NULL DEFAULT 0,
    off_hours_activity_ratio REAL NOT NULL DEFAULT 0,
    cross_tenant_attempts INTEGER NOT NULL DEFAULT 0,
    data_type_diversity_score REAL NOT NULL DEFAULT 0,
    behavioral_anomaly_score REAL NOT NULL DEFAULT 0,
    compliance_violation_count INTEGER NOT NULL DEFAULT 0,
    last_compliance_violation_at TIMESTAMP,
    automation_probability REAL NOT NULL DEFAULT 0,
    trust_score REAL NOT NULL DEFAULT 100.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_request_at TIMESTAMP,
    reputation_history JSON DEFAULT '[]',
    FOREIGN KEY (client_id) REFERENCES mcp_client_registry(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- ============================================
-- DATA LOSS PREVENTION (DLP) CONTROLS
-- ============================================

-- Rate limiting configuration per data type and risk level
CREATE TABLE IF NOT EXISTS mcp_rate_limit_config (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    data_type TEXT NOT NULL CHECK (data_type IN ('profile', 'behavioral', 'assessment', 'real_time', 'aggregated')),
    risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    requests_per_minute INTEGER NOT NULL,
    window_period_minutes INTEGER NOT NULL DEFAULT 60,
    burst_allowance INTEGER NOT NULL DEFAULT 5,
    max_concurrent_sessions INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, data_type, risk_level)
);

-- Volume tracking for cumulative data access monitoring
CREATE TABLE IF NOT EXISTS mcp_volume_tracking (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    data_type TEXT NOT NULL,
    tracking_date DATE NOT NULL,
    total_bytes INTEGER NOT NULL DEFAULT 0,
    request_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES mcp_client_registry(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE(client_id, tenant_id, user_id, data_type, tracking_date)
);

-- DLP violations and policy enforcement
CREATE TABLE IF NOT EXISTS mcp_dlp_violations (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    user_id TEXT,
    violation_type TEXT NOT NULL CHECK (violation_type IN (
        'rate_limit_exceeded', 'volume_limit_exceeded', 'suspicious_pattern_detected',
        'compliance_violation', 'unauthorized_access', 'data_exfiltration_attempt',
        'cross_tenant_access', 'privilege_escalation', 'evasion_detected'
    )),
    violation_details JSON NOT NULL,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMP,
    resolved_by TEXT,
    resolution_notes TEXT,
    automatic_response TEXT,
    manual_review_required BOOLEAN NOT NULL DEFAULT FALSE,
    compliance_impact TEXT,
    notification_sent BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES mcp_client_registry(id) ON DELETE CASCADE
);

-- Data access logging for forensics and analysis
CREATE TABLE IF NOT EXISTS mcp_data_access_log (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    data_type TEXT NOT NULL,
    data_size_bytes INTEGER NOT NULL,
    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    successful BOOLEAN NOT NULL DEFAULT TRUE,
    error_message TEXT,
    processing_time_ms INTEGER,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES mcp_client_registry(id) ON DELETE CASCADE
);

-- ============================================
-- BEHAVIORAL MONITORING AND ANOMALY DETECTION
-- ============================================

-- Behavioral baselines for normal client activity
CREATE TABLE IF NOT EXISTS mcp_behavioral_baseline (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    learning_period_days INTEGER NOT NULL DEFAULT 7,
    total_samples INTEGER NOT NULL DEFAULT 0,
    average_request_size REAL NOT NULL DEFAULT 0,
    request_size_std_dev REAL NOT NULL DEFAULT 0,
    average_requests_per_hour REAL NOT NULL DEFAULT 0,
    peak_hours JSON DEFAULT '[]',
    low_activity_hours JSON DEFAULT '[]',
    weekday_patterns JSON DEFAULT '{}',
    data_type_distribution JSON DEFAULT '{}',
    average_session_duration REAL NOT NULL DEFAULT 0,
    session_duration_std_dev REAL NOT NULL DEFAULT 0,
    common_ip_ranges JSON DEFAULT '[]',
    common_user_agents JSON DEFAULT '[]',
    confidence_score REAL NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_analysis_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    next_update_due TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES mcp_client_registry(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE(client_id, tenant_id, version)
);

-- Client activity tracking for behavioral analysis
CREATE TABLE IF NOT EXISTS mcp_client_activity (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    data_type TEXT NOT NULL,
    request_size INTEGER NOT NULL,
    request_timestamp TIMESTAMP NOT NULL,
    session_duration INTEGER,
    ip_address TEXT,
    user_agent TEXT,
    additional_metadata JSON DEFAULT '{}',
    analysis_completed BOOLEAN NOT NULL DEFAULT FALSE,
    anomaly_scores JSON,
    risk_level TEXT CHECK (risk_level IN ('pending', 'low', 'medium', 'high', 'critical')),
    FOREIGN KEY (client_id) REFERENCES mcp_client_registry(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Behavioral anomalies and threat detection
CREATE TABLE IF NOT EXISTS mcp_behavioral_anomaly (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    user_id TEXT,
    anomaly_type TEXT NOT NULL CHECK (anomaly_type IN (
        'temporal_anomaly', 'volume_anomaly', 'velocity_anomaly', 'pattern_anomaly',
        'behavioral_deviation', 'evasion_techniques', 'coordinated_activity'
    )),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    anomaly_scores JSON NOT NULL,
    detected_patterns JSON DEFAULT '[]',
    risk_indicators JSON DEFAULT '[]',
    automatic_response TEXT,
    investigation_required BOOLEAN NOT NULL DEFAULT FALSE,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMP,
    resolved_by TEXT,
    resolution_notes TEXT,
    false_positive BOOLEAN NOT NULL DEFAULT FALSE,
    suppress_similar BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY (client_id) REFERENCES mcp_client_registry(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- ============================================
-- AUTOMATED INCIDENT RESPONSE
-- ============================================

-- Security incidents and threat management
CREATE TABLE IF NOT EXISTS mcp_security_incidents (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    user_id TEXT,
    incident_type TEXT NOT NULL CHECK (incident_type IN (
        'behavioral_anomaly', 'dlp_violation', 'authentication_failure',
        'privilege_escalation', 'data_exfiltration', 'coordinated_attack',
        'compliance_violation', 'unauthorized_access'
    )),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    detection_source TEXT NOT NULL,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'investigating', 'contained', 'resolved', 'false_positive')),
    assigned_to TEXT,
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    false_positive BOOLEAN NOT NULL DEFAULT FALSE,
    suppress_similar BOOLEAN NOT NULL DEFAULT FALSE,
    related_incidents JSON DEFAULT '[]',
    evidence_collected BOOLEAN NOT NULL DEFAULT FALSE,
    investigation_required BOOLEAN NOT NULL DEFAULT FALSE,
    compliance_reporting_required BOOLEAN NOT NULL DEFAULT FALSE,
    estimated_impact TEXT,
    mitigation_steps JSON DEFAULT '[]',
    lessons_learned TEXT,
    FOREIGN KEY (client_id) REFERENCES mcp_client_registry(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Client isolation and access control
CREATE TABLE IF NOT EXISTS mcp_client_isolation (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    isolation_level TEXT NOT NULL CHECK (isolation_level IN ('soft', 'hard', 'complete')),
    reason TEXT NOT NULL,
    initiated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    initiated_by TEXT NOT NULL,
    duration INTEGER, -- Duration in minutes
    expires_at TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'completed')),
    sessions_terminated INTEGER NOT NULL DEFAULT 0,
    access_points_blocked JSON DEFAULT '[]',
    notifications_sent INTEGER NOT NULL DEFAULT 0,
    rollback_procedure_id TEXT,
    manual_override_required BOOLEAN NOT NULL DEFAULT FALSE,
    compliance_impact TEXT,
    audit_trail JSON DEFAULT '[]',
    FOREIGN KEY (client_id) REFERENCES mcp_client_registry(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Forensic data capture for investigation
CREATE TABLE IF NOT EXISTS mcp_forensic_capture (
    id TEXT PRIMARY KEY,
    incident_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    user_id TEXT,
    capture_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    capture_reason TEXT NOT NULL,
    data_types JSON NOT NULL,
    retention_period INTEGER NOT NULL DEFAULT 90, -- Days
    access_restrictions JSON DEFAULT '[]',
    encryption_level TEXT NOT NULL DEFAULT 'AES-256',
    integrity_hash TEXT NOT NULL,
    compliance_notes TEXT,
    investigation_status TEXT NOT NULL DEFAULT 'pending' CHECK (investigation_status IN ('pending', 'active', 'completed', 'archived')),
    evidence_chain JSON DEFAULT '[]',
    exported_at TIMESTAMP,
    purged_at TIMESTAMP,
    FOREIGN KEY (incident_id) REFERENCES mcp_security_incidents(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES mcp_client_registry(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- ============================================
-- MCP DATA SCOPES AND PRIVACY CONTROLS
-- ============================================

-- Data scope definitions for granular access control
CREATE TABLE IF NOT EXISTS mcp_data_scopes (
    id TEXT PRIMARY KEY,
    scope_name TEXT NOT NULL UNIQUE,
    scope_category TEXT NOT NULL CHECK (scope_category IN ('profile', 'behavioral', 'assessment', 'real_time', 'aggregated')),
    description TEXT NOT NULL,
    data_sensitivity_level TEXT NOT NULL CHECK (data_sensitivity_level IN ('public', 'internal', 'confidential', 'restricted')),
    requires_explicit_consent BOOLEAN NOT NULL DEFAULT TRUE,
    privacy_impact_score INTEGER NOT NULL CHECK (privacy_impact_score >= 1 AND privacy_impact_score <= 10),
    gdpr_article_applicable TEXT,
    coppa_parental_consent_required BOOLEAN NOT NULL DEFAULT FALSE,
    data_tables_accessed JSON NOT NULL,
    anonymization_possible BOOLEAN NOT NULL DEFAULT TRUE,
    real_time_access_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    compliance_review_due DATE
);

-- Active MCP sessions with enhanced security tracking
CREATE TABLE IF NOT EXISTS mcp_active_sessions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    session_token TEXT NOT NULL UNIQUE,
    granted_scopes JSON NOT NULL,
    session_type TEXT NOT NULL CHECK (session_type IN ('api_access', 'real_time_stream', 'batch_analysis')),
    data_accessed_count INTEGER NOT NULL DEFAULT 0,
    last_data_access_at TIMESTAMP,
    rate_limit_exceeded_count INTEGER NOT NULL DEFAULT 0,
    consent_version TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    encryption_level TEXT NOT NULL DEFAULT 'AES-256',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_heartbeat_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    revocation_reason TEXT,
    revoked_by TEXT,
    audit_events_count INTEGER NOT NULL DEFAULT 0,
    privacy_violations_count INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES mcp_client_registry(id) ON DELETE CASCADE
);

-- Consent revocation queue for real-time processing
CREATE TABLE IF NOT EXISTS mcp_consent_revocation_queue (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    revocation_type TEXT NOT NULL CHECK (revocation_type IN ('full_withdrawal', 'scope_specific', 'client_specific', 'emergency_stop')),
    affected_scopes JSON DEFAULT '[]',
    affected_clients JSON DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    priority_level INTEGER NOT NULL DEFAULT 3 CHECK (priority_level >= 1 AND priority_level <= 5),
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    completed_at TIMESTAMP,
    processing_duration_ms INTEGER,
    revocation_reason TEXT,
    initiated_by TEXT NOT NULL CHECK (initiated_by IN ('user', 'parent', 'admin', 'system', 'compliance')),
    compliance_framework TEXT,
    sessions_revoked_count INTEGER NOT NULL DEFAULT 0,
    data_purged_tables JSON DEFAULT '[]',
    notification_sent BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Parental controls for COPPA compliance
CREATE TABLE IF NOT EXISTS mcp_parental_controls (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    parent_email TEXT NOT NULL,
    external_ai_access_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    allowed_client_types JSON DEFAULT '[]',
    max_session_duration_minutes INTEGER NOT NULL DEFAULT 30,
    allowed_time_windows JSON DEFAULT '[]',
    notify_on_access_request BOOLEAN NOT NULL DEFAULT TRUE,
    notify_on_data_sharing BOOLEAN NOT NULL DEFAULT TRUE,
    notify_on_privacy_changes BOOLEAN NOT NULL DEFAULT TRUE,
    notification_frequency TEXT NOT NULL DEFAULT 'immediate' CHECK (notification_frequency IN ('immediate', 'daily', 'weekly')),
    emergency_contact_phone TEXT,
    can_override_ai_access BOOLEAN NOT NULL DEFAULT TRUE,
    can_view_child_data BOOLEAN NOT NULL DEFAULT TRUE,
    can_export_child_data BOOLEAN NOT NULL DEFAULT FALSE,
    coppa_verification_method TEXT NOT NULL CHECK (coppa_verification_method IN ('email', 'phone', 'postal_mail', 'credit_card', 'digital_signature')),
    verification_completed_at TIMESTAMP NOT NULL,
    verification_document_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_notification_sent_at TIMESTAMP,
    next_review_due DATE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE(tenant_id, user_id)
);

-- ============================================
-- AUDIT AND COMPLIANCE LOGGING
-- ============================================

-- Comprehensive audit log for MCP operations
CREATE TABLE IF NOT EXISTS mcp_audit_log (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'parent', 'client', 'admin', 'system')),
    actor_id TEXT NOT NULL,
    client_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    scope_name TEXT,
    compliance_framework TEXT,
    parental_consent_involved BOOLEAN NOT NULL DEFAULT FALSE,
    ip_address TEXT,
    user_agent TEXT,
    action_details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES mcp_client_registry(id) ON DELETE SET NULL
);

-- Security alerts and notifications
CREATE TABLE IF NOT EXISTS mcp_security_alerts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    alert_type TEXT NOT NULL CHECK (alert_type IN (
        'dlp_violation', 'behavioral_anomaly', 'security_incident', 'compliance_violation',
        'client_isolation', 'consent_revocation', 'system_breach', 'data_exfiltration'
    )),
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    source_service TEXT NOT NULL,
    related_client_id TEXT,
    related_user_id TEXT,
    related_incident_id TEXT,
    alert_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP,
    acknowledged_by TEXT,
    resolved_at TIMESTAMP,
    resolved_by TEXT,
    resolution_notes TEXT,
    escalated BOOLEAN NOT NULL DEFAULT FALSE,
    escalation_level INTEGER DEFAULT 0,
    notification_sent BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (related_client_id) REFERENCES mcp_client_registry(id) ON DELETE SET NULL,
    FOREIGN KEY (related_incident_id) REFERENCES mcp_security_incidents(id) ON DELETE SET NULL
);

-- ============================================
-- INDEXES FOR PERFORMANCE AND SECURITY
-- ============================================

-- Client registry indexes
CREATE INDEX IF NOT EXISTS idx_mcp_client_registry_tenant_status ON mcp_client_registry(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_mcp_client_registry_last_access ON mcp_client_registry(last_access_at);

-- Client reputation indexes
CREATE INDEX IF NOT EXISTS idx_mcp_client_reputation_client_tenant ON mcp_client_reputation(client_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_mcp_client_reputation_risk_level ON mcp_client_reputation(risk_level);
CREATE INDEX IF NOT EXISTS idx_mcp_client_reputation_updated ON mcp_client_reputation(updated_at);

-- DLP and monitoring indexes
CREATE INDEX IF NOT EXISTS idx_mcp_dlp_violations_client_detected ON mcp_dlp_violations(client_id, detected_at);
CREATE INDEX IF NOT EXISTS idx_mcp_dlp_violations_severity_resolved ON mcp_dlp_violations(severity, resolved);
CREATE INDEX IF NOT EXISTS idx_mcp_data_access_log_client_accessed ON mcp_data_access_log(client_id, accessed_at);
CREATE INDEX IF NOT EXISTS idx_mcp_data_access_log_tenant_user ON mcp_data_access_log(tenant_id, user_id);

-- Volume tracking indexes
CREATE INDEX IF NOT EXISTS idx_mcp_volume_tracking_client_date ON mcp_volume_tracking(client_id, tracking_date);
CREATE INDEX IF NOT EXISTS idx_mcp_volume_tracking_tenant_user_type ON mcp_volume_tracking(tenant_id, user_id, data_type);

-- Behavioral monitoring indexes
CREATE INDEX IF NOT EXISTS idx_mcp_behavioral_baseline_client_version ON mcp_behavioral_baseline(client_id, version);
CREATE INDEX IF NOT EXISTS idx_mcp_client_activity_client_timestamp ON mcp_client_activity(client_id, request_timestamp);
CREATE INDEX IF NOT EXISTS idx_mcp_behavioral_anomaly_detected ON mcp_behavioral_anomaly(detected_at, severity);

-- Incident response indexes
CREATE INDEX IF NOT EXISTS idx_mcp_security_incidents_client_detected ON mcp_security_incidents(client_id, detected_at);
CREATE INDEX IF NOT EXISTS idx_mcp_security_incidents_severity_status ON mcp_security_incidents(severity, status);
CREATE INDEX IF NOT EXISTS idx_mcp_client_isolation_client_status ON mcp_client_isolation(client_id, status);
CREATE INDEX IF NOT EXISTS idx_mcp_forensic_capture_incident ON mcp_forensic_capture(incident_id);

-- Session and privacy indexes
CREATE INDEX IF NOT EXISTS idx_mcp_active_sessions_client_revoked ON mcp_active_sessions(client_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_mcp_active_sessions_expires ON mcp_active_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_mcp_consent_revocation_status_priority ON mcp_consent_revocation_queue(status, priority_level);
CREATE INDEX IF NOT EXISTS idx_mcp_parental_controls_tenant_user ON mcp_parental_controls(tenant_id, user_id);

-- Audit and alert indexes
CREATE INDEX IF NOT EXISTS idx_mcp_audit_log_tenant_created ON mcp_audit_log(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_log_actor_action ON mcp_audit_log(actor_type, actor_id, action);
CREATE INDEX IF NOT EXISTS idx_mcp_security_alerts_tenant_severity ON mcp_security_alerts(tenant_id, severity);
CREATE INDEX IF NOT EXISTS idx_mcp_security_alerts_created_acknowledged ON mcp_security_alerts(created_at, acknowledged_at);

-- ============================================
-- INITIAL DATA AND CONFIGURATION
-- ============================================

-- Insert default data scopes
INSERT OR IGNORE INTO mcp_data_scopes (id, scope_name, scope_category, description, data_sensitivity_level, privacy_impact_score, gdpr_article_applicable, coppa_parental_consent_required, data_tables_accessed, anonymization_possible, real_time_access_allowed) VALUES
('scope-profile-basic', 'profile:basic', 'profile', 'Basic learner profile information including learning preferences and general cognitive patterns', 'internal', 3, 'Article 6(1)(f)', FALSE, '["learner_dna_profiles"]', TRUE, FALSE),
('scope-profile-detailed', 'profile:detailed', 'profile', 'Detailed learner profile with comprehensive cognitive analysis and learning history', 'confidential', 6, 'Article 6(1)(a)', TRUE, '["learner_dna_profiles", "learner_dna_analysis"]', TRUE, FALSE),
('scope-behavioral-patterns', 'behavioral:patterns', 'behavioral', 'Behavioral learning patterns and timing analysis', 'confidential', 7, 'Article 6(1)(a)', TRUE, '["learner_dna_behavioral_patterns"]', TRUE, FALSE),
('scope-assessment-results', 'assessment:results', 'assessment', 'Assessment results and performance analytics', 'restricted', 8, 'Article 6(1)(a)', TRUE, '["learner_dna_assessments", "learner_dna_analysis"]', FALSE, FALSE),
('scope-realtime-interactions', 'realtime:interactions', 'real_time', 'Real-time chat interactions and immediate behavioral data', 'restricted', 9, 'Article 6(1)(a)', TRUE, '["learner_dna_chat_interactions"]', FALSE, TRUE),
('scope-aggregated-analytics', 'aggregated:analytics', 'aggregated', 'Aggregated and anonymized learning analytics', 'internal', 2, 'Article 6(1)(f)', FALSE, '["learner_dna_aggregated_metrics"]', TRUE, FALSE);

-- Insert default rate limit configurations
INSERT OR IGNORE INTO mcp_rate_limit_config (id, tenant_id, data_type, risk_level, requests_per_minute, window_period_minutes, burst_allowance, max_concurrent_sessions) VALUES
-- Low risk configurations
('rate-low-profile', 'default', 'profile', 'low', 15, 60, 5, 3),
('rate-low-behavioral', 'default', 'behavioral', 'low', 10, 60, 3, 2),
('rate-low-assessment', 'default', 'assessment', 'low', 8, 60, 2, 2),
('rate-low-realtime', 'default', 'real_time', 'low', 20, 60, 8, 1),
('rate-low-aggregated', 'default', 'aggregated', 'low', 25, 60, 10, 3),

-- Medium risk configurations
('rate-med-profile', 'default', 'profile', 'medium', 10, 60, 3, 2),
('rate-med-behavioral', 'default', 'behavioral', 'medium', 7, 60, 2, 1),
('rate-med-assessment', 'default', 'assessment', 'medium', 5, 60, 1, 1),
('rate-med-realtime', 'default', 'real_time', 'medium', 12, 60, 4, 1),
('rate-med-aggregated', 'default', 'aggregated', 'medium', 15, 60, 5, 2),

-- High risk configurations
('rate-high-profile', 'default', 'profile', 'high', 5, 60, 1, 1),
('rate-high-behavioral', 'default', 'behavioral', 'high', 3, 60, 1, 1),
('rate-high-assessment', 'default', 'assessment', 'high', 2, 60, 0, 1),
('rate-high-realtime', 'default', 'real_time', 'high', 6, 60, 1, 1),
('rate-high-aggregated', 'default', 'aggregated', 'high', 8, 60, 2, 1),

-- Critical risk configurations
('rate-crit-profile', 'default', 'profile', 'critical', 1, 60, 0, 1),
('rate-crit-behavioral', 'default', 'behavioral', 'critical', 1, 60, 0, 0),
('rate-crit-assessment', 'default', 'assessment', 'critical', 1, 60, 0, 0),
('rate-crit-realtime', 'default', 'real_time', 'critical', 2, 60, 0, 0),
('rate-crit-aggregated', 'default', 'aggregated', 'critical', 3, 60, 0, 1);

-- ============================================
-- SECURITY TRIGGERS AND CONSTRAINTS
-- ============================================

-- Update timestamp triggers
CREATE TRIGGER IF NOT EXISTS update_mcp_client_registry_timestamp
    AFTER UPDATE ON mcp_client_registry
    BEGIN
        UPDATE mcp_client_registry SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_mcp_client_reputation_timestamp
    AFTER UPDATE ON mcp_client_reputation
    BEGIN
        UPDATE mcp_client_reputation SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_mcp_rate_limit_config_timestamp
    AFTER UPDATE ON mcp_rate_limit_config
    BEGIN
        UPDATE mcp_rate_limit_config SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_mcp_volume_tracking_timestamp
    AFTER UPDATE ON mcp_volume_tracking
    BEGIN
        UPDATE mcp_volume_tracking SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_mcp_behavioral_baseline_timestamp
    AFTER UPDATE ON mcp_behavioral_baseline
    BEGIN
        UPDATE mcp_behavioral_baseline SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_mcp_data_scopes_timestamp
    AFTER UPDATE ON mcp_data_scopes
    BEGIN
        UPDATE mcp_data_scopes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_mcp_parental_controls_timestamp
    AFTER UPDATE ON mcp_parental_controls
    BEGIN
        UPDATE mcp_parental_controls SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Security validation triggers
CREATE TRIGGER IF NOT EXISTS validate_mcp_client_reputation_score
    BEFORE INSERT ON mcp_client_reputation
    BEGIN
        SELECT CASE
            WHEN NEW.reputation_score < 0 OR NEW.reputation_score > 100 THEN
                RAISE(ABORT, 'Reputation score must be between 0 and 100')
        END;
    END;

CREATE TRIGGER IF NOT EXISTS validate_mcp_rate_limits
    BEFORE INSERT ON mcp_rate_limit_config
    BEGIN
        SELECT CASE
            WHEN NEW.requests_per_minute <= 0 THEN
                RAISE(ABORT, 'Requests per minute must be positive')
            WHEN NEW.window_period_minutes <= 0 THEN
                RAISE(ABORT, 'Window period must be positive')
        END;
    END;

-- ============================================
-- VIEWS FOR SECURITY MONITORING
-- ============================================

-- Security dashboard view
CREATE VIEW IF NOT EXISTS v_mcp_security_dashboard AS
SELECT
    t.id as tenant_id,
    COUNT(DISTINCT c.id) as total_clients,
    COUNT(DISTINCT CASE WHEN c.status = 'approved' THEN c.id END) as approved_clients,
    COUNT(DISTINCT CASE WHEN c.status = 'suspended' THEN c.id END) as suspended_clients,
    COUNT(DISTINCT v.id) as total_violations,
    COUNT(DISTINCT CASE WHEN v.severity = 'critical' THEN v.id END) as critical_violations,
    COUNT(DISTINCT i.id) as active_incidents,
    COUNT(DISTINCT iso.id) as active_isolations,
    AVG(r.reputation_score) as avg_reputation_score
FROM tenants t
LEFT JOIN mcp_client_registry c ON t.id = c.tenant_id
LEFT JOIN mcp_dlp_violations v ON t.id = v.tenant_id AND v.detected_at > datetime('now', '-24 hours')
LEFT JOIN mcp_security_incidents i ON t.id = i.tenant_id AND i.status = 'active'
LEFT JOIN mcp_client_isolation iso ON t.id = iso.tenant_id AND iso.status = 'active'
LEFT JOIN mcp_client_reputation r ON c.id = r.client_id
GROUP BY t.id;

-- High-risk clients view
CREATE VIEW IF NOT EXISTS v_mcp_high_risk_clients AS
SELECT
    c.id,
    c.client_name,
    c.tenant_id,
    c.status,
    r.reputation_score,
    r.risk_level,
    r.violation_count,
    r.consecutive_violations,
    r.last_violation_at,
    COUNT(v.id) as recent_violations,
    COUNT(i.id) as active_incidents
FROM mcp_client_registry c
JOIN mcp_client_reputation r ON c.id = r.client_id
LEFT JOIN mcp_dlp_violations v ON c.id = v.client_id AND v.detected_at > datetime('now', '-7 days')
LEFT JOIN mcp_security_incidents i ON c.id = i.client_id AND i.status IN ('active', 'investigating')
WHERE r.risk_level IN ('high', 'critical') OR r.reputation_score < 50
GROUP BY c.id, c.client_name, c.tenant_id, c.status, r.reputation_score, r.risk_level, r.violation_count, r.consecutive_violations, r.last_violation_at
ORDER BY r.reputation_score ASC, recent_violations DESC;