-- Migration 010: Canvas Content Integration Tables
-- Creates tables for Canvas postMessage integration, content references, and context tracking
-- Based on Story 7.1 requirements with security and privacy compliance

-- Canvas content references for assessment context
CREATE TABLE canvas_content_references (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  student_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('assignment', 'quiz', 'discussion', 'page', 'module', 'file')),
  content_id TEXT NOT NULL,
  content_title TEXT,
  content_url TEXT,
  extracted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT NOT NULL DEFAULT '{}', -- JSON metadata object
  privacy_settings TEXT NOT NULL DEFAULT '{}', -- JSON privacy configuration
  retention_expires DATETIME,

  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Canvas context state tracking for real-time awareness
CREATE TABLE canvas_context_states (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  session_id TEXT NOT NULL UNIQUE,
  student_id TEXT NOT NULL,
  current_content_id TEXT,
  navigation_history TEXT NOT NULL DEFAULT '[]', -- JSON navigation array
  active_assessments TEXT NOT NULL DEFAULT '[]', -- JSON assessment array
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME, -- Session expiration

  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (current_content_id) REFERENCES canvas_content_references(id) ON DELETE SET NULL
);

-- PostMessage security audit log for compliance and monitoring
CREATE TABLE postmessage_security_log (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  message_id TEXT NOT NULL,
  origin TEXT NOT NULL,
  message_type TEXT NOT NULL,
  validated BOOLEAN NOT NULL,
  signature_valid BOOLEAN NOT NULL,
  rate_limit_applied BOOLEAN DEFAULT FALSE,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  session_id TEXT,
  error_details TEXT,

  -- Index for security monitoring queries
  INDEX idx_security_log_timestamp (timestamp),
  INDEX idx_security_log_origin (origin),
  INDEX idx_security_log_validation (validated)
);

-- Canvas page content for struggle detection and analysis
CREATE TABLE canvas_page_content (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  page_type TEXT NOT NULL,
  course_id TEXT,
  module_name TEXT,
  assignment_title TEXT,
  content_text TEXT,
  content_hash TEXT NOT NULL,
  difficulty REAL CHECK (difficulty >= 0.0 AND difficulty <= 1.0),
  extracted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  extraction_method TEXT NOT NULL CHECK (extraction_method IN ('canvas_api', 'dom_fallback')),
  metadata TEXT NOT NULL DEFAULT '{}', -- JSON metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Prevent duplicate content extraction
  UNIQUE(content_hash, session_id)
);

-- Behavioral signals for Canvas interaction analysis
CREATE TABLE behavioral_signals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  element_context TEXT,
  page_content_hash TEXT,
  timestamp DATETIME NOT NULL,
  nonce TEXT NOT NULL,
  origin TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance optimization
CREATE INDEX idx_content_references_student ON canvas_content_references(student_id);
CREATE INDEX idx_content_references_course ON canvas_content_references(course_id);
CREATE INDEX idx_content_references_type ON canvas_content_references(content_type);
CREATE INDEX idx_content_references_extracted ON canvas_content_references(extracted_at);
CREATE INDEX idx_content_references_retention ON canvas_content_references(retention_expires);

CREATE INDEX idx_context_states_session ON canvas_context_states(session_id);
CREATE INDEX idx_context_states_student ON canvas_context_states(student_id);
CREATE INDEX idx_context_states_updated ON canvas_context_states(last_updated);

CREATE INDEX idx_page_content_tenant ON canvas_page_content(tenant_id);
CREATE INDEX idx_page_content_session ON canvas_page_content(session_id);
CREATE INDEX idx_page_content_hash ON canvas_page_content(content_hash);
CREATE INDEX idx_page_content_extracted ON canvas_page_content(extracted_at);

CREATE INDEX idx_behavioral_signals_user ON behavioral_signals(user_id);
CREATE INDEX idx_behavioral_signals_session ON behavioral_signals(session_id);
CREATE INDEX idx_behavioral_signals_type ON behavioral_signals(signal_type);
CREATE INDEX idx_behavioral_signals_timestamp ON behavioral_signals(timestamp);

-- Update triggers for maintaining timestamps
CREATE TRIGGER update_context_states_timestamp
  AFTER UPDATE ON canvas_context_states
BEGIN
  UPDATE canvas_context_states SET last_updated = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Data retention trigger for expired content references
CREATE TRIGGER cleanup_expired_content_references
  AFTER INSERT ON canvas_content_references
BEGIN
  DELETE FROM canvas_content_references
  WHERE retention_expires IS NOT NULL AND retention_expires < CURRENT_TIMESTAMP;
END;

-- Data retention trigger for expired context states
CREATE TRIGGER cleanup_expired_context_states
  AFTER INSERT ON canvas_context_states
BEGIN
  DELETE FROM canvas_context_states
  WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP;
END;

-- Security log retention (keep for audit purposes)
CREATE TRIGGER cleanup_old_security_logs
  AFTER INSERT ON postmessage_security_log
BEGIN
  DELETE FROM postmessage_security_log
  WHERE timestamp < datetime('now', '-90 days');
END;

-- Views for common queries
CREATE VIEW canvas_content_summary AS
SELECT
  cr.student_id,
  cr.course_id,
  cr.content_type,
  COUNT(*) as content_count,
  MAX(cr.extracted_at) as latest_extraction,
  GROUP_CONCAT(DISTINCT cr.content_title) as content_titles
FROM canvas_content_references cr
WHERE cr.retention_expires IS NULL OR cr.retention_expires > CURRENT_TIMESTAMP
GROUP BY cr.student_id, cr.course_id, cr.content_type;

CREATE VIEW active_canvas_sessions AS
SELECT
  cs.session_id,
  cs.student_id,
  cr.content_title as current_content,
  cr.content_type,
  cs.last_updated,
  json_array_length(cs.navigation_history) as navigation_count
FROM canvas_context_states cs
LEFT JOIN canvas_content_references cr ON cs.current_content_id = cr.id
WHERE cs.expires_at IS NULL OR cs.expires_at > CURRENT_TIMESTAMP;

-- Migration complete