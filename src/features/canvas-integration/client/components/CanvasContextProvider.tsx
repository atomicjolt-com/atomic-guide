/**
 * @fileoverview Canvas Context Provider for React application
 * @module features/canvas-integration/client/components/CanvasContextProvider
 *
 * Provides Canvas integration context to React components with real-time
 * Canvas content awareness, navigation tracking, and behavioral signal collection.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { CanvasMessageChannel } from '../services/CanvasMessageChannel';
import {
  CanvasPageContent,
  BehavioralSignal,
  InterventionMessage
} from '../../shared/types';

/**
 * Canvas context state interface
 */
interface CanvasContextState {
  // Connection state
  isConnected: boolean;
  isInitializing: boolean;
  connectionError: string | null;

  // Content state
  currentContent: CanvasPageContent | null;
  contentHistory: CanvasPageContent[];

  // Navigation state
  currentUrl: string;
  pageType: string;
  navigationHistory: Array<{
    url: string;
    timestamp: Date;
    duration: number;
  }>;

  // Behavioral tracking
  behavioralSignals: BehavioralSignal[];
  isTrackingEnabled: boolean;

  // Interventions
  activeIntervention: InterventionMessage | null;
  interventionHistory: InterventionMessage[];
}

/**
 * Canvas context actions interface
 */
interface CanvasContextActions {
  // Connection management
  connect: () => Promise<void>;
  disconnect: () => void;
  retry: () => Promise<void>;

  // Behavioral tracking
  sendBehavioralSignal: (signal: Omit<BehavioralSignal, 'id' | 'nonce' | 'hmacSignature' | 'origin'>) => Promise<void>;
  toggleTracking: (enabled: boolean) => void;

  // Content management
  extractCurrentContent: () => Promise<void>;
  getContentHistory: () => CanvasPageContent[];

  // Intervention handling
  dismissIntervention: () => void;
  acceptIntervention: (interventionId: string) => void;

  // Utility functions
  isCanvasPage: () => boolean;
  getCurrentPageType: () => string;
  getCurrentCourseId: () => string | null;
}

/**
 * Combined Canvas context interface
 */
interface CanvasContextType extends CanvasContextState, CanvasContextActions {}

/**
 * Canvas context provider props
 */
interface CanvasContextProviderProps {
  children: React.ReactNode;
  sessionId: string;
  hmacSecret: string;
  atomicGuideOrigin: string;
  enableBehavioralTracking?: boolean;
  debugMode?: boolean;
}

// Create context
const CanvasContext = createContext<CanvasContextType | null>(null);

/**
 * Canvas Context Provider Component
 *
 * Manages Canvas integration state and provides real-time Canvas awareness
 * to child components through React Context.
 */
export const CanvasContextProvider: React.FC<CanvasContextProviderProps> = ({
  children,
  sessionId,
  hmacSecret,
  atomicGuideOrigin,
  enableBehavioralTracking = true,
  debugMode = false
}) => {
  // State management
  const [state, setState] = useState<CanvasContextState>({
    isConnected: false,
    isInitializing: false,
    connectionError: null,
    currentContent: null,
    contentHistory: [],
    currentUrl: window.location.href,
    pageType: 'unknown',
    navigationHistory: [],
    behavioralSignals: [],
    isTrackingEnabled: enableBehavioralTracking,
    activeIntervention: null,
    interventionHistory: []
  });

  // Refs for stable references
  const messageChannelRef = useRef<CanvasMessageChannel | null>(null);
  const trackingIntervalRef = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  /**
   * Initialize Canvas message channel
   */
  const initializeMessageChannel = useCallback(async () => {
    if (messageChannelRef.current) {
      messageChannelRef.current.disconnect();
    }

    const messageChannel = new CanvasMessageChannel(
      sessionId,
      hmacSecret,
      atomicGuideOrigin
    );

    // Set up event listeners
    messageChannel.setEventListeners({
      onConnectionChange: (connected: boolean) => {
        setState(prev => ({
          ...prev,
          isConnected: connected,
          connectionError: connected ? null : prev.connectionError
        }));

        if (debugMode) {
          console.log('Canvas connection changed:', connected);
        }
      },

      onContentChange: (content: CanvasPageContent) => {
        setState(prev => ({
          ...prev,
          currentContent: content,
          contentHistory: [content, ...prev.contentHistory.slice(0, 19)] // Keep last 20
        }));

        if (debugMode) {
          console.log('Canvas content changed:', content);
        }
      },

      onNavigationChange: (url: string, pageType: string) => {
        const now = Date.now();
        const duration = now - lastActivityRef.current;
        lastActivityRef.current = now;

        setState(prev => ({
          ...prev,
          currentUrl: url,
          pageType,
          navigationHistory: [
            { url, timestamp: new Date(), duration },
            ...prev.navigationHistory.slice(0, 29) // Keep last 30
          ]
        }));

        if (debugMode) {
          console.log('Canvas navigation changed:', { url, pageType });
        }
      },

      onIntervention: (intervention: InterventionMessage) => {
        setState(prev => ({
          ...prev,
          activeIntervention: intervention,
          interventionHistory: [intervention, ...prev.interventionHistory.slice(0, 9)] // Keep last 10
        }));

        if (debugMode) {
          console.log('Canvas intervention received:', intervention);
        }
      },

      onError: (error: Error) => {
        setState(prev => ({
          ...prev,
          connectionError: error.message,
          isInitializing: false
        }));

        if (debugMode) {
          console.error('Canvas integration error:', error);
        }
      }
    });

    messageChannelRef.current = messageChannel;
    return messageChannel;
  }, [sessionId, hmacSecret, atomicGuideOrigin, debugMode]);

  /**
   * Connect to Canvas
   */
  const connect = useCallback(async () => {
    setState(prev => ({ ...prev, isInitializing: true, connectionError: null }));

    try {
      const messageChannel = await initializeMessageChannel();
      await messageChannel.initialize();

      setState(prev => ({ ...prev, isInitializing: false }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isInitializing: false,
        connectionError: error instanceof Error ? error.message : 'Connection failed'
      }));
      throw error;
    }
  }, [initializeMessageChannel]);

  /**
   * Disconnect from Canvas
   */
  const disconnect = useCallback(() => {
    if (messageChannelRef.current) {
      messageChannelRef.current.disconnect();
      messageChannelRef.current = null;
    }

    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isConnected: false,
      isInitializing: false
    }));
  }, []);

  /**
   * Retry connection
   */
  const retry = useCallback(async () => {
    disconnect();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    await connect();
  }, [connect, disconnect]);

  /**
   * Send behavioral signal
   */
  const sendBehavioralSignal = useCallback(async (
    signal: Omit<BehavioralSignal, 'id' | 'nonce' | 'hmacSignature' | 'origin'>
  ) => {
    if (!messageChannelRef.current || !state.isTrackingEnabled) {
      return;
    }

    const completeSignal = {
      ...signal,
      id: crypto.randomUUID(),
      timestamp: new Date()
    };

    try {
      await messageChannelRef.current.sendBehavioralSignal(completeSignal);

      setState(prev => ({
        ...prev,
        behavioralSignals: [completeSignal as BehavioralSignal, ...prev.behavioralSignals.slice(0, 99)] // Keep last 100
      }));

      if (debugMode) {
        console.log('Behavioral signal sent:', completeSignal);
      }
    } catch (error) {
      console.error('Failed to send behavioral signal:', error);
    }
  }, [state.isTrackingEnabled, debugMode]);

  /**
   * Toggle behavioral tracking
   */
  const toggleTracking = useCallback((enabled: boolean) => {
    setState(prev => ({ ...prev, isTrackingEnabled: enabled }));

    if (enabled && !trackingIntervalRef.current) {
      startBehavioralTracking();
    } else if (!enabled && trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }
  }, [startBehavioralTracking]);

  /**
   * Extract current content
   */
  const extractCurrentContent = useCallback(async () => {
    if (!messageChannelRef.current) {
      return;
    }

    try {
      // This will trigger content extraction which will be received via onContentChange
      await messageChannelRef.current.sendPageContextUpdate({
        url: window.location.href,
        timestamp: new Date(),
        requestType: 'content_extraction'
      });
    } catch (error) {
      console.error('Failed to extract current content:', error);
    }
  }, []);

  /**
   * Get content history
   */
  const getContentHistory = useCallback(() => {
    return state.contentHistory;
  }, [state.contentHistory]);

  /**
   * Dismiss active intervention
   */
  const dismissIntervention = useCallback(() => {
    setState(prev => ({ ...prev, activeIntervention: null }));
  }, []);

  /**
   * Accept intervention
   */
  const acceptIntervention = useCallback((interventionId: string) => {
    const intervention = state.activeIntervention;
    if (intervention && intervention.id === interventionId) {
      // Handle intervention acceptance (e.g., open chat, show content)
      setState(prev => ({ ...prev, activeIntervention: null }));

      // Send acceptance message to Canvas if needed
      if (messageChannelRef.current) {
        messageChannelRef.current.sendPageContextUpdate({
          type: 'intervention_accepted',
          interventionId,
          timestamp: new Date()
        });
      }
    }
  }, [state.activeIntervention]);

  /**
   * Check if current page is a Canvas page
   */
  const isCanvasPage = useCallback(() => {
    return state.pageType !== 'unknown' && state.isConnected;
  }, [state.pageType, state.isConnected]);

  /**
   * Get current page type
   */
  const getCurrentPageType = useCallback(() => {
    return state.pageType;
  }, [state.pageType]);

  /**
   * Get current course ID
   */
  const getCurrentCourseId = useCallback(() => {
    return state.currentContent?.courseId || null;
  }, [state.currentContent]);

  /**
   * Start behavioral tracking
   */
  const startBehavioralTracking = useCallback(() => {
    if (trackingIntervalRef.current) {
      return;
    }

    // Track idle behavior
    let lastActivity = Date.now();
    let idleStartTime: number | null = null;

    const trackActivity = () => {
      lastActivity = Date.now();
      idleStartTime = null;
    };

    // Add activity listeners
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, trackActivity, true);
    });

    // Check for idle periods every 5 seconds
    trackingIntervalRef.current = window.setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivity;

      if (timeSinceLastActivity > 10000) { // 10 seconds idle
        if (!idleStartTime) {
          idleStartTime = lastActivity;
        }

        // Send idle signal
        sendBehavioralSignal({
          sessionId,
          signalType: 'idle',
          durationMs: timeSinceLastActivity,
          elementContext: 'page',
          pageContentHash: state.currentContent?.contentHash || 'unknown'
        });
      }
    }, 5000);

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, trackActivity, true);
      });
    };
  }, [sessionId, sendBehavioralSignal, state.currentContent]);

  /**
   * Initialize on mount
   */
  useEffect(() => {
    connect().catch(error => {
      console.error('Failed to initialize Canvas integration:', error);
    });

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  /**
   * Start behavioral tracking when enabled
   */
  useEffect(() => {
    if (state.isTrackingEnabled && state.isConnected) {
      const cleanup = startBehavioralTracking();
      return cleanup;
    }
  }, [state.isTrackingEnabled, state.isConnected, startBehavioralTracking]);

  // Context value
  const contextValue: CanvasContextType = {
    // State
    ...state,

    // Actions
    connect,
    disconnect,
    retry,
    sendBehavioralSignal,
    toggleTracking,
    extractCurrentContent,
    getContentHistory,
    dismissIntervention,
    acceptIntervention,
    isCanvasPage,
    getCurrentPageType,
    getCurrentCourseId
  };

  return (
    <CanvasContext.Provider value={contextValue}>
      {children}
    </CanvasContext.Provider>
  );
};

/**
 * Custom hook to use Canvas context
 */
export const useCanvasContext = (): CanvasContextType => {
  const context = useContext(CanvasContext);
  if (!context) {
    throw new Error('useCanvasContext must be used within a CanvasContextProvider');
  }
  return context;
};

/**
 * Custom hook for Canvas content awareness
 */
export const useCanvasContent = () => {
  const { currentContent, contentHistory, getCurrentPageType, getCurrentCourseId } = useCanvasContext();

  return {
    currentContent,
    contentHistory,
    pageType: getCurrentPageType(),
    courseId: getCurrentCourseId(),
    hasContent: currentContent !== null,
    isCanvasPage: getCurrentPageType() !== 'unknown'
  };
};

/**
 * Custom hook for Canvas behavioral tracking
 */
export const useCanvasBehavioralTracking = () => {
  const {
    sendBehavioralSignal,
    isTrackingEnabled,
    toggleTracking,
    behavioralSignals
  } = useCanvasContext();

  const trackHover = useCallback(async (elementContext: string, duration: number) => {
    await sendBehavioralSignal({
      sessionId: crypto.randomUUID(), // This should come from session
      signalType: 'hover',
      durationMs: duration,
      elementContext,
      pageContentHash: crypto.randomUUID() // This should be actual content hash
    });
  }, [sendBehavioralSignal]);

  const trackClick = useCallback(async (elementContext: string) => {
    await sendBehavioralSignal({
      sessionId: crypto.randomUUID(),
      signalType: 'click',
      durationMs: 0,
      elementContext,
      pageContentHash: crypto.randomUUID()
    });
  }, [sendBehavioralSignal]);

  const trackScroll = useCallback(async (duration: number) => {
    await sendBehavioralSignal({
      sessionId: crypto.randomUUID(),
      signalType: 'scroll',
      durationMs: duration,
      elementContext: 'page',
      pageContentHash: crypto.randomUUID()
    });
  }, [sendBehavioralSignal]);

  return {
    trackHover,
    trackClick,
    trackScroll,
    isTrackingEnabled,
    toggleTracking,
    behavioralSignals: behavioralSignals.slice(0, 10) // Return last 10 signals
  };
};

/**
 * Custom hook for Canvas navigation tracking
 */
export const useCanvasNavigation = () => {
  const {
    currentUrl,
    pageType,
    navigationHistory,
    getCurrentPageType,
    getCurrentCourseId
  } = useCanvasContext();

  return {
    currentUrl,
    pageType,
    navigationHistory: navigationHistory.slice(0, 10), // Return last 10 navigation events
    getCurrentPageType,
    getCurrentCourseId,
    isCanvasPage: pageType !== 'unknown'
  };
};

export default CanvasContextProvider;