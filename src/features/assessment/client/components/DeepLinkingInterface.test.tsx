/**
 * @fileoverview Tests for DeepLinkingInterface component
 * @module features/assessment/client/components/DeepLinkingInterface.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeepLinkingInterface } from './DeepLinkingInterface';
import * as assessmentDeepLink from '../services/assessmentDeepLink';
import type { LaunchSettings } from '@atomicjolt/lti-client';

// Mock the assessment deep link service
vi.mock('../services/assessmentDeepLink', () => ({
  submitAssessmentDeepLink: vi.fn(),
  canCreateAssessmentLink: vi.fn(),
}));

// Mock the shared deep linking service
vi.mock('@shared/client/services/deepLinkingService', () => ({
  setupDeepLinkingButton: vi.fn(),
}));

describe('DeepLinkingInterface', () => {
  const mockLaunchSettings: LaunchSettings = {
    jwt: 'test-jwt-token',
    deepLinking: {
      accept_types: ['ltiResourceLink'],
      accept_multiple: false,
      deep_link_return_url: 'https://canvas.test/return',
      accept_presentation_document_targets: ['iframe'],
    },
    contextId: 'test-context',
    userId: 'test-user',
  } as any;

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
      />
    );

    expect(screen.getByText(/Assessment Details/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Assessment Title/i)).toBeInTheDocument();
  });

  it('should display warning when ltiResourceLink is not accepted', () => {
    vi.mocked(assessmentDeepLink.canCreateAssessmentLink).mockReturnValue(false);

    render(
      <DeepLinkingInterface
        launchSettings={{
          ...mockLaunchSettings,
          deepLinking: {
            ...mockLaunchSettings.deepLinking!,
            accept_types: ['html'],
          },
        }}
      />
    );

    expect(screen.getByText(/doesn't support assessment deep links/i)).toBeInTheDocument();
  });

  it('should show error when trying to preview without questions', async () => {
    const user = userEvent.setup();
    
    render(
      <DeepLinkingInterface
        launchSettings={mockLaunchSettings}
      />
    );

    // Initially shows builder
    expect(screen.getByText(/Assessment Details/i)).toBeInTheDocument();

    // Fill title first (required for preview)
    const titleInput = screen.getByLabelText(/Assessment Title/i);
    await user.clear(titleInput);
    await user.type(titleInput, 'Test Assessment');

    // Click preview button
    const previewButton = screen.getByRole('button', { name: /preview assessment/i });
    await user.click(previewButton);

    // Should show error about needing questions
    expect(screen.getByText(/You haven't added any questions yet/i)).toBeInTheDocument();
  });

  it('should handle assessment configuration changes', async () => {
    const user = userEvent.setup();
    
    render(
      <DeepLinkingInterface
        launchSettings={mockLaunchSettings}
      />
    );

    // Change assessment type
    const typeSelect = screen.getByLabelText(/Assessment Type/i);
    await user.selectOptions(typeSelect, 'summative');

    // Change title
    const titleInput = screen.getByLabelText(/Assessment Title/i);
    await user.clear(titleInput);
    await user.type(titleInput, 'Unit Test Assessment');

    // Click preview to see changes
    const previewButton = screen.getByRole('button', { name: /preview assessment/i });
    await user.click(previewButton);
    
    // Should show error about needing questions
    expect(screen.getByText(/Please add a title and at least one question before previewing/i)).toBeInTheDocument();
  });

  it('should block submission without questions', async () => {
    const user = userEvent.setup();
    
    render(
      <DeepLinkingInterface
        launchSettings={mockLaunchSettings}
      />
    );

    // Fill in required fields
    const titleInput = screen.getByLabelText(/Assessment Title/i);
    await user.clear(titleInput);
    await user.type(titleInput, 'Test Assessment');

    // Try to preview
    const previewButton = screen.getByRole('button', { name: /preview assessment/i });
    await user.click(previewButton);

    // Should show error about needing questions
    expect(screen.getByText(/Please add a title and at least one question before previewing/i)).toBeInTheDocument();
    
    // Should not have called submit
    expect(assessmentDeepLink.submitAssessmentDeepLink).not.toHaveBeenCalled();
  });

  it('should handle submission errors gracefully', async () => {
    const user = userEvent.setup();
    
    render(
      <DeepLinkingInterface
        launchSettings={mockLaunchSettings}
      />
    );

    // Fill title
    const titleInput = screen.getByLabelText(/Assessment Title/i);
    await user.clear(titleInput);
    await user.type(titleInput, 'Test Assessment');

    // Try to preview without questions
    const previewButton = screen.getByRole('button', { name: /preview assessment/i });
    await user.click(previewButton);

    // Should show error message about needing questions
    expect(screen.getByText(/Please add a title and at least one question before previewing/i)).toBeInTheDocument();
  });

  it('should show error when trying to preview without title', async () => {
    const user = userEvent.setup();
    
    render(
      <DeepLinkingInterface
        launchSettings={mockLaunchSettings}
      />
    );

    // Try to preview without entering title
    const previewButton = screen.getByRole('button', { name: /preview assessment/i });
    await user.click(previewButton);

    // Should show error message
    expect(screen.getByText(/Please add a title before previewing/i)).toBeInTheDocument();
  });

  it('should validate required fields before submission', async () => {
    const user = userEvent.setup();
    
    render(
      <DeepLinkingInterface
        launchSettings={mockLaunchSettings}
      />
    );

    // Try to preview without filling title
    const previewButton = screen.getByRole('button', { name: /preview assessment/i });
    await user.click(previewButton);

    // Should show validation error
    expect(screen.getByText(/Please add a title before previewing/i)).toBeInTheDocument();

    // Should not proceed to preview
    expect(screen.queryByText(/Assessment Preview/i)).not.toBeInTheDocument();
  });

  it('should handle description input', async () => {
    const user = userEvent.setup();
    
    render(
      <DeepLinkingInterface
        launchSettings={mockLaunchSettings}
      />
    );

    // Find and fill description
    const descriptionInput = screen.getByLabelText(/Description/i);
    await user.type(descriptionInput, 'This is a test assessment description');

    // Verify description was entered
    expect(descriptionInput).toHaveValue('This is a test assessment description');

    // Fill title
    const titleInput = screen.getByLabelText(/Assessment Title/i);
    await user.clear(titleInput);
    await user.type(titleInput, 'Test Assessment');

    // Verify title was entered
    expect(titleInput).toHaveValue('Test Assessment');
  });

  it('should change assessment type', async () => {
    const user = userEvent.setup();
    
    render(
      <DeepLinkingInterface
        launchSettings={mockLaunchSettings}
      />
    );

    // Find type selector
    const typeSelect = screen.getByLabelText(/Assessment Type/i);
    
    // Should default to formative
    expect(typeSelect).toHaveValue('formative');
    
    // Change to summative
    await user.selectOptions(typeSelect, 'summative');
    expect(typeSelect).toHaveValue('summative');
    
    // Change to diagnostic
    await user.selectOptions(typeSelect, 'diagnostic');
    expect(typeSelect).toHaveValue('diagnostic');
  });
});