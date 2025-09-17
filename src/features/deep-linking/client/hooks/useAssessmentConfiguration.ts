/**
 * @fileoverview Assessment Configuration Hook
 * Manages assessment configuration state for deep linking interface
 * @module features/deep-linking/client/hooks/useAssessmentConfiguration
 */

import { useState, useEffect, useCallback, useReducer } from 'react';
import { z } from 'zod';

/**
 * Assessment placement schema
 */
const AssessmentPlacementSchema = z.object({
  id: z.string(),
  contentSelector: z.string(),
  position: z.enum(['before', 'after', 'inline']),
  coordinates: z.object({
    x: z.number(),
    y: z.number(),
  }),
  assessmentType: z.enum(['comprehension', 'application', 'analysis', 'reflection', 'knowledge_check']),
  title: z.string(),
  description: z.string().optional(),
  estimatedTime: z.number().min(1).max(60), // minutes
  order: z.number().min(0),
});

/**
 * Assessment configuration settings schema
 */
const AssessmentSettingsSchema = z.object({
  assessmentType: z.enum(['comprehension', 'application', 'analysis', 'reflection', 'knowledge_check']).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  masteryThreshold: z.number().min(0.5).max(1.0).default(0.75),
  allowRetries: z.boolean().default(true),
  maxAttempts: z.number().min(1).max(10).default(3),
  timeLimit: z.number().min(0).optional(), // minutes, 0 = no limit
  showFeedback: z.boolean().default(true),
  shuffleQuestions: z.boolean().default(false),
  showHints: z.boolean().default(true),
  passbackGrades: z.boolean().default(true),
});

/**
 * Generated question schema
 */
const GeneratedQuestionSchema = z.object({
  id: z.string(),
  placementId: z.string(),
  type: z.enum(['multiple_choice', 'short_answer', 'essay', 'true_false', 'fill_blank']),
  question: z.string(),
  options: z.array(z.string()).optional(),
  correctAnswer: z.union([z.string(), z.array(z.string())]),
  explanation: z.string(),
  difficulty: z.number().min(1).max(5),
  bloomsLevel: z.enum(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']),
  estimatedTime: z.number().min(0.5).max(30), // minutes
  points: z.number().min(1).max(100).default(10),
  tags: z.array(z.string()).default([]),
  source: z.enum(['ai_generated', 'instructor_created', 'template']),
  reviewStatus: z.enum(['pending', 'approved', 'rejected', 'modified']),
  aiConfidence: z.number().min(0).max(1),
  pedagogicalScore: z.number().min(0).max(1),
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.string(),
  modifiedAt: z.string().optional(),
});

/**
 * Assessment configuration schema
 */
const AssessmentConfigurationSchema = z.object({
  id: z.string().optional(),
  sessionId: z.string(),
  instructorId: z.string(),
  courseId: z.string(),
  assignmentId: z.string().optional(),
  title: z.string().default('AI-Powered Assessment'),
  description: z.string().optional(),
  settings: AssessmentSettingsSchema,
  placements: z.array(AssessmentPlacementSchema).default([]),
  totalQuestions: z.number().min(0).default(0),
  estimatedDuration: z.number().min(0).default(0), // minutes
  status: z.enum(['draft', 'configuring', 'generating', 'reviewing', 'completed']).default('draft'),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

// Type exports
export type AssessmentPlacement = z.infer<typeof AssessmentPlacementSchema>;
export type AssessmentSettings = z.infer<typeof AssessmentSettingsSchema>;
export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>;
export type AssessmentConfiguration = z.infer<typeof AssessmentConfigurationSchema>;
export type AssessmentType = AssessmentPlacement['assessmentType'];
export type DifficultyLevel = AssessmentSettings['difficulty'];
export type QuestionType = GeneratedQuestion['type'];
export type BloomsLevel = GeneratedQuestion['bloomsLevel'];
export type ReviewStatus = GeneratedQuestion['reviewStatus'];

/**
 * Configuration action types
 */
type ConfigurationAction =
  | { type: 'SET_CONFIGURATION'; payload: AssessmentConfiguration }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<AssessmentSettings> }
  | { type: 'ADD_PLACEMENT'; payload: AssessmentPlacement }
  | { type: 'UPDATE_PLACEMENT'; payload: { id: string; updates: Partial<AssessmentPlacement> } }
  | { type: 'REMOVE_PLACEMENT'; payload: string }
  | { type: 'REORDER_PLACEMENTS'; payload: { from: number; to: number } }
  | { type: 'SET_QUESTIONS'; payload: GeneratedQuestion[] }
  | { type: 'UPDATE_QUESTION'; payload: { id: string; updates: Partial<GeneratedQuestion> } }
  | { type: 'REMOVE_QUESTION'; payload: string }
  | { type: 'SET_STATUS'; payload: AssessmentConfiguration['status'] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

/**
 * Hook state interface
 */
interface UseAssessmentConfigurationState {
  configuration: AssessmentConfiguration;
  questions: GeneratedQuestion[];
  isLoading: boolean;
  isGenerating: boolean;
  isSaving: boolean;
  error: string | null;
  hasUnsavedChanges: boolean;
  lastSaved: Date | null;
}

/**
 * Hook return interface
 */
interface UseAssessmentConfigurationReturn extends UseAssessmentConfigurationState {
  // Configuration actions
  updateConfiguration: (updates: Partial<AssessmentConfiguration>) => void;
  updateSettings: (settings: Partial<AssessmentSettings>) => void;

  // Placement actions
  addPlacement: (placement: Omit<AssessmentPlacement, 'id' | 'order'>) => void;
  updatePlacement: (id: string, updates: Partial<AssessmentPlacement>) => void;
  removePlacement: (id: string) => void;
  reorderPlacements: (from: number, to: number) => void;

  // Question actions
  generateQuestions: (placements: AssessmentPlacement[], config: AssessmentConfiguration) => Promise<void>;
  approveQuestion: (questionId: string) => void;
  rejectQuestion: (questionId: string) => void;
  editQuestion: (questionId: string, updates: Partial<GeneratedQuestion>) => void;

  // Data actions
  saveConfiguration: () => Promise<void>;
  submitConfiguration: (params: { sessionId: string; csrfToken: string; returnUrl: string }) => Promise<{ success: boolean; redirectUrl?: string; error?: string }>;
  loadConfiguration: (configId: string) => Promise<void>;
  resetConfiguration: () => void;

  // Utility
  validateConfiguration: () => { isValid: boolean; errors: string[] };
  clearError: () => void;
}

/**
 * Configuration reducer
 */
function configurationReducer(
  state: UseAssessmentConfigurationState,
  action: ConfigurationAction
): UseAssessmentConfigurationState {
  switch (action.type) {
    case 'SET_CONFIGURATION':
      return {
        ...state,
        configuration: action.payload,
        hasUnsavedChanges: false,
      };

    case 'UPDATE_SETTINGS':
      return {
        ...state,
        configuration: {
          ...state.configuration,
          settings: {
            ...state.configuration.settings,
            ...action.payload,
          },
          updatedAt: new Date().toISOString(),
        },
        hasUnsavedChanges: true,
      };

    case 'ADD_PLACEMENT': {
      const newPlacement = {
        ...action.payload,
        id: `placement-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        order: state.configuration.placements.length,
      };

      return {
        ...state,
        configuration: {
          ...state.configuration,
          placements: [...state.configuration.placements, newPlacement],
          updatedAt: new Date().toISOString(),
        },
        hasUnsavedChanges: true,
      };
    }

    case 'UPDATE_PLACEMENT': {
      const updatedPlacements = state.configuration.placements.map(placement =>
        placement.id === action.payload.id
          ? { ...placement, ...action.payload.updates }
          : placement
      );

      return {
        ...state,
        configuration: {
          ...state.configuration,
          placements: updatedPlacements,
          updatedAt: new Date().toISOString(),
        },
        hasUnsavedChanges: true,
      };
    }

    case 'REMOVE_PLACEMENT': {
      const updatedPlacements = state.configuration.placements
        .filter(placement => placement.id !== action.payload)
        .map((placement, index) => ({ ...placement, order: index }));

      // Also remove questions for this placement
      const updatedQuestions = state.questions.filter(
        question => question.placementId !== action.payload
      );

      return {
        ...state,
        configuration: {
          ...state.configuration,
          placements: updatedPlacements,
          updatedAt: new Date().toISOString(),
        },
        questions: updatedQuestions,
        hasUnsavedChanges: true,
      };
    }

    case 'REORDER_PLACEMENTS': {
      const placements = [...state.configuration.placements];
      const [removed] = placements.splice(action.payload.from, 1);
      placements.splice(action.payload.to, 0, removed);

      // Update order indices
      const reorderedPlacements = placements.map((placement, index) => ({
        ...placement,
        order: index,
      }));

      return {
        ...state,
        configuration: {
          ...state.configuration,
          placements: reorderedPlacements,
          updatedAt: new Date().toISOString(),
        },
        hasUnsavedChanges: true,
      };
    }

    case 'SET_QUESTIONS':
      return {
        ...state,
        questions: action.payload,
        configuration: {
          ...state.configuration,
          totalQuestions: action.payload.length,
          updatedAt: new Date().toISOString(),
        },
        hasUnsavedChanges: true,
      };

    case 'UPDATE_QUESTION': {
      const updatedQuestions = state.questions.map(question =>
        question.id === action.payload.id
          ? {
              ...question,
              ...action.payload.updates,
              modifiedAt: new Date().toISOString(),
              reviewStatus: 'modified' as const,
            }
          : question
      );

      return {
        ...state,
        questions: updatedQuestions,
        hasUnsavedChanges: true,
      };
    }

    case 'REMOVE_QUESTION': {
      const updatedQuestions = state.questions.filter(question => question.id !== action.payload);

      return {
        ...state,
        questions: updatedQuestions,
        configuration: {
          ...state.configuration,
          totalQuestions: updatedQuestions.length,
          updatedAt: new Date().toISOString(),
        },
        hasUnsavedChanges: true,
      };
    }

    case 'SET_STATUS':
      return {
        ...state,
        configuration: {
          ...state.configuration,
          status: action.payload,
          updatedAt: new Date().toISOString(),
        },
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };

    default:
      return state;
  }
}

/**
 * Assessment Configuration Hook
 *
 * Manages the complete assessment configuration state for deep linking interface.
 * Handles placements, settings, AI question generation, and Canvas submission.
 *
 * @param sessionId - Deep linking session ID
 * @param csrfToken - CSRF token for secure operations
 * @returns Assessment configuration state and actions
 */
export function useAssessmentConfiguration(
  sessionId: string,
  csrfToken: string
): UseAssessmentConfigurationReturn {
  // Initialize state with default configuration
  const [state, dispatch] = useReducer(configurationReducer, {
    configuration: {
      sessionId,
      instructorId: '',
      courseId: '',
      settings: {
        masteryThreshold: 0.75,
        allowRetries: true,
        maxAttempts: 3,
        showFeedback: true,
        shuffleQuestions: false,
        showHints: true,
        passbackGrades: true,
      },
      placements: [],
      totalQuestions: 0,
      estimatedDuration: 0,
      status: 'draft',
    },
    questions: [],
    isLoading: false,
    isGenerating: false,
    isSaving: false,
    error: null,
    hasUnsavedChanges: false,
    lastSaved: null,
  });

  // Configuration actions
  const updateConfiguration = useCallback((updates: Partial<AssessmentConfiguration>): void => {
    dispatch({ type: 'SET_CONFIGURATION', payload: { ...state.configuration, ...updates } });
  }, [state.configuration]);

  const updateSettings = useCallback((settings: Partial<AssessmentSettings>): void => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: settings });
  }, []);

  // Placement actions
  const addPlacement = useCallback((placement: Omit<AssessmentPlacement, 'id' | 'order'>): void => {
    dispatch({ type: 'ADD_PLACEMENT', payload: placement as AssessmentPlacement });
  }, []);

  const updatePlacement = useCallback((id: string, updates: Partial<AssessmentPlacement>): void => {
    dispatch({ type: 'UPDATE_PLACEMENT', payload: { id, updates } });
  }, []);

  const removePlacement = useCallback((id: string): void => {
    dispatch({ type: 'REMOVE_PLACEMENT', payload: id });
  }, []);

  const reorderPlacements = useCallback((from: number, to: number): void => {
    dispatch({ type: 'REORDER_PLACEMENTS', payload: { from, to } });
  }, []);

  // Question generation
  const generateQuestions = useCallback(async (
    placements: AssessmentPlacement[],
    config: AssessmentConfiguration
  ): Promise<void> => {
    if (placements.length === 0) {
      dispatch({ type: 'SET_ERROR', payload: 'No placements defined for question generation' });
      return;
    }

    try {
      dispatch({ type: 'SET_ERROR', payload: null });
      dispatch({ type: 'SET_LOADING', payload: true });
      state.isGenerating = true;

      const response = await fetch('/api/deep-linking/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({
          sessionId,
          placements,
          configuration: config,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Question generation failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Question generation failed');
      }

      // Validate and set questions
      const validatedQuestions = data.questions.map((q: unknown) =>
        GeneratedQuestionSchema.parse(q)
      );

      dispatch({ type: 'SET_QUESTIONS', payload: validatedQuestions });
      dispatch({ type: 'SET_STATUS', payload: 'reviewing' });

    } catch (error) {
      console.error('Question generation error:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Question generation failed'
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
      state.isGenerating = false;
    }
  }, [sessionId, csrfToken]);

  // Question actions
  const approveQuestion = useCallback((questionId: string): void => {
    dispatch({
      type: 'UPDATE_QUESTION',
      payload: { id: questionId, updates: { reviewStatus: 'approved' } }
    });
  }, []);

  const rejectQuestion = useCallback((questionId: string): void => {
    dispatch({
      type: 'UPDATE_QUESTION',
      payload: { id: questionId, updates: { reviewStatus: 'rejected' } }
    });
  }, []);

  const editQuestion = useCallback((questionId: string, updates: Partial<GeneratedQuestion>): void => {
    dispatch({ type: 'UPDATE_QUESTION', payload: { id: questionId, updates } });
  }, []);

  // Save configuration
  const saveConfiguration = useCallback(async (): Promise<void> => {
    try {
      dispatch({ type: 'SET_ERROR', payload: null });
      state.isSaving = true;

      const response = await fetch('/api/deep-linking/save-configuration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({
          sessionId,
          configuration: state.configuration,
          questions: state.questions,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Save failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to save configuration');
      }

      // Update with server response
      dispatch({
        type: 'SET_CONFIGURATION',
        payload: { ...state.configuration, id: data.configurationId }
      });

      state.lastSaved = new Date();
      state.hasUnsavedChanges = false;

    } catch (error) {
      console.error('Save configuration error:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to save configuration'
      });
    } finally {
      state.isSaving = false;
    }
  }, [sessionId, csrfToken, state.configuration, state.questions]);

  // Submit configuration to Canvas
  const submitConfiguration = useCallback(async (params: {
    sessionId: string;
    csrfToken: string;
    returnUrl: string;
  }): Promise<{ success: boolean; redirectUrl?: string; error?: string }> => {
    try {
      dispatch({ type: 'SET_ERROR', payload: null });
      state.isSaving = true;

      // Validate before submission
      const validation = validateConfiguration();
      if (!validation.isValid) {
        return {
          success: false,
          error: `Configuration validation failed: ${validation.errors.join(', ')}`,
        };
      }

      const response = await fetch('/api/deep-linking/submit-configuration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': params.csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({
          sessionId: params.sessionId,
          configuration: state.configuration,
          questions: state.questions,
          returnUrl: params.returnUrl,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Submission failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();

      if (!data.success) {
        return {
          success: false,
          error: data.error || 'Failed to submit configuration',
        };
      }

      dispatch({ type: 'SET_STATUS', payload: 'completed' });
      state.hasUnsavedChanges = false;

      return {
        success: true,
        redirectUrl: data.redirectUrl,
      };

    } catch (error) {
      console.error('Submit configuration error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Submission failed';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });

      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      state.isSaving = false;
    }
  }, [state.configuration, state.questions]);

  // Load existing configuration
  const loadConfiguration = useCallback(async (configId: string): Promise<void> => {
    try {
      dispatch({ type: 'SET_ERROR', payload: null });
      dispatch({ type: 'SET_LOADING', payload: true });

      const response = await fetch(`/api/deep-linking/configuration/${configId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Load failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load configuration');
      }

      // Validate and set configuration
      const validatedConfig = AssessmentConfigurationSchema.parse(data.configuration);
      const validatedQuestions = data.questions?.map((q: unknown) =>
        GeneratedQuestionSchema.parse(q)
      ) || [];

      dispatch({ type: 'SET_CONFIGURATION', payload: validatedConfig });
      dispatch({ type: 'SET_QUESTIONS', payload: validatedQuestions });

    } catch (error) {
      console.error('Load configuration error:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to load configuration'
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  // Reset configuration
  const resetConfiguration = useCallback((): void => {
    dispatch({
      type: 'SET_CONFIGURATION',
      payload: {
        sessionId,
        instructorId: '',
        courseId: '',
        settings: {
          masteryThreshold: 0.75,
          allowRetries: true,
          maxAttempts: 3,
          showFeedback: true,
          shuffleQuestions: false,
          showHints: true,
          passbackGrades: true,
        },
        placements: [],
        totalQuestions: 0,
        estimatedDuration: 0,
        status: 'draft',
      }
    });
    dispatch({ type: 'SET_QUESTIONS', payload: [] });
    dispatch({ type: 'SET_ERROR', payload: null });
  }, [sessionId]);

  // Validate configuration
  const validateConfiguration = useCallback((): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Validate placements
    if (state.configuration.placements.length === 0) {
      errors.push('At least one assessment placement is required');
    }

    // Validate settings
    if (!state.configuration.settings.assessmentType) {
      errors.push('Assessment type must be selected');
    }

    if (!state.configuration.settings.difficulty) {
      errors.push('Difficulty level must be selected');
    }

    if (state.configuration.settings.masteryThreshold < 0.5 || state.configuration.settings.masteryThreshold > 1.0) {
      errors.push('Mastery threshold must be between 50% and 100%');
    }

    // Validate questions if in review stage
    if (state.configuration.status === 'reviewing') {
      if (state.questions.length === 0) {
        errors.push('At least one question must be generated');
      }

      const pendingQuestions = state.questions.filter(q => q.reviewStatus === 'pending');
      if (pendingQuestions.length > 0) {
        errors.push('All questions must be reviewed before deployment');
      }

      const rejectedQuestions = state.questions.filter(q => q.reviewStatus === 'rejected');
      if (rejectedQuestions.length === state.questions.length) {
        errors.push('At least one question must be approved');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }, [state.configuration, state.questions]);

  // Clear error
  const clearError = useCallback((): void => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, []);

  // Auto-save functionality
  useEffect(() => {
    if (state.hasUnsavedChanges && !state.isLoading && !state.isSaving) {
      const timeoutId = setTimeout(() => {
        saveConfiguration();
      }, 5000); // Auto-save after 5 seconds of no changes

      return () => clearTimeout(timeoutId);
    }
  }, [state.hasUnsavedChanges, state.isLoading, state.isSaving, saveConfiguration]);

  return {
    configuration: state.configuration,
    placements: state.configuration.placements,
    questions: state.questions,
    isLoading: state.isLoading,
    isGenerating: state.isGenerating,
    isSaving: state.isSaving,
    error: state.error,
    hasUnsavedChanges: state.hasUnsavedChanges,
    lastSaved: state.lastSaved,
    updateConfiguration,
    updateSettings,
    addPlacement,
    updatePlacement,
    removePlacement,
    reorderPlacements,
    generateQuestions,
    approveQuestion,
    rejectQuestion,
    editQuestion,
    saveConfiguration,
    submitConfiguration,
    loadConfiguration,
    resetConfiguration,
    validateConfiguration,
    clearError,
  };
}