/**
 * @fileoverview Proactive Chat Trigger Component for Story 5.1
 * @module client/components/chat/ProactiveChatTrigger
 * 
 * Non-intrusive intervention component that appears when struggle is detected.
 * Provides contextual help offers with personalized messaging and optimal timing.
 * 
 * Features:
 * - Non-disruptive presentation during natural break points
 * - Context-aware messaging based on current Canvas content
 * - Accessibility-compliant interface (WCAG 2.1 AA)
 * - Adaptive messaging based on Learner DNA profiles
 * - Effectiveness tracking and user preference learning
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { InterventionMessage } from '@features/canvas-integration/shared/types';
import { useProactiveInterventions } from '../../hooks/useProactiveInterventions';
import { 
  validateInterventionSecurity, 
  validateUserActionRateLimit,
  logInterventionEvent 
} from '../../utils/interventionSecurity';
import styles from '../../styles/components/proactive-chat-trigger.module.css';

/**
 * Intervention urgency levels with different visual treatments
 */
export type InterventionUrgency = 'low' | 'medium' | 'high';

/**
 * User response options for interventions
 */
export type InterventionResponse = 'accepted' | 'dismissed' | 'snoozed' | 'timeout';

/**
 * Props for ProactiveChatTrigger component
 */
export interface ProactiveChatTriggerProps {
  /** Intervention message to display */
  intervention: InterventionMessage;
  
  /** Whether the trigger should be visible */
  visible: boolean;
  
  /** Callback when user accepts the intervention */
  onAccept: (interventionId: string) => void;
  
  /** Callback when user dismisses the intervention */
  onDismiss: (interventionId: string, reason?: string) => void;
  
  /** Callback when user snoozes the intervention */
  onSnooze?: (interventionId: string, duration: number) => void;
  
  /** Callback when intervention times out */
  onTimeout: (interventionId: string) => void;
  
  /** Custom positioning for the trigger */
  position?: {
    top?: string | number;
    right?: string | number;
    bottom?: string | number;
    left?: string | number;
  };
  
  /** Animation preferences */
  animation?: {
    enabled: boolean;
    duration: number;
    easing: string;
  };
  
  /** Accessibility options */
  accessibility?: {
    announceToScreenReader: boolean;
    focusOnAppear: boolean;
    keyboardDismissible: boolean;
  };
  
  /** Theme customization */
  theme?: {
    primaryColor?: string;
    backgroundColor?: string;
    textColor?: string;
    borderRadius?: string;
  };
  
  /** Additional CSS classes */
  className?: string;
  
  /** Test ID for testing */
  testId?: string;
}

/**
 * Default configuration values aligned with Atomic Jolt design system
 */
const DEFAULT_CONFIG = {
  position: { top: 20, right: 20 },
  animation: { enabled: true, duration: 300, easing: 'ease-out' },
  accessibility: { 
    announceToScreenReader: true, 
    focusOnAppear: true, 
    keyboardDismissible: true 
  },
  theme: {
    primaryColor: '#FFDD00', // Brand yellow
    backgroundColor: '#FFFFFF', // Brand white
    textColor: '#333333', // Brand neutral dark
    borderRadius: '8px' // Consistent with chat system
  },
  autoTimeoutMs: 30000, // 30 seconds
  snoozeOptions: [
    { label: '5 minutes', value: 300000 },
    { label: '10 minutes', value: 600000 },
    { label: '30 minutes', value: 1800000 }
  ]
};

/**
 * Proactive Chat Trigger Component
 * 
 * Displays contextual intervention messages when students are detected
 * to be struggling. Provides non-intrusive, accessible interface for
 * accepting or dismissing proactive help offers.
 */
export function ProactiveChatTrigger({
  intervention,
  visible,
  onAccept,
  onDismiss,
  onSnooze,
  onTimeout,
  position = DEFAULT_CONFIG.position,
  animation = DEFAULT_CONFIG.animation,
  accessibility = DEFAULT_CONFIG.accessibility,
  theme = DEFAULT_CONFIG.theme,
  className = '',
  testId = 'proactive-chat-trigger'
}: ProactiveChatTriggerProps): React.ReactElement | null {
  
  // Component state - MUST be called unconditionally
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(DEFAULT_CONFIG.autoTimeoutMs);
  
  // Refs for accessibility and cleanup - MUST be called unconditionally
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  
  // Integration with intervention management hook - MUST be called unconditionally
  const { acceptIntervention, dismissIntervention, snoozeIntervention, timeoutIntervention } = useProactiveInterventions();
  
  // Clear auto-timeout helper
  const clearAutoTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  // Handle close with animation
  const handleClose = useCallback((reason: string) => {
    if (animation.enabled) {
      setIsAnimating(true);
      setTimeout(() => {
        setIsVisible(false);
        setIsAnimating(false);
        setShowSnoozeOptions(false);
      }, animation.duration);
    } else {
      setIsVisible(false);
      setShowSnoozeOptions(false);
    }
    
    // Analytics tracking
    trackInteractionEvent('intervention_closed', {
      interventionId: intervention.id,
      reason,
      urgencyLevel: intervention.urgencyLevel,
      timeShown: DEFAULT_CONFIG.autoTimeoutMs - timeRemaining
    });
  }, [animation, intervention.id, intervention.urgencyLevel, timeRemaining]);

  // Handle timeout - MUST be defined before startAutoTimeout
  const handleTimeout = useCallback(() => {
    const sanitizedIntervention = validateInterventionSecurity(intervention).sanitizedData || intervention;
    clearAutoTimeout();
    timeoutIntervention(sanitizedIntervention.id);
    onTimeout(sanitizedIntervention.id);
    logInterventionEvent('intervention_timeout', sanitizedIntervention.id);
    handleClose('timeout');
  }, [intervention, onTimeout, clearAutoTimeout, timeoutIntervention, handleClose]);
  
  // Auto-timeout management - MUST be defined after handleTimeout
  const startAutoTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }

    setTimeRemaining(DEFAULT_CONFIG.autoTimeoutMs);
    
    // Start countdown
    countdownRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1000) {
          handleTimeout();
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    // Set auto-timeout
    timeoutRef.current = setTimeout(() => {
      handleTimeout();
    }, DEFAULT_CONFIG.autoTimeoutMs);
  }, [handleTimeout]);

  // Event handlers - MUST be defined before useEffect
  const handleAccept = useCallback(() => {
    const sanitizedIntervention = validateInterventionSecurity(intervention).sanitizedData || intervention;
    // Validate user action rate limit
    const rateLimitResult = validateUserActionRateLimit();
    if (!rateLimitResult.allowed) {
      console.warn('User action rate limit exceeded:', rateLimitResult.reason);
      return;
    }
    
    clearAutoTimeout();
    acceptIntervention(sanitizedIntervention.id);
    onAccept(sanitizedIntervention.id);
    logInterventionEvent('intervention_accepted', sanitizedIntervention.id);
    handleClose('accepted');
  }, [intervention, onAccept, clearAutoTimeout, acceptIntervention, handleClose]);

  const handleDismiss = useCallback((reason?: string) => {
    const sanitizedIntervention = validateInterventionSecurity(intervention).sanitizedData || intervention;
    // Validate user action rate limit
    const rateLimitResult = validateUserActionRateLimit();
    if (!rateLimitResult.allowed) {
      console.warn('User action rate limit exceeded:', rateLimitResult.reason);
      return;
    }
    
    clearAutoTimeout();
    dismissIntervention(sanitizedIntervention.id, reason);
    onDismiss(sanitizedIntervention.id, reason);
    logInterventionEvent('intervention_dismissed', sanitizedIntervention.id, { reason });
    handleClose('dismissed');
  }, [intervention, onDismiss, clearAutoTimeout, dismissIntervention, handleClose]);

  const handleSnooze = useCallback((duration: number) => {
    const sanitizedIntervention = validateInterventionSecurity(intervention).sanitizedData || intervention;
    // Validate user action rate limit
    const rateLimitResult = validateUserActionRateLimit();
    if (!rateLimitResult.allowed) {
      console.warn('User action rate limit exceeded:', rateLimitResult.reason);
      return;
    }
    
    clearAutoTimeout();
    snoozeIntervention(sanitizedIntervention.id, duration);
    if (onSnooze) {
      onSnooze(sanitizedIntervention.id, duration);
    }
    logInterventionEvent('intervention_snoozed', sanitizedIntervention.id, { duration });
    setShowSnoozeOptions(false);
    handleClose('snoozed');
  }, [intervention, onSnooze, clearAutoTimeout, snoozeIntervention, handleClose]);

  // Enhanced keyboard event handling for accessibility
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!accessibility.keyboardDismissible) return;
    
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        if (showSnoozeOptions) {
          setShowSnoozeOptions(false);
        } else {
          handleDismiss('keyboard_escape');
        }
        break;
      case 'Enter':
        if (event.target === triggerRef.current) {
          event.preventDefault();
          handleAccept();
        }
        break;
      case 'Tab':
        // Let browser handle tab navigation
        break;
      case 'ArrowDown':
      case 'ArrowUp':
        // Allow arrow key navigation within snooze options
        if (showSnoozeOptions) {
          event.preventDefault();
          const buttons = event.currentTarget.querySelectorAll('.snooze-button');
          const currentIndex = Array.from(buttons).findIndex(btn => btn === document.activeElement);
          let nextIndex;
          
          if (event.key === 'ArrowDown') {
            nextIndex = currentIndex < buttons.length - 1 ? currentIndex + 1 : 0;
          } else {
            nextIndex = currentIndex > 0 ? currentIndex - 1 : buttons.length - 1;
          }
          
          (buttons[nextIndex] as HTMLElement)?.focus();
        }
        break;
    }
  }, [accessibility.keyboardDismissible, handleDismiss, handleAccept, showSnoozeOptions]);

  // Security validation
  const securityValidation = validateInterventionSecurity(intervention);
  
  // Use sanitized intervention data or fallback to original intervention
  const sanitizedIntervention = securityValidation.sanitizedData || intervention;
  
  // Handle visibility changes with animation
  useEffect(() => {
    if (visible && !isVisible) {
      setIsVisible(true);
      if (animation.enabled) {
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), animation.duration);
      }
      
      // Start auto-timeout countdown
      startAutoTimeout();
      
      // Focus for accessibility
      if (accessibility.focusOnAppear) {
        setTimeout(() => {
          triggerRef.current?.focus();
        }, animation.enabled ? animation.duration : 0);
      }
      
      // Announce to screen readers
      if (accessibility.announceToScreenReader) {
        announceToScreenReader(
          `Proactive help offer: ${intervention.message}. Use Tab to navigate options.`
        );
      }
      
    } else if (!visible && isVisible) {
      handleClose('programmatic');
    }
  }, [visible, isVisible, animation, accessibility, intervention.message, startAutoTimeout, handleClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAutoTimeout();
    };
  }, [clearAutoTimeout]);
  
  // Early return for security validation failures
  if (!securityValidation.isValid) {
    console.error('Intervention failed security validation:', securityValidation.errors);
    logInterventionEvent('security_validation_failed', intervention.id, {
      errors: securityValidation.errors,
      warnings: securityValidation.warnings
    });
    return null;
  }

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  // Determine urgency styling (use sanitized intervention)
  const urgencyStyles = getUrgencyStyles(sanitizedIntervention.urgencyLevel, theme);
  
  // Calculate position styles with mobile responsiveness
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 767;
  const positionStyles: React.CSSProperties = isMobile ? {
    // Mobile positioning handled by CSS
  } : {
    position: 'fixed',
    zIndex: 10000,
    ...position
  };

  // Animation styles
  const animationStyles: React.CSSProperties = animation.enabled ? {
    transition: `all ${animation.duration}ms ${animation.easing}`,
    transform: isAnimating ? 'scale(0.95) translateY(-10px)' : 'scale(1) translateY(0)',
    opacity: isAnimating ? 0.7 : 1
  } : {};

  return (
    <div
      ref={triggerRef}
      data-testid={testId}
      className={`${styles.proactiveChatTrigger} ${styles[urgencyStyles.className]} ${className}`}
      style={{
        ...positionStyles,
        ...animationStyles
      }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="dialog"
      aria-labelledby="intervention-title"
      aria-describedby="intervention-message"
      aria-live="polite"
      aria-modal="false"
      aria-atomic="true"
    >
      {/* Security validation warnings */}
      {securityValidation.warnings.length > 0 && (
        <div className={styles.srOnly}>
          Security warnings: {securityValidation.warnings.join(', ')}
        </div>
      )}
      {/* Header with urgency indicator */}
      <div className={styles.header}>
        <div
          className={styles.urgencyIndicator}
          style={{ backgroundColor: urgencyStyles.color }}
          aria-hidden="true"
        />
        <h3
          id="intervention-title"
          className={styles.title}
          role="heading"
          aria-level={2}
        >
          {getInterventionTitle(sanitizedIntervention.type, sanitizedIntervention.urgencyLevel)}
        </h3>
        {sanitizedIntervention.urgencyLevel === 'high' && (
          <span
            className={styles.urgentBadge}
            style={{ backgroundColor: urgencyStyles.color }}
          >
            URGENT
          </span>
        )}
      </div>

      {/* Message content */}
      <div className={styles.content}>
        <p
          id="intervention-message"
          className={styles.message}
          role="text"
        >
          {sanitizedIntervention.message}
        </p>
        
        {sanitizedIntervention.contextRelevant && (
          <div className={styles.contextHint}>
            💡 This suggestion is based on your current activity
          </div>
        )}
      </div>

      {/* Snooze options */}
      {showSnoozeOptions && (
        <div className={styles.snoozeOptions}>
          <p className={styles.snoozeTitle} id="snooze-options-label">
            Remind me in:
          </p>
          <div 
            className={styles.snoozeButtons}
            role="group"
            aria-labelledby="snooze-options-label"
          >
            {DEFAULT_CONFIG.snoozeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleSnooze(option.value)}
                className={`${styles.snoozeButton} snooze-button`}
                type="button"
                aria-label={`Snooze intervention for ${option.label}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div 
        className={styles.actions}
        style={{
          borderTop: showSnoozeOptions ? 'none' : undefined
        }}
      >
        <button
          onClick={handleAccept}
          className={styles.primaryButton}
          type="button"
          aria-describedby="intervention-message"
        >
          {getAcceptButtonText(sanitizedIntervention.type)}
        </button>
        
        <button
          onClick={() => handleDismiss('user_dismissed')}
          className={styles.secondaryButton}
          type="button"
          title="Dismiss this suggestion"
          aria-label="Dismiss intervention"
        >
          ✕
        </button>
        
        {onSnooze && !showSnoozeOptions && (
          <button
            onClick={() => setShowSnoozeOptions(true)}
            className={styles.secondaryButton}
            type="button"
            title="Snooze this suggestion"
            aria-label="Snooze intervention"
            aria-expanded={showSnoozeOptions}
            aria-haspopup="true"
          >
            ⏰
          </button>
        )}
      </div>

      {/* Timeout indicator */}
      {timeRemaining > 0 && sanitizedIntervention.urgencyLevel !== 'high' && (
        <div className={styles.timeoutProgress} aria-hidden="true">
          <div
            className={styles.timeoutBar}
            style={{
              width: `${(timeRemaining / DEFAULT_CONFIG.autoTimeoutMs) * 100}%`
            }}
          />
        </div>
      )}
    </div>
  );
}

// Helper functions

function getUrgencyStyles(urgency: InterventionUrgency, theme: any) {
  switch (urgency) {
    case 'high':
      return {
        className: 'urgent',
        style: { border: '2px solid #B42318' }, // Use design system error red
        color: '#B42318'
      };
    case 'medium':
      return {
        className: 'medium',
        style: { border: '2px solid #EBCB00' }, // Use design system yellow dark
        color: '#EBCB00'
      };
    case 'low':
    default:
      return {
        className: 'low',
        style: { border: `1px solid ${theme.primaryColor}` },
        color: theme.primaryColor
      };
  }
}

function getInterventionTitle(type: string, urgency: InterventionUrgency): string {
  const titles = {
    proactive_chat: urgency === 'high' ? 'Immediate Help Available' : 'Would you like help?',
    content_suggestion: 'Helpful Resources',
    break_reminder: 'Take a Break?',
    help_offer: 'Need Assistance?'
  };
  
  return titles[type as keyof typeof titles] || 'Learning Support';
}

function getAcceptButtonText(type: string): string {
  const buttonTexts = {
    proactive_chat: 'Yes, help me',
    content_suggestion: 'Show resources',
    break_reminder: 'Take a break',
    help_offer: 'Get help'
  };
  
  return buttonTexts[type as keyof typeof buttonTexts] || 'Accept';
}


function announceToScreenReader(message: string): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.style.cssText = `
    position: absolute !important;
    width: 1px !important;
    height: 1px !important;
    padding: 0 !important;
    margin: -1px !important;
    overflow: hidden !important;
    clip: rect(0, 0, 0, 0) !important;
    white-space: nowrap !important;
    border: 0 !important;
  `;
  
  document.body.appendChild(announcement);
  announcement.textContent = message;
  
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

function trackInteractionEvent(eventName: string, properties: Record<string, any>): void {
  // Analytics tracking - would integrate with analytics service
  console.log('Intervention interaction:', eventName, properties);
}

export default ProactiveChatTrigger;