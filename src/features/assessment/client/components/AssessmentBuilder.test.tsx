/**
 * @fileoverview Tests for AssessmentBuilder component
 * @module features/assessment/client/components/AssessmentBuilder.test
 */

import { describe, it, expect, vi } from '@/tests/infrastructure';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssessmentBuilder } from './AssessmentBuilder';
import { defaultAssessmentConfig } from '../../shared/schemas/assessment.schema';
import type { AssessmentConfig } from '../../shared/schemas/assessment.schema';

describe('AssessmentBuilder', () => {
  const defaultProps = {
    config: defaultAssessmentConfig,
    onConfigChange: vi.fn(),
    onPreview: vi.fn(),
  };

  beforeEach(async () => {
    // Setup test infrastructure - removed ServiceTestHarness as this tests React components
  });

  describe('Rendering', () => {
    it('should render basic assessment builder interface', () => {
      render(<AssessmentBuilder {...defaultProps} />);

      expect(screen.getByText('Assessment Details')).toBeInTheDocument();
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/type/i)).toBeInTheDocument();
    });

    it('should display current configuration values', () => {
      const customConfig: AssessmentConfig = {
        ...defaultAssessmentConfig,
        title: 'Custom Assessment',
        description: 'A custom description',
        assessmentType: 'summative',
      };

      render(<AssessmentBuilder {...defaultProps} config={customConfig} />);

      expect(screen.getByDisplayValue('Custom Assessment')).toBeInTheDocument();
      expect(screen.getByDisplayValue('A custom description')).toBeInTheDocument();

      // For select elements, check the selected value differently
      const select = screen.getByLabelText(/type/i) as HTMLSelectElement;
      expect(select.value).toBe('summative');
    });

    it('should render preview button', () => {
      render(<AssessmentBuilder {...defaultProps} />);

      const previewButton = screen.getByRole('button', { name: /preview/i });
      expect(previewButton).toBeInTheDocument();
    });
  });

  describe('Form Interactions', () => {
    it('should call onConfigChange when title changes', async () => {
      const user = userEvent.setup();
      const onConfigChange = vi.fn();

      render(<AssessmentBuilder {...defaultProps} onConfigChange={onConfigChange} />);

      const titleInput = screen.getByLabelText(/title/i);

      // Just type into the field, which should trigger onChange
      await user.click(titleInput);
      await user.keyboard('X');

      // Verify onConfigChange was called
      expect(onConfigChange).toHaveBeenCalled();

      // Verify that all calls have the title property
      const calls = onConfigChange.mock.calls;
      expect(calls.length).toBeGreaterThan(0);

      // Check that all calls have a config object with a title property
      const allCallsHaveTitle = calls.every((call) => call[0] && typeof call[0].title === 'string');
      expect(allCallsHaveTitle).toBe(true);
    });

    it('should call onConfigChange when description changes', async () => {
      const user = userEvent.setup();
      const onConfigChange = vi.fn();

      render(<AssessmentBuilder {...defaultProps} onConfigChange={onConfigChange} />);

      const descriptionInput = screen.getByLabelText(/description/i);
      await user.type(descriptionInput, 'Test');

      // Verify onConfigChange was called
      expect(onConfigChange).toHaveBeenCalled();

      // Verify that at least one call has a non-empty description
      const calls = onConfigChange.mock.calls;
      const hasDescription = calls.some((call) => call[0]?.description && call[0].description.length > 0);
      expect(hasDescription).toBe(true);
    });

    it('should call onConfigChange when assessment type changes', async () => {
      const user = userEvent.setup();
      const onConfigChange = vi.fn();

      render(<AssessmentBuilder {...defaultProps} onConfigChange={onConfigChange} />);

      const typeSelect = screen.getByLabelText(/type/i);
      await user.selectOptions(typeSelect, 'summative');

      expect(onConfigChange).toHaveBeenCalledWith(
        expect.objectContaining({
          assessmentType: 'summative',
        })
      );
    });

    it('should call onPreview when preview button is clicked', async () => {
      const user = userEvent.setup();
      const onPreview = vi.fn();

      render(<AssessmentBuilder {...defaultProps} onPreview={onPreview} />);

      const previewButton = screen.getByRole('button', { name: /preview/i });
      await user.click(previewButton);

      expect(onPreview).toHaveBeenCalled();
    });
  });

  describe('Assessment Types', () => {
    it('should have all assessment type options available', () => {
      render(<AssessmentBuilder {...defaultProps} />);

      const _typeSelect = screen.getByLabelText(/type/i);
      const options = screen.getAllByRole('option');
      const optionValues = options.map((option) => option.getAttribute('value'));

      expect(optionValues).toContain('formative');
      expect(optionValues).toContain('summative');
      expect(optionValues).toContain('diagnostic');
    });

    it('should preserve other config properties when type changes', async () => {
      const user = userEvent.setup();
      const onConfigChange = vi.fn();
      const configWithQuestions: AssessmentConfig = {
        ...defaultAssessmentConfig,
        questions: [
          {
            id: '1',
            text: 'Test question',
            type: 'multiple_choice',
            points: 10,
          },
        ],
      };

      render(<AssessmentBuilder {...defaultProps} config={configWithQuestions} onConfigChange={onConfigChange} />);

      const typeSelect = screen.getByLabelText(/type/i);
      await user.selectOptions(typeSelect, 'summative');

      expect(onConfigChange).toHaveBeenCalledWith(
        expect.objectContaining({
          assessmentType: 'summative',
          questions: configWithQuestions.questions, // Should preserve existing questions
        })
      );
    });
  });

  describe('Content Context Integration', () => {
    it('should display content context when provided', () => {
      const contentContext = 'Mathematics: Quadratic Equations';

      render(<AssessmentBuilder {...defaultProps} contentContext={contentContext} />);

      expect(screen.getByText(/context-aware based on the current LMS page content/)).toBeInTheDocument();
    });

    it('should not display content context section when not provided', () => {
      render(<AssessmentBuilder {...defaultProps} contentContext={undefined} />);

      // Should not have a content context section
      expect(screen.queryByText(/content context/i)).not.toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should handle empty title input', async () => {
      const user = userEvent.setup();
      const onConfigChange = vi.fn();

      render(<AssessmentBuilder {...defaultProps} onConfigChange={onConfigChange} />);

      const titleInput = screen.getByLabelText(/title/i);
      await user.clear(titleInput);

      expect(onConfigChange).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '',
        })
      );
    });

    it('should handle empty description input', async () => {
      const user = userEvent.setup();
      const onConfigChange = vi.fn();

      // Start with a config that has a description
      const configWithDescription = {
        ...defaultAssessmentConfig,
        description: 'Initial description',
      };

      render(<AssessmentBuilder {...defaultProps} config={configWithDescription} onConfigChange={onConfigChange} />);

      const descriptionInput = screen.getByLabelText(/description/i);
      await user.clear(descriptionInput);

      expect(onConfigChange).toHaveBeenCalledWith(
        expect.objectContaining({
          description: '',
        })
      );
    });
  });

  describe('Accessibility', () => {
    it('should have proper form labels', () => {
      render(<AssessmentBuilder {...defaultProps} />);

      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/type/i)).toBeInTheDocument();
    });

    it('should have proper heading structure', () => {
      render(<AssessmentBuilder {...defaultProps} />);

      const headings = screen.getAllByRole('heading', { level: 2 });
      expect(headings).toHaveLength(2);
      expect(headings[0]).toHaveTextContent('Assessment Details');
      expect(headings[1]).toHaveTextContent('AI-Powered Questions');
    });

    it('should have accessible form controls', () => {
      render(<AssessmentBuilder {...defaultProps} />);

      const titleInput = screen.getByLabelText(/title/i);
      const descriptionInput = screen.getByLabelText(/description/i);
      const typeSelect = screen.getByLabelText(/type/i);

      expect(titleInput).toHaveAttribute('type', 'text');
      expect(descriptionInput.tagName.toLowerCase()).toBe('textarea');
      expect(typeSelect.tagName.toLowerCase()).toBe('select');
    });
  });

  describe('Configuration Preservation', () => {
    it('should preserve all config properties when updating individual fields', async () => {
      const user = userEvent.setup();
      const onConfigChange = vi.fn();
      const complexConfig: AssessmentConfig = {
        ...defaultAssessmentConfig,
        masteryThreshold: 85,
        gradingSchema: {
          type: 'points',
          maxScore: 200,
          passingScore: 140,
        },
        aiGuidance: {
          assessmentFocus: 'Critical thinking',
          keyConceptsToTest: ['analysis', 'synthesis'],
          allowedAttempts: 3,
        },
        shuffleQuestions: true,
        showFeedback: false,
      };

      render(<AssessmentBuilder {...defaultProps} config={complexConfig} onConfigChange={onConfigChange} />);

      const titleInput = screen.getByLabelText(/title/i);
      await user.tripleClick(titleInput);
      await user.keyboard('New');

      // Verify onConfigChange was called and preserves the complex config properties
      expect(onConfigChange).toHaveBeenCalled();

      // Check that the complex properties are preserved in the calls
      const calls = onConfigChange.mock.calls;
      const preservesProperties = calls.some(
        (call) => call[0]?.masteryThreshold === 85 && call[0]?.shuffleQuestions === true && call[0]?.showFeedback === false
      );

      expect(preservesProperties).toBe(true);
    });
  });
});
