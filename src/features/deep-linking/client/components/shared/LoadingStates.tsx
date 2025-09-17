/**
 * @fileoverview Loading States Component
 * Reusable loading indicators for the deep linking interface
 * @module features/deep-linking/client/components/shared/LoadingStates
 */

import type { ReactElement } from 'react';

/**
 * Loading spinner props
 */
interface SpinnerProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
  className?: string;
}

/**
 * Progress bar props
 */
interface ProgressBarProps {
  progress: number; // 0-100
  message?: string;
  className?: string;
}

/**
 * Skeleton loader props
 */
interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  lines?: number;
  className?: string;
}

/**
 * Loading States Component Collection
 *
 * Provides consistent loading indicators throughout the deep linking interface:
 * - Spinner for general loading states
 * - Progress bar for tracked operations
 * - Skeleton loaders for content placeholders
 */
export const LoadingStates = {
  /**
   * Animated spinner component
   */
  Spinner: ({
    size = 'medium',
    message,
    className = '',
  }: SpinnerProps): ReactElement => {
    const sizeClasses = {
      small: 'spinner-small',
      medium: 'spinner-medium',
      large: 'spinner-large',
    };

    return (
      <div className={`loading-spinner ${className}`.trim()}>
        <div className={`spinner ${sizeClasses[size]}`} />
        {message && <p className="loading-message">{message}</p>}
      </div>
    );
  },

  /**
   * Progress bar component
   */
  ProgressBar: ({
    progress,
    message,
    className = '',
  }: ProgressBarProps): ReactElement => {
    const clampedProgress = Math.min(Math.max(progress, 0), 100);

    return (
      <div className={`loading-progress ${className}`.trim()}>
        {message && <p className="progress-message">{message}</p>}
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${clampedProgress}%` }}
            role="progressbar"
            aria-valuenow={clampedProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={message || `Progress: ${clampedProgress}%`}
          />
        </div>
        <span className="progress-text">{Math.round(clampedProgress)}%</span>
      </div>
    );
  },

  /**
   * Skeleton loader component
   */
  Skeleton: ({
    width = '100%',
    height = '1rem',
    lines = 1,
    className = '',
  }: SkeletonProps): ReactElement => {
    const skeletonStyle = {
      width: typeof width === 'number' ? `${width}px` : width,
      height: typeof height === 'number' ? `${height}px` : height,
    };

    if (lines === 1) {
      return (
        <div
          className={`skeleton-loader ${className}`.trim()}
          style={skeletonStyle}
        />
      );
    }

    return (
      <div className={`skeleton-container ${className}`.trim()}>
        {Array.from({ length: lines }, (_, index) => (
          <div
            key={index}
            className="skeleton-loader skeleton-line"
            style={{
              ...skeletonStyle,
              width: index === lines - 1 ? '70%' : skeletonStyle.width,
            }}
          />
        ))}
      </div>
    );
  },

  /**
   * Canvas content loading placeholder
   */
  CanvasContentLoader: (): ReactElement => (
    <div className="canvas-content-loader">
      <div className="content-header-skeleton">
        <LoadingStates.Skeleton width="60%" height="1.5rem" />
        <LoadingStates.Skeleton width="40%" height="1rem" />
      </div>

      <div className="content-body-skeleton">
        <LoadingStates.Skeleton lines={3} />
        <div className="skeleton-spacer" />
        <LoadingStates.Skeleton width="80%" height="1rem" />
        <LoadingStates.Skeleton width="90%" height="1rem" />
        <div className="skeleton-spacer" />
        <LoadingStates.Skeleton lines={2} />
      </div>

      <div className="content-footer-skeleton">
        <LoadingStates.Skeleton width="25%" height="0.875rem" />
        <LoadingStates.Skeleton width="30%" height="0.875rem" />
      </div>
    </div>
  ),

  /**
   * Assessment generation loading indicator
   */
  AssessmentGenerationLoader: ({
    stage = 'Analyzing content',
    progress,
  }: {
    stage?: string;
    progress?: number;
  }): ReactElement => (
    <div className="assessment-generation-loader">
      <div className="generation-icon">🤖</div>
      <h3>AI Assessment Generation</h3>
      <p className="generation-stage">{stage}...</p>

      {progress !== undefined ? (
        <LoadingStates.ProgressBar progress={progress} />
      ) : (
        <LoadingStates.Spinner size="medium" />
      )}

      <div className="generation-steps">
        <div className="step">📖 Analyzing Canvas content</div>
        <div className="step">🎯 Generating relevant questions</div>
        <div className="step">✨ Applying educational best practices</div>
        <div className="step">🔍 Quality validation</div>
      </div>
    </div>
  ),

  /**
   * Configuration saving loader
   */
  ConfigurationSavingLoader: (): ReactElement => (
    <div className="configuration-saving-loader">
      <LoadingStates.Spinner size="large" />
      <h3>Saving Configuration</h3>
      <p>Creating your assessment configuration...</p>

      <div className="saving-steps">
        <div className="saving-step">💾 Saving assessment settings</div>
        <div className="saving-step">🔗 Generating Canvas content items</div>
        <div className="saving-step">🔐 Signing deep linking response</div>
        <div className="saving-step">🚀 Preparing for deployment</div>
      </div>
    </div>
  ),
};

/**
 * CSS styles for loading components
 */
const styles = `
  .loading-spinner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px;
  }

  .spinner {
    border: 3px solid #f3f3f3;
    border-top: 3px solid #FFDD00;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .spinner-small {
    width: 20px;
    height: 20px;
    border-width: 2px;
  }

  .spinner-medium {
    width: 32px;
    height: 32px;
  }

  .spinner-large {
    width: 48px;
    height: 48px;
    border-width: 4px;
  }

  .loading-message {
    margin: 0;
    color: #666;
    font-size: 0.9rem;
    text-align: center;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .loading-progress {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  .progress-message {
    margin: 0;
    color: #666;
    font-size: 0.9rem;
    text-align: center;
  }

  .progress-bar {
    width: 100%;
    height: 8px;
    background: #E5E7EB;
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #FFDD00, #EBCB00);
    transition: width 0.3s ease;
    border-radius: 4px;
  }

  .progress-text {
    align-self: center;
    font-size: 0.8rem;
    color: #666;
    font-weight: 500;
  }

  .skeleton-loader {
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: skeleton-loading 1.5s infinite;
    border-radius: 4px;
  }

  .skeleton-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .skeleton-line {
    height: 1rem;
  }

  @keyframes skeleton-loading {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  .canvas-content-loader {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .content-header-skeleton {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .content-body-skeleton {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .skeleton-spacer {
    height: 12px;
  }

  .content-footer-skeleton {
    display: flex;
    gap: 16px;
  }

  .assessment-generation-loader {
    text-align: center;
    padding: 40px;
    max-width: 400px;
    margin: 0 auto;
  }

  .generation-icon {
    font-size: 3rem;
    margin-bottom: 16px;
  }

  .assessment-generation-loader h3 {
    margin: 0 0 8px 0;
    color: #333;
    font-size: 1.25rem;
  }

  .generation-stage {
    margin: 0 0 24px 0;
    color: #666;
    font-size: 1rem;
  }

  .generation-steps {
    margin-top: 24px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    text-align: left;
  }

  .step {
    padding: 8px 12px;
    background: #F9FAFB;
    border-radius: 6px;
    font-size: 0.9rem;
    color: #666;
    border-left: 3px solid #E5E7EB;
  }

  .configuration-saving-loader {
    text-align: center;
    padding: 40px;
    max-width: 400px;
    margin: 0 auto;
  }

  .configuration-saving-loader h3 {
    margin: 16px 0 8px 0;
    color: #333;
    font-size: 1.25rem;
  }

  .configuration-saving-loader p {
    margin: 0 0 24px 0;
    color: #666;
  }

  .saving-steps {
    margin-top: 24px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    text-align: left;
  }

  .saving-step {
    padding: 8px 12px;
    background: #F3E8FF;
    border-radius: 6px;
    font-size: 0.9rem;
    color: #7C3AED;
    border-left: 3px solid #A855F7;
  }

  @media (max-width: 768px) {
    .loading-spinner {
      padding: 16px;
    }

    .canvas-content-loader {
      padding: 16px;
    }

    .assessment-generation-loader,
    .configuration-saving-loader {
      padding: 24px 16px;
    }

    .generation-icon {
      font-size: 2.5rem;
    }

    .generation-steps,
    .saving-steps {
      text-align: center;
    }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}