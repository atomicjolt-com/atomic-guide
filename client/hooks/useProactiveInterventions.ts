/**
 * @fileoverview Hook for managing proactive intervention state and actions
 * @module client/hooks/useProactiveInterventions
 * 
 * Provides functionality to show, dismiss, snooze, and track proactive interventions.
 * Handles rate limiting, session management, and analytics integration.
 * 
 * Features:
 * - Intervention state management
 * - User action tracking and analytics
 * - Rate limiting and spam prevention
 * - Session-based intervention limits
 * - Clean-up and memory management
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useAppSelector } from '@features/chat/client/store';
import { InterventionMessage } from '@features/canvas-integration/shared/types';
import type { RootState } from '@features/chat/client/store';

/**
 * Configuration for proactive interventions
 */
interface InterventionConfig {
  /** Maximum interventions to show per session */
  maxInterventionsPerSession: number;
  /** Auto timeout duration in milliseconds */
  autoTimeoutMs: number;
  /** Minimum time between interventions in milliseconds */
  minimumIntervalMs: number;
  /** Rate limit for user actions */
  actionRateLimit: {
    /** Maximum actions per time window */
    maxActions: number;
    /** Time window in milliseconds */
    windowMs: number;
  };
}

/**
 * State for proactive interventions
 */
interface InterventionState {
  /** Currently active intervention */
  activeIntervention: InterventionMessage | null;
  /** Whether intervention is currently visible */
  isVisible: boolean;
  /** Set of dismissed intervention IDs */
  dismissedInterventions: Set<string>;
  /** Map of snoozed intervention IDs to their expiry time */
  snoozedInterventions: Map<string, number>;
}

/**
 * Default configuration for interventions
 */
const DEFAULT_CONFIG: InterventionConfig = {
  maxInterventionsPerSession: 5,
  autoTimeoutMs: 30000, // 30 seconds
  minimumIntervalMs: 60000, // 1 minute between interventions
  actionRateLimit: {
    maxActions: 10,
    windowMs: 60000 // 1 minute window
  }
};

/**
 * Hook for managing proactive interventions
 * 
 * Provides state management and actions for proactive chat interventions.
 * Handles showing, dismissing, snoozing interventions with proper tracking.
 * 
 * @param config Optional configuration overrides
 * @returns Intervention state and actions
 */
export function useProactiveInterventions(config: Partial<InterventionConfig> = {}) {
  const finalConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config]);
  
  // Redux state
  const isChatOpen = useAppSelector((state: RootState) => state.chat.isOpen);
  
  // Component state
  const [state, setState] = useState<InterventionState>({
    activeIntervention: null,
    isVisible: false,
    dismissedInterventions: new Set(),
    snoozedInterventions: new Map()
  });
  
  // Refs for tracking and timers
  const interventionCountRef = useRef(0);
  const lastInterventionTimeRef = useRef(0);
  const sessionStartRef = useRef(Date.now());
  const responseTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  /**
   * Show intervention if conditions are met
   */
  const showIntervention = useCallback((intervention: InterventionMessage) => {
    // Check session limits
    if (interventionCountRef.current >= finalConfig.maxInterventionsPerSession) {
      console.warn('Max interventions per session reached');
      return false;
    }
    
    // Check minimum interval
    const timeSinceLastIntervention = Date.now() - lastInterventionTimeRef.current;
    if (timeSinceLastIntervention < finalConfig.minimumIntervalMs && lastInterventionTimeRef.current > 0) {
      console.warn('Intervention interval too short, waiting');
      return false;
    }
    
    // Check if intervention was previously dismissed
    if (state.dismissedInterventions.has(intervention.id)) {
      return false;
    }
    
    // Check if intervention is still snoozed
    const snoozeExpiry = state.snoozedInterventions.get(intervention.id);
    if (snoozeExpiry && Date.now() < snoozeExpiry) {
      return false;
    }
    
    // Update state
    setState(prev => ({
      ...prev,
      activeIntervention: intervention,
      isVisible: true
    }));
    
    // Update counters
    interventionCountRef.current += 1;
    lastInterventionTimeRef.current = Date.now();
    
    // Track intervention shown
    trackInterventionEvent('intervention_shown', {
      interventionId: intervention.id,
      type: intervention.type,
      urgencyLevel: intervention.urgencyLevel,
      sessionCount: interventionCountRef.current,
      contextRelevant: intervention.contextRelevant
    });
    
    return true;
  }, [state.dismissedInterventions, state.snoozedInterventions, finalConfig]);
  
  /**
   * Accept intervention and open chat
   */
  const acceptIntervention = useCallback((interventionId: string) => {
    const intervention = state.activeIntervention;
    if (!intervention || intervention.id !== interventionId) return;
    
    const responseTime = Date.now() - lastInterventionTimeRef.current;
    
    // Track acceptance
    trackInterventionEvent('intervention_accepted', {
      interventionId,
      responseTime,
      type: intervention.type,
      urgencyLevel: intervention.urgencyLevel,
      hadContextualMessage: !!intervention.contextualMessage,
      chatWasOpen: isChatOpen
    });
    
    // Clear intervention
    setState(prev => ({
      ...prev,
      activeIntervention: null,
      isVisible: false
    }));
    
    if (responseTimerRef.current) {
      clearTimeout(responseTimerRef.current);
      responseTimerRef.current = null;
    }
  }, [state.activeIntervention, isChatOpen]);

  /**
   * Dismiss intervention
   */
  const dismissIntervention = useCallback((interventionId: string, reason?: string) => {
    const intervention = state.activeIntervention;
    if (!intervention || intervention.id !== interventionId) return;
    
    const responseTime = Date.now() - lastInterventionTimeRef.current;
    
    // Add to dismissed set
    setState(prev => ({
      ...prev,
      activeIntervention: null,
      isVisible: false,
      dismissedInterventions: new Set([...prev.dismissedInterventions, interventionId])
    }));
    
    // Track dismissal
    trackInterventionEvent('intervention_dismissed', {
      interventionId,
      responseTime,
      reason: reason || 'user_dismissed',
      type: intervention.type,
      urgencyLevel: intervention.urgencyLevel
    });
    
    if (responseTimerRef.current) {
      clearTimeout(responseTimerRef.current);
      responseTimerRef.current = null;
    }
  }, [state.activeIntervention]);

  /**
   * Snooze intervention
   */
  const snoozeIntervention = useCallback((interventionId: string, durationMs: number) => {
    const intervention = state.activeIntervention;
    if (!intervention || intervention.id !== interventionId) return;
    
    const responseTime = Date.now() - lastInterventionTimeRef.current;
    const snoozeUntil = Date.now() + durationMs;
    
    // Add to snoozed map
    setState(prev => ({
      ...prev,
      activeIntervention: null,
      isVisible: false,
      snoozedInterventions: new Map([...prev.snoozedInterventions, [interventionId, snoozeUntil]])
    }));
    
    // Track snooze
    trackInterventionEvent('intervention_snoozed', {
      interventionId,
      responseTime,
      snoozeDurationMs: durationMs,
      type: intervention.type,
      urgencyLevel: intervention.urgencyLevel
    });
    
    if (responseTimerRef.current) {
      clearTimeout(responseTimerRef.current);
      responseTimerRef.current = null;
    }
    
    // Set timer to remove from snoozed map when expired
    setTimeout(() => {
      setState(prev => {
        const newSnoozed = new Map(prev.snoozedInterventions);
        newSnoozed.delete(interventionId);
        return {
          ...prev,
          snoozedInterventions: newSnoozed
        };
      });
    }, durationMs);
  }, [state.activeIntervention]);

  /**
   * Handle intervention timeout
   */
  const timeoutIntervention = useCallback((interventionId: string) => {
    const intervention = state.activeIntervention;
    if (!intervention || intervention.id !== interventionId) return;
    
    const responseTime = Date.now() - lastInterventionTimeRef.current;
    
    // Clear intervention
    setState(prev => ({
      ...prev,
      activeIntervention: null,
      isVisible: false
    }));
    
    // Track timeout
    trackInterventionEvent('intervention_timeout', {
      interventionId,
      responseTime,
      type: intervention.type,
      urgencyLevel: intervention.urgencyLevel,
      timeoutMs: finalConfig.autoTimeoutMs
    });
    
    if (responseTimerRef.current) {
      clearTimeout(responseTimerRef.current);
      responseTimerRef.current = null;
    }
  }, [state.activeIntervention, finalConfig.autoTimeoutMs]);

  /**
   * Clear all intervention state (useful for session resets)
   */
  const clearInterventions = useCallback(() => {
    setState({
      activeIntervention: null,
      isVisible: false,
      dismissedInterventions: new Set(),
      snoozedInterventions: new Map()
    });
    
    interventionCountRef.current = 0;
    lastInterventionTimeRef.current = 0;
    
    if (responseTimerRef.current) {
      clearTimeout(responseTimerRef.current);
      responseTimerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (responseTimerRef.current) {
        clearTimeout(responseTimerRef.current);
      }
    };
  }, []);

  /**
   * Get session analytics
   */
  const getSessionAnalytics = useCallback(() => {
    return {
      sessionDuration: Date.now() - sessionStartRef.current,
      totalInterventions: interventionCountRef.current,
      dismissedCount: state.dismissedInterventions.size,
      snoozedCount: state.snoozedInterventions.size,
      maxInterventionsReached: interventionCountRef.current >= finalConfig.maxInterventionsPerSession
    };
  }, [state, finalConfig]);

  return {
    // State
    activeIntervention: state.activeIntervention,
    isVisible: state.isVisible,
    
    // Actions
    showIntervention,
    acceptIntervention,
    dismissIntervention,
    snoozeIntervention,
    timeoutIntervention,
    clearInterventions,
    
    // Analytics
    getSessionAnalytics,
    
    // Config
    config: finalConfig
  };
}

/**
 * Track intervention analytics events
 */
function trackInterventionEvent(eventName: string, properties: Record<string, any>): void {
  // Integration with analytics service
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, {
      event_category: 'proactive_interventions',
      ...properties
    });
  }
  
  // Console logging for development
  if (process.env.NODE_ENV === 'development') {
    console.log('Intervention Event:', eventName, properties);
  }
}

// Global gtag type for TypeScript
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}