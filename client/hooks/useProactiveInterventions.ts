/**
 * @fileoverview Hook for managing proactive chat interventions
 * @module client/hooks/useProactiveInterventions
 * 
 * Handles intervention lifecycle, chat integration, and analytics tracking.
 * Provides centralized state management for proactive support triggers.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { InterventionMessage } from '@features/canvas-integration/shared/types';
import { useAppDispatch, useAppSelector } from '@shared/client/store';
import { openChat, addMessage } from '@features/chat/client/store/chatSlice';
import { v4 as uuidv4 } from 'uuid';

export interface InterventionState {
  activeIntervention: InterventionMessage | null;
  isVisible: boolean;
  dismissedInterventions: Set<string>;
  snoozedInterventions: Map<string, number>; // ID -> snooze end timestamp
}

export interface InterventionResponse {
  interventionId: string;
  responseType: 'accepted' | 'dismissed' | 'snoozed' | 'timeout';
  responseTime: number;
  reason?: string;
  snooze_duration?: number;
}

export interface UseProactiveInterventionsOptions {
  /** Enable/disable intervention system */
  enabled?: boolean;
  /** Maximum interventions per session */
  maxInterventionsPerSession?: number;
  /** Minimum time between interventions (ms) */
  minIntervalMs?: number;
  /** Auto-dismiss timeout (ms) */
  autoTimeoutMs?: number;
}

const DEFAULT_OPTIONS: Required<UseProactiveInterventionsOptions> = {
  enabled: true,
  maxInterventionsPerSession: 3,
  minIntervalMs: 300000, // 5 minutes
  autoTimeoutMs: 30000   // 30 seconds
};

/**
 * Hook for managing proactive chat interventions
 * 
 * Provides intervention state management, chat system integration,
 * and analytics tracking for proactive support features.
 */
export function useProactiveInterventions(
  options: UseProactiveInterventionsOptions = {}
) {
  const dispatch = useAppDispatch();
  const { isOpen: isChatOpen, conversationId } = useAppSelector((state) => state.chat);
  
  const config = { ...DEFAULT_OPTIONS, ...options };
  const [state, setState] = useState<InterventionState>({
    activeIntervention: null,
    isVisible: false,
    dismissedInterventions: new Set(),
    snoozedInterventions: new Map()
  });
  
  // Session tracking
  const sessionStartRef = useRef<number>(Date.now());
  const interventionCountRef = useRef<number>(0);
  const lastInterventionTimeRef = useRef<number>(0);
  const responseTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Check if intervention should be shown based on rules
   */
  const shouldShowIntervention = useCallback((intervention: InterventionMessage): boolean => {
    if (!config.enabled) return false;
    
    // Check if already dismissed
    if (state.dismissedInterventions.has(intervention.id)) return false;
    
    // Check if snoozed
    const snoozeEnd = state.snoozedInterventions.get(intervention.id);
    if (snoozeEnd && Date.now() < snoozeEnd) return false;
    
    // Check session limits
    if (interventionCountRef.current >= config.maxInterventionsPerSession) return false;
    
    // Check minimum interval
    const timeSinceLastIntervention = Date.now() - lastInterventionTimeRef.current;
    if (timeSinceLastIntervention < config.minIntervalMs) return false;
    
    // Check if intervention has expired
    if (intervention.validUntil && new Date(intervention.validUntil) < new Date()) return false;
    
    // Don't show if chat is already open unless high urgency
    if (isChatOpen && intervention.urgencyLevel !== 'high') return false;
    
    return true;
  }, [config, state, isChatOpen]);

  /**
   * Show an intervention
   */
  const showIntervention = useCallback((intervention: InterventionMessage) => {
    if (!shouldShowIntervention(intervention)) return false;
    
    setState(prev => ({
      ...prev,
      activeIntervention: intervention,
      isVisible: true
    }));
    
    interventionCountRef.current += 1;
    lastInterventionTimeRef.current = Date.now();
    
    // Track intervention shown
    trackInterventionEvent('intervention_shown', {
      interventionId: intervention.id,
      type: intervention.type,
      urgencyLevel: intervention.urgencyLevel,
      contextRelevant: intervention.contextRelevant,
      sessionTime: Date.now() - sessionStartRef.current,
      interventionCount: interventionCountRef.current
    });
    
    // Start response timer
    if (responseTimerRef.current) {
      clearTimeout(responseTimerRef.current);
    }
    
    return true;
  }, [shouldShowIntervention]);

  /**
   * Accept intervention and integrate with chat
   */
  const acceptIntervention = useCallback((interventionId: string) => {
    const intervention = state.activeIntervention;
    if (!intervention || intervention.id !== interventionId) return;
    
    const responseTime = Date.now() - lastInterventionTimeRef.current;
    
    // Open chat
    dispatch(openChat());
    
    // Add contextual message if provided
    if (intervention.contextualMessage) {
      dispatch(addMessage({
        id: uuidv4(),
        content: intervention.contextualMessage,
        sender: 'ai',
        timestamp: new Date().toISOString()
      }));
    }
    
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
      ...prev,\n      activeIntervention: null,\n      isVisible: false\n    }));\n    \n    if (responseTimerRef.current) {\n      clearTimeout(responseTimerRef.current);\n      responseTimerRef.current = null;\n    }\n  }, [state.activeIntervention, dispatch, isChatOpen]);\n\n  /**\n   * Dismiss intervention\n   */\n  const dismissIntervention = useCallback((interventionId: string, reason?: string) => {\n    const intervention = state.activeIntervention;\n    if (!intervention || intervention.id !== interventionId) return;\n    \n    const responseTime = Date.now() - lastInterventionTimeRef.current;\n    \n    // Add to dismissed set\n    setState(prev => ({\n      ...prev,\n      activeIntervention: null,\n      isVisible: false,\n      dismissedInterventions: new Set([...prev.dismissedInterventions, interventionId])\n    }));\n    \n    // Track dismissal\n    trackInterventionEvent('intervention_dismissed', {\n      interventionId,\n      responseTime,\n      reason: reason || 'user_dismissed',\n      type: intervention.type,\n      urgencyLevel: intervention.urgencyLevel\n    });\n    \n    if (responseTimerRef.current) {\n      clearTimeout(responseTimerRef.current);\n      responseTimerRef.current = null;\n    }\n  }, [state.activeIntervention]);\n\n  /**\n   * Snooze intervention\n   */\n  const snoozeIntervention = useCallback((interventionId: string, durationMs: number) => {\n    const intervention = state.activeIntervention;\n    if (!intervention || intervention.id !== interventionId) return;\n    \n    const responseTime = Date.now() - lastInterventionTimeRef.current;\n    const snoozeUntil = Date.now() + durationMs;\n    \n    // Add to snoozed map\n    setState(prev => ({\n      ...prev,\n      activeIntervention: null,\n      isVisible: false,\n      snoozedInterventions: new Map([...prev.snoozedInterventions, [interventionId, snoozeUntil]])\n    }));\n    \n    // Track snooze\n    trackInterventionEvent('intervention_snoozed', {\n      interventionId,\n      responseTime,\n      snoozeDurationMs: durationMs,\n      type: intervention.type,\n      urgencyLevel: intervention.urgencyLevel\n    });\n    \n    if (responseTimerRef.current) {\n      clearTimeout(responseTimerRef.current);\n      responseTimerRef.current = null;\n    }\n    \n    // Set timer to remove from snoozed map when expired\n    setTimeout(() => {\n      setState(prev => {\n        const newSnoozed = new Map(prev.snoozedInterventions);\n        newSnoozed.delete(interventionId);\n        return {\n          ...prev,\n          snoozedInterventions: newSnoozed\n        };\n      });\n    }, durationMs);\n  }, [state.activeIntervention]);\n\n  /**\n   * Handle intervention timeout\n   */\n  const timeoutIntervention = useCallback((interventionId: string) => {\n    const intervention = state.activeIntervention;\n    if (!intervention || intervention.id !== interventionId) return;\n    \n    const responseTime = Date.now() - lastInterventionTimeRef.current;\n    \n    // Clear intervention\n    setState(prev => ({\n      ...prev,\n      activeIntervention: null,\n      isVisible: false\n    }));\n    \n    // Track timeout\n    trackInterventionEvent('intervention_timeout', {\n      interventionId,\n      responseTime,\n      type: intervention.type,\n      urgencyLevel: intervention.urgencyLevel,\n      timeoutMs: config.autoTimeoutMs\n    });\n    \n    if (responseTimerRef.current) {\n      clearTimeout(responseTimerRef.current);\n      responseTimerRef.current = null;\n    }\n  }, [state.activeIntervention, config.autoTimeoutMs]);\n\n  /**\n   * Clear all intervention state (useful for session resets)\n   */\n  const clearInterventions = useCallback(() => {\n    setState({\n      activeIntervention: null,\n      isVisible: false,\n      dismissedInterventions: new Set(),\n      snoozedInterventions: new Map()\n    });\n    \n    interventionCountRef.current = 0;\n    lastInterventionTimeRef.current = 0;\n    \n    if (responseTimerRef.current) {\n      clearTimeout(responseTimerRef.current);\n      responseTimerRef.current = null;\n    }\n  }, []);\n\n  // Cleanup on unmount\n  useEffect(() => {\n    return () => {\n      if (responseTimerRef.current) {\n        clearTimeout(responseTimerRef.current);\n      }\n    };\n  }, []);\n\n  /**\n   * Get session analytics\n   */\n  const getSessionAnalytics = useCallback(() => {\n    return {\n      sessionDuration: Date.now() - sessionStartRef.current,\n      totalInterventions: interventionCountRef.current,\n      dismissedCount: state.dismissedInterventions.size,\n      snoozedCount: state.snoozedInterventions.size,\n      maxInterventionsReached: interventionCountRef.current >= config.maxInterventionsPerSession\n    };\n  }, [state, config]);\n\n  return {\n    // State\n    activeIntervention: state.activeIntervention,\n    isVisible: state.isVisible,\n    \n    // Actions\n    showIntervention,\n    acceptIntervention,\n    dismissIntervention,\n    snoozeIntervention,\n    timeoutIntervention,\n    clearInterventions,\n    \n    // Analytics\n    getSessionAnalytics,\n    \n    // Config\n    config\n  };\n}\n\n/**\n * Track intervention analytics events\n */\nfunction trackInterventionEvent(eventName: string, properties: Record<string, any>): void {\n  // Integration with analytics service\n  if (typeof window !== 'undefined' && window.gtag) {\n    window.gtag('event', eventName, {\n      event_category: 'proactive_interventions',\n      ...properties\n    });\n  }\n  \n  // Console logging for development\n  if (process.env.NODE_ENV === 'development') {\n    console.log('Intervention Event:', eventName, properties);\n  }\n}\n\n// Global gtag type for TypeScript\ndeclare global {\n  interface Window {\n    gtag?: (...args: any[]) => void;\n  }\n}