import React, { useEffect, useState, useCallback } from 'react';
import styles from './ContentAwareness.module.css';
// import { LMSContentExtractor } from '../../services/LMSContentExtractor'; // Removed - not used
import { useLMSContent } from '../../hooks/useLMSContent';
import ManualContentInput from './ManualContentInput';

export interface ContentAwarenessProps {
  pageUrl?: string;
  onContentExtracted?: (content: any) => void;
  onExtractionError?: (error: Error) => void;
  enableAutoExtraction?: boolean;
  enableMonitoring?: boolean;
}

type ExtractionStatus = 'idle' | 'extracting' | 'analyzing' | 'ready' | 'error' | 'fallback';

export const ContentAwareness: React.FC<ContentAwarenessProps> = ({
  pageUrl,
  onContentExtracted,
  onExtractionError,
  enableAutoExtraction = true,
  enableMonitoring = true
}) => {
  const [status, setStatus] = useState<ExtractionStatus>('idle');
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const {
    content,
    isExtracting,
    error: _extractionError,
    extract,
    startMonitoring,
    stopMonitoring,
    isMonitoring
  } = useLMSContent({
    autoExtract: enableAutoExtraction,
    autoMonitor: false,
    onExtractionError: (err) => {
      setError(err.message);
      setStatus('error');
      if (onExtractionError) {
        onExtractionError(err);
      }
      
      if (retryCount >= 2) {
        setShowManualInput(true);
        setStatus('fallback');
      }
    },
    onContentChange: (change) => {
      console.log('Content changed, re-analyzing...', change);
      analyzeContent(change.current);
    }
  });

  useEffect(() => {
    if (isExtracting) {
      setStatus('extracting');
    }
  }, [isExtracting]);

  const analyzeContent = useCallback(async(contentData: any) => {
    setStatus('analyzing');
    
    try {
      const response = await fetch('/api/content/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...contentData,
          instructorConsent: true
        })
      });

      if (!response.ok) {
        throw new Error('Failed to analyze content');
      }

      const result = await response.json();
      
      const contextResponse = await fetch(`/api/content/context/${encodeURIComponent(contentData.pageUrl)}`);
      
      if (contextResponse.ok) {
        const contextData = await contextResponse.json();
        setAnalysisResults(contextData);
        setStatus('ready');
        
        if (onContentExtracted) {
          onContentExtracted(contextData);
        }
      } else {
        setStatus('ready');
        if (onContentExtracted) {
          onContentExtracted(result);
        }
      }
    } catch (err) {
      console.error('Content analysis error:', err);
      setError('Failed to analyze content');
      setStatus('error');
      
      if (retryCount >= 2) {
        setShowManualInput(true);
        setStatus('fallback');
      }
    }
  }, [onContentExtracted, retryCount]);

  useEffect(() => {
    if (content && !isExtracting) {
      analyzeContent(content);
    }
  }, [content, isExtracting, analyzeContent]);

  useEffect(() => {
    if (enableMonitoring && !isMonitoring && status === 'ready') {
      startMonitoring();
    } else if (!enableMonitoring && isMonitoring) {
      stopMonitoring();
    }
  }, [enableMonitoring, isMonitoring, status, startMonitoring, stopMonitoring]);

  const handleRetry = useCallback(() => {
    setError(null);
    setStatus('idle');
    setRetryCount(prev => prev + 1);
    extract();
  }, [extract]);

  const handleManualSubmit = useCallback(async(content: string, metadata: any) => {
    setStatus('analyzing');
    setError(null);
    
    try {
      const response = await fetch('/api/content/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pageUrl: metadata.url || pageUrl || window.location.href,
          pageType: metadata.type || 'page',
          content: {
            html: content,
            text: content,
            title: metadata.title || 'Manual Content',
            metadata: {
              headings: [],
              links: [],
              images: [],
              lists: [],
              emphasis: [],
              tables: []
            }
          },
          timestamp: new Date().toISOString(),
          contentHash: btoa(content.substring(0, 100)),
          instructorConsent: metadata.instructorConsent
        })
      });

      if (!response.ok) {
        throw new Error('Failed to analyze content');
      }

      const result = await response.json();
      setAnalysisResults(result);
      setStatus('ready');
      setShowManualInput(false);
      
      if (onContentExtracted) {
        onContentExtracted(result);
      }
    } catch (err) {
      console.error('Manual content analysis error:', err);
      setError('Failed to analyze manual content');
      setStatus('error');
    }
  }, [pageUrl, onContentExtracted]);

  const renderStatus = () => {
    switch (status) {
      case 'idle':
        return (
          <div className={styles.status}>
            <div className={styles.statusIcon}>⏳</div>
            <span>Waiting to extract content...</span>
          </div>
        );
      
      case 'extracting':
        return (
          <div className={styles.status}>
            <div className={`${styles.statusIcon} ${styles.spinning}`}>🔄</div>
            <span>Extracting page content...</span>
          </div>
        );
      
      case 'analyzing':
        return (
          <div className={styles.status}>
            <div className={`${styles.statusIcon} ${styles.spinning}`}>🧠</div>
            <span>Analyzing content...</span>
          </div>
        );
      
      case 'ready':
        return (
          <div className={styles.status}>
            <div className={styles.statusIcon}>✅</div>
            <span>Content analysis ready</span>
            {isMonitoring && (
              <span className={styles.monitoring}>
                <span className={styles.monitoringDot} />
                Monitoring for changes
              </span>
            )}
          </div>
        );
      
      case 'error':
        return (
          <div className={styles.status}>
            <div className={styles.statusIcon}>⚠️</div>
            <div className={styles.errorContent}>
              <span>Content extraction failed</span>
              {error && <small className={styles.errorMessage}>{error}</small>}
              <button className={styles.retryButton} onClick={handleRetry}>
                Retry ({3 - retryCount} attempts left)
              </button>
            </div>
          </div>
        );
      
      case 'fallback':
        return null;
      
      default:
        return null;
    }
  };

  const renderAnalysisResults = () => {
    if (!analysisResults || status !== 'ready') {
      return null;
    }

    const { content: contentData } = analysisResults;

    return (
      <div className={styles.results}>
        <div className={styles.resultsHeader}>
          <h4 className={styles.resultsTitle}>Content Analysis</h4>
          {contentData?.processedContent?.contentComplexity && (
            <span className={`${styles.badge} ${styles[`badge${contentData.processedContent.contentComplexity}`]}`}>
              {contentData.processedContent.contentComplexity}
            </span>
          )}
        </div>

        {contentData?.processedContent?.keyConcepts?.length > 0 && (
          <div className={styles.section}>
            <h5 className={styles.sectionTitle}>Key Concepts</h5>
            <div className={styles.conceptList}>
              {contentData.processedContent.keyConcepts.slice(0, 5).map((concept: any, idx: number) => (
                <span key={idx} className={styles.concept}>
                  {concept.concept}
                  {concept.importance > 0.8 && <span className={styles.important}>★</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {contentData?.processedContent?.learningObjectives?.length > 0 && (
          <div className={styles.section}>
            <h5 className={styles.sectionTitle}>Learning Objectives</h5>
            <ul className={styles.objectiveList}>
              {contentData.processedContent.learningObjectives.slice(0, 3).map((obj: any, idx: number) => (
                <li key={idx}>
                  <span className={styles.objectiveText}>{obj.objective}</span>
                  <span className={`${styles.bloomLevel} ${styles[`bloom${obj.bloomLevel}`]}`}>
                    {obj.bloomLevel}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {contentData?.processedContent?.estimatedReadingTime && (
          <div className={styles.metadata}>
            <span>📖 {contentData.processedContent.estimatedReadingTime} min read</span>
            {contentData.processedContent.readabilityScore && (
              <span>📊 Readability: {Math.round(contentData.processedContent.readabilityScore)}/100</span>
            )}
          </div>
        )}
      </div>
    );
  };

  if (showManualInput) {
    return (
      <div className={styles.container}>
        <ManualContentInput
          onContentSubmit={handleManualSubmit}
          isLoading={status === 'analyzing'}
          error={error}
          pageUrl={pageUrl}
        />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {renderStatus()}
      {renderAnalysisResults()}
    </div>
  );
};

export default ContentAwareness;