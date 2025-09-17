/**
 * @fileoverview Assessment Configuration Modal
 * Primary interface for configuring AI-powered assessment checkpoints
 * @module features/deep-linking/client/components/AssessmentConfigurationModal
 */

import { useState, useEffect, useCallback, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { useCanvasAssignmentContext } from '../hooks/useCanvasAssignmentContext';
import { useAssessmentConfiguration } from '../hooks/useAssessmentConfiguration';
import { ConfigurationProgress } from './ConfigurationProgress';
import { ContentPlacementSelector } from './ContentPlacementSelector';
import { AssessmentTypeConfigurator } from './AssessmentTypeConfigurator';
import { AIQuestionReviewer } from './AIQuestionReviewer';
import { ErrorBoundary } from './shared/ErrorBoundaries';
import { LoadingStates } from './shared/LoadingStates';
import { ValidationMessages } from './shared/ValidationMessages';

/**
 * Configuration step definitions
 */
interface ConfigurationStep {
  id: 'context' | 'placement' | 'configuration' | 'review';
  title: string;
  description: string;
  isComplete: boolean;
  isActive: boolean;
  isAccessible: boolean;
}

/**
 * Assessment configuration modal props
 */
interface AssessmentConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  canvasContext: {
    sessionId: string;
    csrfToken: string;
    instructorId: string;
    courseId: string;
    assignmentId?: string;
    returnUrl: string;
    platformOrigin: string;
  };
  deepLinkingSettings: {
    acceptedTypes: string[];
    acceptMultiple: boolean;
  };
}

/**
 * Assessment Configuration Modal Component
 *
 * Primary interface launched from Canvas deep linking that provides:
 * - 4-step configuration workflow
 * - Canvas assignment context display
 * - Assessment placement and configuration
 * - AI question review and approval
 * - Content item generation for Canvas
 */
export function AssessmentConfigurationModal({
  isOpen,
  onClose,
  canvasContext,
  deepLinkingSettings,
}: AssessmentConfigurationModalProps): ReactElement | null {
  // State management
  const [currentStepId, setCurrentStepId] = useState<string>('context');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});

  // Custom hooks
  const {
    canvasAssignment,
    contentStructure,
    isLoading: canvasLoading,
    error: canvasError,
    refreshContext,
  } = useCanvasAssignmentContext(canvasContext.sessionId);

  const {
    configuration,
    placements,
    questions,
    isGenerating,
    updateConfiguration,
    addPlacement,
    updatePlacement,
    removePlacement,
    generateQuestions,
    approveQuestion,
    rejectQuestion,
    editQuestion,
    submitConfiguration,
  } = useAssessmentConfiguration(canvasContext.sessionId, canvasContext.csrfToken);

  // Configuration steps
  const [steps, setSteps] = useState<ConfigurationStep[]>([
    {
      id: 'context',
      title: 'Canvas Assignment Context',
      description: 'Review assignment details and content structure',
      isComplete: false,
      isActive: true,
      isAccessible: true,
    },
    {
      id: 'placement',
      title: 'Assessment Placement',
      description: 'Select where assessment checkpoints will appear',
      isComplete: false,
      isActive: false,
      isAccessible: false,
    },
    {
      id: 'configuration',
      title: 'Assessment Configuration',
      description: 'Configure assessment types and settings',
      isComplete: false,
      isActive: false,
      isAccessible: false,
    },
    {
      id: 'review',
      title: 'Review & Deploy',
      description: 'Review AI-generated questions and deploy to Canvas',
      isComplete: false,
      isActive: false,
      isAccessible: false,
    },
  ]);

  // Update step accessibility based on progress
  useEffect(() => {
    setSteps(prevSteps => prevSteps.map(step => {
      const isActive = step.id === currentStepId;
      let isComplete = false;
      let isAccessible = false;

      switch (step.id) {
        case 'context':
          isComplete = !!canvasAssignment && !canvasError;
          isAccessible = true;
          break;
        case 'placement':
          isComplete = placements.length > 0;
          isAccessible = !!canvasAssignment && !canvasError;
          break;
        case 'configuration':
          isComplete = placements.length > 0 && configuration.settings.assessmentType;
          isAccessible = placements.length > 0;
          break;
        case 'review':
          isComplete = questions.length > 0 && questions.every(q => q.reviewStatus !== 'pending');
          isAccessible = placements.length > 0 && configuration.settings.assessmentType;
          break;
      }

      return {
        ...step,
        isComplete,
        isActive,
        isAccessible,
      };
    }));
  }, [currentStepId, canvasAssignment, canvasError, placements, configuration, questions]);

  // Handle step navigation
  const handleStepChange = useCallback((stepId: string) => {
    const step = steps.find(s => s.id === stepId);
    if (step?.isAccessible) {
      setCurrentStepId(stepId);
      setError(null);
      setValidationErrors({});
    }
  }, [steps]);

  // Navigate to next step
  const handleNext = useCallback(async () => {
    const currentIndex = steps.findIndex(s => s.id === currentStepId);
    const currentStep = steps[currentIndex];

    // Validate current step before proceeding
    const validation = await validateCurrentStep();
    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return;
    }

    // Move to next step
    if (currentIndex < steps.length - 1) {
      const nextStep = steps[currentIndex + 1];
      if (nextStep.isAccessible) {
        setCurrentStepId(nextStep.id);
        setValidationErrors({});
      }
    }
  }, [currentStepId, steps]);

  // Navigate to previous step
  const handlePrevious = useCallback(() => {
    const currentIndex = steps.findIndex(s => s.id === currentStepId);
    if (currentIndex > 0) {
      setCurrentStepId(steps[currentIndex - 1].id);
      setValidationErrors({});
    }
  }, [currentStepId, steps]);

  // Validate current step
  const validateCurrentStep = useCallback(async (): Promise<{
    valid: boolean;
    errors: Record<string, string[]>;
  }> => {
    const errors: Record<string, string[]> = {};

    switch (currentStepId) {
      case 'context':
        if (!canvasAssignment) {
          errors.context = ['Canvas assignment context is required'];
        }
        if (canvasError) {
          errors.context = errors.context || [];
          errors.context.push('Failed to load Canvas assignment context');
        }
        break;

      case 'placement':
        if (placements.length === 0) {
          errors.placement = ['At least one assessment checkpoint placement is required'];
        }
        if (placements.length > 10) {
          errors.placement = ['Maximum 10 assessment checkpoints allowed'];
        }
        break;

      case 'configuration':
        if (!configuration.settings.assessmentType) {
          errors.configuration = ['Assessment type is required'];
        }
        if (!configuration.settings.difficulty) {
          errors.configuration = errors.configuration || [];
          errors.configuration.push('Difficulty level is required');
        }
        if (configuration.settings.masteryThreshold < 0.5 || configuration.settings.masteryThreshold > 1.0) {
          errors.configuration = errors.configuration || [];
          errors.configuration.push('Mastery threshold must be between 50% and 100%');
        }
        break;

      case 'review':
        if (questions.length === 0) {
          errors.review = ['At least one question must be generated'];
        }
        const pendingQuestions = questions.filter(q => q.reviewStatus === 'pending');
        if (pendingQuestions.length > 0) {
          errors.review = ['All questions must be reviewed before deployment'];
        }
        break;
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }, [currentStepId, canvasAssignment, canvasError, placements, configuration, questions]);

  // Handle final submission
  const handleSubmit = useCallback(async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      // Final validation
      const validation = await validateCurrentStep();
      if (!validation.valid) {
        setValidationErrors(validation.errors);
        return;
      }

      // Submit configuration to Canvas
      const result = await submitConfiguration({
        sessionId: canvasContext.sessionId,
        csrfToken: canvasContext.csrfToken,
        returnUrl: canvasContext.returnUrl,
      });

      if (result.success) {
        // Redirect to Canvas with content items
        window.location.href = result.redirectUrl;
      } else {
        setError(result.error || 'Failed to submit configuration');
      }
    } catch (err) {
      console.error('Configuration submission failed:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [validateCurrentStep, submitConfiguration, canvasContext]);

  // Handle modal close
  const handleClose = useCallback(() => {
    if (isSubmitting) return;

    const hasUnsavedChanges = placements.length > 0 || questions.length > 0;
    if (hasUnsavedChanges && !confirm('You have unsaved changes. Are you sure you want to close?')) {
      return;
    }

    onClose();
  }, [isSubmitting, placements, questions, onClose]);

  // Keyboard event handling
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      if (event.key === 'Escape' && !isSubmitting) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, handleClose]);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      const modal = document.getElementById('assessment-config-modal');
      modal?.focus();
    }
  }, [isOpen]);

  // Render step content
  const renderStepContent = (): ReactElement => {
    switch (currentStepId) {
      case 'context':
        return (
          <div className="context-step">
            <div className="canvas-context-header">
              <h3>📚 Canvas Assignment</h3>
              {canvasLoading ? (
                <LoadingStates.Spinner message="Loading Canvas assignment context..." />
              ) : canvasError ? (
                <div className="error-state">
                  <p>❌ Failed to load Canvas assignment context</p>
                  <button
                    onClick={refreshContext}
                    className="btn btn-outline"
                  >
                    Retry
                  </button>
                </div>
              ) : canvasAssignment ? (
                <div className="assignment-info">
                  <h4>{canvasAssignment.title}</h4>
                  <div className="assignment-meta">
                    <span>📖 Course: {canvasAssignment.courseName}</span>
                    <span>🎯 Points: {canvasAssignment.pointsPossible || 'Not set'}</span>
                    {canvasAssignment.dueAt && (
                      <span>📅 Due: {new Date(canvasAssignment.dueAt).toLocaleDateString()}</span>
                    )}
                  </div>
                  {canvasAssignment.description && (
                    <div className="assignment-description">
                      <h5>Assignment Description:</h5>
                      <div
                        dangerouslySetInnerHTML={{ __html: canvasAssignment.description }}
                        className="description-content"
                      />
                    </div>
                  )}

                  {contentStructure && (
                    <div className="content-structure">
                      <h5>📝 Content Structure Detected:</h5>
                      <ul>
                        {contentStructure.sections.map((section, index) => (
                          <li key={index}>
                            <strong>{section.type}:</strong> {section.title || section.text?.substring(0, 100)}...
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p>No Canvas assignment context available</p>
              )}
            </div>
          </div>
        );

      case 'placement':
        return (
          <ContentPlacementSelector
            canvasContent={contentStructure}
            existingPlacements={placements}
            onPlacementAdd={addPlacement}
            onPlacementUpdate={updatePlacement}
            onPlacementRemove={removePlacement}
            maxPlacements={10}
          />
        );

      case 'configuration':
        return (
          <AssessmentTypeConfigurator
            configuration={configuration}
            onConfigurationChange={updateConfiguration}
            canvasContentContext={{
              assignmentTitle: canvasAssignment?.title,
              courseLevel: canvasAssignment?.courseLevel || 'college',
              subject: canvasAssignment?.subject,
              learningObjectives: canvasAssignment?.learningObjectives || [],
            }}
            placementCount={placements.length}
          />
        );

      case 'review':
        return (
          <AIQuestionReviewer
            generatedQuestions={questions}
            isGenerating={isGenerating}
            onQuestionApprove={approveQuestion}
            onQuestionReject={rejectQuestion}
            onQuestionEdit={editQuestion}
            onGenerateQuestions={() => generateQuestions(placements, configuration)}
            showQualityMetrics={true}
          />
        );

      default:
        return <div>Unknown step</div>;
    }
  };

  // Don't render if not open
  if (!isOpen) return null;

  // Create portal for modal
  return createPortal(
    <ErrorBoundary>
      <div
        className="modal-overlay"
        onClick={(e) => e.target === e.currentTarget && handleClose()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div
          id="assessment-config-modal"
          className="modal-container"
          tabIndex={-1}
        >
          {/* Modal Header */}
          <div className="modal-header">
            <div className="header-content">
              <h1 id="modal-title">🎯 Assessment Configuration</h1>
              <p>Configure AI-powered assessment checkpoints for your Canvas assignment</p>
            </div>
            <button
              onClick={handleClose}
              className="close-button"
              aria-label="Close modal"
              disabled={isSubmitting}
            >
              ✕
            </button>
          </div>

          {/* Configuration Progress */}
          <div className="progress-section">
            <ConfigurationProgress
              steps={steps}
              currentStepId={currentStepId}
              onStepClick={handleStepChange}
              allowStepNavigation={!isSubmitting}
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="error-banner">
              <span>⚠️ {error}</span>
              <button onClick={() => setError(null)}>✕</button>
            </div>
          )}

          {/* Validation Errors */}
          <ValidationMessages
            errors={validationErrors}
            onDismiss={(field) => {
              setValidationErrors(prev => {
                const updated = { ...prev };
                delete updated[field];
                return updated;
              });
            }}
          />

          {/* Step Content */}
          <div className="step-content">
            {renderStepContent()}
          </div>

          {/* Modal Actions */}
          <div className="modal-actions">
            <div className="action-group">
              <button
                onClick={handleClose}
                className="btn btn-outline"
                disabled={isSubmitting}
              >
                Cancel
              </button>

              {currentStepId !== 'context' && (
                <button
                  onClick={handlePrevious}
                  className="btn btn-outline"
                  disabled={isSubmitting}
                >
                  ← Previous
                </button>
              )}
            </div>

            <div className="action-group">
              {currentStepId === 'review' ? (
                <button
                  onClick={handleSubmit}
                  className="btn btn-primary"
                  disabled={isSubmitting || !steps.find(s => s.id === 'review')?.isComplete}
                >
                  {isSubmitting ? 'Deploying...' : '🚀 Deploy to Canvas'}
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="btn btn-primary"
                  disabled={isSubmitting || !steps.find(s => s.id === currentStepId)?.isComplete}
                >
                  Continue →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>,
    document.body
  );
}

/**
 * CSS-in-JS styles for the modal
 */
const styles = `
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .modal-container {
    background: white;
    border-radius: 12px;
    box-shadow: var(--shadow-xlarge, 0 20px 40px rgba(0, 0, 0, 0.1));
    max-width: 1200px;
    width: 100%;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    background: linear-gradient(135deg, #FFDD00, #EBCB00);
    padding: 24px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1px solid #E5E7EB;
  }

  .header-content h1 {
    margin: 0 0 8px 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: #333;
  }

  .header-content p {
    margin: 0;
    color: #666;
    font-size: 0.9rem;
  }

  .close-button {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    color: #666;
    transition: all 0.2s;
  }

  .close-button:hover {
    background: rgba(0, 0, 0, 0.1);
    color: #333;
  }

  .close-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .progress-section {
    padding: 20px 24px;
    border-bottom: 1px solid #E5E7EB;
  }

  .error-banner {
    background: #FEF3F2;
    border: 1px solid #F87171;
    color: #B42318;
    padding: 12px 24px;
    margin: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .error-banner button {
    background: none;
    border: none;
    color: #B42318;
    cursor: pointer;
    font-size: 1.2rem;
  }

  .step-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }

  .context-step .canvas-context-header h3 {
    margin: 0 0 16px 0;
    color: #333;
  }

  .assignment-info h4 {
    margin: 0 0 12px 0;
    color: #333;
    font-size: 1.25rem;
  }

  .assignment-meta {
    display: flex;
    gap: 16px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }

  .assignment-meta span {
    background: #F3F4F6;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.85rem;
    color: #666;
  }

  .assignment-description {
    margin-top: 20px;
  }

  .assignment-description h5 {
    margin: 0 0 8px 0;
    color: #333;
    font-size: 1rem;
  }

  .description-content {
    background: #F9FAFB;
    padding: 12px;
    border-radius: 6px;
    border: 1px solid #E5E7EB;
    max-height: 200px;
    overflow-y: auto;
  }

  .content-structure {
    margin-top: 20px;
  }

  .content-structure h5 {
    margin: 0 0 12px 0;
    color: #333;
    font-size: 1rem;
  }

  .content-structure ul {
    margin: 0;
    padding-left: 20px;
  }

  .content-structure li {
    margin-bottom: 8px;
    color: #666;
  }

  .error-state {
    text-align: center;
    padding: 40px;
    color: #666;
  }

  .error-state button {
    margin-top: 16px;
  }

  .modal-actions {
    padding: 20px 24px;
    border-top: 1px solid #E5E7EB;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #F9FAFB;
  }

  .action-group {
    display: flex;
    gap: 12px;
  }

  .btn {
    padding: 10px 20px;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid transparent;
    font-size: 0.9rem;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #FFDD00;
    color: #333;
    border-color: #EBCB00;
  }

  .btn-primary:hover:not(:disabled) {
    background: #EBCB00;
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

  @media (max-width: 768px) {
    .modal-overlay {
      padding: 10px;
    }

    .modal-container {
      max-height: 95vh;
    }

    .modal-header {
      padding: 16px;
    }

    .header-content h1 {
      font-size: 1.25rem;
    }

    .step-content {
      padding: 16px;
    }

    .modal-actions {
      padding: 16px;
      flex-direction: column;
      gap: 12px;
    }

    .action-group {
      width: 100%;
      justify-content: center;
    }

    .assignment-meta {
      flex-direction: column;
      gap: 8px;
    }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}