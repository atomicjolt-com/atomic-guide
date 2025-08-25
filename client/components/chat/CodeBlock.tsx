import React, { useEffect, useRef, useState, useCallback } from 'react';
import Prism from 'prismjs';
import 'prismjs/themes/prism.css';
import 'prismjs/themes/prism-dark.css';
// Import common language components
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-bash';
import DOMPurify from 'dompurify';

interface CodeBlockProps {
  content: string;
  language?: string;
  theme?: 'light' | 'dark';
  onLoad?: (loadTime: number) => void;
  onError?: (error: Error) => void;
  onInteraction?: (action: 'copy' | 'fullscreen') => void;
  className?: string;
  showLineNumbers?: boolean;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  content,
  language = 'text',
  theme = 'light',
  onLoad,
  onError,
  onInteraction,
  className = '',
  showLineNumbers = true
}) => {
  const codeRef = useRef<HTMLElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [detectedLanguage, setDetectedLanguage] = useState<string>(language);
  const [copied, setCopied] = useState(false);
  const [loadTime, setLoadTime] = useState<number>(0);

  // Language detection heuristics
  const detectLanguage = useCallback((code: string): string => {
    if (language && language !== 'text') return language;
    
    // Simple language detection based on common patterns
    if (code.includes('function ') || code.includes('const ') || code.includes('let ')) return 'javascript';
    if (code.includes('def ') || code.includes('import ') || code.includes('print(')) return 'python';
    if (code.includes('public class ') || code.includes('public static void')) return 'java';
    if (code.includes('#include') || code.includes('int main(')) return 'cpp';
    if (code.includes('SELECT ') || code.includes('FROM ') || code.includes('WHERE ')) return 'sql';
    if (code.includes('<?php') || code.includes('$')) return 'php';
    if (code.includes('interface ') && code.includes(': ')) return 'typescript';
    
    return 'text';
  }, [language]);

  const highlightCode = useCallback(async () => {
    const startTime = Date.now();
    setIsLoading(true);
    setHasError(false);

    try {
      if (!codeRef.current) return;

      // Sanitize the code content
      const sanitizedContent = DOMPurify.sanitize(content, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: []
      });

      const lang = detectLanguage(sanitizedContent);
      setDetectedLanguage(lang);

      // Check if language is supported by Prism
      const grammar = Prism.languages[lang];
      if (!grammar && lang !== 'text') {
        console.warn(`Language '${lang}' not supported by Prism, falling back to plain text`);
      }

      // Highlight the code
      let highlightedCode;
      if (grammar) {
        highlightedCode = Prism.highlight(sanitizedContent, grammar, lang);
      } else {
        highlightedCode = sanitizedContent;
      }

      // Sanitize the highlighted HTML
      const sanitizedHTML = DOMPurify.sanitize(highlightedCode, {
        ALLOWED_TAGS: ['span', 'br'],
        ALLOWED_ATTR: ['class']
      });

      codeRef.current.innerHTML = sanitizedHTML;
      
      // Add line numbers if requested
      if (showLineNumbers) {
        codeRef.current.classList.add('line-numbers');
      }

      const endTime = Date.now();
      const renderTime = endTime - startTime;
      setLoadTime(renderTime);
      onLoad?.(renderTime);
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to highlight code';
      setHasError(true);
      setErrorMessage(errorMsg);
      onError?.(error instanceof Error ? error : new Error(errorMsg));
      
      // Fallback to plain text
      if (codeRef.current) {
        codeRef.current.innerHTML = DOMPurify.sanitize(content);
      }
    } finally {
      setIsLoading(false);
    }
  }, [content, detectLanguage, showLineNumbers, onLoad, onError]);

  useEffect(() => {
    highlightCode();
  }, [highlightCode]);

  const handleCopyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      onInteraction?.('copy');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code to clipboard:', error);
    }
  }, [content, onInteraction]);

  const handleFullscreen = useCallback(() => {
    if (!codeRef.current) return;
    
    // Create modal for fullscreen view
    const modal = document.createElement('div');
    modal.className = 'code-fullscreen-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
      box-sizing: border-box;
    `;

    const container = document.createElement('div');
    container.style.cssText = `
      background: ${theme === 'dark' ? '#1e1e1e' : '#f7f9fc'};
      padding: 20px;
      border-radius: 8px;
      max-width: 95vw;
      max-height: 95vh;
      overflow: auto;
      position: relative;
      font-family: 'Fira Code', 'Courier New', monospace;
      font-size: 14px;
      line-height: 1.6;
    `;

    const codeElement = document.createElement('code');
    codeElement.innerHTML = codeRef.current.innerHTML;
    codeElement.className = codeRef.current.className;

    const closeButton = document.createElement('button');
    closeButton.innerText = '×';
    closeButton.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      border: none;
      background: rgba(255, 255, 255, 0.8);
      font-size: 24px;
      cursor: pointer;
      color: #333;
      border-radius: 4px;
      width: 32px;
      height: 32px;
    `;
    closeButton.onclick = () => modal.remove();

    container.appendChild(codeElement);
    container.appendChild(closeButton);
    modal.appendChild(container);
    
    // Close on outside click
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    };

    // Close on escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    document.body.appendChild(modal);
    onInteraction?.('fullscreen');
  }, [theme, onInteraction]);

  if (isLoading) {
    return (
      <div className={`code-loading ${className}`}>
        <div className="code-header" style={{
          background: theme === 'dark' ? '#2d2d2d' : '#f0f0f0',
          padding: '8px 12px',
          borderRadius: '8px 8px 0 0',
          fontSize: '12px',
          color: theme === 'dark' ? '#ccc' : '#666',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>Loading...</span>
        </div>
        <div className="code-skeleton" style={{
          background: theme === 'dark' ? '#1e1e1e' : '#f7f9fc',
          borderRadius: '0 0 8px 8px',
          height: '120px',
          padding: '16px',
          animation: 'code-pulse 1.5s ease-in-out infinite'
        }}>
          <div style={{ background: theme === 'dark' ? '#333' : '#ddd', height: '1em', marginBottom: '8px', borderRadius: '2px' }} />
          <div style={{ background: theme === 'dark' ? '#333' : '#ddd', height: '1em', marginBottom: '8px', borderRadius: '2px', width: '80%' }} />
          <div style={{ background: theme === 'dark' ? '#333' : '#ddd', height: '1em', marginBottom: '8px', borderRadius: '2px', width: '60%' }} />
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className={`code-error ${className}`}>
        <div className="code-header" style={{
          background: '#f8d7da',
          border: '1px solid #f5c6cb',
          padding: '8px 12px',
          borderRadius: '8px 8px 0 0',
          fontSize: '12px',
          color: '#721c24'
        }}>
          <span>⚠️ Code highlighting failed</span>
          <button 
            onClick={() => highlightCode()} 
            style={{ 
              marginLeft: '8px', 
              padding: '2px 8px', 
              border: '1px solid #dc3545', 
              background: 'white', 
              color: '#dc3545',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '10px'
            }}
          >
            Retry
          </button>
        </div>
        <pre style={{
          background: '#f8f9fa',
          border: '1px solid #f5c6cb',
          borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          padding: '16px',
          margin: 0,
          fontSize: '14px',
          fontFamily: '"Fira Code", "Courier New", monospace',
          lineHeight: '1.6',
          overflow: 'auto'
        }}>
          <code>{content}</code>
        </pre>
        {errorMessage && (
          <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '4px', padding: '0 12px' }}>
            {errorMessage}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`code-block ${theme === 'dark' ? 'code-dark' : 'code-light'} ${className}`}>
      <div className="code-header" style={{
        background: theme === 'dark' ? '#2d2d2d' : '#f0f0f0',
        padding: '8px 12px',
        borderRadius: '8px 8px 0 0',
        fontSize: '12px',
        color: theme === 'dark' ? '#ccc' : '#666',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        border: '1px solid',
        borderColor: theme === 'dark' ? '#444' : '#e1e4e8',
        borderBottom: 'none'
      }}>
        <span>{detectedLanguage}</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleCopyToClipboard}
            style={{
              padding: '4px 8px',
              border: '1px solid',
              borderColor: theme === 'dark' ? '#555' : '#ccc',
              background: theme === 'dark' ? '#1e1e1e' : 'white',
              color: theme === 'dark' ? '#ccc' : '#666',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '10px'
            }}
            title="Copy to clipboard"
          >
            {copied ? '✓' : 'Copy'}
          </button>
          <button
            onClick={handleFullscreen}
            style={{
              padding: '4px 8px',
              border: '1px solid',
              borderColor: theme === 'dark' ? '#555' : '#ccc',
              background: theme === 'dark' ? '#1e1e1e' : 'white',
              color: theme === 'dark' ? '#ccc' : '#666',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '10px'
            }}
            title="View fullscreen"
          >
            ⛶
          </button>
        </div>
      </div>
      
      <pre style={{
        background: theme === 'dark' ? '#1e1e1e' : '#f7f9fc',
        border: '1px solid',
        borderColor: theme === 'dark' ? '#444' : '#e1e4e8',
        borderTop: 'none',
        borderRadius: '0 0 8px 8px',
        padding: '16px',
        margin: 0,
        fontSize: '14px',
        fontFamily: '"Fira Code", "Courier New", monospace',
        lineHeight: '1.6',
        overflow: 'auto',
        color: theme === 'dark' ? '#f8f8f2' : '#24292e'
      }}>
        <code 
          ref={codeRef}
          className={`language-${detectedLanguage}`}
        />
      </pre>
      
      <style>{`
        @keyframes code-pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        
        /* Mobile responsive adjustments */
        @media (max-width: 768px) {
          .code-block {
            margin: 12px 0;
          }
          
          .code-block pre {
            font-size: 12px !important;
            padding: 12px !important;
          }
          
          .code-header button {
            padding: 6px 12px !important;
            font-size: 12px !important;
            min-width: 44px;
            min-height: 44px;
          }
        }
        
        /* High contrast mode support */
        @media (prefers-contrast: high) {
          .code-light {
            border: 2px solid #000 !important;
          }
          
          .code-dark {
            border: 2px solid #fff !important;
          }
          
          .code-header {
            border-width: 2px !important;
          }
        }
        
        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          .code-skeleton > div {
            animation: none !important;
          }
        }
        
        /* Print styles */
        @media print {
          .code-header button {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default CodeBlock;