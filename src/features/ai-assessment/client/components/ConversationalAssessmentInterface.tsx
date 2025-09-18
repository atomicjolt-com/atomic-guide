/**
 * @fileoverview Conversational Assessment Interface
 * @module features/ai-assessment/client/components/ConversationalAssessmentInterface
 *
 * React component providing the student-facing chat interface for AI assessments.
 * Supports real-time conversation, progress tracking, and accessibility features.
 *
 * Features:
 * - Chat-style assessment interface with natural conversation flow
 * - Real-time AI response integration with typing indicators
 * - Progress tracking visualization with mastery indicators
 * - Multi-modal content support for text, images, and multimedia
 * - Assessment completion and summary interface
 * - Mobile-responsive design with accessibility compliance
 */

import React, { useState, useEffect, useRef, useCallback, ReactElement } from 'react';
import { z } from 'zod';

// Import types from shared
import {
  AssessmentSession,
  AssessmentSessionId,
  AssessmentMessage,
  MessageType,
  AssessmentSessionStatus
} from '../../shared/types';

/**
 * Component props interface
 */
interface ConversationalAssessmentInterfaceProps {
  sessionId: AssessmentSessionId;
  onComplete?: (session: AssessmentSession) => void;
  onError?: (error: Error) => void;
  className?: string;
  autoFocus?: boolean;
  enableVoiceInput?: boolean;
  enableFileUpload?: boolean;
}

/**
 * Chat message component props
 */
interface ChatMessageProps {
  message: AssessmentMessage;
  isLatest: boolean;
  onRetry?: () => void;
}

/**
 * Progress indicator props
 */
interface ProgressIndicatorProps {
  session: AssessmentSession;
}

/**
 * Input form props
 */
interface AssessmentInputFormProps {
  onSubmit: (message: string, metadata?: Record<string, unknown>) => void;
  disabled: boolean;
  placeholder?: string;
  enableVoiceInput?: boolean;
  enableFileUpload?: boolean;
}

/**
 * Typing indicator component
 */
const TypingIndicator: React.FC = (): ReactElement => {
  return (
    <div className="flex items-center space-x-2 p-4 text-gray-500">
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
      </div>
      <span className="text-sm">AI is thinking...</span>
    </div>
  );
};

/**
 * Chat message component
 */
const ChatMessage: React.FC<ChatMessageProps> = ({ message, isLatest, onRetry }): ReactElement => {
  const isAI = message.type === 'system' || message.type === 'feedback' || message.type === 'question';
  const isStudent = message.type === 'student';

  const getMessageIcon = (): string => {
    switch (message.type) {
      case 'system':
      case 'feedback':
        return '🤖';
      case 'question':
        return '❓';
      case 'hint':
        return '💡';
      case 'encouragement':
        return '⭐';
      case 'mastery_check':
        return '✅';
      case 'student':
        return '👤';
      default:
        return '💬';
    }
  };

  const formatTimestamp = (timestamp: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(timestamp);
  };

  return (
    <div
      className={`flex ${isStudent ? 'justify-end' : 'justify-start'} mb-4`}
      role="log"
      aria-live={isLatest ? 'polite' : 'off'}
    >
      <div
        className={`max-w-[80%] rounded-lg p-4 ${
          isStudent
            ? 'bg-blue-600 text-white ml-4'
            : 'bg-gray-100 text-gray-900 mr-4'
        }`}
      >
        <div className="flex items-start space-x-2">
          <span className="text-lg" role="img" aria-label={isStudent ? 'Student' : 'AI Assistant'}>
            {getMessageIcon()}
          </span>
          <div className="flex-1">
            <div className="text-sm font-medium mb-1">
              {isStudent ? 'You' : 'AI Assistant'}
            </div>
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{
                __html: message.content.replace(/\n/g, '<br>')
              }}
            />
            {message.metadata?.aiConfidence && (
              <div className="mt-2 text-xs opacity-75">
                Confidence: {Math.round(message.metadata.aiConfidence * 100)}%
              </div>
            )}
            <div className="mt-2 text-xs opacity-75">
              {formatTimestamp(message.timestamp)}
            </div>
          </div>
        </div>
        {isAI && onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 text-xs underline opacity-75 hover:opacity-100"
            aria-label="Retry AI response"
          >
            Regenerate response
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Progress indicator component
 */
const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ session }): ReactElement => {
  const progress = session.progress.currentStep / session.progress.totalSteps;
  const masteryRate = session.progress.conceptsMastered.length /
    (session.progress.conceptsMastered.length + session.progress.conceptsNeedWork.length || 1);

  return (
    <div className="bg-white border-b p-4" role="region" aria-label="Assessment Progress">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700">Assessment Progress</h3>
        <span className="text-sm text-gray-500">
          Step {session.progress.currentStep} of {session.progress.totalSteps}
        </span>
      </div>

      {/* Overall progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress * 100}%` }}
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Overall assessment progress"
        />
      </div>

      {/* Mastery indicators */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-green-500 rounded-full" />
            <span>Mastered: {session.progress.conceptsMastered.length}</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-yellow-500 rounded-full" />
            <span>Learning: {session.progress.conceptsNeedWork.length}</span>
          </div>
        </div>
        <div className="text-gray-600">
          Mastery: {Math.round(masteryRate * 100)}%
        </div>
      </div>

      {/* Status indicator */}
      <div className="mt-2">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          session.status === 'active' ? 'bg-green-100 text-green-800' :
          session.status === 'mastery_achieved' ? 'bg-blue-100 text-blue-800' :
          session.status === 'completed' ? 'bg-gray-100 text-gray-800' :
          'bg-yellow-100 text-yellow-800'
        }`}>
          {session.status.replace('_', ' ').toUpperCase()}
        </span>
      </div>
    </div>
  );
};

/**
 * Assessment input form component
 */
const AssessmentInputForm: React.FC<AssessmentInputFormProps> = ({
  onSubmit,
  disabled,
  placeholder = 'Type your response...',
  enableVoiceInput = false,
  enableFileUpload = false
}): ReactElement => {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const startTimeRef = useRef<number>(Date.now());

  const handleSubmit = useCallback((e: React.FormEvent): void => {
    e.preventDefault();

    if (!message.trim() || disabled) {
      return;
    }

    const responseTime = Date.now() - startTimeRef.current;
    const metadata = {
      responseTimeMs: responseTime,
      inputMethod: 'text',
      characterCount: message.length
    };

    onSubmit(message.trim(), metadata);
    setMessage('');
    startTimeRef.current = Date.now();

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [message, disabled, onSubmit]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }, [handleSubmit]);

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setMessage(e.target.value);

    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, []);

  // Reset start time when input is focused
  const handleFocus = useCallback((): void => {
    startTimeRef.current = Date.now();
  }, []);

  return (
    <div className="bg-white border-t p-4">
      <form onSubmit={handleSubmit} className="flex items-end space-x-3">
        <div className="flex-1">
          <label htmlFor="assessment-input" className="sr-only">
            Assessment response
          </label>
          <textarea
            ref={textareaRef}
            id="assessment-input"
            value={message}
            onChange={handleTextareaChange}
            onKeyPress={handleKeyPress}
            onFocus={handleFocus}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            rows={1}
            maxLength={5000}
            aria-describedby="character-count"
          />
          <div id="character-count" className="mt-1 text-xs text-gray-500 text-right">
            {message.length}/5000 characters
          </div>
        </div>

        {/* Voice input button */}
        {enableVoiceInput && (
          <button
            type="button"
            onClick={() => setIsRecording(!isRecording)}
            disabled={disabled}
            className={`p-3 rounded-lg transition-colors ${
              isRecording
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            } disabled:opacity-50`}
            aria-label={isRecording ? 'Stop recording' : 'Start voice recording'}
          >
            🎤
          </button>
        )}

        {/* File upload button */}
        {enableFileUpload && (
          <button
            type="button"
            disabled={disabled}
            className="p-3 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            aria-label="Upload file"
          >
            📎
          </button>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={disabled || !message.trim()}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Send response"
        >
          Send
        </button>
      </form>
    </div>
  );
};

/**
 * Main Conversational Assessment Interface Component
 */
export const ConversationalAssessmentInterface: React.FC<ConversationalAssessmentInterfaceProps> = ({
  sessionId,
  onComplete,
  onError,
  className = '',
  autoFocus = true,
  enableVoiceInput = false,
  enableFileUpload = false
}): ReactElement => {
  const [session, setSession] = useState<AssessmentSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = useCallback((): void => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Load initial session data
  useEffect(() => {
    const loadSession = async (): Promise<void> => {
      try {
        setIsLoading(true);

        const response = await fetch(`/api/ai-assessment/sessions/${sessionId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`Failed to load session: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'Failed to load session');
        }

        setSession(data.session);
        setError(null);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load assessment';
        setError(errorMessage);
        onError?.(new Error(errorMessage));
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, [sessionId, onError]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (session?.conversation) {
      setTimeout(scrollToBottom, 100);
    }
  }, [session?.conversation, scrollToBottom]);

  // Handle session completion
  useEffect(() => {
    if (session && ['completed', 'mastery_achieved', 'max_attempts', 'timeout'].includes(session.status)) {
      onComplete?.(session);
    }
  }, [session?.status, session, onComplete]);

  // Submit student response
  const handleSubmitResponse = useCallback(async (
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<void> => {
    if (!session || isProcessing) {
      return;
    }

    try {
      setIsProcessing(true);

      const response = await fetch(`/api/ai-assessment/sessions/${sessionId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          response: message,
          metadata
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to submit response: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to submit response');
      }

      setSession(data.session);
      setError(null);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit response';
      setError(errorMessage);
      onError?.(new Error(errorMessage));
    } finally {
      setIsProcessing(false);
    }
  }, [session, sessionId, isProcessing, onError]);

  // Retry AI response
  const handleRetryResponse = useCallback(async (): Promise<void> => {
    if (!session) return;

    try {
      setIsProcessing(true);

      const response = await fetch(`/api/ai-assessment/sessions/${sessionId}/retry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to retry: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to retry');
      }

      setSession(data.session);
      setError(null);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to retry';
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [session, sessionId]);

  // Loading state
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading assessment...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !session) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Assessment Error</h3>
          <p className="text-gray-600 mb-4">{error || 'Failed to load assessment'}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const canRespond = ['active', 'awaiting_response'].includes(session.status) && !isProcessing;

  return (
    <div
      ref={containerRef}
      className={`flex flex-col h-full bg-gray-50 ${className}`}
      role="main"
      aria-label="Conversational Assessment"
    >
      {/* Progress indicator */}
      <ProgressIndicator session={session} />

      {/* Messages container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" role="log" aria-live="polite">
        {session.conversation.map((message, index) => (
          <ChatMessage
            key={message.id}
            message={message}
            isLatest={index === session.conversation.length - 1}
            onRetry={message.type !== 'student' ? handleRetryResponse : undefined}
          />
        ))}

        {/* Typing indicator */}
        {isProcessing && <TypingIndicator />}

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input form */}
      <AssessmentInputForm
        onSubmit={handleSubmitResponse}
        disabled={!canRespond}
        placeholder={
          session.status === 'completed' ? 'Assessment completed' :
          session.status === 'mastery_achieved' ? 'Mastery achieved!' :
          session.status === 'max_attempts' ? 'Maximum attempts reached' :
          session.status === 'timeout' ? 'Assessment timed out' :
          isProcessing ? 'AI is thinking...' :
          'Type your response...'
        }
        enableVoiceInput={enableVoiceInput}
        enableFileUpload={enableFileUpload}
      />
    </div>
  );
};

export default ConversationalAssessmentInterface;