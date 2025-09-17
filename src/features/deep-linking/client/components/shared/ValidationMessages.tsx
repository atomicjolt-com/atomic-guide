/**
 * @fileoverview Validation Messages Component
 * Displays validation errors and warnings for form inputs and configuration steps
 * @module features/deep-linking/client/components/shared/ValidationMessages
 */

import { useState, useEffect, type ReactElement } from 'react';

/**
 * Validation message types
 */
type MessageType = 'error' | 'warning' | 'info' | 'success';

/**
 * Validation message interface
 */
interface ValidationMessage {
  type: MessageType;
  message: string;
  field?: string;
  details?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Validation messages props
 */
interface ValidationMessagesProps {
  errors: Record<string, string[]>;
  warnings?: Record<string, string[]>;
  info?: Record<string, string[]>;
  success?: Record<string, string[]>;
  onDismiss?: (field: string) => void;
  showFieldLabels?: boolean;
  className?: string;
  autoHideTimeout?: number; // seconds
}

/**
 * Individual message props
 */
interface MessageItemProps {
  message: ValidationMessage;
  onDismiss?: () => void;
  autoHide?: boolean;
  autoHideTimeout?: number;
}

/**
 * Validation Messages Component
 *
 * Displays validation feedback for form inputs and configuration steps:
 * - Error messages for validation failures
 * - Warning messages for potential issues
 * - Info messages for helpful guidance
 * - Success messages for confirmations
 */
export function ValidationMessages({
  errors = {},
  warnings = {},
  info = {},
  success = {},
  onDismiss,
  showFieldLabels = true,
  className = '',
  autoHideTimeout,
}: ValidationMessagesProps): ReactElement | null {
  const [dismissedMessages, setDismissedMessages] = useState<Set<string>>(new Set());

  // Combine all message types
  const allMessages: ValidationMessage[] = [
    ...Object.entries(errors).flatMap(([field, messages]) =>
      messages.map(message => ({
        type: 'error' as const,
        message,
        field,
      }))
    ),
    ...Object.entries(warnings).flatMap(([field, messages]) =>
      messages.map(message => ({
        type: 'warning' as const,
        message,
        field,
      }))
    ),
    ...Object.entries(info).flatMap(([field, messages]) =>
      messages.map(message => ({
        type: 'info' as const,
        message,
        field,
      }))
    ),
    ...Object.entries(success).flatMap(([field, messages]) =>
      messages.map(message => ({
        type: 'success' as const,
        message,
        field,
      }))
    ),
  ];

  // Filter out dismissed messages
  const visibleMessages = allMessages.filter(msg => {
    const messageKey = `${msg.field || 'global'}-${msg.message}`;
    return !dismissedMessages.has(messageKey);
  });

  // Handle message dismissal
  const handleDismiss = (message: ValidationMessage) => {
    const messageKey = `${message.field || 'global'}-${message.message}`;
    setDismissedMessages(prev => new Set(prev).add(messageKey));

    if (onDismiss && message.field) {
      onDismiss(message.field);
    }
  };

  // Clear dismissed messages when new messages arrive
  useEffect(() => {
    setDismissedMessages(new Set());
  }, [errors, warnings, info, success]);

  if (visibleMessages.length === 0) {
    return null;
  }

  return (
    <div className={`validation-messages ${className}`.trim()}>
      {visibleMessages.map((message, index) => (
        <MessageItem
          key={`${message.field || 'global'}-${message.message}-${index}`}
          message={message}
          onDismiss={() => handleDismiss(message)}
          autoHide={message.type === 'success' || message.type === 'info'}
          autoHideTimeout={autoHideTimeout}
          showFieldLabel={showFieldLabels}
        />
      ))}
    </div>
  );
}

/**
 * Individual Message Item Component
 */
function MessageItem({
  message,
  onDismiss,
  autoHide = false,
  autoHideTimeout = 5,
  showFieldLabel = true,
}: MessageItemProps & { showFieldLabel?: boolean }): ReactElement {
  const [isVisible, setIsVisible] = useState(true);

  // Auto-hide functionality
  useEffect(() => {
    if (autoHide && autoHideTimeout > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onDismiss?.(), 300); // Wait for fade animation
      }, autoHideTimeout * 1000);

      return () => clearTimeout(timer);
    }
  }, [autoHide, autoHideTimeout, onDismiss]);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => onDismiss?.(), 300); // Wait for fade animation
  };

  const getMessageIcon = (type: MessageType): string => {
    switch (type) {
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      case 'success':
        return '✅';
      default:
        return 'ℹ️';
    }
  };

  const formatFieldLabel = (field: string): string => {
    return field
      .split(/[._-]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div
      className={`validation-message validation-${message.type} ${
        isVisible ? 'message-visible' : 'message-hidden'
      }`}
      role={message.type === 'error' ? 'alert' : 'status'}
      aria-live={message.type === 'error' ? 'assertive' : 'polite'}
    >
      <div className="message-content">
        <div className="message-icon">
          {getMessageIcon(message.type)}
        </div>

        <div className="message-text">
          {showFieldLabel && message.field && (
            <strong className="message-field">
              {formatFieldLabel(message.field)}:{' '}
            </strong>
          )}
          <span className="message-body">{message.message}</span>

          {message.details && (
            <div className="message-details">
              {message.details}
            </div>
          )}
        </div>

        <div className="message-actions">
          {message.action && (
            <button
              onClick={message.action.onClick}
              className="message-action-button"
            >
              {message.action.label}
            </button>
          )}

          <button
            onClick={handleDismiss}
            className="message-dismiss-button"
            aria-label="Dismiss message"
          >
            ✕
          </button>
        </div>
      </div>

      {autoHide && autoHideTimeout > 0 && (
        <div
          className="message-timer"
          style={{ animationDuration: `${autoHideTimeout}s` }}
        />
      )}
    </div>
  );
}

/**
 * Specific validation components for common use cases
 */

/**
 * Field validation error display
 */
export function FieldValidationError({
  errors,
  fieldName,
  className = '',
}: {
  errors: Record<string, string[]>;
  fieldName: string;
  className?: string;
}): ReactElement | null {
  const fieldErrors = errors[fieldName];

  if (!fieldErrors || fieldErrors.length === 0) {
    return null;
  }

  return (
    <div className={`field-validation-error ${className}`.trim()}>
      {fieldErrors.map((error, index) => (
        <div key={index} className="field-error-message">
          <span className="error-icon">❌</span>
          <span className="error-text">{error}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Step validation summary
 */
export function StepValidationSummary({
  stepErrors,
  stepName,
  onFixErrors,
}: {
  stepErrors: Record<string, string[]>;
  stepName: string;
  onFixErrors?: () => void;
}): ReactElement | null {
  const totalErrors = Object.values(stepErrors).flat().length;

  if (totalErrors === 0) {
    return null;
  }

  return (
    <div className="step-validation-summary">
      <div className="summary-header">
        <span className="error-icon">⚠️</span>
        <span className="summary-text">
          {totalErrors} validation {totalErrors === 1 ? 'error' : 'errors'} in {stepName}
        </span>
      </div>

      <div className="summary-errors">
        {Object.entries(stepErrors).map(([field, errors]) =>
          errors.map((error, index) => (
            <div key={`${field}-${index}`} className="summary-error-item">
              <strong>{field}:</strong> {error}
            </div>
          ))
        )}
      </div>

      {onFixErrors && (
        <button onClick={onFixErrors} className="fix-errors-button">
          Go to {stepName}
        </button>
      )}
    </div>
  );
}

/**
 * CSS styles for validation messages
 */
const styles = `
  .validation-messages {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 16px 0;
  }

  .validation-message {
    border-radius: 6px;
    padding: 12px;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }

  .message-visible {
    opacity: 1;
    transform: translateY(0);
  }

  .message-hidden {
    opacity: 0;
    transform: translateY(-10px);
  }

  .validation-error {
    background: #FEF3F2;
    border: 1px solid #F87171;
    color: #B42318;
  }

  .validation-warning {
    background: #FEF3C7;
    border: 1px solid #F59E0B;
    color: #92400E;
  }

  .validation-info {
    background: #EFF6FF;
    border: 1px solid #60A5FA;
    color: #1E40AF;
  }

  .validation-success {
    background: #ECFDF3;
    border: 1px solid #34D399;
    color: #047857;
  }

  .message-content {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .message-icon {
    font-size: 1rem;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .message-text {
    flex: 1;
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .message-field {
    font-weight: 600;
  }

  .message-body {
    display: block;
  }

  .message-details {
    margin-top: 4px;
    font-size: 0.8rem;
    opacity: 0.8;
  }

  .message-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .message-action-button {
    background: none;
    border: 1px solid currentColor;
    color: inherit;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .message-action-button:hover {
    background: currentColor;
    color: white;
  }

  .message-dismiss-button {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 2px;
    border-radius: 2px;
    font-size: 0.9rem;
    opacity: 0.7;
    transition: opacity 0.2s;
  }

  .message-dismiss-button:hover {
    opacity: 1;
  }

  .message-timer {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 2px;
    background: currentColor;
    opacity: 0.3;
    animation: timer-countdown linear;
    transform-origin: left;
  }

  @keyframes timer-countdown {
    from { transform: scaleX(1); }
    to { transform: scaleX(0); }
  }

  .field-validation-error {
    margin-top: 4px;
  }

  .field-error-message {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    color: #B42318;
    margin-bottom: 2px;
  }

  .field-error-message:last-child {
    margin-bottom: 0;
  }

  .field-error-message .error-icon {
    font-size: 0.8rem;
  }

  .step-validation-summary {
    background: #FEF3F2;
    border: 1px solid #F87171;
    border-radius: 6px;
    padding: 16px;
    margin: 16px 0;
  }

  .summary-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    font-weight: 600;
    color: #B42318;
  }

  .summary-errors {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
  }

  .summary-error-item {
    font-size: 0.9rem;
    color: #B42318;
    padding-left: 16px;
  }

  .fix-errors-button {
    background: #B42318;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 0.9rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  .fix-errors-button:hover {
    background: #991B1B;
  }

  @media (max-width: 768px) {
    .validation-messages {
      margin: 12px 0;
    }

    .validation-message {
      padding: 10px;
    }

    .message-content {
      flex-direction: column;
      gap: 8px;
    }

    .message-actions {
      justify-content: flex-end;
      margin-top: 8px;
    }

    .message-text {
      font-size: 0.85rem;
    }

    .step-validation-summary {
      padding: 12px;
    }

    .summary-error-item {
      font-size: 0.85rem;
      padding-left: 12px;
    }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}