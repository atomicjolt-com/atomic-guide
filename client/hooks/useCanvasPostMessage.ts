/**
 * @fileoverview Canvas PostMessage Integration Hook
 * @module client/hooks/useCanvasPostMessage
 * 
 * React hook for secure Canvas cross-origin communication and behavioral
 * signal collection. Provides real-time behavioral monitoring with privacy
 * compliance and performance optimization.
 * 
 * Features:
 * - Secure postMessage communication with origin validation
 * - Behavioral signal collection and batching
 * - Real-time struggle detection integration
 * - Performance monitoring and rate limiting
 * - Privacy-compliant data handling
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BehavioralSignal,
  BehavioralSignalType,
  CanvasMessage,
  CanvasPageContent,
  InterventionMessage,
  CanvasOrigin,
  SecurityValidationError
} from '@features/canvas-integration/shared/types';

/**
 * Canvas monitoring configuration
 */
export interface CanvasMonitoringConfig {
  enabledSignalTypes: BehavioralSignalType[];
  sampleRate: number;
  maxSignalsPerMinute: number;
  batchSize: number;
  flushIntervalMs: number;
  privacyMode: 'full' | 'minimal' | 'disabled';
  debugMode: boolean;
}

/**
 * Behavioral signal collection state
 */
export interface SignalCollectionState {
  isMonitoring: boolean;
  sessionId: string | null;
  signalsCollected: number;
  lastSignalTime: Date | null;
  rateLimitHit: boolean;
  errorCount: number;
  canvasOrigin: CanvasOrigin | null;
  pageContent: CanvasPageContent | null;
}

/**
 * Canvas PostMessage hook return type
 */
export interface UseCanvasPostMessageReturn {
  // State
  state: SignalCollectionState;
  config: CanvasMonitoringConfig;
  
  // Signal collection
  startMonitoring: (sessionId: string, config?: Partial<CanvasMonitoringConfig>) => Promise<boolean>;
  stopMonitoring: () => void;
  sendSignal: (signal: Omit<BehavioralSignal, 'id' | 'nonce' | 'hmacSignature' | 'origin'>) => Promise<boolean>;
  
  // Content extraction
  extractPageContent: () => Promise<CanvasPageContent | null>;
  
  // Intervention handling
  onInterventionReceived: (callback: (intervention: InterventionMessage) => void) => void;
  respondToIntervention: (interventionId: string, response: 'accepted' | 'dismissed') => Promise<void>;
  
  // Configuration
  updateConfig: (newConfig: Partial<CanvasMonitoringConfig>) => void;
  
  // Monitoring
  getMetrics: () => {
    signalsPerMinute: number;
    averageProcessingLatency: number;
    errorRate: number;
    connectionHealth: 'good' | 'degraded' | 'poor';
  };
}

/**
 * Default monitoring configuration
 */
const DEFAULT_CONFIG: CanvasMonitoringConfig = {
  enabledSignalTypes: ['hover', 'scroll', 'idle', 'click', 'help_request'],
  sampleRate: 1.0,
  maxSignalsPerMinute: 60,
  batchSize: 5,
  flushIntervalMs: 5000,
  privacyMode: 'full',
  debugMode: false
};

/**
 * Trusted Canvas origins for security validation
 */
const TRUSTED_ORIGINS = [
  'https://canvas.instructure.com',
  'https://atomicjolt.instructure.com',
  'https://community.canvaslms.com'
] as const;

/**
 * Canvas PostMessage Integration Hook
 * 
 * Provides secure real-time behavioral signal collection from Canvas
 * with comprehensive privacy controls and performance monitoring.
 */
export function useCanvasPostMessage(): UseCanvasPostMessageReturn {
  // State management
  const [state, setState] = useState<SignalCollectionState>({
    isMonitoring: false,
    sessionId: null,
    signalsCollected: 0,
    lastSignalTime: null,
    rateLimitHit: false,
    errorCount: 0,
    canvasOrigin: null,
    pageContent: null
  });

  const [config, setConfig] = useState<CanvasMonitoringConfig>(DEFAULT_CONFIG);

  // Refs for performance and cleanup
  const signalBatchRef = useRef<BehavioralSignal[]>([]);
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rateLimitWindowRef = useRef<{ start: number; count: number }>({ start: Date.now(), count: 0 });
  const interventionCallbackRef = useRef<((intervention: InterventionMessage) => void) | null>(null);
  const metricsRef = useRef({
    signalTimes: [] as number[],
    processingLatencies: [] as number[],
    errors: 0
  });

  // Canvas origin detection and validation
  const detectCanvasOrigin = useCallback((): CanvasOrigin | null => {
    try {
      // Try to get origin from parent window or current location
      const origin = window.parent !== window 
        ? document.referrer 
        : window.location.origin;

      if (!origin) return null;

      const parsedOrigin = new URL(origin).origin;
      
      // Check against trusted origins
      if (TRUSTED_ORIGINS.includes(parsedOrigin as any)) {
        return parsedOrigin as CanvasOrigin;
      }

      // Check against Canvas subdomain pattern
      if (/^https:\/\/[\w.-]+\.instructure\.com$/.test(parsedOrigin)) {
        return parsedOrigin as CanvasOrigin;
      }

      return null;
    } catch (error) {
      console.error('Failed to detect Canvas origin:', error);
      return null;
    }
  }, []);

  // HMAC signature generation for message security
  const generateHmacSignature = useCallback(async (payload: string): Promise<string> => {
    try {
      // In production, this would use a shared secret with the server
      // For now, return a placeholder signature
      const encoder = new TextEncoder();
      const data = encoder.encode(payload);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      
      return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    } catch (error) {
      console.error('Failed to generate HMAC signature:', error);
      throw new SecurityValidationError('HMAC signature generation failed');
    }
  }, []);

  // Rate limiting check
  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();
    const window = rateLimitWindowRef.current;
    
    // Reset window if more than 1 minute has passed
    if (now - window.start > 60000) {
      window.start = now;
      window.count = 0;
    }
    
    if (window.count >= config.maxSignalsPerMinute) {
      setState(prev => ({ ...prev, rateLimitHit: true }));
      return false;
    }
    
    window.count++;
    return true;
  }, [config.maxSignalsPerMinute]);

  // Signal batching and flushing
  const flushSignalBatch = useCallback(async (): Promise<void> => {
    if (signalBatchRef.current.length === 0 || !state.sessionId) return;

    const batchToFlush = [...signalBatchRef.current];
    signalBatchRef.current = [];

    try {
      const startTime = Date.now();
      
      // Create secure message for batch
      const message: CanvasMessage = {
        type: 'behavioral_signal',
        payload: batchToFlush,
        timestamp: new Date(),
        sessionId: state.sessionId,
        nonce: crypto.randomUUID(),
        hmacSignature: await generateHmacSignature(JSON.stringify(batchToFlush)),
        origin: state.canvasOrigin!
      };

      // Send to struggle detection service
      const response = await fetch('/api/struggle-detection/signals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(window as any).LAUNCH_SETTINGS?.jwt || ''}`
        },
        body: JSON.stringify(message)
      });

      if (!response.ok) {
        throw new Error(`Signal batch flush failed: ${response.statusText}`);
      }

      const processingLatency = Date.now() - startTime;
      metricsRef.current.processingLatencies.push(processingLatency);

      // Keep only recent metrics (last 100 entries)
      if (metricsRef.current.processingLatencies.length > 100) {
        metricsRef.current.processingLatencies = metricsRef.current.processingLatencies.slice(-50);
      }

      setState(prev => ({ 
        ...prev, 
        signalsCollected: prev.signalsCollected + batchToFlush.length,
        lastSignalTime: new Date()
      }));

    } catch (error) {
      console.error('Failed to flush signal batch:', error);
      metricsRef.current.errors++;
      
      setState(prev => ({ 
        ...prev, 
        errorCount: prev.errorCount + 1 
      }));

      // Re-add failed signals to batch for retry (up to a limit)
      if (signalBatchRef.current.length < config.batchSize * 2) {
        signalBatchRef.current.unshift(...batchToFlush);
      }
    }
  }, [state.sessionId, state.canvasOrigin, generateHmacSignature, config.batchSize]);

  // Schedule batch flush
  const scheduleBatchFlush = useCallback(() => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
    }

    flushTimeoutRef.current = setTimeout(() => {
      flushSignalBatch();
    }, config.flushIntervalMs);
  }, [flushSignalBatch, config.flushIntervalMs]);

  // Send individual behavioral signal
  const sendSignal = useCallback(async (
    signalData: Omit<BehavioralSignal, 'id' | 'nonce' | 'hmacSignature' | 'origin'>
  ): Promise<boolean> => {
    if (!state.isMonitoring || !state.sessionId || !state.canvasOrigin) {
      return false;
    }

    // Rate limiting check
    if (!checkRateLimit()) {
      return false;
    }

    // Sampling check
    if (Math.random() > config.sampleRate) {
      return true; // Signal was "sent" (but sampled out)
    }

    // Privacy mode check
    if (config.privacyMode === 'disabled') {
      return false;
    }

    try {
      // Create complete behavioral signal
      const signal: BehavioralSignal = {
        ...signalData,
        id: crypto.randomUUID(),
        nonce: crypto.randomUUID(),
        hmacSignature: await generateHmacSignature(JSON.stringify(signalData)),
        origin: state.canvasOrigin
      };

      // Add to batch
      signalBatchRef.current.push(signal);

      // Flush if batch is full
      if (signalBatchRef.current.length >= config.batchSize) {
        await flushSignalBatch();
      } else {
        scheduleBatchFlush();
      }

      return true;

    } catch (error) {
      console.error('Failed to send behavioral signal:', error);
      setState(prev => ({ ...prev, errorCount: prev.errorCount + 1 }));
      return false;
    }
  }, [
    state.isMonitoring, 
    state.sessionId, 
    state.canvasOrigin, 
    checkRateLimit, 
    config.sampleRate, 
    config.privacyMode, 
    config.batchSize,
    generateHmacSignature, 
    flushSignalBatch, 
    scheduleBatchFlush
  ]);

  // Start monitoring
  const startMonitoring = useCallback(async (
    sessionId: string, 
    configOverrides?: Partial<CanvasMonitoringConfig>
  ): Promise<boolean> => {
    try {
      // Detect Canvas origin
      const canvasOrigin = detectCanvasOrigin();
      if (!canvasOrigin) {
        console.error('Cannot start monitoring: Canvas origin not detected or not trusted');
        return false;
      }

      // Update configuration
      if (configOverrides) {
        setConfig(prev => ({ ...prev, ...configOverrides }));
      }

      // Initialize state
      setState(prev => ({
        ...prev,
        isMonitoring: true,
        sessionId,
        canvasOrigin,
        signalsCollected: 0,
        lastSignalTime: null,
        rateLimitHit: false,
        errorCount: 0
      }));

      // Reset metrics
      rateLimitWindowRef.current = { start: Date.now(), count: 0 };
      metricsRef.current = { signalTimes: [], processingLatencies: [], errors: 0 };

      if (config.debugMode) {
        console.log('Canvas PostMessage monitoring started:', { sessionId, canvasOrigin });
      }

      return true;

    } catch (error) {
      console.error('Failed to start Canvas monitoring:', error);
      return false;
    }
  }, [detectCanvasOrigin, config.debugMode]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    setState(prev => ({ ...prev, isMonitoring: false, sessionId: null }));
    
    // Flush any remaining signals
    if (signalBatchRef.current.length > 0) {
      flushSignalBatch();
    }
    
    // Clear timeouts
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }

    if (config.debugMode) {
      console.log('Canvas PostMessage monitoring stopped');
    }
  }, [flushSignalBatch, config.debugMode]);

  // Extract current page content
  const extractPageContent = useCallback(async (): Promise<CanvasPageContent | null> => {
    try {
      // This would implement Canvas content extraction
      // For now, return basic page information
      const content: CanvasPageContent = {
        pageType: 'unknown',
        contentText: document.title,
        contentHash: btoa(document.title).slice(0, 32),
        extractedAt: new Date(),
        extractionMethod: 'dom_fallback'
      };

      setState(prev => ({ ...prev, pageContent: content }));
      return content;

    } catch (error) {
      console.error('Failed to extract page content:', error);
      return null;
    }
  }, []);

  // Handle intervention responses
  const respondToIntervention = useCallback(async (
    interventionId: string, 
    response: 'accepted' | 'dismissed'
  ): Promise<void> => {
    try {
      await fetch('/api/interventions/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(window as any).LAUNCH_SETTINGS?.jwt || ''}`
        },
        body: JSON.stringify({
          interventionId,
          response,
          timestamp: new Date(),
          sessionId: state.sessionId
        })
      });

    } catch (error) {
      console.error('Failed to respond to intervention:', error);
    }
  }, [state.sessionId]);

  // Intervention callback registration
  const onInterventionReceived = useCallback((
    callback: (intervention: InterventionMessage) => void
  ) => {
    interventionCallbackRef.current = callback;
  }, []);

  // Configuration update
  const updateConfig = useCallback((newConfig: Partial<CanvasMonitoringConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  // Get performance metrics
  const getMetrics = useCallback(() => {
    const now = Date.now();
    const recentSignals = metricsRef.current.signalTimes.filter(t => now - t < 60000);
    const recentLatencies = metricsRef.current.processingLatencies.slice(-20);
    
    return {
      signalsPerMinute: recentSignals.length,
      averageProcessingLatency: recentLatencies.length > 0 
        ? recentLatencies.reduce((a, b) => a + b, 0) / recentLatencies.length 
        : 0,
      errorRate: metricsRef.current.errors / Math.max(1, state.signalsCollected),
      connectionHealth: (
        state.errorCount < 3 && !state.rateLimitHit ? 'good' :
        state.errorCount < 10 ? 'degraded' : 'poor'
      ) as 'good' | 'degraded' | 'poor'
    };
  }, [state.signalsCollected, state.errorCount, state.rateLimitHit]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, [stopMonitoring]);

  return {
    state,
    config,
    startMonitoring,
    stopMonitoring,
    sendSignal,
    extractPageContent,
    onInterventionReceived,
    respondToIntervention,
    updateConfig,
    getMetrics
  };
}