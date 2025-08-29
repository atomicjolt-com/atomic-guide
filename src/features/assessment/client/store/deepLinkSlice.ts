/**
 * @fileoverview Redux slice for deep linking configuration state management
 * @module client/store/slices/deepLink
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { AssessmentConfig, AssessmentQuestion } from '../../shared/schemas/assessment.schema';
import { defaultAssessmentConfig } from '../../shared/schemas/assessment.schema';
import type { LMSContentExtraction } from '@features/content/client/services/LMSContentExtractor';

/**
 * Deep linking state interface
 */
interface DeepLinkState {
  /** Current assessment configuration */
  assessmentConfig: AssessmentConfig;
  /** Extracted LMS page content */
  pageContent: LMSContentExtraction | null;
  /** Whether content extraction is in progress */
  isExtracting: boolean;
  /** Whether the form is being submitted */
  isSubmitting: boolean;
  /** Error message if any operation fails */
  error: string | null;
  /** Success message after successful submission */
  successMessage: string | null;
  /** Whether the deep link has been submitted */
  submitted: boolean;
  /** The signed JWT for the deep link */
  signedJWT: string | null;
  /** Platform return URL after submission */
  returnUrl: string | null;
}

/**
 * Initial state for deep linking
 */
const initialState: DeepLinkState = {
  assessmentConfig: defaultAssessmentConfig,
  pageContent: null,
  isExtracting: false,
  isSubmitting: false,
  error: null,
  successMessage: null,
  submitted: false,
  signedJWT: null,
  returnUrl: null,
};

/**
 * Deep linking Redux slice
 */
const deepLinkSlice = createSlice({
  name: 'deepLink',
  initialState,
  reducers: {
    /**
     * Updates the entire assessment configuration
     */
    setAssessmentConfig: (state, action: PayloadAction<AssessmentConfig>) => {
      state.assessmentConfig = action.payload;
      state.error = null;
    },

    /**
     * Updates a specific field in the assessment configuration
     */
    updateAssessmentField: <K extends keyof AssessmentConfig>(
      state: DeepLinkState,
      action: PayloadAction<{ field: K; value: AssessmentConfig[K] }>
    ) => {
      const { field, value } = action.payload;
      state.assessmentConfig = {
        ...state.assessmentConfig,
        [field]: value,
      };
      state.error = null;
    },

    /**
     * Sets the extracted LMS page content
     */
    setPageContent: (state, action: PayloadAction<LMSContentExtraction | null>) => {
      state.pageContent = action.payload;
    },

    /**
     * Updates the list of assessment questions
     */
    setQuestions: (state, action: PayloadAction<AssessmentQuestion[]>) => {
      state.assessmentConfig.questions = action.payload;
    },

    /**
     * Adds a new question to the assessment
     */
    addQuestion: (state, action: PayloadAction<AssessmentQuestion>) => {
      state.assessmentConfig.questions.push(action.payload);
    },

    /**
     * Updates an existing question by ID
     */
    updateQuestion: (state, action: PayloadAction<{ id: string; updates: Partial<AssessmentQuestion> }>) => {
      const { id, updates } = action.payload;
      const index = state.assessmentConfig.questions.findIndex(q => q.id === id);
      if (index !== -1) {
        state.assessmentConfig.questions[index] = {
          ...state.assessmentConfig.questions[index],
          ...updates,
        };
      }
    },

    /**
     * Removes a question by ID
     */
    removeQuestion: (state, action: PayloadAction<string>) => {
      state.assessmentConfig.questions = state.assessmentConfig.questions.filter(
        q => q.id !== action.payload
      );
    },

    /**
     * Sets the extraction loading state
     */
    setIsExtracting: (state, action: PayloadAction<boolean>) => {
      state.isExtracting = action.payload;
      if (action.payload) {
        state.error = null;
      }
    },

    /**
     * Sets the submission loading state
     */
    setIsSubmitting: (state, action: PayloadAction<boolean>) => {
      state.isSubmitting = action.payload;
      if (action.payload) {
        state.error = null;
      }
    },

    /**
     * Sets an error message
     */
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isExtracting = false;
      state.isSubmitting = false;
    },

    /**
     * Sets a success message
     */
    setSuccessMessage: (state, action: PayloadAction<string | null>) => {
      state.successMessage = action.payload;
    },

    /**
     * Marks the deep link as submitted with signed JWT
     */
    setSubmitted: (state, action: PayloadAction<{ signedJWT: string; returnUrl: string }>) => {
      state.submitted = true;
      state.signedJWT = action.payload.signedJWT;
      state.returnUrl = action.payload.returnUrl;
      state.isSubmitting = false;
      state.successMessage = 'Assessment configuration submitted successfully';
    },

    /**
     * Resets the entire deep link state
     */
    resetDeepLinkState: () => initialState,

    /**
     * Clears all messages (errors and success)
     */
    clearMessages: (state) => {
      state.error = null;
      state.successMessage = null;
    },
  },
});

// Export actions
export const {
  setAssessmentConfig,
  updateAssessmentField,
  setPageContent,
  setQuestions,
  addQuestion,
  updateQuestion,
  removeQuestion,
  setIsExtracting,
  setIsSubmitting,
  setError,
  setSuccessMessage,
  setSubmitted,
  resetDeepLinkState,
  clearMessages,
} = deepLinkSlice.actions;

// Export reducer
export default deepLinkSlice.reducer;

// Selector functions
export const selectAssessmentConfig = (state: { deepLink: DeepLinkState }): AssessmentConfig =>
  state.deepLink.assessmentConfig;

export const selectPageContent = (state: { deepLink: DeepLinkState }): LMSContentExtraction | null =>
  state.deepLink.pageContent;

export const selectDeepLinkStatus = (state: { deepLink: DeepLinkState }) => ({
  isExtracting: state.deepLink.isExtracting,
  isSubmitting: state.deepLink.isSubmitting,
  submitted: state.deepLink.submitted,
  error: state.deepLink.error,
  successMessage: state.deepLink.successMessage,
});

export const selectQuestions = (state: { deepLink: DeepLinkState }): AssessmentQuestion[] =>
  state.deepLink.assessmentConfig.questions;