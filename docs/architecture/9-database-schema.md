# 9. Database Schema

## D1 Database Schema (SQL)

```sql
-- Assessment configuration table
CREATE TABLE assessment_configs (
    id TEXT PRIMARY KEY,
    platform_id TEXT NOT NULL,
    resource_link_id TEXT NOT NULL,
    assessment_type TEXT CHECK(assessment_type IN ('chat', 'flashcards', 'fill_blank')),
    mastery_threshold REAL DEFAULT 80,
    grading_schema TEXT CHECK(grading_schema IN ('mastery', 'percentage', 'engagement')),
    ai_config JSON,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(platform_id, resource_link_id)
);

-- Conversations table
CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    assessment_config_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    status TEXT CHECK(status IN ('active', 'completed', 'abandoned')),
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    mastery_score REAL DEFAULT 0,
    metadata JSON,
    FOREIGN KEY (assessment_config_id) REFERENCES assessment_configs(id),
    INDEX idx_user_course (user_id, course_id),
    INDEX idx_status (status)
);

-- Conversation messages table
CREATE TABLE conversation_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    INDEX idx_conversation (conversation_id)
);

-- Student progress tracking
CREATE TABLE student_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    total_assessments INTEGER DEFAULT 0,
    average_mastery REAL DEFAULT 0,
    struggle_patterns JSON,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, course_id),
    INDEX idx_course (course_id)
);

-- Generated content cache
CREATE TABLE generated_content (
    id TEXT PRIMARY KEY,
    assessment_config_id TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    content_type TEXT,
    content JSON NOT NULL,
    approved BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assessment_config_id) REFERENCES assessment_configs(id),
    UNIQUE(assessment_config_id, content_hash)
);

-- Analytics aggregation table
CREATE TABLE analytics_snapshots (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL,
    assignment_id TEXT,
    snapshot_data JSON NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_course_assignment (course_id, assignment_id)
);
```
