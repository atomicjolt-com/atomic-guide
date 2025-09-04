/**
 * @fileoverview Tests for AssessmentPreview component
 * @module features/assessment/client/components/AssessmentPreview.test
 */

import {  describe, it, expect, vi , MockFactory, TestDataFactory, ServiceTestHarness } from '@/tests/infrastructure';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssessmentPreview } from './AssessmentPreview';
import { defaultAssessmentConfig } from '../../shared/schemas/assessment.schema';
import type { AssessmentConfig } from '../../shared/schemas/assessment.schema';

import type { MockD1Database, MockKVNamespace, MockQueue } from '@/tests/infrastructure/types/mocks';
describe('AssessmentPreview', () => {
  const defaultProps = {
    config: defaultAssessmentConfig,
    onBack: vi.fn(),
    onSubmit: vi.fn(),
    isSubmitting: false,
  };

  beforeEach(async () => {
    // Setup test infrastructure - removed ServiceTestHarness as this tests React components
    
    
    ;
  
  });

  describe('Rendering', () => {
    it('should render assessment preview interface', () => {
      render(<AssessmentPreview {...defaultProps} />);

      expect(screen.getByText(/preview/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create link/i })).toBeInTheDocument();
    });

    it('should display assessment title', () => {
      const configWithTitle: AssessmentConfig = {
        ...defaultAssessmentConfig,
        title: 'Mathematics Quiz',
      };

      render(<AssessmentPreview {...defaultProps} config={configWithTitle} />);

      expect(screen.getByText('Mathematics Quiz')).toBeInTheDocument();
    });

    it('should display assessment type', () => {
      const configWithType: AssessmentConfig = {
        ...defaultAssessmentConfig,
        assessmentType: 'summative',
      };

      render(<AssessmentPreview {...defaultProps} config={configWithType} />);

      expect(screen.getByText(/summative/i)).toBeInTheDocument();
    });

    it('should display assessment description when provided', () => {
      const configWithDescription: AssessmentConfig = {
        ...defaultAssessmentConfig,
        description: 'This is a test assessment',
      };

      render(<AssessmentPreview {...defaultProps} config={configWithDescription} />);

      expect(screen.getByText('This is a test assessment')).toBeInTheDocument();
    });

    it('should not display description section when not provided', () => {
      const configWithoutDescription: AssessmentConfig = {
        ...defaultAssessmentConfig,
        description: undefined,
      };

      render(<AssessmentPreview {...defaultProps} config={configWithoutDescription} />);

      // Should not show empty description
      expect(screen.queryByText(/description/i)).not.toBeInTheDocument();
    });
  });

  describe('Questions Display', () => {
    it('should display question count', () => {
      const configWithQuestions: AssessmentConfig = {
        ...defaultAssessmentConfig,
        questions: [
          {
            id: '1',
            text: 'Question 1',
            type: 'multiple_choice',
            points: 10,
          },
          {
            id: '2',
            text: 'Question 2',
            type: 'short_answer',
            points: 15,
          },
        ],
      };

      render(<AssessmentPreview {...defaultProps} config={configWithQuestions} />);

      expect(screen.getByText(/2 questions?/i)).toBeInTheDocument();
    });

    it('should display individual questions', () => {
      const configWithQuestions: AssessmentConfig = {
        ...defaultAssessmentConfig,
        questions: [
          {
            id: '1',
            text: 'What is 2 + 2?',
            type: 'multiple_choice',
            points: 10,
          },
          {
            id: '2',
            text: 'Explain the process',
            type: 'essay',
            points: 20,
          },
        ],
      };

      render(<AssessmentPreview {...defaultProps} config={configWithQuestions} />);

      expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument();
      expect(screen.getByText('Explain the process')).toBeInTheDocument();
    });

    it('should display question types', () => {
      const configWithQuestions: AssessmentConfig = {
        ...defaultAssessmentConfig,
        questions: [
          {
            id: '1',
            text: 'Multiple choice question',
            type: 'multiple_choice',
            points: 10,
          },
          {
            id: '2',
            text: 'Short answer question',
            type: 'short_answer',
            points: 15,
          },
        ],
      };

      render(<AssessmentPreview {...defaultProps} config={configWithQuestions} />);

      // Check for question types in the question headers specifically
      const questionTypes = screen.getAllByText(/multiple.choice/i);
      expect(questionTypes.length).toBeGreaterThan(0);

      const shortAnswerTypes = screen.getAllByText(/short.answer/i);
      expect(shortAnswerTypes.length).toBeGreaterThan(0);
    });

    it('should display question points', () => {
      const configWithQuestions: AssessmentConfig = {
        ...defaultAssessmentConfig,
        questions: [
          {
            id: '1',
            text: 'Test question',
            type: 'multiple_choice',
            points: 25,
          },
        ],
      };

      render(<AssessmentPreview {...defaultProps} config={configWithQuestions} />);

      expect(screen.getByText(/25 points?/i)).toBeInTheDocument();
    });
  });

  describe('Grading Information', () => {
    it('should display max score', () => {
      const configWithGrading: AssessmentConfig = {
        ...defaultAssessmentConfig,
        gradingSchema: {
          type: 'points',
          maxScore: 100,
          passingScore: 70,
        },
      };

      render(<AssessmentPreview {...defaultProps} config={configWithGrading} />);

      expect(screen.getByText(/100/)).toBeInTheDocument();
    });

    it('should display passing score', () => {
      const configWithGrading: AssessmentConfig = {
        ...defaultAssessmentConfig,
        gradingSchema: {
          type: 'points',
          maxScore: 100,
          passingScore: 75,
        },
      };

      render(<AssessmentPreview {...defaultProps} config={configWithGrading} />);

      expect(screen.getByText(/75/)).toBeInTheDocument();
    });

    it('should display mastery threshold', () => {
      const configWithMastery: AssessmentConfig = {
        ...defaultAssessmentConfig,
        masteryThreshold: 85,
      };

      render(<AssessmentPreview {...defaultProps} config={configWithMastery} />);

      expect(screen.getByText(/85%/)).toBeInTheDocument();
    });
  });

  describe('AI Guidance Information', () => {
    it('should display allowed attempts', () => {
      const configWithAI: AssessmentConfig = {
        ...defaultAssessmentConfig,
        aiGuidance: {
          assessmentFocus: 'Critical thinking',
          keyConceptsToTest: ['analysis', 'synthesis'],
          allowedAttempts: 3,
        },
      };

      render(<AssessmentPreview {...defaultProps} config={configWithAI} />);

      expect(screen.getByText(/3 attempts?/i)).toBeInTheDocument();
    });

    it('should display assessment focus', () => {
      const configWithAI: AssessmentConfig = {
        ...defaultAssessmentConfig,
        aiGuidance: {
          assessmentFocus: 'Problem solving skills',
          keyConceptsToTest: ['logic', 'reasoning'],
          allowedAttempts: 1,
        },
      };

      render(<AssessmentPreview {...defaultProps} config={configWithAI} />);

      expect(screen.getByText('Problem solving skills')).toBeInTheDocument();
    });

    it('should display key concepts', () => {
      const configWithAI: AssessmentConfig = {
        ...defaultAssessmentConfig,
        aiGuidance: {
          assessmentFocus: 'Mathematics',
          keyConceptsToTest: ['algebra', 'geometry', 'calculus'],
          allowedAttempts: 1,
        },
      };

      render(<AssessmentPreview {...defaultProps} config={configWithAI} />);

      expect(screen.getByText(/algebra/i)).toBeInTheDocument();
      expect(screen.getByText(/geometry/i)).toBeInTheDocument();
      expect(screen.getByText(/calculus/i)).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onBack when back button is clicked', async () => {
      const user = userEvent.setup();
      const onBack = vi.fn();

      render(<AssessmentPreview {...defaultProps} onBack={onBack} />);

      const backButton = screen.getByRole('button', { name: /back/i });
      await user.click(backButton);

      expect(onBack).toHaveBeenCalled();
    });

    it('should call onSubmit when submit button is clicked', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();

      // Create config with questions so button is not disabled
      const configWithQuestions: AssessmentConfig = {
        ...defaultAssessmentConfig,
        questions: [
          {
            id: '1',
            text: 'Test question',
            type: 'multiple_choice',
            points: 10,
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 'A',
          },
        ],
      };

      render(<AssessmentPreview {...defaultProps} config={configWithQuestions} onSubmit={onSubmit} />);

      const submitButton = screen.getByRole('button', { name: /create link/i });
      await user.click(submitButton);

      expect(onSubmit).toHaveBeenCalled();
    });

    it('should disable submit button when submitting', () => {
      render(<AssessmentPreview {...defaultProps} isSubmitting={true} />);

      const submitButton = screen.getByRole('button', { name: /creating/i });
      expect(submitButton).toBeDisabled();
    });

    it('should change submit button text when submitting', () => {
      render(<AssessmentPreview {...defaultProps} isSubmitting={true} />);

      expect(screen.getByRole('button', { name: /creating/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /create link/i })).not.toBeInTheDocument();
    });
  });

  describe('Settings Display', () => {
    it('should display time limit when set', () => {
      const configWithTimeLimit: AssessmentConfig = {
        ...defaultAssessmentConfig,
        timeLimit: 30,
      };

      render(<AssessmentPreview {...defaultProps} config={configWithTimeLimit} />);

      expect(screen.getByText(/30 minutes?/i)).toBeInTheDocument();
    });

    it('should not display time limit when not set', () => {
      const configWithoutTimeLimit: AssessmentConfig = {
        ...defaultAssessmentConfig,
        timeLimit: undefined,
      };

      render(<AssessmentPreview {...defaultProps} config={configWithoutTimeLimit} />);

      expect(screen.queryByText(/time limit/i)).not.toBeInTheDocument();
    });

    it('should display shuffle questions setting', () => {
      const configWithShuffle: AssessmentConfig = {
        ...defaultAssessmentConfig,
        shuffleQuestions: true,
      };

      render(<AssessmentPreview {...defaultProps} config={configWithShuffle} />);

      expect(screen.getByText(/shuffle/i)).toBeInTheDocument();
    });

    it('should display feedback setting', () => {
      const configWithFeedback: AssessmentConfig = {
        ...defaultAssessmentConfig,
        showFeedback: true,
      };

      render(<AssessmentPreview {...defaultProps} config={configWithFeedback} />);

      // Check for "Show Feedback" label and its value
      expect(screen.getByText('Show Feedback:')).toBeInTheDocument();
      expect(screen.getByText('Enabled')).toBeInTheDocument();
    });
  });

  describe('Empty States', () => {
    it('should handle empty questions array', () => {
      const configWithNoQuestions: AssessmentConfig = {
        ...defaultAssessmentConfig,
        questions: [],
      };

      render(<AssessmentPreview {...defaultProps} config={configWithNoQuestions} />);

      expect(screen.getByText(/0 questions?/i)).toBeInTheDocument();
    });

    it('should handle empty key concepts', () => {
      const configWithEmptyKeywords: AssessmentConfig = {
        ...defaultAssessmentConfig,
        aiGuidance: {
          assessmentFocus: 'Test focus',
          keyConceptsToTest: [],
          allowedAttempts: 1,
        },
      };

      render(<AssessmentPreview {...defaultProps} config={configWithEmptyKeywords} />);

      expect(screen.getByText('Test focus')).toBeInTheDocument();
      // Should not show empty concepts section
      expect(screen.queryByText(/key concepts/i)).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper button roles', () => {
      render(<AssessmentPreview {...defaultProps} />);

      const backButton = screen.getByRole('button', { name: /back/i });
      const submitButton = screen.getByRole('button', { name: /create link/i });

      expect(backButton).toBeInTheDocument();
      expect(submitButton).toBeInTheDocument();
    });

    it('should have proper heading structure', () => {
      const configWithTitle: AssessmentConfig = {
        ...defaultAssessmentConfig,
        title: 'Test Assessment',
      };

      render(<AssessmentPreview {...defaultProps} config={configWithTitle} />);

      const mainHeading = screen.getByRole('heading', { level: 2 });
      expect(mainHeading).toHaveTextContent('Assessment Preview');
    });

    it('should have disabled state for submit button when submitting', () => {
      render(<AssessmentPreview {...defaultProps} isSubmitting={true} />);

      const submitButton = screen.getByRole('button', { name: /creating/i });
      expect(submitButton).toHaveAttribute('disabled');
    });
  });
});
