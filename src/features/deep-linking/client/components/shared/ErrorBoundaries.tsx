/**
 * @fileoverview Error Boundary Components
 * React error boundaries for graceful error handling in deep linking interface
 * @module features/deep-linking/client/components/shared/ErrorBoundaries
 */

import { Component, type ReactNode, type ReactElement } from 'react';

/**
 * Error boundary state interface
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: { componentStack: string } | null;
}

/**
 * Error boundary props interface
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactElement;
  onError?: (error: Error, errorInfo: { componentStack: string }) => void;
  className?: string;
}

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the component tree and displays
 * a fallback UI instead of crashing the entire deep linking interface.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * Catch errors during rendering
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  /**
   * Log error details and call error handler
   */
  componentDidCatch(error: Error, errorInfo: { componentStack: string }): void {
    console.error('Error Boundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to monitoring service in production
    this.logErrorToService(error, errorInfo);
  }

  /**
   * Logs error to monitoring service
   */
  private logErrorToService(error: Error, errorInfo: { componentStack: string }): void {
    try {
      // In production, integrate with error monitoring service
      const errorData = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        sessionId: (window as any).LAUNCH_SETTINGS?.sessionId,
      };

      // Log to console for development
      console.error('Deep Linking Error:', errorData);

      // TODO: Send to error monitoring service
      // errorMonitoringService.captureException(error, errorData);
    } catch (loggingError) {
      console.error('Failed to log error:', loggingError);
    }
  }

  /**
   * Resets error boundary state
   */
  resetErrorBoundary = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className={`error-boundary ${this.props.className || ''}`.trim()}>
          <div className="error-content">
            <div className="error-icon">⚠️</div>
            <h2>Something went wrong</h2>
            <p>
              We encountered an unexpected error while configuring your assessment.
              Please try again or contact support if the problem persists.
            </p>

            <div className="error-actions">
              <button
                onClick={this.resetErrorBoundary}
                className="btn btn-primary"
              >
                Try Again
              </button>

              <button
                onClick={() => window.location.reload()}
                className="btn btn-outline"
              >
                Reload Page
              </button>
            </div>

            {/* Show error details in development */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="error-details">
                <summary>Error Details (Development Only)</summary>
                <div className="error-stack">
                  <h4>Error Message:</h4>
                  <pre>{this.state.error.message}</pre>

                  <h4>Stack Trace:</h4>
                  <pre>{this.state.error.stack}</pre>

                  {this.state.errorInfo && (
                    <>
                      <h4>Component Stack:</h4>
                      <pre>{this.state.errorInfo.componentStack}</pre>
                    </>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Specific error boundary for Canvas integration errors
 */
export function CanvasIntegrationErrorBoundary({
  children,
  onRetry,
}: {
  children: ReactNode;
  onRetry?: () => void;
}): ReactElement {
  return (
    <ErrorBoundary
      fallback={
        <div className="canvas-error-boundary">
          <div className="error-content">
            <div className="error-icon">🔗</div>
            <h3>Canvas Integration Error</h3>
            <p>
              We're having trouble connecting to Canvas. This might be a temporary
              network issue or a Canvas configuration problem.
            </p>

            <div className="error-suggestions">
              <h4>Try these solutions:</h4>
              <ul>
                <li>Check your internet connection</li>
                <li>Verify you're logged into Canvas</li>
                <li>Make sure Canvas isn't experiencing downtime</li>
                <li>Try refreshing the page</li>
              </ul>
            </div>

            <div className="error-actions">
              {onRetry && (
                <button onClick={onRetry} className="btn btn-primary">
                  Retry Connection
                </button>
              )}

              <button
                onClick={() => window.location.reload()}
                className="btn btn-outline"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      }
      className="canvas-integration-error"
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Error boundary for AI-related operations
 */
export function AIOperationErrorBoundary({
  children,
  onRetry,
}: {
  children: ReactNode;
  onRetry?: () => void;
}): ReactElement {
  return (
    <ErrorBoundary
      fallback={
        <div className="ai-error-boundary">
          <div className="error-content">
            <div className="error-icon">🤖</div>
            <h3>AI Service Error</h3>
            <p>
              Our AI assessment generation service encountered an error.
              This is usually temporary and can be resolved by trying again.
            </p>

            <div className="error-suggestions">
              <h4>What you can do:</h4>
              <ul>
                <li>Wait a moment and try generating questions again</li>
                <li>Simplify your assessment configuration</li>
                <li>Check your Canvas content for unusual formatting</li>
                <li>Contact support if the issue persists</li>
              </ul>
            </div>

            <div className="error-actions">
              {onRetry && (
                <button onClick={onRetry} className="btn btn-primary">
                  Try Again
                </button>
              )}

              <button
                onClick={() => window.location.reload()}
                className="btn btn-outline"
              >
                Start Over
              </button>
            </div>
          </div>
        </div>
      }
      className="ai-operation-error"
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * CSS styles for error boundaries
 */
const styles = `
  .error-boundary {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    padding: 40px 20px;
    background: #FEFEFE;
    border: 1px solid #E5E7EB;
    border-radius: 8px;
    margin: 20px;
  }

  .error-content {
    text-align: center;
    max-width: 500px;
  }

  .error-icon {
    font-size: 3rem;
    margin-bottom: 16px;
  }

  .error-boundary h2,
  .error-boundary h3 {
    margin: 0 0 12px 0;
    color: #333;
    font-weight: 600;
  }

  .error-boundary h2 {
    font-size: 1.5rem;
  }

  .error-boundary h3 {
    font-size: 1.25rem;
  }

  .error-boundary p {
    margin: 0 0 24px 0;
    color: #666;
    line-height: 1.5;
  }

  .error-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .error-suggestions {
    text-align: left;
    margin: 24px 0;
    padding: 16px;
    background: #F9FAFB;
    border-radius: 6px;
    border-left: 3px solid #FFDD00;
  }

  .error-suggestions h4 {
    margin: 0 0 12px 0;
    color: #333;
    font-size: 1rem;
  }

  .error-suggestions ul {
    margin: 0;
    padding-left: 20px;
  }

  .error-suggestions li {
    margin-bottom: 6px;
    color: #666;
  }

  .error-details {
    margin-top: 24px;
    text-align: left;
    background: #F3F4F6;
    border-radius: 6px;
    overflow: hidden;
  }

  .error-details summary {
    padding: 12px 16px;
    background: #E5E7EB;
    cursor: pointer;
    font-weight: 500;
    color: #374151;
  }

  .error-details summary:hover {
    background: #D1D5DB;
  }

  .error-stack {
    padding: 16px;
  }

  .error-stack h4 {
    margin: 16px 0 8px 0;
    color: #374151;
    font-size: 0.9rem;
  }

  .error-stack h4:first-child {
    margin-top: 0;
  }

  .error-stack pre {
    background: #1F2937;
    color: #F9FAFB;
    padding: 12px;
    border-radius: 4px;
    font-size: 0.8rem;
    overflow-x: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .canvas-error-boundary,
  .ai-error-boundary {
    background: #FEF3F2;
    border-color: #F87171;
  }

  .canvas-error-boundary .error-icon {
    color: #DC2626;
  }

  .ai-error-boundary .error-icon {
    color: #7C3AED;
  }

  .btn {
    padding: 10px 20px;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid transparent;
    font-size: 0.9rem;
    text-decoration: none;
    display: inline-block;
  }

  .btn-primary {
    background: #FFDD00;
    color: #333;
    border-color: #EBCB00;
  }

  .btn-primary:hover {
    background: #EBCB00;
  }

  .btn-outline {
    background: white;
    color: #666;
    border-color: #D1D5DB;
  }

  .btn-outline:hover {
    background: #F9FAFB;
    border-color: #9CA3AF;
  }

  @media (max-width: 768px) {
    .error-boundary {
      margin: 10px;
      padding: 24px 16px;
      min-height: 250px;
    }

    .error-content {
      max-width: 100%;
    }

    .error-icon {
      font-size: 2.5rem;
    }

    .error-boundary h2 {
      font-size: 1.25rem;
    }

    .error-boundary h3 {
      font-size: 1.1rem;
    }

    .error-actions {
      flex-direction: column;
      align-items: center;
    }

    .error-actions .btn {
      width: 100%;
      max-width: 200px;
    }

    .error-suggestions {
      text-align: center;
    }

    .error-suggestions ul {
      text-align: left;
    }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}