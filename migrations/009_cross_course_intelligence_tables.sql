-- Migration 009: Cross-Course Intelligence Foundation Tables
-- Creates tables for cross-course knowledge dependency mapping and performance correlation
-- Based on Story 6.1 requirements with MVP focus

-- Knowledge dependency relationships between courses and concepts
CREATE TABLE knowledge_dependencies (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  prerequisite_course TEXT NOT NULL,
  prerequisite_concept TEXT NOT NULL,
  dependent_course TEXT NOT NULL,
  dependent_concept TEXT NOT NULL,
  dependency_strength REAL NOT NULL CHECK (dependency_strength >= 0.0 AND dependency_strength <= 1.0),
  validation_score REAL NOT NULL CHECK (validation_score >= 0.0 AND validation_score <= 1.0),
  correlation_coefficient REAL CHECK (correlation_coefficient >= -1.0 AND correlation_coefficient <= 1.0),
  sample_size INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure unique dependency relationships
  UNIQUE(prerequisite_course, prerequisite_concept, dependent_course, dependent_concept)
);

-- Cross-course performance correlations for students
CREATE TABLE cross_course_performance (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  student_id TEXT NOT NULL,
  course_sequence TEXT NOT NULL, -- JSON array of course IDs in sequence
  correlation_matrix TEXT NOT NULL, -- JSON correlation matrix between courses
  knowledge_gaps TEXT NOT NULL, -- JSON array of identified gaps
  academic_risk_score REAL NOT NULL CHECK (academic_risk_score >= 0.0 AND academic_risk_score <= 1.0),
  risk_factors TEXT, -- JSON array of risk factor objects
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME, -- For data retention management
  
  FOREIGN KEY (student_id) REFERENCES learner_profiles(id) ON DELETE CASCADE
);

-- Cross-course data sharing consent management
CREATE TABLE cross_course_consent (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  student_id TEXT NOT NULL,
  source_course TEXT NOT NULL,
  target_course TEXT NOT NULL,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('performance_data', 'behavioral_patterns', 'learning_analytics', 'all')),
  consent_granted BOOLEAN NOT NULL DEFAULT FALSE,
  consent_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  expiration_date DATETIME,
  withdrawn_at DATETIME,
  
  FOREIGN KEY (student_id) REFERENCES learner_profiles(id) ON DELETE CASCADE,
  
  -- Ensure unique consent per student/course pair/type
  UNIQUE(student_id, source_course, target_course, consent_type)
);

-- Cross-course gap alerts for instructors
CREATE TABLE cross_course_gap_alerts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  student_id TEXT NOT NULL,
  instructor_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  prerequisite_course TEXT NOT NULL,
  gap_area TEXT NOT NULL,
  gap_concept TEXT NOT NULL,
  risk_score REAL NOT NULL CHECK (risk_score >= 0.0 AND risk_score <= 1.0),
  impact_prediction TEXT NOT NULL, -- JSON object with impact details
  recommendations TEXT NOT NULL, -- JSON array of intervention recommendations
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'in-progress', 'resolved', 'dismissed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  predicted_impact_date DATETIME,
  acknowledged_at DATETIME,
  acknowledged_by TEXT,
  resolved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (student_id) REFERENCES learner_profiles(id) ON DELETE CASCADE
);

-- Knowledge transfer opportunities tracking
CREATE TABLE knowledge_transfer_opportunities (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  student_id TEXT NOT NULL,
  source_course TEXT NOT NULL,
  target_course TEXT NOT NULL,
  source_concept TEXT NOT NULL,
  target_concept TEXT NOT NULL,
  transfer_type TEXT NOT NULL CHECK (transfer_type IN ('positive', 'negative', 'neutral')),
  opportunity_strength REAL NOT NULL CHECK (opportunity_strength >= 0.0 AND opportunity_strength <= 1.0),
  recommendation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'identified' CHECK (status IN ('identified', 'suggested', 'acted_upon', 'dismissed')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (student_id) REFERENCES learner_profiles(id) ON DELETE CASCADE
);

-- Indexes for query performance
CREATE INDEX idx_knowledge_dependencies_prerequisite ON knowledge_dependencies(prerequisite_course, prerequisite_concept);
CREATE INDEX idx_knowledge_dependencies_dependent ON knowledge_dependencies(dependent_course, dependent_concept);
CREATE INDEX idx_knowledge_dependencies_strength ON knowledge_dependencies(dependency_strength DESC);

CREATE INDEX idx_cross_course_performance_student ON cross_course_performance(student_id);
CREATE INDEX idx_cross_course_performance_risk ON cross_course_performance(academic_risk_score DESC);
CREATE INDEX idx_cross_course_performance_generated ON cross_course_performance(generated_at);

CREATE INDEX idx_cross_course_consent_student ON cross_course_consent(student_id);
CREATE INDEX idx_cross_course_consent_courses ON cross_course_consent(source_course, target_course);
CREATE INDEX idx_cross_course_consent_granted ON cross_course_consent(consent_granted);

CREATE INDEX idx_gap_alerts_student ON cross_course_gap_alerts(student_id);
CREATE INDEX idx_gap_alerts_instructor ON cross_course_gap_alerts(instructor_id);
CREATE INDEX idx_gap_alerts_course ON cross_course_gap_alerts(course_id);
CREATE INDEX idx_gap_alerts_status ON cross_course_gap_alerts(status);
CREATE INDEX idx_gap_alerts_priority ON cross_course_gap_alerts(priority);
CREATE INDEX idx_gap_alerts_risk ON cross_course_gap_alerts(risk_score DESC);

CREATE INDEX idx_transfer_opportunities_student ON knowledge_transfer_opportunities(student_id);
CREATE INDEX idx_transfer_opportunities_courses ON knowledge_transfer_opportunities(source_course, target_course);
CREATE INDEX idx_transfer_opportunities_status ON knowledge_transfer_opportunities(status);

-- Update triggers for maintaining updated_at timestamps
CREATE TRIGGER update_knowledge_dependencies_timestamp
  AFTER UPDATE ON knowledge_dependencies
BEGIN
  UPDATE knowledge_dependencies SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_gap_alerts_timestamp
  AFTER UPDATE ON cross_course_gap_alerts
BEGIN
  UPDATE cross_course_gap_alerts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_transfer_opportunities_timestamp
  AFTER UPDATE ON knowledge_transfer_opportunities
BEGIN
  UPDATE knowledge_transfer_opportunities SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Data retention trigger for expired performance data
CREATE TRIGGER cleanup_expired_performance_data
  AFTER INSERT ON cross_course_performance
BEGIN
  DELETE FROM cross_course_performance 
  WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP;
END;

-- Audit logging for consent changes (for FERPA compliance)
CREATE TABLE cross_course_consent_audit (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  consent_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('granted', 'withdrawn', 'expired', 'modified')),
  old_values TEXT, -- JSON of previous consent settings
  new_values TEXT, -- JSON of new consent settings
  changed_by TEXT, -- User ID or system process
  change_reason TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (consent_id) REFERENCES cross_course_consent(id) ON DELETE CASCADE
);

CREATE INDEX idx_consent_audit_student ON cross_course_consent_audit(student_id);
CREATE INDEX idx_consent_audit_consent ON cross_course_consent_audit(consent_id);
CREATE INDEX idx_consent_audit_timestamp ON cross_course_consent_audit(timestamp);

-- Trigger for consent audit logging
CREATE TRIGGER log_consent_changes
  AFTER UPDATE ON cross_course_consent
BEGIN
  INSERT INTO cross_course_consent_audit (
    consent_id, student_id, action, old_values, new_values, changed_by
  ) VALUES (
    NEW.id,
    NEW.student_id,
    CASE 
      WHEN OLD.consent_granted = 1 AND NEW.consent_granted = 0 THEN 'withdrawn'
      WHEN OLD.consent_granted = 0 AND NEW.consent_granted = 1 THEN 'granted'
      ELSE 'modified'
    END,
    json_object(
      'consent_granted', OLD.consent_granted,
      'consent_type', OLD.consent_type,
      'expiration_date', OLD.expiration_date
    ),
    json_object(
      'consent_granted', NEW.consent_granted,
      'consent_type', NEW.consent_type,
      'expiration_date', NEW.expiration_date
    ),
    'system' -- This would be replaced with actual user context in application
  );
END;

-- Insert default consent for backward compatibility
-- This ensures existing learner profiles have explicit consent settings
INSERT OR IGNORE INTO cross_course_consent (
  student_id, source_course, target_course, consent_type, consent_granted
)
SELECT DISTINCT 
  lp.id as student_id,
  'all_courses' as source_course,
  'all_courses' as target_course,
  'learning_analytics' as consent_type,
  1 as consent_granted
FROM learner_profiles lp;

-- Create view for simplified consent checking
CREATE VIEW cross_course_consent_summary AS
SELECT 
  student_id,
  source_course,
  target_course,
  GROUP_CONCAT(
    CASE WHEN consent_granted THEN consent_type ELSE NULL END
  ) as granted_permissions,
  GROUP_CONCAT(
    CASE WHEN NOT consent_granted THEN consent_type ELSE NULL END
  ) as denied_permissions,
  MAX(consent_date) as latest_consent_date,
  MIN(withdrawn_at) as earliest_withdrawal
FROM cross_course_consent
GROUP BY student_id, source_course, target_course;

-- Create view for instructor alert dashboard
CREATE VIEW instructor_alert_summary AS
SELECT 
  instructor_id,
  course_id,
  COUNT(*) as total_alerts,
  COUNT(CASE WHEN status = 'new' THEN 1 END) as new_alerts,
  COUNT(CASE WHEN priority = 'critical' THEN 1 END) as critical_alerts,
  COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_alerts,
  AVG(risk_score) as avg_risk_score,
  MAX(created_at) as latest_alert
FROM cross_course_gap_alerts
WHERE status NOT IN ('resolved', 'dismissed')
GROUP BY instructor_id, course_id;

-- Migration complete