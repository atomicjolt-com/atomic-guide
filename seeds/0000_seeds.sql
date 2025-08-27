-- Atomic Guide D1 Database Seed Data
-- Test data for development and testing environments
-- WARNING: Do not run this in production!

-- ============================================
-- TENANTS
-- ============================================

-- Create development tenant
INSERT INTO tenants (
    id, iss, client_id, deployment_ids,
    institution_name, lms_type, lms_url
) VALUES (
    'dev_tenant_001',
    'https://canvas.dev.edu',
    'dev_client_001',
    '["dev_deployment_001"]',
    'Development University',
    'canvas',
    'https://canvas.dev.edu'
);

-- ============================================
-- LEARNER PROFILES
-- ============================================

-- Create test learners with different cognitive profiles
INSERT INTO learner_profiles (
    id, tenant_id, lti_user_id, lti_deployment_id, email, name,
    forgetting_curve_s, learning_velocity, optimal_difficulty, preferred_modality,
    peak_performance_time, avg_session_duration, total_sessions
) VALUES
    -- High performer - fast learner with strong retention
    ('learner_001', 'dev_tenant_001', 'user_001', 'dev_deployment_001', 'alice@university.edu', 'Alice Johnson',
     1.5, 1.3, 0.75, 'visual', 'morning', 45, 25),

    -- Average performer - standard learning pace
    ('learner_002', 'dev_tenant_001', 'user_002', 'dev_deployment_001', 'bob@university.edu', 'Bob Smith',
     1.0, 1.0, 0.7, 'mixed', 'afternoon', 30, 20),

    -- Struggling learner - needs more support
    ('learner_003', 'dev_tenant_001', 'user_003', 'dev_deployment_001', 'charlie@university.edu', 'Charlie Davis',
     0.7, 0.8, 0.65, 'kinesthetic', 'evening', 20, 15),

    -- Highly engaged but moderate pace
    ('learner_004', 'dev_tenant_001', 'user_004', 'dev_deployment_001', 'diana@university.edu', 'Diana Martinez',
     1.1, 0.9, 0.72, 'reading', 'morning', 60, 40);

-- ============================================
-- KNOWLEDGE GRAPH
-- ============================================

-- Create a simple knowledge graph for a CS101 course
INSERT INTO knowledge_graph (
    tenant_id, concept_id, concept_name, concept_type,
    lti_context_id, module_id, difficulty_level, importance_weight,
    prerequisites, related_concepts
) VALUES
    -- Foundation concepts
    ('dev_tenant_001', 'cs101_variables', 'Variables and Data Types', 'topic',
     'context_cs101', 'module_1', 0.2, 1.0,
     '[]', '["cs101_operators", "cs101_functions"]'),

    ('dev_tenant_001', 'cs101_operators', 'Operators and Expressions', 'topic',
     'context_cs101', 'module_1', 0.3, 0.9,
     '["cs101_variables"]', '["cs101_control_flow"]'),

    ('dev_tenant_001', 'cs101_control_flow', 'Control Flow', 'topic',
     'context_cs101', 'module_2', 0.4, 1.0,
     '["cs101_variables", "cs101_operators"]', '["cs101_loops", "cs101_functions"]'),

    ('dev_tenant_001', 'cs101_loops', 'Loops and Iteration', 'topic',
     'context_cs101', 'module_2', 0.5, 0.9,
     '["cs101_control_flow"]', '["cs101_arrays"]'),

    ('dev_tenant_001', 'cs101_functions', 'Functions and Scope', 'topic',
     'context_cs101', 'module_3', 0.6, 1.0,
     '["cs101_variables", "cs101_control_flow"]', '["cs101_recursion"]'),

    ('dev_tenant_001', 'cs101_arrays', 'Arrays and Lists', 'topic',
     'context_cs101', 'module_3', 0.5, 0.8,
     '["cs101_loops"]', '["cs101_sorting"]'),

    ('dev_tenant_001', 'cs101_recursion', 'Recursion', 'topic',
     'context_cs101', 'module_4', 0.7, 0.7,
     '["cs101_functions"]', '["cs101_sorting"]'),

    ('dev_tenant_001', 'cs101_sorting', 'Sorting Algorithms', 'topic',
     'context_cs101', 'module_4', 0.8, 0.6,
     '["cs101_arrays", "cs101_loops"]', '[]');

-- ============================================
-- CONCEPT MASTERY
-- ============================================

-- Assign mastery levels to learners
INSERT INTO concept_mastery (
    tenant_id, learner_profile_id, concept_id,
    mastery_level, confidence_interval, attempts, successes,
    last_practiced_at, next_review_at, review_interval_days, ease_factor, risk_score
) VALUES
    -- Alice (high performer) - strong across the board
    ('dev_tenant_001', 'learner_001', 'cs101_variables', 0.95, 0.1, 10, 9, datetime('now', '-1 day'), datetime('now', '+7 days'), 7, 2.8, 0.1),
    ('dev_tenant_001', 'learner_001', 'cs101_operators', 0.90, 0.15, 8, 7, datetime('now', '-2 days'), datetime('now', '+5 days'), 5, 2.6, 0.15),
    ('dev_tenant_001', 'learner_001', 'cs101_control_flow', 0.85, 0.2, 12, 10, datetime('now', '-3 days'), datetime('now', '+4 days'), 4, 2.5, 0.2),
    ('dev_tenant_001', 'learner_001', 'cs101_loops', 0.80, 0.2, 15, 12, datetime('now', '-1 day'), datetime('now', '+3 days'), 3, 2.4, 0.25),

    -- Bob (average) - moderate mastery
    ('dev_tenant_001', 'learner_002', 'cs101_variables', 0.85, 0.2, 12, 10, datetime('now', '-2 days'), datetime('now', '+3 days'), 3, 2.5, 0.2),
    ('dev_tenant_001', 'learner_002', 'cs101_operators', 0.75, 0.25, 10, 7, datetime('now', '-3 days'), datetime('now', '+2 days'), 2, 2.3, 0.3),
    ('dev_tenant_001', 'learner_002', 'cs101_control_flow', 0.65, 0.3, 14, 9, datetime('now', '-1 day'), datetime('now', '+1 day'), 1, 2.1, 0.4),

    -- Charlie (struggling) - needs support
    ('dev_tenant_001', 'learner_003', 'cs101_variables', 0.70, 0.3, 20, 14, datetime('now', '-1 day'), datetime('now', '+1 day'), 1, 2.0, 0.35),
    ('dev_tenant_001', 'learner_003', 'cs101_operators', 0.55, 0.35, 18, 10, datetime('now', '-2 days'), datetime('now'), 1, 1.8, 0.5),
    ('dev_tenant_001', 'learner_003', 'cs101_control_flow', 0.40, 0.4, 25, 10, datetime('now', '-4 hours'), datetime('now', '+12 hours'), 1, 1.5, 0.7),

    -- Diana (engaged) - good retention but slower pace
    ('dev_tenant_001', 'learner_004', 'cs101_variables', 0.90, 0.15, 15, 13, datetime('now', '-2 days'), datetime('now', '+5 days'), 5, 2.6, 0.15),
    ('dev_tenant_001', 'learner_004', 'cs101_operators', 0.80, 0.2, 12, 9, datetime('now', '-3 days'), datetime('now', '+3 days'), 3, 2.4, 0.25),
    ('dev_tenant_001', 'learner_004', 'cs101_control_flow', 0.70, 0.25, 18, 12, datetime('now', '-1 day'), datetime('now', '+2 days'), 2, 2.2, 0.35);

-- ============================================
-- LEARNING SESSIONS
-- ============================================

-- Create recent learning sessions
INSERT INTO learning_sessions (
    tenant_id, learner_profile_id, lti_context_id, session_id,
    started_at, ended_at, duration_seconds, page_views, interactions,
    content_type, content_id, content_title,
    engagement_score, struggle_events, help_requests
) VALUES
    -- Alice's sessions - highly engaged
    ('dev_tenant_001', 'learner_001', 'context_cs101', 'session_001',
     datetime('now', '-2 hours'), datetime('now', '-1 hour'), 3600, 25, 40,
     'lecture', 'lecture_loops', 'Introduction to Loops',
     0.9, 1, 0),

    ('dev_tenant_001', 'learner_001', 'context_cs101', 'session_002',
     datetime('now', '-25 hours'), datetime('now', '-24 hours'), 3000, 20, 35,
     'assignment', 'hw_functions', 'Functions Practice',
     0.85, 2, 1),

    -- Bob's sessions - moderate engagement
    ('dev_tenant_001', 'learner_002', 'context_cs101', 'session_003',
     datetime('now', '-3 hours'), datetime('now', '-2 hours'), 3000, 18, 25,
     'lecture', 'lecture_control', 'Control Flow Basics',
     0.7, 3, 1),

    -- Charlie's sessions - struggling
    ('dev_tenant_001', 'learner_003', 'context_cs101', 'session_004',
     datetime('now', '-4 hours'), datetime('now', '-3 hours'), 2400, 30, 20,
     'assignment', 'hw_operators', 'Operators Exercise',
     0.5, 8, 3),

    -- Diana's sessions - long and focused
    ('dev_tenant_001', 'learner_004', 'context_cs101', 'session_005',
     datetime('now', '-5 hours'), datetime('now', '-3 hours'), 7200, 40, 60,
     'resource', 'textbook_ch3', 'Chapter 3: Functions',
     0.8, 4, 2);

-- ============================================
-- STRUGGLE EVENTS
-- ============================================

-- Record struggle events for analysis
INSERT INTO struggle_events (
    tenant_id, learner_profile_id, session_id,
    event_type, confidence_score, page_element, content_context,
    duration_ms, intervention_triggered, intervention_type
) VALUES
    -- Charlie's struggles
    ('dev_tenant_001', 'learner_003', 'session_004',
     'hover_confusion', 0.8, '#operator-precedence', 'Understanding operator precedence',
     15000, TRUE, 'chat_prompt'),

    ('dev_tenant_001', 'learner_003', 'session_004',
     'repeated_access', 0.9, '#example-code-2', 'Complex expression evaluation',
     30000, TRUE, 'resource_suggestion'),

    ('dev_tenant_001', 'learner_003', 'session_004',
     'idle_timeout', 0.7, '#exercise-3', 'Stuck on exercise',
     120000, TRUE, 'chat_prompt'),

    -- Bob's minor struggles
    ('dev_tenant_001', 'learner_002', 'session_003',
     'rapid_scrolling', 0.6, '.lecture-slides', 'Looking for specific information',
     8000, FALSE, NULL),

    -- Diana's focused review
    ('dev_tenant_001', 'learner_004', 'session_005',
     'repeated_access', 0.5, '#recursion-example', 'Reviewing complex concept',
     25000, FALSE, NULL);

-- ============================================
-- CHAT CONVERSATIONS
-- ============================================

-- Create chat conversations
INSERT INTO chat_conversations (
    tenant_id, learner_profile_id, conversation_id,
    started_at, last_message_at, message_count,
    lti_context_id, initial_context, conversation_topic,
    status, satisfaction_rating, resolution_status
) VALUES
    ('dev_tenant_001', 'learner_003', 'conv_001',
     datetime('now', '-3 hours'), datetime('now', '-2.5 hours'), 8,
     'context_cs101', 'Struggle detected on operators', 'Operator precedence',
     'closed', 4, 'resolved'),

    ('dev_tenant_001', 'learner_002', 'conv_002',
     datetime('now', '-1 hour'), datetime('now', '-45 minutes'), 5,
     'context_cs101', 'User initiated', 'Control flow help',
     'closed', 5, 'resolved'),

    ('dev_tenant_001', 'learner_004', 'conv_003',
     datetime('now', '-30 minutes'), datetime('now', '-10 minutes'), 12,
     'context_cs101', 'User initiated', 'Recursion explanation',
     'idle', NULL, NULL);

-- ============================================
-- CHAT MESSAGES
-- ============================================

-- Sample chat messages
INSERT INTO chat_messages (
    tenant_id, conversation_id, message_id, sender_type, message_content,
    created_at, tokens_used, model_used, detected_intent, confidence_score
) VALUES
    -- Charlie's conversation about operators
    ('dev_tenant_001', 'conv_001', 'msg_001', 'system',
     'I noticed you might be having trouble with operator precedence. Would you like some help?',
     datetime('now', '-3 hours'), 0, NULL, 'proactive_help', 0.8),

    ('dev_tenant_001', 'conv_001', 'msg_002', 'learner',
     'Yes! I dont understand why 2 + 3 * 4 equals 14 and not 20',
     datetime('now', '-2.95 hours'), 0, NULL, 'confusion', 0.9),

    ('dev_tenant_001', 'conv_001', 'msg_003', 'ai',
     'Great question! This is about operator precedence. In mathematics and programming, multiplication (*) has higher precedence than addition (+). This means 3 * 4 is calculated first (giving 12), then 2 is added (giving 14). To get 20, you would need parentheses: (2 + 3) * 4.',
     datetime('now', '-2.9 hours'), 150, 'gpt-4', 'explanation', 0.95),

    -- Bob's conversation
    ('dev_tenant_001', 'conv_002', 'msg_004', 'learner',
     'Can you explain the difference between if-else and switch statements?',
     datetime('now', '-1 hour'), 0, NULL, 'question', 0.9),

    ('dev_tenant_001', 'conv_002', 'msg_005', 'ai',
     'Certainly! Both if-else and switch are control flow statements, but they work best in different scenarios...',
     datetime('now', '-58 minutes'), 200, 'gpt-4', 'explanation', 0.95);

-- ============================================
-- INTERVENTION LOGS
-- ============================================

-- Track intervention effectiveness
INSERT INTO intervention_logs (
    tenant_id, learner_profile_id, struggle_event_id,
    intervention_type, triggered_at, accepted_at,
    effectiveness_score, time_to_resolution_seconds,
    intervention_content
) VALUES
    ('dev_tenant_001', 'learner_003', NULL, 'proactive_chat',
     datetime('now', '-3 hours'), datetime('now', '-2.95 hours'),
     0.8, 300,
     '{"message": "Offered help with operator precedence", "accepted": true}'),

    ('dev_tenant_001', 'learner_003', NULL, 'resource_suggestion',
     datetime('now', '-2.8 hours'), datetime('now', '-2.75 hours'),
     0.6, 180,
     '{"resource": "Interactive operator precedence tutorial", "viewed": true}');

-- ============================================
-- COURSE ANALYTICS
-- ============================================

-- Aggregate course analytics
INSERT INTO course_analytics (
    tenant_id, lti_context_id,
    total_learners, active_learners_7d, avg_engagement_score,
    avg_mastery_level, at_risk_learners, struggle_event_rate,
    chat_sessions_total, chat_satisfaction_avg, chat_resolution_rate,
    calculated_at, period_start, period_end
) VALUES
    ('dev_tenant_001', 'context_cs101',
     4, 4, 0.725,
     0.68, 1, 3.25,
     3, 4.5, 0.67,
     datetime('now'), datetime('now', '-7 days'), datetime('now'));

-- ============================================
-- INSTRUCTOR PREFERENCES
-- ============================================

-- Set up instructor dashboard preferences
INSERT INTO instructor_preferences (
    tenant_id, lti_user_id,
    dashboard_layout, alert_thresholds, notification_preferences,
    show_individual_data, anonymize_below_threshold
) VALUES
    ('dev_tenant_001', 'instructor_001',
     '{"widgets": ["at_risk", "engagement", "mastery", "chat_activity"], "layout": "grid"}',
     '{"struggle_rate": 0.3, "at_risk_mastery": 0.6, "low_engagement": 0.5}',
     '{"email": true, "in_app": true, "daily_digest": true}',
     TRUE, 5);

-- ============================================
-- AUDIT LOGS
-- ============================================

-- Sample audit entries
INSERT INTO audit_logs (
    tenant_id, actor_type, actor_id,
    action, resource_type, resource_id,
    ip_address, user_agent, details
) VALUES
    ('dev_tenant_001', 'instructor', 'instructor_001',
     'view', 'analytics', 'context_cs101',
     '192.168.1.100', 'Mozilla/5.0', '{"view": "course_dashboard"}'),

    ('dev_tenant_001', 'learner', 'user_003',
     'export', 'profile', 'user_003',
     '192.168.1.101', 'Mozilla/5.0', '{"format": "json", "gdpr_request": true}');

-- ============================================
-- SUMMARY
-- ============================================

-- This seed data creates:
-- - 4 learner profiles with different cognitive profiles
-- - 8 knowledge graph concepts for a CS101 course
-- - 13 concept mastery records showing varied performance
-- - 5 recent learning sessions
-- - 5 struggle events primarily for the struggling learner
-- - 3 chat conversations with messages
-- - 2 intervention logs
-- - Course analytics summary
-- - Instructor preferences
-- - Sample audit logs

-- To verify the seed data - run these queries separately:
-- SELECT 'Seed data loaded successfully!' as status;
-- SELECT COUNT(*) as learner_count FROM learner_profiles;
-- SELECT COUNT(*) as concept_count FROM knowledge_graph;
-- SELECT COUNT(*) as mastery_count FROM concept_mastery;
-- SELECT COUNT(*) as session_count FROM learning_sessions;
-- SELECT COUNT(*) as chat_count FROM chat_conversations;