/**
 * @fileoverview Prerequisite Gap Analyzer Service
 * Identifies knowledge gaps in foundational courses that predict struggle in advanced courses
 * 
 * This service implements real-time prerequisite gap detection algorithms,
 * builds cross-course performance correlation analysis, and provides predictive
 * modeling for performance impact assessment.
 */

import {
  KnowledgeDependency,
  KnowledgeGap,
  RiskFactor,
  CrossCoursePerformanceCorrelation,
  CourseStatus,
  ActionItem,
  CrossCourseResult,
  CrossCourseError,
  TimeSeriesDataPoint,
  ImpactPrediction
} from '../../shared/types/index.js';

import {
  KnowledgeGapSchema,
  RiskFactorSchema,
  validateSafely
} from '../../shared/schemas/cross-course.schema.js';

import type { KnowledgeGraphRepository } from '../repositories/KnowledgeGraphRepository.js';
import type { AdvancedPatternRecognizer } from '../../../learner-dna/server/services/AdvancedPatternRecognizer.js';
import type { StruggleDetectionEngine } from '../../../struggle-detection/server/services/StruggleDetectionEngine.js';

/**
 * Configuration for gap analysis algorithms
 */
interface GapAnalysisConfig {
  detectionSensitivity: number; // 0-1, higher = more sensitive to gaps
  temporalWindowDays: number; // Days to look back for performance data
  riskThreshold: number; // Risk score threshold for alerts
  minCorrelationStrength: number; // Minimum correlation to consider
  falsePositiveThreshold: number; // Threshold to reduce false positives
}

/**
 * Student performance data for gap analysis
 */
interface StudentPerformanceData {
  studentId: string;
  courseId: string;
  courseName: string;
  overallPerformance: number; // 0-1
  conceptPerformances: ConceptPerformanceData[];
  learningVelocity: number;
  timeInCourse: number; // Days since enrollment
  strugglesDetected: StruggleIndicator[];
  lastAssessment: Date;
}

/**
 * Performance data for specific concepts
 */
interface ConceptPerformanceData {
  concept: string;
  masteryLevel: number; // 0-1
  confidence: number; // 0-1, confidence in mastery assessment
  timeToMastery?: number; // Days taken to reach mastery
  strugglesEncountered: boolean;
  assessmentHistory: AssessmentPoint[];
  reviewsRequired: number;
}

/**
 * Individual assessment data point
 */
interface AssessmentPoint {
  timestamp: Date;
  score: number;
  assessmentType: 'quiz' | 'homework' | 'exam' | 'practice';
  conceptsCovered: string[];
  timeSpent: number; // Minutes
}

/**
 * Struggle indicator from existing struggle detection system
 */
interface StruggleIndicator {
  type: 'conceptual_confusion' | 'procedural_difficulty' | 'time_management' | 'engagement';
  severity: number; // 0-1
  concepts: string[];
  detectedAt: Date;
  resolved: boolean;
}

/**
 * Gap detection result
 */
interface GapDetectionResult {
  gaps: KnowledgeGap[];
  riskFactors: RiskFactor[];
  impactPredictions: ImpactPrediction[];
  confidenceScore: number;
  analysisTimestamp: Date;
}

/**
 * Service for analyzing prerequisite knowledge gaps
 */
export class PrerequisiteGapAnalyzer {
  private config: GapAnalysisConfig;

  constructor(
    private knowledgeGraphRepo: KnowledgeGraphRepository,
    private patternRecognizer: AdvancedPatternRecognizer,
    private struggleDetection: StruggleDetectionEngine,
    config: Partial<GapAnalysisConfig> = {}
  ) {
    this.config = {
      detectionSensitivity: 0.7,
      temporalWindowDays: 30,
      riskThreshold: 0.6,
      minCorrelationStrength: 0.5,
      falsePositiveThreshold: 0.25,
      ...config
    };
  }

  /**
   * Analyzes a student's cross-course performance to identify prerequisite gaps
   */
  async analyzePrerequisiteGaps(
    studentId: string,
    activeCourses: string[],
    includePreventive: boolean = true
  ): Promise<CrossCourseResult<GapDetectionResult>> {
    try {
      // Step 1: Gather student performance data across courses
      const performanceData = await this.gatherStudentPerformanceData(studentId, activeCourses);
      
      // Step 2: Get knowledge dependencies relevant to student's courses
      const dependencies = await this.getRelevantDependencies(activeCourses);
      
      if (!dependencies.success || !dependencies.data) {
        return {
          success: false,
          error: {
            type: 'INSUFFICIENT_DATA',
            message: 'Unable to retrieve knowledge dependencies'
          }
        };
      }

      // Step 3: Identify current knowledge gaps
      const currentGaps = await this.identifyCurrentGaps(performanceData, dependencies.data);
      
      // Step 4: Analyze future impact of gaps
      const impactPredictions = await this.predictGapImpacts(currentGaps, dependencies.data, performanceData);
      
      // Step 5: Generate risk factors
      const riskFactors = await this.generateRiskFactors(currentGaps, performanceData, impactPredictions);
      
      // Step 6: Validate and filter results
      const validatedGaps = this.validateGapDetection(currentGaps, riskFactors);

      // Step 7: Include preventive gaps if requested
      const finalGaps = includePreventive 
        ? await this.includePreventiveGaps(validatedGaps, performanceData, dependencies.data)
        : validatedGaps;

      const result: GapDetectionResult = {
        gaps: finalGaps,
        riskFactors,
        impactPredictions,
        confidenceScore: this.calculateOverallConfidence(finalGaps, riskFactors),
        analysisTimestamp: new Date()
      };

      return {
        success: true,
        data: result
      };

    } catch (error) {
      return {
        success: false,
        error: {
          type: 'GAP_ANALYSIS_FAILED',
          message: error instanceof Error ? error.message : 'Unknown gap analysis error',
          details: { error }
        }
      };
    }
  }

  /**
   * Gathers comprehensive student performance data across courses
   */
  private async gatherStudentPerformanceData(
    studentId: string,
    courseIds: string[]
  ): Promise<StudentPerformanceData[]> {
    const performanceData: StudentPerformanceData[] = [];

    for (const courseId of courseIds) {
      // This would normally integrate with actual LMS data
      // For MVP, we'll simulate realistic performance data
      const courseData = await this.simulateCoursePerformanceData(studentId, courseId);
      performanceData.push(courseData);
    }

    return performanceData;
  }

  /**
   * Simulates realistic course performance data for MVP
   */
  private async simulateCoursePerformanceData(
    studentId: string,
    courseId: string
  ): Promise<StudentPerformanceData> {
    // Simulate realistic performance patterns
    const basePerformance = 0.6 + Math.random() * 0.3; // 0.6-0.9
    const courseName = this.getCourseNameFromId(courseId);
    
    const concepts = this.getConceptsForCourse(courseId);
    const conceptPerformances: ConceptPerformanceData[] = concepts.map(concept => ({
      concept,
      masteryLevel: basePerformance + (Math.random() - 0.5) * 0.2,
      confidence: 0.7 + Math.random() * 0.2,
      timeToMastery: 7 + Math.random() * 14, // 7-21 days
      strugglesEncountered: Math.random() < 0.3, // 30% chance of struggles
      assessmentHistory: this.generateAssessmentHistory(concept),
      reviewsRequired: Math.floor(Math.random() * 3)
    }));

    // Integrate with struggle detection system
    const strugglesDetected = await this.getStruggleIndicators(studentId, courseId);

    return {
      studentId,
      courseId,
      courseName,
      overallPerformance: basePerformance,
      conceptPerformances,
      learningVelocity: 0.5 + Math.random() * 0.4, // 0.5-0.9
      timeInCourse: Math.floor(Math.random() * 60) + 10, // 10-70 days
      strugglesDetected,
      lastAssessment: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) // Within last week
    };
  }

  /**
   * Gets struggle indicators from the existing struggle detection system
   */
  private async getStruggleIndicators(
    studentId: string,
    courseId: string
  ): Promise<StruggleIndicator[]> {
    try {
      // This would integrate with the actual StruggleDetectionEngine
      // For MVP, simulate struggle indicators
      const indicators: StruggleIndicator[] = [];
      
      // Simulate some struggle indicators
      if (Math.random() < 0.4) { // 40% chance of detected struggles
        indicators.push({
          type: 'conceptual_confusion',
          severity: 0.3 + Math.random() * 0.4,
          concepts: ['algebra', 'functions'],
          detectedAt: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000),
          resolved: Math.random() < 0.6 // 60% chance of being resolved
        });
      }

      return indicators;
    } catch (error) {
      console.warn('Failed to retrieve struggle indicators:', error);
      return [];
    }
  }

  /**
   * Gets relevant knowledge dependencies for the student's courses
   */
  private async getRelevantDependencies(
    courseIds: string[]
  ): Promise<CrossCourseResult<KnowledgeDependency[]>> {
    try {
      const allDependencies: KnowledgeDependency[] = [];

      // Get dependencies where these courses are involved
      for (const courseId of courseIds) {
        const courseDeps = await this.knowledgeGraphRepo.getCourseDependencies(courseId);
        if (courseDeps.success) {
          allDependencies.push(...(courseDeps.data?.prerequisites || []));
          allDependencies.push(...(courseDeps.data?.dependents || []));
        }
      }

      // Remove duplicates
      const uniqueDependencies = this.removeDuplicateDependencies(allDependencies);

      return {
        success: true,
        data: uniqueDependencies
      };
    } catch (error) {
      return {
        success: false,
        error: {
          type: 'SYSTEM_OVERLOAD',
          message: 'Failed to retrieve knowledge dependencies'
        }
      };
    }
  }

  /**
   * Identifies current knowledge gaps in student performance
   */
  private async identifyCurrentGaps(
    performanceData: StudentPerformanceData[],
    dependencies: KnowledgeDependency[]
  ): Promise<KnowledgeGap[]> {
    const gaps: KnowledgeGap[] = [];

    for (const dependency of dependencies) {
      // Find performance data for prerequisite course
      const prereqCourse = performanceData.find(p => p.courseId === dependency.prerequisiteCourse);
      const dependentCourse = performanceData.find(p => p.courseId === dependency.dependentCourse);

      if (!prereqCourse || !dependentCourse) {
        continue; // Skip if we don't have data for both courses
      }

      // Check if prerequisite concept shows weakness
      const prereqConcept = prereqCourse.conceptPerformances.find(
        c => c.concept === dependency.prerequisiteConcept
      );

      if (prereqConcept && prereqConcept.masteryLevel < this.config.riskThreshold) {
        // Check if dependent course is currently active or upcoming
        const isActiveOrUpcoming = dependentCourse.timeInCourse < 30; // First month

        if (isActiveOrUpcoming) {
          const gap = await this.createKnowledgeGap(
            dependency,
            prereqConcept,
            dependentCourse,
            performanceData
          );
          gaps.push(gap);
        }
      }
    }

    return gaps;
  }

  /**
   * Creates a knowledge gap object from analysis
   */
  private async createKnowledgeGap(
    dependency: KnowledgeDependency,
    prereqConcept: ConceptPerformanceData,
    dependentCourse: StudentPerformanceData,
    allPerformanceData: StudentPerformanceData[]
  ): Promise<KnowledgeGap> {
    // Calculate gap severity based on multiple factors
    const gapSeverity = this.calculateGapSeverity(
      prereqConcept,
      dependency.dependencyStrength,
      dependentCourse
    );

    // Determine remediation priority
    const remediationPriority = this.determineRemediationPriority(gapSeverity, dependency);

    // Estimate review time needed
    const estimatedReviewTime = this.estimateReviewTime(prereqConcept, dependency);

    // Find impacted courses
    const impactedCourses = this.findImpactedCourses(dependency, allPerformanceData);

    return {
      id: `gap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      prerequisiteCourse: dependency.prerequisiteCourse,
      concept: dependency.prerequisiteConcept,
      gapSeverity,
      impactedCourses,
      remediationPriority,
      estimatedReviewTime,
      prerequisiteTopics: this.getPrerequisiteTopics(dependency.prerequisiteConcept)
    };
  }

  /**
   * Calculates gap severity based on multiple factors
   */
  private calculateGapSeverity(
    concept: ConceptPerformanceData,
    dependencyStrength: number,
    dependentCourse: StudentPerformanceData
  ): number {
    // Base severity from mastery level
    const masteryGap = 1 - concept.masteryLevel;
    
    // Adjust for dependency strength
    const strengthAdjustment = dependencyStrength;
    
    // Adjust for current course performance
    const coursePerformanceAdjustment = 1 - dependentCourse.overallPerformance;
    
    // Adjust for struggle indicators
    const struggleAdjustment = dependentCourse.strugglesDetected.length > 0 ? 0.2 : 0;

    const severity = Math.min(1.0, 
      masteryGap * strengthAdjustment + 
      coursePerformanceAdjustment * 0.3 + 
      struggleAdjustment
    );

    return Math.max(0.1, severity); // Minimum severity of 0.1
  }

  /**
   * Determines remediation priority based on gap characteristics
   */
  private determineRemediationPriority(
    gapSeverity: number,
    dependency: KnowledgeDependency
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (gapSeverity > 0.8 && dependency.dependencyStrength > 0.8) {
      return 'critical';
    } else if (gapSeverity > 0.6 || dependency.dependencyStrength > 0.7) {
      return 'high';
    } else if (gapSeverity > 0.4) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Predicts the impact of identified gaps on future performance
   */
  private async predictGapImpacts(
    gaps: KnowledgeGap[],
    dependencies: KnowledgeDependency[],
    performanceData: StudentPerformanceData[]
  ): Promise<ImpactPrediction[]> {
    const predictions: ImpactPrediction[] = [];

    for (const gap of gaps) {
      const prediction = await this.createImpactPrediction(gap, dependencies, performanceData);
      predictions.push(prediction);
    }

    return predictions;
  }

  /**
   * Creates impact prediction for a specific gap
   */
  private async createImpactPrediction(
    gap: KnowledgeGap,
    dependencies: KnowledgeDependency[],
    performanceData: StudentPerformanceData[]
  ): Promise<ImpactPrediction> {
    // Find the relevant dependency
    const relevantDep = dependencies.find(d => 
      d.prerequisiteCourse === gap.prerequisiteCourse && 
      d.prerequisiteConcept === gap.concept
    );

    // Calculate timeline until impact manifests
    const timeline = this.calculateImpactTimeline(gap, relevantDep, performanceData);
    
    // Calculate severity of impact
    const severity = gap.gapSeverity * (relevantDep?.dependencyStrength || 0.5);
    
    // Predict performance drop
    const performanceDropPrediction = Math.min(0.4, severity * 0.5); // Max 40% drop
    
    // Calculate confidence in prediction
    const confidence = this.calculatePredictionConfidence(gap, relevantDep, performanceData);

    return {
      timeline,
      severity,
      performanceDropPrediction,
      confidence,
      affectedAssignments: this.predictAffectedAssignments(gap, relevantDep)
    };
  }

  /**
   * Generates risk factors from gap analysis
   */
  private async generateRiskFactors(
    gaps: KnowledgeGap[],
    performanceData: StudentPerformanceData[],
    predictions: ImpactPrediction[]
  ): Promise<RiskFactor[]> {
    const riskFactors: RiskFactor[] = [];

    // Create risk factors for each gap
    for (let i = 0; i < gaps.length; i++) {
      const gap = gaps[i];
      const prediction = predictions[i];

      const riskFactor: RiskFactor = {
        id: `risk_${Date.now()}_${i}`,
        category: 'prerequisite_gap',
        description: `Knowledge gap in ${gap.concept} may impact performance in ${gap.impactedCourses.join(', ')}`,
        impact: gap.gapSeverity,
        confidence: prediction.confidence,
        courses: gap.impactedCourses,
        timeframe: this.mapTimelineToTimeframe(prediction.timeline)
      };

      riskFactors.push(riskFactor);
    }

    return riskFactors;
  }

  /**
   * Validates gap detection results to reduce false positives
   */
  private validateGapDetection(
    gaps: KnowledgeGap[],
    riskFactors: RiskFactor[]
  ): KnowledgeGap[] {
    return gaps.filter(gap => {
      // Remove low-severity gaps
      if (gap.gapSeverity < this.config.falsePositiveThreshold) {
        return false;
      }

      // Validate with Zod schema
      const validation = validateSafely(KnowledgeGapSchema, gap);
      if (!validation.success) {
        return false;
      }

      // Additional business logic validation
      return this.validateGapBusinessLogic(gap);
    });
  }

  /**
   * Includes preventive gap detection for early intervention
   */
  private async includePreventiveGaps(
    currentGaps: KnowledgeGap[],
    performanceData: StudentPerformanceData[],
    dependencies: KnowledgeDependency[]
  ): Promise<KnowledgeGap[]> {
    const preventiveGaps: KnowledgeGap[] = [];

    // Look for potential future gaps based on learning velocity and patterns
    for (const performance of performanceData) {
      if (performance.learningVelocity < 0.5 && performance.overallPerformance < 0.7) {
        // Student is at risk of developing gaps
        const futureGaps = await this.identifyPotentialFutureGaps(performance, dependencies);
        preventiveGaps.push(...futureGaps);
      }
    }

    // Combine and deduplicate
    const allGaps = [...currentGaps, ...preventiveGaps];
    return this.removeDuplicateGaps(allGaps);
  }

  // Helper methods

  private getCourseNameFromId(courseId: string): string {
    const courseNames: Record<string, string> = {
      'math101': 'College Algebra',
      'math201': 'Calculus I',
      'physics101': 'Physics I',
      'chemistry101': 'General Chemistry'
    };
    return courseNames[courseId] || `Course ${courseId}`;
  }

  private getConceptsForCourse(courseId: string): string[] {
    const courseConcepts: Record<string, string[]> = {
      'math101': ['algebra', 'quadratic equations', 'functions', 'graphing'],
      'math201': ['derivatives', 'limits', 'integrals', 'continuity'],
      'physics101': ['motion', 'forces', 'energy', 'waves'],
      'chemistry101': ['atoms', 'bonds', 'reactions', 'stoichiometry']
    };
    return courseConcepts[courseId] || ['general concepts'];
  }

  private generateAssessmentHistory(concept: string): AssessmentPoint[] {
    const history: AssessmentPoint[] = [];
    const numAssessments = 3 + Math.floor(Math.random() * 5); // 3-7 assessments

    for (let i = 0; i < numAssessments; i++) {
      history.push({
        timestamp: new Date(Date.now() - (numAssessments - i) * 7 * 24 * 60 * 60 * 1000),
        score: 0.5 + Math.random() * 0.4, // 0.5-0.9
        assessmentType: ['quiz', 'homework', 'exam', 'practice'][Math.floor(Math.random() * 4)] as any,
        conceptsCovered: [concept],
        timeSpent: 20 + Math.random() * 40 // 20-60 minutes
      });
    }

    return history;
  }

  private removeDuplicateDependencies(dependencies: KnowledgeDependency[]): KnowledgeDependency[] {
    const seen = new Set<string>();
    return dependencies.filter(dep => {
      const key = `${dep.prerequisiteCourse}-${dep.prerequisiteConcept}-${dep.dependentCourse}-${dep.dependentConcept}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private removeDuplicateGaps(gaps: KnowledgeGap[]): KnowledgeGap[] {
    const seen = new Set<string>();
    return gaps.filter(gap => {
      const key = `${gap.prerequisiteCourse}-${gap.concept}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private estimateReviewTime(concept: ConceptPerformanceData, dependency: KnowledgeDependency): number {
    // Base time on concept difficulty and current mastery
    const baseTime = 30; // 30 minutes base
    const difficultyMultiplier = 1 + (1 - concept.masteryLevel);
    const dependencyMultiplier = 1 + dependency.dependencyStrength * 0.5;
    
    return Math.round(baseTime * difficultyMultiplier * dependencyMultiplier);
  }

  private findImpactedCourses(
    dependency: KnowledgeDependency,
    performanceData: StudentPerformanceData[]
  ): string[] {
    return [dependency.dependentCourse];
  }

  private getPrerequisiteTopics(concept: string): string[] {
    const topicMap: Record<string, string[]> = {
      'derivatives': ['limits', 'functions', 'graphing'],
      'integrals': ['derivatives', 'limits', 'functions'],
      'quadratic equations': ['algebra', 'factoring', 'graphing']
    };
    return topicMap[concept] || [];
  }

  private calculateImpactTimeline(
    gap: KnowledgeGap,
    dependency: KnowledgeDependency | undefined,
    performanceData: StudentPerformanceData[]
  ): number {
    // Predict days until impact manifests
    const baseDays = 14; // 2 weeks base
    const severityAdjustment = (1 - gap.gapSeverity) * 7; // Lower severity = more time
    const dependencyAdjustment = dependency ? (1 - dependency.dependencyStrength) * 7 : 0;
    
    return Math.max(1, Math.round(baseDays + severityAdjustment + dependencyAdjustment));
  }

  private calculatePredictionConfidence(
    gap: KnowledgeGap,
    dependency: KnowledgeDependency | undefined,
    performanceData: StudentPerformanceData[]
  ): number {
    let confidence = 0.7; // Base confidence

    // Adjust based on dependency validation score
    if (dependency) {
      confidence = Math.min(1.0, confidence + dependency.validationScore * 0.2);
    }

    // Adjust based on data quality
    const dataQuality = this.assessDataQuality(performanceData);
    confidence *= dataQuality;

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private predictAffectedAssignments(
    gap: KnowledgeGap,
    dependency: KnowledgeDependency | undefined
  ): string[] {
    // This would normally query actual assignment data
    // For MVP, return simulated assignments
    return [
      `${dependency?.dependentConcept || 'Advanced'} Assignment 1`,
      `${dependency?.dependentConcept || 'Advanced'} Quiz 2`
    ];
  }

  private mapTimelineToTimeframe(timeline: number): RiskFactor['timeframe'] {
    if (timeline <= 3) return 'immediate';
    if (timeline <= 14) return 'short_term';
    if (timeline <= 30) return 'medium_term';
    return 'long_term';
  }

  private validateGapBusinessLogic(gap: KnowledgeGap): boolean {
    // Business logic validation
    if (gap.gapSeverity <= 0 || gap.gapSeverity > 1) return false;
    if (gap.impactedCourses.length === 0) return false;
    if (!gap.concept || gap.concept.trim().length === 0) return false;
    
    return true;
  }

  private async identifyPotentialFutureGaps(
    performance: StudentPerformanceData,
    dependencies: KnowledgeDependency[]
  ): Promise<KnowledgeGap[]> {
    // Simplified future gap prediction
    // In production, this would use more sophisticated ML models
    const futureGaps: KnowledgeGap[] = [];
    
    const weakConcepts = performance.conceptPerformances.filter(c => c.masteryLevel < 0.6);
    
    for (const concept of weakConcepts) {
      const relevantDep = dependencies.find(d => d.prerequisiteConcept === concept.concept);
      if (relevantDep && Math.random() < 0.3) { // 30% chance of becoming a gap
        futureGaps.push({
          id: `future_gap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          prerequisiteCourse: performance.courseId,
          concept: concept.concept,
          gapSeverity: 1 - concept.masteryLevel,
          impactedCourses: [relevantDep.dependentCourse],
          remediationPriority: 'medium',
          estimatedReviewTime: this.estimateReviewTime(concept, relevantDep)
        });
      }
    }
    
    return futureGaps;
  }

  private assessDataQuality(performanceData: StudentPerformanceData[]): number {
    // Simple data quality assessment
    let quality = 1.0;
    
    for (const performance of performanceData) {
      // Reduce quality for insufficient data
      if (performance.conceptPerformances.length < 3) {
        quality *= 0.9;
      }
      
      // Reduce quality for stale data
      const daysSinceLastAssessment = (Date.now() - performance.lastAssessment.getTime()) / (24 * 60 * 60 * 1000);
      if (daysSinceLastAssessment > 14) {
        quality *= 0.95;
      }
    }
    
    return Math.max(0.5, quality);
  }

  private calculateOverallConfidence(gaps: KnowledgeGap[], riskFactors: RiskFactor[]): number {
    if (gaps.length === 0) return 1.0;
    
    const avgRiskConfidence = riskFactors.reduce((sum, rf) => sum + rf.confidence, 0) / riskFactors.length;
    const gapQuality = gaps.filter(g => g.gapSeverity > 0.5).length / gaps.length;
    
    return Math.min(1.0, avgRiskConfidence * gapQuality);
  }
}