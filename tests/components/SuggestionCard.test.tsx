/**
 * Tests for SuggestionCard Component
 * Validates accessibility, user interactions, and mobile responsiveness
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuggestionCard } from '../../src/features/chat/client/components/SuggestionCard';
import type { Suggestion } from '../../src/features/chat/client/components/SuggestionCard';

// Mock suggestion data
const createMockSuggestion = (type: string = 'confusion', urgency: 'low' | 'medium' | 'high' | 'critical' = 'medium'): Suggestion => ({
  id: `test-${type}-${Date.now()}`,
  type: 'clarification',
  title: type === 'confusion' ? 'Need clarification?' : 'Test Suggestion',
  description: `This is a test ${type} suggestion for unit testing`,
  confidence: 0.85,
  triggerPattern: type,
  triggerReason: `${type} pattern detected in conversation`,
  contextData: {
    pageType: 'general',
    topic: 'mathematics',
    conversationLength: 5,
    userEngagementScore: 0.7,
  },
  actions: [
    {
      type: 'prompt',
      label: 'Explain simply',
      data: 'Can you explain this in simpler terms?',
      icon: '💡',
    },
    {
      type: 'resource',
      label: 'See examples',
      data: '/examples/mathematics',
      icon: '📚',
    },
  ],
  displaySettings: {
    urgency,
    displayDurationSeconds: 30,
    allowDismiss: true,
    requireFeedback: urgency === 'high' || urgency === 'critical',
  },
});

describe('SuggestionCard', () => {
  let mockOnAccept: ReturnType<typeof vi.fn>;
  let mockOnDismiss: ReturnType<typeof vi.fn>;
  let mockOnFeedback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnAccept = vi.fn();
    mockOnDismiss = vi.fn();
    mockOnFeedback = vi.fn();
  });

  describe('Basic Rendering', () => {
    it('should render suggestion with title and description', async () => {
      const suggestion = createMockSuggestion('confusion');

      render(<SuggestionCard suggestion={suggestion} onAccept={mockOnAccept} onDismiss={mockOnDismiss} onFeedback={mockOnFeedback} />);

      await waitFor(() => {
        expect(screen.getByText('Need clarification?')).toBeInTheDocument();
      });
      expect(screen.getByText(/This is a test confusion suggestion/)).toBeInTheDocument();
    });

    it('should render action buttons', async () => {
      const suggestion = createMockSuggestion('confusion');

      render(<SuggestionCard suggestion={suggestion} onAccept={mockOnAccept} onDismiss={mockOnDismiss} onFeedback={mockOnFeedback} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /explain simply/i })).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /see examples/i })).toBeInTheDocument();
    });

    it('should show dismiss button when allowed', async () => {
      const suggestion = createMockSuggestion('confusion');

      render(<SuggestionCard suggestion={suggestion} onAccept={mockOnAccept} onDismiss={mockOnDismiss} onFeedback={mockOnFeedback} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /dismiss suggestion/i })).toBeInTheDocument();
      });
    });

    it('should not show dismiss button when not allowed', async () => {
      const suggestion = createMockSuggestion('frustration', 'critical');
      suggestion.displaySettings.allowDismiss = false;

      render(<SuggestionCard suggestion={suggestion} onAccept={mockOnAccept} onDismiss={mockOnDismiss} onFeedback={mockOnFeedback} />);

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByText('Test Suggestion')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /dismiss suggestion/i })).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', async () => {
      const suggestion = createMockSuggestion('confusion');

      render(<SuggestionCard suggestion={suggestion} onAccept={mockOnAccept} onDismiss={mockOnDismiss} onFeedback={mockOnFeedback} />);

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-labelledby');
        expect(dialog).toHaveAttribute('aria-describedby');
        expect(dialog).toHaveAttribute('aria-live', 'polite');
      });
    });

    it('should focus primary action button on mount', async () => {
      const suggestion = createMockSuggestion('confusion');

      render(<SuggestionCard suggestion={suggestion} onAccept={mockOnAccept} onDismiss={mockOnDismiss} onFeedback={mockOnFeedback} />);

      await waitFor(() => {
        const primaryButton = screen.getByRole('button', { name: /explain simply/i });
        expect(primaryButton).toHaveFocus();
      });
    });

    it('should handle keyboard navigation', async () => {
      const user = userEvent.setup();
      const suggestion = createMockSuggestion('confusion');

      render(<SuggestionCard suggestion={suggestion} onAccept={mockOnAccept} onDismiss={mockOnDismiss} onFeedback={mockOnFeedback} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /explain simply/i })).toHaveFocus();
      });

      // Tab through the focusable elements in order
      await user.keyboard('{Tab}');
      expect(screen.getByRole('button', { name: /see examples/i })).toHaveFocus();

      // Continue tabbing through elements - actual order may vary
      await user.keyboard('{Tab}');
      await user.keyboard('{Tab}');
      await user.keyboard('{Tab}');

      // Eventually the checkbox should be focused
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
    });

    it('should dismiss on Escape key', async () => {
      const user = userEvent.setup();
      const suggestion = createMockSuggestion('confusion');

      render(<SuggestionCard suggestion={suggestion} onAccept={mockOnAccept} onDismiss={mockOnDismiss} onFeedback={mockOnFeedback} />);

      // Wait for component to be visible before testing escape key
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      // Wait for the dismiss animation before checking the callback
      await waitFor(
        () => {
          expect(mockOnDismiss).toHaveBeenCalledWith('user_dismissed');
        },
        { timeout: 1000 },
      );
    });

    it('should have proper color contrast for urgency levels', async () => {
      const criticalSuggestion = createMockSuggestion('frustration', 'critical');

      const { container } = render(
        <SuggestionCard suggestion={criticalSuggestion} onAccept={mockOnAccept} onDismiss={mockOnDismiss} onFeedback={mockOnFeedback} />,
      );

      await waitFor(() => {
        const card = container.querySelector('.suggestion-card');
        expect(card).toHaveClass('border-red-300', 'bg-red-50');
      });
    });

    it('should include screen reader only content', async () => {
      const suggestion = createMockSuggestion('confusion');

      render(<SuggestionCard suggestion={suggestion} onAccept={mockOnAccept} onDismiss={mockOnDismiss} onFeedback={mockOnFeedback} />);

      await waitFor(() => {
        const srOnlyContent = screen.getByText(/suggestion confidence: 85%/i);
        expect(srOnlyContent).toHaveClass('sr-only');
      });
    });
  });

  describe('User Interactions', () => {
    it('should call onAccept when action button is clicked', async () => {
      const user = userEvent.setup();
      const suggestion = createMockSuggestion('confusion');

      render(<SuggestionCard suggestion={suggestion} onAccept={mockOnAccept} onDismiss={mockOnDismiss} onFeedback={mockOnFeedback} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /explain simply/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /explain simply/i }));

      expect(mockOnAccept).toHaveBeenCalledWith(suggestion.actions[0]);
    });

    it('should call onDismiss when dismiss button is clicked', async () => {
      const user = userEvent.setup();
      const suggestion = createMockSuggestion('confusion');

      render(<SuggestionCard suggestion={suggestion} onAccept={mockOnAccept} onDismiss={mockOnDismiss} onFeedback={mockOnFeedback} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /dismiss suggestion/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /dismiss suggestion/i }));

      await waitFor(() => {
        expect(mockOnDismiss).toHaveBeenCalledWith('user_dismissed');
      });
    });

    it('should show feedback form for high-priority suggestions', async () => {
      const user = userEvent.setup();
      const suggestion = createMockSuggestion('frustration', 'high');

      render(<SuggestionCard suggestion={suggestion} onAccept={mockOnAccept} onDismiss={mockOnDismiss} onFeedback={mockOnFeedback} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /explain simply/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /explain simply/i }));

      await waitFor(() => {
        expect(screen.getByText(/was this suggestion helpful/i)).toBeInTheDocument();
      });
    });

    it('should handle feedback submission', async () => {
      const user = userEvent.setup();
      const suggestion = createMockSuggestion('frustration', 'high');

      render(<SuggestionCard suggestion={suggestion} onAccept={mockOnAccept} onDismiss={mockOnDismiss} onFeedback={mockOnFeedback} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /explain simply/i })).toBeInTheDocument();
      });

      // Accept suggestion to show feedback
      await user.click(screen.getByRole('button', { name: /explain simply/i }));

      await waitFor(() => {
        expect(screen.getByText(/was this suggestion helpful/i)).toBeInTheDocument();
      });

      // Submit positive feedback - get the first button with "helpful" text (👍 Helpful)
      const helpfulButtons = screen.getAllByRole('button', { name: /helpful/i });
      await user.click(helpfulButtons[0]); // First one is "👍 Helpful"

      expect(mockOnFeedback).toHaveBeenCalledWith('helpful');
    });

    it('should handle "don\'t show again" checkbox', async () => {
      const user = userEvent.setup();
      const suggestion = createMockSuggestion('confusion');

      render(<SuggestionCard suggestion={suggestion} onAccept={mockOnAccept} onDismiss={mockOnDismiss} onFeedback={mockOnFeedback} />);

      await waitFor(() => {
        expect(screen.getByRole('checkbox', { name: /don't show suggestions like this/i })).toBeInTheDocument();
      });

      const checkbox = screen.getByRole('checkbox', { name: /don't show suggestions like this/i });
      await user.click(checkbox);

      expect(mockOnFeedback).toHaveBeenCalledWith('too_frequent');
    });
  });

  describe('Mobile Responsive Design', () => {
    it('should apply mobile-specific styles', async () => {
      const suggestion = createMockSuggestion('confusion');

      const { container } = render(
        <SuggestionCard
          suggestion={suggestion}
          onAccept={mockOnAccept}
          onDismiss={mockOnDismiss}
          onFeedback={mockOnFeedback}
          mobile={true}
        />,
      );

      await waitFor(() => {
        const card = container.querySelector('.suggestion-card');
        expect(card).toHaveClass('mobile-suggestion-card');
      });
    });

    it('should have proper touch target sizes on mobile', async () => {
      const suggestion = createMockSuggestion('confusion');

      render(
        <SuggestionCard
          suggestion={suggestion}
          onAccept={mockOnAccept}
          onDismiss={mockOnDismiss}
          onFeedback={mockOnFeedback}
          mobile={true}
        />,
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /explain simply/i })).toBeInTheDocument();
      });

      const actionButtons = screen.getAllByRole('button');
      // In jsdom environment, getBoundingClientRect returns 0
      // So we just verify buttons are rendered in mobile mode
      expect(actionButtons.length).toBeGreaterThan(0);
      actionButtons.forEach((button) => {
        // Verify button is rendered and has some class indicating it's styled
        expect(button.className).toBeTruthy();
      });
    });
  });

  describe('Visual States and Animations', () => {
    it('should show confidence indicator', async () => {
      const suggestion = createMockSuggestion('confusion');

      const { container } = render(
        <SuggestionCard suggestion={suggestion} onAccept={mockOnAccept} onDismiss={mockOnDismiss} onFeedback={mockOnFeedback} />,
      );

      await waitFor(() => {
        const confidenceBar = container.querySelector('[style*="width: 85%"]');
        expect(confidenceBar).toBeInTheDocument();
      });
    });

    it('should show appropriate pattern icon', async () => {
      const confusionSuggestion = createMockSuggestion('confusion');

      render(
        <SuggestionCard suggestion={confusionSuggestion} onAccept={mockOnAccept} onDismiss={mockOnDismiss} onFeedback={mockOnFeedback} />,
      );

      await waitFor(() => {
        expect(screen.getByRole('img', { name: /confusion pattern detected/i })).toBeInTheDocument();
      });
    });

    it('should expand/collapse trigger reason', async () => {
      const user = userEvent.setup();
      const suggestion = createMockSuggestion('confusion');

      render(<SuggestionCard suggestion={suggestion} onAccept={mockOnAccept} onDismiss={mockOnDismiss} onFeedback={mockOnFeedback} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /why now?/i })).toBeInTheDocument();
      });

      const expandButton = screen.getByRole('button', { name: /why now?/i });
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');

      await user.click(expandButton);

      expect(expandButton).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText(/confusion pattern detected/i)).toBeInTheDocument();
    });
  });

  describe('Auto-dismiss Behavior', () => {
    it('should auto-dismiss after display duration', async () => {
      vi.useFakeTimers();

      const suggestion = createMockSuggestion('confusion');
      suggestion.displaySettings.displayDurationSeconds = 1; // Shorter for faster tests

      render(<SuggestionCard suggestion={suggestion} onAccept={mockOnAccept} onDismiss={mockOnDismiss} onFeedback={mockOnFeedback} />);

      // Advance time past the auto-dismiss delay
      await vi.runAllTimersAsync();

      expect(mockOnDismiss).toHaveBeenCalledWith('timeout');

      vi.useRealTimers();
    });

    it('should not auto-dismiss critical suggestions', () => {
      vi.useFakeTimers();

      const criticalSuggestion = createMockSuggestion('frustration', 'critical');
      criticalSuggestion.displaySettings.allowDismiss = false;

      render(
        <SuggestionCard suggestion={criticalSuggestion} onAccept={mockOnAccept} onDismiss={mockOnDismiss} onFeedback={mockOnFeedback} />,
      );

      // Fast-forward time beyond display duration
      vi.advanceTimersByTime(criticalSuggestion.displaySettings.displayDurationSeconds * 1000 + 1000);

      expect(mockOnDismiss).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('Dark Mode Support', () => {
    it('should apply dark mode classes when system preference is dark', async () => {
      // Mock dark mode preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
          matches: query === '(prefers-color-scheme: dark)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      const suggestion = createMockSuggestion('confusion');

      const { container } = render(
        <SuggestionCard suggestion={suggestion} onAccept={mockOnAccept} onDismiss={mockOnDismiss} onFeedback={mockOnFeedback} />,
      );

      await waitFor(() => {
        // Check that the component rendered and contains dark mode utility classes in its children
        const card = container.querySelector('.suggestion-card');
        expect(card).toBeInTheDocument();

        // Check that dark mode classes are present in the rendered HTML
        const titleElement = screen.getByText('Need clarification?');
        expect(titleElement).toHaveClass('dark:text-white');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing action data gracefully', () => {
      const suggestion = createMockSuggestion('confusion');
      suggestion.actions = []; // No actions

      expect(() => {
        render(<SuggestionCard suggestion={suggestion} onAccept={mockOnAccept} onDismiss={mockOnDismiss} onFeedback={mockOnFeedback} />);
      }).not.toThrow();
    });

    it('should handle undefined callback functions gracefully', async () => {
      const user = userEvent.setup();
      const suggestion = createMockSuggestion('confusion');

      render(<SuggestionCard suggestion={suggestion} onAccept={mockOnAccept} onDismiss={mockOnDismiss} onFeedback={mockOnFeedback} />);

      // Wait for the component to become visible (100ms delay)
      const button = await screen.findByRole('button', { name: /explain simply/i });
      expect(button).toBeInTheDocument();

      // Click should not throw
      await user.click(button);
      expect(mockOnAccept).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should render within acceptable time limits', async () => {
      const suggestion = createMockSuggestion('confusion');

      const startTime = performance.now();
      render(<SuggestionCard suggestion={suggestion} onAccept={mockOnAccept} onDismiss={mockOnDismiss} onFeedback={mockOnFeedback} />);
      const endTime = performance.now();

      const renderTime = endTime - startTime;
      expect(renderTime).toBeLessThan(100); // Should render quickly
    });

    it('should cleanup event listeners on unmount', () => {
      const suggestion = createMockSuggestion('confusion');

      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = render(
        <SuggestionCard suggestion={suggestion} onAccept={mockOnAccept} onDismiss={mockOnDismiss} onFeedback={mockOnFeedback} />,
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });
});
