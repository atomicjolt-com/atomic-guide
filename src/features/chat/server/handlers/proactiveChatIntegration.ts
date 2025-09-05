/**
 * @fileoverview Enhanced Chat Handler with Proactive Interventions (Story 4.2)
 * @module features/chat/server/handlers/proactiveChatIntegration
 * 
 * Integrates Advanced Pattern Recognition and Predictive Intervention systems
 * with the existing chat interface to provide proactive recommendations and
 * adaptive responses based on real-time behavioral analysis.
 * 
 * INTEGRATION SCOPE (Phase 1 MVP):
 * - Proactive recommendations delivered through chat interface
 * - Real-time behavioral signal analysis during conversations
 * - Adaptive difficulty adjustment for chat responses
 * - Privacy-aware proactive feature delivery
 */

import { Context } from 'hono';
import { verify } from 'hono/jwt';
import { DatabaseService } from '@shared/server/services';
import { AdvancedPatternRecognizer } from '../../../learner-dna/server/services/AdvancedPatternRecognizer';
import { PredictiveInterventionEngine } from '../../../learner-dna/server/services/PredictiveInterventionEngine';
import { PrivacyControlService } from '../../../learner-dna/server/services/PrivacyControlService';
import { CognitiveDataCollector } from '../../../learner-dna/server/services/CognitiveDataCollector';
import { AIService, PromptBuilder } from '@shared/server/services';
import type {
  BehavioralSignalAnalysis,
  StrugglePrediction,
  BehavioralPattern
} from '../../../learner-dna/shared/types';

interface ProactiveChatRequest {
  session_id: string;
  message: string;
  page_context: {
    course_id: string | null;
    module_id: string | null;
    page_content: string | null;
    current_element: string | null;
  };
  conversation_id?: string;
  proactive_features_enabled?: boolean; // User preference
  response_time_ms?: number; // Time to compose message
  interaction_context?: {
    previous_messages_in_session: number;
    time_since_last_message_ms: number;
    help_requests_in_session: number;
    error_corrections_in_session: number;
  };
}

interface ProactiveChatResponse {
  message_id: string;
  content: string;
  timestamp: string;
  conversation_id: string;
  suggestions?: string[];
  
  // Story 4.2 Enhancements
  proactive_recommendations?: Array<{
    id: string;
    type: 'concept_clarification' | 'practice_suggestion' | 'break_reminder' | 'study_strategy' | 'motivational';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    message: string;
    actionText?: string;
    dismissible: boolean;
    triggerReason: string;
    confidence: number;
  }>;
  
  behavioral_insights?: {
    cognitive_load: number;
    attention_level: number;
    engagement_score: number;
    optimal_timing: boolean;
    recommendations: string[];
  };
  
  adaptive_response?: {
    difficulty_adjusted: boolean;
    original_difficulty?: number;
    recommended_difficulty?: number;
    adjustment_reason?: string;
  };
  
  token_usage?: {
    used: number;
    remaining: number;
  };
}

/**
 * Enhanced chat message handler with proactive interventions.
 * 
 * Integrates behavioral pattern recognition and predictive interventions
 * into the chat flow to provide real-time adaptive support without
 * disrupting the existing chat experience.
 * 
 * @param c - Hono context
 * @returns Promise resolving to enhanced chat response
 */
export async function handleProactiveChatMessage(c: Context): Promise<Response> {
  try {
    // Standard authentication (same as original)
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.substring(7);
    const secret = c.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET environment variable is not set');
      return c.json({ error: 'Server configuration error' }, 500);
    }

    let payload;
    try {
      payload = await verify(token, secret);
    } catch {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const tenantId = payload.tenant_id || payload.sub;
    const userId = payload.sub || payload.user_id;
    
    const body: ProactiveChatRequest = await c.req.json();

    if (!body.message || !body.session_id) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Initialize enhanced services
    const db = new DatabaseService(c.env.DB);
    const privacyService = new PrivacyControlService(db);
    const dataCollector = new CognitiveDataCollector(db, privacyService);
    const patternRecognizer = new AdvancedPatternRecognizer(db, dataCollector, privacyService);
    const interventionEngine = new PredictiveInterventionEngine(db, patternRecognizer, privacyService);

    const conversationId = body.conversation_id || `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Collect behavioral data from this interaction
    await collectChatBehavioralData(
      dataCollector,
      tenantId,
      userId,
      body.session_id,
      body.page_context.course_id || '',
      body
    );

    // Check if user has consented to proactive features
    const hasProactiveConsent = await privacyService.validateDataCollectionPermission(
      tenantId,
      userId,
      'behavioral_timing'
    );

    const proactiveFeaturesEnabled = body.proactive_features_enabled !== false && hasProactiveConsent;

    // Initialize response structure
    const response: ProactiveChatResponse = {
      message_id: messageId,
      content: '', // Will be filled by chat processing
      timestamp: new Date().toISOString(),
      conversation_id: conversationId,
    };

    // Process proactive interventions if enabled
    if (proactiveFeaturesEnabled) {
      try {
        // Parallel execution for performance
        const [
          behavioralAnalysis,
          proactiveRecommendations,
          adaptiveDifficulty
        ] = await Promise.all([
          // Real-time behavioral signal analysis
          patternRecognizer.analyzeRealTimeBehavioralSignals(
            tenantId,
            userId,
            body.page_context.course_id || ''
          ).catch(error => {
            console.warn('Behavioral analysis failed:', error);
            return null;
          }),

          // Proactive recommendations
          interventionEngine.generateProactiveRecommendations(
            tenantId,
            userId,
            body.page_context.course_id || '',
            body.page_context.current_element || undefined
          ).catch(error => {
            console.warn('Proactive recommendations failed:', error);
            return [];
          }),

          // Adaptive difficulty for response complexity
          body.page_context.course_id ? 
            interventionEngine.generateAdaptiveDifficultyAdjustment(
              tenantId,
              userId,
              body.page_context.course_id,
              0.5, // Default difficulty
              'explanation'
            ).catch(error => {
              console.warn('Difficulty adjustment failed:', error);
              return null;
            }) : Promise.resolve(null)
        ]);

        // Add behavioral insights to response
        if (behavioralAnalysis) {
          response.behavioral_insights = {
            cognitive_load: behavioralAnalysis.cognitiveLoad,
            attention_level: behavioralAnalysis.attentionLevel,
            engagement_score: behavioralAnalysis.engagementScore,
            optimal_timing: behavioralAnalysis.optimalInterventionTiming,
            recommendations: behavioralAnalysis.recommendations
          };
        }

        // Add proactive recommendations to response
        if (proactiveRecommendations.length > 0) {
          response.proactive_recommendations = proactiveRecommendations.map(rec => ({
            id: rec.id,
            type: rec.type,
            priority: rec.priority,
            message: rec.message,
            actionText: rec.actionText,
            dismissible: rec.dismissible,
            triggerReason: rec.triggerReason,
            confidence: rec.confidence
          }));
        }

        // Add adaptive difficulty information
        if (adaptiveDifficulty && Math.abs(adaptiveDifficulty.recommendedDifficulty - adaptiveDifficulty.currentDifficulty) > 0.1) {
          response.adaptive_response = {
            difficulty_adjusted: true,
            original_difficulty: adaptiveDifficulty.currentDifficulty,
            recommended_difficulty: adaptiveDifficulty.recommendedDifficulty,
            adjustment_reason: adaptiveDifficulty.adjustmentReason
          };
        }

      } catch (error) {
        console.error('Proactive features failed:', error);
        // Continue with standard chat processing
      }
    }

    // Process standard chat response (integrate with existing chat.ts logic)
    const chatResponse = await processStandardChatResponse(c, body, payload, response.adaptive_response?.recommended_difficulty);
    
    // Merge standard response with proactive enhancements
    response.content = chatResponse.content;
    response.suggestions = chatResponse.suggestions;
    response.token_usage = chatResponse.token_usage;

    return c.json(response, 200);

  } catch (error) {
    console.error('Enhanced chat message error:', error);

    // Fallback to basic chat functionality
    if (error instanceof Error) {
      if (error.message.includes('rate limit')) {
        return c.json({
          error: 'Too many requests. Please wait a moment before sending another message.',
          retryAfter: 60,
        }, 429);
      }

      if (error.message.includes('token limit')) {
        return c.json({
          error: 'Conversation has reached the token limit. Please start a new conversation.',
          code: 'TOKEN_LIMIT_EXCEEDED',
        }, 403);
      }
    }

    return c.json({ error: 'An unexpected error occurred. Please try again.' }, 500);
  }
}

/**
 * Collects behavioral data from chat interactions for pattern recognition.
 * 
 * @param dataCollector - Cognitive data collector service
 * @param tenantId - Tenant identifier
 * @param userId - User identifier
 * @param sessionId - Session identifier
 * @param courseId - Course identifier
 * @param request - Chat request with interaction data
 */
async function collectChatBehavioralData(
  dataCollector: CognitiveDataCollector,
  tenantId: string,
  userId: string,
  sessionId: string,
  courseId: string,
  request: ProactiveChatRequest
): Promise<void> {
  try {
    // Extract behavioral patterns from chat interaction
    const interactionData = {
      responseTimeMs: request.response_time_ms || 0,
      messageLength: request.message.length,
      sessionContext: {
        previousMessages: request.interaction_context?.previous_messages_in_session || 0,
        timeSinceLastMessage: request.interaction_context?.time_since_last_message_ms || 0,
        helpRequests: request.interaction_context?.help_requests_in_session || 0,
        errorCorrections: request.interaction_context?.error_corrections_in_session || 0,
      },
      pageContext: request.page_context,
      timestamp: Date.now()
    };

    // Collect interaction timing patterns
    await dataCollector.collectInteractionTiming(
      { 
        responseDelays: [request.response_time_ms || 5000],
        sessionDuration: 0, // Will be calculated from session start
        courseId: courseId,
        engagementEvents: [
          {
            type: 'chat_message',
            timestamp: Date.now()
          }
        ]
      },
      tenantId,
      userId,
      sessionId,
      courseId
    );

    // Collect content interaction patterns if available
    if (request.page_context.page_content) {
      await dataCollector.collectContentInteractionData(
        {
          contentId: request.page_context.current_element || 'chat-context',
          interactionType: 'chat_question',
          duration: 0, // Duration of content interaction before question
          successful: true, // Assume question asking is positive engagement
          completionRate: 1.0,
          struggled: (request.interaction_context?.help_requests_in_session || 0) > 2
        },
        tenantId,
        userId,
        sessionId,
        courseId
      );
    }

  } catch (error) {
    console.error('Failed to collect chat behavioral data:', error);
    // Don't fail the chat request if data collection fails
  }
}

/**
 * Processes standard chat response with optional difficulty adjustment.
 * 
 * @param c - Hono context
 * @param body - Chat request body
 * @param payload - JWT payload
 * @param targetDifficulty - Optional difficulty adjustment (0-1)
 * @returns Promise resolving to chat response data
 */
async function processStandardChatResponse(
  c: Context,
  body: ProactiveChatRequest,
  payload: any,
  targetDifficulty?: number
): Promise<{
  content: string;
  suggestions?: string[];
  token_usage?: { used: number; remaining: number };
}> {
  try {
    const tenantId = payload.tenant_id || payload.sub;
    const userId = payload.sub || payload.user_id;

    // Initialize AI services
    const aiService = new AIService(c.env.AI);
    const promptBuilder = new PromptBuilder();

    // Get or create conversation from Durable Object
    const doId = c.env.CHAT_CONVERSATIONS.idFromName(body.conversation_id || `conv-${Date.now()}`);
    const chatDO = c.env.CHAT_CONVERSATIONS.get(doId);

    // Get conversation history
    const historyResponse = await chatDO.fetch(new Request('https://do/get-history'));
    const conversationHistory = (await historyResponse.json()) as Array<{ role: string; content: string }>;

    // Build enhanced prompt with difficulty adjustment
    const promptContext = {
      courseName: 'Current Course', // Would be enriched from context
      currentQuestion: body.message,
      conversationHistory: conversationHistory.slice(-10),
      difficultyLevel: targetDifficulty || 0.5,
      adaptiveInstructions: targetDifficulty ? 
        `Adjust response complexity to level ${targetDifficulty.toFixed(1)} (0=simple, 1=complex)` : 
        undefined
    };

    // Build adaptive prompt
    const templateId = promptBuilder.selectTemplateForContext(promptContext);
    const { systemPrompt, userPrompt } = promptBuilder.buildPrompt(promptContext, templateId);

    // Add difficulty adjustment to system prompt if specified
    const adaptedSystemPrompt = targetDifficulty ? 
      `${systemPrompt}\n\nIMPORTANT: Adjust your response complexity to level ${targetDifficulty.toFixed(1)} where 0 is very simple/basic and 1 is complex/advanced. Consider the student's current cognitive capacity.` :
      systemPrompt;

    // Generate AI response
    const aiResponse = await aiService.generateResponse(userPrompt, adaptedSystemPrompt, {
      modelName: '@cf/meta/llama-3.1-8b-instruct',
      maxTokens: 2048,
      temperature: 0.7,
    });

    // Store messages in conversation
    await chatDO.fetch(
      new Request('https://do/add-message', {
        method: 'POST',
        body: JSON.stringify({
          role: 'user',
          content: body.message,
          timestamp: new Date().toISOString(),
        }),
      })
    );

    await chatDO.fetch(
      new Request('https://do/add-message', {
        method: 'POST',
        body: JSON.stringify({
          role: 'assistant',
          content: aiResponse.response,
          timestamp: new Date().toISOString(),
        }),
      })
    );

    return {
      content: aiResponse.response,
      suggestions: [], // Would be enhanced with context-aware suggestions
      token_usage: {
        used: aiResponse.tokensUsed || 0,
        remaining: 10000 - (aiResponse.tokensUsed || 0) // Simplified calculation
      }
    };

  } catch (error) {
    console.error('Standard chat processing failed:', error);
    
    // Return fallback response
    return {
      content: "I'm having some technical difficulties right now. Could you please rephrase your question or try again in a moment?",
      suggestions: ['Try rephrasing your question', 'Check your course materials', 'Contact your instructor'],
      token_usage: { used: 0, remaining: 10000 }
    };
  }
}

/**
 * Retrieves proactive recommendations for display in chat interface.
 * 
 * @param c - Hono context
 * @returns Promise resolving to current proactive recommendations
 */
export async function getProactiveRecommendations(c: Context): Promise<Response> {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.substring(7);
    const secret = c.env.JWT_SECRET;
    let payload;
    try {
      payload = await verify(token, secret);
    } catch {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const tenantId = payload.tenant_id || payload.sub;
    const userId = payload.sub || payload.user_id;
    const courseId = c.req.query('course_id');

    if (!courseId) {
      return c.json({ error: 'Course ID required' }, 400);
    }

    // Initialize services
    const db = new DatabaseService(c.env.DB);
    const privacyService = new PrivacyControlService(db);
    const dataCollector = new CognitiveDataCollector(db, privacyService);
    const patternRecognizer = new AdvancedPatternRecognizer(db, dataCollector, privacyService);
    const interventionEngine = new PredictiveInterventionEngine(db, patternRecognizer, privacyService);

    // Generate current recommendations
    const recommendations = await interventionEngine.generateProactiveRecommendations(
      tenantId,
      userId,
      courseId
    );

    return c.json({
      recommendations: recommendations.map(rec => ({
        id: rec.id,
        type: rec.type,
        priority: rec.priority,
        title: rec.title,
        message: rec.message,
        actionable: rec.actionable,
        actionText: rec.actionText,
        dismissible: rec.dismissible,
        validUntil: rec.validUntil,
        confidence: rec.confidence
      })),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to get proactive recommendations:', error);
    return c.json({ error: 'Failed to get recommendations' }, 500);
  }
}

/**
 * Records user response to proactive recommendations.
 * 
 * @param c - Hono context
 * @returns Promise resolving to response tracking confirmation
 */
export async function recordRecommendationResponse(c: Context): Promise<Response> {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.substring(7);
    const secret = c.env.JWT_SECRET;
    let payload;
    try {
      payload = await verify(token, secret);
    } catch {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const body = await c.req.json();
    const { recommendation_id, response, response_timestamp } = body;

    if (!recommendation_id || !response) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const tenantId = payload.tenant_id || payload.sub;
    const userId = payload.sub || payload.user_id;

    // Update intervention record with user response
    const db = new DatabaseService(c.env.DB);
    await db.getDb().prepare(`
      UPDATE learning_interventions 
      SET student_response = ?, response_timestamp = ?, updated_at = ?
      WHERE id = ? AND tenant_id = ? AND user_id = ?
    `).bind(
      response,
      response_timestamp || new Date().toISOString(),
      new Date().toISOString(),
      recommendation_id,
      tenantId,
      userId
    ).run();

    return c.json({ success: true, message: 'Response recorded' });

  } catch (error) {
    console.error('Failed to record recommendation response:', error);
    return c.json({ error: 'Failed to record response' }, 500);
  }
}

/**
 * Gets current behavioral insights for chat interface display.
 * 
 * @param c - Hono context  
 * @returns Promise resolving to real-time behavioral insights
 */
export async function getBehavioralInsights(c: Context): Promise<Response> {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.substring(7);
    const secret = c.env.JWT_SECRET;
    let payload;
    try {
      payload = await verify(token, secret);
    } catch {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const tenantId = payload.tenant_id || payload.sub;
    const userId = payload.sub || payload.user_id;
    const courseId = c.req.query('course_id');

    if (!courseId) {
      return c.json({ error: 'Course ID required' }, 400);
    }

    // Initialize services
    const db = new DatabaseService(c.env.DB);
    const privacyService = new PrivacyControlService(db);
    const dataCollector = new CognitiveDataCollector(db, privacyService);
    const patternRecognizer = new AdvancedPatternRecognizer(db, dataCollector, privacyService);

    // Get real-time behavioral analysis
    const analysis = await patternRecognizer.analyzeRealTimeBehavioralSignals(
      tenantId,
      userId,
      courseId
    );

    return c.json({
      insights: {
        cognitive_load: analysis.cognitiveLoad,
        attention_level: analysis.attentionLevel,
        engagement_score: analysis.engagementScore,
        fatigue_level: analysis.fatigueLevel,
        optimal_intervention_timing: analysis.optimalInterventionTiming,
        recommendations: analysis.recommendations
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to get behavioral insights:', error);
    return c.json({ 
      insights: {
        cognitive_load: 0.5,
        attention_level: 0.5,
        engagement_score: 0.5,
        fatigue_level: 0.5,
        optimal_intervention_timing: false,
        recommendations: ['Insights temporarily unavailable']
      },
      timestamp: new Date().toISOString()
    }, 200);
  }
}