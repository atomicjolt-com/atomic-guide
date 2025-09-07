/**
 * @fileoverview Cross-Course Analytics Engine
 * Orchestrates comprehensive multi-course performance analysis and provides unified insights
 * 
 * This service implements multi-course performance dashboard data generation,
 * predictive academic risk scoring, knowledge transfer optimization algorithms,
 * and comparative course analysis for learning path optimization.
 */

import {
  CrossCourseAnalyticsRequest,
  CrossCourseAnalyticsResponse,
  CourseStatus,
  ActionItem,
  KnowledgeGap,
  KnowledgeDependency,
  PerformanceCorrelation,
  KnowledgeTransferOpportunity,
  RiskFactor,
  CrossCourseResult,
  CrossCourseError,
  TimeSeriesDataPoint
} from '../../shared/types/index.js';

import {
  CrossCourseAnalyticsRequestSchema,
  CrossCourseAnalyticsResponseSchema,
  validateSafely
} from '../../shared/schemas/cross-course.schema.js';

import type { KnowledgeGraphRepository } from '../repositories/KnowledgeGraphRepository.js';
import type { KnowledgeDependencyMapper } from './KnowledgeDependencyMapper.js';
import type { PrerequisiteGapAnalyzer } from './PrerequisiteGapAnalyzer.js';
import type { AdvancedPatternRecognizer } from '../../../learner-dna/server/services/AdvancedPatternRecognizer.js';

/**
 * Configuration for analytics engine
 */
interface AnalyticsEngineConfig {
  cacheExpirationHours: number;
  maxCoursesAnalyzed: number;
  riskScoreWeights: {
    prerequisiteGaps: number;
    performanceTrend: number;
    learningVelocity: number;
    engagementLevel: number;
  };
  correlationThreshold: number;
  transferOpportunityThreshold: number;
}

/**
 * Course enrollment and progress data
 */
interface CourseEnrollmentData {
  courseId: string;
  courseName: string;
  courseCode: string;
  enrollmentDate: Date;
  completionDate?: Date;
  currentGrade: number;
  creditHours: number;
  instructor: string;
  prerequisites: string[];
  isActive: boolean;
}

/**
 * Comprehensive learning analytics data
 */
interface LearningAnalyticsData {
  studentId: string;
  enrollments: CourseEnrollmentData[];
  performanceHistory: TimeSeriesDataPoint[];
  learningPatterns: any; // From learner DNA
  strugglesHistory: any[]; // From struggle detection
  engagementMetrics: EngagementMetrics;
}

/**
 * Student engagement metrics
 */
interface EngagementMetrics {
  averageTimeOnTask: number; // Minutes per session
  loginFrequency: number; // Logins per week
  assignmentSubmissionRate: number; // 0-1
  forumParticipation: number; // Posts per week
  resourceUtilization: number; // 0-1 utilization rate
}

/**
 * Risk assessment components
 */
interface RiskAssessmentComponents {
  prerequisiteGapRisk: number;
  performanceTrendRisk: number;
  learningVelocityRisk: number;
  engagementRisk: number;
  overallRiskScore: number;
  confidence: number;
}

/**
 * Comprehensive cross-course analytics engine
 */
export class CrossCourseAnalyticsEngine {
  private config: AnalyticsEngineConfig;
  private analyticsCache: Map<string, { data: CrossCourseAnalyticsResponse; timestamp: Date }> = new Map();

  constructor(
    private knowledgeGraphRepo: KnowledgeGraphRepository,
    private dependencyMapper: KnowledgeDependencyMapper,
    private gapAnalyzer: PrerequisiteGapAnalyzer,
    private patternRecognizer: AdvancedPatternRecognizer,
    config: Partial<AnalyticsEngineConfig> = {}
  ) {
    this.config = {
      cacheExpirationHours: 1,
      maxCoursesAnalyzed: 10,
      riskScoreWeights: {
        prerequisiteGaps: 0.35,
        performanceTrend: 0.25,
        learningVelocity: 0.25,
        engagementLevel: 0.15
      },
      correlationThreshold: 0.5,
      transferOpportunityThreshold: 0.6,
      ...config
    };
  }

  /**
   * Generates comprehensive cross-course analytics for a student
   */
  async generateCrossCourseAnalytics(
    request: CrossCourseAnalyticsRequest
  ): Promise<CrossCourseResult<CrossCourseAnalyticsResponse>> {
    try {
      // Validate request
      const validation = validateSafely(CrossCourseAnalyticsRequestSchema, request);
      if (!validation.success) {
        return {
          success: false,
          error: {
            type: 'INVALID_COURSE_SEQUENCE',
            message: 'Invalid analytics request',
            details: { errors: validation.error.errors }
          }
        };
      }

      // Check cache first
      const cacheKey = this.generateCacheKey(request);
      const cached = this.getCachedAnalytics(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      // Step 1: Gather comprehensive student data
      const learningData = await this.gatherLearningAnalyticsData(request.studentId);
      
      // Step 2: Analyze active courses and their status
      const activeCourses = await this.analyzeCourseStatuses(learningData, request.courseFilters);
      
      // Step 3: Get knowledge dependencies for student's courses
      const courseIds = activeCourses.map(c => c.id);
      const dependencies = await this.getDependenciesForCourses(courseIds);
      
      // Step 4: Calculate performance correlations
      const performanceCorrelations = await this.calculatePerformanceCorrelations(learningData, dependencies);
      
      // Step 5: Identify knowledge gaps
      const gapAnalysis = await this.gapAnalyzer.analyzePrerequisiteGaps(
        request.studentId,
        courseIds,
        request.analysisDepth !== 'basic'
      );
      
      const knowledgeGaps = gapAnalysis.success ? gapAnalysis.data?.gaps || [] : [];
      
      // Step 6: Calculate academic risk score
      const riskAssessment = await this.calculateAcademicRiskScore(
        learningData,
        knowledgeGaps,
        performanceCorrelations
      );
      
      // Step 7: Generate action items
      const actionItems = await this.generateActionItems(
        knowledgeGaps,
        activeCourses,
        riskAssessment
      );
      
      // Step 8: Identify knowledge transfer opportunities
      const transferOpportunities = await this.identifyKnowledgeTransferOpportunities(
        learningData,
        dependencies,
        activeCourses
      );

      // Step 9: Compile final response
      const response: CrossCourseAnalyticsResponse = {
        studentId: request.studentId,
        academicRiskScore: riskAssessment.overallRiskScore,
        activeCourses,
        knowledgeDependencies: dependencies,
        performanceCorrelations,
        knowledgeGaps,
        actionItems,
        transferOpportunities,
        lastUpdated: new Date(),
        dataFreshness: this.calculateDataFreshness(learningData)
      };

      // Validate response
      const responseValidation = validateSafely(CrossCourseAnalyticsResponseSchema, response);
      if (!responseValidation.success) {
        return {
          success: false,
          error: {
            type: 'SYSTEM_OVERLOAD',
            message: 'Failed to generate valid analytics response',
            details: { errors: responseValidation.error.errors }
          }
        };
      }

      // Cache the result
      this.cacheAnalytics(cacheKey, response);

      return {
        success: true,
        data: response
      };

    } catch (error) {
      return {
        success: false,
        error: {
          type: 'SYSTEM_OVERLOAD',
          message: error instanceof Error ? error.message : 'Unknown analytics error',
          details: { error }
        }
      };
    }
  }

  /**
   * Gathers comprehensive learning analytics data for a student
   */
  private async gatherLearningAnalyticsData(studentId: string): Promise<LearningAnalyticsData> {
    // This would normally integrate with multiple data sources
    // For MVP, we simulate comprehensive learning data
    
    const enrollments = await this.simulateCourseEnrollments(studentId);
    const performanceHistory = await this.simulatePerformanceHistory(studentId, enrollments);
    const engagementMetrics = await this.simulateEngagementMetrics(studentId);

    return {
      studentId,
      enrollments,
      performanceHistory,
      learningPatterns: {}, // Would integrate with learner DNA service
      strugglesHistory: [], // Would integrate with struggle detection
      engagementMetrics
    };
  }

  /**
   * Analyzes course statuses for cross-course intelligence
   */
  private async analyzeCourseStatuses(
    learningData: LearningAnalyticsData,
    courseFilters?: string[]
  ): Promise<CourseStatus[]> {
    const courseStatuses: CourseStatus[] = [];

    for (const enrollment of learningData.enrollments) {
      // Apply course filters if provided
      if (courseFilters && !courseFilters.includes(enrollment.courseId)) {
        continue;
      }

      // Only include active courses for MVP
      if (!enrollment.isActive) {
        continue;
      }

      const status = this.determineCourseStatus(enrollment, learningData.performanceHistory);
      const dependencies = await this.getCourseDependencies(enrollment.courseId);

      courseStatuses.push({
        id: enrollment.courseId,
        name: enrollment.courseName,
        code: enrollment.courseCode,
        performance: enrollment.currentGrade,
        status,
        enrollmentStatus: enrollment.isActive ? 'active' : 'completed',
        prerequisites: dependencies.prerequisites,
        dependents: dependencies.dependents
      });
    }

    return courseStatuses;
  }

  /**
   * Gets knowledge dependencies for a list of courses
   */
  private async getDependenciesForCourses(courseIds: string[]): Promise<KnowledgeDependency[]> {
    try {
      const allDependencies: KnowledgeDependency[] = [];

      for (const courseId of courseIds) {
        const courseDeps = await this.knowledgeGraphRepo.getCourseDependencies(courseId);
        if (courseDeps.success) {
          allDependencies.push(...(courseDeps.data?.prerequisites || []));
          allDependencies.push(...(courseDeps.data?.dependents || []));
        }
      }

      // Remove duplicates and filter by threshold
      return this.deduplicateAndFilterDependencies(allDependencies);

    } catch (error) {
      console.warn('Failed to get course dependencies:', error);
      return [];
    }
  }

  /**
   * Calculates performance correlations between courses
   */
  private async calculatePerformanceCorrelations(
    learningData: LearningAnalyticsData,
    dependencies: KnowledgeDependency[]
  ): Promise<PerformanceCorrelation[]> {
    const correlations: PerformanceCorrelation[] = [];
    const activeCourses = learningData.enrollments.filter(e => e.isActive);

    // Calculate correlations for all active course pairs
    for (let i = 0; i < activeCourses.length; i++) {
      for (let j = i + 1; j < activeCourses.length; j++) {
        const course1 = activeCourses[i];
        const course2 = activeCourses[j];

        const correlation = await this.calculatePairwiseCorrelation(
          course1,
          course2,
          learningData.performanceHistory,
          dependencies
        );

        if (Math.abs(correlation.correlation) >= this.config.correlationThreshold) {
          correlations.push(correlation);
        }
      }
    }

    return correlations;
  }

  /**
   * Calculates academic risk score using multiple factors
   */
  private async calculateAcademicRiskScore(
    learningData: LearningAnalyticsData,
    knowledgeGaps: KnowledgeGap[],
    performanceCorrelations: PerformanceCorrelation[]
  ): Promise<RiskAssessmentComponents> {
    const weights = this.config.riskScoreWeights;

    // Calculate individual risk components
    const prerequisiteGapRisk = this.calculatePrerequisiteGapRisk(knowledgeGaps);
    const performanceTrendRisk = this.calculatePerformanceTrendRisk(learningData.performanceHistory);
    const learningVelocityRisk = this.calculateLearningVelocityRisk(learningData);
    const engagementRisk = this.calculateEngagementRisk(learningData.engagementMetrics);

    // Calculate weighted overall risk
    const overallRiskScore = 
      prerequisiteGapRisk * weights.prerequisiteGaps +
      performanceTrendRisk * weights.performanceTrend +
      learningVelocityRisk * weights.learningVelocity +
      engagementRisk * weights.engagementLevel;

    // Calculate confidence in risk assessment
    const confidence = this.calculateRiskConfidence(
      learningData,
      knowledgeGaps,
      performanceCorrelations
    );

    return {
      prerequisiteGapRisk,
      performanceTrendRisk,
      learningVelocityRisk,
      engagementRisk,
      overallRiskScore: Math.min(1.0, Math.max(0.0, overallRiskScore)),
      confidence
    };
  }

  /**
   * Generates actionable items based on analysis
   */
  private async generateActionItems(
    knowledgeGaps: KnowledgeGap[],
    activeCourses: CourseStatus[],
    riskAssessment: RiskAssessmentComponents
  ): Promise<ActionItem[]> {
    const actionItems: ActionItem[] = [];

    // Generate action items from knowledge gaps
    for (const gap of knowledgeGaps) {
      const course = activeCourses.find(c => c.id === gap.prerequisiteCourse);
      if (course) {
        actionItems.push({
          id: `action_gap_${gap.id}`,
          type: 'knowledge-gap',
          priority: gap.remediationPriority,
          title: `Review ${gap.concept}`,
          description: `Strengthen understanding of ${gap.concept} to improve performance in ${gap.impactedCourses.join(', ')}`,
          course: gap.prerequisiteCourse,
          estimatedTime: gap.estimatedReviewTime || 30,
          completed: false
        });
      }
    }

    // Generate action items from high-risk courses
    for (const course of activeCourses) {
      if (course.status === 'struggling' && riskAssessment.overallRiskScore > 0.7) {
        actionItems.push({
          id: `action_risk_${course.id}`,
          type: 'review-needed',
          priority: 'high',
          title: `Focus on ${course.name}`,
          description: `High risk detected for ${course.name}. Consider additional study time or tutoring`,
          course: course.id,
          estimatedTime: 60,
          completed: false
        });
      }
    }

    // Sort by priority and estimated impact
    return actionItems.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Identifies knowledge transfer opportunities between courses
   */
  private async identifyKnowledgeTransferOpportunities(
    learningData: LearningAnalyticsData,
    dependencies: KnowledgeDependency[],
    activeCourses: CourseStatus[]
  ): Promise<KnowledgeTransferOpportunity[]> {
    const opportunities: KnowledgeTransferOpportunity[] = [];

    // Look for positive transfer opportunities
    for (const dependency of dependencies) {
      const sourceCourse = activeCourses.find(c => c.id === dependency.prerequisiteCourse);
      const targetCourse = activeCourses.find(c => c.id === dependency.dependentCourse);

      if (sourceCourse && targetCourse) {
        // Check if source course performance is strong
        if (sourceCourse.performance > 0.8 && dependency.dependencyStrength > this.config.transferOpportunityThreshold) {
          const opportunity = await this.createTransferOpportunity(
            learningData.studentId,
            dependency,
            sourceCourse,
            targetCourse
          );

          if (opportunity) {
            opportunities.push(opportunity);
          }
        }
      }
    }

    return opportunities;
  }

  // Helper methods for simulation (MVP implementation)

  private async simulateCourseEnrollments(studentId: string): Promise<CourseEnrollmentData[]> {
    // Simulate realistic course enrollments
    const courses = [
      {
        courseId: 'math101',
        courseName: 'College Algebra',
        courseCode: 'MATH 101',
        currentGrade: 0.75 + Math.random() * 0.2,
        creditHours: 3,
        instructor: 'Dr. Smith',
        prerequisites: [],
        isActive: true
      },
      {
        courseId: 'physics101',
        courseName: 'Physics I',
        courseCode: 'PHYS 101',
        currentGrade: 0.60 + Math.random() * 0.3,
        creditHours: 4,
        instructor: 'Dr. Johnson',
        prerequisites: ['math101'],
        isActive: true
      },
      {
        courseId: 'math201',
        courseName: 'Calculus I',
        courseCode: 'MATH 201',
        currentGrade: 0.70 + Math.random() * 0.25,
        creditHours: 4,
        instructor: 'Dr. Brown',
        prerequisites: ['math101'],
        isActive: Math.random() > 0.3 // 70% chance of being active
      }
    ];

    return courses.map(course => ({
      ...course,
      enrollmentDate: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000), // Within last 90 days
      completionDate: course.isActive ? undefined : new Date()
    }));
  }

  private async simulatePerformanceHistory(
    studentId: string,
    enrollments: CourseEnrollmentData[]
  ): Promise<TimeSeriesDataPoint[]> {
    const history: TimeSeriesDataPoint[] = [];
    
    for (const enrollment of enrollments) {
      // Generate 10-20 data points over time
      const numPoints = 10 + Math.floor(Math.random() * 10);
      for (let i = 0; i < numPoints; i++) {
        history.push({
          timestamp: new Date(enrollment.enrollmentDate.getTime() + i * 7 * 24 * 60 * 60 * 1000),
          value: Math.max(0.3, Math.min(1.0, enrollment.currentGrade + (Math.random() - 0.5) * 0.2)),
          courseId: enrollment.courseId,
          metricType: 'performance'
        });
      }
    }

    return history.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private async simulateEngagementMetrics(studentId: string): Promise<EngagementMetrics> {
    return {
      averageTimeOnTask: 45 + Math.random() * 30, // 45-75 minutes
      loginFrequency: 3 + Math.random() * 4, // 3-7 logins per week
      assignmentSubmissionRate: 0.7 + Math.random() * 0.25, // 70-95%
      forumParticipation: Math.random() * 3, // 0-3 posts per week
      resourceUtilization: 0.5 + Math.random() * 0.4 // 50-90%
    };
  }

  private determineCourseStatus(
    enrollment: CourseEnrollmentData,
    performanceHistory: TimeSeriesDataPoint[]
  ): CourseStatus['status'] {
    if (enrollment.currentGrade >= 0.8) return 'strong';
    if (enrollment.currentGrade >= 0.6) return 'at-risk';
    return 'struggling';
  }

  private async getCourseDependencies(courseId: string): Promise<{ prerequisites: string[]; dependents: string[] }> {
    try {
      const deps = await this.knowledgeGraphRepo.getCourseDependencies(courseId);
      if (deps.success) {
        return {
          prerequisites: deps.data?.prerequisites.map(d => d.prerequisiteCourse) || [],
          dependents: deps.data?.dependents.map(d => d.dependentCourse) || []
        };
      }
    } catch (error) {
      console.warn('Failed to get course dependencies:', error);
    }
    
    return { prerequisites: [], dependents: [] };
  }

  private deduplicateAndFilterDependencies(dependencies: KnowledgeDependency[]): KnowledgeDependency[] {
    const unique = new Map<string, KnowledgeDependency>();
    
    for (const dep of dependencies) {
      const key = `${dep.prerequisiteCourse}-${dep.dependentCourse}-${dep.prerequisiteConcept}-${dep.dependentConcept}`;
      if (!unique.has(key) && dep.dependencyStrength >= this.config.correlationThreshold) {
        unique.set(key, dep);
      }
    }
    
    return Array.from(unique.values());
  }

  private async calculatePairwiseCorrelation(
    course1: CourseEnrollmentData,
    course2: CourseEnrollmentData,
    performanceHistory: TimeSeriesDataPoint[],
    dependencies: KnowledgeDependency[]
  ): Promise<PerformanceCorrelation> {
    // Simplified correlation calculation for MVP
    const course1Perf = performanceHistory.filter(p => p.courseId === course1.courseId);
    const course2Perf = performanceHistory.filter(p => p.courseId === course2.courseId);
    
    // Calculate basic correlation
    const correlation = course1Perf.length > 0 && course2Perf.length > 0 
      ? this.calculatePearsonCorrelation(
          course1Perf.map(p => p.value),
          course2Perf.map(p => p.value)
        )
      : 0;

    // Check if there's a direct dependency
    const hasDependency = dependencies.some(d => 
      (d.prerequisiteCourse === course1.courseId && d.dependentCourse === course2.courseId) ||
      (d.prerequisiteCourse === course2.courseId && d.dependentCourse === course1.courseId)
    );

    return {
      course1: course1.courseId,
      course2: course2.courseId,
      correlation,
      confidence: hasDependency ? 0.9 : 0.7,
      sampleSize: Math.min(course1Perf.length, course2Perf.length),
      trendDirection: correlation > 0.1 ? 'positive' : correlation < -0.1 ? 'negative' : 'neutral'
    };
  }

  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let sumXSquared = 0;
    let sumYSquared = 0;

    for (let i = 0; i < n; i++) {
      const deltaX = x[i] - meanX;
      const deltaY = y[i] - meanY;
      numerator += deltaX * deltaY;
      sumXSquared += deltaX * deltaX;
      sumYSquared += deltaY * deltaY;
    }

    const denominator = Math.sqrt(sumXSquared * sumYSquared);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  // Risk calculation methods

  private calculatePrerequisiteGapRisk(gaps: KnowledgeGap[]): number {
    if (gaps.length === 0) return 0;
    
    const avgSeverity = gaps.reduce((sum, gap) => sum + gap.gapSeverity, 0) / gaps.length;
    const criticalGaps = gaps.filter(gap => gap.remediationPriority === 'critical').length;
    
    return Math.min(1.0, avgSeverity + (criticalGaps * 0.1));
  }

  private calculatePerformanceTrendRisk(performanceHistory: TimeSeriesDataPoint[]): number {
    if (performanceHistory.length < 3) return 0.5; // Default risk for insufficient data
    
    // Calculate trend over last 30 days
    const recent = performanceHistory.slice(-10);
    const trend = this.calculateLinearTrend(recent.map(p => p.value));
    
    // Negative trend increases risk
    return Math.max(0, Math.min(1.0, 0.5 - trend));
  }

  private calculateLearningVelocityRisk(learningData: LearningAnalyticsData): number {
    // Based on engagement metrics and time on task
    const velocity = learningData.engagementMetrics.averageTimeOnTask / 60; // Convert to hours
    const submissionRate = learningData.engagementMetrics.assignmentSubmissionRate;
    
    // Lower velocity and submission rate = higher risk
    const velocityRisk = Math.max(0, 1 - (velocity / 2)); // Normalize to 0-1
    const submissionRisk = 1 - submissionRate;
    
    return (velocityRisk + submissionRisk) / 2;
  }

  private calculateEngagementRisk(metrics: EngagementMetrics): number {
    const factors = [
      1 - Math.min(1, metrics.loginFrequency / 5), // Target 5 logins/week
      1 - metrics.assignmentSubmissionRate,
      1 - metrics.resourceUtilization,
      Math.max(0, 1 - (metrics.averageTimeOnTask / 45)) // Target 45 min/session
    ];
    
    return factors.reduce((sum, factor) => sum + factor, 0) / factors.length;
  }

  private calculateRiskConfidence(
    learningData: LearningAnalyticsData,
    knowledgeGaps: KnowledgeGap[],
    performanceCorrelations: PerformanceCorrelation[]
  ): number {
    let confidence = 0.7; // Base confidence

    // More data = higher confidence
    if (learningData.performanceHistory.length > 20) confidence += 0.1;
    if (learningData.enrollments.length > 2) confidence += 0.1;
    if (knowledgeGaps.length > 0) confidence += 0.05;
    if (performanceCorrelations.length > 0) confidence += 0.05;

    return Math.min(1.0, confidence);
  }

  private calculateLinearTrend(values: number[]): number {
    const n = values.length;
    if (n < 2) return 0;

    const x = Array.from({ length: n }, (_, i) => i);
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = values.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (x[i] - meanX) * (values[i] - meanY);
      denominator += (x[i] - meanX) * (x[i] - meanX);
    }

    return denominator === 0 ? 0 : numerator / denominator;
  }

  private async createTransferOpportunity(
    studentId: string,
    dependency: KnowledgeDependency,
    sourceCourse: CourseStatus,
    targetCourse: CourseStatus
  ): Promise<KnowledgeTransferOpportunity | null> {
    try {
      return await this.knowledgeGraphRepo.createKnowledgeTransferOpportunity({
        studentId,
        sourceCourse: sourceCourse.id,
        targetCourse: targetCourse.id,
        sourceConcept: dependency.prerequisiteConcept,
        targetConcept: dependency.dependentConcept,
        transferType: 'positive',
        opportunityStrength: dependency.dependencyStrength,
        recommendation: `Use your strong understanding of ${dependency.prerequisiteConcept} from ${sourceCourse.name} to excel in ${dependency.dependentConcept} in ${targetCourse.name}`,
        status: 'identified'
      });
    } catch (error) {
      console.warn('Failed to create transfer opportunity:', error);
      return null;
    }
  }

  // Caching methods

  private generateCacheKey(request: CrossCourseAnalyticsRequest): string {
    return `analytics_${request.studentId}_${JSON.stringify(request.courseFilters || [])}_${request.analysisDepth}`;
  }

  private getCachedAnalytics(cacheKey: string): CrossCourseAnalyticsResponse | null {
    const cached = this.analyticsCache.get(cacheKey);
    if (cached) {
      const ageHours = (Date.now() - cached.timestamp.getTime()) / (1000 * 60 * 60);
      if (ageHours < this.config.cacheExpirationHours) {
        return cached.data;
      } else {
        this.analyticsCache.delete(cacheKey);
      }
    }
    return null;
  }

  private cacheAnalytics(cacheKey: string, data: CrossCourseAnalyticsResponse): void {
    this.analyticsCache.set(cacheKey, {
      data,
      timestamp: new Date()
    });

    // Cleanup old cache entries periodically
    if (this.analyticsCache.size > 100) {
      const oldestKey = this.analyticsCache.keys().next().value;
      this.analyticsCache.delete(oldestKey);
    }
  }

  private calculateDataFreshness(learningData: LearningAnalyticsData): number {
    // Calculate average age of data in hours
    const now = Date.now();
    const ages = learningData.performanceHistory.map(p => 
      (now - p.timestamp.getTime()) / (1000 * 60 * 60)
    );
    
    const avgAge = ages.length > 0 ? ages.reduce((a, b) => a + b, 0) / ages.length : 0;
    return Math.max(0, Math.min(24, avgAge)); // Cap at 24 hours
  }
}