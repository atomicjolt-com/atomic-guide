/**
 * @fileoverview Tests for DeepLinkingInterface component
 * @module features/assessment/client/components/DeepLinkingInterface.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeepLinkingInterface } from './DeepLinkingInterface';
import * as assessmentDeepLink from '../services/assessmentDeepLink';
import type { LaunchSettings } from '@atomicjolt/lti-client';

// Mock the assessment deep link service
vi.mock('../services/assessmentDeepLink', () => ({
  submitAssessmentDeepLink: vi.fn(),
  canCreateAssessmentLink: vi.fn(),
}));

// Mock the legacy deep linking service
vi.mock('../../../../../client/services/deepLinkingService', () => ({
  setupDeepLinkingButton: vi.fn(),
}));

describe('DeepLinkingInterface', () => {
  const mockLaunchSettings: LaunchSettings = {
    jwt: 'test-jwt-token',
    deepLinking: {
      acceptTypes: ['ltiResourceLink'],
      acceptMultiple: false,
      returnUrl: 'https://canvas.test/return',
      acceptPresentationDocumentTargets: ['iframe'],
    },
    contextId: 'test-context',
    userId: 'test-user',
  };

  const mockOnComplete = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default mock implementations
    vi.mocked(assessmentDeepLink.canCreateAssessmentLink).mockReturnValue(true);
    vi.mocked(assessmentDeepLink.submitAssessmentDeepLink).mockResolvedValue('signed-jwt');
  });

  it('should render the deep linking interface', () => {
    render(
      <DeepLinkingInterface
        launchSettings={mockLaunchSettings}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText(/Create AI-Powered Assessment/i)).toBeInTheDocument();
    expect(screen.getByText(/Assessment Builder/i)).toBeInTheDocument();
  });

  it('should display warning when ltiResourceLink is not accepted', () => {
    vi.mocked(assessmentDeepLink.canCreateAssessmentLink).mockReturnValue(false);

    render(
      <DeepLinkingInterface
        launchSettings={{
          ...mockLaunchSettings,
          deepLinking: {
            ...mockLaunchSettings.deepLinking!,
            acceptTypes: ['html'],
          },
        }}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText(/platform does not accept assessment/i)).toBeInTheDocument();
  });

  it('should switch between builder and preview tabs', async () => {
    const user = userEvent.setup();
    
    render(
      <DeepLinkingInterface
        launchSettings={mockLaunchSettings}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    // Initially shows builder
    expect(screen.getByText(/Assessment Type/i)).toBeInTheDocument();

    // Click preview tab
    const previewTab = screen.getByRole('tab', { name: /preview/i });
    await user.click(previewTab);

    // Should show preview
    expect(screen.getByText(/Assessment Preview/i)).toBeInTheDocument();

    // Click back to builder
    const builderTab = screen.getByRole('tab', { name: /builder/i });
    await user.click(builderTab);

    // Should show builder again
    expect(screen.getByText(/Assessment Type/i)).toBeInTheDocument();
  });

  it('should handle assessment configuration changes', async () => {
    const user = userEvent.setup();
    
    render(
      <DeepLinkingInterface
        launchSettings={mockLaunchSettings}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    // Change assessment type
    const typeSelect = screen.getByLabelText(/assessment type/i);
    await user.selectOptions(typeSelect, 'summative');

    // Change title
    const titleInput = screen.getByLabelText(/title/i);
    await user.clear(titleInput);
    await user.type(titleInput, 'Unit Test Assessment');

    // Verify changes reflected in preview
    const previewTab = screen.getByRole('tab', { name: /preview/i });
    await user.click(previewTab);
    
    expect(screen.getByText(/Unit Test Assessment/i)).toBeInTheDocument();
    expect(screen.getByText(/summative/i)).toBeInTheDocument();
  });

  it('should submit assessment deep link successfully', async () => {
    const user = userEvent.setup();
    
    render(
      <DeepLinkingInterface
        launchSettings={mockLaunchSettings}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    // Fill in required fields
    const titleInput = screen.getByLabelText(/title/i);
    await user.type(titleInput, 'Test Assessment');

    const focusInput = screen.getByLabelText(/assessment focus/i);
    await user.type(focusInput, 'Testing knowledge of React components');

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /create assessment/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(assessmentDeepLink.submitAssessmentDeepLink).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('Test Assessment'),
          aiGuidance: expect.objectContaining({
            assessmentFocus: expect.stringContaining('Testing knowledge'),
          }),
        }),
        'test-jwt-token',
        expect.any(String),
        'https://canvas.test/return'
      );
    });

    expect(mockOnComplete).toHaveBeenCalledWith('signed-jwt');
  });

  it('should handle submission errors gracefully', async () => {
    const user = userEvent.setup();
    const errorMessage = 'Failed to create assessment';
    
    vi.mocked(assessmentDeepLink.submitAssessmentDeepLink).mockRejectedValue(
      new Error(errorMessage)
    );

    render(
      <DeepLinkingInterface
        launchSettings={mockLaunchSettings}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /create assessment/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(new RegExp(errorMessage, 'i'))).toBeInTheDocument();
    });

    expect(mockOnComplete).not.toHaveBeenCalled();
  });

  it('should handle cancel action', async () => {
    const user = userEvent.setup();
    
    render(
      <DeepLinkingInterface
        launchSettings={mockLaunchSettings}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
    expect(mockOnComplete).not.toHaveBeenCalled();
  });

  it('should validate required fields before submission', async () => {
    const user = userEvent.setup();
    
    render(
      <DeepLinkingInterface
        launchSettings={mockLaunchSettings}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    // Try to submit without filling required fields
    const submitButton = screen.getByRole('button', { name: /create assessment/i });
    await user.click(submitButton);

    // Should show validation errors
    expect(screen.getByText(/title is required/i)).toBeInTheDocument();
    expect(screen.getByText(/assessment focus is required/i)).toBeInTheDocument();

    // Should not have submitted
    expect(assessmentDeepLink.submitAssessmentDeepLink).not.toHaveBeenCalled();
  });

  it('should handle adding and removing questions', async () => {
    const user = userEvent.setup();
    
    render(
      <DeepLinkingInterface
        launchSettings={mockLaunchSettings}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    // Add a question
    const addQuestionButton = screen.getByRole('button', { name: /add question/i });
    await user.click(addQuestionButton);

    // Should show question input
    expect(screen.getByLabelText(/question 1/i)).toBeInTheDocument();

    // Add another question
    await user.click(addQuestionButton);
    expect(screen.getByLabelText(/question 2/i)).toBeInTheDocument();

    // Remove first question
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    await user.click(removeButtons[0]);

    // Should only have one question now
    expect(screen.queryByLabelText(/question 2/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/question 1/i)).toBeInTheDocument();
  });

  it('should update mastery threshold', async () => {
    const user = userEvent.setup();
    
    render(
      <DeepLinkingInterface
        launchSettings={mockLaunchSettings}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    const thresholdInput = screen.getByLabelText(/mastery threshold/i);
    await user.clear(thresholdInput);
    await user.type(thresholdInput, '85');

    // Submit and verify threshold is included
    const submitButton = screen.getByRole('button', { name: /create assessment/i });
    
    // Fill required fields first
    await user.type(screen.getByLabelText(/title/i), 'Test');
    await user.type(screen.getByLabelText(/assessment focus/i), 'Test Focus');
    
    await user.click(submitButton);

    await waitFor(() => {
      expect(assessmentDeepLink.submitAssessmentDeepLink).toHaveBeenCalledWith(
        expect.objectContaining({
          masteryThreshold: 85,
        }),
        expect.any(String),
        expect.any(String),
        expect.any(String)
      );
    });
  });
});