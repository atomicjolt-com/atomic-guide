import { useState, useEffect, useCallback, useRef } from 'react';
import { LMSContentExtractor, LMSContentExtraction, ContentExtractionOptions } from '../services/LMSContentExtractor';

export interface UseLMSContentOptions extends ContentExtractionOptions {
  autoExtract?: boolean;
  autoMonitor?: boolean;
  onExtractionError?: (error: Error) => void;
  onContentChange?: (change: { previous: LMSContentExtraction; current: LMSContentExtraction }) => void;
}

export interface UseLMSContentResult {
  content: LMSContentExtraction | null;
  isExtracting: boolean;
  error: Error | null;
  extract: () => Promise<void>;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  isMonitoring: boolean;
  retryCount: number;
}

export function useLMSContent(options: UseLMSContentOptions = {}): UseLMSContentResult {
  const [content, setContent] = useState<LMSContentExtraction | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  const extractorRef = useRef<LMSContentExtractor | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const extractor = new LMSContentExtractor({
      ...options,
      enableMonitoring: options.autoMonitor ?? false,
    });
    
    extractorRef.current = extractor;

    extractor.on('content-extracted', (extractedContent: LMSContentExtraction) => {
      if (mountedRef.current) {
        setContent(extractedContent);
        setError(null);
        setRetryCount(0);
      }
    });

    extractor.on('extraction-error', (err: Error) => {
      if (mountedRef.current) {
        setError(err);
        setIsExtracting(false);
        if (options.onExtractionError) {
          options.onExtractionError(err);
        }
      }
    });

    extractor.on('content-changed', (change: { previous: LMSContentExtraction; current: LMSContentExtraction }) => {
      if (mountedRef.current) {
        setContent(change.current);
        if (options.onContentChange) {
          options.onContentChange(change);
        }
      }
    });

    extractor.on('monitoring-started', () => {
      if (mountedRef.current) {
        setIsMonitoring(true);
      }
    });

    extractor.on('monitoring-stopped', () => {
      if (mountedRef.current) {
        setIsMonitoring(false);
      }
    });

    if (options.autoExtract) {
      extractContent();
    }

    if (options.autoMonitor) {
      extractor.startContentMonitoring();
    }

    return () => {
      extractor.destroy();
      extractorRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const extractContent = useCallback(async() => {
    if (!extractorRef.current || isExtracting) {
      return;
    }

    setIsExtracting(true);
    setError(null);
    
    try {
      await extractorRef.current.extractPageContent();
    } catch (err) {
      if (mountedRef.current) {
        setError(err as Error);
        setRetryCount(prev => prev + 1);
      }
    } finally {
      if (mountedRef.current) {
        setIsExtracting(false);
      }
    }
  }, [isExtracting]);

  const startMonitoring = useCallback(() => {
    if (extractorRef.current && !isMonitoring) {
      extractorRef.current.startContentMonitoring();
    }
  }, [isMonitoring]);

  const stopMonitoring = useCallback(() => {
    if (extractorRef.current && isMonitoring) {
      extractorRef.current.stopContentMonitoring();
    }
  }, [isMonitoring]);

  return {
    content,
    isExtracting,
    error,
    extract: extractContent,
    startMonitoring,
    stopMonitoring,
    isMonitoring,
    retryCount,
  };
}

export default useLMSContent;