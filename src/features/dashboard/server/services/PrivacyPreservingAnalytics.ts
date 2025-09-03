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
    private readonly tenantId: string
  ) {}

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
  public async auditDataAccess(
    actorId: string,
    actorType: 'student' | 'instructor' | 'admin' | 'system',
    operation: 'view_profile' | 'generate_benchmark' | 'export_data' | 'create_alert',
    dataAccessed: string,
    justification?: string
  ): Promise<void> {
    await this.db
      .prepare(`
        INSERT INTO audit_logs (
          tenant_id, actor_type, actor_id, action, resource_type, 
          resource_id, details, created_at
        ) VALUES (?, ?, ?, ?, 'analytics_data', ?, ?, datetime('now'))
      `)
      .bind(
        this.tenantId,
        actorType,
        actorId,
        operation,
        dataAccessed,
        JSON.stringify({
          operation,
          dataAccessed,
          justification,
          privacyCompliant: true,
          timestamp: new Date().toISOString(),
        })
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
}