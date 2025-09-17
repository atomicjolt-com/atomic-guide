/**
 * @fileoverview Assessment Wrapper Component
 * @module features/ai-assessment/client/components/AssessmentWrapper
 *
 * Wrapper component that handles assessment session creation and management
 * for the conversational assessment interface.
 *
 * Features:
 * - Session creation with default configuration
 * - Session state management and error handling
 * - Integration with LTI launch settings
 * - Completion and error callbacks
 */

import React, { useState, useEffect, useCallback, ReactElement } from 'react';
import { z } from 'zod';
import type { LaunchSettings } from '@atomicjolt/lti-client';

import { ConversationalAssessmentInterface } from './ConversationalAssessmentInterface';
import {
  AssessmentSession,
  AssessmentSessionId,
  AssessmentSessionConfig
} from '../../shared/types';

/**
 * Component props interface
 */
interface AssessmentWrapperProps {
  launchSettings: LaunchSettings;
  className?: string;
}

/**
 * Session creation form props
 */
interface SessionCreationFormProps {
  onCreateSession: (config: Partial<AssessmentSessionConfig>) => void;
  isLoading: boolean;
  error?: string;
}

/**
 * Session creation form component
 */
const SessionCreationForm: React.FC<SessionCreationFormProps> = ({
  onCreateSession,
  isLoading,
  error
}): ReactElement => {
  const [assessmentTitle, setAssessmentTitle] = useState('AI Assessment');
  const [masteryThreshold, setMasteryThreshold] = useState(0.8);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [allowHints, setAllowHints] = useState(true);
  const [showFeedback, setShowFeedback] = useState(true);

  const handleSubmit = useCallback((e: React.FormEvent): void => {
    e.preventDefault();

    onCreateSession({
      assessmentTitle,
      settings: {
        masteryThreshold,
        maxAttempts,
        timeLimit: 0, // No time limit
        allowHints,
        showFeedback,
        adaptiveDifficulty: true,
        requireMastery: false
      },
      context: {
        learningObjectives: ['Understanding'],
        concepts: ['General Knowledge'],
        prerequisites: []
      },
      grading: {
        passbackEnabled: false,
        pointsPossible: 100,
        gradingRubric: {
          masteryWeight: 0.7,
          participationWeight: 0.2,
          improvementWeight: 0.1
        }
      }
    });
  }, [assessmentTitle, masteryThreshold, maxAttempts, allowHints, showFeedback, onCreateSession]);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Start AI Assessment</h2>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-red-700">
              <strong>Error:</strong> {error}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Assessment Title
            </label>
            <input
              id="title"
              type="text"
              value={assessmentTitle}
              onChange={(e) => setAssessmentTitle(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter assessment title"
              required
            />
          </div>

          <div>
            <label htmlFor="mastery" className="block text-sm font-medium text-gray-700 mb-2">
              Mastery Threshold: {Math.round(masteryThreshold * 100)}%
            </label>
            <input
              id="mastery"
              type="range"
              min="0.5"
              max="1"
              step="0.05"
              value={masteryThreshold}
              onChange={(e) => setMasteryThreshold(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          <div>
            <label htmlFor="attempts" className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Attempts
            </label>
            <select
              id="attempts"
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(parseInt(e.target.value))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={1}>1 attempt</option>
              <option value={2}>2 attempts</option>
              <option value={3}>3 attempts</option>
              <option value={5}>5 attempts</option>
              <option value={10}>10 attempts</option>
            </select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center">
              <input
                id="hints"
                type="checkbox"
                checked={allowHints}
                onChange={(e) => setAllowHints(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="hints" className="ml-2 block text-sm text-gray-700">
                Allow hints and suggestions
              </label>
            </div>

            <div className="flex items-center">
              <input
                id="feedback"
                type="checkbox"
                checked={showFeedback}
                onChange={(e) => setShowFeedback(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="feedback" className="ml-2 block text-sm text-gray-700">
                Show immediate feedback
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Creating Assessment...
              </span>
            ) : (
              'Start Assessment'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

/**
 * Assessment completion screen
 */
const AssessmentCompletionScreen: React.FC<{
  session: AssessmentSession;
  onRestart: () => void;
}> = ({ session, onRestart }): ReactElement => {
  const progress = session.progress;
  const masteryRate = progress.conceptsMastered.length /
    (progress.conceptsMastered.length + progress.conceptsNeedWork.length || 1);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-6 text-center">
        <div className="text-6xl mb-4">
          {session.status === 'mastery_achieved' ? '🎉' : '✅'}
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Assessment Complete
        </h2>

        <div className="mb-6">
          <div className="text-lg mb-2">
            Status: <span className="font-semibold capitalize">
              {session.status.replace('_', ' ')}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {progress.conceptsMastered.length}
              </div>
              <div className="text-sm text-green-700">Concepts Mastered</div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {Math.round(masteryRate * 100)}%
              </div>
              <div className="text-sm text-blue-700">Mastery Rate</div>
            </div>
          </div>
        </div>

        <button
          onClick={onRestart}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Start New Assessment
        </button>
      </div>
    </div>
  );
};

/**
 * Main Assessment Wrapper Component
 */
export const AssessmentWrapper: React.FC<AssessmentWrapperProps> = ({
  launchSettings,
  className = ''
}): ReactElement => {
  const [currentSessionId, setCurrentSessionId] = useState<AssessmentSessionId | null>(null);
  const [completedSession, setCompletedSession] = useState<AssessmentSession | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create assessment session
  const handleCreateSession = useCallback(async (
    config: Partial<AssessmentSessionConfig>
  ): Promise<void> => {
    try {
      setIsCreatingSession(true);
      setError(null);

      // Get user and course info from LTI launch settings
      const jwt = launchSettings.jwt;
      const decodedJwt = JSON.parse(atob(jwt.split('.')[1]));

      const sessionConfig = {
        configId: crypto.randomUUID(),
        studentId: decodedJwt.sub || 'student-' + Date.now(),
        courseId: decodedJwt['https://purl.imsglobal.org/spec/lti/claim/context']?.id || 'course-default',
        ...config
      };

      const response = await fetch('/api/ai-assessment/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`
        },
        credentials: 'include',
        body: JSON.stringify(sessionConfig)
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to create session');
      }

      setCurrentSessionId(data.sessionId);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create assessment session';
      setError(errorMessage);
      console.error('Session creation error:', err);
    } finally {
      setIsCreatingSession(false);
    }
  }, [launchSettings]);

  // Handle assessment completion
  const handleAssessmentComplete = useCallback((session: AssessmentSession): void => {
    setCompletedSession(session);
    setCurrentSessionId(null);
  }, []);

  // Handle assessment error
  const handleAssessmentError = useCallback((error: Error): void => {
    setError(error.message);
    console.error('Assessment error:', error);
  }, []);

  // Restart assessment
  const handleRestart = useCallback((): void => {
    setCurrentSessionId(null);
    setCompletedSession(null);
    setError(null);
  }, []);

  // Render current view
  if (completedSession) {
    return (
      <div className={className}>
        <AssessmentCompletionScreen
          session={completedSession}
          onRestart={handleRestart}
        />
      </div>
    );
  }

  if (currentSessionId) {
    return (
      <div className={className}>
        <ConversationalAssessmentInterface
          sessionId={currentSessionId}
          onComplete={handleAssessmentComplete}
          onError={handleAssessmentError}
          autoFocus={true}
          enableVoiceInput={false}
          enableFileUpload={false}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <SessionCreationForm
        onCreateSession={handleCreateSession}
        isLoading={isCreatingSession}
        error={error}
      />
    </div>
  );
};

export default AssessmentWrapper;