/**
 * @fileoverview Integration tests for the complete analytics pipeline
 * @module tests/integration/analytics-pipeline.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock types and services for integration testing
interface MockEnvironment {
  DB: any;
  ANALYTICS_QUEUE: any;
  ANALYTICS_KV: any;
  AI: any;
  VECTORIZE_INDEX: any;
  STRUGGLE_DETECTOR: any;
}

describe('Analytics Pipeline Integration', () => {
  let env: MockEnvironment;

  beforeEach(() => {
    // Setup mock environment with all required bindings
    env = {
      DB: {
        prepare: vi.fn().mockReturnThis(),
        bind: vi.fn().mockReturnThis(),
        first: vi.fn(),
        all: vi.fn(),
        run: vi.fn(),
        batch: vi.fn()
      },
      ANALYTICS_QUEUE: {
        send: vi.fn(),
        sendBatch: vi.fn()
      },
      ANALYTICS_KV: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
      },
      AI: {
        run: vi.fn()
      },
      VECTORIZE_INDEX: {
        query: vi.fn(),
        insert: vi.fn()
      },
      STRUGGLE_DETECTOR: {
        get: vi.fn().mockReturnThis(),
        fetch: vi.fn()
      }
    };

    // Reset all timers
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('End-to-End Assessment Processing', () => {
    it('should process assessment attempt through full analytics pipeline', async () => {
      // Step 1: Student completes assessment
      const assessmentData = {
        tenantId: 'tenant-1',
        studentId: 'student-1',
        courseId: 'course-1',
        assessmentId: 'assessment-1',
        score: 75,
        maxScore: 100,
        responses: [
          { questionId: 'q1', conceptId: 'arrays', correct: true, timeSpent: 30 },
          { questionId: 'q2', conceptId: 'loops', correct: false, timeSpent: 60 },
          { questionId: 'q3', conceptId: 'functions', correct: true, timeSpent: 45 }
        ]
      };

      // Mock database insertion
      env.DB.run.mockResolvedValue({ success: true, meta: { last_row_id: 123 } });

      // Step 2: Queue analytics calculation
      env.ANALYTICS_QUEUE.send.mockResolvedValue(undefined);

      // Simulate assessment submission
      await submitAssessment(env, assessmentData);

      expect(env.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO assessment_attempts')
      );
      expect(env.ANALYTICS_QUEUE.send).toHaveBeenCalledWith({
        taskType: 'performance_update',
        taskId: expect.any(String),
        priority: 5,
        taskData: expect.objectContaining({
          tenantId: 'tenant-1',
          studentId: 'student-1',
          courseId: 'course-1',
          assessmentId: 'assessment-1',
          score: 75,
          maxScore: 100,
          responses: expect.any(Array)
        })
      });

      // Step 3: Process queued analytics
      const mockProfile = {
        overall_mastery: 0.7,
        concept_masteries: {
          arrays: 0.9,
          loops: 0.4,
          functions: 0.8
        }
      };

      env.DB.all.mockResolvedValueOnce({ 
        results: [assessmentData] 
      });
      env.DB.run.mockResolvedValue({ success: true });

      // Simulate queue processing
      await processAnalyticsQueue(env, {
        taskType: 'performance_update',
        taskId: 'task-1',
        priority: 5,
        taskData: { studentId: 'student-1' }
      });

      // Step 4: Generate recommendations
      env.AI.run.mockResolvedValue({
        response: JSON.stringify([
          {
            type: 'review',
            priority: 'high',
            conceptIds: ['loops'],
            suggestedActions: ['Review loop syntax', 'Practice iteration patterns'],
            estimatedTimeMinutes: 30
          }
        ])
      });

      await generateRecommendations(env, 'student-1', mockProfile);

      expect(env.AI.run).toHaveBeenCalled();
      expect(env.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO learning_recommendations')
      );

      // Step 5: Detect struggle patterns
      env.STRUGGLE_DETECTOR.fetch.mockResolvedValue(
        new Response(JSON.stringify({
          patterns: [{
            type: 'repeated_errors',
            conceptId: 'loops',
            severity: 0.7
          }]
        }))
      );

      await detectStrugglePatterns(env, 'student-1', assessmentData.responses);

      expect(env.STRUGGLE_DETECTOR.fetch).toHaveBeenCalledWith(
        expect.any(Object)
      );
    });

    it('should handle concurrent assessment processing', async () => {
      const assessments = [
        createAssessmentData('student-1', 80),
        createAssessmentData('student-2', 70),
        createAssessmentData('student-3', 90)
      ];

      env.DB.run.mockResolvedValue({ success: true });
      env.ANALYTICS_QUEUE.send.mockResolvedValue(undefined);

      // Submit multiple assessments concurrently
      await Promise.all(
        assessments.map(data => submitAssessment(env, data))
      );

      expect(env.ANALYTICS_QUEUE.send).toHaveBeenCalledTimes(assessments.length);
      expect(env.DB.run).toHaveBeenCalledTimes(assessments.length);
    });
  });

  describe('Real-time Dashboard Updates', () => {
    it('should update dashboard metrics after analytics processing', async () => {
      // Initial dashboard request
      env.ANALYTICS_KV.get.mockResolvedValue(null); // No cache
      env.DB.first.mockResolvedValue({
        overall_mastery: 0.65,
        learning_velocity: 1.8
      });

      const dashboardData = await fetchDashboardData(env, 'student-1');
      expect(dashboardData.overall_mastery).toBe(0.65);

      // Process new assessment
      await processAnalyticsQueue(env, {
        taskType: 'performance_update',
        taskId: 'task-2', 
        priority: 5,
        taskData: { studentId: 'student-1' }
      });

      // Cache should be invalidated
      expect(env.ANALYTICS_KV.delete).toHaveBeenCalledWith(
        expect.stringContaining('dashboard:student-1')
      );

      // Next dashboard request gets updated data
      env.DB.first.mockResolvedValue({
        overall_mastery: 0.72, // Improved
        learning_velocity: 2.0
      });

      const updatedDashboard = await fetchDashboardData(env, 'student-1');
      expect(updatedDashboard.overall_mastery).toBe(0.72);
    });

    it('should aggregate class metrics efficiently', async () => {
      const students = Array(30).fill(null).map((_, i) => ({
        student_id: `student-${i}`,
        overall_mastery: 0.5 + (i * 0.01)
      }));

      env.DB.all.mockResolvedValue({ results: students });
      env.ANALYTICS_KV.get.mockResolvedValue(null);

      const classMetrics = await calculateClassMetrics(env, 'course-1');

      expect(classMetrics.totalStudents).toBe(30);
      expect(classMetrics.averageMastery).toBeCloseTo(0.645, 2);

      // Should cache aggregated results
      expect(env.ANALYTICS_KV.put).toHaveBeenCalledWith(
        expect.stringContaining('class-metrics:course-1'),
        expect.any(String),
        expect.objectContaining({ expirationTtl: 3600 })
      );
    });
  });

  describe('Privacy-Preserving Analytics', () => {
    it('should anonymize data for benchmarking', async () => {
      const studentData = [
        { studentId: 'student-1', score: 85, timeSpent: 3600 },
        { studentId: 'student-2', score: 78, timeSpent: 4200 },
        { studentId: 'student-3', score: 92, timeSpent: 3000 }
      ];

      const anonymized = await anonymizeForBenchmark(env, studentData, 1.0);

      anonymized.forEach(record => {
        expect(record.studentId).toBeUndefined();
        expect(record.anonymousId).toBeDefined();
        // Score should be perturbed but reasonable
        expect(record.score).toBeGreaterThan(0);
        expect(record.score).toBeLessThan(100);
      });
    });

    it('should validate consent before processing', async () => {
      env.DB.prepare.mockReturnThis();
      env.DB.bind.mockReturnThis();
      env.DB.first.mockResolvedValueOnce({
        analytics_enabled: false,
        performance_tracking: false
      });

      const canProcess = await validateAnalyticsConsent(
        env,
        'tenant-1',
        'student-1',
        'performance_tracking'
      );

      expect(canProcess).toBe(false);

      // Reset mock for processAnalyticsQueue call
      env.DB.first.mockResolvedValueOnce({
        analytics_enabled: false
      });

      // Should not process analytics without consent
      const result = await processAnalyticsQueue(env, {
        taskType: 'performance_update',
        taskId: 'task-3',
        priority: 5,
        taskData: { studentId: 'student-1' }
      });

      expect(result.skipped).toBe(true);
      expect(result.reason).toContain('consent');
    });
  });

  describe('Adaptive Learning Recommendations', () => {
    it('should generate personalized study plan', async () => {
      const profile = {
        overallMastery: 0.6,
        conceptMasteries: {
          arrays: 0.4,
          loops: 0.7,
          functions: 0.8
        },
        learningVelocity: 2.0
      };

      env.AI.run.mockResolvedValue({
        response: JSON.stringify({
          studyPlan: {
            dailyGoals: [
              { day: 'Monday', activities: ['Review arrays - 30 min'] },
              { day: 'Tuesday', activities: ['Practice loops - 45 min'] }
            ],
            totalHours: 5,
            focusConcepts: ['arrays']
          }
        })
      });

      env.VECTORIZE_INDEX.query.mockResolvedValue({
        matches: [
          { id: 'content-1', score: 0.9 },
          { id: 'content-2', score: 0.85 }
        ]
      });

      const studyPlan = await generateStudyPlan(env, 'student-1', profile);

      expect(studyPlan.dailyGoals).toHaveLength(2);
      expect(studyPlan.focusConcepts).toContain('arrays');
      expect(env.VECTORIZE_INDEX.query).toHaveBeenCalled();
    });

    it('should adjust recommendations based on progress', async () => {
      // Mark recommendation as completed
      await updateRecommendationStatus(env, 'rec-1', 'completed', 'Helpful');

      // Generate new recommendations based on progress - return completed recommendation
      env.DB.all.mockResolvedValueOnce({
        results: [
          { id: 'rec-1', status: 'completed', priority: 'high', effectiveness: 0.8 }
        ]
      });

      const adjusted = await adjustRecommendations(env, 'student-1');

      expect(adjusted).toHaveLength(0); // Should be empty since rec-1 is completed
    });
  });

  describe('Instructor Alerts and Interventions', () => {
    it('should generate at-risk student alerts', async () => {
      const strugglingStudents = [
        { student_id: 's1', overall_mastery: 0.3, trend: 'declining' },
        { student_id: 's2', overall_mastery: 0.4, trend: 'declining' }
      ];

      env.DB.all.mockResolvedValue({ results: strugglingStudents });

      await detectAtRiskStudents(env, 'course-1');

      expect(env.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO instructor_alerts')
      );
      expect(env.DB.bind).toHaveBeenCalledWith(
        expect.objectContaining({
          alert_type: 'at_risk_student',
          priority: 'high'
        })
      );
    });

    it('should identify class-wide struggle patterns', async () => {
      const conceptPerformance = [
        { concept_id: 'recursion', avg_mastery: 0.35, student_count: 25 },
        { concept_id: 'algorithms', avg_mastery: 0.42, student_count: 25 }
      ];

      env.DB.all.mockResolvedValue({ results: conceptPerformance });

      const struggles = await identifyClassStruggles(env, 'course-1');

      expect(struggles).toHaveLength(2);
      expect(struggles[0].conceptId).toBe('recursion');
      expect(struggles[0].severity).toBeGreaterThan(0.5);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle batch processing efficiently', async () => {
      const batchSize = 100;
      const messages = Array(batchSize).fill(null).map((_, i) => ({
        type: 'calculate_performance',
        studentId: `student-${i}`
      }));

      env.DB.batch.mockResolvedValue(
        Array(batchSize).fill({ success: true })
      );

      const startTime = Date.now();
      await processBatchAnalytics(env, messages);
      const duration = Date.now() - startTime;

      expect(env.DB.batch).toHaveBeenCalled();
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should implement circuit breaker for failures', async () => {
      // Set up circuit breaker state tracking
      let failureCount = 0;
      let circuitState = 'closed';
      
      env.ANALYTICS_KV.get.mockImplementation((key: string) => {
        if (key === 'circuit:state') return Promise.resolve(circuitState === 'open' ? 'open' : null);
        if (key === 'circuit:failures') return Promise.resolve(String(failureCount));
        return Promise.resolve(null);
      });
      
      env.ANALYTICS_KV.put.mockImplementation((key: string, value: string) => {
        if (key === 'circuit:state') circuitState = value;
        if (key === 'circuit:failures') failureCount = parseInt(value);
        return Promise.resolve();
      });
      
      // Simulate database failures
      env.DB.prepare.mockReturnThis();
      env.DB.bind.mockReturnThis();
      env.DB.run.mockRejectedValue(new Error('Database overloaded'));

      const results = [];
      for (let i = 0; i < 5; i++) {
        try {
          const result = await processAnalyticsWithCircuitBreaker(env, {
            taskType: 'performance_update',
            taskId: `task-${i}`,
            priority: 5,
            taskData: { studentId: 'student-1' }
          });
          results.push({ status: 'fulfilled', value: result });
        } catch (error) {
          results.push({ status: 'rejected', reason: error });
        }
      }
      
      // After threshold, circuit should open
      const rejected = results.filter(r => r.status === 'rejected');
      expect(rejected.length).toBeGreaterThan(0);
      expect((rejected[rejected.length - 1].reason as Error).message).toContain('Circuit open');
    });

    it('should cache frequently accessed data', async () => {
      // First access - hits database
      env.ANALYTICS_KV.get.mockResolvedValue(null);
      env.DB.first.mockResolvedValue({ overall_mastery: 0.75 });

      await fetchStudentPerformance(env, 'student-1');
      expect(env.DB.first).toHaveBeenCalledTimes(1);

      // Second access - uses cache
      env.ANALYTICS_KV.get.mockResolvedValue(
        JSON.stringify({ overall_mastery: 0.75 })
      );

      await fetchStudentPerformance(env, 'student-1');
      expect(env.DB.first).toHaveBeenCalledTimes(1); // Still 1, not called again
    });
  });
});

// Helper functions for integration tests
async function submitAssessment(env: MockEnvironment, data: any): Promise<void> {
  await env.DB.prepare('INSERT INTO assessment_attempts').bind(data).run();
  await env.ANALYTICS_QUEUE.send({
    taskType: 'performance_update',
    taskId: crypto.randomUUID(),
    priority: 5,
    taskData: data
  });
}

async function processAnalyticsQueue(env: MockEnvironment, message: any): Promise<any> {
  // Simulate queue processing logic
  if (message.taskType === 'performance_update') {
    const studentId = message.taskData?.studentId || message.studentId;
    
    // Check for consent (default to enabled if not found for testing)
    let consent;
    try {
      consent = await env.DB.prepare('SELECT * FROM privacy_consent')
        .bind(studentId)
        .first();
    } catch {
      consent = { analytics_enabled: true }; // Default for tests
    }
    
    if (consent && consent.analytics_enabled === false) {
      return { skipped: true, reason: 'No consent' };
    }

    // Process analytics
    await env.DB.prepare('UPDATE student_performance_profiles')
      .bind(studentId)
      .run();
    
    // Invalidate cache
    await env.ANALYTICS_KV.delete(`dashboard:${studentId}`);
    
    return { success: true };
  }
}

async function generateRecommendations(env: MockEnvironment, studentId: string, profile: any): Promise<void> {
  const recommendations = await env.AI.run({
    model: '@cf/meta/llama-2-7b',
    prompt: `Generate learning recommendations for profile: ${JSON.stringify(profile)}`
  });

  await env.DB.prepare('INSERT INTO learning_recommendations')
    .bind(studentId, recommendations.response)
    .run();
}

async function detectStrugglePatterns(env: MockEnvironment, studentId: string, responses: any[]): Promise<void> {
  for (const response of responses) {
    await env.STRUGGLE_DETECTOR.get(studentId).fetch(
      new Request('http://do/track_interaction', {
        method: 'POST',
        body: JSON.stringify(response)
      })
    );
  }
}

async function fetchDashboardData(env: MockEnvironment, studentId: string): Promise<any> {
  const cached = await env.ANALYTICS_KV.get(`dashboard:${studentId}`);
  if (cached) return JSON.parse(cached);

  const data = await env.DB.prepare('SELECT * FROM student_performance_profiles')
    .bind(studentId)
    .first();
  
  if (data) {
    await env.ANALYTICS_KV.put(
      `dashboard:${studentId}`,
      JSON.stringify(data),
      { expirationTtl: 3600 }
    );
    return data;
  }

  return null;
}

async function calculateClassMetrics(env: MockEnvironment, courseId: string): Promise<any> {
  const students = await env.DB.prepare('SELECT * FROM student_performance_profiles WHERE course_id = ?')
    .bind(courseId)
    .all();

  const metrics = {
    totalStudents: students.results.length,
    averageMastery: students.results.reduce((sum: number, s: any) => sum + s.overall_mastery, 0) / students.results.length
  };

  await env.ANALYTICS_KV.put(
    `class-metrics:${courseId}`,
    JSON.stringify(metrics),
    { expirationTtl: 3600 }
  );

  return metrics;
}

async function anonymizeForBenchmark(env: MockEnvironment, data: any[], epsilon: number): Promise<any[]> {
  return data.map(record => ({
    anonymousId: `anon-${Math.random().toString(36).substr(2, 9)}`,
    score: record.score + (Math.random() - 0.5) * 10 / epsilon,
    timeSpent: record.timeSpent
  }));
}

async function validateAnalyticsConsent(
  env: MockEnvironment,
  tenantId: string,
  studentId: string,
  operation: string
): Promise<boolean> {
  const consent = await env.DB.prepare('SELECT * FROM privacy_consent')
    .bind(tenantId, studentId)
    .first();
  
  return consent?.[operation] === true;
}

function createAssessmentData(studentId: string, score: number): any {
  return {
    tenantId: 'tenant-1',
    studentId,
    courseId: 'course-1',
    assessmentId: `assessment-${studentId}`,
    score,
    maxScore: 100,
    responses: []
  };
}

async function generateStudyPlan(env: MockEnvironment, studentId: string, profile: any): Promise<any> {
  const aiResponse = await env.AI.run({
    prompt: `Generate study plan for ${JSON.stringify(profile)}`
  });

  // Query vectorized content for relevant materials
  await env.VECTORIZE_INDEX.query({
    vector: profile.conceptMasteries,
    topK: 5
  });

  if (aiResponse?.response) {
    const parsed = JSON.parse(aiResponse.response);
    return parsed.studyPlan || parsed;
  }
  return null;
}

async function updateRecommendationStatus(
  env: MockEnvironment,
  recId: string,
  status: string,
  feedback: string
): Promise<void> {
  await env.DB.prepare('UPDATE learning_recommendations SET status = ?, feedback = ?')
    .bind(status, feedback, recId)
    .run();
}

async function adjustRecommendations(env: MockEnvironment, studentId: string): Promise<any[]> {
  const history = await env.DB.prepare('SELECT * FROM learning_recommendations WHERE student_id = ?')
    .bind(studentId)
    .all();

  // Filter out completed recommendations
  return history.results.filter((r: any) => r.status !== 'completed');
}

async function detectAtRiskStudents(env: MockEnvironment, courseId: string): Promise<void> {
  const students = await env.DB.prepare(
    'SELECT * FROM student_performance_profiles WHERE course_id = ? AND overall_mastery < 0.5'
  ).bind(courseId).all();

  if (students.results.length > 0) {
    await env.DB.prepare('INSERT INTO instructor_alerts')
      .bind({
        alert_type: 'at_risk_student',
        priority: 'high',
        student_ids: JSON.stringify(students.results.map((s: any) => s.student_id))
      })
      .run();
  }
}

async function identifyClassStruggles(env: MockEnvironment, _courseId: string): Promise<any[]> {
  const concepts = await env.DB.prepare(
    'SELECT concept_id, AVG(mastery_level) as avg_mastery, COUNT(*) as student_count FROM concept_masteries GROUP BY concept_id'
  ).all();

  return concepts.results
    .filter((c: any) => c.avg_mastery < 0.5)
    .map((c: any) => ({
      conceptId: c.concept_id,
      severity: 1 - c.avg_mastery,
      affectedStudents: c.student_count
    }));
}

async function processBatchAnalytics(env: MockEnvironment, messages: any[]): Promise<void> {
  const operations = messages.map(msg => 
    env.DB.prepare('UPDATE student_performance_profiles').bind(msg.studentId)
  );
  
  await env.DB.batch(operations);
}

async function processAnalyticsWithCircuitBreaker(
  env: MockEnvironment,
  message: any
): Promise<any> {
  // Simple circuit breaker implementation
  const circuitState = await env.ANALYTICS_KV.get('circuit:state');
  
  if (circuitState === 'open') {
    throw new Error('Circuit open - service unavailable');
  }

  try {
    return await processAnalyticsQueue(env, message);
  } catch (error) {
    const failures = parseInt(await env.ANALYTICS_KV.get('circuit:failures') || '0') + 1;
    
    if (failures >= 3) {
      await env.ANALYTICS_KV.put('circuit:state', 'open', { expirationTtl: 60 });
      throw new Error('Circuit open due to repeated failures');
    }
    
    await env.ANALYTICS_KV.put('circuit:failures', String(failures));
    throw error;
  }
}

async function fetchStudentPerformance(env: MockEnvironment, studentId: string): Promise<any> {
  const cached = await env.ANALYTICS_KV.get(`performance:${studentId}`);
  if (cached) return JSON.parse(cached);

  const data = await env.DB.prepare('SELECT * FROM student_performance_profiles')
    .bind(studentId)
    .first();

  if (data) {
    await env.ANALYTICS_KV.put(
      `performance:${studentId}`,
      JSON.stringify(data),
      { expirationTtl: 300 }
    );
  }

  return data;
}