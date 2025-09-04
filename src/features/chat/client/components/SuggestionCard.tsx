/**
 * SuggestionCard Component
 * Interactive suggestion display with accessibility support and mobile optimization
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

export interface SuggestionAction {
  type: 'prompt' | 'resource' | 'escalation' | 'practice' | 'break';
  label: string;
  data: any;
  icon?: string;
  analytics?: {
    trackingId: string;
    expectedOutcome: string;
  };
}

export interface Suggestion {
  id: string;
  type: 'help' | 'resource' | 'practice' | 'clarification' | 'next-step';
  title: string;
  description: string;
  confidence: number;
  triggerPattern: string;
  triggerReason: string;
  contextData: {
    pageType?: string;
    topic?: string;
    conversationLength: number;
    lastSuggestionAt?: Date;
    userEngagementScore: number;
  };
  actions: SuggestionAction[];
  displaySettings: {
    urgency: 'low' | 'medium' | 'high' | 'critical';
    displayDurationSeconds: number;
    allowDismiss: boolean;
    requireFeedback: boolean;
  };
}

export interface SuggestionCardProps {
  suggestion: Suggestion;
  onAccept: (action: SuggestionAction) => void;
  onDismiss: (feedback?: string) => void;
  onFeedback: (feedback: 'helpful' | 'not_helpful' | 'too_frequent' | 'wrong_timing' | 'irrelevant') => void;
  mobile?: boolean;
  className?: string;
}

export const SuggestionCard: React.FC<SuggestionCardProps> = ({
  suggestion,
  onAccept,
  onDismiss,
  onFeedback,
  mobile = false,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryActionRef = useRef<HTMLButtonElement>(null);

  // Define handleDismiss early to avoid temporal dead zone
  const handleDismiss = useCallback(
    (reason: string) => {
      setIsVisible(false);
      setTimeout(() => {
        onDismiss(reason);
      }, 200); // Wait for exit animation
    },
    [onDismiss]
  );

  // Auto-dismiss timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100); // Small delay for entrance animation

    const autoDismissTimer = suggestion.displaySettings.allowDismiss
      ? setTimeout(() => {
          handleDismiss('timeout');
        }, suggestion.displaySettings.displayDurationSeconds * 1000)
      : null;

    return () => {
      clearTimeout(timer);
      if (autoDismissTimer) clearTimeout(autoDismissTimer);
    };
  }, [suggestion, handleDismiss]);

  // Focus management for accessibility
  useEffect(() => {
    if (isVisible && primaryActionRef.current) {
      primaryActionRef.current.focus();
    }
  }, [isVisible]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isVisible) return;

      switch (event.key) {
        case 'Escape':
          if (suggestion.displaySettings.allowDismiss) {
            handleDismiss('user_dismissed');
          }
          break;
        case 'Tab':
          // Let browser handle tab navigation within card
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, suggestion.displaySettings.allowDismiss, handleDismiss]);

  const handleAccept = (action: SuggestionAction) => {
    onAccept(action);
    if (suggestion.displaySettings.requireFeedback) {
      setShowFeedback(true);
    }
  };

  const handleFeedback = (feedback: 'helpful' | 'not_helpful' | 'too_frequent' | 'wrong_timing' | 'irrelevant') => {
    onFeedback(feedback);
    setShowFeedback(false);
    setIsVisible(false);
    setTimeout(() => {
      onDismiss('feedback_provided');
    }, 200);
  };

  const getUrgencyColors = () => {
    const colors = {
      low: 'border-neutral-200 bg-off-white shadow-sm',
      medium: 'border-neutral-300 bg-off-white shadow-md',
      high: 'border-yellow-300 bg-yellow-50 shadow-lg',
      critical: 'border-red-300 bg-red-50 shadow-lg',
    };
    return colors[suggestion.displaySettings.urgency];
  };

  const getPatternIcon = () => {
    const icons = {
      confusion: '🤔',
      frustration: '😤',
      repetition: '🔁',
      engagement_decline: '⚡',
      success_opportunity: '🌟',
    };
    return icons[suggestion.triggerPattern as keyof typeof icons] || '💡';
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-labelledby={`suggestion-title-${suggestion.id}`}
      aria-describedby={`suggestion-description-${suggestion.id}`}
      aria-live="polite"
      aria-modal="false"
      className={`
        suggestion-card
        ${getUrgencyColors()}
        ${isVisible ? 'animate-suggestion-enter' : 'animate-suggestion-exit'}
        ${mobile ? 'mobile-suggestion-card' : 'desktop-suggestion-card'}
        ${className}
        relative rounded-lg border p-4 transition-all duration-300
        max-w-md mx-auto
        ${mobile ? 'w-full mx-4' : 'w-96'}
      `}
      style={
        {
          '--suggestion-confidence': `${Math.round(suggestion.confidence * 100)}%`,
        } as React.CSSProperties
      }
    >
      {/* Confidence indicator */}
      <div
        className="absolute top-0 left-0 h-0.5 bg-yellow-400 rounded-tl-lg transition-all duration-300"
        style={{ width: `${suggestion.confidence * 100}%` }}
        aria-hidden="true"
      />

      {/* Header with icon and reason */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-lg" role="img" aria-label={`${suggestion.triggerPattern} pattern detected`}>
            {getPatternIcon()}
          </span>
          <span className="text-sm text-neutral-600">Why this suggestion?</span>
        </div>

        {suggestion.displaySettings.allowDismiss && (
          <button
            onClick={() => handleDismiss('user_dismissed')}
            className="
              p-1 rounded-full hover:bg-neutral-100 focus:ring-2 focus:ring-yellow-500 
              focus:ring-offset-1 transition-colors duration-150
              min-w-[32px] min-h-[32px] flex items-center justify-center
            "
            aria-label="Dismiss suggestion"
            type="button"
          >
            <span className="text-neutral-400 hover:text-neutral-600">×</span>
          </button>
        )}
      </div>

      {/* Title and description */}
      <div className="mb-4">
        <h3 id={`suggestion-title-${suggestion.id}`} className="text-lg font-semibold text-black dark:text-white mb-1">
          {suggestion.title}
        </h3>
        <p id={`suggestion-description-${suggestion.id}`} className="text-neutral-700 dark:text-neutral-300 text-sm leading-relaxed">
          {suggestion.description}
        </p>
      </div>

      {/* Expandable trigger reason */}
      <div className="mb-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="
            text-xs text-neutral-500 hover:text-neutral-700 
            flex items-center space-x-1 transition-colors duration-150
          "
          aria-expanded={isExpanded}
          aria-controls={`reason-${suggestion.id}`}
        >
          <span>{isExpanded ? '▼' : '▶'}</span>
          <span>Why now?</span>
        </button>

        {isExpanded && (
          <div
            id={`reason-${suggestion.id}`}
            className="mt-2 p-2 bg-neutral-50 dark:bg-neutral-800 rounded text-xs text-neutral-600 dark:text-neutral-400"
          >
            {suggestion.triggerReason}
            {suggestion.confidence && (
              <div className="mt-1">
                <span>Confidence: {Math.round(suggestion.confidence * 100)}%</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="space-y-2 mb-4">
        {suggestion.actions.map((action, index) => (
          <button
            key={`${action.type}-${index}`}
            ref={index === 0 ? primaryActionRef : undefined}
            onClick={() => handleAccept(action)}
            className={`
              w-full px-4 py-2 rounded-md font-medium transition-all duration-150
              min-h-[44px] flex items-center justify-center space-x-2
              ${
                index === 0
                  ? 'bg-yellow-400 text-black hover:bg-yellow-500 focus:ring-2 focus:ring-yellow-600'
                  : 'bg-white border border-neutral-300 text-black hover:bg-neutral-50 focus:ring-2 focus:ring-neutral-400'
              }
              focus:ring-offset-2 focus:outline-none
              ${mobile ? 'text-base' : 'text-sm'}
            `}
            aria-describedby={suggestion.displaySettings.requireFeedback ? `suggestion-confidence-${suggestion.id}` : undefined}
          >
            {action.icon && (
              <span role="img" aria-hidden="true">
                {action.icon}
              </span>
            )}
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      {/* Feedback section */}
      {showFeedback && (
        <div className="border-t pt-3 space-y-2">
          <p className="text-sm text-neutral-600 mb-2">Was this suggestion helpful?</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleFeedback('helpful')}
              className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors duration-150"
            >
              👍 Helpful
            </button>
            <button
              onClick={() => handleFeedback('not_helpful')}
              className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors duration-150"
            >
              👎 Not helpful
            </button>
            <button
              onClick={() => handleFeedback('too_frequent')}
              className="px-3 py-1 text-sm bg-orange-100 text-orange-800 rounded hover:bg-orange-200 transition-colors duration-150"
            >
              🔇 Too frequent
            </button>
            <button
              onClick={() => handleFeedback('wrong_timing')}
              className="px-3 py-1 text-sm bg-purple-100 text-purple-800 rounded hover:bg-purple-200 transition-colors duration-150"
            >
              ⏱️ Wrong timing
            </button>
          </div>
        </div>
      )}

      {/* Don't show again option */}
      {!showFeedback && suggestion.displaySettings.allowDismiss && (
        <div className="border-t pt-3">
          <label className="flex items-center space-x-2 text-sm text-neutral-600">
            <input
              type="checkbox"
              className="rounded border-neutral-300 focus:ring-yellow-500"
              onChange={(e) => {
                if (e.target.checked) {
                  handleFeedback('too_frequent');
                }
              }}
            />
            <span>Don't show suggestions like this</span>
          </label>
        </div>
      )}

      {/* Screen reader only confidence information */}
      <span id={`suggestion-confidence-${suggestion.id}`} className="sr-only">
        Suggestion confidence: {Math.round(suggestion.confidence * 100)}%
      </span>
    </div>
  );
};

// CSS animations (would typically be in a separate CSS file)
const suggestionStyles = `
  @keyframes suggestion-enter {
    0% { 
      opacity: 0; 
      transform: translateY(16px) scale(0.95); 
    }
    100% { 
      opacity: 1; 
      transform: translateY(0) scale(1); 
    }
  }

  @keyframes suggestion-exit {
    0% { 
      opacity: 1; 
      transform: translateY(0) scale(1); 
    }
    100% { 
      opacity: 0; 
      transform: translateY(-8px) scale(0.98); 
    }
  }

  .animate-suggestion-enter {
    animation: suggestion-enter 300ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .animate-suggestion-exit {
    animation: suggestion-exit 200ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .desktop-suggestion-card {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }

  .desktop-suggestion-card:hover {
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    transform: translateY(-1px);
  }

  .mobile-suggestion-card {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .suggestion-card {
      border-width: 2px;
    }
    
    .suggestion-card button:focus {
      outline: 2px solid #FFDD00;
      outline-offset: 2px;
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .animate-suggestion-enter,
    .animate-suggestion-exit {
      animation: none;
    }
    
    .suggestion-card {
      transition: none;
    }
    
    .desktop-suggestion-card:hover {
      transform: none;
    }
  }

  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .suggestion-card {
      background-color: #111111;
      border-color: #333333;
    }
  }
`;

// Inject styles (in a real app, these would be in CSS modules or styled-components)
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = suggestionStyles;
  document.head.appendChild(styleSheet);
}

export default SuggestionCard;
