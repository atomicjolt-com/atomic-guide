/**
 * @fileoverview Configuration Progress Component
 * Visual progress tracking through the assessment configuration workflow
 * @module features/deep-linking/client/components/ConfigurationProgress
 */

import { useState, useCallback, useEffect, type ReactElement } from 'react';

/**
 * Configuration step interface
 */
export interface ConfigurationStep {
  id: string;
  title: string;
  description: string;
  isComplete: boolean;
  isActive: boolean;
  isAccessible: boolean;
  icon?: string;
  estimatedTime?: number; // in minutes
  completedAt?: Date;
  validationErrors?: string[];
}

/**
 * Component props interface
 */
interface ConfigurationProgressProps {
  steps: ConfigurationStep[];
  currentStepId: string;
  onStepClick: (stepId: string) => void;
  allowStepNavigation?: boolean;
  showEstimatedTime?: boolean;
  showValidationErrors?: boolean;
  compact?: boolean;
  theme?: 'default' | 'minimal' | 'detailed';
}

/**
 * Step validation status
 */
type ValidationStatus = 'valid' | 'invalid' | 'warning' | 'pending';

/**
 * Configuration Progress Component
 *
 * Provides visual progress tracking through the assessment configuration workflow.
 * Features include step navigation, validation status, progress indicators,
 * and estimated completion times.
 */
export function ConfigurationProgress({
  steps,
  currentStepId,
  onStepClick,
  allowStepNavigation = true,
  showEstimatedTime = true,
  showValidationErrors = true,
  compact = false,
  theme = 'default',
}: ConfigurationProgressProps): ReactElement {
  // State
  const [hoveredStepId, setHoveredStepId] = useState<string | null>(null);
  const [showAllDetails, setShowAllDetails] = useState(false);

  // Calculate progress percentage
  const calculateProgress = useCallback((): number => {
    const completedSteps = steps.filter(step => step.isComplete).length;
    return steps.length > 0 ? (completedSteps / steps.length) * 100 : 0;
  }, [steps]);

  // Get current step index
  const getCurrentStepIndex = useCallback((): number => {
    return steps.findIndex(step => step.id === currentStepId);
  }, [steps, currentStepId]);

  // Get step validation status
  const getStepValidationStatus = useCallback((step: ConfigurationStep): ValidationStatus => {
    if (step.validationErrors && step.validationErrors.length > 0) {
      return 'invalid';
    }
    if (step.isComplete) {
      return 'valid';
    }
    if (step.isActive) {
      return 'pending';
    }
    return 'valid';
  }, []);

  // Get step icon
  const getStepIcon = useCallback((step: ConfigurationStep, index: number): string => {
    if (step.icon) {
      return step.icon;
    }

    // Default icons based on step position
    const defaultIcons = ['📚', '📍', '⚙️', '👀', '🚀'];
    return defaultIcons[index % defaultIcons.length] || '📋';
  }, []);

  // Get validation icon
  const getValidationIcon = useCallback((status: ValidationStatus): string => {
    switch (status) {
      case 'valid': return '✅';
      case 'invalid': return '❌';
      case 'warning': return '⚠️';
      case 'pending': return '⏳';
      default: return '○';
    }
  }, []);

  // Handle step click
  const handleStepClick = useCallback((stepId: string) => {
    const step = steps.find(s => s.id === stepId);
    if (step && step.isAccessible && allowStepNavigation) {
      onStepClick(stepId);
    }
  }, [steps, allowStepNavigation, onStepClick]);

  // Calculate total estimated time
  const getTotalEstimatedTime = useCallback((): number => {
    return steps.reduce((total, step) => total + (step.estimatedTime || 0), 0);
  }, [steps]);

  // Calculate remaining time
  const getRemainingTime = useCallback((): number => {
    const currentIndex = getCurrentStepIndex();
    return steps
      .slice(currentIndex)
      .reduce((total, step) => total + (step.estimatedTime || 0), 0);
  }, [steps, getCurrentStepIndex]);

  // Format time display
  const formatTime = useCallback((minutes: number): string => {
    if (minutes < 1) return '<1 min';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${Math.round(remainingMinutes)}m`;
  }, []);

  // Get step connector class
  const getConnectorClass = useCallback((index: number): string => {
    if (index >= steps.length - 1) return '';

    const currentStep = steps[index];
    const nextStep = steps[index + 1];

    if (currentStep.isComplete) {
      return 'connector completed';
    }
    if (currentStep.isActive) {
      return 'connector active';
    }
    return 'connector pending';
  }, [steps]);

  // Progress percentage
  const progressPercentage = calculateProgress();
  const currentStepIndex = getCurrentStepIndex();
  const totalTime = getTotalEstimatedTime();
  const remainingTime = getRemainingTime();

  // Render based on theme
  if (theme === 'minimal') {
    return (
      <div className="configuration-progress minimal">
        <div className="progress-header">
          <span className="progress-title">Configuration Progress</span>
          <span className="progress-percentage">{Math.round(progressPercentage)}%</span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <div className="current-step">
          <span className="step-indicator">
            {getStepIcon(steps[currentStepIndex] || steps[0], currentStepIndex)}
          </span>
          <span className="step-title">
            {steps[currentStepIndex]?.title || 'Configuration'}
          </span>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="configuration-progress compact">
        <div className="compact-header">
          <div className="progress-info">
            <span className="progress-title">Step {currentStepIndex + 1} of {steps.length}</span>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
          {showEstimatedTime && remainingTime > 0 && (
            <span className="time-remaining">{formatTime(remainingTime)} left</span>
          )}
        </div>

        <div className="compact-steps">
          {steps.map((step, index) => {
            const validationStatus = getStepValidationStatus(step);
            const isHovered = hoveredStepId === step.id;

            return (
              <div
                key={step.id}
                className={`compact-step ${step.isComplete ? 'completed' : ''} ${
                  step.isActive ? 'active' : ''
                } ${step.isAccessible ? 'accessible' : 'disabled'} ${
                  isHovered ? 'hovered' : ''
                }`}
                onClick={() => handleStepClick(step.id)}
                onMouseEnter={() => setHoveredStepId(step.id)}
                onMouseLeave={() => setHoveredStepId(null)}
                role={step.isAccessible ? 'button' : undefined}
                tabIndex={step.isAccessible ? 0 : -1}
                aria-label={`${step.title}: ${step.isComplete ? 'Completed' : step.isActive ? 'Current' : 'Pending'}`}
                title={step.description}
              >
                <div className="step-marker">
                  {step.isComplete ? (
                    <span className="completion-icon">✓</span>
                  ) : (
                    <span className="step-number">{index + 1}</span>
                  )}
                </div>

                {isHovered && (
                  <div className="step-tooltip">
                    <div className="tooltip-content">
                      <strong>{step.title}</strong>
                      <p>{step.description}</p>
                      {step.estimatedTime && (
                        <span className="tooltip-time">~{formatTime(step.estimatedTime)}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Default detailed theme
  return (
    <div className="configuration-progress detailed">
      {/* Progress Header */}
      <div className="progress-header">
        <div className="header-left">
          <h4 className="progress-title">📋 Configuration Progress</h4>
          <div className="progress-stats">
            <span className="progress-percentage">{Math.round(progressPercentage)}% Complete</span>
            {showEstimatedTime && (
              <span className="time-stats">
                {remainingTime > 0 ? (
                  <>~{formatTime(remainingTime)} remaining</>
                ) : (
                  <>Total time: {formatTime(totalTime)}</>
                )}
              </span>
            )}
          </div>
        </div>

        <div className="header-actions">
          <button
            onClick={() => setShowAllDetails(!showAllDetails)}
            className="btn btn-outline btn-sm"
          >
            {showAllDetails ? 'Hide Details' : 'Show Details'}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="progress-bar-container">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progressPercentage}%` }}
          />
          <div className="progress-steps">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className="progress-step-marker"
                style={{ left: `${(index / (steps.length - 1)) * 100}%` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Steps List */}
      <div className="steps-container">
        {steps.map((step, index) => {
          const validationStatus = getStepValidationStatus(step);
          const isHovered = hoveredStepId === step.id;
          const connectorClass = getConnectorClass(index);

          return (
            <div key={step.id} className="step-wrapper">
              <div
                className={`step-item ${step.isComplete ? 'completed' : ''} ${
                  step.isActive ? 'active' : ''
                } ${step.isAccessible ? 'accessible' : 'disabled'} ${
                  isHovered ? 'hovered' : ''
                } ${validationStatus}`}
                onClick={() => handleStepClick(step.id)}
                onMouseEnter={() => setHoveredStepId(step.id)}
                onMouseLeave={() => setHoveredStepId(null)}
                role={step.isAccessible ? 'button' : undefined}
                tabIndex={step.isAccessible ? 0 : -1}
                aria-label={`${step.title}: ${step.isComplete ? 'Completed' : step.isActive ? 'Current step' : 'Pending'}`}
              >
                {/* Step Icon/Status */}
                <div className="step-icon-container">
                  <div className="step-icon">
                    {step.isComplete ? (
                      <span className="completion-check">✓</span>
                    ) : step.isActive ? (
                      <span className="current-indicator">⦿</span>
                    ) : (
                      <span className="step-icon-emoji">{getStepIcon(step, index)}</span>
                    )}
                  </div>

                  {showValidationErrors && (
                    <div className="validation-indicator">
                      {getValidationIcon(validationStatus)}
                    </div>
                  )}
                </div>

                {/* Step Content */}
                <div className="step-content">
                  <div className="step-header">
                    <h5 className="step-title">{step.title}</h5>
                    <div className="step-meta">
                      {showEstimatedTime && step.estimatedTime && (
                        <span className="step-time">~{formatTime(step.estimatedTime)}</span>
                      )}
                      {step.completedAt && (
                        <span className="completion-time">
                          Completed {step.completedAt.toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="step-description">{step.description}</p>

                  {/* Validation Errors */}
                  {showValidationErrors && step.validationErrors && step.validationErrors.length > 0 && (
                    <div className="validation-errors">
                      <div className="errors-header">
                        <span className="error-icon">⚠️</span>
                        <span className="error-count">
                          {step.validationErrors.length} issue{step.validationErrors.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {showAllDetails && (
                        <ul className="error-list">
                          {step.validationErrors.map((error, errorIndex) => (
                            <li key={errorIndex} className="error-item">
                              {error}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Extended Details */}
                  {showAllDetails && step.isActive && (
                    <div className="step-details">
                      <div className="details-grid">
                        <div className="detail-item">
                          <span className="detail-label">Status:</span>
                          <span className="detail-value">
                            {step.isComplete ? 'Completed' :
                             step.isActive ? 'In Progress' : 'Pending'}
                          </span>
                        </div>
                        {step.estimatedTime && (
                          <div className="detail-item">
                            <span className="detail-label">Estimated Time:</span>
                            <span className="detail-value">{formatTime(step.estimatedTime)}</span>
                          </div>
                        )}
                        <div className="detail-item">
                          <span className="detail-label">Accessible:</span>
                          <span className="detail-value">
                            {step.isAccessible ? 'Yes' : 'No'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Step Actions */}
                {step.isAccessible && allowStepNavigation && (
                  <div className="step-actions">
                    {step.isActive ? (
                      <span className="current-step-indicator">Current Step</span>
                    ) : step.isComplete ? (
                      <button className="btn btn-outline btn-sm">Review</button>
                    ) : (
                      <button className="btn btn-outline btn-sm">Go to Step</button>
                    )}
                  </div>
                )}
              </div>

              {/* Step Connector */}
              {index < steps.length - 1 && (
                <div className={connectorClass}>
                  <div className="connector-line" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress Summary */}
      <div className="progress-summary">
        <div className="summary-stats">
          <div className="stat-item">
            <span className="stat-value">{steps.filter(s => s.isComplete).length}</span>
            <span className="stat-label">Completed</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{steps.filter(s => s.isActive).length}</span>
            <span className="stat-label">In Progress</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{steps.filter(s => !s.isComplete && !s.isActive).length}</span>
            <span className="stat-label">Remaining</span>
          </div>
        </div>

        {showEstimatedTime && totalTime > 0 && (
          <div className="time-summary">
            <span className="time-label">Total Configuration Time:</span>
            <span className="time-value">{formatTime(totalTime)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * CSS styles for configuration progress
 */
const styles = `
  .configuration-progress {
    background: white;
    border: 1px solid #E5E7EB;
    border-radius: 8px;
    padding: 20px;
  }

  /* Minimal Theme */
  .configuration-progress.minimal {
    padding: 12px;
  }

  .configuration-progress.minimal .progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .configuration-progress.minimal .progress-title {
    font-weight: 500;
    color: #333;
    font-size: 0.9rem;
  }

  .configuration-progress.minimal .progress-percentage {
    font-weight: 600;
    color: #FFDD00;
    background: #333;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.8rem;
  }

  .configuration-progress.minimal .progress-bar {
    height: 6px;
    background: #E5E7EB;
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 8px;
  }

  .configuration-progress.minimal .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #FFDD00, #EBCB00);
    transition: width 0.3s ease;
  }

  .configuration-progress.minimal .current-step {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .configuration-progress.minimal .step-indicator {
    font-size: 1rem;
  }

  .configuration-progress.minimal .step-title {
    font-weight: 500;
    color: #333;
    font-size: 0.9rem;
  }

  /* Compact Theme */
  .configuration-progress.compact {
    padding: 16px;
  }

  .compact-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .progress-info {
    flex: 1;
  }

  .progress-info .progress-title {
    display: block;
    font-weight: 500;
    color: #333;
    font-size: 0.9rem;
    margin-bottom: 4px;
  }

  .compact-header .progress-bar {
    height: 4px;
    background: #E5E7EB;
    border-radius: 2px;
    overflow: hidden;
  }

  .compact-header .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #FFDD00, #EBCB00);
    transition: width 0.3s ease;
  }

  .time-remaining {
    font-size: 0.8rem;
    color: #666;
    white-space: nowrap;
  }

  .compact-steps {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .compact-step {
    position: relative;
    cursor: pointer;
    transition: all 0.2s;
  }

  .compact-step.disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .compact-step.accessible:hover {
    transform: scale(1.1);
  }

  .step-marker {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #E5E7EB;
    color: #666;
    font-weight: 500;
    font-size: 0.8rem;
    border: 2px solid #E5E7EB;
    transition: all 0.2s;
  }

  .compact-step.completed .step-marker {
    background: #10B981;
    border-color: #059669;
    color: white;
  }

  .compact-step.active .step-marker {
    background: #FFDD00;
    border-color: #EBCB00;
    color: #333;
    box-shadow: 0 0 0 3px rgba(255, 221, 0, 0.3);
  }

  .completion-icon {
    font-weight: bold;
  }

  .step-tooltip {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 8px;
    z-index: 10;
  }

  .tooltip-content {
    background: #333;
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 0.8rem;
    white-space: nowrap;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .tooltip-content::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 4px solid transparent;
    border-top-color: #333;
  }

  .tooltip-content strong {
    display: block;
    margin-bottom: 2px;
  }

  .tooltip-content p {
    margin: 0;
    opacity: 0.9;
  }

  .tooltip-time {
    font-style: italic;
    opacity: 0.8;
  }

  /* Detailed Theme */
  .configuration-progress.detailed .progress-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 20px;
    gap: 20px;
  }

  .header-left {
    flex: 1;
  }

  .progress-title {
    margin: 0 0 8px 0;
    color: #333;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .progress-stats {
    display: flex;
    gap: 16px;
    font-size: 0.9rem;
    color: #666;
  }

  .progress-percentage {
    font-weight: 600;
    color: #FFDD00;
    background: #333;
    padding: 2px 8px;
    border-radius: 4px;
  }

  .time-stats {
    color: #666;
  }

  .header-actions {
    flex-shrink: 0;
  }

  .progress-bar-container {
    margin-bottom: 24px;
  }

  .detailed .progress-bar {
    height: 8px;
    background: #E5E7EB;
    border-radius: 4px;
    overflow: hidden;
    position: relative;
  }

  .detailed .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #FFDD00, #EBCB00);
    transition: width 0.3s ease;
  }

  .progress-steps {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }

  .progress-step-marker {
    position: absolute;
    top: -2px;
    width: 12px;
    height: 12px;
    background: white;
    border: 2px solid #FFDD00;
    border-radius: 50%;
    transform: translateX(-50%);
  }

  .steps-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .step-wrapper {
    position: relative;
  }

  .step-item {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    padding: 16px;
    border-radius: 6px;
    border: 1px solid #E5E7EB;
    background: #FAFBFC;
    transition: all 0.2s;
    cursor: pointer;
  }

  .step-item.disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .step-item.accessible:hover {
    border-color: #FFDD00;
    background: #FFFEF7;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }

  .step-item.active {
    border-color: #FFDD00;
    background: #FFFEF7;
    box-shadow: 0 0 0 2px rgba(255, 221, 0, 0.2);
  }

  .step-item.completed {
    border-color: #10B981;
    background: #ECFDF3;
  }

  .step-item.invalid {
    border-color: #EF4444;
    background: #FEF2F2;
  }

  .step-icon-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .step-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #E5E7EB;
    color: #666;
    font-size: 1.2rem;
    font-weight: 500;
    border: 2px solid #E5E7EB;
    transition: all 0.2s;
  }

  .step-item.completed .step-icon {
    background: #10B981;
    border-color: #059669;
    color: white;
  }

  .step-item.active .step-icon {
    background: #FFDD00;
    border-color: #EBCB00;
    color: #333;
  }

  .step-item.invalid .step-icon {
    background: #EF4444;
    border-color: #DC2626;
    color: white;
  }

  .completion-check,
  .current-indicator {
    font-weight: bold;
    font-size: 1.2rem;
  }

  .step-icon-emoji {
    font-size: 1.1rem;
  }

  .validation-indicator {
    font-size: 0.8rem;
  }

  .step-content {
    flex: 1;
    min-width: 0;
  }

  .step-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 4px;
    gap: 12px;
  }

  .step-title {
    margin: 0;
    color: #333;
    font-size: 1rem;
    font-weight: 600;
  }

  .step-meta {
    display: flex;
    gap: 12px;
    font-size: 0.8rem;
    color: #666;
    flex-shrink: 0;
  }

  .step-time,
  .completion-time {
    background: #F3F4F6;
    padding: 2px 6px;
    border-radius: 3px;
  }

  .step-description {
    margin: 0 0 8px 0;
    color: #666;
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .validation-errors {
    background: #FEF2F2;
    border: 1px solid #FECACA;
    border-radius: 4px;
    padding: 8px;
    margin-top: 8px;
  }

  .errors-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    color: #991B1B;
    font-weight: 500;
  }

  .error-list {
    margin: 4px 0 0 0;
    padding-left: 16px;
  }

  .error-item {
    color: #991B1B;
    font-size: 0.8rem;
    margin-bottom: 2px;
  }

  .step-details {
    background: #F9FAFB;
    border-radius: 4px;
    padding: 8px;
    margin-top: 8px;
  }

  .details-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 8px;
  }

  .detail-item {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
  }

  .detail-label {
    color: #666;
  }

  .detail-value {
    color: #333;
    font-weight: 500;
  }

  .step-actions {
    flex-shrink: 0;
    align-self: center;
  }

  .current-step-indicator {
    background: #FFDD00;
    color: #333;
    padding: 4px 8px;
    border-radius: 3px;
    font-size: 0.8rem;
    font-weight: 500;
  }

  .connector {
    display: flex;
    justify-content: center;
    padding: 8px 0;
    margin-left: 36px;
  }

  .connector-line {
    width: 2px;
    height: 24px;
    background: #E5E7EB;
    border-radius: 1px;
  }

  .connector.completed .connector-line {
    background: #10B981;
  }

  .connector.active .connector-line {
    background: linear-gradient(to bottom, #FFDD00, #E5E7EB);
  }

  .progress-summary {
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid #E5E7EB;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .summary-stats {
    display: flex;
    gap: 24px;
  }

  .stat-item {
    text-align: center;
  }

  .stat-value {
    display: block;
    font-size: 1.2rem;
    font-weight: 600;
    color: #333;
    margin-bottom: 2px;
  }

  .stat-label {
    display: block;
    font-size: 0.8rem;
    color: #666;
  }

  .time-summary {
    font-size: 0.9rem;
    color: #666;
  }

  .time-label {
    margin-right: 6px;
  }

  .time-value {
    font-weight: 500;
    color: #333;
  }

  .btn {
    padding: 4px 8px;
    border-radius: 4px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid transparent;
    font-size: 0.8rem;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-outline {
    background: white;
    color: #666;
    border-color: #D1D5DB;
  }

  .btn-outline:hover:not(:disabled) {
    background: #F9FAFB;
    border-color: #9CA3AF;
  }

  .btn-sm {
    padding: 3px 6px;
    font-size: 0.75rem;
  }

  @media (max-width: 768px) {
    .configuration-progress.detailed .progress-header {
      flex-direction: column;
      gap: 12px;
    }

    .progress-stats {
      flex-direction: column;
      gap: 4px;
    }

    .step-item {
      flex-direction: column;
      gap: 12px;
    }

    .step-header {
      flex-direction: column;
      gap: 4px;
    }

    .step-meta {
      justify-content: flex-start;
    }

    .details-grid {
      grid-template-columns: 1fr;
    }

    .progress-summary {
      flex-direction: column;
      gap: 16px;
    }

    .summary-stats {
      justify-content: center;
    }

    .compact-steps {
      flex-wrap: wrap;
      justify-content: center;
    }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}