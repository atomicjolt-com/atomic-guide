-- Test seed data - minimal set to find the issue

-- Create development tenant
INSERT INTO tenants (
    id, iss, client_id, deployment_ids,
    institution_name, lms_type, lms_url
) VALUES (
    'dev_tenant_002',
    'https://canvas.dev.edu',
    'dev_client_002',
    '["dev_deployment_002"]',
    'Development University',
    'canvas',
    'https://canvas.dev.edu'
);

-- Create test learners
INSERT INTO learner_profiles (
    id, tenant_id, lti_user_id, lti_deployment_id, email, name,
    forgetting_curve_s, learning_velocity, optimal_difficulty, preferred_modality,
    peak_performance_time, avg_session_duration, total_sessions
) VALUES
    ('learner_005', 'dev_tenant_002', 'user_005', 'dev_deployment_002', 'test@university.edu', 'Test User',
     1.5, 1.3, 0.75, 'visual', 'morning', 45, 25);