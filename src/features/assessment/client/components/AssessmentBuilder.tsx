/**
 * @fileoverview Assessment builder component for creating AI-powered assessments
 * @module features/assessment/client/components/AssessmentBuilder
 */

import { ReactElement, useState } from 'react';
import type { AssessmentConfig } from '../../shared/schemas/assessment.schema';
import { createQuestionGenerationApi, type QuestionGenerationOptions } from '../services/questionGenerationApi';
import styles from './AssessmentBuilder.module.css';

interface AssessmentBuilderProps {
  config: AssessmentConfig;
  onConfigChange: (config: AssessmentConfig) => void;
  onPreview: () => void;
  contentContext?: string;
  jwt?: string;
}

/**
 * Assessment builder interface for configuring AI-guided assessments
 */
export function AssessmentBuilder({ config, onConfigChange, onPreview, contentContext, jwt }: AssessmentBuilderProps): ReactElement {
  const [isGenerating, setIsGenerating] = useState(false);
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    onConfigChange({
      ...config,
      title: e.target.value,
    });
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    onConfigChange({
      ...config,
      description: e.target.value,
    });
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    onConfigChange({
      ...config,
      assessmentType: e.target.value as 'formative' | 'summative' | 'diagnostic',
    });
  };

  const handleGenerateQuestions = async (): Promise<void> => {
    if (!jwt || !contentContext) {
      return;
    }

    setIsGenerating(true);

    try {
      const questionApi = createQuestionGenerationApi(jwt);

      const options: QuestionGenerationOptions = {
        count: 5,
        difficulty: 3,
        questionTypes: ['multiple_choice', 'short_answer', 'essay'],
        focusAreas: config.aiGuidance.keyConceptsToTest,
      };

      const questions = await questionApi.generateQuestions(
        {
          rawContent: contentContext,
          title: config.title,
          concepts: config.aiGuidance.keyConceptsToTest,
        },
        config,
        options
      );

      // Update the config with generated questions
      onConfigChange({
        ...config,
        questions: [...config.questions, ...questions],
      });
    } catch (error) {
      console.error('Failed to generate questions:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRemoveQuestion = (questionId: string): void => {
    onConfigChange({
      ...config,
      questions: config.questions.filter((q) => q.id !== questionId),
    });
  };

  return (
    <div className={styles.builder}>
      <div className={styles.section}>
        <h2>Assessment Details</h2>

        <div className={styles.field}>
          <label htmlFor="title">Assessment Title *</label>
          <input id="title" type="text" value={config.title} onChange={handleTitleChange} placeholder="Enter assessment title" required />
        </div>

        <div className={styles.field}>
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={config.description || ''}
            onChange={handleDescriptionChange}
            placeholder="Describe the assessment purpose and content"
            rows={3}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="type">Assessment Type</label>
          <select id="type" value={config.assessmentType} onChange={handleTypeChange}>
            <option value="formative">Formative (Practice)</option>
            <option value="summative">Summative (Graded)</option>
            <option value="diagnostic">Diagnostic</option>
          </select>
        </div>
      </div>

      {contentContext && (
        <div className={styles.contextInfo}>
          <span className={styles.contextIcon}>📄</span>
          <p>This assessment will be context-aware based on the current LMS page content</p>
        </div>
      )}

      <div className={styles.section}>
        <h2>AI-Powered Questions</h2>

        {contentContext ? (
          <div className={styles.aiSection}>
            <p className={styles.aiDescription}>
              Generate questions automatically based on the current page content and your learning objectives.
            </p>

            <button
              className={styles.generateButton}
              onClick={handleGenerateQuestions}
              disabled={isGenerating || !config.title}
              type="button"
            >
              {isGenerating ? (
                <>
                  <span className={styles.spinner}></span>
                  Generating Questions...
                </>
              ) : (
                <>🤖 Generate AI Questions</>
              )}
            </button>

            {config.questions.length > 0 && (
              <div className={styles.questionsList}>
                <h3>Current Questions ({config.questions.length})</h3>
                {config.questions.map((question, index) => (
                  <div key={question.id} className={styles.questionItem}>
                    <div className={styles.questionHeader}>
                      <span className={styles.questionNumber}>Q{index + 1}</span>
                      <span className={styles.questionType}>{question.type.replace('_', ' ')}</span>
                      <span className={styles.questionPoints}>{question.points} pts</span>
                      <button
                        className={styles.removeButton}
                        onClick={() => handleRemoveQuestion(question.id)}
                        type="button"
                        title="Remove question"
                      >
                        ×
                      </button>
                    </div>
                    <div className={styles.questionText}>{question.text}</div>
                    {question.options && (
                      <div className={styles.questionOptions}>
                        {question.options.map((option, i) => (
                          <div key={i} className={styles.option}>
                            {String.fromCharCode(65 + i)}. {option}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className={styles.noContent}>
            <p>
              AI question generation will be available when launched from LMS content pages. Questions will be automatically generated based
              on the page content.
            </p>
          </div>
        )}
      </div>

      <div className={styles.actions}>
        <button className={styles.previewButton} onClick={onPreview} disabled={!config.title}>
          Preview Assessment
        </button>
      </div>
    </div>
  );
}
