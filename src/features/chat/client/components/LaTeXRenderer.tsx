import React, { useEffect, useRef, useState, useCallback } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import DOMPurify from 'dompurify';

interface LaTeXRendererProps {
  content: string;
  inline?: boolean;
  onLoad?: (loadTime: number) => void;
  onError?: (error: Error) => void;
  onInteraction?: () => void;
  className?: string;
}

export const LaTeXRenderer: React.FC<LaTeXRendererProps> = ({
  content,
  inline = false,
  onLoad,
  onError,
  onInteraction,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [_loadTime, setLoadTime] = useState<number>(0);

  const renderMath = useCallback(async () => {
    const startTime = Date.now();
    setIsLoading(true);
    setHasError(false);

    try {
      if (!containerRef.current) return;

      // Sanitize the LaTeX content to prevent XSS
      const sanitizedContent = DOMPurify.sanitize(content, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
      });

      // Render LaTeX with KaTeX
      const rendered = katex.renderToString(sanitizedContent, {
        displayMode: !inline,
        throwOnError: false,
        errorColor: '#dc3545',
        trust: false, // Security: don't allow \href and other potentially dangerous commands
        maxSize: 10, // Limit expansion size
        maxExpand: 1000, // Limit macro expansion
        strict: 'warn', // Warn about deprecated/non-standard LaTeX
      });

      // Sanitize the rendered HTML as well
      const sanitizedHTML = DOMPurify.sanitize(rendered, {
        ADD_TAGS: ['math', 'mi', 'mo', 'mn', 'mrow', 'msup', 'msub', 'mfrac', 'msqrt'], // Allow MathML
        ADD_ATTR: ['xmlns'],
      });

      containerRef.current.innerHTML = sanitizedHTML;

      const endTime = Date.now();
      const renderTime = endTime - startTime;
      setLoadTime(renderTime);
      onLoad?.(renderTime);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to render LaTeX';
      setHasError(true);
      setErrorMessage(errorMsg);
      onError?.(error instanceof Error ? error : new Error(errorMsg));

      // Fallback to plain text
      if (containerRef.current) {
        containerRef.current.innerHTML = `<code>${DOMPurify.sanitize(content)}</code>`;
      }
    } finally {
      setIsLoading(false);
    }
  }, [content, inline, onLoad, onError]);

  useEffect(() => {
    renderMath();
  }, [renderMath]);

  const handleCopyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      onInteraction?.();
    } catch (error) {
      console.error('Failed to copy LaTeX to clipboard:', error);
    }
  }, [content, onInteraction]);

  const handleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    // Create modal for fullscreen view
    const modal = document.createElement('div');
    modal.className = 'katex-fullscreen-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
      box-sizing: border-box;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      padding: 40px;
      border-radius: 8px;
      max-width: 90vw;
      max-height: 90vh;
      overflow: auto;
      position: relative;
    `;
    content.innerHTML = containerRef.current.innerHTML;

    const closeButton = document.createElement('button');
    closeButton.innerText = '×';
    closeButton.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      border: none;
      background: none;
      font-size: 24px;
      cursor: pointer;
      color: #666;
    `;
    closeButton.onclick = () => modal.remove();

    content.appendChild(closeButton);
    modal.appendChild(content);

    // Close on outside click
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    };

    document.body.appendChild(modal);
    onInteraction?.();
  }, [onInteraction]);

  if (isLoading) {
    return (
      <div className={`katex-loading ${className}`} style={{ minHeight: inline ? '1.2em' : '2em' }}>
        <div
          className="katex-skeleton"
          style={{
            background: '#f0f0f0',
            borderRadius: '4px',
            height: inline ? '1.2em' : '2em',
            width: inline ? '4em' : '100%',
            animation: 'katex-pulse 1.5s ease-in-out infinite',
          }}
        />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className={`katex-error ${className}`}>
        <div className="error-content" style={{ color: '#dc3545', fontSize: '0.9em' }}>
          <span>⚠️ Math rendering failed</span>
          <button
            onClick={() => renderMath()}
            style={{
              marginLeft: '8px',
              padding: '2px 8px',
              border: '1px solid #dc3545',
              background: 'white',
              color: '#dc3545',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.8em',
            }}
          >
            Retry
          </button>
        </div>
        {errorMessage && <div style={{ fontSize: '0.8em', color: '#6c757d', marginTop: '4px' }}>{errorMessage}</div>}
      </div>
    );
  }

  return (
    <div className={`katex-container ${inline ? 'katex-inline' : 'katex-display'} ${className}`}>
      <div ref={containerRef} onClick={onInteraction} style={{ cursor: inline ? 'default' : 'pointer' }} />

      {!inline && (
        <div
          className="katex-controls"
          style={{
            display: 'none',
            position: 'absolute',
            top: '4px',
            right: '4px',
            gap: '4px',
          }}
        >
          <button
            onClick={handleCopyToClipboard}
            title="Copy LaTeX to clipboard"
            style={{
              padding: '4px 8px',
              border: '1px solid #ccc',
              background: 'white',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Copy
          </button>
          <button
            onClick={handleFullscreen}
            title="View fullscreen"
            style={{
              padding: '4px 8px',
              border: '1px solid #ccc',
              background: 'white',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            ⛶
          </button>
        </div>
      )}

      <style>{`
        .katex-container {
          position: relative;
        }
        
        .katex-container:hover .katex-controls {
          display: flex !important;
        }
        
        .katex-display {
          margin: 16px 0;
          padding: 16px;
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        
        .katex-inline {
          display: inline-block;
          padding: 0 4px;
        }
        
        .katex-inline:hover {
          background: #e8f4fd;
          border-radius: 4px;
        }
        
        @keyframes katex-pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        
        @media (max-width: 768px) {
          .katex-display {
            overflow-x: auto;
            margin: 12px 0;
            padding: 12px;
          }
          
          .katex-fullscreen-modal > div {
            padding: 20px !important;
            max-width: 95vw !important;
          }
        }
        
        /* High contrast mode support */
        @media (prefers-contrast: high) {
          .katex-display {
            border: 2px solid #000;
          }
          
          .katex-inline:hover {
            background: #000;
            color: #fff;
          }
        }
        
        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          .katex-skeleton {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default LaTeXRenderer;
