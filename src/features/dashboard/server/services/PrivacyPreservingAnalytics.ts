/**
 * @fileoverview Privacy-preserving analytics service with differential privacy implementation
 * @module features/dashboard/server/services/PrivacyPreservingAnalytics
 */

import { z } from 'zod';
import type { D1Database } from '@cloudflare/workers-types';

/**
 * Schema for differential privacy parameters
 */
export const DifferentialPrivacyParamsSchema = z.object({
  epsilon: z.number().min(0.01).max(10), // Privacy budget (lower = more privacy)
  delta: z.number().min(0).max(1), // Probability of privacy breach
  sensitivity: z.number().min(0), // Maximum change one individual can cause
  noiseScale: z.number().min(0), // Scale of noise to add
});

export type DifferentialPrivacyParams = z.infer<typeof DifferentialPrivacyParamsSchema>;

/**
 * Schema for anonymized benchmark data
 */
export const AnonymizedBenchmarkSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  courseId: z.string(),
  conceptId: z.string().optional(),
  assessmentId: z.string().optional(),
  benchmarkType: z.enum(['course_average', 'percentile_bands', 'difficulty_calibration']),
  aggregationLevel: z.enum(['course', 'module', 'concept', 'assessment']),
  sampleSize: z.number().int().min(0),
  meanScore: z.number().optional(),
  medianScore: z.number().optional(),
  stdDeviation: z.number().optional(),
  percentile25: z.number().optional(),
  percentile75: z.number().optional(),
  percentile90: z.number().optional(),
  epsilon: z.number().optional(),
  noiseScale: z.number().optional(),
  calculatedAt: z.string().datetime(),
  validUntil: z.string().datetime(),
  confidenceInterval: z.number().min(0).max(1),
});

export type AnonymizedBenchmark = z.infer<typeof AnonymizedBenchmarkSchema>;

/**
 * Schema for privacy consent validation
 */
export const PrivacyConsentSchema = z.object({
  tenantId: z.string(),
  studentId: z.string(),
  courseId: z.string().optional(),
  performanceAnalyticsConsent: z.boolean(),
  predictiveAnalyticsConsent: z.boolean(),
  benchmarkComparisonConsent: z.boolean(),
  instructorVisibilityConsent: z.boolean(),
  dataRetentionPreference: z.number().int().min(1).max(2555), // Days
  anonymizationRequired: z.boolean(),
  consentGivenAt: z.string().datetime(),
  consentUpdatedAt: z.string().datetime(),
  consentVersion: z.string(),
  withdrawalRequestedAt: z.string().datetime().optional(),
});

export type PrivacyConsent = z.infer<typeof PrivacyConsentSchema>;

/**
 * Privacy-preserving analytics service implementing differential privacy
 * 
 * Provides FERPA-compliant analytics with granular consent controls and
 * differential privacy techniques for cross-student benchmarking.
 * 
 * @class PrivacyPreservingAnalytics
 */
export class PrivacyPreservingAnalytics {
  // Standard privacy parameters for different use cases
  private static readonly PRIVACY_PARAMS = {
    HIGH_PRIVACY: { epsilon: 0.1, delta: 1e-6, sensitivity: 1.0 },
    MEDIUM_PRIVACY: { epsilon: 1.0, delta: 1e-5, sensitivity: 1.0 },
    LOW_PRIVACY: { epsilon: 5.0, delta: 1e-4, sensitivity: 1.0 },
  } as const;

  // Minimum sample sizes for statistical validity
  private static readonly MIN_SAMPLE_SIZES = {
    course_average: 10,
    percentile_bands: 20,
    difficulty_calibration: 30,
  } as const;

  constructor(
    private readonly db: D1Database,
    private readonly kvNamespace?: any
  ) {
    this.tenantId = 'default';
  }

  private tenantId: string;

  /**
   * Generate Laplace noise for differential privacy
   * 
   * @param sensitivity - Sensitivity of the query
   * @param epsilon - Privacy budget
   * @returns Random noise value
   */
  private generateLaplaceNoise(sensitivity: number, epsilon: number): number {
    const scale = sensitivity / epsilon;
    
    // Generate Laplace distributed random number using inverse transform
    const u = Math.random() - 0.5;
    return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  }

  /**
   * Generate Gaussian noise for differential privacy
   * 
   * @param sensitivity - Sensitivity of the query
   * @param epsilon - Privacy budget
   * @param delta - Privacy parameter delta
   * @returns Random noise value
   */
  private generateGaussianNoise(sensitivity: number, epsilon: number, delta: number): number {
    const sigma = (sensitivity * Math.sqrt(2 * Math.log(1.25 / delta))) / epsilon;
    
    // Box-Muller transform for Gaussian random numbers
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    
    return sigma * z0;
  }

  /**
   * Validate privacy consent for analytics operations
   * 
   * @param studentId - Student's LTI user ID
   * @param courseId - Course identifier (optional)
   * @param operationType - Type of analytics operation
   * @returns Promise resolving to consent validation result
   */
  public async validatePrivacyConsent(
    studentId: string,
    courseId: string | undefined,
    operationType: 'performance' | 'predictive' | 'benchmark' | 'instructor_visibility'
  ): Promise<{
    isAllowed: boolean;
    consent: PrivacyConsent | null;
    reason?: string;
  }> {
    const consentResult = await this.db
      .prepare(`
        SELECT * FROM analytics_privacy_consent 
        WHERE tenant_id = ? AND student_id = ? 
          AND (course_id = ? OR course_id IS NULL)
        ORDER BY consent_updated_at DESC
        LIMIT 1
      `)
      .bind(this.tenantId, studentId, courseId || null)
      .first();

    if (!consentResult) {
      return {
        isAllowed: false,
        consent: null,
        reason: 'No privacy consent found',
      };
    }

    const consent = PrivacyConsentSchema.parse({
      ...consentResult,
      consentGivenAt: consentResult.consent_given_at,
      consentUpdatedAt: consentResult.consent_updated_at,
      consentVersion: consentResult.consent_version,
      withdrawalRequestedAt: consentResult.withdrawal_requested_at || undefined,
    });

    // Check for withdrawal
    if (consent.withdrawalRequestedAt) {
      return {
        isAllowed: false,
        consent,
        reason: 'Student has withdrawn consent',
      };
    }

    // Check specific consent types
    const consentMap = {
      performance: consent.performanceAnalyticsConsent,
      predictive: consent.predictiveAnalyticsConsent,
      benchmark: consent.benchmarkComparisonConsent,
      instructor_visibility: consent.instructorVisibilityConsent,
    };

    const isAllowed = consentMap[operationType];

    return {
      isAllowed,
      consent,
      reason: isAllowed ? undefined : `Student has not consented to ${operationType} analytics`,
    };
  }

  /**
   * Create anonymized benchmark data with differential privacy
   * 
   * @param courseId - Course identifier
   * @param benchmarkType - Type of benchmark to create
   * @param aggregationLevel - Level of aggregation
   * @param conceptId - Specific concept ID (optional)
   * @param assessmentId - Specific assessment ID (optional)
   * @returns Promise resolving to anonymized benchmark
   */
  public async createAnonymizedBenchmark(
    courseId: string,
    benchmarkType: 'course_average' | 'percentile_bands' | 'difficulty_calibration',
    aggregationLevel: 'course' | 'module' | 'concept' | 'assessment',
    conceptId?: string,
    assessmentId?: string
  ): Promise<AnonymizedBenchmark | null> {
    // Validate minimum sample size requirements
    const minSampleSize = PrivacyPreservingAnalytics.MIN_SAMPLE_SIZES[benchmarkType];
    
    // Get raw data with consent filtering
    const rawDataResult = await this.getRawBenchmarkData(
      courseId,
      benchmarkType,
      aggregationLevel,
      conceptId,
      assessmentId
    );

    if (!rawDataResult || rawDataResult.scores.length < minSampleSize) {
      return null; // Insufficient data for privacy-preserving analysis
    }

    // Choose privacy parameters based on sensitivity
    const privacyLevel = rawDataResult.scores.length < 50 
      ? PrivacyPreservingAnalytics.PRIVACY_PARAMS.HIGH_PRIVACY
      : rawDataResult.scores.length < 100
      ? PrivacyPreservingAnalytics.PRIVACY_PARAMS.MEDIUM_PRIVACY
      : PrivacyPreservingAnalytics.PRIVACY_PARAMS.LOW_PRIVACY;

    const { epsilon, sensitivity } = privacyLevel;
    const noiseScale = sensitivity / epsilon;

    // Calculate statistics with differential privacy
    const sortedScores = rawDataResult.scores.sort((a, b) => a - b);
    const n = sortedScores.length;

    // Add Laplace noise to aggregates
    const meanScore = this.addNoiseToStatistic(
      sortedScores.reduce((a, b) => a + b, 0) / n,
      sensitivity,
      epsilon
    );

    const medianScore = this.addNoiseToStatistic(
      n % 2 === 0 
        ? (sortedScores[n / 2 - 1] + sortedScores[n / 2]) / 2
        : sortedScores[Math.floor(n / 2)],
      sensitivity,
      epsilon
    );

    // Calculate standard deviation with noise
    const variance = sortedScores.reduce((acc, score) => 
      acc + Math.pow(score - (meanScore - this.generateLaplaceNoise(sensitivity, epsilon)), 2), 0
    ) / (n - 1);
    
    const stdDeviation = Math.sqrt(Math.abs(variance)) + 
      Math.abs(this.generateLaplaceNoise(sensitivity / Math.sqrt(n), epsilon));

    // Calculate percentiles with noise
    const percentile25 = this.addNoiseToStatistic(
      this.calculatePercentile(sortedScores, 0.25),
      sensitivity,
      epsilon
    );

    const percentile75 = this.addNoiseToStatistic(
      this.calculatePercentile(sortedScores, 0.75),
      sensitivity,
      epsilon
    );

    const percentile90 = this.addNoiseToStatistic(
      this.calculatePercentile(sortedScores, 0.90),
      sensitivity,
      epsilon
    );

    // Create anonymized benchmark record
    const benchmarkId = crypto.randomUUID();
    const now = new Date();
    const validUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const benchmark: AnonymizedBenchmark = {
      id: benchmarkId,
      tenantId: this.tenantId,
      courseId,
      conceptId,
      assessmentId,
      benchmarkType,
      aggregationLevel,
      sampleSize: n + Math.round(this.generateLaplaceNoise(1, epsilon)), // Noisy count
      meanScore: Math.max(0, Math.min(1, meanScore)),
      medianScore: Math.max(0, Math.min(1, medianScore)),
      stdDeviation: Math.max(0, stdDeviation),
      percentile25: Math.max(0, Math.min(1, percentile25)),
      percentile75: Math.max(0, Math.min(1, percentile75)),
      percentile90: Math.max(0, Math.min(1, percentile90)),
      epsilon,
      noiseScale,
      calculatedAt: now.toISOString(),
      validUntil: validUntil.toISOString(),
      confidenceInterval: 0.95,
    };

    // Store in database
    await this.db
      .prepare(`
        INSERT INTO anonymized_benchmarks (
          id, tenant_id, course_id, concept_id, assessment_id,
          benchmark_type, aggregation_level, sample_size,
          mean_score, median_score, std_deviation,
          percentile_25, percentile_75, percentile_90,
          epsilon, noise_scale, calculated_at, valid_until, confidence_interval
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        benchmark.id,
        benchmark.tenantId,
        benchmark.courseId,
        benchmark.conceptId || null,
        benchmark.assessmentId || null,
        benchmark.benchmarkType,
        benchmark.aggregationLevel,
        benchmark.sampleSize,
        benchmark.meanScore,
        benchmark.medianScore,
        benchmark.stdDeviation,
        benchmark.percentile25,
        benchmark.percentile75,
        benchmark.percentile90,
        benchmark.epsilon,
        benchmark.noiseScale,
        benchmark.calculatedAt,
        benchmark.validUntil,
        benchmark.confidenceInterval
      )
      .run();

    return benchmark;
  }

  /**
   * Get raw benchmark data with privacy consent filtering
   */
  private async getRawBenchmarkData(
    courseId: string,
    benchmarkType: string,
    aggregationLevel: string,
    conceptId?: string,
    assessmentId?: string
  ): Promise<{ scores: number[]; metadata: Record<string, unknown> } | null> {
    let query = '';
    let params: (string | number)[] = [];

    switch (benchmarkType) {
      case 'course_average':
        query = `
          SELECT aa.score / aa.max_score as normalized_score
          FROM assessment_attempts aa
          JOIN assessment_configs ac ON aa.assessment_id = ac.id
          JOIN analytics_privacy_consent apc ON aa.student_id = apc.student_id 
            AND ac.course_id = apc.course_id
          WHERE ac.tenant_id = ? AND ac.course_id = ?
            AND aa.status = 'completed' 
            AND aa.score IS NOT NULL 
            AND aa.max_score > 0
            AND apc.benchmark_comparison_consent = TRUE
            AND apc.withdrawal_requested_at IS NULL
        `;
        params = [this.tenantId, courseId];
        break;

      case 'percentile_bands':
        query = `
          SELECT spp.overall_mastery as normalized_score
          FROM student_performance_profiles spp
          JOIN analytics_privacy_consent apc ON spp.student_id = apc.student_id 
            AND spp.course_id = apc.course_id
          WHERE spp.tenant_id = ? AND spp.course_id = ?
            AND spp.overall_mastery IS NOT NULL
            AND apc.benchmark_comparison_consent = TRUE
            AND apc.withdrawal_requested_at IS NULL
        `;
        params = [this.tenantId, courseId];
        break;

      case 'difficulty_calibration':
        if (!conceptId) return null;
        query = `
          SELECT cm.mastery_level as normalized_score
          FROM concept_masteries cm
          JOIN student_performance_profiles spp ON cm.profile_id = spp.id
          JOIN analytics_privacy_consent apc ON spp.student_id = apc.student_id 
            AND spp.course_id = apc.course_id
          WHERE spp.tenant_id = ? AND spp.course_id = ? AND cm.concept_id = ?
            AND cm.mastery_level IS NOT NULL
            AND apc.benchmark_comparison_consent = TRUE
            AND apc.withdrawal_requested_at IS NULL
        `;
        params = [this.tenantId, courseId, conceptId];
        break;

      default:
        return null;
    }

    const result = await this.db.prepare(query).bind(...params).all();

    const scores = result.results
      .map(row => Number(row.normalized_score))
      .filter(score => !isNaN(score) && score >= 0 && score <= 1);

    return {
      scores,
      metadata: {
        queryType: benchmarkType,
        aggregationLevel,
        conceptId,
        assessmentId,
      },
    };
  }

  /**
   * Add differential privacy noise to a statistic
   */
  private addNoiseToStatistic(value: number, sensitivity: number, epsilon: number): number {
    const noise = this.generateLaplaceNoise(sensitivity, epsilon);
    return value + noise;
  }

  /**
   * Calculate percentile from sorted array
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    const index = percentile * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (lower === upper) {
      return sortedValues[lower] || 0;
    }

    return (sortedValues[lower] || 0) * (1 - weight) + (sortedValues[upper] || 0) * weight;
  }

  /**
   * Get cached anonymized benchmark or create new one
   * 
   * @param courseId - Course identifier
   * @param benchmarkType - Type of benchmark
   * @param aggregationLevel - Level of aggregation
   * @param conceptId - Optional concept ID
   * @param assessmentId - Optional assessment ID
   * @returns Promise resolving to anonymized benchmark
   */
  public async getAnonymizedBenchmark(
    courseId: string,
    benchmarkType: 'course_average' | 'percentile_bands' | 'difficulty_calibration',
    aggregationLevel: 'course' | 'module' | 'concept' | 'assessment',
    conceptId?: string,
    assessmentId?: string
  ): Promise<AnonymizedBenchmark | null> {
    // First check for cached valid benchmark
    const cachedResult = await this.db
      .prepare(`
        SELECT * FROM anonymized_benchmarks 
        WHERE tenant_id = ? AND course_id = ? 
          AND benchmark_type = ? AND aggregation_level = ?
          AND (concept_id = ? OR (concept_id IS NULL AND ? IS NULL))
          AND (assessment_id = ? OR (assessment_id IS NULL AND ? IS NULL))
          AND valid_until > datetime('now')
        ORDER BY calculated_at DESC
        LIMIT 1
      `)
      .bind(
        this.tenantId,
        courseId,
        benchmarkType,
        aggregationLevel,
        conceptId || null,
        conceptId || null,
        assessmentId || null,
        assessmentId || null
      )
      .first();

    if (cachedResult) {
      return AnonymizedBenchmarkSchema.parse({
        ...cachedResult,
        calculatedAt: cachedResult.calculated_at,
        validUntil: cachedResult.valid_until,
      });
    }

    // Create new anonymized benchmark
    return this.createAnonymizedBenchmark(
      courseId,
      benchmarkType,
      aggregationLevel,
      conceptId,
      assessmentId
    );
  }

  /**
   * Audit privacy-sensitive analytics access
   * 
   * @param actorId - ID of user accessing data
   * @param actorType - Type of user (student, instructor, admin)
   * @param operation - Type of operation performed
   * @param dataAccessed - Description of data accessed
   * @param justification - Reason for access
   * @returns Promise resolving when audit logged
   */
  public async auditDataAccess(params: {
    tenantId: string;
    userId: string;
    targetStudentId?: string;
    operation: string;
    dataCategory: string;
    timestamp: Date;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.db
      .prepare(`
        INSERT INTO privacy_audit_log (
          tenant_id, user_id, target_student_id, operation, data_category, 
          timestamp, ip_address, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        params.tenantId,
        params.userId,
        params.targetStudentId || null,
        params.operation,
        params.dataCategory,
        params.timestamp.toISOString(),
        params.ipAddress || null,
        params.userAgent || null
      )
      .run();
  }

  /**
   * Check if data export is allowed for student
   * 
   * @param studentId - Student's LTI user ID
   * @param exportType - Type of data export requested
   * @returns Promise resolving to export permission result
   */
  public async checkExportPermission(
    studentId: string,
    exportType: 'performance_data' | 'benchmark_comparison' | 'full_analytics'
  ): Promise<{
    allowed: boolean;
    reason?: string;
    anonymizationRequired: boolean;
    dataRetentionDays: number;
  }> {
    const consentValidation = await this.validatePrivacyConsent(
      studentId,
      undefined,
      'performance'
    );

    if (!consentValidation.isAllowed || !consentValidation.consent) {
      return {
        allowed: false,
        reason: consentValidation.reason,
        anonymizationRequired: false,
        dataRetentionDays: 0,
      };
    }

    const consent = consentValidation.consent;

    // Check specific export permissions
    let allowed = true;
    let reason: string | undefined;

    switch (exportType) {
      case 'performance_data':
        allowed = consent.performanceAnalyticsConsent;
        reason = allowed ? undefined : 'Performance analytics consent not given';
        break;

      case 'benchmark_comparison':
        allowed = consent.benchmarkComparisonConsent;
        reason = allowed ? undefined : 'Benchmark comparison consent not given';
        break;

      case 'full_analytics':
        allowed = consent.performanceAnalyticsConsent && 
                 consent.predictiveAnalyticsConsent &&
                 consent.benchmarkComparisonConsent;
        reason = allowed ? undefined : 'Full analytics requires all consent types';
        break;
    }

    return {
      allowed,
      reason,
      anonymizationRequired: consent.anonymizationRequired,
      dataRetentionDays: consent.dataRetentionPreference,
    };
  }

  /**
   * Anonymize benchmark data with differential privacy
   */
  public anonymizeBenchmarkData(
    studentData: any[],
    epsilon: number
  ): any[] {
    return studentData.map((data) => {
      const anonymousId = crypto.randomUUID();
      const { studentId, name, email, ...rest } = data;
      
      // Add noise to numeric fields
      const noisyData = { ...rest };
      if (typeof rest.score === 'number') {
        noisyData.score = rest.score + this.generateLaplaceNoise(1, epsilon);
      }
      if (typeof rest.timeSpent === 'number') {
        noisyData.timeSpent = Math.round(rest.timeSpent + this.generateLaplaceNoise(100, epsilon));
      }
      
      return {
        ...noisyData,
        anonymousId
      };
    });
  }

  /**
   * Apply k-anonymity to data
   */
  public applyKAnonymity(studentData: any[], k: number): any[] {
    // Group by demographic if present
    const groups = new Map<string, any[]>();
    
    studentData.forEach(data => {
      const key = data.demographic || 'default';
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(data);
    });
    
    // Filter out groups with less than k members
    const result: any[] = [];
    groups.forEach((group) => {
      if (group.length >= k) {
        result.push(...group);
      }
    });
    
    return result;
  }

  /**
   * Validate privacy compliance
   */
  public async validatePrivacyCompliance(
    tenantId: string,
    studentId: string,
    operation: string
  ): Promise<boolean> {
    const result = await this.db
      .prepare(`
        SELECT * FROM analytics_privacy_consent 
        WHERE tenant_id = ? AND student_id = ?
        ORDER BY consent_updated_at DESC
        LIMIT 1
      `)
      .bind(tenantId, studentId)
      .first();
    
    if (!result) return false;
    
    // Check the specific operation type
    const operationMap: Record<string, string> = {
      'performance_tracking': 'performance_analytics_consent',
      'any_operation': 'analytics_enabled'
    };
    
    const consentField = operationMap[operation] || 'analytics_enabled';
    return result[consentField] === 1 || result[consentField] === true;
  }

  /**
   * Validate FERPA compliance
   */
  public async validateFERPACompliance(
    tenantId: string,
    instructorId: string,
    studentId: string
  ): Promise<boolean> {
    const result = await this.db
      .prepare(`
        SELECT * FROM analytics_privacy_consent 
        WHERE tenant_id = ? AND student_id = ?
        ORDER BY consent_updated_at DESC
        LIMIT 1
      `)
      .bind(tenantId, studentId)
      .first();
    
    if (!result) return false;
    
    return result.instructor_access === true && result.ferpa_acknowledged === true;
  }

  /**
   * Detect suspicious access patterns
   */
  public async detectSuspiciousAccess(
    tenantId: string,
    userId: string
  ): Promise<boolean> {
    const result = await this.db
      .prepare(`
        SELECT COUNT(*) as count FROM audit_logs 
        WHERE tenant_id = ? AND actor_id = ? 
        AND action = 'export_data'
        AND created_at > datetime('now', '-1 hour')
      `)
      .bind(tenantId, userId)
      .first();
    
    // More than 50 exports in an hour is suspicious
    return result && result.count > 50;
  }

  /**
   * Handle consent withdrawal
   */
  public async handleConsentWithdrawal(
    tenantId: string,
    studentId: string,
    consentTypes: string[]
  ): Promise<void> {
    const statements = [];
    
    // Update consent record
    statements.push(
      this.db.prepare(`
        UPDATE analytics_privacy_consent 
        SET withdrawal_requested_at = datetime('now')
        WHERE tenant_id = ? AND student_id = ?
      `).bind(tenantId, studentId)
    );
    
    // Delete or anonymize data based on consent types
    if (consentTypes.includes('performance_tracking')) {
      statements.push(
        this.db.prepare(`
          DELETE FROM student_performance_profiles 
          WHERE tenant_id = ? AND student_id = ?
        `).bind(tenantId, studentId)
      );
    }
    
    if (consentTypes.includes('data_sharing')) {
      statements.push(
        this.db.prepare(`
          DELETE FROM anonymized_benchmarks 
          WHERE tenant_id = ? 
          AND id IN (
            SELECT benchmark_id FROM benchmark_contributions 
            WHERE student_id = ?
          )
        `).bind(tenantId, studentId)
      );
    }
    
    await this.db.batch(statements);
  }

  /**
   * Update consent status
   */
  public async updateConsentStatus(
    tenantId: string,
    studentId: string,
    consentOptions: any
  ): Promise<void> {
    // Update consent record
    await this.db
      .prepare(`
        INSERT OR REPLACE INTO analytics_privacy_consent (
          tenant_id, student_id, 
          analytics_enabled, performance_analytics_consent,
          predictive_analytics_consent, benchmark_comparison_consent,
          instructor_visibility_consent, data_retention_preference,
          anonymization_required, consent_given_at, consent_updated_at,
          consent_version, instructor_access, ferpa_acknowledged, ai_processing
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), '1.0', ?, ?, ?)
      `)
      .bind(
        tenantId,
        studentId,
        consentOptions.analytics_enabled || false,
        consentOptions.performance_tracking || false,
        consentOptions.predictive_analytics || false,
        consentOptions.data_sharing || false,
        consentOptions.instructor_visibility || false,
        consentOptions.data_retention || 365,
        consentOptions.anonymization_required || true,
        consentOptions.instructor_access || false,
        consentOptions.ferpa_acknowledged || false,
        consentOptions.ai_processing || false
      )
      .run();
    
    // Audit the consent change
    await this.db
      .prepare(`
        INSERT INTO consent_audit (
          tenant_id, student_id, action, details, created_at
        ) VALUES (?, ?, 'consent_updated', ?, datetime('now'))
      `)
      .bind(
        tenantId,
        studentId,
        JSON.stringify(consentOptions)
      )
      .run();
  }

  /**
   * Generate privacy report
   */
  public async generatePrivacyReport(
    tenantId: string,
    studentId: string
  ): Promise<any> {
    const consentStatus = await this.db
      .prepare(`
        SELECT * FROM analytics_privacy_consent 
        WHERE tenant_id = ? AND student_id = ?
        ORDER BY consent_updated_at DESC
        LIMIT 1
      `)
      .bind(tenantId, studentId)
      .first();
    
    const dataCollected = await this.db
      .prepare(`
        SELECT 
          COUNT(DISTINCT assessment_id) as assessment_attempts,
          COUNT(DISTINCT chat_message_id) as chat_messages,
          COUNT(DISTINCT profile_id) as performance_profiles
        FROM (
          SELECT id as assessment_id, null as chat_message_id, null as profile_id
          FROM assessment_attempts WHERE student_id = ? AND tenant_id = ?
          UNION ALL
          SELECT null, id, null
          FROM chat_messages WHERE student_id = ? AND tenant_id = ?
          UNION ALL
          SELECT null, null, id
          FROM student_performance_profiles WHERE student_id = ? AND tenant_id = ?
        )
      `)
      .bind(studentId, tenantId, studentId, tenantId, studentId, tenantId)
      .first();
    
    const dataShared = await this.db
      .prepare(`
        SELECT 
          COUNT(DISTINCT actor_id) as instructor_views,
          COUNT(DISTINCT benchmark_id) as benchmark_contributions
        FROM (
          SELECT actor_id, null as benchmark_id
          FROM audit_logs 
          WHERE tenant_id = ? AND resource_id LIKE ? AND action = 'view_profile'
          UNION ALL
          SELECT null, benchmark_id
          FROM benchmark_contributions
          WHERE student_id = ? AND tenant_id = ?
        )
      `)
      .bind(tenantId, `%${studentId}%`, studentId, tenantId)
      .first();
    
    const accessHistory = await this.db
      .prepare(`
        SELECT action as operation, created_at as timestamp
        FROM audit_logs 
        WHERE tenant_id = ? AND (actor_id = ? OR resource_id LIKE ?)
        ORDER BY created_at DESC
        LIMIT 100
      `)
      .bind(tenantId, studentId, `%${studentId}%`)
      .all();
    
    return {
      consentStatus,
      dataCollected,
      dataShared,
      accessHistory: accessHistory.results
    };
  }

  /**
   * Export user data in GDPR format
   */
  public async exportUserDataGDPR(
    tenantId: string,
    studentId: string
  ): Promise<any> {
    const personalInfo = await this.db
      .prepare(`
        SELECT * FROM students 
        WHERE tenant_id = ? AND id = ?
        LIMIT 1
      `)
      .bind(tenantId, studentId)
      .first();
    
    const performanceData = await this.db
      .prepare(`
        SELECT score, created_at as date
        FROM assessment_attempts 
        WHERE tenant_id = ? AND student_id = ?
        ORDER BY created_at DESC
      `)
      .bind(tenantId, studentId)
      .all();
    
    const chatHistory = await this.db
      .prepare(`
        SELECT message, created_at as timestamp
        FROM chat_messages 
        WHERE tenant_id = ? AND student_id = ?
        ORDER BY created_at DESC
      `)
      .bind(tenantId, studentId)
      .all();
    
    return {
      personalInfo,
      performanceData: performanceData.results,
      chatHistory: chatHistory.results
    };
  }

  /**
   * Add Laplace noise to a value
   */
  public addLaplaceNoise(
    value: number,
    sensitivity: number,
    epsilon: number
  ): number {
    const noise = this.generateLaplaceNoise(sensitivity, epsilon);
    return value + noise;
  }

  /**
   * Add Gaussian noise to a value
   */
  public addGaussianNoise(
    value: number,
    sensitivity: number,
    epsilon: number,
    delta: number
  ): number {
    const noise = this.generateGaussianNoise(sensitivity, epsilon, delta);
    return value + noise;
  }

  /**
   * Apply randomized response
   */
  public randomizedResponse(
    truthfulAnswer: boolean,
    probability: number
  ): boolean {
    const random = Math.random();
    if (random < probability) {
      return truthfulAnswer;
    }
    return !truthfulAnswer;
  }

  /**
   * Cache benchmark data
   */
  public async cacheBenchmark(
    tenantId: string,
    courseId: string,
    benchmarkData: any
  ): Promise<void> {
    if (!this.kvNamespace) return;
    
    const key = `benchmark:${tenantId}:${courseId}`;
    await this.kvNamespace.put(
      key,
      JSON.stringify(benchmarkData),
      { expirationTtl: 7 * 24 * 60 * 60 } // 7 days
    );
  }

  /**
   * Get cached benchmark
   */
  public async getCachedBenchmark(
    tenantId: string,
    courseId: string
  ): Promise<any> {
    if (!this.kvNamespace) return null;
    
    const key = `benchmark:${tenantId}:${courseId}`;
    const cached = await this.kvNamespace.get(key);
    
    if (!cached) return null;
    
    const data = JSON.parse(cached);
    
    // Check if data is stale (older than 7 days)
    if (data.timestamp) {
      const age = Date.now() - new Date(data.timestamp).getTime();
      if (age > 7 * 24 * 60 * 60 * 1000) {
        await this.kvNamespace.delete(key);
        return null;
      }
    }
    
    return data;
  }
}