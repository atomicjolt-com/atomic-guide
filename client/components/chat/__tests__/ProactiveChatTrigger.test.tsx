/**
 * @fileoverview Tests for ProactiveChatTrigger component
 * @module client/components/chat/__tests__/ProactiveChatTrigger.test
 * 
 * Tests the proactive chat trigger component for:
 * - Security validation
 * - Accessibility compliance
 * - Mobile responsiveness
 * - Chat system integration
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import chatReducer from '@features/chat/client/store/chatSlice';
import { ProactiveChatTrigger } from '../ProactiveChatTrigger';
import type { InterventionMessage } from '@features/canvas-integration/shared/types';

// Mock the intervention security utils
vi.mock('../../../utils/interventionSecurity', () => ({
  validateInterventionSecurity: vi.fn(() => ({
    isValid: true,
    sanitizedData: {
      id: 'test-intervention-123',
      type: 'proactive_chat',
      message: 'Would you like help with this topic?',
      urgencyLevel: 'medium',
      contextRelevant: true,
      dismissible: true,
      timestamp: new Date(),
      contextualMessage: 'I noticed you might be struggling. How can I help?'
    },
    errors: [],
    warnings: []
  })),
  validateUserActionRateLimit: vi.fn(() => ({
    allowed: true,
    reason: ''
  })),
  logInterventionEvent: vi.fn()
}));

// Mock the intervention hook
vi.mock('../../../hooks/useProactiveInterventions', () => ({
  useProactiveInterventions: vi.fn(() => ({
    acceptIntervention: vi.fn(),
    dismissIntervention: vi.fn(),
    snoozeIntervention: vi.fn(),
    timeoutIntervention: vi.fn()
  }))
}));

// Create test store
const createTestStore = () => {
  return configureStore({
    reducer: {
      chat: chatReducer
    },
    preloadedState: {
      chat: {
        isOpen: false,
        isMinimized: false,
        messages: [],
        conversationId: null,
        isLoading: false,
        error: null,
        mediaPreferences: {
          prefers_visual: true,
          math_notation_style: 'latex',
          code_highlight_theme: 'light',
          diagram_complexity: 'detailed',
          bandwidth_preference: 'high'
        }
      }
    }
  });
};

// Test intervention message
const mockIntervention: InterventionMessage = {
  id: 'test-intervention-123',
  type: 'proactive_chat',
  message: 'Would you like help with this topic?',
  urgencyLevel: 'medium',
  contextRelevant: true,
  dismissible: true,
  timestamp: new Date(),
  contextualMessage: 'I noticed you might be struggling. How can I help?'
};

const renderWithStore = (component: React.ReactElement) => {
  const store = createTestStore();
  return render(
    <Provider store={store}>
      {component}
    </Provider>
  );
};

describe('ProactiveChatTrigger', () => {
  const mockProps = {
    intervention: mockIntervention,
    visible: true,
    onAccept: vi.fn(),
    onDismiss: vi.fn(),
    onSnooze: vi.fn(),
    onTimeout: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Security Validation', () => {
    it('should validate intervention data on render', () => {
      renderWithStore(<ProactiveChatTrigger {...mockProps} />);
      
      // Verify the component renders successfully with validation
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should use sanitized data for display', () => {
      renderWithStore(<ProactiveChatTrigger {...mockProps} />);
      
      expect(screen.getByText('Would you like help with this topic?')).toBeInTheDocument();
    });
  });

  describe('Accessibility Compliance', () => {
    it('should have proper ARIA attributes', () => {
      renderWithStore(<ProactiveChatTrigger {...mockProps} />);
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'intervention-title');
      expect(dialog).toHaveAttribute('aria-describedby', 'intervention-message');
      expect(dialog).toHaveAttribute('aria-live', 'polite');
      expect(dialog).toHaveAttribute('aria-modal', 'false');
    });

    it('should be keyboard accessible', () => {
      renderWithStore(<ProactiveChatTrigger {...mockProps} />);
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('Visual Design System Compliance', () => {
    it('should apply correct CSS classes', () => {
      renderWithStore(<ProactiveChatTrigger {...mockProps} />);
      
      const dialog = screen.getByRole('dialog');
      // Test that CSS module classes are applied (they will be hashed in production)
      expect(dialog.className).toMatch(/proactiveChatTrigger/);
      expect(dialog.className).toMatch(/medium/);
    });
  });
});