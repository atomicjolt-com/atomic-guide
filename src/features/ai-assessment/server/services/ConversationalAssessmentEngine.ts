/**
 * @fileoverview Conversational Assessment Engine
 * @module features/ai-assessment/server/services/ConversationalAssessmentEngine
 *
 * Core service for managing AI-powered conversational assessments.
 * Handles session lifecycle, mastery tracking, and adaptive questioning.
 *
 * Features:
 * - Contextual assessment initiation based on Canvas content
 * - Natural language conversation flow with pedagogical progression
 * - Real-time comprehension evaluation using Workers AI
 * - Mastery-based progression with instructor-configured thresholds
 * - Assessment state persistence and recovery
 */

import {
  AssessmentSession,
  AssessmentSessionConfig,
  AssessmentSessionId,
  AssessmentSessionStatus,
  AssessmentMessage,
  MessageType,
  ResponseAnalysis,
  GradeCalculation,
  AIAssessmentError,
  SessionValidationError,
  UserIdSchema,
  CourseIdSchema,
  AssessmentSessionIdSchema,
  AssessmentSessionSchema,
  AssessmentSessionConfigSchema,
  ResponseAnalysisSchema,
  GradeCalculationSchema
} from '../../shared/types.ts';

import { AssessmentAIService } from './AssessmentAIService.ts';
import { AssessmentSessionRepository } from '../repositories/AssessmentSessionRepository.ts';
import { DatabaseService } from '../../../../shared/services/DatabaseService.ts';

/**
 * Assessment progression step types
 */
type ProgressionStep =
  | 'initialization'
  | 'engagement'
  | 'knowledge_assessment'
  | 'concept_exploration'
  | 'mastery_verification'
  | 'remediation'
  | 'completion';

/**
 * Conversational Assessment Engine Configuration
 */
interface EngineConfig {
  maxConversationTurns: number;
  masteryConfidenceThreshold: number;
  interventionTriggerThreshold: number;
  adaptiveDifficultyEnabled: boolean;
  academicIntegrityEnabled: boolean;
  performanceMetricsEnabled: boolean;
}

/**
 * Default engine configuration
 */
const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  maxConversationTurns: 50,
  masteryConfidenceThreshold: 0.85,
  interventionTriggerThreshold: 0.3,
  adaptiveDifficultyEnabled: true,
  academicIntegrityEnabled: true,
  performanceMetricsEnabled: true
};

/**
 * Conversational Assessment Engine
 *
 * Main orchestrator for AI-powered conversational assessments.
 * Manages session lifecycle from initialization to completion with grade passback.
 */
export class ConversationalAssessmentEngine {
  private readonly engineConfig: EngineConfig;

  constructor(
    private readonly aiService: AssessmentAIService,
    private readonly sessionRepository: AssessmentSessionRepository,
    private readonly databaseService: DatabaseService,
    engineConfig?: Partial<EngineConfig>
  ) {
    this.engineConfig = { ...DEFAULT_ENGINE_CONFIG, ...engineConfig };
  }

  /**
   * Initialize a new assessment session
   *
   * @param config - Assessment session configuration
   * @returns Created assessment session
   */
  async initializeSession(config: AssessmentSessionConfig): Promise<AssessmentSession> {
    try {
      // Validate configuration
      const validatedConfig = AssessmentSessionConfigSchema.parse(config);

      // Generate session ID
      const sessionId = AssessmentSessionIdSchema.parse(crypto.randomUUID());

      // Create initial session state
      const session: AssessmentSession = {
        id: sessionId,
        config: validatedConfig,
        status: 'created',
        progress: {
          currentStep: 0,
          totalSteps: this.calculateTotalSteps(validatedConfig),
          masteryAchieved: false,
          attemptNumber: 1,
          conceptsMastered: [],
          conceptsNeedWork: [...validatedConfig.context.concepts]
        },
        timing: {
          startedAt: new Date(),
          lastActivity: new Date(),
          timeSpentMs: 0,
          timeoutAt: validatedConfig.settings.timeLimit ?
            new Date(Date.now() + validatedConfig.settings.timeLimit * 60 * 1000) :
            undefined
        },
        conversation: [],
        analytics: {
          engagementScore: 1.0,
          strugglingIndicators: [],
          learningPatterns: {}
        },
        security: {
          sessionToken: this.generateSecureToken(),
          lastValidation: new Date(),
          integrityChecks: []
        }
      };

      // Generate initial welcome message
      const welcomeMessage = await this.generateWelcomeMessage(session);
      session.conversation.push(welcomeMessage);

      // Persist session
      await this.sessionRepository.createSession(session);

      // Update status to active
      session.status = 'active';
      await this.sessionRepository.updateSession(session);

      return session;

    } catch (error) {
      throw new AIAssessmentError(
        `Failed to initialize assessment session: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SESSION_INITIALIZATION_FAILED',
        { config }
      );
    }
  }

  /**
   * Process student response and generate AI feedback
   *
   * @param sessionId - Assessment session ID
   * @param studentResponse - Student's text response
   * @param metadata - Optional response metadata
   * @returns Updated session with AI response
   */
  async processStudentResponse(
    sessionId: AssessmentSessionId,
    studentResponse: string,
    metadata?: Record<string, unknown>
  ): Promise<AssessmentSession> {
    try {
      // Validate session
      const session = await this.validateAndGetSession(sessionId);

      if (session.status !== 'active' && session.status !== 'awaiting_response') {
        throw new SessionValidationError(
          `Invalid session status for response processing: ${session.status}`,
          { sessionId, status: session.status }
        );
      }

      // Update session status
      session.status = 'processing';
      session.timing.lastActivity = new Date();
      await this.sessionRepository.updateSession(session);

      // Record student message
      const studentMessage = this.createStudentMessage(session, studentResponse, metadata);
      session.conversation.push(studentMessage);

      // Perform academic integrity check
      if (this.engineConfig.academicIntegrityEnabled) {
        await this.performIntegrityCheck(session, studentMessage);
      }

      // Analyze student response using AI
      const analysis = await this.aiService.analyzeStudentResponse(
        studentResponse,
        this.buildAnalysisContext(session)
      );

      // Update session progress based on analysis
      this.updateSessionProgress(session, analysis);

      // Generate AI response based on analysis
      const aiResponse = await this.generateAIResponse(session, analysis);
      session.conversation.push(aiResponse);

      // Determine next session status
      const nextStatus = this.determineNextStatus(session, analysis);
      session.status = nextStatus;

      // Handle session completion if applicable
      if (nextStatus === 'completed' || nextStatus === 'mastery_achieved') {
        await this.handleSessionCompletion(session);
      }

      // Update session analytics
      this.updateSessionAnalytics(session, analysis);

      // Persist updated session
      await this.sessionRepository.updateSession(session);

      return session;

    } catch (error) {
      // Handle error and update session status
      await this.handleProcessingError(sessionId, error);
      throw error;
    }
  }

  /**
   * Get current session state
   *
   * @param sessionId - Assessment session ID
   * @returns Current session state
   */
  async getSession(sessionId: AssessmentSessionId): Promise<AssessmentSession> {
    return this.validateAndGetSession(sessionId);
  }

  /**
   * Calculate final grade for completed session
   *
   * @param sessionId - Assessment session ID
   * @returns Grade calculation result
   */
  async calculateFinalGrade(sessionId: AssessmentSessionId): Promise<GradeCalculation> {
    try {
      const session = await this.validateAndGetSession(sessionId);

      if (!['completed', 'mastery_achieved', 'max_attempts', 'timeout'].includes(session.status)) {
        throw new AIAssessmentError(
          `Cannot calculate grade for session in status: ${session.status}`,
          'INVALID_SESSION_STATUS',
          { sessionId, status: session.status }
        );
      }

      // Calculate mastery score based on concepts mastered
      const masteryScore = this.calculateMasteryScore(session);

      // Calculate participation score based on engagement
      const participationScore = this.calculateParticipationScore(session);

      // Calculate improvement score based on learning progression
      const improvementScore = this.calculateImprovementScore(session);

      // Apply rubric weights
      const rubric = session.config.grading.gradingRubric;
      const weightedScore =
        (masteryScore * rubric.masteryWeight) +
        (participationScore * rubric.participationWeight) +
        (improvementScore * rubric.improvementWeight);

      // Generate feedback
      const feedback = await this.generateGradeFeedback(session, {
        masteryScore,
        participationScore,
        improvementScore
      });

      const gradeCalculation: GradeCalculation = {
        sessionId,
        numericScore: Math.round(weightedScore),
        components: {
          masteryScore,
          participationScore,
          improvementScore
        },
        feedback,
        passback: {
          eligible: session.config.grading.passbackEnabled,
          status: 'pending'
        }
      };

      return GradeCalculationSchema.parse(gradeCalculation);

    } catch (error) {
      throw new AIAssessmentError(
        `Failed to calculate grade: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GRADE_CALCULATION_FAILED',
        { sessionId }
      );
    }
  }

  /**
   * Validate session and check for timeout
   */
  private async validateAndGetSession(sessionId: AssessmentSessionId): Promise<AssessmentSession> {
    const session = await this.sessionRepository.getSession(sessionId);

    if (!session) {
      throw new SessionValidationError(
        `Assessment session not found: ${sessionId}`,
        { sessionId }
      );
    }

    // Check for timeout
    if (session.timing.timeoutAt && new Date() > session.timing.timeoutAt) {
      if (session.status !== 'timeout' && session.status !== 'completed') {
        session.status = 'timeout';
        await this.sessionRepository.updateSession(session);
      }
    }

    return AssessmentSessionSchema.parse(session);
  }

  /**
   * Generate welcome message for new session
   */
  private async generateWelcomeMessage(session: AssessmentSession): Promise<AssessmentMessage> {
    const context = {
      assessmentTitle: session.config.assessmentTitle,
      learningObjectives: session.config.context.learningObjectives,
      concepts: session.config.context.concepts,
      settings: session.config.settings
    };

    const welcomeContent = await this.aiService.generateWelcomeMessage(context);

    return {
      id: crypto.randomUUID(),
      sessionId: session.id,
      type: 'system',
      content: welcomeContent,
      timestamp: new Date(),
      contentHash: this.generateContentHash(welcomeContent),
      encrypted: false
    };
  }

  /**
   * Create student message record
   */
  private createStudentMessage(
    session: AssessmentSession,
    content: string,
    metadata?: Record<string, unknown>
  ): AssessmentMessage {
    return {
      id: crypto.randomUUID(),
      sessionId: session.id,
      type: 'student',
      content,
      timestamp: new Date(),
      metadata: {
        responseTimeMs: metadata?.responseTimeMs as number,
        ...metadata
      },
      contentHash: this.generateContentHash(content),
      encrypted: false
    };
  }

  /**
   * Build analysis context from session history
   */
  private buildAnalysisContext(session: AssessmentSession): Record<string, unknown> {
    return {
      sessionId: session.id,
      config: session.config,
      progress: session.progress,
      conversationHistory: session.conversation.slice(-10), // Last 10 messages for context
      concepts: session.config.context.concepts,
      learningObjectives: session.config.context.learningObjectives,
      masteryThreshold: session.config.settings.masteryThreshold,
      attemptNumber: session.progress.attemptNumber
    };
  }

  /**
   * Update session progress based on AI analysis
   */
  private updateSessionProgress(session: AssessmentSession, analysis: ResponseAnalysis): void {
    // Update concepts mastered/need work
    analysis.understanding.conceptsUnderstood.forEach(concept => {
      if (!session.progress.conceptsMastered.includes(concept)) {
        session.progress.conceptsMastered.push(concept);
        session.progress.conceptsNeedWork = session.progress.conceptsNeedWork.filter(c => c !== concept);
      }
    });

    // Update overall mastery status
    const masteryRate = session.progress.conceptsMastered.length / session.config.context.concepts.length;
    session.progress.masteryAchieved = masteryRate >= session.config.settings.masteryThreshold;

    // Update current step
    session.progress.currentStep += 1;

    // Update overall score if available
    if (analysis.mastery.progress !== undefined) {
      session.progress.overallScore = analysis.mastery.progress;
    }
  }

  /**
   * Generate AI response based on analysis
   */
  private async generateAIResponse(
    session: AssessmentSession,
    analysis: ResponseAnalysis
  ): Promise<AssessmentMessage> {
    const responseType = this.determineResponseType(analysis);
    const context = this.buildResponseContext(session, analysis);

    const aiContent = await this.aiService.generateResponse(responseType, context);

    return {
      id: crypto.randomUUID(),
      sessionId: session.id,
      type: responseType,
      content: aiContent,
      timestamp: new Date(),
      metadata: {
        aiConfidence: analysis.understanding.confidence,
        understandingLevel: this.mapUnderstandingLevel(analysis.understanding.level),
        conceptsAddressed: analysis.understanding.conceptsUnderstood,
        misconceptionDetected: analysis.understanding.misconceptions.length > 0
      },
      contentHash: this.generateContentHash(aiContent),
      encrypted: false
    };
  }

  /**
   * Determine appropriate response type based on analysis
   */
  private determineResponseType(analysis: ResponseAnalysis): MessageType {
    if (analysis.understanding.misconceptions.length > 0) {
      return 'feedback';
    }

    if (analysis.mastery.achieved) {
      return 'encouragement';
    }

    if (analysis.understanding.level === 'none' || analysis.understanding.level === 'partial') {
      return 'hint';
    }

    if (analysis.nextQuestion.type === 'mastery_check') {
      return 'mastery_check';
    }

    return 'question';
  }

  /**
   * Build context for AI response generation
   */
  private buildResponseContext(
    session: AssessmentSession,
    analysis: ResponseAnalysis
  ): Record<string, unknown> {
    return {
      session,
      analysis,
      conversationHistory: session.conversation,
      studentProgress: session.progress,
      settings: session.config.settings
    };
  }

  /**
   * Determine next session status
   */
  private determineNextStatus(
    session: AssessmentSession,
    analysis: ResponseAnalysis
  ): AssessmentSessionStatus {
    // Check for mastery achievement
    if (session.progress.masteryAchieved && analysis.mastery.achieved) {
      return 'mastery_achieved';
    }

    // Check for max attempts
    if (session.progress.attemptNumber >= session.config.settings.maxAttempts) {
      return 'max_attempts';
    }

    // Check for timeout
    if (session.timing.timeoutAt && new Date() > session.timing.timeoutAt) {
      return 'timeout';
    }

    // Check for conversation completion
    if (session.conversation.length >= this.engineConfig.maxConversationTurns) {
      return 'completed';
    }

    // Continue assessment
    return 'awaiting_response';
  }

  /**
   * Handle session completion tasks
   */
  private async handleSessionCompletion(session: AssessmentSession): Promise<void> {
    // Calculate final metrics
    session.timing.timeSpentMs = Date.now() - session.timing.startedAt.getTime();

    // Update analytics for completion
    session.analytics.engagementScore = this.calculateFinalEngagementScore(session);

    // Mark completion timestamp
    session.timing.estimatedCompletion = new Date();
  }

  /**
   * Update session analytics based on interaction
   */
  private updateSessionAnalytics(session: AssessmentSession, analysis: ResponseAnalysis): void {
    // Update engagement indicators
    if (analysis.engagement.strugglingSignals?.length) {
      session.analytics.strugglingIndicators.push(...analysis.engagement.strugglingSignals);
    }

    // Update learning patterns
    session.analytics.learningPatterns = {
      ...session.analytics.learningPatterns,
      [`turn_${session.conversation.length}`]: {
        understanding: analysis.understanding.level,
        confidence: analysis.understanding.confidence,
        engagement: analysis.engagement.level
      }
    };
  }

  /**
   * Perform academic integrity check on student response
   */
  private async performIntegrityCheck(
    session: AssessmentSession,
    message: AssessmentMessage
  ): Promise<void> {
    const integrityResult = await this.aiService.checkAcademicIntegrity(
      message.content,
      session.conversation
    );

    session.security.integrityChecks.push({
      timestamp: new Date(),
      type: 'response_authenticity',
      result: integrityResult.authenticity === 'verified' ? 'pass' :
              integrityResult.authenticity === 'suspicious' ? 'warning' : 'fail',
      details: integrityResult.similarityFlags?.join(', ')
    });

    // Update message integrity data
    message.integrity = {
      originalContent: message.content,
      similarityScore: integrityResult.aiDetectionScore,
      authenticity: integrityResult.authenticity
    };
  }

  /**
   * Handle processing errors
   */
  private async handleProcessingError(
    sessionId: AssessmentSessionId,
    error: unknown
  ): Promise<void> {
    try {
      const session = await this.sessionRepository.getSession(sessionId);
      if (session) {
        session.status = 'error';
        session.timing.lastActivity = new Date();
        await this.sessionRepository.updateSession(session);
      }
    } catch (updateError) {
      console.error('Failed to update session status after error:', updateError);
    }
  }

  /**
   * Calculate total steps for assessment
   */
  private calculateTotalSteps(config: AssessmentSessionConfig): number {
    const baseTurns = 5; // Minimum conversation turns
    const conceptTurns = config.context.concepts.length * 2; // 2 turns per concept
    const masteryTurns = 3; // Final mastery verification
    return baseTurns + conceptTurns + masteryTurns;
  }

  /**
   * Generate secure session token
   */
  private generateSecureToken(): string {
    return crypto.randomUUID() + '-' + Date.now().toString(36);
  }

  /**
   * Generate content hash for integrity
   */
  private generateContentHash(content: string): string {
    // Simple hash for content integrity - in production, use crypto.subtle
    return btoa(content).slice(0, 32);
  }

  /**
   * Calculate mastery score from session progress
   */
  private calculateMasteryScore(session: AssessmentSession): number {
    const masteryRate = session.progress.conceptsMastered.length / session.config.context.concepts.length;
    return Math.round(masteryRate * 100);
  }

  /**
   * Calculate participation score from engagement
   */
  private calculateParticipationScore(session: AssessmentSession): number {
    const baseScore = session.analytics.engagementScore * 100;
    const conversationBonus = Math.min(session.conversation.length / 10, 1) * 10;
    return Math.round(Math.min(baseScore + conversationBonus, 100));
  }

  /**
   * Calculate improvement score from learning progression
   */
  private calculateImprovementScore(session: AssessmentSession): number {
    // Simple improvement calculation - can be enhanced with more sophisticated tracking
    const improvementRate = session.progress.overallScore || 0;
    return Math.round(improvementRate * 100);
  }

  /**
   * Generate grade feedback
   */
  private async generateGradeFeedback(
    session: AssessmentSession,
    scores: { masteryScore: number; participationScore: number; improvementScore: number }
  ): Promise<GradeCalculation['feedback']> {
    const context = {
      session,
      scores,
      conceptsMastered: session.progress.conceptsMastered,
      conceptsNeedWork: session.progress.conceptsNeedWork
    };

    return this.aiService.generateGradeFeedback(context);
  }

  /**
   * Calculate final engagement score
   */
  private calculateFinalEngagementScore(session: AssessmentSession): number {
    const messageCount = session.conversation.filter(m => m.type === 'student').length;
    const avgResponseTime = this.calculateAverageResponseTime(session);
    const strugglingPenalty = session.analytics.strugglingIndicators.length * 0.1;

    let score = 1.0;

    // Adjust for participation
    score *= Math.min(messageCount / 10, 1);

    // Adjust for response timing (reasonable times get better scores)
    if (avgResponseTime > 30000) score *= 0.9; // Very slow responses
    if (avgResponseTime < 5000) score *= 0.95; // Very fast responses (potential integrity issue)

    // Apply struggling penalty
    score = Math.max(score - strugglingPenalty, 0.1);

    return Math.min(score, 1.0);
  }

  /**
   * Calculate average response time from student messages
   */
  private calculateAverageResponseTime(session: AssessmentSession): number {
    const studentMessages = session.conversation.filter(m => m.type === 'student');
    const responseTimes = studentMessages
      .map(m => m.metadata?.responseTimeMs as number)
      .filter(t => typeof t === 'number');

    if (responseTimes.length === 0) return 30000; // Default 30 seconds

    return responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
  }

  /**
   * Map understanding level to analytics enum
   */
  private mapUnderstandingLevel(level: ResponseAnalysis['understanding']['level']): 'low' | 'medium' | 'high' {
    switch (level) {
      case 'excellent':
      case 'good':
        return 'high';
      case 'partial':
        return 'medium';
      case 'none':
      default:
        return 'low';
    }
  }
}