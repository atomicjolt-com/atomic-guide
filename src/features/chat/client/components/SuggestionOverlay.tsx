/**
 * SuggestionOverlay Component
 * Manages suggestion display positioning, timing, and mobile responsiveness
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import SuggestionCard, { Suggestion, SuggestionAction } from './SuggestionCard';

export interface SuggestionOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  className?: string;
}

export interface SuggestionQueue {
  suggestions: Suggestion[];
  currentIndex: number;
}

export const SuggestionOverlay: React.FC<SuggestionOverlayProps> = ({
  isVisible,
  onClose,
  className = ''
}) => {
  const [currentSuggestion, setCurrentSuggestion] = useState<Suggestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch next suggestion when overlay becomes visible
  useEffect(() => {
    if (isVisible && !currentSuggestion) {
      fetchNextSuggestion();
    }
  }, [isVisible, currentSuggestion, fetchNextSuggestion]);

  // Handle click outside to close (desktop only)
  useEffect(() => {
    if (!isVisible || isMobile) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isVisible, isMobile, handleClose]);

  // Prevent body scroll when mobile overlay is open
  useEffect(() => {
    if (isVisible && isMobile) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isVisible, isMobile]);

  // Handle swipe gestures on mobile
  useEffect(() => {
    if (!isMobile || !isVisible) return;

    let startY = 0;
    let currentY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      currentY = e.touches[0].clientY;
    };

    const handleTouchEnd = () => {
      const deltaY = startY - currentY;
      
      // Swipe up to expand, swipe down to dismiss
      if (deltaY < -100) {
        handleClose();
      }
    };

    if (overlayRef.current) {
      const element = overlayRef.current;
      element.addEventListener('touchstart', handleTouchStart, { passive: true });
      element.addEventListener('touchmove', handleTouchMove, { passive: true });
      element.addEventListener('touchend', handleTouchEnd);

      return () => {
        element.removeEventListener('touchstart', handleTouchStart);
        element.removeEventListener('touchmove', handleTouchMove);
        element.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isMobile, isVisible, handleClose]);

  const fetchNextSuggestion = useCallback(async() => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/chat/suggestions/next', {
        headers: {
          'X-Tenant-ID': getTenantId(),
          'X-Learner-ID': getLearnerId(),
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentSuggestion(data.suggestion);
      }
    } catch (error) {
      console.error('Error fetching suggestion:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleAccept = async(action: SuggestionAction) => {
    if (!currentSuggestion) return;

    try {
      // Record acceptance
      await fetch('/api/chat/suggestions/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          suggestionId: currentSuggestion.id,
          action: 'accepted',
          followupBehavior: `executed_${action.type}`
        }),
      });

      // Execute the action
      await executeAction(action);

      // Close overlay
      handleClose();

    } catch (error) {
      console.error('Error accepting suggestion:', error);
    }
  };

  const handleDismiss = async(feedback?: string) => {
    if (!currentSuggestion) return;

    try {
      // Record dismissal
      await fetch('/api/chat/suggestions/dismiss', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          suggestionId: currentSuggestion.id,
          reason: feedback || 'user_dismissed',
          contextData: {
            dismissedAt: new Date().toISOString(),
            pageType: getCurrentPageType(),
            mobile: isMobile
          }
        }),
      });

      handleClose();

    } catch (error) {
      console.error('Error dismissing suggestion:', error);
      handleClose(); // Still close even if logging fails
    }
  };

  const handleFeedback = async(feedback: 'helpful' | 'not_helpful' | 'too_frequent' | 'wrong_timing' | 'irrelevant') => {
    if (!currentSuggestion) return;

    try {
      await fetch('/api/chat/suggestions/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          suggestionId: currentSuggestion.id,
          action: 'feedback_provided',
          feedback: feedback,
          details: `User provided ${feedback} feedback`
        }),
      });

      handleClose();

    } catch (error) {
      console.error('Error submitting feedback:', error);
      handleClose(); // Still close even if logging fails
    }
  };

  const handleClose = useCallback(() => {
    setCurrentSuggestion(null);
    onClose();
  }, [onClose]);

  const executeAction = async(action: SuggestionAction) => {
    switch (action.type) {
      case 'prompt': {
        // Send the suggested prompt to the chat
        const chatInput = document.querySelector('textarea[placeholder*="message"]') as HTMLTextAreaElement;
        if (chatInput) {
          chatInput.value = action.data;
          chatInput.focus();
          
          // Trigger input event to notify React
          const event = new Event('input', { bubbles: true });
          chatInput.dispatchEvent(event);
        }
        break;
      }

      case 'resource':
        // Navigate to resource
        if (action.data.startsWith('/')) {
          window.open(action.data, '_blank', 'noopener,noreferrer');
        }
        break;

      case 'escalation':
        // Handle escalation (would integrate with LMS or instructor notification system)
        if (action.data.escalationType === 'immediate') {
          await notifyInstructor(action.data);
        }
        break;

      case 'practice':
        // Navigate to practice problems
        window.open(`/practice?difficulty=${action.data.difficulty}&topic=${action.data.topic}`, '_blank');
        break;

      case 'break':
        // Show break suggestion message
        showBreakMessage(action.data);
        break;

      default:
        console.warn('Unknown action type:', action.type);
    }
  };

  const notifyInstructor = async(escalationData: any) => {
    // This would integrate with the LMS notification system
    console.log('Notifying instructor:', escalationData);
  };

  const showBreakMessage = (message: string) => {
    // This could show a toast or modal with the break message
    alert(message); // Placeholder - would use proper notification system
  };

  const getTenantId = (): string => {
    // Get tenant ID from context or localStorage
    return localStorage.getItem('tenantId') || '';
  };

  const getLearnerId = (): string => {
    // Get learner ID from context or localStorage
    return localStorage.getItem('learnerId') || '';
  };

  const getCurrentPageType = (): string => {
    // Detect current page type from URL or page context
    const path = window.location.pathname;
    if (path.includes('quiz')) return 'quiz';
    if (path.includes('exam')) return 'exam';
    if (path.includes('assignment')) return 'assignment';
    return 'general';
  };

  if (!isVisible) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={`suggestion-overlay ${isMobile ? 'mobile' : 'desktop'} ${className}`}>
        <div className="loading-container">
          <div className="loading-spinner" />
          <span className="sr-only">Loading suggestion...</span>
        </div>
      </div>
    );
  }

  if (!currentSuggestion) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      className={`
        suggestion-overlay
        ${isMobile ? 'mobile' : 'desktop'}
        ${className}
        ${isVisible ? 'animate-overlay-enter' : 'animate-overlay-exit'}
      `}
      role="dialog"
      aria-modal={isMobile}
      aria-label="Learning suggestion"
    >
      {isMobile && (
        <>
          {/* Backdrop for mobile */}
          <div 
            className="overlay-backdrop"
            onClick={handleClose}
            aria-hidden="true"
          />
          
          {/* Handle for swipe gesture indication */}
          <div className="mobile-handle" aria-hidden="true">
            <div className="handle-bar" />
          </div>
        </>
      )}

      <div className="suggestion-container">
        <SuggestionCard
          suggestion={currentSuggestion}
          onAccept={handleAccept}
          onDismiss={handleDismiss}
          onFeedback={handleFeedback}
          mobile={isMobile}
        />
      </div>
    </div>
  );
};

// CSS Styles for the overlay
const overlayStyles = `
  /* Desktop positioning */
  .suggestion-overlay.desktop {
    position: fixed;
    bottom: 100px;
    right: 24px;
    z-index: 1000;
    pointer-events: none;
  }

  .suggestion-overlay.desktop .suggestion-container {
    pointer-events: all;
  }

  /* Mobile bottom sheet */
  .suggestion-overlay.mobile {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    max-height: 80vh;
  }

  .overlay-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(2px);
  }

  .mobile-handle {
    display: flex;
    justify-content: center;
    padding: 8px 0;
    background: white;
    border-radius: 12px 12px 0 0;
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
  }

  .handle-bar {
    width: 36px;
    height: 4px;
    background-color: #D0D0D0;
    border-radius: 2px;
  }

  .suggestion-container {
    background: white;
    padding: 16px;
    border-radius: 0 0 0 0;
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
    max-height: calc(80vh - 40px);
    overflow-y: auto;
  }

  .suggestion-overlay.mobile .suggestion-container {
    border-radius: 0;
    margin: 0;
  }

  /* Loading state */
  .loading-container {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .loading-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid #f3f3f3;
    border-top: 2px solid #FFDD00;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Entrance/exit animations */
  @keyframes overlay-enter-desktop {
    0% {
      opacity: 0;
      transform: translateY(24px) translateX(24px) scale(0.95);
    }
    100% {
      opacity: 1;
      transform: translateY(0) translateX(0) scale(1);
    }
  }

  @keyframes overlay-exit-desktop {
    0% {
      opacity: 1;
      transform: translateY(0) translateX(0) scale(1);
    }
    100% {
      opacity: 0;
      transform: translateY(16px) translateX(16px) scale(0.98);
    }
  }

  @keyframes overlay-enter-mobile {
    0% {
      transform: translateY(100%);
    }
    100% {
      transform: translateY(0);
    }
  }

  @keyframes overlay-exit-mobile {
    0% {
      transform: translateY(0);
    }
    100% {
      transform: translateY(100%);
    }
  }

  .animate-overlay-enter.desktop {
    animation: overlay-enter-desktop 300ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .animate-overlay-exit.desktop {
    animation: overlay-exit-desktop 200ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .animate-overlay-enter.mobile {
    animation: overlay-enter-mobile 300ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .animate-overlay-exit.mobile {
    animation: overlay-exit-mobile 250ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .mobile-handle,
    .suggestion-container {
      background-color: #111111;
      border-color: #333333;
    }
    
    .handle-bar {
      background-color: #666666;
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .animate-overlay-enter,
    .animate-overlay-exit {
      animation: none;
    }
    
    .loading-spinner {
      animation: none;
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .overlay-backdrop {
      background-color: rgba(0, 0, 0, 0.8);
    }
    
    .suggestion-container {
      border: 2px solid black;
    }
  }

  /* Responsive breakpoints */
  @media (max-width: 480px) {
    .suggestion-overlay.mobile .suggestion-container {
      padding: 12px;
    }
  }

  @media (min-width: 769px) {
    .suggestion-overlay.desktop {
      bottom: 120px;
      right: 32px;
    }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = overlayStyles;
  document.head.appendChild(styleSheet);
}

export default SuggestionOverlay;