/**
 * @fileoverview Tests for AssessmentBuilder component
 * @module features/assessment/client/components/AssessmentBuilder.test
 */

import { describe, it, expect, vi } from 'vitest';
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

  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(screen.getByDisplayValue('summative')).toBeInTheDocument();
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
      await user.clear(titleInput);
      await user.type(titleInput, 'New Assessment Title');

      expect(onConfigChange).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Assessment Title',
        })
      );
    });

    it('should call onConfigChange when description changes', async () => {
      const user = userEvent.setup();
      const onConfigChange = vi.fn();

      render(<AssessmentBuilder {...defaultProps} onConfigChange={onConfigChange} />);

      const descriptionInput = screen.getByLabelText(/description/i);
      await user.clear(descriptionInput);
      await user.type(descriptionInput, 'New description');

      expect(onConfigChange).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'New description',
        })
      );
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

      const typeSelect = screen.getByLabelText(/type/i);
      const options = screen.getAllByRole('option');
      const optionValues = options.map(option => option.getAttribute('value'));

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

      render(
        <AssessmentBuilder 
          {...defaultProps} 
          config={configWithQuestions} 
          onConfigChange={onConfigChange} 
        />
      );

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

      render(
        <AssessmentBuilder 
          {...defaultProps} 
          contentContext={contentContext} 
        />
      );

      expect(screen.getByText(/Mathematics: Quadratic Equations/)).toBeInTheDocument();
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

      render(<AssessmentBuilder {...defaultProps} onConfigChange={onConfigChange} />);

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

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Assessment Details');
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

      render(
        <AssessmentBuilder 
          {...defaultProps} 
          config={complexConfig} 
          onConfigChange={onConfigChange} 
        />
      );

      const titleInput = screen.getByLabelText(/title/i);
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Title');

      expect(onConfigChange).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Updated Title',
          masteryThreshold: 85,
          gradingSchema: complexConfig.gradingSchema,
          aiGuidance: complexConfig.aiGuidance,
          shuffleQuestions: true,
          showFeedback: false,
        })
      );
    });
  });
});