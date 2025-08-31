import React, { useState, useCallback, useEffect, type ReactElement } from 'react';
import { useInView } from 'react-intersection-observer';
import LaTeXRenderer from './LaTeXRenderer';
import CodeBlock from './CodeBlock';
import type { RichMediaContent, MediaPreferences, ChatMessage } from '../../types';
import DOMPurify from 'dompurify';

interface RichMessageProps {
  message: ChatMessage;
  learnerPreferences: MediaPreferences;
  onMediaLoad?: (type: string, loadTime: number) => void;
  onMediaInteraction?: (type: string, action: string) => void;
  onMediaError?: (type: string, error: Error) => void;
  className?: string;
}

export const RichMessage: React.FC<RichMessageProps> = ({
  message,
  learnerPreferences,
  onMediaLoad,
  onMediaInteraction,
  onMediaError,
  className = ''
}) => {
  const [loadedMedia, setLoadedMedia] = useState<Set<string>>(new Set());
  const [mediaErrors, setMediaErrors] = useState<Map<string, string>>(new Map());
  const [totalLoadTime, setTotalLoadTime] = useState<number>(0);
  const [bandwidth, setBandwidth] = useState<'high' | 'medium' | 'low'>('high');
  
  // Intersection observer for progressive loading
  const { ref, inView } = useInView({
    threshold: 0,
    triggerOnce: true,
    rootMargin: '200px' // Load 200px before viewport
  });

  // Detect bandwidth (simplified)
  useEffect(() => {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (connection) {
      const effectiveType = connection.effectiveType;
      if (effectiveType === '4g' || connection.downlink > 10) {
        setBandwidth('high');
      } else if (effectiveType === '3g' || connection.downlink > 2) {
        setBandwidth('medium');
      } else {
        setBandwidth('low');
      }
    } else {
      // Fallback to user preference
      setBandwidth(learnerPreferences.bandwidth_preference);
    }
  }, [learnerPreferences.bandwidth_preference]);

  const handleMediaLoad = useCallback((type: string, loadTime: number) => {
    setLoadedMedia(prev => new Set(prev).add(type));
    setTotalLoadTime(prev => prev + loadTime);
    onMediaLoad?.(type, loadTime);
  }, [onMediaLoad]);

  const handleMediaError = useCallback((type: string, error: Error) => {
    setMediaErrors(prev => new Map(prev).set(type, error.message));
    onMediaError?.(type, error);
  }, [onMediaError]);

  const handleMediaInteraction = useCallback((type: string, action: string) => {
    onMediaInteraction?.(type, action);
  }, [onMediaInteraction]);

  // Process text content to identify and replace inline LaTeX
  const processTextContent = useCallback((text: string) => {
    if (!learnerPreferences.prefers_visual || learnerPreferences.math_notation_style === 'ascii') {
      return { processedText: text, inlineElements: [] };
    }

    const inlineElements: ReactElement[] = [];
    let processedText = text;
    let elementIndex = 0;

    // Replace inline LaTeX (single $ delimiters)
    processedText = processedText.replace(/\$([^$]+)\$/g, (_, latex) => {
      const placeholder = `__INLINE_LATEX_${elementIndex}__`;
      inlineElements.push(
        <LaTeXRenderer
          key={`inline-${elementIndex}`}
          content={latex}
          inline={true}
          onLoad={(time) => handleMediaLoad('latex-inline', time)}
          onError={(error) => handleMediaError('latex-inline', error)}
          onInteraction={() => handleMediaInteraction('latex', 'click')}
        />
      );
      elementIndex++;
      return placeholder;
    });

    return { processedText, inlineElements };
  }, [learnerPreferences, handleMediaLoad, handleMediaError, handleMediaInteraction]);

  const renderTextWithInlineMedia = (text: string) => {
    const { processedText, inlineElements } = processTextContent(text);
    
    if (inlineElements.length === 0) {
      return <span>{text}</span>;
    }

    const parts = processedText.split(/(__INLINE_LATEX_\d+__)/);
    return (
      <span>
        {parts.map((part, index) => {
          const match = part.match(/__INLINE_LATEX_(\d+)__/);
          if (match) {
            const elementIndex = parseInt(match[1]);
            return inlineElements[elementIndex];
          }
          return <span key={index}>{part}</span>;
        })}
      </span>
    );
  };

  const renderRichMedia = (media: RichMediaContent, index: number) => {
    // Progressive loading based on bandwidth and viewport
    if (!inView && bandwidth === 'low') {
      return (
        <div key={`${media.type}-${index}`} className="media-placeholder" style={{
          background: '#f0f0f0',
          padding: '16px',
          borderRadius: '8px',
          textAlign: 'center',
          margin: '8px 0'
        }}>
          <p>📄 {media.type.charAt(0).toUpperCase() + media.type.slice(1)} content available</p>
          <button 
            onClick={() => setLoadedMedia(prev => new Set(prev).add(`${media.type}-${index}`))}
            style={{
              padding: '8px 16px',
              border: '1px solid #0052cc',
              background: 'white',
              color: '#0052cc',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Load {media.type}
          </button>
        </div>
      );
    }

    const mediaKey = `${media.type}-${index}`;
    
    switch (media.type) {
      case 'latex':
        return (
          <LaTeXRenderer
            key={mediaKey}
            content={media.content}
            inline={media.metadata?.inline || false}
            onLoad={(time) => handleMediaLoad('latex', time)}
            onError={(error) => handleMediaError('latex', error)}
            onInteraction={() => handleMediaInteraction('latex', 'interact')}
            className="rich-media-latex"
          />
        );

      case 'code':
        return (
          <CodeBlock
            key={mediaKey}
            content={media.content}
            language={media.metadata?.language}
            theme={learnerPreferences.code_highlight_theme}
            onLoad={(time) => handleMediaLoad('code', time)}
            onError={(error) => handleMediaError('code', error)}
            onInteraction={(action) => handleMediaInteraction('code', action)}
            className="rich-media-code"
            showLineNumbers={true}
          />
        );

      case 'diagram':
        return (
          <div key={mediaKey} className="rich-media-diagram" style={{
            margin: '16px 0',
            padding: '16px',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            textAlign: 'center',
            background: 'white'
          }}>
            {media.content.startsWith('http') ? (
              <img
                src={media.content}
                alt={media.metadata?.complexity === 'beginner' ? 'Simple diagram' : 'Detailed diagram'}
                style={{
                  maxWidth: '100%',
                  height: 'auto',
                  borderRadius: '4px'
                }}
                onLoad={() => handleMediaLoad('diagram', 0)}
                onError={() => handleMediaError('diagram', new Error('Failed to load image'))}
                onClick={() => handleMediaInteraction('diagram', 'click')}
              />
            ) : (
              // For text-based diagrams or SVG content
              <div
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(media.content, {
                    ALLOWED_TAGS: ['svg', 'g', 'path', 'circle', 'rect', 'text', 'line'],
                    ALLOWED_ATTR: ['viewBox', 'width', 'height', 'd', 'cx', 'cy', 'r', 'x', 'y', 'fill', 'stroke', 'stroke-width']
                  })
                }}
                onClick={() => handleMediaInteraction('diagram', 'click')}
                style={{ cursor: 'pointer' }}
              />
            )}
          </div>
        );

      case 'video':
        return (
          <div key={mediaKey} className="rich-media-video" style={{
            margin: '16px 0',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <video
              controls
              style={{ width: '100%', height: 'auto' }}
              onLoadedData={() => handleMediaLoad('video', 0)}
              onError={() => handleMediaError('video', new Error('Failed to load video'))}
              onPlay={() => handleMediaInteraction('video', 'play')}
            >
              <source src={media.content} />
              <p>Your browser does not support video playback.</p>
            </video>
          </div>
        );

      default:
        return (
          <div key={mediaKey} className="rich-media-unknown" style={{
            margin: '16px 0',
            padding: '16px',
            background: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: '8px',
            color: '#856404'
          }}>
            <p>⚠️ Unsupported media type: {media.type}</p>
            <details>
              <summary>Show raw content</summary>
              <pre style={{ marginTop: '8px', fontSize: '12px' }}>{media.content}</pre>
            </details>
          </div>
        );
    }
  };

  return (
    <div ref={ref} className={`rich-message ${className}`}>
      {/* FAQ indicator */}
      {message.from_faq && (
        <div className="faq-badge" style={{
          display: 'inline-block',
          background: 'linear-gradient(135deg, #4CAF50, #45A049)',
          color: 'white',
          fontSize: '12px',
          padding: '4px 8px',
          borderRadius: '12px',
          marginBottom: '8px'
        }}>
          ⚡ FAQ • {Math.round(message.from_faq.confidence * 100)}% match
        </div>
      )}

      {/* Main message content with inline media */}
      <div className="message-content" style={{ marginBottom: '8px' }}>
        {renderTextWithInlineMedia(message.content)}
      </div>

      {/* Rich media blocks */}
      {message.rich_media && message.rich_media.length > 0 && (
        <div className="rich-media-container">
          {message.rich_media.map((media, index) => renderRichMedia(media, index))}
        </div>
      )}

      {/* Error summary */}
      {mediaErrors.size > 0 && (
        <div className="media-errors" style={{
          marginTop: '8px',
          padding: '8px',
          background: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#721c24'
        }}>
          <details>
            <summary>{mediaErrors.size} media error(s)</summary>
            <ul style={{ margin: '4px 0', paddingLeft: '16px' }}>
              {Array.from(mediaErrors.entries()).map(([type, error]) => (
                <li key={type}>{type}: {error}</li>
              ))}
            </ul>
          </details>
        </div>
      )}

      {/* Performance info (development only) */}
      {process.env.NODE_ENV === 'development' && totalLoadTime > 0 && (
        <div className="performance-info" style={{
          marginTop: '8px',
          fontSize: '11px',
          color: '#6c757d'
        }}>
          Media load time: {totalLoadTime}ms • Loaded: {loadedMedia.size} items • Bandwidth: {bandwidth}
        </div>
      )}

      <style>{`
        .rich-message {
          word-wrap: break-word;
          line-height: 1.6;
        }
        
        .rich-message img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
        }
        
        .media-placeholder:hover {
          background: #e9ecef;
        }
        
        /* Mobile responsive */
        @media (max-width: 768px) {
          .rich-message {
            font-size: 14px;
          }
          
          .rich-media-container {
            margin: 8px -8px; /* Extend to edges on mobile */
          }
          
          .media-placeholder {
            margin: 8px 0;
            padding: 12px;
          }
        }
        
        /* High contrast mode */
        @media (prefers-contrast: high) {
          .faq-badge {
            background: #000 !important;
            border: 2px solid #fff;
          }
          
          .media-placeholder {
            border: 2px solid #000;
          }
        }
        
        /* Print styles */
        @media print {
          .faq-badge {
            background: #000;
            color: #fff;
          }
          
          .media-placeholder button {
            display: none;
          }
          
          .performance-info {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};

export default RichMessage;