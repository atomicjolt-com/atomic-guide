/**
 * @fileoverview Canvas Assignment Context Hook
 * Provides Canvas content extraction and analysis for deep linking configuration
 * @module features/deep-linking/client/hooks/useCanvasAssignmentContext
 */

import { useState, useEffect, useCallback } from 'react';
import { z } from 'zod';

/**
 * Canvas assignment context schema
 */
const CanvasAssignmentSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  courseName: z.string(),
  courseCode: z.string(),
  pointsPossible: z.number().optional(),
  dueAt: z.string().optional(),
  htmlUrl: z.string(),
  submissionTypes: z.array(z.string()),
  workflowState: z.string(),
  position: z.number().optional(),
  groupCategoryId: z.string().optional(),
  peerReviews: z.boolean().optional(),
  automaticPeerReviews: z.boolean().optional(),
  gradeGroupStudentsIndividually: z.boolean().optional(),
  gradingType: z.string().optional(),
  gradingStandardId: z.string().optional(),
  published: z.boolean(),
  unpublishable: z.boolean(),
  onlyVisibleToOverrides: z.boolean(),
  lockedForUser: z.boolean(),
  lockInfo: z.object({
    assetString: z.string(),
    canView: z.boolean(),
    contextModule: z.string().optional(),
  }).optional(),
  lockExplanation: z.string().optional(),
  discussionTopic: z.any().optional(),
  needsGradingCount: z.number().optional(),
  submissionsDownloadUrl: z.string().optional(),
  courseLevel: z.string().optional(),
  subject: z.string().optional(),
  learningObjectives: z.array(z.string()).optional(),
});

/**
 * Content structure schema for parsed Canvas content
 */
const ContentStructureSchema = z.object({
  id: z.string(),
  contentType: z.enum(['assignment', 'page', 'discussion', 'quiz']),
  title: z.string(),
  sections: z.array(z.object({
    id: z.string(),
    type: z.enum(['text', 'heading', 'image', 'video', 'link', 'list', 'code', 'quote']),
    title: z.string().optional(),
    text: z.string().optional(),
    level: z.number().optional(), // for headings
    src: z.string().optional(), // for images/videos
    href: z.string().optional(), // for links
    items: z.array(z.string()).optional(), // for lists
    position: z.object({
      start: z.number(),
      end: z.number(),
    }),
    metadata: z.record(z.string(), z.any()).optional(),
  })),
  metadata: z.object({
    wordCount: z.number(),
    readingLevel: z.string().optional(),
    estimatedReadingTime: z.number(), // in minutes
    topics: z.array(z.string()).optional(),
    learningObjectives: z.array(z.string()).optional(),
    complexity: z.enum(['basic', 'intermediate', 'advanced']).optional(),
  }),
  lastAnalyzed: z.string(),
});

/**
 * Content analysis result schema
 */
const ContentAnalysisSchema = z.object({
  structure: ContentStructureSchema,
  recommendations: z.array(z.object({
    id: z.string(),
    type: z.enum(['placement', 'assessment_type', 'difficulty', 'content_gap']),
    title: z.string(),
    description: z.string(),
    confidence: z.number().min(0).max(1),
    sectionId: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  })),
  aiInsights: z.object({
    keyTopics: z.array(z.string()),
    suggestedAssessmentTypes: z.array(z.string()),
    cognitiveLoad: z.enum(['low', 'medium', 'high']),
    learningObjectiveAlignment: z.array(z.object({
      objective: z.string(),
      confidence: z.number().min(0).max(1),
      relevantSections: z.array(z.string()),
    })),
  }),
});

// Type exports
export type CanvasAssignment = z.infer<typeof CanvasAssignmentSchema>;
export type ContentStructure = z.infer<typeof ContentStructureSchema>;
export type ContentAnalysis = z.infer<typeof ContentAnalysisSchema>;

/**
 * Hook state interface
 */
interface UseCanvasAssignmentContextState {
  canvasAssignment: CanvasAssignment | null;
  contentStructure: ContentStructure | null;
  contentAnalysis: ContentAnalysis | null;
  isLoading: boolean;
  isAnalyzing: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

/**
 * Hook return interface
 */
interface UseCanvasAssignmentContextReturn extends UseCanvasAssignmentContextState {
  refreshContext: () => Promise<void>;
  analyzeContent: () => Promise<void>;
  clearError: () => void;
}

/**
 * API response interfaces
 */
interface CanvasContextResponse {
  assignment: CanvasAssignment;
  contentStructure?: ContentStructure;
  contentAnalysis?: ContentAnalysis;
  success: boolean;
  error?: string;
}

/**
 * Content analysis response interface
 */
interface ContentAnalysisResponse {
  analysis: ContentAnalysis;
  success: boolean;
  error?: string;
}

/**
 * Canvas Assignment Context Hook
 *
 * Manages Canvas assignment context loading and content analysis for deep linking configuration.
 * Provides real-time Canvas content extraction, structure analysis, and AI-powered recommendations.
 *
 * @param sessionId - Deep linking session ID for context retrieval
 * @returns Canvas assignment context state and actions
 *
 * @example
 * ```tsx
 * const {
 *   canvasAssignment,
 *   contentStructure,
 *   isLoading,
 *   error,
 *   refreshContext,
 *   analyzeContent
 * } = useCanvasAssignmentContext(sessionId);
 *
 * // Display Canvas assignment information
 * if (canvasAssignment) {
 *   return <div>{canvasAssignment.title}</div>;
 * }
 * ```
 */
export function useCanvasAssignmentContext(sessionId: string): UseCanvasAssignmentContextReturn {
  // State management
  const [state, setState] = useState<UseCanvasAssignmentContextState>({
    canvasAssignment: null,
    contentStructure: null,
    contentAnalysis: null,
    isLoading: false,
    isAnalyzing: false,
    error: null,
    lastUpdated: null,
  });

  /**
   * Fetch Canvas assignment context from server
   */
  const fetchCanvasContext = useCallback(async (): Promise<void> => {
    if (!sessionId) {
      setState(prev => ({
        ...prev,
        error: 'Session ID is required for Canvas context',
      }));
      return;
    }

    try {
      setState(prev => ({
        ...prev,
        isLoading: true,
        error: null,
      }));

      const response = await fetch(`/api/deep-linking/canvas-context/${sessionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch Canvas context: ${response.status} ${errorText}`);
      }

      const data: CanvasContextResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load Canvas context');
      }

      // Validate the assignment data
      const validatedAssignment = CanvasAssignmentSchema.parse(data.assignment);

      // Validate content structure if provided
      let validatedContentStructure: ContentStructure | null = null;
      if (data.contentStructure) {
        validatedContentStructure = ContentStructureSchema.parse(data.contentStructure);
      }

      // Validate content analysis if provided
      let validatedContentAnalysis: ContentAnalysis | null = null;
      if (data.contentAnalysis) {
        validatedContentAnalysis = ContentAnalysisSchema.parse(data.contentAnalysis);
      }

      setState(prev => ({
        ...prev,
        canvasAssignment: validatedAssignment,
        contentStructure: validatedContentStructure,
        contentAnalysis: validatedContentAnalysis,
        isLoading: false,
        lastUpdated: new Date(),
      }));

      // Auto-analyze content if structure exists but analysis doesn't
      if (validatedContentStructure && !validatedContentAnalysis) {
        setTimeout(() => analyzeContent(), 500);
      }

    } catch (error) {
      console.error('Canvas context fetch error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load Canvas context',
      }));
    }
  }, [sessionId]);

  /**
   * Perform AI-powered content analysis
   */
  const analyzeContent = useCallback(async (): Promise<void> => {
    if (!sessionId || !state.contentStructure) {
      setState(prev => ({
        ...prev,
        error: 'Canvas content structure required for analysis',
      }));
      return;
    }

    try {
      setState(prev => ({
        ...prev,
        isAnalyzing: true,
        error: null,
      }));

      const response = await fetch(`/api/deep-linking/analyze-content/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          contentStructure: state.contentStructure,
          analysisType: 'assessment_placement',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Content analysis failed: ${response.status} ${errorText}`);
      }

      const data: ContentAnalysisResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Content analysis failed');
      }

      // Validate the analysis data
      const validatedAnalysis = ContentAnalysisSchema.parse(data.analysis);

      setState(prev => ({
        ...prev,
        contentAnalysis: validatedAnalysis,
        isAnalyzing: false,
        lastUpdated: new Date(),
      }));

    } catch (error) {
      console.error('Content analysis error:', error);
      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        error: error instanceof Error ? error.message : 'Content analysis failed',
      }));
    }
  }, [sessionId, state.contentStructure]);

  /**
   * Refresh Canvas context data
   */
  const refreshContext = useCallback(async (): Promise<void> => {
    await fetchCanvasContext();
  }, [fetchCanvasContext]);

  /**
   * Clear current error state
   */
  const clearError = useCallback((): void => {
    setState(prev => ({
      ...prev,
      error: null,
    }));
  }, []);

  // Initial load effect
  useEffect(() => {
    if (sessionId) {
      fetchCanvasContext();
    }
  }, [sessionId, fetchCanvasContext]);

  // Auto-refresh context every 5 minutes if no error
  useEffect(() => {
    if (!sessionId || state.error) return;

    const interval = setInterval(() => {
      if (!state.isLoading && !state.isAnalyzing) {
        fetchCanvasContext();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [sessionId, state.error, state.isLoading, state.isAnalyzing, fetchCanvasContext]);

  return {
    canvasAssignment: state.canvasAssignment,
    contentStructure: state.contentStructure,
    contentAnalysis: state.contentAnalysis,
    isLoading: state.isLoading,
    isAnalyzing: state.isAnalyzing,
    error: state.error,
    lastUpdated: state.lastUpdated,
    refreshContext,
    analyzeContent,
    clearError,
  };
}

/**
 * Helper function to extract key insights from content analysis
 */
export function extractContentInsights(analysis: ContentAnalysis | null) {
  if (!analysis) {
    return {
      keyTopics: [],
      recommendedPlacements: [],
      suggestedAssessmentTypes: [],
      cognitiveLoad: 'medium' as const,
    };
  }

  return {
    keyTopics: analysis.aiInsights.keyTopics,
    recommendedPlacements: analysis.recommendations.filter(r => r.type === 'placement'),
    suggestedAssessmentTypes: analysis.aiInsights.suggestedAssessmentTypes,
    cognitiveLoad: analysis.aiInsights.cognitiveLoad,
  };
}

/**
 * Helper function to get content sections suitable for assessment placement
 */
export function getPlacementSuitableSections(contentStructure: ContentStructure | null) {
  if (!contentStructure) {
    return [];
  }

  // Filter sections that are suitable for assessment placement
  return contentStructure.sections.filter(section => {
    // Text sections with sufficient content
    if (section.type === 'text' && section.text && section.text.length > 100) {
      return true;
    }

    // Headings that can serve as natural break points
    if (section.type === 'heading' && section.level && section.level <= 3) {
      return true;
    }

    // Videos and images as natural transition points
    if (section.type === 'video' || section.type === 'image') {
      return true;
    }

    return false;
  });
}

/**
 * Helper function to estimate reading time for content sections
 */
export function estimateReadingTime(sections: ContentStructure['sections']): number {
  const wordsPerMinute = 200; // Average reading speed

  const totalWords = sections.reduce((count, section) => {
    if (section.type === 'text' && section.text) {
      // Rough word count estimation
      return count + section.text.split(/\s+/).length;
    }
    if (section.type === 'heading' && section.title) {
      return count + section.title.split(/\s+/).length;
    }
    return count;
  }, 0);

  return Math.ceil(totalWords / wordsPerMinute);
}